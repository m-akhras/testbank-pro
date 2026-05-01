"use client";

// Vector field renderer — pure SVG, black-and-white only, designed for printed
// exam output. The same SVG-builder powers the on-screen React component, the
// docx PNG embedder, and the QTI base64 inliner so all three paths show
// identical glyphs.

const VF_PANEL_W = 300;
const VF_PANEL_H = 280;
const VF_MARGIN  = 14;

let _vfMarkerCounter = 0;
function _nextMarkerId() { return `vfArr${++_vfMarkerCounter}`; }

function _escXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Compile a math expression string into a (x,y)→number function.
// Returns null if the expression is unparseable. Uses Function() — no mathjs
// dependency needed for the simple polynomial / trig / exp expressions Calc 3
// vector fields produce.
function _compileExpression(expr) {
  if (typeof expr !== "string" || !expr.trim()) return null;
  const safe = expr
    .replace(/\^/g, "**")
    .replace(/\b(sin|cos|tan|exp|log|ln|sqrt|abs|atan|asin|acos|sinh|cosh|tanh|min|max|pow|floor|ceil|round|sign)\b/g, m => m === "ln" ? "Math.log" : `Math.${m}`)
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\bE\b/g, "Math.E");
  try {
    const fn = new Function("x", "y", `"use strict"; return (${safe});`);
    const v = fn(0.5, 0.5);
    if (typeof v !== "number" && typeof v !== "boolean") return null;
    return fn;
  } catch (_e) {
    return null;
  }
}

