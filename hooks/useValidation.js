"use client";
import { useState } from "react";

export function useValidation({ versions, courseObject, onResult } = {}) {
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
    } catch (e) {
      setValidationError("Failed to copy to clipboard: " + (e.message || e));
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
          // Persist for the bank as soon as a verdict lands (per-question)
          if (onResult && q.id) {
            try { await onResult(q.id, status, issues); } catch (e) { console.warn("onResult failed", e); }
          }
          const issue = issues.join("; ");
          return { questionId: q.id, correct: status === "ok" || status === "warning", issue, status };
        } catch (e) {
          return { questionId: q.id, correct: false, issue: `Request failed: ${e.message || e}`, status: null };
        }
      }));
      setValidationResults(results);
    } catch (e) {
      setValidationError(e.message || "Validation failed");
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
