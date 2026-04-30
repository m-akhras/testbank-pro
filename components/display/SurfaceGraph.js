"use client";

// 3D surface renderer for z = f(x, y). Five canonical hints get hand-tuned
// wireframes that read clearly in B&W; an unhinted config falls back to a
// depth-sorted white-fill polygon mesh that approximates hidden-line
// removal without a full z-buffer.
//
// Iso projection: x → bottom-right, y → bottom-left, z → up.

import { compileExpression } from "../../lib/utils/exprCompile.js";
import { svgToBase64PNG, escXml } from "./svgRasterize.js";

const PANEL_W = 300;
const PANEL_H = 280;

let _arrowCounter = 0;
function _nextArrowId() { return `srfArr${++_arrowCounter}`; }

const HINTS = ["paraboloid", "saddle", "plane", "cone", "sphere"];

function _makeProjector(W, H, isoScale) {
  const cx = W / 2;
  const cy = H / 2 + 18;
  const c30 = Math.cos(Math.PI / 6);
  const s30 = Math.sin(Math.PI / 6);
  return (x, y, z) => [
    cx + (x * c30 - y * c30) * isoScale,
    cy + (-z + x * s30 + y * s30) * isoScale,
  ];
}

function _polyline(pts, opts = {}) {
  if (!pts || pts.length < 2) return "";
  const stroke = opts.stroke || "black";
  const sw = opts.strokeWidth ?? 0.7;
  const dash = opts.dash ? `stroke-dasharray="${opts.dash}"` : "";
  return `<polyline points="${pts.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ")}" stroke="${stroke}" stroke-width="${sw}" fill="none" ${dash}/>`;
}

function _renderAxes(W, H, project, arrowId) {
  let out = "";
  const O = project(0, 0, 0);
  const xEnd = project(2, 0, 0);
  const yEnd = project(0, 2, 0);
  const zEnd = project(0, 0, 2);
  out += `<line x1="${O[0].toFixed(2)}" y1="${O[1].toFixed(2)}" x2="${xEnd[0].toFixed(2)}" y2="${xEnd[1].toFixed(2)}" stroke="black" stroke-width="0.4" marker-end="url(#${arrowId})"/>`;
  out += `<text x="${(xEnd[0] + 5).toFixed(2)}" y="${(xEnd[1] + 10).toFixed(2)}" font-size="11" font-style="italic" fill="black">x</text>`;
  out += `<line x1="${O[0].toFixed(2)}" y1="${O[1].toFixed(2)}" x2="${yEnd[0].toFixed(2)}" y2="${yEnd[1].toFixed(2)}" stroke="black" stroke-width="0.4" marker-end="url(#${arrowId})"/>`;
  out += `<text x="${(yEnd[0] - 12).toFixed(2)}" y="${(yEnd[1] + 10).toFixed(2)}" font-size="11" font-style="italic" fill="black">y</text>`;
  out += `<line x1="${O[0].toFixed(2)}" y1="${O[1].toFixed(2)}" x2="${zEnd[0].toFixed(2)}" y2="${zEnd[1].toFixed(2)}" stroke="black" stroke-width="0.4" marker-end="url(#${arrowId})"/>`;
  out += `<text x="${(zEnd[0] + 5).toFixed(2)}" y="${(zEnd[1] + 3).toFixed(2)}" font-size="11" font-style="italic" fill="black">z</text>`;
  return out;
}

// ── Hinted renderers ────────────────────────────────────────────────────────

function _renderParaboloid(config, project) {
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-2, 2];
  const R = Math.min(xRange[1] - xRange[0], yRange[1] - yRange[0]) / 2;
  const zApex = R; // apex sits zApex units above the bottom ellipse plane
  let out = "";

  // 4 concentric ellipses, decreasing radius going up
  const stops = [0, 0.3, 0.6, 0.85];
  for (const t of stops) {
    const r = R * (1 - t);
    const z = zApex * t;
    const pts = [];
    const N = 80;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI;
      pts.push(project(r * Math.cos(a), r * Math.sin(a), z));
    }
    out += _polyline(pts, { strokeWidth: 0.7 });
  }

  // 4 vertical ribs spaced 90° apart, sweeping from bottom rim to apex
  const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
  for (const a of angles) {
    const pts = [];
    const N = 30;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const r = R * (1 - t);
      const z = zApex * t;
      pts.push(project(r * Math.cos(a), r * Math.sin(a), z));
    }
    out += _polyline(pts, { strokeWidth: 0.7 });
  }
  return out;
}

