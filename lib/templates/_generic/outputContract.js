// lib/templates/_generic/outputContract.js
//
// The strict JSON output format Sonnet must follow when generating questions.
// This is the contract between the generation model's output and the
// downstream pipeline (PastePanel → useBank.handlePaste → Supabase insert).
// Drift here causes silent question-validation failures.
//
// Three enum fields are SECTION-SPECIFIC and parameterized:
//   - subtopic        — the taxonomy of subtopics within a section
//   - function_type   — the function families this section uses
//   - primary_task    — what students are asked to do
// Each template's `section_specific_rules` block supplies these arrays.
//
// Everything else (the field list, the "answer must equal one of choices"
// rule, the section-name format, the difficulty enum) is generic and
// applies to every template in every course.

/**
 * Build the OUTPUT FORMAT block for a prompt.
 *
 * @param {Object} args
 * @param {string} args.sectionLabel - The exact section label string,
 *                                     e.g. "1.1 Four Ways to Represent a Function".
 *                                     This is what the "section" field of each
 *                                     generated question must contain verbatim.
 * @param {string[]} args.subtopicValues - Allowed values for the "subtopic" field.
 * @param {string[]} args.functionTypeValues - Allowed values for the "function_type" field.
 * @param {string[]} args.primaryTaskValues - Allowed values for the "primary_task" field.
 * @returns {string} The full output-format block ready to interpolate.
 */
export function buildOutputContract({
  sectionLabel,
  subtopicValues,
  functionTypeValues,
  primaryTaskValues,
}) {
  if (!sectionLabel) {
    throw new Error("buildOutputContract: sectionLabel is required");
  }
  if (!Array.isArray(subtopicValues) || subtopicValues.length === 0) {
    throw new Error("buildOutputContract: subtopicValues must be a non-empty array");
  }
  if (!Array.isArray(functionTypeValues) || functionTypeValues.length === 0) {
    throw new Error("buildOutputContract: functionTypeValues must be a non-empty array");
  }
  if (!Array.isArray(primaryTaskValues) || primaryTaskValues.length === 0) {
    throw new Error("buildOutputContract: primaryTaskValues must be a non-empty array");
  }

  const subtopicEnum = subtopicValues.map(v => `"${v}"`).join(" | ");
  const functionTypeEnum = functionTypeValues.map(v => `"${v}"`).join(" | ");
  const primaryTaskEnum = primaryTaskValues.map(v => `"${v}"`).join(" | ");

  return `═══════════════════════════════════════════════════════════
OUTPUT FORMAT — CRITICAL, MATCHES EXISTING PIPELINE
═══════════════════════════════════════════════════════════

Return ONLY a JSON array. No preamble, no commentary, no markdown code fences.

Each question object MUST have these exact fields:
{
  "type": "Multiple Choice" | "Free Response",
  "section": "${sectionLabel}",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question": "The question text with mini-syntax math (not LaTeX backslash commands)",
  "choices": ["choice 1 text", "choice 2 text", "choice 3 text", "choice 4 text"],
  "answer": "the EXACT FULL TEXT of the correct choice — must match one of the choices strings EXACTLY",
  "explanation": "Complete worked solution with mini-syntax math",
  "subtopic": ${subtopicEnum},
  "function_type": ${functionTypeEnum},
  "representation_form": "algebraic" | "graphical" | "numerical" | "verbal",
  "primary_task": ${primaryTaskEnum}
}

FIELD RULES — VIOLATIONS WILL CAUSE THE QUESTION TO FAIL VALIDATION:

- "question" must NOT be empty. It is the full prompt the student reads.
- "choices" must be an array of 4 strings (for Multiple Choice). Each string is JUST the answer text — DO NOT prefix with "A:", "B:", "(a)", etc. The pipeline strips prefixes anyway, but the answer field needs to match.
- "answer" must be a string that exactly equals ONE of the strings in "choices". Not the letter "A" — the actual full text. For example, if choices are ["2", "5", "-3", "0"] and the correct answer is the third choice, "answer" must be "-3" (not "C", not "C: -3", not "choice C").
- "section" must be the exact string "${sectionLabel}" — do not abbreviate or change.
- "difficulty" must be one of: "Easy", "Medium", "Hard".
- For questions with a graph, ADD "hasGraph": true at the top level AND "graphConfig": { ... } at the top level (not nested inside choices).
- All math inside "question", "choices", "answer", and "explanation" must use mini-syntax — see notation rules above.`;
}
