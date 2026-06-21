// §2.6 limits at infinity — the apply layer (twin of applyLimitSpec).
//
// PURE + deterministic: no DOM, no I/O, no mutation of the input. Given a question
// carrying a "limitAtInfinitySpec" (a core derive-spec + a pole-free display curve)
// and an "asks" list, it returns a NEW question with:
//   - graphConfig: a type:"single" curve (graph.fn over graph.xDomain) carrying the
//     DERIVED horizontal asymptotes (so the renderer draws dashed HA lines)
//   - answer / explanation DERIVED from the core spec (never trusted from the model)
// For Multiple Choice / True-False the derived answer text must match one of the
// model's own choices (shared lenient matcher) — else the question is provably
// broken and we THROW.
//
// A question without a limitAtInfinitySpec is returned UNCHANGED (no-op), exactly
// like applyLimitSpec for non-§2.2 questions.
//
// NEW GUARD (the §2.6 analog of the §2.2 phantom-VA guard): the DECLARED display
// curve must be (a) pole-free across its window and (b) tail-consistent with the
// DERIVED end behavior — a curve that contradicts its own answer key is rejected.
//
// Reuses (does not reimplement): deriveLimitAtInfinity, describeEndBehavior /
// formatLimitValue, _findCorrectChoiceIdx, compileExpression.

import { deriveLimitAtInfinity } from "./limitsAtInfinity.js";
import { describeEndBehavior, formatLimitValue } from "./composeAtInfinity.js";
import { _findCorrectChoiceIdx } from "../utils/questions.js";
import { compileExpression } from "../utils/exprCompile.js";

// Magnitude a divergent tail must clear at |x| = 1000 to count as "blowing up" with
// the right sign (a genuine degree-gap divergence reads ≥ ~1000 there).
const TAIL_BIG = 100;
// |fn| beyond this during sign-change refinement signals a real pole, not a zero
// crossing (a zero crossing refines toward 0; a pole refines toward ±infinity).
const POLE_CAP = 1e6;

// Does fn blow up between a sign-changing adjacent pair? Bisect toward the sign
// change tracking max |fn|: a pole drives it past POLE_CAP (or hits a non-finite
// sample); a mere zero crossing converges to 0 and never does.
function bisectDiverges(fn, a, b) {
  let fa = fn(a);
  let maxAbs = 0;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const fm = fn(m);
    if (!Number.isFinite(fm)) return true;
    if (Math.abs(fm) > maxAbs) maxAbs = Math.abs(fm);
    if (maxAbs > POLE_CAP) return true;
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else { b = m; }
  }
  return maxAbs > POLE_CAP;
}

// Is there a pole in (or right at) [lo, hi]? Fine sampling catches a pole landing on
// a sample (non-finite); a large-magnitude sign change between adjacent samples is
// refined by bisection to tell a pole from an ordinary zero crossing.
function hasInWindowPole(fn, lo, hi) {
  const N = 600;
  let prevY = null;
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    const y = fn(x);
    if (!Number.isFinite(y)) return true;
    if (prevY !== null && y !== 0 && prevY !== 0 && Math.sign(y) !== Math.sign(prevY)) {
      const xPrev = lo + ((hi - lo) * (i - 1)) / N;
      if (bisectDiverges(fn, xPrev, x)) return true;
    }
    prevY = y;
  }
  return false;
}

// Does the curve's tail value agree with the DERIVED end value?
//  - finite V:  within 0.05·(1+|V|) of V
//  - pinf/ninf: large with the matching sign
//  - finiteSym: skipped (those are symbolic-only and never reach here — guarded)
function tailMatches(fnVal, end) {
  if (end.kind === "finite") {
    const V = end.num / end.den;
    return Math.abs(fnVal - V) <= 0.05 * (1 + Math.abs(V));
  }
  if (end.kind === "pinf") return fnVal > TAIL_BIG;
  if (end.kind === "ninf") return fnVal < -TAIL_BIG;
  return true;
}

// Per-ask answer value (string) from the formatted end-behavior description.
function valueFor(quantity, desc) {
  switch (quantity) {
    case "limitAtPlusInf": return desc.plus;
    case "limitAtMinusInf": return desc.minus;
    case "horizontalAsymptotes": return desc.horizontalAsymptotes;
    case "endBehavior":
      return `as x→infinity, f(x)→${desc.plus}; as x→-infinity, f(x)→${desc.minus}`;
    default:
      throw new Error(`§2.6 unknown ask quantity "${quantity}"`);
  }
}

