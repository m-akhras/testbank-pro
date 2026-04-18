"use client";
import PastePanel from "../panels/PastePanel.js";

export default function GenerateScreen({
  // Course / section data
  course,
  allCourses,   // object { name: { color, chapters } } — built-ins + custom; pass courses from useCourses as fallback
  chapters,
  bank,
  selectedSections,
  sectionCounts,
  sectionConfig,
  qType,
  totalQ,
  QTYPES,
  // Setters
  setCourse,
  setSelectedSections,
  setSectionCounts,
  setSectionConfig,
  setQType,
  toggleSection,
  toggleChapter,
  getSectionConfig,
  setSectionDiff,
  // Generate flow
  generateConfirm,
  setGenerateConfirm,
  isGenerating,
  generateError,
  triggerGenerate,
  autoGenerate,
  pendingType,
  generatedPrompt,
  pasteInput,
  setPasteInput,
  pasteError,
  handlePaste,
  // Navigation
  setScreen,
  // Permissions
  isAdmin,
  // Styles
  S,
  text2,
  text3,
  border,
  accent,
}) {
  return (
    <div>
      <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
        <div>
          <h1 style={S.h1}>Generate Questions</h1>
          <p style={S.sub}>Select a course, pick sections, and copy the prompt to Claude.</p>
        </div>
        <button style={{...S.oBtn(text2), fontSize:"0.75rem", flexShrink:0}} onClick={() => setScreen("bank")}>Browse Bank →</button>
      </div>

      {/* Course picker */}
      <div style={S.card}>
        <div style={S.lbl}>Course</div>
        <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.5rem"}}>
          {Object.entries(allCourses).map(([name, { color }]) => (
            <button key={name}
              style={S.courseChip(color, course===name)}
              onClick={() => { setCourse(name); setSelectedSections([]); setSectionCounts({}); setSectionConfig({}); }}>
              <span style={S.courseDot(color)}/>
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Section picker */}
      {course && (
        <div style={S.card}>
          <div style={S.lbl}>Sections ({selectedSections.length} selected · {totalQ} questions)</div>
          {chapters.map(chap => {
            const allSel = chap.sections.every(s => selectedSections.includes(s));
            return (
              <div key={chap.ch} style={{marginBottom:"1rem"}}>
                <button style={{...S.sBtn(allSel), marginBottom:"0.4rem", fontWeight:"bold"}} onClick={() => toggleChapter(chap)}>
                  <span style={S.chk(allSel)}>{allSel?"✓":""}</span>
                  Ch {chap.ch}: {chap.title}
                </button>
                <div style={{...S.sGrid, paddingLeft:"1rem"}}>
                  {chap.sections.map(sec => {
                    const sel = selectedSections.includes(sec);
                    return (
                      <div key={sec} style={{display:"flex", alignItems:"center", gap:"0.4rem"}}>
                        <button style={S.sBtn(sel)} onClick={() => toggleSection(sec)}>
                          <span style={S.chk(sel)}>{sel?"✓":""}</span>
                          {sec}
                        </button>
                        {(() => {
                          const existingCount = bank.filter(q => q.section === sec && q.course === course).length;
                          return existingCount > 0 && (
                            <span title={`${existingCount} questions already in bank for this section`}
                              style={{fontSize:"0.62rem", color:text3, background:"#F7F2E9", border:"1px solid "+border, borderRadius:"3px", padding:"0.05rem 0.3rem"}}>
                              {existingCount}q
                            </span>
                          );
                        })()}
                        {sel && (() => {
                          const cfg = getSectionConfig(sec);
                          const diffColors = { Easy:"#10b981", Medium:"#f59e0b", Hard:"#f43f5e" };
                          const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
                          const types = isQM ? ["normal","table","graph","mix"] : ["normal","graph","mix"];
                          const typeLabels = { normal:"Text", table:"Table", graph:"Graph", mix:"Mix" };
                          const typeColors = { normal: border, table:"#185FA5", graph:"#1D9E75", mix:"#8b5cf6" };
                          return (
                            <div style={{marginTop:"0.4rem", paddingLeft:"0.75rem", borderLeft:"2px solid #334155"}}>
                              {["Easy","Medium","Hard"].map(d => {
                                const typeCounts = cfg[d].typeCounts || {};
                                const total = types.reduce((s, t) => s + (typeCounts[t]||0), 0);
                                return (
                                  <div key={d} style={{marginBottom:"0.5rem"}}>
                                    <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.25rem"}}>
                                      <span style={{fontSize:"0.68rem", color:diffColors[d], fontWeight:"600", minWidth:"46px"}}>{d}</span>
                                      <span style={{fontSize:"0.68rem", color:text2, background:"#F7F2E9", border:"1px solid "+border, borderRadius:"4px", padding:"0.1rem 0.5rem", minWidth:"28px", textAlign:"center"}}>
                                        {total}
                                      </span>
                                      <span style={{fontSize:"0.6rem", color:text3}}>total</span>
                                    </div>
                                    <div style={{display:"flex", gap:"0.4rem", flexWrap:"wrap", alignItems:"flex-start", paddingLeft:"54px"}}>
                                      {types.map(t => {
                                        const count = typeCounts[t] || 0;
                                        const isTable = t === "table" || t === "mix";
                                        return (
                                          <div key={t} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"0.15rem"}}>
                                            <span style={{fontSize:"0.6rem", color: count > 0 ? typeColors[t] : text3, fontWeight: count>0?"600":"400"}}>{typeLabels[t]}</span>
                                            <input type="number" min={0} max={20} value={count}
                                              onChange={e => {
                                                const newVal = Math.max(0, Number(e.target.value)||0);
                                                const newTypeCounts = { ...typeCounts, [t]: newVal };
                                                const newTotal = types.reduce((s,tt) => s + (newTypeCounts[tt]||0), 0);
                                                const dominant = types.reduce((a,b) => (newTypeCounts[b]||0) > (newTypeCounts[a]||0) ? b : a, "normal");
                                                setSectionDiff(sec, d, { typeCounts: newTypeCounts, count: newTotal, graphType: dominant });
                                              }}
                                              style={{width:"36px", ...S.input, padding:"0.1rem 0.25rem", fontSize:"0.75rem", textAlign:"center",
                                                borderColor: count > 0 ? typeColors[t]+"88" : border}} />
                                            {isTable && count > 0 && (
                                              <div style={{display:"flex", flexDirection:"column", gap:"0.1rem", alignItems:"center"}}>
                                                <div style={{display:"flex", alignItems:"center", gap:"0.15rem"}}>
                                                  <span style={{fontSize:"0.55rem", color:text3}}>rows</span>
                                                  <input type="number" min={2} max={20} value={cfg[d].tableRows||4}
                                                    onChange={e => setSectionDiff(sec, d, "tableRows", Math.max(2, Math.min(20, Number(e.target.value)||4)))}
                                                    style={{width:"30px", ...S.input, padding:"0.1rem 0.2rem", fontSize:"0.62rem", textAlign:"center"}} />
                                                </div>
                                                <div style={{display:"flex", alignItems:"center", gap:"0.15rem"}}>
                                                  <span style={{fontSize:"0.55rem", color:text3}}>cols</span>
                                                  <input type="number" min={2} max={8} value={cfg[d].tableCols||2}
                                                    onChange={e => setSectionDiff(sec, d, "tableCols", Math.max(2, Math.min(8, Number(e.target.value)||2)))}
                                                    style={{width:"30px", ...S.input, padding:"0.1rem 0.2rem", fontSize:"0.62rem", textAlign:"center"}} />
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Question Type */}
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.lbl}>Question Type</label>
          <select style={S.sel} value={qType} onChange={e => setQType(e.target.value)}>
            {QTYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Generate buttons */}
      <div style={{display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"center"}}>
        {generateConfirm ? (
          <div style={{display:"flex", alignItems:"center", gap:"0.75rem", background:"#FDFAF5",
            border:"1px solid "+border, borderRadius:"8px", padding:"0.6rem 1rem"}}>
            <span style={{fontSize:"0.85rem", color:"#1C1A16"}}>
              Generate {selectedSections.reduce((a,s) => a+(sectionCounts[s]||3), 0)} questions?
            </span>
            {(() => {
              const qCount = selectedSections.reduce((a,s) => a+(sectionCounts[s]||3), 0);
              const estTokens = Math.round(qCount * 350 + 1200);
              const estCost = (estTokens / 1000000 * 15).toFixed(3);
              return (
                <span style={{fontSize:"0.72rem", color:text3}}>
                  ~{estTokens.toLocaleString()} tokens · ~${estCost}
                </span>
              );
            })()}
            <button style={S.btn(accent, false)} onClick={async () => {
              setGenerateConfirm(false);
              triggerGenerate();
              const { buildGeneratePrompt } = await import("../../lib/prompts/index.js");
              const prompt = buildGeneratePrompt(course, selectedSections, sectionCounts, qType, "Mixed", sectionConfig);
              await autoGenerate(prompt, (result) => {
                setPasteInput(result);
                setTimeout(() => { document.getElementById("auto-paste-trigger")?.click(); }, 100);
              });
            }}>Yes</button>
            <button style={S.oBtn(text2)} onClick={() => setGenerateConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <>
            <button
              style={S.btn(accent, !course || selectedSections.length === 0 || isGenerating)}
              disabled={!course || selectedSections.length === 0 || isGenerating}
              onClick={() => setGenerateConfirm(true)}>
              {isGenerating ? "⏳ Generating..." : "✦ Generate Questions"}
            </button>
            <button
              style={{...S.oBtn(text2), fontSize:"0.75rem"}}
              disabled={!course || selectedSections.length === 0}
              onClick={triggerGenerate}>
              Manual (copy-paste)
            </button>
          </>
        )}
      </div>

      {generateError && (
        <div style={{color:"#f87171", fontSize:"0.78rem", marginTop:"0.5rem"}}>{generateError}</div>
      )}

      {pendingType === "generate" && generatedPrompt && (
        <>
          <hr style={S.divider} />
          <div style={{fontSize:"0.78rem", color:accent, fontWeight:"bold", marginBottom:"0.5rem"}}>📋 Manual mode — copy prompt and paste response:</div>
          <div style={S.promptBox}>{generatedPrompt}</div>
          {isAdmin && (
            <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
              Copy Prompt
            </button>
          )}
          <button id="auto-paste-trigger" style={{display:"none"}} onClick={handlePaste} />
          <PastePanel
            label="Paste the JSON array from Claude's response below."
            S={S} text2={text2}
            pasteInput={pasteInput} setPasteInput={setPasteInput}
            pasteError={pasteError} handlePaste={handlePaste}
            onCancel={() => { /* parent clears pendingType and generatedPrompt via setters */ }}
          />
        </>
      )}
    </div>
  );
}
