"use client";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import MathText from "../display/MathText.js";
import GraphDisplay from "../display/GraphDisplay.js";
import InlineEditor from "../editors/InlineEditor.js";
import PastePanel from "../panels/PastePanel.js";

const VERSIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function SortableRow({ id, children, S, border, text3 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.45rem 0.5rem",
    borderBottom: "1px solid " + border + "44",
    background: isDragging ? "#F7F2E9" : "transparent",
    borderRadius: isDragging ? "6px" : "0",
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", color: text3, fontSize: "0.9rem", padding: "0 0.25rem", userSelect: "none" }}
        title="Drag to reorder"
      >
        ⋮⋮
      </span>
      {children}
    </div>
  );
}

export default function BuildScreen({
  // State
  bank,
  course,
  selectedForExam,
  setSelectedForExam,
  versions,
  setVersions,
  masterLocked,
  setMasterLocked,
  masterName,
  setMasterName,
  savingMaster,
  saveMaster,
  versionCount,
  setVersionCount,
  numClassSections,
  setNumClassSections,
  versionMutationType,
  setVersionMutationType,
  mutationType,
  autoGenLoading,
  autoGenError,
  triggerVersions,
  autoGenerateVersions,
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
  showToast,
  validateQuestion,
  sectionSortKey,
  // Navigation
  setScreen,
  // Permissions
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
  courseColors,
}) {
  const [inlineEditQId, setInlineEditQId] = useState(null);
  const [orderedSelected, setOrderedSelected] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Build the list of selected question objects (stable order once stage 1 mounted)
  const selectedQuestions = (() => {
    if (orderedSelected) return orderedSelected;
    const raw = bank
      .filter(q => selectedForExam.includes(q.id))
      .sort((a, b) => {
        const [aMaj, aMin] = sectionSortKey(a.section);
        const [bMaj, bMin] = sectionSortKey(b.section);
        return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
      });
    return raw;
  })();

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedSelected(prev => {
      const base = prev || selectedQuestions;
      const oldIdx = base.findIndex(q => q.id === active.id);
      const newIdx = base.findIndex(q => q.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return base;
      return arrayMove(base, oldIdx, newIdx);
    });
  }

  // ── STAGE 1 ── Review Selection ──────────────────────────────────────────
  if (selectedForExam.length > 0 && versions.length === 0 && !masterLocked) {
    const selected = selectedQuestions;
    return (
      <div>
        <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={S.h1}>Build Exam · Stage 1: Review Selection</h1>
            <p style={S.sub}>Reorder by dragging, remove any you don't want, then create the master.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            <button style={{ ...S.oBtn(text2), fontSize: "0.75rem" }} onClick={() => setScreen && setScreen("bank")}>← Back to Bank</button>
          </div>
        </div>

        <div style={{ ...S.card, borderColor: accent + "44" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: "600", color: text1, marginBottom: "0.2rem" }}>
                {selected.length} question{selected.length !== 1 ? "s" : ""} selected
              </div>
              <div style={{ fontSize: "0.72rem", color: text2 }}>
                {[...new Set(selected.map(q => q.course))].join(", ")} · {[...new Set(selected.map(q => q.section))].length} sections
              </div>
            </div>
            <button style={S.ghostBtn("#f87171")} onClick={() => setSelectedForExam([])}>
              ✕ Clear selection
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selected.map(q => q.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: "flex", flexDirection: "column", marginBottom: "1rem" }}>
                {selected.map((q, i) => (
                  <SortableRow key={q.id} id={q.id} S={S} border={border} text3={text3}>
                    <span style={{ fontSize: "0.72rem", color: text3, minWidth: "28px", fontWeight: "600" }}>Q{i + 1}</span>
                    <span style={S.diffTag(q.difficulty || "")}>{(q.difficulty || "?")[0]}</span>
                    <span style={{ ...S.tag(courseColors[q.course]), flexShrink: 0 }}>
                      {(q.section || "").split(" ").slice(0, 2).join(" ")}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: text2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.type === "Branched" ? q.stem : q.question}
                    </span>
                    <button
                      style={{ ...S.smBtn, color: "#f87171", border: "none", padding: "0.1rem 0.3rem" }}
                      onClick={() => {
                        setSelectedForExam(p => p.filter(id => id !== q.id));
                        setOrderedSelected(p => (p || selected).filter(qq => qq.id !== q.id));
                      }}
                    >
                      ✕
                    </button>
                  </SortableRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              style={{ ...S.btn("#10b981", selected.length === 0), fontSize: "0.88rem", padding: "0.55rem 1.4rem" }}
              disabled={selected.length === 0}
              onClick={() => {
                setSelectedForExam(selected.map(q => q.id));
                setVersions([{ label: "A", questions: selected }]);
                setMasterLocked(true);
              }}
            >
              🏗 Create Master Version A →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STAGE 2 ── Master Review + Configure ─────────────────────────────────
  if (masterLocked && versions.length === 1) {
    const v = versions[0];

    const updateMasterQuestion = updatedQ => {
      setVersions([{ ...v, questions: v.questions.map((q, i) => (q.id === updatedQ.id ? updatedQ : q)) }]);
    };

    const toggleNoneOfAbove = (qi) => {
      const q = v.questions[qi];
      if (!q.choices) return;
      const last = q.choices[q.choices.length - 1];
      const hasNone = /none of (these|the above)/i.test(last || "");
      const nextChoices = hasNone ? q.choices.slice(0, -1) : [...q.choices, "None of these"];
      updateMasterQuestion({ ...q, choices: nextChoices });
    };

    const numQ = v.questions.length;
    const totalVersions = versionCount * numClassSections;
    const overLimit = numQ * totalVersions > 15;
    const estTokens = Math.round(numQ * totalVersions * 400 + 1500);
    const estCost = ((numQ * totalVersions * 400 * 3) / 1_000_000 + (numQ * totalVersions * 350 * 15) / 1_000_000).toFixed(3);
    const variantLabels = VERSIONS.slice(1, 1 + versionCount);

    return (
      <div>
        <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={S.h1}>Build Exam · Stage 2: Master Review + Configure</h1>
            <p style={S.sub}>Review Version A, edit or swap out questions, configure variants, then generate.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap" }}>
            <button
              style={{ ...S.oBtn("#f87171"), fontSize: "0.75rem" }}
              onClick={() => {
                setMasterLocked(false);
                setVersions([]);
                setOrderedSelected(null);
              }}
            >
              ✕ Discard Master & Start Over
            </button>
          </div>
        </div>

        <div style={{ background: "#052e1688", border: "1px solid #22c55e44", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1.1rem" }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "#4ade80" }}>Master Version A locked · {v.questions.length} question{v.questions.length !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: "0.72rem", color: text3, marginTop: "0.2rem" }}>Click ✏️ to edit, ↻ to replace, or toggle "None of these" per MCQ.</div>
          </div>
        </div>

        {/* Save Master */}
        <div style={{ padding: "0.85rem 1rem", background: bg2, borderRadius: "8px", border: "1px solid " + border, display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.75rem", color: text2, fontWeight: "600", whiteSpace: "nowrap" }}>💾 Save Master</span>
          <input
            value={masterName}
            onChange={e => setMasterName(e.target.value)}
            placeholder="Master name (e.g. Quiz 02 MAT116)"
            onKeyDown={e => e.key === "Enter" && saveMaster()}
            style={{ flex: 1, minWidth: "200px", padding: "0.35rem 0.6rem", background: bg1, border: "1px solid " + border, color: text1, borderRadius: "6px", fontSize: "0.82rem", fontFamily: "inherit" }}
          />
          <button
            onClick={saveMaster}
            disabled={savingMaster}
            style={{ ...S.btn("#4f46e5", savingMaster), fontSize: "0.8rem", padding: "0.35rem 0.9rem", opacity: savingMaster ? 0.6 : 1 }}
          >
            {savingMaster ? "Saving…" : "💾 Save Master"}
          </button>
        </div>

        {v.questions.map((q, qi) => {
          const issues = validateQuestion ? validateQuestion(q) : [];
          const hasNone = q.choices && /none of (these|the above)/i.test(q.choices[q.choices.length - 1] || "");
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
                <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                  {q.choices && q.type !== "Branched" && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", color: text2, cursor: "pointer", border: "1px solid " + border, padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                      <input
                        type="checkbox"
                        checked={hasNone}
                        onChange={() => toggleNoneOfAbove(qi)}
                        style={{ accentColor: accent, width: "12px", height: "12px" }}
                      />
                      None of these
                    </label>
                  )}
                  <button
                    style={{ ...S.smBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}
                    onClick={() => showToast && showToast("Replace from the Bank screen for now", "info")}
                    title="Replace question"
                  >
                    ↻ Replace
                  </button>
                  <button
                    style={{ ...S.smBtn, color: inlineEditQId === `master_${qi}` ? "#60a5fa" : "#a78bfa", border: "1px solid #a78bfa44" }}
                    onClick={() => setInlineEditQId(inlineEditQId === `master_${qi}` ? null : `master_${qi}`)}
                  >
                    ✏️
                  </button>
                </div>
              </div>

              {inlineEditQId === `master_${qi}` && (
                <InlineEditor
                  q={q}
                  onSave={updated => {
                    setVersions([{ ...v, questions: v.questions.map((vq, vqi) => (vqi !== qi ? vq : updated)) }]);
                    setInlineEditQId(null);
                    showToast && showToast("Question updated ✓");
                  }}
                  onClose={() => setInlineEditQId(null)}
                />
              )}

              {q.hasGraph && q.graphConfig && <GraphDisplay graphConfig={q.graphConfig} authorMode={true} />}

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
            </div>
          );
        })}

        {/* Configure variants */}
        <div style={{ marginTop: "1.5rem", ...S.card, borderColor: "#8b5cf644" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: "600", color: text1, marginBottom: "0.75rem" }}>⚙ Configure Variants</div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={S.lbl}>Variants to generate (after Version A)</div>
              <select style={{ ...S.sel, width: "200px" }} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>
                    {n} variant{n > 1 ? "s" : ""} ({VERSIONS.slice(1, 1 + n).join(", ")})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={S.lbl}>Classroom sections</div>
              <input
                type="number"
                min={1}
                max={10}
                value={numClassSections}
                style={{ ...S.input, width: "80px" }}
                onChange={e => setNumClassSections(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          <div style={{ marginTop: "0.9rem" }}>
            <div style={S.lbl}>Mutation type per variant</div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {variantLabels.map(lbl => {
                const mut = versionMutationType[lbl] || "numbers";
                return (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ fontSize: "0.72rem", color: text1, fontWeight: "600" }}>Ver {lbl}:</span>
                    <button
                      style={{ ...S.smBtn, background: mut === "numbers" ? accent + "22" : "transparent", color: mut === "numbers" ? accent : text2, border: "1px solid " + (mut === "numbers" ? accent + "66" : border) }}
                      onClick={() => setVersionMutationType(p => ({ ...p, [lbl]: "numbers" }))}
                    >
                      numbers
                    </button>
                    <button
                      style={{ ...S.smBtn, background: mut === "function" ? "#8b5cf622" : "transparent", color: mut === "function" ? "#8b5cf6" : text2, border: "1px solid " + (mut === "function" ? "#8b5cf666" : border) }}
                      onClick={() => setVersionMutationType(p => ({ ...p, [lbl]: "function" }))}
                    >
                      function
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: "1rem", padding: "0.75rem 0.9rem", background: bg2, borderRadius: "8px", border: "1px solid " + border }}>
            <div style={{ fontSize: "0.78rem", color: text1, fontWeight: "600", marginBottom: "0.3rem" }}>Estimated cost</div>
            <div style={{ fontSize: "0.75rem", color: text2 }}>
              {numQ} questions × {versionCount} variant{versionCount > 1 ? "s" : ""}
              {numClassSections > 1 ? ` × ${numClassSections} sections` : ""} = {numQ * totalVersions} generated items
            </div>
            <div style={{ fontSize: "0.75rem", color: text2, marginTop: "0.2rem" }}>
              ~{estTokens.toLocaleString()} tokens · ~${estCost}
            </div>
            {overLimit && (
              <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "0.45rem", padding: "0.4rem 0.6rem", background: "#451a0322", borderRadius: "6px", border: "1px solid #f59e0b44" }}>
                ⚠ {numQ * totalVersions} items may exceed Claude's output — consider fewer questions or fewer versions at once.
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1rem", padding: "1rem", background: "#052e1688", borderRadius: "8px", border: "1px solid #22c55e44", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#4ade80" }}>Ready to generate variants?</div>
            <div style={{ fontSize: "0.72rem", color: text3, marginTop: "0.2rem" }}>
              Will produce {versionCount} variant{versionCount > 1 ? "s" : ""}
              {numClassSections > 1 ? ` × ${numClassSections} classroom sections` : ""} from this master.
            </div>
          </div>
          <button
            style={{ ...S.btn("#8b5cf6", false), fontSize: "0.88rem", padding: "0.55rem 1.4rem" }}
            onClick={() => triggerVersions && triggerVersions()}
          >
            ⚡ Generate Variants →
          </button>
        </div>

        {/* STAGE 4 — Generate Variants prompt/paste (inline) */}
        {(pendingType === "version_all" || pendingType === "version_all_sections") && generatedPrompt && (
          <div style={{ marginTop: "1.5rem" }}>
            <hr style={S.divider} />
            <div style={{ fontSize: "0.78rem", color: accent, fontWeight: "600", marginBottom: "0.5rem" }}>
              📋 Stage 4 · Generate Variants
              {pendingType === "version_all_sections" && (
                <> — all {pendingMeta?.numClassSections} sections × {pendingMeta?.labels?.join(", ")}</>
              )}
            </div>
            <div style={S.promptBox}>{generatedPrompt}</div>
            {(() => {
              const nq = pendingMeta?.selected?.length || 0;
              const nv = pendingMeta?.labels?.length || 0;
              const ncs = pendingMeta?.numClassSections || 1;
              const totalV = nv * ncs;
              const cost = ((nq * totalV * 400 * 3) / 1_000_000 + (nq * totalV * 350 * 15) / 1_000_000).toFixed(3);
              const label = ncs > 1 ? `${nq} questions × ${nv} versions × ${ncs} sections` : `${nq} questions × ${nv} versions`;
              return (
                <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.5rem" }}>
                  Estimated cost: ~${cost} ({label})
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <button
                style={{ ...S.btn("#10b981", autoGenLoading), minWidth: "160px" }}
                disabled={autoGenLoading}
                onClick={async () => {
                  await autoGenerateVersions(generatedPrompt, pendingType, pendingMeta);
                  // On successful handlePaste the parent will setScreen("export")
                }}
              >
                {autoGenLoading ? "⏳ Generating..." : "⚡ Generate Variants"}
              </button>
              {isAdmin && (
                <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                  Copy Prompt
                </button>
              )}
            </div>
            {autoGenError && <div style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>{autoGenError}</div>}
            <button id="auto-submit-paste" style={{ display: "none" }} onClick={handlePaste} />
            <PastePanel
              label={pendingType === "version_all_sections" ? "Paste the combined JSON response (all sections + versions)." : "Paste Claude's JSON response here."}
              S={S}
              text2={text2}
              pasteInput={pasteInput}
              setPasteInput={setPasteInput}
              pasteError={pasteError}
              handlePaste={handlePaste}
              onCancel={() => {
                setPendingType(null);
                setPasteInput("");
                setGeneratedPrompt("");
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Fallback: versions already generated — route user to Export screen ───
  if (versions.length > 1) {
    return (
      <div>
        <div style={S.pageHeader}>
          <h1 style={S.h1}>Build Exam</h1>
          <p style={S.sub}>Variants have been generated for this master.</p>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "2.5rem 2rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📦</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
            {versions.length} versions ready
          </div>
          <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.5rem" }}>
            Head to the Export screen to download, save, and send to Canvas.
          </div>
          <button style={S.btn(accent, false)} onClick={() => setScreen && setScreen("export")}>
            Go to Export →
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Build Exam</h1>
        <p style={S.sub}>Select questions from the Bank to start building.</p>
      </div>
      <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏗</div>
        <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
          No questions selected
        </div>
        <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Open the Bank, check the questions you want on your exam, then come back.
        </div>
        <button style={S.btn(accent, false)} onClick={() => setScreen && setScreen("bank")}>
          Browse Bank →
        </button>
      </div>
    </div>
  );
}
