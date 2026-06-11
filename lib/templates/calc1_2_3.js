// lib/templates/calc1_2_3.js
//
// Calculus 1 §2.3 "Calculating Limits Using the Limit Laws" generation template.
//
// Structure mirrors calc1_2_5.js. The `question_style` router selects one of five
// flavors. ONE style — "graph_limit_laws" — emits TWO declared LimitSpecs
// (limitSpecF + limitSpecG) plus a "lawAsks" array, routed through
// applyLimitDerivation → applyLimitLaws → the SAME §2.2 engine + guards
// (phantom-VA, interior-pole) + combineLimits, with the combined answer DERIVED by
// the system. The other four styles are symbolic (no spec → applyLimitDerivation
// no-ops; the model computes and states the answer).

import { LIMIT_SPEC_CONTRACT } from "./_generic/limitSpecContract.js";

// Per-style instruction blocks, defined once and reused by both the explicit
// single-style routing AND the "mixed" block (so the two never drift).
const GRAPH_LIMIT_LAWS_BLOCK = `
§2.3 GRAPH-LIMIT-LAWS STYLE — EMIT TWO LIMIT SPECS + ONE lawAsk, DO NOT STATE THE ANSWER:
For this style you MUST output TWO declared LimitSpecs — "limitSpecF" (the graph of f) and "limitSpecG" (the graph of g) — plus a "lawAsks" array containing EXACTLY ONE ask (single-limit questions only — no multi-part a/b/c format). You MUST NOT compute or assert the combined limit yourself: the system DERIVES the answer from the two specs and the law and OVERWRITES "answer"/"explanation" (leave them as best-effort placeholders). A malformed spec, or more than one ask, is REJECTED.

QUESTION TEXT (Stewart style, ONE limit): "The graphs of f and g are given. Use them to evaluate lim x→a [f(x) + g(x)], if it exists. If the limit does not exist, explain why." (state the single limit your lawAsk encodes — adapt the bracketed expression to the chosen law and point a).

lawAsks: [ { "law": "...", "at": <integer>, "params": { ... } } ]   ← EXACTLY ONE entry
- "sum"           — lim [f + g] as x→at
- "difference"    — lim [f - g] as x→at
- "product"       — lim [f * g] as x→at
- "quotient"      — lim [f / g] as x→at
- "constMultiple" — lim [k * f] as x→at; params: { "k": <number> }
- "xPolyTimesF"   — lim [p(x) * f] as x→at; params: { "poly": "x^2" } (a polynomial in x, e.g. "x^2", "x^3-1")
- "power"         — lim [f ^ n] as x→at; params: { "n": <integer >= 1> }
- "root"          — lim [ n-th root of f ] as x→at; params: { "n": <integer >= 2> }

RULES:
- EXACTLY ONE ask per question, at an INTEGER point where BOTH f and g are defined. Place it at an interesting feature (a jump, hole, or vertical asymptote) so the answer is instructive, not a trivial substitution.
- BATCH-LEVEL MIX (across the whole set of questions you generate, NOT within one question): include at least one "quotient" question at a point where g's two-sided limit is 0 (derives "does not exist (DNE)"); at least one "sum" or "difference" question at a point where one operand's two-sided limit does not exist (e.g. a jump), so the combined limit is DNE; and at least one "xPolyTimesF", "power", or "root" question. Vary the law and the point across the batch.
- OUT OF SCOPE — do NOT emit: any ask that combines a function VALUE with a limit (a value-plus-limit part), or any composition of f and g. ONLY the eight laws above are supported.
- Multiple Choice: the system DERIVES the correct scalar answer (a number, or "does not exist (DNE)", "infinity", "-infinity") and INJECTS it among your choices — you CANNOT set the correct answer. Author 4 plausible WRONG distractors as bare scalar values in that same form (e.g. "3", "0", "infinity", "does not exist (DNE)"); the system replaces one of them with the correct value and marks it.

Declare each of f and g exactly as in §2.2 (segments / holes / points / verticalAsymptotes). The TWO LimitSpec contracts below apply to limitSpecF and limitSpecG respectively — emit each as its own top-level field.

═══════════════════════════════════════════════════════════
LIMIT SPEC — FOR f  (emit as the top-level field "limitSpecF")
═══════════════════════════════════════════════════════════
${LIMIT_SPEC_CONTRACT}

═══════════════════════════════════════════════════════════
LIMIT SPEC — FOR g  (emit as the top-level field "limitSpecG")
═══════════════════════════════════════════════════════════
${LIMIT_SPEC_CONTRACT}
`;

