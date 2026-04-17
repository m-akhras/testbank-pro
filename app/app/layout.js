"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NAV = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/generate",  label: "Generate"  },
  { href: "/app/review",    label: "Review"    },
  { href: "/app/bank",      label: "Bank"      },
  { href: "/app/build",     label: "Build"     },
  { href: "/app/export",    label: "Export"    },
  { href: "/app/exams",     label: "Exams"     },
  { href: "/app/courses",   label: "Courses"   },
  { href: "/app/admin",     label: "Admin"     },
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) router.replace("/login");
      else setReady(true);
    });
    return () => { active = false; };
  }, [router]);

  if (!ready) {
    return (
      <div style={{minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F2EDE4", color:"#6B6355", fontSize:"0.9rem"}}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh", background:"#F2EDE4", color:"#1C1A16", fontFamily:"system-ui, -apple-system, sans-serif"}}>
      <nav style={{display:"flex", gap:"0.25rem", padding:"0.6rem 1rem", background:"#FDFAF5", borderBottom:"1px solid #D9D0C0", flexWrap:"wrap", alignItems:"center"}}>
        <div style={{fontWeight:"700", color:"#2D6A4F", marginRight:"1rem", fontSize:"0.95rem"}}>TestBank Pro</div>
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <a key={item.href} href={item.href}
              style={{
                padding:"0.35rem 0.75rem",
                fontSize:"0.82rem",
                color: active ? "#2D6A4F" : "#6B6355",
                background: active ? "#2D6A4F22" : "transparent",
                borderRadius:"6px",
                textDecoration:"none",
                fontWeight: active ? "600" : "500",
              }}>
              {item.label}
            </a>
          );
        })}
        <button
          onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
          style={{marginLeft:"auto", padding:"0.35rem 0.75rem", fontSize:"0.78rem", background:"transparent", color:"#6B6355", border:"1px solid #D9D0C0", borderRadius:"6px", cursor:"pointer"}}>
          Sign out
        </button>
      </nav>
      <main style={{padding:"1.5rem 1rem", maxWidth:"1400px", margin:"0 auto"}}>
        {children}
      </main>
    </div>
  );
}
