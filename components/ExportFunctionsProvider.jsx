"use client";
import { ExportFunctionsContext } from "../context/ExportFunctionsContext.js";
import {
  buildDocx,
  buildDocxCompare,
  buildQTI,
  buildQTIZip,
  buildQTICompare,
  buildClassroomSectionsQTI,
  buildQTIAllSectionsMerged,
  validateQTIExport,
  dlFile,
  dlBlob,
  isPipeTable,
  normalizePipeTable,
  splitTableBlocks,
  mathToHTML,
  mathToHTMLInline,
  mathToOmml,
  renderGraphToSVG,
  graphToBase64PNG,
  renderStatChartToSVG,
  statChartToBase64PNG,
} from "../lib/exports/index.js";

const value = {
  // Exports
  buildDocx,
  buildDocxCompare,
  buildQTI,
  buildQTIZip,
  buildQTICompare,
  buildClassroomSectionsQTI,
  buildQTIAllSectionsMerged,
  validateQTIExport,
  // Helpers
  dlFile,
  dlBlob,
  isPipeTable,
  normalizePipeTable,
  splitTableBlocks,
  mathToHTML,
  mathToHTMLInline,
  mathToOmml,
  renderGraphToSVG,
  graphToBase64PNG,
  renderStatChartToSVG,
  statChartToBase64PNG,
};

export default function ExportFunctionsProvider({ children }) {
  return <ExportFunctionsContext.Provider value={value}>{children}</ExportFunctionsContext.Provider>;
}
