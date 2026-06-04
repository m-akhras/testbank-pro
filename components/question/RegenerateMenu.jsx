"use client";
import { useState } from "react";

// Flat 4-item per-question regenerate dropdown. Surfaces the doc's three
// regenerate categories (Re-roll / Mutate / Fix) with Mutate's two existing
// modes exposed as separate rows — same buildReplacePrompt machinery, no new
// generation pipeline. The caller wires onPick(mutationType, reason) to
// triggerReplace(vIdx, qIdx, mutationType, reason).
//
//   Re-roll          → mutationType "reroll"   (fresh question, no reason)
//   Mutate: numbers  → mutationType "numbers"  (today's ↻ Replace)
//   Mutate: function → mutationType "function" (today's ↻ Diff.)
//   Fix              → mutationType "fix" + reason = validationIssues.join("; ")
//                      disabled until the question carries a validation flag.
export default function RegenerateMenu({ q, S, onPick }) {
  const [open, setOpen] = useState(false);
  const issues = Array.isArray(q?.validationIssues) ? q.validationIssues : [];
  const canFix = issues.length > 0;

  const pick = (mutationType, reason = "") => {
    setOpen(false);
    onPick && onPick(mutationType, reason);
  };

  const itemStyle = (enabled = true) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: enabled ? "#e8e8e0" : "#6b7280",
    fontSize: "0.72rem",
    padding: "0.4rem 0.7rem",
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  });

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        style={{ ...S.smBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}
        onClick={() => setOpen(o => !o)}
      >
        ↻ Regenerate ▾
      </button>

      {open && (
        <>
          {/* click-outside catcher */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 41,
              background: "#1a1d23",
              border: "1px solid #2d323b",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              padding: "0.25rem 0",
              minWidth: "170px",
            }}
          >
            <button style={itemStyle()} onClick={() => pick("reroll")}>
              🎲 Re-roll
            </button>
            <button style={itemStyle()} onClick={() => pick("numbers")}>
              ↻ Mutate: numbers
            </button>
            <button style={itemStyle()} onClick={() => pick("function")}>
              ↻ Mutate: function
            </button>
            <button
              style={itemStyle(canFix)}
              disabled={!canFix}
              title={canFix ? issues.join("\n") : "Run validation to enable"}
              onClick={() => canFix && pick("fix", issues.join("; "))}
            >
              🛠 Fix
            </button>
          </div>
        </>
      )}
    </span>
  );
}
