"use client";
import { useAppContext } from "../../context/AppContext.js";
import { makeStyles, text1, text2, text3, border, bg1, bg2, bg0, green1 } from "../../lib/theme.js";
import { EG_TYPES } from "../../hooks/useExamGenerator.js";

// The four Add-Question steps shown in the indicator. 'list' is the draft surface.
const STEP_FLOW = [
  { key: "type",    label: "Type" },
  { key: "chapter", label: "Topic" },
  { key: "wording", label: "Wording" },
  { key: "details", label: "Details" },
];

const typeLabel = (v) => EG_TYPES.find(t => t.value === v)?.label || v || "—";

export default function ExamGeneratorScreen() {
  const ctx = useAppContext();
  const S = makeStyles(green1);
  const eg = ctx.examGenerator;
  const { step, setStep, draft, drafts } = eg;

  // Option data comes from the existing generate flow — never hardcoded here.
  const course = ctx.course;
  const allCourses = ctx.allCourses || {};
  const chapters = ctx.chapters || [];
  const courseNames = Object.keys(allCourses);
  const selectedChapter = chapters.find(c => c.title === draft.chapter) || null;
  const sections = selectedChapter?.sections || [];

  const inWalk = step !== "list";
  const activeStepIdx = STEP_FLOW.findIndex(s => s.key === step);

  // --- step indicator --------------------------------------------------------
  const StepIndicator = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
      {STEP_FLOW.map((s, i) => {
        const done = i < activeStepIdx;
        const active = i === activeStepIdx;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              padding: "0.3rem 0.7rem", borderRadius: "20px",
              background: active ? green1 + "18" : done ? green1 + "0E" : bg2,
              border: "1px solid " + (active ? green1 + "66" : done ? green1 + "33" : border),
              color: active ? green1 : done ? green1 : text3,
              fontSize: "0.72rem", fontWeight: active ? "700" : "500",
              fontFamily: "'Inter',system-ui,sans-serif",
            }}>
              <span style={{
                width: "16px", height: "16px", borderRadius: "50%",
                background: active || done ? green1 : "transparent",
                border: "1.5px solid " + (active || done ? green1 : text3),
                color: active || done ? "#fff" : text3,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6rem", fontWeight: "700",
              }}>{done ? "✓" : i + 1}</span>
              {s.label}
            </div>
            {i < STEP_FLOW.length - 1 && (
              <span style={{ color: text3, fontSize: "0.7rem" }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );

  // --- nav buttons -----------------------------------------------------------
  const Back = ({ to }) => (
    <button style={{ ...S.oBtn(text2), borderColor: border }} onClick={() => setStep(to)}>← Back</button>
  );
  const Next = ({ to, disabled }) => (
    <button style={S.btn(green1, disabled)} disabled={disabled} onClick={() => !disabled && setStep(to)}>Next →</button>
  );

  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Exam Generator</h1>
        <p style={S.sub}>
          A guided way to build an exam one question at a time. Pick a type, a topic,
          a wording, and the details — each question drops into a draft list you can
          edit before building.
        </p>
      </div>

      {inWalk && <StepIndicator />}

      {/* STEP: type ----------------------------------------------------------- */}
      {step === "type" && (
        <div style={S.card}>
          <h2 style={S.h2}>1 · Question type</h2>
          <p style={{ ...S.sub, marginBottom: "1.25rem" }}>
            Pick the type first — later suggestions are tailored to it.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {EG_TYPES.map(t => {
              const sel = draft.type === t.value;
              return (
                <button key={t.value} onClick={() => eg.setType(t.value)} style={{
                  flex: "1 1 180px", textAlign: "left", cursor: "pointer",
                  background: sel ? green1 + "12" : bg2,
                  border: "1.5px solid " + (sel ? green1 + "66" : border),
                  borderRadius: "12px", padding: "1.1rem 1.2rem",
                  fontFamily: "'Inter',system-ui,sans-serif",
                  color: sel ? green1 : text1, transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.2rem" }}>{t.label}</div>
                  <div style={{ fontSize: "0.72rem", color: text3 }}>{t.value}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.75rem" }}>
            <button style={{ ...S.oBtn(text2), borderColor: border }} onClick={() => setStep("list")}>
              {drafts.length ? "← Draft list" : "Cancel"}
            </button>
            <Next to="chapter" disabled={!draft.type} />
          </div>
        </div>
      )}

      {/* STEP: chapter / section --------------------------------------------- */}
      {step === "chapter" && (
        <div style={S.card}>
          <h2 style={S.h2}>2 · Topic</h2>
          <p style={{ ...S.sub, marginBottom: "1.25rem" }}>
            Chapter is required. Leave the section blank for chapter-wide suggestions.
          </p>

          {/* Course (active course drives the chapter list) */}
          <div style={S.field}>
            <label style={S.lbl}>Course</label>
            <select
              style={S.sel}
              value={course || ""}
              onChange={(e) => {
                ctx.generate.setCourse(e.target.value || null);
                // Course change invalidates the chosen chapter/section.
                eg.setChapterSection("", "");
              }}
            >
              <option value="">Select a course…</option>
              {courseNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div style={{ ...S.row, marginTop: "1.25rem" }}>
            <div style={S.field}>
              <label style={S.lbl}>Chapter <span style={{ color: "#9B1C1C" }}>*</span></label>
              <select
                style={S.sel}
                value={draft.chapter || ""}
                disabled={!course}
                onChange={(e) => eg.setChapterSection(e.target.value, "")}
              >
                <option value="">{course ? "Select a chapter…" : "Pick a course first"}</option>
                {chapters.map(c => (
                  <option key={c.ch} value={c.title}>{c.ch}. {c.title}</option>
                ))}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.lbl}>Section <span style={{ color: text3 }}>(optional)</span></label>
              <select
                style={S.sel}
                value={draft.section || ""}
                disabled={!draft.chapter}
                onChange={(e) => eg.setChapterSection(draft.chapter, e.target.value)}
              >
                <option value="">Whole chapter</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.75rem" }}>
            <Back to="type" />
            <Next to="wording" disabled={!course || !draft.chapter} />
          </div>
        </div>
      )}

      {/* STEP: wording (Phase A stub) ---------------------------------------- */}
      {step === "wording" && (
        <div style={S.card}>
          <h2 style={S.h2}>3 · Wording</h2>
          <p style={{ ...S.sub, marginBottom: "0.5rem" }}>
            Write the question wording.
          </p>
          <p style={{ fontSize: "0.72rem", color: text3, fontStyle: "italic", marginBottom: "1rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
            ✨ AI suggestions coming soon — type your wording for now.
          </p>
          <textarea
            style={{ ...S.textarea, fontFamily: "'Georgia',serif", minHeight: "120px" }}
            placeholder="Question wording"
            value={draft.wording}
            onChange={(e) => eg.setWording(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            <Back to="chapter" />
            <Next to="details" disabled={!draft.wording.trim()} />
          </div>
        </div>
      )}

      {/* STEP: details (Phase A stub) ---------------------------------------- */}
      {step === "details" && (
        <div style={S.card}>
          <h2 style={S.h2}>4 · Function / details</h2>
          <p style={{ ...S.sub, marginBottom: "0.5rem" }}>
            Add the specifics this question needs (base, evaluation point, coefficients…).
          </p>
          <p style={{ fontSize: "0.72rem", color: text3, fontStyle: "italic", marginBottom: "1rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
            ✨ AI suggestions coming soon — type the details for now.
          </p>
          <textarea
            style={{ ...S.textarea, fontFamily: "'Georgia',serif", minHeight: "100px" }}
            placeholder="Function / details"
            value={draft.details}
            onChange={(e) => eg.setDetails(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            <Back to="wording" />
            <button style={S.btn(green1)} onClick={() => eg.commitDraft()}>
              {eg.editingId != null ? "Save changes" : "Add to draft list ✓"}
            </button>
          </div>
        </div>
      )}

      {/* STEP: draft list ----------------------------------------------------- */}
      {step === "list" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <h2 style={{ ...S.h2, marginBottom: 0 }}>
              Draft questions {drafts.length > 0 && <span style={{ color: text3, fontWeight: 400 }}>({drafts.length})</span>}
            </h2>
            <button style={S.btn(green1)} onClick={() => eg.startNewQuestion()}>Add Question +</button>
          </div>

          {drafts.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", color: text3 }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>🧭</div>
              <div style={{ fontSize: "0.9rem", color: text2, fontFamily: "'Inter',system-ui,sans-serif" }}>
                No questions yet. Click <strong>Add Question +</strong> to compose your first one.
              </div>
            </div>
          ) : (
            drafts.map((q, i) => (
              <div key={q.id} style={S.qCard}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{
                    flexShrink: 0, width: "30px", height: "30px", borderRadius: "8px",
                    background: green1 + "14", color: green1, display: "flex",
                    alignItems: "center", justifyContent: "center", fontWeight: "700",
                    fontSize: "0.8rem", fontFamily: "'Inter',system-ui,sans-serif",
                  }}>Q{i + 1}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.qMeta}>
                      <span style={S.tag(green1)}>{typeLabel(q.type)}</span>
                      <span>{q.chapter || "—"}{q.section ? ` · ${q.section}` : " · whole chapter"}</span>
                    </div>
                    <div style={{ ...S.qText, marginBottom: q.details ? "0.3rem" : 0 }}>
                      {q.wording || <span style={{ color: text3, fontStyle: "italic" }}>No wording</span>}
                    </div>
                    {q.details && (
                      <div style={{ fontSize: "0.75rem", color: text2, fontFamily: "'Inter',system-ui,sans-serif" }}>
                        {q.details}
                      </div>
                    )}
                  </div>

                  {/* Row actions */}
                  <div style={{ display: "flex", flexShrink: 0, gap: "0.3rem", alignItems: "center" }}>
                    <button title="Move up" style={{ ...S.smBtn, opacity: i === 0 ? 0.4 : 1 }}
                      disabled={i === 0} onClick={() => eg.reorderDraft(i, i - 1)}>↑</button>
                    <button title="Move down" style={{ ...S.smBtn, opacity: i === drafts.length - 1 ? 0.4 : 1 }}
                      disabled={i === drafts.length - 1} onClick={() => eg.reorderDraft(i, i + 1)}>↓</button>
                    <button style={S.ghostBtn(green1)} onClick={() => eg.editDraft(q.id)}>Edit</button>
                    <button style={S.ghostBtn("#9B1C1C")} onClick={() => eg.deleteDraft(q.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Build Exam — wired in Phase B */}
          <hr style={S.divider} />
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button style={S.btn(green1, true)} disabled>Build Exam</button>
            <span style={{ fontSize: "0.75rem", color: text3, fontStyle: "italic", fontFamily: "'Inter',system-ui,sans-serif" }}>
              Wired up in the next step.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
