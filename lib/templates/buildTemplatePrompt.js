// lib/templates/buildTemplatePrompt.js
//
// Thin entry point for the template-based question generation prompt builder.
// The actual logic lives in lib/templates/_generic/ — this file exists only
// to preserve the existing import path used by callers (notably
// components/screens/TemplateGenerateForm.jsx).
//
// History: This file was previously 304 lines of monolithic prompt-building
// code containing §1.1-specific rules inline. As part of the Phase 2 refactor
// it was split into:
//   - _generic/buildPrompt.js       (the generic orchestrator)
//   - _generic/notationRules.js     (math notation conventions)
//   - _generic/distractorRules.js   (MC distractor quality bar)
//   - _generic/graphSchemas.js      (renderer-matching graph schemas)
//   - _generic/outputContract.js    (JSON output format spec)
// Section-specific rules previously hardcoded here now live in each
// template's `section_specific_rules` block (see calc1_1_1.js).
//
// The export name and signature are unchanged. Callers do not need updating.

import { buildPrompt } from "./_generic/buildPrompt.js";

export function buildTemplatePrompt(template, answers, options = {}) {
  return buildPrompt(template, answers, options);
}
