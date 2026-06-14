"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { sectionSortKey } from "../lib/utils/questions.js";
import { buildAllVersionsPrompt, buildAllSectionsPrompt, buildVersionChunkPrompt, buildSectionPastePrompt } from "../lib/prompts/index.js";
import { parseAiJson, looksTruncated } from "../lib/utils/sanitizeJsonPaste.js";
import { findIncompleteKeys, formatVersionCompletenessError, findMissingGraphs, formatMissingGraphError, findSingleFamilyErrors } from "../lib/exams/versionMerge.js";

// A is always the master; B–U are the 20 possible variant labels.
const VERSIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"];

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
  // Marks a built version set (variants B–U / classSectionVersions) STALE after
  // the master is edited post-build. While true, exports are gated until the
  // user rebuilds. Set by the BuildScreen master-edit handlers; cleared on a
  // fresh build, saved-exam load, master creation/discard. See
  // docs/exam_pipeline_design.md §2.
  const [builtStale, setBuiltStale] = useState(false);
  const [appendToMaster, setAppendToMaster] = useState(false);
  const [pendingAddFromBank, setPendingAddFromBank] = useState(false);
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
  const [qtiIncludeExplanations, setQtiIncludeExplanations] = useState(false);
  const [qtiPointsPerQ, setQtiPointsPerQ] = useState(1);
  const [exportLoading, setExportLoading] = useState("");
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenError, setAutoGenError] = useState("");
  // Per-section chunk progress for the multi-section generate ("section 2 of 5").
  const [genProgress, setGenProgress] = useState(null);
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

  // Shared resolution of which questions to mutate + the VARIANT labels (the labels
  // generated after the anchor A). For a locked master, A is the anchor and the
  // generated variants are B,C,…; the anchor model prepends/derives A per section.
  function _resolveSelectedAndLabels() {
    const selected = masterLocked
      ? versions[0].questions
      : bank
          .filter(q => selectedForExam.includes(q.id))
          .sort((a, b) => {
            const [aMaj, aMin] = sectionSortKey(a.section);
            const [bMaj, bMin] = sectionSortKey(b.section);
            return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
          });
    // variantLabels = the non-anchor labels (B, C, …). For a non-master build there
    // is no separate anchor, so labels start at A.
    const variantLabels = masterLocked ? VERSIONS.slice(1, 1 + versionCount) : VERSIONS.slice(0, versionCount);
    return { selected, variantLabels, anchorMode: masterLocked, anchorLabel: "A" };
  }

  // Per-section paste STEPPER: build ONE section's prompt (the anchor model asks the
  // model to generate that section's A first then mutate B,C from it within the same
  // response) and arm handlePaste's incremental-merge branch. The screen advances
  // section by section; each paste merges into classSectionVersions without wiping it.
  function triggerSectionPrompt(sectionNum) {
    const { selected, variantLabels, anchorMode, anchorLabel } = _resolveSelectedAndLabels();
    const prompt = buildSectionPastePrompt({ baseQuestions: selected, sectionNum, variantLabels, anchorLabel, course, courseObject });
    setGeneratedPrompt(prompt);
    setPendingType("version_one_section");
    setPendingMeta({ selected, variantLabels, sectionNum, numClassSections, anchorMode, anchorLabel, versionMutationType });
    setPasteInput("");
    setPasteError("");
  }

  function triggerVersions() {
    const { selected, variantLabels, anchorMode, anchorLabel } = _resolveSelectedAndLabels();
    if (numClassSections > 1) {
      const prompt = buildAllSectionsPrompt(selected, variantLabels, numClassSections, course, versionMutationType, courseObject);
      setGeneratedPrompt(prompt);
      setPendingType("version_all_sections");
      setPendingMeta({ selected, variantLabels, numClassSections, anchorMode, anchorLabel, versionMutationType });
    } else {
      const labels = variantLabels;
      const prompt = buildAllVersionsPrompt(selected, mutationType, labels, 1, 1, course, versionMutationType, courseObject);
      setGeneratedPrompt(prompt);
      setPendingType("version_all");
      setPendingMeta({ selected, labels, mutationType, classSection: 1, versionMutationType });
    }
    setPasteInput("");
    setPasteError("");
  }

  async function _callGenerate(prompt) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || data.text || "";
    return { text, stopReason: data.stop_reason, warning: data.warning };
  }

  async function autoGenerateVersions(prompt, pendingTypeVal, pendingMetaVal) {
    setAutoGenLoading(true);
    setAutoGenError("");
    try {
      // MULTI-SECTION (ANCHOR MODEL): one API call per SECTION×VERSION (always
      // masterCount items, fits the cap for any master up to ~35 questions).
      //   - S1_A = the master (prepended on merge, never generated).
      //   - S{s}_A for s ≥ 2 = a FUNCTION mutation of the master (the section's
      //     anchor) — generated FIRST in that section.
      //   - S{s}_B/C = NUMBERS mutations of THAT section's A (the master for s=1,
      //     the just-generated S{s}_A for s ≥ 2) — base-threaded.
      // Accumulate every generated key, then hand to the shared merge (handlePaste
      // auto-submit) for the LOUD completeness guard + single dual-write. A failed
      // chunk fails loudly NAMING the exact key (e.g. "S4_B failed").
      if (pendingTypeVal === "version_all_sections" && (pendingMetaVal?.numClassSections || 1) > 1
          && pendingMetaVal.anchorMode) {
        const { selected, variantLabels, numClassSections: ncs, anchorLabel = "A" } = pendingMetaVal;
        const master = selected;
        const combined = {};
        // total chunks: section 1 = variants only; each s ≥ 2 = anchor + variants.
        const total = variantLabels.length + (ncs - 1) * (1 + variantLabels.length);
        let idx = 0;
        const genChunk = async (baseQuestions, s, label, mutation) => {
          const key = `S${s}_${label}`;
          idx += 1;
          setGenProgress({ current: idx, total, sectionNum: s, label });
          const chunkPrompt = buildVersionChunkPrompt({ baseQuestions, sectionNum: s, label, mutation, course, courseObject });
          const { text, stopReason, warning } = await _callGenerate(chunkPrompt);
          if (warning) showToast(warning, "error");
          if (stopReason === "max_tokens") {
            throw new Error(`${key} failed — cut off by the model's token limit (reduce the master's question count). Retry.`);
          }
          if (!text) throw new Error(`${key} failed — empty response from the model. Retry.`);
          let chunk;
          try { chunk = parseAiJson(text); }
          catch (e) { throw new Error(`${key} failed — ${e.message}`); }
          const { missing, short } = findIncompleteKeys(chunk, [key], master.length);
          if (missing.length || short.length) {
            throw new Error(`${key} failed — ` + formatVersionCompletenessError([key], { missing, short }, looksTruncated(text)));
          }
          // Ground-truth graph presence against the MASTER (every variant ultimately
          // mutates it): a graph-bearing master question must come back with a graph.
          const lostGraphs = findMissingGraphs(chunk, [key], master);
          if (lostGraphs.length) throw new Error(`${key} failed — ` + formatMissingGraphError(lostGraphs));
          // Monoculture guard — only the function-mutated anchor (where the family is
          // chosen). Numbers mutations inherit the anchor's families, so skip them.
          if (mutation === "function") {
            const mono = findSingleFamilyErrors(chunk[key]);
            if (mono.length) throw new Error(`${key} failed — ` + mono.join(" "));
          }
          combined[key] = chunk[key];
          return chunk[key];
        };
        for (let s = 1; s <= ncs; s++) {
          let sectionBase = master; // section 1 mutates from the master
          if (s >= 2) {
            // Anchor first: function mutation of the master → this section's A.
            sectionBase = await genChunk(master, s, anchorLabel, "function");
          }
          for (const label of variantLabels) {
            await genChunk(sectionBase, s, label, "numbers");
          }
        }
        setGenProgress(null);
        setPasteInput(JSON.stringify(combined));
        setPendingType(pendingTypeVal);
        setPendingMeta(pendingMetaVal);
        setGeneratedPrompt(prompt);
        setTimeout(() => { document.getElementById("auto-submit-paste")?.click(); }, 100);
        return;
      }

      // SINGLE SECTION (version_all): one call (existing behavior).
      const { text, stopReason, warning } = await _callGenerate(prompt);
      if (warning) showToast(warning, "error");
      if (stopReason === "max_tokens") {
        throw new Error("Response truncated at the model's token limit — generate fewer questions/versions, or use Copy Prompt.");
      }
      if (!text) throw new Error("Empty response from API. Try again or use Copy Prompt.");
      setPasteInput(text);
      setPendingType(pendingTypeVal);
      setPendingMeta(pendingMetaVal);
      setGeneratedPrompt(prompt);
      setTimeout(() => { document.getElementById("auto-submit-paste")?.click(); }, 100);
    } catch (e) {
      setAutoGenError(e.message || "Generation failed. Try Copy Prompt instead.");
    } finally {
      setAutoGenLoading(false);
      setGenProgress(null);
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
    builtStale, setBuiltStale,
    appendToMaster, setAppendToMaster,
    pendingAddFromBank, setPendingAddFromBank,
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
    qtiIncludeExplanations, setQtiIncludeExplanations,
    qtiPointsPerQ, setQtiPointsPerQ,
    exportLoading, setExportLoading,
    autoGenLoading,
    autoGenError, setAutoGenError,
    genProgress,
    exportHighlight, setExportHighlight,
    loadSavedExams,
    saveExam,
    loadSavedMasters,
    saveMaster,
    deleteSavedMaster,
    loadMaster,
    triggerVersions,
    triggerSectionPrompt,
    autoGenerateVersions,
  };
}
