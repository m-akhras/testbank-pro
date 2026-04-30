"use client";

// Level-curve / contour renderer using marching squares. Pure SVG, B&W only.
// Saddle cases (5 and 10) are disambiguated against the cell-center value so
// hyperbolic contours come out connected the right way. NaN / Infinity at a
// sample (eg from 1/x near a pole) is treated as +Infinity so the algorithm
// silently skirts singularities rather than emitting garbage segments.

import { compileExpression } from "../../lib/utils/exprCompile.js";
import { svgToBase64PNG, escXml } from "./svgRasterize.js";

const PANEL_W = 300;
const PANEL_H = 280;
const MARGIN  = 14;

export function buildContourSvg(config, opts = {}) {
  const W = opts.width  || PANEL_W;
  const H = opts.height || PANEL_H;
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-3, 3];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-3, 3];
  const levels = Array.isArray(config?.levels) ? config.levels : [1, 4, 9];
  const showAxes   = config?.showAxes !== false;
  const showLabels = config?.showLabels !== false;
  const resolution = Math.max(30, Math.min(150, Number(config?.resolution) || 80));

  const fn = compileExpression(config?.expression, ["x", "y"]);
  if (!fn) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
      `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
      `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="11" fill="black">Invalid expression: ${escXml(config?.expression ?? "?")}</text>` +
      `</svg>`;
  }

  const innerW = W - 2 * MARGIN;
  const innerH = H - 2 * MARGIN;
  const xToScreen = x => MARGIN + ((x - xRange[0]) / (xRange[1] - xRange[0])) * innerW;
  const yToScreen = y => MARGIN + ((yRange[1] - y) / (yRange[1] - yRange[0])) * innerH;

  // Sample grid of f(x, y).
  const dx = (xRange[1] - xRange[0]) / (resolution - 1);
  const dy = (yRange[1] - yRange[0]) / (resolution - 1);
  const grid = [];
  for (let i = 0; i < resolution; i++) {
    const row = [];
    const x = xRange[0] + i * dx;
    for (let j = 0; j < resolution; j++) {
      const y = yRange[0] + j * dy;
      let v;
      try { v = Number(fn(x, y)); } catch (_e) { v = Infinity; }
      if (!isFinite(v)) v = Infinity;
      row.push(v);
    }
    grid.push(row);
  }

  let curveXml = "";
  const labelAnchor = {}; // level → { worldX, worldY } chosen at the rightmost segment endpoint

  for (const rawLevel of levels) {
    const level = Number(rawLevel);
    if (!isFinite(level)) continue;

    for (let i = 0; i < resolution - 1; i++) {
      const x0 = xRange[0] + i * dx;
      const x1 = x0 + dx;
      for (let j = 0; j < resolution - 1; j++) {
        const y0 = yRange[0] + j * dy;
        const y1 = y0 + dy;

        const v00 = grid[i][j];     // bottom-left
        const v10 = grid[i + 1][j]; // bottom-right
        const v11 = grid[i + 1][j + 1]; // top-right
        const v01 = grid[i][j + 1]; // top-left

        const code = (v00 > level ? 1 : 0)
                   | (v10 > level ? 2 : 0)
                   | (v11 > level ? 4 : 0)
                   | (v01 > level ? 8 : 0);
        if (code === 0 || code === 15) continue;

        const lerp = (va, vb, a, b) => {
          if (Math.abs(vb - va) < 1e-12) return (a + b) / 2;
          const t = (level - va) / (vb - va);
          return a + Math.max(0, Math.min(1, t)) * (b - a);
        };
        const eB = () => [lerp(v00, v10, x0, x1), y0];
        const eR = () => [x1, lerp(v10, v11, y0, y1)];
        const eT = () => [lerp(v01, v11, x0, x1), y1];
        const eL = () => [x0, lerp(v00, v01, y0, y1)];

        let pieces = [];
        switch (code) {
          case 1:  pieces = [[eL(), eB()]]; break;
          case 2:  pieces = [[eB(), eR()]]; break;
          case 3:  pieces = [[eL(), eR()]]; break;
          case 4:  pieces = [[eT(), eR()]]; break;
          case 5: {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            let center; try { center = Number(fn(cx, cy)); } catch (_e) { center = -Infinity; }
            if (!isFinite(center)) center = -Infinity;
            if (center > level) pieces = [[eL(), eT()], [eR(), eB()]];
            else                pieces = [[eL(), eB()], [eR(), eT()]];
            break;
          }
          case 6:  pieces = [[eT(), eB()]]; break;
          case 7:  pieces = [[eL(), eT()]]; break;
          case 8:  pieces = [[eL(), eT()]]; break;
          case 9:  pieces = [[eT(), eB()]]; break;
          case 10: {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
            let center; try { center = Number(fn(cx, cy)); } catch (_e) { center = -Infinity; }
            if (!isFinite(center)) center = -Infinity;
            if (center > level) pieces = [[eL(), eB()], [eR(), eT()]];
            else                pieces = [[eL(), eT()], [eR(), eB()]];
            break;
          }
          case 11: pieces = [[eT(), eR()]]; break;
          case 12: pieces = [[eL(), eR()]]; break;
          case 13: pieces = [[eR(), eB()]]; break;
          case 14: pieces = [[eL(), eB()]]; break;
        }

        for (const [a, b] of pieces) {
          const sx1 = xToScreen(a[0]).toFixed(2);
          const sy1 = yToScreen(a[1]).toFixed(2);
          const sx2 = xToScreen(b[0]).toFixed(2);
          const sy2 = yToScreen(b[1]).toFixed(2);
          curveXml += `<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}" stroke="black" stroke-width="0.8" stroke-linecap="round"/>`;

          if (showLabels) {
            const cur = labelAnchor[level];
            const rx = a[0] > b[0] ? a[0] : b[0];
            const ry = a[0] > b[0] ? a[1] : b[1];
            if (!cur || rx > cur.worldX) labelAnchor[level] = { worldX: rx, worldY: ry };
          }
        }
      }
    }
  }

  let labelXml = "";
  if (showLabels) {
    for (const [lvlStr, pos] of Object.entries(labelAnchor)) {
      const sx = xToScreen(pos.worldX);
      const sy = yToScreen(pos.worldY);
      const text = `c=${Number(lvlStr)}`;
      const tw = Math.max(18, text.length * 5.5);
      labelXml += `<rect x="${(sx - tw / 2).toFixed(2)}" y="${(sy - 7).toFixed(2)}" width="${tw}" height="11" fill="white"/>`;
      labelXml += `<text x="${sx.toFixed(2)}" y="${(sy + 2).toFixed(2)}" text-anchor="middle" font-size="9" fill="black">${escXml(text)}</text>`;
    }
  }

  let axesXml = "";
  if (showAxes) {
    const axisX = yToScreen(0);
    const axisY = xToScreen(0);
    if (axisX >= MARGIN && axisX <= H - MARGIN) {
      axesXml += `<line x1="${MARGIN}" y1="${axisX.toFixed(2)}" x2="${W - MARGIN}" y2="${axisX.toFixed(2)}" stroke="black" stroke-width="0.4"/>`;
    }
    if (axisY >= MARGIN && axisY <= W - MARGIN) {
      axesXml += `<line x1="${axisY.toFixed(2)}" y1="${MARGIN}" x2="${axisY.toFixed(2)}" y2="${H - MARGIN}" stroke="black" stroke-width="0.4"/>`;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    axesXml +
    curveXml +
    labelXml +
    `</svg>`;
}

export async function contourToBase64PNG(config, width = PANEL_W, height = PANEL_H) {
  return svgToBase64PNG(buildContourSvg(config, { width, height }), width, height);
}

export default function ContourGraph({ config, width, height, style }) {
  const W = width  || PANEL_W;
  const H = height || PANEL_H;
  const svg = buildContourSvg(config, { width: W, height: H });
  return (
    <div
      style={{ width: W, height: H, display: "inline-block", lineHeight: 0, ...(style || {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
