"use client";
import Link from "next/link";
import { useAppContext } from "../../../context/AppContext.js";
import { makeStyles, text1, text2, text3, green1 } from "../../../lib/theme.js";

export default function AdminPage() {
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;

  if (!ctx.auth.isAdmin) {
    return (
      <div>
        <div style={S.pageHeader}>
          <h1 style={S.h1}>Admin</h1>
          <p style={S.sub}>This area is restricted to administrators.</p>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
            Admin access required
          </div>
          <div style={{ fontSize: "0.82rem", color: text2, lineHeight: 1.6 }}>
            Sign in with an administrator account to continue.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Admin</h1>
        <p style={S.sub}>Manage approved users, API usage, and seed data.</p>
      </div>
      <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🛠</div>
        <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
          Open the full admin panel
        </div>
        <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.5rem", lineHeight: 1.6 }}>
          User approvals, API usage limits, and data setup tools live at /admin.
        </div>
        <Link href="/admin" style={{ ...S.btn(accent, false), textDecoration: "none", display: "inline-block" }}>
          Go to /admin →
        </Link>
      </div>
    </div>
  );
}
