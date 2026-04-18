"use client";
import { createContext, useContext } from "react";
import {
  buildDocx,
  buildDocxCompare,
  buildAnswerKey,
  buildQTI,
  buildQTIZip,
  buildQTICompare,
  buildClassroomSectionsQTI,
  buildQTIAllSectionsMerged,
  validateQTIExport,
  dlBlob,
} from "../lib/exports/index.js";

const defaultValue = {
  buildDocx,
  buildDocxCompare,
  buildAnswerKey,
  buildQTI,
  buildQTIZip,
  buildQTICompare,
  buildClassroomSectionsQTI,
  buildQTIAllSectionsMerged,
  validateQTIExport,
  dlBlob,
};

export const ExportContext = createContext(defaultValue);

export function ExportProvider({ children, value = defaultValue }) {
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

export function useExportContext() {
  return useContext(ExportContext);
}
