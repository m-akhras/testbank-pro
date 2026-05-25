"use client";

// Renders a single/piecewise function graph at choice-tile size.
// Wraps lib/exports/graphRendering.js's renderGraphToSVG, which reads
// cfg.type — so this component translates the choice-side convention
// (graphType) into the renderer's legacy convention (type) before calling.
//
// Mirrors the rendering pattern in GraphDisplay.js for stem graphs,
// just smaller and with no axis-control toolbar (choices are static).

import { useRef, useEffect } from "react";

export default function SinglePiecewiseChoice({ config, width = 280, height = 200, style }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !config || typeof window === "undefined") return;
    ref.current.innerHTML = "";
    if (!window.d3 || !window.renderGraphToSVG) return;

    // Translate graphType ("single"|"piecewise") to legacy type for the renderer.
    // Everything else passes through unchanged.
    const { graphType, ...rest } = config;
    const cfg = { ...rest, type: graphType };

    const svgNode = window.renderGraphToSVG(cfg, width, height);
    if (svgNode) {
      svgNode.style.width = "100%";
      svgNode.style.height = `${height}px`;
      ref.current.appendChild(svgNode);
    }
  }, [config, width, height]);

  return (
    <div
      ref={ref}
      style={{
        width: width,
        background: "#fff",
        borderRadius: "4px",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
