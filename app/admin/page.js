"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const ADMIN_EMAIL = "mohammadalakhrass@yahoo.com";
const DEFAULT_MONTHLY_LIMIT = 500;

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvedEmails, setApprovedEmails] = useState([]);
  const [usage, setUsage] = useState({});
  const [limits, setLimits] = useState({});
  const [suspended, setSuspended] = useState({});
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingLimit, setEditingLimit] = useState(null);
  const [limitInput, setLimitInput] = useState("");

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
    setLoading(true);
    const [{ data: emails }, { data: usageData }, { data: limitsData }] = await Promise.all([
      supabase.from("approved_emails").select("email").order("email"),
      supabase.from("api_usage").select("user_id, created_at").order("created_at", { ascending: false }),
      supabase.from("user_limits").select("email, monthly_limit, is_suspended").catch(() => ({ data: [] })),
    ]);

    setApprovedEmails(emails || []);

    // Build usage map
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const usageMap = {};
    (usageData || []).forEach(row => {
      if (!usageMap[row.user_id]) usageMap[row.user_id] = { total: 0, today: 0, month: 0, lastActive: null };
      usageMap[row.user_id].total++;
      if (row.created_at >= oneDayAgo) usageMap[row.user_id].today++;
      if (row.created_at >= oneMonthAgo) usageMap[row.user_id].month++;
      if (!usageMap[row.user_id].lastActive || row.created_at > usageMap[row.user_id].lastActive) {
        usageMap[row.user_id].lastActive = row.created_at;
      }
    });
    setUsage(usageMap);

    // Build limits & suspended map
    const limitsMap = {};
    const suspendedMap = {};
    (limitsData || []).forEach(row => {
      limitsMap[row.email] = row.monthly_limit ?? DEFAULT_MONTHLY_LIMIT;
      suspendedMap[row.email] = row.is_suspended ?? false;
    });
    setLimits(limitsMap);
    setSuspended(suspendedMap);
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

  async function toggleSuspend(email) {
    const current = suspended[email] ?? false;
    const action = current ? "Unsuspend" : "Suspend";
    if (!confirm(`${action} ${email}?`)) return;
    await supabase.from("user_limits").upsert({ email, is_suspended: !current, monthly_limit: limits[email] ?? DEFAULT_MONTHLY_LIMIT }, { onConflict: "email" });
    setSuccess(`${email} ${current ? "unsuspended" : "suspended"}.`);
    loadData();
  }

  async function saveLimit(email) {
    const val = parseInt(limitInput);
    if (isNaN(val) || val < 0) { setError("Invalid limit."); return; }
    await supabase.from("user_limits").upsert({ email, monthly_limit: val, is_suspended: suspended[email] ?? false }, { onConflict: "email" });
    setSuccess(`Limit updated for ${email}.`);
    setEditingLimit(null);
    loadData();
  }

  async function loadUserHistory(email) {
    setSelectedUser(email);
    setHistoryLoading(true);
    setActiveTab("history");
    const { data } = await supabase
      .from("api_usage")
      .select("user_id, created_at")
      .eq("user_id", email)
      .order("created_at", { ascending: false })
      .limit(50);
    setUserHistory(data || []);
    setHistoryLoading(false);
  }

  function getUsageColor(month, limit) {
    const pct = month / limit;
    if (pct >= 1) return "#ef4444";
    if (pct >= 0.8) return "#f59e0b";
    return "#10b981";
  }

  function formatDate(iso) {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const totalCalls = Object.values(usage).reduce((a, u) => a + u.total, 0);
  const todayCalls = Object.values(usage).reduce((a, u) => a + u.today, 0);
  const monthCalls = Object.values(usage).reduce((a, u) => a + u.month, 0);
  const suspendedCount = Object.values(suspended).filter(Boolean).length;
  const highUsageCount = approvedEmails.filter(({ email }) => {
    const m = usage[email]?.month ?? 0;
    const lim = limits[email] ?? DEFAULT_MONTHLY_LIMIT;
    return m / lim >= 0.8;
  }).length;

  const S = {
    page: { minHeight: "100vh", background: "#060910", color: "#e8e8e0", fontFamily: "'Inter', sans-serif", padding: "2rem" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1e3a5f" },
    title: { fontSize: "1.4rem", fontWeight: "700", color: "#e8e8e0", letterSpacing: "-0.5px" },
    subtitle: { fontSize: "0.78rem", color: "#475569", marginTop: "0.2rem" },
    card: { background: "#0f1629", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "1.5rem", marginBottom: "1.5rem" },
    cardTitle: { fontSize: "0.85rem", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" },
    input: { background: "#1a1a2e", border: "1px solid #334155", borderRadius: "6px", color: "#e8e8e0", fontSize: "0.88rem", padding: "0.6rem 0.85rem", outline: "none", width: "100%", boxSizing: "border-box" },
    btn: (color = "#10b981") => ({ background: color, color: "#fff", border: "none", borderRadius: "6px", padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }),
    smBtn: (color = "#1e3a5f") => ({ background: color, color: "#e8e8e0", border: "none", borderRadius: "5px", padding: "0.25rem 0.6rem", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }),
    statGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", marginBottom: "1.5rem" },
    stat: (color = "#10b981") => ({ background: "#0a1628", border: `1px solid ${color}33`, borderRadius: "8px", padding: "1rem", textAlign: "center" }),
    statVal: (color = "#10b981") => ({ fontSize: "1.75rem", fontWeight: "700", color, letterSpacing: "-0.5px" }),
    statLabel: { fontSize: "0.72rem", color: "#475569", marginTop: "0.2rem" },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #0f1e35" },
    alert: (type) => ({ padding: "0.65rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", marginBottom: "1rem", background: type === "error" ? "#1a0a0a" : "#052e16", border: `1px solid ${type === "error" ? "#7f1d1d" : "#14532d"}`, color: type === "error" ? "#f87171" : "#4ade80" }),
    tabs: { display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid #1e3a5f", paddingBottom: "0" },
    tab: (active) => ({ background: "none", border: "none", borderBottom: active ? "2px solid #10b981" : "2px solid transparent", color: active ? "#10b981" : "#475569", fontSize: "0.85rem", fontWeight: "600", padding: "0.5rem 1rem", cursor: "pointer", marginBottom: "-1px" }),
    progressBar: (pct, color) => ({ height: "4px", borderRadius: "2px", background: "#1e3a5f", position: "relative", overflow: "hidden", marginTop: "4px", width: "80px", display: "inline-block" }),
    progressFill: (pct, color) => ({ height: "100%", width: `${Math.min(100, pct * 100)}%`, background: color, borderRadius: "2px", transition: "width 0.3s" }),
  };

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#475569" }}>Loading...</div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.title}>⚙️ Admin Panel</div>
            <div style={S.subtitle}>TestArca — {user?.email}</div>
          </div>
          <a href="/app" style={{ color: "#475569", fontSize: "0.82rem", textDecoration: "none" }}>← Back to App</a>
        </div>

        {/* Stats */}
        <div style={S.statGrid}>
          <div style={S.stat("#10b981")}>
            <div style={S.statVal("#10b981")}>{approvedEmails.length}</div>
            <div style={S.statLabel}>Total Users</div>
          </div>
          <div style={S.stat("#3b82f6")}>
            <div style={S.statVal("#3b82f6")}>{todayCalls}</div>
            <div style={S.statLabel}>Calls Today</div>
          </div>
          <div style={S.stat("#8b5cf6")}>
            <div style={S.statVal("#8b5cf6")}>{monthCalls}</div>
            <div style={S.statLabel}>Calls This Month</div>
          </div>
          <div style={S.stat("#f59e0b")}>
            <div style={S.statVal("#f59e0b")}>{highUsageCount}</div>
            <div style={S.statLabel}>High Usage ⚠️</div>
          </div>
          <div style={S.stat("#ef4444")}>
            <div style={S.statVal("#ef4444")}>{suspendedCount}</div>
            <div style={S.statLabel}>Suspended</div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={S.alert("error")}>{error}</div>}
        {success && <div style={S.alert("success")}>{success}</div>}

        {/* Tabs */}
        <div style={S.tabs}>
          {["overview", "add", "history"].map(tab => (
            <button key={tab} style={S.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              {tab === "overview" ? "👥 Users & Usage" : tab === "add" ? "➕ Add User" : `📋 History${selectedUser ? ` — ${selectedUser.split("@")[0]}` : ""}`}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={S.card}>
            <div style={S.cardTitle}>User Generation Control ({approvedEmails.length})</div>
            {approvedEmails.length === 0 ? (
              <div style={{ color: "#475569", fontSize: "0.85rem" }}>No approved users yet.</div>
            ) : (
              <>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 100px 100px 160px", gap: "0.5rem", padding: "0.4rem 0", marginBottom: "0.25rem", fontSize: "0.68rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #1e3a5f" }}>
                  <div>User</div>
                  <div style={{ textAlign: "center" }}>Today</div>
                  <div style={{ textAlign: "center" }}>Month</div>
                  <div style={{ textAlign: "center" }}>Total</div>
                  <div style={{ textAlign: "center" }}>Last Active</div>
                  <div style={{ textAlign: "center" }}>Limit</div>
                  <div style={{ textAlign: "center" }}>Actions</div>
                </div>

                {approvedEmails.map(({ email }) => {
                  const u = usage[email] ?? { total: 0, today: 0, month: 0, lastActive: null };
                  const lim = limits[email] ?? DEFAULT_MONTHLY_LIMIT;
                  const isSuspended = suspended[email] ?? false;
                  const isAdmin = email === ADMIN_EMAIL;
                  const usageColor = getUsageColor(u.month, lim);
                  const pct = u.month / lim;

                  return (
                    <div key={email} style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 100px 100px 160px", gap: "0.5rem", alignItems: "center", padding: "0.7rem 0", borderBottom: "1px solid #0f1e35", opacity: isSuspended ? 0.5 : 1 }}>

                      {/* Email */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isSuspended ? "#ef4444" : isAdmin ? "#10b981" : "#3b82f6", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.83rem", color: "#e8e8e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
                          <div style={{ display: "flex", gap: "0.3rem", marginTop: "2px" }}>
                            {isAdmin && <span style={{ fontSize: "0.6rem", color: "#10b981", background: "#052e16", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>Admin</span>}
                            {isSuspended && <span style={{ fontSize: "0.6rem", color: "#ef4444", background: "#1a0a0a", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>Suspended</span>}
                            {pct >= 0.8 && !isSuspended && <span style={{ fontSize: "0.6rem", color: "#f59e0b", background: "#1c1002", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>High Usage</span>}
                          </div>
                        </div>
                      </div>

                      {/* Today */}
                      <div style={{ textAlign: "center", fontSize: "0.85rem", color: u.today > 0 ? "#e8e8e0" : "#334155", fontWeight: u.today > 0 ? "600" : "400" }}>{u.today}</div>

                      {/* Month */}
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: usageColor, fontWeight: "600" }}>{u.month}</div>
                        <div style={S.progressBar(pct, usageColor)}>
                          <div style={S.progressFill(pct, usageColor)} />
                        </div>
                      </div>

                      {/* Total */}
                      <div style={{ textAlign: "center", fontSize: "0.85rem", color: "#94a3b8" }}>{u.total}</div>

                      {/* Last Active */}
                      <div style={{ textAlign: "center", fontSize: "0.68rem", color: "#475569" }}>
                        {u.lastActive ? formatDate(u.lastActive) : "—"}
                      </div>

                      {/* Limit */}
                      <div style={{ textAlign: "center" }}>
                        {editingLimit === email ? (
                          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                            <input
                              type="number"
                              value={limitInput}
                              onChange={e => setLimitInput(e.target.value)}
                              style={{ ...S.input, width: "55px", padding: "0.2rem 0.3rem", fontSize: "0.78rem" }}
                              autoFocus
                            />
                            <button onClick={() => saveLimit(email)} style={S.smBtn("#10b981")}>✓</button>
                            <button onClick={() => setEditingLimit(null)} style={S.smBtn("#334155")}>✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingLimit(email); setLimitInput(String(lim)); }}
                            style={{ background: "none", border: "1px solid #1e3a5f", borderRadius: "5px", color: "#94a3b8", fontSize: "0.78rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
                          >
                            {lim}/mo
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <button onClick={() => loadUserHistory(email)} style={S.smBtn("#1e3a5f")}>📋 History</button>
                        {!isAdmin && (
                          <>
                            <button onClick={() => toggleSuspend(email)} style={S.smBtn(isSuspended ? "#052e16" : "#1c1002")}>
                              {isSuspended ? "✅ Resume" : "🚫 Suspend"}
                            </button>
                            <button onClick={() => removeEmail(email)} style={S.smBtn("#3b0a0a")}>Remove</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ADD USER TAB */}
        {activeTab === "add" && (
          <div style={S.card}>
            <div style={S.cardTitle}>Add Approved User</div>
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
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div style={S.card}>
            <div style={S.cardTitle}>
              Generation History {selectedUser ? `— ${selectedUser}` : ""}
            </div>
            {!selectedUser ? (
              <div style={{ color: "#475569", fontSize: "0.85rem" }}>Select a user from the Users & Usage tab to view their history.</div>
            ) : historyLoading ? (
              <div style={{ color: "#475569", fontSize: "0.85rem" }}>Loading...</div>
            ) : userHistory.length === 0 ? (
              <div style={{ color: "#475569", fontSize: "0.85rem" }}>No generation history found.</div>
            ) : (
              <>
                <div style={{ fontSize: "0.78rem", color: "#475569", marginBottom: "1rem" }}>
                  Showing last {userHistory.length} generation requests
                </div>
                {userHistory.map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #0f1e35" }}>
                    <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Generation #{userHistory.length - i}</div>
                    <div style={{ fontSize: "0.78rem", color: "#475569" }}>{formatDate(row.created_at)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
