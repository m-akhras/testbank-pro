"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
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

  return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <a href="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#e8e8e0", letterSpacing: "-0.5px" }}>
              TestArca
            </div>
          </a>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>Reset your password</div>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📧</div>
            <div style={{ fontSize: "0.95rem", color: "#e8e8e0", marginBottom: "0.5rem", fontWeight: "500" }}>Check your email</div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.6 }}>
              We sent a password reset link to <strong style={{ color: "#94a3b8" }}>{email}</strong>
            </div>
            <a href="/login" style={{ display: "block", marginTop: "2rem", color: "#10b981", fontSize: "0.85rem", textDecoration: "none" }}>
              ← Back to Sign In
            </a>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com"
                style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#1a1a2e", border: "1px solid #334155",
                  borderRadius: "6px", color: "#e8e8e0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
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
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <a href="/login" style={{ display: "block", textAlign: "center", marginTop: "1.25rem", color: "#475569", fontSize: "0.82rem", textDecoration: "none" }}>
              ← Back to Sign In
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
