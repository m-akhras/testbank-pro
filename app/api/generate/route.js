import Anthropic from "@anthropic-ai/sdk";

export const runtime = "edge";
export const maxDuration = 60;

const client = new Anthropic();

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return Response.json({ error: "No prompt provided" }, { status: 400 });

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    return Response.json({ result: text });
  } catch (err) {
    console.error("Generate error:", err);
    return Response.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}
