"use client";
import { useState } from "react";

export function useValidation({ versions, courseObject } = {}) {
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState({});
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
    try {
      const prompt = buildValidationPrompt();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("Could not find JSON array in response");
      const arr = JSON.parse(match[0]);
      const results = {};
      arr.forEach(r => { if (r && r.id) results[r.id] = r; });
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
