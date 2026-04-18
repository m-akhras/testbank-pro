"use client";
import { uid } from "../../lib/utils/questions.js";
import { mathStepsOnly } from "../../lib/exports/helpers.js";
import { buildReplacePrompt, buildConvertPrompt, buildGeneratePrompt } from "../../lib/prompts/index.js";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";
import GraphEditor from "../editors/GraphEditor.js";
import InlineEditor from "../editors/InlineEditor.js";
import PastePanel from "../panels/PastePanel.js";
import QuestionCard from "../question/QuestionCard.jsx";

export default function BankScreen({
  // Bank state
  bank,
  bankLoaded,
  bankIssueCount,
  bankCompact,
  setBankCompact,
  bankSearch,
  setBankSearch,
  filterCourse,
  setFilterCourse,
  filterSection,
  setFilterSection,
  filterType,
  setFilterType,
  filterDiff,
  setFilterDiff,
  filterYear,
  setFilterYear,
  filterMonth,
  setFilterMonth,
  filterDay,
  setFilterDay,
  filterTime,
  setFilterTime,
  filterIssuesOnly,
  setFilterIssuesOnly,
  bankSelectMode,
  setBankSelectMode,
  bankSelected,
  setBankSelected,
  filteredBank,
  duplicateIds,
  bankDupCount,
  availableSections,
  availableYears,
  availableMonths,
  availableDays,
  availableTimes,
  MONTHS,
  QTYPES,
  DIFFICULTIES,
  allCourses,
  courseColors,
  accent,
  isAdmin,
  // Exam selection
  selectedForExam,
  setSelectedForExam,
  usedInExams,
  mutationType,
  setMutationType,
  numClassSections,
  setNumClassSections,
  versionCount,
  setVersionCount,
  classSectionVersions,
  versions,
  // Pending / paste state
  pendingType,
  setPendingType,
  pendingMeta,
  setPendingMeta,
  generatedPrompt,
  setGeneratedPrompt,
  pasteInput,
  setPasteInput,
  pasteError,
  setPasteError,
  handlePaste,
  autoGenLoading,
  autoGenError,
  autoGenerateVersions,
  // Bulk replace
  bulkReplacePrompt,
  setBulkReplacePrompt,
  bulkReplaceIds,
  setBulkReplaceIds,
  bulkReplacePaste,
  setBulkReplacePaste,
  bulkReplaceError,
  setBulkReplaceError,
  // Editor state
  graphEditorQId,
  setGraphEditorQId,
  inlineEditQId,
  setInlineEditQId,
  // Tab state
  bankTabState,
  setBankTabState,
  expandedBatches,
  setExpandedBatches,
  // Delete dialog
  confirmDelete,
  setConfirmDelete,
  // Navigation
  setScreen,
  // DB helpers
  saveQuestion,
  deleteQuestion,
  // Toast
  showToast,
  // Styles
  S,
  text1,
  text2,
  text3,
  border,
  bg1,
  bg2,
  bg0,
  // Validator
  validateQuestion,
}) {
  return (
    <div>
      {selectedForExam.length > 0 && (
        <div style={{
          position:"sticky", top:0, zIndex:10,
          background:"#10b981", color:"#052e16",
          padding:"0.6rem 1rem", marginBottom:"0.75rem",
          borderRadius:"8px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          gap:"0.75rem", flexWrap:"wrap",
          boxShadow:"0 2px 6px rgba(16,185,129,0.35)"
        }}>
          <span style={{fontWeight:"600", fontSize:"0.85rem"}}>
            ✓ {selectedForExam.length} question{selectedForExam.length === 1 ? "" : "s"} selected
          </span>
          <button
            style={{background:"#052e16", color:"#d1fae5", border:"none", borderRadius:"6px",
              padding:"0.4rem 0.9rem", fontSize:"0.8rem", fontWeight:"600", cursor:"pointer"}}
            onClick={() => setScreen && setScreen("build")}
          >
            ✓ Done — Back to Build →
          </button>
        </div>
      )}
      <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
        <div>
          <h1 style={S.h1}>Question Bank</h1>
          <p style={S.sub}>{bank.length} questions saved{bankIssueCount > 0 ? ` · ⚠️ ${bankIssueCount} with issues` : " · ✓ all valid"}.</p>
        </div>
        <div style={{display:"flex", gap:"0.5rem", flexShrink:0}}>
          <button style={{...S.ghostBtn(bankCompact ? accent : text3), fontSize:"0.75rem"}} onClick={() => setBankCompact(p => !p)}>
            {bankCompact ? "≡ Compact" : "☰ Compact"}
          </button>
          {isAdmin && (
            <button style={{...S.ghostBtn("#f59e0b"), fontSize:"0.75rem"}} onClick={async () => {
              const frQs = bank.filter(q => (q.type === "Free Response" || q.type === "Short Answer") && q.explanation);
              if (!frQs.length) { showToast("No Free Response explanations to clean."); return; }
              if (!window.confirm(`Clean prose from explanations of ${frQs.length} Free Response questions? This rewrites their explanation field in Supabase.`)) return;
              let cleaned = 0;
              for (const q of frQs) {
                const original = q.explanation;
                const lines = mathStepsOnly(original);
                const newExpl = lines.join("\n");
                if (newExpl !== original) {
                  const updated = { ...q, explanation: newExpl };
                  await saveQuestion(updated);
                  cleaned++;
                }
              }
              showToast(`Cleaned ${cleaned} explanation${cleaned !== 1 ? "s" : ""} ✓`);
            }}>🧹 Clean Explanations</button>
          )}
          <button style={{...S.oBtn(text2), fontSize:"0.75rem"}} onClick={() => setScreen("generate")}>+ Generate More</button>
          <button style={{...S.btn("#8b5cf6", false), fontSize:"0.75rem"}} onClick={() => {
            const ids = (window.__lastGenerated || []).map(q => q.id).filter(Boolean);
            if (ids.length) setSelectedForExam(prev => [...new Set([...prev, ...ids])]);
            setScreen("versions");
          }}>Build Exam →</button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.5rem", borderBottom:"1px solid "+border, paddingBottom:"0"}}>
        {[{id:"browse",label:"Browse Questions"},{id:"history",label:"Generation History"}].map(tab => (
          <button key={tab.id}
            style={{
              background:"transparent", border:"none", color: bankTabState===tab.id ? accent : text2,
              fontSize:"0.85rem", fontWeight: bankTabState===tab.id ? "600" : "400",
              padding:"0.5rem 0.25rem", cursor:"pointer",
              borderBottom: "2px solid "+(bankTabState===tab.id ? accent : "transparent"),
              marginBottom:"-1px", fontFamily:"'Inter',system-ui,sans-serif"
            }}
            onClick={() => setBankTabState(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BROWSE TAB ── */}
      {bankTabState === "browse" && (<>

        {/* Bulk select toolbar */}
        <div style={{display:"flex", gap:"0.5rem", alignItems:"center", marginBottom:"0.75rem", flexWrap:"wrap"}}>
          <button style={S.ghostBtn(bankSelectMode ? "#f87171" : text2)}
            onClick={() => { setBankSelectMode(!bankSelectMode); setBankSelected(new Set()); }}>
            {bankSelectMode ? `✕ Cancel Select (${bankSelected.size} selected)` : "☑ Select to Delete"}
          </button>
          {isAdmin && !bankSelectMode && (
            <button style={S.ghostBtn("#8b5cf6")} onClick={async () => {
              const graphQs = bank.filter(q => q.hasGraph && q.graphConfig && (q.graphConfig.title || q.graphConfig.probability));
              if (graphQs.length === 0) { showToast("No titles/labels to clean up ✓"); return; }
              if (!window.confirm(`Strip title and probability labels from ${graphQs.length} graph question(s)? This makes them cleaner in Canvas.`)) return;
              let cleaned = 0;
              for (const q of graphQs) {
                const { title, probability, ...cleanConfig } = q.graphConfig;
                const updated = { ...q, graphConfig: cleanConfig };
                await saveQuestion(updated);
                cleaned++;
              }
              showToast(`✓ Cleaned ${cleaned} graph question${cleaned>1?"s":""}`);
            }}>🧹 Clean graph titles</button>
          )}
          {bankSelectMode && bankSelected.size > 0 && (
            <>
              <button style={S.ghostBtn("#f87171")} onClick={async () => {
                if (!window.confirm(`Delete ${bankSelected.size} questions? This cannot be undone.`)) return;
                for (const id of bankSelected) await deleteQuestion(id);
                setBankSelected(new Set()); setBankSelectMode(false);
              }}>🗑 Delete {bankSelected.size} questions</button>
              <button style={S.ghostBtn("#10b981")} onClick={() => {
                const selectedQs = bank.filter(q => bankSelected.has(q.id));
                if (!selectedQs.length) return;
                const secCfg = {};
                selectedQs.forEach(q => {
                  const sec = q.section || "Unknown";
                  if (!secCfg[sec]) secCfg[sec] = { Easy:{count:0,graphType:"normal"}, Medium:{count:0,graphType:"normal"}, Hard:{count:0,graphType:"normal"} };
                  const diff = q.difficulty || "Medium";
                  if (secCfg[sec][diff]) secCfg[sec][diff].count++;
                  if (q.hasGraph) secCfg[sec][diff].graphType = "graph";
                });
                const sections = Object.keys(secCfg);
                const qType = selectedQs[0].type || "Multiple Choice";
                const prompt = buildGeneratePrompt(null, sections, {}, qType, null, secCfg);
                setBulkReplacePrompt(prompt);
                setBulkReplaceIds(new Set(bankSelected));
                setBulkReplacePaste(""); setBulkReplaceError("");
              }}>🔄 Replace {bankSelected.size} with new</button>
              <button style={S.ghostBtn(text2)} onClick={() => {
                const ids = new Set(filteredBank.map(q => q.id));
                setBankSelected(ids);
              }}>Select all {filteredBank.length} shown</button>
            </>
          )}
        </div>

        {/* Bulk replace prompt + paste panel */}
        {bulkReplacePrompt && (
          <div style={{background:bg2, border:"1px solid #10b98144", borderRadius:"10px", padding:"1rem", marginBottom:"1rem"}}>
            <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"600", marginBottom:"0.5rem"}}>
              🔄 Replace {bulkReplaceIds.size} questions — copy prompt to Claude, paste response back:
            </div>
            <div style={{...S.promptBox, maxHeight:"140px"}}>{bulkReplacePrompt}</div>
            <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
              <button style={{...S.oBtn("#10b981"), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                onClick={() => navigator.clipboard.writeText(bulkReplacePrompt)}>📋 Copy Prompt</button>
              {isAdmin && (
                <button style={{...S.btn("#10b981", autoGenLoading), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                  disabled={autoGenLoading}
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt:bulkReplacePrompt}) });
                      if (!res.ok) throw new Error(`API error: ${res.status}`);
                      const data = await res.json();
                      const text = data.content?.[0]?.text || data.text || "";
                      if (!text) throw new Error("Empty response.");
                      setBulkReplacePaste(text);
                    } catch(e) { setBulkReplaceError(e.message); }
                  }}>{autoGenLoading ? "⏳ Generating..." : "⚡ Auto-Generate"}</button>
              )}
              <button style={{...S.ghostBtn(text3), fontSize:"0.68rem"}}
                onClick={() => { setBulkReplacePrompt(""); setBulkReplaceIds(new Set()); setBulkReplacePaste(""); setBulkReplaceError(""); }}>Cancel</button>
            </div>
            {bulkReplaceError && <div style={{color:"#f87171", fontSize:"0.75rem", marginBottom:"0.5rem"}}>{bulkReplaceError}</div>}
            <textarea
              value={bulkReplacePaste}
              onChange={e => setBulkReplacePaste(e.target.value)}
              placeholder="Paste Claude's JSON response here..."
              style={{...S.textarea, minHeight:"80px", marginBottom:"0.5rem"}}
            />
            <button style={S.btn("#10b981", !bulkReplacePaste.trim())} disabled={!bulkReplacePaste.trim()}
              onClick={async () => {
                setBulkReplaceError("");
                try {
                  const match = bulkReplacePaste.match(/\[[\s\S]*\]/);
                  if (!match) throw new Error("No JSON array found. Copy the full response.");
                  const parsed = JSON.parse(match[0]);
                  const sanitize = (q) => ({ ...q, type:q.type||"Multiple Choice", difficulty:q.difficulty||"Medium", question:q.question||"", answer:q.answer||"", choices:(q.choices||[]).map(c=>c??""), explanation:q.explanation||"" });
                  const tagged = parsed.map(q => ({ ...sanitize(q), id:uid(), createdAt:Date.now() }));
                  for (const id of bulkReplaceIds) await deleteQuestion(id);
                  for (const q of tagged) await saveQuestion(q);
                  setBankSelected(new Set()); setBankSelectMode(false);
                  setBulkReplacePrompt(""); setBulkReplaceIds(new Set()); setBulkReplacePaste("");
                  showToast(`✓ ${tagged.length} questions replaced successfully`, "success");
                } catch(e) { setBulkReplaceError(e.message || "Failed to parse response."); }
              }}>✓ Submit Replacement</button>
          </div>
        )}

        {/* Search */}
        <div style={{marginBottom:"0.75rem"}}>
          <input
            value={bankSearch} onChange={e => setBankSearch(e.target.value)}
            placeholder="🔍  Search questions, answers, sections..."
            style={{width:"100%", padding:"0.5rem 0.75rem", background:bg2,
              border:"1px solid "+border, color:text1, borderRadius:"8px",
              fontSize:"0.83rem", boxSizing:"border-box", outline:"none"}}
          />
        </div>

        {/* Filters */}
        <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
          <select style={{...S.sel, width:"155px"}} value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSection("All"); }}>
            <option>All</option>{Object.keys(allCourses).map(c => <option key={c}>{c}</option>)}
          </select>
          {filterCourse !== "All" && (
            <select style={{...S.sel, width:"220px"}} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="All">All Sections</option>
              {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select style={{...S.sel, width:"145px"}} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option>All</option>{QTYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <select style={{...S.sel, width:"130px"}} value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
            <option>All</option>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
          <select style={{...S.sel, width:"175px"}} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth("All"); setFilterDay("All"); setFilterTime("All"); }}>
            <option value="All">All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {filterYear !== "All" && (
            <select style={{...S.sel, width:"145px"}} value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDay("All"); setFilterTime("All"); }}>
              <option value="All">All Months</option>
              {availableMonths.map(m => <option key={m} value={m}>{MONTHS[parseInt(m)]}</option>)}
            </select>
          )}
          {filterYear !== "All" && filterMonth !== "All" && (
            <select style={{...S.sel, width:"120px"}} value={filterDay} onChange={e => { setFilterDay(e.target.value); setFilterTime("All"); }}>
              <option value="All">All Days</option>
              {availableDays.map(d => <option key={d} value={d}>Day {d}</option>)}
            </select>
          )}
          {filterYear !== "All" && filterMonth !== "All" && filterDay !== "All" && (
            <select style={{...S.sel, width:"130px"}} value={filterTime} onChange={e => setFilterTime(e.target.value)}>
              <option value="All">All Times</option>
              {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <span style={{fontSize:"0.78rem", color:text2, alignSelf:"center"}}>{filteredBank.length} matching</span>
          {selectedForExam.length > 0 && (
            <span style={{
              display:"inline-flex", alignItems:"center", gap:"0.3rem",
              fontSize:"0.75rem", fontWeight:"700", color:"#fff",
              background:"#e11d48", borderRadius:"999px",
              padding:"0.18rem 0.65rem", alignSelf:"center",
              boxShadow:"0 1px 4px "+accent+"55"
            }}>
              ✓ {selectedForExam.length} selected for exam
              <span title="Clear selection" onClick={() => setSelectedForExam([])}
                style={{cursor:"pointer", marginLeft:"2px", opacity:0.75, fontWeight:"400", fontSize:"0.72rem"}}>✕</span>
            </span>
          )}
          {bankIssueCount > 0 && (
            <button
              style={{...S.ghostBtn(filterIssuesOnly ? "#f87171" : text3), alignSelf:"center", border: filterIssuesOnly ? "1px solid #f8717144" : "1px solid "+border}}
              onClick={() => setFilterIssuesOnly(p => !p)}>
              {filterIssuesOnly ? "⚠ Issues only ✕" : `⚠ Show ${bankIssueCount} with issues`}
            </button>
          )}
          {bankDupCount > 0 && (
            <span style={{fontSize:"0.72rem", color:"#f59e0b", alignSelf:"center", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.18rem 0.5rem"}}>
              ⚠ {bankDupCount} possible duplicate{bankDupCount>1?"s":""}
            </span>
          )}
        </div>

        {!bankLoaded && <div style={{color:text2}}>Loading from database…</div>}
        {bankLoaded && bank.length === 0 && (
          <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
            <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>📭</div>
            <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>Your bank is empty</div>
            <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
              Generate your first questions to get started.<br/>
              Choose a course, pick sections, and copy the prompt to Claude.
            </div>
            <button style={S.btn(accent, false)} onClick={() => setScreen("generate")}>
              ✦ Generate Questions
            </button>
          </div>
        )}
        {bankLoaded && bank.length > 0 && filteredBank.length === 0 && (
          <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
            No questions match filters.
          </div>
        )}

        {/* Compact view */}
        {bankCompact ? (
          <div style={{border:"1px solid "+border, borderRadius:"10px", overflow:"hidden"}}>
            {filteredBank.map((q, qi) => {
              const inExam = selectedForExam.includes(q.id);
              const used = usedInExams[q.id] || 0;
              const issues = validateQuestion(q);
              return (
                <div key={q.id} style={{
                  display:"flex", alignItems:"center", gap:"0.6rem",
                  padding:"0.45rem 0.75rem",
                  borderBottom: qi < filteredBank.length-1 ? "1px solid "+border+"55" : "none",
                  background: inExam ? "#fff1f2" : qi%2===0 ? "transparent" : "#ffffff04",
                  borderLeft: inExam ? "4px solid #e11d48" : "4px solid transparent",
                }}>
                  <span style={{...S.diffTag(q.difficulty||""), flexShrink:0, fontSize:"0.58rem", padding:"0.05rem 0.3rem"}}>{(q.difficulty||"?")[0]}</span>
                  <span style={{fontSize:"0.68rem", color:text3, flexShrink:0, minWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{(q.section||"").split(" ").slice(0,3).join(" ")}</span>
                  <span style={{flex:1, fontSize:"0.8rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    {q.type==="Branched" ? q.stem : q.question}
                  </span>
                  {used > 0 && <span style={{fontSize:"0.62rem", color:"#06b6d4", flexShrink:0}}>📋×{used}</span>}
                  {issues.length > 0 && <span style={{fontSize:"0.62rem", color:"#f87171", flexShrink:0}}>⚠</span>}
                  <button style={{...S.smBtn, flexShrink:0, color:inExam?"#e11d48":text3, border:"1px solid "+(inExam?"#e11d4844":border)}}
                    onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id=>id!==q.id) : [...p,q.id])}>
                    {inExam?"✓":"+"}</button>
                  <button style={{...S.smBtn, flexShrink:0, color:"#7C3AED", border:"1px solid #a78bfa33"}}
                    onClick={() => { setInlineEditQId(inlineEditQId===q.id?null:q.id); setGraphEditorQId(null); }}>✏</button>
                  <button style={{...S.smBtn, flexShrink:0, color:"#f87171", border:"1px solid #f8717133"}}
                    onClick={() => setConfirmDelete({id:q.id, label:(q.question||q.stem||"").slice(0,60)})}>✕</button>
                </div>
              );
            })}
          </div>
        ) : (
          // Normal card view — uses QuestionCard component
          filteredBank.map(q => {
            const inExam = selectedForExam.includes(q.id);
            return (
              <QuestionCard
                key={q.id}
                q={q}
                inExam={inExam}
                isAdmin={isAdmin}
                S={S}
                accent={accent}
                text1={text1}
                text2={text2}
                text3={text3}
                border={border}
                mutationType={mutationType[q.id]}
                onMutationChange={(id, mt) => setMutationType(p => ({...p, [id]: mt}))}
                onSelect={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id => id !== q.id) : [...p, q.id])}
                onEdit={() => { setInlineEditQId(inlineEditQId === q.id ? null : q.id); setGraphEditorQId(null); }}
                onGraphEdit={() => { setGraphEditorQId(graphEditorQId === q.id ? null : q.id); setInlineEditQId(null); }}
                onDelete={() => setConfirmDelete({id: q.id, label: (q.question||q.stem||"").slice(0,60)})}
                onReplace={() => {
                  const prompt = buildReplacePrompt(q, "numbers");
                  setGeneratedPrompt(prompt);
                  setPendingType("bank_replace"); setPendingMeta({qId: q.id}); setPasteInput(""); setPasteError("");
                }}
                noneOfAbove={q.noneOfAbove || false}
                onNoneOfAboveChange={async (id, value) => {
                  const target = bank.find(bq => bq.id === id);
                  if (!target) return;
                  const updated = { ...target, noneOfAbove: value };
                  await saveQuestion(updated);
                }}
              >
                {/* Extra tags (used in exams, duplicates, bankSelectMode) */}
                {usedInExams[q.id] > 0 && (
                  <div style={{...S.qMeta, marginTop:"-0.25rem", marginBottom:"0.4rem"}}>
                    <span title={`Used in ${usedInExams[q.id]} saved exam${usedInExams[q.id]>1?"s":""}`}
                      style={{...S.tag(), background:"#06b6d415", color:"#06b6d4", border:"1px solid #06b6d433"}}>
                      📋 ×{usedInExams[q.id]}
                    </span>
                    {duplicateIds.has(q.id) && (
                      <span title="Possible duplicate — similar question exists in same section"
                        style={{...S.tag(), background:"#f59e0b15", color:"#f59e0b", border:"1px solid #f59e0b44"}}>
                        ⚠ dup
                      </span>
                    )}
                  </div>
                )}
                {bankSelectMode && (
                  <div style={{marginBottom:"0.35rem"}}>
                    <input type="checkbox" checked={bankSelected.has(q.id)}
                      onChange={e => { const s = new Set(bankSelected); e.target.checked ? s.add(q.id) : s.delete(q.id); setBankSelected(s); }}
                      style={{accentColor:"#f87171", width:"15px", height:"15px", cursor:"pointer"}} />
                  </div>
                )}

                {/* GraphEditor */}
                {graphEditorQId === q.id && (
                  <GraphEditor
                    initialConfig={q.graphConfig || null}
                    onSave={async (cfg) => {
                      const updated = { ...q, hasGraph: true, graphConfig: cfg };
                      await saveQuestion(updated);
                      setGraphEditorQId(null);
                      showToast("Graph saved ✓");
                    }}
                    onRemove={async () => {
                      const updated = { ...q, hasGraph: false, graphConfig: null };
                      await saveQuestion(updated);
                      setGraphEditorQId(null);
                    }}
                    onClose={() => setGraphEditorQId(null)}
                  />
                )}

                {/* InlineEditor */}
                {inlineEditQId === q.id && (
                  <InlineEditor
                    q={q}
                    onSave={async (updated) => {
                      await saveQuestion(updated);
                      setInlineEditQId(null);
                      showToast("Question saved ✓");
                    }}
                    onClose={() => setInlineEditQId(null)}
                  />
                )}

                {/* Bank replace panel */}
                {pendingType === "bank_replace" && pendingMeta?.qId === q.id && generatedPrompt && (
                  <div style={{marginTop:"0.75rem", borderTop:"1px solid #f59e0b33", paddingTop:"0.75rem"}}>
                    <div style={{fontSize:"0.72rem", color:"#f59e0b", fontWeight:"600", marginBottom:"0.4rem"}}>
                      ↻ Replace this question — copy prompt to Claude, paste response back:
                    </div>
                    <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.35rem", flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.65rem", color:text3, alignSelf:"center"}}>Regenerate:</span>
                      <button style={S.ghostBtn("#f59e0b")} onClick={() => { const p = buildReplacePrompt(q,"numbers"); setGeneratedPrompt(p); }}>Same type</button>
                      <button style={S.ghostBtn("#e879f9")} onClick={() => { const p = buildReplacePrompt(q,"function"); setGeneratedPrompt(p); }}>Diff. function</button>
                    </div>
                    {(q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II" || q.hasGraph) && (
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap", paddingTop:"0.35rem", borderTop:"1px solid "+border}}>
                        <span style={{fontSize:"0.65rem", color:text3, alignSelf:"center"}}>Convert to:</span>
                        {!q.hasGraph && (
                          <button style={S.ghostBtn("#10b981")} onClick={() => { const p = buildConvertPrompt(q,"graph"); setGeneratedPrompt(p); }}>📈 Graph</button>
                        )}
                        {q.hasGraph && (
                          <button style={S.ghostBtn("#94a3b8")} onClick={() => { const p = buildConvertPrompt(q,"text"); setGeneratedPrompt(p); }}>📝 Text only</button>
                        )}
                        {(q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II") && (<>
                          {!q.hasGraph && <button style={S.ghostBtn("#185FA5")} onClick={() => { const p = buildConvertPrompt(q,"table"); setGeneratedPrompt(p); }}>📊 Table</button>}
                          {q.hasGraph && <button style={S.ghostBtn("#185FA5")} onClick={() => { const p = buildConvertPrompt(q,"table"); setGeneratedPrompt(p); }}>📊 Table</button>}
                        </>)}
                      </div>
                    )}
                    <div style={{display:"flex", justifyContent:"flex-end"}}>
                      <button style={{...S.ghostBtn(text3), fontSize:"0.68rem"}} onClick={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}>Cancel</button>
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    {isAdmin && (
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap"}}>
                        <button style={{...S.oBtn("#f59e0b"), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                          onClick={() => navigator.clipboard.writeText(generatedPrompt)}>📋 Copy Prompt</button>
                        <button style={{...S.btn("#10b981", autoGenLoading), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                          disabled={autoGenLoading}
                          onClick={() => autoGenerateVersions(generatedPrompt, "bank_replace", pendingMeta)}>
                          {autoGenLoading ? "⏳ Generating..." : "⚡ Auto-Generate"}
                        </button>
                      </div>
                    )}
                    <PastePanel
                      label="Paste the replacement question JSON here."
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError}
                      handlePaste={async () => {
                        setPasteError("");
                        try {
                          const raw = pasteInput.trim();
                          const match = raw.match(/\[[\s\S]*\]/);
                          if (!match) throw new Error("No JSON array found.");
                          const parsed = JSON.parse(match[0]);
                          const newQ = { ...parsed[0], id: q.id, course: q.course, section: q.section, createdAt: Date.now() };
                          await saveQuestion(newQ);
                          setPendingType(null); setPasteInput(""); setGeneratedPrompt("");
                        } catch(e) { setPasteError("Error: " + e.message); }
                      }}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </div>
                )}
              </QuestionCard>
            );
          })
        )}

        {/* Selected-for-exam footer */}
        {selectedForExam.length > 0 && (
          <div style={{...S.card, borderColor:accent+"44", marginTop:"1.5rem"}}>
            <div style={{display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap", marginBottom:"0.75rem"}}>
              <span style={{fontSize:"0.78rem", color:accent, fontWeight:"bold"}}>
                {selectedForExam.length} question{selectedForExam.length!==1?"s":""} selected
              </span>
              <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                <span style={{fontSize:"0.72rem", color:text2}}>Versions per class:</span>
                <select style={{...S.sel, width:"130px", padding:"0.4rem 0.6rem"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} version{n>1?"s":""}</option>)}
                </select>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                <span style={{fontSize:"0.72rem", color:text2}}>Classroom sections:</span>
                <input
                  type="number" min={1} max={10} value={numClassSections}
                  onChange={e => setNumClassSections(Math.max(1, parseInt(e.target.value)||1))}
                  style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}}
                />
              </div>
            </div>
            <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.5rem"}}>
              <button style={S.btn(accent, false)} onClick={() => setScreen("versions")}>
                ✦ Build Exam →
              </button>
              {Object.keys(classSectionVersions).length > 0 && (
                <button style={{...S.oBtn("#10b981")}} onClick={() => setScreen("versions")}>
                  📋 View Versions
                </button>
              )}
            </div>
            <div style={{fontSize:"0.68rem", color:text3}}>
              {numClassSections > 1
                ? "Section 1: numbers mutation (same time). Section 2+: function mutation (different time)."
                : "Tip: set numbers/function mutation on each question card above ↑"}
            </div>

            {/* Version generation prompt + paste panel */}
            {(pendingType === "version_all" || pendingType === "version_all_sections") && generatedPrompt && (
              <div style={{marginTop:"1rem"}}>
                <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                  📋 {pendingType === "version_all_sections"
                    ? `Copy this prompt — generates ALL ${pendingMeta?.numClassSections} sections × ${pendingMeta?.labels?.join(", ")} versions in one go:`
                    : `Copy this prompt — generates ${pendingMeta?.labels?.join(", ")} versions:`}
                </div>
                <div style={S.promptBox}>{generatedPrompt}</div>
                <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                  <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                    disabled={autoGenLoading}
                    onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                    {autoGenLoading ? "⏳ Generating..." : "⚡ Generate Versions"}
                  </button>
                  {isAdmin && (
                    <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                      Copy Prompt
                    </button>
                  )}
                </div>
                {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                <PastePanel
                  label={pendingType === "version_all_sections"
                    ? `Paste the JSON object with all section+version keys ({"S1_A":[...], "S1_B":[...], "S2_A":[...], ...}) here.`
                    : `Paste the JSON object with all versions ({"A":[...], "B":[...], ...}) here.`}
                  S={S} text2={text2}
                  pasteInput={pasteInput} setPasteInput={setPasteInput}
                  pasteError={pasteError} handlePaste={handlePaste}
                  onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                />
              </div>
            )}
          </div>
        )}
      </>)}

      {/* ── HISTORY TAB ── */}
      {bankTabState === "history" && (() => {
        const batches = [];
        const seen = new Set();
        [...bank].sort((a,b) => b.createdAt - a.createdAt).forEach(q => {
          const minute = Math.floor((q.createdAt||0) / 60000);
          const key = `${q.course}__${minute}`;
          if (!seen.has(key)) {
            seen.add(key);
            batches.push({
              key,
              course: q.course,
              minute,
              createdAt: q.createdAt,
              questions: bank.filter(bq => {
                const bMinute = Math.floor((bq.createdAt||0) / 60000);
                return bq.course === q.course && bMinute === minute;
              })
            });
          }
        });

        if (batches.length === 0) return (
          <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
            No generation history yet. Generate questions to see batches here.
          </div>
        );

        return (
          <div>
            {batches.map((batch, bi) => {
              const color = courseColors[batch.course] || accent;
              const sections = [...new Set(batch.questions.map(q => q.section).filter(Boolean))];
              const date = new Date(batch.createdAt);
              const dateStr = date.toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
              const timeStr = date.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"});
              const expanded = expandedBatches[batch.key] || false;
              const toggleExpand = () => setExpandedBatches(prev => ({...prev, [batch.key]: !prev[batch.key]}));
              return (
                <div key={batch.key} style={{...S.card, borderLeft:`3px solid ${color}`, marginBottom:"0.75rem"}}>
                  <div style={{display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem"}}>
                        <div style={{width:"8px", height:"8px", borderRadius:"50%", background:color, flexShrink:0}}/>
                        <span style={{fontSize:"0.85rem", fontWeight:"600", color:text1}}>{batch.course}</span>
                        <span style={S.tag(color)}>{batch.questions.length} questions</span>
                      </div>
                      <div style={{fontSize:"0.72rem", color:text2, marginBottom:"0.25rem"}}>
                        {dateStr} · {timeStr}
                      </div>
                      <div style={{fontSize:"0.7rem", color:text3}}>
                        {sections.slice(0,4).join(" · ")}{sections.length > 4 ? ` +${sections.length-4} more` : ""}
                      </div>
                    </div>
                    <div style={{display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap"}}>
                      <button style={S.ghostBtn(color)} onClick={() => toggleExpand()}>
                        {expanded ? "▲ Hide" : "▼ Show"} questions
                      </button>
                      <button style={S.ghostBtn(text2)}
                        onClick={() => {
                          setSelectedForExam(prev => {
                            const ids = batch.questions.map(q => q.id);
                            const allIn = ids.every(id => prev.includes(id));
                            return allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])];
                          });
                          setScreen("versions");
                        }}>
                        + Add to Exam
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div style={{marginTop:"0.75rem", borderTop:"1px solid "+border, paddingTop:"0.75rem"}}>
                      {batch.questions.map((q, qi) => (
                        <div key={q.id} style={{padding:"0.4rem 0", borderBottom: qi < batch.questions.length-1 ? "1px solid "+border+"44" : "none", display:"flex", gap:"0.5rem", alignItems:"flex-start"}}>
                          <span style={{...S.diffTag(q.difficulty), flexShrink:0, marginTop:"0.1rem"}}>{(q.difficulty||"?")[0]}</span>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontSize:"0.75rem", color:text2, marginBottom:"0.1rem"}}>{q.section}</div>
                            <div style={{fontSize:"0.82rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                              {q.type==="Branched" ? q.stem : q.question}
                            </div>
                          </div>
                          <span style={{...S.tag(), flexShrink:0}}>{(q.type||"").split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