function _renderSaddle(config, project) {
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-2, 2];
  const a = 0.3; // visual scale; topology is what matters here
  let out = "";

  // Three rising arcs along the x-direction at y = yMin/2, 0, yMax/2
  const yVals = [yRange[0] / 2, 0, yRange[1] / 2];
  for (const y of yVals) {
    const pts = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const x = xRange[0] + (xRange[1] - xRange[0]) * (i / N);
      pts.push(project(x, y, a * (x * x - y * y)));
    }
    out += _polyline(pts, { strokeWidth: 0.7, dash: Math.abs(y) < 1e-6 ? "3,2" : null });
  }

  // Three falling arcs along the y-direction at x = xMin/2, 0, xMax/2
  const xVals = [xRange[0] / 2, 0, xRange[1] / 2];
  for (const x of xVals) {
    const pts = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const y = yRange[0] + (yRange[1] - yRange[0]) * (i / N);
      pts.push(project(x, y, a * (x * x - y * y)));
    }
    out += _polyline(pts, { strokeWidth: 0.7, dash: Math.abs(x) < 1e-6 ? "3,2" : null });
  }
  return out;
}

function _renderPlane(config, project) {
  // Without parsing the expression, render a representative tilted plane:
  // triangle whose vertices are the unit intercepts on each axis. Mesh lines
  // connect equal-fraction subdivisions of each pair of edges (4 per pair).
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const X = xRange[1] || 2;
  const v1 = project(X, 0, 0);
  const v2 = project(0, X, 0);
  const v3 = project(0, 0, X);
  let out = "";

  out += `<polyline points="${v1[0].toFixed(2)},${v1[1].toFixed(2)} ${v2[0].toFixed(2)},${v2[1].toFixed(2)} ${v3[0].toFixed(2)},${v3[1].toFixed(2)} ${v1[0].toFixed(2)},${v1[1].toFixed(2)}" stroke="black" stroke-width="1" fill="none"/>`;

  // 4 mesh lines parallel to each pair of edges (3 pairs × 4 = 12 lines)
  for (let k = 1; k <= 3; k++) {
    const t = k / 4;
    const pairs = [
      [v1, v2, v3],
      [v2, v1, v3],
      [v3, v1, v2],
    ];
    for (const [a, b, c] of pairs) {
      const p1 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const p2 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
      out += `<line x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" stroke="black" stroke-width="0.5"/>`;
    }
  }

  for (const v of [v1, v2, v3]) {
    out += `<circle cx="${v[0].toFixed(2)}" cy="${v[1].toFixed(2)}" r="2.5" fill="black"/>`;
  }
  return out;
}

function _renderCone(config, project) {
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : xRange;
  const R = Math.min(xRange[1] - xRange[0], yRange[1] - yRange[0]) / 2;
  const zMax = R;
  let out = "";

  // Top ellipse at z = zMax (full radius), shoulder ellipse at z = zMax/2 (half radius)
  for (const ring of [{ z: zMax, r: R }, { z: zMax / 2, r: R / 2 }]) {
    const pts = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * 2 * Math.PI;
      pts.push(project(ring.r * Math.cos(a), ring.r * Math.sin(a), ring.z));
    }
    out += _polyline(pts, { strokeWidth: 0.8 });
  }

  // 6 radial lines from apex (origin) to the top rim
  const apex = project(0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const top = project(R * Math.cos(a), R * Math.sin(a), zMax);
    out += `<line x1="${apex[0].toFixed(2)}" y1="${apex[1].toFixed(2)}" x2="${top[0].toFixed(2)}" y2="${top[1].toFixed(2)}" stroke="black" stroke-width="0.7"/>`;
  }
  return out;
}

