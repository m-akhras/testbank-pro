"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import CoursesScreen from "../../../components/screens/CoursesScreen.jsx";
import { useCourses } from "../../../hooks/useCourses.js";

const ADMIN_EMAIL = "mohammadalakhrass@yahoo.com";

const bg1    = "#FDFAF5";
const bg2    = "#F7F2E9";
const bg3    = "#EDE8DE";
const border = "#D9D0C0";
const text1  = "#1C1A16";
const text2  = "#6B6355";
const text3  = "#A89E8E";
const accent = "#2D6A4F";

const S = {
  pageHeader: { marginBottom: "2rem", borderBottom: "1px solid " + border, paddingBottom: "1.25rem" },
  h1: { fontSize: "1.75rem", fontWeight: "700", letterSpacing: "-0.03em", marginBottom: "0.25rem", color: text1, fontFamily: "'Georgia',serif" },
  sub: { color: text2, fontSize: "0.83rem", marginBottom: 0, lineHeight: 1.6, fontFamily: "'Inter',system-ui,sans-serif" },
  card: { background: bg1, border: "1px solid " + border, borderRadius: "14px", padding: "1.5rem", marginBottom: "1rem", boxShadow: "0 1px 3px rgba(45,106,79,0.06)" },
  btn: (bg, dis) => ({
    background: dis ? bg3 : bg, color: "#fff", border: "none", borderRadius: "9px",
    padding: "0.65rem 1.4rem", fontSize: "0.83rem", fontWeight: "600",
    cursor: dis ? "not-allowed" : "pointer", fontFamily: "'Inter',system-ui,sans-serif",
    display: "inline-flex", alignItems: "center", gap: "0.45rem", opacity: dis ? 0.5 : 1,
  }),
  oBtn: (c) => ({
    background: "transparent", color: c, border: "1px solid " + c + "66",
    borderRadius: "9px", padding: "0.55rem 1.1rem", fontSize: "0.78rem",
    cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif",
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
  }),
};

export default function CoursesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const { courses, saveCourse, deleteCourse, coursesLoaded } = useCourses();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || "");
    });
  }, []);

  const isAdmin = userEmail === ADMIN_EMAIL;

  if (!coursesLoaded) {
    return <div style={{ color: text2, fontSize: "0.9rem" }}>Loading courses…</div>;
  }

  return (
    <CoursesScreen
      courses={courses}
      saveCourse={saveCourse}
      deleteCourse={deleteCourse}
      setScreen={(screen) => {
        const map = {
          dashboard: "/app/dashboard",
          generate: "/app/generate",
          review: "/app/review",
          bank: "/app/bank",
          build: "/app/build",
          export: "/app/export",
          exams: "/app/exams",
          courses: "/app/courses",
        };
        if (map[screen]) router.push(map[screen]);
      }}
      isAdmin={isAdmin}
      S={S}
      text1={text1}
      text2={text2}
      text3={text3}
      border={border}
      accent={accent}
      bg1={bg1}
      bg2={bg2}
    />
  );
}
