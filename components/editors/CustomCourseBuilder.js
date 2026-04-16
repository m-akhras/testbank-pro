"use client";
import { useState, useRef } from "react";

// bg2 is used internally but not passed as a prop by the caller
const bg2 = "#F7F2E9";

export default function CustomCourseBuilder({ customCourses, onSave, onDelete, text1, text2, text3, border, bg1, S, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", color: "#6366f1", textbook: "", chapters: [] });
  const [newChapter, setNewChapter] = useState({ ch: "", title: "", sections: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState("paste"); // "paste" | "file"
  const [fileName, setFileName] = useState("");
  const [fileRef2, setFileRef2] = useState(null); // base64 data
  const fileRef = useRef(null);

  const COLORS = ["#10b981","#8b5cf6","#f59e0b","#06b6d4","#f43f5e","#e879f9","#a855f7","#3b82f6","#f97316","#ec4899"];
  const MAX_FILE_SIZE = 500 * 1024; // 500KB

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is 500KB (your file: ${Math.round(file.size/1024)}KB).`);
      return;
    }
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "pdf") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(",")[1];
        setFileRef2({ type: "pdf", base64, mediaType: "application/pdf" });
      };
      reader.readAsDataURL(file);
    } else if (ext === "docx") {
      if (!window.mammoth) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
        await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const result = await window.mammoth.extractRawText({ arrayBuffer: ev.target.result });
          setSyllabusText(result.value);
          setSyllabusMode("paste");
          setFileName("");
        } catch(e) { setError("Could not read Word file: " + e.message); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Only PDF and Word (.docx) files are supported.");
    }
  }

  async function importFromFile({ type, base64, mediaType }) {
    setSyllabusLoading(true);
    setError("");
    try {
      const prompt = `You are a course structure extractor. Extract the course name, all textbooks/books mentioned, and all chapters with their sections from this syllabus.

Return ONLY a valid JSON object:
{
  "name": "Course Name",
  "textbook": "All textbooks mentioned, comma-separated, or empty string",
  "chapters": [
    { "ch": "1", "title": "Chapter Title", "sections": ["1.1 Section Name", "1.2 Section Name"] }
  ]
}

Reply with ONLY the JSON, no markdown, no explanation.`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, file: { type, base64, mediaType } }),
      });
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response");
      const parsed = JSON.parse(match[0]);
      setForm(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        textbook: parsed.textbook || prev.textbook,
        chapters: parsed.chapters || [],
      }));
      setShowSyllabus(false);
      setFileName("");
      setSyllabusText("");
      setEditing(prev => prev || "new");
    } catch(e) {
      setError("Import failed: " + (e.message || "Unknown error"));
    } finally {
      setSyllabusLoading(false);
    }
  }

  async function importFromSyllabus() {
    if (!syllabusText.trim()) return;
    setSyllabusLoading(true);
    setError("");
    try {
      const prompt = `You are a course structure extractor. Extract the course name, all textbooks/books mentioned, and all chapters with their sections from this syllabus.

Return ONLY a valid JSON object:
{
  "name": "Course Name",
  "textbook": "All textbooks mentioned, comma-separated, or empty string",
  "chapters": [
    { "ch": "1", "title": "Chapter Title", "sections": ["1.1 Section Name", "1.2 Section Name"] }
  ]
}

Syllabus:
${syllabusText}

Reply with ONLY the JSON, no markdown, no explanation.`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response");
      const parsed = JSON.parse(match[0]);
      setForm(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        textbook: parsed.textbook || prev.textbook,
        chapters: parsed.chapters || [],
      }));
      setShowSyllabus(false);
      setSyllabusText("");
      setEditing(prev => prev || "new");
    } catch(e) {
      setError("Import failed: " + (e.message || "Unknown error"));
    } finally {
      setSyllabusLoading(false);
    }
  }

  function startNew() {
    setForm({ name: "", color: "#6366f1", textbook: "", chapters: [] });
    setNewChapter({ ch: "", title: "", sections: "" });
    setEditing("new");
    setError("");
  }

  function startEdit(name) {
    const c = customCourses[name];
    setForm({ name, color: c.color, textbook: c.textbook || "", chapters: c.chapters || [], id: c.id });
    setNewChapter({ ch: "", title: "", sections: "" });
    setEditing(name);
    setError("");
  }

  function addChapter() {
    if (!newChapter.ch || !newChapter.title) return;
    const sections = newChapter.sections.split("\n").map(s => s.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, chapters: [...prev.chapters, { ch: newChapter.ch, title: newChapter.title, sections }] }));
    setNewChapter({ ch: "", title: "", sections: "" });
  }

  function removeChapter(idx) {
    setForm(prev => ({ ...prev, chapters: prev.chapters.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Course name is required."); return; }
    setSaving(true);
    await onSave(form);
    setEditing(null);
    setSaving(false);
  }

  const inp = (val, set, placeholder, width="100%", type="text") => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
      style={{ width, padding:"0.5rem 0.7rem", background:bg2, border:"1px solid "+border,
        borderRadius:"6px", color:text1, fontSize:"0.82rem", outline:"none", boxSizing:"border-box" }} />
  );

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem" }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background:"none", border:"none", cursor:"pointer", color:text2, fontSize:"0.82rem", display:"flex", alignItems:"center", gap:"6px" }}>
          {expanded ? "▾" : "▸"} Custom Courses {Object.keys(customCourses).length > 0 && `(${Object.keys(customCourses).length})`}
        </button>
        {expanded && (
          <button onClick={startNew}
            style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:"6px",
              padding:"0.35rem 0.85rem", fontSize:"0.78rem", fontWeight:"600", cursor:"pointer" }}>
            + New Course
          </button>
        )}
      </div>

      {expanded && (
        <div>
          {/* Existing custom courses */}
          {Object.keys(customCourses).length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.5rem", marginBottom:"1rem" }}>
              {Object.entries(customCourses).map(([name, c]) => (
                <div key={name} style={{ display:"flex", alignItems:"center", gap:"6px", background:bg1,
                  border:`1px solid ${"#D9D0C0"}`, borderRadius:"8px", padding:"0.4rem 0.75rem",
                  borderLeft:`3px solid ${c.color}` }}>
                  <span style={{ fontSize:"0.82rem", color:text1 }}>{name}</span>
                  <button onClick={() => startEdit(name)}
                    style={{ background:"none", border:"none", cursor:"pointer", color:text3, fontSize:"0.75rem" }}>✏</button>
                  <button onClick={() => { if(confirm(`Delete "${name}"?`)) onDelete(name); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:"0.75rem" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Editor */}
          {editing && (
            <div style={{ background:bg1, border:"1px solid "+border, borderRadius:"10px", padding:"1.25rem" }}>
              <div style={{ fontSize:"0.82rem", fontWeight:"600", color:"#185FA5", marginBottom:"1rem" }}>
                {editing === "new" ? "New Course" : `Editing: ${editing}`}
              </div>

              {/* Syllabus Import */}
              <div style={{ marginBottom:"0.75rem" }}>
                <button onClick={() => setShowSyllabus(s => !s)}
                  style={{ background: showSyllabus ? border : "transparent", color:"#185FA5",
                    border:"1px solid "+border, borderRadius:"6px", padding:"0.35rem 0.85rem",
                    fontSize:"0.78rem", cursor:"pointer", marginBottom: showSyllabus ? "0.75rem" : 0 }}>
                  📄 {showSyllabus ? "Hide" : "Import from Syllabus"}
                </button>
                {showSyllabus && (
                  <div style={{ background:bg2, border:"1px solid "+border, borderRadius:"8px", padding:"0.85rem" }}>
                    {/* Mode tabs */}
                    <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem" }}>
                      {["file", "paste"].map(mode => (
                        <button key={mode} onClick={() => setSyllabusMode(mode)}
                          style={{ background: syllabusMode === mode ? border : "transparent",
                            color: syllabusMode === mode ? "#60a5fa" : text3,
                            border:`1px solid ${syllabusMode === mode ? border : border}`,
                            borderRadius:"6px", padding:"0.3rem 0.75rem", fontSize:"0.75rem", cursor:"pointer" }}>
                          {mode === "file" ? "📎 Upload File" : "📋 Paste Text"}
                        </button>
                      ))}
                    </div>

                    {syllabusMode === "file" ? (
                      <div>
                        <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>
                          Upload PDF or Word (.docx) — max 500KB
                        </div>
                        <input ref={fileRef} type="file" accept=".pdf,.docx"
                          onChange={handleFileUpload}
                          style={{ display:"none" }} />
                        <button onClick={() => fileRef.current?.click()}
                          style={{ background:border, color:"#185FA5", border:"1px solid "+border,
                            borderRadius:"6px", padding:"0.5rem 1rem", fontSize:"0.82rem", cursor:"pointer" }}>
                          {fileName ? `📄 ${fileName}` : "Choose File"}
                        </button>
                        {fileName && !syllabusLoading && (
                          <div style={{ fontSize:"0.72rem", color:"#4ade80", marginTop:"0.4rem" }}>
                            ✓ File ready — click Import to extract
                          </div>
                        )}
                        {fileName && (
                          <button onClick={() => fileRef2 && importFromFile(fileRef2)}
                            disabled={syllabusLoading || !fileRef2}
                            style={{ marginTop:"0.5rem", display:"block", background: syllabusLoading ? "#064e3b" : "#10b981",
                              color:"#fff", border:"none", borderRadius:"6px", padding:"0.5rem 1.25rem",
                              fontSize:"0.82rem", fontWeight:"600", cursor: syllabusLoading ? "not-allowed" : "pointer" }}>
                            {syllabusLoading ? "⏳ Importing..." : "⚡ Import"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>
                          Paste your syllabus — AI extracts course name, textbooks, chapters and sections.
                        </div>
                        <textarea value={syllabusText} onChange={e => setSyllabusText(e.target.value)}
                          placeholder="Paste syllabus text here..."
                          rows={6}
                          style={{ width:"100%", padding:"0.5rem 0.7rem", background:bg2, border:"1px solid "+border,
                            borderRadius:"6px", color:text1, fontSize:"0.78rem", outline:"none",
                            boxSizing:"border-box", resize:"vertical", fontFamily:"inherit", marginBottom:"0.5rem" }} />
                        <button onClick={importFromSyllabus} disabled={syllabusLoading || !syllabusText.trim()}
                          style={{ background: syllabusLoading ? "#064e3b" : "#10b981", color:"#fff", border:"none",
                            borderRadius:"6px", padding:"0.5rem 1.25rem", fontSize:"0.82rem", fontWeight:"600",
                            cursor: syllabusLoading ? "not-allowed" : "pointer" }}>
                          {syllabusLoading ? "⏳ Importing..." : "⚡ Import"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Name + Textbook */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginBottom:"0.75rem" }}>
                <div>
                  <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.3rem" }}>Course Name *</div>
                  {inp(form.name, v => setForm(p => ({...p, name:v})), "e.g. Linear Algebra")}
                </div>
                <div>
                  <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.3rem" }}>Textbook (optional)</div>
                  {inp(form.textbook, v => setForm(p => ({...p, textbook:v})), "e.g. Gilbert Strang 5th Ed")}
                </div>
              </div>

              {/* Color picker */}
              <div style={{ marginBottom:"0.75rem" }}>
                <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>Color</div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(p => ({...p, color:c}))}
                      style={{ width:"24px", height:"24px", borderRadius:"50%", background:c, cursor:"pointer",
                        border: form.color === c ? "2px solid #fff" : "2px solid transparent" }} />
                  ))}
                </div>
              </div>

              {/* Chapters */}
              <div style={{ marginBottom:"0.75rem" }}>
                <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>Chapters ({form.chapters.length})</div>
                {form.chapters.map((ch, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"0.4rem",
                    background:bg2, borderRadius:"6px", padding:"0.4rem 0.7rem" }}>
                    <span style={{ fontSize:"0.75rem", color:"#185FA5", fontWeight:"600", minWidth:"20px" }}>{ch.ch}</span>
                    <span style={{ fontSize:"0.78rem", color:text1, flex:1 }}>{ch.title}</span>
                    <span style={{ fontSize:"0.68rem", color:text3 }}>{ch.sections.length} sections</span>
                    {isAdmin && <button onClick={() => removeChapter(i)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:"0.8rem" }}>✕</button>}
                  </div>
                ))}

                {/* Add chapter manually — admin only */}
                {isAdmin && (
                  <div style={{ background:bg2, border:"1px dashed #1e3a5f", borderRadius:"8px", padding:"0.85rem", marginTop:"0.5rem" }}>
                    <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.5rem" }}>Add Chapter Manually</div>
                    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:"0.5rem", marginBottom:"0.5rem" }}>
                      {inp(newChapter.ch, v => setNewChapter(p => ({...p, ch:v})), "Ch#", "100%")}
                      {inp(newChapter.title, v => setNewChapter(p => ({...p, title:v})), "Chapter title")}
                    </div>
                    <textarea value={newChapter.sections} onChange={e => setNewChapter(p => ({...p, sections:e.target.value}))}
                      placeholder={"One section per line:\n1.1 Introduction\n1.2 Key Concepts"}
                      rows={3}
                      style={{ width:"100%", padding:"0.5rem 0.7rem", background:bg2, border:"1px solid "+border,
                        borderRadius:"6px", color:text1, fontSize:"0.78rem", outline:"none",
                        boxSizing:"border-box", resize:"vertical", fontFamily:"inherit" }} />
                    <button onClick={addChapter}
                      style={{ marginTop:"0.5rem", background:border, color:"#185FA5", border:"none",
                        borderRadius:"6px", padding:"0.35rem 0.85rem", fontSize:"0.75rem", cursor:"pointer" }}>
                      + Add Chapter
                    </button>
                  </div>
                )}
              </div>

              {error && <div style={{ color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem" }}>{error}</div>}

              <div style={{ display:"flex", gap:"0.5rem" }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:"6px",
                    padding:"0.5rem 1.25rem", fontSize:"0.85rem", fontWeight:"600", cursor:"pointer" }}>
                  {saving ? "Saving..." : "Save Course"}
                </button>
                <button onClick={() => setEditing(null)}
                  style={{ background:"none", color:text2, border:"1px solid "+border, borderRadius:"6px",
                    padding:"0.5rem 1rem", fontSize:"0.85rem", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
