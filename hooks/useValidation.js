"use client";
import { useState } from "react";

export function useValidation({
  versions,
  courseObject,
  onResult,
  setVersions,
  setClassSectionVersions,
  showToast,
} = {}) {
  const [validating, setValidating] = useState(false);
  // TODO: remove once persisted path is confirmed stable. The bank reads
  // q.validationStatus / q.validationIssues / q.validatedAt directly now;
  // this in-memory mirror only exists for legacy consumers that haven't
  // migrated yet.
  const [validationResults, setValidationResults] = useState([]);
  const [validationError, setValidationError] = useState("");

  const collectQuestions = () => {
    const list = [];
    (versions || []).forEach(v => (v?.questions || []).forEach(q => list.push(q)));
    return list;
  };

  const buildValidationPrompt = () => {
    const questions = collectQuestions();
    const courseLine = courseObject?.name ? `Course: ${courseObject.name}\n\n` : "";
    const header = `${courseLine}You are validating ${questions.length} multiple-choice exam question${questions.length === 1 ? "" : "s"}. For each question, determine whether the stated correct answer is mathematically accurate.

Respond with ONLY a JSON array (no preamble, no markdown fences, no commentary outside the JSON). One entry per question, keyed by the id shown in [id: ...]:

[
  {"id": "<question id>", "valid": true, "corrected_answer": null, "reason": null},
  {"id": "<question id>", "valid": false, "corrected_answer": "the correct answer text", "reason": "brief explanation of the error"}
]

Questions:
`;

    const body = questions.map((q, i) => {
      const choices = (q.choices || [])
        .map((c, j) => `   ${String.fromCharCode(65 + j)}) ${c}`)
        .join("\n");
      const stem = q.question || q.stem || "";
      return `${i + 1}. [id: ${q.id}] ${stem}
${choices}
   Stated answer: ${q.answer ?? ""}`;
    }).join("\n\n");

    return header + "\n" + body;
  };

  const copyValidationPrompt = async () => {
    const prompt = buildValidationPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      showToast?.("Validation prompt copied to clipboard ✓");
    } catch (e) {
      const msg = "Failed to copy to clipboard: " + (e.message || e);
      setValidationError(msg);
      showToast?.(msg, "error");
    }
  };

  // Map a single API verdict to the persisted (status, issues) tuple.
  //   valid=true,  no reason  → 'ok'      []
  //   valid=true,  with reason → 'warning' [reason]   (answer accepted but flagged)
  //   valid=false              → 'error'   [reason + corrected_answer]
  function _toPersisted(v) {
    const valid = !!v?.valid;
    const reason = v?.reason || "";
    const corrected = v?.corrected_answer ? ` (correct: ${v.corrected_answer})` : "";
    if (valid && !reason) return { status: "ok", issues: [] };
    if (valid && reason)  return { status: "warning", issues: [reason] };
    return { status: "error", issues: [(reason || "Stated answer is incorrect") + corrected] };
  }

  // Mirror persisted verdicts onto the in-memory versions/sections state so
  // the Build screen badges refresh without a reload. Matches by either the
  // question's own id (master version A === bank row) or originalId
  // (variants point back at the bank row).
  function _patchLocalVersions(dbId, patch) {
    const matches = (q) => q && (q.id === dbId || q.originalId === dbId);
    const patchQ  = (q) => (matches(q) ? { ...q, ...patch } : q);
    const patchVer = (ver) => ({ ...ver, questions: (ver?.questions || []).map(patchQ) });
    setVersions?.((prev) => (Array.isArray(prev) ? prev.map(patchVer) : prev));
    setClassSectionVersions?.((prev) => {
      if (!prev || typeof prev !== "object") return prev;
      const next = {};
      for (const [sec, vers] of Object.entries(prev)) {
        next[sec] = Array.isArray(vers) ? vers.map(patchVer) : vers;
      }
      return next;
    });
  }

  const autoValidateAllVersions = async () => {
    setValidating(true);
    setValidationError("");
    setValidationResults([]);
    try {
      const questions = collectQuestions();
      const results = await Promise.all(questions.map(async (q) => {
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questions: [{
                question: q.question || q.stem || "",
                choices: q.choices || [],
                answer: q.answer || "",
                explanation: q.explanation || "",
              }],
              mode: "validate",
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const issue = `API error: ${err.error || res.status}`;
            // Don't persist on transport failures — leave the previous status alone
            return { questionId: q.id, correct: false, issue, status: null };
          }
          const data = await res.json();
          const v = data.validated?.[0]?.validation || { valid: true };
          const { status, issues } = _toPersisted(v);
          // Persist as soon as a verdict lands. Variants carry a uid() id that
          // isn't in the questions table — their originalId points to the bank
          // row, so prefer that. Master version A keeps its bank id directly.
          const dbId = q.originalId || q.id;
          if (onResult && dbId) {
            try {
              await onResult(dbId, status, issues);
              _patchLocalVersions(dbId, {
                validationStatus: status || null,
                validationIssues: issues,
                validatedAt: Date.now(),
              });
            } catch (e) { console.warn("onResult failed", e); }
          }
          const issue = issues.join("; ");
          return { questionId: q.id, correct: status === "ok" || status === "warning", issue, status };
        } catch (e) {
          return { questionId: q.id, correct: false, issue: `Request failed: ${e.message || e}`, status: null };
        }
      }));
      setValidationResults(results);
      const total = results.length;
      const passed = results.filter((r) => r.correct).length;
      const flagged = total - passed;
      showToast?.(
        flagged === 0
          ? `✅ ${total} validated — all OK`
          : `⚠️ ${flagged} flagged of ${total}`,
        flagged === 0 ? "success" : "info"
      );
    } catch (e) {
      setValidationError(e.message || "Validation failed");
      showToast?.(e.message || "Validation failed", "error");
    } finally {
      setValidating(false);
    }
  };

  return {
    validating,
    validationResults,
    validationError,
    buildValidationPrompt,
    copyValidationPrompt,
    autoValidateAllVersions,
  };
}
