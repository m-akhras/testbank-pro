"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
function isPipeTable(text) {
  const s = String(text);
  // Newline-based table
  const lines = s.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines.filter(l => l.startsWith("|")).length >= 2) return true;
  // Inline table: text contains | cell | cell | pattern (at least 2 columns, 2 rows implied by || separator)
  if (s.includes("|") && /\|[^|]+\|[^|]+\|/.test(s)) {
    // Must have at least 3 pipe chars to be a real table
    return (s.match(/\|/g)||[]).length >= 4;
  }
  return false;
}

// Normalize inline table (no newlines) to newline-based table
function normalizePipeTable(text) {
  const s = String(text);
  if (s.includes("\n")) return s; // already has newlines

  const pipeIdx = s.indexOf("|");
  if (pipeIdx === -1) return s;

  const before = s.slice(0, pipeIdx).trim();
  const rest = s.slice(pipeIdx);

  const sepMatch = rest.match(/\|[-| :]+\|/);
  if (!sepMatch) return s;

  const sepIdx = rest.indexOf(sepMatch[0]);
  const headerPart = rest.slice(0, sepIdx).trim();
  const afterSep = rest.slice(sepIdx + sepMatch[0].length).trim();
  const headerRow = headerPart.replace(/^\||\|$/g,"").split("|").map(c => c.trim());
  const numCols = headerRow.length;

  const rows = [];
  rows.push("| " + headerRow.join(" | ") + " |");
  rows.push("|" + headerRow.map(() => "---").join("|") + "|");

  const allParts = afterSep.split("|").map(p => p.trim());
  let cellBuf = [];
  let remaining = "";

  for (let i = 0; i < allParts.length; i++) {
    const p = allParts[i];
    if (p === "") {
      if (cellBuf.length === numCols) {
        rows.push("| " + cellBuf.join(" | ") + " |");
        cellBuf = [];
      }
      continue;
    }
    cellBuf.push(p);
    if (cellBuf.length === numCols) {
      rows.push("| " + cellBuf.join(" | ") + " |");
      cellBuf = [];
    }
  }
  if (cellBuf.length > 0 && cellBuf.length < numCols) {
    remaining = cellBuf.join(" ").trim();
  }

  const tableText = rows.join("\n");
  const result = (before ? before + "\n" : "") + tableText + (remaining ? "\n" + remaining : "");
  return result;
}

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
                border:"1px solid #2a2a4a",
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

// Split text into table blocks and non-table blocks
function splitTableBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = [];
  let inTable = false;

  for (const line of lines) {
    const isTableLine = line.trim().startsWith("|");
    if (isTableLine) {
      if (!inTable && current.length) {
        blocks.push({ type:"text", content: current.join("\n") });
        current = [];
      }
      inTable = true;
      current.push(line);
    } else {
      if (inTable && current.length) {
        blocks.push({ type:"table", content: current.join("\n") });
        current = [];
      }
      inTable = false;
      current.push(line);
    }
  }
  if (current.length) blocks.push({ type: inTable ? "table" : "text", content: current.join("\n") });
  return blocks;
}

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
               labelOffsetX: Number(labelOffsetX)||0, labelOffsetY: Number(labelOffsetY)||0 };
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
      style={{width, padding:"0.2rem 0.4rem", background:"#1a1a2e", border:"1px solid #334155",
        color:"#e8e8e0", borderRadius:"4px", fontSize:"0.78rem"}} />
  );

  const lbl = (text) => <span style={{fontSize:"0.72rem", color:"#94a3b8", marginRight:"6px"}}>{text}</span>;

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
    <div style={{marginTop:"0.75rem", padding:"1rem", background:"#0f1629", border:"1px solid #1e3a5f",
      borderRadius:"8px"}}>
      <div style={{fontSize:"0.78rem", color:"#60a5fa", fontWeight:"600", marginBottom:"0.75rem"}}>
        📈 Graph Editor — <span style={{color:"#94a3b8", fontWeight:"400"}}>{typeLabel}</span>
      </div>

      {/* Single curve inputs */}
      {type === "single" && <>
        {row(<>{lbl("f(x) =")} {inp(fn, setFn, "e.g. x^2 - 3", "200px")}</>)}
        {row(<>
          {lbl("Label:")} {inp(fnLabel, setFnLabel, "e.g. f(x) = x²-3", "150px")}
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:"#94a3b8",cursor:"pointer"}}>
            <input type="checkbox" checked={showFnLabel} onChange={e=>setShowFnLabel(e.target.checked)} /> Show
          </label>
        </>)}
        {row(<>
          {lbl("Holes (x,y):")}
          {inp(holeInput, setHoleInput, "e.g. 2,3", "100px")}
          <button onClick={() => addPoint(holes, setHoles, holeInput, setHoleInput)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background:"transparent", border:"1px solid #334155", color:"#94a3b8"}}>+ Add</button>
          {holes.map((h,i) => <span key={i} style={{fontSize:"0.7rem", color:"#60a5fa", cursor:"pointer"}}
            onClick={() => setHoles(holes.filter((_,j)=>j!==i))}>({h[0]},{h[1]}) ✕</span>)}
        </>)}
        {row(<>
          {lbl("Points (x,y):")}
          {inp(pointInput, setPointInput, "e.g. 2,5", "100px")}
          <button onClick={() => addPoint(points, setPoints, pointInput, setPointInput)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background:"transparent", border:"1px solid #334155", color:"#94a3b8"}}>+ Add</button>
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
            style={{width:"42px",padding:"0.18rem 0.3rem",background:"#1a1a2e",border:"1px solid #334155",color:"#e8e8e0",borderRadius:"4px",fontSize:"0.72rem"}} />
          <input type="number" value={topLabelOffsetY} onChange={e=>setTopLabelOffsetY(Number(e.target.value))} placeholder="y" title="Y offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:"#1a1a2e",border:"1px solid #334155",color:"#e8e8e0",borderRadius:"4px",fontSize:"0.72rem"}} />
          <span style={{fontSize:"0.62rem",color:"#475569"}}>px</span>
        </>)}
        {row(<>
          {lbl("g(x) bottom =")} {inp(fnBottom, setFnBottom, "bottom curve", "150px")}
          {lbl("label:")} {inp(fnBottomLabel, setFnBottomLabel, "g(x)", "60px")}
          {lbl("offset:")}
          <input type="number" value={botLabelOffsetX} onChange={e=>setBotLabelOffsetX(Number(e.target.value))} placeholder="x" title="X offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:"#1a1a2e",border:"1px solid #334155",color:"#e8e8e0",borderRadius:"4px",fontSize:"0.72rem"}} />
          <input type="number" value={botLabelOffsetY} onChange={e=>setBotLabelOffsetY(Number(e.target.value))} placeholder="y" title="Y offset in pixels"
            style={{width:"42px",padding:"0.18rem 0.3rem",background:"#1a1a2e",border:"1px solid #334155",color:"#e8e8e0",borderRadius:"4px",fontSize:"0.72rem"}} />
          <span style={{fontSize:"0.62rem",color:"#475569"}}>px</span>
        </>)}
        {row(<>
          {lbl("Shade from x =")} {inp(shadeFrom, setShadeFrom, "-1", "55px")} {lbl("to x =")} {inp(shadeTo, setShadeTo, "2", "55px")}
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:"#94a3b8",cursor:"pointer"}}>
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
              border:`1px solid ${shadeAbove?"#185FA5":"#334155"}`}}>Above</button>
          <button onClick={() => setShadeAbove(false)}
            style={{fontSize:"0.72rem", padding:"0.2rem 0.5rem", borderRadius:"4px", cursor:"pointer",
              background: !shadeAbove ? "#185FA5" : "transparent", color: !shadeAbove ? "#fff" : "#94a3b8",
              border:`1px solid ${!shadeAbove?"#185FA5":"#334155"}`}}>Below</button>
        </>)}
        {row(<>
          <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"0.72rem",color:"#94a3b8",cursor:"pointer"}}>
            <input type="checkbox" checked={boundDashed} onChange={e=>setBoundDashed(e.target.checked)} />
            Dashed boundary (strict inequality)
          </label>
        </>)}
        {row(<>{lbl("Boundary label:")} {inp(boundLabel, setBoundLabel, "y = x²", "140px")}</>)}
      </>}

      {/* x domain + display toggles */}
      <div style={{display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"0.5rem", marginTop:"0.25rem", alignItems:"center"}}>
        <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
          {lbl("x:")} {inp(xMin, setXMin, "-5", "44px")} <span style={{color:"#94a3b8",fontSize:"0.72rem"}}>to</span> {inp(xMax, setXMax, "5", "44px")}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:"6px"}}>
          {lbl("y:")}
          {inp(yMinState ?? "", v => setYMinState(v===""?null:v), "auto", "44px")}
          <span style={{color:"#94a3b8",fontSize:"0.72rem"}}>to</span>
          {inp(yMaxState ?? "", v => setYMaxState(v===""?null:v), "auto", "44px")}
          <span style={{fontSize:"0.65rem", color:"#475569"}}>(blank = auto)</span>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:"#94a3b8",cursor:"pointer"}}>
          <input type="checkbox" checked={showNumbers} onChange={e=>setShowNumbers(e.target.checked)} /> Axis numbers
        </label>
        <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:"#94a3b8",cursor:"pointer"}}>
          <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} /> Grid
        </label>
        {["continuous_dist","discrete_dist","standard_normal"].includes(type) && (
          <label style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:"#94a3b8",cursor:"pointer"}}>
            <input type="checkbox" checked={showFnLabel} onChange={e=>setShowFnLabel(e.target.checked)} /> Show label
          </label>
        )}
        {["continuous_dist","discrete_dist","standard_normal"].includes(type) && showFnLabel && (
          <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.72rem",color:"#94a3b8"}}>
            <span>Label offset:</span>
            <span>x</span>
            <input type="number" value={labelOffsetX} onChange={e=>setLabelOffsetX(Number(e.target.value))}
              style={{width:"46px",padding:"0.18rem 0.3rem",background:"#1a1a2e",border:"1px solid #334155",color:"#e8e8e0",borderRadius:"4px",fontSize:"0.72rem"}} />
            <span>y</span>
            <input type="number" value={labelOffsetY} onChange={e=>setLabelOffsetY(Number(e.target.value))}
              style={{width:"46px",padding:"0.18rem 0.3rem",background:"#1a1a2e",border:"1px solid #334155",color:"#e8e8e0",borderRadius:"4px",fontSize:"0.72rem"}} />
            <span style={{fontSize:"0.65rem",color:"#475569"}}>px</span>
          </div>
        )}
      </div>

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
            background:"transparent", color:"#94a3b8", border:"1px solid #334155"}}>
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
        style={{width:"100%", padding:"0.4rem 0.6rem", background:"#0d1425", border:"1px solid #1e3a5f",
          color:"#e8e8e0", borderRadius:"6px", fontSize:"0.82rem", resize:"vertical",
          lineHeight:1.5, fontFamily:"inherit", boxSizing:"border-box"}} />
    : <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
        style={{width:"100%", padding:"0.35rem 0.6rem", background:"#0d1425", border:"1px solid #1e3a5f",
          color:"#e8e8e0", borderRadius:"6px", fontSize:"0.82rem", fontFamily:"inherit", boxSizing:"border-box"}} />;

  const lbl = (t) => <div style={{fontSize:"0.68rem", color:"#4a6fa5", textTransform:"uppercase",
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
    <div style={{marginTop:"0.75rem", padding:"1rem", background:"#080d1a",
      border:"1px solid #1e3a5f", borderRadius:"8px", borderLeft:"3px solid #60a5fa"}}>
      <div style={{fontSize:"0.75rem", color:"#60a5fa", fontWeight:"700", marginBottom:"0.75rem",
        display:"flex", alignItems:"center", gap:"0.5rem"}}>
        ✏️ Edit Question
        <span style={{fontSize:"0.65rem", color:"#3a5a8a", fontWeight:"400"}}>— changes save to Supabase</span>
      </div>

      {q.type === "Branched" ? (<>
        {lbl("Given (stem)")}
        {inp(stem, setStem, "Shared context for all parts...", 2)}
        {parts.map((p, pi) => (
          <div key={pi} style={{marginTop:"0.75rem", paddingLeft:"0.75rem", borderLeft:"2px solid #1e3a5f"}}>
            <div style={{fontSize:"0.68rem", color:"#4a6fa5", marginBottom:"0.3rem"}}>Part ({String.fromCharCode(97+pi)})</div>
            {inp(p.question, (v) => { const np=[...parts]; np[pi]={...np[pi],question:v}; setParts(np); }, "Question text...", 2)}
            <div style={{fontSize:"0.65rem", color:"#4a6fa5", margin:"0.3rem 0 0.2rem"}}>Answer</div>
            {inp(p.answer, (v) => { const np=[...parts]; np[pi]={...np[pi],answer:v}; setParts(np); }, "Answer...")}
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
                  background: answer===c ? "#10b981" : "#1e3a5f",
                  color: answer===c ? "#fff" : "#4a6fa5"}}>
                {String.fromCharCode(65+ci)}
              </button>
              <input value={c} onChange={e => { const nc=[...choices]; nc[ci]=e.target.value; setChoices(nc);
                  if (answer===c) setAnswer(e.target.value); }}
                style={{flex:1, padding:"0.3rem 0.5rem", background:"#0d1425",
                  border:"1px solid "+(answer===c?"#10b981":"#1e3a5f"),
                  color:"#e8e8e0", borderRadius:"5px", fontSize:"0.8rem"}} />
            </div>
          ))}
          <div style={{fontSize:"0.65rem", color:"#3a5a8a", marginTop:"0.3rem"}}>
            Click a letter to mark as correct answer · Currently: <span style={{color:"#10b981"}}>{answer || "none selected"}</span>
          </div>
        </>)}

        {!choices.length && (<>
          {lbl("Answer")}
          {inp(answer, setAnswer, "Answer...")}
        </>)}
      </>)}

      {lbl("Explanation (optional)")}
      {inp(explanation, setExplanation, "Step-by-step explanation...", 2)}

      <div style={{display:"flex", gap:"0.5rem", marginTop:"0.85rem"}}>
        <button onClick={handleSave} disabled={saving}
          style={{padding:"0.35rem 0.9rem", background:"#10b981", color:"#000",
            border:"none", borderRadius:"6px", fontSize:"0.78rem", fontWeight:"600",
            cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1}}>
          {saving ? "Saving…" : "✓ Save Changes"}
        </button>
        <button onClick={onClose}
          style={{padding:"0.35rem 0.8rem", background:"transparent", color:"#4a6fa5",
            border:"1px solid #1e3a5f", borderRadius:"6px", fontSize:"0.78rem", cursor:"pointer"}}>
          Cancel
        </button>
      </div>
    </div>
  );
}
// ─── End InlineEditor ─────────────────────────────────────────────────────────


// ─── Course data ──────────────────────────────────────────────────────────────
const COURSES = {
  "Calculus 1": {
    color: "#10b981",
    chapters: [
      { ch:"1", title:"Functions and Models", sections:["1.1 Four Ways to Represent a Function","1.2 Mathematical Models: A Catalog of Essential Functions","1.3 New Functions from Old Functions","1.4 Exponential Functions","1.5 Inverse Functions and Logarithms"] },
      { ch:"2", title:"Limits and Derivatives", sections:["2.2 The Limit of a Function","2.3 Calculating Limits Using the Limit Laws","2.5 Continuity","2.6 Limits at Infinity; Horizontal Asymptotes","2.8 The Derivative as a Function"] },
      { ch:"3", title:"Differentiation Rules", sections:["3.1 Derivatives of Polynomials and Exponential Functions","3.2 The Product and Quotient Rules","3.3 Derivatives of Trigonometric Functions","3.4 The Chain Rule","3.5 Implicit Differentiation","3.6 Derivatives of Logarithmic and Inverse Trigonometric Functions"] },
      { ch:"4", title:"Applications of Differentiation", sections:["4.1 Maximum and Minimum Values","4.2 The Mean Value Theorem","4.3 What Derivatives Tell Us about the Shape of a Graph","4.4 Indeterminate Forms and l'Hopital's Rule","4.9 Antiderivatives"] },
      { ch:"5", title:"Integrals", sections:["5.2 The Definite Integral","5.3 The Fundamental Theorem of Calculus","5.4 Indefinite Integrals and the Net Change Theorem","5.5 The Substitution Rule"] },
    ],
  },
  "Calculus 2": {
    color: "#8b5cf6",
    chapters: [
      { ch:"3", title:"Differentiation Rules (cont.)", sections:["3.9 Related Rates","3.10 Linear Approximations and Differentials","3.11 Hyperbolic Functions"] },
      { ch:"6", title:"Applications of Integration", sections:["6.1 Areas Between Curves","6.2 Volumes","6.3 Volumes by Cylindrical Shells"] },
      { ch:"7", title:"Techniques of Integration", sections:["7.1 Integration by Parts","7.2 Trigonometric Integrals","7.3 Trigonometric Substitution","7.4 Integration of Rational Functions by Partial Fractions","7.8 Improper Integrals"] },
      { ch:"8", title:"Further Applications of Integration", sections:["8.1 Arc Length","8.2 Surface Area of Revolution"] },
      { ch:"11", title:"Sequences, Series, and Power Series", sections:["11.1 Sequences","11.2 Series","11.3 The Integral Test and Estimates of Sums","11.4 The Comparison Tests","11.5 Alternating Series and Absolute Convergence","11.6 The Ratio and Root Tests","11.8 Power Series","11.10 Taylor and Maclaurin Series"] },
    ],
  },
  "Calculus 3": {
    color: "#f59e0b",
    chapters: [
      { ch:"12", title:"Vectors and the Geometry of Space", sections:["12.1 Three-Dimensional Coordinate Systems","12.2 Vectors","12.3 The Dot Product","12.4 The Cross Product","12.5 Equations of Lines and Planes"] },
      { ch:"14", title:"Partial Derivatives", sections:["14.1 Functions of Several Variables","14.2 Limits and Continuity","14.3 Partial Derivatives","14.4 Tangent Planes and Linear Approximations","14.5 The Chain Rule","14.6 Directional Derivatives and the Gradient Vector","14.7 Maximum and Minimum Values"] },
      { ch:"15", title:"Multiple Integrals", sections:["15.1 Double Integrals over Rectangles","15.2 Double Integrals over General Regions","15.3 Double Integrals in Polar Coordinates","15.5 Surface Area","15.6 Triple Integrals"] },
      { ch:"16", title:"Vector Calculus", sections:["16.1 Vector Fields","16.2 Line Integrals"] },
    ],
  },
  "Quantitative Methods I": {
    color: "#06b6d4",
    chapters: [
      { ch:"1", title:"Data and Statistics", sections:["1.1 Applications in Business and Economics","1.2 Data","1.3 Data Sources","1.4 Descriptive Statistics","1.5 Statistical Inference"] },
      { ch:"2", title:"Descriptive Statistics: Tabular and Graphical Displays", sections:["2.1 Summarizing Data for a Categorical Variable","2.2 Summarizing Data for a Quantitative Variable","2.3 Summarizing Data for Two Variables Using Tables","2.4 Summarizing Data for Two Variables Using Graphical Displays","2.5 Data Visualization: Best Practices"] },
      { ch:"3", title:"Descriptive Statistics: Numerical Measures", sections:["3.1 Measures of Location","3.2 Measures of Variability","3.3 Measures of Distribution Shape, Relative Location, and Outliers","3.4 Five-Number Summaries and Boxplots","3.5 Measures of Association Between Two Variables","3.6 Data Dashboards and Measures of Performance"] },
    ],
  },
  "Quantitative Methods II": {
    color: "#f43f5e",
    chapters: [
      { ch:"4", title:"Introduction to Probability", sections:["4.1 Experiments, Counting Rules, and Assigning Probabilities","4.2 Events and Their Probabilities","4.3 Some Basic Relationships of Probability","4.4 Conditional Probability","4.5 Bayes Theorem"] },
      { ch:"5", title:"Discrete Probability Distributions", sections:["5.1 Random Variables","5.2 Developing Discrete Probability Distributions","5.3 Expected Value and Variance","5.4 Bivariate Distributions, Covariance, and Financial Portfolios","5.5 Binomial Probability Distribution","5.6 Poisson Probability Distribution","5.7 Hypergeometric Probability Distribution"] },
      { ch:"6", title:"Continuous Probability Distributions", sections:["6.1 Uniform Probability Distribution","6.2 Normal Probability Distribution","6.3 Normal Approximation of Binomial Probabilities","6.4 Exponential Probability Distribution"] },
      { ch:"7", title:"Sampling and Sampling Distributions", sections:["7.1 The Electronics Associates Sampling Problem","7.2 Selecting a Sample","7.3 Point Estimation","7.4 Introduction to Sampling Distributions","7.5 Sampling Distribution of x-bar","7.6 Sampling Distribution of p-bar"] },
      { ch:"8", title:"Interval Estimation", sections:["8.1 Population Mean: sigma Known","8.2 Population Mean: sigma Unknown","8.3 Determining the Sample Size","8.4 Population Proportion"] },
      { ch:"9", title:"Hypothesis Tests", sections:["9.1 Developing Null and Alternative Hypotheses","9.2 Type I and Type II Errors","9.3 Population Mean: sigma Known","9.4 Population Mean: sigma Unknown","9.5 Population Proportion","9.6 Hypothesis Testing and Decision Making","9.7 Calculating the Probability of Type II Errors","9.8 Determining the Sample Size for a Hypothesis Test"] },
      { ch:"14", title:"Simple Linear Regression", sections:["14.1 Simple Linear Regression Model","14.2 Least Squares Method","14.3 Coefficient of Determination","14.4 Model Assumptions","14.5 Testing for Significance","14.6 Using the Estimated Regression Equation for Estimation and Prediction","14.7 Excel and Tools for Regression Analysis","14.8 Residual Analysis: Validating Model Assumptions","14.9 Residual Analysis: Outliers and Influential Observations"] },
    ],
  },
  "Precalculus": {
    color: "#e879f9",
    chapters: [
      { ch:"A", title:"Fundamentals of Algebra", sections:["A.1 Exponents and Radicals","A.2 Polynomials and Factoring","A.3 Rational Expressions","A.4 Solving Equations","A.5 Linear Inequalities in One Variable"] },
      { ch:"1", title:"Functions and Their Graphs", sections:["1.1 Rectangular Coordinates and Graphs of Equations","1.2 Linear Equations and Functions","1.3 Functions and Their Graphs","1.4 Analyzing Graphs of Functions","1.5 Parent Functions","1.6 Transformations of Functions","1.7 Composite and Inverse Functions"] },
      { ch:"2", title:"Polynomial and Rational Functions", sections:["2.1 Quadratic Functions","2.2 Polynomial Functions","2.3 Synthetic Division","2.4 Complex Numbers","2.5 Zeros of Polynomial Functions","2.6 Rational Functions"] },
      { ch:"3", title:"Exponential and Logarithmic Functions", sections:["3.1 Exponential Functions and Their Graphs","3.2 Logarithmic Functions and Their Graphs","3.3 Properties of Logarithms","3.4 Exponential and Logarithmic Equations","3.5 Exponential and Logarithmic Models"] },
      { ch:"4", title:"Trigonometry", sections:["4.1 Radian and Degree Measure","4.2 The Unit Circle","4.3 Right Triangle Trigonometry","4.4 Trigonometric Functions of Any Angle","4.5 Graphs of Sine and Cosine Functions","4.6 Inverse Trigonometric Functions"] },
      { ch:"5", title:"Analytic Trigonometry", sections:["5.1 Using Fundamental Identities","5.2 Verifying Trigonometric Identities","5.3 Solving Trigonometric Equations","5.4 Sum and Difference Formulas","5.5 Multiple-Angle and Product-to-Sum Formulas"] },
    ],
  },
    "Discrete Mathematics": {
    color: "#a855f7",
    chapters: [
      { ch:"1", title:"Speaking Mathematically", sections:["1.1 Variables","1.2 The Language of Sets","1.3 The Language of Relations and Functions","1.4 The Language of Graphs"] },
      { ch:"2", title:"The Logic of Compound Statements", sections:["2.1 Logical Form and Logical Equivalence","2.2 Conditional Statements","2.3 Valid and Invalid Arguments","2.4 Application: Digital Logic Circuits","2.5 Application: Number Systems and Circuits for Addition"] },
      { ch:"3", title:"The Logic of Quantified Statements", sections:["3.1 Predicates and Quantified Statements I","3.2 Predicates and Quantified Statements II","3.3 Statements with Multiple Quantifiers","3.4 Arguments with Quantified Statements"] },
      { ch:"4", title:"Elementary Number Theory and Methods of Proof", sections:["4.1 Direct Proof and Counterexample I: Introduction","4.2 Direct Proof and Counterexample II: Writing Advice","4.3 Direct Proof and Counterexample III: Rational Numbers","4.4 Direct Proof and Counterexample IV: Divisibility","4.5 Direct Proof and Counterexample V: Division into Cases","4.6 Direct Proof and Counterexample VI: Floor and Ceiling","4.7 Indirect Argument: Contradiction and Contraposition","4.8 Indirect Argument: Two Classical Theorems","4.9 Application: Algorithms","4.10 Application: Handshaking"] },
      { ch:"5", title:"Sequences, Mathematical Induction, and Recursion", sections:["5.1 Sequences","5.2 Mathematical Induction I: Proving Formulas","5.3 Mathematical Induction II: Applications","5.4 Strong Mathematical Induction and the Well-Ordering Principle","5.5 Application: Correctness of Algorithms","5.6 Defining Sequences Recursively","5.7 Solving Recurrence Relations by Iteration","5.8 Second-Order Linear Homogeneous Recurrence Relations","5.9 General Recursive Definitions and Structural Induction"] },
      { ch:"6", title:"Set Theory", sections:["6.1 Set Theory: Definitions and the Element Method of Proof","6.2 Properties of Sets","6.3 Disproofs and Algebraic Proofs","6.4 Boolean Algebras, Russell's Paradox, and the Halting Problem"] },
      { ch:"7", title:"Properties of Functions", sections:["7.1 Functions Defined on General Sets","7.2 One-to-One, Onto, and Inverse Functions","7.3 Composition of Functions","7.4 Cardinality with Applications to Computability"] },
      { ch:"8", title:"Properties of Relations", sections:["8.1 Relations on Sets","8.2 Reflexivity, Symmetry, and Transitivity","8.3 Equivalence Relations","8.4 Modular Arithmetic with Applications to Cryptography","8.5 Partial Order Relations"] },
      { ch:"9", title:"Counting and Probability", sections:["9.1 Introduction to Probability","9.2 Possibility Trees and the Multiplication Rule","9.3 Counting Elements of Disjoint Sets: The Addition Rule","9.4 The Pigeonhole Principle","9.5 Counting Subsets of a Set: Combinations","9.6 r-Combinations with Repetition Allowed","9.7 Pascal's Formula and the Binomial Theorem","9.8 Probability Axioms and Expected Value","9.9 Conditional Probability, Bayes' Formula, and Independent Events"] },
      { ch:"10", title:"Theory of Graphs and Trees", sections:["10.1 Trails, Paths, and Circuits","10.2 Matrix Representations of Graphs","10.3 Isomorphisms of Graphs","10.4 Trees: Examples and Basic Properties","10.5 Rooted Trees","10.6 Spanning Trees and a Shortest Path Algorithm"] },
      { ch:"11", title:"Analysis of Algorithm Efficiency", sections:["11.1 Real-Valued Functions of a Real Variable and Their Graphs","11.2 O-, Omega-, and Theta-Notations","11.3 Application: Analysis of Algorithm Efficiency I","11.4 Exponential and Logarithmic Functions: Graphs and Orders","11.5 Application: Analysis of Algorithm Efficiency II"] },
      { ch:"12", title:"Regular Expressions and Finite-State Automata", sections:["12.1 Formal Languages and Regular Expressions","12.2 Finite-State Automata","12.3 Simplifying Finite-State Automata"] },
    ],
  },
};

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
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeXML(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

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
  if (q.hasGraph && q.graphConfig) {
    const gc = q.graphConfig;
    if (gc.type === "area" && (!gc.fnTop || !gc.fnBottom)) issues.push("Area graph missing fnTop or fnBottom");
    if (gc.type === "domain" && !gc.boundary) issues.push("Domain graph missing boundary");
    if (gc.type === "single" && !gc.fn) issues.push("Single curve graph missing fn");
  }

  return issues;
}
// ─── End Question Validator ───────────────────────────────────────────────────

