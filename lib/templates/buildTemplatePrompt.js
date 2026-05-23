
export function buildTemplatePrompt(template, answers, options = {}) {
  // Validate that all required fields have answers
  for (const field of template.fields) {
    if (field.id === "free_text") continue; // free_text is always optional
    if (answers[field.id] === undefined || answers[field.id] === null) {
      throw new Error(`Missing answer for required field: ${field.id}`);
    }
    if (field.type === "multi_select" && field.minSelections) {
      if (!Array.isArray(answers[field.id]) || answers[field.id].length < field.minSelections) {
        throw new Error(`Field ${field.id} requires at least ${field.minSelections} selection(s)`);
      }
    }
    // Piecewise pairing rule: piecewise must be paired with at least one base type
    if (field.id === "function_types" && Array.isArray(answers.function_types)) {
      if (answers.function_types.includes("piecewise") && answers.function_types.length === 1) {
        throw new Error("Piecewise must be paired with at least one base function type (polynomial, rational, radical, etc.). Piecewise tells us the structure; the base type tells us what the pieces are made of.");
      }
    }
  }

  // Helper: get the human-readable label for a single_select value
  const getLabel = (fieldId, value) => {
    const field = template.fields.find(f => f.id === fieldId);
    if (!field || !field.options) return value;
    const opt = field.options.find(o => o.value === value);
    return opt ? opt.label : value;
  };

  // Helper: get human-readable labels for a multi_select value array
  const getLabels = (fieldId, values) => {
    if (!Array.isArray(values)) return "";
    return values.map(v => getLabel(fieldId, v)).join(", ");
  };

  const count = answers.count;
  const primaryFocus = getLabel("primary_focus", answers.primary_focus);
  const representationForms = getLabels("representation_forms", answers.representation_forms);
  const functionTypes = getLabels("function_types", answers.function_types);
  const domainComplexity = getLabel("domain_complexity", answers.domain_complexity);
  const studentTasks = getLabels("student_tasks", answers.student_tasks);
  const graphsOption = getLabel("graphs_option", answers.graphs_option);
  const tablesOption = getLabel("tables_option", answers.tables_option);
  const questionType = getLabel("question_type", answers.question_type);
  const freeText = (answers.free_text || "").trim();

  // Build the "do not use" list from function_types that were NOT selected
  const allFunctionTypes = template.fields.find(f => f.id === "function_types").options.map(o => o.value);
  const excludedFunctionTypes = allFunctionTypes.filter(t => !answers.function_types.includes(t));
  const excludedLabels = excludedFunctionTypes.map(t => getLabel("function_types", t));

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
PIECEWISE STRUCTURE NOTE: "Piecewise" is a structural choice, not a base type. When generating a piecewise function, EACH PIECE must use one of the OTHER selected base types: ${answers.function_types.filter(t => t !== "piecewise").map(t => getLabel("function_types", t)).join(", ")}. Do NOT generate piecewise functions whose pieces are arbitrary types.
` : `
Use these function types as the building blocks. Vary across the set.
`}

FUNCTION TYPES YOU MUST NOT USE: ${excludedLabels.length > 0 ? excludedLabels.join(", ") : "(none excluded)"}
${excludedLabels.length > 0 ? "Do not generate any question that uses these excluded function types, even partially. This is a hard restriction." : ""}
${answers.function_types.includes("piecewise") ? `
PIECEWISE QUALITY REQUIREMENTS:
BAD example (do NOT generate): a "piecewise" function whose three pieces are all horizontal lines (e.g., f(x) = 2 on [-2,0), 5 on [0,2), 7 on [2,4]). That is a step function masquerading as piecewise and tests no real piecewise concept.
GOOD examples:
- f(x) = { x + 1 on [-3, 0],  x^2 on [0, 2] } — linear piece meeting a parabolic piece; tests continuity at x = 0.
- f(x) = { -x on (-infinity, 0),  sqrt(x) on [0, infinity) } — absolute-value-style branch meeting a radical; tests both pieces' domain restrictions.
- f(x) = { x^2 on [-2, 1),  3 - x on [1, 4] } — quadratic-to-linear transition with a jump discontinuity at x = 1.
Pieces should differ from each other. Two pieces both being y = 5 and y = 7 (both constant) is forbidden. At minimum, pieces must vary in slope or curvature.
` : ""}
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

NOTATION (mini-syntax, NOT LaTeX backslash commands):
- Use ${template.textbook} notation throughout
- Functions: f, g, h (default), or context-appropriate names for applied problems
- Variables: x (default), t for time, r for radius, etc.
- Exponents: x^2, x^3, (x-3)^2 — never x² or x³
- Fractions: ALWAYS (numerator)/(denominator) — e.g. (x+1)/(x-3) — never use square brackets or LaTeX
- Square roots: sqrt(x) — never use √, never use \\\\sqrt{}
- Cube roots: cbrt(x) — never use ∛, never use \\\\cbrt{}
- Greek letters: alpha, beta, theta, pi, sigma — never use α β θ π σ
- Comparison: <=, >=, != — never use ≤ ≥ ≠
- Multiplication: * — never use · or ×
- Infinity: infinity — never use ∞
- Absolute value: |x|
- Domain in interval notation: [a, b], (a, b], (-infinity, a), (-infinity, a) U (a, infinity)
- NEVER emit raw LaTeX commands like \\\\dfrac{}{}, \\\\sqrt{}, \\\\int_{}^{} — the renderer expects mini-syntax
- LINEAR FUNCTIONS must have a non-zero slope: f(x) = m*x + b where m != 0. Do NOT generate constant functions like f(x) = 5 disguised as "linear" or "polynomial".
- A function listed as "polynomial" must be at least degree 1 with a visible variable term — never a constant.
- Piecewise pieces obey the same rule: do NOT generate piecewise functions where any piece is a constant. Every piece must have a real variable term.

DISTRACTORS (for Multiple Choice):
Each wrong choice MUST trace to a specific named student misconception.
REMINDER: choices are bare text strings, not labeled "A:". The correct answer's full text must appear exactly in the choices array. Examples:
- Forgetting denominator ≠ 0
- Forgetting radicand ≥ 0
- Confusing f(x+h) with f(x) + h
- Sign errors in factoring
- Confusing domain with range
- Including/excluding endpoints incorrectly
- Confusing increasing with decreasing

If you cannot construct a distractor that traces to a genuine, specific misconception, REPLACE that question with a different question that has better distractors. It is acceptable to have one weak distractor per question, but no more.

EXPLANATIONS:
Each question must include a complete worked solution:
- Key concept tested
- Step-by-step derivation
- For MC: explanation of why each wrong choice is wrong, naming the misconception

═══════════════════════════════════════════════════════════
GRAPH CONFIG (only if graphs are included) — MUST MATCH RENDERER SCHEMA
═══════════════════════════════════════════════════════════

For any question that has a graph, ADD these two top-level fields to the question object (alongside "question", "choices", "answer", etc. — NOT nested anywhere else):

"hasGraph": true,
"graphConfig": { ...one of the schemas below... }

The renderer accepts ONLY these schemas. Choose ONE per graphConfig:

SCHEMA A — Single function curve (most common for Section 1.1):
{
  "type": "single",
  "fn": "x^2 - 4*x + 3",
  "xDomain": [-2, 6],
  "yDomain": [-2, 8],
  "holes": [[2, -1]],
  "points": [[3, 0]],
  "fnLabel": "f(x)",
  "showAxisNumbers": true,
  "showGrid": true
}

Required: type ("single"), fn (math expression string)
Optional: xDomain (default [-5,5]), yDomain (auto if omitted), holes (array of [x,y] for open circles), points (array of [x,y] for filled dots), fnLabel, showAxisNumbers, showGrid

SCHEMA B — Piecewise function:
{
  "type": "piecewise",
  "pieces": [
    { "fn": "x + 1", "domain": [-3, 0], "extendsLeft": false, "extendsRight": false },
    { "fn": "x^2",   "domain": [0, 2],  "extendsLeft": false, "extendsRight": false }
  ],
  "xDomain": [-4, 3],
  "holes": [[0, 1]],
  "points": [[0, 0]]
}

Required: type ("piecewise"), pieces (each with fn and domain)
Optional per-piece: extendsLeft (boolean), extendsRight (boolean), see "DOMAIN ENDPOINTS" rules below
Optional global: same chrome options as Schema A (xDomain, yDomain, fnLabel, showAxisNumbers, showGrid, holes, points)

DOMAIN ENDPOINTS — how to represent finite vs. infinite extension:

For each piecewise piece, you must indicate whether its domain endpoints are FINITE (bounded by a specific value) or INFINITE (the piece continues forever in that direction). Use these conventions:

1. FINITE endpoints (most common):
   - Use a number in the domain array
   - The renderer draws the curve from that x to the piece's other endpoint
   - For closed endpoints (included), add the [x, y] coordinate to the global "points" array
   - For open endpoints (excluded), add the [x, y] coordinate to the global "holes" array
   - extendsLeft and extendsRight are false (or omitted)

2. INFINITE extension to the LEFT (piece's domain is (-infinity, b]):
   - Set "domain": [xDomain[0], b]  — use xDomain's lower bound as the visible left edge
   - Set "extendsLeft": true
   - The renderer will draw an arrow on the left end of the curve
   - Do NOT add a "hole" or "point" for the left end (there is no endpoint to mark)
   - The right end (b) still needs a hole or point as appropriate

3. INFINITE extension to the RIGHT (piece's domain is [a, infinity)):
   - Set "domain": [a, xDomain[1]]  — use xDomain's upper bound as the visible right edge
   - Set "extendsRight": true
   - The renderer will draw an arrow on the right end of the curve
   - Do NOT add a "hole" or "point" for the right end
   - The left end (a) still needs a hole or point as appropriate

4. Piece defined on ALL REALS (rare for piecewise but possible):
   - Set "domain": [xDomain[0], xDomain[1]]
   - Set BOTH "extendsLeft": true AND "extendsRight": true
   - Arrows on both ends, no endpoint markers

EXAMPLE — piecewise function defined on all reals:
{
  "type": "piecewise",
  "pieces": [
    { "fn": "-x",  "domain": [-5, 0], "extendsLeft": true, "extendsRight": false },
    { "fn": "x^2", "domain": [0, 3],  "extendsLeft": false, "extendsRight": true }
  ],
  "xDomain": [-5, 3],
  "points": [[0, 0]]
}
Renders as: left piece from x=-5 (arrow) to x=0 (filled dot), right piece from x=0 (filled dot) to x=3 (arrow).

EXAMPLE — piecewise function with one finite and one infinite piece:
{
  "type": "piecewise",
  "pieces": [
    { "fn": "x + 2", "domain": [-3, 1], "extendsLeft": false, "extendsRight": false },
    { "fn": "x^2",   "domain": [1, 4],  "extendsLeft": false, "extendsRight": true }
  ],
  "xDomain": [-4, 4],
  "holes": [[1, 3]],
  "points": [[-3, -1], [1, 1]]
}
Renders as: left piece from x=-3 (filled dot) to x=1 (open circle), right piece from x=1 (filled dot) to x=4 (arrow).

CRITICAL: Use INFINITY in the conceptual domain, but NEVER write "Infinity" or "-Infinity" as a value in the JSON. Always use numbers (matching xDomain edges) plus the boolean extendsLeft/extendsRight flags.

EXPRESSION SYNTAX for "fn" fields:
- Use mini-syntax: x^2, sqrt(x), |x|, (x+1)/(x-2)
- Use * for multiplication: 4*x not 4x
- Use standard math functions: sin, cos, tan, exp, log, ln
- The renderer evaluates fn numerically; constants and elementary functions only

CRITICAL RULES:
- DO NOT use type "function" — use "single"
- DO NOT use type "points" — use "single" with empty fn (or skip the graph entirely)
- DO NOT nest fn under a "functions" array — fn is a top-level string in graphConfig
- DO NOT use "domain"/"range" — use "xDomain"/"yDomain"
- DO NOT include a "features" array — use "holes" and "points" at the top level instead
- DO NOT include a "color" field — colors are hardcoded by the renderer
- Vertical asymptotes emerge naturally from fn evaluation (e.g. "1/(x-2)") — do not add an "asymptote" feature
- The graph renderer ignores any keys not listed above

═══════════════════════════════════════════════════════════
OUTPUT FORMAT — CRITICAL, MATCHES EXISTING PIPELINE
═══════════════════════════════════════════════════════════

Return ONLY a JSON array. No preamble, no commentary, no markdown code fences.

Each question object MUST have these exact fields:
{
  "type": "Multiple Choice" | "Free Response",
  "section": "${template.section} ${template.sectionTitle}",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question": "The question text with mini-syntax math (not LaTeX backslash commands)",
  "choices": ["choice 1 text", "choice 2 text", "choice 3 text", "choice 4 text"],
  "answer": "the EXACT FULL TEXT of the correct choice — must match one of the choices strings EXACTLY",
  "explanation": "Complete worked solution with mini-syntax math",
  "subtopic": "function_evaluation" | "domain_analysis" | "graph_reading" | "table_reading" | "piecewise" | "symmetry" | "monotonicity" | "applied_modeling",
  "function_type": "polynomial" | "rational" | "radical" | "absolute_value" | "piecewise" | "trigonometric" | "exponential" | "logarithmic",
  "representation_form": "algebraic" | "graphical" | "numerical" | "verbal",
  "primary_task": "evaluate" | "find_domain" | "find_range" | "find_x_for_value" | "classify_symmetry" | "find_intervals" | "sketch_identify" | "interpret_context"
}

FIELD RULES — VIOLATIONS WILL CAUSE THE QUESTION TO FAIL VALIDATION:

- "question" must NOT be empty. It is the full prompt the student reads.
- "choices" must be an array of 4 strings (for Multiple Choice). Each string is JUST the answer text — DO NOT prefix with "A:", "B:", "(a)", etc. The pipeline strips prefixes anyway, but the answer field needs to match.
- "answer" must be a string that exactly equals ONE of the strings in "choices". Not the letter "A" — the actual full text. For example, if choices are ["2", "5", "-3", "0"] and the correct answer is the third choice, "answer" must be "-3" (not "C", not "C: -3", not "choice C").
- "section" must be the exact string "${template.section} ${template.sectionTitle}" — do not abbreviate or change.
- "difficulty" must be one of: "Easy", "Medium", "Hard".
- For questions with a graph, ADD "hasGraph": true at the top level AND "graphConfig": { ... } at the top level (not nested inside choices).
- All math inside "question", "choices", "answer", and "explanation" must use mini-syntax — see notation rules above.
`;

  return prompt;
}
