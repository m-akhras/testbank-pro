import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const RATE_LIMIT = 20;

// ── Validation prompt ────────────────────────────────────────────────────────
const VALIDATION_SYSTEM = `You are a mathematics answer validator for university-level exams.
You will be given a multiple choice question with its choices and stated correct answer.
Your job is to verify whether the stated correct answer is mathematically accurate.

Respond ONLY with a JSON object in this exact format, no preamble, no markdown:
{
  "valid": true,
  "corrected_answer": null,
  "reason": null
}

OR if the answer is wrong:
{
  "valid": false,
  "corrected_answer": "the correct answer text here",
  "reason": "brief explanation of the error"
}`;

async function validateQuestion(question) {
  const prompt = `Question: ${question.question}

Choices:
${(question.choices || []).map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join("\n")}

Stated correct answer: ${question.answer}

Is this answer mathematically correct?`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system: VALIDATION_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return { valid: true, corrected_answer: null, reason: null }; // fail silently

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { valid: true, corrected_answer: null, reason: null }; // fail silently
  }
}

// ── JSON repair for truncated responses ──────────────────────────────────────
function repairTruncatedJSON(text) {
  try {
    // Find the start of the JSON array
    const arrayStart = text.indexOf("[");
    if (arrayStart === -1) return null;
    const jsonPart = text.slice(arrayStart);

    // Try parsing as-is first
    try { JSON.parse(jsonPart); return jsonPart; } catch {}

    // Find the last complete object by scanning for },{ or }] patterns
    // Walk backwards from the end to find last complete closing brace
    let depth = 0;
    let lastCompleteEnd = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < jsonPart.length; i++) {
      const c = jsonPart[i];
      if (escape) { escape = false; continue; }
      if (c === '\\' && inString) { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) lastCompleteEnd = i; // end of a top-level object
      }
    }

    if (lastCompleteEnd === -1) return null;

    // Rebuild: take everything up to and including the last complete object, close the array
    const salvaged = jsonPart.slice(0, lastCompleteEnd + 1) + "]";
    JSON.parse(salvaged); // verify it parses
    return salvaged;
  } catch {
    return null;
  }
}

// ── Main route ───────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("api_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if (count >= RATE_LIMIT) {
      return Response.json({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT} generations per hour.` }, { status: 429 });
    }

    await supabase.from("api_usage").insert({ user_id: userId });

    const { prompt, file, questions } = await req.json();

    // ── Validation mode ──────────────────────────────────────────────────────
    // If questions array is passed, run validation only (no generation)
    if (questions && Array.isArray(questions)) {
      const results = await Promise.all(questions.map(validateQuestion));
      const validated = questions.map((q, i) => ({
        ...q,
        validation: results[i],
      }));
      return Response.json({ validated });
    }

    // ── Generation mode ──────────────────────────────────────────────────────
    if (!prompt) return Response.json({ error: "No prompt provided" }, { status: 400 });

    let messageContent;
    if (file?.base64 && file?.mediaType) {
      messageContent = [
        {
          type: "document",
          source: { type: "base64", media_type: file.mediaType, data: file.base64 },
        },
        { type: "text", text: prompt },
      ];
    } else {
      messageContent = prompt;
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 16000,
        stream: true,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return Response.json({ error: err }, { status: anthropicRes.status });
    }

    // Accumulate the full streamed text on the server, then return as normal JSON.
    let fullText = "";
    let stopReason = "";
    const decoder = new TextDecoder();
    const reader = anthropicRes.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            fullText += evt.delta.text;
          }
          if (evt.type === "message_delta" && evt.delta?.stop_reason) {
            stopReason = evt.delta.stop_reason;
          }
        } catch {}
      }
    }

    if (stopReason === "max_tokens") {
      const repaired = repairTruncatedJSON(fullText);
      if (repaired) {
        return Response.json({
          content: [{ type: "text", text: repaired }],
          stop_reason: "max_tokens",
          warning: "Response was truncated — some questions were recovered. Try generating fewer questions at once for best results."
        });
      }
      return Response.json({
        content: [{ type: "text", text: fullText }],
        stop_reason: "max_tokens",
        warning: "Response was truncated — try fewer questions per generation."
      });
    }

    return Response.json({
      content: [{ type: "text", text: fullText }],
      stop_reason: stopReason,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
