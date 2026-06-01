"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAppContext } from "../../context/AppContext.js";
import { makeStyles, text1, text2, text3, border, bg1, bg2, bg0, green1 } from "../../lib/theme.js";
import { EG_TYPES } from "../../hooks/useExamGenerator.js";
import { buildExamGeneratorPrompt } from "../../lib/prompts/index.js";
import {
  getWordingSuggestions,
  buildWordingSuggestionPrompt,
  parseWordingSuggestions,
} from "../../lib/suggestions/wordingSuggestions.js";

// Friendly label for a suggestion's provenance badge.
const WS_SOURCE_LABEL = { template: "textbook", bank: "your bank", grounding: "style", ai: "AI" };

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

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
  const router = useRouter();
  const S = makeStyles(green1);
  const eg = ctx.examGenerator;
  const { step, setStep, draft, drafts } = eg;
  const [building, setBuilding] = useState(false);

  // Option data comes from the existing generate flow — never hardcoded here.
  const course = ctx.course;
  const allCourses = ctx.allCourses || {};
  const chapters = ctx.chapters || [];
  const courseNames = Object.keys(allCourses);
  const selectedChapter = chapters.find(c => c.title === draft.chapter) || null;
  const sections = selectedChapter?.sections || [];
  const bank = ctx.bank?.bank || [];

  // --- Wording suggestions (additive; the textarea path is never blocked) -----
  const wsSection = draft.section;
  const [wsLoading, setWsLoading] = useState(false);
  const [wsSuggestions, setWsSuggestions] = useState([]);
  const [wsNeedsFallback, setWsNeedsFallback] = useState(false);
  const [wsShowFallback, setWsShowFallback] = useState(false);
  const [wsPaste, setWsPaste] = useState("");

  // Fetch suggestions once when the wording step opens with a known section.
  // Deliberately keyed only on step+course+section so it doesn't re-run as the
  // user types or as the bank array identity changes.
  useEffect(() => {
    if (step !== "wording" || !course || !wsSection) {
      setWsSuggestions([]);
      setWsNeedsFallback(false);
      setWsShowFallback(false);
      return;
    }
    let cancelled = false;
    setWsLoading(true);
    setWsShowFallback(false);
    getWordingSuggestions(course, wsSection, { bank, supabase: getSupabase() })
      .then(res => {
        if (cancelled) return;
        setWsSuggestions(res.suggestions || []);
        setWsNeedsFallback(!!res.needsFallback);
      })
      .catch(() => {
        if (cancelled) return;
        setWsSuggestions([]);
        setWsNeedsFallback(true);
      })
      .finally(() => { if (!cancelled) setWsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, course, wsSection]);

  // Parse pasted AI suggestions and append any new ones as more chips.
  function applyPastedWordingSuggestions() {
    const parsed = parseWordingSuggestions(wsPaste);
    if (parsed.length === 0) return;
    setWsSuggestions(prev => {
      const seen = new Set(prev.map(s => s.text.trim().toLowerCase()));
      const adds = [];
      for (const t of parsed) {
        const key = t.trim().toLowerCase();
        if (key && !seen.has(key)) { seen.add(key); adds.push({ text: t, source: "ai" }); }
      }
      return [...prev, ...adds];
    });
    setWsPaste("");
  }

  // Section gate (Phase B): drafts may hold a blank/chapter-wide section, but
  // every question needs a concrete section before Build — the prompt and the
  // bank row both require one. Surface the first offending question by index.
  const missingSectionIdx = drafts.findIndex(d => !d.section || !String(d.section).trim());
  const hasMissingSection = missingSectionIdx !== -1;
  const canBuild = drafts.length > 0 && !!course && !hasMissingSection && !building;
  const buildReason =
    drafts.length === 0 ? "Add at least one question first."
    : !course ? "Pick a course (on a question's Topic step) before building."
    : hasMissingSection ? `Q${missingSectionIdx + 1} needs a section — tap to fix.`
    : null;

  // Assemble the wizard's draft list into the existing single-generation
  // pipeline: build the TIGHT prompt, set the SHARED generate state exactly as
  // useGenerate.triggerGenerate does, then route to the Generate screen's
  // prompt+paste panel. handlePaste's "generate" branch does the rest
  // (parse → sanitize → uid → upsert → setBank prepend → seed versions[A]).
  async function handleBuild() {
    if (!canBuild) return;
    setBuilding(true);
    try {
      const prompt = await buildExamGeneratorPrompt(drafts, course, ctx.courseObject, getSupabase());
      ctx.generate.setGeneratedPrompt(prompt);
      ctx.generate.setPendingType("generate");
      ctx.generate.setPendingMeta({ course });
      ctx.generate.setPasteInput("");
      ctx.generate.setPasteError("");
      router.push("/app/generate");
    } catch (e) {
      console.error("Exam Generator build error:", e);
      setBuilding(false);
    }
  }

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

      {/* STEP: wording -------------------------------------------------------- */}
      {step === "wording" && (
        <div style={S.card}>
          <h2 style={S.h2}>3 · Wording</h2>
          <p style={{ ...S.sub, marginBottom: "0.75rem" }}>
            Write the question wording — or tap a suggestion to start from a concrete example, then edit.
          </p>

          {/* Suggestion chips (above the textarea; never block it) */}
          {!wsSection ? (
            <p style={{ fontSize: "0.72rem", color: text3, fontStyle: "italic", marginBottom: "1rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
              Pick a section on the Topic step for tailored wording suggestions.
            </p>
          ) : wsLoading ? (
            <p style={{ fontSize: "0.72rem", color: text3, marginBottom: "1rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
              Loading suggestions…
            </p>
          ) : wsSuggestions.length > 0 ? (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.5rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
                ✨ Suggested wordings — tap to use:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {wsSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => eg.setWording(s.text)}
                    title="Use this wording"
                    style={{
                      textAlign: "left", cursor: "pointer",
                      background: bg2, border: "1px solid " + border,
                      borderRadius: "10px", padding: "0.55rem 0.75rem",
                      color: text1, fontSize: "0.8rem", lineHeight: 1.4,
                      fontFamily: "'Georgia',serif", transition: "all 0.15s",
                      display: "flex", alignItems: "flex-start", gap: "0.5rem",
                    }}
                  >
                    <span style={{
                      flexShrink: 0, marginTop: "0.1rem", fontSize: "0.6rem", fontWeight: 700,
                      color: green1, background: green1 + "14", borderRadius: "6px",
                      padding: "0.1rem 0.35rem", fontFamily: "'Inter',system-ui,sans-serif",
                      textTransform: "uppercase", letterSpacing: "0.02em",
                    }}>{WS_SOURCE_LABEL[s.source] || s.source}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "0.72rem", color: text3, fontStyle: "italic", marginBottom: "1rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
              No saved suggestions for this section yet — type your own below, or use ✨ AI suggest.
            </p>
          )}

          {/* AI fallback: copy a prompt, paste back stems → more chips */}
          {wsSection && (
            <div style={{ marginBottom: "1rem" }}>
              {!wsShowFallback ? (
                <button
                  style={{ ...S.oBtn(green1), fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}
                  onClick={() => setWsShowFallback(true)}
                >
                  ✨ AI suggest{wsNeedsFallback ? " (recommended)" : ""}
                </button>
              ) : (
                <div style={{ border: "1px dashed " + border, borderRadius: "12px", padding: "0.9rem", background: bg1 }}>
                  <div style={{ fontSize: "0.72rem", color: text2, marginBottom: "0.5rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
                    Copy this prompt into Claude, then paste the JSON array of stems back below.
                  </div>
                  <div style={{ ...S.promptBox, maxHeight: "160px", overflow: "auto" }}>
                    {buildWordingSuggestionPrompt(course, wsSection, "")}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0", flexWrap: "wrap" }}>
                    <button
                      style={{ ...S.oBtn(green1), fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}
                      onClick={() => navigator.clipboard.writeText(buildWordingSuggestionPrompt(course, wsSection, ""))}
                    >
                      📋 Copy Prompt
                    </button>
                    <button
                      style={{ ...S.oBtn(text2), borderColor: border, fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}
                      onClick={() => { setWsShowFallback(false); setWsPaste(""); }}
                    >
                      Close
                    </button>
                  </div>
                  <textarea
                    style={{ ...S.textarea, minHeight: "70px", fontFamily: "monospace", fontSize: "0.75rem" }}
                    placeholder={`Paste Claude's JSON array here, e.g. ["Find ...", "Compute ..."]`}
                    value={wsPaste}
                    onChange={(e) => setWsPaste(e.target.value)}
                  />
                  <button
                    style={{ ...S.btn(green1, !parseWordingSuggestions(wsPaste).length), fontSize: "0.75rem", padding: "0.4rem 0.8rem", marginTop: "0.4rem" }}
                    disabled={!parseWordingSuggestions(wsPaste).length}
                    onClick={applyPastedWordingSuggestions}
                  >
                    Add as suggestions
                  </button>
                </div>
              )}
            </div>
          )}

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
                      <span>{q.chapter || "—"}{q.section ? ` · ${q.section}` : ""}</span>
                      {(!q.section || !String(q.section).trim()) && (
                        <span style={{ ...S.tag("#9B1C1C"), cursor: "pointer" }} onClick={() => eg.editDraft(q.id)}>
                          ⚠ needs section
                        </span>
                      )}
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

          {/* Build Exam — assembles a TIGHT generate prompt and routes to the
              Generate screen's copy-paste panel (admin path). */}
          <hr style={S.divider} />
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button style={S.btn(green1, !canBuild)} disabled={!canBuild} onClick={handleBuild}>
              {building ? "Building…" : "Build Exam"}
            </button>
            {buildReason && (
              <span
                onClick={hasMissingSection ? () => eg.editDraft(drafts[missingSectionIdx].id) : undefined}
                style={{
                  fontSize: "0.75rem", color: hasMissingSection ? "#9B1C1C" : text3,
                  fontStyle: "italic", fontFamily: "'Inter',system-ui,sans-serif",
                  cursor: hasMissingSection ? "pointer" : "default",
                  textDecoration: hasMissingSection ? "underline" : "none",
                }}>
                {buildReason}
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.7rem", color: text3, marginTop: "0.75rem", fontFamily: "'Inter',system-ui,sans-serif" }}>
            Build assembles your questions into a prompt and opens the Generate panel,
            where you copy it to Claude and paste the result back — the questions then
            land in the bank and seed a master exam, exactly like the manual flow.
          </p>
        </div>
      )}
    </div>
  );
}
