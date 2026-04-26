"use client";
import { useState, useEffect } from "react";

export default function ExportTemplateModal({
  open,
  onClose,
  onGenerate,
  defaultExamTitle = "",
  defaultClassSection = null,
  numQuestions = 0,
  busy = false,
  S,
  text1, text2, text3, border, bg1, bg2,
  accent = "#185FA5",
}) {
  const [examTitle, setExamTitle] = useState(defaultExamTitle);
  const [dateField, setDateField] = useState("");
  const [semester, setSemester] = useState("");
  const [timeAllowed, setTimeAllowed] = useState("");
  const [instructions, setInstructions] = useState("");
  const [includeCover, setIncludeCover] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [showVersion, setShowVersion] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [showSection, setShowSection] = useState(false);
  const [sectionLabel, setSectionLabel] = useState("");
  const [questionMarks, setQuestionMarks] = useState([]);
  const [error, setError] = useState("");

  // Reset & autofill on open transition (ignore prop drift while open)
  useEffect(() => {
    if (!open) return;
    setExamTitle(defaultExamTitle || "");
    setError("");
    if (defaultClassSection != null && defaultClassSection !== "") {
      setShowSection(true);
      setSectionLabel(`Section ${String(defaultClassSection).padStart(2, "0")}`);
    } else {
      setShowSection(false);
      setSectionLabel("");
    }
    const n = Number(numQuestions) || 0;
    setQuestionMarks(Array(n).fill(10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function setMarkAt(i, val) {
    setQuestionMarks(prev => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  }

  const totalMarks = questionMarks.reduce((sum, m) => sum + (Number(m) || 0), 0);

  function submit() {
    if (!examTitle.trim()) {
      setError("Exam title is required.");
      return;
    }
    onGenerate({
      examTitle: examTitle.trim(),
      date: dateField.trim(),
      semester: semester.trim(),
      timeAllowed: timeAllowed.trim(),
      instructions: instructions.trim(),
      includeCover,
      includeHeader,
      includeFooter,
      showVersion,
      versionLabel: versionLabel.trim(),
      showSection,
      sectionLabel: sectionLabel.trim(),
      questionMarks: questionMarks.map(m => Number(m) || 0),
    });
  }

  const labelStyle = { display: "block", fontSize: "0.74rem", color: text2, marginBottom: "0.3rem", fontWeight: "500" };
  const inputStyle = { ...S.input, width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.82rem" };
  const sectionBoxStyle = { marginBottom: "0.85rem", padding: "0.65rem 0.85rem", background: bg2, border: "1px solid " + border, borderRadius: "6px" };
  const checkboxRowStyle = { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: text2, cursor: "pointer", marginBottom: "0.4rem" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: bg1, border: "1px solid " + border, borderRadius: "12px",
        padding: "1.5rem", maxWidth: "640px", width: "100%",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ fontSize: "1rem", fontWeight: "700", color: text1, marginBottom: "0.25rem" }}>
          Word Export — Exam Template
        </div>
        <div style={{ fontSize: "0.74rem", color: text3, marginBottom: "1.25rem" }}>
          These fields appear on the cover page and headers of the Word document.
        </div>

        <div style={{ marginBottom: "0.85rem" }}>
          <label style={labelStyle}>Exam title <span style={{ color: "#f87171" }}>*</span></label>
          <input
            type="text"
            value={examTitle}
            onChange={e => setExamTitle(e.target.value)}
            placeholder="e.g. Midterm Exam"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.85rem" }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="text"
              value={dateField}
              onChange={e => setDateField(e.target.value)}
              placeholder="December 15, 2025"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Semester</label>
            <input
              type="text"
              value={semester}
              onChange={e => setSemester(e.target.value)}
              placeholder="Fall 2025"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: "0.85rem" }}>
          <label style={labelStyle}>Time allowed</label>
          <input
            type="text"
            value={timeAllowed}
            onChange={e => setTimeAllowed(e.target.value)}
            placeholder="60 minutes"
            style={inputStyle}
          />
        </div>

        {/* Version (optional) */}
        <div style={sectionBoxStyle}>
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={showVersion}
              onChange={e => setShowVersion(e.target.checked)}
              style={{ accentColor: accent, width: "14px", height: "14px" }}
            />
            Include version on cover
          </label>
          <input
            type="text"
            value={versionLabel}
            onChange={e => setVersionLabel(e.target.value)}
            placeholder="e.g. Midterm VA"
            disabled={!showVersion}
            style={{
              ...inputStyle,
              opacity: showVersion ? 1 : 0.5,
              cursor: showVersion ? "auto" : "not-allowed",
            }}
          />
        </div>

        {/* Section (optional, auto-filled from active version's classSection) */}
        <div style={sectionBoxStyle}>
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={showSection}
              onChange={e => setShowSection(e.target.checked)}
              style={{ accentColor: accent, width: "14px", height: "14px" }}
            />
            Include section on cover
          </label>
          <input
            type="text"
            value={sectionLabel}
            onChange={e => setSectionLabel(e.target.value)}
            placeholder="e.g. Section 01"
            disabled={!showSection}
            style={{
              ...inputStyle,
              opacity: showSection ? 1 : 0.5,
              cursor: showSection ? "auto" : "not-allowed",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Instructions</label>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Read each question carefully. Show all work. Calculators permitted."
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Grading table (per-question marks) */}
        {questionMarks.length > 0 && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem", background: bg2, border: "1px solid " + border, borderRadius: "6px" }}>
            <div style={{ fontSize: "0.7rem", color: text2, fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Grading table
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(70px, 1fr))", gap: "0.4rem", marginBottom: "0.5rem" }}>
              {questionMarks.map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: "0.65rem", color: text3, marginBottom: "0.15rem", textAlign: "center" }}>
                    Q{i + 1}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={m}
                    onChange={e => setMarkAt(i, e.target.value)}
                    style={{ ...inputStyle, padding: "0.3rem 0.4rem", fontSize: "0.78rem", textAlign: "center" }}
                  />
                </div>
              ))}
            </div>
            <div style={{ fontSize: "0.78rem", color: text2, fontWeight: "600", textAlign: "right" }}>
              Total: {totalMarks} marks
            </div>
          </div>
        )}

        <div style={{ background: bg2, border: "1px solid " + border, borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.7rem", color: text2, fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Layout
          </div>
          {[
            { id: "cover",  label: "Include cover page",            value: includeCover,  set: setIncludeCover },
            { id: "header", label: "Include header on each page",   value: includeHeader, set: setIncludeHeader },
            { id: "footer", label: "Include footer with page numbers", value: includeFooter, set: setIncludeFooter },
          ].map(opt => (
            <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: text2, cursor: "pointer", padding: "0.2rem 0" }}>
              <input
                type="checkbox"
                checked={opt.value}
                onChange={e => opt.set(e.target.checked)}
                style={{ accentColor: accent, width: "14px", height: "14px" }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ ...S.oBtn(text2), fontSize: "0.82rem", padding: "0.45rem 1rem" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            style={{ ...S.btn(accent, busy), fontSize: "0.82rem", padding: "0.45rem 1.25rem" }}
          >
            {busy ? "Generating…" : "Generate Word Document"}
          </button>
        </div>
      </div>
    </div>
  );
}
