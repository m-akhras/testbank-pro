"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import DashboardScreen from "../../../components/screens/DashboardScreen.jsx";
import { makeStyles, text1, text2, text3, border, bg1, green1 } from "../../../lib/theme.js";
import { validateQuestion } from "../../../lib/utils/questions.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build",
  export: "/app/export", exams: "/app/exams", saved: "/app/exams",
  courses: "/app/courses", admin: "/app/admin",
};

export default function DashboardPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  const bankIssueCount = ctx.bank.bank.filter(q => validateQuestion(q).length > 0).length;

  return (
    <DashboardScreen
      bank={ctx.bank.bank}
      bankLoaded={ctx.bank.bankLoaded}
      bankIssueCount={bankIssueCount}
      lastGenerated={ctx.generate.lastGenerated}
      savedExams={ctx.examBuilder.savedExams}
      course={ctx.course}
      allCourses={ctx.allCourses}
      courseColors={ctx.courseColors}
      accent={accent}
      exportHighlight={ctx.examBuilder.exportHighlight}
      setExportHighlight={ctx.examBuilder.setExportHighlight}
      customCourses={{}}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border} bg1={bg1}
      setCourse={ctx.generate.setCourse}
      setSelectedSections={ctx.generate.setSelectedSections}
      setSectionCounts={ctx.generate.setSectionCounts}
      setSectionConfig={ctx.generate.setSectionConfig}
      setScreen={setScreen}
      setFilterIssuesOnly={ctx.bank.setFilterIssuesOnly}
      saveCustomCourse={() => {}}
      deleteCustomCourse={() => {}}
      isAdmin={ctx.auth.isAdmin}
    />
  );
}