function mathToHTML(s) {
  let r = String(s ?? "");

  // ── Pipe table → HTML table (must do FIRST before any other replacements) ──
  if (isPipeTable(r)) {
    const normalized = normalizePipeTable(r);
    const blocks = splitTableBlocks(normalized);
    return blocks.map(block => {
      if (block.type !== "table") return mathToHTMLInline(block.content);
      // Convert pipe table to HTML table
      const lines = block.content.split("\n").map(l => l.trim()).filter(Boolean);
      const rows = lines.filter(l => !/^\|[-\s|:]+\|$/.test(l))
        .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
      if (!rows.length) return "";
      const tableStyle = 'style="border-collapse:collapse;margin:8px 0;font-size:0.9em;"';
      const thStyle = 'style="border:1px solid #999;padding:4px 10px;background:#dde;text-align:center;font-weight:bold;"';
      const tdStyle = 'style="border:1px solid #ccc;padding:4px 10px;text-align:center;"';
      const tdFirstStyle = 'style="border:1px solid #ccc;padding:4px 10px;font-weight:bold;background:#eef;"';
      const htmlRows = rows.map((row, ri) =>
        `<tr>${row.map((cell, ci) => {
          const tag = ri === 0 ? "th" : "td";
          const style = ri === 0 ? thStyle : ci === 0 ? tdFirstStyle : tdStyle;
          return `<${tag} ${style}>${mathToHTMLInline(cell)}</${tag}>`;
        }).join("")}</tr>`
      ).join("");
      return `<table ${tableStyle}><tbody>${htmlRows}</tbody></table>`;
    }).join("");
  }

  return mathToHTMLInline(r);
}

function mathToHTMLInline(s) {
  let r = String(s ?? "");

  // ── Script operators: L{f(t)}, F{f(t)}, Z{f(t)} — Laplace, Fourier, Z-transform ──
  r = r.replace(/\b([LFZ])\^\{-1\}\{([^{}]+)\}/g, (_, op, inner) => {
    const rendered = inner.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, (__, b, e) => `${b}<sup>${e}</sup>`);
    return `<i>${op}</i><sup>-1</sup>{${rendered}}`;
  });
  r = r.replace(/\b([LFZ])\{([^{}]+)\}/g, (_, op, inner) => {
    const rendered = inner.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, (__, b, e) => `${b}<sup>${e}</sup>`);
    return `<i>${op}</i>{${rendered}}`;
  });

  // ── Logical operators (text → symbol, for Discrete Math) ──
  // Must do before other replacements to avoid partial matches
  r = r.replace(/\bNOT\s+([a-z])\b/g, '~$1');
  r = r.replace(/\b([a-z])\s+AND\s+([a-z])\b/g, '$1 &and; $2');
  r = r.replace(/\b([a-z])\s+OR\s+([a-z])\b/g, '$1 &or; $2');
  r = r.replace(/\(NOT\s+([^)]+)\)/g, '(~$1)');

  // Symbols already in text — pass through as HTML entities
  r = r.replace(/∧/g, '&and;');
  r = r.replace(/∨/g, '&or;');
  r = r.replace(/~/g, '~');
  r = r.replace(/→/g, '&rarr;');
  r = r.replace(/↔/g, '&harr;');

  // Set notation
  r = r.replace(/\bunion\b/gi, '&cup;');
  r = r.replace(/\bintersect(?:ion)?\b/gi, '&cap;');
  r = r.replace(/\bsubset\b/gi, '&sub;');
  r = r.replace(/\bin\b(?=\s)/g, '&isin;');

  // Greek letters
  r = r.replace(/\btheta\b/gi, '&theta;');
  r = r.replace(/\bphi\b/gi, '&phi;');
  r = r.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, '&pi;');
  r = r.replace(/\brho\b/gi, '&rho;');
  r = r.replace(/\balpha\b/gi, '&alpha;');
  r = r.replace(/\bbeta\b/gi, '&beta;');
  r = r.replace(/\bgamma\b/gi, '&gamma;');
  r = r.replace(/\bdelta\b/gi, '&delta;');
  r = r.replace(/\blambda\b/gi, '&lambda;');
  r = r.replace(/\bsigma\b/gi, '&sigma;');
  r = r.replace(/\bmu\b/gi, '&mu;');
  r = r.replace(/\binfinity\b/gi, '&infin;');
  r = r.replace(/\binf\b/g, '&infin;');

  // sqrt
  let prev;
  do {
    prev = r;
    r = r.replace(/sqrt\(([^()]+)\)/g, (_, inner) => `&radic;(${inner})`);
  } while (r !== prev);

  // integral
  r = r.replace(/integral from ([^\s]+) to ([^\s]+) of/gi,
    (_, a, b) => `&int;<sub>${a}</sub><sup>${b}</sup>`);
  r = r.replace(/\bintegral of\b/gi, '&int;');

  // inequality symbols
  r = r.replace(/!=/g, '&ne;');
  r = r.replace(/(?<![<>])<=(?![>])/g, '&le;');
  r = r.replace(/(?<![<>])>=(?![<])/g, '&ge;');

  // lim as x->a  /  \lim_{x->a}  /  lim_{x→a}
  r = r.replace(/\\lim_\{([^}]+)\}/g,
    (_, sub) => `lim<sub>${sub.replace(/\\to/g,'&rarr;').replace(/->/g,'&rarr;')}</sub>`);
  r = r.replace(/\blim_\{([^}]+)\}/gi,
    (_, sub) => `lim<sub>${sub.replace(/\\to/g,'&rarr;').replace(/->/g,'&rarr;')}</sub>`);
  r = r.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)\s*of\b/gi,
    (_, v, a) => `lim<sub>${v}&rarr;${a}</sub>`);
  r = r.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)/gi,
    (_, v, a) => `lim<sub>${v}&rarr;${a}</sub>`);

  // exponents
  r = r.replace(/\(([^()]+)\)\^\(([0-9-]+)\/([0-9]+)\)/g,
    (_, b, n, d) => `(${b})<sup>${n}/${d}</sup>`);
  r = r.replace(/\(([^()]+)\)\^(-?[0-9a-zA-Z]+)/g,
    (_, b, e) => `(${b})<sup>${e}</sup>`);
  r = r.replace(/([a-zA-Z0-9])\^\(([0-9-]+)\/([0-9]+)\)/g,
    (_, b, n, d) => `${b}<sup>${n}/${d}</sup>`);
  r = r.replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g,
    (_, b, e) => `${b}<sup>${e}</sup>`);
  r = r.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g,
    (_, b, e) => `${b}<sup>${e}</sup>`);

  // fractions
  r = r.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,
    (_, n, d) => `(${n})&frasl;(${d})`);
  r = r.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_, n, d) => `${n}&frasl;${d}`);

  // operators
  r = r.replace(/\*/g, '&middot;');
  r = r.replace(/<=/g, '&le;').replace(/>=/g, '&ge;');
  r = r.replace(/!=/g, '&ne;');

  return r;
}

// ─── Graph Engine ─────────────────────────────────────────────────────────────
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

