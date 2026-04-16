"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { COURSES, getCourse, typeInstructions } from "../lib/courses/index.js";
import { isPipeTable, normalizePipeTable, splitTableBlocks, mathStepsOnly } from "../lib/exports/helpers.js";
import { evalFn, graphToBase64PNG } from "../lib/exports/graphRendering.js";
import { buildQTI, buildQTIZip, buildClassroomSectionsQTI, buildQTICompare, buildQTIAllSectionsMerged, canvasExportConfig, validateQTIExport } from "../lib/exports/qti.js";
import { buildAnswerKey, buildDocx, buildDocxCompare } from "../lib/exports/docx.js";
import { dlFile, dlBlob } from "../lib/exports/utils.js";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Theme tokens — Warm Ivory & Forest Green (module-level so all components can use them) ──
const bg0   = "#F2EDE4";
const bg1   = "#FDFAF5";
const bg2   = "#F7F2E9";
const bg3   = "#EDE8DE";
const border = "#D9D0C0";
const text1  = "#1C1A16";
const text2  = "#6B6355";
const text3  = "#A89E8E";
const green1 = "#2D6A4F";
const green2 = "#1B4332";
const green3 = "#52B788";

// ─── KaTeX helpers ───────────────────────────────────────────────────────────
// Helper: convert plain math expression to LaTeX WITHOUT \(...\) wrapper
function innerLatex(expr) {
  let e = String(expr ?? "");
  e = e.replace(/\btheta\b/gi, '\\theta');
  e = e.replace(/\bphi\b/gi, '\\phi');
  e = e.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, '\\pi');
  const toks = [];
  function stash2(v) { toks.push(v); return '\x03'+(toks.length-1)+'\x03'; }
  function unstash2(t) { return t.replace(/\x03(\d+)\x03/g, function(_,i){ return toks[parseInt(i)]; }); }
  // Stash fn(x) calls but NOT sqrt/cbrt
  let p1; do { p1=e; e=e.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)'?\(([^()]*)\)/g, function(m){ return stash2(m); }); } while(e!==p1);
  // Stash (expr)^n
  let p2; do { p2=e; e=e.replace(/\(([^()]+)\)\^(-?[0-9a-zA-Z]+)/g, function(m){ return stash2(m); }); } while(e!==p2);
  // Stash (a)/(b) fractions inside sqrt args
  let p4; do { p4=e; e=e.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, function(m){ return stash2(m); }); } while(e!==p4);
  // Step 3: sqrt now sees flat content
  let p3;
  do { p3=e; e=e.replace(/sqrt\(([^()]*)\)/g, function(_,x){ return '\\sqrt{'+unstash2(x)+'}'; }); } while(e!==p3);
  e = unstash2(e);
  // Convert remaining math
  e = e.replace(/\(([^()]+)\)\^\((-?[0-9]+)\/([0-9]+)\)/g, function(_,b,n,d){ return '\\left('+b+'\\right)^{\\frac{'+n+'}{'+d+'}}'; });
  e = e.replace(/([a-zA-Z0-9])\^\((-?[0-9]+)\/([0-9]+)\)/g, function(_,b,n,d){ return b+'^{\\frac{'+n+'}{'+d+'}}'; });
  e = e.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, function(_,b,x){ return b+'^{'+x+'}'; });
  e = e.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, function(_,n,d){ return '\\frac{'+n+'}{'+d+'}'; });
  e = e.replace(/\b([0-9]+)\/([0-9]+)\b/g, function(_,n,d){ return '\\frac{'+n+'}{'+d+'}'; });
  e = e.replace(/\b(sin|cos|tan|sec|csc|cot|ln|log|arcsin|arccos|arctan)\b/g, function(_,fn){ return '\\'+fn; });
  return e;
}

function toLatex(raw) {
  let s = String(raw ?? "");

  // Already has \( \) — pass through
  if (s.includes("\\(")) return s;

  const inf = "\\infty";
  const fix = x => x.replace(/\binf(inity)?\b/gi, inf).trim();

  // Integrals — convert inner expression fully before wrapping
  s = s.replace(/\bintegral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+(.+?)\s+d([a-z])\b/gi,
    (_,a,b,f,v)=>`\\(\\int_{${fix(innerLatex(a))}}^{${fix(innerLatex(b))}} ${innerLatex(f)}\\,d${v}\\)`);
  s = s.replace(/\bintegral\s+of\s+(.+?)\s+d([a-z])\b/gi,
    (_,f,v)=>`\\(\\int ${innerLatex(f)}\\,d${v}\\)`);

  // != → ≠ before anything else
  s = s.replace(/!=/g, '≠');
  s = s.replace(/(?<![<>])<=(?![>=])/g, '≤');
  s = s.replace(/(?<![<>])>=(?![<=])/g, '≥');

  // Limits
  s = s.replace(/\blim(?:it)?\s+as\s+\(([^)]+)\)\s*(?:->|→)\s*\(([^)]+)\)/gi,
    (_,v,a)=>`\\(\\lim_{(${v})\\to(${fix(a)})}\\)`);
  s = s.replace(/\blim(?:it)?\s+as\s+([a-zA-Z,\s]+?)\s*(?:->|→|\\to)\s*([^\s,;.(]+)\s*of\b/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);
  s = s.replace(/\blim(?:it)?\s+as\s+([a-zA-Z,\s]+?)\s*(?:->|→|\\to)\s*([^\s,;.(]+)/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);
  // Also handle plain "lim_{x->a}" not wrapped in \( \)
  s = s.replace(/(?<!\\\()\blim_\{([^}]+)\}/gi,
    (_,sub)=>`\\(\\lim_{${sub.replace(/->/g,'\\to')}}\\)`);

  // Derivatives
  s = s.replace(/\bd\/d([a-z])\s*\[([^\]]+)\]/g, (_,v,f)=>`\\(\\dfrac{d}{d${v}}\\left[${f}\\right]\\)`);
  s = s.replace(/\bd\/d([a-z])\s*\(([^)]+)\)/g,  (_,v,f)=>`\\(\\dfrac{d}{d${v}}\\left(${f}\\right)\\)`);
  s = s.replace(/\bd\^2([a-zA-Z])\/d([a-z])\^2\b/g, (_,y,x)=>`\\(\\dfrac{d^2${y}}{d${x}^2}\\)`);
  s = s.replace(/\bd([a-zA-Z])\/d([a-z])\b/g,    (_,y,x)=>`\\(\\dfrac{d${y}}{d${x}}\\)`);
  s = s.replace(/\bd\/d([a-z])\b/g,              (_,v)  =>`\\(\\dfrac{d}{d${v}}\\)`);

  // Partial derivatives
  s = s.replace(/∂([a-zA-Z0-9]*)\/∂([a-z])/g, (_,f,v)=>`\\(\\dfrac{\\partial ${f}}{\\partial ${v}}\\)`);

  // Trig & log functions with args
  s = s.replace(/\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log)\(([^)]+)\)/g,
    (_,fn,arg)=>`\\(\\${fn}(${innerLatex(arg)})\\)`);

  // Pre-process for sqrt: temporarily replace f'(x), g(x) style calls and (expr)^n
  // so sqrt() sees flat content with no nested parens
  const tokens = [];
  function stash(val) { tokens.push(val); return `\x02${tokens.length-1}\x02`; }
  function unstash(t) { return t.replace(/\x02(\d+)\x02/g, (_,i) => tokens[parseInt(i)]); }

  // Stash (expr)^n — innermost first
  let pp;
  do {
    pp = s;
    s = s.replace(/\(([^()]+)\)\^(\{[^}]+\}|-?[0-9]+(?:\.[0-9]+)?|[a-zA-Z])/g,
      (m) => stash(m));
  } while (s !== pp);

  // Stash fn(expr) calls — including single-letter like f(x), g(x), but NOT sqrt/cbrt
  s = s.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)'?\(([^()]*)\)/g, function(m, fn) {
    if (fn === 'sqrt' || fn === 'cbrt') return m;
    return stash(m);
  });

  // NOW sqrt can see flat content
  let prev;
  do {
    prev = s;
    s = s.replace(/sqrt\(([^()]*)\)/g, (_, x) => {
      const inner = unstash(x);
      return `\\(\\sqrt{${innerLatex(inner)}}\\)`;
    });
  } while (s !== prev);
  s = s.replace(/cbrt\(([^()]*)\)/g, (_, x) => `\\(\\sqrt[3]{${unstash(x)}}\\)`);

  // Unstash remaining tokens
  s = unstash(s);

  // Powers with fractional/complex exponents
  s = s.replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g, (_,base,exp) => {
    const expLatex = exp.replace(/(-?[0-9]+)\/([0-9]+)/g, (_,a,b) => `\\frac{${a}}{${b}}`);
    return `\\(${base}^{${expLatex}}\\)`;
  });
  s = s.replace(/([a-zA-Z0-9])\^\{([^}]+)\}/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  // frac(a,b)
  s = s.replace(/\bfrac\(([^,)]+),\s*([^)]+)\)/g, (_,a,b)=>`\\(\\dfrac{${a.trim()}}{${b.trim()}}\\)`);

  // Inline fractions
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)\^([0-9]+)/g, (_,a,b,n)=>`\\(\\dfrac{${a}}{(${b})^{${n}}}\\)`);
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\(([^()]+)\)\/([a-zA-Z0-9][a-zA-Z0-9^+\-*]*)/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\b([a-zA-Z0-9]+\^[0-9]+)\/([a-zA-Z0-9]+(?:\^[0-9]+)?)\b/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\b([0-9]+)\/([0-9]+)\b/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);

  // e^(expr)
  s = s.replace(/\be\^\(([^)]+)\)/g, (_,x)=>`\\(e^{${x}}\\)`);
  s = s.replace(/\be\^(-?[a-zA-Z0-9]+)\b/g, (_,x)=>`\\(e^{${x}}\\)`);

  // Sums and products
  s = s.replace(/\bsum\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\sum_{${v}=${a}}^{${fix(b)}}\\)`);
  s = s.replace(/\bprod(?:uct)?\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\prod_{${v}=${a}}^{${fix(b)}}\\)`);

  // Simple powers
  s = s.replace(/([a-zA-Z0-9])\^(-?[0-9]+(?:\.[0-9]+)?)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);
  s = s.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  // Subscripts
  s = s.replace(/\b([a-zA-Z])_\{([^}]+)\}/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);
  s = s.replace(/\b([a-zA-Z])_([0-9a-zA-Z])\b/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);

  // Vectors
  s = s.replace(/<(-?[^<>]+(?:,[^<>]+)+)>/g, (_,inner)=>`\\(\\langle ${inner} \\rangle\\)`);

  // Absolute value
  s = s.replace(/\|([a-zA-Z0-9 +\-*/^._]+)\|/g, (_,x)=>`\\(\\left|${x}\\right|\\)`);

  // Symbols — use lookahead/lookbehind to catch pi after ( like (pi/6)
  s = s.replace(/\binfinity\b/gi, `\\(${inf}\\)`);
  s = s.replace(/\binf\b/g, `\\(${inf}\\)`);
  s = s.replace(/→/g, "\\(\\to\\)");
  s = s.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, "\\(\\pi\\)");
  s = s.replace(/\btheta\b/gi, "\\(\\theta\\)");
  s = s.replace(/\brho\b/gi, "\\(\\rho\\)");
  s = s.replace(/\bphi\b/gi, "\\(\\phi\\)");
  s = s.replace(/\blambda\b/gi, "\\(\\lambda\\)");
  s = s.replace(/\bsigma\b/gi, "\\(\\sigma\\)");
  s = s.replace(/\bdelta\b/gi, "\\(\\delta\\)");
  s = s.replace(/\balpha\b/gi, "\\(\\alpha\\)");
  s = s.replace(/\bbeta\b/gi, "\\(\\beta\\)");
  s = s.replace(/\bgamma\b/gi, "\\(\\gamma\\)");
  s = s.replace(/\btimes\b/g, "\\(\\times\\)");
  s = s.replace(/\bcdot\b/g, "\\(\\cdot\\)");

  return s;
}

function tokenize(raw) {
  const s = toLatex(String(raw ?? ""));
  const out = [];
  const re = /\\\((.+?)\\\)/gs;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ kind:"text", val: s.slice(last, m.index) });
    out.push({ kind:"math", val: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind:"text", val: s.slice(last) });
  return out;
}

function renderMath(latex) {
  if (!window.katex) return null;
  try {
    return window.katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: false,
      trust: true,
      macros: {
        "\\dfrac": "\\frac",
      }
    });
  } catch(e) {
    // Strip problematic parts and try simpler render
    try {
      const safe = latex.replace(/\\left|\\right/g,"");
      return window.katex.renderToString(safe, { throwOnError:false, strict:false });
    } catch {
      return `<span style="color:#e8e8e0">${latex}</span>`;
    }
  }
}

// ─── Pipe table detector & renderer ──────────────────────────────────────────
// isPipeTable, normalizePipeTable imported from lib/exports/helpers.js

function parsePipeTable(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith("|"));
  const rows = tableLines
    .filter(l => !/^\|[-\s|:]+\|$/.test(l)) // remove separator rows
    .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
  return rows;
}

function PipeTableHTML({ text }) {
  const rows = parsePipeTable(text);
  if (!rows.length) return <span>{text}</span>;
  return (
    <table style={{
      borderCollapse:"collapse", fontSize:"0.82rem", margin:"0.5rem 0",
      width:"auto", maxWidth:"100%"
    }}>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => {
            const Tag = ri === 0 ? "th" : "td";
            return (
              <Tag key={ci} style={{
                border:"1px solid "+border,
                padding:"0.3rem 0.6rem",
                background: ri === 0 ? "#1a1a35" : ci === 0 ? "#141428" : "transparent",
                color: ri === 0 ? "#a0a0c0" : "#d0d0cc",
                fontWeight: ri === 0 || ci === 0 ? "bold" : "normal",
                textAlign:"center",
                whiteSpace:"nowrap"
              }}>
                <MathText>{cell}</MathText>
              </Tag>
            );
          })}
        </tr>
      ))}
    </table>
  );
}

// splitTableBlocks imported from lib/exports/helpers.js

function MathText({ children }) {
  const ref = useRef(null);
  const src = String(children ?? "");

  // Check if text contains pipe table — normalize then use block renderer
  if (src.includes("|") && isPipeTable(src)) {
    const normalized = normalizePipeTable(src);
    const blocks = splitTableBlocks(normalized);
    return (
      <span>
        {blocks.map((block, i) =>
          block.type === "table"
            ? <PipeTableHTML key={i} text={block.content} />
            : <MathTextInline key={i}>{block.content}</MathTextInline>
        )}
      </span>
    );
  }

  return <MathTextInline>{src}</MathTextInline>;
}

function MathTextInline({ children }) {
  const ref = useRef(null);
  const src = String(children ?? "");
  useEffect(() => {
    if (!ref.current) return;
    const render = () => {
      if (!window.katex) { setTimeout(render, 80); return; }
      ref.current.innerHTML = tokenize(src).map(tok => {
        if (tok.kind === "math") {
          return renderMath(tok.val) ?? tok.val;
        }
        return tok.val.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      }).join("");
    };
    render();
  }, [src]);
  return <span ref={ref}>{src}</span>;
}


// ─── GraphDisplay component ───────────────────────────────────────────────────
// Renders a graph from q.graphConfig inline above the question text.
// Author-only toggles (showAxisNumbers, showGrid) are saved into graphConfig.
function GraphDisplay({ graphConfig, authorMode = false }) {
  const ref = useRef(null);
  const [showNumbers, setShowNumbers] = useState(
    graphConfig?.showAxisNumbers !== false
  );
  const [showGrid, setShowGrid] = useState(
    graphConfig?.showGrid !== false
  );

  useEffect(() => {
    if (!ref.current || !graphConfig || typeof window === "undefined" || !window.d3) return;
    ref.current.innerHTML = "";
    const cfg = { ...graphConfig, showAxisNumbers: showNumbers, showGrid };
    const isStatChart = cfg.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(cfg.type);
    const renderFn = isStatChart ? window.renderStatChartToSVG : window.renderGraphToSVG;
    if (!renderFn) return;
    const svgNode = renderFn(cfg, ref.current.offsetWidth || 480, 260);
    if (svgNode) {
      svgNode.style.width = "100%";
      svgNode.style.height = "260px";
      ref.current.appendChild(svgNode);
    }
  }, [graphConfig, showNumbers, showGrid]);

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {authorMode && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "6px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#888", cursor: "pointer" }}>
            <input type="checkbox" checked={showNumbers} onChange={e => setShowNumbers(e.target.checked)} />
            Axis numbers
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#888", cursor: "pointer" }}>
            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
            Grid
          </label>
        </div>
      )}
      <div ref={ref} style={{ width: "100%", background: "#fff", borderRadius: "6px", overflow: "hidden" }} />
    </div>
  );
}
// ─── End GraphDisplay ─────────────────────────────────────────────────────────


// ─── GraphEditor component ────────────────────────────────────────────────────
// Author-only panel for building and attaching a graph to a question.
// Props:
//   initialConfig  — existing graphConfig or null
//   onSave(config) — called with the new graphConfig
//   onRemove()     — called to remove the graph entirely
//   onClose()      — called to close without saving
function autoScaleY(fns, xMin, xMax, padding=0.18) {
  const xs = Array.from({length: 400}, (_, i) => xMin + (xMax - xMin) * i / 399);
  const allY = [];
  fns.forEach(fn => {
    if (!fn) return;
    xs.forEach(x => {
      const y = evalFn(fn, x);
      if (isFinite(y) && !isNaN(y)) allY.push(y);
    });
  });
  if (!allY.length) return [-5, 5];
  allY.sort((a, b) => a - b);
  // trim top/bottom 2% to ignore asymptotes
  const trim = Math.max(1, Math.floor(allY.length * 0.02));
  const trimmed = allY.slice(trim, allY.length - trim);
  if (!trimmed.length) return [-5, 5];
  const yMin = trimmed[0];
  const yMax = trimmed[trimmed.length - 1];
  const pad = (yMax - yMin) * padding || 1;
  return [Math.round((yMin - pad) * 10) / 10, Math.round((yMax + pad) * 10) / 10];
}

const STAT_CHART_TYPES = new Set(["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"]);

function inferGraphType(cfg) {
  if (!cfg) return "single";
  if (cfg.type) return cfg.type;
  if (cfg.fnTop || cfg.fnBottom) return "area";
  if (cfg.boundary) return "domain";
  if (cfg.labels && cfg.values) return "bar";
  if (cfg.bins) return "histogram";
  if (cfg.points) return "scatter";
  if (cfg.data) return "discrete_dist";
  if (cfg.distType === "standard_normal") return "continuous_dist";
  if (cfg.distType || cfg.mu !== undefined) return "continuous_dist";
  return "single";
}

function GraphEditor({ initialConfig, onSave, onRemove, onClose }) {
  const type = inferGraphType(initialConfig);
  const [fn,          setFn]          = useState(initialConfig?.fn          || "x^2 - 3");
  const [fnTop,       setFnTop]       = useState(initialConfig?.fnTop       || "x + 2");
  const [fnBottom,    setFnBottom]    = useState(initialConfig?.fnBottom    || "x^2");
  const [shadeFrom,   setShadeFrom]   = useState(initialConfig?.shadeFrom   ?? -1);
  const [shadeTo,     setShadeTo]     = useState(initialConfig?.shadeTo     ?? 2);
  const [boundary,    setBoundary]    = useState(initialConfig?.boundary    || "x^2");
  const [shadeAbove,  setShadeAbove]  = useState(initialConfig?.shadeAbove  !== false);
  const [boundDashed, setBoundDashed] = useState(initialConfig?.boundaryDashed !== false);
  const [boundLabel,  setBoundLabel]  = useState(initialConfig?.boundaryLabel || "y = x²");
  const [holes,       setHoles]       = useState(initialConfig?.holes       || []);
  const [points,      setPoints]      = useState(initialConfig?.points      || []);
  const [xMin,        setXMin]        = useState(initialConfig?.xDomain?.[0] ?? -5);
  const [xMax,        setXMax]        = useState(initialConfig?.xDomain?.[1] ?? 5);
  const [yMinState,   setYMinState]   = useState(null); // null = auto
  const [yMaxState,   setYMaxState]   = useState(null);
  const [showNumbers, setShowNumbers] = useState(initialConfig?.showAxisNumbers !== false);
  const [showGrid,    setShowGrid]    = useState(initialConfig?.showGrid !== false);
  const [fnLabel,      setFnLabel]      = useState(initialConfig?.fnLabel      || "");
  const [fnTopLabel,   setFnTopLabel]   = useState(initialConfig?.fnTopLabel   || "");
  const [fnBottomLabel,setFnBottomLabel]= useState(initialConfig?.fnBottomLabel|| "");
  const [showFnLabel,  setShowFnLabel]  = useState(initialConfig?.showFnLabel  !== false);
  const [labelOffsetX,    setLabelOffsetX]    = useState(initialConfig?.labelOffsetX    ?? 0);
  const [labelOffsetY,    setLabelOffsetY]    = useState(initialConfig?.labelOffsetY    ?? 0);
  const [topLabelOffsetX, setTopLabelOffsetX] = useState(initialConfig?.topLabelOffsetX ?? 0);
  const [topLabelOffsetY, setTopLabelOffsetY] = useState(initialConfig?.topLabelOffsetY ?? 0);
  const [botLabelOffsetX, setBotLabelOffsetX] = useState(initialConfig?.botLabelOffsetX ?? 0);
  const [botLabelOffsetY, setBotLabelOffsetY] = useState(initialConfig?.botLabelOffsetY ?? 0);
  const [chartTitle,      setChartTitle]      = useState(initialConfig?.title  || "");
  const [chartXLabel,     setChartXLabel]     = useState(initialConfig?.xLabel || "");
  const [chartYLabel,     setChartYLabel]     = useState(initialConfig?.yLabel || "");
  const [exportTitle,     setExportTitle]     = useState(initialConfig?.exportTitle     ?? false);
  const [exportProbLabel, setExportProbLabel] = useState(initialConfig?.exportProbLabel ?? false);
  const [holeInput,   setHoleInput]   = useState("");
  const [pointInput,  setPointInput]  = useState("");
  const previewRef = useRef(null);

  // Compute y domain — auto if not overridden
  const getYDomain = () => {
    const xN = Number(xMin); const xX = Number(xMax);
    if (yMinState !== null && yMaxState !== null) return [Number(yMinState), Number(yMaxState)];
    if (type === "single") return autoScaleY([fn], xN, xX);
    if (type === "piecewise") return autoScaleY((initialConfig?.pieces||[]).map(p=>p.fn), xN, xX);
    if (type === "area") return autoScaleY([fnTop, fnBottom], xN, xX);
    if (type === "domain") return autoScaleY([boundary], xN, xX);
    return [-5, 5];
  };

  const buildConfig = () => {
    const yDom = getYDomain();
    const base = {
      type, showAxisNumbers: showNumbers, showGrid,
      xDomain: [Number(xMin), Number(xMax)],
      yDomain: yDom,
    };
    if (type === "single")    return { ...base, fn, fnLabel: fnLabel||undefined, showFnLabel, holes, points };
    if (type === "piecewise") return { ...base, fn, fnLabel: fnLabel||undefined, showFnLabel, holes, points };
    if (type === "area")      return { ...base, fnTop, fnBottom, fnTopLabel: fnTopLabel||undefined, fnBottomLabel: fnBottomLabel||undefined, showFnLabel, shadeFrom: Number(shadeFrom), shadeTo: Number(shadeTo), topLabelOffsetX: Number(topLabelOffsetX)||0, topLabelOffsetY: Number(topLabelOffsetY)||0, botLabelOffsetX: Number(botLabelOffsetX)||0, botLabelOffsetY: Number(botLabelOffsetY)||0 };
    if (type === "domain")    return { ...base, boundary, shadeAbove, boundaryDashed: boundDashed, boundaryLabel: boundLabel, showFnLabel };
    // Stat chart types — pass through initialConfig, just add display flags
    if (["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(type)) {
      return { ...(initialConfig || {}), showAxisNumbers: showNumbers, showGrid, showFnLabel,
               labelOffsetX: Number(labelOffsetX)||0, labelOffsetY: Number(labelOffsetY)||0,
               title: chartTitle || null,
               xLabel: chartXLabel || null,
               yLabel: chartYLabel || null,
               exportTitle: exportTitle,
               exportProbLabel: exportProbLabel };
    }
    return base;
  };

  useEffect(() => {
    if (!previewRef.current || typeof window === "undefined" || !window.d3) return;
    previewRef.current.innerHTML = "";
    try {
      const cfg = buildConfig();
      const isStatChart = cfg.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(cfg.type);
      const renderFn = isStatChart ? window.renderStatChartToSVG : window.renderGraphToSVG;
      if (!renderFn) return;
      const svg = renderFn(cfg, previewRef.current.offsetWidth || 400, 220);
      if (svg) { svg.style.width = "100%"; svg.style.height = "220px"; previewRef.current.appendChild(svg); }
    } catch(e) { console.warn("preview error", e); }
  });

  const addPoint = (list, setList, input, setInput) => {
    const parts = input.split(",").map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setList([...list, parts]);
      setInput("");
    }
  };

  const inp = (val, set, placeholder, width="80px") => (
    <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
      style={{width, padding:"0.2rem 0.4rem", background:bg2, border:"1px solid "+border,
        color:text1, borderRadius:"4px", fontSize:"0.78rem"}} />
  );

  const lbl = (text) => <span style={{fontSize:"0.72rem", color:text2, marginRight:"6px"}}>{text}</span>;

  const row = (children) => (
    <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"0.5rem", flexWrap:"wrap"}}>
      {children}
    </div>
  );

  const typeLabel = {
    "single": "Single curve", "piecewise": "Piecewise function", "area": "Area between curves",
    "domain": "Domain sketch", "bar": "Bar chart", "histogram": "Histogram",
    "scatter": "Scatter plot", "discrete_dist": "Discrete probability distribution",
    "continuous_dist": initialConfig?.distType === "standard_normal"
      ? "Standard Normal Distribution (Z)"
      : initialConfig?.distType === "uniform" ? "Uniform Distribution"
      : initialConfig?.distType === "exponential" ? "Exponential Distribution"
      : "Normal Distribution"
  }[type] || type;

  return (
    <div style={{marginTop:"0.75rem", padding:"1rem", background:bg1, border:"1px solid "+border,
      borderRadius:"8px"}}>
      <div style={{fontSize:"0.78rem", color:"#185FA5", fontWeight:"600", marginBottom:"0.75rem"}}>
        📈 Graph Editor — <span style={{color:text2, fontWeight:"400"}}>{typeLabel}</span>
      </div>

      {/* Single curve inputs */}
      {type === "single" && <>
        {row(<>{lbl("f(x) =")} {inp(fn, setFn, "e.g. x^2 - 3", "200px")}</>)}
        {row(<>
          {lbl("Label:")} {inp(fnLabel, setFnLabel, "e.g. f(x) = x²-3", "150px")}
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:text2,cursor:"pointer"}}>
            <input type="checkbox" checked={showFnLabel} onChange={e=>setShowFnLabel(e.target.checked)} /> Show
          </label>
        </>)}
        {row(<>
          {lbl("Holes (x,y):")}
          {inp(holeInput, setHoleInput, "e.g. 2,3", "100px")}
          <button onClick={() => addPoint(holes, setHoles, holeInput, setHoleInput)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background:"transparent", border:"1px solid "+border, color:text2}}>+ Add</button>
          {holes.map((h,i) => <span key={i} style={{fontSize:"0.7rem", color:"#185FA5", cursor:"pointer"}}
            onClick={() => setHoles(holes.filter((_,j)=>j!==i))}>({h[0]},{h[1]}) ✕</span>)}
        </>)}
        {row(<>
          {lbl("Points (x,y):")}
          {inp(pointInput, setPointInput, "e.g. 2,5", "100px")}
          <button onClick={() => addPoint(points, setPoints, pointInput, setPointInput)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background:"transparent", border:"1px solid "+border, color:text2}}>+ Add</button>
          {points.map((p,i) => <span key={i} style={{fontSize:"0.7rem", color:"#10b981", cursor:"pointer"}}
            onClick={() => setPoints(points.filter((_,j)=>j!==i))}>({p[0]},{p[1]}) ✕</span>)}
        </>)}
      </>}

      {/* Area between curves */}
      {type === "area" && <>
        {row(<>
          {lbl("f(x) top =")} {inp(fnTop, setFnTop, "top curve", "150px")}
          {lbl("label:")} {inp(fnTopLabel, setFnTopLabel, "f(x)", "60px")}
          {lbl("offset:")}
          <input type="number" value={topLabelOffsetX} onChange={e=>setTopLabelOffsetX(Number(e.target.value))} placeholder="x" title="X offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.72rem"}} />
          <input type="number" value={topLabelOffsetY} onChange={e=>setTopLabelOffsetY(Number(e.target.value))} placeholder="y" title="Y offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.72rem"}} />
          <span style={{fontSize:"0.62rem",color:"#475569"}}>px</span>
        </>)}
        {row(<>
          {lbl("g(x) bottom =")} {inp(fnBottom, setFnBottom, "bottom curve", "150px")}
          {lbl("label:")} {inp(fnBottomLabel, setFnBottomLabel, "g(x)", "60px")}
          {lbl("offset:")}
          <input type="number" value={botLabelOffsetX} onChange={e=>setBotLabelOffsetX(Number(e.target.value))} placeholder="x" title="X offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.72rem"}} />
          <input type="number" value={botLabelOffsetY} onChange={e=>setBotLabelOffsetY(Number(e.target.value))} placeholder="y" title="Y offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.72rem"}} />
          <span style={{fontSize:"0.62rem",color:"#475569"}}>px</span>
        </>)}
        {row(<>
          {lbl("Shade from x =")} {inp(shadeFrom, setShadeFrom, "-1", "55px")} {lbl("to x =")} {inp(shadeTo, setShadeTo, "2", "55px")}
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:text2,cursor:"pointer"}}>
            <input type="checkbox" checked={showFnLabel} onChange={e=>setShowFnLabel(e.target.checked)} /> Show labels
          </label>
        </>)}
      </>}

      {/* Domain sketch */}
      {type === "domain" && <>
        {row(<>{lbl("Boundary =")} {inp(boundary, setBoundary, "e.g. x^2", "180px")}</>)}
        {row(<>
          {lbl("Shade:")}
          <button onClick={() => setShadeAbove(true)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background: shadeAbove ? "#185FA5" : "transparent", color: shadeAbove ? "#fff" : "#94a3b8",
              border:`1px solid ${shadeAbove?"#185FA5":border}`}}>Above</button>
          <button onClick={() => setShadeAbove(false)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background: !shadeAbove ? "#185FA5" : "transparent", color: !shadeAbove ? "#fff" : "#94a3b8",
              border:`1px solid ${!shadeAbove?"#185FA5":border}`}}>Below</button>
        </>)}
        {row(<>
          <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"0.72rem",color:text2,cursor:"pointer"}}>
            <input type="checkbox" checked={boundDashed} onChange={e=>setBoundDashed(e.target.checked)} />
            Dashed boundary (strict inequality)
          </label>
        </>)}
        {row(<>{lbl("Boundary label:")} {inp(boundLabel, setBoundLabel, "y = x²", "140px")}</>)}
      </>}

      {/* x domain + display toggles */}
      <div style={{display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"0.5rem", marginTop:"0.25rem", alignItems:"center"}}>
        <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
          {lbl("x:")} {inp(xMin, setXMin, "-5", "44px")} <span style={{color:text2,fontSize:"0.72rem"}}>to</span> {inp(xMax, setXMax, "5", "44px")}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
          {lbl("y:")}
          {inp(yMinState ?? "", v => setYMinState(v===""?null:v), "auto", "44px")}
          <span style={{color:text2,fontSize:"0.72rem"}}>to</span>
          {inp(yMaxState ?? "", v => setYMaxState(v===""?null:v), "auto", "44px")}
          <span style={{fontSize:"0.65rem", color:"#475569"}}>(blank = auto)</span>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:text2,cursor:"pointer"}}>
          <input type="checkbox" checked={showNumbers} onChange={e=>setShowNumbers(e.target.checked)} /> Axis numbers
        </label>
        <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:text2,cursor:"pointer"}}>
          <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} /> Grid
        </label>
        {["continuous_dist","discrete_dist","standard_normal"].includes(type) && (
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:text2,cursor:"pointer"}}>
            <input type="checkbox" checked={showFnLabel} onChange={e=>setShowFnLabel(e.target.checked)} /> Show label
          </label>
        )}
        {["continuous_dist","discrete_dist","standard_normal"].includes(type) && showFnLabel && (
          <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:text2}}>
            <span>Label offset:</span>
            <span>x</span>
            <input type="number" value={labelOffsetX} onChange={e=>setLabelOffsetX(Number(e.target.value))}
              style={{width:"46px",padding:"0.18rem 0.3rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.72rem"}} />
            <span>y</span>
            <input type="number" value={labelOffsetY} onChange={e=>setLabelOffsetY(Number(e.target.value))}
              style={{width:"46px",padding:"0.18rem 0.3rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.72rem"}} />
            <span style={{fontSize:"0.65rem",color:"#475569"}}>px</span>
          </div>
        )}
      </div>

      {/* Title / axis label editors for stat charts */}
      {["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(type) && (
        <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center", marginBottom:"0.5rem"}}>
          {lbl("Title:")}
          <input value={chartTitle} onChange={e=>setChartTitle(e.target.value)} placeholder="e.g. Normal Distribution"
            style={{width:"200px",padding:"0.2rem 0.4rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.78rem"}} />
          {lbl("x-axis:")}
          <input value={chartXLabel} onChange={e=>setChartXLabel(e.target.value)} placeholder="e.g. x"
            style={{width:"80px",padding:"0.2rem 0.4rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.78rem"}} />
          {lbl("y-axis:")}
          <input value={chartYLabel} onChange={e=>setChartYLabel(e.target.value)} placeholder="e.g. f(x)"
            style={{width:"80px",padding:"0.2rem 0.4rem",background:bg2,border:"1px solid "+border,color:text1,borderRadius:"4px",fontSize:"0.78rem"}} />
          <label style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"0.7rem",color:text2,cursor:"pointer",marginLeft:"0.5rem"}}>
            <input type="checkbox" checked={exportTitle} onChange={e=>setExportTitle(e.target.checked)}
              style={{accentColor:"#8b5cf6"}} />
            Show title in Canvas
          </label>
          <label style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"0.7rem",color:text2,cursor:"pointer"}}>
            <input type="checkbox" checked={exportProbLabel} onChange={e=>setExportProbLabel(e.target.checked)}
              style={{accentColor:"#8b5cf6"}} />
            Show P(X) label in Canvas
          </label>
        </div>
      )}

      {/* Live preview */}
      <div ref={previewRef} style={{width:"100%", background:"#fff", borderRadius:"6px",
        overflow:"hidden", marginBottom:"0.75rem", minHeight:"220px"}} />

      {/* Actions */}
      <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
        <button onClick={() => onSave({ ...buildConfig(), hasGraph: true })}
          style={{padding:"0.3rem 0.8rem", fontSize:"0.78rem", borderRadius:"4px", cursor:"pointer",
            background:"#185FA5", color:"#fff", border:"none", fontWeight:"500"}}>
          ✓ Save graph
        </button>
        {initialConfig && (
          <button onClick={onRemove}
            style={{padding:"0.3rem 0.8rem", fontSize:"0.78rem", borderRadius:"4px", cursor:"pointer",
              background:"transparent", color:"#f87171", border:"1px solid #f8717144"}}>
            ✕ Remove graph
          </button>
        )}
        <button onClick={onClose}
          style={{padding:"0.3rem 0.8rem", fontSize:"0.78rem", borderRadius:"4px", cursor:"pointer",
            background:"transparent", color:text2, border:"1px solid "+border}}>
          Cancel
        </button>
      </div>
    </div>
  );
}
// ─── End GraphEditor ──────────────────────────────────────────────────────────

