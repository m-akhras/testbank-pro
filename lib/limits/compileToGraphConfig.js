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

  return {
    type: "piecewise",
    pieces,
    holes,
    points,
    verticalAsymptotes: vas.map((v) => v.x),
    xDomain,
  };
}
