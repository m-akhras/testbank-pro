"use client";

// Region-of-integration renderer. Pure SVG, hatch-shaded interior + crisp
// boundary curves on top + intersection-point dots + axis tick labels.
// Boundaries arrive in traversal order; each is converted to a polyline of
// 50 sample points (or 64 along an arc for circles), all concatenated into
// one closed path that gets the hatch fill.

import { compileExpression } from "../../lib/utils/exprCompile.js";
import { svgToBase64PNG, escXml } from "./svgRasterize.js";
import { mathToSvgTspans } from "../../lib/utils/svgMath.js";

const PANEL_W = 300;
const PANEL_H = 280;
const MARGIN  = 22;

let _hatchCounter = 0;
function _nextHatchId() { return `rgnHatch${++_hatchCounter}`; }

function _boundaryPoints(b, xToScreen, yToScreen) {
  if (!b) return [];
  if (b.kind === "function") {
    const fn = compileExpression(b.expr, ["x"]);
    if (!fn) return [];
    const from = Number(b.from), to = Number(b.to);
    if (!isFinite(from) || !isFinite(to)) return [];
    const N = 50;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = from + (to - from) * (i / N);
      let y;
      try { y = Number(fn(x)); } catch (_e) { continue; }
      if (!isFinite(y)) continue;
      pts.push([xToScreen(x), yToScreen(y)]);
    }
    return pts;
  }
  if (b.kind === "function_y") {
    const fn = compileExpression(b.expr, ["y"]);
    if (!fn) return [];
    const from = Number(b.from), to = Number(b.to);
    if (!isFinite(from) || !isFinite(to)) return [];
    const N = 50;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const y = from + (to - from) * (i / N);
      let x;
      try { x = Number(fn(y)); } catch (_e) { continue; }
      if (!isFinite(x)) continue;
      pts.push([xToScreen(x), yToScreen(y)]);
    }
    return pts;
  }
  if (b.kind === "line") {
    if (!Array.isArray(b.from) || !Array.isArray(b.to) || b.from.length < 2 || b.to.length < 2) {
      console.warn("RegionGraph: line boundary malformed", b);
      return [];
    }
    const fx = Number(b.from[0]), fy = Number(b.from[1]);
    const tx = Number(b.to[0]),   ty = Number(b.to[1]);
    if (!isFinite(fx) || !isFinite(fy) || !isFinite(tx) || !isFinite(ty)) {
      console.warn("RegionGraph: line boundary has non-finite coords", b);
      return [];
    }
    return [
      [xToScreen(fx), yToScreen(fy)],
      [xToScreen(tx), yToScreen(ty)],
    ];
  }
  if (b.kind === "circle") {
    const c = Array.isArray(b.center) ? b.center : [0, 0];
    const r = Number(b.radius);
    if (!(r > 0)) return [];
    const a0 = (b.arcFrom == null ? 0   : Number(b.arcFrom)) * Math.PI / 180;
    const a1 = (b.arcTo   == null ? 360 : Number(b.arcTo))   * Math.PI / 180;
    const N = 64;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + (a1 - a0) * (i / N);
      pts.push([xToScreen(c[0] + r * Math.cos(a)), yToScreen(c[1] + r * Math.sin(a))]);
    }
    return pts;
  }
  return [];
}

// Default screen-space label offset by boundary kind. Applied only when the
// caller (AI / instructor) hasn't supplied an explicit offsetX / offsetY.
// Picked so that labels sit close to the curve in the most common cases:
//   function (y = f(x))   → 8px above the curve
//   function_y (x = g(y)) → 8px to the right of the curve
//   line, vertical        → 8px to the right (e.g. "x = 4")
//   line, horizontal      → 12px below (e.g. "y = 0", room for descenders)
//   line, diagonal        → 8px above the line midpoint
//   circle / arc          → 8px above the arc anchor
function _defaultLabelOffsets(b) {
  if (b?.kind === "function")   return { offsetX: 0, offsetY: -8 };
  if (b?.kind === "function_y") return { offsetX: 8, offsetY: 0 };
  if (b?.kind === "circle")     return { offsetX: 0, offsetY: -8 };
  if (b?.kind === "line" && Array.isArray(b.from) && Array.isArray(b.to)) {
    const dx = Number(b.to[0]) - Number(b.from[0]);
    const dy = Number(b.to[1]) - Number(b.from[1]);
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx < 1e-9 && ady > 1e-9) return { offsetX: 8, offsetY: 0 };  // vertical
    if (ady < 1e-9 && adx > 1e-9) return { offsetX: 0, offsetY: 12 }; // horizontal
  }
  return { offsetX: 0, offsetY: -8 };
}

