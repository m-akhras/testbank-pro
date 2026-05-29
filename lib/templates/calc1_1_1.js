export const calc1_1_1_template = {
  id: "calc1_1_1",
  version: 1,
  course: "Calculus 1",
  section: "1.1",
  sectionTitle: "Four Ways to Represent a Function",
  textbook: "Stewart Early Transcendentals 9th Ed",

  fields: [
    {
      id: "count",
      label: "How many questions?",
      type: "number",
      default: 5,
      min: 1,
      max: 20
    },
    {
      id: "primary_focus",
      label: "Primary focus",
      type: "single_select",
      default: "mix",
      options: [
        { value: "mix", label: "A mix across the section (recommended)" },
        { value: "function_notation", label: "Function notation and evaluation (Stewart Ex 1-2, 25-32)" },
        { value: "reading_graphs", label: "Reading values and features from graphs (Stewart Ex 3-6)" },
        { value: "function_test", label: "Is this a function? — equations, tables, vertical line test (Stewart Ex 7-18)" },
        { value: "domain", label: "Find the domain of a function (Stewart Ex 39-46)" },
        { value: "piecewise", label: "Piecewise-defined functions (Stewart Ex 49-58)" },
        { value: "even_odd", label: "Even, odd, or neither (Stewart Ex 77-86)" }
      ]
    },
    {
      id: "representation_forms",
      label: "Representation forms to include",
      type: "multi_select",
      default: ["algebraic", "graphical"],
      minSelections: 1,
      options: [
        { value: "algebraic", label: "Algebraic (formula given)" },
        { value: "graphical", label: "Graphical (graph given)" },
        { value: "numerical", label: "Numerical (table given)" },
        { value: "verbal", label: "Verbal (word description)" }
      ]
    },
    {
      id: "function_types",
      label: "Function families to feature in stems",
      type: "multi_select",
      default: ["polynomial", "rational", "radical", "abs_value", "piecewise"],
      minSelections: 1,
      options: [
        { value: "polynomial", label: "Polynomial (linear, quadratic, cubic)" },
        { value: "rational", label: "Rational (denominators with x)" },
        { value: "radical", label: "Radical (square roots, cube roots)" },
        { value: "abs_value", label: "Absolute value" },
        { value: "piecewise", label: "Piecewise (separate rules per interval)" },
        { value: "exponential_log", label: "Exponential / logarithmic (only if §1.4-1.5 already covered)" },
        { value: "trig", label: "Trigonometric (only if students know basic trig)" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select_with_counts",
      default: [
        { value: "evaluate_function_at_point", count: 1, difficulty: "medium" },
        { value: "read_graph_features", count: 1, difficulty: "medium" },
        { value: "function_test_equation", count: 1, difficulty: "medium" },
        { value: "vertical_line_test_graph", count: 1, difficulty: "medium" },
        { value: "domain_from_formula", count: 1, difficulty: "medium" }
      ],
      minSelections: 1,
      options: [
        { value: "evaluate_function_at_point", label: "Evaluate f at a specific input from formula (Stewart Ex 25-32)" },
        { value: "read_graph_features", label: "Read values, intervals, domain/range from a graph (Stewart Ex 3)" },
        { value: "compare_two_graphs", label: "Compare two graphs on the same axes — f vs g (Stewart Ex 4)" },
        { value: "function_test_equation", label: "Does this equation define y as a function of x? (Stewart Ex 7-14)" },
        { value: "vertical_line_test_graph", label: "Is this curve a function? (Stewart Ex 15-18)" },
        { value: "domain_from_formula", label: "Find the domain of a function (Stewart Ex 39-46)" },
        { value: "evaluate_piecewise", label: "Evaluate a piecewise function at specific inputs (Stewart Ex 49-52)" },
        { value: "classify_even_odd_formula", label: "Classify f as even, odd, or neither — from formula (Stewart Ex 81-86)" },
        { value: "classify_even_odd_graph", label: "Classify f as even, odd, or neither — from graph (Stewart Ex 77-78)" }
      ]
    },
    {
      id: "compound_format",
      label: "Compound-stem (Stewart Ex 3-style) format",
      type: "single_select",
      default: "independent",
      options: [
        { value: "independent", label: "Independent MC questions — one sub-question per MC item (recommended for Canvas)" },
        { value: "branched", label: "Branched MC — Stewart's compound style, multiple parts sharing a graph (recommended for Word)" }
      ]
    },
    {
      id: "graphs_option",
      label: "Include graphs?",
      type: "single_select",
      default: "some",
      options: [
        { value: "none", label: "No graphs" },
        { value: "some", label: "Some questions include graphs (~30-40%)" },
        { value: "many", label: "Many questions include graphs (~60-70%)" },
        { value: "all", label: "All questions use graphs" }
      ]
    },
    {
      id: "tables_option",
      label: "Include tables?",
      type: "single_select",
      default: "none",
      options: [
        { value: "none", label: "No tables" },
        { value: "few", label: "One or two questions use a table" },
        { value: "several", label: "Several questions use tables" }
      ]
    },
    {
      id: "question_type",
      label: "Question type",
      type: "single_select",
      default: "multiple_choice",
      options: [
        { value: "multiple_choice", label: "Multiple Choice" },
        { value: "free_response", label: "Free Response" },
        { value: "mix", label: "Mix of both" }
      ]
    },
    {
      id: "free_text",
      label: "Additional instructions (optional)",
      type: "free_text",
      default: "",
      placeholder: "e.g., Avoid piecewise stems. Include at least one vertical-line-test question. Keep domains simple (no nested radicals)."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    graph_eligible_tasks: [
      "read_graph_features",
      "compare_two_graphs",
      "vertical_line_test_graph",
      "classify_even_odd_graph"
    ],

    // Reference examples populated in v2 (round 2 of template build-out).
    // For v1 the template runs without reference_examples; the generic
    // prompt-builder block handles that case gracefully.
    reference_examples: [],

    conditional_quality_blocks: [
      {
        condition: { field: "student_tasks", includes: "evaluate_function_at_point" },
        content: `
DIFFICULTY RUBRIC for §1.1 (Four Ways to Represent a Function):
The STUDENT TASKS block above tells you, per-task, how many questions to generate at Easy / Medium / Hard. This block defines what those labels MEAN for each §1.1 task. Pick the appropriate complexity per question to honor the requested distribution. Set the per-question "difficulty" field in your output to "Easy", "Medium", or "Hard" matching the level you actually wrote at.

evaluate_function_at_point (Stewart Ex 25-32):
- Easy: single substitution into a polynomial — f(x) = 2*x + 3, find f(5)
- Medium: substitution into a rational or radical — f(x) = (x-1)/(x+2), find f(3); or g(x) = sqrt(x+1), find g(8)
- Hard: substitution returning an expression — f(x) = x^2 - x, find f(a+h); or composition-flavored — f(x) = x^2, find f(x+h) - f(x)

read_graph_features (Stewart Ex 3):
- Easy: read a single value — g(0) = ? — from a graph with clear lattice points
- Medium: solve g(x) = c for x — find all x-values where the graph reaches a horizontal line
- Hard: solve g(x) <= c or state domain/range/increasing-decreasing intervals from a non-trivially-shaped graph

compare_two_graphs (Stewart Ex 4):
- Easy: read both functions' value at the same x — f(-4) and g(3)
- Medium: where do f and g intersect, or where is f >= g
- Hard: solve f(x) = c with a non-trivial graph, OR state domain/range/decreasing intervals for both functions

function_test_equation (Stewart Ex 7-14):
- Easy: linear equation — 3*x - 5*y = 7 (always a function unless y is squared)
- Medium: equation with y squared OR y cubed — 3*x^2 - 2*y = 5 vs x^2 + (y-3)^2 = 5
- Hard: equation involving |y|, y^n with n even, or implicit equations — 2*x - |y| = 0

vertical_line_test_graph (Stewart Ex 15-18):
- Easy: a clear curve OR clearly-failing graph (e.g. a sideways parabola)
- Medium: a curve with a self-intersection or a near-vertical region
- Hard: a curve that passes vertical line test except at one boundary point, plus a domain/range write-up

domain_from_formula (Stewart Ex 39-46):
- Easy: single restriction — rational like (x+4)/(x^2-9) or radical like sqrt(2*t-1)
- Medium: two restrictions combined — two separate radicals like sqrt(3-t) - sqrt(2+t), or radical inside denominator
- Hard: nested fractions like (u+1)/(1 + 1/(u+1)); nested radicals like sqrt(2 - sqrt(p)); or three interacting restrictions

evaluate_piecewise (Stewart Ex 49-52):
- Easy: two pieces with simple linear/quadratic rules — evaluate at 1-2 points that hit different pieces
- Medium: three pieces OR pieces with non-trivial expressions like absolute value branches
- Hard: pieces with boundary edge cases where the student must check which piece applies at the boundary, OR pieces involving |x| or floor

classify_even_odd_formula (Stewart Ex 81-86):
- Easy: monomial — x^2 (even), x^3 (odd), x (odd), 5 (even)
- Medium: rational or product — x/(x^2+1), x^2/(x^4+1), x|x|
- Hard: compound polynomial like 1 + 3*x^2 - x^4 (even) vs 1 + 3*x^3 - x^5 (neither because of the constant)

classify_even_odd_graph (Stewart Ex 77-78):
- Easy: classic textbook even/odd shape — symmetric parabola for even, point-symmetric curve through origin for odd
- Medium: graph that LOOKS even or odd at a glance but has subtle asymmetry — student must check carefully
- Hard: graph showing two functions f and g where one is even, the other is neither — classify both with reasoning

NEVER label a question Hard if it would be solved in one line. NEVER label a question Easy if it requires multiple concept lookups.
`
      },

      // Stub conditional blocks for each task — these get fleshed out in v2 (round 2)
      // with full Stewart-anchored quality requirements and distractor guidance.
      // For v1 we want the template to *register* and *compile* with all 9 tasks
      // surfacing correctly in the form; quality refinements come after.

      {
        condition: { field: "compound_format", equals: "branched" },
        content: `
BRANCHED COMPOUND FORMAT (Stewart Ex 3 and Ex 4 style):
When the user selects "branched", read_graph_features and compare_two_graphs questions should be generated as branched MCQ:
- ONE shared stem with the graph image
- 3-5 MCQ sub-parts each with their own choices and correct answer

This matches Stewart's pedagogy — students read one graph and answer multiple related questions about it.

Required output shape: questionType "branched_mcq" with a parts[] array. Each part has its own stem text, choices array, and answer.

If user selected "independent" (the default), generate normal one-stem-one-MCQ questions — one sub-question becomes one MC item with its own graph.

For Canvas QTI export, prefer "independent" — Canvas Classic Quizzes does not natively support compound stems with shared graphs.
For Word export, "branched" mirrors Stewart's textbook style and reads more naturally on paper.
`
      },

      {
        condition: { field: "student_tasks", includes: "vertical_line_test_graph" },
        content: `
VERTICAL LINE TEST GUIDANCE (Stewart Ex 15-18):
A curve in the xy-plane is the graph of a function of x if and only if every vertical line intersects it at most once.

For these questions:
- Stem: "Is the curve below the graph of a function of x? If yes, state its domain and range."
- Graphs should be a mix of clear yes/no cases plus an edge case (e.g. curve with a closed endpoint on a vertical line — still a function).
- Common failures: sideways parabolas, circles, curves with a vertical segment, curves with multiple branches at the same x.
- Common passes: any single-branch curve, even with sharp corners or jumps.

If the curve passes, the student must also state domain (range of x-values where the curve exists) and range (range of y-values the curve covers).
`
      },

      {
        condition: { field: "student_tasks", includes: "domain_from_formula" },
        content: `
DOMAIN FROM FORMULA GUIDANCE (Stewart Ex 39-46):
Standard restrictions:
- Denominator cannot equal zero
- Radicand of an even-index root (sqrt, fourth-root, etc.) must be >= 0
- Argument of log must be > 0 (only if logs are in scope for the course)
- Argument of inverse trig must be within their natural ranges (only if covered)

ANSWER FORMAT: interval notation with parentheses/brackets and "infinity". Use union symbol U for disjoint intervals.
- Example: (-infinity, 3) U (3, infinity) for x != 3
- Example: [1, infinity) for x >= 1
- Example: (-infinity, -3) U (-3, 3) U (3, infinity) for x != +/- 3
- NEVER use unicode infinity glyph; write "infinity" as ASCII text.

DISTRACTORS:
- Swap open/closed brackets (e.g. (3, infinity) when answer is [3, infinity))
- Miss one of two restrictions (e.g. handle denominator but forget radical)
- Wrong direction on inequality (e.g. x <= 3 when answer is x >= 3)
- Include endpoint that should be excluded
`
      },

      {
        condition: { field: "student_tasks", includes: "evaluate_piecewise" },
        content: `
PIECEWISE EVALUATION GUIDANCE (Stewart Ex 49-52):
Standard format: f(x) = { rule_1 if condition_1 ; rule_2 if condition_2 ; ... }

For each evaluation point:
1. Identify which condition the input satisfies
2. Apply the corresponding rule
3. Pay attention to boundary points — Stewart's pieces typically use <, <=, >, >= so the boundary belongs to exactly one piece

CRITICAL BOUNDARY CHECK: when the input is exactly the boundary value (e.g. x = 2 when one piece is "x < 2" and another is "x >= 2"), determine which piece applies based on the inequality direction. Students often miss this.

NOTATION in stems: write piecewise functions using brace mini-syntax:
"f(x) = { x^2 + 2 if x < 0 ; x if x >= 0 }"
Rules separated by semicolons; each rule is "expression if condition". The renderer converts this to a proper stacked-cases display (large brace, aligned rows) in both Canvas and on-screen preview. Do NOT write piecewise as prose ("f(x) = x^2 + 2 if x < 0, and f(x) = x if x >= 0") — always use the brace mini-syntax so it renders as stacked cases. Stems may say "the piecewise-defined function" followed by the brace mini-syntax form.

DISTRACTORS for evaluations:
- Apply the wrong piece (e.g. use x^2 + 2 when x = 1 should use the x piece)
- Get the arithmetic right but answer "undefined" because the student doesn't see which piece applies
- Off-by-one error on the boundary
`
      },

      {
        condition: { field: "student_tasks", includes: "classify_even_odd_formula" },
        content: `
EVEN/ODD FROM FORMULA GUIDANCE (Stewart Ex 81-86):
Definitions:
- f is EVEN if f(-x) = f(x) for all x in the domain
- f is ODD if f(-x) = -f(x) for all x in the domain
- Otherwise NEITHER

Method: compute f(-x). Compare to f(x) and -f(x).
- If f(-x) simplifies to f(x): even
- If f(-x) simplifies to -f(x): odd
- Otherwise: neither

ALGEBRAIC TIPS:
- Polynomials with only even-power terms (and constants) are even: 1 + 3*x^2 - x^4
- Polynomials with only odd-power terms (no constant) are odd: x + x^3 - x^5
- Mixing even and odd terms gives neither: 1 + 3*x^3 - x^5 (constant makes it neither)
- |x| is even since |-x| = |x|
- x|x| is odd since (-x)|-x| = -x|x|
- Ratios: x/(x^2+1) is odd (numerator odd, denominator even, odd/even = odd)
- Ratios: x^2/(x^4+1) is even (numerator even, denominator even, even/even = even)

CHOICES for MC: "Even", "Odd", "Neither", and (when applicable) "Both even and odd" — note: only f(x) = 0 is both even and odd. Generally use just three choices: Even / Odd / Neither.

DISTRACTORS:
- Sign error: forget that (-x)^3 = -x^3 (correctly odd) or (-x)^4 = x^4 (correctly even)
- Mix-up: classify x^3 + x^2 as odd (it's neither, due to mixed parity)
- Constant-term blindness: classify 1 + x^2 as odd (it's even, since 1 = 1*x^0 is an even term)
`
      },

      {
        condition: { field: "student_tasks", includes: "classify_even_odd_graph" },
        content: `
EVEN/ODD FROM GRAPH GUIDANCE (Stewart Ex 77-78):
Symmetry rules:
- EVEN: graph is symmetric about the y-axis (mirror image left-right)
- ODD: graph is symmetric about the origin (rotate 180 degrees gives same graph)
- NEITHER: no such symmetry

For Pattern B (graph choices):
- Stem: "Which of the following graphs represents an even function?" with 4 candidate graphs
- All four graphs should be plausible (no obvious gotchas like a graph that's clearly not a function at all)
- Distractor graphs: one is odd (point-symmetric), one is neither (no symmetry), one has near-symmetry that fails on inspection

For single-graph stems:
- Stem: "The graph below shows f(x). Is f even, odd, or neither?"
- Use a graph with clear symmetry that the student can read at lattice points
- Distractor: when the graph IS even, the wrong answer "odd" is the most common student mistake (and vice versa)

OVERLAY VARIANT (Stewart Ex 77-78): two functions f and g shown on the same axes, classify each.
Stem: "The graphs of f and g are shown. Classify each as even, odd, or neither."
This is a compound question — best generated as branched_mcq when compound_format is "branched", otherwise as two independent MC items.

DO NOT pick a graph whose symmetry is ambiguous near the y-axis or origin. Use clear, lattice-point-anchored graphs.
`
      }
    ],

    notation_additions: [
      `FUNCTION NOTATION: write f(x), g(x), h(x), F(p), etc. The letter inside parentheses is the input variable. f(3) is the value of f at 3. f(a+h) is the value of f at the input a+h.`,
      `INTERVAL NOTATION for domain/range: use parentheses for open endpoints, brackets for closed, and "U" for union. Example: (-infinity, 3) U (3, infinity). Use "infinity" as ASCII text, never the unicode glyph.`,
      `INEQUALITIES in piecewise definitions: write < <= > >= with ASCII. Do NOT use unicode. The renderer normalizes these to symbols at display time.`,
      `PIECEWISE FUNCTIONS in stems: write using brace mini-syntax: { expr if cond ; expr if cond }. Example: f(x) = { x^2 - 1 if x < 0 ; sqrt(x + 4) if x >= 0 }. Rules separated by semicolons; each rule is "expression if condition". The renderer converts this to a proper stacked-cases display (with the large brace and aligned rows) for both Canvas and on-screen preview. Do NOT write piecewise as prose ("... if x < 0, and ... if x >= 0") — always use the brace mini-syntax so it renders as stacked cases.`,
      `ABSOLUTE VALUE: write |x|, |x+2|, |x-1|. The renderer converts | bars to absolute value display at display time.`,
      `SQUARE ROOT: write sqrt(...) for square root, cbrt(...) for cube root. Renders to the radical symbol.`,
      `RATIONAL FUNCTIONS: write (numerator)/(denominator) with explicit parentheses around the numerator and denominator so the renderer produces a stacked fraction.`,
      `DOMAIN-RESTRICTION REASONING in explanations: state the rule explicitly. "The denominator x^2 - 9 = 0 when x = 3 or x = -3, so the domain excludes these values."`,
      `EVEN/ODD VERIFICATION in explanations: show f(-x) explicitly and compare to f(x) and -f(x). "f(-x) = (-x)^2 - 2*(-x) = x^2 + 2*x. Since this equals neither f(x) nor -f(x), f is neither even nor odd."`,
      `LABEL CONVENTION FOR GRAPHS: when including a graph (single, overlay, or piecewise), the fnLabel MUST be a short identifier — "y", "f(x)", "g(x)", "h(x)" — never the full equation. The equation belongs in the stem or as part of the question text, not on the curve.`,
      `Do NOT use unicode symbols anywhere. Write <= >= != "infinity" — never the unicode versions.`
    ],

    subtopic_values: [
      "function_notation", "reading_graphs", "function_test",
      "domain", "piecewise", "even_odd"
    ],
    function_type_values: [
      "polynomial", "rational", "radical", "abs_value",
      "piecewise", "exponential_log", "trig"
    ],
    primary_task_values: [
      "evaluate_function_at_point", "read_graph_features", "compare_two_graphs",
      "function_test_equation", "vertical_line_test_graph",
      "domain_from_formula", "evaluate_piecewise",
      "classify_even_odd_formula", "classify_even_odd_graph"
    ]
  }
};
