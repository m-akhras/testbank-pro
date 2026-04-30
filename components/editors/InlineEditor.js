"use client";
import { useState } from "react";
import { stripChoiceLabel, isGraphChoice } from "../../lib/utils/questions.js";
import GraphChoice from "../display/GraphChoice.jsx";

const bg2    = "#F7F2E9";
const border = "#D9D0C0";
const text1  = "#1C1A16";
const text2  = "#6B6355";
const text3  = "#A89E8E";

// Strip-or-pass: leave graph-choice objects untouched, strip the leading
// "A) " prefix off plain string choices.
function _normalizeSeed(c) {
  return isGraphChoice(c) ? c : stripChoiceLabel(c);
}

export default function InlineEditor({ q, onSave, onSaveAll, onClose }) {
  const [question,  setQuestion]  = useState(q.question  || "");
  const [choices,   setChoices]   = useState(q.choices   ? q.choices.map(_normalizeSeed) : []);
  const [answer,    setAnswer]    = useState(stripChoiceLabel(q.answer || ""));
  const [explanation, setExplanation] = useState(q.explanation || "");
  const [saving,    setSaving]    = useState(false);

  const inp = (val, set, ph, rows) => rows
    ? <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={rows}
        style={{width:"100%", padding:"0.4rem 0.6rem", background:bg2, border:"1px solid "+border,
          color:text1, borderRadius:"6px", fontSize:"0.82rem", resize:"vertical",
          lineHeight:1.5, fontFamily:"inherit", boxSizing:"border-box"}} />
    : <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
        style={{width:"100%", padding:"0.35rem 0.6rem", background:bg2, border:"1px solid "+border,
          color:text1, borderRadius:"6px", fontSize:"0.82rem", fontFamily:"inherit", boxSizing:"border-box"}} />;

  const lbl = (t) => <div style={{fontSize:"0.68rem", color:text2, textTransform:"uppercase",
    letterSpacing:"0.1em", fontWeight:"600", marginBottom:"0.3rem", marginTop:"0.75rem"}}>{t}</div>;

  const handleSave = async () => {
    setSaving(true);
    let updated = { ...q, question, answer, explanation };
    if (choices.length) updated.choices = choices;
    await onSave(updated);
    setSaving(false);
  };

  // Graph-choice MCQs store the answer as a single letter; the highlight
  // logic compares per-row by letter for graph choices and by text for
  // string choices.
  const isLetterAnswer = /^[A-Ha-h]$/.test(String(answer || "").trim());

  return (
    <div style={{marginTop:"0.75rem", padding:"1rem", background:"#1B4332",
      border:"1px solid "+border, borderRadius:"8px", borderLeft:"3px solid #60a5fa"}}>
      <div style={{fontSize:"0.75rem", color:"#185FA5", fontWeight:"700", marginBottom:"0.75rem",
        display:"flex", alignItems:"center", gap:"0.5rem"}}>
        ✏️ Edit Question
        <span style={{fontSize:"0.65rem", color:text3, fontWeight:"400"}}>— changes save to Supabase</span>
      </div>

      {lbl("Question Text")}
      {inp(question, setQuestion, "Question text...", 3)}

      {choices.length > 0 && (<>
        {lbl("Answer Choices")}
        {choices.map((c, ci) => {
          const letter = String.fromCharCode(65+ci);
          const isGraph = isGraphChoice(c);
          const isCorrect = isGraph ? (isLetterAnswer && answer.toUpperCase() === letter) : answer === c;
          return (
            <div key={ci} style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem"}}>
              <button onClick={() => setAnswer(isGraph ? letter : c)}
                style={{flexShrink:0, width:"24px", height:"24px", borderRadius:"50%", border:"none",
                  cursor:"pointer", fontSize:"0.7rem", fontWeight:"700",
                  background: isCorrect ? "#10b981" : border,
                  color: isCorrect ? "#fff" : "#4a6fa5"}}>
                {letter}
              </button>
              {isGraph ? (
                <div style={{flex:1, display:"flex", alignItems:"center", gap:"0.5rem",
                    padding:"0.3rem 0.5rem", background:bg2, border:"1px solid "+(isCorrect?"#10b981":border),
                    borderRadius:"5px"}}>
                  <GraphChoice config={c.graphConfig} width={150} height={140} />
                  <span style={{fontSize:"0.65rem", color:text3}}>graph choice — edit graphConfig in JSON to change</span>
                </div>
              ) : (
                <input value={c} onChange={e => { const nc=[...choices]; nc[ci]=e.target.value; setChoices(nc);
                    if (answer===c) setAnswer(e.target.value); }}
                  style={{flex:1, padding:"0.3rem 0.5rem", background:bg2,
                    border:"1px solid "+(isCorrect?"#10b981":border),
                    color:text1, borderRadius:"5px", fontSize:"0.8rem"}} />
              )}
            </div>
          );
        })}
        <div style={{fontSize:"0.65rem", color:text3, marginTop:"0.3rem"}}>
          Click a letter to mark as correct answer · Currently: <span style={{color:"#10b981"}}>{answer || "none selected"}</span>
        </div>
      </>)}

      {!choices.length && (<>
        {lbl("Answer")}
        {inp(answer, setAnswer, "Answer...")}
      </>)}

      {lbl("Solution Steps (answer key)")}
      {q.type === "Free Response" || q.type === "Short Answer" ? (
        <div style={{marginBottom:"0.35rem"}}>
          <div style={{fontSize:"0.63rem", color:text3, marginBottom:"0.3rem", lineHeight:1.5}}>
            One math line per line — no prose. Prose lines (starting with "Use", "Thus", "Let", etc.) are auto-filtered out.
            <span style={{color:"#10b981", marginLeft:"0.4rem"}}>Example: = (10)/(s^3) - (6)/(s^2) + (4)/(s)</span>
          </div>
          {inp(explanation, setExplanation, "= ...\n= ...", 5)}
        </div>
      ) : (
        inp(explanation, setExplanation, "Step-by-step explanation...", 2)
      )}

      <div style={{display:"flex", gap:"0.5rem", marginTop:"0.85rem"}}>
        <button onClick={handleSave} disabled={saving}
          style={{padding:"0.35rem 0.9rem", background:"#2D6A4F", color:"#fff",
            border:"none", borderRadius:"6px", fontSize:"0.78rem", fontWeight:"600",
            cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1}}>
          {saving ? "Saving…" : "✓ Save Changes"}
        </button>
        {onSaveAll && (
          <button onClick={() => onSaveAll({question, choices, answer, explanation})}
            style={{padding:"0.35rem 0.9rem", background:"#8b5cf6", color:"#fff",
              border:"none", borderRadius:"6px", fontSize:"0.78rem", fontWeight:"600", cursor:"pointer"}}>
            Push to All Versions
          </button>
        )}
        <button onClick={onClose}
          style={{padding:"0.35rem 0.8rem", background:"transparent", color:text2,
            border:"1px solid #D9D0C0", borderRadius:"6px", fontSize:"0.78rem", cursor:"pointer"}}>
          Cancel
        </button>
      </div>
    </div>
  );
}
