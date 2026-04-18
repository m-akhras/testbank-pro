"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../../context/AppContext.js";
import BankScreen from "../../../components/screens/BankScreen.jsx";
import { makeStyles, QTYPES, DIFFICULTIES, MONTHS, text1, text2, text3, border, bg0, bg1, bg2, green1 } from "../../../lib/theme.js";
import { validateQuestion, sectionSortKey } from "../../../lib/utils/questions.js";

const SCREEN_ROUTES = {
  dashboard: "/app/dashboard", home: "/app/dashboard",
  generate: "/app/generate", review: "/app/review", bank: "/app/bank",
  versions: "/app/build", build: "/app/build", export: "/app/export",
  exams: "/app/exams", saved: "/app/exams", courses: "/app/courses", admin: "/app/admin",
};

export default function BankPage() {
  const router = useRouter();
  const ctx = useAppContext();
  const S = makeStyles(green1);

  const [graphEditorQId, setGraphEditorQId] = useState(null);
  const [inlineEditQId, setInlineEditQId]   = useState(null);

  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };

  const { bank, generate, examBuilder } = ctx;
  const bankIssueCount = bank.bank.filter(q => validateQuestion(q).length > 0).length;
  const bankDupCount = bank.duplicateIds.size;

  // Derived filter options — section list scoped to selected course
  const sectionPool = bank.filterCourse === "All"
    ? bank.bank
    : bank.bank.filter(q => q.course === bank.filterCourse);
  const availableSections = [...new Set(sectionPool.map(q => q.section).filter(Boolean))]
    .sort((a, b) => {
      const [aMaj, aMin] = sectionSortKey(a);
      const [bMaj, bMin] = sectionSortKey(b);
      return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
    });
  const availableYears = [...new Set(bank.bank.map(q => String(new Date(q.createdAt).getFullYear())))].sort((a, b) => b - a);
  const availableMonths = bank.filterYear === "All" ? [] : [...new Set(
    bank.bank.filter(q => String(new Date(q.createdAt).getFullYear()) === bank.filterYear)
      .map(q => String(new Date(q.createdAt).getMonth()))
  )].sort((a, b) => b - a);
  const availableDays = (bank.filterYear === "All" || bank.filterMonth === "All") ? [] : [...new Set(
    bank.bank.filter(q => {
      const d = new Date(q.createdAt);
      return String(d.getFullYear()) === bank.filterYear && String(d.getMonth()) === bank.filterMonth;
    }).map(q => String(new Date(q.createdAt).getDate()))
  )].sort((a, b) => b - a);
  const availableTimes = (bank.filterYear === "All" || bank.filterMonth === "All" || bank.filterDay === "All") ? [] : [...new Set(
    bank.bank.filter(q => {
      const d = new Date(q.createdAt);
      return String(d.getFullYear()) === bank.filterYear && String(d.getMonth()) === bank.filterMonth && String(d.getDate()) === bank.filterDay;
    }).map(q => new Date(q.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }))
  )].sort((a, b) => new Date(`1970/01/01 ${b}`) - new Date(`1970/01/01 ${a}`));

  // Used-in-exams map
  const usedInExams = {};
  (examBuilder.savedExams || []).forEach(exam => {
    const seen = new Set();
    (exam.versions || []).forEach(v => (v.questions || []).forEach(q => {
      const key = q.originalId || q.id;
      if (key && !seen.has(key)) { seen.add(key); usedInExams[key] = (usedInExams[key] || 0) + 1; }
    }));
  });

  return (
    <BankScreen
      bank={bank.bank}
      bankLoaded={bank.bankLoaded}
      bankIssueCount={bankIssueCount}
      bankCompact={bank.bankCompact} setBankCompact={bank.setBankCompact}
      bankSearch={bank.bankSearch} setBankSearch={bank.setBankSearch}
      filterCourse={bank.filterCourse} setFilterCourse={bank.setFilterCourse}
      filterSection={bank.filterSection} setFilterSection={bank.setFilterSection}
      filterType={bank.filterType} setFilterType={bank.setFilterType}
      filterDiff={bank.filterDiff} setFilterDiff={bank.setFilterDiff}
      filterYear={bank.filterYear} setFilterYear={bank.setFilterYear}
      filterMonth={bank.filterMonth} setFilterMonth={bank.setFilterMonth}
      filterDay={bank.filterDay} setFilterDay={bank.setFilterDay}
      filterTime={bank.filterTime} setFilterTime={bank.setFilterTime}
      filterIssuesOnly={bank.filterIssuesOnly} setFilterIssuesOnly={bank.setFilterIssuesOnly}
      bankSelectMode={bank.bankSelectMode} setBankSelectMode={bank.setBankSelectMode}
      bankSelected={bank.bankSelected} setBankSelected={bank.setBankSelected}
      filteredBank={bank.filteredBank}
      duplicateIds={bank.duplicateIds}
      bankDupCount={bankDupCount}
      availableSections={availableSections}
      availableYears={availableYears}
      availableMonths={availableMonths}
      availableDays={availableDays}
      availableTimes={availableTimes}
      MONTHS={MONTHS} QTYPES={QTYPES} DIFFICULTIES={DIFFICULTIES}
      allCourses={ctx.allCourses}
      courseColors={ctx.courseColors}
      accent={green1}
      isAdmin={ctx.auth.isAdmin}
      selectedForExam={examBuilder.selectedForExam}
      setSelectedForExam={examBuilder.setSelectedForExam}
      usedInExams={usedInExams}
      mutationType={examBuilder.mutationType} setMutationType={examBuilder.setMutationType}
      numClassSections={examBuilder.numClassSections} setNumClassSections={examBuilder.setNumClassSections}
      versionCount={examBuilder.versionCount} setVersionCount={examBuilder.setVersionCount}
      classSectionVersions={examBuilder.classSectionVersions}
      versions={examBuilder.versions}
      pendingType={generate.pendingType} setPendingType={generate.setPendingType}
      pendingMeta={generate.pendingMeta} setPendingMeta={generate.setPendingMeta}
      generatedPrompt={generate.generatedPrompt} setGeneratedPrompt={generate.setGeneratedPrompt}
      pasteInput={generate.pasteInput} setPasteInput={generate.setPasteInput}
      pasteError={generate.pasteError} setPasteError={generate.setPasteError}
      handlePaste={generate.handlePaste}
      autoGenLoading={examBuilder.autoGenLoading}
      autoGenError={examBuilder.autoGenError}
      autoGenerateVersions={examBuilder.autoGenerateVersions}
      bulkReplacePrompt={generate.bulkReplacePrompt} setBulkReplacePrompt={generate.setBulkReplacePrompt}
      bulkReplaceIds={generate.bulkReplaceIds} setBulkReplaceIds={generate.setBulkReplaceIds}
      bulkReplacePaste={generate.bulkReplacePaste} setBulkReplacePaste={generate.setBulkReplacePaste}
      bulkReplaceError={generate.bulkReplaceError} setBulkReplaceError={generate.setBulkReplaceError}
      graphEditorQId={graphEditorQId} setGraphEditorQId={setGraphEditorQId}
      inlineEditQId={inlineEditQId} setInlineEditQId={setInlineEditQId}
      bankTabState={bank.bankTabState} setBankTabState={bank.setBankTabState}
      expandedBatches={bank.expandedBatches} setExpandedBatches={bank.setExpandedBatches}
      confirmDelete={bank.confirmDelete} setConfirmDelete={bank.setConfirmDelete}
      setScreen={setScreen}
      saveQuestion={bank.saveQuestion}
      deleteQuestion={bank.deleteQuestion}
      showToast={ctx.showToast}
      S={S}
      text1={text1} text2={text2} text3={text3} border={border} bg0={bg0} bg1={bg1} bg2={bg2}
      validateQuestion={validateQuestion}
    />
  );
}