// Compute the screen-space anchor point for a boundary's label, sampled at
// the fraction `at` (0..1) along the curve. Returns null if the boundary or
// its expression is unparseable.
function _boundaryLabelAnchor(b, xToScreen, yToScreen) {
  const rawAt = b?.label?.at;
  const t = Math.max(0, Math.min(1, Number.isFinite(Number(rawAt)) ? Number(rawAt) : 0.5));
  if (b.kind === "function") {
    const fn = compileExpression(b.expr, ["x"]);
    if (!fn) return null;
    const x = Number(b.from) + t * (Number(b.to) - Number(b.from));
    let y;
    try { y = Number(fn(x)); } catch (_e) { return null; }
    if (!isFinite(y)) return null;
    return [xToScreen(x), yToScreen(y)];
  }
  if (b.kind === "function_y") {
    const fn = compileExpression(b.expr, ["y"]);
    if (!fn) return null;
    const y = Number(b.from) + t * (Number(b.to) - Number(b.from));
    let x;
    try { x = Number(fn(y)); } catch (_e) { return null; }
    if (!isFinite(x)) return null;
    return [xToScreen(x), yToScreen(y)];
  }
  if (b.kind === "line") {
    if (!Array.isArray(b.from) || !Array.isArray(b.to)) return null;
    const x = Number(b.from[0]) + t * (Number(b.to[0]) - Number(b.from[0]));
    const y = Number(b.from[1]) + t * (Number(b.to[1]) - Number(b.from[1]));
    if (!isFinite(x) || !isFinite(y)) return null;
    return [xToScreen(x), yToScreen(y)];
  }
  if (b.kind === "circle") {
    const c = Array.isArray(b.center) ? b.center : [0, 0];
    const r = Number(b.radius);
    if (!(r > 0)) return null;
    const a0 = (b.arcFrom == null ? 0   : Number(b.arcFrom)) * Math.PI / 180;
    const a1 = (b.arcTo   == null ? 360 : Number(b.arcTo))   * Math.PI / 180;
    const a = a0 + t * (a1 - a0);
    return [xToScreen(c[0] + r * Math.cos(a)), yToScreen(c[1] + r * Math.sin(a))];
  }
  return null;
}

