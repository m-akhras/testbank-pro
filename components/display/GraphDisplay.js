"use client";
import { useRef, useState, useEffect } from "react";
import { buildVectorFieldSvg } from "./VectorFieldGraph.js";
import { buildContourSvg }     from "./ContourGraph.js";
import { buildRegionSvg }      from "./RegionGraph.js";
import { buildParametricSvg }  from "./ParametricGraph.js";
import { buildSurfaceSvg }     from "./SurfaceGraph.js";

const NEW_GRAPH_TYPES = ["vectorField", "contour", "region", "parametric", "surface"];

function _newGraphSvg(cfg, w, h) {
  switch (cfg?.graphType) {
    case "vectorField": return buildVectorFieldSvg(cfg, { width: w, height: h });
    case "contour":     return buildContourSvg    (cfg, { width: w, height: h });
    case "region":      return buildRegionSvg     (cfg, { width: w, height: h });
    case "parametric":  return buildParametricSvg (cfg, { width: w, height: h });
    case "surface":     return buildSurfaceSvg    (cfg, { width: w, height: h });
    default: return null;
  }
}

export default function GraphDisplay({ graphConfig, authorMode = false }) {
  const ref = useRef(null);
  const [showNumbers, setShowNumbers] = useState(
    graphConfig?.showAxisNumbers !== false
  );
  const [showGrid, setShowGrid] = useState(
    graphConfig?.showGrid !== false
  );

  const isNewGraph = graphConfig && NEW_GRAPH_TYPES.includes(graphConfig.graphType);

  useEffect(() => {
    if (!ref.current || !graphConfig || typeof window === "undefined") return;
    ref.current.innerHTML = "";

    if (isNewGraph) {
      const w = ref.current.offsetWidth || 480;
      const h = 260;
      const svgString = _newGraphSvg(graphConfig, w, h);
      if (svgString) {
        ref.current.innerHTML = svgString;
        const svgEl = ref.current.querySelector("svg");
        if (svgEl) {
          svgEl.style.width = "100%";
          svgEl.style.height = `${h}px`;
        }
      }
      return;
    }

    if (!window.d3) return;
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
  }, [graphConfig, showNumbers, showGrid, isNewGraph]);

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      {authorMode && !isNewGraph && (
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
