"use client";
import { useState } from "react";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";
import InlineEditor from "../editors/InlineEditor.js";
import PastePanel from "../panels/PastePanel.js";
import { buildQTI, buildQTIZip, buildClassroomSectionsQTI, buildQTICompare, buildQTIAllSectionsMerged, validateQTIExport } from "../../lib/exports/qti.js";
import { buildAnswerKey, buildDocx, buildDocxCompare } from "../../lib/exports/docx.js";
import { dlBlob } from "../../lib/exports/utils.js";
import { buildAllVersionsPrompt, buildAllSectionsPrompt } from "../../lib/prompts/index.js";
import { saveExam } from "../../lib/db/exams.js";
import { logExport } from "../../lib/db/exportHistory.js";
import { S, bg1, bg2, border, text1, text2, text3 } from "../../styles/theme.js";

const VERSIONS = ["A","B","C","D","E","F","G","H"];

export default function VersionsScreen({
  versions, setVersions,
  classSectionVersions, setClassSectionVersions,
  activeClassSection, setActiveClassSection,
  activeVersion, setActiveVersion,
  selectedForExam, setSelectedForExam,
  masterLocked, setMasterLocked,
  mastersLoading, savedMasters,
  masterName, setMasterName,
  savingMaster,
  loadSavedMasters, loadMaster, deleteSavedMaster, saveMaster,
  versionCount, setVersionCount,
  numClassSections, setNumClassSections,
  versionMutationType, setVersionMutationType,
  mutationType,
  generatedPrompt, setGeneratedPrompt,
  pendingType, setPendingType,
  pendingMeta, setPendingMeta,
  pasteInput, setPasteInput,
  pasteError, setPasteError,
  autoGenLoading,
  autoGenError,
  autoGenerateVersions,
  exportLoading, setExportLoading,
  examSaved, setExamSaved,
  saveExamName, setSaveExamName,
  savingExam, setSavingExam,
  versionsViewMode, setVersionsViewMode,
  exportHighlight,
  inlineEditQId, setInlineEditQId,
  validating, validationError, validationResults, setValidationResults,
  qtiUseGroups, setQtiUseGroups,
  qtiPointsPerQ, setQtiPointsPerQ,
  qtiExamName, setQtiExamName,
  compareSection, setCompareSection,
  printGraphCache,
  bank,
  course,
  courseObject,
  isAdmin,
  accent,
  courseColors,
  handlePaste,
  sectionSortKey,
  validateQuestion,
  autoValidateAllVersions,
  copyValidationPrompt,
  triggerReplace,
  triggerReplaceAuto,
  showToast,
  setScreen,
  setShowPrintPreview,
}) {
  const [pointsInput, setPointsInput] = useState(String(qtiPointsPerQ));
  const [showValidationPaste, setShowValidationPaste] = useState(false);
  const [validationPasteInput, setValidationPasteInput] = useState("");
  const [validationPasteError, setValidationPasteError] = useState("");
  return (
<div>
  <div style={S.pageHeader}>
    <h1 style={S.h1}>Exam Builder</h1>
    <p style={S.sub}>{versions.length} version{versions.length !== 1 ? "s" : ""} created{Object.keys(classSectionVersions).length > 1 ? ` Â· ${Object.keys(classSectionVersions).length} classroom sections` : ""}.</p>
  </div>

  {/* Classroom section tabs */}
  {Object.keys(classSectionVersions).length > 1 && (
    <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
      <span style={{fontSize:"0.72rem", color:text2}}>Classroom Section:</span>
      {Object.keys(classSectionVersions).sort().map(sec => (
        <button key={sec}
          style={S.vTab(activeClassSection===Number(sec), Number(sec)===1?"#10b981":"#8b5cf6")}
          onClick={() => { setActiveClassSection(Number(sec)); setVersions(classSectionVersions[sec]); setActiveVersion(0); }}>
          Section {sec}
        </button>
      ))}
    </div>
  )}

  {versions.length === 0 && selectedForExam.length === 0 && (
    <>
      <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
        <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>ðŸ“‹</div>
        <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>No exam built yet</div>
        <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
          Select questions from the bank, then click Build Exam here to create multiple versions.
        </div>
        <div style={{display:"flex", gap:"0.75rem", justifyContent:"center", flexWrap:"wrap"}}>
          <button style={S.btn(accent, false)} onClick={() => setScreen("bank")}>â–¦ Browse Question Bank</button>
          <button style={S.oBtn(text2)} onClick={() => setScreen("generate")}>âœ¦ Generate Questions</button>
        </div>
      </div>

      {/* â”€â”€ Saved Masters â”€â”€ */}
      {(mastersLoading || savedMasters.length > 0) && (
        <div style={{...S.card, marginTop:"1rem"}}>
          <div style={{fontSize:"0.82rem", fontWeight:"700", color:text1, marginBottom:"0.75rem", display:"flex", alignItems:"center", gap:"0.5rem"}}>
            ðŸ’¾ Saved Masters
            <button onClick={loadSavedMasters} style={{...S.smBtn, marginLeft:"auto", fontSize:"0.68rem"}}>â†» Refresh</button>
          </div>
          {mastersLoading && <div style={{fontSize:"0.78rem", color:text3, textAlign:"center", padding:"1rem"}}>Loadingâ€¦</div>}
          {!mastersLoading && savedMasters.map(m => (
            <div key={m.id} style={{display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.6rem 0", borderBottom:"1px solid "+border+"44", flexWrap:"wrap"}}>
              <div style={{flex:1, minWidth:"150px"}}>
                <div style={{fontSize:"0.85rem", fontWeight:"600", color:text1}}>{m.name}</div>
                <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.15rem"}}>
                  {new Date(m.created_at).toLocaleDateString()} Â· {(m.master_questions||[]).length} questions
                  {m.settings?.course ? ` Â· ${m.settings.course}` : ""}
                  {m.settings?.versionCount ? ` Â· ${m.settings.versionCount} variants` : ""}
                </div>
              </div>
              <button
                style={{...S.btn("#10b981", false), fontSize:"0.78rem", padding:"0.3rem 0.8rem"}}
                onClick={() => loadMaster(m)}>
                â–¶ Load
              </button>
              <button
                style={{...S.ghostBtn("#f87171"), fontSize:"0.78rem", padding:"0.3rem 0.7rem"}}
                onClick={() => deleteSavedMaster(m.id)}>
                ðŸ—‘
              </button>
            </div>
          ))}
          {!mastersLoading && savedMasters.length === 0 && (
            <div style={{fontSize:"0.78rem", color:text3, textAlign:"center", padding:"0.75rem"}}>No saved masters yet.</div>
          )}
        </div>
      )}
    </>
  )}

  {/* â”€â”€ STAGE 1: Questions selected, ready to create master â”€â”€ */}
  {selectedForExam.length > 0 && (() => {
    const selected = bank
      .filter(q => selectedForExam.includes(q.id))
      .sort((a,b) => {
        const [aMaj, aMin] = sectionSortKey(a.section);
        const [bMaj, bMin] = sectionSortKey(b.section);
        return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
      });
    return (
      <div>
        <div style={{...S.card, borderColor:accent+"44", marginBottom:"1rem"}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem", flexWrap:"wrap", gap:"0.5rem"}}>
            <div>
              <div style={{fontSize:"0.95rem", fontWeight:"600", color:text1, marginBottom:"0.2rem"}}>
                {selected.length} questions selected
              </div>
              <div style={{fontSize:"0.72rem", color:text2}}>
                {[...new Set(selected.map(q => q.course))].join(", ")} Â· {[...new Set(selected.map(q => q.section))].length} sections
              </div>
            </div>
            <button style={S.ghostBtn("#f87171")} onClick={() => setSelectedForExam([])}>
              âœ• Clear selection
            </button>
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:"0.3rem", marginBottom:"1rem"}}>
            {selected.map((q,i) => (
              <div key={q.id} style={{display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.35rem 0", borderBottom: i < selected.length-1 ? "1px solid "+border+"44" : "none"}}>
                <span style={S.diffTag(q.difficulty||"")}>{(q.difficulty||"?")[0]}</span>
                <span style={{...S.tag(courseColors[q.course]), flexShrink:0}}>{(q.section||"").split(" ").slice(0,2).join(" ")}</span>
                <span style={{fontSize:"0.8rem", color:text2, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                  {q.type==="Branched" ? q.stem : q.question}
                </span>
                <button style={{...S.smBtn, color:"#f87171", border:"none", padding:"0.1rem 0.3rem"}}
                  onClick={() => setSelectedForExam(p => p.filter(id => id !== q.id))}>âœ•</button>
              </div>
            ))}
          </div>
          <button
            style={{...S.btn("#10b981", false), fontSize:"0.88rem", padding:"0.55rem 1.4rem"}}
            onClick={() => {
              setVersions([{ label: "A", questions: selected }]);
              setActiveVersion(0);
              setMasterLocked(false);
            }}>
            â† Create Master Exam (Version A)
          </button>
        </div>
      </div>
    );
  })()}

  {/* â”€â”€ STAGE 2: Master Version A created â€” proof and verify â”€â”€ */}
  {versions.length === 1 && !masterLocked && (() => {
    const v = versions[0];
    return (
      <div>
        <div style={{background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"8px", padding:"0.75rem 1rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap"}}>
          <span style={{fontSize:"1.1rem"}}>âš ï¸</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.82rem", fontWeight:"600", color:"#f59e0b"}}>Export and proof your master exam before generating variants</div>
            <div style={{fontSize:"0.72rem", color:text3, marginTop:"0.2rem"}}>Edit any question below, then click â€œMaster Verifiedâ€ when youâ€™re satisfied with Version A.</div>
          </div>
        </div>
        <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
          <button style={S.btn("#10b981", exportLoading !== "")} disabled={exportLoading !== ""} onClick={async () => {
            setExportLoading("Building Word document...");
            try {
              const blob = await buildDocx(v.questions, v.questions[0]?.course||"Calculus", v.label, null);
              dlBlob(blob, `Version_A_Master_Exam.docx`);
            } finally { setExportLoading(""); }
          }}>â¬‡ Word (.docx)</button>
          <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
            ðŸ‘ Print Preview
          </button>
          <button style={S.oBtn("#f43f5e")} disabled={exportLoading !== ""} onClick={async () => {
            setExportLoading("Building answer key...");
            try {
              const blob = await buildAnswerKey([v], v.questions[0]?.course || "Exam");
              if (blob) dlBlob(blob, `Version_A_Answer_Key.docx`);
            } finally { setExportLoading(""); }
          }}>ðŸ”‘ Answer Key (.docx)</button>
          <button style={S.oBtn("#8b5cf6")} onClick={async () => {
            const xml = buildQTI(v.questions, v.questions[0]?.course||"Exam", v.label, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
            const blob = await buildQTIZip(xml, `Version_A`);
            dlBlob(blob, `Version_A_Canvas_QTI.zip`);
          }}>â¬‡ QTI (.zip)</button>
          {exportLoading && <span style={{fontSize:"0.75rem", color:text3, alignSelf:"center"}}>â³ {exportLoading}</span>}
        </div>
        {v.questions.map((q,qi) => (
          <div key={q.id||qi} style={S.qCard}>
            <div style={S.qMeta}>
              <span style={{fontWeight:"bold", color:text1}}>Q{qi+1}</span>
              <span style={S.tag("#f43f5e")}>{q.type}</span>
              <span style={S.tag()}>{q.section}</span>
              <span style={S.tag()}>{q.difficulty}</span>
              <div style={{marginLeft:"auto", display:"flex", gap:"0.3rem"}}>
                <button style={{...S.smBtn, color: inlineEditQId===`master_${qi}` ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                  onClick={() => setInlineEditQId(inlineEditQId===`master_${qi}` ? null : `master_${qi}`)}>
                  âœï¸
                </button>
              </div>
            </div>
            {inlineEditQId === `master_${qi}` && (
              <InlineEditor
                q={q}
                onSave={(updated) => {
                  setVersions([{ ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }]);
                  setInlineEditQId(null);
                  showToast("Question updated âœ“");
                }}
                onClose={() => setInlineEditQId(null)}
              />
            )}
            {q.type==="Branched" ? (
              <>
                <div style={{...S.qText,color:"#f43f5e99"}}>Given: <MathText>{q.stem}</MathText></div>
                {(q.parts||[]).map((p,pi) => (
                  <div key={pi} style={{marginBottom:"0.6rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                    <div style={{fontSize:"0.7rem",color:text3,marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                    <div style={S.qText}><MathText>{p.question}</MathText></div>
                    {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                    {p.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{p.explanation}</MathText></div>}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={S.qText}><MathText>{q.question}</MathText></div>
                {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                {q.answer&&<div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                {q.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{q.explanation}</MathText></div>}
              </>
            )}
          </div>
        ))}
        <div style={{marginTop:"1.5rem", padding:"1rem", background:"#052e1688", borderRadius:"8px", border:"1px solid #22c55e44", display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.85rem", fontWeight:"600", color:"#4ade80"}}>Ready to generate variants?</div>
            <div style={{fontSize:"0.72rem", color:text3, marginTop:"0.2rem"}}>This will lock Version A and let you configure B, C, D variants.</div>
          </div>
          <button
            style={{...S.btn("#10b981", false), fontSize:"0.88rem", padding:"0.55rem 1.4rem"}}
            onClick={() => setMasterLocked(true)}>
            âœ… Master Verified â€” Generate Variants
          </button>
        </div>

        {/* â”€â”€ Save Master â”€â”€ */}
        <div style={{marginTop:"0.75rem", padding:"0.85rem 1rem", background:bg2, borderRadius:"8px", border:"1px solid "+border, display:"flex", alignItems:"center", gap:"0.6rem", flexWrap:"wrap"}}>
          <span style={{fontSize:"0.75rem", color:text2, fontWeight:"600", whiteSpace:"nowrap"}}>ðŸ’¾ Save Master</span>
          <input
            value={masterName}
            onChange={e => setMasterName(e.target.value)}
            placeholder="Master name (e.g. Quiz 02 MAT116)"
            onKeyDown={e => e.key === "Enter" && saveMaster()}
            style={{flex:1, minWidth:"200px", padding:"0.35rem 0.6rem", background:bg1, border:"1px solid "+border, color:text1, borderRadius:"6px", fontSize:"0.82rem", fontFamily:"inherit"}} />
          <button
            onClick={saveMaster}
            disabled={savingMaster}
            style={{...S.btn("#4f46e5", savingMaster), fontSize:"0.8rem", padding:"0.35rem 0.9rem", opacity: savingMaster ? 0.6 : 1}}>
            {savingMaster ? "Savingâ€¦" : "ðŸ’¾ Save Master"}
          </button>
        </div>
      </div>
    );
  })()}

  {/* â”€â”€ STAGE 3: Master verified â€” configure variants â”€â”€ */}
  {versions.length === 1 && masterLocked && (
    <div>
      <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1rem"}}>
        <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"700", marginBottom:"0.75rem"}}>
          âœ… Version A locked Â· Now configure variants (B, C, Dâ€¦)
        </div>
        <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-end"}}>
          <div>
            <div style={S.lbl}>Variants to generate</div>
            <select style={{...S.sel, width:"160px"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
              {[1,2,3,4,5,6,7].map(n => {
                const lbls = VERSIONS.slice(1, 1+n);
                return <option key={n} value={n}>{n} variant{n>1?"s":""} ({lbls.join(", ")})</option>;
              })}
            </select>
          </div>
          <div>
            <div style={S.lbl}>Classroom sections</div>
            <input type="number" min={1} max={10} value={numClassSections}
              style={{...S.input, width:"80px"}}
              onChange={e => setNumClassSections(Math.max(1, Number(e.target.value)||1))} />
          </div>
          <button style={S.btn(accent, false)} onClick={() => {
            // Stage 3: always use Version A questions directly â€” never re-query bank
            const masterQs = versions[0].questions;
            console.log("Stage3 triggerVariants masterQs", masterQs.map(q => ({id:q.id, hasGraph:q.hasGraph, hasGC:!!q.graphConfig})));
            const varLabels = VERSIONS.slice(1, 1 + versionCount);
            if (numClassSections > 1) {
              const prompt = buildAllSectionsPrompt(masterQs, varLabels, numClassSections, course, versionMutationType, courseObject);
              setGeneratedPrompt(prompt);
              setPendingType("version_all_sections");
              setPendingMeta({ selected: masterQs, labels: varLabels, numClassSections, versionMutationType });
            } else {
              const prompt = buildAllVersionsPrompt(masterQs, mutationType, varLabels, 1, 1, course, versionMutationType, courseObject);
              setGeneratedPrompt(prompt);
              setPendingType("version_all");
              setPendingMeta({ selected: masterQs, labels: varLabels, mutationType, classSection: 1, versionMutationType });
            }
            setPasteInput(""); setPasteError("");
          }}>
            â† {numClassSections > 1 ? `Generate All ${numClassSections} Sections` : "Generate Variants"}
          </button>
        </div>
        <div style={{marginTop:"0.75rem"}}>
          <div style={S.lbl}>Mutation type per version</div>
          <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.3rem"}}>
            {VERSIONS.slice(1, 1 + versionCount).map(lbl => {
              const mut = versionMutationType[lbl] || "numbers";
              return (
                <div key={lbl} style={{display:"flex", alignItems:"center", gap:"0.3rem"}}>
                  <span style={{fontSize:"0.72rem", color:text1, fontWeight:"600"}}>Ver {lbl}:</span>
                  <button
                    style={{...S.smBtn, background: mut==="numbers" ? accent+"22" : "transparent", color: mut==="numbers" ? accent : text2, border:"1px solid "+(mut==="numbers" ? accent+"66" : border)}}
                    onClick={() => setVersionMutationType(p => ({...p, [lbl]: "numbers"}))}>
                    numbers
                  </button>
                  <button
                    style={{...S.smBtn, background: mut==="function" ? "#8b5cf622" : "transparent", color: mut==="function" ? "#8b5cf6" : text2, border:"1px solid "+(mut==="function" ? "#8b5cf666" : border)}}
                    onClick={() => setVersionMutationType(p => ({...p, [lbl]: "function"}))}>
                    function
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {pendingType === "version_all" && generatedPrompt && (
        <>
          <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
            ðŸ“‹ Copy this prompt â€” paste to Claude â€” paste response back:
          </div>
          <div style={S.promptBox}>{generatedPrompt}</div>
          {(() => {
            const numQ = pendingMeta?.selected?.length || 0;
            const numV = pendingMeta?.labels?.length || 0;
            const ncs = pendingMeta?.numClassSections || 1;
            const totalVersions = numV * ncs;
            const cost = (numQ * totalVersions * 400 * 3 / 1_000_000) + (numQ * totalVersions * 350 * 15 / 1_000_000);
            const label = ncs > 1 ? `${numQ} questions Ã— ${numV} versions Ã— ${ncs} sections` : `${numQ} questions Ã— ${numV} versions`;
            return <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.5rem"}}>Estimated cost: ~${cost.toFixed(3)} ({label})</div>;
          })()}
          <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
            <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
              disabled={autoGenLoading}
              onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
              {autoGenLoading ? "â³ Generating..." : "âš¡ Generate Variants"}
            </button>
            {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
          </div>
          {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
          <button id="auto-submit-paste" style={{display:"none"}} onClick={handlePaste} />
          <PastePanel
            label="Paste Claude's JSON response here."
            S={S} text2={text2}
            pasteInput={pasteInput} setPasteInput={setPasteInput}
            pasteError={pasteError} handlePaste={handlePaste}
            onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
          />
        </>
      )}
      {pendingType === "version_all_sections" && generatedPrompt && (
        <>
          <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
            ðŸ“‹ Copy this prompt â€” generates ALL {pendingMeta?.numClassSections} sections Ã— {pendingMeta?.labels?.join(", ")} versions in one go:
          </div>
          <div style={S.promptBox}>{generatedPrompt}</div>
          {(() => {
            const numQ = pendingMeta?.selected?.length || 0;
            const numV = pendingMeta?.labels?.length || 0;
            const ncs = pendingMeta?.numClassSections || 1;
            const totalVersions = numV * ncs;
            const cost = (numQ * totalVersions * 400 * 3 / 1_000_000) + (numQ * totalVersions * 350 * 15 / 1_000_000);
            const label = ncs > 1 ? `${numQ} questions Ã— ${numV} versions Ã— ${ncs} sections` : `${numQ} questions Ã— ${numV} versions`;
            return <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.5rem"}}>Estimated cost: ~${cost.toFixed(3)} ({label})</div>;
          })()}
          <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
            <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
              disabled={autoGenLoading}
              onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
              {autoGenLoading ? "â³ Generating..." : "âš¡ Generate Variants"}
            </button>
            {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
          </div>
          {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
          <button id="auto-submit-paste" style={{display:"none"}} onClick={handlePaste} />
          <PastePanel
            label="Paste the combined JSON response (all sections + versions)."
            S={S} text2={text2}
            pasteInput={pasteInput} setPasteInput={setPasteInput}
            pasteError={pasteError} handlePaste={handlePaste}
            onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
          />
        </>
      )}
    </div>
  )}

  {/* â”€â”€ STAGE 4: Variants generated â€” full export and compare flow â”€â”€ */}
  {versions.length > 1 && (
    <>
      {/* Save to DB */}
      {!examSaved && (
        <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"bold", marginBottom:"0.5rem"}}>ðŸ’¾ Save this exam to database</div>
          <div style={{display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap"}}>
            <input
              style={{...S.input, maxWidth:"300px"}}
              placeholder="Exam name (e.g. Calculus 1 Midterm)"
              value={saveExamName}
              onChange={e => setSaveExamName(e.target.value)}
            />
            <button
              style={S.btn("#10b981", !saveExamName.trim() || savingExam)}
              disabled={!saveExamName.trim() || savingExam}
              onClick={async () => {
                setSavingExam(true);
                // Save all sections â€” if multi-section, flatten all versions; otherwise just current versions
                const allVersions = Object.keys(classSectionVersions).length > 1
                  ? Object.values(classSectionVersions).flat()
                  : versions;
                const result = await saveExam(saveExamName.trim(), allVersions);
                if (result) setExamSaved(true);
                setSavingExam(false);
              }}
            >
              {savingExam ? "Savingâ€¦" : "Save Exam"}
            </button>
          </div>
        </div>
      )}
      {examSaved && (
        <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem", color:"#10b981"}}>
          âœ… Exam saved! View it in the Saved Exams tab.
        </div>
      )}

      {/* View mode toggle */}
      <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
        <span style={{fontSize:"0.72rem", color:text2, marginRight:"0.25rem"}}>View:</span>
        <button style={S.vTab(versionsViewMode==="single","#f43f5e")} onClick={() => setVersionsViewMode("single")}>
          ðŸ“„ Single Version
        </button>
        <button style={S.vTab(versionsViewMode==="compare","#8b5cf6")} onClick={() => setVersionsViewMode("compare")}>
          ðŸ“‹ Canvas Versions
        </button>
      </div>

      {/* â”€â”€ SINGLE VERSION MODE â”€â”€ */}
      {versionsViewMode === "single" && (() => {
        const v = versions[activeVersion];
        return (
          <>
            {/* Version tabs */}
            <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
              {versions.map((ver,i) => (
                <button key={ver.label} style={S.vTab(activeVersion===i,"#f43f5e")} onClick={() => setActiveVersion(i)}>
                  Version {ver.label} <span style={{fontSize:"0.68rem", opacity:0.7, marginLeft:"0.3rem"}}>({ver.questions.length}q)</span>
                </button>
              ))}
            </div>


            {(() => {
              const allIssues = v.questions.flatMap((q,qi) => {
                const issues = validateQuestion(q);
                return issues.map(issue => `Q${qi+1}: ${issue}`);
              });
              return allIssues.length > 0 ? (
                <div style={{background:"#7c2d1222", border:"1px solid #f8717144", borderRadius:"6px",
                  padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.75rem", color:"#9B1C1C"}}>
                  <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>âš ï¸ {allIssues.length} issue{allIssues.length>1?"s":""} found in this version</div>
                  {allIssues.map((issue,i) => <div key={i} style={{opacity:0.85}}>â€¢ {issue}</div>)}
                </div>
              ) : null;
            })()}
            <div id="export-panel" ref={el => { if (el && exportHighlight) el.scrollIntoView({behavior:"smooth", block:"start"}); }}
              style={{transition:"outline 0.3s", outline: exportHighlight ? "2px solid #185FA555" : "none", borderRadius:"8px", padding: exportHighlight ? "0.5rem" : "0"}}>
            <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
              <button style={S.btn("#10b981", exportLoading !== "")} disabled={exportLoading !== ""} onClick={async () => {
                setExportLoading("Building Word document...");
                try {
                  const cs = v.questions[0]?.classSection || null;
                  const blob = await buildDocx(v.questions,v.questions[0]?.course||"Calculus",v.label,cs);
                  const secStr = cs ? `_S${cs}` : "";
                  dlBlob(blob,`Version_${v.label}${secStr}_Exam.docx`);
                  if (examSaved && saveExamName) await logExport(saveExamName, "Word", v.label);
                } finally { setExportLoading(""); }
              }}>â¬‡ Word (.docx)</button>
              <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
                ðŸ‘ Print Preview
              </button>
              {Object.keys(classSectionVersions).length > 1 && (
                <button style={S.oBtn("#8b5cf6")} disabled={exportLoading !== ""} onClick={async () => {
                  setExportLoading("Building all sections Word...");
                  try {
                    for(const [sec, secVers] of Object.entries(classSectionVersions)){
                      for(const ver of secVers){
                        const blob=await buildDocx(ver.questions,ver.questions[0]?.course||"Calculus",ver.label,Number(sec));
                        dlBlob(blob,`S${sec}_Version_${ver.label}_Exam.docx`);
                      }
                    }
                  } finally { setExportLoading(""); }
                }}>â¬‡ All Sections Word</button>
              )}
              <button style={S.oBtn("#f43f5e")} disabled={exportLoading !== ""} onClick={async () => {
                setExportLoading("Building answer key...");
                try {
                  const allVers = Object.keys(classSectionVersions).length > 1
                    ? Object.values(classSectionVersions).flat()
                    : versions;
                  const course = allVers[0]?.questions[0]?.course || "Exam";
                  const blob = await buildAnswerKey(allVers, course);
                  if (blob) dlBlob(blob, `${course.replace(/\s+/g,"_")}_Answer_Key.docx`);
                } finally { setExportLoading(""); }
              }}>ðŸ”‘ Answer Key (.docx)</button>
              {isAdmin && (
                <button style={S.btn("#7c3aed", validating)} disabled={validating} onClick={autoValidateAllVersions}>
                  {validating ? "â³ Validating..." : "âœ… Auto Validate"}
                </button>
              )}
              {isAdmin && (
                <>
                  <button style={S.oBtn(“#7c3aed”)} onClick={() => { copyValidationPrompt(); }}>
                    ðŸ”‹ Copy Validation Prompt
                  </button>
                  <button style={S.oBtn(“#7c3aed”)} onClick={() => { setValidationPasteInput(“”); setValidationPasteError(“”); setShowValidationPaste(true); }}>
                    ðŸ”¥ Paste Validation Result
                  </button>
                </>
              )}
            </div>
            {isAdmin && validationError && (
              <div style={{background:"#1a0a0a", border:"1px solid #7f1d1d", borderRadius:"6px", padding:"0.5rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.78rem", color:"#f87171"}}>
                âš ï¸ {validationError}
              </div>
            )}
            {isAdmin && Object.keys(validationResults).length > 0 && (() => {
              const issues = Object.entries(validationResults).filter(([,r]) => !r.valid);
              return (
                <div style={{background: issues.length === 0 ? "#052e16" : "#1c1002", border:`1px solid ${issues.length === 0 ? "#14532d" : "#f59e0b44"}`, borderRadius:"6px", padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.78rem", color: issues.length === 0 ? "#4ade80" : "#f59e0b"}}>
                  {issues.length === 0
                    ? "âœ… All questions verified â€” no issues found."
                    : <>
                        <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>âš ï¸ {issues.length} issue{issues.length>1?"s":""} found</div>
                        {issues.map(([id, r]) => (
                          <div key={id} style={{marginBottom:"0.25rem", opacity:0.9}}>
                            â€¢ <strong>Q{id}:</strong> {r.reason}{r.corrected_answer ? ` â†’ Correct: ${r.corrected_answer}` : ""}
                          </div>
                        ))}
                      </>
                  }
                </div>
              );
            })()}

            {/* Canvas QTI Export Panel */}
            {Object.keys(classSectionVersions).length > 1 ? (
              <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas QTI Export â€” Classroom Sections</div>
                <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                  <span style={{fontSize:"0.72rem", color:text2, flexShrink:0}}>Quiz name in Canvas:</span>
                  <input
                    placeholder={`e.g. Midterm MAT221`}
                    value={qtiExamName}
                    onChange={e => setQtiExamName(e.target.value)}
                    style={{...S.input, flex:1, maxWidth:"280px", padding:"0.3rem 0.6rem", fontSize:"0.78rem"}}
                  />
                </div>
                <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.75rem"}}>
                  <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                    <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                      style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                    Group by question number
                  </label>
                  <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                    Points per question:
                    <input type="number" min={0.25} max={100} step={0.25} value={pointsInput}
                      onChange={e => setPointsInput(e.target.value)}
                      onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.25) { setQtiPointsPerQ(v); setPointsInput(String(v)); } else { setPointsInput(String(qtiPointsPerQ)); } }}
                      style={{width:"60px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                  </label>
                </div>
                <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.75rem"}}>
                  {qtiUseGroups
                    ? "Grouped: one question group per question number â€” Canvas randomly picks 1 version per student."
                    : "Flat: all question versions listed sequentially â€” no Canvas grouping."}
                </div>
                <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                  {(() => {
                    const allVers = Object.values(classSectionVersions).flat();
                    const warnings = validateQTIExport(allVers);
                    return warnings.length > 0 && (
                      <div style={{width:"100%", fontSize:"0.7rem", color:"#f59e0b", background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.35rem 0.6rem", marginBottom:"0.35rem"}}>
                        âš  {warnings.length} issue{warnings.length>1?"s":""} detected before export: {warnings.slice(0,2).join(" Â· ")}{warnings.length>2?` +${warnings.length-2} more`:""}
                      </div>
                    );
                  })()}
                  {Object.keys(classSectionVersions).sort((a,b)=>Number(a)-Number(b)).map(sec => (
                    <button key={sec} style={S.btn("#8b5cf6", false)} onClick={async () => {
                      const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                      const blobs = await buildClassroomSectionsQTI(
                        {[sec]: classSectionVersions[sec]},
                        examTitle, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1
                      );
                      const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g,"_");
                      dlBlob(blobs[sec], `${safeName}_S${sec}_QTI.zip`);
                    }}>â¬‡ Section {sec} QTI (.zip)</button>
                  ))}
                  <button style={S.btn("#10b981", false)} onClick={async () => {
                    const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                    const blobs = await buildClassroomSectionsQTI(
                      classSectionVersions, examTitle, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1
                    );
                    const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g,"_");
                    for(const [sec, blob] of Object.entries(blobs)){
                      dlBlob(blob, `${safeName}_S${sec}_QTI.zip`);
                    }
                  }}>â¬‡ All Sections QTI (.zip)</button>
                </div>
              </div>
            ) : (
              <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas QTI Export</div>
                <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.75rem"}}>
                  <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                    <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                      style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                    Group by question number
                  </label>
                  <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                    Points per question:
                    <input type="number" min={0.25} max={100} step={0.25} value={pointsInput}
                      onChange={e => setPointsInput(e.target.value)}
                      onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.25) { setQtiPointsPerQ(v); setPointsInput(String(v)); } else { setPointsInput(String(qtiPointsPerQ)); } }}
                      style={{width:"60px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                  </label>
                </div>
                <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                  {versions.map(v => (
                    <button key={v.label} style={S.oBtn("#8b5cf6")} onClick={async () => {
                      const xml = buildQTI(v.questions, v.questions[0]?.course||"Exam", v.label, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                      const blob = await buildQTIZip(xml, `Version_${v.label}`);
                      dlBlob(blob, `Version_${v.label}_Canvas_QTI.zip`);
                    }}>â¬‡ V{v.label} QTI (.zip)</button>
                  ))}
                  <button style={S.btn("#8b5cf6", false)} onClick={async () => {
                    const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                    const blob = await buildQTIZip(xml, "AllVersions");
                    dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                  }}>â¬‡ All Versions QTI (.zip)</button>
                </div>
              </div>
            )}
            </div>{/* end export-panel wrapper */}

            {v.questions.map((q,qi) => (
              <div key={q.id||qi} style={S.qCard}>
                {(() => { const issues = validateQuestion(q); return (
                <div style={S.qMeta}>
                  <span style={{fontWeight:"bold", color:text1}}>Q{qi+1}</span>
                  <span style={S.tag("#f43f5e")}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                  {issues.length > 0 && (
                    <span title={issues.join("\n")} style={{cursor:"help",
                      background:"#7c2d12", color:"#9B1C1C", fontSize:"0.68rem", fontWeight:"600",
                      padding:"0.1rem 0.4rem", borderRadius:"4px", whiteSpace:"nowrap"}}>
                      âš ï¸ {issues.length}
                    </span>
                  )}
                  <div style={{marginLeft:"auto", display:"flex", gap:"0.3rem"}}>
                    <button style={{...S.smBtn, color:"#f59e0b", border:"1px solid #f59e0b44"}}
                      onClick={() => isAdmin ? triggerReplace(activeVersion,qi,"numbers") : triggerReplaceAuto(activeVersion,qi,"numbers")}>â†» Replace</button>
                    <button style={{...S.smBtn, color:"#e879f9", border:"1px solid #e879f944"}}
                      onClick={() => isAdmin ? triggerReplace(activeVersion,qi,"function") : triggerReplaceAuto(activeVersion,qi,"function")}>â†» Diff.</button>
                    <button style={{...S.smBtn, color: inlineEditQId===`v${activeVersion}_${qi}` ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                      onClick={() => setInlineEditQId(inlineEditQId===`v${activeVersion}_${qi}` ? null : `v${activeVersion}_${qi}`)}>
                      âœï¸
                    </button>
                  </div>
                </div>
                ); })()}
                {inlineEditQId === `v${activeVersion}_${qi}` && (
                  <InlineEditor
                    q={q}
                    onSave={(updated) => {
                      const updVers = versions.map((v,vi) =>
                        vi !== activeVersion ? v : { ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }
                      );
                      setVersions(updVers);
                      setClassSectionVersions(prev => {
                        const next = {...prev};
                        Object.keys(next).forEach(sec => {
                          next[sec] = next[sec].map((v,vi) =>
                            vi !== activeVersion ? v : { ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }
                          );
                        });
                        return next;
                      });
                      setInlineEditQId(null);
                      showToast("Question updated âœ“");
                    }}
                    onSaveAll={(updated) => {
                      const updVers = versions.map(v => ({
                        ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : { ...vq, question: updated.question, choices: updated.choices })
                      }));
                      setVersions(updVers);
                      setClassSectionVersions(prev => {
                        const next = {...prev};
                        Object.keys(next).forEach(sec => {
                          next[sec] = next[sec].map(v => ({
                            ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : { ...vq, question: updated.question, choices: updated.choices })
                          }));
                        });
                        return next;
                      });
                      setInlineEditQId(null);
                      showToast("Pushed to all versions âœ“");
                    }}
                    onClose={() => setInlineEditQId(null)}
                  />
                )}
                {q.hasGraph && q.graphConfig && (
                  <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
                )}
                {q.type==="Branched" ? (
                  <>
                    <div style={{...S.qText,color:"#f43f5e99"}}>Given: <MathText>{q.stem}</MathText></div>
                    {(q.parts||[]).map((p,pi) => (
                      <div key={pi} style={{marginBottom:"0.6rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                        <div style={{fontSize:"0.7rem",color:text3,marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                        <div style={S.qText}><MathText>{p.question}</MathText></div>
                        {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                        {p.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{p.explanation}</MathText></div>}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                    {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                    {q.answer&&<div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                    {q.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{q.explanation}</MathText></div>}
                  </>
                )}
                {pendingType === "replace" && pendingMeta?.vIdx === activeVersion && pendingMeta?.qIdx === qi && (
                  <>
                    {isAdmin && generatedPrompt && (
                      <>
                        <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"bold", margin:"0.75rem 0 0.4rem"}}>ðŸ“‹ Replacement prompt:</div>
                        <div style={S.promptBox}>{generatedPrompt}</div>
                        <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                          <button
                            style={{...S.btn("#10b981", autoGenLoading), minWidth:"150px"}}
                            disabled={autoGenLoading}
                            onClick={() => autoGenerateVersions(generatedPrompt, "replace", pendingMeta)}>
                            {autoGenLoading ? "â³ Generating..." : "âš¡ Auto-Generate"}
                          </button>
                          <button style={S.oBtn("#f59e0b")} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>
                        </div>
                        {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.5rem"}}>{autoGenError}</div>}
                        <PastePanel
                          label="Paste the replacement question JSON here."
                          S={S} text2={text2}
                          pasteInput={pasteInput} setPasteInput={setPasteInput}
                          pasteError={pasteError} handlePaste={handlePaste}
                          onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                        />
                      </>
                    )}
                    {!isAdmin && (
                      <div style={{marginTop:"0.75rem", display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap", padding:"0.6rem 0.75rem", background:"#052e1688", borderRadius:"6px", border:"1px solid #22c55e22"}}>
                        {autoGenLoading
                          ? <><span style={{fontSize:"0.75rem", color:"#86efac"}}>â³ Generating replacement...</span></>
                          : autoGenError
                            ? <span style={{fontSize:"0.72rem", color:"#f87171"}}>{autoGenError}</span>
                            : <span style={{fontSize:"0.72rem", color:"#86efac"}}>âœ“ Done</span>
                        }
                        <button style={{...S.smBtn, color:text2, marginLeft:"auto"}}
                          onClick={() => { setPendingType(null); setGeneratedPrompt(""); }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </>
        );
      })()}

      {/* â”€â”€ COMPARE ALL VERSIONS MODE â”€â”€ */}
      {versionsViewMode === "compare" && (() => {
        const numQ = versions[0]?.questions?.length || 0;
        const allSections = [...new Set(versions.flatMap(v => v.questions.map(q => q.section)))];
        const [filterSec, setFilterSec] = [compareSection, setCompareSection];

        const filteredIndices = Array.from({length:numQ},(_,i)=>i).filter(i => {
          if (filterSec === "All") return true;
          return versions.some(v => v.questions[i]?.section === filterSec);
        });

        return (
          <>
            {/* Section filter */}
            <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
              <span style={{fontSize:"0.72rem", color:text2}}>Filter section:</span>
              <select style={{...S.sel, width:"220px"}} value={filterSec} onChange={e => setFilterSec(e.target.value)}>
                <option value="All">All Sections</option>
                {allSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span style={{fontSize:"0.72rem", color:text2}}>{filteredIndices.length} question{filteredIndices.length!==1?"s":""}</span>
            </div>

            {/* Canvas Export Settings */}
            <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
              <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas Export Settings</div>
              <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center"}}>
                <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                  <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                    style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                  Group by section per version
                </label>
                <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                  Points per question:
                  <input type="number" min={0.25} max={100} step={0.25} value={pointsInput}
                    onChange={e => setPointsInput(e.target.value)}
                    onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.25) { setQtiPointsPerQ(v); setPointsInput(String(v)); } else { setPointsInput(String(qtiPointsPerQ)); } }}
                    style={{width:"60px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                </label>
              </div>
            </div>

            {/* Export buttons for compare view â€” single grouped file */}
            <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
              <span style={{fontSize:"0.72rem", color:accent, fontWeight:"bold"}}>Canvas export â€” one file, all versions:</span>
              <button style={S.btn("#8b5cf6", false)} onClick={async () => {
                const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                const blob = await buildQTIZip(xml, "AllVersions");
                dlBlob(blob, "AllVersions_Canvas_QTI.zip");
              }}>â¬‡ Export to Canvas (QTI .zip)</button>
              {Object.keys(classSectionVersions).length > 1 && (
                <button style={S.btn("#f59e0b", false)} onClick={async () => {
                  const course = versions[0]?.questions[0]?.course || "Exam";
                  const xml = buildQTIAllSectionsMerged(classSectionVersions, course, parseFloat(qtiPointsPerQ) || 1);
                  const blob = await buildQTIZip(xml, "AllSections_Merged");
                  dlBlob(blob, "AllSections_Merged_QTI.zip");
                }}>â¬‡ All Sections Merged QTI</button>
              )}
              <button style={S.btn("#10b981", false)} onClick={async () => {
                const blob = await buildDocxCompare(versions, versions[0]?.questions[0]?.course || "Exam");
                dlBlob(blob, "AllVersions_Grouped.docx");
              }}>â¬‡ Export to Word (all versions)</button>
            </div>

            {/* Questions grouped by number, all versions stacked */}
            {filteredIndices.map(qi => (
              <div key={qi} style={{marginBottom:"1.5rem"}}>
                {/* Question group header */}
                <div style={{fontSize:"0.72rem", color:"#f43f5e", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.5rem", padding:"0.3rem 0.6rem", background:"#f43f5e18", borderRadius:"5px", display:"inline-block"}}>
                  Question {qi+1} â€” {versions[0]?.questions[qi]?.section} â€” {versions[0]?.questions[qi]?.difficulty}
                </div>

                {versions.map((v, vi) => {
                  const q = v.questions[qi];
                  if (!q) return null;
                  const vColors = ["#f43f5e","#8b5cf6","#f59e0b","#06b6d4","#10b981"];
                  const vc = vColors[vi % vColors.length];
                  return (
                    <div key={v.label} style={{...S.qCard, borderLeft:`3px solid ${vc}`, marginBottom:"0.4rem"}}>
                      <div style={S.qMeta}>
                        <span style={{background:vc+"22", color:vc, border:`1px solid ${vc}44`, borderRadius:"4px", padding:"0.15rem 0.5rem", fontSize:"0.7rem", fontWeight:"bold"}}>Version {v.label}</span>
                        <span style={S.tag()}>{q.type}</span>
                      </div>
                      {q.hasGraph && q.graphConfig && (
                        <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
                      )}
                      {q.type==="Branched" ? (
                        <>
                          <div style={{...S.qText,color:vc+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                          {(q.parts||[]).map((p,pi) => (
                            <div key={pi} style={{marginBottom:"0.4rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                              <div style={{fontSize:"0.7rem",color:text3}}>({String.fromCharCode(97+pi)})</div>
                              <div style={S.qText}><MathText>{p.question}</MathText></div>
                              {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div style={S.qText}><MathText>{q.question}</MathText></div>
                          {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                          {q.answer&&<div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        );
      })()}
    </>
  )}

  {showValidationPaste && (
    <div style={{position:"fixed",inset:0,background:"#00000088",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:bg1,border:"1px solid "+border,borderRadius:"12px",padding:"1.5rem",width:"100%",maxWidth:"560px",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
        <div style={{fontSize:"0.95rem",fontWeight:"700",color:text1}}>📥 Paste Validation Result</div>
        <div style={{fontSize:"0.78rem",color:text2,lineHeight:1.5}}>
          Paste Claude's JSON response. Expected format:&nbsp;
          <code style={{fontSize:"0.72rem",color:"#a78bfa",wordBreak:"break-all"}}>{'{"validated":[{"id":"...","validation":{"valid":false,"reason":"...","corrected_answer":"..."}}]}'}</code>
        </div>
        <textarea
          value={validationPasteInput}
          onChange={e => setValidationPasteInput(e.target.value)}
          placeholder='{ "validated": [{ "id": "abc123", "validation": { "valid": false, "reason": "...", "corrected_answer": "..." } }] }'
          style={{...S.input,width:"100%",height:"180px",resize:"vertical",fontFamily:"monospace",fontSize:"0.75rem",padding:"0.5rem 0.6rem",boxSizing:"border-box"}}
        />
        {validationPasteError && (
          <div style={{fontSize:"0.78rem",color:"#f87171"}}>{validationPasteError}</div>
        )}
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
          <button style={S.oBtn(text2)} onClick={() => setShowValidationPaste(false)}>Cancel</button>
          <button style={S.btn("#7c3aed",false)} onClick={() => {
            try {
              const data = JSON.parse(validationPasteInput.trim());
              const list = data.validated || (Array.isArray(data) ? data : null);
              if (!list) throw new Error('Expected { "validated": [...] } or a top-level array.');
              const results = {};
              list.forEach(q => { if (q.id && q.validation) results[q.id] = q.validation; });
              if (Object.keys(results).length === 0) throw new Error("No valid entries found — check the format.");
              setValidationResults(results);
              setShowValidationPaste(false);
              setValidationPasteError("");
            } catch (e) {
              setValidationPasteError("Invalid JSON: " + e.message);
            }
          }}>Apply</button>
        </div>
      </div>
    </div>
  )}
</div>
  );
}
