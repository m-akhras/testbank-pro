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
- "choices" (for Multiple Choice) must be an array of exactly 4 items. Each item is EITHER a string (text choice) OR a graph object of shape { "graphConfig": { "graphType": "single" | "piecewise", ...rest } } (graph choice). All four items in a single question must be the SAME kind — do not mix text choices and graph choices in one question. Do NOT prefix text choices with "A:", "B:", "(a)", etc.
- "answer" rule depends on the choice kind:
  · For text choices: "answer" must be a string that exactly equals ONE of the strings in "choices". Not the letter "A" — the actual full text. For example, if choices are ["2", "5", "-3", "0"] and the correct answer is the third choice, "answer" must be "-3".
  · For graph choices: "answer" must be the letter "A", "B", "C", or "D" identifying which choice is correct.
- "section" must be the exact string "${sectionLabel}" — do not abbreviate or change.
- "difficulty" must be one of: "Easy", "Medium", "Hard".
- For a question whose STEM has a graph (the question prompt shows one graph and asks about it), add "hasGraph": true and "graphConfig": {...} at the TOP LEVEL of the question object. For a question whose CHOICES are graphs (student picks which graph matches a description), nest each graphConfig inside its respective choice object — do NOT put a top-level hasGraph/graphConfig on these questions.
- All math inside "question", text choices, "answer", and "explanation" must use mini-syntax — see notation rules above.

GRAPH-AS-CHOICES (when to use this pattern):
For transformation, identify-the-graph, and match-the-equation questions, the most pedagogically valuable format is to show the original or a description in the stem and present 4 candidate graphs as the choices. Example uses:
- "Which graph represents y = -f(x - 2) + 3?" — stem describes the transformation, choices show 4 candidate graphs.
- "Which graph below matches y = (x - 1)^2 - 4?" — stem gives the equation, choices show 4 candidate parabolas with different vertex locations.
- "Which graph is the result of reflecting y = sqrt(x) across the y-axis?" — stem describes the transformation, choices show 4 candidate radical-function graphs.

For graph-as-choices, each choice is an object: { "graphConfig": { "graphType": "single", "fn": "...", "xDomain": [...], "yDomain": [...] } }. The graphType is "single" or "piecewise" (NOT "type" — for choices we use "graphType"). All other graphConfig fields (fn, xDomain, yDomain, holes, points, fnLabel, showAxisNumbers, showGrid, pieces) follow the same schema as stem graphs (see the GRAPH CONFIG section above).

Example graph-as-choice question:
{
  "type": "Multiple Choice",
  "section": "${sectionLabel}",
  "difficulty": "Medium",
  "question": "Which graph represents y = (x - 2)^2 - 3?",
  "choices": [
    { "graphConfig": { "graphType": "single", "fn": "(x - 2)^2 - 3", "xDomain": [-1, 5], "yDomain": [-4, 4], "points": [[2, -3]] } },
    { "graphConfig": { "graphType": "single", "fn": "(x + 2)^2 - 3", "xDomain": [-5, 1], "yDomain": [-4, 4], "points": [[-2, -3]] } },
    { "graphConfig": { "graphType": "single", "fn": "(x - 2)^2 + 3", "xDomain": [-1, 5], "yDomain": [0, 8], "points": [[2, 3]] } },
    { "graphConfig": { "graphType": "single", "fn": "-(x - 2)^2 - 3", "xDomain": [-1, 5], "yDomain": [-8, 0], "points": [[2, -3]] } }
  ],
  "answer": "A",
  "explanation": "..."
}

Use graph-as-choices for: transformation questions, identify-the-vertex/intercept questions, match-the-equation questions, sketch-the-result questions. Do NOT use graph-as-choices when the question is about an evaluation, a domain, or a computation (where text choices like "f(2) = -3" are more natural).

CHOICES — FORBIDDEN PATTERNS (most common quality failures):
The "choices" array is where Sonnet most frequently violates the mini-syntax rule. The rule applies HERE, in the choices, exactly as strictly as in the question stem.

NEVER put any of these in a choice string:
- LaTeX delimiters: \\( \\) \\[ \\] $$ $
- LaTeX commands: \\frac, \\sqrt, \\sin, \\cos, \\log, \\pi, \\infty, \\cdot, \\times, \\le, \\ge, \\ne, \\to, \\rightarrow
- Backslash anything: \\, \\\\, \\pi, \\sin — any visible backslash in a choice string is a violation
- Markdown formatting: ** for bold, _ for italic, \` for code
- Unicode math: π ∞ ≤ ≥ ≠ ∘ ∪ → ↔ • × ÷
- Mixed syntax: "(x - \\pi)" is WRONG even though parens are fine — the \\pi must be the literal word "pi"

CORRECT format for choices containing math:
- "y = 2sin(x - pi) - 1"     not   "y = 2\\sin(x - \\pi) - 1"
- "h(x) = 3^(-x) + 1"         not   "h(x) = \\(3^{-x}\\) + 1"
- "(1)/(2)(x - 1)^2 - 2"      not   "\\frac{1}{2}(x-1)^2 - 2"
- "sqrt(x + 3)"               not   "\\sqrt{x+3}"
- "x^2 - 4*x + 3"             not   "x² - 4·x + 3"

The downstream renderer expects mini-syntax in choices. LaTeX leaks through as literal text (students see "\\sin" instead of "sin") and breaks the question visually. If you find yourself reaching for \\ or { } or unicode while writing a choice, STOP and rewrite using mini-syntax.`;
}