function evalFn(exprRaw, xVal) {
  try {
    let expr = String(exprRaw ?? "")
      // operators
      .replace(/\^/g, "**")
      // implicit multiplication: 2x → 2*x, 3sin → 3*Math.sin, (x+1)(x-1) → (x+1)*(x-1)
      .replace(/(\d)\s*([a-zA-Z(])/g, "$1*$2")
      .replace(/([)\d])\s*\(/g, "$1*(")
      // trig
      .replace(/\bsin\b/g,    "Math.sin")
      .replace(/\bcos\b/g,    "Math.cos")
      .replace(/\btan\b/g,    "Math.tan")
      .replace(/\bsec\b/g,    "(1/Math.cos)")
      .replace(/\bcsc\b/g,    "(1/Math.sin)")
      .replace(/\bcot\b/g,    "(1/Math.tan)")
      .replace(/\barcsin\b/g, "Math.asin")
      .replace(/\barccos\b/g, "Math.acos")
      .replace(/\barctan\b/g, "Math.atan")
      .replace(/\basin\b/g,   "Math.asin")
      .replace(/\bacos\b/g,   "Math.acos")
      .replace(/\batan\b/g,   "Math.atan")
      .replace(/\bsinh\b/g,   "Math.sinh")
      .replace(/\bcosh\b/g,   "Math.cosh")
      .replace(/\btanh\b/g,   "Math.tanh")
      // roots & abs
      .replace(/\bsqrt\b/g,   "Math.sqrt")
      .replace(/\bcbrt\b/g,   "Math.cbrt")
      .replace(/\babs\b/g,    "Math.abs")
      // logs
      .replace(/\bln\b/g,     "Math.log")
      .replace(/\blog10\b/g,  "Math.log10")
      .replace(/\blog2\b/g,   "Math.log2")
      .replace(/\blog\b/g,    "Math.log10")
      // exp
      .replace(/\bexp\b/g,    "Math.exp")
      // constants
      .replace(/\bpi\b/gi,    "Math.PI")
      .replace(/\bPI\b/g,     "Math.PI")
      // e as constant — careful not to replace 'e' inside words like 'exp'
      .replace(/(?<![a-zA-Z])e(?![a-zA-Z0-9_])/g, "Math.E")
      // floor/ceil
      .replace(/\bfloor\b/g,  "Math.floor")
      .replace(/\bceil\b/g,   "Math.ceil")
      .replace(/\bround\b/g,  "Math.round")
      // max/min
      .replace(/\bmax\b/g,    "Math.max")
      .replace(/\bmin\b/g,    "Math.min");
    // eslint-disable-next-line no-new-func
    const result = Function("x", `"use strict"; return (${expr});`)(xVal);
    return (isFinite(result) && !isNaN(result)) ? result : NaN;
  } catch { return NaN; }
}

function renderGraphToSVG(graphConfig, width = 480, height = 300) {
  if (typeof window === "undefined" || !window.d3) return null;
  const d3  = window.d3;
  const cfg = graphConfig || {};

  const showNumbers = cfg.showAxisNumbers !== false;
  const showGrid    = cfg.showGrid !== false;
  const xDom = cfg.xDomain || [-5, 5];

  // Auto-scale yDomain from function values if not provided
  let yDom = cfg.yDomain || null;
  if (!yDom) {
    const fns = [];
    if (cfg.fn) fns.push(cfg.fn);
    if (cfg.fnTop) fns.push(cfg.fnTop);
    if (cfg.fnBottom) fns.push(cfg.fnBottom);
    if (cfg.boundary) fns.push(cfg.boundary);
    if (cfg.pieces) cfg.pieces.forEach(p => fns.push(p.fn));
    if (fns.length) {
      const xs = Array.from({length:400}, (_,i) => xDom[0] + (xDom[1]-xDom[0])*i/399);
      const allY = [];
      fns.forEach(fn => xs.forEach(x => {
        const y = evalFn(fn, x);
        if (isFinite(y) && !isNaN(y)) allY.push(y);
      }));
      if (allY.length) {
        // remove outliers — ignore top/bottom 2% to handle asymptotes (tan, 1/x etc)
        allY.sort((a,b) => a-b);
        const trim = Math.max(1, Math.floor(allY.length * 0.02));
        const trimmed = allY.slice(trim, allY.length - trim);
        const yMin = trimmed[0];
        const yMax = trimmed[trimmed.length - 1];
        const pad = (yMax - yMin) * 0.18 || 1;
        yDom = [
          Math.round((yMin - pad) * 10) / 10,
          Math.round((yMax + pad) * 10) / 10
        ];
      }
    }
    yDom = yDom || [-5, 5];
  }

  const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgNode.setAttribute("xmlns",   "http://www.w3.org/2000/svg");
  svgNode.setAttribute("width",   String(width));
  svgNode.setAttribute("height",  String(height));
  svgNode.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 22, right: 36, bottom: 34, left: 42 };
  const iW = width  - margin.left - margin.right;
  const iH = height - margin.top  - margin.bottom;

  const xScale = d3.scaleLinear().domain(xDom).range([0, iW]);
  const yScale = d3.scaleLinear().domain(yDom).range([iH, 0]);

  const svg = d3.select(svgNode);
  // Define clip path so curves are clipped cleanly at plot edges
  const clipId = `clip_${Math.random().toString(36).slice(2,8)}`;
  svg.append("defs").append("clipPath").attr("id", clipId)
    .append("rect").attr("x", 0).attr("y", 0).attr("width", iW).attr("height", iH);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  // curves group with clip applied
  const gClip = g.append("g").attr("clip-path", `url(#${clipId})`);

  // hardcoded colours — CSS vars won't resolve in detached/offscreen SVG
  const COL = {
    text:  "#1a1a1a", muted: "#888888", grid:  "#e0e0e0",
    blue:  "#185FA5", red:   "#E24B4A", green: "#1D9E75", shade: "#378ADD",
  };

  // Smart tick generator — max 10 ticks, rounded step
  function smartTicks(min, max, maxTicks=10) {
    const range = max - min;
    const rawStep = range / maxTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.ceil(rawStep / mag) * mag;
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let t = start; t <= max + 0.001; t += step) ticks.push(Math.round(t * 1000) / 1000);
    return ticks;
  }

  function drawGrid() {
    if (!showGrid) return;
    smartTicks(xDom[0], xDom[1]).forEach(t => {
      g.append("line").attr("x1", xScale(t)).attr("x2", xScale(t))
        .attr("y1", 0).attr("y2", iH).attr("stroke", COL.grid).attr("stroke-width", 0.5);
    });
    smartTicks(yDom[0], yDom[1]).forEach(t => {
      g.append("line").attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("x1", 0).attr("x2", iW).attr("stroke", COL.grid).attr("stroke-width", 0.5);
    });
  }

  function drawAxes() {
    g.append("line").attr("x1", xScale(0)).attr("x2", xScale(0))
      .attr("y1", 0).attr("y2", iH).attr("stroke", COL.text).attr("stroke-width", 1.5);
    g.append("line").attr("x1", 0).attr("x2", iW)
      .attr("y1", yScale(0)).attr("y2", yScale(0)).attr("stroke", COL.text).attr("stroke-width", 1.5);
    g.append("text").attr("x", iW + 5).attr("y", yScale(0) + 4)
      .attr("fill", COL.text).attr("font-size", 13).attr("font-family", "sans-serif").text("x");
    g.append("text").attr("x", xScale(0) + 4).attr("y", -6)
      .attr("fill", COL.text).attr("font-size", 13).attr("font-family", "sans-serif").text("y");
  }

  function drawAxisNumbers() {
    if (!showNumbers) return;
    smartTicks(xDom[0], xDom[1]).filter(t => t !== 0).forEach(t => {
      g.append("text").attr("x", xScale(t)).attr("y", yScale(0) + 15)
        .attr("text-anchor", "middle").attr("fill", COL.muted)
        .attr("font-size", 10).attr("font-family", "sans-serif").text(t);
    });
    smartTicks(yDom[0], yDom[1]).filter(t => t !== 0).forEach(t => {
      g.append("text").attr("x", xScale(0) - 6).attr("y", yScale(t) + 4)
        .attr("text-anchor", "end").attr("fill", COL.muted)
        .attr("font-size", 10).attr("font-family", "sans-serif").text(t);
    });
  }

  function drawCurve(fnExpr, domainOverride, color, dashed) {
    const [x0, x1] = domainOverride || xDom;
    const step = (x1 - x0) / 300;
    const pts = d3.range(x0, x1 + step * 0.5, step)
      .map(x => [x, evalFn(fnExpr, x)])
      .filter(([, y]) => isFinite(y));
    if (!pts.length) return;
    const line = d3.line()
      .x(d => xScale(d[0]))
      .y(d => yScale(d[1]))
      .defined(d => isFinite(d[1]));
    gClip.append("path").datum(pts).attr("d", line)
      .attr("fill", "none").attr("stroke", color || COL.blue).attr("stroke-width", 2.5)
      .attr("stroke-dasharray", dashed ? "6,4" : "none");
  }

  function drawOpenCircle(x, y, color) {
    g.append("circle").attr("cx", xScale(x)).attr("cy", yScale(y)).attr("r", 4)
      .attr("fill", "white").attr("stroke", color || COL.blue).attr("stroke-width", 2);
  }

  function drawFilledDot(x, y, color) {
    g.append("circle").attr("cx", xScale(x)).attr("cy", yScale(y)).attr("r", 4)
      .attr("fill", color || COL.blue).attr("stroke", "none");
  }

  function drawShadePolygon(topFnExpr, bottomFnExpr, x0, x1, fillColor) {
    const step = (x1 - x0) / 300;
    const xs = d3.range(x0, x1 + step * 0.5, step);
    const topPts = xs.map(x => {
      const y = evalFn(topFnExpr, x);
      return isFinite(y) ? { x: xScale(x), y: yScale(Math.max(yDom[0], Math.min(yDom[1], y))) } : null;
    }).filter(Boolean);
    const botPts = xs.map(x => {
      const y = evalFn(bottomFnExpr, x);
      return isFinite(y) ? { x: xScale(x), y: yScale(Math.max(yDom[0], Math.min(yDom[1], y))) } : null;
    }).filter(Boolean);
    if (!topPts.length || !botPts.length) return;
    const poly = [...topPts, ...[...botPts].reverse()];
    gClip.append("polygon").attr("points", poly.map(p => `${p.x},${p.y}`).join(" "))
      .attr("fill", fillColor || COL.shade).attr("fill-opacity", 0.25).attr("stroke", "none");
  }

  function drawDomainShade(boundaryFnExpr, shadeAbove, halfX) {
    const xEdge  = Math.sqrt(Math.max(0, yDom[1]));
    const xStart = halfX ? 0 : -xEdge;
    const xs     = d3.range(xStart, xEdge + 0.01, xEdge / 150);
    const parPts = xs.map(x => ({ x: xScale(x), y: yScale(evalFn(boundaryFnExpr, x)) }));
    let poly;
    if (shadeAbove) {
      poly = [{ x: xScale(xStart), y: 0 }, { x: xScale(xEdge), y: 0 }, ...parPts.slice().reverse()];
    } else {
      const allXs  = d3.range(-xEdge, xEdge + 0.01, xEdge / 150);
      const allPts = allXs.map(x => ({ x: xScale(x), y: yScale(evalFn(boundaryFnExpr, x)) }));
      poly = [...allPts, { x: xScale(xEdge), y: yScale(0) }, { x: xScale(-xEdge), y: yScale(0) }];
    }
    gClip.append("polygon").attr("points", poly.map(p => `${p.x},${p.y}`).join(" "))
      .attr("fill", COL.green).attr("fill-opacity", 0.22).attr("stroke", "none");
  }

  // ── multi: 2×2 grid ──────────────────────────────────────────────────────
  if (cfg.type === "multi") {
    const options = cfg.options || [];
    const cellW = Math.floor(width  / 2);
    const cellH = Math.floor(height / 2);
    const labels = ["A", "B", "C", "D"];
    options.forEach((opt, idx) => {
      const ox   = (idx % 2) * cellW;
      const oy   = Math.floor(idx / 2) * cellH;
      const cell = svg.append("g").attr("transform", `translate(${ox},${oy})`);
      const mm   = { top: 18, right: 12, bottom: 22, left: 28 };
      const mW   = cellW - mm.left - mm.right;
      const mH   = cellH - mm.top  - mm.bottom;
      const mx   = d3.scaleLinear().domain(xDom).range([0, mW]);
      const my   = d3.scaleLinear().domain(yDom).range([mH, 0]);
      const inn  = cell.append("g").attr("transform", `translate(${mm.left},${mm.top})`);

      cell.append("text").attr("x", mm.left).attr("y", 13)
        .attr("fill", COL.text).attr("font-size", 12).attr("font-weight", "bold")
        .attr("font-family", "sans-serif").text(labels[idx]);

      if (showGrid) {
        smartTicks(xDom[0], xDom[1], 6).forEach(t => {
          inn.append("line").attr("x1", mx(t)).attr("x2", mx(t))
            .attr("y1", 0).attr("y2", mH).attr("stroke", COL.grid).attr("stroke-width", 0.5);
        });
        smartTicks(yDom[0], yDom[1], 6).forEach(t => {
          inn.append("line").attr("y1", my(t)).attr("y2", my(t))
            .attr("x1", 0).attr("x2", mW).attr("stroke", COL.grid).attr("stroke-width", 0.5);
        });
      }
      inn.append("line").attr("x1", mx(0)).attr("x2", mx(0)).attr("y1", 0).attr("y2", mH).attr("stroke", COL.text).attr("stroke-width", 1.2);
      inn.append("line").attr("x1", 0).attr("x2", mW).attr("y1", my(0)).attr("y2", my(0)).attr("stroke", COL.text).attr("stroke-width", 1.2);

      if (showNumbers) {
        smartTicks(xDom[0], xDom[1], 5).filter(t => t !== 0).forEach(t => {
          inn.append("text").attr("x", mx(t)).attr("y", my(0) + 12)
            .attr("text-anchor", "middle").attr("fill", COL.muted)
            .attr("font-size", 8).attr("font-family", "sans-serif").text(t);
        });
        smartTicks(yDom[0], yDom[1], 5).filter(t => t !== 0).forEach(t => {
          inn.append("text").attr("x", mx(0) - 4).attr("y", my(t) + 3)
            .attr("text-anchor", "end").attr("fill", COL.muted)
            .attr("font-size", 8).attr("font-family", "sans-serif").text(t);
        });
      }

      const xEdge  = Math.sqrt(Math.max(0, yDom[1]));
      const xStart = opt.halfX ? 0 : -xEdge;
      const xs     = d3.range(xStart, xEdge + 0.01, xEdge / 120);
      const parPts = xs.map(x => ({ x: mx(x), y: my(evalFn(cfg.boundary, x)) }));
      let poly;
      if (opt.shadeAbove) {
        poly = [{ x: mx(xStart), y: 0 }, { x: mx(xEdge), y: 0 }, ...parPts.slice().reverse()];
      } else {
        const allXs  = d3.range(-xEdge, xEdge + 0.01, xEdge / 120);
        const allPts = allXs.map(x => ({ x: mx(x), y: my(evalFn(cfg.boundary, x)) }));
        poly = [...allPts, { x: mx(xEdge), y: my(0) }, { x: mx(-xEdge), y: my(0) }];
      }
      inn.append("polygon").attr("points", poly.map(p => `${p.x},${p.y}`).join(" "))
        .attr("fill", COL.green).attr("fill-opacity", 0.22).attr("stroke", "none");

      const bPts = d3.range(-xEdge - 0.1, xEdge + 0.11, xEdge / 120)
        .filter(x => !opt.halfX || x >= 0)
        .map(x => [x, evalFn(cfg.boundary, x)]);
      const miniClipId = `miniclip_${Math.random().toString(36).slice(2,8)}`;
      cell.append("defs").append("clipPath").attr("id", miniClipId)
        .append("rect").attr("x", mm.left).attr("y", mm.top).attr("width", mW).attr("height", mH);
      const lineGen = d3.line().x(d => mx(d[0])).y(d => my(d[1])).defined(d => isFinite(d[1]));
      inn.append("path").datum(bPts).attr("d", lineGen)
        .attr("fill", "none").attr("stroke", COL.red).attr("stroke-width", 1.8)
        .attr("stroke-dasharray", opt.dashed ? "5,3" : "none")
        .attr("clip-path", `url(#${miniClipId})`);
    });
    return svgNode;
  }

  // ── single / piecewise / area / domain ───────────────────────────────────
  drawGrid();
  drawAxes();
  drawAxisNumbers();

  const showLabel = cfg.showFnLabel !== false;

  // helper: find a good x position for a label that stays within the plot
  function labelX(fn, preferRight) {
    const xTry = preferRight
      ? xDom[0] + (xDom[1] - xDom[0]) * 0.75
      : xDom[0] + (xDom[1] - xDom[0]) * 0.25;
    const y = evalFn(fn, xTry);
    if (isFinite(y) && y >= yDom[0] + 0.5 && y <= yDom[1] - 0.5) return xTry;
    // fallback: scan for a good x
    for (let t = 0.5; t <= 0.9; t += 0.1) {
      const x2 = xDom[0] + (xDom[1] - xDom[0]) * t;
      const y2 = evalFn(fn, x2);
      if (isFinite(y2) && y2 >= yDom[0] + 0.5 && y2 <= yDom[1] - 0.8) return x2;
    }
    return xTry;
  }

  if (cfg.type === "single") {
    drawCurve(cfg.fn, null, COL.blue, false);
    (cfg.holes  || []).forEach(([x, y]) => drawOpenCircle(x, y, COL.blue));
    (cfg.points || []).forEach(([x, y]) => drawFilledDot(x, y, COL.blue));
    if (showLabel && cfg.fn) {
      const lx = labelX(cfg.fn, true);
      const ly = evalFn(cfg.fn, lx);
      if (isFinite(ly) && ly >= yDom[0] && ly <= yDom[1]) {
        const above = ly < yDom[1] - 0.8;
        g.append("text").attr("x", xScale(lx)).attr("y", yScale(ly) + (above ? -8 : 14))
          .attr("fill", COL.blue).attr("font-size", 12).attr("font-style", "italic").attr("font-family", "sans-serif")
          .text(cfg.fnLabel || "f(x)");
      }
    }

  } else if (cfg.type === "piecewise") {
    (cfg.pieces || []).forEach(p => drawCurve(p.fn, p.domain, COL.blue, false));
    (cfg.holes  || []).forEach(([x, y]) => drawOpenCircle(x, y, COL.blue));
    (cfg.points || []).forEach(([x, y]) => drawFilledDot(x, y, COL.blue));
    if (showLabel && cfg.pieces?.length) {
      const last = cfg.pieces[cfg.pieces.length - 1];
      const lx = last.domain?.[1] ? last.domain[1] * 0.85 : labelX(last.fn, true);
      const ly = evalFn(last.fn, lx);
      if (isFinite(ly) && ly >= yDom[0] && ly <= yDom[1]) {
        g.append("text").attr("x", xScale(lx)).attr("y", yScale(ly) - 8)
          .attr("fill", COL.blue).attr("font-size", 12).attr("font-style", "italic").attr("font-family", "sans-serif")
          .text(cfg.fnLabel || "f(x)");
      }
    }

  } else if (cfg.type === "area") {
    const x0 = cfg.shadeFrom ?? xDom[0];
    const x1 = cfg.shadeTo   ?? xDom[1];
    // auto-detect which function is actually on top at the midpoint
    const xMid = (x0 + x1) / 2;
    const yA = evalFn(cfg.fnTop, xMid);
    const yB = evalFn(cfg.fnBottom, xMid);
    const actualTop = (isFinite(yA) && isFinite(yB) && yB > yA) ? cfg.fnBottom : cfg.fnTop;
    const actualBot = (isFinite(yA) && isFinite(yB) && yB > yA) ? cfg.fnTop    : cfg.fnBottom;
    const topLabel = (isFinite(yA) && isFinite(yB) && yB > yA) ? (cfg.fnBottomLabel || "f(x)") : (cfg.fnTopLabel    || "f(x)");
    const botLabel = (isFinite(yA) && isFinite(yB) && yB > yA) ? (cfg.fnTopLabel    || "g(x)") : (cfg.fnBottomLabel || "g(x)");
    drawShadePolygon(actualTop, actualBot, x0, x1, COL.shade);
    drawCurve(actualTop, null, COL.blue, false);
    drawCurve(actualBot, null, COL.red,  false);
    // Only draw intersection dot if the two curves are actually equal at that x
    [[x0, evalFn(actualTop, x0)], [x1, evalFn(actualTop, x1)]].forEach(([x, y]) => {
      const yTop = evalFn(actualTop, x);
      const yBot = evalFn(actualBot, x);
      const isRealIntersection = isFinite(yTop) && isFinite(yBot) && Math.abs(yTop - yBot) < (yDom[1]-yDom[0]) * 0.06;
      if (isRealIntersection) drawFilledDot(x, y, COL.text);
    });
    if (showLabel) {
      // label top curve — try right of shaded region first, fallback to left
      const lxRight = x1 + (xDom[1] - x1) * 0.4;
      const lxLeft  = xDom[0] + (x0 - xDom[0]) * 0.4;
      const tryLabelX = (fn, color, offset) => {
        for (const lx of [lxRight, lxLeft, (x0+x1)/2]) {
          const ly = evalFn(fn, lx);
          if (isFinite(ly) && ly >= yDom[0] && ly <= yDom[1]) {
            g.append("text").attr("x", xScale(lx)).attr("y", yScale(ly) + offset)
              .attr("fill", color).attr("font-size", 12).attr("font-style", "italic").attr("font-family", "sans-serif");
            return { lx, ly };
          }
        }
      };
      // Smart label placement — follow each curve in both x and y
      // Avoid intersection points (shadeFrom, shadeTo) and find where curves have good gap
      const intersections = [x0, x1]; // don't label near these
      const avoidRadius = (x1 - x0) * 0.12; // stay this far from intersections

      const labelCandidates = [0.75, 0.60, 0.50, 0.85, 0.40, 0.30, 0.90];
      let lxLabel = xDom[0] + (xDom[1] - xDom[0]) * 0.75;
      for (const frac of labelCandidates) {
        const xTry = xDom[0] + (xDom[1] - xDom[0]) * frac;
        // skip if too close to an intersection
        const nearIntersection = intersections.some(ix => Math.abs(xTry - ix) < avoidRadius);
        if (nearIntersection) continue;
        const yT = evalFn(actualTop, xTry);
        const yB = evalFn(actualBot, xTry);
        const gap = Math.abs(yT - yB);
        if (isFinite(yT) && isFinite(yB) &&
            gap > (yDom[1]-yDom[0]) * 0.06 && // need visible gap between curves
            yT >= yDom[0] + (yDom[1]-yDom[0])*0.05 &&
            yT <= yDom[1] - (yDom[1]-yDom[0])*0.05 &&
            yB >= yDom[0] + (yDom[1]-yDom[0])*0.02 &&
            yB <= yDom[1] - (yDom[1]-yDom[0])*0.02) {
          lxLabel = xTry;
          break;
        }
      }

      const lyTopAt = evalFn(actualTop, lxLabel);
      const lyBotAt = evalFn(actualBot, lxLabel);
      const clamp = (y) => Math.min(yDom[1], Math.max(yDom[0], y));

      // pixel y positions on each curve
      const pxTop = isFinite(lyTopAt) ? yScale(clamp(lyTopAt)) : null;
      const pxBot = isFinite(lyBotAt) ? yScale(clamp(lyBotAt)) : null;

      // per-curve offsets (from graphConfig)
      const tOffX = cfg.topLabelOffsetX || 0;
      const tOffY = cfg.topLabelOffsetY || 0;
      const bOffX = cfg.botLabelOffsetX || 0;
      const bOffY = cfg.botLabelOffsetY || 0;

      // top label: above the top curve + offset
      if (pxTop !== null) {
        g.append("text")
          .attr("x", xScale(lxLabel) + tOffX)
          .attr("y", pxTop - 9 + tOffY)
          .attr("fill", COL.blue).attr("font-size", 12).attr("font-style", "italic")
          .attr("font-family", "sans-serif").text(topLabel);
      }

      // bottom label: below the bottom curve + offset
      // enforce minimum pixel gap from top label (unless overridden by offset)
      if (pxBot !== null) {
        const topLabelBottom = pxTop !== null ? pxTop - 9 + 14 : -9999;
        const naturalY = pxBot + 16 + bOffY;
        const autoY = naturalY < topLabelBottom + 4 ? topLabelBottom + 18 : naturalY;
        const finalY = bOffY !== 0 ? naturalY : autoY; // if user set offset, respect it exactly
        g.append("text")
          .attr("x", xScale(lxLabel) + bOffX)
          .attr("y", finalY)
          .attr("fill", COL.red).attr("font-size", 12).attr("font-style", "italic")
          .attr("font-family", "sans-serif").text(botLabel);
      }
    }

  } else if (cfg.type === "domain") {
    drawDomainShade(cfg.boundary, cfg.shadeAbove !== false, false);
    drawCurve(cfg.boundary, null, COL.red, cfg.boundaryDashed !== false);
    if (showLabel) {
      const lx = xDom[0] + (xDom[1] - xDom[0]) * 0.65;
      const ly = evalFn(cfg.boundary, lx);
      if (isFinite(ly) && ly >= yDom[0] && ly <= yDom[1]) {
        g.append("text").attr("x", xScale(lx)).attr("y", yScale(ly) + 16)
          .attr("fill", COL.red).attr("font-size", 12).attr("font-style", "italic").attr("font-family", "sans-serif")
          .text(cfg.boundaryLabel || "boundary");
      }
    }
  }

  return svgNode;
}

// ── Convert graphConfig → base64 PNG (used by QTI and Word export) ───────────
async function graphToBase64PNG(graphConfig, width = 480, height = 300) {
  return new Promise((resolve, reject) => {
    try {
      const svgNode = renderGraphToSVG(graphConfig, width, height);
      if (!svgNode) { resolve(null); return; }
      const svgStr  = new XMLSerializer().serializeToString(svgNode);
      const url     = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
      const img     = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    } catch (e) { reject(e); }
  });
}
// ─── QM Statistical Chart Renderer ──────────────────────────────────────────
function renderStatChartToSVG(chartConfig, width=480, height=300) {
  if (typeof window === "undefined" || !window.d3) return null;
  const d3 = window.d3;
  // normalize standard_normal alias
  const rawCfg = chartConfig || {};
  const cfg = rawCfg.type === "standard_normal"
    ? { ...rawCfg, type: "continuous_dist", distType: "standard_normal", mu: 0, sigma: 1 }
    : rawCfg;
  const margin = {top:30, right:30, bottom:55, left:55};
  const iW = width  - margin.left - margin.right;
  const iH = height - margin.top  - margin.bottom;

  const svgNode = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svgNode.setAttribute("width", width);
  svgNode.setAttribute("height", height);
  svgNode.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const svg = d3.select(svgNode);
  svg.append("rect").attr("width",width).attr("height",height).attr("fill","#ffffff");
  const g = svg.append("g").attr("transform",`translate(${margin.left},${margin.top})`);

  const COL = { blue:"#185FA5", red:"#E24B4A", green:"#1D9E75", shade:"#378ADD",
                text:"#1a1a1a", muted:"#888888", grid:"#e8e8e8", bar:"#185FA5", barHl:"#E24B4A" };

  const showGrid    = cfg.showGrid    !== false;
  const showNumbers = cfg.showAxisNumbers !== false;

  function gridLine(x1,y1,x2,y2) {
    if (!showGrid) return;
    g.append("line").attr("x1",x1).attr("y1",y1).attr("x2",x2).attr("y2",y2)
      .attr("stroke",COL.grid).attr("stroke-width",0.8);
  }
  function axisNum(val, x, y, anchor="middle", size=10) {
    if (!showNumbers) return;
    axisLabel(val, x, y, anchor, size);
  }
  function axisLabel(text, x, y, anchor="middle", size=11) {
    g.append("text").attr("x",x).attr("y",y).attr("text-anchor",anchor)
      .attr("font-size",size).attr("font-family","sans-serif").attr("fill",COL.text).text(text);
  }

  // ── Bar Chart ──────────────────────────────────────────────────────────────
  if (cfg.type === "bar") {
    const labels = cfg.labels || [];
    const values = cfg.values || [];
    const xScale = d3.scaleBand().domain(labels).range([0,iW]).padding(0.25);
    const yMax   = d3.max(values) * 1.15 || 10;
    const yScale = d3.scaleLinear().domain([0,yMax]).range([iH,0]);
    // grid
    d3.ticks(0, yMax, 6).forEach(t => { gridLine(0,yScale(t),iW,yScale(t)); });
    // bars
    labels.forEach((lbl,i) => {
      const x = xScale(lbl);
      const bw = xScale.bandwidth();
      const highlighted = cfg.highlight === lbl || cfg.highlight === i;
      g.append("rect").attr("x",x).attr("y",yScale(values[i]))
        .attr("width",bw).attr("height",iH-yScale(values[i]))
        .attr("fill", highlighted ? COL.barHl : COL.bar).attr("rx",2);
      if (showNumbers) {
        g.append("text").attr("x",x+bw/2).attr("y",yScale(values[i])-5)
          .attr("text-anchor","middle").attr("font-size",10).attr("fill",COL.text).text(values[i]);
        g.append("text").attr("x",x+bw/2).attr("y",iH+15)
          .attr("text-anchor","middle").attr("font-size",10).attr("fill",COL.text).text(lbl);
      }
    });
    // axes
    g.append("line").attr("x1",0).attr("y1",iH).attr("x2",iW).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    g.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    if (showNumbers) d3.ticks(0, yMax, 6).forEach(t => { axisLabel(t, -8, yScale(t)+4, "end", 10); });
    if (cfg.xLabel) axisLabel(cfg.xLabel, iW/2, iH+42);
    if (cfg.yLabel) g.append("text").attr("transform",`translate(-40,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel);
    if (cfg.title)  axisLabel(cfg.title, iW/2, -12, "middle", 13);
  }

  // ── Histogram ─────────────────────────────────────────────────────────────
  else if (cfg.type === "histogram") {
    const bins   = cfg.bins   || [];   // [{x0, x1, count}]
    const counts = bins.map(b => b.count||0);
    const yMax   = d3.max(counts) * 1.15 || 10;
    const xMin   = bins[0]?.x0 ?? 0;
    const xMax   = bins[bins.length-1]?.x1 ?? 10;
    const xScale = d3.scaleLinear().domain([xMin,xMax]).range([0,iW]);
    const yScale = d3.scaleLinear().domain([0,yMax]).range([iH,0]);
    d3.ticks(0,yMax,6).forEach(t => { gridLine(0,yScale(t),iW,yScale(t)); });
    bins.forEach(b => {
      const x = xScale(b.x0), w = xScale(b.x1)-xScale(b.x0)-1;
      g.append("rect").attr("x",x).attr("y",yScale(b.count)).attr("width",w)
        .attr("height",iH-yScale(b.count)).attr("fill",COL.bar).attr("stroke","#fff").attr("stroke-width",1);
      if (w > 20) g.append("text").attr("x",x+w/2).attr("y",yScale(b.count)-5)
        .attr("text-anchor","middle").attr("font-size",10).attr("fill",COL.text).text(b.count);
    });
    g.append("line").attr("x1",0).attr("y1",iH).attr("x2",iW).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    g.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    // x axis ticks
    if (showNumbers) {
      bins.forEach(b => { axisLabel(b.x0, xScale(b.x0), iH+15, "middle", 10); });
      axisLabel(bins[bins.length-1]?.x1 ?? xMax, xScale(xMax), iH+15, "middle", 10);
      d3.ticks(0,yMax,6).forEach(t => { axisLabel(t,-8,yScale(t)+4,"end",10); });
    }
    if (cfg.xLabel) axisLabel(cfg.xLabel, iW/2, iH+42);
    if (cfg.yLabel) g.append("text").attr("transform",`translate(-40,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel);
    if (cfg.title)  axisLabel(cfg.title, iW/2, -12, "middle", 13);
  }

  // ── Scatter Plot ──────────────────────────────────────────────────────────
  else if (cfg.type === "scatter") {
    const points = cfg.points || []; // [{x,y}]
    const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
    const xMin = d3.min(xs)||0, xMax = d3.max(xs)||10;
    const yMin = d3.min(ys)||0, yMax = d3.max(ys)||10;
    const xPad = (xMax-xMin)*0.1||1, yPad = (yMax-yMin)*0.1||1;
    const xScale = d3.scaleLinear().domain([xMin-xPad, xMax+xPad]).range([0,iW]);
    const yScale = d3.scaleLinear().domain([yMin-yPad, yMax+yPad]).range([iH,0]);
    d3.ticks(xMin-xPad,xMax+xPad,6).forEach(t => { gridLine(xScale(t),0,xScale(t),iH); });
    d3.ticks(yMin-yPad,yMax+yPad,6).forEach(t => { gridLine(0,yScale(t),iW,yScale(t)); });
    // regression line if provided
    if (cfg.regressionLine) {
      const {slope, intercept} = cfg.regressionLine;
      const rx1=xMin-xPad, rx2=xMax+xPad;
      g.append("line").attr("x1",xScale(rx1)).attr("y1",yScale(slope*rx1+intercept))
        .attr("x2",xScale(rx2)).attr("y2",yScale(slope*rx2+intercept))
        .attr("stroke",COL.red).attr("stroke-width",1.8).attr("stroke-dasharray","5,3");
    }
    points.forEach(p => {
      g.append("circle").attr("cx",xScale(p.x)).attr("cy",yScale(p.y)).attr("r",5)
        .attr("fill",COL.blue).attr("fill-opacity",0.75).attr("stroke","#fff").attr("stroke-width",1);
    });
    g.append("line").attr("x1",0).attr("y1",iH).attr("x2",iW).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    g.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    if (showNumbers) {
      d3.ticks(xMin-xPad,xMax+xPad,6).forEach(t => { axisLabel(Math.round(t*10)/10,xScale(t),iH+18,"middle",10); });
      d3.ticks(yMin-yPad,yMax+yPad,6).forEach(t => { axisLabel(Math.round(t*10)/10,-8,yScale(t)+4,"end",10); });
    }
    if (cfg.xLabel) axisLabel(cfg.xLabel, iW/2, iH+42);
    if (cfg.yLabel) g.append("text").attr("transform",`translate(-40,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel);
    if (cfg.title)  axisLabel(cfg.title, iW/2, -12, "middle", 13);
  }

  // ── Discrete Probability Distribution ────────────────────────────────────
  else if (cfg.type === "discrete_dist") {
    const data = cfg.data || []; // [{x, p}]
    const xVals = data.map(d=>d.x);
    const pVals = data.map(d=>d.p);
    const pMax  = d3.max(pVals)*1.2 || 0.5;
    const xScale = d3.scaleBand().domain(xVals.map(String)).range([0,iW]).padding(0.3);
    const yScale = d3.scaleLinear().domain([0,pMax]).range([iH,0]);
    d3.ticks(0,pMax,5).forEach(t => { gridLine(0,yScale(t),iW,yScale(t)); });
    data.forEach(d => {
      const bx = xScale(String(d.x)), bw = xScale.bandwidth();
      const isHighlight = cfg.highlightX !== undefined && d.x === cfg.highlightX;
      g.append("rect").attr("x",bx).attr("y",yScale(d.p)).attr("width",bw)
        .attr("height",iH-yScale(d.p)).attr("fill",isHighlight ? COL.red : COL.blue).attr("rx",2);
      g.append("text").attr("x",bx+bw/2).attr("y",yScale(d.p)-5)
        .attr("text-anchor","middle").attr("font-size",10).attr("fill",COL.text)
        .text(d.p.toFixed ? d.p.toFixed(3) : d.p);
      g.append("text").attr("x",bx+bw/2).attr("y",iH+15)
        .attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(d.x);
    });
    g.append("line").attr("x1",0).attr("y1",iH).attr("x2",iW).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    g.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    if (showNumbers) d3.ticks(0,pMax,5).forEach(t => { axisLabel(t.toFixed(2),-8,yScale(t)+4,"end",10); });
    axisLabel(cfg.xLabel||"x", iW/2, iH+42);
    g.append("text").attr("transform",`translate(-40,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel||"P(X = x)");
    if (cfg.title) axisLabel(cfg.title, iW/2, -12, "middle", 13);
  }

  // ── Continuous Probability Distribution (Normal / Uniform / Exponential) ──
  else if (cfg.type === "continuous_dist") {
    const distType  = cfg.distType || "normal";
    const isStdNorm = distType === "standard_normal" || (distType === "normal" && cfg.mu === 0 && cfg.sigma === 1);
    const mu     = cfg.mu     ?? 0;
    const sigma  = cfg.sigma  ?? 1;
    const lambda = cfg.lambda ?? 1;
    const uMin   = cfg.uMin   ?? 0;
    const uMax   = cfg.uMax   ?? 1;

    // x range — standard normal shows -3.8 to 3.8, uniform uses uMin/uMax with padding
    const xLo = isStdNorm ? -3.8
      : distType === "uniform" ? (uMin === 0 ? 0 : uMin - (uMax-uMin)*0.15)
      : distType === "exponential" ? 0
      : (cfg.a ?? mu - 4*sigma);
    const xHi = isStdNorm ? 3.8
      : distType === "uniform" ? (uMax + (uMax-uMin)*0.15)
      : distType === "exponential" ? (cfg.b ?? 5/lambda)
      : (cfg.b ?? mu + 4*sigma);

    // PDF
    const pdf = (x) => {
      if (distType === "normal" || distType === "standard_normal") {
        const s = isStdNorm ? 1 : sigma;
        const m = isStdNorm ? 0 : mu;
        return (1/(s*Math.sqrt(2*Math.PI))) * Math.exp(-0.5*((x-m)/s)**2);
      }
      if (distType === "uniform") return (x>=uMin && x<=uMax) ? 1/(uMax-uMin) : 0;
      if (distType === "exponential") return x>=0 ? lambda*Math.exp(-lambda*x) : 0;
      return 0;
    };

    const xs   = d3.range(xLo, xHi+0.01, (xHi-xLo)/400);
    const yMax = (d3.max(xs.map(pdf)) || 0.5) * 1.2;
    const xScale = d3.scaleLinear().domain([xLo, xHi]).range([0, iW]);
    const yScale = d3.scaleLinear().domain([0, yMax]).range([iH, 0]);

    // grid
    d3.ticks(xLo, xHi, 8).forEach(t => gridLine(xScale(t),0,xScale(t),iH));
    d3.ticks(0, yMax, 5).forEach(t => gridLine(0,yScale(t),iW,yScale(t)));

    // shaded region
    const sFrom = cfg.shadeFrom ?? null;
    const sTo   = cfg.shadeTo   ?? null;
    if (sFrom !== null || sTo !== null) {
      const lo = Math.max(xLo, sFrom ?? xLo);
      const hi = Math.min(xHi, sTo   ?? xHi);
      const sxs = d3.range(lo, hi+0.01, (xHi-xLo)/400);
      const poly = [[lo,0], ...sxs.map(x=>[x,pdf(x)]), [hi,0]];
      const areaPath = d3.line().x(d=>xScale(d[0])).y(d=>yScale(d[1]));
      g.append("path").datum(poly).attr("d",areaPath)
        .attr("fill",COL.shade).attr("fill-opacity",0.38).attr("stroke","none");
    }

    // main curve
    const lineGen = d3.line().x(d=>xScale(d[0])).y(d=>yScale(d[1])).defined(d=>isFinite(d[1]));
    g.append("path").datum(xs.map(x=>[x,pdf(x)])).attr("d",lineGen)
      .attr("fill","none").attr("stroke",COL.blue).attr("stroke-width",2.5);

    // boundary vertical lines + z/x labels
    const boundaryVals = new Set(); // track values with red labels to skip in x-axis ticks

    const drawBoundary = (val, label) => {
      if (val === null || val <= xLo || val >= xHi) return;
      const px = xScale(val);
      const py = yScale(pdf(val));
      g.append("line").attr("x1",px).attr("y1",yScale(0)).attr("x2",px).attr("y2",py)
        .attr("stroke",COL.red).attr("stroke-width",1.8).attr("stroke-dasharray","5,4");
      const rounded = Math.round(val*100)/100;
      boundaryVals.add(rounded); // always register — prevents tick labels from overlapping even when showNumbers toggle varies
      if (showNumbers) {
        g.append("text").attr("x",px).attr("y",iH+28)
          .attr("text-anchor","middle").attr("font-size",10).attr("font-weight","600")
          .attr("fill",COL.red).text(label || rounded);
      }
    };

    // for uniform: draw uMin/uMax as boundaries
    if (distType === "uniform") {
      drawBoundary(uMin, `${Math.round(uMin*100)/100}`);
      drawBoundary(uMax, `${Math.round(uMax*100)/100}`);
    }
    if (sFrom !== null && !(distType === "uniform" && sFrom === uMin)) {
      const lbl = isStdNorm ? `z=${Math.round(sFrom*100)/100}` : `${Math.round(sFrom*100)/100}`;
      drawBoundary(sFrom, lbl);
    }
    if (sTo !== null && !(distType === "uniform" && sTo === uMax)) {
      const lbl = isStdNorm ? `z=${Math.round(sTo*100)/100}` : `${Math.round(sTo*100)/100}`;
      drawBoundary(sTo, lbl);
    }

    // probability label inside shaded region — respects showFnLabel toggle + offset
    const showProb = cfg.showFnLabel !== false;
    if (showProb && cfg.probability && (sFrom !== null || sTo !== null)) {
      const midX = ((sFrom??xLo) + (sTo??xHi)) / 2;
      const midPdf = pdf(midX);
      if (isFinite(midPdf) && midPdf > 0) {
        const offX = cfg.labelOffsetX || 0;
        const offY = cfg.labelOffsetY || 0;
        g.append("text")
          .attr("x", xScale(midX) + offX)
          .attr("y", yScale(midPdf * 0.42) + offY)
          .attr("text-anchor","middle").attr("font-size",12).attr("font-weight","700")
          .attr("fill",COL.blue).text(cfg.probability);
      }
    }

    // axes
    g.append("line").attr("x1",0).attr("y1",iH).attr("x2",iW).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);
    g.append("line").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",iH).attr("stroke",COL.text).attr("stroke-width",1.5);

    // x-axis tick labels — skip values already shown as red boundary labels
    if (showNumbers) {
      const ticks = isStdNorm ? [-3,-2,-1,0,1,2,3] : d3.ticks(xLo, xHi, 8);
      const tickStep = (xHi - xLo) / 8;
      ticks.forEach(t => {
        const rounded = Math.round(t*100)/100;
        const nearBoundary = [...boundaryVals].some(bv => bv === rounded || Math.abs(rounded - bv) < tickStep * 0.5);
        if (!nearBoundary) axisLabel(rounded, xScale(t), iH+16, "middle", 10);
      });
      // y-axis ticks
      d3.ticks(0, yMax, 5).forEach(t => axisLabel(Math.round(t*1000)/1000, -8, yScale(t)+4, "end", 9));
    }

    // x/z axis label
    const axX = isStdNorm ? "z" : (cfg.xLabel || "x");
    axisLabel(axX, iW/2, iH+44);
    g.append("text").attr("transform",`translate(-40,${iH/2}) rotate(-90)`)
      .attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text)
      .text(cfg.yLabel || "f(x)");

    // title
    if (cfg.title) axisLabel(cfg.title, iW/2, -12, "middle", 13);

    // μ marker for normal distributions
    if ((distType === "normal" || distType === "standard_normal") && xScale(mu) >= 0 && xScale(mu) <= iW) {
      g.append("line").attr("x1",xScale(mu)).attr("y1",yScale(0))
        .attr("x2",xScale(mu)).attr("y2",yScale(pdf(mu))*0.15)
        .attr("stroke",COL.muted).attr("stroke-width",1).attr("stroke-dasharray","3,3");
      const muLabel = isStdNorm ? "\u03bc=0" : ("\u03bc=" + mu);
      if (sFrom !== mu && sTo !== mu) // don't overlap with boundary label
        axisLabel(muLabel, xScale(mu), iH+42, "middle", 9);
    }
  }

  return svgNode;
}

