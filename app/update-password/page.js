"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handleUpdate(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => { window.location.href = "/app"; }, 2000);
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    minHeight: "100vh", background: "#0a0a1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
  };

  const boxStyle = {
    width: "100%", maxWidth: "400px", padding: "2.5rem",
    background: "#0f1629", border: "1px solid #1e3a5f",
    borderRadius: "12px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  };

  const inputStyle = {
    width: "100%", padding: "0.65rem 0.85rem", background: "#1a1a2e",
    border: "1px solid #334155", borderRadius: "6px", color: "#e8e8e0",
    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#e8e8e0", letterSpacing: "-0.5px" }}>
            TestBank <span style={{ color: "#10b981" }}>Pro</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>Set a new password</div>
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✅</div>
            <div style={{ fontSize: "0.95rem", color: "#e8e8e0", fontWeight: "500" }}>Password updated!</div>
            <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "0.5rem" }}>Redirecting you to the app...</div>
          </div>
        ) : (
          <form onSubmit={handleUpdate}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem" }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" style={inputStyle} />
            </div>
            {error && (
              <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: "6px",
                padding: "0.65rem 0.85rem", color: "#f87171", fontSize: "0.8rem", marginBottom: "1rem" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "0.75rem", background: loading ? "#064e3b" : "#10b981",
                color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.95rem", fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
