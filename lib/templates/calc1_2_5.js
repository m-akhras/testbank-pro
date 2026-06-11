// lib/templates/calc1_2_5.js
//
// Calculus 1 §2.5 "Continuity" generation template.
//
// Structure mirrors calc1_2_2.js (metadata + fields[] + section_specific_rules
// with the 3 required *_values enums). The `question_style` router selects a
// style (or "mixed", the default, which lets the model pick per question). ONE
// style — "graph_continuity" — emits a declared limitSpec plus CONTINUITY asks
// (isContinuous point asks, and the discontinuitySet / removableSet / limitDNESet
// global asks), routed through applyLimitSpec → the SAME §2.2 engine + guards
// (phantom-VA, interior-pole) and the system-derived answer key. The other styles
// are symbolic (no limitSpec → applyLimitSpec no-ops; the model computes the
// answer).

import { LIMIT_SPEC_CONTRACT } from "./_generic/limitSpecContract.js";

// Per-style instruction blocks, defined once and reused by both the explicit
// single-style routing AND the "mixed" block (so the two never drift).
const GRAPH_CONTINUITY_BLOCK = `
§2.5 GRAPH-CONTINUITY STYLE — EMIT A LIMIT SPEC + CONTINUITY ASKS, DO NOT STATE THE ANSWER:
FUNCTION LETTER (MANDATORY): the function MUST be called f. Write "f" and "f(x)" everywhere in the question text — NEVER h, g, y, or any other letter. The graph is labeled f and the derived statements say "f", so any other letter (e.g. "the function h", "h(x)") contradicts the graph and is REJECTED.
For this question_style you MUST output a declared "limitSpec" plus an "asks" array and you MUST NOT decide what is correct yourself. The system DERIVES the authoritative answer key from your limitSpec and will REJECT a malformed spec.

CONTINUITY ASKS to use (see the contract below for the full list):
- POINT asks: "isContinuous" (at a) → continuous/discontinuous. For Multiple Choice POINT asks, author normal choices that INCLUDE the derived value (continuous / discontinuous).
- GLOBAL asks (use as the SOLE ask of the question): "discontinuitySet" (where f is discontinuous), "removableSet" (limit exists but f not continuous), "limitDNESet" (where the two-sided limit does not exist = jumps + infinite). For Multiple Choice GLOBAL asks, supply DISTRACTORS ONLY — plausible but WRONG statements; the SYSTEM composes the correct statement from the derived set and injects it as the answer key (you CANNOT set the correct answer). Provide at least 2 distractor choices.

DECLARE every discontinuity structurally (do not rely on an fn to "produce" one):
- Removable hole at (a, h): a holes[] entry { "x": a, "y": h } (open circle; limit exists, f(a) missing). A redefined value uses a points[] entry.
- Jump at x=a: two adjacent segments meeting at a (one ending at a with "openRight": true, the next starting at a) + a points[] entry for f(a).
- Infinite at x=a: a verticalAsymptotes[] entry { "x": a, "leftSign": "...", "rightSign": "..." } (signs "+inf"/"-inf"). Do NOT fake it with an fn like 1/(x-a).
- A CONTINUOUS join (two segments meeting at the same value, f(a) equal) is NOT a discontinuity and must not be marked — it will correctly be absent from every derived set.
- Every segment must be CONTINUOUS on its own (from, to) interval.

VERTICAL ASYMPTOTES — DECLARE ONLY WHERE THE FUNCTION ACTUALLY DIVERGES:
- Declare a vertical asymptote at x=a ONLY where a segment expression actually diverges to +infinity or -infinity (a RATIONAL whose denominator is zero, numerator nonzero, at a). Polynomials, roots, exponentials, and in-domain logarithms have NONE.
- A declared VA MUST be consistent with the segments: the segment covering/bordering a must genuinely blow up there. The validator REJECTS a VA where the segment is finite, and REJECTS a pole declared strictly inside a segment's interior.
- The NUMBER of vertical asymptotes allowed is governed by the "VERTICAL ASYMPTOTE COUNT" rule below; the divergence-consistency rule here is about VALIDITY and always applies.

${LIMIT_SPEC_CONTRACT}
`;

