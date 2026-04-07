"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const ADMIN_EMAIL = "mohammadalakhrass@yahoo.com";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvedEmails, setApprovedEmails] = useState([]);
  const [users, setUsers] = useState([]);
  const [usage, setUsage] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/login"; return; }
      if (session.user.email !== ADMIN_EMAIL) { window.location.href = "/app"; return; }
      setUser(session.user);
      loadData();
    });
  }, []);

  async function loadData() {
    const [{ data: emails }, { data: usageData }] = await Promise.all([
      supabase.from("approved_emails").select("email").order("email"),
      supabase.from("api_usage").select("user_id, created_at").order("created_at", { ascending: false }),
    ]);
    setApprovedEmails(emails || []);

    // Count usage per user in last 24h and total
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const usageMap = {};
    (usageData || []).forEach(row => {
      if (!usageMap[row.user_id]) usageMap[row.user_id] = { total: 0, today: 0 };
      usageMap[row.user_id].total++;
      if (row.created_at >= oneDayAgo) usageMap[row.user_id].today++;
    });
    setUsage(usageMap);
    setLoading(false);
  }

  async function addEmail(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!newEmail.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("approved_emails").insert({ email: newEmail.trim().toLowerCase() });
    if (error) {
      setError(error.message.includes("duplicate") ? "Email already approved." : error.message);
    } else {
      setSuccess(`${newEmail} added successfully.`);
      setNewEmail("");
      loadData();
    }
    setAdding(false);
  }

  async function removeEmail(email) {
    if (!confirm(`Remove ${email} from approved list?`)) return;
    await supabase.from("approved_emails").delete().eq("email", email);
    setSuccess(`${email} removed.`);
    loadData();
  }

  const S = {
    page: { minHeight: "100vh", background: "#060910", color: "#e8e8e0", fontFamily: "'Inter', sans-serif", padding: "2rem" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1e3a5f" },
    title: { fontSize: "1.4rem", fontWeight: "700", color: "#e8e8e0", letterSpacing: "-0.5px" },
    subtitle: { fontSize: "0.78rem", color: "#475569", marginTop: "0.2rem" },
    card: { background: "#0f1629", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem" },
    cardTitle: { fontSize: "0.85rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" },
    input: { background: "#1a1a2e", border: "1px solid #334155", borderRadius: "6px", color: "#e8e8e0", fontSize: "0.88rem", padding: "0.6rem 0.85rem", outline: "none", width: "100%", boxSizing: "border-box" },
    btn: (color="#10b981") => ({ background: color, color: "#fff", border: "none", borderRadius: "6px", padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }),
    tag: { display: "inline-flex", alignItems: "center", gap: "8px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "0.5rem 0.85rem", marginBottom: "0.5rem", marginRight: "0.5rem" },
    removeBtn: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: "0 2px" },
    statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" },
    stat: { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "1rem", textAlign: "center" },
    statVal: { fontSize: "1.75rem", fontWeight: "700", color: "#10b981", letterSpacing: "-0.5px" },
    statLabel: { fontSize: "0.72rem", color: "#475569", marginTop: "0.2rem" },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0", borderBottom: "1px solid #0f1e35" },
    alert: (type) => ({ padding: "0.65rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", marginBottom: "1rem", background: type === "error" ? "#1a0a0a" : "#052e16", border: `1px solid ${type === "error" ? "#7f1d1d" : "#14532d"}`, color: type === "error" ? "#f87171" : "#4ade80" }),
  };

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#475569" }}>Loading...</div>
    </div>
  );

  const totalCalls = Object.values(usage).reduce((a, u) => a + u.total, 0);
  const todayCalls = Object.values(usage).reduce((a, u) => a + u.today, 0);

  return (
    <div style={S.page}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.title}>⚙️ Admin Panel</div>
            <div style={S.subtitle}>TestBank Pro — {user?.email}</div>
          </div>
          <a href="/app" style={{ color: "#475569", fontSize: "0.82rem", textDecoration: "none" }}>← Back to App</a>
        </div>

        {/* Stats */}
        <div style={S.statGrid}>
          <div style={S.stat}>
            <div style={S.statVal}>{approvedEmails.length}</div>
            <div style={S.statLabel}>Approved Users</div>
          </div>
          <div style={S.stat}>
            <div style={S.statVal}>{todayCalls}</div>
            <div style={S.statLabel}>API Calls Today</div>
          </div>
          <div style={S.stat}>
            <div style={S.statVal}>{totalCalls}</div>
            <div style={S.statLabel}>Total API Calls</div>
          </div>
        </div>

        {/* Add Email */}
        <div style={S.card}>
          <div style={S.cardTitle}>Add Approved User</div>
          {error && <div style={S.alert("error")}>{error}</div>}
          {success && <div style={S.alert("success")}>{success}</div>}
          <form onSubmit={addEmail} style={{ display: "flex", gap: "0.75rem" }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="instructor@university.edu"
              style={S.input}
              required
            />
            <button type="submit" disabled={adding} style={{ ...S.btn(), whiteSpace: "nowrap" }}>
              {adding ? "Adding..." : "+ Add User"}
            </button>
          </form>
        </div>

        {/* Approved Emails */}
        <div style={S.card}>
          <div style={S.cardTitle}>Approved Users ({approvedEmails.length})</div>
          {approvedEmails.length === 0 ? (
            <div style={{ color: "#475569", fontSize: "0.85rem" }}>No approved users yet.</div>
          ) : (
            <div>
              {approvedEmails.map(({ email }) => (
                <div key={email} style={S.row}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: email === ADMIN_EMAIL ? "#10b981" : "#3b82f6" }} />
                    <span style={{ fontSize: "0.88rem", color: "#e8e8e0" }}>{email}</span>
                    {email === ADMIN_EMAIL && <span style={{ fontSize: "0.65rem", color: "#10b981", background: "#052e16", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>Admin</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                      {usage[email] ? `${usage[email].today} calls today` : "No API usage"}
                    </span>
                    {email !== ADMIN_EMAIL && (
                      <button onClick={() => removeEmail(email)} style={{ ...S.btn("#7f1d1d"), padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
