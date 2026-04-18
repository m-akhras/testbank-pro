"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import ExamsScreen from "../../../components/screens/ExamsScreen.jsx";
import { makeStyles, text1, text2, text3, border, bg1, bg2, green1 } from "../../../lib/theme.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function ExamsPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;
  const { bank, examBuilder, generate } = ctx;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  return (
    <ExamsScreen
      savedMasters={examBuilder.savedMasters}
      loadSavedMasters={examBuilder.loadSavedMasters}
      deleteSavedMaster={examBuilder.deleteSavedMaster}
      loadMaster={examBuilder.loadMaster}
      bank={bank.bank}
      setVersions={examBuilder.setVersions}
      setClassSectionVersions={examBuilder.setClassSectionVersions}
      setActiveVersion={examBuilder.setActiveVersion}
      setMasterLocked={examBuilder.setMasterLocked}
      setExamSaved={examBuilder.setExamSaved}
      setSaveExamName={examBuilder.setSaveExamName}
      setCourse={generate.setCourse}
      setSelectedForExam={examBuilder.setSelectedForExam}
      setScreen={setScreen}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border} accent={accent} bg1={bg1} bg2={bg2}
    />
  );
}
