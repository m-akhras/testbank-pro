"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import { useExportContext } from "../../../context/ExportContext.js";
import ExportScreen from "../../../components/screens/ExportScreen.jsx";
import { makeStyles, text1, text2, text3, border, bg1, bg2, green1 } from "../../../lib/theme.js";
import { validateQuestion } from "../../../lib/utils/questions.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function ExportPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const exp = useExportContext();
  const S = makeStyles(green1);
  const accent = green1;
  const { bank, examBuilder, generate, exportHook } = ctx;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  return (
    <ExportScreen
      versions={examBuilder.versions} setVersions={examBuilder.setVersions}
      activeVersion={examBuilder.activeVersion} setActiveVersion={examBuilder.setActiveVersion}
      classSectionVersions={examBuilder.classSectionVersions} setClassSectionVersions={examBuilder.setClassSectionVersions}
      activeClassSection={examBuilder.activeClassSection} setActiveClassSection={examBuilder.setActiveClassSection}
      versionsViewMode={examBuilder.versionsViewMode} setVersionsViewMode={examBuilder.setVersionsViewMode}
      compareSection={examBuilder.compareSection} setCompareSection={examBuilder.setCompareSection}
      saveExamName={examBuilder.saveExamName} setSaveExamName={examBuilder.setSaveExamName}
      examSaved={examBuilder.examSaved} setExamSaved={examBuilder.setExamSaved}
      savingExam={examBuilder.savingExam} setSavingExam={examBuilder.setSavingExam}
      saveExam={examBuilder.saveExam}
      qtiExamName={examBuilder.qtiExamName} setQtiExamName={examBuilder.setQtiExamName}
      qtiUseGroups={examBuilder.qtiUseGroups} setQtiUseGroups={examBuilder.setQtiUseGroups}
      qtiPointsPerQ={examBuilder.qtiPointsPerQ} setQtiPointsPerQ={examBuilder.setQtiPointsPerQ}
      exportLoading={exportHook.exportLoading} setExportLoading={exportHook.setExportLoading}
      exportHighlight={examBuilder.exportHighlight}
      logExport={exportHook.logExport}
      buildDocx={exp.buildDocx}
      buildDocxCompare={exp.buildDocxCompare}
      buildAnswerKey={exp.buildAnswerKey}
      buildQTI={exp.buildQTI}
      buildQTIZip={exp.buildQTIZip}
      buildQTICompare={exp.buildQTICompare}
      buildClassroomSectionsQTI={exp.buildClassroomSectionsQTI}
      buildQTIAllSectionsMerged={exp.buildQTIAllSectionsMerged}
      validateQTIExport={exp.validateQTIExport}
      dlBlob={exp.dlBlob}
      showPrintPreview={exportHook.showPrintPreview} setShowPrintPreview={exportHook.setShowPrintPreview}
      printGraphCache={exportHook.printGraphCache}
      triggerReplace={generate.triggerReplace}
      triggerReplaceAuto={generate.triggerReplace}
      pendingType={generate.pendingType} setPendingType={generate.setPendingType}
      pendingMeta={generate.pendingMeta}
      generatedPrompt={generate.generatedPrompt} setGeneratedPrompt={generate.setGeneratedPrompt}
      pasteInput={generate.pasteInput} setPasteInput={generate.setPasteInput}
      pasteError={generate.pasteError}
      handlePaste={generate.handlePaste}
      autoGenLoading={examBuilder.autoGenLoading}
      autoGenError={examBuilder.autoGenError}
      autoGenerateVersions={examBuilder.autoGenerateVersions}
      inlineEditQId={null} setInlineEditQId={() => {}}
      showToast={ctx.showToast}
      validateQuestion={validateQuestion}
      setScreen={setScreen}
      isAdmin={ctx.auth.isAdmin}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border} accent={accent} bg1={bg1} bg2={bg2}
    />
  );
}
