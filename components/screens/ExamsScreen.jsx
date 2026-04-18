"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { loadExams, loadExportHistory } from "../../lib/supabase/exams.js";
import { useAppContext } from "../../context/AppContext.js";

function getClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default function ExamsScreen({
  // Data from useExamBuilder
  savedMasters,
  loadSavedMasters,
  deleteSavedMaster,
  loadMaster,
  bank,

  // Setters to hydrate an exam into Export screen
  setVersions,
  setClassSectionVersions,
  setActiveVersion,
  setMasterLocked,
  setExamSaved,
  setSaveExamName,
  setCourse,
  setSelectedForExam,

  // Navigation
  setScreen,
  // Toast (optional, not from prev wiring)
  showToast,

  // Styles
  S,
  text1,
  text2,
  text3,
  border,
  accent,
  bg1,
  bg2,
}) {
  const router = useRouter();
  const { examBuilder, bank: bankHook } = useAppContext();

  const [tab, setTab] = useState("exams");
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setExamsLoading(true);
    setHistoryLoading(true);
    try {
      const [e, h] = await Promise.all([loadExams(), loadExportHistory()]);
      setExams(e);
      setHistory(h);
    } finally {
      setExamsLoading(false);
      setHistoryLoading(false);
    }
    if (loadSavedMasters) await loadSavedMasters();
  }

  async function deleteExam(id) {
    if (!confirm("Delete this saved exam?")) return;
    setDeletingId(id);
    try {
      const supabase = getClient();
      await supabase.from("exams").delete().eq("id", id);
      setExams(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  function hydrateAndGoExport(exam) {
    const vers = exam.versions || [];
    const sectionNums = [
      ...new Set(vers.map(v => v.classSection ?? v.questions?.[0]?.classSection).filter(Boolean))
    ].sort((a, b) => a - b);
    if (sectionNums.length > 1) {
      const secVersions = {};
      sectionNums.forEach(sec => {
        secVersions[sec] = vers.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec);
      });
      setClassSectionVersions && setClassSectionVersions(secVersions);
      setVersions && setVersions(secVersions[sectionNums[0]] || vers);
    } else {
      setClassSectionVersions && setClassSectionVersions({});
      setVersions && setVersions(vers);
    }
    setActiveVersion && setActiveVersion(0);
    setMasterLocked && setMasterLocked(false);
    setExamSaved && setExamSaved(true);
    setSaveExamName && setSaveExamName(exam.name);
    setCourse && setCourse(vers[0]?.questions?.[0]?.course || null);
    setSelectedForExam && setSelectedForExam([]);
    setScreen && setScreen("export");
  }

  function hydrateAndGoBuild(master) {
    const resolvedQuestions = (master.master_questions || []).map(mq => {
      const fresh = bankHook.bank.find(b => b.id === mq.id);
      return fresh || mq;
    });

    examBuilder.setVersions([{ label: "A", questions: resolvedQuestions }]);
    examBuilder.setMasterLocked(true);
    examBuilder.setSelectedForExam(resolvedQuestions.map(q => q.id));
    examBuilder.setVersionCount(master.settings?.versionCount || 2);
    examBuilder.setNumClassSections(master.settings?.numClassSections || 1);
    examBuilder.setVersionMutationType(master.settings?.versionMutationType || {});

    router.push("/app/build");
    if (showToast) showToast(`Loaded "${master.name}" ✓`);
  }

  const tabBtn = (key, label, count) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        background: tab === key ? accent + "22" : "transparent",
        color: tab === key ? accent : text2,
        border: `1px solid ${tab === key ? accent + "66" : border}`,
        borderRadius: "6px",
        padding: "0.4rem 0.9rem",
        fontSize: "0.82rem",
        fontWeight: tab === key ? "600" : "500",
        cursor: "pointer",
      }}
    >
      {label}
      {typeof count === "number" && (
        <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", opacity: 0.75 }}>({count})</span>
      )}
    </button>
  );

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={S.h1}>Exams</h1>
          <p style={S.sub}>Saved exams, masters, and export history.</p>
        </div>
        <button style={{ ...S.oBtn(text2), fontSize: "0.75rem" }} onClick={refreshAll}>↻ Refresh</button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {tabBtn("exams", "Saved Exams", exams.length)}
        {tabBtn("masters", "Master Versions", (savedMasters || []).length)}
        {tabBtn("history", "Export History", history.length)}
      </div>

      {/* Saved Exams */}
      {tab === "exams" && (
        <>
          {examsLoading && <div style={{ color: text3, padding: "2rem", textAlign: "center" }}>Loading exams…</div>}
          {!examsLoading && exams.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🗂</div>
              <div style={{ fontSize: "0.95rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>No saved exams yet</div>
              <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.25rem" }}>
                Build an exam and save it to see it here.
              </div>
              <button style={S.btn(accent, false)} onClick={() => setScreen && setScreen("build")}>Go to Build →</button>
            </div>
          )}
          {exams.map(exam => {
            const vers = exam.versions || [];
            const sectionNums = [
              ...new Set(vers.map(v => v.classSection ?? v.questions?.[0]?.classSection).filter(Boolean))
            ].sort((a, b) => a - b);
            const courseName = vers[0]?.questions?.[0]?.course || "—";
            return (
              <div key={exam.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.25rem" }}>{exam.name}</div>
                    <div style={{ fontSize: "0.72rem", color: text3 }}>
                      {new Date(exam.created_at).toLocaleDateString()} · {vers.length} version{vers.length !== 1 ? "s" : ""}
                      {sectionNums.length > 1 && ` · ${sectionNums.length} sections`}
                      {courseName !== "—" && ` · ${courseName}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                    <button style={{ ...S.btn(accent, false), fontSize: "0.78rem", padding: "0.35rem 0.85rem" }} onClick={() => hydrateAndGoExport(exam)}>
                      ▶ Load
                    </button>
                    <button
                      style={{ ...S.oBtn("#f87171"), fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}
                      disabled={deletingId === exam.id}
                      onClick={() => deleteExam(exam.id)}
                    >
                      {deletingId === exam.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Master Versions */}
      {tab === "masters" && (
        <>
          {(!savedMasters || savedMasters.length === 0) && (
            <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🧱</div>
              <div style={{ fontSize: "0.95rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>No saved masters yet</div>
              <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.25rem" }}>
                Save a master from the Build screen to reuse it later.
              </div>
              <button style={S.btn(accent, false)} onClick={() => setScreen && setScreen("build")}>Go to Build →</button>
            </div>
          )}
          {(savedMasters || []).map(master => {
            const qCount = (master.master_questions || []).length;
            const settings = master.settings || {};
            return (
              <div key={master.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.25rem" }}>{master.name}</div>
                    <div style={{ fontSize: "0.72rem", color: text3 }}>
                      {new Date(master.created_at).toLocaleDateString()} · {qCount} question{qCount !== 1 ? "s" : ""}
                      {settings.course && ` · ${settings.course}`}
                      {settings.versionCount && ` · ${settings.versionCount} variant${settings.versionCount > 1 ? "s" : ""}`}
                      {settings.numClassSections > 1 && ` · ${settings.numClassSections} sections`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                    <button
                      style={{ ...S.btn("#8b5cf6", false), fontSize: "0.78rem", padding: "0.35rem 0.85rem" }}
                      onClick={() => hydrateAndGoBuild(master)}
                    >
                      ▶ Load
                    </button>
                    <button
                      style={{ ...S.oBtn("#f87171"), fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}
                      onClick={() => {
                        if (confirm(`Delete master "${master.name}"?`)) deleteSavedMaster && deleteSavedMaster(master.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Export History */}
      {tab === "history" && (
        <>
          {historyLoading && <div style={{ color: text3, padding: "2rem", textAlign: "center" }}>Loading history…</div>}
          {!historyLoading && history.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem", color: text3 }}>
              No exports yet.
            </div>
          )}
          {!historyLoading && history.length > 0 && (
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: bg2, textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.85rem", color: text2, fontWeight: "600", borderBottom: "1px solid " + border }}>Exam</th>
                    <th style={{ padding: "0.6rem 0.85rem", color: text2, fontWeight: "600", borderBottom: "1px solid " + border }}>Format</th>
                    <th style={{ padding: "0.6rem 0.85rem", color: text2, fontWeight: "600", borderBottom: "1px solid " + border }}>Version</th>
                    <th style={{ padding: "0.6rem 0.85rem", color: text2, fontWeight: "600", borderBottom: "1px solid " + border }}>Exported</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ borderBottom: "1px solid " + border + "66" }}>
                      <td style={{ padding: "0.55rem 0.85rem", color: text1 }}>{h.exam_name}</td>
                      <td style={{ padding: "0.55rem 0.85rem", color: text2 }}>{h.format}</td>
                      <td style={{ padding: "0.55rem 0.85rem", color: text2 }}>{h.version_label ?? "—"}</td>
                      <td style={{ padding: "0.55rem 0.85rem", color: text3, whiteSpace: "nowrap" }}>
                        {new Date(h.exported_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
