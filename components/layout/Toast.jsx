"use client";

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 99999,
      padding: "0.65rem 1.1rem", borderRadius: "8px",
      fontSize: "0.82rem", fontWeight: "600",
      background:  toast.type === "error" ? "#7c2d12" : toast.type === "warn" ? "#451a03" : "#052e16",
      color:       toast.type === "error" ? "#fca5a5" : toast.type === "warn" ? "#fde68a" : "#86efac",
      border: `1px solid ${toast.type === "error" ? "#f8717144" : toast.type === "warn" ? "#f59e0b44" : "#22c55e44"}`,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      animation: "fadeIn 0.2s ease",
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      {toast.type === "success" ? "✓" : toast.type === "warn" ? "⚠" : "✕"} {toast.msg}
    </div>
  );
}