const ALGEBRAIC_BLOCK = `
§2.3 ALGEBRAIC STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. Ask "Evaluate the limit, if it exists" for a concrete expression. Compute the answer yourself and show the full method.
Methods (vary across the set):
- DIRECT SUBSTITUTION when the function is continuous at the point (polynomials, and rationals whose denominator is nonzero there): e.g. lim x→-2 (3x - 7) = -13.
- FACTOR-AND-CANCEL for 0/0 forms: factor numerator and denominator, cancel the common (x - a) factor, then substitute, e.g. (t^2 - 2t - 8)/(t - 4) → t + 2 → 6.
- CONJUGATE / ALGEBRAIC REARRANGEMENT for roots or complex fractions: multiply by the conjugate, or combine fractions, then cancel, e.g. (sqrt(9 + h) - 3)/h → 1/6.
- DNE: if direct substitution gives nonzero/0 (denominator → 0, numerator → nonzero), the limit DOES NOT EXIST — say "does not exist (DNE)" and explain why.
Use mini-syntax (sqrt(x), x^2, not LaTeX). State exact answers (fractions like 5/7, 1/6, -1/9), never decimals.
DISTRACTORS (for Multiple Choice): the value from plugging in BEFORE cancelling (0/0 mishandled); a sign error in factoring; the reciprocal of the correct fraction; "0" when the answer is a nonzero limit.
`;

const LIMIT_LAWS_GIVEN_BLOCK = `
§2.3 LIMIT-LAWS-GIVEN STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. State given limit values at a point — lim f = a, lim g = b, lim h = c with EXACTLY ONE of them equal to 0 — then ask the student to evaluate several combinations, "if the limit exists; if not, explain why." Compute the answers yourself using the Limit Laws.
REQUIRED in every variant:
- One part that is DNE: a QUOTIENT whose denominator is the zero-limit function over a nonzero-limit numerator (e.g. lim g/h with lim h = 0, lim g != 0).
- One part where the zero-limit function multiplies harmlessly to give 0 (e.g. lim g*h/f = b*0/a = 0, valid because lim f != 0).
- A power/root part (e.g. lim [g]^3, lim sqrt(f)) — note sqrt requires the limit to be >= 0.
Method: apply sum/constant-multiple/product/quotient/power laws; the quotient law requires the denominator's limit != 0 (state this when a part is DNE).
DISTRACTORS (for Multiple Choice): treat 0/nonzero and nonzero/0 the same; compute b*0 as something other than 0; forget that sqrt of a negative limit is not real.
`;

const SQUEEZE_THEOREM_BLOCK = `
§2.3 SQUEEZE-THEOREM STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER:
Do NOT emit a limitSpec for this style. Ask "Use the Squeeze Theorem to show that [limit] = 0" for a product of a factor that → 0 and a genuinely BOUNDED factor (sin or cos of anything, or e^(sin(...))). Compute and prove it.
Method to show: state the bounding inequality for the bounded factor (e.g. -1 <= sin(pi/x) <= 1, or e^(-1) <= e^(sin(pi/x)) <= e), multiply through by the squeezing factor (which → 0 and, where needed, take absolute values so the inequality direction is valid), conclude both bounds → 0, so by the Squeeze Theorem the limit is 0.
REQUIRED: the bounded factor must really be bounded (never an unbounded thing like 1/x), and the squeezing factor (x^2, x^4, sqrt(x), sqrt(x^3+x^2)) must → 0. The explanation MUST state both bounding inequalities.
DISTRACTORS (for Multiple Choice): claim the limit is the bound itself (e.g. 1 or -1) rather than 0; claim DNE because sin(pi/x) oscillates (the Squeeze Theorem resolves it); a nonzero value.
`;

