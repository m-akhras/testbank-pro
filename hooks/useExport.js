"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { graphToBase64PNG, statChartToBase64PNG } from "../lib/exports/graphRendering.js";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const STAT_CHART_TYPES = ["bar", "histogram", "scatter", "discrete_dist", "continuous_dist", "standard_normal"];

/**
 * Cross-hook dependencies accepted as parameters:
 *   versions      — from useExamBuilder
 *   activeVersion — from useExamBuilder
 */
export function useExport({
  versions = [],
  activeVersion = 0,
} = {}) {
  const [exportLoading, setExportLoading] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printGraphCache, setPrintGraphCache] = useState({});

  useEffect(() => {
    if (!showPrintPreview) { setPrintGraphCache({}); return; }
    const v = versions[activeVersion];
    if (!v) return;
    const graphQs = v.questions.filter(q => q.hasGraph && q.graphConfig);
    if (!graphQs.length) return;
    (async () => {
      const cache = {};
      for (const q of graphQs) {
        try {
          const isStatChart = q.graphConfig?.type && STAT_CHART_TYPES.includes(q.graphConfig.type);
          const b64 = isStatChart
            ? await statChartToBase64PNG(q.graphConfig, 480, 280)
            : await graphToBase64PNG(q.graphConfig, 480, 280);
          if (b64) cache[q.id || q.question] = b64;
        } catch (e) { console.warn("print graph failed", e); }
      }
      setPrintGraphCache(cache);
    })();
  }, [showPrintPreview, activeVersion]);

  async function logExport(examName, format, versionLabel) {
    try {
      const supabase = getSupabase();
      await supabase.from("export_history").insert({
        exam_name: examName,
        format,
        version_label: versionLabel,
        exported_at: new Date().toISOString(),
      });
    } catch (e) { console.error("logExport error:", e); }
  }

  return {
    exportLoading, setExportLoading,
    showPrintPreview, setShowPrintPreview,
    printGraphCache, setPrintGraphCache,
    logExport,
  };
}
