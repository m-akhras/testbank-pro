"use client";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import GenerateScreen from "../../../components/screens/GenerateScreen.jsx";
import { makeStyles, QTYPES, text2, text3, border, green1 } from "../../../lib/theme.js";
import { buildGeneratePrompt } from "../../../lib/prompts/index.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function GeneratePage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const accent = green1;
  const { generate } = ctx;
  const course = ctx.course;
  const chapters = ctx.chapters;

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  const toggleSection = (sec) => {
    generate.setSelectedSections(prev =>
      prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]
    );
  };
  const toggleChapter = (chap) => {
    const all = chap.sections.every(s => generate.selectedSections.includes(s));
    generate.setSelectedSections(prev =>
      all ? prev.filter(s => !chap.sections.includes(s))
          : [...new Set([...prev, ...chap.sections])]
    );
  };
  const getSectionConfig = (sec) => {
    const existing = generate.sectionConfig[sec];
    if (existing) return existing;
    return {
      Easy:   { typeCounts: {}, count: 0, graphType: "normal", tableRows: 4, tableCols: 2 },
      Medium: { typeCounts: {}, count: 0, graphType: "normal", tableRows: 4, tableCols: 2 },
      Hard:   { typeCounts: {}, count: 0, graphType: "normal", tableRows: 4, tableCols: 2 },
    };
  };
  const setSectionDiff = (sec, diff, ...args) => {
    const prev = getSectionConfig(sec);
    const updated = { ...prev };
    if (args.length === 1 && typeof args[0] === "object") {
      updated[diff] = { ...prev[diff], ...args[0] };
    } else {
      const [key, val] = args;
      updated[diff] = { ...prev[diff], [key]: val };
    }
    generate.setSectionConfig({ ...generate.sectionConfig, [sec]: updated });
    const totalCount = ["Easy", "Medium", "Hard"].reduce((a, d) => a + (updated[d].count || 0), 0);
    generate.setSectionCounts({ ...generate.sectionCounts, [sec]: totalCount });
  };

  const totalQ = generate.selectedSections.reduce(
    (a, s) => a + (generate.sectionCounts[s] || 3), 0
  );

  const autoGenerateWrapped = async (prompt, onSuccess) => {
    await generate.autoGenerate(prompt, (result) => {
      onSuccess(result);
      setTimeout(() => {
        if (generate.pendingType === "generate") router.push("/app/bank");
      }, 300);
    });
  };

  return (
    <GenerateScreen
      course={course}
      allCourses={ctx.allCourses}
      chapters={chapters}
      bank={ctx.bank.bank}
      selectedSections={generate.selectedSections}
      sectionCounts={generate.sectionCounts}
      sectionConfig={generate.sectionConfig}
      qType={generate.qType}
      totalQ={totalQ}
      QTYPES={QTYPES}
      setCourse={generate.setCourse}
      setSelectedSections={generate.setSelectedSections}
      setSectionCounts={generate.setSectionCounts}
      setSectionConfig={generate.setSectionConfig}
      setQType={generate.setQType}
      toggleSection={toggleSection}
      toggleChapter={toggleChapter}
      getSectionConfig={getSectionConfig}
      setSectionDiff={setSectionDiff}
      generateConfirm={generate.generateConfirm}
      setGenerateConfirm={generate.setGenerateConfirm}
      isGenerating={generate.isGenerating}
      generateError={generate.generateError}
      triggerGenerate={generate.triggerGenerate}
      autoGenerate={autoGenerateWrapped}
      pendingType={generate.pendingType}
      generatedPrompt={generate.generatedPrompt}
      pasteInput={generate.pasteInput}
      setPasteInput={generate.setPasteInput}
      pasteError={generate.pasteError}
      handlePaste={generate.handlePaste}
      setScreen={setScreen}
      isAdmin={ctx.auth.isAdmin}
      S={S}
      text2={text2}
      text3={text3}
      border={border}
      accent={accent}
    />
  );
}
