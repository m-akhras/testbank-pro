"use client";

// Line-integral path renderer for §16.2. Pure SVG, B&W only. Modeled on
// RegionGraph but: no fill / no hatch — just curves, mid-segment direction
// arrows, and labeled endpoints. Each segment can have its own halo'd
// label rendered via mathToSvgTspans so subscripts (C_1, C_2) and powers
// (y = x^2) come out right. The same SVG-builder is reused by the QTI and
// Word rasterization paths so on-screen and printed output stay identical.

import { compileExpression } from "../../lib/utils/exprCompile.js";
import { svgToBase64PNG, escXml } from "./svgRasterize.js";
import { mathToSvgTspans } from "../../lib/utils/svgMath.js";

const PANEL_W = 300;
const PANEL_H = 280;
const MARGIN  = 22;

const ARROW_LEN_PX  = 8;   // tip-to-base length of the direction arrowhead
const ARROW_HALF_PX = 3;   // half-width of the arrowhead base

// Convert a parameter t in [0, 1] along a segment to a screen-space [x, y].
// Returns null if the segment / its expression is unparseable. Used both
// for sampling the polyline and for placing labels / arrows.
function _segmentScreenPointAt(seg, t, xToScreen, yToScreen) {
  if (!seg) return null;
  const tt = Math.max(0, Math.min(1, Number(t)));
  if (seg.kind === "function") {
    const fn = compileExpression(seg.expr, ["x"]);
    if (!fn) return null;
    const x = Number(seg.from) + tt * (Number(seg.to) - Number(seg.from));
    let y;
    try { y = Number(fn(x)); } catch (_e) { return null; }
    if (!isFinite(y)) return null;
    return [xToScreen(x), yToScreen(y)];
  }
  if (seg.kind === "function_y") {
    const fn = compileExpression(seg.expr, ["y"]);
    if (!fn) return null;
    const y = Number(seg.from) + tt * (Number(seg.to) - Number(seg.from));
    let x;
    try { x = Number(fn(y)); } catch (_e) { return null; }
    if (!isFinite(x)) return null;
    return [xToScreen(x), yToScreen(y)];
  }
  if (seg.kind === "line") {
    if (!Array.isArray(seg.from) || !Array.isArray(seg.to)) return null;
    const x = Number(seg.from[0]) + tt * (Number(seg.to[0]) - Number(seg.from[0]));
    const y = Number(seg.from[1]) + tt * (Number(seg.to[1]) - Number(seg.from[1]));
    if (!isFinite(x) || !isFinite(y)) return null;
    return [xToScreen(x), yToScreen(y)];
  }
  if (seg.kind === "circle") {
    const c = Array.isArray(seg.center) ? seg.center : [0, 0];
    const r = Number(seg.radius);
    if (!(r > 0)) return null;
    const a0 = (seg.arcFrom == null ? 0   : Number(seg.arcFrom)) * Math.PI / 180;
    const a1 = (seg.arcTo   == null ? 360 : Number(seg.arcTo))   * Math.PI / 180;
    const a = a0 + tt * (a1 - a0);
    return [xToScreen(c[0] + r * Math.cos(a)), yToScreen(c[1] + r * Math.sin(a))];
  }
  if (seg.kind === "parametric") {
    const fx = compileExpression(seg.xExpr, ["t"]);
    const fy = compileExpression(seg.yExpr, ["t"]);
    if (!fx || !fy) return null;
    const tFrom = Number(seg.tFrom);
    const tTo   = Number(seg.tTo);
    if (!isFinite(tFrom) || !isFinite(tTo)) return null;
    const tParam = tFrom + tt * (tTo - tFrom);
    let xv, yv;
    try { xv = Number(fx(tParam)); yv = Number(fy(tParam)); } catch (_e) { return null; }
    if (!isFinite(xv) || !isFinite(yv)) return null;
    return [xToScreen(xv), yToScreen(yv)];
  }
  return null;
}

// Sample a segment as a polyline of N+1 screen-space points. Skips unparseable
// samples so a partially singular curve still renders the visible portion.
function _segmentPoints(seg, xToScreen, yToScreen) {
  const N = seg?.kind === "line" ? 1 : 50;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const p = _segmentScreenPointAt(seg, i / N, xToScreen, yToScreen);
    if (p) pts.push(p);
  }
  return pts;
}