export function buildRegionSvg(config, opts = {}) {
  const W = opts.width  || PANEL_W;
  const H = opts.height || PANEL_H;
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-1, 5];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-1, 5];
  const boundaries = Array.isArray(config?.boundaries) ? config.boundaries : [];
  const vertices   = Array.isArray(config?.vertices)   ? config.vertices   : [];
  const shaded     = config?.shaded !== false;
  const hatchAngle = Number.isFinite(Number(config?.hatchAngle)) ? Number(config.hatchAngle) : 45;
  const axisLabels = config?.axisLabels || { x: [], y: [] };

  const innerW = W - 2 * MARGIN;
  const innerH = H - 2 * MARGIN;
  const xToScreen = x => MARGIN + ((x - xRange[0]) / (xRange[1] - xRange[0])) * innerW;
  const yToScreen = y => MARGIN + ((yRange[1] - y) / (yRange[1] - yRange[0])) * innerH;

  const segments = boundaries.map(b => _boundaryPoints(b, xToScreen, yToScreen));

  // Concatenate all segments into one closed path for the hatch fill.
  let combinedPath = "";
  for (const pts of segments) {
    if (!pts.length) continue;
    if (!combinedPath) {
      combinedPath = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
      for (let i = 1; i < pts.length; i++) combinedPath += `L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} `;
    } else {
      for (let i = 0; i < pts.length; i++) combinedPath += `L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} `;
    }
  }
  if (combinedPath) combinedPath += "Z";

  const hatchId = _nextHatchId();
  const defs = shaded
    ? `<defs><pattern id="${hatchId}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(${hatchAngle})"><line x1="0" y1="0" x2="0" y2="6" stroke="black" stroke-width="0.5"/></pattern></defs>`
    : "";

  const fillXml = (shaded && combinedPath)
    ? `<path d="${combinedPath}" fill="url(#${hatchId})" stroke="none" fill-rule="evenodd"/>`
    : "";

  // Each boundary re-stroked on top of the hatch so curves stay crisp.
  // We use native SVG primitives per kind so lines render as <line> and
  // circles render as <circle> / <path d="A ...">; this avoids any chance
  // of a 2-point polyline collapsing visually and matches what the printer
  // expects.
  const STROKE_ATTRS = `stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
  // World → screen radius scales (different on x and y axes when the panel
  // isn't square in world units).
  const xRadiusScale = innerW / (xRange[1] - xRange[0]);
  const yRadiusScale = innerH / (yRange[1] - yRange[0]);

  let strokeXml = "";
  for (let bi = 0; bi < boundaries.length; bi++) {
    const b = boundaries[bi];
    if (!b) continue;

    if (b.kind === "line") {
      if (!Array.isArray(b.from) || !Array.isArray(b.to) || b.from.length < 2 || b.to.length < 2) {
        console.warn("RegionGraph: line boundary malformed", b);
        continue;
      }
      const fx = Number(b.from[0]), fy = Number(b.from[1]);
      const tx = Number(b.to[0]),   ty = Number(b.to[1]);
      if (!isFinite(fx) || !isFinite(fy) || !isFinite(tx) || !isFinite(ty)) {
        console.warn("RegionGraph: line boundary has non-finite coords", b);
        continue;
      }
      const x1 = xToScreen(fx).toFixed(2);
      const y1 = yToScreen(fy).toFixed(2);
      const x2 = xToScreen(tx).toFixed(2);
      const y2 = yToScreen(ty).toFixed(2);
      strokeXml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${STROKE_ATTRS}/>`;
      continue;
    }

    if (b.kind === "circle") {
      const c = Array.isArray(b.center) ? b.center : [0, 0];
      const r = Number(b.radius);
      if (!(r > 0)) { console.warn("RegionGraph: circle has invalid radius", b); continue; }
      const cx = xToScreen(Number(c[0]));
      const cy = yToScreen(Number(c[1]));
      const rx = r * xRadiusScale;
      const ry = r * yRadiusScale;
      const isFullCircle = b.arcFrom == null && b.arcTo == null;
      if (isFullCircle) {
        // Native ellipse handles non-square world ranges cleanly.
        strokeXml += `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" ${STROKE_ATTRS}/>`;
      } else {
        const aFrom = Number(b.arcFrom);
        const aTo   = Number(b.arcTo);
        if (!isFinite(aFrom) || !isFinite(aTo)) {
          console.warn("RegionGraph: circle arc bounds non-finite", b);
          continue;
        }
        const a0 = aFrom * Math.PI / 180;
        const a1 = aTo   * Math.PI / 180;
        const sx = xToScreen(c[0] + r * Math.cos(a0));
        const sy = yToScreen(c[1] + r * Math.sin(a0));
        const ex = xToScreen(c[0] + r * Math.cos(a1));
        const ey = yToScreen(c[1] + r * Math.sin(a1));
        const largeArc = Math.abs(aTo - aFrom) > 180 ? 1 : 0;
        // World y points up, screen y points down — a CCW arc in world
        // (aTo > aFrom) traces clockwise in screen space, which is SVG
        // sweep flag 1.
        const sweep = aTo > aFrom ? 1 : 0;
        const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 ${largeArc} ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
        strokeXml += `<path d="${d}" ${STROKE_ATTRS}/>`;
      }
      continue;
    }

    // function / function_y → polyline approximation from sample grid.
    const pts = segments[bi];
    if (!Array.isArray(pts) || pts.length < 2) continue;
    const d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} ` +
      pts.slice(1).map(p => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
    strokeXml += `<path d="${d}" ${STROKE_ATTRS}/>`;
  }

  let dotsXml = "";
  for (const v of vertices) {
    if (!Array.isArray(v) || v.length < 2) continue;
    const sx = xToScreen(Number(v[0]));
    const sy = yToScreen(Number(v[1]));
    if (!isFinite(sx) || !isFinite(sy)) continue;
    dotsXml += `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="2" fill="black"/>`;
  }

  let axesXml = "";
  const axisXScreen = yToScreen(0);
  const axisYScreen = xToScreen(0);
  if (axisXScreen >= MARGIN && axisXScreen <= H - MARGIN) {
    axesXml += `<line x1="${MARGIN}" y1="${axisXScreen.toFixed(2)}" x2="${W - MARGIN}" y2="${axisXScreen.toFixed(2)}" stroke="black" stroke-width="0.4"/>`;
  }
  if (axisYScreen >= MARGIN && axisYScreen <= W - MARGIN) {
    axesXml += `<line x1="${axisYScreen.toFixed(2)}" y1="${MARGIN}" x2="${axisYScreen.toFixed(2)}" y2="${H - MARGIN}" stroke="black" stroke-width="0.4"/>`;
  }

  // Per-boundary labels — drawn on top of everything else so the white halo
  // (paint-order: stroke fill) cleanly punches through the hatch pattern.
  let boundaryLabelXml = "";
  for (const b of boundaries) {
    if (!b?.label || typeof b.label !== "object") continue;
    const text = String(b.label.text ?? "");
    if (!text.trim()) continue;
    const anchor = _boundaryLabelAnchor(b, xToScreen, yToScreen);
    if (!anchor || !isFinite(anchor[0]) || !isFinite(anchor[1])) continue;
    const defaults = _defaultLabelOffsets(b);
    const offsetX = Number.isFinite(Number(b.label.offsetX)) ? Number(b.label.offsetX) : defaults.offsetX;
    const offsetY = Number.isFinite(Number(b.label.offsetY)) ? Number(b.label.offsetY) : defaults.offsetY;
    const fontSize = Number.isFinite(Number(b.label.fontSize)) ? Number(b.label.fontSize) : 14;
    const align = b.label.align === "left"  ? "start"
                : b.label.align === "right" ? "end"
                                            : "middle";
    const lx = anchor[0] + offsetX;
    const ly = anchor[1] + offsetY;
    const inner = mathToSvgTspans(text);
    boundaryLabelXml += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${align}" fill="black" font-family="serif" font-size="${fontSize}" font-style="italic" paint-order="stroke fill" stroke="white" stroke-width="3" stroke-linejoin="round">${inner}</text>`;
  }

  let labelXml = "";
  if (axisLabels?.x && Array.isArray(axisLabels.x)) {
    for (const lbl of axisLabels.x) {
      const v = Number(lbl);
      if (!Number.isFinite(v)) continue;
      const sx = xToScreen(v);
      const sy = axisXScreen + 12;
      labelXml += `<text x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" text-anchor="middle" font-size="9" fill="black">${escXml(lbl)}</text>`;
    }
  }
  if (axisLabels?.y && Array.isArray(axisLabels.y)) {
    for (const lbl of axisLabels.y) {
      const v = Number(lbl);
      if (!Number.isFinite(v)) continue;
      const sy = yToScreen(v);
      const sx = axisYScreen - 6;
      labelXml += `<text x="${sx.toFixed(2)}" y="${(sy + 3).toFixed(2)}" text-anchor="end" font-size="9" fill="black">${escXml(lbl)}</text>`;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    defs +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    axesXml +
    fillXml +
    strokeXml +
    dotsXml +
    labelXml +
    boundaryLabelXml +
    `</svg>`;
}

export async function regionToBase64PNG(config, width = PANEL_W, height = PANEL_H) {
  return svgToBase64PNG(buildRegionSvg(config, { width, height }), width, height);
}

export default function RegionGraph({ config, width, height, style }) {
  const W = width  || PANEL_W;
  const H = height || PANEL_H;
  const svg = buildRegionSvg(config, { width: W, height: H });
  return (
    <div
      style={{ width: W, height: H, display: "inline-block", lineHeight: 0, ...(style || {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