// Human-readable label for one ask (multi-ask answer text only).
function labelFor(quantity) {
  switch (quantity) {
    case "limitAtPlusInf": return "the limit as x approaches infinity";
    case "limitAtMinusInf": return "the limit as x approaches -infinity";
    case "horizontalAsymptotes": return "the horizontal asymptote(s)";
    case "endBehavior": return "the end behavior";
    default:
      throw new Error(`§2.6 unknown ask quantity "${quantity}"`);
  }
}

/**
 * @param {object} q a generated question, possibly carrying q.limitAtInfinitySpec / q.asks
 * @returns {object} a new question (or the same reference when no limitAtInfinitySpec)
 */
export function applyLimitAtInfinitySpec(q) {
  if (!q || !q.limitAtInfinitySpec) return q; // no-op

  const { derive, graph } = q.limitAtInfinitySpec;
  if (!derive || !graph) {
    throw new Error("§2.6 limitAtInfinitySpec requires both a derive spec and a graph block");
  }

  const result = deriveLimitAtInfinity(derive);
  if (!result.plus || result.plus.kind === "unsupported") {
    throw new Error("§2.6 derive spec is unsupported by the limit-at-infinity engine — rejected");
  }

  // SYMBOLIC-ONLY GUARD: arctan & friends derive to finiteSym (e.g. pi/2); those are
  // symbolic-only and must NOT carry a graph block (graph_at_infinity is rational /
  // algebraic-root only, by design).
  if (result.plus.kind === "finiteSym" || result.minus.kind === "finiteSym") {
    throw new Error(
      "§2.6 special/finiteSym limits are symbolic-only; omit the graph block for this spec"
    );
  }

  const fn = compileExpression(graph.fn, ["x"]);
  if (!fn) {
    throw new Error("§2.6 graph.fn is not a compilable expression");
  }
  const xd = graph.xDomain;
  if (
    !Array.isArray(xd) || xd.length < 2 ||
    !Number.isFinite(xd[0]) || !Number.isFinite(xd[1]) || !(xd[0] < xd[1])
  ) {
    throw new Error("§2.6 graph.xDomain must be [lo, hi] with finite lo < hi");
  }
  const [lo, hi] = xd;

  // GRAPH/DERIVE CONSISTENCY GUARD. (a) The curve must be finite everywhere in the
  // window and at large |x|; (b) its far tails must trend toward the derived limits.
  const big = [50, 200, 1000, -50, -200, -1000];
  for (const x of big) {
    if (!Number.isFinite(fn(x))) {
      throw new Error("§2.6 graph fn diverges in-window — graph_at_infinity curves must be pole-free");
    }
  }
  if (hasInWindowPole(fn, lo, hi)) {
    throw new Error("§2.6 graph fn diverges in-window — graph_at_infinity curves must be pole-free");
  }
  if (!tailMatches(fn(1000), result.plus) || !tailMatches(fn(-1000), result.minus)) {
    throw new Error("§2.6 graph fn tail contradicts derived limit (declared curve and answer key disagree)");
  }

  const out = { ...q };
  out.graphConfig = {
    type: "single",
    fn: graph.fn,
    xDomain: [lo, hi],
    showAxisNumbers: true,
    showGrid: true,
    horizontalAsymptotes: result.horizontalAsymptotes.map((v) => ({
      y: v.num / v.den,
      label: formatLimitValue(v),
    })),
  };
  out.hasGraph = true;

  const desc = describeEndBehavior(result);

  const asks = Array.isArray(q.asks) ? q.asks : [];
  if (asks.length === 0) return out; // graph only; nothing to grade

  out.explanation =
    `As x approaches infinity, f(x) approaches ${desc.plus}; as x approaches -infinity, ` +
    `f(x) approaches ${desc.minus}. Horizontal asymptotes: ${desc.horizontalAsymptotes}.`;

  const answerText =
    asks.length === 1
      ? valueFor(asks[0].quantity, desc)
      : asks.map((a) => `${labelFor(a.quantity)} = ${valueFor(a.quantity, desc)}`).join("; ");

  const isMC = q.type === "Multiple Choice" || q.type === "True/False";
  if (isMC) {
    const idx = _findCorrectChoiceIdx({ choices: q.choices || [], answer: answerText });
    if (idx < 0) {
      throw new Error(`§2.6 derived answer "${answerText}" is not among the choices — rejected`);
    }
    out.answer = (q.choices || [])[idx];
  } else {
    out.answer = answerText;
  }

  return out;
}