async function statChartToBase64PNG(chartConfig, w=480, h=300) {
  const svgNode = renderStatChartToSVG(chartConfig, w, h);
  if (!svgNode) return null;
  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgNode);
      const blob = new Blob([svgStr], {type:"image/svg+xml;charset=utf-8"});
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    } catch(e) { reject(e); }
  });
}

// expose to window for console testing + export pipeline
if (typeof window !== "undefined") {
  window.renderGraphToSVG = renderGraphToSVG;
  window.graphToBase64PNG = graphToBase64PNG;
  window.renderStatChartToSVG = renderStatChartToSVG;
  window.statChartToBase64PNG = statChartToBase64PNG;
}
// ─── End Graph Engine ──────────────────────────────────────────────────────────

// Difficulty pattern: cycle Easy→Medium→Hard for any count
function difficultyPattern(count) {
  const cycle = ["Easy", "Medium", "Hard"];
  return Array.from({length: count}, (_, i) => cycle[i % 3]);
}

function buildQTI(questions, course, vLabel, useGroups=false, pointsPerQ=1) {
  const canvasQ = questions.filter(q => q.type !== "Branched");

  // register graph configs so buildQTIZip can resolve placeholders
  window._qtiGraphConfigs = window._qtiGraphConfigs || {};
  canvasQ.forEach((q, i) => {
    if (q.hasGraph && q.graphConfig) {
      window._qtiGraphConfigs[`q${i+1}`] = q.graphConfig;
    }
  });

  function makeItem(q, id, num) {
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${id}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + `Q${num}. ` + mathToHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="c${ci}"><material><mattext texttype="text/html">${mathToHTML(c)}</mattext></material></response_label>`
      ).join("");
      const correct = q.choices.findIndex(c => c === q.answer);
      return `<item ident="${id}" title="Q${num}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_lid ident="r${id}" rcardinality="Single">
      <render_choice shuffle="false">${cx}</render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="No">
      <conditionvar><varequal respident="r${id}">c${correct}</varequal></conditionvar>
      <setvar action="Set" varname="SCORE">${pointsPerQ}</setvar>
    </respcondition>
  </resprocessing>
</item>`;
    }
    return `<item ident="${id}" title="Q${num}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_str ident="r${id}" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
  </resprocessing>
</item>`;
  }

  if (!useGroups) {
    const items = canvasQ.map((q,i) => makeItem(q, `q${i+1}`, i+1)).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — Version ${vLabel}" ident="assessment1">
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`;
  }

  // Canvas Classic Quizzes grouped format
  // Each section = one Canvas question group
  const sectionMap = {};
  canvasQ.forEach((q,i) => {
    const sec = q.section || "General";
    if (!sectionMap[sec]) sectionMap[sec] = [];
    sectionMap[sec].push({q, globalIdx: i});
  });

  const groupSections = Object.entries(sectionMap).map(([sec, qs], gi) => {
    const pickCount = qs.length; // pick all — user can reduce in Canvas
    const items = qs.map(({q, globalIdx}, li) =>
      makeItem(q, `g${gi}q${li+1}`, globalIdx+1)
    ).join("\n");
    return `    <section ident="group_${gi}" title="${escapeXML(sec)}">
      <selection_ordering>
        <selection>
          <selection_number>${pickCount}</selection_number>
          <selection_extension>
            <points_per_item>${pointsPerQ}</points_per_item>
          </selection_extension>
        </selection>
      </selection_ordering>
${items}
    </section>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — Version ${vLabel}" ident="assessment1">
    <section ident="root_section">
${groupSections}
    </section>
  </assessment>
</questestinterop>`;
}


// ─── Math text → OMML (Word native math) converter ───────────────────────────
function mathToOmml(raw) {
  const s = String(raw ?? "");

  // OMML builders
  const X = t => t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const oT = t => `<m:r><m:t xml:space="preserve">${X(t)}</m:t></m:r>`;
  const oSqrt = inner => `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${inner}</m:e></m:rad>`;
  const oSup = (base, exp) => `<m:sSup><m:e>${base}</m:e><m:sup>${exp}</m:sup></m:sSup>`;
  const oFrac = (n, d) => `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
  const oInt = (a, b) => `<m:nary><m:naryPr><m:chr m:val="\u222B"/><m:limLoc m:val="subSup"/></m:naryPr><m:sub>${oT(a)}</m:sub><m:sup>${oT(b)}</m:sup><m:e>${oT(" ")}</m:e></m:nary>`;
  const oDelim = (begChr, endChr, inner) => `<m:d><m:dPr><m:begChr m:val="${begChr}"/><m:endChr m:val="${endChr}"/><m:grow/></m:dPr><m:e>${inner}</m:e></m:d>`;
  // lim with subscript: base="lim", sub="x→a" — built after renderSegment is defined
  const oLim = (varTo) => `__LIM__${varTo}__ENDLIM__`;

  // Step 1: replace Greek letters and symbols
  let w = s
    // Math inequalities/relations — text to symbols
    .replace(/!=/g, '≠')
    .replace(/<=(?!=)/g, '≤')
    .replace(/>=(?!=)/g, '≥')
    .replace(/->/g, '→')
    .replace(/\.\.\./g, '…')
    // Logical operators — text to symbols (Discrete Math)
    .replace(/\bNOT\s+([a-z])\b/g, '~$1')
    .replace(/\(NOT\s+([^)]+)\)/g, '(~$1)')
    .replace(/\b([a-z])\s+AND\s+([a-z])\b/g, '$1 ∧ $2')
    .replace(/\b([a-z])\s+OR\s+([a-z])\b/g, '$1 ∨ $2')
    .replace(/\btheta\b/gi, 'θ')
    .replace(/\bphi\b/gi, 'φ')
    .replace(/\brho\b/gi, 'ρ')
    .replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, 'π')
    .replace(/\balpha\b/gi, 'α')
    .replace(/\bbeta\b/gi, 'β')
    .replace(/\bgamma\b/gi, 'γ')
    .replace(/\bdelta\b/gi, 'δ')
    .replace(/\blambda\b/gi, 'λ')
    .replace(/\bsigma\b/gi, 'σ')
    .replace(/\binfinity\b/gi, '∞')
    .replace(/\binf\b/g, '∞');

  // Step 2: parse and build OMML directly
  // We'll do a single-pass conversion using a segment array
  // Each segment is either {type:'text', val} or {type:'sqrt'|'sup'|'frac'|'int', ...}

  // Process in priority order using replacements into a neutral token array
  // Use simple unique separator strings unlikely to appear in math text
  const SEP = '\x01';
  const tokens = [];

  function addToken(obj) { tokens.push(obj); return SEP + (tokens.length-1) + SEP; }

  // * → · (before tokenizing)
  w = w.replace(/\s*\*\s*/g, '·');

  // Script operators: L{expr}, F{expr}, Z{expr} — Laplace, Fourier, Z-transform
  // Must be handled BEFORE fn(x) and {expr} passes
  // Also handle L^{-1}{expr} — inverse Laplace (must come first)
  w = w.replace(/\b([LFZ])\^\{(-1)\}\{([^{}]+)\}/g,
    (_, op, exp, inner) => addToken({t:'script', op, sup:"-1", inner}));
  w = w.replace(/\b([LFZ])\{([^{}]+)\}/g,
    (_, op, inner) => addToken({t:'script', op, sup:null, inner}));

  // Stash fn(x) calls like f(x), g'(y), sin(x) — BEFORE exponent processing
  // so (f'(x))^2 becomes (TOKEN)^2 which exponent handler can match
  let prevFn;
  do {
    prevFn = w;
    w = w.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)('?)\(([^()]*)\)/g,
      (_, fn, prime, arg) => addToken({t:'text', val: `${fn}${prime}(${arg})`}));
  } while (w !== prevFn);

  // Process exponents FIRST (innermost), then sqrt can consume the results

  // (expr)^(n/m)
  let prev2;
  do {
    prev2 = w;
    w = w.replace(/(\([^()]+\)|\x01\d+\x01)\^\(([0-9]+)\/([0-9]+)\)/g,
      (_,base,n,d) => addToken({t:'sup', base, exp:`${n}/${d}`}));
    // (expr)^n
    w = w.replace(/(\([^()]+\)|\x01\d+\x01)\^(-?[0-9a-zA-Zα-ωθφ]+)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^(n/m)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\(([0-9]+)\/([0-9]+)\)/g,
      (_,base,n,d) => addToken({t:'sup', base, exp:`${n}/${d}`}));
    // x^(expr)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\(([^)]+)\)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^{expr}
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\{([^}]+)\}/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^2 or x^n
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^(-?[0-9]+(?:\.[0-9]+)?)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    w = w.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
  } while (w !== prev2);

  // NOW handle sqrt — fn calls and exponents already tokenized so parens are flat
  let prev;
  do {
    prev = w;
    w = w.replace(/sqrt\(([^()]*)\)/g, (_,inner) => addToken({t:'sqrt', inner}));
  } while (w !== prev);

  // lim as x->a  /  lim_{x->a}  /  lim x->a
  w = w.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)\s*of\b/gi,
    (_, v, a) => addToken({t:'lim', sub: v.trim() + '→' + a.trim()}));
  w = w.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)/gi,
    (_, v, a) => addToken({t:'lim', sub: v.trim() + '→' + a.trim()}));
  w = w.replace(/\blim\s*_\{([^}]+)\}/gi,
    (_, sub) => addToken({t:'lim', sub: sub.replace(/\\to/g,'→').replace(/->/g,'→')}));
  w = w.replace(/\\lim_\{([^}]+)\}/g,
    (_, sub) => addToken({t:'lim', sub: sub.replace(/\\to/g,'→').replace(/->/g,'→')}));

  // integral from a to b of
  w = w.replace(/integral from ([^\s]+) to ([^\s]+) of/gi,
    (_,a,b) => addToken({t:'int', a, b}));

  // (expr)/(b) fraction — horizontal bar (MUST come before delimiter processing)
  w = w.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/(expr) or letter/(expr) — e.g. 1/(s+3), A/(s+1)
  w = w.replace(/\b([a-zA-Z0-9]+)\/\(([^()]+)\)/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // TOKEN/(expr) — tokenized numerator over parenthesized denominator
  w = w.replace(/(\x01\d+\x01)\/\(([^()]+)\)/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // (expr)/number — parenthesized numerator over number
  w = w.replace(/\(([^()]+)\)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // (a)/[b] or TOKEN/[b] fraction — square bracket denominator
  w = w.replace(/(\([^()]+\)|\x01\d+\x01)\/\[([^\[\]]*(?:\x01\d+\x01[^\[\]]*)*)\]/g,
    (_,n,d) => addToken({t:'frac', n: n.replace(/^\(|\)$/g,''), d}));

  // simple/[b] fraction
  w = w.replace(/([a-zA-Z0-9]+)\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // [a]/[b] fraction
  w = w.replace(/\[([^\[\]]+)\]\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/number
  w = w.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // Auto-scaling delimiters: {expr} — curly braces (AFTER fractions)
  let prevD;
  do {
    prevD = w;
    w = w.replace(/\{([^{}]*)\}/g, (_, inner) => addToken({t:'delim', beg:'{', end:'}', inner}));
  } while (w !== prevD);

  // Auto-scaling parentheses — only when content contains a fraction token
  // Exception: standalone numeric fractions (1/2) don't need parentheses
  let prevP;
  do {
    prevP = w;
    w = w.replace(/\(([^()]*\x01\d+\x01[^()]*)\)/g, (_, inner) => {
      const parts = inner.split(/\x01(\d+)\x01/);
      const tokenIndices = [];
      parts.forEach((p, i) => { if (i % 2 === 1) tokenIndices.push(parseInt(p)); });
      const hasFrac = tokenIndices.some(i => tokens[i]?.t === 'frac');
      if (!hasFrac) return `(${inner})`;
      // Standalone numeric fraction: only a frac token, nothing else
      const isStandalone = parts.every((p, i) => i % 2 === 0 ? p.trim() === '' : true)
        && tokenIndices.length === 1 && tokens[tokenIndices[0]]?.t === 'frac';
      if (isStandalone) return `\x01${tokenIndices[0]}\x01`; // just the fraction, no parens
      return addToken({t:'delim', beg:'(', end:')', inner});
    });
  } while (w !== prevP);

  // (a)/[b] or TOKEN/[b] fraction — square bracket denominator
  w = w.replace(/(\([^()]+\)|\x01\d+\x01)\/\[([^\[\]]*(?:\x01\d+\x01[^\[\]]*)*)\]/g,
    (_,n,d) => addToken({t:'frac', n: n.replace(/^\(|\)$/g,''), d}));

  // simple/[b] fraction
  w = w.replace(/([a-zA-Z0-9]+)\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // [a]/[b] fraction
  w = w.replace(/\[([^\[\]]+)\]\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/number
  w = w.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // Now render: split w by SEP tokens and build OMML
  function renderToken(idx) {
    const tok = tokens[idx];
    if (!tok) return oT('?');
    if (tok.t === 'text') return oT(tok.val);
    if (tok.t === 'script') {
      // L{inner} or L^{-1}{inner} — render inner through full pipeline
      const innerOmml = mathToOmml(tok.inner);
      // Extract the inner m:oMath content
      const innerContent = innerOmml.replace(/^<m:oMath>|<\/m:oMath>$/g, '');
      const opRun = oT(tok.op);
      const supRun = tok.sup ? oSup(oT(tok.op), oT(tok.sup)) : opRun;
      const lbrace = oT('{');
      const rbrace = oT('}');
      return (tok.sup ? oSup(oT(tok.op), oT(tok.sup)) : oT(tok.op)) + lbrace + innerContent + rbrace;
    }
    if (tok.t === 'sqrt') return oSqrt(renderSegment(tok.inner));
    if (tok.t === 'sup') return oSup(renderSegment(tok.base), renderSegment(tok.exp));
    if (tok.t === 'frac') return oFrac(renderSegment(tok.n), renderSegment(tok.d));
    if (tok.t === 'delim') return oDelim(tok.beg, tok.end, renderSegment(tok.inner));
    if (tok.t === 'int') return oInt(tok.a, tok.b);
    if (tok.t === 'lim') return oLim(tok.sub);
    return oT('?');
  }

  function renderSegment(seg) {
    if (!seg) return '';
    const parts = seg.split(/\x01(\d+)\x01/);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { if (parts[i]) out += oT(parts[i]); }
      else out += renderToken(parseInt(parts[i]));
    }
    return out;
  }

  let inner = renderSegment(w);
  // Resolve lim placeholders now that renderSegment is available
  inner = inner.replace(/__LIM__(.*?)__ENDLIM__/g, (_, varTo) =>
    `<m:limLow><m:e><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t xml:space="preserve">lim</m:t></m:r></m:e><m:lim>${renderSegment(varTo)}</m:lim></m:limLow>`
  );
  // Strip any leaked control characters that would break XML
  const clean = inner.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return `<m:oMath>${clean}</m:oMath>`;
}

// ─── Build proper .docx file ──────────────────────────────────────────────────
// ── Word image XML helper (used by both buildDocx and buildDocxCompare) ──────
let _docxImgCounter = 0;
function makeDocxImageXml(base64png, widthEmu=4800000, heightEmu=2800000) {
  _docxImgCounter++;
  const b64 = base64png.replace(/^data:image\/png;base64,/, "");
  const rid  = `rImg${_docxImgCounter}`;
  const docId = _docxImgCounter;
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docId}" name="Graph${docId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docId}" name="Graph${docId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<GRAPH_REL_PLACEHOLDER rid="${rid}" b64="${b64}"/>`;
}

async function buildAnswerKey(versions, course) {
  const JSZip = window.JSZip;
  if (!JSZip) { alert("JSZip not loaded"); return null; }

  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  // Plain text paragraph
  function plainPara(text, opts={}) {
    const {bold=false, size=22, color="000000", indent=0, spacing=120} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    const safe = String(text??'').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
  }

  // Math paragraph using OMML
  function mathPara(text, opts={}) {
    const {size=22, color="000000", indent=0, spacing=120} = opts;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    try {
      const omml = mathToOmml(String(text??''));
      const rpr = `<m:rPr><m:sz m:val="${size}"/></m:rPr>`;
      const colorRun = color !== "000000"
        ? `<w:r><w:rPr><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t> </w:t></w:r>`
        : '';
      return `<w:p>${ppr}${colorRun}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
    } catch(e) {
      return plainPara(text, opts);
    }
  }

  const mcTypes = ["Multiple Choice","True/False","Fill in the Blank"];
  let body = "";

  for (const v of versions) {
    const cs = v.questions[0]?.classSection;
    const heading = cs
      ? `${course} — Section ${cs} Version ${v.label} — Answer Key`
      : `${course} — Version ${v.label} — Answer Key`;

    body += plainPara(heading, {bold:true, size:28, spacing:200});

    v.questions.forEach((q, qi) => {
      const num = qi + 1;
      const isFR = q.type === "Free Response" || q.type === "Short Answer";
      const isBranched = q.type === "Branched";
      const isMC = q.type === "Multiple Choice" || q.type === "True/False";

      // ── Question header: Q1. [Section] — Type — Difficulty ──
      const sectionLabel = q.section ? `[${q.section}]` : "";
      const meta = `${sectionLabel}  ${q.type||""}  —  ${q.difficulty||""}`;
      body += plainPara(`Q${num}.  ${meta}`, {bold:true, size:22, color:"1a3a6a", spacing:40});

      // ── Question text ──
      if (isBranched) {
        body += mathPara(q.stem || "", {size:20, color:"333333", indent:280, spacing:40});
        (q.parts||[]).forEach((p, pi) => {
          body += mathPara(`(${String.fromCharCode(97+pi)})  ${p.question||""}`, {size:20, color:"333333", indent:560, spacing:30});
        });
      } else {
        body += mathPara(q.question || "", {size:20, color:"333333", indent:280, spacing:40});
      }

      // ── Answer ──
      if (isBranched) {
        (q.parts||[]).forEach((p, pi) => {
          if (!p.answer) return;
          body += mathPara(`(${String.fromCharCode(97+pi)})  Answer:  ${p.answer}`, {size:21, color:"1a7a4a", indent:560, spacing:30});
          if (p.explanation) {
            const steps = p.explanation.split(/\n/).map(s=>s.trim()).filter(Boolean);
            steps.forEach((step) => {
              body += mathPara(step, {size:19, color:"444444", indent:840, spacing:25});
            });
          }
        });
      } else if (isFR) {
        if (q.answer) body += mathPara(`Answer:  ${q.answer}`, {size:21, color:"1a7a4a", indent:560, spacing:30});
        if (q.explanation) {
          const steps = q.explanation.split(/\n/).map(s=>s.trim()).filter(Boolean);
          steps.forEach((step) => {
            body += mathPara(step, {size:19, color:"444444", indent:840, spacing:25});
          });
        }
      } else if (isMC && q.choices && q.answer) {
        const idx = q.choices.indexOf(q.answer);
        const letter = idx >= 0 ? String.fromCharCode(65+idx) : "";
        body += mathPara(`Answer:  ${letter ? letter+".  " : ""}${q.answer}`, {size:21, color:"1a4a8a", indent:560, spacing:30});
      } else if (q.answer) {
        body += mathPara(`Answer:  ${q.answer}`, {size:21, color:"1a7a4a", indent:560, spacing:30});
      }

      // Divider between questions
      body += `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="dddddd"/></w:pBdr></w:pPr></w:p>`;
    });

    body += `<w:p><w:pPr><w:spacing w:after="400"/></w:pPr></w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns}>
<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  zip.file("word/document.xml", documentXml);
  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}

async function buildDocx(questions, course, vLabel, classSection=null, startNum=1) {
  _docxImgCounter = 0; // reset per export
  // We build the docx XML manually for full math support
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=160} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}${bold?'<w:jc w:val="left"/>' :''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</w:t></w:r></w:p>`;
  }

  // Convert pipe table text to Word table XML
  function pipeTableToWordXml(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const tableLines = lines.filter(l => l.startsWith("|"));
    const rows = tableLines
      .filter(l => !/^\|[-\s|:]+\|$/.test(l))
      .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
    if (!rows.length) return "";

    const numCols = Math.max(...rows.map(r => r.length));
    const colWidth = Math.floor(8640 / numCols); // fit in content width (DXA)

    const border = `<w:top w:val="single" w:sz="4" w:color="888888"/><w:left w:val="single" w:sz="4" w:color="888888"/><w:bottom w:val="single" w:sz="4" w:color="888888"/><w:right w:val="single" w:sz="4" w:color="888888"/>`;

    const wordRows = rows.map((row, ri) => {
      const isHeader = ri === 0;
      const cells = Array.from({length: numCols}, (_,ci) => {
        const cellText = row[ci] || "";
        const shading = isHeader
          ? `<w:shd w:val="clear" w:color="auto" w:fill="2D2D5A"/>`
          : ci === 0 ? `<w:shd w:val="clear" w:color="auto" w:fill="1A1A3A"/>` : "";
        const textColor = isHeader ? "A0A0CC" : ci === 0 ? "C0C0E0" : "D0D0CC";
        const bold = isHeader || ci === 0;
        const safe = cellText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        return `<w:tc>
          <w:tcPr>
            <w:tcW w:w="${colWidth}" w:type="dxa"/>
            <w:tcBorders>${border}</w:tcBorders>
            ${shading}
            <w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
          </w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="20"/><w:color w:val="${textColor}"/></w:rPr>
              <w:t xml:space="preserve">${safe}</w:t>
            </w:r>
          </w:p>
        </w:tc>`;
      }).join("");
      const rowProps = isHeader ? `<w:trPr><w:tblHeader/></w:trPr>` : "";
      return `<w:tr>${rowProps}${cells}</w:tr>`;
    }).join("");

    return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${numCols * colWidth}" w:type="dxa"/>
        <w:tblBorders>${border.repeat ? border : border}</w:tblBorders>
        <w:tblLook w:val="04A0"/>
      </w:tblPr>
      <w:tblGrid>${Array.from({length:numCols},()=>`<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>
      ${wordRows}
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
  }

  function mathPara(text, opts={}) {
    const {indent=0} = opts;
    const ppr = indent ? `<w:pPr><w:ind w:left="${indent}"/><w:spacing w:after="80"/></w:pPr>` : `<w:pPr><w:spacing w:after="80"/></w:pPr>`;

    // Normalize inline tables, then check for pipe tables
    const normalized = isPipeTable(String(text)) ? normalizePipeTable(String(text)) : String(text);

    if (normalized.includes("|") && isPipeTable(normalized)) {
      const blocks = splitTableBlocks(normalized);
      return blocks.map(block => {
        if (block.type === "table") return pipeTableToWordXml(block.content);
        if (!block.content.trim()) return "";
        try {
          const omml = mathToOmml(block.content);
          return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
        } catch(e) {
          const safe = block.content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
          return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
        }
      }).join("");
    }

    try {
      const omml = mathToOmml(normalized);
      return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
    } catch(e) {
      const safe = normalized.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }
  }

  let body = "";
  // Title
  const titleLabel = classSection ? `Section ${classSection} — Version ${vLabel}` : `Exam Version ${vLabel}`;
  body += para(`${course} — ${titleLabel}`, {bold:true, size:32, spacing:120});

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = startNum + i;
    // ── graph image (buildDocx) ──
    if (q.hasGraph && q.graphConfig) {
      try {
        const _isStat = q.graphConfig.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
        const b64 = _isStat ? await statChartToBase64PNG(q.graphConfig, 480, 280) : await graphToBase64PNG(q.graphConfig, 480, 280);
        if (b64) body += makeDocxImageXml(b64);
      } catch(e) { console.warn("graph png failed", e); }
    }
    if (q.type === "Branched") {
      body += para(`${num}. [${q.section}] — ${q.difficulty}`, {bold:true, size:24, spacing:80});
      body += mathPara(`Given: ${q.stem}`);
      (q.parts||[]).forEach((p, pi) => {
        body += para(`(${String.fromCharCode(97+pi)})`, {indent:360, size:22, spacing:60});
        body += mathPara(p.question, {indent:360});
        if (p.choices) p.choices.forEach((c,ci) => {
          body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:720});
        });
        if (p.answer) body += para(`Answer: ${p.answer}`, {indent:360, size:22, color:"1a7a4a", spacing:80});
      });
    } else {
      body += para(`${num}. [${q.section}] — ${q.type} — ${q.difficulty}`, {bold:true, size:24, spacing:80});
      body += mathPara(q.question);
      if (q.type==="Formula" && q.variables) {
        body += para(`Variables: ${q.variables.map(v=>v.name+"∈["+v.min+","+v.max+"]").join(", ")}`, {indent:360, size:20, color:"555555", spacing:60});
      }
      if (q.choices) q.choices.forEach((c,ci) => {
        body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:360});
      });
      if (q.answer) body += mathPara(`✓ Answer: ${q.answer}`, {indent:0, size:22, color:"1a7a4a", spacing:60});
      if (q.explanation) body += mathPara(`Note: ${q.explanation}`, {indent:0, size:20, color:"666666", spacing:120});
    }
    body += `<w:p><w:pPr><w:spacing w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/></w:pBdr></w:pPr></w:p>`;
  }

  let documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
  <w:pgNumType w:fmt="decimal" w:start="1"/>
  <w:footerReference w:type="default" r:id="rFooter1"/>
