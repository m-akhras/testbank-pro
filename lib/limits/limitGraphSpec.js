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

// Interior-pole guard tuning (clamped multi-level refinement). A segment must be
// continuous on its own (from, to) interval — any UNdeclared blow-up strictly
// inside is rejected. A genuine pole's local max grows without bound as we zoom;
// a steep-but-finite curve (exp, x^3) plateaus. We refine POLE_LEVELS times,
// ×10 closer each level (clamped to the interior so a legal boundary VA can't be
// chased into), and flag divergence when the final max exceeds POLE_CAP AND grew
// by ≥ POLE_GROWTH across the last two levels — or any sample is ±Infinity.
const POLE_CAP = 1e7;
const POLE_GROWTH = 5;
const POLE_LEVELS = 6;
const POLE_SCAN_PTS = 100;
const POLE_BOUNDARY_PROBE = 1e-4;
// Saturation cutoff: when a sample lands within machine-epsilon of a pole the
// value is already astronomical (~1e15) and can't grow further, so the growth
// test alone misses it. A magnitude this large only arises from sitting on a
// pole — the interior scan stays ≥ 1e-4 from each boundary (δ floor), so a legal
// boundary asymptote reads at most ~2e4 here and never trips this.
const POLE_SATURATE = 1e12;

// Scan |fn| over [lo, hi]; return the max of FINITE samples and its x. NaN is
// ignored (a removable hole reads 0/0 = NaN but is bounded nearby — not a pole),
// while ±Infinity is a definite pole hit (sawInfinity).
function _scanMaxAbs(fn, lo, hi, n) {
  let max = -1;
  let maxX = (lo + hi) / 2;
  let sawInfinity = false;
  for (let i = 0; i <= n; i++) {
    const x = lo + (hi - lo) * (i / n);
    const v = fn(x);
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (!Number.isFinite(v)) { sawInfinity = true; maxX = x; continue; }
    if (Math.abs(v) > max) { max = Math.abs(v); maxX = x; }
  }
  return { max, maxX, sawInfinity };
}

// Does fn diverge STRICTLY INSIDE [lo, hi]? Clamped refinement around the running
// max; every zoom window stays within [lo, hi] so a boundary pole just outside
// can't be walked into.
function _interiorDiverges(fn, lo, hi) {
  let a = lo;
  let b = hi;
  let prev = 0;
  let last = 0;
  let lastX = (lo + hi) / 2;
  for (let lvl = 0; lvl < POLE_LEVELS; lvl++) {
    const { max, maxX, sawInfinity } = _scanMaxAbs(fn, a, b, POLE_SCAN_PTS);
    if (sawInfinity) return { diverges: true, x: maxX };
    prev = last;
    last = max;
    lastX = maxX;
    const w = (b - a) / POLE_SCAN_PTS;
    a = Math.max(lo, maxX - w);
    b = Math.min(hi, maxX + w);
  }
  // Regime A: grid landed essentially ON the pole → astronomically large, can't
  // grow further. Regime B: pole off-grid → max climbs steadily under refinement.
  if (last > POLE_SATURATE) return { diverges: true, x: lastX };
  if (last > POLE_CAP && prev > 0 && last / prev >= POLE_GROWTH) {
    return { diverges: true, x: lastX };
  }
  return { diverges: false };
}

// Does fn diverge approaching boundary `b` from INSIDE the segment? `dir` is +1
// for a `from` endpoint (sample to the right) or -1 for a `to` endpoint (sample
// to the left). A huge value at b ∓ 1e-4 that GROWS at b ∓ 1e-5 (or a ±Infinity)
// signals a boundary pole; a merely-large-but-stable value does not.
function _boundaryDiverges(fn, b, dir) {
  const v1 = fn(b + dir * POLE_BOUNDARY_PROBE);
  if (typeof v1 !== "number" || Number.isNaN(v1)) return false;
  if (!Number.isFinite(v1)) return true; // ±Infinity exactly inside the boundary
  if (Math.abs(v1) <= VA_FINITE_LIMIT) return false;
  const v2 = fn(b + dir * (POLE_BOUNDARY_PROBE / 10));
  if (typeof v2 !== "number" || Number.isNaN(v2)) return false;
  if (!Number.isFinite(v2)) return true;
  return Math.abs(v2) > Math.abs(v1) * 2; // growing toward the boundary
}

function _hasVADeclaredAt(vas, x) {
  return vas.some((va) => va && isFiniteNumber(va.x) && Math.abs(va.x - x) < 1e-9);
}

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

  // Undeclared-pole guard. Option A requires each segment to be CONTINUOUS on its
  // own (from, to) interval; divergence is legal only AT a boundary that declares
  // a vertical asymptote. Part A rejects a blow-up STRICTLY INSIDE the interval;
  // Part B rejects a blow-up AT a from/to endpoint with no VA declared there.
  const declaredVAs = Array.isArray(spec.verticalAsymptotes) ? spec.verticalAsymptotes : [];
  spec.segments.forEach((s, i) => {
    const fn = compileExpression(s.fn, ["x"]);
    if (!fn) return; // already validated above; defensive
    const span = s.to - s.from;
    const delta = Math.min(1e-2, Math.max(1e-4, span * 1e-3));
    const lo = s.from + delta;
    const hi = s.to - delta;

    // PART A — interior pole.
    if (lo < hi) {
      const res = _interiorDiverges(fn, lo, hi);
      if (res.diverges) {
        const approxX = Math.round(res.x * 1000) / 1000;
        fail(
          `segments[${i}].fn ("${s.fn}") diverges at the interior point x≈${approxX} ` +
          `on (${s.from}, ${s.to}) — each segment must be continuous on its own interval; ` +
          `declare a vertical asymptote at a segment boundary instead`
        );
      }
    }

    // PART B — boundary pole with no declared VA (legal only when a VA is declared
    // at that boundary; the phantom-VA guard above already confirmed declared VAs
    // are real).
    if (_boundaryDiverges(fn, s.from, +1) && !_hasVADeclaredAt(declaredVAs, s.from)) {
      fail(
        `segments[${i}].fn ("${s.fn}") diverges at the boundary x=${s.from} ` +
        `but no vertical asymptote is declared there`
      );
    }
    if (_boundaryDiverges(fn, s.to, -1) && !_hasVADeclaredAt(declaredVAs, s.to)) {
      fail(
        `segments[${i}].fn ("${s.fn}") diverges at the boundary x=${s.to} ` +
        `but no vertical asymptote is declared there`
      );
    }
  });

  return spec;
}
