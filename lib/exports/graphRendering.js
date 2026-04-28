// ─── Graph Engine ─────────────────────────────────────────────────────────────
// Requires D3 loaded as window.d3 (CDN)

export function evalFn(exprRaw, xVal) {
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

export function renderGraphToSVG(graphConfig, width = 480, height = 300) {
  if (typeof window === "undefined" || !window.d3) return null;
  const d3  = window.d3;
  const cfg = graphConfig || {};

  // ── mapping diagram (Discrete Math Ch.7) ─────────────────────────────────
  if (cfg.type === "mapping") {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.background = "#fff";

    const domain   = cfg.domain   || [];
    const codomain = cfg.codomain || [];
    const arrows   = cfg.arrows   || [];
    const title    = cfg.title    || "";

    const colLeft  = width * 0.28;
    const colRight = width * 0.72;
    const topY     = 48;
    const botY     = height - 32;
    const usable   = botY - topY;

    const domY   = n => topY + (n + 0.5) * usable / Math.max(domain.length,   1);
    const codY   = n => topY + (n + 0.5) * usable / Math.max(codomain.length, 1);

    const mk = (tag, attrs) => {
      const el = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    // defs — one arrowhead marker per palette color
    const palette = ["#3b82f6","#ef4444","#8b5cf6","#f59e0b","#10b981","#ec4899"];
    const defs = mk("defs", {});
    palette.forEach((color, i) => {
      const marker = mk("marker", { id:`arrowhead-${i}`, markerWidth:"8", markerHeight:"6",
        refX:"8", refY:"3", orient:"auto" });
      marker.appendChild(mk("polygon", { points:"0 0, 8 3, 0 6", fill: color }));
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    // oval backgrounds
    const ovalH = usable + 24;
    const ovalW = 56;
    [colLeft, colRight].forEach(cx => {
      const el = mk("ellipse", { cx: String(cx), cy: String(height/2),
        rx: String(ovalW/2), ry: String(ovalH/2),
        fill:"#f1f5f9", stroke:"#94a3b8", "stroke-width":"1.5" });
      svg.appendChild(el);
    });

    // set labels
    if (cfg.domainLabel || cfg.codomainLabel) {
      const dl = mk("text", { x: String(colLeft), y: String(topY - 20),
        "text-anchor":"middle", "font-size":"12", "font-family":"sans-serif",
        fill:"#475569", "font-style":"italic" });
      dl.textContent = cfg.domainLabel || "A";
      svg.appendChild(dl);

      const cl = mk("text", { x: String(colRight), y: String(topY - 20),
        "text-anchor":"middle", "font-size":"12", "font-family":"sans-serif",
        fill:"#475569", "font-style":"italic" });
      cl.textContent = cfg.codomainLabel || "B";
      svg.appendChild(cl);
    }

    // domain nodes
    domain.forEach((label, i) => {
      const cy = domY(i);
      svg.appendChild(mk("circle", { cx: String(colLeft), cy: String(cy),
        r:"14", fill:"#fff", stroke:"#64748b", "stroke-width":"1.5" }));
      const t = mk("text", { x: String(colLeft), y: String(cy + 4),
        "text-anchor":"middle", "font-size":"12", "font-family":"sans-serif", fill:"#1e293b" });
      t.textContent = label;
      svg.appendChild(t);
    });

    // codomain nodes
    codomain.forEach((label, i) => {
      const cy = codY(i);
      svg.appendChild(mk("circle", { cx: String(colRight), cy: String(cy),
        r:"14", fill:"#fff", stroke:"#64748b", "stroke-width":"1.5" }));
      const t = mk("text", { x: String(colRight), y: String(cy + 4),
        "text-anchor":"middle", "font-size":"12", "font-family":"sans-serif", fill:"#1e293b" });
      t.textContent = label;
      svg.appendChild(t);
    });

    // arrows — color per domain index
    arrows.forEach(([from, to]) => {
      const x1 = colLeft  + 15;
      const y1 = domY(from);
      const x2 = colRight - 15;
      const y2 = codY(to);
      const colorIdx = from % palette.length;
      svg.appendChild(mk("line", { x1:String(x1), y1:String(y1), x2:String(x2), y2:String(y2),
        stroke: palette[colorIdx], "stroke-width":"1.5",
        "marker-end":`url(#arrowhead-${colorIdx})` }));
    });

    // title
    if (title) {
      const t = mk("text", { x: String(width/2), y:"18",
        "text-anchor":"middle", "font-size":"13", "font-family":"sans-serif",
        fill:"#1e293b", "font-weight":"600" });
      t.textContent = title;
      svg.appendChild(t);
    }

    return svg;
  }

  // ── relation digraph (Discrete Math Ch.8) ────────────────────────────────
  if (cfg.type === "relation_digraph") {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.background = "#fff";

    const nodes = cfg.nodes || [];
    const edges = cfg.edges || [];
    const title = cfg.title || "";
    const n     = nodes.length;

    const mk = (tag, attrs) => {
      const el = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    // defs
    const defs = mk("defs", {});
    const marker = mk("marker", { id:"dgarrow", markerWidth:"8", markerHeight:"6",
      refX:"8", refY:"3", orient:"auto" });
    const mpoly = mk("polygon", { points:"0 0, 8 3, 0 6", fill:"#334155" });
    marker.appendChild(mpoly);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // place nodes in a circle
    const cx = width  / 2;
    const cy = height / 2;
    const r  = Math.min(width, height) * 0.33;
    const nodeR = 18;

    const pos = nodes.map((_, i) => ({
      x: cx + r * Math.cos((2 * Math.PI * i / n) - Math.PI / 2),
      y: cy + r * Math.sin((2 * Math.PI * i / n) - Math.PI / 2),
    }));

    // draw edges
    edges.forEach(([from, to]) => {
      const p1 = pos[from];
      const p2 = pos[to];
      if (from === to) {
        // self-loop
        const lx = p1.x + nodeR * 1.2;
        const ly = p1.y - nodeR * 1.2;
        const path = mk("path", {
          d: `M ${p1.x} ${p1.y - nodeR} C ${lx} ${ly - 28}, ${lx + 28} ${ly}, ${p1.x + nodeR} ${p1.y}`,
          fill:"none", stroke:"#334155", "stroke-width":"1.5", "marker-end":"url(#dgarrow)"
        });
        svg.appendChild(path);
      } else {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const ux = dx/dist; const uy = dy/dist;
        const x1 = p1.x + ux * nodeR;
        const y1 = p1.y + uy * nodeR;
        const x2 = p2.x - ux * (nodeR + 6);
        const y2 = p2.y - uy * (nodeR + 6);
        svg.appendChild(mk("line", { x1:String(x1), y1:String(y1), x2:String(x2), y2:String(y2),
          stroke:"#334155", "stroke-width":"1.5", "marker-end":"url(#dgarrow)" }));
      }
    });

    // draw nodes
    nodes.forEach((label, i) => {
      const { x, y } = pos[i];
      svg.appendChild(mk("circle", { cx:String(x), cy:String(y), r:String(nodeR),
        fill:"#fff", stroke:"#64748b", "stroke-width":"1.5" }));
      const t = mk("text", { x:String(x), y:String(y+4),
        "text-anchor":"middle", "font-size":"13", "font-family":"sans-serif", fill:"#1e293b" });
      t.textContent = label;
      svg.appendChild(t);
    });

    // title
    if (title) {
      const t = mk("text", { x:String(width/2), y:"18",
        "text-anchor":"middle", "font-size":"13", "font-family":"sans-serif",
        fill:"#1e293b", "font-weight":"600" });
      t.textContent = title;
      svg.appendChild(t);
    }

    return svg;
  }

  // ── Venn diagram (Discrete Math Ch.6, Probability) ───────────────────────
  if (cfg.type === "venn") {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.background = "#fff";

    const mk = (tag, attrs, text) => {
      const el = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      if (text !== undefined) el.textContent = text;
      return el;
    };

    const sets = cfg.sets || [];
    const shaded = cfg.shaded || [];
    const title = cfg.title || "";
    const universeLabel = cfg.universeLabel || "U";

    const cx = width / 2;
    const cy = height / 2 + 10;
    const r = Math.min(width, height) * 0.28;
    const offset = r * 0.5;

    const cA = { x: cx - offset, y: cy };
    const cB = { x: cx + offset, y: cy };

    const colorA = (sets[0]?.color) || "#3b82f6";
    const colorB = (sets[1]?.color) || "#ef4444";
    const labelA = sets[0]?.label || "A";
    const labelB = sets[1]?.label || "B";

    const defs = mk("defs", {});

    const clipA = mk("clipPath", { id: "clipA" });
    clipA.appendChild(mk("circle", { cx: String(cA.x), cy: String(cA.y), r: String(r) }));
    defs.appendChild(clipA);

    const clipB = mk("clipPath", { id: "clipB" });
    clipB.appendChild(mk("circle", { cx: String(cB.x), cy: String(cB.y), r: String(r) }));
    defs.appendChild(clipB);

    svg.appendChild(defs);

    svg.appendChild(mk("rect", {
      x: "8", y: "8", width: String(width - 16), height: String(height - 16),
      fill: "none", stroke: "#94a3b8", "stroke-width": "1.5", rx: "6"
    }));

    svg.appendChild(mk("text", {
      x: "18", y: "26", "font-size": "13", "font-family": "sans-serif",
      fill: "#64748b", "font-style": "italic"
    }, universeLabel));

    const shade = (color, clipPathId) => {
      const rect = mk("rect", {
        x: "0", y: "0", width: String(width), height: String(height),
        fill: color, "fill-opacity": "0.35",
        "clip-path": `url(#${clipPathId})`
      });
      svg.appendChild(rect);
    };

    if (shaded.includes("AorB") || shaded.includes("A") || shaded.includes("AnotB")) {
      shade(colorA, "clipA");
    }
    if (shaded.includes("AorB") || shaded.includes("B") || shaded.includes("BnotA")) {
      shade(colorB, "clipB");
    }

    if (shaded.includes("AandB")) {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("clip-path", "url(#clipB)");
      g.appendChild(mk("circle", {
        cx: String(cA.x), cy: String(cA.y), r: String(r),
        fill: "#8b5cf6", "fill-opacity": "0.45"
      }));
      svg.appendChild(g);
    }

    if (shaded.includes("AnotB")) {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("clip-path", "url(#clipB)");
      g.appendChild(mk("circle", {
        cx: String(cA.x), cy: String(cA.y), r: String(r),
        fill: "#fff", "fill-opacity": "1"
      }));
      svg.appendChild(g);
    }
    if (shaded.includes("BnotA")) {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("clip-path", "url(#clipA)");
      g.appendChild(mk("circle", {
        cx: String(cB.x), cy: String(cB.y), r: String(r),
        fill: "#fff", "fill-opacity": "1"
      }));
      svg.appendChild(g);
    }

    svg.appendChild(mk("circle", {
      cx: String(cA.x), cy: String(cA.y), r: String(r),
      fill: "none", stroke: colorA, "stroke-width": "2"
    }));
    svg.appendChild(mk("circle", {
      cx: String(cB.x), cy: String(cB.y), r: String(r),
      fill: "none", stroke: colorB, "stroke-width": "2"
    }));

    svg.appendChild(mk("text", {
      x: String(cA.x - r * 0.55), y: String(cA.y - r * 0.72),
      "text-anchor": "middle", "font-size": "14", "font-family": "sans-serif",
      fill: colorA, "font-weight": "600"
    }, labelA));
    svg.appendChild(mk("text", {
      x: String(cB.x + r * 0.55), y: String(cB.y - r * 0.72),
      "text-anchor": "middle", "font-size": "14", "font-family": "sans-serif",
      fill: colorB, "font-weight": "600"
    }, labelB));

    (cfg.elementsA || []).forEach((el, i) => {
      svg.appendChild(mk("text", {
        x: String(cA.x - r * 0.55), y: String(cy - 10 + i * 18),
        "text-anchor": "middle", "font-size": "12", "font-family": "sans-serif", fill: "#1e293b"
      }, el));
    });
    (cfg.elementsB || []).forEach((el, i) => {
      svg.appendChild(mk("text", {
        x: String(cB.x + r * 0.55), y: String(cy - 10 + i * 18),
        "text-anchor": "middle", "font-size": "12", "font-family": "sans-serif", fill: "#1e293b"
      }, el));
    });
    (cfg.elementsAB || []).forEach((el, i) => {
      svg.appendChild(mk("text", {
        x: String(cx), y: String(cy - 10 + i * 18),
        "text-anchor": "middle", "font-size": "12", "font-family": "sans-serif", fill: "#1e293b"
      }, el));
    });

    if (title) {
      svg.appendChild(mk("text", {
        x: String(width / 2), y: "20",
        "text-anchor": "middle", "font-size": "13", "font-family": "sans-serif",
        fill: "#1e293b", "font-weight": "600"
      }, title));
    }

    return svg;
  }

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

  // Safety guard: for rectangle regions (area type with constant fnTop/fnBottom),
  // ensure yDomain actually contains both bounds — expand if needed
  if (cfg.type === "area") {
    const yTopVal = evalFn(cfg.fnTop,    0);
    const yBotVal = evalFn(cfg.fnBottom, 0);
    const pad = (yDom[1] - yDom[0]) * 0.12 || 0.5;
    if (isFinite(yTopVal) && yTopVal > yDom[1] - 0.1) yDom[1] = yTopVal + pad;
    if (isFinite(yBotVal) && yBotVal < yDom[0] + 0.1) yDom[0] = yBotVal - pad;
    // Also ensure xDomain contains shadeFrom/shadeTo
    const x0 = cfg.shadeFrom ?? xDom[0];
    const x1 = cfg.shadeTo   ?? xDom[1];
    const xpad = (xDom[1] - xDom[0]) * 0.12 || 0.5;
    if (x0 < xDom[0]) xDom[0] = x0 - xpad;
    if (x1 > xDom[1]) xDom[1] = x1 + xpad;
  }

  const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgNode.setAttribute("xmlns",   "http://www.w3.org/2000/svg");
  svgNode.setAttribute("width",   String(width));
  svgNode.setAttribute("height",  String(height));
  svgNode.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const margin = { top: 22, right: 36, bottom: 34, left: 50 };
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
export async function graphToBase64PNG(graphConfig, width = 480, height = 300) {
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
export function renderStatChartToSVG(chartConfig, width=480, height=300) {
  if (typeof window === "undefined" || !window.d3) return null;
  const d3 = window.d3;
  // normalize standard_normal alias
  const rawCfg = chartConfig || {};
  const cfg = rawCfg.type === "standard_normal"
    ? { ...rawCfg, type: "continuous_dist", distType: "standard_normal", mu: 0, sigma: 1 }
    : rawCfg;
  const margin = {top:30, right:30, bottom:68, left:55};
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
    if (cfg.yLabel) g.append("text").attr("transform",`translate(-46,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel);
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
    if (cfg.yLabel) g.append("text").attr("transform",`translate(-46,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel);
    if (cfg.title)  axisLabel(cfg.title, iW/2, -12, "middle", 13);
  }

  // ── Scatter Plot ──────────────────────────────────────────────────────────
  else if (cfg.type === "scatter") {
    const points = cfg.points || []; // [{x,y}]
    const xs = points.map(p=>p.x), ys = points.map(p=>p.y);

    // Snap a tick step to {1, 2, 2.5, 5} × 10ⁿ — yields the requested set
    // {0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, ...} and keeps
    // gridlines on values students can read at a glance.
    function niceStep(range, target) {
      if (!isFinite(range) || range <= 0) return 1;
      const raw = range / target;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag; // in [1, 10)
      const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
      return mult * mag;
    }
    function niceTicks(min, max, target = 10) {
      const step = niceStep(max - min, target);
      const start = Math.floor(min / step) * step;
      const end = Math.ceil(max / step) * step;
      const ticks = [];
      // Step in integer space to dodge fp drift, then divide back out.
      const inv = 1 / step;
      const n0 = Math.round(start * inv);
      const n1 = Math.round(end * inv);
      for (let n = n0; n <= n1; n++) ticks.push(n / inv);
      return ticks;
    }
    function fmtTick(v) {
      const r = Math.round(v * 1000) / 1000;
      return Number.isInteger(r) ? String(r) : String(r);
    }

    // Regression line + the y-intercept (b₀) must be visible. Force both
    // axis ranges to include 0 and (0, intercept) so chapter 14.1 questions
    // don't crop off where the fitted line crosses the y-axis.
    const slope     = cfg.regressionLine?.slope;
    const intercept = cfg.regressionLine?.intercept;
    const hasRegression = isFinite(slope) && isFinite(intercept);

    const dataXMin = xs.length ? d3.min(xs) : 0;
    const dataXMax = xs.length ? d3.max(xs) : 10;
    const dataYMin = ys.length ? d3.min(ys) : 0;
    const dataYMax = ys.length ? d3.max(ys) : 10;

    let xLo = Math.min(0, dataXMin);
    let xHi = Math.max(0, dataXMax);
    let yLo = Math.min(0, dataYMin);
    let yHi = Math.max(0, dataYMax);
    if (hasRegression) {
      // Include intercept (line at x=0) AND the line's value at the data extremes
      yLo = Math.min(yLo, intercept, slope * xLo + intercept, slope * xHi + intercept);
      yHi = Math.max(yHi, intercept, slope * xLo + intercept, slope * xHi + intercept);
    }

    // Round to a clean tick step BEFORE building the scale so the axis ends on
    // a labeled gridline and gives breathing room above/right of the data.
    const xTicks = niceTicks(xLo, xHi + (xHi - xLo) * 0.05, 10);
    const yTicks = niceTicks(yLo, yHi + (yHi - yLo) * 0.08, 10);
    const xDomain = [xTicks[0], xTicks[xTicks.length - 1]];
    const yDomain = [yTicks[0], yTicks[yTicks.length - 1]];
    const xScale = d3.scaleLinear().domain(xDomain).range([0, iW]);
    const yScale = d3.scaleLinear().domain(yDomain).range([iH, 0]);

    // Gridlines on the snapped ticks
    xTicks.forEach(t => gridLine(xScale(t), 0, xScale(t), iH));
    yTicks.forEach(t => gridLine(0, yScale(t), iW, yScale(t)));

    // Regression line drawn across the full visible domain
    if (hasRegression) {
      const rx1 = xDomain[0], rx2 = xDomain[1];
      g.append("line")
        .attr("x1", xScale(rx1)).attr("y1", yScale(slope * rx1 + intercept))
        .attr("x2", xScale(rx2)).attr("y2", yScale(slope * rx2 + intercept))
        .attr("stroke", "#ef4444").attr("stroke-width", 2);
    }

    points.forEach(p => {
      g.append("circle").attr("cx", xScale(p.x)).attr("cy", yScale(p.y)).attr("r", 5)
        .attr("fill", COL.blue).attr("fill-opacity", 0.75)
        .attr("stroke", "#fff").attr("stroke-width", 1);
    });

    // Axis lines
    g.append("line").attr("x1", 0).attr("y1", iH).attr("x2", iW).attr("y2", iH)
      .attr("stroke", COL.text).attr("stroke-width", 1.5);
    g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", iH)
      .attr("stroke", COL.text).attr("stroke-width", 1.5);

    if (showNumbers) {
      xTicks.forEach(t => axisLabel(fmtTick(t), xScale(t), iH + 18, "middle", 10));
      yTicks.forEach(t => axisLabel(fmtTick(t), -8, yScale(t) + 4, "end", 10));
    }

    if (cfg.xLabel) axisLabel(cfg.xLabel, iW / 2, iH + 42);
    if (cfg.yLabel) g.append("text").attr("transform", `translate(-46,${iH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", COL.text).text(cfg.yLabel);
    if (cfg.title) axisLabel(cfg.title, iW / 2, -12, "middle", 13);
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
    g.append("text").attr("transform",`translate(-46,${iH/2}) rotate(-90)`).attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text).text(cfg.yLabel||"P(X = x)");
    if (cfg.title) axisLabel(cfg.title, iW/2, -12, "middle", 13);
  }

  // ── Continuous Probability Distribution (Normal / Uniform / Exponential) ──
  else if (cfg.type === "continuous_dist") {
    const distType  = cfg.distType || "normal";
    const isStdNorm = distType === "standard_normal" || (distType === "normal" && cfg.mu === 0 && cfg.sigma === 1);
    const mu     = cfg.mu     ?? 0;
    const sigma  = cfg.sigma  ?? 1;
    // Exponential: accept mu (mean) or lambda (rate); internally use lambda=1/mu
    const expMu     = cfg.mu !== undefined && distType === "exponential" ? cfg.mu : (cfg.lambda ? 1/cfg.lambda : 1);
    const lambda = distType === "exponential" ? 1/expMu : (cfg.lambda ?? 1);
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
    g.append("text").attr("transform",`translate(-46,${iH/2}) rotate(-90)`)
      .attr("text-anchor","middle").attr("font-size",11).attr("fill",COL.text)
      .text(cfg.yLabel || "f(x)");

    // title
    if (cfg.title) axisLabel(cfg.title, iW/2, -12, "middle", 13);

    // μ marker for normal distributions only
    if ((distType === "normal" || distType === "standard_normal") && xScale(mu) >= 0 && xScale(mu) <= iW) {
      g.append("line").attr("x1",xScale(mu)).attr("y1",yScale(0))
        .attr("x2",xScale(mu)).attr("y2",yScale(pdf(mu))*0.15)
        .attr("stroke",COL.muted).attr("stroke-width",1).attr("stroke-dasharray","3,3");
      const muLabel = isStdNorm ? "\u03bc=0" : ("\u03bc=" + mu);
      if (sFrom !== mu && sTo !== mu)
        axisLabel(muLabel, xScale(mu), iH+58, "middle", 9);
    }
    // y-intercept annotation for exponential: dot at (0, lambda) with label
    if (distType === "exponential") {
      const yInt = lambda; // pdf(0) = lambda = 1/mu
      const dotX = xScale(0);
      const dotY = yScale(yInt);
      // short horizontal dashed line from y-axis to dot
      g.append("line")
        .attr("x1", 0).attr("y1", dotY)
        .attr("x2", dotX + 12).attr("y2", dotY)
        .attr("stroke", COL.muted).attr("stroke-width", 1.2).attr("stroke-dasharray", "4,3");
      // dot on curve at y-intercept
      g.append("circle")
        .attr("cx", dotX).attr("cy", dotY).attr("r", 3.5)
        .attr("fill", COL.blue).attr("stroke", "#fff").attr("stroke-width", 1);
      // label: "0.167 = 1/μ"
      const yIntRounded = Math.round(yInt * 1000) / 1000;
      g.append("text")
        .attr("x", dotX + 8).attr("y", dotY - 5)
        .attr("font-size", 10).attr("fill", COL.text)
        .text(`${yIntRounded} = 1/\u03bc`);
    }
  }

  return svgNode;
}

export async function statChartToBase64PNG(chartConfig, w=480, h=300) {
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

// Expose render functions on window so GraphDisplay / GraphEditor can call them
// without importing this module directly (they use window.* to avoid circular deps).
if (typeof window !== "undefined") {
  window.renderGraphToSVG = renderGraphToSVG;
  window.renderStatChartToSVG = renderStatChartToSVG;
}