const FIND_CONSTANT_BLOCK = `
§2.5 FIND-CONSTANT STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. Present a 2-3 branch piecewise function with one or two unknown constants (Stewart style: c*x^2 + 2*x / x^3 - c*x; or a 3-branch with a and b) and ask "For what value(s) of the constant(s) is f continuous on (-infinity, infinity)?" Compute the answer yourself.
Method to show: each polynomial / standard piece is continuous on its interval, so continuity can fail ONLY at the breakpoints. At each breakpoint set the two adjacent pieces equal (match the one-sided limits / values) to get one equation per breakpoint; solve the resulting linear system for the constant(s).
DISTRACTORS (for Multiple Choice): a sign-flipped solution; the value obtained by matching the WRONG pair of pieces; a value that makes only ONE breakpoint match (forgetting the second equation in a two-constant problem).
`;

const ANALYZE_PIECEWISE_BLOCK = `
§2.5 ANALYZE-PIECEWISE STYLE — SPEC-BACKED, DO NOT STATE THE ANSWER (no graph):
FUNCTION LETTER (MANDATORY): call the function f everywhere — never h/g/y.
DISPLAY the piecewise function ALGEBRAICALLY in the question TEXT (mini-syntax), e.g.
f(x) = { (x^2 - 1)/(x - 1) if x < 1 ; 4 if x >= 1 }. There is NO graph for this style:
set "noGraph": true on the question.
You MUST ALSO emit a "limitSpec" that encodes the SAME function as the displayed
formulas, plus an "asks" array. The system DERIVES the authoritative answer key from
the spec — you MUST NOT decide correctness yourself, and you MUST NOT write an
explanation that contradicts the spec. THE SPEC IS THE ANSWER'S SOURCE OF TRUTH.

ENCODE the displayed branches into the spec (see the LIMIT SPEC contract below for the schema):
- One "segments" entry per branch; from/to match the branch interval, and
  openLeft/openRight match strict (<, >) vs inclusive (<=, >=) boundaries.
- A value defined SEPARATELY at a point (e.g. "4 if x >= 1" → f(1) = 4) is a points[]
  entry { "x": 1, "y": 4 }. A removable hole (limit exists, value missing/redefined)
  uses holes[] (+ points[] for a redefined value), exactly as in graph_continuity.
- Each segment must be continuous on its own interval; declare verticalAsymptotes[]
  only where a branch genuinely diverges.
CRITICAL — the spec MUST encode the same function as the displayed formulas. Example:
text shows f(x) = (x^2-1)/(x-1) for x < 1 and f(x) = 4 for x >= 1. Here (x^2-1)/(x-1)
→ x+1 with a removable hole at x=1 whose limit is 2, and f(1)=4. So the spec encodes
the left branch (limit 2 at x=1), the right branch, AND points[]: { "x":1, "y":4 }.
Derived truth: leftLimit = 2, rightLimit = 4, two-sided limit DNE, f discontinuous at 1.
(The live bug keyed "limit = 2 but f(1) = 4" as a JUMP excuse — the derived two-sided
limit does not exist, so the correct reason is "the limit does not exist".)

ASKS: leftLimit / rightLimit / limit / fValue / isContinuous at the boundary points.
MULTIPLE CHOICE: use ONLY plain VALUE asks — the choices are scalars or the words
"continuous" / "discontinuous" / "does not exist (DNE)", fully derived and injected by
the system. Do NOT author reason-style "explain why" MULTIPLE CHOICE; a question that
asks for the REASON/justification must be FREE RESPONSE, where the system's derived
explanation is authoritative.
`;