// ─── InlineEditor ─────────────────────────────────────────────────────────────
function InlineEditor({ q, onSave, onClose }) {
  const [question,  setQuestion]  = useState(q.question  || "");
  const [stem,      setStem]      = useState(q.stem      || "");
  const [choices,   setChoices]   = useState(q.choices   ? [...q.choices] : []);
  const [answer,    setAnswer]    = useState(q.answer    || "");
  const [explanation, setExplanation] = useState(q.explanation || "");
  const [parts,     setParts]     = useState(q.parts     ? q.parts.map(p => ({...p})) : []);
  const [saving,    setSaving]    = useState(false);

  const inp = (val, set, ph, rows) => rows
    ? <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={rows}
        style={{width:"100%", padding:"0.4rem 0.6rem", background:bg2, border:"1px solid "+border,
          color:text1, borderRadius:"6px", fontSize:"0.82rem", resize:"vertical",
          lineHeight:1.5, fontFamily:"inherit", boxSizing:"border-box"}} />
    : <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
        style={{width:"100%", padding:"0.35rem 0.6rem", background:bg2, border:"1px solid "+border,
          color:text1, borderRadius:"6px", fontSize:"0.82rem", fontFamily:"inherit", boxSizing:"border-box"}} />;

  const lbl = (t) => <div style={{fontSize:"0.68rem", color:text2, textTransform:"uppercase",
    letterSpacing:"0.1em", fontWeight:"600", marginBottom:"0.3rem", marginTop:"0.75rem"}}>{t}</div>;

  const handleSave = async () => {
    setSaving(true);
    let updated = { ...q, question, answer, explanation };
    if (choices.length) updated.choices = choices;
    if (q.type === "Branched") updated = { ...updated, stem, parts };
    await onSave(updated);
    setSaving(false);
  };

  return (
    <div style={{marginTop:"0.75rem", padding:"1rem", background:"#1B4332",
      border:"1px solid "+border, borderRadius:"8px", borderLeft:"3px solid #60a5fa"}}>
      <div style={{fontSize:"0.75rem", color:"#185FA5", fontWeight:"700", marginBottom:"0.75rem",
        display:"flex", alignItems:"center", gap:"0.5rem"}}>
        ✏️ Edit Question
        <span style={{fontSize:"0.65rem", color:text3, fontWeight:"400"}}>— changes save to Supabase</span>
      </div>

      {q.type === "Branched" ? (<>
        {lbl("Given (stem)")}
        {inp(stem, setStem, "Shared context for all parts...", 2)}
        {parts.map((p, pi) => (
          <div key={pi} style={{marginTop:"0.75rem", paddingLeft:"0.75rem", borderLeft:"2px solid #1e3a5f"}}>
            <div style={{fontSize:"0.68rem", color:text2, marginBottom:"0.3rem"}}>Part ({String.fromCharCode(97+pi)})</div>
            {inp(p.question, (v) => { const np=[...parts]; np[pi]={...np[pi],question:v}; setParts(np); }, "Question text...", 2)}
            <div style={{fontSize:"0.65rem", color:text2, margin:"0.3rem 0 0.2rem"}}>Answer</div>
            {inp(p.answer, (v) => { const np=[...parts]; np[pi]={...np[pi],answer:v}; setParts(np); }, "Answer...")}
            <div style={{fontSize:"0.65rem", color:text2, margin:"0.3rem 0 0.2rem"}}>Solution steps (math lines only, one per line)</div>
            {inp(p.explanation||"", (v) => { const np=[...parts]; np[pi]={...np[pi],explanation:v}; setParts(np); }, "= (10)/(s^3) - (6)/(s^2) + (4)/(s)", 3)}
          </div>
        ))}
      </>) : (<>
        {lbl("Question Text")}
        {inp(question, setQuestion, "Question text...", 3)}

        {choices.length > 0 && (<>
          {lbl("Answer Choices")}
          {choices.map((c, ci) => (
            <div key={ci} style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem"}}>
              <button onClick={() => setAnswer(c)}
                style={{flexShrink:0, width:"24px", height:"24px", borderRadius:"50%", border:"none",
                  cursor:"pointer", fontSize:"0.7rem", fontWeight:"700",
                  background: answer===c ? "#10b981" : border,
                  color: answer===c ? "#fff" : "#4a6fa5"}}>
                {String.fromCharCode(65+ci)}
              </button>
              <input value={c} onChange={e => { const nc=[...choices]; nc[ci]=e.target.value; setChoices(nc);
                  if (answer===c) setAnswer(e.target.value); }}
                style={{flex:1, padding:"0.3rem 0.5rem", background:bg2,
                  border:"1px solid "+(answer===c?"#10b981":border),
                  color:text1, borderRadius:"5px", fontSize:"0.8rem"}} />
            </div>
          ))}
          <div style={{fontSize:"0.65rem", color:text3, marginTop:"0.3rem"}}>
            Click a letter to mark as correct answer · Currently: <span style={{color:"#10b981"}}>{answer || "none selected"}</span>
          </div>
        </>)}

        {!choices.length && (<>
          {lbl("Answer")}
          {inp(answer, setAnswer, "Answer...")}
        </>)}
      </>)}

      {lbl("Solution Steps (answer key)")}
      {q.type === "Free Response" || q.type === "Short Answer" ? (
        <div style={{marginBottom:"0.35rem"}}>
          <div style={{fontSize:"0.63rem", color:text3, marginBottom:"0.3rem", lineHeight:1.5}}>
            One math line per line — no prose. Prose lines (starting with "Use", "Thus", "Let", etc.) are auto-filtered out.
            <span style={{color:"#10b981", marginLeft:"0.4rem"}}>Example: = (10)/(s^3) - (6)/(s^2) + (4)/(s)</span>
          </div>
          {inp(explanation, setExplanation, "= ...\n= ...", 5)}
        </div>
      ) : (
        inp(explanation, setExplanation, "Step-by-step explanation...", 2)
      )}

      <div style={{display:"flex", gap:"0.5rem", marginTop:"0.85rem"}}>
        <button onClick={handleSave} disabled={saving}
          style={{padding:"0.35rem 0.9rem", background:"#2D6A4F", color:"#fff",
            border:"none", borderRadius:"6px", fontSize:"0.78rem", fontWeight:"600",
            cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1}}>
          {saving ? "Saving…" : "✓ Save Changes"}
        </button>
        <button onClick={onClose}
          style={{padding:"0.35rem 0.8rem", background:"transparent", color:text2,
            border:"1px solid #D9D0C0", borderRadius:"6px", fontSize:"0.78rem", cursor:"pointer"}}>
          Cancel
        </button>
      </div>
    </div>
  );
}
// ─── End InlineEditor ─────────────────────────────────────────────────────────


// Course data is imported from lib/courses/index.js

const QTYPES = ["Multiple Choice","Free Response","True/False","Fill in the Blank","Formula","Branched"];
const DIFFICULTIES = ["Easy","Medium","Hard","Mixed"];
const VERSIONS = ["A","B","C","D","E"];

// ─── Supabase DB helpers ──────────────────────────────────────────────────────
async function loadBank() {
  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(r => ({ ...r.data, id: r.id, createdAt: new Date(r.created_at).getTime() }));
  } catch (e) { console.error("loadBank error:", e); return []; }
}

async function saveQuestion(q) {
  try {
    const { error } = await supabase.from("questions").upsert({
      id: q.id,
      course: q.course,
      section: q.section,
      type: q.type,
      difficulty: q.difficulty,
      data: q,
    });
    if (error) throw error;
  } catch (e) { console.error("saveQuestion error:", e); }
}

async function deleteQuestion(id) {
  try {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
  } catch (e) { console.error("deleteQuestion error:", e); }
}

async function saveExam(name, versions) {
  try {
    const { data, error } = await supabase.from("exams").insert({
      name,
      versions,
      created_at: new Date().toISOString(),
    }).select();
    if (error) throw error;
    return data[0];
  } catch (e) { console.error("saveExam error:", e); return null; }
}

