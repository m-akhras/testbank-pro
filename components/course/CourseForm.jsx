"use client";
import { useState, useRef } from "react";

const DEPARTMENTS = ["Math", "Sciences", "Engineering", "Business", "Other"];
const COLORS = [
  "#185FA5", // blue
  "#10b981", // green
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#e879f9", // pink
  "#3b82f6", // indigo
];
const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMG_SIZE = 2 * 1024 * 1024; // 2MB

async function readFileBase64(file) {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function extractPdfText(file) {
  const base64 = await readFileBase64(file);
  const res = await fetch("/api/extract-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, filename: file.name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `extract-pdf ${res.status}`);
  }
  const { text } = await res.json();
  return text || "";
}

async function parseChaptersFromText(text) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `Extract chapters and sections from this syllabus text. Return ONLY a JSON array:
[{ "ch": "1", "title": "Chapter Title", "sections": ["1.1 Section Name", "1.2 Section Name"] }]

Syllabus:
${text}

Reply with ONLY the JSON array, no markdown, no explanation.`,
    }),
  });
  if (!res.ok) throw new Error("Chapter parse API error " + res.status);
  const data = await res.json();
  const resp = data.content?.[0]?.text || data.text || "";
  const match = resp.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Could not parse AI response");
  return JSON.parse(match[0]);
}

