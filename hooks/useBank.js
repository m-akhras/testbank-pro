"use client";
import { useState, useEffect } from "react";
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
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(r => ({ ...r.data, id: r.id, createdAt: new Date(r.created_at).getTime() }));
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
    } catch (e) { console.error("deleteQuestion error:", e); }
  }

  // Computed: filtered + sorted view of the bank
  const filteredBank = bank.filter(q => {
    const searchLower = bankSearch.toLowerCase().trim();
    const matchesSearch = !searchLower || (
      (q.question || "").toLowerCase().includes(searchLower) ||
      (q.stem || "").toLowerCase().includes(searchLower) ||
      (q.answer || "").toLowerCase().includes(searchLower) ||
      (q.section || "").toLowerCase().includes(searchLower) ||
      (q.choices || []).some(c => c != null && String(c).toLowerCase().includes(searchLower))
    );
    return matchesSearch &&
      (filterCourse === "All" || q.course === filterCourse) &&
      (filterType === "All" || q.type === filterType) &&
      (filterDiff === "All" || q.difficulty === filterDiff) &&
      (filterSection === "All" || q.section === filterSection) &&
      (!filterIssuesOnly || validateQuestion(q).length > 0) &&
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
  });

  // Duplicate detection
  const duplicateIds = new Set();
  for (let i = 0; i < bank.length; i++) {
    for (let j = i + 1; j < bank.length; j++) {
      const a = bank[i]; const b = bank[j];
      if (a.section !== b.section) continue;
      if (questionSimilarity(a, b) > 0.75) { duplicateIds.add(a.id); duplicateIds.add(b.id); }
    }
  }

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
    loadBank,
    saveQuestion,
    deleteQuestion,
  };
}