const MIXED_BLOCK = `
§2.5 MIXED STYLE — YOU CHOOSE EACH QUESTION'S STYLE PER QUESTION:
Generate a VARIED batch, choosing for EACH question one of the three §2.5 styles below (graph_continuity, find_constant, analyze_piecewise), guided by the instructor's selections:
- Representation forms: if "Graphical" is selected, graph_continuity questions are allowed (and encouraged). If "Graphical" is NOT selected, do NOT produce any graph question — use only the symbolic styles (find_constant / analyze_piecewise).
- Function types & focus steer which symbolic style fits (piecewise with unknown constants → find_constant; piecewise with breaks → analyze_piecewise).
- Suggested mix when graphical is available: roughly half graph_continuity and half symbolic, varied across the batch (this is guidance, not a rigid count). When graphical is not available: all symbolic.

HARD RULE: ANY question that presents a graph MUST carry the appropriate spec (limitSpec, or limitSpecF+limitSpecG+lawAsks). A graph question without a spec is INVALID and will be rejected.

Each question follows the FULL rules of the style you pick for it, reproduced here:
${GRAPH_CONTINUITY_BLOCK}
${FIND_CONSTANT_BLOCK}
${ANALYZE_PIECEWISE_BLOCK}
`;

export const calc1_2_5_template = {
  id: "calc1_2_5",
  version: 1,
  course: "Calculus 1",
  section: "2.5",
  sectionTitle: "Continuity",
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
      default: "mixed",
      options: [
        { value: "mixed", label: "Mixed — AI chooses each question's style from the options below" },
        { value: "graph_continuity", label: "From a given graph: find discontinuities / where the limit DNE / continuity at a point" },
        { value: "find_constant", label: "Find the constant(s) that make a piecewise function continuous" },
        { value: "analyze_piecewise", label: "Analyze a piecewise function: continuity on R / one-sided continuity" }
      ]
    },
    {
      id: "primary_focus",
      label: "Primary focus",
      type: "single_select",
      default: "mix",
      options: [
        { value: "mix", label: "A mix across the section (recommended)" },
        { value: "continuity_at_point", label: "Continuity at a point" },
        { value: "types_of_discontinuity", label: "Types of discontinuity (removable / jump / infinite)" },
        { value: "one_sided_continuity", label: "One-sided continuity (from the left / right)" },
        { value: "continuity_on_interval", label: "Continuity on an interval / on all reals" },
        { value: "find_constant_for_continuity", label: "Finding a constant for continuity" }
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
      id: "va_mode",
      label: "Vertical asymptotes",
      type: "single_select",
      default: "single",
      options: [
        { value: "none", label: "No vertical asymptotes (function finite everywhere)" },
        { value: "single", label: "At most one vertical asymptote" },
        { value: "multiple", label: "Allow multiple vertical asymptotes" }
      ]
    },
    {
      id: "domain_complexity",
      label: "Domain complexity",
      type: "single_select",
      default: "moderate",
      options: [
        { value: "trivial", label: "Trivial (one clean discontinuity)" },
        { value: "moderate", label: "Moderate (a removable + a jump, or one asymptote)" },
        { value: "advanced", label: "Advanced (several discontinuities of mixed kinds)" },
        { value: "mix", label: "Mix across questions" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select",
      default: ["identify_discontinuities_from_graph", "find_limit_dne_set"],
      minSelections: 1,
      options: [
        { value: "identify_discontinuities_from_graph", label: "Identify discontinuities from a graph" },
        { value: "find_limit_dne_set", label: "Find where the two-sided limit does not exist" },
        { value: "find_constant_for_continuity", label: "Find the constant(s) making a piecewise function continuous" },
        { value: "explain_discontinuity", label: "Explain why f is discontinuous at a given a" },
        { value: "analyze_piecewise_continuity", label: "Analyze a piecewise function's continuity + one-sided continuity" }
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
      placeholder: "e.g., Use a graph with a removable hole at x=1, a jump at x=2, and an infinite discontinuity at x=3."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    // graph_continuity tasks carry the (limitSpec-driven) graph; the symbolic
    // tasks are purely algebraic and must NOT attach a graph.
    graph_eligible_tasks: [
      "identify_discontinuities_from_graph",
      "find_limit_dne_set"
    ],

    reference_examples: [
      {
        stem: "For the function f whose graph is given, answer: (a) At what numbers does lim x→a f(x) NOT exist? (b) At what numbers is f NOT continuous? (c) At what numbers does the limit exist but f is not continuous there?",
        answer: "(a) the two-sided limit fails where the one-sided limits differ or the function blows up (jumps + infinite); (b) f is discontinuous at every removable, jump, and infinite point; (c) exactly the removable discontinuities (limit exists but f(a) is missing or different).",
        explanation: "(a) lim x→a f(x) fails to exist at jump discontinuities (left ≠ right) and at infinite discontinuities. (b) f is discontinuous wherever lim x→a f(x) ≠ f(a) or f(a) is undefined — i.e. all removable, jump, and infinite points. (c) The limit existing while continuity fails is the defining feature of a REMOVABLE discontinuity (the hole): lim x→a f(x) exists but f(a) is undefined or has a different value."
      },
      {
        stem: "From the given graph of g, state the numbers at which g is discontinuous and explain why.",
        answer: "g is discontinuous at each marked x; for each, name the reason (removable hole, jump, or infinite).",
        explanation: "Scan the graph for breaks. At a removable hole the curve has an open circle (and possibly a filled dot elsewhere): the limit exists but g(a) is missing/different. At a jump the left and right pieces approach different heights. At an infinite discontinuity the curve runs off to ±infinity along a vertical asymptote. State each x with its reason."
      },
      {
        stem: "For what value of the constant c is the function f continuous on (-infinity, infinity)? f(x) = c*x^2 + 2*x for x < 2, and f(x) = x^3 - c*x for x >= 2.",
        answer: "c = 2/3",
        explanation: "Each piece is a polynomial (continuous), so continuity can only fail at the breakpoint x = 2. Require the two pieces to agree there: c*(2)^2 + 2*(2) = (2)^3 - c*(2) → 4c + 4 = 8 - 2c → 6c = 4 → c = 2/3. With c = 2/3 the left and right values match, so f is continuous everywhere."
      },
      {
        stem: "Find the values of the constants a and b that make f continuous everywhere. f(x) = (x^2 - 4)/(x - 2) for x < 2, f(x) = a*x^2 - b*x + 3 for 2 <= x < 3, f(x) = 2*x - a + b for x >= 3.",
        answer: "a = 1/2, b = -1/2",
        explanation: "At x = 2 the first piece simplifies: (x^2-4)/(x-2) = x+2 → 4. Require a*4 - b*2 + 3 = 4 → 4a - 2b = 1. At x = 3 require a*9 - b*3 + 3 = 2*3 - a + b → 9a - 3b + 3 = 6 - a + b → 10a - 4b = 3. Solve: from 4a - 2b = 1, b = 2a - 1/2; substitute: 10a - 4(2a - 1/2) = 3 → 10a - 8a + 2 = 3 → 2a = 1 → a = 1/2, b = -1/2."
      },
      {
        stem: "Explain why the function f(x) = 1/(x + 2) is discontinuous at a = -2. Sketch the graph.",
        answer: "f(-2) is undefined (division by zero) and the function has an infinite discontinuity there.",
        explanation: "f(-2) = 1/0 is undefined, so the first condition of continuity (f(a) defined) fails. Moreover lim x→-2 f(x) does not exist as a finite number: as x→-2^-, f→ -infinity; as x→-2^+, f→ +infinity. So x = -2 is an infinite discontinuity (a vertical asymptote). The graph is the hyperbola 1/(x+2): branches going to ±infinity on either side of the dashed line x = -2."
      },
      {
        stem: "Explain why the piecewise function is discontinuous at a = 1. f(x) = (x^2 - 1)/(x - 1) for x != 1, and f(1) = 6.",
        answer: "The limit at 1 is 2 but f(1) = 6, so f is discontinuous (removable) at a = 1.",
        explanation: "For x != 1, (x^2-1)/(x-1) = x+1, so lim x→1 f(x) = 2. But f(1) is DEFINED as 6. Since lim x→1 f(x) = 2 ≠ 6 = f(1), the third condition of continuity fails. The limit exists, so this is a REMOVABLE discontinuity — redefining f(1) = 2 would repair it."
      },
      {
        stem: "Show that the function f is continuous on (-infinity, infinity). f(x) = 1 - x^2 for x <= 1, and f(x) = ln(x) for x > 1.",
        answer: "f is continuous everywhere.",
        explanation: "On x < 1, f = 1 - x^2 is a polynomial (continuous). On x > 1, f = ln(x) is continuous (x > 1 > 0). The only point to check is the breakpoint x = 1: left value = 1 - 1^2 = 0; right limit = lim x→1^+ ln(x) = ln(1) = 0; and f(1) = 1 - 1^2 = 0. All three agree, so f is continuous at 1 and hence on all of (-infinity, infinity)."
      },
      {
        stem: "Find the numbers at which f is discontinuous. At which of these numbers is f continuous from the right, from the left, or neither? f(x) = x + 1 for x <= 1, f(x) = 1/x for 1 < x < 3, and f(x) = sqrt(x - 3) for x >= 3.",
        answer: "Discontinuous at x = 1 (continuous from the left) and at x = 3 (continuous from the right).",
        explanation: "At x = 1: left value f(1) = 1 + 1 = 2 and lim x→1^- f(x) = 2, so f is continuous from the LEFT; but lim x→1^+ f(x) = 1/1 = 1 ≠ 2, so not from the right → discontinuous (jump), continuous from the left. At x = 3: lim x→3^- f(x) = 1/3, while f(3) = sqrt(0) = 0 and lim x→3^+ = 0, so f is continuous from the RIGHT but not the left → discontinuous (jump), continuous from the right."
      }
    ],

    conditional_quality_blocks: [
      {
        // ── ROUTING: mixed → AI picks each question's style (default) ──
        condition: { field: "question_style", equals: "mixed" },
        content: MIXED_BLOCK
      },
      {
        // ── ROUTING: graph_continuity → emit a limitSpec + CONTINUITY asks ──
        condition: { field: "question_style", equals: "graph_continuity" },
        content: GRAPH_CONTINUITY_BLOCK
      },
      {
        // ── ROUTING: find_constant → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "find_constant" },
        content: FIND_CONSTANT_BLOCK
      },
      {
        // ── ROUTING: analyze_piecewise → SPEC-BACKED (no graph); system derives ──
        // Append the contract here (the MIXED block already carries it once via
        // GRAPH_CONTINUITY_BLOCK, so it isn't embedded in ANALYZE_PIECEWISE_BLOCK).
        condition: { field: "question_style", equals: "analyze_piecewise" },
        content: `${ANALYZE_PIECEWISE_BLOCK}\n${LIMIT_SPEC_CONTRACT}`
      },
      {
        // ── Piecewise is REQUIRED when selected in function_types (multi_select
        //    → use `includes`, not `equals`, or the block silently never fires). ──
        condition: { field: "function_types", includes: "piecewise" },
        content: `
PIECEWISE IS REQUIRED:
Because "piecewise" is selected in function types, the function MUST be a genuine multi-branch piecewise (2–3 branches defined by formulas over stated intervals, Stewart style). Do NOT emit a single-expression function and call it piecewise. Each branch must use one of the OTHER selected base types (e.g. rational branches if "rational" is also selected; do not invent branch types that were not selected).
- For the graph_continuity style: the limitSpec's "segments" ARE the branches — one segment per branch, each continuous on its own (from, to) interval. Declare the boundary behavior at every interval boundary: continuous join (segments meet at the same value), jump (adjacent segments with openLeft/openRight + a points[] entry for f(a)), or removable hole (a holes[] entry). Only declare a verticalAsymptotes[] entry at a boundary where a branch expression genuinely diverges.
- For the symbolic styles: write the function with explicit branch conditions, e.g. f(x) = { (x+1)/(x-2) if x < 2; x^2 if x >= 2 }, and reason branch-by-branch at the boundaries.
`
      },
      {
        // ── VA COUNT: va_mode = none ──
        condition: { field: "va_mode", equals: "none" },
        content: `
VERTICAL ASYMPTOTE COUNT — NONE:
This question must have NO vertical asymptotes / no infinite discontinuities. Every segment must be finite across its interval. Do NOT declare any verticalAsymptotes (for graph_continuity, omit the verticalAsymptotes array or leave it empty); for symbolic styles, the function must not have any pole.
`
      },
      {
        // ── VA COUNT: va_mode = single (default) ──
        condition: { field: "va_mode", equals: "single" },
        content: `
VERTICAL ASYMPTOTE COUNT — AT MOST ONE:
Use AT MOST ONE vertical asymptote / infinite discontinuity, and only where a segment genuinely diverges (a rational whose denominator is zero, numerator nonzero, at that x). Many continuity questions have NONE (their discontinuities are removable / jump). If you include the single asymptote, declare it at a segment boundary (split the function so the pole sits at a from/to, never strictly inside a segment's interior).
`
      },
      {
        // ── VA COUNT: va_mode = multiple ──
        condition: { field: "va_mode", equals: "multiple" },
        content: `
VERTICAL ASYMPTOTE COUNT — MULTIPLE ALLOWED:
You MAY include several vertical asymptotes / infinite discontinuities — but EACH must be real: a segment must genuinely diverge at that boundary (denominator zero, numerator nonzero). Declare every VA at a SEGMENT BOUNDARY: split the function into segments around each asymptote so each pole sits at a from/to, never inside a segment's interior (the validator REJECTS a pole strictly inside a segment). Do not pad with fake asymptotes where the function is finite.
`
      }
    ],

    notation_additions: [
      `CONTINUITY DEFINITION: f is continuous at a when all three hold — (1) f(a) is defined, (2) lim x→a f(x) exists, (3) lim x→a f(x) = f(a). Cite which condition fails when explaining a discontinuity.`,
      `DISCONTINUITY TYPES: "removable" (limit exists but f(a) is undefined or different — a hole), "jump" (the one-sided limits differ), "infinite" (the function is unbounded near a / a vertical asymptote). Use these exact words.`,
      `ONE-SIDED CONTINUITY: "continuous from the left at a" means lim x→a^- f(x) = f(a); "continuous from the right at a" means lim x→a^+ f(x) = f(a). Write the one-sided limits as "lim x→a^- f(x)" and "lim x→a^+ f(x)" (caret superscripts required).`,
      `LIMIT NOTATION: write a limit as "lim x→a f(x)" with the arrow "→" (never "->"). Write infinite results as the mini-syntax "infinity" / "-infinity" — NEVER the unicode ∞ glyph.`,
      `NONEXISTENCE: when a limit fails to exist write "does not exist (DNE)"; an infinite limit COUNTS as the limit not existing. State WHY (one-sided limits differ, or unbounded behavior).`,
      `Do NOT use unicode symbols anywhere. Write <= >= != and "infinity" — never the unicode versions.`
    ],

    distractor_additions: [
      "Naming the wrong discontinuity kind (calling a removable hole 'infinite', or a jump 'removable')",
      "Claiming f is continuous at a because f(a) is defined, while ignoring that the limit differs (condition 3 fails)",
      "Listing a continuous join as a discontinuity, or omitting a genuine discontinuity",
      "Swapping continuous-from-the-left with continuous-from-the-right at a jump",
      "In a find-constant problem, matching the wrong pair of pieces or solving only one of two needed equations"
    ],

    subtopic_values: [
      "continuity_at_point", "types_of_discontinuity", "one_sided_continuity",
      "continuity_on_interval", "find_constant_for_continuity",
      "continuity_from_graph"
    ],
    function_type_values: [
      "rational", "polynomial", "root", "exponential",
      "logarithmic", "trigonometric", "piecewise"
    ],
    primary_task_values: [
      "identify_discontinuities_from_graph",
      "find_limit_dne_set", "find_constant_for_continuity",
      "analyze_piecewise_continuity",
      "one_sided_continuity"
    ]
  }
};
