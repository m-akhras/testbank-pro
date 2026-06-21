// lib/templates/calc1_2_6.js
//
// Calculus 1 §2.6 "Limits at Infinity; Horizontal Asymptotes" generation template.
//
// Structure mirrors calc1_2_2.js (metadata + fields[] + section_specific_rules
// with the 3 required *_values enums). This slice wires ONE style: "graph_at_infinity"
// — the spec-backed style. The model declares a "limitAtInfinitySpec" (a core
// derive-spec + a pole-free display curve) plus an "asks" array; the question routes
// through applyLimitDerivation → applyLimitAtInfinitySpec, which compiles the graph,
// DERIVES the answer key, and ENFORCES the graph/derive consistency + pole-free
// guards. Symbolic styles (compute-the-limit) are a later slice and are NOT added here.
//
// The §2.6 emission contract is defined INLINE below (LIMIT_AT_INFINITY_CONTRACT) —
// it is the §2.6 analog of LIMIT_SPEC_CONTRACT and deliberately does not touch
// limitSpecContract.js.

// §2.6 spec contract. The model DECLARES the function's end behavior via a derive
// spec + a pole-free display curve; the system compiles the graph and DERIVES the
// answer. These rules mirror the apply-layer guards — violating them gets the
// question REJECTED.
const LIMIT_AT_INFINITY_CONTRACT = `═══════════════════════════════════════════════════════════
§2.6 LIMIT-AT-INFINITY SPEC (graph_at_infinity questions ONLY) — DECLARE, DON'T COMPUTE
═══════════════════════════════════════════════════════════

For a §2.6 graph question, DO NOT emit a "graphConfig" and DO NOT compute or state
the limit / horizontal asymptotes yourself. Instead add two top-level fields and let
the system draw the graph and derive the answer:

"limitAtInfinitySpec": {
  "derive": <ONE of the two forms below>,
  "graph": { "fn": "<mini-expr in x>", "xDomain": [lo, hi] }
},
"asks": [ { "quantity": "endBehavior" | "limitAtPlusInf" | "limitAtMinusInf" | "horizontalAsymptotes" } ]

Leave "answer" and "explanation" as best-effort placeholders — the system OVERWRITES
them from the derived end behavior. Do not rely on them.

DERIVE — RATIONAL ONLY (v1):
- Rational:  { "kind": "rational", "num": [int coeffs high→low], "den": [int coeffs high→low] }
    e.g. (3x^2 - x + 1)/(x^2 + 4)  ⇒  { "kind":"rational", "num":[3,-1,1], "den":[1,0,4] }

HARD RULES (these mirror the system's guards — break one and the question is REJECTED):
- The function MUST be called f. Write "f" and "f(x)" everywhere in the question text —
  NEVER g, h, or y.
- The display curve graph.fn MUST be POLE-FREE on a generous window (no vertical
  asymptote anywhere near xDomain) AND its tails MUST approach the SAME limits the
  derive-spec implies. graph.fn must be the ALGEBRAIC EQUAL of the derive-spec — e.g.
  derive { "kind":"rational","num":[3,0,1],"den":[1,0,1] } ⇒ graph.fn "(3*x^2+1)/(x^2+1)".
- DENOMINATOR MUST HAVE NO REAL ROOT — this is what keeps the curve pole-free. The
  required shape is den = x^2 + c with integer c >= 1 (e.g. x^2+1, x^2+4). NEVER a
  denominator that is zero at some real x: NOT x^2 (zero at 0), NOT 3x^2, NOT x^2-1
  (zero at ±1), NOT x(x-1), NOT (x-2)^2. If the denominator can equal 0 for ANY real x,
  the curve has a vertical asymptote and the question is REJECTED.
- Numerator: any integer-coefficient polynomial with deg(num) <= deg(den) = 2. The
  horizontal asymptote is the leading-coefficient ratio when deg(num) = 2, else y = 0.
- mini-expr dialect: x^2, sqrt(x^2+1), (…)/(…), * for multiply — NO unicode, NO LaTeX,
  NO backslashes. Exactly the same dialect as a graphConfig "fn".
- xDomain should be WIDE enough to show the approach to the asymptote, e.g. [-10, 10] or
  [-20, 20]. The system draws the dashed horizontal-asymptote line(s) automatically from
  the derived values — do NOT add asymptotes to the graph yourself.

ASKS — what the question asks (drives the derived answer key):
- "horizontalAsymptotes" → give the equation(s) of the horizontal asymptote(s), e.g. "y = 3".
- "limitAtPlusInf"       → the limit as x → infinity (one direction).
- "limitAtMinusInf"      → the limit as x → -infinity (one direction).
- "endBehavior"          → both directions at once.

Derived answers are reported as: a number/fraction verbatim ("3", "1/2"); an unbounded
end as "infinity" / "-infinity" (mini-syntax — never the ∞ glyph); horizontal asymptotes
as "y = <value>" joined with " and " (e.g. "y = -1 and y = 1"), or "no horizontal
asymptotes" when none exist.

For Multiple Choice: author 4 plausible choices in the SAME format as the derived answer
— "y = 3" / "y = 1/2" for horizontalAsymptotes asks; "3" / "infinity" for limit asks. The
system matches the DERIVED value to one of your choices and REJECTS the question if it is
absent — so make sure the correct value is present VERBATIM.`;

