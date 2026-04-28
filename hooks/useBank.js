"use client";
import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { validateQuestion, questionSimilarity, sectionSortKey } from "../lib/utils/questions.js";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function useBank() {
  const [bank, setBank] = useState([]);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankCompact, setBankCompact] = useState(false);
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterDiff, setFilterDiff] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false);
  const [filterValidation, setFilterValidation] = useState("All"); // All | ok | warning | error | none
  const [filterDate, setFilterDate] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterDay, setFilterDay] = useState("All");
  const [filterTime, setFilterTime] = useState("All");
  const [filterUsedInExams, setFilterUsedInExams] = useState(false);
  const [bankSelectMode, setBankSelectMode] = useState(false);
  const [bankSelected, setBankSelected] = useState(new Set());
  const [bankTabState, setBankTabState] = useState("browse");
  const [expandedBatches, setExpandedBatches] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null); // {id, label}

  useEffect(() => {
    _loadBank().then(q => { setBank(q); setBankLoaded(true); });
  }, []);

  async function _loadBank() {
    try {
      const supabase = getSupabase();
      // PostgREST caps a single response at 1000 rows by default. We have
      // users with >1000 questions in the bank, so without pagination the
      // older rows (including older validated ones) silently get dropped —
      // which made the validation filter show "0 validated / 1000 not
      // validated" even though Supabase had populated rows.
      const PAGE = 1000;
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      return rows.map(r => ({
        ...r.data,
        id: r.id,
        createdAt: new Date(r.created_at).getTime(),
        // Persisted AI-validation snapshot (nullable when never validated).
        // r.data may carry a stale validationStatus from save time, but the
        // explicit assignment AFTER the spread ensures the dedicated column
        // is the source of truth.
        validationStatus: r.validation_status || null,
        validationIssues: Array.isArray(r.validation_issues) ? r.validation_issues : [],
        validatedAt: r.validated_at ? new Date(r.validated_at).getTime() : null,
      }));
    } catch (e) { console.error("loadBank error:", e); return []; }
  }

  async function loadBank() {
    const q = await _loadBank();
    setBank(q);
    setBankLoaded(true);
    return q;
  }

  async function saveQuestion(q) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("questions").upsert({
        id: q.id,
        course: q.course,
        section: q.section,
        type: q.type,
        difficulty: q.difficulty,
        data: q,
      });
      if (error) throw error;
      setBank(prev => prev.map(bq => bq.id === q.id ? q : bq));
    } catch (e) { console.error("saveQuestion error:", e); }
  }

  async function deleteQuestion(id) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;
      setBank(prev => prev.filter(q => q.id !== id));
    } catch (e) { console.error("deleteQuestion error:", e); }
  }

  // Persist a single AI-validation result. Called by useValidation as each
  // question's check completes. Status is 'ok' | 'warning' | 'error'.
  //
  // We use .select() so Supabase actually returns the affected rows — without
  // it, the previous version silently no-op'd whenever the id didn't match
  // (deleted row, stale variant, missing migration), and the caller couldn't
  // tell a successful write from a 0-row update. Now: errors and empty
  // updates throw, so useValidation can mark the question as errored instead
  // of falsely flashing a badge that won't survive a reload.
  async function saveValidationResult(id, status, issues = []) {
    if (!id) throw new Error("saveValidationResult: missing id");
    const supabase = getSupabase();
    const validatedAtIso = new Date().toISOString();
    const safeIssues = Array.isArray(issues) ? issues.filter(Boolean) : [];
    const { data, error } = await supabase.from("questions")
      .update({
        validation_status: status || null,
        validation_issues: safeIssues,
        validated_at: validatedAtIso,
      })
      .eq("id", id)
      .select("id");
    if (error) {
      console.error("[saveValidationResult] supabase error for id", id, ":", error);
      throw new Error(`Supabase update failed for ${id}: ${error.message || error}`);
    }
    if (!data || data.length === 0) {
      const msg = `No question row matched id "${id}" — validation result not persisted. ` +
        `Likely causes: row was deleted, the id is a fresh variant uid() that isn't in the bank, ` +
        `or the validation columns migration (supabase-validation-fields-migration.sql) hasn't been applied.`;
      console.warn("[saveValidationResult]", msg);
      throw new Error(msg);
    }
    setBank(prev => prev.map(bq => bq.id === id ? {
      ...bq,
      validationStatus: status || null,
      validationIssues: safeIssues,
      validatedAt: new Date(validatedAtIso).getTime(),
    } : bq));
    return data[0];
  }

  // Computed: filtered + sorted view of the bank
  const filteredBank = useMemo(() => bank.filter(q => {
    const searchLower = bankSearch.toLowerCase().trim();
    const matchesSearch = !searchLower || (
      (q.question || "").toLowerCase().includes(searchLower) ||
      (q.stem || "").toLowerCase().includes(searchLower) ||
      (q.answer || "").toLowerCase().includes(searchLower) ||
      (q.section || "").toLowerCase().includes(searchLower) ||
      (q.choices || []).some(c => c != null && String(c).toLowerCase().includes(searchLower))
    );
    const matchesValidation =
      filterValidation === "All" ? true :
      filterValidation === "none" ? !q.validationStatus :
      q.validationStatus === filterValidation;
    return matchesSearch &&
      (filterCourse === "All" || q.course === filterCourse) &&
      (filterType === "All" || q.type === filterType) &&
      (filterDiff === "All" || q.difficulty === filterDiff) &&
      (filterSection === "All" || q.section === filterSection) &&
      (!filterIssuesOnly || validateQuestion(q).length > 0) &&
      matchesValidation &&
      (() => {
        if (filterYear === "All") return true;
        const d = new Date(q.createdAt);
        if (String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "All" && String(d.getMonth()) !== filterMonth) return false;
        if (filterDay !== "All" && String(d.getDate()) !== filterDay) return false;
        if (filterTime !== "All" && d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) !== filterTime) return false;
        return true;
      })();
  }).sort((a, b) => {
    const [aMaj, aMin] = sectionSortKey(a.section);
    const [bMaj, bMin] = sectionSortKey(b.section);
    if (aMaj !== bMaj) return aMaj - bMaj;
    if (aMin !== bMin) return aMin - bMin;
    return (a.createdAt || 0) - (b.createdAt || 0);
  }), [bank, bankSearch, filterCourse, filterType, filterDiff, filterSection, filterIssuesOnly, filterValidation, filterYear, filterMonth, filterDay, filterTime]);

  // Per-status counts for the validation filter dropdown
  const validationCounts = useMemo(() => {
    const counts = { ok: 0, warning: 0, error: 0, none: 0 };
    for (const q of bank) {
      const s = q.validationStatus || "none";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [bank]);

  // Duplicate detection
  const duplicateIds = useMemo(() => {
    const ids = new Set();
    for (let i = 0; i < bank.length; i++) {
      for (let j = i + 1; j < bank.length; j++) {
        const a = bank[i]; const b = bank[j];
        if (a.section !== b.section) continue;
        if (questionSimilarity(a, b) > 0.75) { ids.add(a.id); ids.add(b.id); }
      }
    }
    return ids;
  }, [bank]);

  return {
    bank, setBank,
    bankLoaded, setBankLoaded,
    bankSearch, setBankSearch,
    bankCompact, setBankCompact,
    filterCourse, setFilterCourse,
    filterType, setFilterType,
    filterDiff, setFilterDiff,
    filterSection, setFilterSection,
    filterIssuesOnly, setFilterIssuesOnly,
    filterValidation, setFilterValidation,
    filterDate, setFilterDate,
    filterYear, setFilterYear,
    filterMonth, setFilterMonth,
    filterDay, setFilterDay,
    filterTime, setFilterTime,
    filterUsedInExams, setFilterUsedInExams,
    bankSelectMode, setBankSelectMode,
    bankSelected, setBankSelected,
    bankTabState, setBankTabState,
    expandedBatches, setExpandedBatches,
    confirmDelete, setConfirmDelete,
    filteredBank,
    duplicateIds,
    validationCounts,
    loadBank,
    saveQuestion,
    deleteQuestion,
    saveValidationResult,
  };
}
