// lib/templates/calc1_2_2.js
//
// Calculus 1 §2.2 "The Limit of a Function" generation template.
//
// Structure mirrors calc1_1_3.js exactly (metadata + fields[] +
// section_specific_rules with the 3 required *_values enums). What is special to
// §2.2 is the `question_style` router: the "graph_reading" style emits a declared
// limitSpec (which routes through applyLimitSpec → spec compiled to a graph +
// answer DERIVED by deriveLimits), while the three symbolic styles generate
// normally (no limitSpec → applyLimitSpec is a no-op and the model's own
// answer/explanation stand).
//
// This is where Stage A's emission contract (LIMIT_SPEC_CONTRACT) finally gets
// wired into a real prompt — via the graph_reading conditional_quality_block.

import { LIMIT_SPEC_CONTRACT } from "./_generic/limitSpecContract.js";

export const calc1_2_2_template = {
  id: "calc1_2_2",
  version: 1,
  course: "Calculus 1",
  section: "2.2",
  sectionTitle: "The Limit of a Function",
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
      id: "question_style",
      label: "Question style",
      type: "single_select",
      default: "graph_reading",
      options: [
        { value: "graph_reading", label: "Read limits / f(a) / asymptotes off a given graph" },
        { value: "piecewise_existence", label: "Given a piecewise function, find values a where the limit exists" },
        { value: "infinite_limit", label: "Determine an infinite limit (e.g. lim x→5+ (x+1)/(x-5))" },
        { value: "find_va", label: "Find the vertical asymptote(s) of a rational function" }
      ]
    },
    {
      id: "primary_focus",
      label: "Primary focus",
      type: "single_select",
      default: "mix",
      options: [
        { value: "mix", label: "A mix across the section (recommended)" },
        { value: "two_sided_limit", label: "Two-sided limit at a point" },
        { value: "one_sided_limits", label: "One-sided limits (left / right)" },
        { value: "limit_existence", label: "Existence of the limit (DNE cases)" },
        { value: "function_value", label: "Function value f(a) vs the limit" },
        { value: "infinite_limits", label: "Infinite limits" },
        { value: "vertical_asymptotes", label: "Vertical asymptotes" }
      ]
    },
    {
      id: "representation_forms",
      label: "Representation forms to include",
      type: "multi_select",
      default: ["graphical", "algebraic"],
      minSelections: 1,
      options: [
        { value: "graphical", label: "Graphical (graph given)" },
        { value: "algebraic", label: "Algebraic (formula given)" },
        { value: "numerical", label: "Numerical (table of values)" },
        { value: "verbal", label: "Verbal (word description)" }
      ]
    },
    {
      id: "function_types",
      label: "Function types to feature",
      type: "multi_select",
      default: ["rational", "piecewise"],
      minSelections: 1,
      options: [
        { value: "rational", label: "Rational" },
        { value: "polynomial", label: "Polynomial" },
        { value: "root", label: "Root (square / cube root)" },
        { value: "exponential", label: "Exponential" },
        { value: "log", label: "Logarithmic" },
        { value: "trig", label: "Trigonometric" },
        { value: "piecewise", label: "Piecewise" }
      ]
    },
    {
      id: "domain_complexity",
      label: "Domain complexity",
      type: "single_select",
      default: "moderate",
      options: [
        { value: "trivial", label: "Trivial (single clean breakpoint / one asymptote)" },
        { value: "moderate", label: "Moderate (jump or removable discontinuity, one asymptote)" },
        { value: "advanced", label: "Advanced (multiple discontinuities, multiple asymptotes)" },
        { value: "mix", label: "Mix across questions" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select",
      default: ["read_limit_from_graph", "read_function_value"],
      minSelections: 1,
      options: [
        { value: "read_limit_from_graph", label: "Read a two-sided limit from a graph" },
        { value: "read_one_sided_limit", label: "Read a one-sided limit from a graph" },
        { value: "read_function_value", label: "Read f(a) and compare it to the limit" },
        { value: "find_limit_existence_values", label: "Find the values a where the limit exists (piecewise)" },
        { value: "determine_infinite_limit", label: "Determine an infinite limit symbolically" },
        { value: "find_vertical_asymptote", label: "Find vertical asymptote(s) of a rational function" }
      ]
    },
    {
      id: "graphs_option",
      label: "Include graphs?",
      type: "single_select",
      default: "many",
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
      default: "free_response",
      options: [
        { value: "free_response", label: "Free Response" },
        { value: "multiple_choice", label: "Multiple Choice" },
        { value: "mix", label: "Mix of both" }
      ]
    },
    {
      id: "free_text",
      label: "Additional instructions (optional)",
      type: "free_text",
      default: "",
      placeholder: "e.g., Use a graph with a removable hole at x=2 and a jump at x=3. Include one vertical-asymptote question."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    // graph_reading tasks carry the (limitSpec-driven) graph; the symbolic tasks
    // are purely algebraic and must NOT attach a graph.
    graph_eligible_tasks: [
      "read_limit_from_graph",
      "read_one_sided_limit",
      "read_function_value"
    ],

    reference_examples: [
      {
        stem: "For the function f whose graph is given, state the value of each quantity, if it exists. If it does not exist, explain why. (a) lim x→1 f(x)  (b) lim x→3^- f(x)  (c) lim x→3^+ f(x)  (d) lim x→3 f(x)  (e) f(3)",
        answer: "(a) 2  (b) 1  (c) 4  (d) does not exist (DNE)  (e) 3",
        explanation: "Read each value off the graph. (a) The curve approaches 2 from both sides of x=1, so the two-sided limit is 2. (b) Approaching x=3 from the left, the curve heads to 1. (c) From the right it heads to 4. (d) Since the left-hand limit (1) and right-hand limit (4) differ, lim x→3 f(x) does not exist (DNE) — a jump discontinuity. (e) The filled dot at x=3 sits at height 3, so f(3)=3, which need not equal either one-sided limit."
      },
      {
        stem: "For the function f whose graph is given, state the equations of the vertical asymptotes.",
        answer: "x = -3 and x = 2",
        explanation: "A vertical asymptote occurs at each x where the graph shoots to +infinity or -infinity. Here the curve blows up at x=-3 and x=2, so the vertical asymptotes are the lines x=-3 and x=2. State asymptotes as equations of vertical lines, not as points."
      },
      {
        stem: "Determine the infinite limit: lim x→5^+ (x + 1)/(x - 5).",
        answer: "infinity",
        explanation: "As x→5^+, the numerator x+1 → 6 (positive) and the denominator x-5 → 0 through positive values. A fixed positive number divided by a positive quantity shrinking to 0 grows without bound, so the limit is infinity. (From the left, x-5→0^- would give -infinity.)"
      },
      {
        stem: "Find the vertical asymptote(s) of the function f(x) = (x - 1)/(2x + 4).",
        answer: "x = -2",
        explanation: "Vertical asymptotes of a rational function occur where the denominator is 0 but the numerator is not. Solve 2x+4=0 → x=-2. The numerator x-1 = -3 at x=-2 (nonzero), so x=-2 is a genuine vertical asymptote (not a removable hole)."
      },
      {
        stem: "The function f is defined by f(x) = e^x for x < 0, f(x) = x - 1 for 0 <= x <= 1, and f(x) = ln(x) for x > 1. Determine the values of a for which lim x→a f(x) exists.",
        answer: "All a except a = 0; the limit exists for every a > 0 and every a < 0, but not at a = 0.",
        explanation: "Within each piece the function is continuous, so the only points in question are the breakpoints x=0 and x=1. At x=0: left limit = e^0 = 1, right limit = 0-1 = -1; they differ, so the limit does NOT exist at a=0. At x=1: left limit = 1-1 = 0, right limit = ln(1) = 0; they agree, so the limit exists at a=1. Hence lim x→a f(x) exists for all a ≠ 0."
      }
    ],

    conditional_quality_blocks: [
      {
        // ── ROUTING: graph_reading → emit a limitSpec, DO NOT state the answer ──
        condition: { field: "question_style", equals: "graph_reading" },
        content: `
§2.2 GRAPH-READING STYLE — EMIT A LIMIT SPEC, DO NOT STATE THE ANSWER:
For this question_style you MUST output a declared "limitSpec" plus an "asks" array (schema below) and you MUST NOT compute or assert the limit/f(a)/asymptotes yourself. Leave "answer" and "explanation" as best-effort placeholders only — the system DERIVES the authoritative answer key from your limitSpec and will REJECT the question if the spec is malformed or (for Multiple Choice) if the derived value is not among your choices.

How to build the spec — DECLARE every discontinuity structurally (do not rely on an fn to "produce" one):
- Removable hole at (a, h): add a holes[] entry { "x": a, "y": h }. The system never samples an fn at the hole, so a raw rational like (x^2-4)/(x-2) with a declared hole at x=2 is fine.
- Jump at x=a: use two adjacent segments meeting at a (e.g. one ending at a with "openRight": true, the next starting at a), and add a points[] entry for the FILLED value f(a).
- Infinite behavior at x=a: add a verticalAsymptotes[] entry { "x": a, "leftSign": "...", "rightSign": "..." } with each sign "+inf" or "-inf". Do NOT fake it with an fn like 1/(x-a).
- Every segment must be CONTINUOUS on its own (from, to) interval; openLeft/openRight mark open (excluded) endpoints.
Build the "asks" array in the SAME ORDER the question's parts are asked (e.g. lim x→a, then lim x→a^-, then f(a)).

${LIMIT_SPEC_CONTRACT}
`
      },
      {
        // ── ROUTING: piecewise_existence → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "piecewise_existence" },
        content: `
§2.2 PIECEWISE-EXISTENCE STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. Present a 2-3 branch piecewise function defined by formulas (Stewart style: e^x / x-1 / ln(x)) and ask "Determine the values of a for which lim x→a f(x) exists." Compute the answer yourself and give the full worked explanation.
Method to show: within each piece the function is continuous, so only the BREAKPOINTS matter; at each breakpoint compute the left-hand and right-hand limits and check whether they agree. The two-sided limit exists exactly where they agree.
Notation: write limits as "lim x→a f(x)", one-sided as "lim x→a^- f(x)" / "lim x→a^+ f(x)"; write "does not exist (DNE)" when the one-sided limits differ.
DISTRACTORS (for Multiple Choice): the most attractive wrong answer omits a breakpoint where the limit actually fails (or claims failure at a breakpoint where the one-sided limits actually agree). Include a choice that confuses "limit exists" with "function is continuous / defined".
`
      },
      {
        // ── ROUTING: infinite_limit → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "infinite_limit" },
        content: `
§2.2 INFINITE-LIMIT STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. Ask "Determine the infinite limit" for a one-sided limit of a rational expression whose denominator → 0, e.g. lim x→5^+ (x+1)/(x-5). Compute the answer yourself.
Method to show: evaluate the SIGN of the numerator near a and the SIGN the denominator approaches 0 through (0^+ vs 0^-) for the given side; a fixed nonzero numerator over a quantity shrinking to 0 gives "infinity" or "-infinity" per the sign rule.
Answer values: report "infinity" or "-infinity" in mini-syntax (never the ∞ glyph). If the question's side makes the answer two-sided and the signs disagree, say "does not exist (DNE)".
DISTRACTORS (for Multiple Choice): the strongest distractor flips the sign (writes infinity instead of -infinity) by mishandling the one-sided approach 0^+ vs 0^-. Include a "0" distractor (student divides numerator limit by denominator limit naively) and a finite-number distractor.
`
      },
      {
        // ── ROUTING: find_va → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "find_va" },
        content: `
§2.2 FIND-VERTICAL-ASYMPTOTE STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. Ask "Find the vertical asymptote(s) of the function f(x) = ..." for a rational function, e.g. f(x) = (x-1)/(2x+4). Compute the answer yourself.
Method to show: set the denominator equal to 0 and solve; a root of the denominator is a vertical asymptote ONLY if the numerator is nonzero there (otherwise it is a removable hole — check this explicitly). State each asymptote as an equation of a vertical line, "x = a".
DISTRACTORS (for Multiple Choice): include a choice that reports a denominator root which is actually a removable hole (numerator also 0 there); a choice that solves the NUMERATOR = 0 (confusing zeros with asymptotes); and a sign-error root.
`
      }
    ],

    notation_additions: [
      `LIMIT NOTATION: write a limit as "lim x→a f(x)" — use the arrow "→", never "->" or words. Name the point explicitly (a is a number).`,
      `ONE-SIDED LIMITS: write the left-hand limit as "lim x→a^- f(x)" and the right-hand limit as "lim x→a^+ f(x)" — the caret superscripts ^- and ^+ are required; never "a-" or "a+" without the caret.`,
      `INFINITE LIMITS: write infinite results as the mini-syntax text "infinity" and "-infinity" — NEVER the unicode ∞ glyph. (The renderer converts "infinity" to the symbol at display time.)`,
      `NONEXISTENCE: when a limit fails to exist, write "does not exist (DNE)" and, for graph/piecewise cases, state WHY (e.g. left and right limits differ, or unbounded behavior).`,
      `VERTICAL ASYMPTOTES: state each as an equation of a vertical line, "x = a" — never as a point (a, _) and never as just the number a.`,
      `Do NOT use unicode symbols anywhere. Write <= >= != and "infinity" — never the unicode versions.`
    ],

    distractor_additions: [
      "Confusing the value of the limit lim x→a f(x) with the function value f(a) (they can differ at a removable or jump discontinuity)",
      "Reporting that a two-sided limit exists when the one-sided limits differ (jump discontinuity)",
      "Sign error on a one-sided infinite limit (infinity vs -infinity) from mishandling 0^+ vs 0^-",
      "Calling a removable hole a vertical asymptote (numerator and denominator both zero there)",
      "Stating a vertical asymptote as a point or a bare number instead of the line x = a"
    ],

    subtopic_values: [
      "two_sided_limit", "one_sided_limits", "limit_existence",
      "function_value", "infinite_limit", "vertical_asymptote",
      "piecewise_limit"
    ],
    function_type_values: [
      "rational", "polynomial", "root", "exponential",
      "logarithmic", "trigonometric", "piecewise"
    ],
    primary_task_values: [
      "read_limit_from_graph", "read_one_sided_limit", "read_function_value",
      "find_limit_existence_values", "determine_infinite_limit",
      "find_vertical_asymptote"
    ]
  }
};