</w:sectPr>
</w:body>
</w:document>`;

  // Build minimal docx zip using JSZip loaded from CDN
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // extract image data from GRAPH_REL_PLACEHOLDER tags and wire into zip
  const imgRe = /<GRAPH_REL_PLACEHOLDER rid="([^"]+)" b64="([^"]+)"\/>/g;
  const imgMatches = [...documentXml.matchAll(imgRe)];
  let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  let imgIdx = 1;
  for (const m of imgMatches) {
    const rid = m[1]; // use the rid from the placeholder tag directly
    const b64 = m[2];
    const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    zip.file(`word/media/graph${imgIdx}.png`, imgBytes);
    relsXml += `
  <Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/graph${imgIdx}.png"/>`;
    imgIdx++;
  }
  relsXml += "\n</Relationships>";
  // strip placeholder tags from documentXml
  documentXml = documentXml.replace(imgRe, "");

  // ── Page number footer ──
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:t>1</w:t></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;
  zip.file("word/footer1.xml", footerXml);
  relsXml = relsXml.replace("</Relationships>",
    `  <Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>\n</Relationships>`);

  // ── Answer key page ──
  let answerKeyBody = para("Answer Key", {bold:true, size:28, spacing:120});
  answerKeyBody += para(titleLabel, {size:20, color:"555555", spacing:200});
  const mcTypes = ["Multiple Choice","True/False","Fill in the Blank"];
  const isFreeResponse = (q) => q.type === "Free Response" || q.type === "Short Answer";
  const divider = `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="dddddd"/></w:pBdr></w:pPr></w:p>`;

  questions.forEach((q, i) => {
    const num = i + 1;
    const isMC = q.type === "Multiple Choice" || q.type === "True/False";
    const isBranched = q.type === "Branched";
    const isFR = isFreeResponse(q);

    // Q header: number + section + type + difficulty
    const meta = `${q.section ? "["+q.section+"]  " : ""}${q.type||""}  —  ${q.difficulty||""}`;
    answerKeyBody += para(`Q${num}.  ${meta}`, {bold:true, size:22, color:"1a3a6a", spacing:40});

    // Question text
    if (isBranched) {
      answerKeyBody += mathPara(q.stem||"", {indent:280, size:20, color:"333333", spacing:35});
      (q.parts||[]).forEach((p, pi) => {
        answerKeyBody += mathPara(`(${String.fromCharCode(97+pi)})  ${p.question||""}`, {indent:560, size:20, color:"333333", spacing:30});
      });
    } else {
      answerKeyBody += mathPara(q.question||"", {indent:280, size:20, color:"333333", spacing:35});
    }

    // Answer(s)
    if (isBranched) {
      (q.parts||[]).forEach((p, pi) => {
        if (!p.answer) return;
        answerKeyBody += mathPara(`(${String.fromCharCode(97+pi)})  Answer:  ${p.answer}`, {indent:560, size:21, color:"1a7a4a", spacing:30});
        if (p.explanation) {
          p.explanation.split(/\n/).map(s=>s.trim()).filter(Boolean).forEach((step) => {
            answerKeyBody += mathPara(step, {indent:840, size:18, color:"555555", spacing:25});
          });
        }
      });
    } else if (isFR) {
      if (q.answer) answerKeyBody += mathPara(`Answer:  ${q.answer}`, {indent:560, size:21, color:"1a7a4a", spacing:30});
      if (q.explanation) {
        q.explanation.split(/\n/).map(s=>s.trim()).filter(Boolean).forEach((step) => {
          answerKeyBody += mathPara(step, {indent:840, size:18, color:"444444", spacing:25});
        });
      }
    } else if (isMC && q.choices && q.answer) {
      const idx = q.choices.indexOf(q.answer);
      const letter = idx >= 0 ? String.fromCharCode(65+idx) : "";
      answerKeyBody += mathPara(`Answer:  ${letter ? letter+".  " : ""}${q.answer}`, {indent:560, size:21, color:"1a4a8a", spacing:35});
    } else if (q.answer) {
      answerKeyBody += mathPara(`Answer:  ${q.answer}`, {indent:560, size:21, color:"1a7a4a", spacing:35});
    }

    answerKeyBody += divider;
  });

  // page break before answer key
  documentXml = documentXml.replace("</w:body>",
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${answerKeyBody}</w:body>`);

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  const blob = await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  return blob;
}

function dlFile(content, name, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content],{type}));
  a.download = name; a.click();
}

function dlBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
}

// ─── Wrap QTI XML in Canvas-compatible ZIP ────────────────────────────────────
async function buildQTIZip(qtiXml, title) {
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const assessmentId = `assessment_${Math.random().toString(16).slice(2,10)}`;
  const folder = safeTitle;
  const qtiFile = `${folder}/assessment_qti.xml`;
  const metaFile = `${folder}/assessment_meta.xml`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man${assessmentId}"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1.xsd">
  <metadata><schema>IMS Content</schema><schemaversion>1.1</schemaversion></metadata>
  <organizations/>
  <resources>
    <resource identifier="${assessmentId}" type="imsqti_xmlv1p2" href="${qtiFile}">
      <file href="${qtiFile}"/>
      <file href="${metaFile}"/>
    </resource>
  </resources>
</manifest>`;

  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="${assessmentId}" xmlns="http://canvas.instructure.com/xsd/cccv1p0">
  <title>${escapeXML(title)}</title>
  <shuffle_answers>false</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <quiz_type>assignment</quiz_type>
  <allowed_attempts>1</allowed_attempts>
  <show_correct_answers>false</show_correct_answers>
</quiz>`;

  const zip = new window.JSZip();

  // ── resolve graph placeholders ──
  // Canvas requires images as web_resources inside the zip
  const placeholderRe = /GRAPH_PLACEHOLDER_([^"]+)/g;
  const phMatches = [...qtiXml.matchAll(placeholderRe)];
  const seen = new Set();
  let imgIdx = 0;
  const imgResourceEntries = [];
  for (const m of phMatches) {
    const pid = m[1];
    if (seen.has(pid)) continue;
    seen.add(pid);
    let cfg = window._qtiGraphConfigs?.[pid];
    if (!cfg && window._qtiGraphConfigs) {
      const keys = Object.keys(window._qtiGraphConfigs);
      if (keys.length > 0) cfg = window._qtiGraphConfigs[keys[Math.min(imgIdx, keys.length-1)]];
    }
    imgIdx++;
    if (cfg) {
      try {
        const _isStatQTI = cfg.type && ["bar","histogram","scatter","discrete_dist","continuous_dist"].includes(cfg.type);
        const b64 = _isStatQTI ? await statChartToBase64PNG(cfg, 480, 280) : await graphToBase64PNG(cfg, 480, 280);
        if (b64) {
          const imgName = `graph_${imgIdx}.png`;
          const imgWebPath = `web_resources/${imgName}`;
          const imgBytes = Uint8Array.from(atob(b64.replace(/^data:image\/png;base64,/, "")), ch => ch.charCodeAt(0));
          zip.file(imgWebPath, imgBytes);
          imgResourceEntries.push(imgWebPath);
          // Canvas resolves $IMS-CC-FILEBASE$ relative to the package root
          qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join(`$IMS-CC-FILEBASE$${imgWebPath}`);
        }
      } catch(e) {
        console.warn("graph png failed", e);
        qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
      }
    } else {
      qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
    }
  }

  // add image files to manifest resources
  const imgResources = imgResourceEntries.map((p, i) =>
    `    <resource identifier="graph_res_${i+1}" type="webcontent" href="${p}"><file href="${p}"/></resource>`
  ).join("\n");

  // patch manifest to include image resources
  const patchedManifest = manifest.replace("</resources>", imgResources + "\n  </resources>");

  zip.file("imsmanifest.xml", patchedManifest);
  zip.file(qtiFile, qtiXml);
  zip.file(metaFile, meta);

  return await zip.generateAsync({type:"blob", mimeType:"application/zip"});
}

// ─── Classroom Sections Canvas QTI export ─────────────────────────────────────
// Matches the exact structure of the uploaded MAT221 QTI files:
// - One zip per classroom section (S1, S2, S3, S4)
// - Grouped mode: one <section> per question number, each containing all versions of that question
// - Flat mode: all items in a single <section>
async function buildClassroomSectionsQTI(classSectionVersions, course, useGroups=true, pointsPerQ=1) {
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function uid8() { return Math.random().toString(16).slice(2,10).padEnd(8,'0'); }

  function makeItem(q, ident, qnum) {
    const qhtml = mathToHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata><qtimetadata>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata></itemmetadata>`;

    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="${ident}_${ci}"><material><mattext texttype="text/html"><![CDATA[<p>${mathToHTML(c)}</p>]]></mattext></material></response_label>`
      ).join("\n          ");
      const correct = q.choices.findIndex(c => c === q.answer);
      const correctIdent = `${ident}_${correct}`;
      return `    <item ident="${ident}" title="Q${qnum}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="No">
          ${cx}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
      <respcondition continue="No"><conditionvar><varequal respident="response1">${correctIdent}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
      </resprocessing>
    </item>`;
    }
    return `    <item ident="${ident}" title="Q${qnum}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_str ident="response1" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
      </resprocessing>
    </item>`;
  }

  const sortedSecs = Object.keys(classSectionVersions).sort((a,b) => Number(a)-Number(b));
  const blobs = {};

  for (const sec of sortedSecs) {
    const secVersions = classSectionVersions[sec]; // array of {label, questions}
    const numQ = secVersions[0]?.questions?.length || 0;
    const assessId = `mat_s${sec}_${uid8()}`;
    const title = `${course} Section ${sec} Exam`;
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    const qtiFile = `${safeTitle}/${safeTitle}_questions.xml`;

    let sectionsXml = "";

    if (useGroups) {
      // Grouped: one <section title="Q1"> containing all versions of Q1, etc.
      for (let qi = 0; qi < numQ; qi++) {
        const sectionId = `g${uid8()}`;
        let items = "";
        secVersions.forEach((v) => {
          const q = v.questions[qi];
          if (!q || q.type === "Branched") return;
          const ident = `i${uid8()}`;
          items += makeItem(q, ident, qi+1) + "\n";
        });
        sectionsXml += `  <section ident="${sectionId}" title="Q${qi+1}">
    <selection_ordering>
      <selection>
        <selection_number>1</selection_number>
        <selection_extension><points_per_item>${pointsPerQ}</points_per_item></selection_extension>
      </selection>
    </selection_ordering>
${items}  </section>\n`;
      }
    } else {
      // Flat: all versions of all questions in one section, ordered V-A Q1, V-B Q1, V-A Q2, V-B Q2...
      const sectionId = `g${uid8()}`;
      let items = "";
      for (let qi = 0; qi < numQ; qi++) {
        secVersions.forEach((v) => {
          const q = v.questions[qi];
          if (!q || q.type === "Branched") return;
          const ident = `i${uid8()}`;
          items += makeItem(q, ident, qi+1) + "\n";
        });
      }
      sectionsXml = `  <section ident="${sectionId}" title="All Questions">\n${items}  </section>\n`;
    }

    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${assessId}" title="${escapeXML(title)}">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
${sectionsXml}  </assessment>
</questestinterop>`;

    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="${assessId}" xmlns="http://canvas.instructure.com/xsd/cccv1p0">
  <title>${escapeXML(title)}</title>
  <shuffle_answers>false</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <quiz_type>assignment</quiz_type>
  <points_possible>${numQ * pointsPerQ}</points_possible>
  <allowed_attempts>1</allowed_attempts>
  <show_correct_answers>false</show_correct_answers>
</quiz>`;

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${assessId}_manifest" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1.xsd">
  <metadata><schema>IMS Content</schema><schemaversion>1.1</schemaversion></metadata>
  <organizations/>
  <resources>
    <resource identifier="${assessId}" type="imsqti_xmlv1p2" href="${qtiFile}">
      <file href="${qtiFile}"/>
      <file href="${safeTitle}/${safeTitle}_meta.xml"/>
    </resource>
  </resources>
</manifest>`;

    const zip = new window.JSZip();
    zip.file("imsmanifest.xml", manifest);
    zip.file(qtiFile, qtiXml);
    zip.file(`${safeTitle}/${safeTitle}_meta.xml`, metaXml);
    blobs[sec] = await zip.generateAsync({type:"blob", mimeType:"application/zip"});
  }

  return blobs; // { "1": Blob, "2": Blob, ... }
}

