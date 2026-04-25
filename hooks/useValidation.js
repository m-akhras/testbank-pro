"use client";
import { useState } from "react";

export function useValidation({ versions, courseObject } = {}) {
  const [validating, setValidating] = useState(false);
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
            return { questionId: q.id, correct: false, issue: `API error: ${err.error || res.status}` };
          }
          const data = await res.json();
          const v = data.validated?.[0]?.validation || { valid: true };
          const issue = v.reason
            ? v.reason + (v.corrected_answer ? ` (correct: ${v.corrected_answer})` : "")
            : "";
          return { questionId: q.id, correct: !!v.valid, issue };
        } catch (e) {
          return { questionId: q.id, correct: false, issue: `Request failed: ${e.message || e}` };
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
