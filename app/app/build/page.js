"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import BuildScreen from "../../../components/screens/BuildScreen.jsx";
import { makeStyles, text1, text2, text3, border, bg1, bg2, green1 } from "../../../lib/theme.js";
import { validateQuestion, sectionSortKey } from "../../../lib/utils/questions.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", variants: "/app/variants", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function BuildPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;
  const { bank, examBuilder, generate } = ctx;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  return (
    <BuildScreen
      bank={bank.bank}
      course={ctx.course}
      selectedForExam={examBuilder.selectedForExam} setSelectedForExam={examBuilder.setSelectedForExam}
      versions={examBuilder.versions} setVersions={examBuilder.setVersions}
      masterLocked={examBuilder.masterLocked} setMasterLocked={examBuilder.setMasterLocked}
      masterName={examBuilder.masterName} setMasterName={examBuilder.setMasterName}
      savingMaster={examBuilder.savingMaster}
      saveMaster={examBuilder.saveMaster}
      dupWarnings={generate.dupWarnings}
      appendToMaster={examBuilder.appendToMaster}
      setAppendToMaster={examBuilder.setAppendToMaster}
      pendingAddFromBank={examBuilder.pendingAddFromBank}
      setPendingAddFromBank={examBuilder.setPendingAddFromBank}
      showToast={ctx.showToast}
      validateQuestion={validateQuestion}
      sectionSortKey={sectionSortKey}
      setScreen={setScreen}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border} accent={accent}
      bg1={bg1} bg2={bg2}
      courseColors={ctx.courseColors}
    />
  );
}
