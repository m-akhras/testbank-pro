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
    // multi_select_with_counts: answer is [{value, count}, ...] where count > 0.
    // Entries with count <= 0 don't count as selections (analogous to unselected toggles).
    if (field.type === "multi_select_with_counts" && field.minSelections) {
      const value = answers[field.id];
      if (!Array.isArray(value)) {
        throw new Error(`Field ${field.id} must be an array of {value, count, difficulty?} entries`);
      }
      const activeEntries = value.filter(e => e && typeof e === "object" && e.value && Number(e.count) > 0);
      if (activeEntries.length < field.minSelections) {
        throw new Error(`Field ${field.id} requires at least ${field.minSelections} task(s) with count > 0`);
      }
      // Validate difficulty values if present. Unknown difficulty defaults to "medium" silently.
      const validDifficulties = ["easy", "medium", "hard", "mix_easy", "mix_balanced", "mix_hard"];
      for (const entry of activeEntries) {
        if (entry.difficulty !== undefined && !validDifficulties.includes(entry.difficulty)) {
          throw new Error(
            `Field ${field.id}: entry "${entry.value}" has invalid difficulty "${entry.difficulty}". ` +
            `Valid values: ${validDifficulties.join(", ")}`
          );
        }
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

/**
 * For multi_select_with_counts fields. Takes [{value, count}, ...] and returns
 * a readable string like "Apply transformation (3 questions), Find domain (2 questions)".
 * Entries with count <= 0 are filtered out.
 */
function getLabelsWithCounts(template, fieldId, entries) {
  if (!Array.isArray(entries)) return "";
  return entries
    .filter(e => e && typeof e === "object" && e.value && Number(e.count) > 0)
    .map(e => {
      const label = getLabel(template, fieldId, e.value);
      const n = Number(e.count);
      const word = n === 1 ? "question" : "questions";
      return `${label} (${n} ${word})`;
    })
    .join(", ");
}

/**
 * Distribute a count across Easy / Medium / Hard for a given mix selection.
 * Used by getLabelsWithCountsAndDifficulty to translate per-task difficulty
 * settings into explicit per-level counts for the model.
 *
 * Mix rules:
 *   "easy" / "medium" / "hard"     → all questions at that level
 *   "mix_easy"     → ceil(count * 0.7) Easy, remainder Medium
 *   "mix_balanced" → distribute as evenly as possible across all 3 levels
 *   "mix_hard"     → ceil(count * 0.7) Hard, remainder Medium
 *
 * Returns { easy, medium, hard } with easy+medium+hard === count.
 */
function distributeMixCounts(count, mix) {
  if (count <= 0) return { easy: 0, medium: 0, hard: 0 };
  if (mix === "easy")   return { easy: count, medium: 0, hard: 0 };
  if (mix === "medium") return { easy: 0, medium: count, hard: 0 };
  if (mix === "hard")   return { easy: 0, medium: 0, hard: count };
  if (mix === "mix_easy") {
    const easy = Math.ceil(count * 0.7);
    return { easy, medium: count - easy, hard: 0 };
  }
  if (mix === "mix_balanced") {
    const base = Math.floor(count / 3);
    const remainder = count - base * 3;
    return {
      easy:   base + (remainder > 0 ? 1 : 0),
      medium: base + (remainder > 1 ? 1 : 0),
      hard:   base
    };
  }
  if (mix === "mix_hard") {
    const hard = Math.ceil(count * 0.7);
    return { easy: 0, medium: count - hard, hard };
  }
  // Unknown mix value — default to all medium so the model still produces something.
  return { easy: 0, medium: count, hard: 0 };
}

/**
 * For multi_select_with_counts fields that include per-entry difficulty.
 * Takes [{value, count, difficulty?}, ...] and returns a readable string
 * with per-task difficulty distributions explicit.
 *
 * Entries with count <= 0 are filtered out (just like getLabelsWithCounts).
 * Entries missing a difficulty default to "medium" (backwards-compatibility
 * with templates whose defaults predate per-task difficulty).
 */
function getLabelsWithCountsAndDifficulty(template, fieldId, entries) {
  if (!Array.isArray(entries)) return "";
  return entries
    .filter(e => e && typeof e === "object" && e.value && Number(e.count) > 0)
    .map(e => {
      const label = getLabel(template, fieldId, e.value);
      const count = Number(e.count);
      const word = count === 1 ? "question" : "questions";
      const mix = e.difficulty || "medium";
      const dist = distributeMixCounts(count, mix);
      const parts = [];
      if (dist.easy   > 0) parts.push(`${dist.easy} Easy`);
      if (dist.medium > 0) parts.push(`${dist.medium} Medium`);
      if (dist.hard   > 0) parts.push(`${dist.hard} Hard`);
      return `${label} - ${count} ${word} (${parts.join(", ")})`;
    })
    .join("\n");
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
 * Reference examples (style anchoring)
 * ────────────────────────────────────────────────────────────────── */

/**
 * If the template has reference_examples (extracted from textbook materials
 * during template generation), format them as a style-anchor block so the
 * generated questions match the textbook's specific style — notation
 * conventions, level of formality, phrasing patterns.
 *
 * Returns an empty string if no reference_examples present, so callers can
 * unconditionally interpolate it.
 */
function buildReferenceExamplesBlock(template) {
  const examples = template.section_specific_rules?.reference_examples || [];
  if (!Array.isArray(examples) || examples.length === 0) return "";

  const formatted = examples.map((ex, i) => {
    const parts = [`Example ${i + 1}:`];
    if (ex.stem) parts.push(`  Question stem: ${ex.stem}`);
    if (Array.isArray(ex.choices) && ex.choices.length > 0) {
      parts.push(`  Choices: ${ex.choices.map(c => `"${c}"`).join("; ")}`);
    }
    if (ex.answer) parts.push(`  Answer: ${ex.answer}`);
    if (ex.explanation) parts.push(`  Explanation style: ${ex.explanation}`);
    return parts.join("\n");
  }).join("\n\n");

  return `═══════════════════════════════════════════════════════════
REFERENCE EXAMPLES FROM TEXTBOOK — match this style
═══════════════════════════════════════════════════════════

The following examples were extracted from the source textbook for this section. Your generated questions should match the STYLE of these examples — the phrasing, the formality, the notation conventions, the level of scaffolding in explanations. These are not templates to copy; they are style anchors.

${formatted}

When generating new questions, ask yourself: "If a student read this question next to an example above, would they look stylistically consistent?" If not, revise.

`;
}

/* ────────────────────────────────────────────────────────────────────
 * Main builder
 * ────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────
 * Per-question enrichment (Exam Generator wizard, TIGHT mode)
 * ────────────────────────────────────────────────────────────────── */

/**
 * buildPerQuestionEnrichment — SUPPLEMENTARY guidance for ONE wizard question.
 *
 * Given a section template and the (possibly partial) form answers captured on
 * a draft, returns a compact block of STYLE + DISTRACTOR hints drawn from the
 * template's intelligence: resolved focus / function-type / domain labels, the
 * instructor's free-text note, any fired conditional_quality_blocks, the
 * section notation conventions, and the textbook reference examples.
 *
 * This is deliberately NOT a generation spec. It omits the batch machinery
 * (count, student_tasks distribution, output contract, "generate N questions").
 * It exists only to inform the parts the model fills in TIGHT mode — the MC
 * choices, the correct answer, the difficulty label, and the worked
 * explanation. The instructor's wording stays authoritative; if a hint
 * conflicts with the wording, the wording wins (the framing below says so).
 *
 * The batch-only fields (count, student_tasks) are stripped before evaluating
 * conditional blocks, so blocks keyed on the hidden student_tasks defaults
 * don't fire with a dangling "STUDENT TASKS block above" reference. Only the
 * instructor-set selections (primary_focus, function_types, …) drive firing.
 *
 * Returns "" when template/answers are missing or nothing meaningful resolves,
 * so callers can interpolate it unconditionally.
 *
 * NOTE: this does NOT call buildPrompt — buildPrompt's behavior is untouched.
 */
export function buildPerQuestionEnrichment(template, answers) {
  if (!template || !answers || typeof answers !== "object") return "";

  const ssr = template.section_specific_rules || {};

  // Resolved qualitative content hints — only those the instructor actually set.
  const lines = [];
  if (answers.primary_focus) {
    lines.push(`- Subtopic focus: ${getLabel(template, "primary_focus", answers.primary_focus)}`);
  }
  if (Array.isArray(answers.function_types) && answers.function_types.length) {
    lines.push(`- Feature these function types: ${getLabels(template, "function_types", answers.function_types)}`);
  }
  if (Array.isArray(answers.representation_forms) && answers.representation_forms.length) {
    lines.push(`- Representation forms in play: ${getLabels(template, "representation_forms", answers.representation_forms)}`);
  }
  if (answers.domain_complexity) {
    lines.push(`- Domain complexity: ${getLabel(template, "domain_complexity", answers.domain_complexity)}`);
  }
  const freeText = (answers.free_text || "").trim();
  if (freeText) {
    lines.push(`- Instructor note: ${freeText}`);
  }

  // Fire conditional blocks only on instructor-set selections (drop batch fields).
  const { count, student_tasks, ...contentAnswers } = answers;
  const conditionalBlock = buildConditionalBlocks(template, contentAnswers);
  const referenceExamplesBlock = buildReferenceExamplesBlock(template);
  const notation = Array.isArray(ssr.notation_additions) && ssr.notation_additions.length
    ? ssr.notation_additions.map(n => `- ${n}`).join("\n")
    : "";

  if (!lines.length && !conditionalBlock && !referenceExamplesBlock && !notation) return "";

  const framing =
`  SUPPLEMENTARY TEMPLATE GUIDANCE for this question (section ${template.section} — ${template.sectionTitle}):
  The wording above is AUTHORITATIVE and must be used VERBATIM (TIGHT mode). The hints below come from this section's textbook template and apply ONLY to the parts you fill in — the MC choices, the correct answer, the difficulty label, and the worked explanation. Do NOT use them to rewrite, reframe, renumber, re-scope, or replace the question, and do NOT generate extra questions from them. If any hint conflicts with the instructor's wording, the wording wins.`;

  const parts = [framing];
  if (lines.length) parts.push(lines.join("\n"));
  if (notation) parts.push(`  Notation conventions for this section:\n${notation}`);
  if (conditionalBlock) parts.push(conditionalBlock);
  if (referenceExamplesBlock) parts.push(`  Style anchors (match STYLE only — do NOT copy these as new questions):\n${referenceExamplesBlock}`);

  return "\n" + parts.join("\n\n");
}

export function buildPrompt(template, answers, options = {}) {
  validateAnswers(template, answers);

  // Resolve labels for interpolation
  const count = answers.count;
  const primaryFocus = getLabel(template, "primary_focus", answers.primary_focus);
  const representationForms = getLabels(template, "representation_forms", answers.representation_forms);
  const functionTypes = getLabels(template, "function_types", answers.function_types);
  const domainComplexity = getLabel(template, "domain_complexity", answers.domain_complexity);

  // student_tasks may be multi_select (string[]), multi_select_with_counts
  // ([{value, count}, ...]), or the same with per-entry difficulty
  // ([{value, count, difficulty}, ...]). Detect by checking the actual answer shape.
  const studentTasksField = template.fields.find(f => f.id === "student_tasks");
  const studentTasksHasCounts = studentTasksField?.type === "multi_select_with_counts";
  const studentTasksHasDifficulty = studentTasksHasCounts
    && Array.isArray(answers.student_tasks)
    && answers.student_tasks.some(e => e && typeof e === "object" && e.difficulty);
  const studentTasks = studentTasksHasDifficulty
    ? getLabelsWithCountsAndDifficulty(template, "student_tasks", answers.student_tasks)
    : studentTasksHasCounts
      ? getLabelsWithCounts(template, "student_tasks", answers.student_tasks)
      : getLabels(template, "student_tasks", answers.student_tasks);

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
  const referenceExamplesBlock = buildReferenceExamplesBlock(template);
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

${referenceExamplesBlock}═══════════════════════════════════════════════════════════
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

STUDENT TASKS:
${studentTasksHasDifficulty
  ? `Generate questions matching this specific distribution of tasks and difficulties:\n${studentTasks}\n\nHonor the per-task counts AND the per-task difficulty distribution as closely as possible. Total question count is ${count}. The DIFFICULTY RUBRIC in the section-specific rules below defines what Easy / Medium / Hard mean for each task type. Follow it precisely when assigning the per-question difficulty field in your output.`
  : studentTasksHasCounts
    ? `Generate questions matching this specific distribution of tasks:\n${studentTasks}\nHonor these counts as closely as possible. If the total doesn't match the question count, prioritize the count field (${count}) and adjust task distribution proportionally.`
    : `The questions should ask students to do at least one of these:\n${studentTasks}\nDistribute tasks across the question set; do not ask the same task repeatedly.`}

GRAPHS: ${graphsOption}
${answers.graphs_option === "none" ? "Do not include any graphs." : "For questions with graphs, include a graphConfig field describing the graph (structure described below)."}
${Array.isArray(ssr.graph_eligible_tasks) && ssr.graph_eligible_tasks.length > 0 ? `
GRAPHS — STRICT TASK-COUPLING RULE:
A graphConfig may be attached ONLY to questions whose primary_task is one of:
  ${ssr.graph_eligible_tasks.join(", ")}

For ALL OTHER tasks, do NOT attach a graphConfig under any circumstances. A graph on an algebraic/computational task (e.g., evaluating a log, finding an inverse formula, simplifying an expression, solving an equation) is a quality failure even if it renders correctly. The graph must be LOAD-BEARING — the student must NEED to read the graph to answer the question. Decorative graphs are forbidden.

Within the eligible tasks above, attach graphs at the frequency implied by the GRAPHS option (none / some / many / all).
` : ""}

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

GRAPH X-DOMAIN RULE (applies to function graphs — single, overlay, piecewise):
For any function graph, xDomain MUST include x = 0 so the y-axis is visible. The y-axis is drawn at x = 0; if xDomain starts at a positive number, the y-axis disappears and the graph looks broken.

Examples:
- f(x) = sqrt(x - 2) + 1: even though defined only for x >= 2, use xDomain like [0, 10] (y-axis visible), NOT [2, 10] (y-axis cropped out).
- y = log_b(x): defined only for x > 0, but xDomain should still include 0 (e.g., [0, 10]), NOT [0.1, 10].
- y = 2^x: include 0 so y-intercept is visible — use xDomain like [-3, 3], NOT [1, 5].

Exception: only when the question is specifically about behavior far from the origin (e.g., "find the horizontal asymptote as x approaches infinity") may xDomain exclude 0. Rare.

This rule does NOT apply to stat-chart types (bar, histogram, scatter, continuous_dist, etc.) — those have their own x-axis conventions.

${outputContractBlock}
`;

  return prompt;
}
