"use client";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const bg3    = "#EDE8DE";
const border = "#D9D0C0";
const text3  = "#A89E8E";

const NAV_GROUPS = [
  {
    label: "CONTENT",
    items: [
      { href: "/app/dashboard", icon: "🏠", label: "Dashboard" },
      { href: "/app/generate",  icon: "✨", label: "Generate" },
      { href: "/app/bank",      icon: "📚", label: "Question Bank", badgeKey: "bank" },
    ],
  },
  {
    label: "EXAMS",
    items: [
      { href: "/app/build",  icon: "🏗", label: "Build Exam", badgeKey: "selectedForExam" },
      { href: "/app/export", icon: "📤", label: "Export" },
      { href: "/app/exams",  icon: "💾", label: "My Exams" },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { href: "/app/courses", icon: "🎓", label: "Courses" },
      { href: "/app/admin",   icon: "⚙",  label: "Admin", adminOnly: true },
    ],
  },
];

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function Sidebar({ user, bank = [], lastGenerated = [], selectedForExam = [], isAdmin = false, bankIssueCount = 0, course = null, accent = "#2D6A4F" }) {
  const pathname = usePathname();
  const router = useRouter();

  const badges = { bank: bank.length, lastGenerated: lastGenerated.length, selectedForExam: selectedForExam.length };

  const S = {
    sidebar: {
      width: "230px", flexShrink: 0, background: "#1B4332",
      borderRight: "none", display: "flex", flexDirection: "column",
      padding: "0", position: "sticky", top: 0, height: "100vh", overflowY: "auto",
    },
    sidebarLogo: {
      padding: "1.5rem 1.25rem 1.2rem", borderBottom: "1px solid #2D6A4F",
      display: "flex", alignItems: "center", gap: "0.75rem",
    },
    logoMark: {
      width: "36px", height: "36px", borderRadius: "10px", background: "#52B788",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "1rem", fontWeight: "900", color: "#1B4332", flexShrink: 0,
    },
    logoText: { fontSize: "0.95rem", fontWeight: "700", letterSpacing: "-0.02em", color: "#D8F3DC", fontFamily: "'Georgia',serif" },
    logoSub:  { fontSize: "0.55rem", color: "#52B788", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "3px", fontFamily: "'Inter',system-ui,sans-serif" },
    navSection: { padding: "1.2rem 1rem 0.3rem", fontSize: "0.55rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#52B788", fontWeight: "700", fontFamily: "'Inter',system-ui,sans-serif" },
    navBtn: (active) => ({
      display: "flex", alignItems: "center", gap: "0.65rem",
      padding: "0.55rem 0.9rem", margin: "0.04rem 0.6rem",
      borderRadius: "8px", border: "none", cursor: "pointer",
      background: active ? "#52B78825" : "transparent",
      color: active ? "#D8F3DC" : "#74B49B",
      fontSize: "0.82rem", fontWeight: active ? "600" : "400",
      textAlign: "left", width: "calc(100% - 1.2rem)",
      transition: "background 0.12s, color 0.12s",
      borderLeft: active ? "3px solid #52B788" : "3px solid transparent",
      fontFamily: "'Inter',system-ui,sans-serif",
      textDecoration: "none",
    }),
    navIcon:  { fontSize: "0.95rem", width: "20px", textAlign: "center", flexShrink: 0 },
    navBadge: {
      marginLeft: "auto", background: "#52B78830", color: "#D8F3DC",
      border: "1px solid #52B78860", borderRadius: "10px",
      padding: "0.05rem 0.4rem", fontSize: "0.6rem", fontWeight: "700",
      fontFamily: "'Inter',system-ui,sans-serif",
    },
  };

  return (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={S.sidebarLogo}>
        <div style={S.logoMark}>T</div>
        <div>
          <div style={S.logoText}>TestArca</div>
          <div style={S.logoSub}>Exam Authoring Suite</div>
        </div>
      </div>

      {/* Notification banners */}
      {bankIssueCount > 0 && (
        <div onClick={() => router.push("/app/bank?issues=1")} style={{
          margin: "0.4rem 0.6rem 0", padding: "0.5rem 0.7rem",
          background: "#FEE2E2", border: "1px solid #FECACA",
          borderRadius: "8px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ fontSize: "0.9rem" }}>⚠️</span>
          <div>
            <div style={{ fontSize: "0.71rem", color: "#9B1C1C", fontWeight: "600", lineHeight: 1.3 }}>
              {bankIssueCount} question{bankIssueCount > 1 ? "s" : ""} with issues
            </div>
            <div style={{ fontSize: "0.62rem", color: "#9B1C1C", marginTop: "1px" }}>Click to fix →</div>
          </div>
        </div>
      )}

      {/* Nav groups */}
      <div style={{ padding: "0.4rem 0", flex: 1 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            <div style={S.navSection}>{group.label}</div>
            {group.items
              .filter(item => !item.adminOnly || isAdmin)
              .map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const badge = item.badgeKey ? badges[item.badgeKey] : null;
                return (
                  <button key={item.href} style={S.navBtn(active)} onClick={() => router.push(item.href)}>
                    <span style={S.navIcon}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {badge > 0 && <span style={S.navBadge}>{badge}</span>}
                  </button>
                );
              })}
          </div>
        ))}
      </div>

      {/* Active course */}
      {course && (
        <div style={{ padding: "0.7rem 1rem", borderTop: "1px solid " + border }}>
          <div style={{ fontSize: "0.57rem", color: text3, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.3rem" }}>Active Course</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: accent, flexShrink: 0, boxShadow: "0 0 6px " + accent }} />
            <span style={{ fontSize: "0.74rem", color: accent, fontWeight: "600", lineHeight: 1.3 }}>{course}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: "0.55rem 1rem", borderTop: "1px solid " + border }}>
        {user && (
          <div style={{ marginBottom: "0.4rem" }}>
            <div style={{ fontSize: "0.6rem", color: text3, marginBottom: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
            <button
              onClick={() => getSupabase().auth.signOut().then(() => router.push("/login"))}
              style={{ fontSize: "0.62rem", color: "#475569", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Sign out
            </button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.57rem", color: text3 }}>TestArca</span>
          <span style={{ fontSize: "0.57rem", color: text3, background: bg3, padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: "600" }}>v55</span>
        </div>
      </div>
    </aside>
  );
}
