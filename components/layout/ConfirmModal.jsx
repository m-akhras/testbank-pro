"use client";

const bg2   = "#F7F2E9";
const border = "#D9D0C0";
const text1  = "#1C1A16";

export default function ConfirmModal({ confirmDelete, onConfirm, onCancel }) {
  if (!confirmDelete) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: bg2, border: "1px solid " + border,
        borderRadius: "12px", padding: "1.5rem",
        maxWidth: "380px", width: "90%",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        fontFamily: "'Inter',system-ui,sans-serif",
      }}>
        <div style={{ fontSize: "1rem", fontWeight: "700", color: text1, marginBottom: "0.5rem" }}>
          Delete Question?
        </div>
        <div style={{ fontSize: "0.82rem", color: "#6b89b8", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          This will permanently remove the question from your bank. This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "0.5rem", background: "#7c2d12", color: "#fca5a5",
              border: "1px solid #f8717144", borderRadius: "6px",
              cursor: "pointer", fontWeight: "600", fontSize: "0.82rem",
            }}>
            Delete
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "0.5rem", background: "transparent", color: "#6b89b8",
              border: "1px solid " + border, borderRadius: "6px",
              cursor: "pointer", fontSize: "0.82rem",
            }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
