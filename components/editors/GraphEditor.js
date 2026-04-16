"use client";
import { useState, useEffect, useRef } from "react";
import { evalFn } from "../../lib/exports/graphRendering.js";

const bg1    = "#FDFAF5";
const bg2    = "#F7F2E9";
const border = "#D9D0C0";
const text1  = "#1C1A16";
const text2  = "#6B6355";

// ── Helpers (module-private) ────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

export default function GraphEditor({ initialConfig, onSave, onRemove, onClose }) {
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
  const [yMinState,   setYMinState]   = useState(null);
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
