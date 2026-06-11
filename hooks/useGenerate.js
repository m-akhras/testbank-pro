"use client";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createBrowserClient } from "@supabase/ssr";
import { uid, questionSimilarity, stripChoiceLabel, isGraphChoice } from "../lib/utils/questions.js";
import { parseAiJson, looksTruncated } from "../lib/utils/sanitizeJsonPaste.js";
import {
  expectedVersionKeys,
  findIncompleteKeys,
  formatVersionCompletenessError,
  buildSectionVersions,
  buildOneSectionVariants,
  mergeSection,
} from "../lib/exams/versionMerge.js";
import { answerMatchesAChoice } from "../lib/exports/index.js";
import { applyLimitDerivation } from "../lib/limits/applyLimitLaws.js";
import { isLimitTemplateSection } from "../lib/templates/registry.js";
import {
  buildGeneratePrompt,
  buildVersionPrompt,
  buildReplacePrompt,
} from "../lib/prompts/index.js";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Flag MC questions whose answer matches no choice, using the same lenient
// matcher the QTI export uses. Advisory only — these still import to Canvas,
// just unkeyed (no correct answer marked). Caller surfaces via setDupWarnings.
function collectAnswerWarnings(versionList) {
  const out = [];
  (versionList || []).forEach(ver => {
    (ver.questions || []).forEach((q, i) => {
      if (!answerMatchesAChoice(q)) {
        out.push(`${ver.label} Q${i+1}: answer "${q.answer}" not in choices — will import unkeyed; fix before exporting`);
      }
    });
  });
  return out;
}

/**
 * Cross-hook dependencies accepted as parameters:
 *   bank, setBank                       — from useBank
 *   versions                            — from useExamBuilder
 *   masterLocked                        — from useExamBuilder
 *   setVersions                         — from useExamBuilder
 *   setClassSectionVersions             — from useExamBuilder
 *   setActiveVersion                    — from useExamBuilder
 *   setActiveClassSection               — from useExamBuilder
 *   setExamSaved                        — from useExamBuilder
 *   setSaveExamName                     — from useExamBuilder
 *   showToast                           — from component
 *   setScreen                           — from component
 */
