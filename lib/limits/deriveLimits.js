// §2.2 — derive the limit facts of a declared limit-graph spec at a point.
//
// PURE + deterministic: no DOM, no rendering, no side effects. Given a spec (see
// limitGraphSpec.js) and a query point `at`, it reports the left/right/two-sided
// limits, the function value, continuity, and the kind of discontinuity. This is
// Option A: every discontinuity is DECLARED in the spec (holes / points / VAs),
// so we never try to *detect* singularities — we read declarations and evaluate
// the continuous segments at boundaries, approaching `at` (never landing on it
// where a hole/VA lives).
//
// Segment fns are evaluated with the shared compileExpression util
// (lib/utils/exprCompile.js) — no second evaluator is introduced.

import { compileExpression } from "../utils/exprCompile.js";
import { validateLimitSpec } from "./limitGraphSpec.js";

// How far to step away from `at` when sampling a one-sided limit. Small enough
// that the rounding below absorbs the curvature error for the polynomial / trig
// / exponential forms these graphs use, large enough to stay clear of float
// underflow for the small integer coordinates limit problems live in.
const STEP = 1e-8;

// Clean float noise from a sampled value: round to 6 decimals and normalize -0.
// Returns null for non-finite results (so a stray NaN never escapes as a value).
function cleanNum(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

// Evaluate a segment's fn at exactly `x`.
function evalAt(seg, x) {
  const fn = compileExpression(seg.fn, ["x"]);
  if (!fn) return null;
  return cleanNum(fn(x));
}

// Approach `at` from one side along a segment by sampling at `at ∓ STEP`.
function evalApproach(seg, at, side) {
  const x = side === "left" ? at - STEP : at + STEP;
  return evalAt(seg, x);
}

// Segment covering the immediate LEFT neighbourhood of `at`:
// either `at` is the segment's right end, or strictly interior.
function leftSegment(segments, at) {
  return segments.find((s) => s.from < at && at <= s.to) || null;
}

// Segment covering the immediate RIGHT neighbourhood of `at`.
function rightSegment(segments, at) {
  return segments.find((s) => s.from <= at && at < s.to) || null;
}

// Segment for which `at` is an actually-defined (filled) point:
// strictly interior, or a closed endpoint.
function closedSegmentAt(segments, at) {
  return (
    segments.find((s) => {
      if (s.from < at && at < s.to) return true; // interior is always filled
      if (at === s.to && !s.openRight) return true;
      if (at === s.from && !s.openLeft) return true;
      return false;
    }) || null
  );
}

// Combine the two one-sided limits into the two-sided limit.
//  - equal finite L=R           → that value
//  - same infinity on both      → that infinity
//  - any mismatch / DNE side    → null
function combineTwoSided(L, R) {
  if (L === null || R === null) return null;
  if (typeof L === "number" && typeof R === "number") {
    return L === R ? L : null;
  }
  // at least one side is an infinity
  return L === R ? L : null;
}

/**
 * @param {import("./limitGraphSpec.js").LimitSpec} spec
 * @param {number} at
 * @returns {{
 *   at: number,
 *   leftLimit: number|"+inf"|"-inf"|null,
 *   rightLimit: number|"+inf"|"-inf"|null,
 *   twoSided: number|"+inf"|"-inf"|null,
 *   fValue: number|null,
 *   continuous: boolean,
 *   discontinuityKind: "none"|"removable"|"jump"|"infinite",
 *   verticalAsymptotes: number[],
 * }}
 */
export function deriveLimits(spec, at) {
  validateLimitSpec(spec);

  const segments = spec.segments || [];
  const holes = spec.holes || [];
  const points = spec.points || [];
  const vas = spec.verticalAsymptotes || [];

  const va = vas.find((v) => v.x === at) || null;

  // --- one-sided limits ---
  let leftLimit;
  let rightLimit;
  if (va) {
    leftLimit = va.leftSign;
    rightLimit = va.rightSign;
  } else {
    const ls = leftSegment(segments, at);
    const rs = rightSegment(segments, at);
    leftLimit = ls ? evalApproach(ls, at, "left") : null;
    rightLimit = rs ? evalApproach(rs, at, "right") : null;
  }

  const twoSided = combineTwoSided(leftLimit, rightLimit);

  // --- f(at) ---
  let fValue;
  const pt = points.find((p) => p.x === at);
  if (pt) {
    fValue = cleanNum(pt.y); // declared filled override wins
  } else if (holes.some((h) => h.x === at)) {
    fValue = null; // declared removable hole → undefined at `at`
  } else {
    const cs = closedSegmentAt(segments, at);
    fValue = cs ? evalAt(cs, at) : null;
  }

  // --- classification ---
  let discontinuityKind;
  if (va) {
    discontinuityKind = "infinite";
  } else if (typeof leftLimit === "number" && typeof rightLimit === "number") {
    if (leftLimit === rightLimit) {
      discontinuityKind =
        fValue !== null && fValue === twoSided ? "none" : "removable";
    } else {
      discontinuityKind = "jump";
    }
  } else {
    // one side has no segment (domain endpoint / undefined): not an interior
    // discontinuity.
    discontinuityKind = "none";
  }

  const continuous =
    typeof twoSided === "number" && fValue !== null && twoSided === fValue;

  return {
    at,
    leftLimit,
    rightLimit,
    twoSided,
    fValue,
    continuous,
    discontinuityKind,
    verticalAsymptotes: vas.map((v) => v.x),
  };
}
