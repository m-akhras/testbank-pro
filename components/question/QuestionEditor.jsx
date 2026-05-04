"use client";
import { useState } from "react";
import { stripChoiceLabel, isGraphChoice } from "../../lib/utils/questions.js";
import GraphChoice from "../display/GraphChoice.jsx";

const bg2    = "#F7F2E9";
const border = "#D9D0C0";
const text1  = "#1C1A16";
const text2  = "#6B6355";
const text3  = "#A89E8E";

function _normalizeSeed(c) {
  return isGraphChoice(c) ? c : stripChoiceLabel(c);
}

// Editor for Branched MCQ: shared stem + per-part question/4 choices/answer/
// explanation/marks. Marks live as a string on each part (or omitted when blank).
export function BranchedMCQEditor({ q, onSave, onClose }) {
  const seedParts = (q.parts || []).length > 0 ? q.parts : [
    { question: "", choices: ["", "", "", ""], answer: "", explanation: "", marks: "" },
    { question: "", choices: ["", "", "", ""], answer: "", explanation: "", marks: "" },
  ];
  const [stem, setStem] = useState(q.stem || "");
  const [parts, setParts] = useState(() => seedParts.map(p => ({
    question: p?.question || "",
    choices: Array.isArray(p?.choices) && p.choices.length === 4
      ? p.choices.map(c => stripChoiceLabel(c || ""))
      : ["", "", "", ""],
    answer: stripChoiceLabel(p?.answer || ""),
    explanation: p?.explanation || "",
    marks: p?.marks == null ? "" : String(p.marks),
  })));
  const [saving, setSaving] = useState(false);

  function setPart(idx, patch) {
    setParts(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function setPartChoice(idx, ci, val) {
    setParts(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const nc = [...p.choices]; nc[ci] = val;
      // Keep answer in sync if author edits the currently-selected choice
      const nextAnswer = p.answer === p.choices[ci] ? val : p.answer;
      return { ...p, choices: nc, answer: nextAnswer };
    }));
  }
  function addPart() {
    if (parts.length >= 6) return;
    setParts([...parts, { question: "", choices: ["", "", "", ""], answer: "", explanation: "", marks: "" }]);
  }
  function removePart(idx) {
    if (parts.length <= 1) return;
    setParts(parts.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    const cleanParts = parts.map(p => {
      const out = {
        question: p.question,
        choices: p.choices,
        answer: p.answer,
        explanation: p.explanation,
      };
      if (String(p.marks).trim() !== "") out.marks = String(p.marks).trim();
      return out;
    });
    await onSave({ ...q, stem, parts: cleanParts });
    setSaving(false);
  }

  const lbl = (t) => (
    <div style={{ fontSize: "0.68rem", color: text2, textTransform: "uppercase",
      letterSpacing: "0.1em", fontWeight: "600", marginBottom: "0.3rem", marginTop: "0.75rem" }}>
      {t}
    </div>
  );
  const fieldStyle = {
    width: "100%", padding: "0.35rem 0.6rem", background: bg2, border: "1px solid " + border,
    color: text1, borderRadius: "6px", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ marginTop: "0.75rem", padding: "1rem", background: "#1B4332",
      border: "1px solid " + border, borderRadius: "8px", borderLeft: "3px solid #60a5fa" }}>
      <div style={{ fontSize: "0.75rem", color: "#185FA5", fontWeight: "700", marginBottom: "0.75rem" }}>
        ✏️ Edit Branched MCQ <span style={{ fontSize: "0.65rem", color: text3, fontWeight: "400" }}>— shared stem + parts</span>
      </div>

      {lbl("Shared Stem")}
      <textarea value={stem} onChange={e => setStem(e.target.value)} placeholder="Shared given information..."
        rows={3} style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.5 }} />

      {parts.map((p, pi) => {
        const partLabel = String.fromCharCode(97 + pi);
        return (
          <div key={pi} style={{
            marginTop: "1rem", padding: "0.75rem", background: bg2,
            border: `1px solid ${border}`, borderRadius: "6px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: "700", color: text1 }}>Part ({partLabel})</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.65rem", color: text2 }}>marks:</span>
                <input value={p.marks} onChange={e => setPart(pi, { marks: e.target.value })}
                  placeholder="—" style={{ width: "48px", textAlign: "center", padding: "0.15rem 0.3rem",
                    fontSize: "0.72rem", border: `1px solid ${border}`, borderRadius: "4px",
                    background: "#fff", color: text1 }} />
                {parts.length > 1 && (
                  <button onClick={() => removePart(pi)}
                    style={{ background: "transparent", color: "#f87171", border: "1px solid #f8717144",
                      borderRadius: "4px", padding: "0.1rem 0.4rem", fontSize: "0.65rem", cursor: "pointer" }}>
                    ✕ remove
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: "0.65rem", color: text2, marginBottom: "0.2rem" }}>Question</div>
            <textarea value={p.question} onChange={e => setPart(pi, { question: e.target.value })}
              rows={2} style={{ ...fieldStyle, resize: "vertical" }} />

            <div style={{ fontSize: "0.65rem", color: text2, marginTop: "0.5rem", marginBottom: "0.2rem" }}>Choices (click letter to mark correct)</div>
            {p.choices.map((c, ci) => {
              const letter = String.fromCharCode(65 + ci);
              const isCorrect = p.answer && p.answer === c;
              return (
                <div key={ci} style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                  <button onClick={() => setPart(pi, { answer: c })}
                    style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", border: "none",
                      cursor: "pointer", fontSize: "0.7rem", fontWeight: "700",
                      background: isCorrect ? "#10b981" : border,
                      color: isCorrect ? "#fff" : "#4a6fa5" }}>{letter}</button>
                  <input value={c} onChange={e => setPartChoice(pi, ci, e.target.value)}
                    style={{ flex: 1, padding: "0.25rem 0.45rem", background: "#fff",
                      border: `1px solid ${isCorrect ? "#10b981" : border}`,
                      color: text1, borderRadius: "5px", fontSize: "0.78rem" }} />
                </div>
              );
            })}

            <div style={{ fontSize: "0.65rem", color: text2, marginTop: "0.5rem", marginBottom: "0.2rem" }}>Explanation</div>
            <textarea value={p.explanation} onChange={e => setPart(pi, { explanation: e.target.value })}
              rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
          </div>
        );
      })}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem" }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "0.35rem 0.9rem", background: "#2D6A4F", color: "#fff",
            border: "none", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "600",
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "✓ Save Changes"}
        </button>
        {parts.length < 6 && (
          <button onClick={addPart}
            style={{ padding: "0.35rem 0.8rem", background: "transparent", color: text2,
              border: "1px solid " + border, borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer" }}>
            + Add part
          </button>
        )}
        <button onClick={onClose}
          style={{ padding: "0.35rem 0.8rem", background: "transparent", color: text2,
            border: "1px solid " + border, borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function QuestionEditor({ q, onSave, onClose }) {
  if (q?.type === "Branched MCQ") {
    return <BranchedMCQEditor q={q} onSave={onSave} onClose={onClose} />;
  }

  const [question,    setQuestion]    = useState(q.question    || "");
  const [choices,     setChoices]     = useState(q.choices     ? q.choices.map(_normalizeSeed) : []);
  const [answer,      setAnswer]      = useState(stripChoiceLabel(q.answer || ""));
  const [explanation, setExplanation] = useState(q.explanation || "");
  const [saving,      setSaving]      = useState(false);

  const inp = (val, set, ph, rows) => rows
    ? <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={rows}
        style={{ width: "100%", padding: "0.4rem 0.6rem", background: bg2, border: "1px solid " + border,
          color: text1, borderRadius: "6px", fontSize: "0.82rem", resize: "vertical",
          lineHeight: 1.5, fontFamily: "inherit", boxSizing: "border-box" }} />
    : <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
        style={{ width: "100%", padding: "0.35rem 0.6rem", background: bg2, border: "1px solid " + border,
          color: text1, borderRadius: "6px", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box" }} />;

  const lbl = (t) => (
    <div style={{ fontSize: "0.68rem", color: text2, textTransform: "uppercase",
      letterSpacing: "0.1em", fontWeight: "600", marginBottom: "0.3rem", marginTop: "0.75rem" }}>
      {t}
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    let updated = { ...q, question, answer, explanation };
    if (choices.length) updated.choices = choices;
    await onSave(updated);
    setSaving(false);
  };

  const isLetterAnswer = /^[A-Ha-h]$/.test(String(answer || "").trim());

  return (
    <div style={{ marginTop: "0.75rem", padding: "1rem", background: "#1B4332",
      border: "1px solid " + border, borderRadius: "8px", borderLeft: "3px solid #60a5fa" }}>
      <div style={{ fontSize: "0.75rem", color: "#185FA5", fontWeight: "700", marginBottom: "0.75rem",
        display: "flex", alignItems: "center", gap: "0.5rem" }}>
        ✏️ Edit Question
        <span style={{ fontSize: "0.65rem", color: text3, fontWeight: "400" }}>— changes save to Supabase</span>
      </div>

      {lbl("Question Text")}
      {inp(question, setQuestion, "Question text...", 3)}

      {choices.length > 0 && (
        <>
          {lbl("Answer Choices")}
          {choices.map((c, ci) => {
            const letter = String.fromCharCode(65 + ci);
            const isGraph = isGraphChoice(c);
            const isCorrect = isGraph ? (isLetterAnswer && answer.toUpperCase() === letter) : answer === c;
            return (
              <div key={ci} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <button
                  onClick={() => setAnswer(isGraph ? letter : c)}
                  style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", border: "none",
                    cursor: "pointer", fontSize: "0.7rem", fontWeight: "700",
                    background: isCorrect ? "#10b981" : border,
                    color: isCorrect ? "#fff" : "#4a6fa5" }}>
                  {letter}
                </button>
                {isGraph ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.3rem 0.5rem", background: bg2, border: "1px solid " + (isCorrect ? "#10b981" : border),
                      borderRadius: "5px" }}>
                    <GraphChoice config={c.graphConfig} width={150} height={140} />
                    <span style={{ fontSize: "0.65rem", color: text3 }}>graph choice — edit graphConfig in JSON to change</span>
                  </div>
                ) : (
                  <input
                    value={c}
                    onChange={e => {
                      const nc = [...choices]; nc[ci] = e.target.value; setChoices(nc);
                      if (answer === c) setAnswer(e.target.value);
                    }}
                    style={{ flex: 1, padding: "0.3rem 0.5rem", background: bg2,
                      border: "1px solid " + (isCorrect ? "#10b981" : border),
                      color: text1, borderRadius: "5px", fontSize: "0.8rem" }} />
                )}
              </div>
            );
          })}
          <div style={{ fontSize: "0.65rem", color: text3, marginTop: "0.3rem" }}>
            Click a letter to mark as correct answer · Currently: <span style={{ color: "#10b981" }}>{answer || "none selected"}</span>
          </div>
        </>
      )}

      {!choices.length && (
        <>
          {lbl("Answer")}
          {inp(answer, setAnswer, "Answer...")}
        </>
      )}

      {lbl("Solution Steps (answer key)")}
      {q.type === "Free Response" || q.type === "Short Answer" ? (
        <div style={{ marginBottom: "0.35rem" }}>
          <div style={{ fontSize: "0.63rem", color: text3, marginBottom: "0.3rem", lineHeight: 1.5 }}>
            One math line per line — no prose. Prose lines (starting with "Use", "Thus", "Let", etc.) are auto-filtered out.
            <span style={{ color: "#10b981", marginLeft: "0.4rem" }}>Example: = (10)/(s^3) - (6)/(s^2) + (4)/(s)</span>
          </div>
          {inp(explanation, setExplanation, "= ...\n= ...", 5)}
        </div>
      ) : (
        inp(explanation, setExplanation, "Step-by-step explanation...", 2)
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "0.35rem 0.9rem", background: "#2D6A4F", color: "#fff",
            border: "none", borderRadius: "6px", fontSize: "0.78rem", fontWeight: "600",
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "✓ Save Changes"}
        </button>
        <button
          onClick={onClose}
          style={{ padding: "0.35rem 0.8rem", background: "transparent", color: text2,
            border: "1px solid #D9D0C0", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
