"use client";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";

export default function QuestionCard({
  q,
  inExam = false,
  isAdmin = false,
  onSelect,
  onEdit,
  onGraphEdit,
  onDelete,
  onReplace,
  mutationType = "numbers",
  onMutationChange,
  noneOfAbove = false,
  onNoneOfAboveChange,
  S,
  accent = "#2D6A4F",
  text1 = "#1C1A16",
  text2 = "#6B6355",
  text3 = "#A89E8E",
  border = "#D9D0C0",
  // extras rendered by parent (editor, graph editor, replace panel)
  children,
}) {
  return (
    <div style={{
      ...S.qCard,
      borderColor: inExam ? "#e11d48" : border,
      borderLeftWidth: inExam ? "4px" : "1px",
      background: inExam ? "#fff1f2" : S.qCard.background,
      boxShadow: inExam ? "0 0 0 1px #e11d4833, 0 2px 8px #e11d4822" : S.qCard.boxShadow,
    }}>
      {/* ── Meta row ── */}
      <div style={S.qMeta}>
        <span style={S.tag(accent)}>{q.course}</span>
        <span style={S.tag()}>{q.type}</span>
        <span style={S.tag()}>{q.section}</span>
        <span style={S.tag()}>{q.difficulty}</span>

        {/* Action buttons */}
        <button
          style={{ ...S.smBtn, marginLeft: "auto", color: "#f87171", border: "1px solid #f8717144" }}
          onClick={() => onDelete && onDelete(q)}>
          ✕
        </button>
        <button
          style={{ ...S.smBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}
          onClick={() => onReplace && onReplace(q)}>
          ↻
        </button>
        <button
          style={{ ...S.smBtn, color: "#185FA5", border: "1px solid #60a5fa44" }}
          onClick={() => onGraphEdit && onGraphEdit(q)}>
          📈{q.hasGraph ? " Edit" : " Graph"}
        </button>
        <button
          style={{ ...S.smBtn, color: "#a78bfa", border: "1px solid #a78bfa44" }}
          onClick={() => onEdit && onEdit(q)}>
          ✏️ Edit
        </button>
        <button
          style={{ ...S.smBtn, color: inExam ? "#e11d48" : text2, border: "1px solid " + (inExam ? "#e11d4844" : border) }}
          onClick={() => onSelect && onSelect(q)}>
          {inExam ? "✓ In exam" : "+ Exam"}
        </button>
      </div>

      {/* Graph display */}
      {q.hasGraph && q.graphConfig && (
        <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
      )}

      {/* Question content */}
      {q.type === "Branched" ? (
        <>
          <div style={{ ...S.qText, color: accent + "cc" }}>Given: <MathText>{q.stem}</MathText></div>
          {(q.parts || []).map((p, pi) => (
            <div key={pi} style={{ marginBottom: "0.5rem", paddingLeft: "0.75rem", borderLeft: "2px solid " + border }}>
              <div style={{ fontSize: "0.7rem", color: text3, marginBottom: "0.2rem" }}>({String.fromCharCode(97 + pi)})</div>
              <div style={{ ...S.qText, marginBottom: "0.2rem" }}><MathText>{p.question}</MathText></div>
              {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
            </div>
          ))}
        </>
      ) : (
        <>
          <div style={S.qText}><MathText>{q.question}</MathText></div>
          {q.choices && (
            <ul style={S.cList}>
              {q.choices.map((c, ci) => (
                <li key={ci} style={S.cItem(c === q.answer)}>
                  {String.fromCharCode(65 + ci)}. <MathText>{c}</MathText>
                </li>
              ))}
            </ul>
          )}
          {/* None of the above toggle for MCQ */}
          {q.type === "Multiple Choice" && (
            <label style={{ fontSize: "0.7rem", color: text2, display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: "0.35rem" }}>
              <input
                type="checkbox"
                checked={noneOfAbove || false}
                onChange={e => onNoneOfAboveChange && onNoneOfAboveChange(q.id, e.target.checked)}
              />
              E. None of the above
            </label>
          )}
          {q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
          {q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
        </>
      )}

      {/* Slot for editor / replace panel injected by parent */}
      {children}

      {/* Mutation selector — shown when selected for exam */}
      {inExam && onMutationChange && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          marginTop: "0.6rem", paddingTop: "0.6rem",
          borderTop: "1px solid " + accent + "33",
        }}>
          <span style={{ fontSize: "0.68rem", color: accent, fontWeight: "bold", letterSpacing: "0.08em", textTransform: "uppercase" }}>Mutation:</span>
          <button
            style={{
              ...S.smBtn,
              background: (mutationType || "numbers") === "numbers" ? accent + "22" : "transparent",
              color: (mutationType || "numbers") === "numbers" ? accent : text2,
              border: "1px solid " + ((mutationType || "numbers") === "numbers" ? accent + "66" : border),
            }}
            onClick={() => onMutationChange(q.id, "numbers")}>
            numbers
          </button>
          <button
            style={{
              ...S.smBtn,
              background: mutationType === "function" ? "#8b5cf622" : "transparent",
              color: mutationType === "function" ? "#8b5cf6" : text2,
              border: "1px solid " + (mutationType === "function" ? "#8b5cf666" : border),
            }}
            onClick={() => onMutationChange(q.id, "function")}>
            function
          </button>
        </div>
      )}
    </div>
  );
}
