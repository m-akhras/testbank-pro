"use client";
import { useMemo, useState } from "react";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";
import GraphChoice from "../display/GraphChoice.jsx";
import ValidationBadge from "./ValidationBadge.jsx";
import { stripChoiceLabel, isGraphChoice } from "../../lib/utils/questions.js";
import { useAppContext } from "../../context/AppContext.js";

// Branched MCQ body — shared stem (rendered above by parent) + per-part list.
// Each part shows its own MCQ choices (with the correct one highlighted in
// answer-key mode), the answer/explanation, and a small editable marks input
// (blank by default — author fills in manually).
function BranchedMCQBody({ q, showAnswer, S, text2, text3, border }) {
  const { bank: bankHook } = useAppContext();
  const saveQuestion = bankHook?.saveQuestion;
  const [marksDraft, setMarksDraft] = useState(() =>
    (q.parts || []).map(p => (p?.marks == null ? "" : String(p.marks)))
  );

  function commitMarks(idx, val) {
    if (!saveQuestion) return;
    const newParts = (q.parts || []).map((p, i) => {
      if (i !== idx) return p;
      const trimmed = String(val).trim();
      const next = { ...p };
      if (trimmed === "") delete next.marks; else next.marks = trimmed;
      return next;
    });
    saveQuestion({ ...q, parts: newParts });
  }

  return (
    <>
      {q.stem && (
        <div style={S.qText}><MathText>{q.stem}</MathText></div>
      )}
      {(q.parts || []).map((p, pi) => {
        const label = String.fromCharCode(97 + pi); // a, b, c, d
        const choices = Array.isArray(p?.choices) ? p.choices : [];
        const correctNorm = stripChoiceLabel(p?.answer || "");
        return (
          <div key={pi} style={{
            marginTop: "0.85rem",
            paddingTop: "0.6rem",
            borderTop: pi === 0 ? "none" : `1px dashed ${border}`,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <div style={{ ...S.qText, flex: 1, marginBottom: 0 }}>
                <strong>({label})</strong>{" "}
                <MathText>{p?.question || ""}</MathText>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="—"
                  value={marksDraft[pi] ?? ""}
                  onChange={e => {
                    const next = [...marksDraft];
                    next[pi] = e.target.value;
                    setMarksDraft(next);
                  }}
                  onBlur={e => commitMarks(pi, e.target.value)}
                  title="Marks for this part (manual)"
                  style={{
                    width: "44px", padding: "0.15rem 0.35rem", fontSize: "0.7rem",
                    border: `1px solid ${border}`, borderRadius: "4px",
                    background: "#fff", color: "#1C1A16", textAlign: "center",
                  }}
                />
                <span style={{ fontSize: "0.65rem", color: text3 }}>marks</span>
              </div>
            </div>
            {choices.length > 0 && (
              <ul style={S.cList}>
                {choices.map((c, ci) => {
                  const letter = String.fromCharCode(65 + ci);
                  const isCorrect = stripChoiceLabel(c) === correctNorm;
                  return (
                    <li key={ci} style={S.cItem(isCorrect)}>
                      {letter}. <MathText>{stripChoiceLabel(c)}</MathText>
                    </li>
                  );
                })}
              </ul>
            )}
            {showAnswer && p?.answer && (
              <div style={S.ans}>✓ <MathText>{stripChoiceLabel(p.answer)}</MathText></div>
            )}
            {showAnswer && p?.explanation && (
              <div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>
            )}
          </div>
        );
      })}
    </>
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

  // Validation badge inheritance.
  //
  // Variants are saved through saveQuestion, which writes the JSONB blob but
  // not the dedicated validation_status / validation_issues / validated_at
  // columns. loadBank reads only those top-level columns, so a variant's own
  // validationStatus is always null on reload — the badge resets to
  // "Not validated" even when the source question is validated.
  //
  // Fix: at render time, if the question has no status of its own but does
  // carry an originalId, look up the source question in the bank and reuse
  // its status. Inherited badges are visually distinguished in
  // <ValidationBadge>. Re-validating the source automatically updates every
  // variant since they all read through this lookup on the next render.
  const { bank: bankHook } = useAppContext();
  const bankArr = bankHook?.bank;
  const inherited = useMemo(() => {
    if (q.validationStatus) {
      return {
        status: q.validationStatus,
        issues: q.validationIssues,
        validatedAt: q.validatedAt,
        inherited: false,
      };
    }
    if (q.originalId && Array.isArray(bankArr)) {
      const source = bankArr.find(b => b.id === q.originalId);
      if (source?.validationStatus) {
        return {
          status: source.validationStatus,
          issues: source.validationIssues,
          validatedAt: source.validatedAt,
          inherited: true,
        };
      }
    }
    return { status: null, issues: [], validatedAt: null, inherited: false };
  }, [q.validationStatus, q.validationIssues, q.validatedAt, q.originalId, bankArr]);

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
          status={inherited.status}
          issues={inherited.issues}
          validatedAt={inherited.validatedAt}
          inherited={inherited.inherited}
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

      {/* Branched MCQ — shared stem + per-part choices */}
      {q.type === "Branched MCQ" && Array.isArray(q.parts) ? (
        <BranchedMCQBody
          q={q}
          showAnswer={showAnswer}
          S={S}
          text2={text2}
          text3={text3}
          border={border}
        />
      ) : (
        <div style={S.qText}><MathText>{q.question}</MathText></div>
      )}
      {q.type !== "Branched MCQ" && q.choices && (() => {
        const hasGraphChoices = q.choices.some(isGraphChoice);
        const ansLetterIdx = hasGraphChoices && /^[A-Ha-h]$/.test(String(q.answer || "").trim())
          ? String(q.answer).trim().toUpperCase().charCodeAt(0) - 65
          : -1;
        return (
          <ul style={S.cList}>
            {q.choices.map((c, ci) => {
              const letter = String.fromCharCode(65 + ci);
              const isGraph = isGraphChoice(c);
              const isCorrect = isGraph
                ? ci === ansLetterIdx
                : stripChoiceLabel(c) === stripChoiceLabel(q.answer);
              return (
                <li key={ci} style={S.cItem(isCorrect)}>
                  {isGraph ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, lineHeight: "1.2" }}>{letter}.</span>
                      <GraphChoice config={c.graphConfig} />
                    </div>
                  ) : (
                    <>{letter}. <MathText>{stripChoiceLabel(c)}</MathText></>
                  )}
                </li>
              );
            })}
          </ul>
        );
      })()}
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
      {q.type !== "Branched MCQ" && showAnswer && q.answer && (() => {
        const hasGraphChoices = Array.isArray(q.choices) && q.choices.some(isGraphChoice);
        if (hasGraphChoices) {
          return <div style={S.ans}>✓ Choice {String(q.answer).trim().toUpperCase()}</div>;
        }
        return <div style={S.ans}>✓ <MathText>{stripChoiceLabel(q.answer)}</MathText></div>;
      })()}
      {q.type !== "Branched MCQ" && showAnswer && q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}

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
