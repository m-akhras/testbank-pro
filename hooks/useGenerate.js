"use client";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createBrowserClient } from "@supabase/ssr";
import { uid, questionSimilarity } from "../lib/utils/questions.js";
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
  setVersions = () => {},
  setClassSectionVersions = () => {},
  setActiveVersion = () => {},
  setActiveClassSection = () => {},
  setExamSaved = () => {},
  setSaveExamName = () => {},
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

  function triggerGenerate() {
    const prompt = buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig, courseObject);
    setGeneratedPrompt(prompt);
    setPendingType("generate");
    setPendingMeta({ course });
    setPasteInput("");
    setPasteError("");
  }

  function triggerReplace(vIdx, qIdx, mutationType = "numbers") {
    const prompt = buildReplacePrompt(versions[vIdx].questions[qIdx], mutationType);
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
      choices: (q.choices || []).map(c => c ?? ""),
      explanation: q.explanation || "",
      ...(graphConfig ? { graphConfig } : {}),
    };
  };

  async function handlePaste() {
    setPasteError("");
    console.log("handlePaste pendingMeta.selected", pendingMeta?.selected?.map(q => ({ id: q.id, hasGraph: q.hasGraph })));
    try {
      const raw = pasteInput.trim();

      if (pendingType === "version_all") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found. Make sure you copied the full response.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, classSection } = pendingMeta;
        const allVersions = labels.map(label => {
          const qs = parsed[label] || [];
          const versioned = qs.map((q, i) => ({
            ...sanitize(q), id: uid(), originalId: selected[i]?.id,
            course: selected[i]?.course || course,
            versionLabel: label, classSection, createdAt: Date.now(),
            ...(selected[i]?.hasGraph ? {
              hasGraph: true,
              graphConfig: q.graphConfig ? { ...selected[i].graphConfig, ...q.graphConfig } : selected[i].graphConfig,
            } : {}),
          }));
          return { label, questions: versioned, classSection };
        });
        const finalVersions = masterLocked ? [{ ...versions[0], classSection }, ...allVersions] : allVersions;
        // flushSync commits all state updates synchronously before router.push fires,
        // preventing the export page from rendering with stale (empty) versions.
        flushSync(() => {
          setClassSectionVersions({ [classSection]: finalVersions });
          setVersions(finalVersions);
          setActiveVersion(0);
          setActiveClassSection(classSection);
          setPasteInput("");
          setExamSaved(false); setSaveExamName("");
        });
        setScreen("export");
        return;
      }

      if (pendingType === "version_all_sections") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, numClassSections: ncs } = pendingMeta;
        const newSectionVersions = {};
        for (let s = 1; s <= ncs; s++) {
          const sectionVariants = labels.map(label => {
            const key = `S${s}_${label}`;
            const qs = parsed[key] || [];
            const versioned = qs.map((q, i) => ({
              ...sanitize(q), id: uid(), originalId: selected[i]?.id,
              course: selected[i]?.course || course,
              versionLabel: label, classSection: s, createdAt: Date.now(),
              ...(selected[i]?.hasGraph ? {
                hasGraph: true,
                graphConfig: q.graphConfig ? { ...selected[i].graphConfig, ...q.graphConfig } : selected[i].graphConfig,
              } : {}),
            }));
            return { label, questions: versioned, classSection: s };
          });
          newSectionVersions[s] = masterLocked
            ? [{ ...versions[0], classSection: s }, ...sectionVariants]
            : sectionVariants;
        }
        // flushSync commits all state updates synchronously before router.push fires.
        flushSync(() => {
          setClassSectionVersions(newSectionVersions);
          setVersions(newSectionVersions[1]);
          setActiveVersion(0); setActiveClassSection(1);
          setPasteInput("");
          setExamSaved(false); setSaveExamName("");
        });
        setScreen("export");
        return;
      }

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array found. Make sure you copied the full response.");
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

      const sanitized = parsed.map(sanitize);

      if (pendingType === "generate") {
        const tagged = sanitized.map(q => ({ ...q, id: uid(), course: pendingMeta.course, createdAt: Date.now() }));
        const warnings = [];
        tagged.forEach((newQ, i) => {
          if (newQ.hasGraph) return;
          const sectionBank = bank.filter(bq => bq.section === newQ.section && bq.course === newQ.course);
          const sim = sectionBank.find(bq => questionSimilarity(newQ, bq) > 0.75);
          if (sim) warnings.push(`Q${i + 1} (${newQ.section}) may be similar to an existing question.`);
        });
        setDupWarnings(warnings);
        setLastGenerated(tagged);
        for (const q of tagged) {
          // saveQuestion is in useBank — caller must wire this if needed
        }
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
        setScreen("review");
      } else if (pendingType === "version") {
        const { selected, label, allVersions, remaining, mutationType: mt } = pendingMeta;
        const versioned = sanitized.map((q, i) => ({
          ...q, id: uid(), originalId: selected[i]?.id,
          course: selected[i]?.course || course,
          versionLabel: label, createdAt: Date.now(),
          ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: q.graphConfig || selected[i].graphConfig } : {}),
        }));
        const updated = [...allVersions, { label, questions: versioned }];
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
      const msg = e instanceof SyntaxError
        ? "Response was too large or cut off. Try fewer versions at a time (recommended: max 4 versions × 2 sections)."
        : "Error: " + e.message;
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