const GRAPH_AT_INFINITY_BLOCK = `
§2.6 GRAPH-AT-INFINITY STYLE — EMIT A LIMIT-AT-INFINITY SPEC, DO NOT STATE THE ANSWER:
Present a question that asks the student to READ the limits at infinity / horizontal
asymptote(s) off the graph of a function f. The graph shows a single pole-free curve f(x)
that flattens toward its horizontal asymptote(s) as x → ±infinity.
For this question_style you MUST output a declared "limitAtInfinitySpec" plus an "asks"
array (schema below) and you MUST NOT compute or assert the limit / horizontal asymptotes
yourself. Leave "answer" and "explanation" as best-effort placeholders only — the system
DERIVES the authoritative answer key from your spec and will REJECT the question if the
spec is malformed, if the display curve is not pole-free, if its tails contradict the
derive-spec, or (for Multiple Choice) if the derived value is not among your choices.

${LIMIT_AT_INFINITY_CONTRACT}
`;

export const calc1_2_6_template = {
  id: "calc1_2_6",
  version: 1,
  course: "Calculus 1",
  section: "2.6",
  sectionTitle: "Limits at Infinity; Horizontal Asymptotes",
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
      default: "graph_at_infinity",
      options: [
        { value: "graph_at_infinity", label: "Read limits at infinity / horizontal asymptotes off a given graph" }
      ]
    },
    {
      id: "function_types",
      label: "Function types to feature",
      type: "multi_select",
      default: ["rational"],
      minSelections: 1,
      options: [
        { value: "rational", label: "Rational" }
      ]
    },
    {
      id: "representation_forms",
      label: "Representation forms to include",
      type: "multi_select",
      default: ["graphical"],
      minSelections: 1,
      options: [
        { value: "graphical", label: "Graphical (graph given)" },
        { value: "algebraic", label: "Algebraic (formula given)" }
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
      placeholder: "e.g., Use a rational function with horizontal asymptote y = 2, and one root-over-linear graph with two horizontal asymptotes."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    // graph_at_infinity tasks carry the (limitAtInfinitySpec-driven) graph.
    graph_eligible_tasks: [
      "read_limit_at_infinity_from_graph",
      "read_horizontal_asymptote_from_graph"
    ],

    reference_examples: [
      {
        stem: "The graph of f is shown. State (a) lim x→infinity f(x), (b) lim x→-infinity f(x), and (c) the equation(s) of any horizontal asymptote(s). f(x) = (3*x^2 + 1)/(x^2 + 1).",
        answer: "(a) 3  (b) 3  (c) y = 3",
        explanation: "For a rational function with equal numerator and denominator degrees, the limit at infinity is the ratio of the leading coefficients: 3/1 = 3. The same value holds as x → -infinity, so the curve flattens toward the single horizontal asymptote y = 3 on both ends."
      },
      {
        stem: "For the function f whose graph is given, give the equation of the horizontal asymptote. f(x) = (2*x^2 - 3)/(x^2 + 1).",
        answer: "y = 2",
        explanation: "The numerator and denominator have the same degree (2), so the limit at infinity is the ratio of the leading coefficients: 2/1 = 2. The same value holds as x → -infinity, so the curve flattens toward the single horizontal asymptote y = 2 on both ends. The denominator x^2 + 1 is never zero, so the curve is pole-free."
      },
      {
        stem: "The graph of f is shown. Find lim x→infinity f(x) and the horizontal asymptote, where f(x) = (x - 4)/(2*x + 3).",
        answer: "lim x→infinity f(x) = 1/2; horizontal asymptote y = 1/2",
        explanation: "Numerator and denominator both have degree 1, so the limit at infinity is the ratio of leading coefficients 1/2. The limit as x → -infinity is the same, so the graph has the single horizontal asymptote y = 1/2."
      }
    ],

    conditional_quality_blocks: [
      {
        // ── ROUTING: graph_at_infinity → emit a limitAtInfinitySpec, DO NOT state the answer ──
        condition: { field: "question_style", equals: "graph_at_infinity" },
        content: GRAPH_AT_INFINITY_BLOCK
      }
    ],

    notation_additions: [
      `LIMIT-AT-INFINITY NOTATION: write the limits as "lim x→infinity f(x)" and "lim x→-infinity f(x)" — use the arrow "→" and the mini-syntax word "infinity" / "-infinity", NEVER the unicode ∞ glyph.`,
      `HORIZONTAL ASYMPTOTES: state each as an equation of a horizontal line, "y = a" — never as a point or a bare number. When there are two, write "y = -1 and y = 1".`,
      `Do NOT use unicode symbols anywhere. Write <= >= != and "infinity" — never the unicode versions.`
    ],

    distractor_additions: [
      "Reporting the ratio of constant terms instead of the leading coefficients for an equal-degree rational",
      "Reporting the ratio of constant terms instead of leading coefficients for a degree-matched rational",
      "Confusing a vertical asymptote (where the function blows up) with a horizontal asymptote (the end behavior)",
      "Stating a horizontal asymptote as a bare number or a point instead of the line y = a"
    ],

    subtopic_values: [
      "limit_at_infinity", "horizontal_asymptote", "end_behavior"
    ],
    function_type_values: [
      "rational"
    ],
    primary_task_values: [
      "read_limit_at_infinity_from_graph",
      "read_horizontal_asymptote_from_graph"
    ]
  }
};
