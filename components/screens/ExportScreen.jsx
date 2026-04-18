"use client";
import { useState } from "react";
import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";
import InlineEditor from "../editors/InlineEditor.js";
import PastePanel from "../panels/PastePanel.js";
import { useExportFunctions } from "../../context/ExportFunctionsContext.js";

export default function ExportScreen({
  // Versions state
  versions,
  setVersions,
  activeVersion,
  setActiveVersion,
  classSectionVersions,
  setClassSectionVersions,
  activeClassSection,
  setActiveClassSection,
  versionsViewMode,
  setVersionsViewMode,
  compareSection,
  setCompareSection,

  // Save exam
  saveExamName,
  setSaveExamName,
  examSaved,
  setExamSaved,
  savingExam,
  setSavingExam,
  saveExam,

  // QTI settings
  qtiExamName,
  setQtiExamName,
  qtiUseGroups,
  setQtiUseGroups,
  qtiPointsPerQ,
  setQtiPointsPerQ,

  // Export state/functions
  exportLoading,
  setExportLoading,
  exportHighlight,
  logExport,

  // Export helpers — now resolved from ExportFunctionsContext; props kept as fallback
  buildDocx: buildDocxProp,
  buildDocxCompare: buildDocxCompareProp,
  buildAnswerKey: buildAnswerKeyProp,
  buildQTI: buildQTIProp,
  buildQTIZip: buildQTIZipProp,
  buildQTICompare: buildQTICompareProp,
  buildClassroomSectionsQTI: buildClassroomSectionsQTIProp,
  buildQTIAllSectionsMerged: buildQTIAllSectionsMergedProp,
  validateQTIExport: validateQTIExportProp,
  dlBlob: dlBlobProp,

  // Print preview
  showPrintPreview,
  setShowPrintPreview,
  printGraphCache,

  // Replace flow
  triggerReplace,
  triggerReplaceAuto,
  pendingType,
  setPendingType,
  pendingMeta,
  generatedPrompt,
  setGeneratedPrompt,
  pasteInput,
  setPasteInput,
  pasteError,
  handlePaste,
  autoGenLoading,
  autoGenError,
  autoGenerateVersions,

  // Validation
  validationResults,
  validationError,
  validating,
  autoValidateAllVersions,
  copyValidationPrompt,

  // Misc
  inlineEditQId,
  setInlineEditQId,
  showToast,
  validateQuestion,

  // Navigation + permissions
  setScreen,
  isAdmin,

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
  const exportFns = useExportFunctions() || {};
  const buildDocx                 = exportFns.buildDocx                 || buildDocxProp;
  const buildDocxCompare          = exportFns.buildDocxCompare          || buildDocxCompareProp;
  const buildAnswerKey            = exportFns.buildAnswerKey            || buildAnswerKeyProp;
  const buildQTI                  = exportFns.buildQTI                  || buildQTIProp;
  const buildQTIZip               = exportFns.buildQTIZip               || buildQTIZipProp;
  const buildQTICompare           = exportFns.buildQTICompare           || buildQTICompareProp;
  const buildClassroomSectionsQTI = exportFns.buildClassroomSectionsQTI || buildClassroomSectionsQTIProp;
  const buildQTIAllSectionsMerged = exportFns.buildQTIAllSectionsMerged || buildQTIAllSectionsMergedProp;
  const validateQTIExport         = exportFns.validateQTIExport         || validateQTIExportProp;
  const dlBlob                    = exportFns.dlBlob                    || dlBlobProp;

  if (!versions || versions.length === 0) {
    return (
      <div>
        <div style={S.pageHeader}>
          <h1 style={S.h1}>Export Exam</h1>
          <p style={S.sub}>Generate versions from the Build screen to unlock exports.</p>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📦</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
            No versions available
          </div>
          <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Build a master exam and generate variants first.
          </div>
          <button style={S.btn(accent, false)} onClick={() => setScreen && setScreen("build")}>
            Go to Build →
          </button>
        </div>
      </div>
    );
  }

  const v = versions[activeVersion] || versions[0];
  const hasMultiSections = Object.keys(classSectionVersions || {}).length > 1;

  // Classroom section tabs — when multi-section, switch which versions[] is shown
  const classroomTabs = hasMultiSections ? (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: "0.72rem", color: text2, marginRight: "0.25rem" }}>Classroom section:</span>
      {Object.keys(classSectionVersions).sort((a, b) => Number(a) - Number(b)).map(sec => (
        <button
          key={sec}
          style={S.vTab(String(activeClassSection) === String(sec), "#06b6d4")}
          onClick={() => {
            setActiveClassSection(Number(sec));
            setVersions(classSectionVersions[sec] || []);
            setActiveVersion(0);
          }}
        >
          Section {sec}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={S.h1}>Export Exam</h1>
          <p style={S.sub}>
            {versions.length} version{versions.length > 1 ? "s" : ""} ready
            {hasMultiSections ? ` · ${Object.keys(classSectionVersions).length} classroom sections` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap" }}>
          <button style={{ ...S.oBtn(text2), fontSize: "0.75rem" }} onClick={() => setScreen && setScreen("build")}>← Build</button>
          <button style={{ ...S.oBtn(accent), fontSize: "0.75rem" }} onClick={() => setScreen && setScreen("exams")}>Saved Exams →</button>
        </div>
      </div>

      {classroomTabs}

      {/* Save to DB */}
      {!examSaved && (
        <div style={{ ...S.card, borderColor: "#10b98144", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: "bold", marginBottom: "0.5rem" }}>💾 Save this exam to database</div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              style={{ ...S.input, maxWidth: "300px" }}
              placeholder="Exam name (e.g. Calculus 1 Midterm)"
              value={saveExamName}
              onChange={e => setSaveExamName(e.target.value)}
            />
            <button
              style={S.btn("#10b981", !saveExamName.trim() || savingExam)}
              disabled={!saveExamName.trim() || savingExam}
              onClick={async () => {
                setSavingExam(true);
                const allVersions = hasMultiSections ? Object.values(classSectionVersions).flat() : versions;
                const result = await saveExam(saveExamName.trim(), allVersions);
                if (result) setExamSaved(true);
                setSavingExam(false);
              }}
            >
              {savingExam ? "Saving…" : "Save Exam"}
            </button>
          </div>
        </div>
      )}
      {examSaved && (
        <div style={{ ...S.card, borderColor: "#10b98144", marginBottom: "1.5rem", color: "#10b981" }}>
          ✅ Exam saved! View it in the Saved Exams tab.
        </div>
      )}

      {/* View mode toggle */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", color: text2, marginRight: "0.25rem" }}>View:</span>
        <button style={S.vTab(versionsViewMode === "single", "#f43f5e")} onClick={() => setVersionsViewMode("single")}>
          📄 Single Version
        </button>
        <button style={S.vTab(versionsViewMode === "compare", "#8b5cf6")} onClick={() => setVersionsViewMode("compare")}>
          📋 Canvas Versions
        </button>
      </div>

      {versionsViewMode === "single" && (
        <>
          {/* Version tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            {versions.map((ver, i) => (
              <button key={ver.label} style={S.vTab(activeVersion === i, "#f43f5e")} onClick={() => setActiveVersion(i)}>
                Version {ver.label}{" "}
                <span style={{ fontSize: "0.68rem", opacity: 0.7, marginLeft: "0.3rem" }}>({ver.questions.length}q)</span>
              </button>
            ))}
          </div>

          {(() => {
            const allIssues = v.questions.flatMap((q, qi) => {
              const issues = validateQuestion ? validateQuestion(q) : [];
              return issues.map(issue => `Q${qi + 1}: ${issue}`);
            });
            return allIssues.length > 0 ? (
              <div style={{ background: "#7c2d1222", border: "1px solid #f8717144", borderRadius: "6px", padding: "0.6rem 0.85rem", marginBottom: "0.75rem", fontSize: "0.75rem", color: "#9B1C1C" }}>
                <div style={{ fontWeight: "600", marginBottom: "0.3rem" }}>⚠️ {allIssues.length} issue{allIssues.length > 1 ? "s" : ""} found in this version</div>
                {allIssues.map((issue, i) => <div key={i} style={{ opacity: 0.85 }}>• {issue}</div>)}
              </div>
            ) : null;
          })()}

          <div
            id="export-panel"
            ref={el => { if (el && exportHighlight) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            style={{ transition: "outline 0.3s", outline: exportHighlight ? "2px solid #185FA555" : "none", borderRadius: "8px", padding: exportHighlight ? "0.5rem" : "0" }}
          >
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              <button
                style={S.btn("#10b981", exportLoading !== "")}
                disabled={exportLoading !== ""}
                onClick={async () => {
                  setExportLoading("Building Word document...");
                  try {
                    const cs = v.questions[0]?.classSection || null;
                    const blob = await buildDocx(v.questions, v.questions[0]?.course || "Calculus", v.label, cs);
                    const secStr = cs ? `_S${cs}` : "";
                    dlBlob(blob, `Version_${v.label}${secStr}_Exam.docx`);
                    if (examSaved && saveExamName) await logExport(saveExamName, "Word", v.label);
                  } finally {
                    setExportLoading("");
                  }
                }}
              >
                ⬇ Word (.docx)
              </button>
              <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
                👁 Print Preview
              </button>
              {hasMultiSections && (
                <button
                  style={S.oBtn("#8b5cf6")}
                  disabled={exportLoading !== ""}
                  onClick={async () => {
                    setExportLoading("Building all sections Word...");
                    try {
                      for (const [sec, secVers] of Object.entries(classSectionVersions)) {
                        for (const ver of secVers) {
                          const blob = await buildDocx(ver.questions, ver.questions[0]?.course || "Calculus", ver.label, Number(sec));
                          dlBlob(blob, `S${sec}_Version_${ver.label}_Exam.docx`);
                        }
                      }
                    } finally {
                      setExportLoading("");
                    }
                  }}
                >
                  ⬇ All Sections Word
                </button>
              )}
              <button
                style={S.oBtn("#f43f5e")}
                disabled={exportLoading !== ""}
                onClick={async () => {
                  setExportLoading("Building answer key...");
                  try {
                    const allVers = hasMultiSections ? Object.values(classSectionVersions).flat() : versions;
                    const course = allVers[0]?.questions[0]?.course || "Exam";
                    const blob = await buildAnswerKey(allVers, course);
                    if (blob) dlBlob(blob, `${course.replace(/\s+/g, "_")}_Answer_Key.docx`);
                  } finally {
                    setExportLoading("");
                  }
                }}
              >
                🔑 Answer Key (.docx)
              </button>
              {isAdmin && (
                <button
                  style={S.btn("#7c3aed", validating)}
                  disabled={validating}
                  onClick={() => {
                    if (!autoValidateAllVersions) return;
                    const allVers = Object.keys(classSectionVersions || {}).length > 1
                      ? Object.values(classSectionVersions).flat()
                      : versions;
                    const questionCount = allVers.reduce((sum, v) => sum + v.questions.length, 0);
                    const estimatedCost = (questionCount * 300 * 3 / 1_000_000) + (questionCount * 200 * 15 / 1_000_000);
                    const confirmed = window.confirm(
                      `Auto Validate will check ${questionCount} questions across all versions.\n\nEstimated cost: ~$${estimatedCost.toFixed(4)}\n\nProceed?`
                    );
                    if (!confirmed) return;
                    autoValidateAllVersions();
                  }}
                >
                  {validating ? "⏳ Validating..." : "✅ Auto Validate"}
                </button>
              )}
              {isAdmin && (
                <button style={S.oBtn("#7c3aed")} onClick={() => copyValidationPrompt && copyValidationPrompt()}>
                  📋 Copy Validation Prompt
                </button>
              )}
            </div>

            {isAdmin && validationError && (
              <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "0.5rem 0.85rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: "#f87171" }}>
                ⚠️ {validationError}
              </div>
            )}

            {isAdmin && validationResults && Object.keys(validationResults).length > 0 && (() => {
              const issues = Object.entries(validationResults).filter(([, r]) => !r.valid);
              return (
                <div style={{ background: issues.length === 0 ? "#052e16" : "#1c1002", border: `1px solid ${issues.length === 0 ? "#14532d" : "#f59e0b44"}`, borderRadius: "6px", padding: "0.6rem 0.85rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: issues.length === 0 ? "#4ade80" : "#f59e0b" }}>
                  {issues.length === 0 ? (
                    "✅ All questions verified — no issues found."
                  ) : (
                    <>
                      <div style={{ fontWeight: "600", marginBottom: "0.3rem" }}>⚠️ {issues.length} issue{issues.length > 1 ? "s" : ""} found</div>
                      {issues.map(([id, r]) => (
                        <div key={id} style={{ marginBottom: "0.25rem", opacity: 0.9 }}>
                          • <strong>Q{id}:</strong> {r.reason}{r.corrected_answer ? ` → Correct: ${r.corrected_answer}` : ""}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Canvas QTI Export Panel */}
            {hasMultiSections ? (
              <div style={{ ...S.card, borderColor: "#8b5cf644", marginBottom: "1rem", padding: "1rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#8b5cf6", fontWeight: "bold", marginBottom: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Canvas QTI Export — Classroom Sections
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.72rem", color: text2, flexShrink: 0 }}>Quiz name in Canvas:</span>
                  <input
                    placeholder="e.g. Midterm MAT221"
                    value={qtiExamName}
                    onChange={e => setQtiExamName(e.target.value)}
                    style={{ ...S.input, flex: 1, maxWidth: "280px", padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: text2, cursor: "pointer" }}>
                    <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)} style={{ accentColor: "#8b5cf6", width: "14px", height: "14px" }} />
                    Group by question number
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: text2 }}>
                    Points per question:
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={qtiPointsPerQ}
                      onChange={e => setQtiPointsPerQ(Number(e.target.value) || 1)}
                      style={{ width: "52px", ...S.input, padding: "0.25rem 0.4rem", fontSize: "0.78rem" }}
                    />
                  </label>
                </div>
                <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.75rem" }}>
                  {qtiUseGroups
                    ? "Grouped: one question group per question number — Canvas randomly picks 1 version per student."
                    : "Flat: all question versions listed sequentially — no Canvas grouping."}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(() => {
                    const allVers = Object.values(classSectionVersions).flat();
                    const warnings = validateQTIExport ? validateQTIExport(allVers) : [];
                    return warnings.length > 0 && (
                      <div style={{ width: "100%", fontSize: "0.7rem", color: "#f59e0b", background: "#451a0322", border: "1px solid #f59e0b44", borderRadius: "4px", padding: "0.35rem 0.6rem", marginBottom: "0.35rem" }}>
                        ⚠ {warnings.length} issue{warnings.length > 1 ? "s" : ""} detected before export: {warnings.slice(0, 2).join(" · ")}{warnings.length > 2 ? ` +${warnings.length - 2} more` : ""}
                      </div>
                    );
                  })()}
                  {Object.keys(classSectionVersions).sort((a, b) => Number(a) - Number(b)).map(sec => (
                    <button
                      key={sec}
                      style={S.btn("#8b5cf6", false)}
                      onClick={async () => {
                        const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                        const blobs = await buildClassroomSectionsQTI({ [sec]: classSectionVersions[sec] }, examTitle, qtiUseGroups, qtiPointsPerQ);
                        const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g, "_");
                        dlBlob(blobs[sec], `${safeName}_S${sec}_QTI.zip`);
                      }}
                    >
                      ⬇ Section {sec} QTI (.zip)
                    </button>
                  ))}
                  <button
                    style={S.btn("#10b981", false)}
                    onClick={async () => {
                      const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                      const blobs = await buildClassroomSectionsQTI(classSectionVersions, examTitle, qtiUseGroups, qtiPointsPerQ);
                      const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g, "_");
                      for (const [sec, blob] of Object.entries(blobs)) {
                        dlBlob(blob, `${safeName}_S${sec}_QTI.zip`);
                      }
                    }}
                  >
                    ⬇ All Sections QTI (.zip)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ ...S.card, borderColor: "#8b5cf644", marginBottom: "1rem", padding: "1rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#8b5cf6", fontWeight: "bold", marginBottom: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Canvas QTI Export
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: text2, cursor: "pointer" }}>
                    <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)} style={{ accentColor: "#8b5cf6", width: "14px", height: "14px" }} />
                    Group by question number
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: text2 }}>
                    Points per question:
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={qtiPointsPerQ}
                      onChange={e => setQtiPointsPerQ(Number(e.target.value) || 1)}
                      style={{ width: "52px", ...S.input, padding: "0.25rem 0.4rem", fontSize: "0.78rem" }}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {versions.map(ver => (
                    <button
                      key={ver.label}
                      style={S.oBtn("#8b5cf6")}
                      onClick={async () => {
                        const xml = buildQTI(ver.questions, ver.questions[0]?.course || "Exam", ver.label, qtiUseGroups, qtiPointsPerQ);
                        const blob = await buildQTIZip(xml, `Version_${ver.label}`);
                        dlBlob(blob, `Version_${ver.label}_Canvas_QTI.zip`);
                      }}
                    >
                      ⬇ V{ver.label} QTI (.zip)
                    </button>
                  ))}
                  <button
                    style={S.btn("#8b5cf6", false)}
                    onClick={async () => {
                      const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, qtiPointsPerQ);
                      const blob = await buildQTIZip(xml, "AllVersions");
                      dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                    }}
                  >
                    ⬇ All Versions QTI (.zip)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Question list */}
          {v.questions.map((q, qi) => {
            const issues = validateQuestion ? validateQuestion(q) : [];
            return (
              <div key={q.id || qi} style={S.qCard}>
                <div style={S.qMeta}>
                  <span style={{ fontWeight: "bold", color: text1 }}>Q{qi + 1}</span>
                  <span style={S.tag("#f43f5e")}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                  {issues.length > 0 && (
                    <span title={issues.join("\n")} style={{ cursor: "help", background: "#7c2d12", color: "#9B1C1C", fontSize: "0.68rem", fontWeight: "600", padding: "0.1rem 0.4rem", borderRadius: "4px", whiteSpace: "nowrap" }}>
                      ⚠️ {issues.length}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem" }}>
                    <button
                      style={{ ...S.smBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}
                      onClick={() => isAdmin ? triggerReplace && triggerReplace(activeVersion, qi, "numbers") : triggerReplaceAuto && triggerReplaceAuto(activeVersion, qi, "numbers")}
                    >
                      ↻ Replace
                    </button>
                    <button
                      style={{ ...S.smBtn, color: "#e879f9", border: "1px solid #e879f944" }}
                      onClick={() => isAdmin ? triggerReplace && triggerReplace(activeVersion, qi, "function") : triggerReplaceAuto && triggerReplaceAuto(activeVersion, qi, "function")}
                    >
                      ↻ Diff.
                    </button>
                    <button
                      style={{ ...S.smBtn, color: inlineEditQId === `v${activeVersion}_${qi}` ? "#60a5fa" : "#a78bfa", border: "1px solid #a78bfa44" }}
                      onClick={() => setInlineEditQId(inlineEditQId === `v${activeVersion}_${qi}` ? null : `v${activeVersion}_${qi}`)}
                    >
                      ✏️
                    </button>
                  </div>
                </div>

                {inlineEditQId === `v${activeVersion}_${qi}` && (
                  <InlineEditor
                    q={q}
                    onSave={updated => {
                      const updVers = versions.map((ver, vi) =>
                        vi !== activeVersion ? ver : { ...ver, questions: ver.questions.map((vq, vqi) => (vqi !== qi ? vq : updated)) }
                      );
                      setVersions(updVers);
                      setClassSectionVersions(prev => {
                        const next = { ...prev };
                        Object.keys(next).forEach(sec => {
                          next[sec] = next[sec].map((ver, vi) =>
                            vi !== activeVersion ? ver : { ...ver, questions: ver.questions.map((vq, vqi) => (vqi !== qi ? vq : updated)) }
                          );
                        });
                        return next;
                      });
                      setInlineEditQId(null);
                      showToast && showToast("Question updated ✓");
                    }}
                    onClose={() => setInlineEditQId(null)}
                  />
                )}

                {q.hasGraph && q.graphConfig && <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />}

                {q.type === "Branched" ? (
                  <>
                    <div style={{ ...S.qText, color: "#f43f5e99" }}>
                      Given: <MathText>{q.stem}</MathText>
                    </div>
                    {(q.parts || []).map((p, pi) => (
                      <div key={pi} style={{ marginBottom: "0.6rem", paddingLeft: "0.75rem", borderLeft: "2px solid " + border }}>
                        <div style={{ fontSize: "0.7rem", color: text3, marginBottom: "0.2rem" }}>({String.fromCharCode(97 + pi)})</div>
                        <div style={S.qText}>
                          <MathText>{p.question}</MathText>
                        </div>
                        {p.answer && (
                          <div style={S.ans}>
                            Answer: <MathText>{p.answer}</MathText>
                          </div>
                        )}
                        {p.explanation && (
                          <div style={S.expl}>
                            💡 <MathText>{p.explanation}</MathText>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}>
                      <MathText>{q.question}</MathText>
                    </div>
                    {q.choices && (
                      <ul style={S.cList}>
                        {q.choices.map((c, ci) => (
                          <li key={ci} style={S.cItem(c === q.answer)}>
                            {String.fromCharCode(65 + ci)}. <MathText>{c}</MathText>
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.answer && (
                      <div style={S.ans}>
                        ✓ <MathText>{q.answer}</MathText>
                      </div>
                    )}
                    {q.explanation && (
                      <div style={S.expl}>
                        💡 <MathText>{q.explanation}</MathText>
                      </div>
                    )}
                  </>
                )}

                {pendingType === "replace" && pendingMeta?.vIdx === activeVersion && pendingMeta?.qIdx === qi && (
                  <>
                    {isAdmin && generatedPrompt && (
                      <>
                        <div style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: "bold", margin: "0.75rem 0 0.4rem" }}>
                          📋 Replacement prompt:
                        </div>
                        <div style={S.promptBox}>{generatedPrompt}</div>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                          <button
                            style={{ ...S.btn("#10b981", autoGenLoading), minWidth: "150px" }}
                            disabled={autoGenLoading}
                            onClick={() => autoGenerateVersions(generatedPrompt, "replace", pendingMeta)}
                          >
                            {autoGenLoading ? "⏳ Generating..." : "⚡ Auto-Generate"}
                          </button>
                          <button style={S.oBtn("#f59e0b")} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                            Copy Prompt
                          </button>
                        </div>
                        {autoGenError && <div style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.5rem" }}>{autoGenError}</div>}
                        <PastePanel
                          label="Paste the replacement question JSON here."
                          S={S}
                          text2={text2}
                          pasteInput={pasteInput}
                          setPasteInput={setPasteInput}
                          pasteError={pasteError}
                          handlePaste={handlePaste}
                          onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                        />
                      </>
                    )}
                    {!isAdmin && (
                      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", padding: "0.6rem 0.75rem", background: "#052e1688", borderRadius: "6px", border: "1px solid #22c55e22" }}>
                        {autoGenLoading ? (
                          <span style={{ fontSize: "0.75rem", color: "#86efac" }}>⏳ Generating replacement...</span>
                        ) : autoGenError ? (
                          <span style={{ fontSize: "0.72rem", color: "#f87171" }}>{autoGenError}</span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#86efac" }}>✓ Done</span>
                        )}
                        <button style={{ ...S.smBtn, color: text2, marginLeft: "auto" }} onClick={() => { setPendingType(null); setGeneratedPrompt(""); }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {versionsViewMode === "compare" && (() => {
        const numQ = versions[0]?.questions?.length || 0;
        const allSections = [...new Set(versions.flatMap(ver => ver.questions.map(q => q.section)))];
        const filteredIndices = Array.from({ length: numQ }, (_, i) => i).filter(i => {
          if (compareSection === "All") return true;
          return versions.some(ver => ver.questions[i]?.section === compareSection);
        });

        return (
          <>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", color: text2 }}>Filter section:</span>
              <select style={{ ...S.sel, width: "220px" }} value={compareSection} onChange={e => setCompareSection(e.target.value)}>
                <option value="All">All Sections</option>
                {allSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span style={{ fontSize: "0.72rem", color: text2 }}>{filteredIndices.length} question{filteredIndices.length !== 1 ? "s" : ""}</span>
            </div>

            <div style={{ ...S.card, borderColor: "#8b5cf644", marginBottom: "1rem", padding: "1rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#8b5cf6", fontWeight: "bold", marginBottom: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Canvas Export Settings
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: text2, cursor: "pointer" }}>
                  <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)} style={{ accentColor: "#8b5cf6", width: "14px", height: "14px" }} />
                  Group by section per version
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: text2 }}>
                  Points per question:
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={qtiPointsPerQ}
                    onChange={e => setQtiPointsPerQ(Number(e.target.value) || 1)}
                    style={{ width: "52px", ...S.input, padding: "0.25rem 0.4rem", fontSize: "0.78rem" }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: accent, fontWeight: "bold" }}>Canvas export — one file, all versions:</span>
              <button
                style={S.btn("#8b5cf6", false)}
                onClick={async () => {
                  const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, qtiPointsPerQ);
                  const blob = await buildQTIZip(xml, "AllVersions");
                  dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                }}
              >
                ⬇ Export to Canvas (QTI .zip)
              </button>
              {hasMultiSections && (
                <button
                  style={S.btn("#f59e0b", false)}
                  onClick={async () => {
                    const course = versions[0]?.questions[0]?.course || "Exam";
                    const xml = buildQTIAllSectionsMerged(classSectionVersions, course, qtiPointsPerQ);
                    const blob = await buildQTIZip(xml, "AllSections_Merged");
                    dlBlob(blob, "AllSections_Merged_QTI.zip");
                  }}
                >
                  ⬇ All Sections Merged QTI
                </button>
              )}
              <button
                style={S.btn("#10b981", false)}
                onClick={async () => {
                  const blob = await buildDocxCompare(versions, versions[0]?.questions[0]?.course || "Exam");
                  dlBlob(blob, "AllVersions_Grouped.docx");
                }}
              >
                ⬇ Export to Word (all versions)
              </button>
            </div>

            {filteredIndices.map(qi => (
              <div key={qi} style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#f43f5e", fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem", padding: "0.3rem 0.6rem", background: "#f43f5e18", borderRadius: "5px", display: "inline-block" }}>
                  Question {qi + 1} — {versions[0]?.questions[qi]?.section} — {versions[0]?.questions[qi]?.difficulty}
                </div>

                {versions.map((ver, vi) => {
                  const q = ver.questions[qi];
                  if (!q) return null;
                  const vColors = ["#f43f5e", "#8b5cf6", "#f59e0b", "#06b6d4", "#10b981"];
                  const vc = vColors[vi % vColors.length];
                  return (
                    <div key={ver.label} style={{ ...S.qCard, borderLeft: `3px solid ${vc}`, marginBottom: "0.4rem" }}>
                      <div style={S.qMeta}>
                        <span style={{ background: vc + "22", color: vc, border: `1px solid ${vc}44`, borderRadius: "4px", padding: "0.15rem 0.5rem", fontSize: "0.7rem", fontWeight: "bold" }}>Version {ver.label}</span>
                        <span style={S.tag()}>{q.type}</span>
                      </div>
                      {q.hasGraph && q.graphConfig && <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />}
                      {q.type === "Branched" ? (
                        <>
                          <div style={{ ...S.qText, color: vc + "cc" }}>
                            Given: <MathText>{q.stem}</MathText>
                          </div>
                          {(q.parts || []).map((p, pi) => (
                            <div key={pi} style={{ marginBottom: "0.4rem", paddingLeft: "0.75rem", borderLeft: "2px solid " + border }}>
                              <div style={{ fontSize: "0.7rem", color: text3 }}>({String.fromCharCode(97 + pi)})</div>
                              <div style={S.qText}>
                                <MathText>{p.question}</MathText>
                              </div>
                              {p.answer && (
                                <div style={S.ans}>
                                  Answer: <MathText>{p.answer}</MathText>
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div style={S.qText}>
                            <MathText>{q.question}</MathText>
                          </div>
                          {q.choices && (
                            <ul style={S.cList}>
                              {q.choices.map((c, ci) => (
                                <li key={ci} style={S.cItem(c === q.answer)}>
                                  {String.fromCharCode(65 + ci)}. <MathText>{c}</MathText>
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.answer && (
                            <div style={S.ans}>
                              ✓ <MathText>{q.answer}</MathText>
                            </div>
                          )}
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
    </div>
  );
}
