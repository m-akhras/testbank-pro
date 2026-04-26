"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { sectionSortKey } from "../lib/utils/questions.js";
import { buildAllVersionsPrompt, buildAllSectionsPrompt } from "../lib/prompts/index.js";

const VERSIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Cross-hook dependencies accepted as parameters:
 *   bank          — from useBank
 *   course        — from useGenerate
 *   showToast     — from component
 *   setScreen     — from component
 *   setGeneratedPrompt, setPendingType, setPendingMeta, setPasteInput, setPasteError — from useGenerate
 */
export function useExamBuilder({
  bank = [],
  course = null,
  showToast = () => {},
  setScreen = () => {},
  setGeneratedPrompt = () => {},
  setPendingType = () => {},
  setPendingMeta = () => {},
  setPasteInput = () => {},
  setPasteError = () => {},
  courseObject = null,
} = {}) {
  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [classSectionVersions, setClassSectionVersions] = useState({});
  const [activeClassSection, setActiveClassSection] = useState(1);
  const [selectedForExam, setSelectedForExam] = useState([]);
  const [mutationType, setMutationType] = useState({});
  const [versionCount, setVersionCount] = useState(2);
  const [numClassSections, setNumClassSections] = useState(1);
  const [currentClassSection, setCurrentClassSection] = useState(1);
  const [versionMutationType, setVersionMutationType] = useState({});
  const [masterLocked, setMasterLocked] = useState(false);
  const [appendToMaster, setAppendToMaster] = useState(false);
  const [masterName, setMasterName] = useState("");
  const [savedMasters, setSavedMasters] = useState([]);
  const [savingMaster, setSavingMaster] = useState(false);
  const [mastersLoading, setMastersLoading] = useState(false);
  const [versionsViewMode, setVersionsViewMode] = useState("single");
  const [compareSection, setCompareSection] = useState("All");
  const [selectedQIndices, setSelectedQIndices] = useState([]);
  const [examSaved, setExamSaved] = useState(false);
  const [saveExamName, setSaveExamName] = useState("");
  const [savingExam, setSavingExam] = useState(false);
  const [savedExams, setSavedExams] = useState([]);
  const [qtiExamName, setQtiExamName] = useState("");
  const [qtiUseGroups, setQtiUseGroups] = useState(false);
  const [qtiPointsPerQ, setQtiPointsPerQ] = useState(1);
  const [exportLoading, setExportLoading] = useState("");
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenError, setAutoGenError] = useState("");
  const [exportHighlight, setExportHighlight] = useState(false);

  async function loadSavedExams() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSavedExams(data || []);
      return data || [];
    } catch (e) { console.error("loadExams error:", e); return []; }
  }

  async function saveExam(name, versionsToSave) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from("exams").insert({
        name,
        versions: versionsToSave,
        created_at: new Date().toISOString(),
      }).select();
      if (error) throw error;
      return data[0];
    } catch (e) { console.error("saveExam error:", e); return null; }
  }

  async function loadSavedMasters() {
    setMastersLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("exams")
        .select("id, name, master_questions, settings, created_at")
        .eq("is_master", true)
        .order("created_at", { ascending: false });
      if (!error && data) setSavedMasters(data);
    } catch (e) { console.error("loadSavedMasters error:", e); }
    finally { setMastersLoading(false); }
  }

  async function saveMaster() {
    if (!masterName.trim()) { showToast("Enter a master name first", "error"); return; }
    setSavingMaster(true);
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("exams").insert({
        name: masterName.trim(),
        is_master: true,
        versions: [],
        master_questions: versions[0].questions,
        settings: { versionCount, numClassSections, versionMutationType, course },
        user_id: user.id,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      showToast("Master saved ✓");
      setMasterName("");
      loadSavedMasters();
    } catch (e) { showToast("Save failed: " + e.message, "error"); }
    finally { setSavingMaster(false); }
  }

  async function deleteSavedMaster(id) {
    const supabase = getSupabase();
    await supabase.from("exams").delete().eq("id", id);
    setSavedMasters(p => p.filter(m => m.id !== id));
    showToast("Master deleted");
  }

  function loadMaster(master) {
    const { master_questions = [], settings = {} } = master;
    const resolved = master_questions.map(sq => bank.find(q => q.id === sq.id) || sq);
    setVersions([{ label: "A", questions: resolved }]);
    setMasterLocked(false);
    if (settings.versionCount) setVersionCount(settings.versionCount);
    if (settings.numClassSections) setNumClassSections(settings.numClassSections);
    if (settings.versionMutationType) setVersionMutationType(settings.versionMutationType);
    setActiveVersion(0);
    setScreen("versions");
    showToast(`Loaded "${master.name}" ✓`);
  }

  function triggerVersions() {
    const selected = masterLocked
      ? versions[0].questions
      : bank
          .filter(q => selectedForExam.includes(q.id))
          .sort((a, b) => {
            const [aMaj, aMin] = sectionSortKey(a.section);
            const [bMaj, bMin] = sectionSortKey(b.section);
            return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
          });
    const labels = masterLocked ? VERSIONS.slice(1, 1 + versionCount) : VERSIONS.slice(0, versionCount);
    if (numClassSections > 1) {
      const prompt = buildAllSectionsPrompt(selected, labels, numClassSections, course, versionMutationType, courseObject);
      setGeneratedPrompt(prompt);
      setPendingType("version_all_sections");
      setPendingMeta({ selected, labels, numClassSections, versionMutationType });
    } else {
      const prompt = buildAllVersionsPrompt(selected, mutationType, labels, 1, 1, course, versionMutationType, courseObject);
      setGeneratedPrompt(prompt);
      setPendingType("version_all");
      setPendingMeta({ selected, labels, mutationType, classSection: 1, versionMutationType });
    }
    setPasteInput("");
    setPasteError("");
  }

  async function autoGenerateVersions(prompt, pendingTypeVal, pendingMetaVal) {
    setAutoGenLoading(true);
    setAutoGenError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text || data.text || "";
      if (!text) throw new Error("Empty response from API. Try again or use Copy Prompt.");
      if (data.warning) showToast(data.warning, "error");
      if (data.stop_reason === "max_tokens" && !text) throw new Error("Response truncated — generate fewer questions at once (max 10 recommended).");
      setPasteInput(text);
      setPendingType(pendingTypeVal);
      setPendingMeta(pendingMetaVal);
      setGeneratedPrompt(prompt);
      setTimeout(() => { document.getElementById("auto-submit-paste")?.click(); }, 100);
    } catch (e) {
      setAutoGenError(e.message || "Generation failed. Try Copy Prompt instead.");
    } finally {
      setAutoGenLoading(false);
    }
  }

  return {
    versions, setVersions,
    activeVersion, setActiveVersion,
    classSectionVersions, setClassSectionVersions,
    activeClassSection, setActiveClassSection,
    selectedForExam, setSelectedForExam,
    mutationType, setMutationType,
    versionCount, setVersionCount,
    numClassSections, setNumClassSections,
    currentClassSection, setCurrentClassSection,
    versionMutationType, setVersionMutationType,
    masterLocked, setMasterLocked,
    appendToMaster, setAppendToMaster,
    masterName, setMasterName,
    savedMasters, setSavedMasters,
    savingMaster,
    mastersLoading,
    versionsViewMode, setVersionsViewMode,
    compareSection, setCompareSection,
    selectedQIndices, setSelectedQIndices,
    examSaved, setExamSaved,
    saveExamName, setSaveExamName,
    savingExam, setSavingExam,
    savedExams, setSavedExams,
    qtiExamName, setQtiExamName,
    qtiUseGroups, setQtiUseGroups,
    qtiPointsPerQ, setQtiPointsPerQ,
    exportLoading, setExportLoading,
    autoGenLoading,
    autoGenError, setAutoGenError,
    exportHighlight, setExportHighlight,
    loadSavedExams,
    saveExam,
    loadSavedMasters,
    saveMaster,
    deleteSavedMaster,
    loadMaster,
    triggerVersions,
    autoGenerateVersions,
  };
}