const PIECEWISE_EVAL_BLOCK = `
§2.3 PIECEWISE-EVAL STYLE — SYMBOLIC, COMPUTE AND STATE THE ANSWER (no graph):
Do NOT emit a limitSpec for this style — the piecewise function is given ALGEBRAICALLY (by its branch formulas and conditions), with no graph. Build a 3-4 piece piecewise function and ask for one-sided and two-sided limits at the boundary points (and the occasional function value). Compute the answers yourself.
REQUIRED: at each boundary point, ask BOTH one-sided limits (lim x→a^- and lim x→a^+) AND the two-sided conclusion. Include at least one boundary where the two-sided limit EXISTS but differs from the function value defined there (e.g. f(1) defined as 3 while lim x→1 f = 1), and at least one boundary where the two-sided limit DNE because the one-sided limits differ.
Method: substitute each adjacent branch formula into the matching one-sided limit; the two-sided limit exists iff the one-sided limits agree. The function value at a point is read from the branch (or special case) that covers it.
Notation: write one-sided limits as "lim x→a^- f(x)" / "lim x→a^+ f(x)"; write "does not exist (DNE)" when they differ.
DISTRACTORS (for Multiple Choice): use the function value where a limit is asked (or vice versa); evaluate the wrong branch for a one-sided limit; claim the two-sided limit exists when the one-sided limits differ.
`;

const MIXED_BLOCK = `
§2.3 MIXED STYLE — YOU CHOOSE EACH QUESTION'S STYLE PER QUESTION:
Generate a VARIED batch, choosing for EACH question one of the five §2.3 styles below (graph_limit_laws, algebraic, limit_laws_given, squeeze_theorem, piecewise_eval), guided by the instructor's selections:
- Representation forms: if "Graphical" is selected, graph_limit_laws (two-graph) questions are allowed (and encouraged). If "Graphical" is NOT selected, do NOT produce any graph question — use only the symbolic styles (algebraic / limit_laws_given / squeeze_theorem / piecewise_eval).
- Function types & focus steer which symbolic style fits (rational/root → algebraic factor-cancel/conjugate; piecewise → piecewise_eval; trig → squeeze_theorem).
- Suggested mix when graphical is available: roughly half graph_limit_laws and half symbolic, varied across the batch (this is guidance, not a rigid count). When graphical is not available: all symbolic.

HARD RULE: ANY question that presents a graph MUST carry the appropriate spec (limitSpec, or limitSpecF+limitSpecG+lawAsks). A graph question without a spec is INVALID and will be rejected.

Each question follows the FULL rules of the style you pick for it, reproduced here:
${GRAPH_LIMIT_LAWS_BLOCK}
${ALGEBRAIC_BLOCK}
${LIMIT_LAWS_GIVEN_BLOCK}
${SQUEEZE_THEOREM_BLOCK}
${PIECEWISE_EVAL_BLOCK}
`;

