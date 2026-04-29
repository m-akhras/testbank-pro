"use client";
import { useState } from "react";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";

// Visual styling per AI-validation status. Returned shape lines up with the
// inline badge pill rendered in the question meta row.
const VALIDATION_BADGE = {
  ok:      { icon: "✅", label: "Validated OK",  color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
  warning: { icon: "⚠️", label: "Has warnings", color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
  error:   { icon: "❌", label: "Has errors",   color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" },
  none:    { icon: "⚪", label: "Not validated", color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
};

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Inline AI-validation badge ──
// Shows a status pill (✅/⚠️/❌/⚪) next to the question meta. Clicking toggles
// a small popover with the issue list and the "Validated X ago" timestamp.
function ValidationBadge({ status, issues, validatedAt, S }) {
  const [open, setOpen] = useState(false);
  const key = status || "none";
  const cfg = VALIDATION_BADGE[key] || VALIDATION_BADGE.none;
  const issueList = Array.isArray(issues) ? issues.filter(Boolean) : [];

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={cfg.label}
        style={{
          cursor: "pointer",
          background: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
          fontSize: "0.7rem",
          fontWeight: 600,
          padding: "0.12rem 0.45rem",
          borderRadius: "999px",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        {cfg.icon} {cfg.label}
      </button>
      {open && (
        <>
          {/* click-outside catcher */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 19, background: "transparent" }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 20,
              minWidth: "240px",
              maxWidth: "360px",
              background: "#fff",
              border: `1px solid ${cfg.border}`,
              borderRadius: "8px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
              padding: "0.65rem 0.75rem",
              fontSize: "0.78rem",
              color: "#1f2937",
            }}
          >
            <div style={{ fontWeight: 700, color: cfg.color, marginBottom: "0.35rem" }}>
              {cfg.icon} {cfg.label}
            </div>
            {issueList.length > 0 ? (
              <ul style={{ margin: 0, padding: "0 0 0 1.1rem", lineHeight: 1.45 }}>
                {issueList.map((it, i) => <li key={i} style={{ marginBottom: "0.2rem" }}>{it}</li>)}
              </ul>
            ) : (
              <div style={{ color: "#374151" }}>
                {status ? "No issues found." : "This question hasn't been validated yet. Run Auto Validate to check."}
              </div>
            )}
            {validatedAt && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#6b7280" }}>
                Validated {timeAgo(validatedAt)}
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

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

        {/* AI-validation status badge — clickable, shows issue popover */}
        <ValidationBadge
          status={q.validationStatus}
          issues={q.validationIssues}
          validatedAt={q.validatedAt}
          S={S}
        />

        {/* Static-check warning (missing fields, malformed structure) — separate
            from AI validation. Kept for backwards compatibility with callers
            that still pass an `issues` prop. */}
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
