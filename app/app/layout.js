"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Sidebar from "../../components/layout/Sidebar.jsx";
import { AppProvider } from "../../context/AppContext.js";
import { ExportProvider } from "../../context/ExportContext.js";
import ExportFunctionsProvider from "../../components/ExportFunctionsProvider.jsx";

const ADMIN_EMAIL = "mohammadalakhrass@yahoo.com";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AppLayout({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        router.replace("/login");
      } else {
        setUser(session.user);
        setReady(true);
      }
    });
    return () => { active = false; };
  }, [router]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2EDE4", color: "#6B6355", fontSize: "0.9rem" }}>
        Loading…
      </div>
    );
  }

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <AppProvider>
      <ExportProvider>
        <ExportFunctionsProvider>
          <div style={{ minHeight: "100vh", background: "#F2EDE4", color: "#1C1A16", display: "flex", fontFamily: "system-ui, -apple-system, sans-serif" }}>
            <Sidebar user={user} isAdmin={isAdmin} />
            <main style={{ flex: 1, minWidth: 0, padding: "2.5rem 3rem", maxWidth: "1400px", margin: "0 auto", overflow: "auto" }}>
              {children}
            </main>
          </div>
        </ExportFunctionsProvider>
      </ExportProvider>
    </AppProvider>
  );
}
