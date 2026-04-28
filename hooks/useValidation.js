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

  // Hidden-textarea fallback for browsers/contexts where navigator.clipboard
  // is unavailable or rejects (e.g. blurred document, missing permission).
  function _execCommandCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      console.warn("[copyValidationPrompt] execCommand fallback threw:", err);
      return false;
    }
  }

  // IMPORTANT: this must stay synchronous up to (and including) the
  // navigator.clipboard.writeText call. Browsers tie clipboard writes to the
  // user-gesture context of the click, and any `await` *before* writeText
  // breaks that chain — silently leaving the clipboard empty.
  const copyValidationPrompt = () => {
    const prompt = buildValidationPrompt();
    console.log("[copyValidationPrompt] prompt length:", prompt.length);

    const onSuccess = () => {
      console.log("[copyValidationPrompt] writeText succeeded");
      showToast?.("Validation prompt copied to clipboard ✓");
    };
    const onFailure = (err) => {
      console.warn("[copyValidationPrompt] writeText rejected:", err);
      // Try the legacy path before giving up — it works in some contexts where
      // the async clipboard API is blocked.
      if (_execCommandCopy(prompt)) {
        console.log("[copyValidationPrompt] execCommand fallback succeeded");
        showToast?.("Validation prompt copied to clipboard ✓");
        return;
      }
      const msg = "Failed to copy to clipboard: " + (err?.message || err || "unknown");
      setValidationError(msg);
      showToast?.(msg, "error");
    };

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        // Call writeText synchronously to preserve user-gesture context, then
        // attach .then/.catch — do NOT await inside the click handler.
        navigator.clipboard.writeText(prompt).then(onSuccess, onFailure);
        return;
      }
      console.log("[copyValidationPrompt] navigator.clipboard unavailable — using execCommand");
      if (_execCommandCopy(prompt)) {
        onSuccess();
      } else {
        onFailure(new Error("Clipboard API unavailable and execCommand failed"));
      }
    } catch (e) {
      console.error("[copyValidationPrompt] threw synchronously:", e);
      onFailure(e);
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
              operation: "validate",
              questions: [{
                question: q.question || q.stem || "",
                choices: q.choices || [],
                answer: q.answer || "",
                explanation: q.explanation || "",
              }],
            }),
          });
          if (!res.ok) {
            // Transport / rate-limit failure. NOT a question-quality problem —
            // do not persist, do not touch local state, just surface the error
            // so the summary toast can count it separately.
            const err = await res.json().catch(() => ({}));
            return {
              questionId: q.id,
              correct: false,
              errored: true,
              status: null,
              issue: `API error: ${err.error || res.status}`,
            };
          }
          const data = await res.json();
          const v = data.validated?.[0]?.validation || { valid: true };
          const { status, issues } = _toPersisted(v);
          // Persist as soon as a verdict lands. Variants carry a uid() id that
          // isn't in the questions table — their originalId points to the bank
          // row, so prefer that. Master version A keeps its bank id directly.
          const dbId = q.originalId || q.id;
          let persistError = null;
          if (onResult && dbId) {
            try {
              await onResult(dbId, status, issues);
              // Only mirror locally once we've confirmed the row was written —
              // otherwise the badge would flash green for a question whose DB
              // status is still NULL and would revert on reload.
              _patchLocalVersions(dbId, {
                validationStatus: status || null,
                validationIssues: issues,
                validatedAt: Date.now(),
              });
            } catch (e) {
              console.warn("[autoValidate] persist failed for", dbId, ":", e);
              persistError = e?.message || String(e);
            }
          }
          if (persistError) {
            return {
              questionId: q.id,
              correct: false,
              errored: true,
              status: null,
              issue: `Not persisted: ${persistError}`,
            };
          }
          const issue = issues.join("; ");
          return {
            questionId: q.id,
            correct: status === "ok" || status === "warning",
            errored: false,
            issue,
            status,
          };
        } catch (e) {
          // Network/parse failure — same treatment as a non-OK response.
          return {
            questionId: q.id,
            correct: false,
            errored: true,
            status: null,
            issue: `Request failed: ${e.message || e}`,
          };
        }
      }));
      setValidationResults(results);
      const total = results.length;
      const errored = results.filter((r) => r.errored).length;
      const flagged = results.filter((r) => !r.errored && !r.correct).length;
      const passed = total - errored - flagged;
      const parts = [];
      if (passed)  parts.push(`✅ ${passed} passed`);
      if (flagged) parts.push(`⚠️ ${flagged} flagged`);
      if (errored) parts.push(`🚫 ${errored} errors (rate limit / network / db)`);
      const tone = errored ? "error" : flagged ? "info" : "success";
      showToast?.(parts.join(" · ") || `Validated ${total}`, tone);
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
