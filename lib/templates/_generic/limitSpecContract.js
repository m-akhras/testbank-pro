// lib/templates/_generic/limitSpecContract.js
//
// §2.2 limit-graph emission contract. ADDITIVE and SECTION-SPECIFIC: this block
// is documented here but is NOT injected into the generic prompt today. The
// §2.2 template (Stage B) will interpolate LIMIT_SPEC_CONTRACT alongside (not
// instead of) GRAPH_SCHEMAS / the output contract.
//
// The point of this contract is that for §2.2 the model declares the function
// SEMANTICALLY as a LimitSpec and states WHAT is being asked (the `asks` list).
// The pipeline then (a) compiles the spec to the renderer's piecewise
// graphConfig and (b) DERIVES the answer key from the spec — the model's own
// claimed answer/explanation are discarded and never trusted. So the model's
// job here is only to draw the picture (the spec) and name the questions
// (asks), not to compute limits.
//
// Schema lives in lib/limits/limitGraphSpec.js (validateLimitSpec) and is
// compiled by lib/limits/compileToGraphConfig.js + answered by
// lib/limits/deriveLimits.js. Keep this doc in sync with those.

export const LIMIT_SPEC_CONTRACT = `═══════════════════════════════════════════════════════════
§2.2 LIMIT SPEC (limit-of-a-function questions ONLY) — DECLARE, DON'T COMPUTE
═══════════════════════════════════════════════════════════

For a §2.2 limit question that shows a graph, DO NOT emit a "graphConfig" and DO
NOT compute the limit yourself. Instead add two top-level fields and let the
system draw the graph and grade the answer:

"limitSpec": { ...the declared function below... },
"asks": [ { "quantity": "...", "at": <number>, "side": "left" | "right" } ]

Leave "answer" and "explanation" as best-effort placeholders — the system
OVERWRITES them from the spec. Do not rely on them.

LIMIT SPEC SHAPE — every discontinuity is DECLARED, never implied by an fn:
{
  "segments": [
    { "fn": "x+2", "from": 0, "to": 4, "openLeft": false, "openRight": false }
  ],
  "holes": [ { "x": 2, "y": 4 } ],
  "points": [ { "x": 2, "y": 6 } ],
  "verticalAsymptotes": [ { "x": 3, "leftSign": "-inf", "rightSign": "+inf" } ]
}

- segments: continuous pieces. "fn" is a mini-expression in x (same dialect as
  graphConfig "fn": x^2, sqrt(x), (x^2-4)/(x-2), 2^x — NO unicode, NO LaTeX,
  NO backslashes). Each segment is continuous on its interval (from, to);
  from < to. "openLeft"/"openRight" mark whether each endpoint is an OPEN circle
  (limit-only, value excluded) vs a FILLED endpoint. Default false (filled).
- holes: declared removable points drawn as OPEN circles at (x, y). Use these
  for a hole even when the fn would divide by zero there — the system never
  samples the fn AT the hole.
- points: declared FILLED dots at (x, y) that OVERRIDE the function value f(x)
  (e.g. the actual value at a jump, or a redefined point).
- verticalAsymptotes: declared VAs. leftSign/rightSign ∈ "+inf" | "-inf"
  describe the behavior approaching x from each side. The renderer draws a
  dashed vertical line; do NOT also add an "fn" like 1/(x-3) to fake one.
  DECLARE A VA ONLY WHERE A SEGMENT ACTUALLY DIVERGES to ±infinity — i.e. a
  rational with denominator zero (numerator nonzero) at that x. Polynomials,
  roots, exponentials, and in-domain logarithms have NO vertical asymptotes —
  declare none. Most §2.2 graphs have ZERO or ONE VA; do NOT add them by
  default. A VA where the covering segment is finite (e.g. sqrt(x+5) at x=2) is
  REJECTED by the validator.

ASKS — what the question asks, in order (drives the derived answer key):
{ "quantity": "limit" | "leftLimit" | "rightLimit" | "fValue" | "verticalAsymptotes",
  "at": <number>, "side": "left" | "right" (optional) }

- "limit"        → the two-sided limit as x → at.
- "leftLimit"    → the one-sided limit as x → at⁻.
- "rightLimit"   → the one-sided limit as x → at⁺.
- "fValue"       → the function value f(at).
- "verticalAsymptotes" → the x-locations of vertical asymptotes ("at" ignored).

CONTINUITY ASKS (§2.5) — same DECLARE-don't-compute rule:

POINT continuity (take "at", single-value answers):
- "isContinuous"          → "continuous" or "discontinuous" at x = at.

GLOBAL continuity (NO "at" — these scan the WHOLE function; use as the SOLE ask
in the question). Each may carry a "mode" (phrasing): "discontinuous_at" |
"continuous_except". The composed statement lists BARE x-values only — it never
appends a discontinuity kind like "(removable)".
- "discontinuitySet" → every x where f is discontinuous.
- "removableSet"     → every x where the limit EXISTS but f is not continuous
                       (removable discontinuities only).
- "limitDNESet"      → every x where the two-sided limit does NOT exist (jumps +
                       infinite limits). NOTE: an infinite limit COUNTS as "the
                       limit does not exist".

Derived answers are reported as: a number verbatim; an infinite limit as the
text "infinity" / "-infinity" (mini-syntax — never the ∞ glyph); a
nonexistent / undefined result as "does not exist (DNE)"; a continuity set as a
canonical sorted statement, e.g. "f is discontinuous at x = 1 and x = 3", or
"f is continuous everywhere" when empty.

For Multiple Choice POINT asks (limit / leftLimit / rightLimit / fValue /
isContinuous): still author 4 plausible choices. The system formats the DERIVED
value and matches it to one of your choices. If the derived truth is not among
your choices, the question is REJECTED — so make sure the correct value is
present verbatim (e.g. include "4", "does not exist (DNE)", "infinity",
"continuous" as appropriate).

For Multiple Choice GLOBAL continuity asks (discontinuitySet / removableSet /
limitDNESet): supply DISTRACTORS ONLY — plausible but WRONG statements in the SAME
bare format as the correct one, e.g. "f is discontinuous at x = 0 and x = 2"
(bare x-values, NO "(removable)/(jump)/(infinite)" kinds). The system composes the
correct statement from the derived set and injects it as the answer key (you
cannot set the correct answer). Provide at least 2 distractor choices.`;