// Filled-triangle arrowhead path with the tip exactly at (sx, sy) and the
// base extending backwards along (-tx, -ty). Tangent (tx, ty) is in screen
// pixels and need not be unit-length; we normalize.
function _arrowheadPath(sx, sy, tx, ty) {
  const m = Math.hypot(tx, ty);
  if (!(m > 0)) return "";
  const ux = tx / m;
  const uy = ty / m;
  const nx = -uy; // perpendicular (left-hand)
  const ny =  ux;
  const bx = sx - ux * ARROW_LEN_PX;
  const by = sy - uy * ARROW_LEN_PX;
  const c1x = bx + nx * ARROW_HALF_PX;
  const c1y = by + ny * ARROW_HALF_PX;
  const c2x = bx - nx * ARROW_HALF_PX;
  const c2y = by - ny * ARROW_HALF_PX;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} L ${c1x.toFixed(2)} ${c1y.toFixed(2)} L ${c2x.toFixed(2)} ${c2y.toFixed(2)} Z`;
}

export function buildPathSvg(config, opts = {}) {
  const W = opts.width  || PANEL_W;
  const H = opts.height || PANEL_H;
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-1, 5];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-1, 5];
  const segments  = Array.isArray(config?.segments)  ? config.segments  : [];
  const endpoints = Array.isArray(config?.endpoints) ? config.endpoints : [];
  const showAxes  = config?.showAxes !== false;
  const axisLabels = config?.axisLabels || { x: [], y: [] };

  const innerW = W - 2 * MARGIN;
  const innerH = H - 2 * MARGIN;
  const xToScreen = x => MARGIN + ((x - xRange[0]) / (xRange[1] - xRange[0])) * innerW;
  const yToScreen = y => MARGIN + ((yRange[1] - y) / (yRange[1] - yRange[0])) * innerH;

  // Stroke each segment as its own polyline. No fill / no hatch.
  let strokeXml = "";
  for (const seg of segments) {
    const pts = _segmentPoints(seg, xToScreen, yToScreen);
    if (pts.length < 2) continue;
    const d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} ` +
      pts.slice(1).map(p => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
    strokeXml += `<path d="${d}" stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  // Direction arrows — one per segment by default. Sample the tangent
  // numerically by taking points at arrowAt ± eps and using the difference
  // vector directly; this works uniformly for line / function / circle /
  // parametric without per-kind derivative formulas.
  let arrowXml = "";
  for (const seg of segments) {
    if (seg?.directionArrow === false) continue;
    const at = Number.isFinite(Number(seg?.arrowAt)) ? Number(seg.arrowAt) : 0.5;
    const tipT = Math.max(0.02, Math.min(0.98, at));
    const eps  = 0.02;
    const tip  = _segmentScreenPointAt(seg, tipT, xToScreen, yToScreen);
    const back = _segmentScreenPointAt(seg, Math.max(0, tipT - eps), xToScreen, yToScreen);
    if (!tip || !back) continue;
    const tx = tip[0] - back[0];
    const ty = tip[1] - back[1];
    const path = _arrowheadPath(tip[0], tip[1], tx, ty);
    if (path) arrowXml += `<path d="${path}" fill="black" stroke="none"/>`;
  }

  // Endpoint dots + optional coordinate labels.
  let endpointXml = "";
  let endpointLabelXml = "";
  for (const ep of endpoints) {
    if (!ep || !Array.isArray(ep.at) || ep.at.length < 2) continue;
    const wx = Number(ep.at[0]);
    const wy = Number(ep.at[1]);
    if (!isFinite(wx) || !isFinite(wy)) continue;
    const sx = xToScreen(wx);
    const sy = yToScreen(wy);
    if (!isFinite(sx) || !isFinite(sy)) continue;
    endpointXml += `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="2.4" fill="black"/>`;
    if (ep.label && String(ep.label).trim()) {
      const offsetX = Number.isFinite(Number(ep.offsetX)) ? Number(ep.offsetX) : 0;
      const offsetY = Number.isFinite(Number(ep.offsetY)) ? Number(ep.offsetY) : 14;
      const align = ep.align === "left"  ? "start"
                  : ep.align === "right" ? "end"
                                         : "middle";
      const lx = sx + offsetX;
      const ly = sy + offsetY;
      const inner = mathToSvgTspans(String(ep.label));
      endpointLabelXml += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${align}" fill="black" font-family="serif" font-size="11" paint-order="stroke fill" stroke="white" stroke-width="3" stroke-linejoin="round">${inner}</text>`;
    }
  }

  // Per-segment labels — same anchor / halo / math conventions as
  // RegionGraph boundary labels.
  let segmentLabelXml = "";
  for (const seg of segments) {
    if (!seg?.label || typeof seg.label !== "object") continue;
    const text = String(seg.label.text ?? "");
    if (!text.trim()) continue;
    const at = Number.isFinite(Number(seg.label.at)) ? Number(seg.label.at) : 0.5;
    const anchor = _segmentScreenPointAt(seg, at, xToScreen, yToScreen);
    if (!anchor || !isFinite(anchor[0]) || !isFinite(anchor[1])) continue;
    const offsetX = Number.isFinite(Number(seg.label.offsetX)) ? Number(seg.label.offsetX) : 0;
    const offsetY = Number.isFinite(Number(seg.label.offsetY)) ? Number(seg.label.offsetY) : -10;
    const align = seg.label.align === "left"  ? "start"
                : seg.label.align === "right" ? "end"
                                              : "middle";
    const lx = anchor[0] + offsetX;
    const ly = anchor[1] + offsetY;
    const inner = mathToSvgTspans(text);
    segmentLabelXml += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${align}" fill="black" font-family="serif" font-size="11" font-style="italic" paint-order="stroke fill" stroke="white" stroke-width="3" stroke-linejoin="round">${inner}</text>`;
  }

  // Axes (thin black lines) + optional axis tick labels in world coordinates.
  let axesXml = "";
  if (showAxes) {
    const axisXScreen = yToScreen(0);
    const axisYScreen = xToScreen(0);
    if (axisXScreen >= MARGIN && axisXScreen <= H - MARGIN) {
      axesXml += `<line x1="${MARGIN}" y1="${axisXScreen.toFixed(2)}" x2="${W - MARGIN}" y2="${axisXScreen.toFixed(2)}" stroke="black" stroke-width="0.4"/>`;
    }
    if (axisYScreen >= MARGIN && axisYScreen <= W - MARGIN) {
      axesXml += `<line x1="${axisYScreen.toFixed(2)}" y1="${MARGIN}" x2="${axisYScreen.toFixed(2)}" y2="${H - MARGIN}" stroke="black" stroke-width="0.4"/>`;
    }
  }

  let axisTickXml = "";
  const axisXScreen = yToScreen(0);
  const axisYScreen = xToScreen(0);
  if (axisLabels?.x && Array.isArray(axisLabels.x)) {
    for (const lbl of axisLabels.x) {
      const v = Number(lbl);
      if (!Number.isFinite(v)) continue;
      const sx = xToScreen(v);
      const sy = axisXScreen + 12;
      axisTickXml += `<text x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" text-anchor="middle" font-size="9" fill="black">${escXml(lbl)}</text>`;
    }
  }
  if (axisLabels?.y && Array.isArray(axisLabels.y)) {
    for (const lbl of axisLabels.y) {
      const v = Number(lbl);
      if (!Number.isFinite(v)) continue;
      const sy = yToScreen(v);
      const sx = axisYScreen - 6;
      axisTickXml += `<text x="${sx.toFixed(2)}" y="${(sy + 3).toFixed(2)}" text-anchor="end" font-size="9" fill="black">${escXml(lbl)}</text>`;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    axesXml +
    strokeXml +
    arrowXml +
    endpointXml +
    axisTickXml +
    segmentLabelXml +
    endpointLabelXml +
    `</svg>`;
}

export async function pathToBase64PNG(config, width = PANEL_W, height = PANEL_H) {
  return svgToBase64PNG(buildPathSvg(config, { width, height }), width, height);
}

export default function PathGraph({ config, width, height, style }) {
  const W = width  || PANEL_W;
  const H = height || PANEL_H;
  const svg = buildPathSvg(config, { width: W, height: H });
  return (
    <div
      style={{ width: W, height: H, display: "inline-block", lineHeight: 0, ...(style || {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
