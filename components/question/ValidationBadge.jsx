"use client";
import { useState } from "react";

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

// Inline AI-validation badge. Click the pill to open a popover with the
// per-issue list and a "Validated X ago" timestamp.
//
// `inherited` indicates the status was looked up from a source question
// (variant inheriting its parent's badge). We render the same icon/label
// so users don't have to learn a second visual vocabulary, but switch the
// pill to a dashed outline and add a "Inherited from source" note in the
// popover so the relationship is discoverable.
export default function ValidationBadge({ status, issues, validatedAt, inherited = false }) {
  const [open, setOpen] = useState(false);
  const key = status || "none";
  const cfg = VALIDATION_BADGE[key] || VALIDATION_BADGE.none;
  const issueList = Array.isArray(issues) ? issues.filter(Boolean) : [];

  const pillStyle = inherited
    ? {
        cursor: "pointer",
        background: "transparent",
        color: cfg.color,
        border: `1px dashed ${cfg.border}`,
        fontSize: "0.7rem",
        fontWeight: 600,
        padding: "0.12rem 0.45rem",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }
    : {
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
      };

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={inherited ? `${cfg.label} (inherited from source)` : cfg.label}
        style={pillStyle}
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
            {inherited && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.7rem", color: "#6b7280", fontStyle: "italic" }}>
                Inherited from source question — re-validate the source to update all variants.
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}
