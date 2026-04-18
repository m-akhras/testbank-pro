"use client";
import { createContext, useContext } from "react";

// Export helpers live inside TestBankApp.js and capture its internal state (versions,
// activeVersion, print cache, etc.) via closure. Until they are extracted to pure
// functions that take state as arguments, the /app/export route can't drive them.
//
// This context exposes stub placeholders so ExportScreen can render without crashing
// on the new route. Each stub surfaces a toast-friendly error; real wiring happens
// in a later batch that extracts the builders into lib/exports/.
const STUB_MSG = "Export not wired on this route yet — use the legacy /app view for exports.";

function notReady() {
  if (typeof window !== "undefined") window.alert?.(STUB_MSG);
  throw new Error(STUB_MSG);
}

const defaultValue = {
  buildDocx:                   notReady,
  buildDocxCompare:            notReady,
  buildAnswerKey:              notReady,
  buildQTI:                    notReady,
  buildQTIZip:                 notReady,
  buildQTICompare:             notReady,
  buildClassroomSectionsQTI:   notReady,
  buildQTIAllSectionsMerged:   notReady,
  validateQTIExport:           () => ({ ok: false, warnings: [STUB_MSG] }),
  dlBlob:                      notReady,
};

export const ExportContext = createContext(defaultValue);

export function ExportProvider({ children, value = defaultValue }) {
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

export function useExportContext() {
  return useContext(ExportContext);
}
