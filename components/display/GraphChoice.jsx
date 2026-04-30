"use client";

// Single dispatcher used by every choice render site. Routes by
// config.graphType to the matching renderer. Render sites import this
// component instead of the per-type renderers, so adding a new graph type
// only touches the switch below — render sites stay untouched.

import VectorFieldGraph from "./VectorFieldGraph.js";
import ContourGraph     from "./ContourGraph.js";
import RegionGraph      from "./RegionGraph.js";
import ParametricGraph  from "./ParametricGraph.js";
import SurfaceGraph     from "./SurfaceGraph.js";

const _FALLBACK_STYLE = {
  border: "1px solid #d9d0c0",
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.4rem 0.6rem",
  fontSize: "0.7rem",
  color: "#900",
  textAlign: "center",
};

export default function GraphChoice({ config, width, height, style }) {
  const t = config?.graphType;
  switch (t) {
    case "vectorField": return <VectorFieldGraph config={config} width={width} height={height} style={style} />;
    case "contour":     return <ContourGraph     config={config} width={width} height={height} style={style} />;
    case "region":      return <RegionGraph      config={config} width={width} height={height} style={style} />;
    case "parametric":  return <ParametricGraph  config={config} width={width} height={height} style={style} />;
    case "surface":     return <SurfaceGraph     config={config} width={width} height={height} style={style} />;
    default:
      return (
        <div style={{ width: width || 300, height: height || 280, ..._FALLBACK_STYLE, ...(style || {}) }}>
          unsupported graphType: {String(t ?? "?")}
        </div>
      );
  }
}
