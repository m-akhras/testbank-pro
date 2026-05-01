// Shared dispatcher for the "new system" SVG-based graph types
// (vectorField / contour / region / parametric / surface / path). Used by
// both lib/exports/docx.js and lib/exports/qti.js to rasterize either a
// top-level question graph or a per-choice graph to a base64 PNG.
//
// Returns null when:
//   - cfg has no graphType (fall through to old-system graphToBase64PNG)
//   - graphType is unknown (caller treats as "no graph")
//   - rasterization fails (browser may be unavailable in SSR)

import { vectorFieldToBase64PNG } from "../../components/display/VectorFieldGraph.js";
import { contourToBase64PNG }     from "../../components/display/ContourGraph.js";
import { regionToBase64PNG }      from "../../components/display/RegionGraph.js";
import { parametricToBase64PNG }  from "../../components/display/ParametricGraph.js";
import { surfaceToBase64PNG }     from "../../components/display/SurfaceGraph.js";
import { pathToBase64PNG }        from "../../components/display/PathGraph.js";

export const NEW_GRAPH_TYPES = ["vectorField", "contour", "region", "parametric", "surface", "path"];

export function isNewGraphConfig(cfg) {
  return !!(cfg && typeof cfg === "object" && NEW_GRAPH_TYPES.includes(cfg.graphType));
}

export async function newGraphConfigToPng(cfg, width = 300, height = 280) {
  if (!isNewGraphConfig(cfg)) return null;
  try {
    switch (cfg.graphType) {
      case "vectorField": return (await vectorFieldToBase64PNG(cfg, width, height)) || null;
      case "contour":     return (await contourToBase64PNG    (cfg, width, height)) || null;
      case "region":      return (await regionToBase64PNG     (cfg, width, height)) || null;
      case "parametric":  return (await parametricToBase64PNG (cfg, width, height)) || null;
      case "surface":     return (await surfaceToBase64PNG    (cfg, width, height)) || null;
      case "path":        return (await pathToBase64PNG       (cfg, width, height)) || null;
      default: return null;
    }
  } catch (_e) {
    return null;
  }
}