export function useGenerate({
  bank = [],
  setBank = () => {},
  versions = [],
  masterLocked = false,
  classSectionVersions = {},
  setVersions = () => {},
  setClassSectionVersions = () => {},
  setActiveVersion = () => {},
  setActiveClassSection = () => {},
  setExamSaved = () => {},
  setSaveExamName = () => {},
  setMasterLocked = () => {},
  setBuiltStale = () => {},
  setSelectedForExam = () => {},
  appendToMaster = false,
  setAppendToMaster = () => {},
  showToast = () => {},
  setScreen = () => {},
  courseObject = null,
} = {}) {
  const [pendingType, setPendingType] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null);
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [lastGenerated, setLastGenerated] = useState([]);
  const [dupWarnings, setDupWarnings] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateConfirm, setGenerateConfirm] = useState(false);
  const [selectedSections, setSelectedSections] = useState([]);
  const [sectionCounts, setSectionCounts] = useState({});
  const [sectionConfig, setSectionConfig] = useState({});
  const [qType, setQType] = useState("Multiple Choice");
  const [diff, setDiff] = useState("Mixed");
  const [course, setCourse] = useState(null);
  const [bulkReplacePrompt, setBulkReplacePrompt] = useState("");
  const [bulkReplacePaste, setBulkReplacePaste] = useState("");
  const [bulkReplaceError, setBulkReplaceError] = useState("");
  const [bulkReplaceIds, setBulkReplaceIds] = useState(new Set());

  async function autoGenerate(prompt, onSuccess) {
    setIsGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const result = data.result || data.content?.[0]?.text || data.text || "";
      if (!result) throw new Error("Empty response from API. Try again.");
      if (data.warning) showToast(data.warning, "error");
      onSuccess(result);
    } catch (e) {
      setGenerateError(e.message);
      showToast(e.message, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  async function triggerGenerate() {
    const prompt = await buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig, courseObject, getSupabase());
    setGeneratedPrompt(prompt);
    setPendingType("generate");
    setPendingMeta({ course });
    setPasteInput("");
    setPasteError("");
  }

  function triggerReplace(vIdx, qIdx, mutationType = "numbers", reason = "") {
    const prompt = buildReplacePrompt(versions[vIdx].questions[qIdx], mutationType, reason);
    setGeneratedPrompt(prompt);
    setPendingType("replace");
    setPendingMeta({ vIdx, qIdx });
    setPasteInput("");
    setPasteError("");
  }

  const sanitize = (q) => {
    let graphConfig = q.graphConfig;
    if (graphConfig) {
      const { title, ...rest } = graphConfig;
      graphConfig = rest;
    }
    return {
      ...q,
      type: q.type || "Multiple Choice",
      difficulty: q.difficulty || "Medium",
      question: q.question || "",
      answer: q.answer || "",
      choices: (q.choices || []).map(c => isGraphChoice(c) ? c : stripChoiceLabel(c ?? "")),
      explanation: q.explanation || "",
      ...(graphConfig ? { graphConfig } : {}),
    };
  };

  // Merge a master question's graphConfig with a variant's API-returned graphConfig.
  // Master config is the base (guarantees structural fields survive). API config
  // overlays only non-null/non-undefined values, so Claude's partial or missing
  // updates can never blank out the master's good values.
  const mergeVariantGraphConfig = (masterCfg, apiCfg) => {
    if (!masterCfg && !apiCfg) return null;
    if (!masterCfg) return apiCfg;
    if (!apiCfg || typeof apiCfg !== "object") return masterCfg;
    const overlay = {};
    for (const [k, v] of Object.entries(apiCfg)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      overlay[k] = v;
    }
    return { ...masterCfg, ...overlay };
  };

  async function handlePaste() {
    setPasteError("");
    console.log("handlePaste pendingMeta.selected", pendingMeta?.selected?.map(q => ({ id: q.id, hasGraph: q.hasGraph })));
    try {
      const raw = pasteInput.trim();

      if (pendingType === "version_one_section") {
        // Per-section paste STEPPER: merge ONE section's versions into the
        // existing classSectionVersions WITHOUT wiping the others. No navigation
        // — the user stays on VariantsScreen and advances to the next section.
        const parsed = parseAiJson(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Expected a JSON object keyed by version label.");
        }
        const { selected, labels, sectionNum } = pendingMeta;
        const expected = labels.map((l) => `S${sectionNum}_${l}`);
        const { missing, short } = findIncompleteKeys(parsed, expected, selected.length);
        if (missing.length || short.length) {
          throw new Error(
            formatVersionCompletenessError(expected, { missing, short }, looksTruncated(raw))
          );
        }
        const sectionVariants = buildOneSectionVariants({
          parsed, sectionNum, multi: true, labels, selected, course,
          sanitizeFn: sanitize, mergeGraphFn: mergeVariantGraphConfig, makeId: uid,
        });
        const withMaster = (masterLocked && versions[0])
          ? [{ ...versions[0], classSection: sectionNum }, ...sectionVariants]
          : sectionVariants;
        const merged = mergeSection(classSectionVersions, sectionNum, withMaster);
        const answerWarnings = collectAnswerWarnings(Object.values(merged.classSectionVersions).flat());
        flushSync(() => {
          setClassSectionVersions(merged.classSectionVersions);
          setVersions(merged.versions);
          setActiveVersion(0);
          setActiveClassSection(1);
          setPasteInput("");
          setExamSaved(false); setSaveExamName("");
          setBuiltStale(false);
          setDupWarnings(answerWarnings);
        });
        showToast(`Section ${sectionNum} merged ✓`);
        return;
      }

      if (pendingType === "version_all" || pendingType === "version_all_sections") {
        const parsed = parseAiJson(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Expected a JSON object keyed by version label.");
        }
        const { selected, labels } = pendingMeta;
        const sections = pendingType === "version_all_sections"
          ? (pendingMeta.numClassSections || 1)
          : 1;

        // LOUD completeness guard — every expected version set must be present
        // with the full question count, else fail by NAME (no silent empties).
        const expected = expectedVersionKeys(sections, labels);
        const { missing, short } = findIncompleteKeys(parsed, expected, selected.length);
        if (missing.length || short.length) {
          throw new Error(
            formatVersionCompletenessError(expected, { missing, short }, looksTruncated(raw))
          );
        }

        // Single source for the dual-write (classSectionVersions + versions).
        const { classSectionVersions, versions: vers } = buildSectionVersions({
          parsed,
          numClassSections: sections,
          labels,
          selected,
          course,
          masterLocked,
          masterVersion: versions[0],
          sanitizeFn: sanitize,
          mergeGraphFn: mergeVariantGraphConfig,
          makeId: uid,
        });
        const answerWarnings = collectAnswerWarnings(Object.values(classSectionVersions).flat());
        // flushSync commits all state updates synchronously before router.push fires,
        // preventing the export page from rendering with stale (empty) versions.
        flushSync(() => {
          setClassSectionVersions(classSectionVersions);
          setVersions(vers);
          setActiveVersion(0);
          setActiveClassSection(1);
          setPasteInput("");
          setExamSaved(false); setSaveExamName("");
          setBuiltStale(false); // fresh build — the version set is clean
          setDupWarnings(answerWarnings);
        });
        setScreen("export");
        return;
      }

      const parsed = parseAiJson(raw);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

      const sanitized = parsed.map(sanitize);

      if (pendingType === "generate") {
        // §2.2/§2.5/§2.3: a question carrying a limitSpec (single) or a
        // limitSpecF/limitSpecG + lawAsks (pair) gets its graph compiled and its
        // answer/explanation DERIVED here. applyLimitDerivation dispatches by
        // shape (ambiguous both-shapes → throw). A throw — e.g. a hard-failed MC
        // whose derived answer isn't among its choices — surfaces via pasteError
        // below. No-op for every question without any limit spec.
        const tagged = sanitized.map(q => {
          // In a limit-template section, a graph question MUST carry a spec
          // (the "mixed" hard rule). Gate the guard so non-limit sections that
          // legitimately ship a hand-authored graphConfig are never affected.
          const requireSpecForGraph = isLimitTemplateSection(pendingMeta.course, q.section);
          return { ...applyLimitDerivation(q, { requireSpecForGraph }), id: uid(), course: pendingMeta.course, createdAt: Date.now() };
        });
        const warnings = [];
        tagged.forEach((newQ, i) => {
          if (newQ.hasGraph) return;
          const sectionBank = bank.filter(bq => bq.section === newQ.section && bq.course === newQ.course);
          const sim = sectionBank.find(bq => questionSimilarity(newQ, bq) > 0.75);
          if (sim) warnings.push(`Q${i + 1} (${newQ.section}) may be similar to an existing question.`);
        });
        setDupWarnings(warnings);
        setLastGenerated(tagged);
        const supabase = getSupabase();
        for (const q of tagged) {
          try {
            await supabase.from("questions").upsert({
              id: q.id, course: q.course, section: q.section, type: q.type, difficulty: q.difficulty, data: q,
            });
          } catch (e) { console.error("persist generated question error:", e); }
        }
        setBank(prev => [...tagged, ...prev]);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);

        const ids = tagged.map(q => q.id);
        if (appendToMaster && versions.length > 0 && versions[0]?.questions) {
          // Round-trip: append to the existing master
          flushSync(() => {
            setVersions([{ ...versions[0], questions: [...versions[0].questions, ...tagged] }]);
            setSelectedForExam(prev => [...new Set([...prev, ...ids])]);
            setAppendToMaster(false);
          });
        } else {
          // Fresh generate: jump straight to master review
          flushSync(() => {
            setVersions([{ label: "A", questions: tagged }]);
            setSelectedForExam(ids);
            setMasterLocked(true);
            setActiveVersion(0);
          });
        }
        setScreen("build");
      } else if (pendingType === "version") {
        const { selected, label, allVersions, remaining, mutationType: mt } = pendingMeta;
        const versioned = sanitized.map((q, i) => ({
          ...q, id: uid(), originalId: selected[i]?.id,
          course: selected[i]?.course || course,
          versionLabel: label, createdAt: Date.now(),
          ...(selected[i]?.hasGraph ? {
            hasGraph: true,
            graphConfig: mergeVariantGraphConfig(selected[i].graphConfig, q.graphConfig),
          } : {}),
        }));
        const updated = [...allVersions, { label, questions: versioned }];
        setDupWarnings(collectAnswerWarnings([{ label, questions: versioned }]));
        if (remaining.length > 0) {
          const nextLabel = remaining[0];
          const nextRemaining = remaining.slice(1);
          const prompt = buildVersionPrompt(selected, mt, nextLabel);
          setGeneratedPrompt(prompt);
          setPendingMeta({ selected, label: nextLabel, allVersions: updated, remaining: nextRemaining, mutationType: mt });
          setPasteInput("");
        } else {
          setVersions(updated); setActiveVersion(0);
          setPendingType(null); setPasteInput(""); setPendingMeta(null);
          setExamSaved(false); setSaveExamName("");
          setScreen("versions");
        }
      } else if (pendingType === "replace") {
        const { vIdx, qIdx } = pendingMeta;
        const newQ = { ...parsed[0], id: uid(), course: versions[vIdx].questions[qIdx]?.course || course, versionLabel: versions[vIdx].label, classSection: versions[vIdx].questions[qIdx]?.classSection };
        const updatedVersions = versions.map((v, vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q, qi) => qi !== qIdx ? q : newQ) });
        setVersions(updatedVersions);
        const cs = versions[vIdx]?.classSection || versions[vIdx]?.questions[0]?.classSection;
        if (cs) {
          setClassSectionVersions(prev => ({
            ...prev,
            [cs]: (prev[cs] || []).map((v, vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q, qi) => qi !== qIdx ? q : newQ) }),
          }));
        } else {
          setClassSectionVersions(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(sec => {
              updated[sec] = updated[sec].map((v, vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q, qi) => qi !== qIdx ? q : newQ) });
            });
            return updated;
          });
        }
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
      }
    } catch (e) {
      // parseAiJson() already classifies truncation vs. real syntax errors
      // and throws messages with that detail. SyntaxError only reaches here
      // for non-JSON-paste callers (none currently); keep the cutoff hint
      // as a last-resort fallback so we don't lose useful guidance.
      let msg;
      if (e instanceof SyntaxError) {
        msg = "Response was too large or cut off. Try fewer versions at a time (recommended: max 4 versions × 2 sections).";
      } else {
        msg = e.message || String(e);
      }
      setPasteError(msg);
    }
  }

  return {
    pendingType, setPendingType,
    pendingMeta, setPendingMeta,
    pasteInput, setPasteInput,
    pasteError, setPasteError,
    generatedPrompt, setGeneratedPrompt,
    lastGenerated, setLastGenerated,
    dupWarnings, setDupWarnings,
    isGenerating,
    generateError, setGenerateError,
    generateConfirm, setGenerateConfirm,
    selectedSections, setSelectedSections,
    sectionCounts, setSectionCounts,
    sectionConfig, setSectionConfig,
    qType, setQType,
    diff, setDiff,
    course, setCourse,
    bulkReplacePrompt, setBulkReplacePrompt,
    bulkReplacePaste, setBulkReplacePaste,
    bulkReplaceError, setBulkReplaceError,
    bulkReplaceIds, setBulkReplaceIds,
    handlePaste,
    triggerGenerate,
    triggerReplace,
    autoGenerate,
  };
}
