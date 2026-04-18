"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import ReviewScreen from "../../../components/screens/ReviewScreen.jsx";
import { makeStyles, text1, text2, text3, border, green1 } from "../../../lib/theme.js";
import { validateQuestion } from "../../../lib/utils/questions.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function ReviewPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  return (
    <ReviewScreen
      lastGenerated={ctx.generate.lastGenerated}
      dupWarnings={ctx.generate.dupWarnings}
      accent={green1}
      courseColors={ctx.courseColors}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border}
      setScreen={setScreen}
      setSelectedForExam={ctx.examBuilder.setSelectedForExam}
      validateQuestion={validateQuestion}
    />
  );
}
