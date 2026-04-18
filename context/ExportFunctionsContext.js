"use client";
import { createContext, useContext } from "react";
export const ExportFunctionsContext = createContext(null);
export function useExportFunctions() { return useContext(ExportFunctionsContext); }
