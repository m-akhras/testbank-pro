"use client";

// Region-of-integration renderer (15.2 / 15.3). Pure SVG, B&W. The output
// is one closed hatch-filled path that exactly traces the supplied
// boundaries, plus a stroked overlay so each curve stays crisp on top of
// the hatch, plus vertex dots and any labels.
//
// Boundary kinds:
//   "function"   — y = expr(x) sampled from `from` to `to` over x
//   "function_y" — x = expr(y) sampled from `from` to `to` over y
//   "line"       — straight segment between `from`/`to` [x,y]; ALWAYS
//                  stroked as <line>, never auto-arced
//   "circle"     — arc from arcFrom..arcTo (deg) on circle of given
//                  center+radius, full circle if both omitted; sampled
//                  as a polyline so the visible stroke and the closed
//                  hatch path are byte-identical (no SVG sweep-flag math)
//
// Render order is fixed: background → axes → axis tick labels → hatch
// fill → boundary strokes → vertex dots → vertex labels → boundary
// labels. Tick labels render ONLY for entries in cfg.axisLabels.x / .y;
// nothing is auto-generated.

import { compileExpression } from "../../lib/utils/exprCompile.js";
import { svgToBase64PNG, escXml } from "./svgRasterize.js";
import { mathToSvgTspans } from "../../lib/utils/svgMath.js";

const PANEL_W = 300;
const PANEL_H = 280;
const MARGIN  = 22;

const FN_SAMPLES  = 50;
const ARC_SAMPLES = 64;

let _hatchCounter = 0;
function _nextHatchId() { return `rgnHatch${++_hatchCounter}`; }