function _renderSphere(config, project) {
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const r = (xRange[1] - xRange[0]) / 2 || 1.5;
  const N = 80;
  let out = "";

  // xy-plane equator (z = 0)
  const xy = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    xy.push(project(r * Math.cos(a), r * Math.sin(a), 0));
  }
  out += _polyline(xy, { strokeWidth: 0.8 });

  // xz-plane meridian (y = 0)
  const xz = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    xz.push(project(r * Math.cos(a), 0, r * Math.sin(a)));
  }
  out += _polyline(xz, { strokeWidth: 0.8 });

  // yz-plane meridian (x = 0)
  const yz = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    yz.push(project(0, r * Math.cos(a), r * Math.sin(a)));
  }
  out += _polyline(yz, { strokeWidth: 0.8 });
  return out;
}

// Generic mesh fallback. Each cell becomes a white-filled polygon so that
// front cells overwrite back cells when drawn back-to-front. Depth = world
// (x + y) at the cell midpoint — reasonable approximation for typical
// textbook surfaces in iso projection.
function _renderGenericMesh(config, project) {
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-2, 2];
  const meshDensity = Math.max(6, Math.min(20, Number(config?.meshDensity) || 12));

  const fn = compileExpression(config?.expression, ["x", "y"]);
  if (!fn) {
    return `<text x="150" y="140" text-anchor="middle" font-size="11" fill="black">Invalid expression: ${escXml(config?.expression ?? "?")}</text>`;
  }

  const grid = [];
  const dx = (xRange[1] - xRange[0]) / (meshDensity - 1);
  const dy = (yRange[1] - yRange[0]) / (meshDensity - 1);
  for (let i = 0; i < meshDensity; i++) {
    const row = [];
    const x = xRange[0] + i * dx;
    for (let j = 0; j < meshDensity; j++) {
      const y = yRange[0] + j * dy;
      let z; try { z = Number(fn(x, y)); } catch (_e) { z = 0; }
      if (!isFinite(z)) z = 0;
      row.push({ x, y, z, p: project(x, y, z) });
    }
    grid.push(row);
  }

  const cells = [];
  for (let i = 0; i < meshDensity - 1; i++) {
    for (let j = 0; j < meshDensity - 1; j++) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      const c = grid[i + 1][j + 1];
      const d = grid[i][j + 1];
      const depth = (a.x + b.x + c.x + d.x + a.y + b.y + c.y + d.y) / 4;
      cells.push({ corners: [a.p, b.p, c.p, d.p], depth });
    }
  }
  cells.sort((a, b) => a.depth - b.depth);

  let out = "";
  for (const cell of cells) {
    const pts = cell.corners.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    out += `<polygon points="${pts}" fill="white" stroke="black" stroke-width="0.5"/>`;
  }
  return out;
}

export function buildSurfaceSvg(config, opts = {}) {
  const W = opts.width  || PANEL_W;
  const H = opts.height || PANEL_H;
  const isoScale = Number(config?.isoScale) || 30;
  const showAxes = config?.showAxes !== false;
  const project = _makeProjector(W, H, isoScale);
  const arrowId = _nextArrowId();

  const defs = `<defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="black"/></marker></defs>`;

  let body = "";
  const hint = HINTS.includes(config?.hint) ? config.hint : null;
  if (hint === "paraboloid") body += _renderParaboloid(config, project);
  else if (hint === "saddle")  body += _renderSaddle(config, project);
  else if (hint === "plane")   body += _renderPlane(config, project);
  else if (hint === "cone")    body += _renderCone(config, project);
  else if (hint === "sphere")  body += _renderSphere(config, project);
  else                         body += _renderGenericMesh(config, project);

  // Axes drawn last so they read on top of the surface
  if (showAxes) body += _renderAxes(W, H, project, arrowId);

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    defs +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    body +
    `</svg>`;
}

export async function surfaceToBase64PNG(config, width = PANEL_W, height = PANEL_H) {
  return svgToBase64PNG(buildSurfaceSvg(config, { width, height }), width, height);
}

export default function SurfaceGraph({ config, width, height, style }) {
  const W = width  || PANEL_W;
  const H = height || PANEL_H;
  const svg = buildSurfaceSvg(config, { width: W, height: H });
  return (
    <div
      style={{ width: W, height: H, display: "inline-block", lineHeight: 0, ...(style || {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
