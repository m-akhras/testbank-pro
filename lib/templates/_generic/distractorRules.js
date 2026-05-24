// lib/templates/_generic/distractorRules.js
//
// The distractor quality bar for multiple-choice questions, applied to every
// section's generation prompt. The rule is: every wrong answer choice must
// trace to a specific named student misconception. If a distractor can't be
// justified by a real error pattern, the question must be replaced rather
// than padded with weak choices.
//
// Generic example misconceptions cover the common categories (sign errors,
// domain confusion, operator confusion, etc.). Sections can add their own
// section-specific misconception examples via
// `section_specific_rules.distractor_additions`.

const GENERIC_MISCONCEPTION_EXAMPLES = [
  "Forgetting denominator ≠ 0",
  "Forgetting radicand ≥ 0",
  "Confusing f(x+h) with f(x) + h",
  "Sign errors in factoring",
  "Confusing domain with range",
  "Including/excluding endpoints incorrectly",
  "Confusing increasing with decreasing",
];

export const DISTRACTOR_RULES_HEADER = `DISTRACTORS (for Multiple Choice):
Each wrong choice MUST trace to a specific named student misconception.
REMINDER: choices are bare text strings, not labeled "A:". The correct answer's full text must appear exactly in the choices array. Examples:`;

export const DISTRACTOR_RULES_FOOTER = `If you cannot construct a distractor that traces to a genuine, specific misconception, REPLACE that question with a different question that has better distractors. It is acceptable to have one weak distractor per question, but no more.`;

/**
 * Build the full distractor-rules block for a prompt, optionally appending
 * section-specific misconception examples.
 *
 * @param {string[]} additions - lines from template.section_specific_rules.distractor_additions
 *                               e.g. for §1.3 transformations: ["Confusing horizontal shift direction (f(x-2) means shift right, not left)"]
 * @returns {string} The full distractor-rules block ready to interpolate.
 */
export function buildDistractorBlock(additions = []) {
  const allExamples = [
    ...GENERIC_MISCONCEPTION_EXAMPLES,
    ...(Array.isArray(additions) ? additions : []),
  ];
  const exampleLines = allExamples.map(e => `- ${e.replace(/^-\s*/, "")}`).join("\n");
  return `${DISTRACTOR_RULES_HEADER}\n${exampleLines}\n\n${DISTRACTOR_RULES_FOOTER}`;
}