// ─── Compare-mode exports (grouped by question number across versions) ─────────
function buildQTICompare(versions, course, useGroups=false, pointsPerQ=1) {
  const numQ = versions[0]?.questions?.length || 0;
  const vLabels = versions.map(v => v.label).join(", ");

  // register graph configs
  window._qtiGraphConfigs = window._qtiGraphConfigs || {};
  versions.forEach(v => v.questions.forEach((q, i) => {
    if (q.hasGraph && q.graphConfig) window._qtiGraphConfigs[`i${i}_${v.label}`] = q.graphConfig;
  }));

  function makeItem(q, id, pointsPer) {
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${id}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + mathToHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPer}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="${id}_${ci}"><material><mattext texttype="text/html"><![CDATA[<p>${mathToHTML(c)}</p>]]></mattext></material></response_label>`
      ).join("");
      const correct = q.choices.findIndex(c => c === q.answer);
      return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="No">${cx}</render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No"><conditionvar><varequal respident="response1">${id}_${correct}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
      </resprocessing>
    </item>`;
    }
    return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_str ident="response1" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
      </resprocessing>
    </item>`;
  }

  function uid8() { return Math.random().toString(16).slice(2,10).padEnd(8,'0'); }

  if (!useGroups) {
    let items = "";
    for (let qi = 0; qi < numQ; qi++) {
      versions.forEach(v => {
        const q = v.questions[qi];
        if (!q || q.type === "Branched") return;
        items += makeItem(q, `i${uid8()}`, pointsPerQ) + "\n";
      });
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment title="${escapeXML(course)}" ident="assessment1">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
    <section ident="root_section">
${items}    </section>
  </assessment>
</questestinterop>`;
  }

  // Grouped: one section per question number, no labels on groups or items
  const groupSections = [];
  for (let qi = 0; qi < numQ; qi++) {
    const sectionId = `g${uid8()}`;
    const items = versions.map(v => {
      const q = v.questions[qi];
      if (!q || q.type === "Branched") return "";
      return makeItem(q, `i${uid8()}`, pointsPerQ);
    }).filter(Boolean).join("\n");
    groupSections.push(`  <section ident="${sectionId}">
    <selection_ordering>
      <selection>
        <selection_number>1</selection_number>
        <selection_extension><points_per_item>${pointsPerQ}</points_per_item></selection_extension>
      </selection>
    </selection_ordering>
${items}
  </section>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment title="${escapeXML(course)}" ident="assessment1">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
${groupSections.join("\n")}
  </assessment>
</questestinterop>`;
}

// ─── Merged All-Sections QTI: Q1 pool = S1_A + S1_B + S2_A + S2_B + ... ──────
function buildQTIAllSectionsMerged(classSectionVersions, course, pointsPerQ=1) {
  function uid8() { return Math.random().toString(16).slice(2,10).padEnd(8,'0'); }
  // register graph configs
  window._qtiGraphConfigs = window._qtiGraphConfigs || {};
  Object.values(classSectionVersions).forEach(vers => vers.forEach(v => (v.questions||[]).forEach((q,i) => {
    if (q.hasGraph && q.graphConfig) window._qtiGraphConfigs[`m${i}`] = q.graphConfig;
  })));

  // Get all sections sorted
  const sortedSecs = Object.keys(classSectionVersions).sort((a,b) => Number(a)-Number(b));
  if (!sortedSecs.length) return null;

  // numQ = questions per version (all sections should have same count)
  const numQ = classSectionVersions[sortedSecs[0]]?.[0]?.questions?.length || 0;

  function makeItem(q, id) {
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${id}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + mathToHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="${id}_${ci}"><material><mattext texttype="text/html"><![CDATA[<p>${mathToHTML(c)}</p>]]></mattext></material></response_label>`
      ).join("");
      const correct = q.choices.findIndex(c => c === q.answer);
      return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="No">${cx}</render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No"><conditionvar><varequal respident="response1">${id}_${correct}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
      </resprocessing>
    </item>`;
    }
    return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_str ident="response1" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
      </resprocessing>
    </item>`;
  }

  // Build one group per question number, pooling ALL sections × ALL versions
  const groupSections = [];
  for (let qi = 0; qi < numQ; qi++) {
    const sectionId = `g${uid8()}`;
    let items = "";
    // For each section, for each version, add Q[qi]
    sortedSecs.forEach(sec => {
      const secVersions = classSectionVersions[sec] || [];
      secVersions.forEach(v => {
        const q = v.questions[qi];
        if (!q || q.type === "Branched") return;
        items += makeItem(q, `i${uid8()}`) + "\n";
      });
    });
    const totalItems = sortedSecs.reduce((sum, sec) =>
      sum + (classSectionVersions[sec]||[]).filter(v => v.questions[qi] && v.questions[qi].type !== "Branched").length, 0);
    groupSections.push(`  <section ident="${sectionId}">
    <selection_ordering>
      <selection>
        <selection_number>1</selection_number>
        <selection_extension><points_per_item>${pointsPerQ}</points_per_item></selection_extension>
      </selection>
    </selection_ordering>
${items}
  </section>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment title="${escapeXML(course)}" ident="assessment1">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
${groupSections.join("\n")}
  </assessment>
</questestinterop>`;
}

async function buildDocxCompare(versions, course) {
  _docxImgCounter = 0; // reset per export
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=120} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</w:t></w:r></w:p>`;
  }

  function mathPara(text, opts={}) {
    const {indent=0} = opts;
    const ppr = `<w:pPr><w:spacing w:after="60"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;

    // Normalize and detect pipe tables
    const normalized = isPipeTable(String(text)) ? normalizePipeTable(String(text)) : String(text);
    if (normalized.includes("|") && isPipeTable(normalized)) {
      const blocks = splitTableBlocks(normalized);
      return blocks.map(block => {
        if (block.type === "table") {
          // Build Word table XML inline
          const lines = block.content.split("\n").map(l => l.trim()).filter(Boolean);
          const rows = lines.filter(l => !/^\|[-\s|:]+\|$/.test(l))
            .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
          if (!rows.length) return "";
          const numCols = Math.max(...rows.map(r => r.length));
          const colWidth = Math.floor(8640 / numCols);
          const border = `<w:top w:val="single" w:sz="4" w:color="888888"/><w:left w:val="single" w:sz="4" w:color="888888"/><w:bottom w:val="single" w:sz="4" w:color="888888"/><w:right w:val="single" w:sz="4" w:color="888888"/>`;
          const wordRows = rows.map((row, ri) => {
            const isHeader = ri === 0;
            const cells = Array.from({length: numCols}, (_,ci) => {
              const cellText = (row[ci]||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
              const shading = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="2D2D5A"/>` : ci===0 ? `<w:shd w:val="clear" w:color="auto" w:fill="1A1A3A"/>` : "";
              const textColor = isHeader ? "A0A0CC" : ci===0 ? "C0C0E0" : "D0D0CC";
              return `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/><w:tcBorders>${border}</w:tcBorders>${shading}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr>${isHeader?'<w:b/>':''}<w:sz w:val="20"/><w:color w:val="${textColor}"/></w:rPr><w:t xml:space="preserve">${cellText}</w:t></w:r></w:p></w:tc>`;
            }).join("");
            return `<w:tr>${isHeader?'<w:trPr><w:tblHeader/></w:trPr>':''}${cells}</w:tr>`;
          }).join("");
          return `<w:tbl><w:tblPr><w:tblW w:w="${numCols*colWidth}" w:type="dxa"/></w:tblPr><w:tblGrid>${Array.from({length:numCols},()=>`<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>${wordRows}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
        }
        if (!block.content.trim()) return "";
        try {
          const omml = mathToOmml(block.content);
          return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
        } catch(e) {
          const safe = block.content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
          return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
        }
      }).join("");
    }

    try {
      const omml = mathToOmml(normalized);
      return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
    } catch(e) {
      const safe = normalized.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }
  }

  const vLabels = versions.map(v => v.label).join(", ");
  const numQ = versions[0]?.questions?.length || 0;
  const vColors = ["1a7a4a","6d28d9","b45309","0e7490","be185d"];

  let body = para(`${course} — All Versions (${vLabels})`, {bold:true, size:32, spacing:100});
  body += para("Version Comparison — Grouped by Question Number", {size:22, color:"555555", spacing:200});

  for (let qi = 0; qi < numQ; qi++) {
    body += `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="334155"/></w:pBdr></w:pPr></w:p>`;
    body += para(`Question ${qi+1} — ${versions[0]?.questions[qi]?.section || ""} — ${versions[0]?.questions[qi]?.difficulty || ""}`, {bold:true, size:26, color:"334155", spacing:80});

    for (let vi = 0; vi < versions.length; vi++) {
      const v = versions[vi];
      const q = v.questions[qi];
      if (!q) continue;
      const vc = vColors[vi % vColors.length];
      body += para(`Version ${v.label}`, {bold:true, size:22, color:vc, spacing:60});
      // ── graph image (buildDocxCompare) ──
      if (q.hasGraph && q.graphConfig) {
        try {
          const _isStat = q.graphConfig.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
          const b64 = _isStat ? await statChartToBase64PNG(q.graphConfig, 480, 280) : await graphToBase64PNG(q.graphConfig, 480, 280);
          if (b64) body += makeDocxImageXml(b64);
        } catch(e) { console.warn("graph png failed", e); }
      }
      body += mathPara(q.question);
      if (q.choices) q.choices.forEach((c,ci) => {
        body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:360});
      });
      body += mathPara(`Answer: ${q.answer}`);
    }
  }

  let documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
  <w:pgNumType w:fmt="decimal" w:start="1"/>
  <w:footerReference w:type="default" r:id="rFooter1"/>
</w:sectPr>
</w:body>
</w:document>`;

  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  // extract image data from GRAPH_REL_PLACEHOLDER tags (buildDocxCompare)
  const imgReC = /<GRAPH_REL_PLACEHOLDER rid="([^"]+)" b64="([^"]+)"\/>/g;
  const imgMatchesC = [...documentXml.matchAll(imgReC)];
  let relsXmlC = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  let imgIdxC = 1;
  for (const m of imgMatchesC) {
    const rid = m[1]; // use rid from placeholder directly
    const b64 = m[2];
    const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    zip.file(`word/media/graph${imgIdxC}.png`, imgBytes);
    relsXmlC += `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/graph${imgIdxC}.png"/>`;
    imgIdxC++;
  }
  relsXmlC += `</Relationships>`;
  documentXml = documentXml.replace(imgReC, "");

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXmlC);

  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}

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

function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig) {
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
        const lines = ["Easy","Medium","Hard"]
          .filter(d => (c[d].count||0) > 0)
          .map(d => {
            const gt = c[d].graphType;
            const tableNote = gt === "table" || gt === "mix"
              ? ` [tableRows: ${c[d].tableRows||4}, tableCols: ${c[d].tableCols||2}]`
              : "";
            return `  ${d}: ${c[d].count} question(s) [graphType: ${gt}${tableNote}]`;
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
    return c && ["Easy","Medium","Hard"].some(d => c[d].graphType === "graph" || c[d].graphType === "mix" || c[d].graphType === "table");
  });

  const graphInstructions = hasGraphQuestions ? `
GRAPH/TABLE QUESTIONS:
- graphType "graph": MUST include hasGraph:true and graphConfig in the JSON.
- graphType "table": MUST include a pipe table in the question text presenting the data. Do NOT include graphConfig.
- graphType "mix": mix of normal text questions, table questions, and graph questions. Use tables and graphs when they genuinely help.
- graphType "normal": pure text/calculation only. Do NOT include graphConfig or tables.

CRITICAL — Choose graphConfig type based on how many functions appear in the question:
- Question mentions 1 function (e.g. f(x) = x²-3) → use type "single", put expression in "fn"
- Question mentions 2 functions (e.g. f(x) = x+2 and g(x) = x²) → use type "area", put higher curve in "fnTop", lower in "fnBottom", set "shadeFrom" and "shadeTo" to x-intersection points
- Question is about a region/domain (e.g. y > x², x²+y²≤1) → use type "domain", put boundary in "boundary", set "shadeAbove" true/false

DO NOT include yDomain — it will be auto-calculated from the functions.
DO include xDomain set to a range that shows the full curve clearly.

graphConfig examples:
  1 function: {"type":"single","fn":"x^2-3","showAxisNumbers":true,"showGrid":true,"xDomain":[-4,4]}
  2 functions: {"type":"area","fnTop":"x+2","fnBottom":"x^2","shadeFrom":-1,"shadeTo":2,"showAxisNumbers":true,"showGrid":true,"xDomain":[-3,4]}
  Domain:     {"type":"domain","boundary":"x^2","shadeAbove":true,"boundaryDashed":true,"boundaryLabel":"y = x²","showAxisNumbers":true,"showGrid":true,"xDomain":[-3,3]}

For limit questions with holes: use "single" and include "holes":[[x,y]] for open circles and "points":[[x,y]] for filled dots.
Question text must say "Based on the graph above, ..." — never describe the graph in the question text.
The expressions in graphConfig must EXACTLY match the functions mentioned in the question text.
` : "";
  const typeInstructions = {
    "Multiple Choice": "4 choices as plain strings. answer = exact text of correct choice.",
    "True/False": 'choices = ["True","False"]. answer = "True" or "False".',
    "Free Response": "answer = complete worked answer.",
    "Fill in the Blank": "question has blank shown as ___. answer = the missing word or expression.",
    "Formula": "Include variables array [{name,min,max,precision}] with sensible ranges. Include answerFormula as math expression using variable names. Question text uses [varname] placeholders.",
    "Branched": "Include stem (shared given info), parts array [{question,answer,explanation}]. Decide number of parts (2-4) based on topic. All parts share the same stem.",
  };

  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const isDiscrete = course === "Discrete Mathematics";

  const tableInstructions = isQM ? `
QUANTITATIVE METHODS — QUESTION FORMAT RULES:
Mix these formats naturally across questions. Choose based on what fits the content:

1. NORMAL (text/calculation): Pure numeric scenario, no table or chart needed.
   Example: "A binomial distribution has n=10, p=0.3. Find P(X=4)."

2. TABLE: Present data in a pipe table, ask student to compute from it.
   Use these table types by section:
   * Probability/frequency tables → Random Variables, Distributions
   * Joint probability tables → Conditional Probability, Bivariate
   * Contingency tables → Bayes Theorem
   * Payoff/decision tables → Decision Analysis
   * Regression output tables → Regression sections
   Table format (pipe tables only). Use the exact tableRows and tableCols specified in the section breakdown above.
   tableRows = number of DATA rows (not counting the header or separator). tableCols = number of columns.
   Example for tableRows:4, tableCols:3 — a probability table with 3 columns and 4 data rows:
   | X | P(X) | Cumulative P |
   |---|------|--------------|
   | 0 | 0.10 | 0.10 |
   | 1 | 0.25 | 0.35 |
   | 2 | 0.40 | 0.75 |
   | 3 | 0.25 | 1.00 |
   NEVER default to a 2-column, 4-row table when a larger size is specified. Always match tableRows and tableCols exactly.

3. CHART (when graphType is "graph" or "mix"): Include hasGraph:true and graphConfig.
   Choose chart type based on content:
   * Bar chart → categorical frequency, relative frequency distributions
     graphConfig: {"type":"bar","labels":["A","B","C"],"values":[10,25,15],"xLabel":"Category","yLabel":"Frequency","title":"Frequency Distribution"}
   * Histogram → continuous data distributions, class intervals
     graphConfig: {"type":"histogram","bins":[{"x0":10,"x1":20,"count":5},{"x0":20,"x1":30,"count":12}],"xLabel":"Value","yLabel":"Frequency","title":"Sales Distribution"}
   * Scatter plot → correlation, regression, bivariate data
     graphConfig: {"type":"scatter","points":[{"x":1,"y":3},{"x":2,"y":5}],"xLabel":"x","yLabel":"y","title":"Scatter Plot","regressionLine":{"slope":1.8,"intercept":1.2}}
   * Discrete probability distribution → P(X=x) bar chart
     graphConfig: {"type":"discrete_dist","data":[{"x":0,"p":0.10},{"x":1,"p":0.35},{"x":2,"p":0.40},{"x":3,"p":0.15}],"title":"Probability Distribution","highlightX":2}
   * Normal distribution → bell curve with shaded region, actual μ and σ values
     graphConfig: {"type":"continuous_dist","distType":"normal","mu":50,"sigma":10,"shadeFrom":65,"shadeTo":null,"probability":"P(X>65)","title":"Normal Distribution","xLabel":"x"}

   * Standard normal distribution → z-score curve, always μ=0 σ=1, x-axis shows z values
     graphConfig: {"type":"continuous_dist","distType":"standard_normal","mu":0,"sigma":1,"shadeFrom":1.5,"shadeTo":null,"probability":"P(Z>1.5)","title":"Standard Normal Distribution"}
     Use standard_normal when question involves z-scores, z-tables, or standardization.
     Shade boundaries are z-score values (e.g. shadeFrom:1.28, shadeTo:null for P(Z>1.28)).

   * Uniform distribution → flat rectangle with shading
     graphConfig: {"type":"continuous_dist","distType":"uniform","uMin":2,"uMax":8,"shadeFrom":4,"shadeTo":7,"probability":"P(4<X<7)","title":"Uniform Distribution"}
     CRITICAL for uniform: ALWAYS set uMin and uMax to the actual distribution boundaries from the question. Never leave them at defaults.

   * Exponential distribution → decaying curve
     graphConfig: {"type":"continuous_dist","distType":"exponential","lambda":0.5,"shadeFrom":null,"shadeTo":3,"probability":"P(X<3)","title":"Exponential Distribution"}

   SHADING RULES for continuous_dist:
   - P(X > a): set shadeFrom=a, shadeTo=null
   - P(X < b): set shadeFrom=null, shadeTo=b
   - P(a < X < b): set shadeFrom=a, shadeTo=b
   - Same rules apply for Z in standard normal
   - Always include "probability" field as string e.g. "P(Z > 1.5)" — shown inside shaded area
   Question text must say "Based on the distribution above, find..." — never describe the chart in text.
` : isDiscrete ? `
DISCRETE MATHEMATICS QUESTION GUIDELINES:
- Base questions on Susanna Epp "Discrete Mathematics with Applications" textbook structure.
- Questions must follow the exact style and structure of exercises from that book — you may change variable names, propositions, or specific values but keep the question structure identical.

CRITICAL — LOGICAL NOTATION (always use these symbols, never spell out AND/OR/NOT):
  * NOT p  →  ~p
  * p AND q  →  p ∧ q
  * p OR q   →  p ∨ q
  * p → q    (conditional, "if p then q")
  * p ↔ q    (biconditional, "p if and only if q")
  * Use these symbols in question text, table column headers, and answer choices.
  * Example: write "~p ∧ q" not "(NOT p) AND q"
  * Column headers in truth tables: "~p", "p ∧ q", "p ∨ ~q", "p → q"

- For Ch.2 Logic sections: MUST include truth table questions. CRITICAL TRUTH TABLE FORMAT:
  * Show the truth table with ALL input column values (p, q, r) filled in — NEVER hide inputs.
  * For output columns: fill in MOST values but replace EXACTLY ONE cell with "?" — the one the student must find.
  * Ask "What is the value of [expression] in the row where [specific input values]?" where the answer matches the "?" cell.
  * Use True/False (NOT 0/1, NOT T/F).
  * Example of correct format using proper notation:
    | p | q | p ∧ q | p ∨ (~q) |
    |---|---|-------|----------|
    | True | True | True | True |
    | True | False | False | True |
    | False | True | False | ? |
    | False | False | False | True |
  Then ask: "In the row where p is False and q is True, what is the truth value of p ∨ (~q)?"
  The answer would be "False".
  * NEVER show a complete table with all values filled — that gives away the answer.
  * For harder questions, you may hide 2-3 cells across different output columns.
- For 2.1 (Logical Equivalence): Show partial truth tables for two expressions using proper notation, hide one cell in each, ask if they are equivalent.
- For 2.2 (Conditional Statements): Use → notation; ask for converse, inverse, contrapositive, or truth value for given p and q.
- For 2.3 (Valid Arguments): Give a specific argument with premises and conclusion using ∧ ∨ ~ → notation; ask if it is valid.
- For 3.x (Quantifiers): Use specific domains and predicates with concrete values.
- For 4.x (Proofs): Give specific integer/rational claims; ask to identify proof type or verify a specific step.
- For 5.x (Induction): Give specific n values; ask to verify base case or inductive step.
- For 6.x (Sets): Use sets with explicitly listed elements; ask for union, intersection, complement, power set, or cardinality.
- For 9.x (Counting/Probability): Use specific counting scenarios from the book style.
- Always use concrete specific values — never ask about abstract symbols without grounding them.
` : "";

  const needsChoices = qType==="Multiple Choice"||qType==="True/False";
  const shape = qType==="Branched"
    ? `{"type":"Branched","section":"...","difficulty":"...","stem":"...","parts":[{"question":"...","answer":"...","explanation":"..."}]}`
    : qType==="Formula"
    ? `{"type":"Formula","section":"...","difficulty":"...","question":"...","variables":[{"name":"a","min":1,"max":9,"precision":0}],"answerFormula":"...","answer":"...","explanation":"..."}`
    : needsChoices
    ? `{"type":"${qType}","section":"...","difficulty":"...","question":"...","choices":[...],"answer":"...","explanation":"..."}`
    : `{"type":"${qType}","section":"...","difficulty":"...","question":"...","answer":"...","explanation":"..."}`;

  const courseText = isQM
    ? "You are a college business/statistics professor writing a test bank for a Quantitative Methods course (Anderson, Sweeney, Williams textbook)."
    : isDiscrete
    ? "You are a college professor writing a test bank for Discrete Mathematics based on Susanna Epp's Discrete Mathematics with Applications. Follow the exact question style and structure from the book — change values but not structure."
    : "You are a college math professor writing a test bank from Stewart Calculus Early Transcendentals 9th Edition.";

  return `TESTBANK_GENERATE_REQUEST\nCourse: ${course}\nType: ${qType}\nTotal questions: ${totalQ}\n\nSections, counts, and difficulty/graph config:\n${breakdown}\n\nIMPORTANT: Follow the exact count and difficulty per section strictly.\n\nType instructions: ${typeInstructions[qType]}\n${tableInstructions}${graphInstructions || ''}\n${courseText}\nUse plain-text math: x^2, sqrt(x), summations. For fractions ALWAYS use (numerator)/(denominator) with parentheses around both — never use square brackets like [denominator].\nBe rigorous, numerically specific, university-level.\nEach question must have a 'section' field with the exact section name.\nEach question must have a 'difficulty' field.\n\nReply with ONLY a valid JSON array, no markdown fences, no explanation:\n[${shape}, ...]`;
}

