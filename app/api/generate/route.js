import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const RATE_LIMIT = 20;

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

    const { prompt, file } = await req.json();
    if (!prompt) return Response.json({ error: "No prompt provided" }, { status: 400 });

    // Build message content — support PDF file input
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

    // Warn if response was cut off due to token limit
    if (data.stop_reason === "max_tokens") {
      return Response.json({ ...data, warning: "Response was truncated — try fewer questions per generation." });
    }

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
