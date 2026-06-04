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
  examGenerator: "/app/exam-generator",
};

export default function BuildPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;
  const { bank, examBuilder, generate, validation } = ctx;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  return (
    <BuildScreen
      bank={bank.bank}
      course={ctx.course}
      selectedForExam={examBuilder.selectedForExam} setSelectedForExam={examBuilder.setSelectedForExam}
      versions={examBuilder.versions} setVersions={examBuilder.setVersions}
      classSectionVersions={examBuilder.classSectionVersions}
      builtStale={examBuilder.builtStale} setBuiltStale={examBuilder.setBuiltStale}
      masterLocked={examBuilder.masterLocked} setMasterLocked={examBuilder.setMasterLocked}
      masterName={examBuilder.masterName} setMasterName={examBuilder.setMasterName}
      savingMaster={examBuilder.savingMaster}
      saveMaster={examBuilder.saveMaster}
      dupWarnings={generate.dupWarnings}
      appendToMaster={examBuilder.appendToMaster}
      setAppendToMaster={examBuilder.setAppendToMaster}
      pendingAddFromBank={examBuilder.pendingAddFromBank}
      setPendingAddFromBank={examBuilder.setPendingAddFromBank}
      triggerReplace={generate.triggerReplace}
      pendingType={generate.pendingType} setPendingType={generate.setPendingType}
      pendingMeta={generate.pendingMeta}
      generatedPrompt={generate.generatedPrompt} setGeneratedPrompt={generate.setGeneratedPrompt}
      pasteInput={generate.pasteInput} setPasteInput={generate.setPasteInput}
      pasteError={generate.pasteError}
      handlePaste={generate.handlePaste}
      isAdmin={ctx.auth.isAdmin}
      autoGenLoading={examBuilder.autoGenLoading}
      autoGenError={examBuilder.autoGenError}
      autoGenerateVersions={examBuilder.autoGenerateVersions}
      autoValidateAllVersions={validation.autoValidateAllVersions}
      validating={validation.validating}
      copyValidationPrompt={validation.copyValidationPrompt}
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