export const calc1_2_3_template = {
  id: "calc1_2_3",
  version: 1,
  course: "Calculus 1",
  section: "2.3",
  sectionTitle: "Calculating Limits Using the Limit Laws",
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
        { value: "graph_limit_laws", label: "Two graphs f and g: evaluate combined limits via the limit laws" },
        { value: "algebraic", label: "Algebraic: substitution / factor-cancel / conjugate" },
        { value: "limit_laws_given", label: "Given lim f, lim g, lim h: evaluate combinations" },
        { value: "squeeze_theorem", label: "Squeeze Theorem (show a limit is 0)" },
        { value: "piecewise_eval", label: "Piecewise function (algebraic): one-sided / two-sided limits at boundaries" }
      ]
    },
    {
      id: "primary_focus",
      label: "Primary focus",
      type: "single_select",
      default: "mix",
      options: [
        { value: "mix", label: "A mix across the section (recommended)" },
        { value: "limit_laws", label: "Applying the limit laws (sum / product / quotient / power)" },
        { value: "factor_cancel", label: "Factor-and-cancel (0/0 forms)" },
        { value: "conjugate", label: "Conjugate / algebraic rearrangement" },
        { value: "squeeze", label: "Squeeze Theorem" },
        { value: "piecewise_boundary", label: "Piecewise limits at boundary points" }
      ]
    },
    {
      id: "representation_forms",
      label: "Representation forms to include",
      type: "multi_select",
      default: ["algebraic"],
      minSelections: 1,
      options: [
        { value: "algebraic", label: "Algebraic (formula given)" },
        { value: "graphical", label: "Graphical (graphs given)" },
        { value: "numerical", label: "Numerical (table of values)" },
        { value: "verbal", label: "Verbal (word description)" }
      ]
    },
    {
      id: "function_types",
      label: "Function types to feature",
      type: "multi_select",
      default: ["rational", "root"],
      minSelections: 1,
      options: [
        { value: "rational", label: "Rational" },
        { value: "polynomial", label: "Polynomial" },
        { value: "root", label: "Root (square / cube root)" },
        { value: "exponential", label: "Exponential" },
        { value: "log", label: "Logarithmic" },
        { value: "trigonometric", label: "Trigonometric" },
        { value: "piecewise", label: "Piecewise" }
      ]
    },
    {
      id: "va_mode",
      label: "Vertical asymptotes (graph style only)",
      type: "single_select",
      default: "single",
      options: [
        { value: "none", label: "No vertical asymptotes (graphs finite everywhere)" },
        { value: "single", label: "At most one vertical asymptote per graph" },
        { value: "multiple", label: "Allow multiple vertical asymptotes" }
      ]
    },
    {
      id: "domain_complexity",
      label: "Difficulty",
      type: "single_select",
      default: "moderate",
      options: [
        { value: "trivial", label: "Trivial (direct substitution)" },
        { value: "moderate", label: "Moderate (one factor-cancel / conjugate step)" },
        { value: "advanced", label: "Advanced (nested rearrangement, DNE cases)" },
        { value: "mix", label: "Mix across questions" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select",
      default: ["evaluate_algebraic_limit", "evaluate_combined_limit_from_graphs"],
      minSelections: 1,
      options: [
        { value: "evaluate_combined_limit_from_graphs", label: "Evaluate a combined limit (f and g) from two graphs" },
        { value: "evaluate_algebraic_limit", label: "Evaluate a limit algebraically (substitution / factor / conjugate)" },
        { value: "apply_limit_laws_to_given", label: "Apply the limit laws to given limit values" },
        { value: "apply_squeeze_theorem", label: "Apply the Squeeze Theorem" },
        { value: "evaluate_piecewise_limit", label: "Evaluate one-sided / two-sided limits of a piecewise function" }
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
      placeholder: "e.g., Emphasize 0/0 factor-cancel limits and include one conjugate-rationalization."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    // Only the two-graph style carries graphs (a functionPair); every other style
    // is purely symbolic and must NOT attach a graph.
    graph_eligible_tasks: ["evaluate_combined_limit_from_graphs"],

    reference_examples: [
      // ── graph_limit_laws (Stewart §2.3 Ex 2 — structure authoritative; graphs
      //    not transcribable; part (f) value+limit combo omitted, out of scope) ──
      {
        stem: "The graphs of f and g are given. Use them to evaluate lim x→3 [f(x)/g(x)], if it exists. If the limit does not exist, explain why.",
        answer: "does not exist (DNE)",
        explanation: "Read lim x→3 f(x) and lim x→3 g(x) off the graphs and apply the Quotient Law. The quotient law applies only when the denominator's limit is nonzero. Here lim x→3 g(x) = 0 while lim x→3 f(x) is nonzero, so f(x)/g(x) grows without bound and the limit does not exist (DNE). (Each §2.3 graph question asks a SINGLE limit; across a batch the laws and points vary — sum/difference at a jump, a quotient where lim g = 0, an x^2*f / power / root, etc.)"
      },
      // ── algebraic (Stewart §2.3 Ex 11-26 style) ──
      {
        stem: "Evaluate the limit: lim x→-2 (3x - 7).",
        answer: "-13",
        explanation: "3x - 7 is a polynomial (continuous), so by direct substitution lim x→-2 (3x - 7) = 3(-2) - 7 = -13."
      },
      {
        stem: "Evaluate the limit: lim t→4 (t^2 - 2t - 8)/(t - 4).",
        answer: "6",
        explanation: "Direct substitution gives 0/0. Factor: t^2 - 2t - 8 = (t - 4)(t + 2). Cancel (t - 4): lim t→4 (t + 2) = 6."
      },
      {
        stem: "Evaluate the limit, if it exists: lim x→2 (x^2 + 5x + 4)/(x - 2).",
        answer: "does not exist (DNE)",
        explanation: "As x → 2 the numerator → 4 + 10 + 4 = 18 (nonzero) and the denominator → 0. A nonzero number over a quantity approaching 0 is unbounded, so the two-sided limit does not exist."
      },
      {
        stem: "Evaluate the limit: lim x→-2 (x^2 - x - 6)/(3x^2 + 5x - 2).",
        answer: "5/7",
        explanation: "0/0 form. Factor: (x - 3)(x + 2) / ((3x - 1)(x + 2)). Cancel (x + 2): lim x→-2 (x - 3)/(3x - 1) = (-5)/(-7) = 5/7."
      },
      {
        stem: "Evaluate the limit: lim h→0 (sqrt(9 + h) - 3)/h.",
        answer: "1/6",
        explanation: "0/0 form. Multiply by the conjugate (sqrt(9 + h) + 3): the numerator becomes (9 + h) - 9 = h, giving h / (h(sqrt(9 + h) + 3)) = 1/(sqrt(9 + h) + 3) → 1/(3 + 3) = 1/6."
      },
      {
        stem: "Evaluate the limit: lim x→3 (1/x - 1/3)/(x - 3).",
        answer: "-1/9",
        explanation: "Combine the numerator: 1/x - 1/3 = (3 - x)/(3x). Divide by (x - 3): (3 - x)/(3x(x - 3)) = -1/(3x) → -1/(3*3) = -1/9."
      },
      {
        stem: "Evaluate the limit: lim t→0 (sqrt(1 + t) - sqrt(1 - t))/t.",
        answer: "1",
        explanation: "Multiply by the conjugate sqrt(1 + t) + sqrt(1 - t): numerator becomes (1 + t) - (1 - t) = 2t, giving 2t / (t(sqrt(1 + t) + sqrt(1 - t))) = 2/(sqrt(1 + t) + sqrt(1 - t)) → 2/(1 + 1) = 1."
      },
      // ── limit_laws_given (Stewart §2.3 Ex 1) ──
      {
        stem: "Given that lim x→2 f(x) = 4, lim x→2 g(x) = -2, and lim x→2 h(x) = 0, find each limit if it exists; if not, explain why. (a) lim [f + 5g]  (b) lim [g]^3  (c) lim sqrt(f)  (d) lim 3f/g  (e) lim g/h  (f) lim gh/f",
        answer: "(a) -6  (b) -8  (c) 2  (d) -6  (e) does not exist (DNE)  (f) 0",
        explanation: "(a) 4 + 5(-2) = -6. (b) (-2)^3 = -8. (c) sqrt(4) = 2. (d) 3(4)/(-2) = -6. (e) numerator → -2 (nonzero), denominator → 0, so DNE. (f) (-2)(0)/4 = 0 — the zero-limit factor makes the product 0 (the quotient law applies since lim f = 4 ≠ 0)."
      },
      // ── squeeze_theorem (Stewart §2.3 Ex 35-38 style) ──
      {
        stem: "Use the Squeeze Theorem to show that lim x→0 x^2 cos(20*pi*x) = 0.",
        answer: "0",
        explanation: "Since -1 <= cos(20*pi*x) <= 1, multiplying by x^2 >= 0 gives -x^2 <= x^2 cos(20*pi*x) <= x^2. Both bounds → 0 as x → 0, so by the Squeeze Theorem the limit is 0."
      },
      {
        stem: "Use the Squeeze Theorem to show that lim x→0 sqrt(x^3 + x^2) sin(pi/x) = 0.",
        answer: "0",
        explanation: "Since -1 <= sin(pi/x) <= 1, we have 0 <= |sqrt(x^3 + x^2) sin(pi/x)| <= sqrt(x^3 + x^2). The right bound → 0 as x → 0, so the squeezed quantity → 0."
      },
      {
        stem: "Use the Squeeze Theorem to show that lim x→0+ sqrt(x) e^(sin(pi/x)) = 0.",
        answer: "0",
        explanation: "Since -1 <= sin(pi/x) <= 1, the bounded factor satisfies e^(-1) <= e^(sin(pi/x)) <= e. Thus 0 <= sqrt(x) e^(sin(pi/x)) <= e*sqrt(x). The right bound → 0 as x → 0+, so the limit is 0."
      },
      // ── piecewise_eval (Stewart §2.3 Ex 54) ──
      {
        stem: "Let g(x) = x for x < 1, g(x) = 3 for x = 1, g(x) = 2 - x^2 for 1 < x <= 2, and g(x) = x - 3 for x > 2. Evaluate each, if it exists: (i) lim x→1^- g(x)  (ii) lim x→1 g(x)  (iii) g(1)  (iv) lim x→2^- g(x)  (v) lim x→2^+ g(x)  (vi) lim x→2 g(x)",
        answer: "(i) 1  (ii) 1  (iii) 3  (iv) -2  (v) -1  (vi) does not exist (DNE)",
        explanation: "(i) From the left of 1, g = x → 1. (ii) From the right, g = 2 - x^2 → 1; both one-sided limits are 1, so lim x→1 g = 1 (even though g(1) = 3). (iii) g(1) = 3 by definition. (iv) From the left of 2, g = 2 - x^2 → 2 - 4 = -2. (v) From the right, g = x - 3 → -1. (vi) The one-sided limits differ (-2 != -1), so the two-sided limit DNE."
      }
    ],

    conditional_quality_blocks: [
      {
        // ── ROUTING: mixed → AI picks each question's style (default) ──
        condition: { field: "question_style", equals: "mixed" },
        content: MIXED_BLOCK
      },
      {
        // ── ROUTING: graph_limit_laws → emit TWO LimitSpecs + lawAsks ──
        condition: { field: "question_style", equals: "graph_limit_laws" },
        content: GRAPH_LIMIT_LAWS_BLOCK
      },
      {
        // ── ROUTING: algebraic → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "algebraic" },
        content: ALGEBRAIC_BLOCK
      },
      {
        // ── ROUTING: limit_laws_given → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "limit_laws_given" },
        content: LIMIT_LAWS_GIVEN_BLOCK
      },
      {
        // ── ROUTING: squeeze_theorem → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "squeeze_theorem" },
        content: SQUEEZE_THEOREM_BLOCK
      },
      {
        // ── ROUTING: piecewise_eval → symbolic, model computes the answer ──
        condition: { field: "question_style", equals: "piecewise_eval" },
        content: PIECEWISE_EVAL_BLOCK
      },
      {
        // ── Piecewise REQUIRED when selected in function_types (multi_select →
        //    use `includes`, not `equals`). ──
        condition: { field: "function_types", includes: "piecewise" },
        content: `
PIECEWISE IS REQUIRED:
Because "piecewise" is selected, any piecewise function MUST be a genuine multi-branch piecewise (2-4 branches over stated intervals). Do NOT label a single-expression function "piecewise".
- For graph_limit_laws: in EACH of limitSpecF and limitSpecG, the "segments" ARE the branches — one continuous segment per branch, with jumps/holes/VAs declared structurally at the boundaries.
- For piecewise_eval and the other symbolic styles: write explicit branch conditions, e.g. f(x) = { x if x < 1; 2 - x^2 if 1 <= x <= 2; x - 3 if x > 2 }, and reason branch-by-branch at the boundaries.
`
      },
      {
        // ── VA COUNT: va_mode = none (graph_limit_laws only) ──
        condition: { field: "va_mode", equals: "none" },
        content: `
VERTICAL ASYMPTOTE COUNT — NONE (graph_limit_laws):
Neither f nor g may have a vertical asymptote / infinite limit. Every segment must be finite across its interval; declare NO verticalAsymptotes in either limitSpecF or limitSpecG. (Symbolic styles: no infinite limits.)
`
      },
      {
        // ── VA COUNT: va_mode = single (default) ──
        condition: { field: "va_mode", equals: "single" },
        content: `
VERTICAL ASYMPTOTE COUNT — AT MOST ONE PER GRAPH (graph_limit_laws):
Each of f and g may have AT MOST ONE vertical asymptote, and only where a segment genuinely diverges (rational, denominator zero / numerator nonzero). Declare each VA at a segment boundary, never strictly inside a segment's interior (the validator rejects that). A product/quotient ask AT such an asymptote is a good instructive case (finite * infinity, or finite / infinity).
`
      },
      {
        // ── VA COUNT: va_mode = multiple ──
        condition: { field: "va_mode", equals: "multiple" },
        content: `
VERTICAL ASYMPTOTE COUNT — MULTIPLE ALLOWED (graph_limit_laws):
f and/or g MAY have several vertical asymptotes — but EACH must be real (a segment genuinely diverging at that boundary, denominator zero / numerator nonzero), declared at a SEGMENT BOUNDARY (never inside a segment's interior). Do not pad with fake asymptotes where a graph is finite.
`
      }
    ],

    notation_additions: [
      `LIMIT NOTATION: write a limit as "lim x→a f(x)" with the arrow "→" (never "->" or words). One-sided: "lim x→a^- f(x)" (left) and "lim x→a^+ f(x)" (right) — the caret superscripts are required.`,
      `LIMIT LAWS: the limit of a sum/difference/product/quotient is the sum/difference/product/quotient of the limits, PROVIDED each limit exists and (for a quotient) the denominator's limit is nonzero. lim [c f] = c lim f; lim [f^n] = (lim f)^n; lim (n-th root of f) = n-th root of (lim f) when defined.`,
      `EXACT VALUES: state answers exactly — fractions like "5/7", "1/6", "-1/9" — never decimal approximations.`,
      `INFINITE LIMITS: write infinite results as the mini-syntax text "infinity" / "-infinity" — NEVER the unicode ∞ glyph.`,
      `NONEXISTENCE: when a limit fails to exist write "does not exist (DNE)" and state WHY (denominator → 0 over a nonzero numerator; one-sided limits differ; unbounded behavior).`,
      `Do NOT use unicode symbols or LaTeX. Write mini-syntax: sqrt(x), x^2, <= >= !=, "pi", "infinity".`
    ],

    distractor_additions: [
      "Plugging the point into a 0/0 expression before cancelling (reporting 0/0 or a bogus value instead of the cancelled limit)",
      "Treating nonzero/0 and 0/0 the same — both are NOT automatically DNE; only nonzero/0 is DNE, 0/0 must be resolved",
      "Sign error when factoring a quadratic, giving the wrong cancelled limit",
      "Reporting the bound (1 or -1) instead of 0 for a Squeeze-Theorem limit",
      "Using a piecewise function's VALUE where a one-sided LIMIT was asked (or evaluating the wrong branch)"
    ],

    subtopic_values: [
      "limit_laws_from_graph", "algebraic_limit", "factor_cancel",
      "conjugate_rationalize", "given_limit_laws", "squeeze_theorem",
      "piecewise_limit", "indeterminate_form"
    ],
    function_type_values: [
      "rational", "polynomial", "root", "exponential",
      "logarithmic", "trigonometric", "piecewise"
    ],
    primary_task_values: [
      "evaluate_combined_limit_from_graphs", "evaluate_algebraic_limit",
      "apply_limit_laws_to_given", "apply_squeeze_theorem",
      "evaluate_piecewise_limit"
    ]
  }
};
