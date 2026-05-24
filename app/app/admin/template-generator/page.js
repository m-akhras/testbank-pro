"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useAppContext } from "../../../../context/AppContext.js";
import { makeStyles, text1, text2, text3, green1, bg2, border } from "../../../../lib/theme.js";
import { hasTemplate } from "../../../../lib/templates/registry.js";

// Per-image limit matches the server-side cap in app/api/generate-template/route.js.
// Keeping these in sync prevents the user from uploading then being rejected.
const MAX_IMG_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

/**
 * Split a section string like "1.3 New Functions from Old Functions" into:
 *   { number: "1.3", title: "New Functions from Old Functions" }
 *
 * If the format doesn't match, returns the whole string as the number with an
 * empty title. The API will reject empty titles, surfacing a clear error.
 */
function splitSectionString(s) {
  if (!s) return { number: "", title: "" };
  const m = s.match(/^(\S+)\s+(.+)$/);
  if (!m) return { number: s, title: "" };
  return { number: m[1], title: m[2] };
}

/**
 * Read a File object as a base64 string (without the data: prefix).
 * Mirrors the pattern used by components/course/CourseForm.jsx for
 * reference-image uploads, so the produced { name, mediaType, base64 }
 * shape matches what /api/generate-template expects.
 */
function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // result is "data:image/png;base64,iVBOR..."; strip the prefix.
      const comma = typeof result === "string" ? result.indexOf(",") : -1;
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function TemplateGeneratorPage() {
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;

  // ── Admin gate (mirrors app/app/admin/page.js) ─────────────────────────────
  if (!ctx.auth.isAdmin) {
    return (
      <div>
        <div style={S.pageHeader}>
          <h1 style={S.h1}>Template Generator</h1>
          <p style={S.sub}>This area is restricted to administrators.</p>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
            Admin access required
          </div>
          <div style={{ fontSize: "0.82rem", color: text2, lineHeight: 1.6 }}>
            Sign in with an administrator account to continue.
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");
  const [textbook, setTextbook] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // { name, mediaType, base64 }[]
  const [error, setError] = useState("");

  // ── API call state ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { templateJs, model, usage }
  const [apiError, setApiError] = useState("");

  const imagesRef = useRef(null);

  // ── Derived data ───────────────────────────────────────────────────────────
  const allCourses = ctx.allCourses || {};
  const courseNames = Object.keys(allCourses).sort();

  // Sections list for the selected course, filtered to those WITHOUT templates.
  // We flatten the chapters[] structure into a single sorted list of section
  // strings, then drop any that already have a registered template.
  const availableSections = useMemo(() => {
    if (!course) return [];
    const courseData = allCourses[course];
    if (!courseData || !Array.isArray(courseData.chapters)) return [];

    const all = [];
    for (const chapter of courseData.chapters) {
      if (Array.isArray(chapter.sections)) {
        for (const sec of chapter.sections) {
          if (!hasTemplate(course, sec)) all.push(sec);
        }
      }
    }
    return all;
  }, [course, allCourses]);

  // When the user picks a course, auto-fill the textbook field from the course
  // data. (Built-ins now carry composed `textbook` after the backfill; custom
  // courses may have it from Supabase.) The user can override per template.
  useEffect(() => {
    if (!course) {
      setTextbook("");
      return;
    }
    const c = allCourses[course];
    setTextbook(c?.textbook || "");
    setSection(""); // reset section when course changes
  }, [course, allCourses]);

  // ── Image upload handler (mirrors CourseForm.jsx) ──────────────────────────
  async function handleImagesUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError("");

    for (const file of files) {
      if (images.length >= MAX_IMAGES) {
        setError(`Maximum ${MAX_IMAGES} images per template.`);
        break;
      }
      if (file.size > MAX_IMG_BYTES) {
        setError(`${file.name} is too large (max ${MAX_IMG_BYTES / 1024 / 1024}MB per image).`);
        continue;
      }
      if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) {
        setError(`${file.name}: unsupported type. JPEG/PNG/GIF/WebP only.`);
        continue;
      }
      try {
        const base64 = await readFileBase64(file);
        setImages(prev => [...prev, { name: file.name, mediaType: file.type, base64 }]);
      } catch {
        setError(`Could not read ${file.name}`);
      }
    }
    // Reset the input so the same file can be re-selected after removal.
    if (e.target) e.target.value = "";
  }

  function removeImage(idx) {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Generate button handler ────────────────────────────────────────────────
  async function handleGenerate() {
    setError("");
    setApiError("");
    setResult(null);

    // Client-side validation (server validates again, but this gives faster feedback).
    if (!course) { setError("Pick a course."); return; }
    if (!section) { setError("Pick a section."); return; }
    if (!textbook.trim()) { setError("Textbook is required. Add it on the course or in this field."); return; }
    if (!text.trim() && images.length === 0) {
      setError("Provide section materials: paste text or upload at least one image.");
      return;
    }

    const { number, title } = splitSectionString(section);
    if (!number || !title) {
      setError(`Could not parse section into number + title: "${section}". Expected format like "1.3 New Functions from Old Functions".`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course,
          section: number,
          sectionTitle: title,
          textbook: textbook.trim(),
          text: text.trim() || undefined,
          images: images.length > 0 ? images : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Surface the server's error message, including for 502 cases where
        // it also returns a partial templateJs (we still show that for debugging).
        setApiError(data.error || `Request failed (HTTP ${res.status})`);
        if (data.templateJs) {
          setResult({ templateJs: data.templateJs, model: null, usage: null, partial: true });
        }
        return;
      }

      setResult({
        templateJs: data.templateJs || "",
        model: data.model || null,
        usage: data.usage || null,
        partial: false,
      });
    } catch (e) {
      setApiError(e.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  // ── Copy / Download handlers ───────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    if (!result?.templateJs) return;
    try {
      await navigator.clipboard.writeText(result.templateJs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setApiError("Could not copy to clipboard");
    }
  }

  function handleDownload() {
    if (!result?.templateJs) return;
    // Derive the filename from the result. We pull the first `export const X`
    // identifier from the JS and use that as the filename. This guarantees the
    // filename matches what's in the file (e.g. calc1_1_3_template → calc1_1_3.js).
    const m = result.templateJs.match(/export\s+const\s+([a-zA-Z0-9_]+)_template\s*=/);
    const baseName = m ? m[1] : "template";
    const filename = `${baseName}.js`;

    const blob = new Blob([result.templateJs], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%",
    padding: "0.5rem 0.7rem",
    fontSize: "0.85rem",
    background: bg2,
    border: `1px solid ${border}`,
    borderRadius: "6px",
    color: text1,
    fontFamily: "inherit",
  };
  const labelStyle = {
    display: "block",
    fontSize: "0.78rem",
    fontWeight: "600",
    color: text1,
    marginBottom: "0.4rem",
  };
  const helpTextStyle = {
    fontSize: "0.7rem",
    color: text3,
    marginTop: "0.3rem",
    lineHeight: 1.5,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const canSubmit = course && section && textbook.trim() && (text.trim() || images.length > 0) && !busy;

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Template Generator</h1>
        <p style={S.sub}>
          AI-generated section templates from textbook materials. Pick a course and section, provide
          intro text and/or page photos, then save the generated file to <code>lib/templates/</code>.
        </p>
      </div>

      {/* ── Form card ──────────────────────────────────────────────────────── */}
      <div style={{ ...S.card, marginBottom: "1.25rem" }}>
        {/* Course + Section row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem", marginBottom: "0.85rem" }}>
          <div>
            <label style={labelStyle}>Course</label>
            <select
              style={inputStyle}
              value={course}
              onChange={e => setCourse(e.target.value)}
            >
              <option value="">— Pick a course —</option>
              {courseNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Section (only sections without templates are listed)</label>
            <select
              style={inputStyle}
              value={section}
              onChange={e => setSection(e.target.value)}
              disabled={!course}
            >
              <option value="">
                {!course
                  ? "— Pick a course first —"
                  : availableSections.length === 0
                    ? "— All sections of this course have templates —"
                    : "— Pick a section —"}
              </option>
              {availableSections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Textbook field */}
        <div style={{ marginBottom: "0.85rem" }}>
          <label style={labelStyle}>Textbook</label>
          <input
            style={inputStyle}
            type="text"
            value={textbook}
            placeholder="e.g. Stewart Early Transcendentals 9th Ed"
            onChange={e => setTextbook(e.target.value)}
          />
          <div style={helpTextStyle}>
            Auto-fills from the course's textbook fields. Edit if this template should reference a different source.
          </div>
        </div>

        {/* Materials: text */}
        <div style={{ marginBottom: "0.85rem" }}>
          <label style={labelStyle}>Section materials — text (optional if uploading images)</label>
          <textarea
            style={{ ...inputStyle, minHeight: "140px", fontFamily: "ui-monospace, SF Mono, Consolas, monospace", fontSize: "0.78rem" }}
            value={text}
            placeholder={
              "Paste the section intro and 2-5 worked examples from the textbook.\n\n" +
              "Example:\n" +
              "1.3 New Functions from Old Functions\n\n" +
              "Given any two functions f and g, we can construct new functions by...\n" +
              "Example 1. If f(x) = x^2 and g(x) = x - 3, find f + g, f*g, ..."
            }
            onChange={e => setText(e.target.value)}
          />
          <div style={helpTextStyle}>
            Plain text. Sonnet reads this to understand what the section teaches. Max ~50KB.
          </div>
        </div>

        {/* Materials: images */}
        <div style={{ marginBottom: "0.85rem" }}>
          <label style={labelStyle}>
            Section materials — images (optional, up to {MAX_IMAGES} images, {MAX_IMG_BYTES / 1024 / 1024}MB each)
          </label>
          <input
            ref={imagesRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleImagesUpload}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => imagesRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
            style={{
              ...S.oBtn("#06b6d4"),
              fontSize: "0.78rem",
              opacity: images.length >= MAX_IMAGES ? 0.5 : 1,
              cursor: images.length >= MAX_IMAGES ? "not-allowed" : "pointer",
            }}
          >
            🖼 Upload textbook page images
          </button>

          {images.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.6rem" }}>
              {images.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    width: "92px",
                    height: "92px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: `1px solid ${border}`,
                    background: bg2,
                  }}
                >
                  <img
                    src={`data:${img.mediaType};base64,${img.base64}`}
                    alt={img.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    title="Remove"
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      width: "22px",
                      height: "22px",
                      border: "none",
                      borderRadius: "11px",
                      background: "rgba(0,0,0,0.7)",
                      color: "white",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={helpTextStyle}>
            JPEG, PNG, GIF, or WebP. Sonnet reads these natively (vision) — no OCR step.
          </div>
        </div>

        {/* Client-side validation error */}
        {error && (
          <div
            style={{
              padding: "0.6rem 0.8rem",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "6px",
              color: "#b91c1c",
              fontSize: "0.78rem",
              marginBottom: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canSubmit}
          style={{
            ...S.btn(accent, false),
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "Generating template… (30–60s)" : "Generate Template →"}
        </button>
      </div>

      {/* ── Server error ───────────────────────────────────────────────────── */}
      {apiError && (
        <div
          style={{
            ...S.card,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ fontWeight: "600", color: "#b91c1c", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
            Template generation failed
          </div>
          <div style={{ fontSize: "0.8rem", color: text1, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {apiError}
          </div>
        </div>
      )}

      {/* ── Result ─────────────────────────────────────────────────────────── */}
      {result?.templateJs && (
        <div style={{ ...S.card, marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
            <div style={{ fontSize: "0.92rem", fontWeight: "600", color: text1 }}>
              {result.partial ? "Partial output (see error above)" : "Generated template"}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={handleCopy} style={{ ...S.oBtn(accent), fontSize: "0.78rem" }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button type="button" onClick={handleDownload} style={{ ...S.oBtn("#06b6d4"), fontSize: "0.78rem" }}>
                Download .js
              </button>
            </div>
          </div>

          {result.usage && (
            <div style={{ ...helpTextStyle, marginTop: 0, marginBottom: "0.5rem" }}>
              Model: {result.model || "?"} · Input tokens: {result.usage.input_tokens?.toLocaleString() || "?"}
              {" · "}Output tokens: {result.usage.output_tokens?.toLocaleString() || "?"}
            </div>
          )}

          <pre
            style={{
              padding: "0.85rem",
              background: bg2,
              border: `1px solid ${border}`,
              borderRadius: "6px",
              fontSize: "0.72rem",
              fontFamily: "ui-monospace, SF Mono, Consolas, monospace",
              color: text1,
              maxHeight: "480px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
            }}
          >
            {result.templateJs}
          </pre>

          {!result.partial && (
            <div
              style={{
                marginTop: "0.85rem",
                padding: "0.7rem 0.85rem",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "6px",
                fontSize: "0.78rem",
                color: text1,
                lineHeight: 1.6,
              }}
            >
              <strong>Next steps:</strong>
              <ol style={{ margin: "0.4rem 0 0 0", paddingLeft: "1.2rem" }}>
                <li>Download the file (or copy the content).</li>
                <li>Save it to <code style={{ background: bg2, padding: "1px 4px", borderRadius: "3px" }}>lib/templates/&lt;filename&gt;.js</code> via Claude Code.</li>
                <li>
                  Open <code style={{ background: bg2, padding: "1px 4px", borderRadius: "3px" }}>lib/templates/registry.js</code>{" "}
                  and add an entry for this template (copy the §1.1 entry as a model).
                </li>
                <li>Commit, push, wait for Vercel to deploy. The new section will appear in the question generator.</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ── Back-to-admin link ─────────────────────────────────────────────── */}
      <div style={{ marginTop: "1.5rem" }}>
        <Link href="/app/admin" style={{ ...S.oBtn(accent), fontSize: "0.78rem", textDecoration: "none", display: "inline-block" }}>
          ← Back to Admin
        </Link>
      </div>
    </div>
  );
}