// Sample one boundary as a polyline of screen-space [x, y] points.
// The same polyline drives both the closed hatch path and the visible
// stroke so they cannot disagree.
function _samplePolyline(b, xToScreen, yToScreen) {
  if (!b) return [];
  switch (b.kind) {
    case "function": {
      const fn = compileExpression(b.expr, ["x"]);
      if (!fn) return [];
      const from = Number(b.from), to = Number(b.to);
      if (!isFinite(from) || !isFinite(to)) return [];
      const pts = [];
      for (let i = 0; i <= FN_SAMPLES; i++) {
        const x = from + (to - from) * (i / FN_SAMPLES);
        let y;
        try { y = Number(fn(x)); } catch { continue; }
        if (!isFinite(y)) continue;
        pts.push([xToScreen(x), yToScreen(y)]);
      }
      return pts;
    }
    case "function_y": {
      const fn = compileExpression(b.expr, ["y"]);
      if (!fn) return [];
      const from = Number(b.from), to = Number(b.to);
      if (!isFinite(from) || !isFinite(to)) return [];
      const pts = [];
      for (let i = 0; i <= FN_SAMPLES; i++) {
        const y = from + (to - from) * (i / FN_SAMPLES);
        let x;
        try { x = Number(fn(y)); } catch { continue; }
        if (!isFinite(x)) continue;
        pts.push([xToScreen(x), yToScreen(y)]);
      }
      return pts;
    }
    case "line": {
      if (!Array.isArray(b.from) || !Array.isArray(b.to) ||
          b.from.length < 2 || b.to.length < 2) {
        console.warn("RegionGraph: line boundary missing from/to", b);
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
    case "circle": {
      const c = Array.isArray(b.center) ? b.center : [0, 0];
      const r = Number(b.radius);
      if (!(r > 0)) {
        console.warn("RegionGraph: circle has invalid radius", b);
        return [];
      }
      const a0 = (b.arcFrom == null ? 0   : Number(b.arcFrom)) * Math.PI / 180;
      const a1 = (b.arcTo   == null ? 360 : Number(b.arcTo))   * Math.PI / 180;
      const pts = [];
      for (let i = 0; i <= ARC_SAMPLES; i++) {
        const a = a0 + (a1 - a0) * (i / ARC_SAMPLES);
        pts.push([
          xToScreen(c[0] + r * Math.cos(a)),
          yToScreen(c[1] + r * Math.sin(a)),
        ]);
      }
      return pts;
    }
    default:
      console.warn("RegionGraph: unknown boundary kind", b.kind);
      return [];
  }
}

// Where to anchor a boundary's text label. `at` runs 0..1 along the curve.
function _boundaryLabelAnchor(b, xToScreen, yToScreen) {
  const rawAt = b?.label?.at;
  const t = Math.max(0, Math.min(1,
    Number.isFinite(Number(rawAt)) ? Number(rawAt) : 0.5));
  switch (b?.kind) {
    case "function": {
      const fn = compileExpression(b.expr, ["x"]);
      if (!fn) return null;
      const x = Number(b.from) + t * (Number(b.to) - Number(b.from));
      let y;
      try { y = Number(fn(x)); } catch { return null; }
      if (!isFinite(y)) return null;
      return [xToScreen(x), yToScreen(y)];
    }
    case "function_y": {
      const fn = compileExpression(b.expr, ["y"]);
      if (!fn) return null;
      const y = Number(b.from) + t * (Number(b.to) - Number(b.from));
      let x;
      try { x = Number(fn(y)); } catch { return null; }
      if (!isFinite(x)) return null;
      return [xToScreen(x), yToScreen(y)];
    }
    case "line": {
      if (!Array.isArray(b.from) || !Array.isArray(b.to)) return null;
      const x = Number(b.from[0]) + t * (Number(b.to[0]) - Number(b.from[0]));
      const y = Number(b.from[1]) + t * (Number(b.to[1]) - Number(b.from[1]));
      if (!isFinite(x) || !isFinite(y)) return null;
      return [xToScreen(x), yToScreen(y)];
    }
    case "circle": {
      const c = Array.isArray(b.center) ? b.center : [0, 0];
      const r = Number(b.radius);
      if (!(r > 0)) return null;
      const a0 = (b.arcFrom == null ? 0   : Number(b.arcFrom)) * Math.PI / 180;
      const a1 = (b.arcTo   == null ? 360 : Number(b.arcTo))   * Math.PI / 180;
      const a = a0 + t * (a1 - a0);
      return [
        xToScreen(c[0] + r * Math.cos(a)),
        yToScreen(c[1] + r * Math.sin(a)),
      ];
    }
    default:
      return null;
  }
}

// Sensible default label nudge per boundary kind, used when the caller
// hasn't supplied an explicit offsetX / offsetY in label.
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

export function buildRegionSvg(config, opts = {}) {
  const W = opts.width  || PANEL_W;
  const H = opts.height || PANEL_H;

  const xRange     = Array.isArray(config?.xRange) ? config.xRange : [-1, 5];
  const yRange     = Array.isArray(config?.yRange) ? config.yRange : [-1, 5];
  const boundaries = Array.isArray(config?.boundaries) ? config.boundaries : [];
  const vertices   = Array.isArray(config?.vertices)   ? config.vertices   : [];
  const shaded     = config?.shaded   !== false;
  const showAxes   = config?.showAxes !== false;
  const hatchAngle = Number.isFinite(Number(config?.hatchAngle))
    ? Number(config.hatchAngle) : 45;

  const axisCfg      = config?.axisLabels || {};
  const xLabels      = Array.isArray(axisCfg.x) ? axisCfg.x : [];
  const yLabels      = Array.isArray(axisCfg.y) ? axisCfg.y : [];
  const axisFontSize = Number.isFinite(Number(axisCfg.fontSize))
    ? Number(axisCfg.fontSize) : 12;

  const innerW = W - 2 * MARGIN;
  const innerH = H - 2 * MARGIN;
  const xToScreen = x => MARGIN + ((x - xRange[0]) / (xRange[1] - xRange[0])) * innerW;
  const yToScreen = y => MARGIN + ((yRange[1] - y) / (yRange[1] - yRange[0])) * innerH;

  // Sample every boundary once.
  const polylines = boundaries.map(b => _samplePolyline(b, xToScreen, yToScreen));

  // Closed region path for the hatch fill: walk the boundaries in order,
  // M to the first point of the first non-empty boundary, L through every
  // subsequent point of every subsequent boundary, close with Z. There is
  // no auto-arcing — gaps between segments are a config bug, not something
  // the renderer will paper over with a curve.
  let closedPath = "";
  for (const pts of polylines) {
    if (!pts.length) continue;
    if (!closedPath) {
      closedPath = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
      for (let i = 1; i < pts.length; i++) {
        closedPath += `L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} `;
      }
    } else {
      for (let i = 0; i < pts.length; i++) {
        closedPath += `L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} `;
      }
    }
  }
  if (closedPath) closedPath += "Z";

  const hatchId = _nextHatchId();
  const defs = shaded
    ? `<defs><pattern id="${hatchId}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(${hatchAngle})"><line x1="0" y1="0" x2="0" y2="6" stroke="black" stroke-width="0.5"/></pattern></defs>`
    : "";

  const fillXml = (shaded && closedPath)
    ? `<path d="${closedPath}" fill="url(#${hatchId})" stroke="none" fill-rule="evenodd"/>`
    : "";

  // Visible boundary strokes drawn on top of the hatch. Lines render as
  // native <line> primitives. Functions / function_y / circle arcs render
  // as <path d="M ... L ..."> using the same sample polyline that fed the
  // closed path, so the visible curve and the hatch outline coincide
  // exactly (this is what fixes half-disks / quarter-circles "not closing
  // at the bottom" — the line below the arc is now stroked as an actual
  // line, never an arc, and the arc samples land exactly on the line's
  // endpoints).
  const STROKE_ATTRS =
    `stroke="black" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round"`;
  let strokeXml = "";
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    if (!b) continue;
    if (b.kind === "line") {
      if (!Array.isArray(b.from) || !Array.isArray(b.to) ||
          b.from.length < 2 || b.to.length < 2) continue;
      const fx = Number(b.from[0]), fy = Number(b.from[1]);
      const tx = Number(b.to[0]),   ty = Number(b.to[1]);
      if (!isFinite(fx) || !isFinite(fy) || !isFinite(tx) || !isFinite(ty)) continue;
      strokeXml +=
        `<line x1="${xToScreen(fx).toFixed(2)}" y1="${yToScreen(fy).toFixed(2)}" ` +
        `x2="${xToScreen(tx).toFixed(2)}" y2="${yToScreen(ty).toFixed(2)}" ${STROKE_ATTRS}/>`;
      continue;
    }
    const pts = polylines[i];
    if (!Array.isArray(pts) || pts.length < 2) continue;
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let j = 1; j < pts.length; j++) {
      d += ` L ${pts[j][0].toFixed(2)} ${pts[j][1].toFixed(2)}`;
    }
    strokeXml += `<path d="${d}" ${STROKE_ATTRS}/>`;
  }

  // Axes — thin black lines through the origin, only drawn if the origin
  // sits inside the visible panel.
  const axisYFromOrigin = yToScreen(0); // screen y where world y=0 lands
  const axisXFromOrigin = xToScreen(0); // screen x where world x=0 lands
  let axesXml = "";
  if (showAxes) {
    if (axisYFromOrigin >= MARGIN && axisYFromOrigin <= H - MARGIN) {
      axesXml +=
        `<line x1="${MARGIN}" y1="${axisYFromOrigin.toFixed(2)}" ` +
        `x2="${W - MARGIN}" y2="${axisYFromOrigin.toFixed(2)}" stroke="black" stroke-width="0.4"/>`;
    }
    if (axisXFromOrigin >= MARGIN && axisXFromOrigin <= W - MARGIN) {
      axesXml +=
        `<line x1="${axisXFromOrigin.toFixed(2)}" y1="${MARGIN}" ` +
        `x2="${axisXFromOrigin.toFixed(2)}" y2="${H - MARGIN}" stroke="black" stroke-width="0.4"/>`;
    }
  }

  // Axis tick labels. Render ONLY values present in cfg.axisLabels.x / .y.
  // Never auto-generate — that's how phantom "y = 0" / "x = 0" labels used
  // to leak in. If both arrays are empty the panel shows axis lines only.
  let axisLabelXml = "";
  for (const lbl of xLabels) {
    const v = Number(lbl);
    if (!Number.isFinite(v)) continue;
    const sx = xToScreen(v);
    const sy = axisYFromOrigin + axisFontSize + 2;
    axisLabelXml +=
      `<text x="${sx.toFixed(2)}" y="${sy.toFixed(2)}" text-anchor="middle" ` +
      `font-family="serif" font-size="${axisFontSize}" fill="black">${escXml(String(lbl))}</text>`;
  }
  for (const lbl of yLabels) {
    const v = Number(lbl);
    if (!Number.isFinite(v)) continue;
    const sy = yToScreen(v);
    const sx = axisXFromOrigin - 6;
    axisLabelXml +=
      `<text x="${sx.toFixed(2)}" y="${(sy + axisFontSize / 3).toFixed(2)}" text-anchor="end" ` +
      `font-family="serif" font-size="${axisFontSize}" fill="black">${escXml(String(lbl))}</text>`;
  }

  // Vertices accept either [x, y] (plain dot) or
  // { at:[x,y], label, offsetX, offsetY, align, fontSize } (dot + halo'd label).
  let vertexDotXml   = "";
  let vertexLabelXml = "";
  for (const v of vertices) {
    const point = Array.isArray(v)
      ? v
      : (v && Array.isArray(v.at) ? v.at : null);
    if (!point || point.length < 2) continue;
    const sx = xToScreen(Number(point[0]));
    const sy = yToScreen(Number(point[1]));
    if (!isFinite(sx) || !isFinite(sy)) continue;
    vertexDotXml += `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="2.4" fill="black"/>`;
    if (!Array.isArray(v) && v && v.label && String(v.label).trim()) {
      const offsetX = Number.isFinite(Number(v.offsetX)) ? Number(v.offsetX) : 0;
      const offsetY = Number.isFinite(Number(v.offsetY)) ? Number(v.offsetY) : 14;
      const fontSize = Number.isFinite(Number(v.fontSize)) ? Number(v.fontSize) : 13;
      const align = v.align === "left"  ? "start"
                  : v.align === "right" ? "end"
                                        : "middle";
      const inner = mathToSvgTspans(String(v.label));
      vertexLabelXml +=
        `<text x="${(sx + offsetX).toFixed(2)}" y="${(sy + offsetY).toFixed(2)}" ` +
        `text-anchor="${align}" font-family="serif" font-size="${fontSize}" font-style="italic" ` +
        `fill="black" paint-order="stroke fill" stroke="white" stroke-width="3" stroke-linejoin="round">${inner}</text>`;
    }
  }

  // Boundary text labels — drawn last so the white halo cleanly punches
  // through the hatch / strokes / axis labels underneath.
  let boundaryLabelXml = "";
  for (const b of boundaries) {
    if (!b?.label || typeof b.label !== "object") continue;
    const text = String(b.label.text ?? "");
    if (!text.trim()) continue;
    const anchor = _boundaryLabelAnchor(b, xToScreen, yToScreen);
    if (!anchor || !isFinite(anchor[0]) || !isFinite(anchor[1])) continue;
    const def = _defaultLabelOffsets(b);
    const offsetX = Number.isFinite(Number(b.label.offsetX))
      ? Number(b.label.offsetX) : def.offsetX;
    const offsetY = Number.isFinite(Number(b.label.offsetY))
      ? Number(b.label.offsetY) : def.offsetY;
    const fontSize = Number.isFinite(Number(b.label.fontSize))
      ? Number(b.label.fontSize) : 14;
    const align = b.label.align === "left"  ? "start"
                : b.label.align === "right" ? "end"
                                            : "middle";
    const inner = mathToSvgTspans(text);
    boundaryLabelXml +=
      `<text x="${(anchor[0] + offsetX).toFixed(2)}" y="${(anchor[1] + offsetY).toFixed(2)}" ` +
      `text-anchor="${align}" font-family="serif" font-size="${fontSize}" font-style="italic" ` +
      `fill="black" paint-order="stroke fill" stroke="white" stroke-width="3" stroke-linejoin="round">${inner}</text>`;
  }

  // Render order: background, axes, axis tick labels, hatch fill,
  // boundary strokes, vertex dots, vertex labels, boundary labels.
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    defs +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    axesXml +
    axisLabelXml +
    fillXml +
    strokeXml +
    vertexDotXml +
    vertexLabelXml +
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
