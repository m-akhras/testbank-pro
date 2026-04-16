"use client";
import { useRef, useState, useEffect } from "react";

export default function GraphDisplay({ graphConfig, authorMode = false }) {
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
