// lib/templates/_generic/buildPrompt.js
//
// Generic question-generation prompt builder. Consumes:
//   1. A template (declares fields, course/section metadata, and
//      section_specific_rules)
//   2. The instructor's form answers
//
// Produces the final prompt string Sonnet/DeepSeek follows when generating
// questions. The four sub-blocks (notation, distractor, graph schemas, output
// contract) are imported from sibling modules; the rest of the prompt is
// assembled here from generic boilerplate + the template's section-specific
// rules.
//
// This replaces 90% of the original lib/templates/buildTemplatePrompt.js.
// That file becomes a thin entry point that calls this builder.

import { buildNotationBlock } from "./notationRules.js";
import { buildDistractorBlock } from "./distractorRules.js";
import { GRAPH_SCHEMAS } from "./graphSchemas.js";
import { buildOutputContract } from "./outputContract.js";

/* ────────────────────────────────────────────────────────────────────
 * Answer validation
 * ────────────────────────────────────────────────────────────────── */

/**
 * Validate that the form answers satisfy the template's field declarations
 * and any section-specific pairing constraints. Throws on first violation.
 */
function validateAnswers(template, answers) {
  // Field-level validation (required + minSelections)
  for (const field of template.fields) {
    if (field.id === "free_text") continue;
    if (answers[field.id] === undefined || answers[field.id] === null) {
      throw new Error(`Missing answer for required field: ${field.id}`);
    }
    if (field.type === "multi_select" && field.minSelections) {
      if (!Array.isArray(answers[field.id]) || answers[field.id].length < field.minSelections) {
        throw new Error(`Field ${field.id} requires at least ${field.minSelections} selection(s)`);
      }
    }
  }

  // Section-specific pairing constraints
  const pairing = template.section_specific_rules?.pairing_constraints || [];
  for (const rule of pairing) {
    const value = answers[rule.field];
    if (!Array.isArray(value)) continue;

    // Rule shape: { field, requires_other_when_includes, error }
    // "If this field includes X, it must also include at least one other value."
    if (rule.requires_other_when_includes) {
      const trigger = rule.requires_other_when_includes;
      if (value.includes(trigger) && value.length === 1) {
        throw new Error(rule.error);
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────────
 * Label resolution helpers
 * ────────────────────────────────────────────────────────────────── */

function getLabel(template, fieldId, value) {
  const field = template.fields.find(f => f.id === fieldId);
  if (!field || !field.options) return value;
  const opt = field.options.find(o => o.value === value);
  return opt ? opt.label : value;
}

function getLabels(template, fieldId, values) {
  if (!Array.isArray(values)) return "";
  return values.map(v => getLabel(template, fieldId, v)).join(", ");
}

/* ────────────────────────────────────────────────────────────────────
 * Conditional quality blocks (section-specific)
 * ────────────────────────────────────────────────────────────────── */

/**
 * Evaluate which conditional_quality_blocks fire for the given answers,
 * and return their concatenated content. A block fires when its condition
 * matches.
 *
 * Supported condition shapes:
 *   { field: "<multi_select_field>", includes: "value" }
 *     → fires when answers[field] is an array containing "value".
 *     Use this for multi_select fields (e.g. function_types, student_tasks).
 *
 *   { field: "<single_select_field>", equals: "value" }
 *     → fires when answers[field] === "value".
 *     Use this for single_select fields (e.g. primary_focus, domain_complexity).
 *
 * Both shapes accept the value to compare under different keys for safety:
 * mixing them (e.g. `includes` on a single_select string) is silently ignored.
 */
function buildConditionalBlocks(template, answers) {
  const blocks = template.section_specific_rules?.conditional_quality_blocks || [];
  const fired = [];
  for (const block of blocks) {
    const cond = block.condition;
    if (!cond) continue;

    // Predicate: array-contains (multi_select fields)
    if (cond.includes !== undefined) {
      const value = answers[cond.field];
      if (Array.isArray(value) && value.includes(cond.includes)) {
        fired.push(block.content);
      }
    }

    // Predicate: string-equals (single_select fields)
    if (cond.equals !== undefined) {
      const value = answers[cond.field];
      if (typeof value === "string" && value === cond.equals) {
        fired.push(block.content);
      }
    }
    // Future condition shapes can be added here without changing callers.
  }
  return fired.join("\n");
}

/* ────────────────────────────────────────────────────────────────────
 * Main builder
 * ────────────────────────────────────────────────────────────────── */

export function buildPrompt(template, answers, options = {}) {
  validateAnswers(template, answers);

  // Resolve labels for interpolation
  const count = answers.count;
  const primaryFocus = getLabel(template, "primary_focus", answers.primary_focus);
  const representationForms = getLabels(template, "representation_forms", answers.representation_forms);
  const functionTypes = getLabels(template, "function_types", answers.function_types);
  const domainComplexity = getLabel(template, "domain_complexity", answers.domain_complexity);
  const studentTasks = getLabels(template, "student_tasks", answers.student_tasks);
  const graphsOption = getLabel(template, "graphs_option", answers.graphs_option);
  const tablesOption = getLabel(template, "tables_option", answers.tables_option);
  const questionType = getLabel(template, "question_type", answers.question_type);
  const freeText = (answers.free_text || "").trim();

  // Build the "do not use" list from function_types that were NOT selected
  const functionTypesField = template.fields.find(f => f.id === "function_types");
  const allFunctionTypes = functionTypesField ? functionTypesField.options.map(o => o.value) : [];
  const excludedFunctionTypes = allFunctionTypes.filter(t => !answers.function_types.includes(t));
  const excludedLabels = excludedFunctionTypes.map(t => getLabel(template, "function_types", t));

  // Section label used in the OUTPUT FORMAT block
  const sectionLabel = `${template.section} ${template.sectionTitle}`;

  // Enum values for the OUTPUT FORMAT block (section-specific)
  const ssr = template.section_specific_rules || {};
  if (!ssr.subtopic_values || !ssr.function_type_values || !ssr.primary_task_values) {
    throw new Error(
      `Template ${template.id} is missing one or more required section_specific_rules enum arrays: ` +
      `subtopic_values, function_type_values, primary_task_values`
    );
  }

  // The four extracted blocks
  const notationBlock = buildNotationBlock(template.textbook, ssr.notation_additions);
  const distractorBlock = buildDistractorBlock(ssr.distractor_additions);
  const conditionalBlock = buildConditionalBlocks(template, answers);
  const outputContractBlock = buildOutputContract({
    sectionLabel,
    subtopicValues: ssr.subtopic_values,
    functionTypeValues: ssr.function_type_values,
    primaryTaskValues: ssr.primary_task_values,
  });

  // Assemble the prompt. Order matches the original buildTemplatePrompt.js
  // verbatim so the regression test can compare byte-for-byte.
  const prompt = `You are generating exam questions for a university ${template.course} course.

COURSE: ${template.course}
SECTION: ${template.section} — ${template.sectionTitle}
TEXTBOOK: ${template.textbook}

═══════════════════════════════════════════════════════════
GENERATION SPECIFICATION
═══════════════════════════════════════════════════════════

Generate exactly ${count} questions matching this specification.

PRIMARY FOCUS: ${primaryFocus}
${answers.primary_focus === "mix"
  ? "Distribute questions across multiple subtopics of the section. Do NOT cluster all questions on a single subtopic."
  : "Every question should focus on this subtopic specifically."}

REPRESENTATION FORMS (allowed): ${representationForms}
Each question must use one of these representation forms. Distribute the chosen forms across the question set.

FUNCTION TYPES (allowed): ${functionTypes}
${answers.function_types.includes("piecewise") && answers.function_types.length > 1 ? `
PIECEWISE STRUCTURE NOTE: "Piecewise" is a structural choice, not a base type. When generating a piecewise function, EACH PIECE must use one of the OTHER selected base types: ${answers.function_types.filter(t => t !== "piecewise").map(t => getLabel(template, "function_types", t)).join(", ")}. Do NOT generate piecewise functions whose pieces are arbitrary types.
` : `
Use these function types as the building blocks. Vary across the set.
`}

FUNCTION TYPES YOU MUST NOT USE: ${excludedLabels.length > 0 ? excludedLabels.join(", ") : "(none excluded)"}
${excludedLabels.length > 0 ? "Do not generate any question that uses these excluded function types, even partially. This is a hard restriction." : ""}
${conditionalBlock}
DOMAIN COMPLEXITY: ${domainComplexity}

STUDENT TASKS (the questions should ask students to do at least one of these):
${studentTasks}
Distribute tasks across the question set; do not ask the same task repeatedly.

GRAPHS: ${graphsOption}
${answers.graphs_option === "none" ? "Do not include any graphs." : "For questions with graphs, include a graphConfig field describing the graph (structure described below)."}

TABLES: ${tablesOption}
${answers.tables_option === "none" ? "Do not include any tables." : "For table-based questions, present the function as a pipe-format table in the question stem with 5-8 rows of (x, f(x)) pairs."}

QUESTION TYPE: ${questionType}
${answers.question_type === "multiple_choice" ? "Every question must have exactly 4 answer choices labeled A, B, C, D. Exactly one is correct." : ""}
${answers.question_type === "free_response" ? "No answer choices. Students produce the answer." : ""}
${answers.question_type === "mix" ? "Mix MC and FR; specify type per question." : ""}

═══════════════════════════════════════════════════════════
ADDITIONAL INSTRUCTIONS FROM INSTRUCTOR
═══════════════════════════════════════════════════════════

${freeText || "(none)"}

═══════════════════════════════════════════════════════════
QUALITY REQUIREMENTS — NON-NEGOTIABLE
═══════════════════════════════════════════════════════════

${notationBlock}

${distractorBlock}

EXPLANATIONS:
Each question must include a complete worked solution:
- Key concept tested
- Step-by-step derivation
- For MC: explanation of why each wrong choice is wrong, naming the misconception

${GRAPH_SCHEMAS}

${outputContractBlock}
`;

  return prompt;
}