function buildVersionPrompt(selectedQuestions, mutationType, versionLabel) {
  const lines = selectedQuestions.map((q,i) => {
    const mut = mutationType[q.id]||"numbers";
    const orig = q.type==="Branched" ? q.stem : q.question;
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"] Original: "+orig;
  }).join("\n");
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- For Branched: mutate the shared stem and regenerate ALL parts consistently.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation}\n- Branched: {type, section, difficulty, stem, parts:[{question,answer,explanation}]}\nReply with ONLY valid JSON array, no markdown.`;
}


// Single combined prompt for ALL classroom sections AND versions at once
function buildAllVersionsPrompt(selectedQuestions, mutationType, labels, classSection=1, numClassSections=1) {
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.type==="Branched" ? q.stem : q.question;
    const mut = mutationType[q.id] || "numbers";
    return (i+1)+". ["+q.section+"] ["+q.type+"] [mutation: "+mut+"] Original: "+orig;
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
    return `TESTBANK_ALL_VERSIONS_REQUEST\nVersions to create: ${versionList}\n\nFor each version, mutate ALL of the following questions:\n${lines}\n\nPER-QUESTION MUTATION RULES:\n${mutRules}\n\nADDITIONAL RULES:\n- ALWAYS regenerate a correct answer key for each mutated version.\n- Keep same question type, section, and difficulty.\n- Each version must be DIFFERENT from all others.\n- Within numbers-mutation questions: versions differ only by coefficients/constants.\n- Within function-mutation questions: versions use different function types from each other.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n\nReturn a JSON object with one key per version label. Each value is a JSON array of mutated questions in the SAME order:\n{\n  "A": [{type, section, difficulty, question, choices, answer, explanation}, ...],\n  "B": [{type, section, difficulty, question, choices, answer, explanation}, ...]\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
  }

  // Multi-section: single prompt, all sections + versions
  const sectionKeys = [];
  for (let s = 1; s <= numClassSections; s++) {
    for (const lbl of labels) {
      sectionKeys.push(`S${s}_${lbl}`);
    }
  }

  const sectionRules = Array.from({length: numClassSections}, (_,i) => {
    const s = i+1;
    if (s === 1) return `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types.`;
    return `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — change to DIFFERENT but equivalent-difficulty functions. Must differ completely from Section 1${s > 2 ? " and all previous sections" : ""}.`;
  }).join("\n");

  const exampleKeys = sectionKeys.map(k => `"${k}": [{...}]`).join(",\n  ");

  return `TESTBANK_ALL_SECTIONS_AND_VERSIONS_REQUEST\nClassroom Sections: ${numClassSections}\nVersions per section: ${versionList}\nTotal keys to generate: ${sectionKeys.join(", ")}\n\nFor each key, mutate ALL of the following questions:\n${lines}\n\nMUTATION RULES BY SECTION:\n${sectionRules}\n\nADDITIONAL RULES:\n- Within each section, versions (A, B, C...) must differ from each other by numbers only.\n- Across sections, questions must use completely different function types.\n- ALWAYS regenerate correct answer keys.\n- Keep same question type, section name, and difficulty throughout.\n- Each version must be a JSON array in the SAME question order.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n\nReturn a single JSON object with ALL keys:\n{\n  ${exampleKeys}\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
}

// Single combined prompt for ALL classroom sections at once
// Returns one prompt that asks for S1_A, S1_B, S2_A, S2_B etc.
function buildAllSectionsPrompt(selectedQuestions, labels, numClassSections) {
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.type==="Branched" ? q.stem : q.question;
    return (i+1)+". ["+q.section+"] ["+q.type+"] Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");

  // Build version keys: S1_A, S1_B, S2_A, S2_B etc.
  const allKeys = [];
  for(let s=1; s<=numClassSections; s++) {
    labels.forEach(v => allKeys.push(`S${s}_${v}`));
  }

  const sectionRules = Array.from({length:numClassSections},(_,i)=>i+1).map(s =>
    `- Section ${s} versions (S${s}_A, S${s}_B, ...): ${s===1 ? "numbers mutation — change only coefficients/constants, keep same function types." : `function mutation — use COMPLETELY DIFFERENT but equivalent-difficulty functions from Section 1${s>2?" and all previous sections":""}. Different function types (e.g. if S1 used polynomial, use trig or exponential).`}`
  ).join("\n");

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
- Across sections: each section must use different functions entirely.
- ALWAYS regenerate a correct answer key for each mutated version.
- Keep same question type, section name, and difficulty.

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
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.type==="Branched" ? q.stem : q.question}\nMutation: ${mutationType} — ${mutationRule}\nRequirements: same section, same question type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Branched"?"Include stem and parts array.":""}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
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

// ─── Paste Panel ──────────────────────────────────────────────────────────────
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
        <button style={S.oBtn(text2)} onClick={onCancel}>Cancel</button>
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
      style={{ width, padding:"0.5rem 0.7rem", background:"#1a1a2e", border:"1px solid #334155",
        borderRadius:"6px", color:"#e8e8e0", fontSize:"0.82rem", outline:"none", boxSizing:"border-box" }} />
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
                  border:`1px solid ${border}`, borderRadius:"8px", padding:"0.4rem 0.75rem",
                  borderLeft:`3px solid ${c.color}` }}>
                  <span style={{ fontSize:"0.82rem", color:"#e8e8e0" }}>{name}</span>
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
            <div style={{ background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:"10px", padding:"1.25rem" }}>
              <div style={{ fontSize:"0.82rem", fontWeight:"600", color:"#60a5fa", marginBottom:"1rem" }}>
                {editing === "new" ? "New Course" : `Editing: ${editing}`}
              </div>

              {/* Syllabus Import */}
              <div style={{ marginBottom:"0.75rem" }}>
                <button onClick={() => setShowSyllabus(s => !s)}
                  style={{ background: showSyllabus ? "#1e3a5f" : "transparent", color:"#60a5fa",
                    border:"1px solid #1e3a5f", borderRadius:"6px", padding:"0.35rem 0.85rem",
                    fontSize:"0.78rem", cursor:"pointer", marginBottom: showSyllabus ? "0.75rem" : 0 }}>
                  📄 {showSyllabus ? "Hide" : "Import from Syllabus"}
                </button>
                {showSyllabus && (
                  <div style={{ background:"#060d1a", border:"1px solid #1e3a5f", borderRadius:"8px", padding:"0.85rem" }}>
                    {/* Mode tabs */}
                    <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem" }}>
                      {["file", "paste"].map(mode => (
                        <button key={mode} onClick={() => setSyllabusMode(mode)}
                          style={{ background: syllabusMode === mode ? "#1e3a5f" : "transparent",
                            color: syllabusMode === mode ? "#60a5fa" : text3,
                            border:`1px solid ${syllabusMode === mode ? "#1e3a5f" : "#334155"}`,
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
                          style={{ background:"#1e3a5f", color:"#60a5fa", border:"1px solid #1e3a5f",
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
                          style={{ width:"100%", padding:"0.5rem 0.7rem", background:"#1a1a2e", border:"1px solid #334155",
                            borderRadius:"6px", color:"#e8e8e0", fontSize:"0.78rem", outline:"none",
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
                    background:"#060d1a", borderRadius:"6px", padding:"0.4rem 0.7rem" }}>
                    <span style={{ fontSize:"0.75rem", color:"#60a5fa", fontWeight:"600", minWidth:"20px" }}>{ch.ch}</span>
                    <span style={{ fontSize:"0.78rem", color:"#e8e8e0", flex:1 }}>{ch.title}</span>
                    <span style={{ fontSize:"0.68rem", color:text3 }}>{ch.sections.length} sections</span>
                    {isAdmin && <button onClick={() => removeChapter(i)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#f87171", fontSize:"0.8rem" }}>✕</button>}
                  </div>
                ))}

                {/* Add chapter manually — admin only */}
                {isAdmin && (
                  <div style={{ background:"#060d1a", border:"1px dashed #1e3a5f", borderRadius:"8px", padding:"0.85rem", marginTop:"0.5rem" }}>
                    <div style={{ fontSize:"0.72rem", color:text3, marginBottom:"0.5rem" }}>Add Chapter Manually</div>
                    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:"0.5rem", marginBottom:"0.5rem" }}>
                      {inp(newChapter.ch, v => setNewChapter(p => ({...p, ch:v})), "Ch#", "100%")}
                      {inp(newChapter.title, v => setNewChapter(p => ({...p, title:v})), "Chapter title")}
                    </div>
                    <textarea value={newChapter.sections} onChange={e => setNewChapter(p => ({...p, sections:e.target.value}))}
                      placeholder={"One section per line:\n1.1 Introduction\n1.2 Key Concepts"}
                      rows={3}
                      style={{ width:"100%", padding:"0.5rem 0.7rem", background:"#1a1a2e", border:"1px solid #334155",
                        borderRadius:"6px", color:"#e8e8e0", fontSize:"0.78rem", outline:"none",
                        boxSizing:"border-box", resize:"vertical", fontFamily:"inherit" }} />
                    <button onClick={addChapter}
                      style={{ marginTop:"0.5rem", background:"#1e3a5f", color:"#60a5fa", border:"none",
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
                  style={{ background:"none", color:text2, border:"1px solid #334155", borderRadius:"6px",
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
function SavedExamsScreen({ S, text2, text3, border, onLoad }) {
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
        // detect sections from classSection field on questions
        const sectionNums = [...new Set(versions.map(v => v.questions?.[0]?.classSection).filter(Boolean))].sort((a,b)=>a-b);
        const hasMultipleSections = sectionNums.length > 1;
        const safeName = (exam.name||"Exam").replace(/[^a-zA-Z0-9]/g,"_");

        return (
        <div key={exam.id} style={S.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"0.5rem"}}>
            <div>
              <div style={{fontSize:"1rem", fontWeight:"bold", color:"#e8e8e0", marginBottom:"0.25rem"}}>{exam.name}</div>
              <div style={{fontSize:"0.72rem", color:text3}}>
                {new Date(exam.created_at).toLocaleDateString()} · {versions.length} version(s)
                {hasMultipleSections && ` · ${sectionNums.length} sections`}
              </div>
              <button style={{marginTop:"0.4rem", padding:"0.25rem 0.7rem", fontSize:"0.72rem",
                background:"#10b981", color:"#000", border:"none", borderRadius:"4px",
                cursor:"pointer", fontWeight:"600"}}
                onClick={() => onLoad && onLoad(exam)}>
                ▶ Load into Versions tab
              </button>
            </div>
            <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
              {/* QTI per version */}
              {versions.map(v => (
                <button key={v.label} style={S.oBtn("#8b5cf6")}
                  onClick={async () => {
                    dlFile(buildQTI(v.questions, exam.name, v.label), `${exam.name}_V${v.label}.xml`, "text/xml");
                    await logExport(exam.name, "QTI", v.label);
                  }}>
                  ⬇ V{v.label} QTI
                </button>
              ))}
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
                    const secVersions = versions.filter(v => v.questions?.[0]?.classSection === sec || (!v.questions?.[0]?.classSection && sec === sectionNums[0]));
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
            <div style={{marginTop:"0.75rem", background:"#060d18", border:"1px solid #1e3a5f", borderRadius:"10px", padding:"1rem"}}>
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
                  <div style={{flex:1, fontSize:"0.78rem", color:"#e8e8e0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                    title={r.label}>{r.label}</div>
                  <div style={{flexShrink:0, width:"180px"}}>
                    <div style={{height:"6px", borderRadius:"3px", background:"#1e3a5f", overflow:"hidden"}}>
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
          <h2 style={{fontSize:"1.1rem", fontWeight:"normal", margin:"2rem 0 0.75rem", color:"#e8e8e0"}}>Export History</h2>
          <div style={S.card}>
            {exportLog.map((log, i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"0.4rem 0", borderBottom: i < exportLog.length-1 ? `1px solid ${border}` : "none", fontSize:"0.78rem"}}>
                <span style={{color:"#e8e8e0"}}>{log.exam_name} — V{log.version_label}</span>
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
export default function TestBankApp() {
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
      onSuccess(data.result);
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
  const [examSaved, setExamSaved] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenError, setAutoGenError] = useState("");
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
  const accent = course ? (allCourses[course]?.color || "#10b981") : "#10b981";

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

      // For version_all, parse as object {A:[...], B:[...]}
      if (pendingType === "version_all") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found. Make sure you copied the full response.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, classSection } = pendingMeta;
        const allVersions = labels.map(label => {
          const qs = parsed[label] || [];
          const versioned = qs.map((q,i) => ({
            ...q, id: uid(), originalId: selected[i]?.id,
            course: selected[i]?.course || course,
            versionLabel: label, classSection, createdAt: Date.now(),
            ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: selected[i].graphConfig } : {}),
          }));
          return { label, questions: versioned, classSection };
        });
        setClassSectionVersions(prev => ({ ...prev, [classSection]: allVersions }));
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
              ...q, id: uid(), originalId: selected[i]?.id,
              course: selected[i]?.course || course,
              versionLabel: label, classSection: s, createdAt: Date.now(),
              ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: selected[i].graphConfig } : {}),
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

      // Sanitize API response — guard against null/missing fields from AI
      const sanitize = (q) => ({
        ...q,
        type:       q.type       || "Multiple Choice",
        difficulty: q.difficulty || "Medium",
        question:   q.question   || "",
        answer:     q.answer     || "",
        choices:    (q.choices   || []).map(c => c ?? ""),
      });
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
        setScreen("review");
      } else if (pendingType === "version") {
        const { selected, label, allVersions, remaining, mutationType: mt } = pendingMeta;
        const versioned = sanitized.map((q,i) => ({
          ...q,
          id: uid(),
          originalId: selected[i]?.id,
          course: selected[i]?.course || course,
          versionLabel: label,
          createdAt: Date.now(),
          // carry graph config from original question
          ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: selected[i].graphConfig } : {}),
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
      const prompt = buildAllSectionsPrompt(selected, labels, numClassSections);
      setGeneratedPrompt(prompt);
      setPendingType("version_all_sections");
      setPendingMeta({ selected, labels, numClassSections });
    } else {
      const prompt = buildAllVersionsPrompt(selected, mutationType, labels, 1, 1);
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

  function defaultSecCfg() { return { Easy:{count:1,graphType:"normal",tableRows:4,tableCols:2}, Medium:{count:1,graphType:"normal",tableRows:5,tableCols:3}, Hard:{count:1,graphType:"normal",tableRows:6,tableCols:3} }; }

  function getSectionConfig(sec) { return sectionConfig[sec] || defaultSecCfg(); }
  function setSectionDiff(sec, difficulty, field, value) {
    setSectionConfig(prev => ({ ...prev, [sec]: { ...getSectionConfig(sec), [difficulty]: { ...getSectionConfig(sec)[difficulty], [field]: value } } }));
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
  });

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
  const courseColors = { "Calculus 1":"#10b981","Calculus 2":"#8b5cf6","Calculus 3":"#f59e0b","Quantitative Methods I":"#06b6d4","Quantitative Methods II":"#f43f5e","Precalculus":"#e879f9","Discrete Mathematics":"#a855f7" };

  // ── Design tokens ────────────────────────────────────────────────────────────
  const bg0   = "#080c14";   // deepest bg
  const bg1   = "#0d1321";   // card bg
  const bg2   = "#111827";   // elevated card
  const bg3   = "#1a2235";   // hover / subtle
  const border = "#1e2d45";
  const text1  = "#f0f4ff";
  const text2  = "#7a92b8";
  const text3  = "#3a4f6a";

  const S = {
    // Layout
    app: { display:"flex", minHeight:"100vh", background:bg0, fontFamily:"'Inter',system-ui,sans-serif", color:text1 },
    sidebar: {
      width:"242px", flexShrink:0, background:"#080d1a",
      borderRight:"1px solid #0f1e3a",
      display:"flex", flexDirection:"column", padding:"0",
      position:"sticky", top:0, height:"100vh", overflowY:"auto"
    },
    sidebarLogo: {
      padding:"1.4rem 1.2rem 1.1rem", borderBottom:"1px solid #0f1e3a",
      display:"flex", alignItems:"center", gap:"0.75rem"
    },
    logoMark: {
      width:"34px", height:"34px", borderRadius:"9px",
      background:"linear-gradient(135deg, "+accent+" 0%, #0ea5e9 100%)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:"0.95rem", fontWeight:"900", color:"#fff", flexShrink:0,
      boxShadow:"0 0 14px "+accent+"55"
    },
    logoText: { fontSize:"0.97rem", fontWeight:"800", letterSpacing:"-0.03em", color:"#eef2ff" },
    logoSub: { fontSize:"0.57rem", color:"#2d4a7a", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:"2px" },
    navSection: { padding:"1.1rem 1rem 0.3rem", fontSize:"0.57rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"#1e3660", fontWeight:"700" },
    navBtn: (a) => ({
      display:"flex", alignItems:"center", gap:"0.65rem",
      padding:"0.58rem 0.85rem", margin:"0.06rem 0.55rem",
      borderRadius:"8px", border:"none", cursor:"pointer",
      background: a ? accent+"1a" : "transparent",
      color: a ? accent : "#5a7aa8",
      fontSize:"0.82rem", fontWeight: a ? "600" : "400",
      textAlign:"left", width:"calc(100% - 1.1rem)",
      transition:"background 0.12s, color 0.12s",
      borderLeft: a ? "2px solid "+accent : "2px solid transparent",
    }),
    navIcon: { fontSize:"1rem", width:"20px", textAlign:"center", flexShrink:0 },
    navBadge: (c) => ({
      marginLeft:"auto", background:c+"20", color:c, border:"1px solid "+c+"40",
      borderRadius:"10px", padding:"0.06rem 0.42rem", fontSize:"0.61rem", fontWeight:"700"
    }),
    main: { flex:1, minWidth:0, padding:"2rem 2.5rem", maxWidth:"960px" },
    pageHeader: { marginBottom:"2rem" },
    h1: { fontSize:"1.6rem", fontWeight:"700", letterSpacing:"-0.03em", marginBottom:"0.25rem", color:text1 },
    h2: { fontSize:"1.1rem", fontWeight:"600", letterSpacing:"-0.02em", marginBottom:"0.5rem", color:text1 },
    sub: { color:text2, fontSize:"0.83rem", marginBottom:"0", lineHeight:1.5 },
    // Cards
    card: {
      background:bg1, border:"1px solid "+border, borderRadius:"12px",
      padding:"1.5rem", marginBottom:"1rem"
    },
    cardSm: {
      background:bg1, border:"1px solid "+border, borderRadius:"10px",
      padding:"1rem", marginBottom:"0.75rem"
    },
    statCard: (c) => ({
      background:bg1, border:"1px solid "+border, borderRadius:"12px",
      padding:"1.25rem", position:"relative", overflow:"hidden"
    }),
    statAccent: (c) => ({
      position:"absolute", top:0, left:0, right:0, height:"2px",
      background:"linear-gradient(90deg, "+c+", "+c+"44)"
    }),
    // Course chips
    courseChip: (c, active) => ({
      display:"inline-flex", alignItems:"center", gap:"0.4rem",
      padding:"0.4rem 0.9rem", borderRadius:"20px", cursor:"pointer", border:"none",
      background: active ? c+"22" : bg2,
      color: active ? c : text2,
      fontSize:"0.78rem", fontWeight: active ? "600" : "400",
      outline: active ? "1.5px solid "+c+"66" : "1px solid "+border,
      fontFamily:"'Inter',system-ui,sans-serif", transition:"all 0.15s"
    }),
    courseDot: (c) => ({
      width:"7px", height:"7px", borderRadius:"50%", background:c, flexShrink:0
    }),
    // Section buttons
    sGrid: { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"0.35rem" },
    sBtn: (sel) => ({
      background: sel ? accent+"15" : bg2,
      border: "1px solid "+(sel ? accent+"55" : border),
      borderRadius:"8px", padding:"0.55rem 0.75rem", cursor:"pointer",
      color: sel ? accent : text2, fontSize:"0.78rem", textAlign:"left",
      fontFamily:"'Inter',system-ui,sans-serif", display:"flex", alignItems:"center", gap:"0.45rem",
      transition:"all 0.15s"
    }),
    chk: (sel) => ({
      width:"14px", height:"14px", borderRadius:"4px",
      border:"1.5px solid "+(sel ? accent : text3),
      background: sel ? accent : "transparent", flexShrink:0,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:"9px", color:"#000", fontWeight:"bold"
    }),
    // Form elements
    row: { display:"flex", gap:"1rem", marginBottom:"1.25rem", flexWrap:"wrap" },
    field: { flex:1, minWidth:"120px" },
    lbl: { display:"block", fontSize:"0.65rem", textTransform:"uppercase", letterSpacing:"0.1em", color:text3, marginBottom:"0.4rem", fontWeight:"600" },
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
      background: dis ? bg3 : bg, color: dis ? text3 : "#000",
      border:"none", borderRadius:"8px", padding:"0.65rem 1.4rem",
      fontSize:"0.83rem", fontWeight:"600", cursor: dis ? "not-allowed" : "pointer",
      fontFamily:"'Inter',system-ui,sans-serif", display:"inline-flex",
      alignItems:"center", gap:"0.45rem", transition:"opacity 0.15s"
    }),
    oBtn: (c) => ({
      background:"transparent", color:c, border:"1px solid "+c+"66",
      borderRadius:"8px", padding:"0.55rem 1.1rem", fontSize:"0.78rem",
      cursor:"pointer", fontFamily:"'Inter',system-ui,sans-serif",
      display:"inline-flex", alignItems:"center", gap:"0.4rem"
    }),
    smBtn: {
      background:bg3, border:"1px solid "+border, color:text2, borderRadius:"6px",
      padding:"0.2rem 0.55rem", fontSize:"0.68rem", cursor:"pointer",
      fontFamily:"'Inter',system-ui,sans-serif"
    },
    ghostBtn: (c) => ({
      background:c+"12", color:c, border:"none", borderRadius:"6px",
      padding:"0.25rem 0.6rem", fontSize:"0.7rem", cursor:"pointer",
      fontFamily:"'Inter',system-ui,sans-serif", fontWeight:"500"
    }),
    // Tags
    tag: (c) => ({
      display:"inline-flex", alignItems:"center", gap:"0.25rem",
      background:(c||accent)+"15", border:"1px solid "+(c||accent)+"33",
      color:(c||accent), borderRadius:"5px", padding:"0.1rem 0.45rem",
      fontSize:"0.65rem", fontWeight:"500", marginRight:"0.25rem"
    }),
    diffTag: (d) => {
      const dc = d==="Easy"?"#10b981":d==="Medium"?"#f59e0b":"#f43f5e";
      return { display:"inline-block", background:dc+"18", color:dc, border:"1px solid "+dc+"33",
        borderRadius:"4px", padding:"0.1rem 0.4rem", fontSize:"0.62rem", fontWeight:"600" };
    },
    divider: { border:"none", borderTop:"1px solid "+border, margin:"1.5rem 0" },
    // Question cards
    qCard: {
      background:bg1, border:"1px solid "+border, borderRadius:"10px",
      padding:"1.1rem", marginBottom:"0.6rem", transition:"border-color 0.15s"
    },
    qMeta: {
      fontSize:"0.62rem", color:text3, letterSpacing:"0.05em",
      textTransform:"uppercase", marginBottom:"0.4rem",
      display:"flex", gap:"0.4rem", alignItems:"center", flexWrap:"wrap"
    },
    qText: { fontSize:"0.88rem", color:"#c8d8f0", lineHeight:1.7, marginBottom:"0.65rem" },
    cList: { listStyle:"none", padding:0, margin:0, marginBottom:"0.5rem" },
    cItem: (correct) => ({
      padding:"0.35rem 0.65rem", marginBottom:"0.2rem", borderRadius:"6px",
      background: correct ? "#10b98115" : "transparent",
      border: "1px solid "+(correct ? "#10b98144" : border),
      color: correct ? "#10b981" : text2, fontSize:"0.83rem",
      display:"flex", alignItems:"flex-start", gap:"0.5rem"
    }),
    ans: {
      fontSize:"0.8rem", color:"#10b981", background:"#10b98110",
      border:"1px solid #10b98130", borderRadius:"6px",
      padding:"0.35rem 0.7rem", marginBottom:"0.35rem",
      display:"flex", alignItems:"center", gap:"0.4rem"
    },
    expl: { fontSize:"0.76rem", color:text2, fontStyle:"italic", marginTop:"0.2rem", lineHeight:1.6 },
    vTab: (active, c) => ({
      background: active ? c+"20" : "transparent",
      border: "1px solid "+(active ? c+"66" : border),
      color: active ? c : text2, borderRadius:"8px",
      padding:"0.4rem 0.9rem", fontSize:"0.78rem", cursor:"pointer",
      fontFamily:"'Inter',system-ui,sans-serif", fontWeight: active ? "600" : "400"
    }),
    // Paste/prompt
    pasteBox: {
      background:bg2, border:"1px solid "+accent+"33", borderRadius:"10px",
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
          background:"#f59e0b14", border:"1px solid #f59e0b40",
          borderRadius:"8px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:"0.5rem"
        }}>
          <span style={{fontSize:"0.9rem"}}>⚡</span>
          <div>
            <div style={{fontSize:"0.71rem", color:"#f59e0b", fontWeight:"600", lineHeight:1.3}}>{lastGenerated.length} questions ready to review</div>
            <div style={{fontSize:"0.62rem", color:"#7a5a10", marginTop:"1px"}}>Click to review →</div>
          </div>
        </div>
      )}
      {bankIssueCount > 0 && (
        <div onClick={() => { setFilterIssuesOnly(true); setScreen("bank"); }} style={{
          margin:"0.4rem 0.6rem 0", padding:"0.5rem 0.7rem",
          background:"#f8717114", border:"1px solid #f8717140",
          borderRadius:"8px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:"0.5rem"
        }}>
          <span style={{fontSize:"0.9rem"}}>⚠️</span>
          <div>
            <div style={{fontSize:"0.71rem", color:"#fca5a5", fontWeight:"600", lineHeight:1.3}}>{bankIssueCount} question{bankIssueCount>1?"s":""} with issues</div>
            <div style={{fontSize:"0.62rem", color:"#6b2525", marginTop:"1px"}}>Click to fix →</div>
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
        <div style={{padding:"0.7rem 1rem", borderTop:"1px solid #0f1e3a"}}>
          <div style={{fontSize:"0.57rem", color:"#1e3660", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.3rem"}}>Active Course</div>
          <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
            <div style={{width:"7px", height:"7px", borderRadius:"50%", background:accent, flexShrink:0, boxShadow:"0 0 6px "+accent}}/>
            <span style={{fontSize:"0.74rem", color:accent, fontWeight:"600", lineHeight:1.3}}>{course}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{padding:"0.55rem 1rem", borderTop:"1px solid #0f1e3a"}}>
        {user && (
          <div style={{marginBottom:"0.4rem"}}>
            <div style={{fontSize:"0.6rem", color:"#1e3660", marginBottom:"0.15rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
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
          <span style={{fontSize:"0.57rem", color:"#1e3660"}}>TestBank Pro</span>
          <span style={{fontSize:"0.57rem", color:"#1e3660", background:"#0f1e3a", padding:"0.1rem 0.4rem", borderRadius:"4px", fontWeight:"600"}}>v55</span>
        </div>
      </div>
    </aside>
  );

  const [confirmDelete, setConfirmDelete] = useState(null); // {id, label}

  if (authLoading) return (
    <div style={{ minHeight:"100vh", background:"#0a0a1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"1.4rem", fontWeight:"800", color:"#e8e8e0", marginBottom:"1.25rem", letterSpacing:"-0.5px" }}>
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

      {/* ── Delete confirmation dialog ── */}
      {confirmDelete && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9998,
          display:"flex", alignItems:"center", justifyContent:"center"}}>
          <div style={{background:"#0d1425", border:"1px solid #1e3a5f", borderRadius:"12px",
            padding:"1.5rem", maxWidth:"380px", width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{fontSize:"1rem", fontWeight:"700", color:"#f0f4ff", marginBottom:"0.5rem"}}>Delete Question?</div>
            <div style={{fontSize:"0.82rem", color:"#6b89b8", marginBottom:"1.25rem", lineHeight:1.5}}>
              This will permanently remove the question from your bank. This cannot be undone.
            </div>
            <div style={{display:"flex", gap:"0.75rem"}}>
              <button onClick={async () => {
                await deleteQuestion(confirmDelete.id);
                setBank(prev => prev.filter(q => q.id !== confirmDelete.id));
                setConfirmDelete(null);
                showToast("Question deleted");
              }} style={{flex:1, padding:"0.5rem", background:"#7c2d12", color:"#fca5a5",
                border:"1px solid #f8717144", borderRadius:"6px", cursor:"pointer", fontWeight:"600", fontSize:"0.82rem"}}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(null)}
                style={{flex:1, padding:"0.5rem", background:"transparent", color:"#6b89b8",
                  border:"1px solid #1e3a5f", borderRadius:"6px", cursor:"pointer", fontSize:"0.82rem"}}>
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
            <div style={S.pageHeader}>
              <h1 style={S.h1}>Dashboard</h1>
              <p style={S.sub}>Welcome to TestBank Pro — your exam authoring workspace.</p>
            </div>

            {/* Workflow connector */}
            <div style={{background:"#080d1a", border:"1px solid #0f1e3a", borderRadius:"12px", padding:"1.4rem", marginBottom:"1.5rem"}}>
              <div style={{fontSize:"0.6rem", color:"#1e3660", textTransform:"uppercase", letterSpacing:"0.14em", fontWeight:"700", marginBottom:"1rem"}}>Your Workflow</div>
              <div style={{display:"flex", alignItems:"center", gap:"0"}}>
                {[
                  { step:"1", label:"Generate", sub:"Create with AI", sc:"generate", color:"#10b981" },
                  { step:"2", label:"Review", sub:"Check & save", sc:"review", color:"#f59e0b", badge: lastGenerated.length || 0 },
                  { step:"3", label:"Build Exam", sub:"Select & version", sc:"versions", color:"#8b5cf6" },
                  { step:"4", label:"Export", sub:"Word · QTI · Print", sc:"export", color:"#185FA5" },
                ].map((s, i) => (
                  <div key={i} style={{display:"flex", alignItems:"center", flex:1}}>
                    <div onClick={() => {
                      if (s.sc === "export") { setScreen("versions"); setExportHighlight(true); setTimeout(() => setExportHighlight(false), 2500); }
                      else setScreen(s.sc);
                    }} style={{
                      flex:1, padding:"1rem 0.75rem", borderRadius:"10px", cursor:"pointer", textAlign:"center",
                      background: (s.sc === "export" ? exportHighlight : screen===s.sc) ? s.color+"18" : "#0d1530",
                      border:"1px solid "+((s.sc === "export" ? exportHighlight : screen===s.sc) ? s.color+"50" : "#0f1e3a"),
                      transition:"all 0.15s"
                    }}>
                      <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem", marginBottom:"0.4rem"}}>
                        <div style={{width:"22px", height:"22px", borderRadius:"50%", background:s.color+"22",
                          border:"1.5px solid "+s.color+"55", fontSize:"0.68rem", fontWeight:"700", color:s.color,
                          display:"flex", alignItems:"center", justifyContent:"center"}}>{s.step}</div>
                        {s.badge > 0 && <span style={{background:"#f59e0b22", color:"#f59e0b", fontSize:"0.6rem", fontWeight:"700", padding:"0.05rem 0.35rem", borderRadius:"8px"}}>{s.badge}</span>}
                      </div>
                      <div style={{fontSize:"0.8rem", fontWeight:"600", color:s.color}}>{s.label}</div>
                      <div style={{fontSize:"0.62rem", color:"#3a5a8a", marginTop:"0.2rem"}}>{s.sub}</div>
                    </div>
                    {i < 3 && (
                      <div style={{display:"flex", alignItems:"center", padding:"0 0.3rem", flexShrink:0}}>
                        <div style={{width:"20px", height:"1px", background:"#1a2f50"}}/>
                        <div style={{color:"#1a2f50", fontSize:"0.7rem", lineHeight:1}}>›</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"1.5rem"}}>
              {[
                { label:"Questions in Bank", value:bank.length, color:"#10b981", icon:"▦", action:() => setScreen("bank") },
                { label:"Pending Review",    value:lastGenerated.length || 0, color:"#f59e0b", icon:"◎", action:() => setScreen("review") },
                { label:"Issues Found",      value:bankIssueCount, color:bankIssueCount>0?"#f87171":"#10b981", icon:bankIssueCount>0?"⚠":"✓", action:() => { setFilterIssuesOnly(bankIssueCount > 0); setScreen("bank"); } },
              ].map((s,i) => (
                <div key={i} onClick={s.action} style={{...S.statCard(s.color), cursor:"pointer"}}>
                  <div style={S.statAccent(s.color)}/>
                  <div style={{fontSize:"1.5rem", marginBottom:"0.15rem"}}>{s.icon}</div>
                  <div style={{fontSize:"1.6rem", fontWeight:"700", color:s.color, letterSpacing:"-0.03em"}}>{s.value}</div>
                  <div style={{fontSize:"0.72rem", color:text2, marginTop:"0.2rem"}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Courses grid header */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem"}}>
              <div style={S.h2}>Courses</div>
              <button style={{...S.oBtn(accent), fontSize:"0.72rem", padding:"0.3rem 0.75rem"}} onClick={() => setScreen("generate")}>+ Generate Questions</button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"0.75rem", marginBottom:"1.5rem"}}>
              {Object.entries(allCourses).map(([name, { color, chapters }]) => {
                const qCount = bank.filter(q => q.course === name).length;
                return (
                  <div key={name}
                    style={{
                      background:bg1, borderRadius:"12px", padding:"1.1rem",
                      border:"1px solid "+border, cursor:"pointer",
                      borderTop:"3px solid "+color, transition:"border-color 0.15s"
                    }}
                    onClick={() => { setCourse(name); setSelectedSections([]); setSectionCounts({}); setSectionConfig({}); setScreen("generate"); }}>
                    <div style={{fontSize:"0.82rem", fontWeight:"600", color:text1, marginBottom:"0.35rem"}}>{name}</div>
                    <div style={{fontSize:"0.7rem", color:text2}}>{chapters.length} chapters</div>
                    {qCount > 0 && <div style={{fontSize:"0.68rem", color:color, marginTop:"0.3rem", fontWeight:"500"}}>{qCount} questions in bank</div>}
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
              <div>
                <div style={{...S.h2, marginBottom:"0.75rem"}}>Recent Questions</div>
                {bank.slice(0,3).map((q,i) => (
                  <div key={i} style={{...S.cardSm, display:"flex", alignItems:"flex-start", gap:"0.75rem"}}>
                    <div style={{flexShrink:0, width:"28px", height:"28px", borderRadius:"6px",
                      background:(courseColors[q.course]||accent)+"20",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:"0.7rem", color:courseColors[q.course]||accent, fontWeight:"700"}}>
                      {(q.section||"?").split(" ")[0]}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:"0.75rem", color:text2, marginBottom:"0.2rem"}}>
                        <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                        <span style={S.diffTag(q.difficulty)}>{q.difficulty}</span>
                      </div>
                      <div style={{fontSize:"0.83rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {q.type==="Branched" ? q.stem : q.question}
                      </div>
                    </div>
                  </div>
                ))}
                <button style={{...S.oBtn(text2), fontSize:"0.75rem", marginTop:"0.5rem"}} onClick={() => setScreen("bank")}>
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
                              {sel && (() => {
                                const cfg = getSectionConfig(sec);
                                const diffColors = { Easy:"#10b981", Medium:"#f59e0b", Hard:"#f43f5e" };
                                return (
                                  <div style={{marginTop:"0.4rem", paddingLeft:"0.75rem", borderLeft:"2px solid #334155"}}>
                                    {["Easy","Medium","Hard"].map(d => (
                                      <div key={d} style={{display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"0.25rem", flexWrap:"wrap"}}>
                                        <span style={{fontSize:"0.68rem", color:diffColors[d], fontWeight:"600", minWidth:"46px"}}>{d}</span>
                                        <input type="number" min={0} max={10} value={cfg[d].count}
                                          style={{width:"40px", ...S.input, padding:"0.2rem 0.3rem", fontSize:"0.75rem"}}
                                          onChange={e => setSectionDiff(sec, d, "count", Number(e.target.value)||0)} />
                                        <span style={{fontSize:"0.65rem", color:text3}}>q</span>
                                        {((course === "Quantitative Methods I" || course === "Quantitative Methods II") ? ["normal","table","graph","mix"] : ["normal","graph","mix"]).map(gt => (
                                          <button key={gt} onClick={() => setSectionDiff(sec, d, "graphType", gt)}
                                            style={{padding:"0.15rem 0.35rem", fontSize:"0.65rem", borderRadius:"3px", cursor:"pointer",
                                              background: cfg[d].graphType===gt
                                                ? (gt==="graph"?"#1D9E75":gt==="table"?"#185FA5":gt==="mix"?"#8b5cf6":"#334155")
                                                : "transparent",
                                              color: cfg[d].graphType===gt ? "#fff" : text3,
                                              border:`1px solid ${cfg[d].graphType===gt?(gt==="graph"?"#1D9E75":gt==="table"?"#185FA5":gt==="mix"?"#8b5cf6":"#475569"):"#334155"}`}}>
                                            {gt==="normal"?"Text":gt==="graph"?"Graph":gt==="table"?"Table":"Mix"}
                                          </button>
                                        ))}
                                        {(cfg[d].graphType === "table" || cfg[d].graphType === "mix") && (course === "Quantitative Methods I" || course === "Quantitative Methods II") && (
                                          <span style={{display:"flex", alignItems:"center", gap:"0.25rem", marginLeft:"0.25rem"}}>
                                            <span style={{fontSize:"0.6rem", color:text3}}>rows</span>
                                            <input type="number" min={2} max={20} value={cfg[d].tableRows||4}
                                              onChange={e => setSectionDiff(sec, d, "tableRows", Math.max(2, Math.min(20, Number(e.target.value)||4)))}
                                              style={{width:"34px", ...S.input, padding:"0.1rem 0.25rem", fontSize:"0.68rem", textAlign:"center"}} />
                                            <span style={{fontSize:"0.6rem", color:text3}}>cols</span>
                                            <input type="number" min={2} max={8} value={cfg[d].tableCols||2}
                                              onChange={e => setSectionDiff(sec, d, "tableCols", Math.max(2, Math.min(8, Number(e.target.value)||2)))}
                                              style={{width:"34px", ...S.input, padding:"0.1rem 0.25rem", fontSize:"0.68rem", textAlign:"center"}} />
                                          </span>
                                        )}
                                      </div>
                                    ))}
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
                <div style={{display:"flex", alignItems:"center", gap:"0.75rem", background:"#0a1628",
                  border:"1px solid #1e3a5f", borderRadius:"8px", padding:"0.6rem 1rem"}}>
                  <span style={{fontSize:"0.85rem", color:"#e8e8e0"}}>
                    Generate {selectedSections.reduce((a,s) => a+(sectionCounts[s]||3), 0)} questions?
                  </span>
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
                      background:"#7c2d12", color:"#fca5a5", fontSize:"0.68rem", fontWeight:"600",
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
              {bankSelectMode && bankSelected.size > 0 && (
                <>
                  <button style={S.ghostBtn("#f87171")} onClick={async () => {
                    if (!window.confirm(`Delete ${bankSelected.size} questions? This cannot be undone.`)) return;
                    for (const id of bankSelected) await deleteQuestion(id);
                    setBank(prev => prev.filter(q => !bankSelected.has(q.id)));
                    setBankSelected(new Set()); setBankSelectMode(false);
                  }}>🗑 Delete {bankSelected.size} questions</button>
                  <button style={S.ghostBtn(text2)} onClick={() => {
                    const ids = new Set(filteredBank.map(q => q.id));
                    setBankSelected(ids);
                  }}>Select all {filteredBank.length} shown</button>
                </>
              )}
            </div>
            <div style={{marginBottom:"0.75rem"}}>
              <input
                value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                placeholder="🔍  Search questions, answers, sections..."
                style={{width:"100%", padding:"0.5rem 0.75rem", background:"#0d1425",
                  border:"1px solid #1e3a5f", color:"#e8e8e0", borderRadius:"8px",
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
              {bankIssueCount > 0 && (
                <button
                  style={{...S.ghostBtn(filterIssuesOnly ? "#f87171" : text3), alignSelf:"center", border: filterIssuesOnly ? "1px solid #f8717144" : "1px solid "+border}}
                  onClick={() => setFilterIssuesOnly(p => !p)}>
                  {filterIssuesOnly ? "⚠ Issues only ✕" : `⚠ Show ${bankIssueCount} with issues`}
                </button>
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
                      background: inExam ? accent+"08" : qi%2===0 ? "transparent" : "#ffffff04",
                    }}>
                      <span style={{...S.diffTag(q.difficulty||""), flexShrink:0, fontSize:"0.58rem", padding:"0.05rem 0.3rem"}}>{(q.difficulty||"?")[0]}</span>
                      <span style={{fontSize:"0.68rem", color:text3, flexShrink:0, minWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{(q.section||"").split(" ").slice(0,3).join(" ")}</span>
                      <span style={{flex:1, fontSize:"0.8rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {q.type==="Branched" ? q.stem : q.question}
                      </span>
                      {used > 0 && <span style={{fontSize:"0.62rem", color:"#06b6d4", flexShrink:0}}>📋×{used}</span>}
                      {issues.length > 0 && <span style={{fontSize:"0.62rem", color:"#f87171", flexShrink:0}}>⚠</span>}
                      <button style={{...S.smBtn, flexShrink:0, color:inExam?accent:text3, border:"1px solid "+(inExam?accent+"44":border)}}
                        onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id=>id!==q.id) : [...p,q.id])}>
                        {inExam?"✓":"+"}</button>
                      <button style={{...S.smBtn, flexShrink:0, color:"#a78bfa", border:"1px solid #a78bfa33"}}
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
              <div key={q.id} style={{...S.qCard, borderColor: inExam ? accent+"66" : undefined}}>
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
                  <button style={{...S.smBtn, color:"#60a5fa", border:"1px solid #60a5fa44"}}
                    onClick={() => { setGraphEditorQId(graphEditorQId === q.id ? null : q.id); setInlineEditQId(null); }}>
                    📈{q.hasGraph ? " Edit" : " Graph"}
                  </button>
                  <button style={{...S.smBtn, color: inlineEditQId===q.id ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                    onClick={() => { setInlineEditQId(inlineEditQId===q.id ? null : q.id); setGraphEditorQId(null); }}>
                    ✏️ Edit
                  </button>
                  <button style={{...S.smBtn, color:inExam?accent:text2, border:"1px solid "+(inExam?accent+"44":border)}}
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
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap", paddingTop:"0.35rem", borderTop:"1px solid #334155"}}>
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
                    {isAdmin && <button style={{...S.oBtn("#f59e0b"), fontSize:"0.72rem", padding:"0.3rem 0.7rem", marginBottom:"0.5rem"}}
                      onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
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
                          const result = await saveExam(saveExamName.trim(), versions);
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
                            padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.75rem", color:"#fca5a5"}}>
                            <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>⚠️ {allIssues.length} issue{allIssues.length>1?"s":""} found in this version</div>
                            {allIssues.map((issue,i) => <div key={i} style={{opacity:0.85}}>• {issue}</div>)}
                          </div>
                        ) : null;
                      })()}
                      <div id="export-panel" ref={el => { if (el && exportHighlight) el.scrollIntoView({behavior:"smooth", block:"start"}); }}
                        style={{transition:"outline 0.3s", outline: exportHighlight ? "2px solid #185FA555" : "none", borderRadius:"8px", padding: exportHighlight ? "0.5rem" : "0"}}>
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        <button style={S.btn("#10b981",false)} onClick={async () => {
                          const cs = v.questions[0]?.classSection || null;
                          const blob = await buildDocx(v.questions,v.questions[0]?.course||"Calculus",v.label,cs);
                          const secStr = cs ? `_S${cs}` : "";
                          dlBlob(blob,`Version_${v.label}${secStr}_Exam.docx`);
                          if (examSaved && saveExamName) await logExport(saveExamName, "Word", v.label);
                        }}>⬇ Word (.docx)</button>
                        <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
                          👁 Print Preview
                        </button>
                        {Object.keys(classSectionVersions).length > 1 && (
                          <button style={S.oBtn("#8b5cf6")} onClick={async () => {
                            for(const [sec, secVers] of Object.entries(classSectionVersions)){
                              for(const ver of secVers){
                                const blob=await buildDocx(ver.questions,ver.questions[0]?.course||"Calculus",ver.label,Number(sec));
                                dlBlob(blob,`S${sec}_Version_${ver.label}_Exam.docx`);
                              }
                            }
                          }}>⬇ All Sections Word</button>
                        )}
                        <button style={S.oBtn("#f43f5e")} onClick={async () => {
                          const allVers = Object.keys(classSectionVersions).length > 1
                            ? Object.values(classSectionVersions).flat()
                            : versions;
                          const course = allVers[0]?.questions[0]?.course || "Exam";
                          const blob = await buildAnswerKey(allVers, course);
                          if (blob) dlBlob(blob, `${course.replace(/\s+/g,"_")}_Answer_Key.docx`);
                        }}>🔑 Answer Key (.docx)</button>
                      </div>

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
                                background:"#7c2d12", color:"#fca5a5", fontSize:"0.68rem", fontWeight:"600",
                                padding:"0.1rem 0.4rem", borderRadius:"4px", whiteSpace:"nowrap"}}>
                                ⚠️ {issues.length}
                              </span>
                            )}
                            <div style={{marginLeft:"auto", display:"flex", gap:"0.3rem"}}>
                              <button style={{...S.smBtn, color:"#f59e0b", border:"1px solid #f59e0b44"}}
                                onClick={() => triggerReplace(activeVersion,qi,"numbers")}>↻ Replace</button>
                              <button style={{...S.smBtn, color:"#e879f9", border:"1px solid #e879f944"}}
                                onClick={() => triggerReplace(activeVersion,qi,"function")}>↻ Diff.</button>
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
                          {pendingType === "replace" && pendingMeta?.vIdx === activeVersion && pendingMeta?.qIdx === qi && generatedPrompt && (
                            <>
                              <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"bold", margin:"0.75rem 0 0.4rem"}}>📋 Copy this replacement prompt:</div>
                              <div style={S.promptBox}>{generatedPrompt}</div>
                              {isAdmin && <button style={S.oBtn("#f59e0b")} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
                              <PastePanel
                                label="Paste the replacement question JSON here."
                                S={S} text2={text2}
                                pasteInput={pasteInput} setPasteInput={setPasteInput}
                                pasteError={pasteError} handlePaste={handlePaste}
                                onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                              />
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
          <SavedExamsScreen S={S} text2={text2} text3={text3} border={border}
            onLoad={(exam) => {
              // Restore exam into Versions tab
              const vers = exam.versions || [];
              // detect sections
              const sectionNums = [...new Set(vers.map(v => v.questions?.[0]?.classSection).filter(Boolean))].sort((a,b)=>a-b);
              if (sectionNums.length > 1) {
                // multi-section
                const secVersions = {};
                sectionNums.forEach(sec => {
                  secVersions[sec] = vers.filter(v => v.questions?.[0]?.classSection === sec);
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
            <div style={{background:"#111827", borderBottom:"1px solid #1e2d45", padding:"0.65rem 1.5rem", display:"flex", alignItems:"center", gap:"1rem", flexShrink:0}}>
              <span style={{fontSize:"0.85rem", fontWeight:"600", color:"#f0f4ff", flex:1}}>
                👁 Print Preview — {courseName} {titleLabel}
              </span>
              <button style={{background:"#10b981", color:"#000", border:"none", borderRadius:"6px", padding:"0.4rem 1.1rem", fontSize:"0.82rem", fontWeight:"600", cursor:"pointer"}}
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
              <button style={{background:"transparent", color:"#7a92b8", border:"1px solid #1e2d45", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.82rem", cursor:"pointer"}}
                onClick={() => setShowPrintPreview(false)}>✕ Close</button>
            </div>

            {/* Preview content */}
            <div style={{flex:1, overflowY:"auto", display:"flex", justifyContent:"center", padding:"2rem 1rem", flexDirection:"column", alignItems:"center"}}>
              {graphsLoading && (
                <div style={{color:"#60a5fa", fontSize:"0.85rem", marginBottom:"1rem", padding:"0.5rem 1rem", background:"#1e3a5f", borderRadius:"6px"}}>
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
