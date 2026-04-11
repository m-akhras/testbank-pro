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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 16000,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const data = await res.json();

    if (data.stop_reason === "max_tokens") {
      return Response.json({ ...data, warning: "Response was truncated — try fewer questions per generation." });
    }

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
