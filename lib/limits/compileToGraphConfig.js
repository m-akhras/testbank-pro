// §2.2 Phase 2 — compile a declared limit-graph spec (limitGraphSpec.js) into the
// EXISTING type:"piecewise" graphConfig that lib/exports/graphRendering.js already
// renders. This is a PURE transform: no rendering, no I/O. It only produces the
// config object; nothing in the renderer is touched.
//
// Renderer contract matched (graphRendering.js piecewise branch, ~L919):
//   cfg.type    === "piecewise"
//   cfg.pieces  = [{ fn, domain:[x0,x1], extendsLeft?, extendsRight? }]
//   cfg.holes   = [[x, y], ...]   → drawn as OPEN circles
//   cfg.points  = [[x, y], ...]   → drawn as FILLED dots
//   cfg.xDomain = [min, max]      (defaults to [-5,5]); yDomain auto-scales.
// The renderer has NO per-piece open/closed flag, so a segment's open endpoint
// is expressed by emitting an open-circle entry in cfg.holes at that coordinate.
// cfg.verticalAsymptotes is an ADDITIVE field the renderer currently ignores;
// Phase 3 will teach it to draw them.

import { compileExpression } from "../utils/exprCompile.js";
import { validateLimitSpec } from "./limitGraphSpec.js";

const round1 = (n) => Math.round(n * 10) / 10;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const hasCoord = (list, x, y) => list.some(([X, Y]) => near(X, x) && near(Y, y));

// Evaluate a segment fn at exactly x (used only for OPEN-ENDPOINT y values,
// never for declared holes — declared holes carry their own y so we never sample
// a fn at its singularity).
function evalAt(fn, x) {
  const f = compileExpression(fn, ["x"]);
  if (!f) return null;
  const v = f(x);
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 1e6) / 1e6;
}

/**
 * @param {import("./limitGraphSpec.js").LimitSpec} spec
 * @returns {{
 *   type: "piecewise",
 *   pieces: {fn:string, domain:[number,number]}[],
 *   holes: [number,number][],
 *   points: [number,number][],
 *   verticalAsymptotes: number[],
 *   xDomain: [number,number],
 * }}
 */
export function compileToGraphConfig(spec) {
  validateLimitSpec(spec);

  const segments = spec.segments || [];
  const holesIn = spec.holes || [];
  const pointsIn = spec.points || [];
  const vas = spec.verticalAsymptotes || [];

  const pieces = segments.map((s) => ({ fn: s.fn, domain: [s.from, s.to] }));

  // Filled dots: declared overrides.
  const points = pointsIn.map((p) => [p.x, p.y]);

  // Open circles: declared holes first, then segment open-endpoints (deduped by
  // coordinate against holes already present AND against filled points so a jump
  // keeps BOTH its open circle and its differing filled dot).
  const holes = holesIn.map((h) => [h.x, h.y]);
  segments.forEach((s) => {
    if (s.openLeft) {
      const y = evalAt(s.fn, s.from);
      if (y !== null && !hasCoord(holes, s.from, y) && !hasCoord(points, s.from, y)) {
        holes.push([s.from, y]);
      }
    }
    if (s.openRight) {
      const y = evalAt(s.fn, s.to);
      if (y !== null && !hasCoord(holes, s.to, y) && !hasCoord(points, s.to, y)) {
        holes.push([s.to, y]);
      }
    }
  });

  // x-axis bounds from every declared x (segment ends + VAs), padded.
  const allX = [
    ...segments.flatMap((s) => [s.from, s.to]),
    ...vas.map((v) => v.x),
  ];
  let xDomain;
  if (allX.length) {
    const lo = Math.min(...allX);
    const hi = Math.max(...allX);
    const pad = Math.max((hi - lo) * 0.1, 0.5);
    xDomain = [round1(lo - pad), round1(hi + pad)];
  } else {
    xDomain = [-5, 5];
  }

  // Label x integers across the domain: step 1 for small spans, scaled up so a
  // wide domain still shows ~12 labels (otherwise the renderer's nice-number
  // ticker thins integers to even-only). The renderer treats xTickStep as
  // optional — configs without it are unaffected.
  const xSpan = xDomain[1] - xDomain[0];
  const xTickStep = xSpan <= 12 ? 1 : Math.ceil(xSpan / 12);

  return {
    type: "piecewise",
    pieces,
    holes,
    points,
    verticalAsymptotes: vas.map((v) => v.x),
    xDomain,
    xTickStep,
  };
}

// Readable cap on the FEATURE span (the y-values the question needs the student
// to read). Aligned with the GRAPH_LIMIT_LAWS contract, which tells the model to
// keep values within roughly [-8, 8] (a span of 16) — so a contract-obeying spec
// is never rejected by our own guard. With ±2 integer padding the resulting
// yDomain span stays ≈ ≤ 20.
const Y_FEATURE_SPAN_CAP = 16;

// The y-values a §2.3 question depends on being READABLE: declared holes, filled
// points, and each segment's value at its from/to boundaries. NON-finite endpoint
// values (a removable-hole singularity, or a VA-bordering blow-up) are skipped —
// the hole carries its own declared y, and a VA must not drag the scale to ∞.
function featureYsForSpec(spec) {
  const ys = [];
  (spec.holes || []).forEach((h) => {
    if (typeof h.y === "number" && Number.isFinite(h.y)) ys.push(h.y);
  });
  (spec.points || []).forEach((p) => {
    if (typeof p.y === "number" && Number.isFinite(p.y)) ys.push(p.y);
  });
  (spec.segments || []).forEach((s) => {
    const a = evalAt(s.fn, s.from);
    const b = evalAt(s.fn, s.to);
    if (a !== null) ys.push(a);
    if (b !== null) ys.push(b);
  });
  return ys;
}

// §2.3 Limit Laws — compile TWO limitSpecs (f and g) into ONE graphConfig that the
// renderer draws as ONE shared graph (f blue, g red) in a single SVG. Each
// sub-config is produced by the SAME compileToGraphConfig (validated there:
// phantom-VA / interior-pole guards). One graphConfig per question → QTI/Word
// export unchanged.
//
// The shared yDomain is FEATURE-DRIVEN (not curve-max-driven): scaled to the union
// of both specs' feature y-values so holes/dots/endpoints stay readable; a
// fast-growing segment simply runs off the top/bottom (the renderer clips it). If
// the features themselves can't fit a readable span, the spec is unreadable and we
// REJECT it (fail closed, rides pasteError). A matching yTickStep is emitted so
// integer y ticks are labeled across the domain (mirrors xTickStep).
export function compileToFunctionPairConfig(specF, specG) {
  const f = compileToGraphConfig(specF);
  const g = compileToGraphConfig(specG);

  const ys = [...featureYsForSpec(specF), ...featureYsForSpec(specG)];
  let yDomain;
  let yTickStep;
  if (ys.length) {
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    if (hi - lo > Y_FEATURE_SPAN_CAP) {
      throw new Error(
        `Invalid functionPair: the graph's feature values span ${round1(hi - lo)} ` +
        `(> ${Y_FEATURE_SPAN_CAP}), which is unreadable. Use slower-growing expressions ` +
        `or narrower domains so segment values and declared points fit a readable range.`
      );
    }
    yDomain = [Math.floor(lo) - 2, Math.ceil(hi) + 2];
    const ySpan = yDomain[1] - yDomain[0];
    yTickStep = ySpan <= 12 ? 1 : Math.ceil(ySpan / 12);
  } else {
    yDomain = [-5, 5];
    yTickStep = 1;
  }

  return { type: "functionPair", f, g, yDomain, yTickStep };
}
