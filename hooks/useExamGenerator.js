"use client";
import { useState } from "react";

// Wizard steps in the Add-Question loop, plus the draft 'list' surface.
export const EG_STEPS = ["type", "chapter", "wording", "details", "list"];

// The three question types the wizard composes (spec §2.1, step 1).
export const EG_TYPES = [
  { value: "MCQ",        label: "Multiple Choice" },
  { value: "open-ended", label: "Open-ended" },
  { value: "branched",   label: "Branched" },
];

const EMPTY_DRAFT = { type: "", chapter: "", section: "", wording: "", details: "" };

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "eg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * useExamGenerator — owns ALL Exam Generator wizard state (Phase A: shell only).
 *
 * No AI / API / copy-paste here. The wording + details steps are plain text
 * fields in Phase A; suggestions arrive in Phase C/D. Build Exam (Phase B) is
 * not wired yet — the screen renders a disabled button.
 *
 * Course / chapter / section OPTION data is NOT owned here — the screen reads it
 * from the existing generate flow (ctx.course / ctx.chapters), so chapter lists
 * are never hardcoded. This hook only stores the chosen chapter/section strings.
 */
export function useExamGenerator() {
  // Which Add-Question step we're on ('type'|'chapter'|'wording'|'details'|'list').
  const [step, setStep] = useState("type");
  // The in-progress question being built (or an existing draft loaded for edit).
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  // The committed draft list — same shape as `draft`, each with a stable id.
  const [drafts, setDrafts] = useState([]);
  // When non-null, commitDraft updates this existing draft instead of pushing.
  const [editingId, setEditingId] = useState(null);

  // --- per-step value setters (Phase A: just store the typed value) ----------
  const setType = (type) => setDraft(d => ({ ...d, type }));
  const setChapterSection = (chapter, section = "") => setDraft(d => ({ ...d, chapter, section }));
  const setWording = (wording) => setDraft(d => ({ ...d, wording }));
  const setDetails = (details) => setDraft(d => ({ ...d, details }));

  // --- draft-list lifecycle --------------------------------------------------

  // Push the in-progress draft onto the list (or save edits back), then reset
  // and return to the draft list.
  function commitDraft() {
    setDrafts(prev => {
      if (editingId != null) {
        return prev.map(q => q.id === editingId ? { ...q, ...draft, id: editingId } : q);
      }
      return [...prev, { ...draft, id: newId() }];
    });
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setStep("list");
  }

  // Start composing a fresh question from step 1.
  function startNewQuestion() {
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setStep("type");
  }

  // Load an existing draft's full selections back into `draft` and reopen the
  // wizard with that draft active (editingId set, so commitDraft saves in place).
  // Lands on the Wording step by default — the earlier steps are already filled
  // and reachable via Back, so Edit never dumps the user back on a blank step 1.
  // Callers that edit to fix a missing section pass toStep="chapter" (the Topic
  // step owns the Section dropdown).
  function editDraft(id, toStep = "wording") {
    const found = drafts.find(q => q.id === id);
    if (!found) return;
    const { id: _omit, ...fields } = found;
    setDraft({ ...EMPTY_DRAFT, ...fields });
    setEditingId(id);
    setStep(toStep);
  }

  // Patch a draft in place (used for inline list edits).
  function updateDraft(id, patch) {
    setDrafts(prev => prev.map(q => q.id === id ? { ...q, ...patch, id } : q));
  }

  function deleteDraft(id) {
    setDrafts(prev => prev.filter(q => q.id !== id));
    if (editingId === id) { setEditingId(null); setDraft({ ...EMPTY_DRAFT }); }
  }

  // Move a draft from one position to another (clamped, no-op if out of range).
  function reorderDraft(fromIndex, toIndex) {
    setDrafts(prev => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 || fromIndex >= prev.length ||
        toIndex < 0 || toIndex >= prev.length
      ) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  return {
    // state
    step, setStep,
    draft, setDraft,
    drafts, setDrafts,
    editingId,
    // value setters
    setType,
    setChapterSection,
    setWording,
    setDetails,
    // lifecycle
    commitDraft,
    startNewQuestion,
    editDraft,
    updateDraft,
    deleteDraft,
    reorderDraft,
  };
}
