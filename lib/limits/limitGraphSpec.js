// §2.2 limit-graph spec schema (Option A — all discontinuities are DECLARED,
// never detected). One spec describes ONE function semantically: a list of
// continuous segments plus declared holes, filled-point overrides, and
// vertical asymptotes. Nothing here renders or evaluates limits — that lives in
// deriveLimits.js. This file only defines the shape and validates it.
//
// Segment fns are mini-expression strings in the SAME dialect used everywhere
// else in the app; they are compiled with the shared compileExpression util
// (lib/utils/exprCompile.js). We do NOT introduce a second evaluator.
//
// @typedef {Object} LimitSegment
// @property {string}  fn         mini-expression in `x` (e.g. "x+2", "2^x")
// @property {number}  from       left end of the segment's interval
// @property {number}  to         right end of the segment's interval (from < to)
// @property {boolean} [openLeft]  true → open circle at `from` (limit-only)
// @property {boolean} [openRight] true → open circle at `to`   (limit-only)
//
// @typedef {Object} LimitHole    declared removable point (open circle)
// @property {number} x
// @property {number} y
//
// @typedef {Object} LimitPoint   declared filled f(a) override
// @property {number} x
// @property {number} y
//
// @typedef {Object} LimitVA      declared vertical asymptote
// @property {number} x
// @property {"+inf"|"-inf"} leftSign   behavior approaching x from the left
// @property {"+inf"|"-inf"} rightSign  behavior approaching x from the right
//
// @typedef {Object} LimitSpec
// @property {LimitSegment[]} segments
// @property {LimitHole[]}    [holes]
// @property {LimitPoint[]}   [points]
// @property {LimitVA[]}      [verticalAsymptotes]

import { compileExpression } from "../utils/exprCompile.js";

export const INF_SIGNS = ["+inf", "-inf"];

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function fail(msg) {
  throw new Error(`Invalid limit spec: ${msg}`);
}

// Phantom-VA guard tuning: how far from the declared asymptote to sample a
// covering segment, and the magnitude below which the segment is considered
// "finite" (i.e. NOT actually diverging) at that point. A genuine 1/(x-a) form
// sampled at a ∓ 1e-4 reads ~1e4, comfortably above the threshold.
const VA_PROBE = 1e-4;
const VA_FINITE_LIMIT = 1e3;

// Validate `spec` in place; throws on malformed input. Returns the same spec so
// callers can write `const s = validateLimitSpec(raw)`. Missing optional arrays
// (holes / points / verticalAsymptotes) are allowed and treated as empty; an
// absent or non-array `segments` is an error.
export function validateLimitSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    fail("spec must be an object");
  }

  if (!Array.isArray(spec.segments)) {
    fail("`segments` must be an array");
  }
  spec.segments.forEach((seg, i) => {
    if (!seg || typeof seg !== "object") fail(`segments[${i}] must be an object`);
    if (typeof seg.fn !== "string" || !seg.fn.trim()) {
      fail(`segments[${i}].fn must be a non-empty string`);
    }
    if (compileExpression(seg.fn, ["x"]) === null) {
      fail(`segments[${i}].fn ("${seg.fn}") is not a compilable expression`);
    }
    if (!isFiniteNumber(seg.from)) fail(`segments[${i}].from must be a finite number`);
    if (!isFiniteNumber(seg.to)) fail(`segments[${i}].to must be a finite number`);
    if (!(seg.from < seg.to)) fail(`segments[${i}]: require from < to`);
    if (seg.openLeft !== undefined && typeof seg.openLeft !== "boolean") {
      fail(`segments[${i}].openLeft must be a boolean`);
    }
    if (seg.openRight !== undefined && typeof seg.openRight !== "boolean") {
      fail(`segments[${i}].openRight must be a boolean`);
    }
  });

  const checkPointList = (list, key) => {
    if (list === undefined) return;
    if (!Array.isArray(list)) fail(`\`${key}\` must be an array`);
    list.forEach((p, i) => {
      if (!p || typeof p !== "object") fail(`${key}[${i}] must be an object`);
      if (!isFiniteNumber(p.x)) fail(`${key}[${i}].x must be a finite number`);
      if (!isFiniteNumber(p.y)) fail(`${key}[${i}].y must be a finite number`);
    });
  };
  checkPointList(spec.holes, "holes");
  checkPointList(spec.points, "points");

  if (spec.verticalAsymptotes !== undefined) {
    if (!Array.isArray(spec.verticalAsymptotes)) {
      fail("`verticalAsymptotes` must be an array");
    }
    spec.verticalAsymptotes.forEach((va, i) => {
      if (!va || typeof va !== "object") fail(`verticalAsymptotes[${i}] must be an object`);
      if (!isFiniteNumber(va.x)) fail(`verticalAsymptotes[${i}].x must be a finite number`);
      if (!INF_SIGNS.includes(va.leftSign)) {
        fail(`verticalAsymptotes[${i}].leftSign must be one of ${INF_SIGNS.join(", ")}`);
      }
      if (!INF_SIGNS.includes(va.rightSign)) {
        fail(`verticalAsymptotes[${i}].rightSign must be one of ${INF_SIGNS.join(", ")}`);
      }

      // Phantom-VA guard: a declared VA must sit where a covering/bordering
      // segment actually diverges. Sample each segment that covers a side of a
      // at a ∓ 1e-4; if a covering segment is FINITE (and not large) there, the
      // VA is bogus (the function doesn't blow up) — reject it so deriveLimits
      // can't report ±infinity where the curve is finite, and the renderer can't
      // draw a phantom dashed line. A VA in a GAP (no covering segment) is left
      // alone — there's nothing to contradict it.
      const a = va.x;
      let covered = false;
      let phantom = null; // first finite, non-divergent witness
      spec.segments.forEach((s) => {
        const fn = compileExpression(s.fn, ["x"]);
        if (!fn) return; // already validated above; defensive
        const samples = [];
        if (s.from < a && a <= s.to) samples.push(a - VA_PROBE); // left side covered
        if (s.from <= a && a < s.to) samples.push(a + VA_PROBE); // right side covered
        for (const x of samples) {
          covered = true;
          const v = fn(x);
          if (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < VA_FINITE_LIMIT) {
            if (phantom === null) phantom = { fn: s.fn, v };
          }
        }
      });
      if (covered && phantom) {
        const approx = Math.round(phantom.v * 100) / 100;
        fail(
          `verticalAsymptotes[${i}]: declared vertical asymptote at x=${a} but segment ` +
          `"${phantom.fn}" is finite there (~${approx})`
        );
      }
    });
  }

  return spec;
}
