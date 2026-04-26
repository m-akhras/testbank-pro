"use client";
import { useState, useEffect } from "react";

export default function ExportTemplateModal({
  open,
  onClose,
  onGenerate,
  defaultExamTitle = "",
  defaultCourseTitle = "",
  defaultCourseCode = "",
  defaultClassSection = null,
  classSections = [],
  numQuestions = 0,
  busy = false,
  S,
  text1, text2, text3, border, bg1, bg2,
  accent = "#185FA5",
}) {
  const [examTitle, setExamTitle] = useState(defaultExamTitle);
  const [courseTitle, setCourseTitle] = useState(defaultCourseTitle);
  const [courseCode, setCourseCode] = useState(defaultCourseCode);
  const [examSemester, setExamSemester] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [examDuration, setExamDuration] = useState("");
  const [materialsAllowed, setMaterialsAllowed] = useState("");
  const [examInstructions, setExamInstructions] = useState("");
  const [includeCover, setIncludeCover] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [showVersion, setShowVersion] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [showSection, setShowSection] = useState(false);
  const [sectionLabel, setSectionLabel] = useState("");
  const [instructorBySection, setInstructorBySection] = useState({});
  const [questionMarks, setQuestionMarks] = useState([]);
  const [error, setError] = useState("");

  // Reset & autofill on open transition (ignore prop drift while open)
  useEffect(() => {
    if (!open) return;
    setExamTitle(defaultExamTitle || "");
    setCourseTitle(defaultCourseTitle || "");
    setCourseCode(defaultCourseCode || "");
    setError("");
    if (defaultClassSection != null && defaultClassSection !== "") {
      setShowSection(true);
      setSectionLabel(String(defaultClassSection).padStart(2, "0"));
    } else {
      setShowSection(false);
      setSectionLabel("");
    }
    setInstructorBySection({});
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

  function setInstructorAt(key, val) {
    setInstructorBySection(prev => ({ ...prev, [key]: val }));
  }

  const totalMarks = questionMarks.reduce((sum, m) => sum + (Number(m) || 0), 0);

  // Per-section instructor inputs: multi-section if 2+, else single "_default"
  const sectionList = Array.isArray(classSections) ? [...classSections].filter(s => s != null && s !== "") : [];
  const useMultiSectionInstructors = sectionList.length > 1;

  function submit() {
    if (!examTitle.trim()) { setError("Exam title is required."); return; }
    if (!courseTitle.trim()) { setError("Course title is required."); return; }
    if (!courseCode.trim()) { setError("Course code is required."); return; }
    onGenerate({
      examTitle: examTitle.trim(),
      courseTitle: courseTitle.trim(),
      courseCode: courseCode.trim(),
      examSemester: examSemester.trim(),
      examDate: examDate.trim(),
      examTime: examTime.trim(),
      examDuration: examDuration.trim(),
      materialsAllowed: materialsAllowed.trim(),
      examInstructions: examInstructions.trim(),
      includeCover,
      includeHeader,
      includeFooter,
      showVersion,
      versionLabel: versionLabel.trim(),
      showSection,
      sectionLabel: sectionLabel.trim(),
      instructorBySection,
      questionMarks: questionMarks.map(m => Number(m) || 0),
    });
  }

  const labelStyle = { display: "block", fontSize: "0.74rem", color: text2, marginBottom: "0.3rem", fontWeight: "500" };
  const inputStyle = { ...S.input, width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.82rem" };
  const sectionBoxStyle = { marginBottom: "0.85rem", padding: "0.65rem 0.85rem", background: bg2, border: "1px solid " + border, borderRadius: "6px" };
  const checkboxRowStyle = { display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: text2, cursor: "pointer", marginBottom: "0.4rem" };
  const sectionHeaderStyle = { fontSize: "0.7rem", color: text2, fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: bg1, border: "1px solid " + border, borderRadius: "12px",
        padding: "1.5rem", maxWidth: "680px", width: "100%",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ fontSize: "1rem", fontWeight: "700", color: text1, marginBottom: "0.25rem" }}>
          Word Export — Cover Page
        </div>
        <div style={{ fontSize: "0.74rem", color: text3, marginBottom: "1.25rem" }}>
          These fields populate the exam cover page and headers.
        </div>

        {/* EXAM INFO */}
        <div style={sectionHeaderStyle}>Exam Info</div>

        <div style={{ marginBottom: "0.7rem" }}>
          <label style={labelStyle}>Exam title <span style={{ color: "#f87171" }}>*</span></label>
          <input type="text" value={examTitle} onChange={e => setExamTitle(e.target.value)}
            placeholder="e.g. Final Exam" style={inputStyle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Course title <span style={{ color: "#f87171" }}>*</span></label>
            <input type="text" value={courseTitle} onChange={e => setCourseTitle(e.target.value)}
              placeholder="e.g. Quantitative Methods II" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Course code <span style={{ color: "#f87171" }}>*</span></label>
            <input type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)}
              placeholder="e.g. MAT 116" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Semester</label>
            <input type="text" value={examSemester} onChange={e => setExamSemester(e.target.value)}
              placeholder="Spring 2025" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Exam date</label>
            <input type="text" value={examDate} onChange={e => setExamDate(e.target.value)}
              placeholder="April 23, 2025" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Exam time</label>
            <input type="text" value={examTime} onChange={e => setExamTime(e.target.value)}
              placeholder="12:30 PM" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Exam duration</label>
            <input type="text" value={examDuration} onChange={e => setExamDuration(e.target.value)}
              placeholder="45 mins" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: "0.7rem" }}>
          <label style={labelStyle}>Materials allowed</label>
          <textarea value={materialsAllowed} onChange={e => setMaterialsAllowed(e.target.value)}
            placeholder="Pen and scientific calculator." rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Instructions (optional)</label>
          <textarea value={examInstructions} onChange={e => setExamInstructions(e.target.value)}
            placeholder="Read each question carefully. Show all work."
            rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* VERSION & SECTION */}
        <div style={sectionHeaderStyle}>Version & Section</div>

        <div style={sectionBoxStyle}>
          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={showVersion} onChange={e => setShowVersion(e.target.checked)}
              style={{ accentColor: accent, width: "14px", height: "14px" }} />
            Include version on cover
          </label>
          <input type="text" value={versionLabel} onChange={e => setVersionLabel(e.target.value)}
            placeholder="e.g. Version B2" disabled={!showVersion}
            style={{ ...inputStyle, opacity: showVersion ? 1 : 0.5, cursor: showVersion ? "auto" : "not-allowed" }} />
        </div>

        <div style={sectionBoxStyle}>
          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={showSection} onChange={e => setShowSection(e.target.checked)}
              style={{ accentColor: accent, width: "14px", height: "14px" }} />
            Include section on cover
          </label>
          <input type="text" value={sectionLabel} onChange={e => setSectionLabel(e.target.value)}
            placeholder="e.g. 02" disabled={!showSection}
            style={{ ...inputStyle, opacity: showSection ? 1 : 0.5, cursor: showSection ? "auto" : "not-allowed" }} />
        </div>

        {/* PER-SECTION INSTRUCTORS */}
        <div style={sectionHeaderStyle}>{useMultiSectionInstructors ? "Per-section instructors" : "Instructor"}</div>
        <div style={{ marginBottom: "1rem", padding: "0.65rem 0.85rem", background: bg2, border: "1px solid " + border, borderRadius: "6px" }}>
          {useMultiSectionInstructors ? (
            sectionList.map(sec => {
              const key = String(sec);
              return (
                <div key={key} style={{ marginBottom: "0.5rem" }}>
                  <label style={labelStyle}>{`Instructor for Section ${String(sec).padStart(2, "0")}:`}</label>
                  <input type="text" value={instructorBySection[key] || ""}
                    onChange={e => setInstructorAt(key, e.target.value)}
                    placeholder="Instructor name" style={inputStyle} />
                </div>
              );
            })
          ) : (
            <div>
              <label style={labelStyle}>Instructor:</label>
              <input type="text" value={instructorBySection["_default"] || ""}
                onChange={e => setInstructorAt("_default", e.target.value)}
                placeholder="Instructor name" style={inputStyle} />
            </div>
          )}
        </div>

        {/* GRADING TABLE */}
        {questionMarks.length > 0 && (
          <>
            <div style={sectionHeaderStyle}>Grading table</div>
            <div style={{ marginBottom: "1rem", padding: "0.75rem", background: bg2, border: "1px solid " + border, borderRadius: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(70px, 1fr))", gap: "0.4rem", marginBottom: "0.5rem" }}>
                {questionMarks.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: "0.65rem", color: text3, marginBottom: "0.15rem", textAlign: "center" }}>Q{i + 1}</div>
                    <input type="number" min={0} value={m} onChange={e => setMarkAt(i, e.target.value)}
                      style={{ ...inputStyle, padding: "0.3rem 0.4rem", fontSize: "0.78rem", textAlign: "center" }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.78rem", color: text2, fontWeight: "600", textAlign: "right" }}>
                Total: {totalMarks} marks
              </div>
            </div>
          </>
        )}

        {/* LAYOUT */}
        <div style={{ background: bg2, border: "1px solid " + border, borderRadius: "6px", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <div style={sectionHeaderStyle}>Layout</div>
          {[
            { id: "cover",  label: "Include cover page",            value: includeCover,  set: setIncludeCover },
            { id: "header", label: "Include header on each page",   value: includeHeader, set: setIncludeHeader },
            { id: "footer", label: "Include footer with page numbers", value: includeFooter, set: setIncludeFooter },
          ].map(opt => (
            <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: text2, cursor: "pointer", padding: "0.2rem 0" }}>
              <input type="checkbox" checked={opt.value} onChange={e => opt.set(e.target.checked)}
                style={{ accentColor: accent, width: "14px", height: "14px" }} />
              {opt.label}
            </label>
          ))}
        </div>

        {error && <div style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>⚠ {error}</div>}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy}
            style={{ ...S.oBtn(text2), fontSize: "0.82rem", padding: "0.45rem 1rem" }}>Cancel</button>
          <button onClick={submit} disabled={busy}
            style={{ ...S.btn(accent, busy), fontSize: "0.82rem", padding: "0.45rem 1.25rem" }}>
            {busy ? "Generating…" : "Generate Word Document"}
          </button>
        </div>
      </div>
    </div>
  );
}
