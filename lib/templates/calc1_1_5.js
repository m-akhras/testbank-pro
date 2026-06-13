export const calc1_1_5_template = {
  id: "calc1_1_5",
  version: 1,
  course: "Calculus 1",
  section: "1.5",
  sectionTitle: "Inverse Functions and Logarithms",
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
        { value: "inverse_functions", label: "Inverse functions: one-to-one, finding f-inverse (Stewart Ex 23-36)" },
        { value: "logarithms_evaluate", label: "Evaluating logarithms and log/exp identities (Stewart Ex 39-42)" },
        { value: "log_laws", label: "Laws of logarithms: expand and combine (Stewart Ex 43-46)" },
        { value: "log_graphs_equations", label: "Graphs of log functions and solving log/exp equations (Stewart Ex 53-63)" },
        { value: "inverse_trig", label: "Inverse trigonometric functions (Stewart Ex 69-81)" }
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
      default: ["logarithmic", "exponential", "radical_polynomial", "inverse_trig"],
      minSelections: 1,
      options: [
        { value: "logarithmic", label: "Logarithmic (log_b, ln)" },
        { value: "exponential", label: "Exponential (b^x, e^x) — as inverses of logs" },
        { value: "radical_polynomial", label: "Radical / polynomial (for inverse-finding, e.g. sqrt(x+1), x^2 with restricted domain)" },
        { value: "rational", label: "Rational (for inverse-finding, e.g. (6-3x)/(5x+7))" },
        { value: "inverse_trig", label: "Inverse trigonometric (arcsin, arccos, arctan, etc.)" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select_with_counts",
      default: [
        { value: "evaluate_log_exact", count: 1, difficulty: "medium" },
        { value: "find_inverse_formula", count: 1, difficulty: "medium" },
        { value: "expand_log_expression", count: 1, difficulty: "medium" },
        { value: "solve_log_exp_equation", count: 1, difficulty: "medium" },
        { value: "inverse_trig_exact", count: 1, difficulty: "medium" }
      ],
      minSelections: 1,
      options: [
        { value: "one_to_one_test", label: "Is the function one-to-one? (horizontal line test — §1.5 intro)" },
        { value: "find_inverse_formula", label: "Find a formula for the inverse function (Stewart Ex 23-30)" },
        { value: "inverse_from_graph", label: "Sketch / identify the inverse from a graph (Stewart Ex 31-34)" },
        { value: "evaluate_log_exact", label: "Evaluate a logarithm or log/exp identity exactly (Stewart Ex 39-42)" },
        { value: "expand_log_expression", label: "Expand using the Laws of Logarithms (Stewart Ex 43-44)" },
        { value: "combine_to_single_log", label: "Combine into a single logarithm (Stewart Ex 45-46)" },
        { value: "change_of_base", label: "Evaluate using the change-of-base formula (Stewart Ex 47-48)" },
        { value: "graph_log_function", label: "Graph / state domain, range, intercept of a log function (Stewart Ex 53-56)" },
        { value: "solve_log_exp_equation", label: "Solve a logarithmic or exponential equation (Stewart Ex 57-60)" },
        { value: "domain_with_log", label: "Find the domain of a function involving a logarithm (Stewart Ex 63)" },
        { value: "inverse_trig_exact", label: "Find the exact value of an inverse-trig expression (Stewart Ex 69-74)" },
        { value: "inverse_trig_composition", label: "Simplify / evaluate an inverse-trig composition (Stewart Ex 75-78)" }
      ]
    },
    {
      id: "log_base_policy",
      label: "Which logarithm bases to feature",
      type: "multi_select",
      default: ["natural_ln", "common_and_integer"],
      minSelections: 1,
      options: [
        { value: "natural_ln", label: "Natural log ln (base e)" },
        { value: "common_and_integer", label: "Common log (base 10) and small integer bases (2, 3, 5)" },
        { value: "arbitrary_base", label: "Arbitrary base log_b (for change-of-base problems)" }
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
      placeholder: "e.g., Focus on natural log. Avoid inverse trig. Include at least one solve-the-equation problem requiring change of base."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    graph_eligible_tasks: [
      "one_to_one_test",
      "inverse_from_graph",
      "graph_log_function"
    ],

    // Reference examples populated in v2 (round 2). v1 runs without them; the
    // generic prompt-builder handles the empty array gracefully.
    reference_examples: [],

    conditional_quality_blocks: [
      {
        condition: { field: "student_tasks", includes: "evaluate_log_exact" },
        content: `
DIFFICULTY RUBRIC for §1.5 (Inverse Functions and Logarithms):
The STUDENT TASKS block above tells you, per-task, how many questions to generate at Easy / Medium / Hard. This block defines what those labels MEAN for each §1.5 task. Pick the appropriate complexity per question to honor the requested distribution. Set the per-question "difficulty" field in your output to "Easy", "Medium", or "Hard" matching the level you actually wrote at.

one_to_one_test (horizontal line test):
- Easy: a clearly monotonic function (line, cube, exponential) — yes, one-to-one
- Medium: a function that fails (parabola, |x|, sin over a full period) — identify why
- Hard: a function that is one-to-one only on a restricted domain, or a piecewise that passes/fails subtly

find_inverse_formula (Stewart Ex 23-30):
- Easy: linear or simple radical — f(x) = 2*x + 3, or f(x) = sqrt(x) + 1
- Medium: rational or radical with shift — f(x) = (6 - 3*x)/(5*x + 7), or g(x) = 2 + sqrt(x + 1)
- Hard: exponential/log inverse — y = e^(1 - x), or y = 3*ln(x - 3), or y = (1 - e^(-x))/(1 + e^(-x))

inverse_from_graph (Stewart Ex 31-34):
- Easy: read one point on f-inverse from a clearly-plotted point on f (reflect across y = x)
- Medium: identify which graph is f-inverse from candidates, given graph of f
- Hard: sketch/identify f-inverse for a curve with restricted domain or asymptote behavior

evaluate_log_exact (Stewart Ex 39-42):
- Easy: direct definition — log_3(81) = 4, log_2(8) = 3, ln(e^2) = 2
- Medium: reciprocal or root arguments — log_3(1/81), ln(sqrt(e)), log_5(1/25)
- Hard: nested or log/exp identity — ln(ln(e^(e^10))), e^(3*ln(2)), e^(ln(ln(e^3)))

expand_log_expression (Stewart Ex 43-44):
- Easy: single product or quotient — log(x*y), log(x/y)
- Medium: powers and roots combined — log_10(x^2 * y^3 * z), ln(sqrt(3*x/(x-3)))
- Hard: nested radicals and quotients — ln(x^4/sqrt(x^2 - 4)), log_2((x^3+1)*((x-3)^2)^(1/5))

combine_to_single_log (Stewart Ex 45-46):
- Easy: two terms — ln(a) + ln(b), log(x) - log(y)
- Medium: coefficient + subtraction — log_10(20) - (1/3)*log_10(1000), ln(a) - 2*ln(b) + 3*ln(c)
- Hard: multiple terms with factoring — 3*ln(x-2) - ln(x^2 - 5*x + 6) + 2*ln(x-3)

change_of_base (Stewart Ex 47-48):
- Easy: set up the change-of-base formula correctly for log_5(10) = ln(10)/ln(5)
- Medium: evaluate to a decimal — log_5(10) ≈ 1.430677
- Hard: a change-of-base evaluation embedded in a larger computation or comparison

graph_log_function (Stewart Ex 53-56):
- Easy: identify domain or x-intercept of y = ln(x) or y = log_10(x + 5)
- Medium: domain/range/intercept of a shifted/reflected log — y = -ln(x), y = ln(-x), f(x) = ln(x) + 2
- Hard: full domain+range+intercept+shape for a compound transformation — f(x) = ln(x - 1) - 1, or y = ln|x|

solve_log_exp_equation (Stewart Ex 57-60):
- Easy: single log or single exp — ln(4*x + 2) = 3, e^(2*x - 3) = 12
- Medium: requires log law first — log_2(x^2 - x - 1) = 2, ln(x) + ln(x - 1) = 0
- Hard: requires change of base or rejecting extraneous roots — 5^(1 - 2*x) = 9, ln(ln(x)) = 0, 60/(1 + e^(-x)) = 4

domain_with_log (Stewart Ex 63):
- Easy: single restriction — domain of ln(x - 3) is x > 3
- Medium: argument is itself a function — domain of ln(e^x - 3) requires e^x - 3 > 0, x > ln(3)
- Hard: compound — domain of ln(x^2 - 4) (two intervals), or domain involving both log and radical

inverse_trig_exact (Stewart Ex 69-74):
- Easy: standard reference value — cos^(-1)(-1) = pi, arcsin(1) = pi/2, arctan(-1) = -pi/4
- Medium: requires range awareness — sin^(-1)(-1/sqrt(2)), arccsc(sqrt(2)), cos^(-1)(sqrt(3)/2)
- Hard: reciprocal inverse-trig or careful quadrant reasoning — sec^(-1)(2), cot^(-1)(-sqrt(3))

inverse_trig_composition (Stewart Ex 75-78):
- Easy: known identity — sin(arcsin(x)) = x for x in [-1, 1]
- Medium: build a right triangle — tan(sin^(-1)(x)), sin(tan^(-1)(x))
- Hard: double-angle or nested — sin(2*arccos(x)), arcsin(sin(5*pi/4)) (where the inside is outside the range)

NEVER label a question Hard if it would be solved in one line. NEVER label a question Easy if it requires multiple concept lookups.
`
      },

      {
        condition: { field: "student_tasks", includes: "find_inverse_formula" },
        content: `
FIND-INVERSE-FORMULA GUIDANCE (Stewart Ex 23-30):
Standard method: write y = f(x), swap x and y, solve for y. The result is f-inverse(x).

STEWART'S CANONICAL EXAMPLES:
- f(x) = 1 - x^2 for x >= 0 -> f-inverse(x) = sqrt(1 - x) (note the domain restriction makes it one-to-one)
- g(x) = 2 + sqrt(x + 1) -> g-inverse(x) = (x - 2)^2 - 1 for x >= 2
- h(x) = (6 - 3*x)/(5*x + 7) -> solve the rational
- y = e^(1 - x) -> y-inverse: x = e^(1 - y), so 1 - y = ln(x), y = 1 - ln(x)
- y = 3*ln(x - 3) -> y-inverse: x = 3*ln(y - 3), y = e^(x/3) + 3

KEY POINTS:
- Domain restrictions matter: f(x) = 1 - x^2 is only one-to-one for x >= 0, and the inverse's range reflects this.
- For exponential f, the inverse involves ln. For log f, the inverse involves e.
- The domain of f-inverse equals the range of f, and vice versa.

DISTRACTORS:
- Reciprocal confusion: students write 1/f(x) instead of f-inverse(x)
- Forget to swap: solve f(x) = something instead of swapping x and y
- Sign/operation errors when isolating y
- Drop the domain restriction (giving an inverse that isn't actually a function)
`
      },

      {
        condition: { field: "student_tasks", includes: "expand_log_expression" },
        content: `
EXPAND-LOG GUIDANCE (Stewart Ex 43-44):
Laws of Logarithms:
- log_b(M*N) = log_b(M) + log_b(N)
- log_b(M/N) = log_b(M) - log_b(N)
- log_b(M^p) = p*log_b(M)

STEWART'S CANONICAL EXAMPLES:
- log_10(x^2 * y^3 * z) = 2*log_10(x) + 3*log_10(y) + log_10(z)
- ln(x^4/sqrt(x^2 - 4)) = 4*ln(x) - (1/2)*ln(x^2 - 4)
- ln(sqrt(3*x/(x-3))) = (1/2)*(ln(3) + ln(x) - ln(x - 3))

KEY POINTS:
- A root is a fractional power: sqrt(M) = M^(1/2), so log_b(sqrt(M)) = (1/2)*log_b(M).
- A quotient inside becomes subtraction; do NOT distribute log over the subtraction inside an argument: log(M - N) is NOT log(M) - log(N).
- log_b(M^p) — the exponent comes out front as a multiplier.

DISTRACTORS:
- log(M + N) = log(M) + log(N) — FALSE, a classic error. log of a sum does not expand.
- Forget the coefficient from a root: write ln(x^2 - 4) instead of (1/2)*ln(x^2 - 4)
- Sign error on the quotient (addition instead of subtraction)
- Distribute a power incorrectly: log(x^2 * y^3) -> 2*3*log(xy) (wrong)
`
      },

      {
        condition: { field: "student_tasks", includes: "combine_to_single_log" },
        content: `
COMBINE-TO-SINGLE-LOG GUIDANCE (Stewart Ex 45-46):
Reverse of expansion. Coefficients become exponents, sums become products, differences become quotients.

STEWART'S CANONICAL EXAMPLES:
- log_10(20) - (1/3)*log_10(1000) = log_10(20) - log_10(1000^(1/3)) = log_10(20) - log_10(10) = log_10(2)
- ln(a) - 2*ln(b) + 3*ln(c) = ln(a*c^3/b^2)
- 3*ln(x-2) - ln(x^2 - 5*x + 6) + 2*ln(x-3) = ln((x-2)^3 * (x-3)^2 / (x^2 - 5*x + 6))
  Note: x^2 - 5*x + 6 = (x-2)(x-3), so this simplifies further to ln((x-2)^2 * (x-3)).

KEY POINTS:
- A coefficient in front of a log becomes an exponent on the argument: p*log_b(M) = log_b(M^p).
- Move coefficients to exponents BEFORE combining.
- Watch for factoring opportunities that simplify the final single log.

DISTRACTORS:
- Coefficient becomes a multiplier instead of an exponent: 3*ln(x) -> ln(3*x) (wrong; should be ln(x^3))
- Sign error: subtraction becomes a product instead of quotient
- Miss the factoring simplification (acceptable as a weaker distractor)
`
      },

      {
        condition: { field: "student_tasks", includes: "solve_log_exp_equation" },
        content: `
SOLVE-LOG/EXP-EQUATION GUIDANCE (Stewart Ex 57-60):
Method depends on form:
- Single log = constant: ln(4*x + 2) = 3 -> 4*x + 2 = e^3 -> x = (e^3 - 2)/4
- Single exp = constant: e^(2*x - 3) = 12 -> 2*x - 3 = ln(12) -> x = (ln(12) + 3)/2
- Log law first: ln(x) + ln(x - 1) = 0 -> ln(x*(x-1)) = 0 -> x*(x-1) = 1 -> solve quadratic, REJECT negative root
- Exp with non-e base: 5^(1 - 2*x) = 9 -> (1 - 2*x)*ln(5) = ln(9) -> solve for x

KEY POINTS:
- Convert between log and exp form using the definition: log_b(a) = c iff b^c = a.
- After applying a log law and solving, CHECK for extraneous solutions — log arguments must be positive.
- Give both an exact value (in terms of e, ln) and a decimal approximation when the problem asks.

DISTRACTORS:
- Forget to reject an extraneous root (e.g. ln(x) + ln(x-1) = 0 gives a negative root that must be discarded)
- Apply log law incorrectly: ln(x) + ln(x-1) = ln(x) * ln(x-1) (wrong)
- Sign error converting between log and exp form
- Forget to divide/multiply through by ln(base) for non-e exponentials
`
      },

      {
        condition: { field: "student_tasks", includes: "inverse_trig_exact" },
        content: `
INVERSE-TRIG EXACT-VALUE GUIDANCE (Stewart Ex 69-74):
The inverse trig functions return angles in specific RANGES (principal values):
- arcsin (sin^(-1)): range [-pi/2, pi/2]
- arccos (cos^(-1)): range [0, pi]
- arctan (tan^(-1)): range (-pi/2, pi/2)
- arccsc (csc^(-1)): range [-pi/2, 0) U (0, pi/2]
- arcsec (sec^(-1)): range [0, pi/2) U (pi/2, pi]
- arccot (cot^(-1)): range (0, pi)

STEWART'S CANONICAL EXAMPLES:
- cos^(-1)(-1) = pi
- arcsin(1) = pi/2
- arctan(-1) = -pi/4
- sin^(-1)(-1/sqrt(2)) = -pi/4
- csc^(-1)(sqrt(2)) = pi/4
- sec^(-1)(2) = pi/3
- cot^(-1)(-sqrt(3)) = 5*pi/6

KEY POINTS:
- The answer MUST lie in the function's principal range. This is the #1 source of error.
- For negative arguments of arcsin/arctan, the answer is negative (in the lower half of the range).
- For negative arguments of arccos, the answer is in (pi/2, pi] — still positive.

DISTRACTORS:
- Answer outside the principal range (e.g. arcsin(-1/sqrt2) = 7*pi/4 instead of -pi/4) — the most common error
- Sign error (arctan(-1) = pi/4 instead of -pi/4)
- Confuse the range of arccos with arcsin
- Reciprocal confusion (treat sec^(-1) as 1/cos^(-1))
`
      },

      {
        condition: { field: "student_tasks", includes: "inverse_trig_composition" },
        content: `
INVERSE-TRIG COMPOSITION GUIDANCE (Stewart Ex 75-78):
Two main cases:
1. trig(arctrig(x)) where they match: sin(arcsin(x)) = x (for x in domain), cos(arccos(x)) = x.
2. trig(arctrig(x)) where they DON'T match: build a right triangle.
   - tan(sin^(-1)(x)): let theta = sin^(-1)(x), so sin(theta) = x = x/1. Opposite = x, hypotenuse = 1, adjacent = sqrt(1 - x^2). Then tan(theta) = x/sqrt(1 - x^2).
   - cos(sin^(-1)(x)) = sqrt(1 - x^2)
   - sin(tan^(-1)(x)) = x/sqrt(1 + x^2)

STEWART'S CANONICAL EXAMPLES:
- cos(sin^(-1)(x)) = sqrt(1 - x^2) (Stewart Ex 75, a "prove that" problem)
- tan(sin^(-1)(x)) = x/sqrt(1 - x^2)
- sin(tan^(-1)(x)) = x/sqrt(1 + x^2)
- sin(2*arccos(x)) = 2*x*sqrt(1 - x^2) (uses double-angle: sin(2u) = 2 sin(u) cos(u))
- arcsin(sin(5*pi/4)) = -pi/4 (the inside angle 5pi/4 is OUTSIDE arcsin's range, so the answer is the co-terminal/reference angle within [-pi/2, pi/2])

KEY POINTS:
- The right-triangle method: set the inner inverse-trig equal to an angle, label the triangle, read off the outer trig.
- For nested same-function compositions like arcsin(sin(t)): the answer is t ONLY if t is in the principal range; otherwise find the equivalent angle in range.
- Double-angle and other identities may be needed for arguments like sin(2*arccos(x)).

DISTRACTORS:
- Claim sin(arcsin(x)) composition simplifies to x when it's actually the mismatched case
- Wrong triangle side (use sqrt(1 + x^2) when it should be sqrt(1 - x^2))
- For arcsin(sin(5pi/4)): answer 5*pi/4 (forgetting the range restriction)
- Sign error in the double-angle expansion
`
      }
    ],

    notation_additions: [
      `LOGARITHM NOTATION: write log_b(x) for log base b, ln(x) for natural log (base e), log(x) or log_10(x) for common log (base 10). Always put the argument in parentheses: ln(x), not ln x. Subscript the base with underscore: log_2(8), log_5(10).`,
      `LOG LAWS: log_b(M*N) = log_b(M) + log_b(N); log_b(M/N) = log_b(M) - log_b(N); log_b(M^p) = p*log_b(M). The log of a SUM does NOT expand: log_b(M + N) has no simpler form.`,
      `CHANGE OF BASE (Stewart Formula 11): log_b(x) = ln(x)/ln(b) = log_10(x)/log_10(b). Write it with explicit division.`,
      `LOG/EXP INVERSE RELATIONSHIP: ln(e^x) = x for all x; e^(ln(x)) = x for x > 0. log_b(b^x) = x; b^(log_b(x)) = x for x > 0.`,
      `INVERSE FUNCTION NOTATION: write the inverse of f as f-inverse(x) in prose, or "f^(-1)(x)" using the caret-superscript form. Do NOT confuse f^(-1)(x) with 1/f(x) — they are different. State explicitly in explanations: "f^(-1) denotes the inverse function, NOT the reciprocal."`,
      `INVERSE TRIG NOTATION: write arcsin(x), arccos(x), arctan(x) OR sin^(-1)(x), cos^(-1)(x), tan^(-1)(x). Both forms are acceptable; be consistent within a question. For reciprocal inverse trig: arccsc, arcsec, arccot (or csc^(-1), sec^(-1), cot^(-1)).`,
      `PRINCIPAL RANGES of inverse trig (state in explanations when relevant): arcsin in [-pi/2, pi/2]; arccos in [0, pi]; arctan in (-pi/2, pi/2). Answers to exact-value problems MUST lie in these ranges.`,
      `EXACT VALUES: write angle answers in terms of pi, e.g. pi/2, -pi/4, 5*pi/6, 2*pi/3. Use "pi" as ASCII text, never the unicode glyph. For decimal approximations (change-of-base problems), give 6 decimal places when the problem asks.`,
      `THE NUMBER e and EXPONENTIALS: write e^x, e^(2*x), e^(-x). For solving equations, isolate the exponential then take ln of both sides.`,
      `DOMAIN OF A LOG: log_b(g(x)) is defined only where g(x) > 0. State the inequality explicitly in explanations: "ln(x - 3) requires x - 3 > 0, so x > 3, domain (3, infinity)."`,
      `INTERVAL NOTATION for domain/range: use parentheses for open, brackets for closed, "U" for union, "infinity" as ASCII text. Example: (3, infinity), (-infinity, -2) U (2, infinity).`,
      `LABEL CONVENTION FOR GRAPHS: when including a graph, the fnLabel MUST be a short identifier — "y", "f(x)", "g(x)" — never the full equation. For inverse-function graphs that show f and f-inverse on the same axes, use overlay with labels "f" and "f^(-1)" (short), and optionally the line y = x dashed.`,
      `Do NOT use unicode symbols anywhere. Write <= >= != "infinity" "pi" — never the unicode versions.`,
      `LOG GRAPH RENDERING: the graph renderer's "log" is base-10 and "ln" is natural log (same convention as display/answers — see LOGARITHM NOTATION above). For y = ln(x) write fn: "ln(x)". For y = log_10(x) write fn: "log(x)" (or "log10(x)"). For any other base b, write fn: "log(x)/log(b)" (change-of-base — the base cancels, so this renders log_b(x) correctly under any log convention). Examples: y = ln(x) -> fn: "ln(x)"; y = log_10(x) -> fn: "log(x)"; y = log_3(x) -> fn: "log(x)/log(3)". NEVER write fn: "log(x)" to mean ln(x) — "log" is base-10. NEVER render y = log_b(x) as isolated points or a discrete sequence — it is always a continuous curve. Domain x > 0 is handled by the xDomain rule.`
    ],

    subtopic_values: [
      "inverse_functions", "logarithms_evaluate", "log_laws",
      "log_graphs_equations", "inverse_trig"
    ],
    function_type_values: [
      "logarithmic", "exponential", "radical_polynomial",
      "rational", "inverse_trig"
    ],
    primary_task_values: [
      "one_to_one_test", "find_inverse_formula", "inverse_from_graph",
      "evaluate_log_exact", "expand_log_expression", "combine_to_single_log",
      "change_of_base", "graph_log_function", "solve_log_exp_equation",
      "domain_with_log", "inverse_trig_exact", "inverse_trig_composition"
    ]
  }
};
