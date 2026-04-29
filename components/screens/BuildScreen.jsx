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

import InlineEditor from "../editors/InlineEditor.js";
import GraphEditor from "../editors/GraphEditor.js";
import QuestionCard from "../question/QuestionCard.jsx";

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

function SortableMasterCard({ id, children, S, text3 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    ...S.qCard,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{ position: "absolute", top: "0.5rem", left: "-1.4rem", cursor: "grab", color: text3, fontSize: "1rem", padding: "0 0.25rem", userSelect: "none" }}
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
  showToast,
  validateQuestion,
  sectionSortKey,
  // Navigation
  setScreen,
  // Validation context (from generate hook, surfaced in master review)
  dupWarnings = [],
  // Round-trip flow flags
  appendToMaster,
  setAppendToMaster,
  pendingAddFromBank,
  setPendingAddFromBank,
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
  const [graphEditorQId, setGraphEditorQId] = useState(null);
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
  if (masterLocked === true && versions.length > 0 && versions[0].questions.length > 0) {
    const v = versions[0];

    const updateMasterQuestion = updatedQ => {
      setVersions([{ ...v, questions: v.questions.map((q, i) => (q.id === updatedQ.id ? updatedQ : q)) }]);
    };

    const removeMasterQuestion = (qid) => {
      setVersions([{ ...v, questions: v.questions.filter(q => q.id !== qid) }]);
      setSelectedForExam(p => p.filter(id => id !== qid));
    };

    const handleMasterDragEnd = (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = v.questions.findIndex(q => q.id === active.id);
      const newIdx = v.questions.findIndex(q => q.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      setVersions([{ ...v, questions: arrayMove(v.questions, oldIdx, newIdx) }]);
    };

    const toggleNoneOfAbove = (qi) => {
      const q = v.questions[qi];
      if (!q.choices) return;
      const last = q.choices[q.choices.length - 1];
      const hasNone = /none of (these|the above)/i.test(last || "");
      const nextChoices = hasNone ? q.choices.slice(0, -1) : [...q.choices, "None of these"];
      updateMasterQuestion({ ...q, choices: nextChoices });
    };

    const addNoneOfTheseToAll = () => {
      let updated = 0;
      const nextQuestions = v.questions.map(q => {
        if (!Array.isArray(q.choices) || q.choices.length === 0) return q;
        const last = q.choices[q.choices.length - 1];
        if (/none of (these|the above)/i.test(last || "")) return q;
        updated++;
        return { ...q, choices: [...q.choices, "None of these"] };
      });
      if (updated === 0) {
        showToast && showToast("All MCQ questions already have 'None of these' ✓", "info");
        return;
      }
      setVersions([{ ...v, questions: nextQuestions }]);
      showToast && showToast(`✓ Added "None of these" to ${updated} question${updated > 1 ? "s" : ""}`);
    };

    const numQ = v.questions.length;

    return (
      <div>
        <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={S.h1}>Build Exam · Stage 2: Master Review</h1>
            <p style={S.sub}>Review Version A, edit or swap out questions, save the master, then continue to Variants.</p>
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

        {dupWarnings && dupWarnings.length > 0 && (
          <div style={{ ...S.card, borderColor: "#f59e0b44", background: "#f59e0b08", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: "#f59e0b", fontWeight: "600", marginBottom: "0.4rem" }}>⚠ Possible duplicates detected (same section)</div>
            {dupWarnings.map((w, i) => (
              <div key={i} style={{ fontSize: "0.72rem", color: text2, marginBottom: "0.2rem" }}>• {w}</div>
            ))}
            <div style={{ fontSize: "0.68rem", color: text3, marginTop: "0.4rem" }}>These questions were still saved — review and delete if needed.</div>
          </div>
        )}

        {/* Bulk MCQ tools */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            style={{ ...S.oBtn("#3b82f6"), fontSize: "0.75rem" }}
            onClick={addNoneOfTheseToAll}
          >
            ＋ Toggle None of These for All
          </button>
          <button
            style={{ ...S.oBtn("#10b981"), fontSize: "0.75rem" }}
            onClick={() => {
              setPendingAddFromBank && setPendingAddFromBank(true);
              setScreen && setScreen("bank");
            }}
          >
            ＋ Add from Bank
          </button>
          <button
            style={{ ...S.oBtn("#8b5cf6"), fontSize: "0.75rem" }}
            onClick={() => {
              setAppendToMaster && setAppendToMaster(true);
              setScreen && setScreen("generate");
            }}
          >
            ＋ Generate more
          </button>
        </div>

        {(() => {
          if (!pendingAddFromBank) return null;
          const inMaster = new Set(v.questions.map(q => q.id));
          const newIds = (selectedForExam || []).filter(id => !inMaster.has(id));
          if (newIds.length === 0) return null;
          return (
            <div style={{ background: "#1e3a5f33", border: "1px solid #3b82f644", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, fontSize: "0.78rem", color: "#3b82f6", fontWeight: "500" }}>
                ＋ {newIds.length} new question{newIds.length > 1 ? "s" : ""} selected from Bank — add to master?
              </div>
              <button
                style={{ ...S.btn("#10b981", false), fontSize: "0.74rem", padding: "0.3rem 0.8rem" }}
                onClick={() => {
                  const newQs = bank.filter(q => newIds.includes(q.id));
                  setVersions([{ ...v, questions: [...v.questions, ...newQs] }]);
                  setPendingAddFromBank(false);
                  showToast && showToast(`✓ Added ${newQs.length} question${newQs.length > 1 ? "s" : ""} to master`);
                }}
              >
                Add to Master
              </button>
              <button
                style={{ ...S.oBtn(text2), fontSize: "0.74rem", padding: "0.3rem 0.8rem" }}
                onClick={() => setPendingAddFromBank(false)}
              >
                Cancel
              </button>
            </div>
          );
        })()}

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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMasterDragEnd}>
          <SortableContext items={v.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
        {v.questions.map((q, qi) => {
          const issues = validateQuestion ? validateQuestion(q) : [];
          const hasNone = q.choices && /none of (these|the above)/i.test(q.choices[q.choices.length - 1] || "");
          const editing = inlineEditQId === `master_${qi}`;
          const editingGraph = graphEditorQId === q.id;
          return (
            <SortableMasterCard key={q.id || qi} id={q.id} S={S} text3={text3}>
              <QuestionCard
                q={q}
                index={qi + 1}
                issues={issues}
                authorMode={true}
                showCourse={false}
                typeColor="#f43f5e"
                S={S}
                accent={accent}
                text1={text1}
                text2={text2}
                text3={text3}
                border={border}
                onEdit={() => { setInlineEditQId(editing ? null : `master_${qi}`); setGraphEditorQId(null); }}
                onGraphEdit={() => { setGraphEditorQId(editingGraph ? null : q.id); setInlineEditQId(null); }}
                onDelete={() => removeMasterQuestion(q.id)}
                onReplace={() => showToast && showToast("Replace from the Bank screen for now", "info")}
                headerExtra={q.choices && q.type !== "Branched" && (
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
                bodyTop={(editing || editingGraph) && (
                  <>
                    {editing && (
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
                    {editingGraph && (
                      <GraphEditor
                        initialConfig={q.graphConfig || null}
                        onSave={cfg => {
                          const updated = { ...q, hasGraph: true, graphConfig: cfg };
                          setVersions([{ ...v, questions: v.questions.map((vq, vqi) => (vqi !== qi ? vq : updated)) }]);
                          setGraphEditorQId(null);
                          showToast && showToast("Graph saved ✓");
                        }}
                        onRemove={() => {
                          const updated = { ...q, hasGraph: false, graphConfig: null };
                          setVersions([{ ...v, questions: v.questions.map((vq, vqi) => (vqi !== qi ? vq : updated)) }]);
                          setGraphEditorQId(null);
                        }}
                        onClose={() => setGraphEditorQId(null)}
                      />
                    )}
                  </>
                )}
              />
            </SortableMasterCard>
          );
        })}
          </SortableContext>
        </DndContext>

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#052e1688", borderRadius: "8px", border: "1px solid #22c55e44", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#4ade80" }}>Master ready · {numQ} question{numQ !== 1 ? "s" : ""}</div>
            <div style={{ fontSize: "0.72rem", color: text3, marginTop: "0.2rem" }}>
              Save the master above, then head to the Variants screen to configure and generate.
            </div>
          </div>
          <button
            style={{ ...S.btn("#8b5cf6", false), fontSize: "0.88rem", padding: "0.55rem 1.4rem" }}
            onClick={() => setScreen && setScreen("variants")}
          >
            ⚡ Generate Variants →
          </button>
        </div>
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