async function loadExams() {
  try {
    const { data, error } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { console.error("loadExams error:", e); return []; }
}

async function logExport(examName, format, versionLabel) {
  try {
    await supabase.from("export_history").insert({
      exam_name: examName,
      format,
      version_label: versionLabel,
      exported_at: new Date().toISOString(),
    });
  } catch (e) { console.error("logExport error:", e); }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
// escapeXML moved to lib/exports/helpers.js (used only by QTI functions)
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// Convert plain-text math to HTML for Canvas QTI display
// Convert plain-text math expression to LaTeX string
// Convert plain-text math to simple HTML entities for Canvas QTI (proven to work)
// ─── Question Validator ───────────────────────────────────────────────────────
// Returns array of issue strings. Empty array = valid.
function validateQuestion(q) {
  const issues = [];
  if (!q) return ["Empty question object"];

  // blank question text
  const qText = q.type === "Branched" ? q.stem : q.question;
  if (!qText || !String(qText).trim()) issues.push("Question text is empty");

  // blank answer
  if (q.type !== "Branched" && q.type !== "Free Response") {
    if (!q.answer && q.answer !== 0) issues.push("Answer is empty");
  }

  if (q.type === "Multiple Choice" || q.type === "True/False") {
    const choices = q.choices || [];

    // answer must be in choices
    if (q.answer && choices.length && !choices.includes(q.answer)) {
      issues.push("Correct answer does not match any choice");
    }

    // duplicate or equivalent choices
    const normalizeChoice = (c) => String(c ?? "")
      .trim()
      .toLowerCase()
      // strip LaTeX wrappers
      .replace(/\[()[\]]/g, "")
      .replace(/\s+/g, " ")
      // normalize fractions: 1/2 and rac{1}{2} → same
      .replace(/\frac\{(\d+)\}\{(\d+)\}/g, (_, n, d) => `${n}/${d}`)
      // normalize common math: x^2 vs x² etc
      .replace(/\^2/g, "²").replace(/\^3/g, "³")
      // strip spaces around operators
      .replace(/\s*([+\-*/=])\s*/g, "$1");

    const seen = new Map();
    choices.forEach((c, i) => {
      const norm = normalizeChoice(c);
      if (seen.has(norm)) {
        issues.push(`Choices ${String.fromCharCode(65+seen.get(norm))} and ${String.fromCharCode(65+i)} are duplicate or equivalent`);
      } else {
        seen.set(norm, i);
      }
    });

    // fewer than 2 choices
    if (choices.length < 2) issues.push("Question has fewer than 2 choices");
  }

  if (q.type === "Branched") {
    (q.parts || []).forEach((p, i) => {
      if (!p.answer && p.answer !== 0) issues.push(`Part (${String.fromCharCode(97+i)}) has no answer`);
    });
  }

  if (q.type === "Formula") {
    if (!q.answerFormula) issues.push("Formula question missing answerFormula");
    if (!q.variables || !q.variables.length) issues.push("Formula question missing variables");
  }

  // graph config validation
  if (q.hasGraph && !q.graphConfig) {
    issues.push("Question marked as having a graph but graphConfig is missing");
  }
  if (q.hasGraph && q.graphConfig) {
    const gc = q.graphConfig;
    if (!gc.type) issues.push("Graph missing type");
    if (gc.type === "single" && !gc.fn) issues.push("Single curve graph missing fn");
    if (gc.type === "area" && (!gc.fnTop || !gc.fnBottom)) issues.push("Area graph missing fnTop or fnBottom");
    if (gc.type === "domain" && !gc.boundary) issues.push("Domain graph missing boundary");
    if (gc.type === "piecewise" && (!gc.pieces || !gc.pieces.length)) issues.push("Piecewise graph missing pieces");
    if (gc.type === "multi" && (!gc.fns || !gc.fns.length)) issues.push("Multi graph missing fns array");
    if (gc.type === "bar") {
      if (!gc.labels || !gc.labels.length) issues.push("Bar chart missing labels");
      if (!gc.values || !gc.values.length) issues.push("Bar chart missing values");
      if (gc.labels && gc.values && gc.labels.length !== gc.values.length) issues.push("Bar chart labels and values length mismatch");
    }
    if (gc.type === "histogram" && (!gc.bins || !gc.bins.length)) issues.push("Histogram missing bins");
    if (gc.type === "scatter" && (!gc.points || !gc.points.length)) issues.push("Scatter plot missing points");
    if (gc.type === "discrete_dist" && (!gc.data || !gc.data.length)) issues.push("Discrete distribution missing data");
    if (gc.type === "continuous_dist" || gc.type === "standard_normal") {
      const dt = gc.distType || gc.type;
      if (!dt) issues.push("Continuous distribution missing distType");
      if ((dt === "normal" || dt === "standard_normal") && gc.sigma !== undefined && gc.sigma <= 0) issues.push("Normal distribution sigma must be > 0");
      if (dt === "exponential" && gc.lambda !== undefined && gc.lambda <= 0) issues.push("Exponential distribution lambda must be > 0");
      if (dt === "exponential" && gc.mu !== undefined && gc.mu <= 0) issues.push("Exponential distribution mu must be > 0");
      if (dt === "uniform" && gc.uMin !== undefined && gc.uMax !== undefined && gc.uMin >= gc.uMax) issues.push("Uniform distribution uMin must be < uMax");
    }
    if ((gc.xMin !== undefined && gc.xMax !== undefined) && gc.xMin >= gc.xMax) issues.push("Graph xMin must be less than xMax");
  }

  return issues;
}
// ─── End Question Validator ───────────────────────────────────────────────────

// mathToHTML, mathToHTMLInline moved to lib/exports/helpers.js

// ─── Graph Engine ─────────────────────────────────────────────────────────────
// evalFn, renderGraphToSVG, graphToBase64PNG, renderStatChartToSVG, statChartToBase64PNG
// moved to lib/exports/graphRendering.js
// Requires D3 — add to app/layout.js <head>:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
//
// graphConfig shape:
// {
//   type: "single" | "piecewise" | "area" | "domain" | "multi"
//
//   // single:
//   fn: "x^2 - 3"
//   holes:  [[x,y], ...]   // open circles
//   points: [[x,y], ...]   // filled dots
//
//   // piecewise:
//   pieces: [{ fn:"x+1", domain:[-3, 0.999] }, ...]
//   holes:  [[x,y], ...]
//   points: [[x,y], ...]
//
//   // area (between two curves, Calc 2):
//   fnTop: "x+2", fnBottom: "x^2", shadeFrom: -1, shadeTo: 2
//
//   // domain (single shaded region, Calc 3):
//   boundary: "x^2", shadeAbove: true, boundaryDashed: true, boundaryLabel: "y = x²"
//
//   // multi (4 graphs as MC options, Calc 3):
//   boundary: "x^2"
//   options: [{ shadeAbove:true, dashed:true, halfX:false, correct:true }, ...]
//
//   // shared:
//   showAxisNumbers: true
//   showGrid: true
//   xDomain: [-5, 5]
//   yDomain: [-5, 5]
// }

// evalFn imported from lib/exports/graphRendering.js

// renderGraphToSVG, graphToBase64PNG, renderStatChartToSVG, statChartToBase64PNG
// moved to lib/exports/graphRendering.js
// buildQTI, buildQTIZip, buildClassroomSectionsQTI, buildQTICompare, buildQTIAllSectionsMerged,
// canvasExportConfig, validateQTIExport moved to lib/exports/qti.js
// mathToOmml, mathStepsOnly moved to lib/exports/helpers.js
// makeDocxImageXml (private), buildAnswerKey, buildDocx, buildDocxCompare moved to lib/exports/docx.js
// dlFile, dlBlob moved to lib/exports/utils.js
// ─── Duplicate detection ──────────────────────────────────────────────────────
function questionSimilarity(a, b) {
  const textA = String(a.question || a.stem || "").toLowerCase().trim();
  const textB = String(b.question || b.stem || "").toLowerCase().trim();
  if (!textA || !textB) return 0;
  // Simple word overlap ratio
  const wordsA = new Set(textA.split(/\W+/).filter(w => w.length > 3));
  const wordsB = new Set(textB.split(/\W+/).filter(w => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// ── Question type instructions (used by all prompt builders) ──────────────────

// ─── Prompt Builders ─────────────────────────────────────────────────────────
// All AI prompt construction functions — isolated per course, no React deps
// Used by TestBankApp.js for generation, mutation, and replace operations

function difficultyPattern(count) {
  const cycle = ["Easy", "Medium", "Hard"];
  return Array.from({length: count}, (_, i) => cycle[i % 3]);
}


// typeInstructions is imported from lib/courses/index.js

function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig) {
  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";

  const useCfg = sectionConfig && Object.keys(sectionConfig).length > 0;

  const totalQ = useCfg
    ? selectedSections.reduce((a,s) => {
        const c = sectionConfig[s] || { Easy:{count:1}, Medium:{count:1}, Hard:{count:1} };
        return a + (c.Easy.count||0) + (c.Medium.count||0) + (c.Hard.count||0);
      }, 0)
    : selectedSections.reduce((a,s)=>a+(sectionCounts[s]||3),0);

  const breakdown = useCfg
    ? selectedSections.map(s => {
        const c = sectionConfig[s] || { Easy:{count:1,graphType:"normal"}, Medium:{count:1,graphType:"normal"}, Hard:{count:1,graphType:"normal"} };
        const types = isQM ? ["normal","table","graph","mix"] : ["normal","graph","mix"];
        const lines = ["Easy","Medium","Hard"]
          .filter(d => (c[d].count||0) > 0)
          .map(d => {
            const count = c[d].count || 0;
            const typeCounts = c[d].typeCounts || {};
            const hasTypeCounts = types.some(t => (typeCounts[t]||0) > 0);
            if (hasTypeCounts) {
              const parts = types
                .filter(t => (typeCounts[t]||0) > 0)
                .map(t => {
                  const n = typeCounts[t];
                  const tableNote = (t==="table"||t==="mix") ? ` [tableRows:${c[d].tableRows||4}, tableCols:${c[d].tableCols||2}]` : "";
                  const mixNote = t==="mix" ? ` [REQUIRED: ${Math.ceil(n*0.4)} chart(s), ${Math.ceil(n*0.3)} table(s), rest text]` : "";
                  return `${n} ${t==="normal"?"text":t}${tableNote}${mixNote}`;
                }).join(", ");
              return `  ${d}: ${count} question(s) [${parts}]`;
            }
            const gt = c[d].graphType || "normal";
            const tableNote = gt === "table" || gt === "mix" ? ` [tableRows: ${c[d].tableRows||4}, tableCols: ${c[d].tableCols||2}]` : "";
            const mixNote = gt === "mix" && count > 0 ? ` [REQUIRED: ${Math.ceil(count*0.4)} chart(s), ${Math.ceil(count*0.3)} table(s), rest text]` : "";
            return `  ${d}: ${count} question(s) [graphType: ${gt}${tableNote}${mixNote}]`;
          });
        return `${s}:\n${lines.join("\n")}`;
      }).join("\n")
    : selectedSections.map(s => {
        const count = sectionCounts[s]||3;
        const pattern = difficultyPattern(count).join(", ");
        return `${s}: ${count} question(s) [difficulties: ${pattern}]`;
      }).join("\n");

  const hasGraphQuestions = useCfg && selectedSections.some(s => {
    const c = sectionConfig[s];
    return c && ["Easy","Medium","Hard"].some(d => {
      const gt = c[d].graphType;
      const tc = c[d].typeCounts || {};
      return gt === "graph" || gt === "mix" || gt === "table" ||
             (tc.graph||0) > 0 || (tc.mix||0) > 0 || (tc.table||0) > 0;
    });
  });

  const needsChoices = qType==="Multiple Choice"||qType==="True/False";
  const shape = qType==="Branched"
    ? `{"type":"Branched","section":"...","difficulty":"...","stem":"...","parts":[{"question":"...","answer":"...","explanation":"..."}]}`
    : qType==="Formula"
    ? `{"type":"Formula","section":"...","difficulty":"...","question":"...","variables":[{"name":"a","min":1,"max":9,"precision":0}],"answerFormula":"...","answer":"...","explanation":"..."}`
    : needsChoices
    ? `{"type":"${qType}","section":"...","difficulty":"...","question":"...","choices":[...],"answer":"...","explanation":"..."}`
    : `{"type":"${qType}","section":"...","difficulty":"...","question":"...","answer":"...","explanation":"..."}`;

  const commonRules = `
Be rigorous, numerically specific, university-level.
Each question must have a 'section' field with the exact section name.
Each question must have a 'difficulty' field.

Reply with ONLY a valid JSON array, no markdown fences, no explanation:
[${shape}, ...]`;

  const mathNotationBase = `
MATH NOTATION RULES:
- Exponents: x^2, s^3, (s-3)^2
- Fractions: ALWAYS (numerator)/(denominator) — e.g. (10)/(s^3)
- Never use square brackets for denominators — always (parentheses)`;

  const courseObj = getCourse(course);
  if (courseObj) {
    return courseObj.buildPrompt({ course, totalQ, breakdown, hasGraphQuestions, qType, typeInstruction: typeInstructions[qType], commonRules, mathNotationBase });
  }

  // ── Custom courses (fallback) ────────────────────────────────────────────────
  return `TESTBANK_GENERATE_REQUEST
Course: ${course}
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstructions[qType]}
You are a university professor writing exam questions for ${course}. Be rigorous, numerically specific, university-level.
${mathNotationBase}
${commonRules}`;
}

// Free Response explanation rule — shared across all prompts
const FR_EXPLANATION_RULE = `For Free Response questions: explanation MUST contain the FULL worked solution — every step a student needs for full marks. Write each step on its own line as a pure math equation (no English prose, no "Use", "Thus", "Let", "We get"). Show ALL intermediate steps — formula, substitution, algebra, final answer. Use (numerator)/(denominator) for all fractions.`;

function buildVersionPrompt(selectedQuestions, mutationType, versionLabel) {
  const lines = selectedQuestions.map((q,i) => {
    const mut = mutationType[q.id]||"numbers";
    const orig = q.type==="Branched" ? q.stem : q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- For Branched: mutate the shared stem and regenerate ALL parts consistently.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation}\n- Branched: {type, section, difficulty, stem, parts:[{question,answer,explanation}]}\n- If the original question has hasGraph:true, you MUST include hasGraph:true and an updated graphConfig that matches the new numbers (e.g. updated mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability).\nReply with ONLY valid JSON array, no markdown.`;
}


// Single combined prompt for ALL classroom sections AND versions at once
function buildAllVersionsPrompt(selectedQuestions, mutationType, labels, classSection=1, numClassSections=1, course="") {
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.type==="Branched" ? q.stem : q.question;
    const mut = mutationType[q.id] || "numbers";
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+q.type+"] [mutation: "+mut+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");

  if (numClassSections <= 1) {
    // Single section — respect per-question mutation type
    const hasFunctionMut = selectedQuestions.some(q => mutationType[q.id] === "function");
    const mutRules = selectedQuestions.map((q,i) => {
      const mut = mutationType[q.id] || "numbers";
      return `- Q${i+1}: ${mut === "function"
        ? "function mutation — use a DIFFERENT function type (e.g. if original uses polynomial, use exponential or trigonometric). Same concept difficulty, same steps."
        : "numbers mutation — keep exact same function type, change only coefficients/constants."}`;
    }).join("\n");
    return `TESTBANK_ALL_VERSIONS_REQUEST\nVersions to create: ${versionList}\n\nFor each version, mutate ALL of the following questions:\n${lines}\n\nPER-QUESTION MUTATION RULES:\n${mutRules}\n\nADDITIONAL RULES:\n- ALWAYS regenerate a correct answer key for each mutated version.\n- Keep same question type, section, and difficulty.\n- Each version must be DIFFERENT from all others.\n- Within numbers-mutation questions: versions differ only by coefficients/constants.\n- Within function-mutation questions: versions use different function types from each other.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON object with one key per version label. Each value is a JSON array of mutated questions in the SAME order:\n{\n  "A": [{type, section, difficulty, question, choices, answer, explanation}, ...],\n  "B": [{type, section, difficulty, question, choices, answer, explanation}, ...]\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
  }

  // Multi-section: single prompt, all sections + versions
  const sectionKeys = [];
  for (let s = 1; s <= numClassSections; s++) {
    for (const lbl of labels) {
      sectionKeys.push(`S${s}_${lbl}`);
    }
  }

  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const allFunctionFamilies = ["polynomial (e.g. x^3-2x)", "exponential (e.g. e^(2x))", "logarithmic (e.g. ln(x+1))", "trigonometric-sin (e.g. sin(2x))", "trigonometric-cos (e.g. cos(x^2))", "rational (e.g. 1/(x^2+1))", "square root (e.g. sqrt(x^2+1))"];
  const sectionRules = Array.from({length: numClassSections}, (_,i) => {
    const s = i+1;
    if (s === 1) return `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types as originals.`;
    if (isQM) return `- Section ${s} versions (S${s}_A, S${s}_B, ...): numbers/direction mutation — keep the SAME distribution type (e.g. normal stays normal, uniform stays uniform, exponential stays exponential). You may change μ, σ, uMin, uMax, or the probability direction (e.g. P(X<4) → P(X>3) or P(a<X<b)). Update graphConfig shadeFrom, shadeTo, probability, and mu/sigma/uMin/uMax to match. NEVER change the distribution type.`;
    return `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family. Pick randomly from: polynomial, exponential, logarithmic, sin, cos, rational, sqrt — but NO two questions in the same section may share the same family. For example with 3 questions: Q1 gets polynomial, Q2 gets e^x, Q3 gets ln(x). Must differ from Section 1${s > 2 ? " and all previous sections" : ""}.`;
  }).join("\n");

  const exampleKeys = sectionKeys.map(k => `"${k}": [{...}]`).join(",\n  ");

  return `TESTBANK_ALL_SECTIONS_AND_VERSIONS_REQUEST\nClassroom Sections: ${numClassSections}\nVersions per section: ${versionList}\nTotal keys to generate: ${sectionKeys.join(", ")}\n\nFor each key, mutate ALL of the following questions:\n${lines}\n\nMUTATION RULES BY SECTION:\n${sectionRules}\n\nADDITIONAL RULES:\n- Within each section, versions (A, B, C...) must differ from each other by numbers only.\n${isQM ? "- Across sections: SAME distribution type MUST be kept — only numbers, direction (< vs >) or boundary values may change. NEVER switch distribution types across sections." : "- Across sections, questions must use completely different function families.\n- Within each section, EVERY question must come from a DIFFERENT function family — polynomial, exponential, logarithmic, sin, cos, rational, sqrt are all separate families. sin and cos count as the same family.\n- Think of it like assigning a unique function family to each question slot: Q1=polynomial, Q2=e^x, Q3=ln, Q4=sin — no repeats."}\n- ALWAYS regenerate correct answer keys.\n- Keep same question type, section name, and difficulty throughout.\n- Each version must be a JSON array in the SAME question order.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- If a question has hasGraph:true, include hasGraph:true and update graphConfig (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability) to match the new numbers.\n- ${FR_EXPLANATION_RULE}\n\nReturn a single JSON object with ALL keys:\n{\n  ${exampleKeys}\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
}

// Single combined prompt for ALL classroom sections at once
// Returns one prompt that asks for S1_A, S1_B, S2_A, S2_B etc.
function buildAllSectionsPrompt(selectedQuestions, labels, numClassSections, course="") {
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.type==="Branched" ? q.stem : q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+q.type+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");

  // Build version keys: S1_A, S1_B, S2_A, S2_B etc.
  const allKeys = [];
  for(let s=1; s<=numClassSections; s++) {
    labels.forEach(v => allKeys.push(`S${s}_${v}`));
  }

  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const sectionRules = Array.from({length:numClassSections},(_,i)=>i+1).map(s => {
    if (s === 1) return `- Section 1 versions (S${s}_A, S${s}_B, ...): numbers mutation — change only coefficients/constants, keep same function types.`;
    if (isQM) return `- Section ${s} versions (S${s}_A, S${s}_B, ...): keep the SAME distribution type. Change μ, σ, uMin, uMax, or probability direction (< vs >). Update graphConfig to match. NEVER change distribution type.`;
    return `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family randomly. Available families: polynomial, exponential (e^x), logarithmic (ln), sin, cos, rational, sqrt. NO two questions in the same section may use the same family. Example for 3 questions: Q1→polynomial, Q2→e^x, Q3→ln. Must differ from Section 1${s>2?" and all previous sections":""}.`;
  }).join("\n");

  const exampleKeys = allKeys.slice(0,4).map(k => `  "${k}": [{type, section, difficulty, question, choices, answer, explanation}, ...]`).join(",\n");

  return `TESTBANK_ALL_SECTIONS_REQUEST
Classroom sections: ${numClassSections}
Versions per section: ${versionList}
All version keys to generate: ${allKeys.join(", ")}

For each version key, mutate ALL of the following questions:
${lines}

MUTATION RULES BY SECTION:
${sectionRules}
- Within each section: each version (A, B, C...) must differ from other versions by numbers only.
- ${isQM ? "Across sections: SAME distribution type MUST be kept. Only numbers (μ, σ, uMin, uMax) or probability direction (< vs >) may change. NEVER switch distribution types." : "Across sections: each section must use different functions entirely."}
- ALWAYS regenerate a correct answer key for each mutated version.
- Keep same question type, section name, and difficulty.
- EXPONENTIAL DISTRIBUTION: always use μ (mu) — NEVER λ (lambda).
- If a question has hasGraph:true, include hasGraph:true and update graphConfig (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability) to match the new numbers.
- ${FR_EXPLANATION_RULE}

Return a JSON object with one key per version label (${allKeys.join(", ")}):
{
${exampleKeys},
  ...
}
Reply with ONLY valid JSON object, no markdown, no explanation.`;
}

function buildReplacePrompt(q, mutationType="numbers") {
  const mutationRule = mutationType === "function"
    ? "Use a DIFFERENT function type (e.g. if original uses polynomial, use exponential or trigonometric). Same concept area, same difficulty, same steps count."
    : "Keep the same function type, change only the numbers/coefficients.";
  const MC_VERIFY = q.type === "Multiple Choice"
    ? `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch.\n- Confirm the answer field exactly matches one of the 4 choices (same value, same notation).\n- Confirm all 4 choices are distinct — no two may be equal or mathematically equivalent.\n- If any check fails, fix the question before returning.`
    : `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch and confirm your answer field is correct.\n- If it is wrong, fix it before returning.`;
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.type==="Branched" ? q.stem : q.question}\nMutation: ${mutationType} — ${mutationRule}\nRequirements: same section, same question type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Branched"?"Include stem and parts array.":""}\n${q.type==="Free Response"?FR_EXPLANATION_RULE:""}${MC_VERIFY}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}

function buildConvertPrompt(q, targetFormat) {
  const isQM = q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II";
  const formatRules = {
    "text": "Convert to a pure text/calculation question. Remove any graph or table. Keep the same concept, numbers, and answer.",
    "table": `Convert to a table-based question. Present the data in a pipe table like:
| X | Value |
|---|-------|
| 1 | ...   |
Keep the same concept and answer. Remove any graphConfig.`,
    "graph": isQM
      ? `Convert to a graph question. Add hasGraph:true and appropriate graphConfig based on the concept:
- For distributions: use continuous_dist with correct distType, mu, sigma, shadeFrom/shadeTo, probability
- For frequency data: use bar or histogram
- For correlation: use scatter
- Keep same question concept and answer. Question text should say "Based on the distribution/chart above, ..."`
      : `Convert to a graph question. Add hasGraph:true and graphConfig with type based on functions in the question:
- 1 function → type:"single", fn:"..."
- 2 functions → type:"area", fnTop:"...", fnBottom:"...", shadeFrom:x0, shadeTo:x1
Keep same concept and answer. Question text should say "Based on the graph above, ..."`,
  };
  return `TESTBANK_CONVERT_REQUEST
Convert this question to a different format.
Section: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty} | Course: ${q.course}
Original question: ${q.type === "Branched" ? q.stem : q.question}
Current format: ${q.hasGraph ? "graph" : "text/table"}
Target format: ${targetFormat}
Rule: ${formatRules[targetFormat]}
Keep: same section, same type (${q.type}), same difficulty, same answer.
Reply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}

function PastePanel({ label, S, text2, pasteInput, setPasteInput, pasteError, handlePaste, onCancel }) {
  return (
    <div style={S.pasteBox}>
      <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"bold", marginBottom:"0.5rem"}}>
        ⏳ Waiting for AI response
      </div>
      <div style={{fontSize:"0.8rem", color:text2, marginBottom:"0.75rem"}}>
        {label || "Generate questions using the prompt above, then paste the JSON array here."}
      </div>
      <textarea
        style={S.textarea}
        placeholder="Paste the JSON response here..."
        value={pasteInput}
        onChange={e => setPasteInput(e.target.value)}
      />
      {pasteError && <div style={{color:"#f87171", fontSize:"0.78rem", marginTop:"0.4rem"}}>{pasteError}</div>}
      <div style={{display:"flex", gap:"0.75rem", marginTop:"0.75rem"}}>
        <button id="auto-submit-paste" style={S.btn("#10b981", !pasteInput.trim())} disabled={!pasteInput.trim()} onClick={handlePaste}>
          ✓ Submit Response
        </button>
        <button style={S.oBtn("#6B6355")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Custom Course Builder ────────────────────────────────────────────────────
function CustomCourseBuilder({ customCourses, onSave, onDelete, text1, text2, text3, border, bg1, S, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", color: "#6366f1", textbook: "", chapters: [] });
  const [newChapter, setNewChapter] = useState({ ch: "", title: "", sections: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState("paste"); // "paste" | "file"
  const [fileName, setFileName] = useState("");
  const [fileRef2, setFileRef2] = useState(null); // base64 data
  const fileRef = useRef(null);

  const COLORS = ["#10b981","#8b5cf6","#f59e0b","#06b6d4","#f43f5e","#e879f9","#a855f7","#3b82f6","#f97316","#ec4899"];
  const MAX_FILE_SIZE = 500 * 1024; // 500KB

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is 500KB (your file: ${Math.round(file.size/1024)}KB).`);
      return;
    }
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "pdf") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(",")[1];
        setFileRef2({ type: "pdf", base64, mediaType: "application/pdf" });
      };
      reader.readAsDataURL(file);
    } else if (ext === "docx") {
      if (!window.mammoth) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
        await new Promise((res, rej) => { script.onload = res; script.onerror = rej; document.head.appendChild(script); });
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const result = await window.mammoth.extractRawText({ arrayBuffer: ev.target.result });
          setSyllabusText(result.value);
          setSyllabusMode("paste");
          setFileName("");
        } catch(e) { setError("Could not read Word file: " + e.message); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Only PDF and Word (.docx) files are supported.");
    }
  }

  async function importFromFile({ type, base64, mediaType }) {
    setSyllabusLoading(true);
    setError("");
    try {
      const prompt = `You are a course structure extractor. Extract the course name, all textbooks/books mentioned, and all chapters with their sections from this syllabus.

Return ONLY a valid JSON object:
{
  "name": "Course Name",
  "textbook": "All textbooks mentioned, comma-separated, or empty string",
  "chapters": [
    { "ch": "1", "title": "Chapter Title", "sections": ["1.1 Section Name", "1.2 Section Name"] }
  ]
}

Reply with ONLY the JSON, no markdown, no explanation.`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, file: { type, base64, mediaType } }),
      });
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response");
      const parsed = JSON.parse(match[0]);
      setForm(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        textbook: parsed.textbook || prev.textbook,
        chapters: parsed.chapters || [],
      }));
      setShowSyllabus(false);
      setFileName("");
      setSyllabusText("");
      setEditing(prev => prev || "new");
    } catch(e) {
      setError("Import failed: " + (e.message || "Unknown error"));
    } finally {
      setSyllabusLoading(false);
    }
  }

  async function importFromSyllabus() {
    if (!syllabusText.trim()) return;
    setSyllabusLoading(true);
    setError("");
    try {
      const prompt = `You are a course structure extractor. Extract the course name, all textbooks/books mentioned, and all chapters with their sections from this syllabus.

Return ONLY a valid JSON object:
{
  "name": "Course Name",
  "textbook": "All textbooks mentioned, comma-separated, or empty string",
  "chapters": [
    { "ch": "1", "title": "Chapter Title", "sections": ["1.1 Section Name", "1.2 Section Name"] }
  ]
}

Syllabus:
${syllabusText}

Reply with ONLY the JSON, no markdown, no explanation.`;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response");
      const parsed = JSON.parse(match[0]);
      setForm(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        textbook: parsed.textbook || prev.textbook,
        chapters: parsed.chapters || [],
      }));
      setShowSyllabus(false);
      setSyllabusText("");
      setEditing(prev => prev || "new");
    } catch(e) {
      setError("Import failed: " + (e.message || "Unknown error"));
    } finally {
      setSyllabusLoading(false);
    }
  }

  function startNew() {
    setForm({ name: "", color: "#6366f1", textbook: "", chapters: [] });
    setNewChapter({ ch: "", title: "", sections: "" });
    setEditing("new");
    setError("");
  }

  function startEdit(name) {
    const c = customCourses[name];
    setForm({ name, color: c.color, textbook: c.textbook || "", chapters: c.chapters || [], id: c.id });
    setNewChapter({ ch: "", title: "", sections: "" });
    setEditing(name);
    setError("");
  }

  function addChapter() {
    if (!newChapter.ch || !newChapter.title) return;
    const sections = newChapter.sections.split("\n").map(s => s.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, chapters: [...prev.chapters, { ch: newChapter.ch, title: newChapter.title, sections }] }));
    setNewChapter({ ch: "", title: "", sections: "" });
  }

  function removeChapter(idx) {
    setForm(prev => ({ ...prev, chapters: prev.chapters.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Course name is required."); return; }
    setSaving(true);
    await onSave(form);
    setEditing(null);
    setSaving(false);
  }

  const inp = (val, set, placeholder, width="100%", type="text") => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
      style={{ width, padding:"0.5rem 0.7rem", background:bg2, border:"1px solid "+border,
        borderRadius:"6px", color:text1, fontSize:"0.82rem", outline:"none", boxSizing:"border-box" }} />
  );

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem" }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background:"none", border:"none", cursor:"pointer", color:text2, fontSize:"0.82rem", display:"flex", alignItems:"center", gap:"6px" }}>
          {expanded ? "▾" : "▸"} Custom Courses {Object.keys(customCourses).length > 0 && `(${Object.keys(customCourses).length})`}
        </button>
        {expanded && (
          <button onClick={startNew}
            style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:"6px",
              padding:"0.35rem 0.85rem", fontSize:"0.78rem", fontWeight:"600", cursor:"pointer" }}>
            + New Course
          </button>
        )}
      </div>

      {expanded && (
        <div>
          {/* Existing custom courses */}
          {Object.keys(customCourses).length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.5rem", marginBottom:"1rem" }}>
              {Object.entries(customCourses).map(([name, c]) => (
                <div key={name} style={{ display:"flex", alignItems:"center", gap:"6px", background:bg1,
                  border:`1px solid ${"#D9D0C0"}`, borderRadius:"8px", padding:"0.4rem 0.75rem",
                  borderLeft:`3px solid ${c.color}` }}>
                  <span style={{ fontSize:"0.82rem", color:text1 }}>{name}</span>
                  <button onClick={() => startEdit(name)}
                    style={{ background:"none", border:"none", cursor:"pointer", color:text3, fontSize:"0.75rem" }}>✏</button>
                  <button onClick={() => { if(confirm(`Delete "${name}"?`)) onDelete(name); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:"0.75rem" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Editor */}
          {editing && (
            <div style={{ background:bg1, border:"1px solid "+border, borderRadius:"10px", padding:"1.25rem" }}>
              <div style={{ fontSize:"0.82rem", fontWeight:"600", color:"#185FA5", marginBottom:"1rem" }}>
                {editing === "new" ? "New Course" : `Editing: ${editing}`}
              </div>

              {/* Syllabus Import */}
              <div style={{ marginBottom:"0.75rem" }}>
                <button onClick={() => setShowSyllabus(s => !s)}
                  style={{ background: showSyllabus ? border : "transparent", color:"#185FA5",
                    border:"1px solid "+border, borderRadius:"6px", padding:"0.35rem 0.85rem",
                    fontSize:"0.78rem", cursor:"pointer", marginBottom: showSyllabus ? "0.75rem" : 0 }}>
                  📄 {showSyllabus ? "Hide" : "Import from Syllabus"}
                </button>
                {showSyllabus && (
                  <div style={{ background:bg2, border:"1px solid "+border, borderRadius:"8px", padding:"0.85rem" }}>
                    {/* Mode tabs */}
                    <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem" }}>
                      {["file", "paste"].map(mode => (
                        <button key={mode} onClick={() => setSyllabusMode(mode)}
                          style={{ background: syllabusMode === mode ? border : "transparent",
                            color: syllabusMode === mode ? "#60a5fa" : text3,
                            border:`1px solid ${syllabusMode === mode ? border : border}`,
                            borderRadius:"6px", padding:"0.3rem 0.75rem", fontSize:"0.75rem", cursor:"pointer" }}>
                          {mode === "file" ? "📎 Upload File" : "📋 Paste Text"}
                        </button>
                      ))}
                    </div>

                    {syllabusMode === "file" ? (
                      <div>
                        <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>
                          Upload PDF or Word (.docx) — max 500KB
                        </div>
                        <input ref={fileRef} type="file" accept=".pdf,.docx"
                          onChange={handleFileUpload}
                          style={{ display:"none" }} />
                        <button onClick={() => fileRef.current?.click()}
                          style={{ background:border, color:"#185FA5", border:"1px solid "+border,
                            borderRadius:"6px", padding:"0.5rem 1rem", fontSize:"0.82rem", cursor:"pointer" }}>
                          {fileName ? `📄 ${fileName}` : "Choose File"}
                        </button>
                        {fileName && !syllabusLoading && (
                          <div style={{ fontSize:"0.72rem", color:"#4ade80", marginTop:"0.4rem" }}>
                            ✓ File ready — click Import to extract
                          </div>
                        )}
                        {fileName && (
                          <button onClick={() => fileRef2 && importFromFile(fileRef2)}
                            disabled={syllabusLoading || !fileRef2}
                            style={{ marginTop:"0.5rem", display:"block", background: syllabusLoading ? "#064e3b" : "#10b981",
                              color:"#fff", border:"none", borderRadius:"6px", padding:"0.5rem 1.25rem",
                              fontSize:"0.82rem", fontWeight:"600", cursor: syllabusLoading ? "not-allowed" : "pointer" }}>
                            {syllabusLoading ? "⏳ Importing..." : "⚡ Import"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>
                          Paste your syllabus — AI extracts course name, textbooks, chapters and sections.
                        </div>
                        <textarea value={syllabusText} onChange={e => setSyllabusText(e.target.value)}
                          placeholder="Paste syllabus text here..."
                          rows={6}
                          style={{ width:"100%", padding:"0.5rem 0.7rem", background:bg2, border:"1px solid "+border,
                            borderRadius:"6px", color:text1, fontSize:"0.78rem", outline:"none",
                            boxSizing:"border-box", resize:"vertical", fontFamily:"inherit", marginBottom:"0.5rem" }} />
                        <button onClick={importFromSyllabus} disabled={syllabusLoading || !syllabusText.trim()}
                          style={{ background: syllabusLoading ? "#064e3b" : "#10b981", color:"#fff", border:"none",
                            borderRadius:"6px", padding:"0.5rem 1.25rem", fontSize:"0.82rem", fontWeight:"600",
                            cursor: syllabusLoading ? "not-allowed" : "pointer" }}>
                          {syllabusLoading ? "⏳ Importing..." : "⚡ Import"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Name + Textbook */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginBottom:"0.75rem" }}>
                <div>
                  <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.3rem" }}>Course Name *</div>
                  {inp(form.name, v => setForm(p => ({...p, name:v})), "e.g. Linear Algebra")}
                </div>
                <div>
                  <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.3rem" }}>Textbook (optional)</div>
                  {inp(form.textbook, v => setForm(p => ({...p, textbook:v})), "e.g. Gilbert Strang 5th Ed")}
                </div>
              </div>

              {/* Color picker */}
              <div style={{ marginBottom:"0.75rem" }}>
                <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>Color</div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(p => ({...p, color:c}))}
                      style={{ width:"24px", height:"24px", borderRadius:"50%", background:c, cursor:"pointer",
                        border: form.color === c ? "2px solid #fff" : "2px solid transparent" }} />
                  ))}
                </div>
              </div>

              {/* Chapters */}
              <div style={{ marginBottom:"0.75rem" }}>
                <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.4rem" }}>Chapters ({form.chapters.length})</div>
                {form.chapters.map((ch, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"0.4rem",
                    background:bg2, borderRadius:"6px", padding:"0.4rem 0.7rem" }}>
                    <span style={{ fontSize:"0.75rem", color:"#185FA5", fontWeight:"600", minWidth:"20px" }}>{ch.ch}</span>
                    <span style={{ fontSize:"0.78rem", color:text1, flex:1 }}>{ch.title}</span>
                    <span style={{ fontSize:"0.68rem", color:text3 }}>{ch.sections.length} sections</span>
                    {isAdmin && <button onClick={() => removeChapter(i)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:"0.8rem" }}>✕</button>}
                  </div>
                ))}

                {/* Add chapter manually — admin only */}
                {isAdmin && (
                  <div style={{ background:bg2, border:"1px dashed #1e3a5f", borderRadius:"8px", padding:"0.85rem", marginTop:"0.5rem" }}>
                    <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.5rem" }}>Add Chapter Manually</div>
                    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:"0.5rem", marginBottom:"0.5rem" }}>
                      {inp(newChapter.ch, v => setNewChapter(p => ({...p, ch:v})), "Ch#", "100%")}
                      {inp(newChapter.title, v => setNewChapter(p => ({...p, title:v})), "Chapter title")}
                    </div>
                    <textarea value={newChapter.sections} onChange={e => setNewChapter(p => ({...p, sections:e.target.value}))}
                      placeholder={"One section per line:\n1.1 Introduction\n1.2 Key Concepts"}
                      rows={3}
                      style={{ width:"100%", padding:"0.5rem 0.7rem", background:bg2, border:"1px solid "+border,
                        borderRadius:"6px", color:text1, fontSize:"0.78rem", outline:"none",
                        boxSizing:"border-box", resize:"vertical", fontFamily:"inherit" }} />
                    <button onClick={addChapter}
                      style={{ marginTop:"0.5rem", background:border, color:"#185FA5", border:"none",
                        borderRadius:"6px", padding:"0.35rem 0.85rem", fontSize:"0.75rem", cursor:"pointer" }}>
                      + Add Chapter
                    </button>
                  </div>
                )}
              </div>

              {error && <div style={{ color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem" }}>{error}</div>}

              <div style={{ display:"flex", gap:"0.5rem" }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:"6px",
                    padding:"0.5rem 1.25rem", fontSize:"0.85rem", fontWeight:"600", cursor:"pointer" }}>
                  {saving ? "Saving..." : "Save Course"}
                </button>
                <button onClick={() => setEditing(null)}
                  style={{ background:"none", color:text2, border:"1px solid "+border, borderRadius:"6px",
                    padding:"0.5rem 1rem", fontSize:"0.85rem", cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Saved Exams Screen ───────────────────────────────────────────────────────
function SavedExamsScreen({ S, text1, text2, text3, border, onLoad }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLog, setExportLog] = useState([]);
  const [gradesData, setGradesData] = useState({}); // examId → [{question, avg, count}]
  const [showGrades, setShowGrades] = useState({}); // examId → bool
  const gradesFileRefs = {};

  useEffect(() => {
    Promise.all([loadExams(), loadExportHistory()]).then(([e, h]) => {
      setExams(e); setExportLog(h); setLoading(false);
    });
  }, []);

  async function loadExportHistory() {
    try {
      const { data, error } = await supabase
        .from("export_history")
        .select("*")
        .order("exported_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    } catch { return []; }
  }

  function parseCanvasGrades(csvText, exam) {
    // Parse CSV — Canvas format: first row = headers, first col = student name, second = ID, rest = question scores
    const lines = csvText.trim().split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
    if (lines.length < 2) return null;
    const headers = lines[0];

    // Find question columns — skip student name, ID, section, group cols
    // Canvas format typically: Student, ID, SIS User ID, SIS Login ID, Section, question_1, question_2...
    const skipCols = new Set();
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes("student") || lower.includes(" id") || lower === "id" ||
          lower.includes("sis") || lower.includes("login") || lower.includes("section") ||
          lower.includes("group") || lower.includes("score") || lower.includes("total") ||
          lower.includes("percent") || lower.includes("grade") || lower === "") {
        skipCols.add(i);
      }
    });

    const questionCols = headers
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => !skipCols.has(i));

    if (questionCols.length === 0) return null;

    // Calculate average score per question column (strip student identity)
    const results = questionCols.map(({ h, i }) => {
      const scores = lines.slice(1)
        .map(row => parseFloat(row[i]))
        .filter(v => !isNaN(v));
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      // Try to find max points from header e.g. "Q1 (2 pts)" or from data
      const maxMatch = h.match(/\((\d+(?:\.\d+)?)\s*pts?\)/i);
      const max = maxMatch ? parseFloat(maxMatch[1]) : Math.max(...scores, 1);
      return { label: h, avg, max, count: scores.length, pct: avg !== null ? Math.round((avg / max) * 100) : null };
    }).filter(r => r.avg !== null).sort((a, b) => a.pct - b.pct);

    return results;
  }

  function handleGradesUpload(e, exam) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const results = parseCanvasGrades(ev.target.result, exam);
      if (!results || results.length === 0) {
        alert("Could not parse grades. Make sure this is a Canvas grades CSV.");
        return;
      }
      setGradesData(prev => ({ ...prev, [exam.id]: results }));
      setShowGrades(prev => ({ ...prev, [exam.id]: true }));
    };
    reader.readAsText(file);
  }

  if (loading) return <div style={{color:text2, padding:"2rem"}}>Loading saved exams…</div>;

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Saved Exams</h1>
        <p style={S.sub}>{exams.length} exam{exams.length !== 1 ? "s" : ""} saved in database.</p>
      </div>

      {exams.length === 0 && (
        <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
          No saved exams yet. Build an exam in the Versions tab and save it.
        </div>
      )}

      {exams.map(exam => {
        const versions = exam.versions || [];
        // detect sections — classSection lives on the version object, fall back to questions[0]
        const sectionNums = [...new Set(versions.map(v => v.classSection ?? v.questions?.[0]?.classSection).filter(Boolean))].sort((a,b)=>a-b);
        const hasMultipleSections = sectionNums.length > 1;
        const safeName = (exam.name||"Exam").replace(/[^a-zA-Z0-9]/g,"_");

        return (
        <div key={exam.id} style={S.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"0.5rem"}}>
            <div>
              <div style={{fontSize:"1rem", fontWeight:"bold", color:text1, marginBottom:"0.25rem"}}>{exam.name}</div>
              <div style={{fontSize:"0.72rem", color:text3}}>
                {new Date(exam.created_at).toLocaleDateString()} · {versions.length} version(s)
                {hasMultipleSections && ` · ${sectionNums.length} sections`}
              </div>
              {!hasMultipleSections && versions.length > 0 && versions.some(v => v.classSection || v.questions?.[0]?.classSection) && (
                <div style={{marginTop:"0.3rem", fontSize:"0.68rem", color:"#f59e0b", background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.2rem 0.5rem"}}>
                  ⚠ Saved before multi-section fix — re-build and re-save to restore all sections
                </div>
              )}
              <button style={{marginTop:"0.4rem", padding:"0.25rem 0.7rem", fontSize:"0.72rem",
                background:"#2D6A4F", color:"#fff", border:"none", borderRadius:"4px",
                cursor:"pointer", fontWeight:"600"}}
                onClick={() => onLoad && onLoad(exam)}>
                ▶ Load into Versions tab
              </button>
            </div>
            <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
            </div>
          </div>

          {/* Word export section — one zip per section */}
          <div style={{marginTop:"0.75rem", borderTop:"1px solid #1e2d45", paddingTop:"0.75rem", display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
            <span style={{fontSize:"0.72rem", color:text3, marginRight:"0.25rem"}}>Word:</span>
            {hasMultipleSections ? (
              // One zip button per section
              sectionNums.map(sec => (
                <button key={sec} style={S.oBtn("#10b981")}
                  onClick={async () => {
                    // load JSZip
                    if (!window.JSZip) {
                      await new Promise((res,rej) => {
                        const s = document.createElement("script");
                        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
                        s.onload = res; s.onerror = rej;
                        document.head.appendChild(s);
                      });
                    }
                    const zip = new window.JSZip();
                    const secVersions = versions.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec || (!(v.classSection ?? v.questions?.[0]?.classSection) && sec === sectionNums[0]));
                    for (const v of secVersions) {
                      const blob = await buildDocx(v.questions, exam.name, v.label, sec);
                      const bytes = await blob.arrayBuffer();
                      zip.file(`${safeName}_S${sec}_V${v.label}.docx`, bytes);
                    }
                    const zipBlob = await zip.generateAsync({type:"blob"});
                    dlBlob(zipBlob, `${safeName}_S${sec}_Word.zip`);
                    await logExport(exam.name, `Word S${sec} ZIP`, sec);
                  }}>
                  ⬇ S{sec} Word (.zip)
                </button>
              ))
            ) : (
              // No sections — one zip with all versions
              <button style={S.oBtn("#10b981")}
                onClick={async () => {
                  if (!window.JSZip) {
                    await new Promise((res,rej) => {
                      const s = document.createElement("script");
                      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
                      s.onload = res; s.onerror = rej;
                      document.head.appendChild(s);
                    });
                  }
                  const zip = new window.JSZip();
                  for (const v of versions) {
                    const blob = await buildDocx(v.questions, exam.name, v.label, null);
                    const bytes = await blob.arrayBuffer();
                    zip.file(`${safeName}_V${v.label}.docx`, bytes);
                  }
                  const zipBlob = await zip.generateAsync({type:"blob"});
                  dlBlob(zipBlob, `${safeName}_Word.zip`);
                  await logExport(exam.name, "Word ZIP", "all");
                }}>
                ⬇ All Versions Word (.zip)
              </button>
            )}
          </div>

          {/* QTI Re-export */}
          <div style={{marginTop:"0.75rem", borderTop:"1px solid #1e2d45", paddingTop:"0.75rem", display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
            <span style={{fontSize:"0.72rem", color:text3, marginRight:"0.25rem"}}>Canvas QTI:</span>
            {hasMultipleSections ? (
              sectionNums.map(sec => (
                <button key={sec} style={S.oBtn("#8b5cf6")}
                  onClick={async () => {
                    const secVersions = versions.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec);
                    const blobs = await buildClassroomSectionsQTI({[sec]: secVersions}, exam.name, true, 1);
                    if (blobs[sec]) dlBlob(blobs[sec], `${safeName}_S${sec}_QTI.zip`);
                    await logExport(exam.name, `QTI S${sec}`, sec);
                  }}>
                  ⬇ S{sec} QTI (.zip)
                </button>
              ))
            ) : (
              versions.map(v => (
                <button key={v.label} style={S.oBtn("#8b5cf6")}
                  onClick={async () => {
                    const xml = buildQTI(v.questions, exam.name, v.label);
                    const blob = await buildQTIZip(xml, `${exam.name}_V${v.label}`);
                    dlBlob(blob, `${safeName}_V${v.label}_QTI.zip`);
                    await logExport(exam.name, "QTI", v.label);
                  }}>
                  ⬇ V{v.label} QTI (.zip)
                </button>
              ))
            )}
          </div>

          {/* Grades Import */}
          <div style={{marginTop:"0.75rem", borderTop:"1px solid #1e2d45", paddingTop:"0.75rem", display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap"}}>
            <input
              type="file" accept=".csv"
              style={{display:"none"}}
              id={`grades-${exam.id}`}
              onChange={e => handleGradesUpload(e, exam)}
            />
            <button style={{...S.oBtn("#06b6d4"), fontSize:"0.72rem"}}
              onClick={() => document.getElementById(`grades-${exam.id}`)?.click()}>
              📊 Import Canvas Grades
            </button>
            {gradesData[exam.id] && (
              <button style={{fontSize:"0.72rem", background:"none", border:"none", cursor:"pointer",
                color: showGrades[exam.id] ? "#06b6d4" : text3}}
                onClick={() => setShowGrades(prev => ({...prev, [exam.id]: !prev[exam.id]}))}>
                {showGrades[exam.id] ? "Hide Results" : "Show Results"}
              </button>
            )}
          </div>

          {/* Grades Results Panel */}
          {showGrades[exam.id] && gradesData[exam.id] && (
            <div style={{marginTop:"0.75rem", background:bg2, border:"1px solid "+border, borderRadius:"10px", padding:"1rem"}}>
              <div style={{fontSize:"0.78rem", color:"#06b6d4", fontWeight:"600", marginBottom:"0.75rem"}}>
                📊 Question Performance — sorted by lowest score
                <span style={{fontSize:"0.68rem", color:text3, fontWeight:"400", marginLeft:"0.5rem"}}>
                  (no student data stored)
                </span>
              </div>
              {gradesData[exam.id].map((r, i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.4rem",
                  padding:"0.4rem 0.6rem", borderRadius:"6px",
                  background: r.pct < 50 ? "#1a0a0a" : r.pct < 70 ? "#1a1200" : "#0a1200"}}>
                  <div style={{flex:1, fontSize:"0.78rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                    title={r.label}>{r.label}</div>
                  <div style={{flexShrink:0, width:"180px"}}>
                    <div style={{height:"6px", borderRadius:"3px", background:border, overflow:"hidden"}}>
                      <div style={{height:"100%", width:`${r.pct}%`, borderRadius:"3px",
                        background: r.pct < 50 ? "#f87171" : r.pct < 70 ? "#f59e0b" : "#4ade80"}} />
                    </div>
                  </div>
                  <div style={{flexShrink:0, fontSize:"0.75rem", fontWeight:"600", minWidth:"45px", textAlign:"right",
                    color: r.pct < 50 ? "#f87171" : r.pct < 70 ? "#f59e0b" : "#4ade80"}}>
                    {r.pct}%
                  </div>
                  <div style={{flexShrink:0, fontSize:"0.68rem", color:text3, minWidth:"55px"}}>
                    {r.avg?.toFixed(1)}/{r.max} pts
                  </div>
                </div>
              ))}
              <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.5rem"}}>
                Based on {gradesData[exam.id][0]?.count || 0} student submissions · Red = below 50% · Yellow = 50–70% · Green = above 70%
              </div>
            </div>
          )}
        </div>
        );
      })}

      {exportLog.length > 0 && (
        <>
          <h2 style={{fontSize:"1.1rem", fontWeight:"normal", margin:"2rem 0 0.75rem", color:text1}}>Export History</h2>
          <div style={S.card}>
            {exportLog.map((log, i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"0.4rem 0", borderBottom: i < exportLog.length-1 ? `1px solid ${"#D9D0C0"}` : "none", fontSize:"0.78rem"}}>
                <span style={{color:text1}}>{log.exam_name} — V{log.version_label}</span>
                <span style={{color:text3}}>{log.format} · {new Date(log.exported_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function TestBankAppInner() {
  const [screen, setScreen] = useState("home");
  const [exportHighlight, setExportHighlight] = useState(false);
  const [bank, setBank] = useState([]);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [savedExams, setSavedExams] = useState([]);
  const [course, setCourse] = useState(null);
  const [selectedSections, setSelectedSections] = useState([]);
  const [sectionCounts, setSectionCounts] = useState({});
  const [generateConfirm, setGenerateConfirm] = useState(false);
  const [sectionConfig, setSectionConfig] = useState({});
  const [qType, setQType] = useState("Multiple Choice");
  const [diff, setDiff] = useState("Mixed");
  const [pendingType, setPendingType] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null);
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [lastGenerated, setLastGenerated] = useState([]);
  const [selectedForExam, setSelectedForExam] = useState([]);
  const [mutationType, setMutationType] = useState({});
  const [versionCount, setVersionCount] = useState(2);
  const [versions, setVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [bankSearch, setBankSearch] = useState("");
  const [bankCompact, setBankCompact] = useState(false);
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterDiff, setFilterDiff] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false);
  const [filterDate, setFilterDate] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterDay, setFilterDay] = useState("All");
  const [filterTime, setFilterTime] = useState("All");
  const [bankSelectMode, setBankSelectMode] = useState(false);
  const [bankSelected, setBankSelected] = useState(new Set());
  const [bulkReplacePrompt, setBulkReplacePrompt] = useState("");
  const [bulkReplacePaste, setBulkReplacePaste] = useState("");
  const [bulkReplaceError, setBulkReplaceError] = useState("");
  const [bulkReplaceIds, setBulkReplaceIds] = useState(new Set());
  const [graphEditorQId, setGraphEditorQId] = useState(null); // which question has graph editor open
  const [inlineEditQId,  setInlineEditQId]  = useState(null); // which question has inline editor open
  const [toast, setToast] = useState(null); // {msg, type} — auto-dismisses

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function autoGenerate(prompt, onSuccess) {
    setIsGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const result = data.result || data.content?.[0]?.text || data.text || "";
      if (!result) throw new Error("Empty response from API. Try again.");
      if (data.warning) showToast(data.warning, "error");
      onSuccess(result);
    } catch(e) {
      setGenerateError(e.message);
      showToast(e.message, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  const [qtiExamName, setQtiExamName] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printGraphCache, setPrintGraphCache] = useState({});

  // Pre-render graphs for print preview — must be after state declarations
  useEffect(() => {
    if (!showPrintPreview) { setPrintGraphCache({}); return; }
    const v = versions[activeVersion];
    if (!v) return;
    const graphQs = v.questions.filter(q => q.hasGraph && q.graphConfig);
    if (!graphQs.length) return;
    (async () => {
      const cache = {};
      for (const q of graphQs) {
        try {
          const isStatChart = q.graphConfig?.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
          const b64 = isStatChart
            ? await (window.statChartToBase64PNG ? window.statChartToBase64PNG(q.graphConfig, 480, 280) : null)
            : await graphToBase64PNG(q.graphConfig, 480, 280);
          if (b64) cache[q.id || q.question] = b64;
        } catch(e) { console.warn("print graph failed", e); }
      }
      setPrintGraphCache(cache);
    })();
  }, [showPrintPreview, activeVersion]);

  const [dupWarnings, setDupWarnings] = useState([]);
  const [saveExamName, setSaveExamName] = useState("");
  const [savingExam, setSavingExam] = useState(false);
  const [exportLoading, setExportLoading] = useState("");  // label of current export, "" = idle
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [examSaved, setExamSaved] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenError, setAutoGenError] = useState("");
  const [validationResults, setValidationResults] = useState({}); // { questionId: { valid, corrected_answer, reason } }
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [user, setUser] = useState(null);

  const isAdmin = user?.email === "mohammadalakhrass@yahoo.com";
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (!session) window.location.href = "/login";
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        window.location.href = "/login";
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const [versionsViewMode, setVersionsViewMode] = useState("single"); // "single" | "compare"
  const [compareSection, setCompareSection] = useState("All");
  const [selectedQIndices, setSelectedQIndices] = useState([]);
  const [qtiUseGroups, setQtiUseGroups] = useState(false);
  const [qtiPointsPerQ, setQtiPointsPerQ] = useState(1);
  const [bankTabState, setBankTabState] = useState("browse");
  const [expandedBatches, setExpandedBatches] = useState({});
  // ── Classroom sections ──
  const [numClassSections, setNumClassSections] = useState(1);
  const [currentClassSection, setCurrentClassSection] = useState(1);
  const [classSectionVersions, setClassSectionVersions] = useState({}); // {1: [...versions], 2: [...versions]}
  const [activeClassSection, setActiveClassSection] = useState(1);

  const [customCourses, setCustomCourses] = useState({});

  const allCourses = { ...COURSES, ...customCourses };
  const accent = course ? (allCourses[course]?.color || "#2D6A4F") : "#2D6A4F";

  useEffect(() => {
    loadBank().then(q => { setBank(q); setBankLoaded(true); });
    loadCustomCourses();
    loadExams().then(e => setSavedExams(e));
  }, []);

  async function loadCustomCourses() {
    try {
      const { data } = await supabase.from("custom_courses").select("*").order("created_at");
      if (!data) return;
      const map = {};
      data.forEach(c => {
        map[c.name] = { color: c.color, chapters: c.chapters || [], id: c.id, textbook: c.textbook };
      });
      setCustomCourses(map);
    } catch(e) { console.error("loadCustomCourses error:", e); }
  }

  async function saveCustomCourse(courseData) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { name: courseData.name, color: courseData.color, chapters: courseData.chapters, textbook: courseData.textbook || "", user_id: user.id };
    if (courseData.id) {
      await supabase.from("custom_courses").update(payload).eq("id", courseData.id);
    } else {
      await supabase.from("custom_courses").insert(payload);
    }
    await loadCustomCourses();
  }

  async function deleteCustomCourse(courseName) {
    const c = customCourses[courseName];
    if (!c?.id) return;
    await supabase.from("custom_courses").delete().eq("id", c.id);
    if (course === courseName) setCourse(null);
    await loadCustomCourses();
  }

  const persistBank = useCallback(async (newBank) => {
    setBank(newBank);
    // individual upserts handled by saveQuestion / deleteQuestion
  }, []);

  async function handlePaste() {
    setPasteError("");
    try {
      const raw = pasteInput.trim();

      // Sanitize any question object from AI — guard null/missing fields
      const sanitize = (q) => {
        // Strip title/probability from graphConfig — cleaner for Canvas exports
        let graphConfig = q.graphConfig;
        if (graphConfig) {
          const { title, ...rest } = graphConfig;
          graphConfig = rest;
        }
        return {
          ...q,
          type:       q.type       || "Multiple Choice",
          difficulty: q.difficulty || "Medium",
          question:   q.question   || "",
          answer:     q.answer     || "",
          choices:    (q.choices   || []).map(c => c ?? ""),
          explanation: q.explanation || "",
          ...(graphConfig ? { graphConfig } : {}),
        };
      };

      // For version_all, parse as object {A:[...], B:[...]}
      if (pendingType === "version_all") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found. Make sure you copied the full response.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, classSection } = pendingMeta;
        const allVersions = labels.map(label => {
          const qs = parsed[label] || [];
          const versioned = qs.map((q,i) => ({
            ...sanitize(q), id: uid(), originalId: selected[i]?.id,
            course: selected[i]?.course || course,
            versionLabel: label, classSection, createdAt: Date.now(),
            ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: q.graphConfig || selected[i].graphConfig } : {}),
          }));
          return { label, questions: versioned, classSection };
        });
        setClassSectionVersions({ [classSection]: allVersions });
        setVersions(allVersions); setActiveVersion(0);
        setActiveClassSection(classSection);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setExamSaved(false); setSaveExamName("");
        setScreen("versions");
        return;
      }

      // Single paste with all sections: {S1_A:[...], S1_B:[...], S2_A:[...], ...}
      if (pendingType === "version_all_sections") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, numClassSections: ncs } = pendingMeta;
        const newSectionVersions = {};
        for(let s=1; s<=ncs; s++) {
          newSectionVersions[s] = labels.map(label => {
            const key = `S${s}_${label}`;
            const qs = parsed[key] || [];
            const versioned = qs.map((q,i) => ({
              ...sanitize(q), id: uid(), originalId: selected[i]?.id,
              course: selected[i]?.course || course,
              versionLabel: label, classSection: s, createdAt: Date.now(),
              ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: q.graphConfig || selected[i].graphConfig } : {}),
            }));
            return { label, questions: versioned, classSection: s };
          });
        }
        setClassSectionVersions(newSectionVersions);
        setVersions(newSectionVersions[1]);
        setActiveVersion(0); setActiveClassSection(1);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setExamSaved(false); setSaveExamName("");
        setScreen("versions");
        return;
      }

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array found. Make sure you copied the full response.");
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

      const sanitized = parsed.map(sanitize);

      if (pendingType === "generate") {
        const tagged = sanitized.map(q => ({ ...q, id: uid(), course: pendingMeta.course, createdAt: Date.now() }));
        // Check for duplicates within same section
        const warnings = [];
        tagged.forEach((newQ, i) => {
          if (newQ.hasGraph) return; // skip duplicate check for graph questions
          const sectionBank = bank.filter(bq => bq.section === newQ.section && bq.course === newQ.course);
          const sim = sectionBank.find(bq => questionSimilarity(newQ, bq) > 0.75);
          if (sim) warnings.push(`Q${i+1} (${newQ.section}) may be similar to an existing question.`);
        });
        setDupWarnings(warnings);
        setLastGenerated(tagged);
        for (const q of tagged) await saveQuestion(q);
        setBank(prev => [...tagged, ...prev]);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setScreen("bank");
      } else if (pendingType === "version") {
        const { selected, label, allVersions, remaining, mutationType: mt } = pendingMeta;
        const versioned = sanitized.map((q,i) => ({
          ...q,
          id: uid(),
          originalId: selected[i]?.id,
          course: selected[i]?.course || course,
          versionLabel: label,
          createdAt: Date.now(),
          // carry graph config from AI response if present, else fall back to original
          ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: q.graphConfig || selected[i].graphConfig } : {}),
        }));
        const updated = [...allVersions, { label, questions: versioned }];
        if (remaining.length > 0) {
          const nextLabel = remaining[0]; const nextRemaining = remaining.slice(1);
          const prompt = buildVersionPrompt(selected, mt, nextLabel);
          setGeneratedPrompt(prompt);
          setPendingMeta({ selected, label: nextLabel, allVersions: updated, remaining: nextRemaining, mutationType: mt });
          setPasteInput("");
        } else {
          setVersions(updated); setActiveVersion(0);
          setPendingType(null); setPasteInput(""); setPendingMeta(null);
          setExamSaved(false); setSaveExamName("");
          setScreen("versions");
        }
      } else if (pendingType === "replace") {
        const { vIdx, qIdx } = pendingMeta;
        const newQ = { ...parsed[0], id: uid(), course: versions[vIdx].questions[qIdx]?.course || course, versionLabel: versions[vIdx].label, classSection: versions[vIdx].questions[qIdx]?.classSection };
        const updatedVersions = versions.map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) });
        setVersions(updatedVersions);
        // Also update classSectionVersions so exports use the replaced question
        const cs = versions[vIdx]?.classSection || versions[vIdx]?.questions[0]?.classSection;
        if (cs) {
          setClassSectionVersions(prev => ({
            ...prev,
            [cs]: (prev[cs] || []).map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) })
          }));
        } else {
          // Single section — sync all classSectionVersions entries
          setClassSectionVersions(prev => {
            const updated = {...prev};
            Object.keys(updated).forEach(sec => {
              updated[sec] = updated[sec].map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) });
            });
            return updated;
          });
        }
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
      }
    } catch(e) { setPasteError("Error: " + e.message); }
  }

  function triggerGenerate() {
    const prompt = buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig);
    setGeneratedPrompt(prompt);
    setPendingType("generate"); setPendingMeta({ course }); setPasteInput(""); setPasteError("");
  }

  function sectionSortKey(section) {
    // Extract numeric parts from section like "3.1", "5.4", "A.1", "11.2"
    const m = String(section||"").match(/([A-Za-z]?)(\d+)\.(\d+)/);
    if (!m) return [999, 999];
    const prefix = m[1] ? m[1].charCodeAt(0) - 64 : 0; // A=1, B=2...
    return [prefix * 1000 + parseInt(m[2]), parseInt(m[3])];
  }

  function triggerVersions() {
    const selected = bank
      .filter(q => selectedForExam.includes(q.id))
      .sort((a, b) => {
        const [aMaj, aMin] = sectionSortKey(a.section);
        const [bMaj, bMin] = sectionSortKey(b.section);
        return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
      });
    const labels = VERSIONS.slice(0, versionCount);
    if (numClassSections > 1) {
      const prompt = buildAllSectionsPrompt(selected, labels, numClassSections, course);
      setGeneratedPrompt(prompt);
      setPendingType("version_all_sections");
      setPendingMeta({ selected, labels, numClassSections });
    } else {
      const prompt = buildAllVersionsPrompt(selected, mutationType, labels, 1, 1, course);
      setGeneratedPrompt(prompt);
      setPendingType("version_all");
      setPendingMeta({ selected, labels, mutationType, classSection: 1 });
    }
    setPasteInput(""); setPasteError("");
  }

  async function autoGenerateVersions(prompt, pendingTypeVal, pendingMetaVal) {
    setAutoGenLoading(true);
    setAutoGenError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text || data.text || "";
      if (!text) throw new Error("Empty response from API. Try again or use Copy Prompt.");
      if (data.warning) showToast(data.warning, "error");
      if (data.stop_reason === "max_tokens" && !text) throw new Error("Response truncated — generate fewer questions at once (max 10 recommended).");
      setPasteInput(text);
      setPendingType(pendingTypeVal);
      setPendingMeta(pendingMetaVal);
      setGeneratedPrompt(prompt);
      // auto-submit
      setTimeout(() => { document.getElementById("auto-submit-paste")?.click(); }, 100);
    } catch (e) {
      setAutoGenError(e.message || "Generation failed. Try Copy Prompt instead.");
    } finally {
      setAutoGenLoading(false);
    }
  }

  function triggerReplace(vIdx, qIdx, mutationType="numbers") {
    const prompt = buildReplacePrompt(versions[vIdx].questions[qIdx], mutationType);
    setGeneratedPrompt(prompt);
    setPendingType("replace"); setPendingMeta({ vIdx, qIdx }); setPasteInput(""); setPasteError("");
  }

  async function triggerReplaceAuto(vIdx, qIdx, mutationType="numbers") {
    const baseQ = versions[vIdx].questions[qIdx];
    const prompt = buildReplacePrompt(baseQ, mutationType);
    setGeneratedPrompt(prompt);
    setPendingType("replace");
    setPendingMeta({ vIdx, qIdx });
    setPasteInput(""); setPasteError("");
    await autoGenerateVersions(prompt, "replace", { vIdx, qIdx });
  }

  function defaultSecCfg() {
    const defTypeCounts = { normal: 1, table: 0, graph: 0, mix: 0 };
    return {
      Easy:   { count:1, graphType:"normal", tableRows:4, tableCols:2, typeCounts: {...defTypeCounts} },
      Medium: { count:1, graphType:"normal", tableRows:5, tableCols:3, typeCounts: {...defTypeCounts} },
      Hard:   { count:1, graphType:"normal", tableRows:6, tableCols:3, typeCounts: {...defTypeCounts} },
    };
  }

  function getSectionConfig(sec) { return sectionConfig[sec] || defaultSecCfg(); }
  function setSectionDiff(sec, difficulty, fields, value) {
    // Accept either (sec, diff, fieldName, value) or (sec, diff, {field:value,...})
    const updates = typeof fields === "object" ? fields : { [fields]: value };
    setSectionConfig(prev => {
      const secCfg = prev[sec] || defaultSecCfg();
      return { ...prev, [sec]: { ...secCfg, [difficulty]: { ...secCfg[difficulty], ...updates } } };
    });
  }

  function toggleSection(sec) {
    setSelectedSections(p => p.includes(sec) ? p.filter(s => s !== sec) : [...p, sec]);
    setSectionCounts(p => ({ ...p, [sec]: p[sec] || 3 }));
    setSectionConfig(p => p[sec] ? p : ({ ...p, [sec]: defaultSecCfg() }));
  }

  function toggleChapter(chap) {
    const all = chap.sections.every(s => selectedSections.includes(s));
    if (all) { setSelectedSections(p => p.filter(s => !chap.sections.includes(s))); }
    else {
      setSelectedSections(p => { const n = [...p]; chap.sections.forEach(s => { if (!n.includes(s)) n.push(s); }); return n; });
      setSectionCounts(p => { const n = { ...p }; chap.sections.forEach(s => { if (!n[s]) n[s] = 3; }); return n; });
      setSectionConfig(p => { const n = { ...p }; chap.sections.forEach(s => { if (!n[s]) n[s] = defaultSecCfg(); }); return n; });
    }
  }

  const chapters = course ? (allCourses[course]?.chapters || []) : [];
  const totalQ = selectedSections.reduce((a,s) => {
    const cfg = sectionConfig[s] || defaultSecCfg();
    return a + (cfg.Easy.count||0) + (cfg.Medium.count||0) + (cfg.Hard.count||0);
  }, 0);

  // Get available sections — only show when a course is selected, pulled from actual bank questions
  const availableSections = filterCourse === "All"
    ? []
    : [...new Set(bank.filter(q => q.course === filterCourse).map(q => q.section).filter(Boolean))].sort();

  const filteredBank = bank.filter(q => {
    const searchLower = bankSearch.toLowerCase().trim();
    const matchesSearch = !searchLower || (
      (q.question||"").toLowerCase().includes(searchLower) ||
      (q.stem||"").toLowerCase().includes(searchLower) ||
      (q.answer||"").toLowerCase().includes(searchLower) ||
      (q.section||"").toLowerCase().includes(searchLower) ||
      (q.choices||[]).some(c => c != null && String(c).toLowerCase().includes(searchLower))
    );
    return matchesSearch &&
      (filterCourse === "All" || q.course === filterCourse) &&
      (filterType === "All" || q.type === filterType) &&
      (filterDiff === "All" || q.difficulty === filterDiff) &&
      (filterSection === "All" || q.section === filterSection) &&
      (!filterIssuesOnly || validateQuestion(q).length > 0) &&
      (() => {
        if (filterYear === "All") return true;
        const d = new Date(q.createdAt);
        if (String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "All" && String(d.getMonth()) !== filterMonth) return false;
        if (filterDay !== "All" && String(d.getDate()) !== filterDay) return false;
        if (filterTime !== "All" && d.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"}) !== filterTime) return false;
        return true;
      })();
  }).sort((a, b) => {
    const [aMaj, aMin] = sectionSortKey(a.section);
    const [bMaj, bMin] = sectionSortKey(b.section);
    if (aMaj !== bMaj) return aMaj - bMaj;
    if (aMin !== bMin) return aMin - bMin;
    return (a.createdAt || 0) - (b.createdAt || 0); // within same section: oldest first
  });

  // Detect near-duplicate questions in the bank (same section + high word overlap)
  const duplicateIds = new Set();
  for (let i = 0; i < bank.length; i++) {
    for (let j = i + 1; j < bank.length; j++) {
      const a = bank[i]; const b = bank[j];
      if (a.section !== b.section) continue;
      const sim = questionSimilarity(a, b);
      if (sim > 0.75) { duplicateIds.add(a.id); duplicateIds.add(b.id); }
    }
  }
  const bankDupCount = duplicateIds.size;

  // Available years, months, days from bank
  const availableYears = [...new Set(bank.map(q => String(new Date(q.createdAt).getFullYear())))].sort((a,b) => b-a);
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const availableMonths = filterYear === "All" ? [] : [...new Set(
    bank.filter(q => String(new Date(q.createdAt).getFullYear()) === filterYear)
      .map(q => String(new Date(q.createdAt).getMonth()))
  )].sort((a,b) => b-a);
  const availableDays = (filterYear === "All" || filterMonth === "All") ? [] : [...new Set(
    bank.filter(q => {
      const d = new Date(q.createdAt);
      return String(d.getFullYear()) === filterYear && String(d.getMonth()) === filterMonth;
    }).map(q => String(new Date(q.createdAt).getDate()))
  )].sort((a,b) => b-a);
  const availableTimes = (filterYear === "All" || filterMonth === "All" || filterDay === "All") ? [] : [...new Set(
    bank.filter(q => {
      const d = new Date(q.createdAt);
      return String(d.getFullYear()) === filterYear && String(d.getMonth()) === filterMonth && String(d.getDate()) === filterDay;
    }).map(q => new Date(q.createdAt).toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"}))
  )].sort((a,b) => new Date(`1970/01/01 ${b}`) - new Date(`1970/01/01 ${a}`));
  const courseColors = Object.fromEntries(Object.entries(allCourses).map(([k, v]) => [k, v.color]));

  // ── Design tokens — defined at module level above ────────────────────────────

  // Forest green primary, amber secondary
  const amber1 = "#92400E";  // warning/amber

  const S = {
    // Layout
    app: { display:"flex", minHeight:"100vh", background:bg0, fontFamily:"'Georgia',serif", color:text1 },
    sidebar: {
      width:"230px", flexShrink:0, background:"#1B4332",
      borderRight:"none",
      display:"flex", flexDirection:"column", padding:"0",
      position:"sticky", top:0, height:"100vh", overflowY:"auto"
    },
    sidebarLogo: {
      padding:"1.5rem 1.25rem 1.2rem", borderBottom:"1px solid #2D6A4F",
      display:"flex", alignItems:"center", gap:"0.75rem"
    },
    logoMark: {
      width:"36px", height:"36px", borderRadius:"10px",
      background:"#52B788",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:"1rem", fontWeight:"900", color:"#1B4332", flexShrink:0,
    },
    logoText: { fontSize:"0.95rem", fontWeight:"700", letterSpacing:"-0.02em", color:"#D8F3DC", fontFamily:"'Georgia',serif" },
    logoSub: { fontSize:"0.55rem", color:"#52B788", letterSpacing:"0.12em", textTransform:"uppercase", marginTop:"3px", fontFamily:"'Inter',system-ui,sans-serif" },
    navSection: { padding:"1.2rem 1rem 0.3rem", fontSize:"0.55rem", letterSpacing:"0.16em", textTransform:"uppercase", color:"#52B788", fontWeight:"700", fontFamily:"'Inter',system-ui,sans-serif" },
    navBtn: (a) => ({
      display:"flex", alignItems:"center", gap:"0.65rem",
      padding:"0.55rem 0.9rem", margin:"0.04rem 0.6rem",
      borderRadius:"8px", border:"none", cursor:"pointer",
      background: a ? "#52B78825" : "transparent",
      color: a ? "#D8F3DC" : "#74B49B",
      fontSize:"0.82rem", fontWeight: a ? "600" : "400",
      textAlign:"left", width:"calc(100% - 1.2rem)",
      transition:"background 0.12s, color 0.12s",
      borderLeft: a ? "3px solid #52B788" : "3px solid transparent",
      fontFamily:"'Inter',system-ui,sans-serif",
    }),
    navIcon: { fontSize:"0.95rem", width:"20px", textAlign:"center", flexShrink:0 },
    navBadge: (c) => ({
      marginLeft:"auto", background:"#52B78830", color:"#D8F3DC", border:"1px solid #52B78860",
      borderRadius:"10px", padding:"0.05rem 0.4rem", fontSize:"0.6rem", fontWeight:"700",
      fontFamily:"'Inter',system-ui,sans-serif"
    }),
    main: { flex:1, minWidth:0, padding:"2.5rem 3rem", maxWidth:"980px" },
    pageHeader: { marginBottom:"2rem", borderBottom:"1px solid "+border, paddingBottom:"1.25rem" },
    h1: { fontSize:"1.75rem", fontWeight:"700", letterSpacing:"-0.03em", marginBottom:"0.25rem", color:text1, fontFamily:"'Georgia',serif" },
    h2: { fontSize:"1.1rem", fontWeight:"700", letterSpacing:"-0.02em", marginBottom:"0.5rem", color:text1, fontFamily:"'Georgia',serif" },
    sub: { color:text2, fontSize:"0.83rem", marginBottom:"0", lineHeight:1.6, fontFamily:"'Inter',system-ui,sans-serif" },
    // Cards
    card: {
      background:bg1, border:"1px solid "+border, borderRadius:"14px",
      padding:"1.5rem", marginBottom:"1rem",
      boxShadow:"0 1px 3px rgba(45,106,79,0.06)"
    },
    cardSm: {
      background:bg1, border:"1px solid "+border, borderRadius:"10px",
      padding:"1rem", marginBottom:"0.75rem",
      boxShadow:"0 1px 2px rgba(45,106,79,0.04)"
    },
    statCard: (c) => ({
      background:bg1, border:"1px solid "+border, borderRadius:"14px",
      padding:"1.25rem", position:"relative", overflow:"hidden",
      boxShadow:"0 1px 3px rgba(45,106,79,0.06)"
    }),
    statAccent: (c) => ({
      position:"absolute", top:0, left:0, right:0, height:"3px",
      background:c
    }),
    // Course chips
    courseChip: (c, active) => ({
      display:"inline-flex", alignItems:"center", gap:"0.4rem",
      padding:"0.4rem 0.9rem", borderRadius:"20px", cursor:"pointer", border:"none",
      background: active ? c+"20" : bg2,
      color: active ? c : text2,
      fontSize:"0.78rem", fontWeight: active ? "600" : "400",
      outline: active ? "1.5px solid "+c+"77" : "1px solid "+border,
      fontFamily:"'Inter',system-ui,sans-serif", transition:"all 0.15s"
    }),
    courseDot: (c) => ({
      width:"7px", height:"7px", borderRadius:"50%", background:c, flexShrink:0
    }),
    // Section buttons
    sGrid: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"0.35rem" },
    sBtn: (sel) => ({
      background: sel ? green1+"15" : bg2,
      border: "1px solid "+(sel ? green1+"55" : border),
      borderRadius:"8px", padding:"0.55rem 0.75rem", cursor:"pointer",
      color: sel ? green1 : text2, fontSize:"0.78rem", textAlign:"left",
      fontFamily:"'Inter',system-ui,sans-serif", display:"flex", alignItems:"center", gap:"0.45rem",
      transition:"all 0.15s"
    }),
    chk: (sel) => ({
      width:"14px", height:"14px", borderRadius:"4px",
      border:"1.5px solid "+(sel ? green1 : text3),
      background: sel ? green1 : "transparent", flexShrink:0,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:"9px", color:"#fff", fontWeight:"bold"
    }),
    // Form elements
    row: { display:"flex", gap:"1rem", marginBottom:"1.25rem", flexWrap:"wrap" },
    field: { flex:1, minWidth:"120px" },
    lbl: { display:"block", fontSize:"0.65rem", textTransform:"uppercase", letterSpacing:"0.1em", color:text3, marginBottom:"0.4rem", fontWeight:"600", fontFamily:"'Inter',system-ui,sans-serif" },
    sel: {
      width:"100%", background:bg2, border:"1px solid "+border, borderRadius:"8px",
      padding:"0.6rem 0.8rem", color:text1, fontSize:"0.83rem",
      fontFamily:"'Inter',system-ui,sans-serif"
    },
    input: {
      background:bg2, border:"1px solid "+border, borderRadius:"8px",
      padding:"0.6rem 0.8rem", color:text1, fontSize:"0.83rem",
      fontFamily:"'Inter',system-ui,sans-serif", width:"100%"
    },
    // Buttons
    btn: (bg, dis) => ({
      background: dis ? bg3 : bg, color: dis ? text3 : (bg === green1 ? "#fff" : "#fff"),
      border:"none", borderRadius:"9px", padding:"0.65rem 1.4rem",
      fontSize:"0.83rem", fontWeight:"600", cursor: dis ? "not-allowed" : "pointer",
      fontFamily:"'Inter',system-ui,sans-serif", display:"inline-flex",
      alignItems:"center", gap:"0.45rem", transition:"opacity 0.15s",
      opacity: dis ? 0.5 : 1
    }),
    oBtn: (c) => ({
      background:"transparent", color:c, border:"1px solid "+c+"66",
      borderRadius:"9px", padding:"0.55rem 1.1rem", fontSize:"0.78rem",
      cursor:"pointer", fontFamily:"'Inter',system-ui,sans-serif",
      display:"inline-flex", alignItems:"center", gap:"0.4rem"
    }),
    smBtn: {
      background:bg2, border:"1px solid "+border, color:text2, borderRadius:"6px",
      padding:"0.2rem 0.55rem", fontSize:"0.68rem", cursor:"pointer",
      fontFamily:"'Inter',system-ui,sans-serif"
    },
    ghostBtn: (c) => ({
      background:c+"15", color:c, border:"1px solid "+c+"33", borderRadius:"6px",
      padding:"0.25rem 0.6rem", fontSize:"0.7rem", cursor:"pointer",
      fontFamily:"'Inter',system-ui,sans-serif", fontWeight:"500"
    }),
    // Tags
    tag: (c) => ({
      display:"inline-flex", alignItems:"center", gap:"0.25rem",
      background:(c||green1)+"15", border:"1px solid "+(c||green1)+"33",
      color:(c||green1), borderRadius:"5px", padding:"0.1rem 0.45rem",
      fontSize:"0.65rem", fontWeight:"600", marginRight:"0.25rem",
      fontFamily:"'Inter',system-ui,sans-serif"
    }),
    diffTag: (d) => {
      const dc = d==="Easy"?"#2D6A4F":d==="Medium"?"#92400E":"#9B1C1C";
      const bg = d==="Easy"?"#D1FAE5":d==="Medium"?"#FEF3C7":"#FEE2E2";
      return { display:"inline-block", background:bg, color:dc, border:"none",
        borderRadius:"4px", padding:"0.1rem 0.45rem", fontSize:"0.62rem", fontWeight:"700",
        fontFamily:"'Inter',system-ui,sans-serif" };
    },
    divider: { border:"none", borderTop:"1px solid "+border, margin:"1.5rem 0" },
    // Question cards
    qCard: {
      background:bg1, border:"1px solid "+border, borderRadius:"12px",
      padding:"1.1rem", marginBottom:"0.6rem", transition:"border-color 0.15s, box-shadow 0.15s",
      boxShadow:"0 1px 2px rgba(45,106,79,0.04)"
    },
    qMeta: {
      fontSize:"0.62rem", color:text3, letterSpacing:"0.04em",
      textTransform:"uppercase", marginBottom:"0.4rem",
      display:"flex", gap:"0.4rem", alignItems:"center", flexWrap:"wrap",
      fontFamily:"'Inter',system-ui,sans-serif"
    },
    qText: { fontSize:"0.88rem", color:text1, lineHeight:1.75, marginBottom:"0.65rem", fontFamily:"'Georgia',serif" },
    cList: { listStyle:"none", padding:0, margin:0, marginBottom:"0.5rem" },
    cItem: (correct) => ({
      padding:"0.35rem 0.65rem", marginBottom:"0.2rem", borderRadius:"6px",
      background: correct ? "#D1FAE5" : "transparent",
      border: "1px solid "+(correct ? "#2D6A4F44" : border),
      color: correct ? green2 : text2, fontSize:"0.83rem",
      display:"flex", alignItems:"flex-start", gap:"0.5rem",
      fontFamily:"'Inter',system-ui,sans-serif"
    }),
    ans: {
      fontSize:"0.8rem", color:green2, background:"#D1FAE5",
      border:"1px solid #2D6A4F30", borderRadius:"6px",
      padding:"0.35rem 0.7rem", marginBottom:"0.35rem",
      display:"flex", alignItems:"center", gap:"0.4rem",
      fontFamily:"'Inter',system-ui,sans-serif"
    },
    expl: { fontSize:"0.76rem", color:text2, fontStyle:"italic", marginTop:"0.2rem", lineHeight:1.6, fontFamily:"'Georgia',serif" },
    vTab: (active, c) => ({
      background: active ? c+"20" : "transparent",
      border: "1px solid "+(active ? c+"66" : border),
      color: active ? c : text2, borderRadius:"8px",
      padding:"0.4rem 0.9rem", fontSize:"0.78rem", cursor:"pointer",
      fontFamily:"'Inter',system-ui,sans-serif", fontWeight: active ? "600" : "400"
    }),
    // Paste/prompt
    pasteBox: {
      background:bg1, border:"1px solid "+green1+"33", borderRadius:"12px",
      padding:"1.25rem", marginTop:"1.5rem"
    },
    textarea: {
      width:"100%", minHeight:"110px", background:bg0,
      border:"1px solid "+border, borderRadius:"8px",
      padding:"0.75rem", color:text1, fontSize:"0.8rem",
      fontFamily:"'JetBrains Mono','Fira Code',monospace", resize:"vertical"
    },
    promptBox: {
      background:bg0, border:"1px solid "+border, borderRadius:"8px",
      padding:"1rem", marginBottom:"1rem", fontSize:"0.72rem", color:text2,
      fontFamily:"'JetBrains Mono','Fira Code',monospace",
      whiteSpace:"pre-wrap", wordBreak:"break-word", maxHeight:"180px", overflowY:"auto"
    },
  };

  // ── Sidebar nav groups ───────────────────────────────────────────────────────
  const bankIssueCount = bank.filter(q => validateQuestion(q).length > 0).length;

  // Map originalId → count of saved exams that include that question
  const usedInExams = {};
  savedExams.forEach(exam => {
    const versions = exam.versions || [];
    const seen = new Set();
    versions.forEach(v => (v.questions||[]).forEach(q => {
      const key = q.originalId || q.id;
      if (key && !seen.has(key)) { seen.add(key); usedInExams[key] = (usedInExams[key]||0) + 1; }
    }));
  });

  const navGroups = [
    { label: null, items: [
      { id:"home", icon:"⊟", label:"Dashboard" },
    ]},
    { label: "Question Bank", items: [
      ...(isAdmin ? [{ id:"generate", icon:"✦", label:"Generate" }] : []),
      { id:"review",   icon:"◎", label:"Review", badge: lastGenerated.length || null, alert: lastGenerated.length > 0 },
      { id:"bank",     icon:"▦", label:"Browse & Edit", badge: bank.length || null },
    ]},
    { label: "Exam Builder", items: [
      { id:"versions", icon:"⊞", label:"Build & Export" },
      { id:"saved",    icon:"◈", label:"Saved Exams" },
    ]},
  ];

  // ── Sidebar component ────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={S.sidebarLogo}>
        <div style={S.logoMark}>T</div>
        <div>
          <div style={S.logoText}>TestBank Pro</div>
          <div style={S.logoSub}>Exam Authoring Suite</div>
        </div>
      </div>

      {/* Notification banners */}
      {lastGenerated.length > 0 && (
        <div onClick={() => setScreen("review")} style={{
          margin:"0.7rem 0.6rem 0", padding:"0.55rem 0.7rem",
          background:"#FEF3C7", border:"1px solid #FCD34D",
          borderRadius:"8px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:"0.5rem"
        }}>
          <span style={{fontSize:"0.9rem"}}>⚡</span>
          <div>
            <div style={{fontSize:"0.71rem", color:"#f59e0b", fontWeight:"600", lineHeight:1.3}}>{lastGenerated.length} questions ready to review</div>
            <div style={{fontSize:"0.62rem", color:"#92400E", marginTop:"1px"}}>Click to review →</div>
          </div>
        </div>
      )}
      {bankIssueCount > 0 && (
        <div onClick={() => { setFilterIssuesOnly(true); setScreen("bank"); }} style={{
          margin:"0.4rem 0.6rem 0", padding:"0.5rem 0.7rem",
          background:"#FEE2E2", border:"1px solid #FECACA",
          borderRadius:"8px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:"0.5rem"
        }}>
          <span style={{fontSize:"0.9rem"}}>⚠️</span>
          <div>
            <div style={{fontSize:"0.71rem", color:"#9B1C1C", fontWeight:"600", lineHeight:1.3}}>{bankIssueCount} question{bankIssueCount>1?"s":""} with issues</div>
            <div style={{fontSize:"0.62rem", color:"#9B1C1C", marginTop:"1px"}}>Click to fix →</div>
          </div>
        </div>
      )}

      {/* Nav groups */}
      <div style={{padding:"0.4rem 0", flex:1}}>
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && <div style={S.navSection}>{group.label}</div>}
            {group.items.map(n => (
              <button key={n.id}
                style={{...S.navBtn(screen===n.id), ...(n.alert && screen!==n.id ? {color:"#f59e0b"} : {})}}
                onClick={() => setScreen(n.id)}>
                <span style={S.navIcon}>{n.icon}</span>
                <span style={{flex:1}}>{n.label}</span>
                {n.badge ? <span style={S.navBadge(screen===n.id ? accent : n.alert ? "#f59e0b" : "#3a5a8a")}>{n.badge}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Active course */}
      {course && (
        <div style={{padding:"0.7rem 1rem", borderTop:"1px solid "+border}}>
          <div style={{fontSize:"0.57rem", color:text3, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.3rem"}}>Active Course</div>
          <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
            <div style={{width:"7px", height:"7px", borderRadius:"50%", background:accent, flexShrink:0, boxShadow:"0 0 6px "+accent}}/>
            <span style={{fontSize:"0.74rem", color:accent, fontWeight:"600", lineHeight:1.3}}>{course}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{padding:"0.55rem 1rem", borderTop:"1px solid "+border}}>
        {user && (
          <div style={{marginBottom:"0.4rem"}}>
            <div style={{fontSize:"0.6rem", color:text3, marginBottom:"0.15rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {user.email}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{fontSize:"0.62rem", color:"#475569", background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline"}}>
              Sign out
            </button>
          </div>
        )}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span style={{fontSize:"0.57rem", color:text3}}>TestBank Pro</span>
          <span style={{fontSize:"0.57rem", color:text3, background:bg3, padding:"0.1rem 0.4rem", borderRadius:"4px", fontWeight:"600"}}>v55</span>
        </div>
      </div>
    </aside>
  );

  const [confirmDelete, setConfirmDelete] = useState(null); // {id, label}

  // ── Auto-validate all versions (admin only) ───────────────────────────────
  async function autoValidateAllVersions() {
    setValidating(true);
    setValidationError("");
    try {
      const allVersions = Object.keys(classSectionVersions).length > 1
        ? Object.values(classSectionVersions).flat()
        : versions;
      const seen = new Set();
      const uniqueQuestions = [];
      allVersions.forEach(v => {
        v.questions.forEach(q => {
          if (!seen.has(q.id)) { seen.add(q.id); uniqueQuestions.push(q); }
        });
      });
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: uniqueQuestions }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const results = {};
      (data.validated || []).forEach(q => { results[q.id] = q.validation; });
      setValidationResults(results);
    } catch (e) {
      setValidationError(e.message || "Validation failed. Try Copy Validation Prompt instead.");
    }
    setValidating(false);
  }

  // ── Copy validation prompt (admin only) ──────────────────────────────────
  function copyValidationPrompt() {
    const allVersions = Object.keys(classSectionVersions).length > 1
      ? Object.values(classSectionVersions).flat()
      : versions;
    const seen = new Set();
    const uniqueQuestions = [];
    allVersions.forEach(v => {
      v.questions.forEach(q => {
        if (!seen.has(q.id)) { seen.add(q.id); uniqueQuestions.push(q); }
      });
    });
    const questionsText = uniqueQuestions.map((q, i) => {
      const choices = (q.choices || []).map((c, ci) => `  ${String.fromCharCode(65+ci)}) ${c}`).join("\n");
      return `Q${i+1}: ${q.question}\n${choices}\n  Correct Answer: ${q.answer}`;
    }).join("\n\n");
    const prompt = `You are validating math exam questions for a university course.

For each question below, check:
1. Is the correct answer mathematically accurate?
2. Are the distractors plausible student mistakes (not random values)?
3. Is the question clearly worded with no ambiguity?
4. Are any two choices mathematically equivalent? (e.g. 1/2 and 0.5, or x+x and 2x)
5. Are any two choices identical or near-identical in value?

For each issue found, return:
- Question number
- Problem: what is wrong
- Fix: the corrected answer, rewrite, or replacement distractor

If everything is correct, say "All questions verified"

QUESTIONS:
${questionsText}`;
    navigator.clipboard.writeText(prompt);
  }

  if (authLoading) return (
    <div style={{ minHeight:"100vh", background:bg0, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"1.4rem", fontWeight:"800", color:text1, marginBottom:"1.25rem", letterSpacing:"-0.5px" }}>
          TestBank <span style={{ color:"#10b981" }}>Pro</span>
        </div>
        <div style={{ width:"28px", height:"28px", border:"2px solid #1e3a5f", borderTop:"2px solid #10b981", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <Sidebar />

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:99999,
          padding:"0.65rem 1.1rem", borderRadius:"8px", fontSize:"0.82rem", fontWeight:"600",
          background: toast.type==="error" ? "#7c2d12" : toast.type==="warn" ? "#451a03" : "#052e16",
          color: toast.type==="error" ? "#fca5a5" : toast.type==="warn" ? "#fde68a" : "#86efac",
          border: `1px solid ${toast.type==="error" ? "#f8717144" : toast.type==="warn" ? "#f59e0b44" : "#22c55e44"}`,
          boxShadow:"0 4px 20px rgba(0,0,0,0.4)", animation:"fadeIn 0.2s ease"}}>
          {toast.type==="success" ? "✓" : toast.type==="warn" ? "⚠" : "✕"} {toast.msg}
        </div>
      )}

      {/* ── Export loading overlay ── */}
      {exportLoading && (
        <div style={{position:"fixed", bottom:"1.5rem", left:"50%", transform:"translateX(-50%)", zIndex:99999,
          padding:"0.65rem 1.4rem", borderRadius:"8px", fontSize:"0.82rem", fontWeight:"600",
          background:"#1B4332", color:"#86efac", border:"1px solid #22c55e44",
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:"0.5rem"}}>
          <span style={{display:"inline-block", animation:"spin 1s linear infinite"}}>⟳</span>
          {exportLoading}
        </div>
      )}

      {/* ── Delete confirmation dialog ── */}
      {confirmDelete && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9998,
          display:"flex", alignItems:"center", justifyContent:"center"}}>
          <div style={{background:bg2, border:"1px solid "+border, borderRadius:"12px",
            padding:"1.5rem", maxWidth:"380px", width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{fontSize:"1rem", fontWeight:"700", color:text1, marginBottom:"0.5rem"}}>Delete Question?</div>
            <div style={{fontSize:"0.82rem", color:"#6b89b8", marginBottom:"1.25rem", lineHeight:1.5}}>
              This will permanently remove the question from your bank. This cannot be undone.
            </div>
            <div style={{display:"flex", gap:"0.75rem"}}>
              <button onClick={async () => {
                await deleteQuestion(confirmDelete.id);
                setBank(prev => prev.filter(q => q.id !== confirmDelete.id));
                setConfirmDelete(null);
                showToast("Question deleted");
              }} style={{flex:1, padding:"0.5rem", background:"#7c2d12", color:"#9B1C1C",
                border:"1px solid #f8717144", borderRadius:"6px", cursor:"pointer", fontWeight:"600", fontSize:"0.82rem"}}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(null)}
                style={{flex:1, padding:"0.5rem", background:"transparent", color:"#6b89b8",
                  border:"1px solid "+border, borderRadius:"6px", cursor:"pointer", fontSize:"0.82rem"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={S.main}>

        {/* ── DASHBOARD ── */}
        {screen === "home" && (
          <div>
            {/* Header */}
            <div style={{marginBottom:"2.5rem"}}>
              <h1 style={{...S.h1, fontSize:"2rem", marginBottom:"0.3rem"}}>Dashboard</h1>
              <p style={{...S.sub, fontSize:"0.85rem"}}>Welcome back — your exam authoring workspace.</p>
            </div>

            {/* Workflow strip — horizontal pill row */}
            <div style={{marginBottom:"2.5rem"}}>
              <div style={{fontSize:"0.6rem", color:text3, textTransform:"uppercase", letterSpacing:"0.18em", fontWeight:"700", marginBottom:"1rem", fontFamily:"'Inter',system-ui,sans-serif"}}>Your Workflow</div>
              <div style={{display:"flex", gap:"0.5rem", alignItems:"stretch"}}>
                {[
                  { step:"1", label:"Generate", sub:"Create with AI", sc:"generate", color:"#2D6A4F", icon:"✦" },
                  { step:"2", label:"Review", sub:"Check & save",    sc:"review",   color:"#92400E", icon:"◎", badge: lastGenerated.length || 0 },
                  { step:"3", label:"Build Exam", sub:"Select & version", sc:"versions", color:"#7C3AED", icon:"⊞" },
                  { step:"4", label:"Export",   sub:"Word · QTI · Print", sc:"export", color:"#185FA5", icon:"⬇" },
                ].map((s, i) => (
                  <div key={i} style={{display:"flex", alignItems:"center", flex:1, gap:"0.5rem"}}>
                    <div onClick={() => {
                      if (s.sc === "export") { setScreen("versions"); setExportHighlight(true); setTimeout(() => setExportHighlight(false), 2500); }
                      else setScreen(s.sc);
                    }} style={{
                      flex:1, padding:"1rem 1.1rem", borderRadius:"12px", cursor:"pointer",
                      background: (s.sc === "export" ? exportHighlight : screen===s.sc) ? s.color+"12" : bg1,
                      border:"1.5px solid "+((s.sc === "export" ? exportHighlight : screen===s.sc) ? s.color+"60" : border),
                      transition:"all 0.15s", display:"flex", alignItems:"center", gap:"0.75rem"
                    }}>
                      <div style={{width:"34px", height:"34px", borderRadius:"9px", background:s.color+"15",
                        border:"1px solid "+s.color+"30", display:"flex", alignItems:"center", justifyContent:"center",
                        flexShrink:0, position:"relative"}}>
                        <span style={{fontSize:"0.85rem", color:s.color}}>{s.icon}</span>
                        <div style={{position:"absolute", top:"-7px", right:"-7px", width:"16px", height:"16px",
                          borderRadius:"50%", background:s.color, display:"flex", alignItems:"center",
                          justifyContent:"center", fontSize:"0.55rem", fontWeight:"800", color:"#fff",
                          fontFamily:"'Inter',system-ui,sans-serif"}}>
                          {s.step}
                        </div>
                        {s.badge > 0 && (
                          <div style={{position:"absolute", top:"-7px", left:"-7px", width:"16px", height:"16px",
                            borderRadius:"50%", background:"#92400E", display:"flex", alignItems:"center",
                            justifyContent:"center", fontSize:"0.55rem", fontWeight:"800", color:"#fff",
                            fontFamily:"'Inter',system-ui,sans-serif"}}>
                            {s.badge}
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{fontSize:"0.82rem", fontWeight:"700", color:text1, fontFamily:"'Inter',system-ui,sans-serif"}}>{s.label}</div>
                        <div style={{fontSize:"0.65rem", color:text3, marginTop:"1px", fontFamily:"'Inter',system-ui,sans-serif"}}>{s.sub}</div>
                      </div>
                    </div>
                    {i < 3 && <div style={{color:text3, fontSize:"0.8rem", flexShrink:0}}>›</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Onboarding checklist — shown when bank is empty or user hasn't completed steps */}
            {bankLoaded && bank.length === 0 && (
              <div style={{...S.card, borderColor:"#2D6A4F44", marginBottom:"2rem", background:"#052e1608"}}>
                <div style={{fontSize:"0.78rem", fontWeight:"700", color:"#2D6A4F", marginBottom:"0.75rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>
                  🚀 Getting Started
                </div>
                {[
                  { done: course !== null, label:"Select a course", action:() => setScreen("generate"), btn:"Go to Generate" },
                  { done: bank.length > 0, label:"Generate your first questions", action:() => setScreen("generate"), btn:"Generate" },
                  { done: savedExams.length > 0, label:"Build and save an exam", action:() => setScreen("versions"), btn:"Build Exam" },
                ].map((step, i) => (
                  <div key={i} style={{display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.5rem"}}>
                    <div style={{width:"20px", height:"20px", borderRadius:"50%", flexShrink:0,
                      background: step.done ? "#2D6A4F" : bg2,
                      border: "1.5px solid " + (step.done ? "#2D6A4F" : border),
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"0.65rem", color:"#fff", fontWeight:"700"}}>
                      {step.done ? "✓" : i+1}
                    </div>
                    <span style={{fontSize:"0.82rem", color: step.done ? text3 : text1, flex:1,
                      textDecoration: step.done ? "line-through" : "none"}}>{step.label}</span>
                    {!step.done && (
                      <button onClick={step.action}
                        style={{fontSize:"0.72rem", padding:"0.2rem 0.65rem", background:"#2D6A4F",
                          color:"#fff", border:"none", borderRadius:"4px", cursor:"pointer", fontWeight:"600"}}>
                        {step.btn} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stats row — clean metric cards */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"2.5rem"}}>
              {[
                { label:"Questions in Bank", value:bank.length, color:"#2D6A4F", bg:"#D1FAE5", action:() => setScreen("bank") },
                { label:"Pending Review",    value:lastGenerated.length || 0, color:"#92400E", bg:"#FEF3C7", action:() => setScreen("review") },
                { label:"Issues Found",      value:bankIssueCount, color:bankIssueCount>0?"#9B1C1C":"#2D6A4F", bg:bankIssueCount>0?"#FEE2E2":"#D1FAE5", action:() => { setFilterIssuesOnly(bankIssueCount > 0); setScreen("bank"); } },
              ].map((s,i) => (
                <div key={i} onClick={s.action} style={{
                  background:bg1, border:"1px solid "+border, borderRadius:"14px",
                  padding:"1.5rem 1.5rem 1.25rem", cursor:"pointer", transition:"border-color 0.15s",
                  borderLeft:"4px solid "+s.color
                }}>
                  <div style={{fontSize:"2.2rem", fontWeight:"800", color:s.color, letterSpacing:"-0.04em",
                    fontFamily:"'Georgia',serif", lineHeight:1, marginBottom:"0.5rem"}}>{s.value}</div>
                  <div style={{fontSize:"0.72rem", color:text2, fontFamily:"'Inter',system-ui,sans-serif", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:"600"}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Courses */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"1.25rem"}}>
              <h2 style={S.h2}>Courses</h2>
              <button style={{...S.oBtn(accent), fontSize:"0.72rem", padding:"0.3rem 0.9rem"}} onClick={() => setScreen("generate")}>+ Generate Questions</button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:"0.85rem", marginBottom:"2.5rem"}}>
              {Object.entries(allCourses).map(([name, { color, chapters }]) => {
                const qCount = bank.filter(q => q.course === name).length;
                return (
                  <div key={name} onClick={() => { setCourse(name); setSelectedSections([]); setSectionCounts({}); setSectionConfig({}); setScreen("generate"); }}
                    style={{
                      background:bg1, borderRadius:"14px", padding:"1.25rem 1.25rem 1rem",
                      border:"1px solid "+border, cursor:"pointer",
                      borderBottom:"3px solid "+color, transition:"all 0.15s",
                      display:"flex", flexDirection:"column", gap:"0.3rem"
                    }}>
                    <div style={{fontSize:"0.88rem", fontWeight:"700", color:text1, lineHeight:1.3, fontFamily:"'Georgia',serif"}}>{name}</div>
                    <div style={{fontSize:"0.68rem", color:text3, fontFamily:"'Inter',system-ui,sans-serif"}}>{chapters.length} chapters</div>
                    {qCount > 0 && (
                      <div style={{marginTop:"0.5rem", display:"inline-flex", alignItems:"center", gap:"0.35rem",
                        background:color+"12", border:"1px solid "+color+"30", borderRadius:"20px",
                        padding:"0.15rem 0.6rem", width:"fit-content"}}>
                        <div style={{width:"5px", height:"5px", borderRadius:"50%", background:color, flexShrink:0}}/>
                        <span style={{fontSize:"0.65rem", color:color, fontWeight:"600", fontFamily:"'Inter',system-ui,sans-serif"}}>{qCount} questions</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom Course Builder */}
            <CustomCourseBuilder
              customCourses={customCourses}
              onSave={saveCustomCourse}
              onDelete={deleteCustomCourse}
              text1={text1} text2={text2} text3={text3} border={border} bg1={bg1} S={S}
              isAdmin={isAdmin}
            />

            {/* Recent questions */}
            {bank.length > 0 && (
              <div style={{marginTop:"2rem"}}>
                <h2 style={{...S.h2, marginBottom:"1rem"}}>Recent Questions</h2>
                <div style={{display:"flex", flexDirection:"column", gap:"0"}}>
                  {bank.slice(0,5).map((q,i) => (
                    <div key={i} style={{
                      display:"flex", alignItems:"center", gap:"1rem",
                      padding:"0.85rem 0",
                      borderBottom: i < 4 ? "1px solid "+border+"88" : "none",
                    }}>
                      <div style={{flexShrink:0, width:"32px", height:"32px", borderRadius:"8px",
                        background:(courseColors[q.course]||accent)+"18",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"0.65rem", color:courseColors[q.course]||accent, fontWeight:"800",
                        fontFamily:"'Inter',system-ui,sans-serif"}}>
                        {(q.section||"?").split(" ")[0]}
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:"flex", gap:"0.4rem", marginBottom:"0.2rem", flexWrap:"wrap"}}>
                          <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                          <span style={S.diffTag(q.difficulty||"")}>{q.difficulty}</span>
                        </div>
                        <div style={{fontSize:"0.82rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"'Georgia',serif"}}>
                          {q.type==="Branched" ? q.stem : q.question}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button style={{...S.oBtn(text2), fontSize:"0.75rem", marginTop:"1rem"}} onClick={() => setScreen("bank")}>
                  View all {bank.length} questions →
                </button>
              </div>
            )}
          </div>
        )}


        {/* GENERATE */}
        {screen === "generate" && (
          <div>
            <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
              <div>
                <h1 style={S.h1}>Generate Questions</h1>
                <p style={S.sub}>Select a course, pick sections, and copy the prompt to Claude.</p>
              </div>
              <button style={{...S.oBtn(text2), fontSize:"0.75rem", flexShrink:0}} onClick={() => setScreen("bank")}>Browse Bank →</button>
            </div>

            {/* Course picker */}
            <div style={S.card}>
              <div style={S.lbl}>Course</div>
              <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.5rem"}}>
                {Object.entries(allCourses).map(([name, { color }]) => (
                  <button key={name}
                    style={S.courseChip(color, course===name)}
                    onClick={() => { setCourse(name); setSelectedSections([]); setSectionCounts({}); setSectionConfig({}); }}>
                    <span style={S.courseDot(color)}/>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Section picker */}
            {course && (
              <div style={S.card}>
                <div style={S.lbl}>Sections ({selectedSections.length} selected · {totalQ} questions)</div>
                {chapters.map(chap => {
                  const allSel = chap.sections.every(s => selectedSections.includes(s));
                  return (
                    <div key={chap.ch} style={{marginBottom:"1rem"}}>
                      <button style={{...S.sBtn(allSel), marginBottom:"0.4rem", fontWeight:"bold"}} onClick={() => toggleChapter(chap)}>
                        <span style={S.chk(allSel)}>{allSel?"✓":""}</span>
                        Ch {chap.ch}: {chap.title}
                      </button>
                      <div style={{...S.sGrid, paddingLeft:"1rem"}}>
                        {chap.sections.map(sec => {
                          const sel = selectedSections.includes(sec);
                          return (
                            <div key={sec} style={{display:"flex", alignItems:"center", gap:"0.4rem"}}>
                              <button style={S.sBtn(sel)} onClick={() => toggleSection(sec)}>
                                <span style={S.chk(sel)}>{sel?"✓":""}</span>
                                {sec}
                              </button>
                              {(() => {
                                const existingCount = bank.filter(q => q.section === sec && q.course === course).length;
                                return existingCount > 0 && (
                                  <span title={`${existingCount} questions already in bank for this section`}
                                    style={{fontSize:"0.62rem", color:text3, background:bg2, border:"1px solid "+border, borderRadius:"3px", padding:"0.05rem 0.3rem"}}>
                                    {existingCount}q
                                  </span>
                                );
                              })()}
                              {sel && (() => {
                                const cfg = getSectionConfig(sec);
                                const diffColors = { Easy:"#10b981", Medium:"#f59e0b", Hard:"#f43f5e" };
                                const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
                                const types = isQM ? ["normal","table","graph","mix"] : ["normal","graph","mix"];
                                const typeLabels = { normal:"Text", table:"Table", graph:"Graph", mix:"Mix" };
                                const typeColors = { normal: border, table:"#185FA5", graph:"#1D9E75", mix:"#8b5cf6" };
                                return (
                                  <div style={{marginTop:"0.4rem", paddingLeft:"0.75rem", borderLeft:"2px solid #334155"}}>
                                    {["Easy","Medium","Hard"].map(d => {
                                      // total = sum of all type counts
                                      const typeCounts = cfg[d].typeCounts || {};
                                      const total = types.reduce((s,t) => s + (typeCounts[t]||0), 0);
                                      return (
                                        <div key={d} style={{marginBottom:"0.5rem"}}>
                                          {/* Header row: difficulty + total */}
                                          <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.25rem"}}>
                                            <span style={{fontSize:"0.68rem", color:diffColors[d], fontWeight:"600", minWidth:"46px"}}>{d}</span>
                                            <span style={{fontSize:"0.68rem", color:text2, background:bg2, border:"1px solid "+border, borderRadius:"4px", padding:"0.1rem 0.5rem", minWidth:"28px", textAlign:"center"}}>
                                              {total}
                                            </span>
                                            <span style={{fontSize:"0.6rem", color:text3}}>total</span>
                                          </div>
                                          {/* Type counts row */}
                                          <div style={{display:"flex", gap:"0.4rem", flexWrap:"wrap", alignItems:"flex-start", paddingLeft:"54px"}}>
                                            {types.map(t => {
                                              const count = typeCounts[t] || 0;
                                              const isTable = t === "table" || t === "mix";
                                              return (
                                                <div key={t} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"0.15rem"}}>
                                                  <span style={{fontSize:"0.6rem", color: count > 0 ? typeColors[t] : text3, fontWeight: count>0?"600":"400"}}>{typeLabels[t]}</span>
                                                  <input type="number" min={0} max={20} value={count}
                                                    onChange={e => {
                                                      const newVal = Math.max(0, Number(e.target.value)||0);
                                                      const newTypeCounts = { ...typeCounts, [t]: newVal };
                                                      const newTotal = types.reduce((s,tt) => s + (newTypeCounts[tt]||0), 0);
                                                      // dominant graphType = type with highest count (for prompt fallback)
                                                      const dominant = types.reduce((a,b) => (newTypeCounts[b]||0) > (newTypeCounts[a]||0) ? b : a, "normal");
                                                      setSectionDiff(sec, d, { typeCounts: newTypeCounts, count: newTotal, graphType: dominant });
                                                    }}
                                                    style={{width:"36px", ...S.input, padding:"0.1rem 0.25rem", fontSize:"0.75rem", textAlign:"center",
                                                      borderColor: count > 0 ? typeColors[t]+"88" : border}} />
                                                  {isTable && count > 0 && (
                                                    <div style={{display:"flex", flexDirection:"column", gap:"0.1rem", alignItems:"center"}}>
                                                      <div style={{display:"flex", alignItems:"center", gap:"0.15rem"}}>
                                                        <span style={{fontSize:"0.55rem", color:text3}}>rows</span>
                                                        <input type="number" min={2} max={20} value={cfg[d].tableRows||4}
                                                          onChange={e => setSectionDiff(sec, d, "tableRows", Math.max(2, Math.min(20, Number(e.target.value)||4)))}
                                                          style={{width:"30px", ...S.input, padding:"0.1rem 0.2rem", fontSize:"0.62rem", textAlign:"center"}} />
                                                      </div>
                                                      <div style={{display:"flex", alignItems:"center", gap:"0.15rem"}}>
                                                        <span style={{fontSize:"0.55rem", color:text3}}>cols</span>
                                                        <input type="number" min={2} max={8} value={cfg[d].tableCols||2}
                                                          onChange={e => setSectionDiff(sec, d, "tableCols", Math.max(2, Math.min(8, Number(e.target.value)||2)))}
                                                          style={{width:"30px", ...S.input, padding:"0.1rem 0.2rem", fontSize:"0.62rem", textAlign:"center"}} />
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Question Type */}
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.lbl}>Question Type</label>
                <select style={S.sel} value={qType} onChange={e => setQType(e.target.value)}>
                  {QTYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"center"}}>
              {generateConfirm ? (
                <div style={{display:"flex", alignItems:"center", gap:"0.75rem", background:bg1,
                  border:"1px solid "+border, borderRadius:"8px", padding:"0.6rem 1rem"}}>
                  <span style={{fontSize:"0.85rem", color:text1}}>
                    Generate {selectedSections.reduce((a,s) => a+(sectionCounts[s]||3), 0)} questions?
                  </span>
                  {(() => {
                    const qCount = selectedSections.reduce((a,s) => a+(sectionCounts[s]||3), 0);
                    const estTokens = Math.round(qCount * 350 + 1200);
                    const estCost = (estTokens / 1000000 * 15).toFixed(3);
                    return (
                      <span style={{fontSize:"0.72rem", color:text3}}>
                        ~{estTokens.toLocaleString()} tokens · ~${estCost}
                      </span>
                    );
                  })()}
                  <button style={S.btn(accent, false)} onClick={async () => {
                    setGenerateConfirm(false);
                    triggerGenerate();
                    const prompt = buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig);
                    await autoGenerate(prompt, (result) => {
                      setPasteInput(result);
                      setTimeout(() => { document.getElementById("auto-paste-trigger")?.click(); }, 100);
                    });
                  }}>Yes</button>
                  <button style={S.oBtn(text2)} onClick={() => setGenerateConfirm(false)}>Cancel</button>
                </div>
              ) : (
                <>
                  <button
                    style={S.btn(accent, !course || selectedSections.length === 0 || isGenerating)}
                    disabled={!course || selectedSections.length === 0 || isGenerating}
                    onClick={() => setGenerateConfirm(true)}
                  >
                    {isGenerating ? "⏳ Generating..." : "✦ Generate Questions"}
                  </button>
                  <button
                    style={{...S.oBtn(text2), fontSize:"0.75rem"}}
                    disabled={!course || selectedSections.length === 0}
                    onClick={triggerGenerate}
                  >
                    Manual (copy-paste)
                  </button>
                </>
              )}
            </div>

            {generateError && (
              <div style={{color:"#f87171", fontSize:"0.78rem", marginTop:"0.5rem"}}>{generateError}</div>
            )}

            {pendingType === "generate" && generatedPrompt && (
              <>
                <hr style={S.divider} />
                <div style={{fontSize:"0.78rem", color:accent, fontWeight:"bold", marginBottom:"0.5rem"}}>📋 Manual mode — copy prompt and paste response:</div>
                <div style={S.promptBox}>{generatedPrompt}</div>
                {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                  Copy Prompt
                </button>}
                <button id="auto-paste-trigger" style={{display:"none"}} onClick={handlePaste} />
                <PastePanel
                  label="Paste the JSON array from Claude's response below."
                  S={S} text2={text2}
                  pasteInput={pasteInput} setPasteInput={setPasteInput}
                  pasteError={pasteError} handlePaste={handlePaste}
                  onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                />
              </>
            )}
          </div>
        )}

        {/* REVIEW */}
        {screen === "review" && (
          <div>
            <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
              <div>
                <h1 style={S.h1}>Review Generated Questions</h1>
                <p style={S.sub}>{lastGenerated.length} questions generated and saved to your bank.</p>
              </div>
              <div style={{display:"flex", gap:"0.5rem", flexShrink:0}}>
                <button style={{...S.oBtn(text2), fontSize:"0.75rem"}} onClick={() => setScreen("generate")}>← Generate More</button>
                <button style={{...S.oBtn(accent), fontSize:"0.75rem"}} onClick={() => setScreen("bank")}>Browse Bank →</button>
                <button style={{...S.btn("#8b5cf6", false), fontSize:"0.75rem"}} onClick={() => setScreen("versions")}>Build Exam →</button>
              </div>
            </div>
            {lastGenerated.length === 0 && (
              <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
                <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>✨</div>
                <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>No questions to review</div>
                <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
                  Generate questions first, then paste the JSON here to review them before saving to your bank.
                </div>
                <button style={S.btn(accent, false)} onClick={() => setScreen("generate")}>✦ Generate Questions</button>
              </div>
            )}
            {dupWarnings.length > 0 && (
              <div style={{...S.card, borderColor:"#f59e0b44", background:"#f59e0b08", marginBottom:"1rem"}}>
                <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"600", marginBottom:"0.4rem"}}>⚠ Possible duplicates detected (same section)</div>
                {dupWarnings.map((w,i) => (
                  <div key={i} style={{fontSize:"0.72rem", color:text2, marginBottom:"0.2rem"}}>• {w}</div>
                ))}
                <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.4rem"}}>These questions were still saved — review and delete if needed.</div>
              </div>
            )}
            {lastGenerated.map((q, qi) => (
              <div key={q.id || qi} style={S.qCard}>
                {(() => { const issues = validateQuestion(q); return (
                <div style={S.qMeta}>
                  <span>Q{qi+1}</span>
                  <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                  <span style={S.tag()}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                  {issues.length > 0 && (
                    <span title={issues.join("\n")} style={{marginLeft:"auto", cursor:"help",
                      background:"#7c2d12", color:"#9B1C1C", fontSize:"0.68rem", fontWeight:"600",
                      padding:"0.1rem 0.4rem", borderRadius:"4px", whiteSpace:"nowrap"}}>
                      ⚠️ {issues.length} issue{issues.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                ); })()}
                {q.hasGraph && q.graphConfig && (
                  <GraphDisplay graphConfig={q.graphConfig} authorMode={true} />
                )}
                {q.type === "Branched" ? (
                  <>
                    <div style={{...S.qText, color:accent+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                    {(q.parts||[]).map((p,pi) => (
                      <div key={pi} style={{marginBottom:"0.6rem", paddingLeft:"0.75rem", borderLeft:"2px solid "+border}}>
                        <div style={{fontSize:"0.7rem", color:text3, marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                        <div style={S.qText}><MathText>{p.question}</MathText></div>
                        {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                        {p.explanation && <div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                    {q.choices && <ul style={S.cList}>{q.choices.map((c,ci) => <li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                    {q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                    {q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* BANK */}
        {screen === "bank" && (
          <div>
            <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
              <div>
                <h1 style={S.h1}>Question Bank</h1>
                <p style={S.sub}>{bank.length} questions saved{bankIssueCount > 0 ? ` · ⚠️ ${bankIssueCount} with issues` : " · ✓ all valid"}.</p>
              </div>
              <div style={{display:"flex", gap:"0.5rem", flexShrink:0}}>
                <button style={{...S.ghostBtn(bankCompact ? accent : text3), fontSize:"0.75rem"}} onClick={() => setBankCompact(p => !p)}>
                  {bankCompact ? "≡ Compact" : "☰ Compact"}
                </button>
                {isAdmin && (
                  <button style={{...S.ghostBtn("#f59e0b"), fontSize:"0.75rem"}} onClick={async () => {
                    const frQs = bank.filter(q => (q.type === "Free Response" || q.type === "Short Answer") && q.explanation);
                    if (!frQs.length) { showToast("No Free Response explanations to clean."); return; }
                    if (!window.confirm(`Clean prose from explanations of ${frQs.length} Free Response questions? This rewrites their explanation field in Supabase.`)) return;
                    let cleaned = 0;
                    for (const q of frQs) {
                      const original = q.explanation;
                      const lines = mathStepsOnly(original);
                      const newExpl = lines.join("\n");
                      if (newExpl !== original) {
                        const updated = { ...q, explanation: newExpl };
                        await saveQuestion(updated);
                        setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                        cleaned++;
                      }
                    }
                    showToast(`Cleaned ${cleaned} explanation${cleaned !== 1 ? "s" : ""} ✓`);
                  }}>🧹 Clean Explanations</button>
                )}
                <button style={{...S.oBtn(text2), fontSize:"0.75rem"}} onClick={() => setScreen("generate")}>+ Generate More</button>
                <button style={{...S.btn("#8b5cf6", false), fontSize:"0.75rem"}} onClick={() => setScreen("versions")}>Build Exam →</button>
              </div>
            </div>

            {/* Tab switcher */}
            <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.5rem", borderBottom:"1px solid "+border, paddingBottom:"0"}}>
              {[{id:"browse",label:"Browse Questions"},{id:"history",label:"Generation History"}].map(tab => (
                <button key={tab.id}
                  style={{
                    background:"transparent", border:"none", color: bankTabState===tab.id ? accent : text2,
                    fontSize:"0.85rem", fontWeight: bankTabState===tab.id ? "600" : "400",
                    padding:"0.5rem 0.25rem", cursor:"pointer",
                    borderBottom: "2px solid "+(bankTabState===tab.id ? accent : "transparent"),
                    marginBottom:"-1px", fontFamily:"'Inter',system-ui,sans-serif"
                  }}
                  onClick={() => setBankTabState(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── BROWSE TAB ── */}
            {bankTabState === "browse" && (<>

            {/* Bulk select toolbar */}
            <div style={{display:"flex", gap:"0.5rem", alignItems:"center", marginBottom:"0.75rem", flexWrap:"wrap"}}>
              <button style={S.ghostBtn(bankSelectMode ? "#f87171" : text2)}
                onClick={() => { setBankSelectMode(!bankSelectMode); setBankSelected(new Set()); }}>
                {bankSelectMode ? `✕ Cancel Select (${bankSelected.size} selected)` : "☑ Select to Delete"}
              </button>
              {isAdmin && !bankSelectMode && (
                <button style={S.ghostBtn("#8b5cf6")} onClick={async () => {
                  const graphQs = bank.filter(q => q.hasGraph && q.graphConfig && (q.graphConfig.title || q.graphConfig.probability));
                  if (graphQs.length === 0) { showToast("No titles/labels to clean up ✓"); return; }
                  if (!window.confirm(`Strip title and probability labels from ${graphQs.length} graph question(s)? This makes them cleaner in Canvas.`)) return;
                  let cleaned = 0;
                  for (const q of graphQs) {
                    const { title, probability, ...cleanConfig } = q.graphConfig;
                    const updated = { ...q, graphConfig: cleanConfig };
                    await saveQuestion(updated);
                    setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                    cleaned++;
                  }
                  showToast(`✓ Cleaned ${cleaned} graph question${cleaned>1?"s":""}`);
                }}>🧹 Clean graph titles</button>
              )}
              {bankSelectMode && bankSelected.size > 0 && (
                <>
                  <button style={S.ghostBtn("#f87171")} onClick={async () => {
                    if (!window.confirm(`Delete ${bankSelected.size} questions? This cannot be undone.`)) return;
                    for (const id of bankSelected) await deleteQuestion(id);
                    setBank(prev => prev.filter(q => !bankSelected.has(q.id)));
                    setBankSelected(new Set()); setBankSelectMode(false);
                  }}>🗑 Delete {bankSelected.size} questions</button>
                  <button style={S.ghostBtn("#10b981")} onClick={() => {
                    const selectedQs = bank.filter(q => bankSelected.has(q.id));
                    if (!selectedQs.length) return;
                    const secCfg = {};
                    selectedQs.forEach(q => {
                      const sec = q.section || "Unknown";
                      if (!secCfg[sec]) secCfg[sec] = { Easy:{count:0,graphType:"normal"}, Medium:{count:0,graphType:"normal"}, Hard:{count:0,graphType:"normal"} };
                      const diff = q.difficulty || "Medium";
                      if (secCfg[sec][diff]) secCfg[sec][diff].count++;
                      if (q.hasGraph) secCfg[sec][diff].graphType = "graph";
                    });
                    const sections = Object.keys(secCfg);
                    const qType = selectedQs[0].type || "Multiple Choice";
                    const prompt = buildGeneratePrompt(course, sections, {}, qType, null, secCfg);
                    setBulkReplacePrompt(prompt);
                    setBulkReplaceIds(new Set(bankSelected));
                    setBulkReplacePaste(""); setBulkReplaceError("");
                  }}>🔄 Replace {bankSelected.size} with new</button>
                  <button style={S.ghostBtn(text2)} onClick={() => {
                    const ids = new Set(filteredBank.map(q => q.id));
                    setBankSelected(ids);
                  }}>Select all {filteredBank.length} shown</button>
                </>
              )}
            </div>

            {/* Bulk replace prompt + paste panel */}
            {bulkReplacePrompt && (
              <div style={{background:bg2, border:"1px solid #10b98144", borderRadius:"10px", padding:"1rem", marginBottom:"1rem"}}>
                <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"600", marginBottom:"0.5rem"}}>
                  🔄 Replace {bulkReplaceIds.size} questions — copy prompt to Claude, paste response back:
                </div>
                <div style={{...S.promptBox, maxHeight:"140px"}}>{bulkReplacePrompt}</div>
                <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                  <button style={{...S.oBtn("#10b981"), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                    onClick={() => navigator.clipboard.writeText(bulkReplacePrompt)}>📋 Copy Prompt</button>
                  {isAdmin && <button style={{...S.btn("#10b981", autoGenLoading), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                    disabled={autoGenLoading}
                    onClick={async () => {
                      setAutoGenLoading(true); setAutoGenError("");
                      try {
                        const res = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt:bulkReplacePrompt}) });
                        if (!res.ok) throw new Error(`API error: ${res.status}`);
                        const data = await res.json();
                        const text = data.content?.[0]?.text || data.text || "";
                        if (!text) throw new Error("Empty response.");
                        setBulkReplacePaste(text);
                      } catch(e) { setBulkReplaceError(e.message); }
                      finally { setAutoGenLoading(false); }
                    }}>{autoGenLoading ? "⏳ Generating..." : "⚡ Auto-Generate"}</button>}
                  <button style={{...S.ghostBtn(text3), fontSize:"0.68rem"}}
                    onClick={() => { setBulkReplacePrompt(""); setBulkReplaceIds(new Set()); setBulkReplacePaste(""); setBulkReplaceError(""); }}>Cancel</button>
                </div>
                {bulkReplaceError && <div style={{color:"#f87171", fontSize:"0.75rem", marginBottom:"0.5rem"}}>{bulkReplaceError}</div>}
                <textarea
                  value={bulkReplacePaste}
                  onChange={e => setBulkReplacePaste(e.target.value)}
                  placeholder="Paste Claude's JSON response here..."
                  style={{...S.textarea, minHeight:"80px", marginBottom:"0.5rem"}}
                />
                <button style={S.btn("#10b981", !bulkReplacePaste.trim())} disabled={!bulkReplacePaste.trim()}
                  onClick={async () => {
                    setBulkReplaceError("");
                    try {
                      const match = bulkReplacePaste.match(/\[[\s\S]*\]/);
                      if (!match) throw new Error("No JSON array found. Copy the full response.");
                      const parsed = JSON.parse(match[0]);
                      const sanitize = (q) => ({ ...q, type:q.type||"Multiple Choice", difficulty:q.difficulty||"Medium", question:q.question||"", answer:q.answer||"", choices:(q.choices||[]).map(c=>c??""), explanation:q.explanation||"" });
                      const tagged = parsed.map(q => ({ ...sanitize(q), id:uid(), course, createdAt:Date.now() }));
                      // Delete old questions
                      for (const id of bulkReplaceIds) await deleteQuestion(id);
                      setBank(prev => prev.filter(q => !bulkReplaceIds.has(q.id)));
                      // Save new questions
                      for (const q of tagged) await saveQuestion(q);
                      setBank(prev => [...tagged, ...prev]);
                      setFilterTime("All"); setFilterDay("All");
                      setBankSelected(new Set()); setBankSelectMode(false);
                      setBulkReplacePrompt(""); setBulkReplaceIds(new Set()); setBulkReplacePaste("");
                      showToast(`✓ ${tagged.length} questions replaced successfully`, "success");
                    } catch(e) { setBulkReplaceError(e.message || "Failed to parse response."); }
                  }}>✓ Submit Replacement</button>
              </div>
            )}

            <div style={{marginBottom:"0.75rem"}}>
              <input
                value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                placeholder="🔍  Search questions, answers, sections..."
                style={{width:"100%", padding:"0.5rem 0.75rem", background:bg2,
                  border:"1px solid "+border, color:text1, borderRadius:"8px",
                  fontSize:"0.83rem", boxSizing:"border-box", outline:"none"}}
              />
            </div>
            <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
              <select style={{...S.sel, width:"155px"}} value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSection("All"); }}>
                <option>All</option>{Object.keys(allCourses).map(c => <option key={c}>{c}</option>)}
              </select>
              {filterCourse !== "All" && (
                <select style={{...S.sel, width:"220px"}} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select style={{...S.sel, width:"145px"}} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option>All</option>{QTYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={{...S.sel, width:"130px"}} value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                <option>All</option>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
              <select style={{...S.sel, width:"175px"}} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth("All"); setFilterDay("All"); setFilterTime("All"); }}>
                <option value="All">All Years</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {filterYear !== "All" && (
                <select style={{...S.sel, width:"145px"}} value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDay("All"); setFilterTime("All"); }}>
                  <option value="All">All Months</option>
                  {availableMonths.map(m => <option key={m} value={m}>{MONTHS[parseInt(m)]}</option>)}
                </select>
              )}
              {filterYear !== "All" && filterMonth !== "All" && (
                <select style={{...S.sel, width:"120px"}} value={filterDay} onChange={e => { setFilterDay(e.target.value); setFilterTime("All"); }}>
                  <option value="All">All Days</option>
                  {availableDays.map(d => <option key={d} value={d}>Day {d}</option>)}
                </select>
              )}
              {filterYear !== "All" && filterMonth !== "All" && filterDay !== "All" && (
                <select style={{...S.sel, width:"130px"}} value={filterTime} onChange={e => setFilterTime(e.target.value)}>
                  <option value="All">All Times</option>
                  {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <span style={{fontSize:"0.78rem", color:text2, alignSelf:"center"}}>{filteredBank.length} matching</span>
              {selectedForExam.length > 0 && (
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:"0.3rem",
                  fontSize:"0.75rem", fontWeight:"700", color:"#fff",
                  background:"#e11d48", borderRadius:"999px",
                  padding:"0.18rem 0.65rem", alignSelf:"center",
                  boxShadow:"0 1px 4px "+accent+"55"
                }}>
                  ✓ {selectedForExam.length} selected for exam
                  <span
                    title="Clear selection"
                    onClick={() => setSelectedForExam([])}
                    style={{cursor:"pointer", marginLeft:"2px", opacity:0.75, fontWeight:"400", fontSize:"0.72rem"}}>✕</span>
                </span>
              )}
              {bankIssueCount > 0 && (
                <button
                  style={{...S.ghostBtn(filterIssuesOnly ? "#f87171" : text3), alignSelf:"center", border: filterIssuesOnly ? "1px solid #f8717144" : "1px solid "+border}}
                  onClick={() => setFilterIssuesOnly(p => !p)}>
                  {filterIssuesOnly ? "⚠ Issues only ✕" : `⚠ Show ${bankIssueCount} with issues`}
                </button>
              )}
              {bankDupCount > 0 && (
                <span style={{fontSize:"0.72rem", color:"#f59e0b", alignSelf:"center", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.18rem 0.5rem"}}>
                  ⚠ {bankDupCount} possible duplicate{bankDupCount>1?"s":""}
                </span>
              )}
            </div>

            {!bankLoaded && <div style={{color:text2}}>Loading from database…</div>}
            {bankLoaded && bank.length === 0 && (
              <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
                <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>📭</div>
                <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>Your bank is empty</div>
                <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
                  Generate your first questions to get started.<br/>
                  Choose a course, pick sections, and copy the prompt to Claude.
                </div>
                <button style={S.btn(accent, false)} onClick={() => setScreen("generate")}>
                  ✦ Generate Questions
                </button>
              </div>
            )}
            {bankLoaded && bank.length > 0 && filteredBank.length === 0 && (
              <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
                {bank.length === 0 ? "No questions yet. Go to Generate." : "No questions match filters."}
              </div>
            )}

            {bankCompact ? (
              <div style={{border:"1px solid "+border, borderRadius:"10px", overflow:"hidden"}}>
                {filteredBank.map((q, qi) => {
                  const inExam = selectedForExam.includes(q.id);
                  const used = usedInExams[q.id] || 0;
                  const issues = validateQuestion(q);
                  return (
                    <div key={q.id} style={{
                      display:"flex", alignItems:"center", gap:"0.6rem",
                      padding:"0.45rem 0.75rem",
                      borderBottom: qi < filteredBank.length-1 ? "1px solid "+border+"55" : "none",
                      background: inExam ? "#fff1f2" : qi%2===0 ? "transparent" : "#ffffff04",
                      borderLeft: inExam ? "4px solid #e11d48" : "4px solid transparent",
                    }}>
                      <span style={{...S.diffTag(q.difficulty||""), flexShrink:0, fontSize:"0.58rem", padding:"0.05rem 0.3rem"}}>{(q.difficulty||"?")[0]}</span>
                      <span style={{fontSize:"0.68rem", color:text3, flexShrink:0, minWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{(q.section||"").split(" ").slice(0,3).join(" ")}</span>
                      <span style={{flex:1, fontSize:"0.8rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {q.type==="Branched" ? q.stem : q.question}
                      </span>
                      {used > 0 && <span style={{fontSize:"0.62rem", color:"#06b6d4", flexShrink:0}}>📋×{used}</span>}
                      {issues.length > 0 && <span style={{fontSize:"0.62rem", color:"#f87171", flexShrink:0}}>⚠</span>}
                      <button style={{...S.smBtn, flexShrink:0, color:inExam?"#e11d48":text3, border:"1px solid "+(inExam?"#e11d4844":border)}}
                        onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id=>id!==q.id) : [...p,q.id])}>
                        {inExam?"✓":"+"}</button>
                      <button style={{...S.smBtn, flexShrink:0, color:"#7C3AED", border:"1px solid #a78bfa33"}}
                        onClick={() => { setInlineEditQId(inlineEditQId===q.id?null:q.id); setGraphEditorQId(null); }}>✏</button>
                      <button style={{...S.smBtn, flexShrink:0, color:"#f87171", border:"1px solid #f8717133"}}
                        onClick={() => setConfirmDelete({id:q.id, label:(q.question||q.stem||"").slice(0,60)})}>✕</button>
                    </div>
                  );
                })}
              </div>
            ) : filteredBank.map(q => {
              const inExam = selectedForExam.includes(q.id);
              return (
              <div key={q.id} style={{
                ...S.qCard,
                borderColor: inExam ? "#e11d48" : border,
                borderLeftWidth: inExam ? "4px" : "1px",
                background: inExam ? "#fff1f2" : bg1,
                boxShadow: inExam ? "0 0 0 1px #e11d4833, 0 2px 8px #e11d4822" : S.qCard.boxShadow,
              }}>
                <div style={S.qMeta}>
                  <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                  <span style={S.tag()}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                  {usedInExams[q.id] > 0 && (
                    <span title={`Used in ${usedInExams[q.id]} saved exam${usedInExams[q.id]>1?"s":""}`}
                      style={{...S.tag(), background:"#06b6d415", color:"#06b6d4", border:"1px solid #06b6d433"}}>
                      📋 ×{usedInExams[q.id]}
                    </span>
                  )}
                  {duplicateIds.has(q.id) && (
                    <span title="Possible duplicate — similar question exists in same section"
                      style={{...S.tag(), background:"#f59e0b15", color:"#f59e0b", border:"1px solid #f59e0b44"}}>
                      ⚠ dup
                    </span>
                  )}
                  {bankSelectMode && (
                    <input type="checkbox" checked={bankSelected.has(q.id)}
                      onChange={e => { const s = new Set(bankSelected); e.target.checked ? s.add(q.id) : s.delete(q.id); setBankSelected(s); }}
                      style={{accentColor:"#f87171", width:"15px", height:"15px", marginLeft:"auto", cursor:"pointer"}} />
                  )}
                  {!bankSelectMode && (
                    <button style={{...S.smBtn, marginLeft:"auto", color:"#f87171", border:"1px solid #f8717144"}}
                      onClick={() => setConfirmDelete({id: q.id, label: (q.question||q.stem||"").slice(0,60)})}>
                      ✕
                    </button>
                  )}
                  <button style={{...S.smBtn, color:"#f59e0b", border:"1px solid #f59e0b44"}}
                    onClick={() => {
                      const prompt = buildReplacePrompt(q, "numbers");
                      setGeneratedPrompt(prompt);
                      setPendingType("bank_replace"); setPendingMeta({qId: q.id}); setPasteInput(""); setPasteError("");
                    }}>↻</button>
                  <button style={{...S.smBtn, color:"#185FA5", border:"1px solid #60a5fa44"}}
                    onClick={() => { setGraphEditorQId(graphEditorQId === q.id ? null : q.id); setInlineEditQId(null); }}>
                    📈{q.hasGraph ? " Edit" : " Graph"}
                  </button>
                  <button style={{...S.smBtn, color: inlineEditQId===q.id ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                    onClick={() => { setInlineEditQId(inlineEditQId===q.id ? null : q.id); setGraphEditorQId(null); }}>
                    ✏️ Edit
                  </button>
                  <button style={{...S.smBtn, color:inExam?"#e11d48":text2, border:"1px solid "+(inExam?"#e11d4844":border)}}
                    onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id => id !== q.id) : [...p, q.id])}>
                    {inExam ? "✓ In exam" : "+ Exam"}
                  </button>
                </div>

                {q.hasGraph && q.graphConfig && graphEditorQId !== q.id && (
                  <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
                )}
                {graphEditorQId === q.id && (
                  <GraphEditor
                    initialConfig={q.graphConfig || null}
                    onSave={async (cfg) => {
                      const updated = { ...q, hasGraph: true, graphConfig: cfg };
                      await saveQuestion(updated);
                      setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                      setGraphEditorQId(null);
                      showToast("Graph saved ✓");
                    }}
                    onRemove={async () => {
                      const updated = { ...q, hasGraph: false, graphConfig: null };
                      await saveQuestion(updated);
                      setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                      setGraphEditorQId(null);
                    }}
                    onClose={() => setGraphEditorQId(null)}
                  />
                )}
                {inlineEditQId === q.id && (
                  <InlineEditor
                    q={q}
                    onSave={async (updated) => {
                      await saveQuestion(updated);
                      setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                      setInlineEditQId(null);
                      showToast("Question saved ✓");
                    }}
                    onClose={() => setInlineEditQId(null)}
                  />
                )}
                {q.type === "Branched" ? (
                  <>
                    <div style={{...S.qText, color:accent+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                    {(q.parts||[]).map((p,pi) => (
                      <div key={pi} style={{marginBottom:"0.5rem", paddingLeft:"0.75rem", borderLeft:"2px solid "+border}}>
                        <div style={{fontSize:"0.7rem", color:text3, marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                        <div style={{...S.qText, marginBottom:"0.2rem"}}><MathText>{p.question}</MathText></div>
                        {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                    {q.choices && <ul style={S.cList}>{q.choices.map((c,ci) => <li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                    {q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                    {q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
                  </>
                )}

                {/* Inline bank replace panel */}
                {pendingType === "bank_replace" && pendingMeta?.qId === q.id && generatedPrompt && (
                  <div style={{marginTop:"0.75rem", borderTop:"1px solid #f59e0b33", paddingTop:"0.75rem"}}>
                    <div style={{fontSize:"0.72rem", color:"#f59e0b", fontWeight:"600", marginBottom:"0.4rem"}}>
                      ↻ Replace this question — copy prompt to Claude, paste response back:
                    </div>
                    <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.35rem", flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.65rem", color:text3, alignSelf:"center"}}>Regenerate:</span>
                      <button style={S.ghostBtn("#f59e0b")} onClick={() => { const p = buildReplacePrompt(q,"numbers"); setGeneratedPrompt(p); }}>Same type</button>
                      <button style={S.ghostBtn("#e879f9")} onClick={() => { const p = buildReplacePrompt(q,"function"); setGeneratedPrompt(p); }}>Diff. function</button>
                    </div>
                    {(q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II" || q.hasGraph) && (
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap", paddingTop:"0.35rem", borderTop:"1px solid "+border}}>
                        <span style={{fontSize:"0.65rem", color:text3, alignSelf:"center"}}>Convert to:</span>
                        {!q.hasGraph && (
                          <button style={S.ghostBtn("#10b981")} onClick={() => { const p = buildConvertPrompt(q,"graph"); setGeneratedPrompt(p); }}>📈 Graph</button>
                        )}
                        {q.hasGraph && (
                          <button style={S.ghostBtn("#94a3b8")} onClick={() => { const p = buildConvertPrompt(q,"text"); setGeneratedPrompt(p); }}>📝 Text only</button>
                        )}
                        {(q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II") && (<>
                          {!q.hasGraph && <button style={S.ghostBtn("#185FA5")} onClick={() => { const p = buildConvertPrompt(q,"table"); setGeneratedPrompt(p); }}>📊 Table</button>}
                          {q.hasGraph && <button style={S.ghostBtn("#185FA5")} onClick={() => { const p = buildConvertPrompt(q,"table"); setGeneratedPrompt(p); }}>📊 Table</button>}
                        </>)}
                      </div>
                    )}
                    <div style={{display:"flex", justifyContent:"flex-end"}}>
                      <button style={{...S.ghostBtn(text3), fontSize:"0.68rem"}} onClick={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}>Cancel</button>
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    {isAdmin && <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap"}}>
                      <button style={{...S.oBtn("#f59e0b"), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                        onClick={() => navigator.clipboard.writeText(generatedPrompt)}>📋 Copy Prompt</button>
                      <button style={{...S.btn("#10b981", autoGenLoading), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                        disabled={autoGenLoading}
                        onClick={() => autoGenerateVersions(generatedPrompt, "bank_replace", pendingMeta)}>
                        {autoGenLoading ? "⏳ Generating..." : "⚡ Auto-Generate"}
                      </button>
                    </div>}
                    <PastePanel
                      label="Paste the replacement question JSON here."
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError}
                      handlePaste={async () => {
                        setPasteError("");
                        try {
                          const raw = pasteInput.trim();
                          const match = raw.match(/\[[\s\S]*\]/);
                          if (!match) throw new Error("No JSON array found.");
                          const parsed = JSON.parse(match[0]);
                          const newQ = { ...parsed[0], id: q.id, course: q.course, section: q.section, createdAt: Date.now() };
                          await saveQuestion(newQ);
                          setBank(prev => prev.map(bq => bq.id === q.id ? newQ : bq));
                          setPendingType(null); setPasteInput(""); setGeneratedPrompt("");
                        } catch(e) { setPasteError("Error: " + e.message); }
                      }}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </div>
                )}

                {/* Inline mutation selector — only shown when question is selected for exam */}
                {inExam && (
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginTop:"0.6rem", paddingTop:"0.6rem", borderTop:"1px solid "+accent+"33"}}>
                    <span style={{fontSize:"0.68rem", color:accent, fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase"}}>Mutation:</span>
                    <button
                      style={{...S.smBtn, background:(mutationType[q.id]||"numbers")==="numbers"?accent+"22":"transparent", color:(mutationType[q.id]||"numbers")==="numbers"?accent:text2, border:"1px solid "+((mutationType[q.id]||"numbers")==="numbers"?accent+"66":border)}}
                      onClick={() => setMutationType(p => ({...p,[q.id]:"numbers"}))}>
                      numbers
                    </button>
                    <button
                      style={{...S.smBtn, background:mutationType[q.id]==="function"?"#8b5cf622":"transparent", color:mutationType[q.id]==="function"?"#8b5cf6":text2, border:"1px solid "+(mutationType[q.id]==="function"?"#8b5cf666":border)}}
                      onClick={() => setMutationType(p => ({...p,[q.id]:"function"}))}>
                      function
                    </button>
                  </div>
                )}
              </div>
              );
            })}
            {/* end bankCompact ternary */}

            {selectedForExam.length > 0 && (
              <div style={{...S.card, borderColor:accent+"44", marginTop:"1.5rem"}}>
                <div style={{display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap", marginBottom:"0.75rem"}}>
                  <span style={{fontSize:"0.78rem", color:accent, fontWeight:"bold"}}>
                    {selectedForExam.length} question{selectedForExam.length!==1?"s":""} selected
                  </span>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"0.72rem", color:text2}}>Versions per class:</span>
                    <select style={{...S.sel, width:"130px", padding:"0.4rem 0.6rem"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} version{n>1?"s":""}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"0.72rem", color:text2}}>Classroom sections:</span>
                    <input
                      type="number" min={1} max={10} value={numClassSections}
                      onChange={e => setNumClassSections(Math.max(1, parseInt(e.target.value)||1))}
                      style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}}
                    />
                  </div>
                </div>

                {/* Per-section build buttons */}
                <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.5rem"}}>
                  <button style={S.btn(accent, false)} onClick={() => triggerVersions()}>
                    ✦ {numClassSections > 1 ? `Build All ${numClassSections} Sections (1 prompt)` : "Build Versions"}
                  </button>
                  {Object.keys(classSectionVersions).length > 0 && (
                    <button style={{...S.oBtn("#10b981")}} onClick={() => setScreen("versions")}>
                      📋 View Versions
                    </button>
                  )}
                </div>
                <div style={{fontSize:"0.68rem", color:text3}}>
                  {numClassSections > 1
                    ? "Section 1: numbers mutation (same time). Section 2+: function mutation (different time)."
                    : "Tip: set numbers/function mutation on each question card above ↑"}
                </div>

                {/* Prompt + paste panel — appears after Build is clicked */}
                {(pendingType === "version_all" || pendingType === "version_all_sections") && generatedPrompt && (
                  <div style={{marginTop:"1rem"}}>
                    <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                      📋 {pendingType === "version_all_sections"
                        ? `Copy this prompt — generates ALL ${pendingMeta?.numClassSections} sections × ${pendingMeta?.labels?.join(", ")} versions in one go:`
                        : `Copy this prompt — generates ${pendingMeta?.labels?.join(", ")} versions:`}
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                      <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                        disabled={autoGenLoading}
                        onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                        {autoGenLoading ? "⏳ Generating..." : "⚡ Generate Versions"}
                      </button>
                      {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                        Copy Prompt
                      </button>}
                    </div>
                    {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                    <PastePanel
                      label={pendingType === "version_all_sections"
                        ? `Paste the JSON object with all section+version keys ({"S1_A":[...], "S1_B":[...], "S2_A":[...], ...}) here.`
                        : `Paste the JSON object with all versions ({"A":[...], "B":[...], ...}) here.`}
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError} handlePaste={handlePaste}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </div>
                )}
              </div>
            )}
            </>)}

            {/* ── HISTORY TAB ── */}
            {bankTabState === "history" && (() => {
              // Group questions by date batch (same createdAt minute = same batch)
              const batches = [];
              const seen = new Set();
              [...bank].sort((a,b) => b.createdAt - a.createdAt).forEach(q => {
                const minute = Math.floor((q.createdAt||0) / 60000);
                const key = `${q.course}__${minute}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  batches.push({
                    key,
                    course: q.course,
                    minute,
                    createdAt: q.createdAt,
                    questions: bank.filter(bq => {
                      const bMinute = Math.floor((bq.createdAt||0) / 60000);
                      return bq.course === q.course && bMinute === minute;
                    })
                  });
                }
              });

              if (batches.length === 0) return (
                <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
                  No generation history yet. Generate questions to see batches here.
                </div>
              );

              return (
                <div>
                  {batches.map((batch, bi) => {
                    const color = courseColors[batch.course] || accent;
                    const sections = [...new Set(batch.questions.map(q => q.section).filter(Boolean))];
                    const date = new Date(batch.createdAt);
                    const dateStr = date.toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
                    const timeStr = date.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"});
                    const expanded = expandedBatches[batch.key] || false;
                    const toggleExpand = () => setExpandedBatches(prev => ({...prev, [batch.key]: !prev[batch.key]}));
                    return (
                      <div key={batch.key} style={{...S.card, borderLeft:`3px solid ${color}`, marginBottom:"0.75rem"}}>
                        <div style={{display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem"}}>
                              <div style={{width:"8px", height:"8px", borderRadius:"50%", background:color, flexShrink:0}}/>
                              <span style={{fontSize:"0.85rem", fontWeight:"600", color:text1}}>{batch.course}</span>
                              <span style={S.tag(color)}>{batch.questions.length} questions</span>
                            </div>
                            <div style={{fontSize:"0.72rem", color:text2, marginBottom:"0.25rem"}}>
                              {dateStr} · {timeStr}
                            </div>
                            <div style={{fontSize:"0.7rem", color:text3}}>
                              {sections.slice(0,4).join(" · ")}{sections.length > 4 ? ` +${sections.length-4} more` : ""}
                            </div>
                          </div>
                          <div style={{display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap"}}>
                            <button style={S.ghostBtn(color)}
                              onClick={() => toggleExpand()}>
                              {expanded ? "▲ Hide" : "▼ Show"} questions
                            </button>
                            <button style={S.ghostBtn(text2)}
                              onClick={() => {
                                setSelectedForExam(prev => {
                                  const ids = batch.questions.map(q => q.id);
                                  const allIn = ids.every(id => prev.includes(id));
                                  return allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])];
                                });
                                setScreen("versions");
                              }}>
                              + Add to Exam
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div style={{marginTop:"0.75rem", borderTop:"1px solid "+border, paddingTop:"0.75rem"}}>
                            {batch.questions.map((q, qi) => (
                              <div key={q.id} style={{padding:"0.4rem 0", borderBottom: qi < batch.questions.length-1 ? "1px solid "+border+"44" : "none", display:"flex", gap:"0.5rem", alignItems:"flex-start"}}>
                                <span style={{...S.diffTag(q.difficulty), flexShrink:0, marginTop:"0.1rem"}}>{(q.difficulty||"?")[0]}</span>
                                <div style={{flex:1, minWidth:0}}>
                                  <div style={{fontSize:"0.75rem", color:text2, marginBottom:"0.1rem"}}>{q.section}</div>
                                  <div style={{fontSize:"0.82rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                                    {q.type==="Branched" ? q.stem : q.question}
                                  </div>
                                </div>
                                <span style={{...S.tag(), flexShrink:0}}>{(q.type||"").split(" ")[0]}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* VERSIONS */}
        {screen === "versions" && (
          <div>
            <div style={S.pageHeader}>
              <h1 style={S.h1}>Exam Builder</h1>
              <p style={S.sub}>{versions.length} version{versions.length !== 1 ? "s" : ""} created{Object.keys(classSectionVersions).length > 1 ? ` · ${Object.keys(classSectionVersions).length} classroom sections` : ""}.</p>
            </div>

            {/* Classroom section tabs */}
            {Object.keys(classSectionVersions).length > 1 && (
              <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
                <span style={{fontSize:"0.72rem", color:text2}}>Classroom Section:</span>
                {Object.keys(classSectionVersions).sort().map(sec => (
                  <button key={sec}
                    style={S.vTab(activeClassSection===Number(sec), Number(sec)===1?"#10b981":"#8b5cf6")}
                    onClick={() => { setActiveClassSection(Number(sec)); setVersions(classSectionVersions[sec]); setActiveVersion(0); }}>
                    Section {sec}
                  </button>
                ))}
              </div>
            )}

            {versions.length === 0 && selectedForExam.length === 0 && (
              <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
                <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>📋</div>
                <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>No exam built yet</div>
                <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
                  Select questions from the bank, then click Build Exam here to create multiple versions.
                </div>
                <div style={{display:"flex", gap:"0.75rem", justifyContent:"center", flexWrap:"wrap"}}>
                  <button style={S.btn(accent, false)} onClick={() => setScreen("bank")}>▦ Browse Question Bank</button>
                  <button style={S.oBtn(text2)} onClick={() => setScreen("generate")}>✦ Generate Questions</button>
                </div>
              </div>
            )}

            {/* ── READY TO BUILD panel — questions selected but not yet built ── */}
            {versions.length === 0 && selectedForExam.length > 0 && (() => {
              const selected = bank
                .filter(q => selectedForExam.includes(q.id))
                .sort((a,b) => {
                  const [aMaj, aMin] = sectionSortKey(a.section);
                  const [bMaj, bMin] = sectionSortKey(b.section);
                  return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
                });
              return (
                <div>
                  {/* Selected questions summary */}
                  <div style={{...S.card, borderColor:accent+"44", marginBottom:"1rem"}}>
                    <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem", flexWrap:"wrap", gap:"0.5rem"}}>
                      <div>
                        <div style={{fontSize:"0.95rem", fontWeight:"600", color:text1, marginBottom:"0.2rem"}}>
                          {selected.length} questions selected
                        </div>
                        <div style={{fontSize:"0.72rem", color:text2}}>
                          {[...new Set(selected.map(q => q.course))].join(", ")} · {[...new Set(selected.map(q => q.section))].length} sections
                        </div>
                      </div>
                      <button style={S.ghostBtn("#f87171")} onClick={() => setSelectedForExam([])}>
                        ✕ Clear selection
                      </button>
                    </div>

                    {/* Question list */}
                    <div style={{display:"flex", flexDirection:"column", gap:"0.3rem", marginBottom:"1rem"}}>
                      {selected.map((q,i) => (
                        <div key={q.id} style={{display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.35rem 0", borderBottom: i < selected.length-1 ? "1px solid "+border+"44" : "none"}}>
                          <span style={S.diffTag(q.difficulty||"")}>{(q.difficulty||"?")[0]}</span>
                          <span style={{...S.tag(courseColors[q.course]), flexShrink:0}}>{(q.section||"").split(" ").slice(0,2).join(" ")}</span>
                          <span style={{fontSize:"0.8rem", color:text2, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                            {q.type==="Branched" ? q.stem : q.question}
                          </span>
                          <button style={{...S.smBtn, color:"#f87171", border:"none", padding:"0.1rem 0.3rem"}}
                            onClick={() => setSelectedForExam(p => p.filter(id => id !== q.id))}>✕</button>
                        </div>
                      ))}
                    </div>

                    {/* Config row */}
                    <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-end"}}>
                      <div>
                        <div style={S.lbl}>Versions per class</div>
                        <select style={{...S.sel, width:"120px"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} version{n>1?"s":""}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={S.lbl}>Classroom sections</div>
                        <input type="number" min={1} max={10} value={numClassSections}
                          style={{...S.input, width:"80px"}}
                          onChange={e => setNumClassSections(Math.max(1, Number(e.target.value)||1))} />
                      </div>
                      <button
                        style={S.btn(accent, false)}
                        onClick={triggerVersions}>
                        ✦ {numClassSections > 1 ? `Build All ${numClassSections} Sections (1 prompt)` : "Build Versions"}
                      </button>
                    </div>
                  </div>

                  {/* Prompt + paste panel */}
                  {pendingType === "version_all" && generatedPrompt && (
                    <>
                      <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                        📋 Copy this prompt — paste to Claude — paste response back:
                      </div>
                      <div style={S.promptBox}>{generatedPrompt}</div>
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                        <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                          disabled={autoGenLoading}
                          onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                          {autoGenLoading ? "⏳ Generating..." : "⚡ Generate Versions"}
                        </button>
                        {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
                      </div>
                      {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                      <PastePanel
                        label="Paste Claude's JSON response here."
                        S={S} text2={text2}
                        pasteInput={pasteInput} setPasteInput={setPasteInput}
                        pasteError={pasteError} handlePaste={handlePaste}
                        onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                      />
                    </>
                  )}
                  {pendingType === "version_all_sections" && generatedPrompt && (
                    <>
                      <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                        📋 Copy this prompt — generates ALL {pendingMeta?.numClassSections} sections × {pendingMeta?.labels?.join(", ")} versions in one go:
                      </div>
                      <div style={S.promptBox}>{generatedPrompt}</div>
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                        <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                          disabled={autoGenLoading}
                          onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                          {autoGenLoading ? "⏳ Generating..." : "⚡ Generate Versions"}
                        </button>
                        {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
                      </div>
                      {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                      <PastePanel
                        label="Paste the combined JSON response (all sections + versions)."
                        S={S} text2={text2}
                        pasteInput={pasteInput} setPasteInput={setPasteInput}
                        pasteError={pasteError} handlePaste={handlePaste}
                        onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                      />
                    </>
                  )}
                </div>
              );
            })()}

            {versions.length > 0 && (
              <>
                {/* Save to DB */}
                {!examSaved && (
                  <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem"}}>
                    <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"bold", marginBottom:"0.5rem"}}>💾 Save this exam to database</div>
                    <div style={{display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap"}}>
                      <input
                        style={{...S.input, maxWidth:"300px"}}
                        placeholder="Exam name (e.g. Calculus 1 Midterm)"
                        value={saveExamName}
                        onChange={e => setSaveExamName(e.target.value)}
                      />
                      <button
                        style={S.btn("#10b981", !saveExamName.trim() || savingExam)}
                        disabled={!saveExamName.trim() || savingExam}
                        onClick={async () => {
                          setSavingExam(true);
                          // Save all sections — if multi-section, flatten all versions; otherwise just current versions
                          const allVersions = Object.keys(classSectionVersions).length > 1
                            ? Object.values(classSectionVersions).flat()
                            : versions;
                          const result = await saveExam(saveExamName.trim(), allVersions);
                          if (result) setExamSaved(true);
                          setSavingExam(false);
                        }}
                      >
                        {savingExam ? "Saving…" : "Save Exam"}
                      </button>
                    </div>
                  </div>
                )}
                {examSaved && (
                  <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem", color:"#10b981"}}>
                    ✅ Exam saved! View it in the Saved Exams tab.
                  </div>
                )}

                {/* View mode toggle */}
                <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
                  <span style={{fontSize:"0.72rem", color:text2, marginRight:"0.25rem"}}>View:</span>
                  <button style={S.vTab(versionsViewMode==="single","#f43f5e")} onClick={() => setVersionsViewMode("single")}>
                    📄 Single Version
                  </button>
                  <button style={S.vTab(versionsViewMode==="compare","#8b5cf6")} onClick={() => setVersionsViewMode("compare")}>
                    📋 Canvas Versions
                  </button>
                </div>

                {/* ── SINGLE VERSION MODE ── */}
                {versionsViewMode === "single" && (() => {
                  const v = versions[activeVersion];
                  return (
                    <>
                      {/* Version tabs */}
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        {versions.map((ver,i) => (
                          <button key={ver.label} style={S.vTab(activeVersion===i,"#f43f5e")} onClick={() => setActiveVersion(i)}>
                            Version {ver.label} <span style={{fontSize:"0.68rem", opacity:0.7, marginLeft:"0.3rem"}}>({ver.questions.length}q)</span>
                          </button>
                        ))}
                      </div>


                      {(() => {
                        const allIssues = v.questions.flatMap((q,qi) => {
                          const issues = validateQuestion(q);
                          return issues.map(issue => `Q${qi+1}: ${issue}`);
                        });
                        return allIssues.length > 0 ? (
                          <div style={{background:"#7c2d1222", border:"1px solid #f8717144", borderRadius:"6px",
                            padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.75rem", color:"#9B1C1C"}}>
                            <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>⚠️ {allIssues.length} issue{allIssues.length>1?"s":""} found in this version</div>
                            {allIssues.map((issue,i) => <div key={i} style={{opacity:0.85}}>• {issue}</div>)}
                          </div>
                        ) : null;
                      })()}
                      <div id="export-panel" ref={el => { if (el && exportHighlight) el.scrollIntoView({behavior:"smooth", block:"start"}); }}
                        style={{transition:"outline 0.3s", outline: exportHighlight ? "2px solid #185FA555" : "none", borderRadius:"8px", padding: exportHighlight ? "0.5rem" : "0"}}>
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        <button style={S.btn("#10b981", exportLoading !== "")} disabled={exportLoading !== ""} onClick={async () => {
                          setExportLoading("Building Word document...");
                          try {
                            const cs = v.questions[0]?.classSection || null;
                            const blob = await buildDocx(v.questions,v.questions[0]?.course||"Calculus",v.label,cs);
                            const secStr = cs ? `_S${cs}` : "";
                            dlBlob(blob,`Version_${v.label}${secStr}_Exam.docx`);
                            if (examSaved && saveExamName) await logExport(saveExamName, "Word", v.label);
                          } finally { setExportLoading(""); }
                        }}>⬇ Word (.docx)</button>
                        <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
                          👁 Print Preview
                        </button>
                        {Object.keys(classSectionVersions).length > 1 && (
                          <button style={S.oBtn("#8b5cf6")} disabled={exportLoading !== ""} onClick={async () => {
                            setExportLoading("Building all sections Word...");
                            try {
                              for(const [sec, secVers] of Object.entries(classSectionVersions)){
                                for(const ver of secVers){
                                  const blob=await buildDocx(ver.questions,ver.questions[0]?.course||"Calculus",ver.label,Number(sec));
                                  dlBlob(blob,`S${sec}_Version_${ver.label}_Exam.docx`);
                                }
                              }
                            } finally { setExportLoading(""); }
                          }}>⬇ All Sections Word</button>
                        )}
                        <button style={S.oBtn("#f43f5e")} disabled={exportLoading !== ""} onClick={async () => {
                          setExportLoading("Building answer key...");
                          try {
                            const allVers = Object.keys(classSectionVersions).length > 1
                              ? Object.values(classSectionVersions).flat()
                              : versions;
                            const course = allVers[0]?.questions[0]?.course || "Exam";
                            const blob = await buildAnswerKey(allVers, course);
                            if (blob) dlBlob(blob, `${course.replace(/\s+/g,"_")}_Answer_Key.docx`);
                          } finally { setExportLoading(""); }
                        }}>🔑 Answer Key (.docx)</button>
                        {isAdmin && (
                          <button style={S.btn("#7c3aed", validating)} disabled={validating} onClick={autoValidateAllVersions}>
                            {validating ? "⏳ Validating..." : "✅ Auto Validate"}
                          </button>
                        )}
                        {isAdmin && (
                          <button style={S.oBtn("#7c3aed")} onClick={() => { copyValidationPrompt(); }}>
                            📋 Copy Validation Prompt
                          </button>
                        )}
                      </div>
                      {isAdmin && validationError && (
                        <div style={{background:"#1a0a0a", border:"1px solid #7f1d1d", borderRadius:"6px", padding:"0.5rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.78rem", color:"#f87171"}}>
                          ⚠️ {validationError}
                        </div>
                      )}
                      {isAdmin && Object.keys(validationResults).length > 0 && (() => {
                        const issues = Object.entries(validationResults).filter(([,r]) => !r.valid);
                        return (
                          <div style={{background: issues.length === 0 ? "#052e16" : "#1c1002", border:`1px solid ${issues.length === 0 ? "#14532d" : "#f59e0b44"}`, borderRadius:"6px", padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.78rem", color: issues.length === 0 ? "#4ade80" : "#f59e0b"}}>
                            {issues.length === 0
                              ? "✅ All questions verified — no issues found."
                              : <>
                                  <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>⚠️ {issues.length} issue{issues.length>1?"s":""} found</div>
                                  {issues.map(([id, r]) => (
                                    <div key={id} style={{marginBottom:"0.25rem", opacity:0.9}}>
                                      • <strong>Q{id}:</strong> {r.reason}{r.corrected_answer ? ` → Correct: ${r.corrected_answer}` : ""}
                                    </div>
                                  ))}
                                </>
                            }
                          </div>
                        );
                      })()}

                      {/* Canvas QTI Export Panel */}
                      {Object.keys(classSectionVersions).length > 1 ? (
                        <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                          <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas QTI Export — Classroom Sections</div>
                          <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                            <span style={{fontSize:"0.72rem", color:text2, flexShrink:0}}>Quiz name in Canvas:</span>
                            <input
                              placeholder={`e.g. Midterm MAT221`}
                              value={qtiExamName}
                              onChange={e => setQtiExamName(e.target.value)}
                              style={{...S.input, flex:1, maxWidth:"280px", padding:"0.3rem 0.6rem", fontSize:"0.78rem"}}
                            />
                          </div>
                          <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.75rem"}}>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                              <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                                style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                              Group by question number
                            </label>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                              Points per question:
                              <input type="number" min={1} max={100} value={qtiPointsPerQ}
                                onChange={e => setQtiPointsPerQ(Number(e.target.value)||1)}
                                style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                            </label>
                          </div>
                          <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.75rem"}}>
                            {qtiUseGroups
                              ? "Grouped: one question group per question number — Canvas randomly picks 1 version per student."
                              : "Flat: all question versions listed sequentially — no Canvas grouping."}
                          </div>
                          <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                            {(() => {
                              const allVers = Object.values(classSectionVersions).flat();
                              const warnings = validateQTIExport(allVers);
                              return warnings.length > 0 && (
                                <div style={{width:"100%", fontSize:"0.7rem", color:"#f59e0b", background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.35rem 0.6rem", marginBottom:"0.35rem"}}>
                                  ⚠ {warnings.length} issue{warnings.length>1?"s":""} detected before export: {warnings.slice(0,2).join(" · ")}{warnings.length>2?` +${warnings.length-2} more`:""}
                                </div>
                              );
                            })()}
                            {Object.keys(classSectionVersions).sort((a,b)=>Number(a)-Number(b)).map(sec => (
                              <button key={sec} style={S.btn("#8b5cf6", false)} onClick={async () => {
                                const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                                const blobs = await buildClassroomSectionsQTI(
                                  {[sec]: classSectionVersions[sec]},
                                  examTitle, qtiUseGroups, qtiPointsPerQ
                                );
                                const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g,"_");
                                dlBlob(blobs[sec], `${safeName}_S${sec}_QTI.zip`);
                              }}>⬇ Section {sec} QTI (.zip)</button>
                            ))}
                            <button style={S.btn("#10b981", false)} onClick={async () => {
                              const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                              const blobs = await buildClassroomSectionsQTI(
                                classSectionVersions, examTitle, qtiUseGroups, qtiPointsPerQ
                              );
                              const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g,"_");
                              for(const [sec, blob] of Object.entries(blobs)){
                                dlBlob(blob, `${safeName}_S${sec}_QTI.zip`);
                              }
                            }}>⬇ All Sections QTI (.zip)</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                          <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas QTI Export</div>
                          <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.75rem"}}>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                              <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                                style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                              Group by question number
                            </label>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                              Points per question:
                              <input type="number" min={1} max={100} value={qtiPointsPerQ}
                                onChange={e => setQtiPointsPerQ(Number(e.target.value)||1)}
                                style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                            </label>
                          </div>
                          <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                            {versions.map(v => (
                              <button key={v.label} style={S.oBtn("#8b5cf6")} onClick={async () => {
                                const xml = buildQTI(v.questions, v.questions[0]?.course||"Exam", v.label, qtiUseGroups, qtiPointsPerQ);
                                const blob = await buildQTIZip(xml, `Version_${v.label}`);
                                dlBlob(blob, `Version_${v.label}_Canvas_QTI.zip`);
                              }}>⬇ V{v.label} QTI (.zip)</button>
                            ))}
                            <button style={S.btn("#8b5cf6", false)} onClick={async () => {
                              const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, qtiPointsPerQ);
                              const blob = await buildQTIZip(xml, "AllVersions");
                              dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                            }}>⬇ All Versions QTI (.zip)</button>
                          </div>
                        </div>
                      )}
                      </div>{/* end export-panel wrapper */}

                      {v.questions.map((q,qi) => (
                        <div key={q.id||qi} style={S.qCard}>
                          {(() => { const issues = validateQuestion(q); return (
                          <div style={S.qMeta}>
                            <span style={{fontWeight:"bold", color:text1}}>Q{qi+1}</span>
                            <span style={S.tag("#f43f5e")}>{q.type}</span>
                            <span style={S.tag()}>{q.section}</span>
                            <span style={S.tag()}>{q.difficulty}</span>
                            {issues.length > 0 && (
                              <span title={issues.join("\n")} style={{cursor:"help",
                                background:"#7c2d12", color:"#9B1C1C", fontSize:"0.68rem", fontWeight:"600",
                                padding:"0.1rem 0.4rem", borderRadius:"4px", whiteSpace:"nowrap"}}>
                                ⚠️ {issues.length}
                              </span>
                            )}
                            <div style={{marginLeft:"auto", display:"flex", gap:"0.3rem"}}>
                              <button style={{...S.smBtn, color:"#f59e0b", border:"1px solid #f59e0b44"}}
                                onClick={() => isAdmin ? triggerReplace(activeVersion,qi,"numbers") : triggerReplaceAuto(activeVersion,qi,"numbers")}>↻ Replace</button>
                              <button style={{...S.smBtn, color:"#e879f9", border:"1px solid #e879f944"}}
                                onClick={() => isAdmin ? triggerReplace(activeVersion,qi,"function") : triggerReplaceAuto(activeVersion,qi,"function")}>↻ Diff.</button>
                              <button style={{...S.smBtn, color: inlineEditQId===`v${activeVersion}_${qi}` ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                                onClick={() => setInlineEditQId(inlineEditQId===`v${activeVersion}_${qi}` ? null : `v${activeVersion}_${qi}`)}>
                                ✏️
                              </button>
                            </div>
                          </div>
                          ); })()}
                          {inlineEditQId === `v${activeVersion}_${qi}` && (
                            <InlineEditor
                              q={q}
                              onSave={(updated) => {
                                const updVers = versions.map((v,vi) =>
                                  vi !== activeVersion ? v : { ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }
                                );
                                setVersions(updVers);
                                setClassSectionVersions(prev => {
                                  const next = {...prev};
                                  Object.keys(next).forEach(sec => {
                                    next[sec] = next[sec].map((v,vi) =>
                                      vi !== activeVersion ? v : { ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }
                                    );
                                  });
                                  return next;
                                });
                                setInlineEditQId(null);
                                showToast("Question updated ✓");
                              }}
                              onClose={() => setInlineEditQId(null)}
                            />
                          )}
                          {q.type==="Branched" ? (
                            <>
                              <div style={{...S.qText,color:"#f43f5e99"}}>Given: <MathText>{q.stem}</MathText></div>
                              {(q.parts||[]).map((p,pi) => (
                                <div key={pi} style={{marginBottom:"0.6rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                                  <div style={{fontSize:"0.7rem",color:text3,marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                                  <div style={S.qText}><MathText>{p.question}</MathText></div>
                                  {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                                  {p.explanation&&<div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>}
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <div style={S.qText}><MathText>{q.question}</MathText></div>
                              {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                              {q.answer&&<div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                              {q.explanation&&<div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
                            </>
                          )}
                          {pendingType === "replace" && pendingMeta?.vIdx === activeVersion && pendingMeta?.qIdx === qi && (
                            <>
                              {isAdmin && generatedPrompt && (
                                <>
                                  <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"bold", margin:"0.75rem 0 0.4rem"}}>📋 Replacement prompt:</div>
                                  <div style={S.promptBox}>{generatedPrompt}</div>
                                  <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                                    <button
                                      style={{...S.btn("#10b981", autoGenLoading), minWidth:"150px"}}
                                      disabled={autoGenLoading}
                                      onClick={() => autoGenerateVersions(generatedPrompt, "replace", pendingMeta)}>
                                      {autoGenLoading ? "⏳ Generating..." : "⚡ Auto-Generate"}
                                    </button>
                                    <button style={S.oBtn("#f59e0b")} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>
                                  </div>
                                  {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.5rem"}}>{autoGenError}</div>}
                                  <PastePanel
                                    label="Paste the replacement question JSON here."
                                    S={S} text2={text2}
                                    pasteInput={pasteInput} setPasteInput={setPasteInput}
                                    pasteError={pasteError} handlePaste={handlePaste}
                                    onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                                  />
                                </>
                              )}
                              {!isAdmin && (
                                <div style={{marginTop:"0.75rem", display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap", padding:"0.6rem 0.75rem", background:"#052e1688", borderRadius:"6px", border:"1px solid #22c55e22"}}>
                                  {autoGenLoading
                                    ? <><span style={{fontSize:"0.75rem", color:"#86efac"}}>⏳ Generating replacement...</span></>
                                    : autoGenError
                                      ? <span style={{fontSize:"0.72rem", color:"#f87171"}}>{autoGenError}</span>
                                      : <span style={{fontSize:"0.72rem", color:"#86efac"}}>✓ Done</span>
                                  }
                                  <button style={{...S.smBtn, color:text2, marginLeft:"auto"}}
                                    onClick={() => { setPendingType(null); setGeneratedPrompt(""); }}>
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}

                {/* ── COMPARE ALL VERSIONS MODE ── */}
                {versionsViewMode === "compare" && (() => {
                  const numQ = versions[0]?.questions?.length || 0;
                  const allSections = [...new Set(versions.flatMap(v => v.questions.map(q => q.section)))];
                  const [filterSec, setFilterSec] = [compareSection, setCompareSection];

                  const filteredIndices = Array.from({length:numQ},(_,i)=>i).filter(i => {
                    if (filterSec === "All") return true;
                    return versions.some(v => v.questions[i]?.section === filterSec);
                  });

                  return (
                    <>
                      {/* Section filter */}
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.72rem", color:text2}}>Filter section:</span>
                        <select style={{...S.sel, width:"220px"}} value={filterSec} onChange={e => setFilterSec(e.target.value)}>
                          <option value="All">All Sections</option>
                          {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{fontSize:"0.72rem", color:text2}}>{filteredIndices.length} question{filteredIndices.length!==1?"s":""}</span>
                      </div>

                      {/* Canvas Export Settings */}
                      <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                        <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas Export Settings</div>
                        <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center"}}>
                          <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                            <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                              style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                            Group by section per version
                          </label>
                          <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                            Points per question:
                            <input type="number" min={1} max={100} value={qtiPointsPerQ}
                              onChange={e => setQtiPointsPerQ(Number(e.target.value)||1)}
                              style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                          </label>
                        </div>
                      </div>

                      {/* Export buttons for compare view — single grouped file */}
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
                        <span style={{fontSize:"0.72rem", color:accent, fontWeight:"bold"}}>Canvas export — one file, all versions:</span>
                        <button style={S.btn("#8b5cf6", false)} onClick={async () => {
                          const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, qtiPointsPerQ);
                          const blob = await buildQTIZip(xml, "AllVersions");
                          dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                        }}>⬇ Export to Canvas (QTI .zip)</button>
                        {Object.keys(classSectionVersions).length > 1 && (
                          <button style={S.btn("#f59e0b", false)} onClick={async () => {
                            const course = versions[0]?.questions[0]?.course || "Exam";
                            const xml = buildQTIAllSectionsMerged(classSectionVersions, course, qtiPointsPerQ);
                            const blob = await buildQTIZip(xml, "AllSections_Merged");
                            dlBlob(blob, "AllSections_Merged_QTI.zip");
                          }}>⬇ All Sections Merged QTI</button>
                        )}
                        <button style={S.btn("#10b981", false)} onClick={async () => {
                          const blob = await buildDocxCompare(versions, versions[0]?.questions[0]?.course || "Exam");
                          dlBlob(blob, "AllVersions_Grouped.docx");
                        }}>⬇ Export to Word (all versions)</button>
                      </div>

                      {/* Questions grouped by number, all versions stacked */}
                      {filteredIndices.map(qi => (
                        <div key={qi} style={{marginBottom:"1.5rem"}}>
                          {/* Question group header */}
                          <div style={{fontSize:"0.72rem", color:"#f43f5e", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.5rem", padding:"0.3rem 0.6rem", background:"#f43f5e18", borderRadius:"5px", display:"inline-block"}}>
                            Question {qi+1} — {versions[0]?.questions[qi]?.section} — {versions[0]?.questions[qi]?.difficulty}
                          </div>

                          {versions.map((v, vi) => {
                            const q = v.questions[qi];
                            if (!q) return null;
                            const vColors = ["#f43f5e","#8b5cf6","#f59e0b","#06b6d4","#10b981"];
                            const vc = vColors[vi % vColors.length];
                            return (
                              <div key={v.label} style={{...S.qCard, borderLeft:`3px solid ${vc}`, marginBottom:"0.4rem"}}>
                                <div style={S.qMeta}>
                                  <span style={{background:vc+"22", color:vc, border:`1px solid ${vc}44`, borderRadius:"4px", padding:"0.15rem 0.5rem", fontSize:"0.7rem", fontWeight:"bold"}}>Version {v.label}</span>
                                  <span style={S.tag()}>{q.type}</span>
                                </div>
                                {q.type==="Branched" ? (
                                  <>
                                    <div style={{...S.qText,color:vc+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                                    {(q.parts||[]).map((p,pi) => (
                                      <div key={pi} style={{marginBottom:"0.4rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                                        <div style={{fontSize:"0.7rem",color:text3}}>({String.fromCharCode(97+pi)})</div>
                                        <div style={S.qText}><MathText>{p.question}</MathText></div>
                                        {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                                    {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                                    {q.answer&&<div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* SAVED EXAMS */}
        {screen === "saved" && (
          <SavedExamsScreen S={S} text1={text1} text2={text2} text3={text3} border={border}
            onLoad={(exam) => {
              // Restore exam into Versions tab
              const vers = exam.versions || [];
              // detect sections — classSection lives on the version object, fall back to questions[0]
              const sectionNums = [...new Set(vers.map(v => v.classSection ?? v.questions?.[0]?.classSection).filter(Boolean))].sort((a,b)=>a-b);
              if (sectionNums.length > 1) {
                // multi-section
                const secVersions = {};
                sectionNums.forEach(sec => {
                  secVersions[sec] = vers.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec);
                });
                setClassSectionVersions(secVersions);
                setVersions(secVersions[sectionNums[0]] || vers);
              } else {
                setClassSectionVersions({});
                setVersions(vers);
              }
              setActiveVersion(0);
              setExamSaved(true);
              setSaveExamName(exam.name);
              setCourse(vers[0]?.questions?.[0]?.course || null);
              setSelectedForExam([]);
              setScreen("versions");
            }}
          />
        )}

      </main>

      {/* ── PRINT PREVIEW MODAL ── */}
      {showPrintPreview && (() => {
        const v = versions[activeVersion];
        if (!v) { setShowPrintPreview(false); return null; }
        const cs = v.questions[0]?.classSection;
        const courseName = v.questions[0]?.course || "Exam";
        const titleLabel = cs ? `Section ${cs} — Version ${v.label}` : `Version ${v.label}`;

        // check if any graph questions still need rendering
        const graphQs = v.questions.filter(q => q.hasGraph && q.graphConfig);
        const graphsReady = graphQs.every(q => printGraphCache[q.id || q.question]);
        const graphsLoading = graphQs.length > 0 && !graphsReady;

        const getGraphImg = (q) => {
          const b64 = printGraphCache[q.id || q.question];
          if (b64) return `<img src="${b64}" style="max-width:100%;display:block;margin-bottom:8pt;" />`;
          return ""; // graphs not ready yet — will re-render when cache updates
        };

        const printHTML = `
          <h2 style="font-size:16pt;margin-bottom:4pt;">${courseName} — ${titleLabel}</h2>
          <div style="font-size:10pt;color:#555;margin-bottom:20pt;">Name: _________________________ &nbsp;&nbsp; Date: _____________</div>
          ${v.questions.map((q, qi) => {
            const graphImg = getGraphImg(q);
            if (q.type === "Branched") return `
              <div style="margin-bottom:20pt;page-break-inside:avoid;">
                <div style="font-weight:bold;margin-bottom:4pt;">Question ${qi+1}.</div>
                ${graphImg}
                <div style="margin-bottom:8pt;">Given: ${q.stem}</div>
                ${(q.parts||[]).map((p,pi) => `
                  <div style="margin-left:20pt;margin-bottom:6pt;">
                    (${String.fromCharCode(97+pi)}) ${p.question}
                    ${p.choices ? p.choices.map((c,ci) => `<div style="margin-left:20pt;">${String.fromCharCode(65+ci)}. ${c}</div>`).join("") : ""}
                  </div>`).join("")}
              </div>`;
            return `
              <div style="margin-bottom:20pt;page-break-inside:avoid;">
                <div style="font-weight:bold;margin-bottom:4pt;">Question ${qi+1}.</div>
                ${graphImg}
                <div style="margin-bottom:8pt;">${q.question}</div>
                ${q.choices ? q.choices.map((c,ci) => `
                  <div style="margin:3pt 0 3pt 24pt;">${String.fromCharCode(65+ci)}.&nbsp; ${c}</div>`).join("") : ""}
                ${!q.choices ? `<div style="border-bottom:1px solid #ccc;margin-top:40pt;"></div>` : ""}
              </div>
              <hr style="border:none;border-top:1px solid #eee;margin:0 0 16pt 0;" />`;
          }).join("")}`;

        return (
          <div style={{position:"fixed", top:0, left:0, right:0, bottom:0, width:"100vw", height:"100vh", background:"rgba(0,0,0,0.95)", zIndex:99999, display:"flex", flexDirection:"column", overflow:"hidden"}}>
            {/* Top bar */}
            <div style={{background:bg1, borderBottom:"1px solid #1e2d45", padding:"0.65rem 1.5rem", display:"flex", alignItems:"center", gap:"1rem", flexShrink:0}}>
              <span style={{fontSize:"0.85rem", fontWeight:"600", color:text1, flex:1}}>
                👁 Print Preview — {courseName} {titleLabel}
              </span>
              <button style={{background:"#2D6A4F", color:"#fff", border:"none", borderRadius:"6px", padding:"0.4rem 1.1rem", fontSize:"0.82rem", fontWeight:"600", cursor:"pointer"}}
                onClick={() => {
                  const win = window.open("","_blank");
                  win.document.write(`<!DOCTYPE html><html><head><title>${courseName} ${titleLabel}</title>
                    <style>
                      body{font-family:"Times New Roman",serif;color:#000;background:#fff;margin:2cm;font-size:12pt;line-height:1.6;}
                      h2{font-size:16pt;margin-bottom:4pt;}
                      hr{border:none;border-top:1px solid #eee;margin:0 0 16pt 0;}
                      table{border-collapse:collapse;margin:8pt 0;}
                      th,td{border:1px solid #999;padding:4pt 10pt;text-align:center;}
                      th{background:#eee;font-weight:bold;}
                      @media print{body{margin:1.5cm;}}
                    </style></head><body>${printHTML}</body></html>`);
                  win.document.close();
                  setTimeout(() => win.print(), 400);
                }}>🖨 Print</button>
              <button style={{background:"transparent", color:text2, border:"1px solid #1e2d45", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.82rem", cursor:"pointer"}}
                onClick={() => setShowPrintPreview(false)}>✕ Close</button>
            </div>

            {/* Preview content */}
            <div style={{flex:1, overflowY:"auto", display:"flex", justifyContent:"center", padding:"2rem 1rem", flexDirection:"column", alignItems:"center"}}>
              {graphsLoading && (
                <div style={{color:"#185FA5", fontSize:"0.85rem", marginBottom:"1rem", padding:"0.5rem 1rem", background:border, borderRadius:"6px"}}>
                  ⏳ Rendering graphs...
                </div>
              )}
              <div key={Object.keys(printGraphCache).length} style={{background:"#fff", color:"#000", width:"min(21cm, 95vw)", minHeight:"29.7cm", padding:"min(2cm, 4vw)", boxShadow:"0 4px 32px rgba(0,0,0,0.5)", fontFamily:"'Times New Roman',serif", fontSize:"12pt", lineHeight:1.6, boxSizing:"border-box"}}
                dangerouslySetInnerHTML={{__html: printHTML}}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function TestBankApp() {
  return <TestBankAppInner />;
}
