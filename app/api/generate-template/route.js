import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildMetaPrompt } from "../../../lib/templates/_generic/metaPrompt.js";

// Server-side admin check. The client-side `useAuth` in context/AppContext.js
// determines isAdmin by `user?.email === ADMIN_EMAIL`. We replicate that here
// because client booleans can't be trusted on the server — anyone with a valid
// Supabase session could otherwise hit this endpoint. Keep this in sync with
// context/AppContext.js's ADMIN_EMAIL constant.
const ADMIN_EMAIL = "mohammadalakhrass@yahoo.com";

// Limits chosen for template generation:
//   - Max 5 images (~5 textbook pages, plenty for the densest sections; beyond
//     that the meta-prompt's token budget is eaten by image tokens and Sonnet's
//     attention spreads thin)
//   - Max 5MB per image (Anthropic's own limit; catching here gives a friendlier
//     error than the API's cryptic refusal)
//   - Max 50KB pasted text (a generous cap on textbook-page text — 50KB is
//     ~12 pages of dense prose, which is far more than any reasonable section)
const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;

// Allowed image MIME types — what Anthropic's vision actually accepts.
const ALLOWED_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Model is configurable via TEMPLATE_GEN_MODEL env var (we picked sonnet 4.5
// as a sensible default, but you can switch to haiku for cost or to a newer
// model without touching code by setting the env var on Vercel).
const TEMPLATE_GEN_MODEL = process.env.TEMPLATE_GEN_MODEL || "claude-sonnet-4-5";

// Response cap. A complete template is ~140 lines / ~4-5K tokens of JS.
// 8000 gives ~2x headroom without paying for capacity we won't use.
const MAX_TOKENS = 8000;

export async function POST(req) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
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
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Admin gate ──────────────────────────────────────────────────────────
    const userEmail = session.user.email;
    if (userEmail !== ADMIN_EMAIL) {
      return Response.json(
        { error: "Forbidden: template generation is restricted to administrators." },
        { status: 403 }
      );
    }

    // ── Parse and validate request body ─────────────────────────────────────
    const body = await req.json();
    const { course, section, sectionTitle, textbook, text, images } = body;

    if (!course || typeof course !== "string") {
      return Response.json({ error: "Missing or invalid 'course'." }, { status: 400 });
    }
    if (!section || typeof section !== "string") {
      return Response.json({ error: "Missing or invalid 'section'." }, { status: 400 });
    }
    if (!sectionTitle || typeof sectionTitle !== "string") {
      return Response.json({ error: "Missing or invalid 'sectionTitle'." }, { status: 400 });
    }
    if (!textbook || typeof textbook !== "string") {
      return Response.json({ error: "Missing or invalid 'textbook'." }, { status: 400 });
    }
    if (!text && (!images || images.length === 0)) {
      return Response.json(
        { error: "Provide at least one of 'text' or 'images' as section materials." },
        { status: 400 }
      );
    }
    if (text && typeof text !== "string") {
      return Response.json({ error: "'text' must be a string." }, { status: 400 });
    }
    if (text && text.length > MAX_TEXT_CHARS) {
      return Response.json(
        { error: `'text' exceeds maximum size (${MAX_TEXT_CHARS.toLocaleString()} characters).` },
        { status: 400 }
      );
    }
    if (images !== undefined && !Array.isArray(images)) {
      return Response.json({ error: "'images' must be an array." }, { status: 400 });
    }
    if (Array.isArray(images) && images.length > MAX_IMAGES) {
      return Response.json(
        { error: `Too many images. Maximum ${MAX_IMAGES} per request; received ${images.length}.` },
        { status: 400 }
      );
    }

    // Per-image validation (shape + size + media type)
    const validatedImages = [];
    if (Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img || typeof img !== "object") {
          return Response.json(
            { error: `Image ${i + 1}: must be an object with mediaType and base64.` },
            { status: 400 }
          );
        }
        if (!ALLOWED_IMAGE_MEDIA_TYPES.has(img.mediaType)) {
          return Response.json(
            { error: `Image ${i + 1}: unsupported mediaType "${img.mediaType}". Allowed: JPEG, PNG, GIF, WebP.` },
            { status: 400 }
          );
        }
        if (typeof img.base64 !== "string" || img.base64.length === 0) {
          return Response.json(
            { error: `Image ${i + 1}: missing or empty base64 data.` },
            { status: 400 }
          );
        }
        // Base64 expands by ~33% over raw bytes. Decoded size = base64.length * 0.75 (approx).
        const approxBytes = Math.floor(img.base64.length * 0.75);
        if (approxBytes > MAX_IMAGE_BYTES) {
          return Response.json(
            {
              error: `Image ${i + 1}: ${(approxBytes / 1024 / 1024).toFixed(1)}MB exceeds ` +
                     `${(MAX_IMAGE_BYTES / 1024 / 1024)}MB per-image limit.`
            },
            { status: 400 }
          );
        }
        validatedImages.push(img);
      }
    }

    // ── Build the system prompt ─────────────────────────────────────────────
    let systemPrompt;
    try {
      systemPrompt = buildMetaPrompt({ course, section, sectionTitle, textbook });
    } catch (e) {
      // buildMetaPrompt throws for unknown courses (no slug mapping) or
      // missing required args. Surface as a 400 to make the error fixable.
      return Response.json({ error: e.message }, { status: 400 });
    }

    // ── Assemble user message (text + images) ───────────────────────────────
    // Order matters: text first (provides context for the images), then images,
    // then a final text turn that reinforces what to produce. This is the
    // pattern Anthropic recommends for multimodal prompts.
    const userContent = [];

    const materialsHeader =
      `Section materials for ${course} §${section} — ${sectionTitle}:\n\n` +
      (text ? text : "(no pasted text — see images)");
    userContent.push({ type: "text", text: materialsHeader });

    for (const img of validatedImages) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    }

    userContent.push({
      type: "text",
      text:
        `Now produce the complete template file as instructed in your system prompt. ` +
        `Use the exact export name and file structure shown in the system prompt's "YOUR TASK" section. ` +
        `Begin your response with "export const" and end with "};". No prose, no markdown fences.`,
    });

    // ── Call Anthropic ──────────────────────────────────────────────────────
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: TEMPLATE_GEN_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      // Mirror the existing /api/generate pattern: forward upstream status + body.
      return Response.json({ error: errText }, { status: anthropicRes.status });
    }

    const data = await anthropicRes.json();

    // Pull the text out of Anthropic's content blocks. Templates are single-block
    // text responses, but we iterate defensively in case Anthropic ever returns
    // multiple blocks (e.g. tool_use + text in a future model).
    const blocks = Array.isArray(data.content) ? data.content : [];
    const templateJs = blocks
      .filter(b => b?.type === "text")
      .map(b => b.text || "")
      .join("")
      .trim();

    if (!templateJs) {
      return Response.json(
        { error: "Anthropic returned an empty response.", raw: data },
        { status: 502 }
      );
    }

    // ── Sanity-check the output shape ───────────────────────────────────────
    // Sonnet usually obeys "no markdown fences" but we defensively strip them
    // here if it slips up. We do NOT try to fix anything more complex than
    // this — if the output is broken in some other way, the instructor will
    // see it in the preview pane and can iterate the prompt.
    let cleanJs = templateJs;
    if (cleanJs.startsWith("```")) {
      // Strip opening fence ("```js\n" or "```javascript\n" or "```\n")
      cleanJs = cleanJs.replace(/^```[a-zA-Z]*\n?/, "");
      // Strip closing fence
      cleanJs = cleanJs.replace(/```\s*$/, "");
      cleanJs = cleanJs.trim();
    }

    // Final shape check: must start with "export const" and end with a brace + semicolon.
    if (!cleanJs.startsWith("export const")) {
      return Response.json(
        {
          error: "Generated output does not start with 'export const'. Sonnet may have included preamble.",
          templateJs: cleanJs,
          stopReason: data.stop_reason,
        },
        { status: 502 }
      );
    }
    if (data.stop_reason === "max_tokens") {
      return Response.json(
        {
          error: "Generation hit max_tokens limit; template is likely truncated. Try a shorter section or split materials.",
          templateJs: cleanJs,
          stopReason: "max_tokens",
        },
        { status: 502 }
      );
    }

    // ── Success ─────────────────────────────────────────────────────────────
    return Response.json({
      templateJs: cleanJs,
      stopReason: data.stop_reason,
      usage: data.usage,
      model: data.model,
    });
  } catch (e) {
    // Mirror /api/generate's catch-all
    return Response.json({ error: e.message }, { status: 500 });
  }
}
