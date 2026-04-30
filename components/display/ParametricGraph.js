"use client";

// Parametric / space-curve renderer. 2D path uses straight (xRange, yRange)
// projection; 3D path uses isometric projection with x → bottom-right,
// y → bottom-left, z → up. Optional start dot at t = tRange[0], optional
// midpoint direction arrow, three labelled axes in 3D mode.

import { compileExpression } from "../../lib/utils/exprCompile.js";
import { svgToBase64PNG, escXml } from "./svgRasterize.js";

const PANEL_W = 300;
const PANEL_H = 280;
const MARGIN  = 14;

let _arrowCounter = 0;
function _nextArrowId() { return `pmArr${++_arrowCounter}`; }

function _formatT(v) {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(2);
}

export function buildParametricSvg(config, opts = {}) {
  const W = opts.width  || PANEL_W;
  const H = opts.height || PANEL_H;
  const dimensions = config?.dimensions === 3 ? 3 : 2;
  const tRange = Array.isArray(config?.tRange) ? config.tRange : [0, 2 * Math.PI];
  const samples = Math.max(50, Math.min(500, Number(config?.samples) || 200));
  const showStartDot       = config?.showStartDot       !== false;
  const showDirectionArrow = config?.showDirectionArrow !== false;
  const showAxes           = config?.showAxes           !== false;

  const fxFn = compileExpression(config?.xExpr, ["t"]);
  const fyFn = compileExpression(config?.yExpr, ["t"]);
  const fzFn = dimensions === 3 ? compileExpression(config?.zExpr, ["t"]) : null;

  if (!fxFn || !fyFn || (dimensions === 3 && !fzFn)) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
      `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
      `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="11" fill="black">Invalid expression</text>` +
      `</svg>`;
  }

  const arrowId = _nextArrowId();
  const defs = `<defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="black"/></marker></defs>`;

  let body = "";

  if (dimensions === 2) {
    const xRange = Array.isArray(config?.xRange) ? config.xRange : [-1.5, 1.5];
    const yRange = Array.isArray(config?.yRange) ? config.yRange : [-1.5, 1.5];
    const innerW = W - 2 * MARGIN;
    const innerH = H - 2 * MARGIN;
    const xToScreen = x => MARGIN + ((x - xRange[0]) / (xRange[1] - xRange[0])) * innerW;
    const yToScreen = y => MARGIN + ((yRange[1] - y) / (yRange[1] - yRange[0])) * innerH;

    if (showAxes) {
      const axisXScreen = yToScreen(0);
      const axisYScreen = xToScreen(0);
      if (axisXScreen >= MARGIN && axisXScreen <= H - MARGIN) {
        body += `<line x1="${MARGIN}" y1="${axisXScreen.toFixed(2)}" x2="${W - MARGIN}" y2="${axisXScreen.toFixed(2)}" stroke="black" stroke-width="0.4"/>`;
      }
      if (axisYScreen >= MARGIN && axisYScreen <= W - MARGIN) {
        body += `<line x1="${axisYScreen.toFixed(2)}" y1="${MARGIN}" x2="${axisYScreen.toFixed(2)}" y2="${H - MARGIN}" stroke="black" stroke-width="0.4"/>`;
      }
    }

    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = tRange[0] + (tRange[1] - tRange[0]) * (i / samples);
      let x, y;
      try { x = Number(fxFn(t)); y = Number(fyFn(t)); } catch (_e) { continue; }
      if (!isFinite(x) || !isFinite(y)) continue;
      pts.push([xToScreen(x), yToScreen(y)]);
    }

    if (pts.length > 1) {
      const polyline = pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
      body += `<polyline points="${polyline}" stroke="black" stroke-width="1" fill="none" stroke-linejoin="round"/>`;
    }

    if (showDirectionArrow && pts.length > 4) {
      const mid = Math.floor(pts.length / 2);
      const a = pts[mid - 1], b = pts[mid + 1];
      body += `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke="black" stroke-width="1" marker-end="url(#${arrowId})"/>`;
    }

    if (showStartDot && pts.length) {
      const [sx, sy] = pts[0];
      body += `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="2.5" fill="black"/>`;
      body += `<text x="${(sx + 6).toFixed(2)}" y="${(sy - 4).toFixed(2)}" font-size="9" font-style="italic" fill="black">t=${escXml(_formatT(tRange[0]))}</text>`;
    }
  } else {
    // 3D: isometric projection with x to bottom-right, y to bottom-left, z up.
    const isoScale = Number(config?.isoScale) || 30;
    const cx = W / 2;
    const cy = H / 2 + 18;
    const c30 = Math.cos(Math.PI / 6);
    const s30 = Math.sin(Math.PI / 6);
    const project = (x, y, z) => [
      cx + (x * c30 - y * c30) * isoScale,
      cy + (-z + x * s30 + y * s30) * isoScale,
    ];

    if (showAxes) {
      const xEnd = project(2, 0, 0);
      const yEnd = project(0, 2, 0);
      const zEnd = project(0, 0, 2);
      body += `<line x1="${cx}" y1="${cy}" x2="${xEnd[0].toFixed(2)}" y2="${xEnd[1].toFixed(2)}" stroke="black" stroke-width="0.4" marker-end="url(#${arrowId})"/>`;
      body += `<text x="${(xEnd[0] + 5).toFixed(2)}" y="${(xEnd[1] + 10).toFixed(2)}" font-size="11" font-style="italic" fill="black">x</text>`;
      body += `<line x1="${cx}" y1="${cy}" x2="${yEnd[0].toFixed(2)}" y2="${yEnd[1].toFixed(2)}" stroke="black" stroke-width="0.4" marker-end="url(#${arrowId})"/>`;
      body += `<text x="${(yEnd[0] - 12).toFixed(2)}" y="${(yEnd[1] + 10).toFixed(2)}" font-size="11" font-style="italic" fill="black">y</text>`;
      body += `<line x1="${cx}" y1="${cy}" x2="${zEnd[0].toFixed(2)}" y2="${zEnd[1].toFixed(2)}" stroke="black" stroke-width="0.4" marker-end="url(#${arrowId})"/>`;
      body += `<text x="${(zEnd[0] + 5).toFixed(2)}" y="${(zEnd[1] + 3).toFixed(2)}" font-size="11" font-style="italic" fill="black">z</text>`;
    }

    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = tRange[0] + (tRange[1] - tRange[0]) * (i / samples);
      let x, y, z;
      try { x = Number(fxFn(t)); y = Number(fyFn(t)); z = Number(fzFn(t)); } catch (_e) { continue; }
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
      pts.push(project(x, y, z));
    }

    if (pts.length > 1) {
      const polyline = pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
      body += `<polyline points="${polyline}" stroke="black" stroke-width="1" fill="none" stroke-linejoin="round"/>`;
    }

    if (showDirectionArrow && pts.length > 4) {
      const mid = Math.floor(pts.length / 2);
      const a = pts[mid - 1], b = pts[mid + 1];
      body += `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke="black" stroke-width="1" marker-end="url(#${arrowId})"/>`;
    }

    if (showStartDot && pts.length) {
      const [sx, sy] = pts[0];
      body += `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="2.5" fill="black"/>`;
      body += `<text x="${(sx + 6).toFixed(2)}" y="${(sy - 4).toFixed(2)}" font-size="9" font-style="italic" fill="black">t=${escXml(_formatT(tRange[0]))}</text>`;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    defs +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    body +
    `</svg>`;
}

export async function parametricToBase64PNG(config, width = PANEL_W, height = PANEL_H) {
  return svgToBase64PNG(buildParametricSvg(config, { width, height }), width, height);
}

export default function ParametricGraph({ config, width, height, style }) {
  const W = width  || PANEL_W;
  const H = height || PANEL_H;
  const svg = buildParametricSvg(config, { width: W, height: H });
  return (
    <div
      style={{ width: W, height: H, display: "inline-block", lineHeight: 0, ...(style || {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
