"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { loadExams } from "../../lib/db/exams.js";
import { logExport } from "../../lib/db/exportHistory.js";
import { buildDocx } from "../../lib/exports/docx.js";
import { buildQTI, buildQTIZip, buildClassroomSectionsQTI } from "../../lib/exports/qti.js";
import { dlBlob } from "../../lib/exports/utils.js";
import { bg2 } from "../../styles/theme.js";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SavedExamsScreen({ S, text1, text2, text3, border, onLoad }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLog, setExportLog] = useState([]);
  const [gradesData, setGradesData] = useState({}); // examId → [{question, avg, count}]
  const [showGrades, setShowGrades] = useState({}); // examId → bool
  const gradesFileRefs = {};

  useEffect(() => {
    Promise.all([loadExams(), loadExportHistory()]).then(([e, h]) => {
      setExams(e); setExportLog(h); setLoading(false);
    });
  }, []);

  async function loadExportHistory() {
    try {
      const { data, error } = await supabase
        .from("export_history")
        .select("*")
        .order("exported_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    } catch { return []; }
  }

  function parseCanvasGrades(csvText, exam) {
    // Parse CSV — Canvas format: first row = headers, first col = student name, second = ID, rest = question scores
    const lines = csvText.trim().split("\n").map(l => l.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
    if (lines.length < 2) return null;
    const headers = lines[0];

    // Find question columns — skip student name, ID, section, group cols
    // Canvas format typically: Student, ID, SIS User ID, SIS Login ID, Section, question_1, question_2...
    const skipCols = new Set();
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes("student") || lower.includes(" id") || lower === "id" ||
          lower.includes("sis") || lower.includes("login") || lower.includes("section") ||
          lower.includes("group") || lower.includes("score") || lower.includes("total") ||
          lower.includes("percent") || lower.includes("grade") || lower === "") {
        skipCols.add(i);
      }
    });

    const questionCols = headers
      .map((h, i) => ({ h, i }))
      .filter(({ i }) => !skipCols.has(i));

    if (questionCols.length === 0) return null;

    // Calculate average score per question column (strip student identity)
    const results = questionCols.map(({ h, i }) => {
      const scores = lines.slice(1)
        .map(row => parseFloat(row[i]))
        .filter(v => !isNaN(v));
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      // Try to find max points from header e.g. "Q1 (2 pts)" or from data
      const maxMatch = h.match(/\((\d+(?:\.\d+)?)\s*pts?\)/i);
      const max = maxMatch ? parseFloat(maxMatch[1]) : Math.max(...scores, 1);
      return { label: h, avg, max, count: scores.length, pct: avg !== null ? Math.round((avg / max) * 100) : null };
    }).filter(r => r.avg !== null).sort((a, b) => a.pct - b.pct);

    return results;
  }

  function handleGradesUpload(e, exam) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const results = parseCanvasGrades(ev.target.result, exam);
      if (!results || results.length === 0) {
        alert("Could not parse grades. Make sure this is a Canvas grades CSV.");
        return;
      }
      setGradesData(prev => ({ ...prev, [exam.id]: results }));
      setShowGrades(prev => ({ ...prev, [exam.id]: true }));
    };
    reader.readAsText(file);
  }

  if (loading) return <div style={{color:text2, padding:"2rem"}}>Loading saved exams…</div>;

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Saved Exams</h1>
        <p style={S.sub}>{exams.length} exam{exams.length !== 1 ? "s" : ""} saved in database.</p>
      </div>

      {exams.length === 0 && (
        <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
          No saved exams yet. Build an exam in the Versions tab and save it.
        </div>
      )}

      {exams.map(exam => {
        const versions = exam.versions || [];
        // detect sections — classSection lives on the version object, fall back to questions[0]
        const sectionNums = [...new Set(versions.map(v => v.classSection ?? v.questions?.[0]?.classSection).filter(Boolean))].sort((a,b)=>a-b);
        const hasMultipleSections = sectionNums.length > 1;
        const safeName = (exam.name||"Exam").replace(/[^a-zA-Z0-9]/g,"_");

        return (
        <div key={exam.id} style={S.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"0.5rem"}}>
            <div>
              <div style={{fontSize:"1rem", fontWeight:"bold", color:text1, marginBottom:"0.25rem"}}>{exam.name}</div>
              <div style={{fontSize:"0.72rem", color:text3}}>
                {new Date(exam.created_at).toLocaleDateString()} · {versions.length} version(s)
                {hasMultipleSections && ` · ${sectionNums.length} sections`}
              </div>
              {!hasMultipleSections && versions.length > 0 && versions.some(v => v.classSection || v.questions?.[0]?.classSection) && (
                <div style={{marginTop:"0.3rem", fontSize:"0.68rem", color:"#f59e0b", background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.2rem 0.5rem"}}>
                  ⚠ Saved before multi-section fix — re-build and re-save to restore all sections
                </div>
              )}
              <button style={{marginTop:"0.4rem", padding:"0.25rem 0.7rem", fontSize:"0.72rem",
                background:"#2D6A4F", color:"#fff", border:"none", borderRadius:"4px",
                cursor:"pointer", fontWeight:"600"}}
                onClick={() => onLoad && onLoad(exam)}>
                ▶ Load into Versions tab
              </button>
            </div>
            <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
            </div>
          </div>

          {/* Word export section — one zip per section */}
          <div style={{marginTop:"0.75rem", borderTop:"1px solid #1e2d45", paddingTop:"0.75rem", display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
            <span style={{fontSize:"0.72rem", color:text3, marginRight:"0.25rem"}}>Word:</span>
            {hasMultipleSections ? (
              // One zip button per section
              sectionNums.map(sec => (
                <button key={sec} style={S.oBtn("#10b981")}
                  onClick={async () => {
                    // load JSZip
                    if (!window.JSZip) {
                      await new Promise((res,rej) => {
                        const s = document.createElement("script");
                        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
                        s.onload = res; s.onerror = rej;
                        document.head.appendChild(s);
                      });
                    }
                    const zip = new window.JSZip();
                    const secVersions = versions.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec || (!(v.classSection ?? v.questions?.[0]?.classSection) && sec === sectionNums[0]));
                    for (const v of secVersions) {
                      const blob = await buildDocx(v.questions, exam.name, v.label, sec);
                      const bytes = await blob.arrayBuffer();
                      zip.file(`${safeName}_S${sec}_V${v.label}.docx`, bytes);
                    }
                    const zipBlob = await zip.generateAsync({type:"blob"});
                    dlBlob(zipBlob, `${safeName}_S${sec}_Word.zip`);
                    await logExport(exam.name, `Word S${sec} ZIP`, sec);
                  }}>
                  ⬇ S{sec} Word (.zip)
                </button>
              ))
            ) : (
              // No sections — one zip with all versions
              <button style={S.oBtn("#10b981")}
                onClick={async () => {
                  if (!window.JSZip) {
                    await new Promise((res,rej) => {
                      const s = document.createElement("script");
                      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
                      s.onload = res; s.onerror = rej;
                      document.head.appendChild(s);
                    });
                  }
                  const zip = new window.JSZip();
                  for (const v of versions) {
                    const blob = await buildDocx(v.questions, exam.name, v.label, null);
                    const bytes = await blob.arrayBuffer();
                    zip.file(`${safeName}_V${v.label}.docx`, bytes);
                  }
                  const zipBlob = await zip.generateAsync({type:"blob"});
                  dlBlob(zipBlob, `${safeName}_Word.zip`);
                  await logExport(exam.name, "Word ZIP", "all");
                }}>
                ⬇ All Versions Word (.zip)
              </button>
            )}
          </div>

          {/* QTI Re-export */}
          <div style={{marginTop:"0.75rem", borderTop:"1px solid #1e2d45", paddingTop:"0.75rem", display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center"}}>
            <span style={{fontSize:"0.72rem", color:text3, marginRight:"0.25rem"}}>Canvas QTI:</span>
            {hasMultipleSections ? (
              sectionNums.map(sec => (
                <button key={sec} style={S.oBtn("#8b5cf6")}
                  onClick={async () => {
                    const secVersions = versions.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec);
                    const blobs = await buildClassroomSectionsQTI({[sec]: secVersions}, exam.name, true, 1);
                    if (blobs[sec]) dlBlob(blobs[sec], `${safeName}_S${sec}_QTI.zip`);
                    await logExport(exam.name, `QTI S${sec}`, sec);
                  }}>
                  ⬇ S{sec} QTI (.zip)
                </button>
              ))
            ) : (
              versions.map(v => (
                <button key={v.label} style={S.oBtn("#8b5cf6")}
                  onClick={async () => {
                    const xml = buildQTI(v.questions, exam.name, v.label);
                    const blob = await buildQTIZip(xml, `${exam.name}_V${v.label}`);
                    dlBlob(blob, `${safeName}_V${v.label}_QTI.zip`);
                    await logExport(exam.name, "QTI", v.label);
                  }}>
                  ⬇ V{v.label} QTI (.zip)
                </button>
              ))
            )}
          </div>

          {/* Grades Import */}
          <div style={{marginTop:"0.75rem", borderTop:"1px solid #1e2d45", paddingTop:"0.75rem", display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap"}}>
            <input
              type="file" accept=".csv"
              style={{display:"none"}}
              id={`grades-${exam.id}`}
              onChange={e => handleGradesUpload(e, exam)}
            />
            <button style={{...S.oBtn("#06b6d4"), fontSize:"0.72rem"}}
              onClick={() => document.getElementById(`grades-${exam.id}`)?.click()}>
              📊 Import Canvas Grades
            </button>
            {gradesData[exam.id] && (
              <button style={{fontSize:"0.72rem", background:"none", border:"none", cursor:"pointer",
                color: showGrades[exam.id] ? "#06b6d4" : text3}}
                onClick={() => setShowGrades(prev => ({...prev, [exam.id]: !prev[exam.id]}))}>
                {showGrades[exam.id] ? "Hide Results" : "Show Results"}
              </button>
            )}
          </div>

          {/* Grades Results Panel */}
          {showGrades[exam.id] && gradesData[exam.id] && (
            <div style={{marginTop:"0.75rem", background:bg2, border:"1px solid "+border, borderRadius:"10px", padding:"1rem"}}>
              <div style={{fontSize:"0.78rem", color:"#06b6d4", fontWeight:"600", marginBottom:"0.75rem"}}>
                📊 Question Performance — sorted by lowest score
                <span style={{fontSize:"0.68rem", color:text3, fontWeight:"400", marginLeft:"0.5rem"}}>
                  (no student data stored)
                </span>
              </div>
              {gradesData[exam.id].map((r, i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.4rem",
                  padding:"0.4rem 0.6rem", borderRadius:"6px",
                  background: r.pct < 50 ? "#1a0a0a" : r.pct < 70 ? "#1a1200" : "#0a1200"}}>
                  <div style={{flex:1, fontSize:"0.78rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                    title={r.label}>{r.label}</div>
                  <div style={{flexShrink:0, width:"180px"}}>
                    <div style={{height:"6px", borderRadius:"3px", background:border, overflow:"hidden"}}>
                      <div style={{height:"100%", width:`${r.pct}%`, borderRadius:"3px",
                        background: r.pct < 50 ? "#f87171" : r.pct < 70 ? "#f59e0b" : "#4ade80"}} />
                    </div>
                  </div>
                  <div style={{flexShrink:0, fontSize:"0.75rem", fontWeight:"600", minWidth:"45px", textAlign:"right",
                    color: r.pct < 50 ? "#f87171" : r.pct < 70 ? "#f59e0b" : "#4ade80"}}>
                    {r.pct}%
                  </div>
                  <div style={{flexShrink:0, fontSize:"0.68rem", color:text3, minWidth:"55px"}}>
                    {r.avg?.toFixed(1)}/{r.max} pts
                  </div>
                </div>
              ))}
              <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.5rem"}}>
                Based on {gradesData[exam.id][0]?.count || 0} student submissions · Red = below 50% · Yellow = 50–70% · Green = above 70%
              </div>
            </div>
          )}
        </div>
        );
      })}

      {exportLog.length > 0 && (
        <>
          <h2 style={{fontSize:"1.1rem", fontWeight:"normal", margin:"2rem 0 0.75rem", color:text1}}>Export History</h2>
          <div style={S.card}>
            {exportLog.map((log, i) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"0.4rem 0", borderBottom: i < exportLog.length-1 ? `1px solid ${"#D9D0C0"}` : "none", fontSize:"0.78rem"}}>
                <span style={{color:text1}}>{log.exam_name} — V{log.version_label}</span>
                <span style={{color:text3}}>{log.format} · {new Date(log.exported_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
