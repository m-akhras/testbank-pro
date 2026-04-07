"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: approved } = await supabase
        .from("approved_emails")
        .select("email")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (!approved) {
        setError("Access denied. Your email is not approved.");
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
        const { error: signInError2 } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError2) {
          setError(signInError2.message);
          setLoading(false);
          return;
        }
      }

      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        padding: "2.5rem",
        background: "#0f1629",
        border: "1px solid #1e3a5f",
        borderRadius: "12px",
        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#e8e8e0", letterSpacing: "-0.5px" }}>
            TestBank <span style={{ color: "#10b981" }}>Pro</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.4rem" }}>Exam Authoring Suite</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com"
              style={{ width: "100%", padding: "0.65rem 0.85rem", background: "#1a1a2e", border: "1px solid #334155",
                borderRadius: "6px", color: "#e8e8e0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem" }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "#475569" }}>
          Access is by invitation only.
        </div>
      </div>
    </div>
  );
}