// Public: take a vectorField config and produce a complete SVG document string.
// Pure black on white. Auto-scales arrow length so density-heavy panels stay
// readable: scale = (cellSize * 0.6) / maxMagnitude, with cellSize derived
// from the panel width and the grid density. Stroke width and arrowhead size
// also shrink at higher densities so 9×9 grids don't look like ink blots.
// Tolerates singular cells (mag=0 → dot, NaN → dot).
export function buildVectorFieldSvg(config, opts = {}) {
  const W = opts.width  || VF_PANEL_W;
  const H = opts.height || VF_PANEL_H;
  const xRange = Array.isArray(config?.xRange) ? config.xRange : [-2, 2];
  const yRange = Array.isArray(config?.yRange) ? config.yRange : [-2, 2];
  // Default density bumped from 5 → 9: 5×5 panels read as sparse and made
  // distractors hard to differentiate visually. 9×9 is dense enough to show
  // rotational/divergent character at a glance. Authors can still pass 3–9.
  const density = Math.max(3, Math.min(9, Number(config?.gridDensity) || 9));
  const showAxes  = config?.showAxes  !== false;
  const showOrigin = config?.showOrigin !== false;
  const markerId = _nextMarkerId();

  // Heavier strokes / larger arrowheads for print legibility. The previous
  // density-based reduction made 9×9 panels nearly invisible on paper.
  const arrowStrokeWidth = 1.0;
  const arrowMarkerSize  = 6;
  // Minimum on-screen arrow length so short-magnitude samples near the
  // origin / zeros of the field still render visibly instead of
  // disappearing under the arrowhead.
  const MIN_ARROW_PX = 6;

  const fxFn = _compileExpression(config?.fx);
  const fyFn = _compileExpression(config?.fy);

  if (!fxFn || !fyFn) {
    const msg = `Invalid expression: ${_escXml(config?.fx ?? "?")} or ${_escXml(config?.fy ?? "?")}`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
      `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
      `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="11" fill="black">${msg}</text>` +
      `</svg>`;
  }

  const innerW = W - 2 * VF_MARGIN;
  const innerH = H - 2 * VF_MARGIN;
  const xToScreen = x => VF_MARGIN + ((x - xRange[0]) / (xRange[1] - xRange[0])) * innerW;
  const yToScreen = y => VF_MARGIN + ((yRange[1] - y) / (yRange[1] - yRange[0])) * innerH;

  // cellSize = panelWidth / (gridDensity + 1) — slightly smaller than the
  // raw between-sample spacing so arrows stay clearly inside their cell with
  // no overlap into neighbours, regardless of density.
  const cellSize = W / (density + 1);

  const samples = [];
  let maxMag = 0;
  for (let i = 0; i < density; i++) {
    for (let j = 0; j < density; j++) {
      const x = xRange[0] + (i / (density - 1)) * (xRange[1] - xRange[0]);
      const y = yRange[0] + (j / (density - 1)) * (yRange[1] - yRange[0]);
      let dx = 0, dy = 0;
      try { dx = Number(fxFn(x, y)); dy = Number(fyFn(x, y)); } catch (_e) { dx = 0; dy = 0; }
      if (!isFinite(dx) || !isFinite(dy)) { dx = 0; dy = 0; }
      const mag = Math.hypot(dx, dy);
      if (mag > maxMag) maxMag = mag;
      samples.push({ x, y, dx, dy, mag });
    }
  }

  const targetLen = cellSize * 0.6;
  const scale = maxMag > 1e-9 ? targetLen / maxMag : 1;

  let arrows = "";
  for (const s of samples) {
    const sx = xToScreen(s.x);
    const sy = yToScreen(s.y);
    if (s.mag < 1e-9) {
      arrows += `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="1.2" fill="black"/>`;
      continue;
    }
    let dxPx = s.dx * scale;
    let dyPx = -s.dy * scale; // SVG y inverted
    const lenPx = Math.hypot(dxPx, dyPx);
    if (lenPx > 0 && lenPx < MIN_ARROW_PX) {
      const k = MIN_ARROW_PX / lenPx;
      dxPx *= k;
      dyPx *= k;
    }
    const ex = sx + dxPx;
    const ey = sy + dyPx;
    arrows += `<line x1="${sx.toFixed(2)}" y1="${sy.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" stroke="black" stroke-width="${arrowStrokeWidth}" marker-end="url(#${markerId})"/>`;
  }

  let axes = "";
  if (showAxes) {
    const yAxisScreen = yToScreen(0);
    const xAxisScreen = xToScreen(0);
    if (yAxisScreen >= VF_MARGIN && yAxisScreen <= H - VF_MARGIN) {
      axes += `<line x1="${VF_MARGIN}" y1="${yAxisScreen.toFixed(2)}" x2="${W - VF_MARGIN}" y2="${yAxisScreen.toFixed(2)}" stroke="black" stroke-width="0.4"/>`;
    }
    if (xAxisScreen >= VF_MARGIN && xAxisScreen <= W - VF_MARGIN) {
      axes += `<line x1="${xAxisScreen.toFixed(2)}" y1="${VF_MARGIN}" x2="${xAxisScreen.toFixed(2)}" y2="${H - VF_MARGIN}" stroke="black" stroke-width="0.4"/>`;
    }
  }

  let origin = "";
  if (showOrigin) {
    const ox = xToScreen(0);
    const oy = yToScreen(0);
    if (ox >= VF_MARGIN && ox <= W - VF_MARGIN && oy >= VF_MARGIN && oy <= H - VF_MARGIN) {
      origin = `<circle cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}" r="1.4" fill="black"/>`;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    `<defs>` +
      `<marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${arrowMarkerSize}" markerHeight="${arrowMarkerSize}" orient="auto-start-reverse">` +
        `<path d="M0 0 L10 5 L0 10 z" fill="black"/>` +
      `</marker>` +
    `</defs>` +
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="white" stroke="black" stroke-width="0.5" rx="4"/>` +
    axes +
    arrows +
    origin +
    `</svg>`;
}

// Rasterize a vectorField config to a base64 PNG data URL. Browser-only —
// returns null in any non-browser context. Uses canvas at 2× resolution so
// the embedded image stays crisp in print.
export async function vectorFieldToBase64PNG(config, width = VF_PANEL_W, height = VF_PANEL_H) {
  if (typeof window === "undefined") return null;
  const svgString = buildVectorFieldSvg(config, { width, height });
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (_e) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export default function VectorFieldGraph({ config, width, height, style }) {
  const W = width  || VF_PANEL_W;
  const H = height || VF_PANEL_H;
  const svg = buildVectorFieldSvg(config, { width: W, height: H });
  return (
    <div
      style={{ width: W, height: H, display: "inline-block", lineHeight: 0, ...(style || {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
