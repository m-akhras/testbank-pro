"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import VariantsScreen from "../../../components/screens/VariantsScreen.jsx";
import { makeStyles, text1, text2, text3, border, bg1, bg2, green1 } from "../../../lib/theme.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", variants: "/app/variants", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function VariantsPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;
  const { examBuilder, generate } = ctx;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  return (
    <VariantsScreen
      versions={examBuilder.versions}
      masterLocked={examBuilder.masterLocked}
      versionCount={examBuilder.versionCount} setVersionCount={examBuilder.setVersionCount}
      numClassSections={examBuilder.numClassSections} setNumClassSections={examBuilder.setNumClassSections}
      versionMutationType={examBuilder.versionMutationType} setVersionMutationType={examBuilder.setVersionMutationType}
      autoGenLoading={examBuilder.autoGenLoading}
      autoGenError={examBuilder.autoGenError}
      triggerVersions={examBuilder.triggerVersions}
      autoGenerateVersions={examBuilder.autoGenerateVersions}
      pendingType={generate.pendingType} setPendingType={generate.setPendingType}
      pendingMeta={generate.pendingMeta}
      generatedPrompt={generate.generatedPrompt} setGeneratedPrompt={generate.setGeneratedPrompt}
      pasteInput={generate.pasteInput} setPasteInput={generate.setPasteInput}
      pasteError={generate.pasteError}
      handlePaste={generate.handlePaste}
      setScreen={setScreen}
      isAdmin={ctx.auth.isAdmin}
      course={ctx.course}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border} accent={accent}
      bg1={bg1} bg2={bg2}
    />
  );
}