export default function CourseForm({
  initial,
  onSave,
  onCancel,
  S,
  text1,
  text2,
  text3,
  border,
  accent,
  bg1,
  bg2,
}) {
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    name: initial?.name || "",
    department: initial?.department || "Math",
    color: initial?.color || COLORS[0],
    textbook_name: initial?.textbook_name || "",
    textbook_author: initial?.textbook_author || "",
    textbook_edition: initial?.textbook_edition || "",
    chapters: initial?.chapters || [],
    glossary_text: initial?.glossary_text || "",
    reference_images: initial?.reference_images || [], // [{name, base64}]
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [glossaryLoading, setGlossaryLoading] = useState(false);
  const [syllabusFileName, setSyllabusFileName] = useState("");
  const [glossaryFileName, setGlossaryFileName] = useState("");
  const syllabusRef = useRef(null);
  const glossaryRef = useRef(null);
  const imagesRef = useRef(null);

  async function handleSyllabusUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_PDF_SIZE) {
      setError(`PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB).`);
      return;
    }
    setSyllabusFileName(file.name);
    setSyllabusLoading(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) throw new Error("No text extracted from PDF.");
      const chapters = await parseChaptersFromText(text);
      setForm(prev => ({ ...prev, chapters }));
    } catch (err) {
      setError("Syllabus import failed: " + (err.message || "unknown error"));
    } finally {
      setSyllabusLoading(false);
    }
  }

  async function handleGlossaryUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_PDF_SIZE) {
      setError(`PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB).`);
      return;
    }
    setGlossaryFileName(file.name);
    setGlossaryLoading(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) throw new Error("No text extracted from PDF.");
      setForm(prev => ({ ...prev, glossary_text: text }));
    } catch (err) {
      setError("Glossary import failed: " + (err.message || "unknown error"));
    } finally {
      setGlossaryLoading(false);
    }
  }

  async function handleImagesUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError("");
    for (const file of files) {
      if (file.size > MAX_IMG_SIZE) {
        setError(`${file.name} too large (max ${MAX_IMG_SIZE / 1024 / 1024}MB per image).`);
        continue;
      }
      try {
        const base64 = await readFileBase64(file);
        setForm(prev => ({
          ...prev,
          reference_images: [...prev.reference_images, { name: file.name, mediaType: file.type, base64 }],
        }));
      } catch {
        setError("Could not read " + file.name);
      }
    }
    if (imagesRef.current) imagesRef.current.value = "";
  }

  function removeImage(idx) {
    setForm(prev => ({ ...prev, reference_images: prev.reference_images.filter((_, i) => i !== idx) }));
  }

  function removeChapter(idx) {
    setForm(prev => ({ ...prev, chapters: prev.chapters.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Course name is required.");
      return;
    }
    if (!form.department) {
      setError("Department is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
      });
    } catch (e) {
      setError("Save failed: " + (e.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "0.5rem 0.7rem",
    background: bg2,
    border: "1px solid " + border,
    borderRadius: "6px",
    color: text1,
    fontSize: "0.82rem",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ ...S.card, borderColor: accent + "44" }}>
      <div style={{ fontSize: "0.88rem", fontWeight: "600", color: accent, marginBottom: "1rem" }}>
        {initial?.id ? `Edit: ${initial.name}` : "New Course"}
      </div>

      {/* Name + Department */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.3rem" }}>Course Name *</div>
          <input
            style={inputStyle}
            value={form.name}
            placeholder="e.g. Linear Algebra"
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.3rem" }}>Department *</div>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={form.department}
            onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
          >
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Color */}
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.4rem" }}>Color</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {COLORS.map(c => (
            <div
              key={c}
              onClick={() => setForm(p => ({ ...p, color: c }))}
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: c,
                cursor: "pointer",
                border: form.color === c ? "3px solid " + text1 : "2px solid " + border,
                boxSizing: "border-box",
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Textbook */}
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: "600", color: text1, marginBottom: "0.4rem" }}>Textbook</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <input
            style={inputStyle}
            value={form.textbook_name}
            placeholder="Textbook name"
            onChange={e => setForm(p => ({ ...p, textbook_name: e.target.value }))}
          />
          <input
            style={inputStyle}
            value={form.textbook_author}
            placeholder="Author"
            onChange={e => setForm(p => ({ ...p, textbook_author: e.target.value }))}
          />
          <input
            style={inputStyle}
            value={form.textbook_edition}
            placeholder="Edition"
            onChange={e => setForm(p => ({ ...p, textbook_edition: e.target.value }))}
          />
        </div>
        <div style={{ fontSize: "0.7rem", color: text3, padding: "0.45rem 0.65rem", background: bg2, border: "1px solid " + border, borderRadius: "6px", lineHeight: 1.5 }}>
          ℹ️ Matching textbook name, author and edition helps the generator align notation and examples. Leave blank if you'd rather keep things generic.
        </div>
      </div>

      {/* Syllabus upload */}
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: "600", color: text1, marginBottom: "0.4rem" }}>
          Syllabus (PDF) — extracts chapters automatically
        </div>
        <input ref={syllabusRef} type="file" accept="application/pdf" onChange={handleSyllabusUpload} style={{ display: "none" }} />
        <button
          onClick={() => syllabusRef.current?.click()}
          disabled={syllabusLoading}
          style={{ ...S.oBtn(accent), fontSize: "0.78rem", cursor: syllabusLoading ? "not-allowed" : "pointer" }}
        >
          {syllabusLoading ? "⏳ Extracting…" : syllabusFileName ? `📄 ${syllabusFileName} — re-upload` : "📄 Upload syllabus PDF"}
        </button>
        {form.chapters.length > 0 && (
          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.3rem" }}>
              {form.chapters.length} chapter{form.chapters.length !== 1 ? "s" : ""} extracted
            </div>
            <div style={{ maxHeight: "220px", overflow: "auto", border: "1px solid " + border, borderRadius: "6px", background: bg2 }}>
              {form.chapters.map((ch, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.6rem", borderBottom: i < form.chapters.length - 1 ? "1px solid " + border + "66" : "none" }}>
                  <span style={{ fontSize: "0.72rem", color: accent, fontWeight: "600", minWidth: "24px" }}>{ch.ch}</span>
                  <span style={{ fontSize: "0.78rem", color: text1, flex: 1 }}>{ch.title}</span>
                  <span style={{ fontSize: "0.68rem", color: text3 }}>{(ch.sections || []).length} sec</span>
                  <button style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => removeChapter(i)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Glossary upload */}
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: "600", color: text1, marginBottom: "0.4rem" }}>
          Glossary (PDF) — stored as reference text
        </div>
        <input ref={glossaryRef} type="file" accept="application/pdf" onChange={handleGlossaryUpload} style={{ display: "none" }} />
        <button
          onClick={() => glossaryRef.current?.click()}
          disabled={glossaryLoading}
          style={{ ...S.oBtn("#8b5cf6"), fontSize: "0.78rem", cursor: glossaryLoading ? "not-allowed" : "pointer" }}
        >
          {glossaryLoading ? "⏳ Extracting…" : glossaryFileName ? `📖 ${glossaryFileName} — re-upload` : "📖 Upload glossary PDF"}
        </button>
        {form.glossary_text && (
          <div style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: text3 }}>
            ✓ {form.glossary_text.length.toLocaleString()} chars stored
            <button
              style={{ marginLeft: "0.5rem", background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.72rem" }}
              onClick={() => { setForm(p => ({ ...p, glossary_text: "" })); setGlossaryFileName(""); }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Reference images */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: "600", color: text1, marginBottom: "0.4rem" }}>Reference Images</div>
        <input ref={imagesRef} type="file" accept="image/*" multiple onChange={handleImagesUpload} style={{ display: "none" }} />
        <button
          onClick={() => imagesRef.current?.click()}
          style={{ ...S.oBtn("#06b6d4"), fontSize: "0.78rem" }}
        >
          🖼 Upload reference images
        </button>
        {form.reference_images.length > 0 && (
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {form.reference_images.map((img, i) => (
              <div key={i} style={{ position: "relative", border: "1px solid " + border, borderRadius: "6px", overflow: "hidden", width: "90px", height: "90px", background: bg2 }}>
                <img
                  src={`data:${img.mediaType || "image/png"};base64,${img.base64}`}
                  alt={img.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  onClick={() => removeImage(i)}
                  style={{ position: "absolute", top: 2, right: 2, background: "#000a", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "0.7rem", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem", padding: "0.4rem 0.6rem", background: "#7f1d1d22", border: "1px solid #f8717144", borderRadius: "6px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button style={{ ...S.btn("#10b981", saving), fontSize: "0.85rem" }} disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Course"}
        </button>
        <button style={{ ...S.oBtn(text2), fontSize: "0.85rem" }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
