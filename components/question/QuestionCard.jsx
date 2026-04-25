"use client";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";

export default function QuestionCard({
  q,
  index,
  issues,
  showAnswer = true,
  showCourse = true,
  typeColor,
  authorMode = false,
  headerExtra,
  bodyTop,
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
  children,
}) {
  const issuesArr = Array.isArray(issues) ? issues : null;
  const hasAnyAction = onDelete || onReplace || onGraphEdit || onEdit || onSelect;

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
        {index !== undefined && (
          <span style={{ fontWeight: "bold", color: text1 }}>Q{index}</span>
        )}
        {showCourse && q.course && <span style={S.tag(accent)}>{q.course}</span>}
        <span style={typeColor ? S.tag(typeColor) : S.tag()}>{q.type}</span>
        <span style={S.tag()}>{q.section}</span>
        <span style={S.tag()}>{q.difficulty}</span>

        {issuesArr && issuesArr.length > 0 && (
          <span title={issuesArr.join("\n")} style={{
            cursor: "help",
            background: "#7c2d12", color: "#9B1C1C",
            fontSize: "0.68rem", fontWeight: "600",
            padding: "0.1rem 0.4rem", borderRadius: "4px", whiteSpace: "nowrap",
          }}>
            ⚠️ {issuesArr.length}{issuesArr.length > 1 ? " issues" : " issue"}
          </span>
        )}

        {hasAnyAction || headerExtra ? (
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
            {headerExtra}
            {onDelete && (
              <button
                style={{ ...S.smBtn, color: "#f87171", border: "1px solid #f8717144" }}
                onClick={() => onDelete(q)}>
                ✕
              </button>
            )}
            {onReplace && (
              <button
                style={{ ...S.smBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}
                onClick={() => onReplace(q)}>
                ↻
              </button>
            )}
            {onGraphEdit && (
              <button
                style={{ ...S.smBtn, color: "#185FA5", border: "1px solid #60a5fa44" }}
                onClick={() => onGraphEdit(q)}>
                📈{q.hasGraph ? " Edit" : " Graph"}
              </button>
            )}
            {onEdit && (
              <button
                style={{ ...S.smBtn, color: "#a78bfa", border: "1px solid #a78bfa44" }}
                onClick={() => onEdit(q)}>
                ✏️ Edit
              </button>
            )}
            {onSelect && (
              <button
                style={{ ...S.smBtn, color: inExam ? "#e11d48" : text2, border: "1px solid " + (inExam ? "#e11d4844" : border) }}
                onClick={() => onSelect(q)}>
                {inExam ? "✓ In exam" : "+ Exam"}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Slot for InlineEditor / per-card panels rendered above the body */}
      {bodyTop}

      {/* Graph display */}
      {q.hasGraph && q.graphConfig && (
        <GraphDisplay graphConfig={q.graphConfig} authorMode={authorMode} />
      )}

      {/* Question content */}
      {q.type === "Branched" ? (
        <>
          <div style={{ ...S.qText, color: accent + "cc" }}>Given: <MathText>{q.stem}</MathText></div>
          {(q.parts || []).map((p, pi) => (
            <div key={pi} style={{ marginBottom: "0.5rem", paddingLeft: "0.75rem", borderLeft: "2px solid " + border }}>
              <div style={{ fontSize: "0.7rem", color: text3, marginBottom: "0.2rem" }}>({String.fromCharCode(97 + pi)})</div>
              <div style={{ ...S.qText, marginBottom: "0.2rem" }}><MathText>{p.question}</MathText></div>
              {showAnswer && p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
              {showAnswer && p.explanation && <div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>}
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
          {/* Bank-style "None of these" preference toggle (separate from choices array) */}
          {q.type === "Multiple Choice" && onNoneOfAboveChange && (
            <label style={{ fontSize: "0.7rem", color: text2, display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: "0.35rem" }}>
              <input
                type="checkbox"
                checked={noneOfAbove || false}
                onChange={e => onNoneOfAboveChange(q.id, e.target.checked)}
              />
              E. None of these
            </label>
          )}
          {showAnswer && q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
          {showAnswer && q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
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
