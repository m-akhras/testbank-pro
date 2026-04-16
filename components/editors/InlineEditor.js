"use client";
import { useState } from "react";

const bg2    = "#F7F2E9";
const border = "#D9D0C0";
const text1  = "#1C1A16";
const text2  = "#6B6355";
const text3  = "#A89E8E";

export default function InlineEditor({ q, onSave, onClose }) {
  const [question,  setQuestion]  = useState(q.question  || "");
  const [stem,      setStem]      = useState(q.stem      || "");
  const [choices,   setChoices]   = useState(q.choices   ? [...q.choices] : []);
  const [answer,    setAnswer]    = useState(q.answer    || "");
  const [explanation, setExplanation] = useState(q.explanation || "");
  const [parts,     setParts]     = useState(q.parts     ? q.parts.map(p => ({...p})) : []);
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
    if (q.type === "Branched") updated = { ...updated, stem, parts };
    await onSave(updated);
    setSaving(false);
  };

  return (
    <div style={{marginTop:"0.75rem", padding:"1rem", background:"#1B4332",
      border:"1px solid "+border, borderRadius:"8px", borderLeft:"3px solid #60a5fa"}}>
      <div style={{fontSize:"0.75rem", color:"#185FA5", fontWeight:"700", marginBottom:"0.75rem",
        display:"flex", alignItems:"center", gap:"0.5rem"}}>
        ✏️ Edit Question
        <span style={{fontSize:"0.65rem", color:text3, fontWeight:"400"}}>— changes save to Supabase</span>
      </div>

      {q.type === "Branched" ? (<>
        {lbl("Given (stem)")}
        {inp(stem, setStem, "Shared context for all parts...", 2)}
        {parts.map((p, pi) => (
          <div key={pi} style={{marginTop:"0.75rem", paddingLeft:"0.75rem", borderLeft:"2px solid #1e3a5f"}}>
            <div style={{fontSize:"0.68rem", color:text2, marginBottom:"0.3rem"}}>Part ({String.fromCharCode(97+pi)})</div>
            {inp(p.question, (v) => { const np=[...parts]; np[pi]={...np[pi],question:v}; setParts(np); }, "Question text...", 2)}
            <div style={{fontSize:"0.65rem", color:text2, margin:"0.3rem 0 0.2rem"}}>Answer</div>
            {inp(p.answer, (v) => { const np=[...parts]; np[pi]={...np[pi],answer:v}; setParts(np); }, "Answer...")}
            <div style={{fontSize:"0.65rem", color:text2, margin:"0.3rem 0 0.2rem"}}>Solution steps (math lines only, one per line)</div>
            {inp(p.explanation||"", (v) => { const np=[...parts]; np[pi]={...np[pi],explanation:v}; setParts(np); }, "= (10)/(s^3) - (6)/(s^2) + (4)/(s)", 3)}
          </div>
        ))}
      </>) : (<>
        {lbl("Question Text")}
        {inp(question, setQuestion, "Question text...", 3)}

        {choices.length > 0 && (<>
          {lbl("Answer Choices")}
          {choices.map((c, ci) => (
            <div key={ci} style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem"}}>
              <button onClick={() => setAnswer(c)}
                style={{flexShrink:0, width:"24px", height:"24px", borderRadius:"50%", border:"none",
                  cursor:"pointer", fontSize:"0.7rem", fontWeight:"700",
                  background: answer===c ? "#10b981" : border,
                  color: answer===c ? "#fff" : "#4a6fa5"}}>
                {String.fromCharCode(65+ci)}
              </button>
              <input value={c} onChange={e => { const nc=[...choices]; nc[ci]=e.target.value; setChoices(nc);
                  if (answer===c) setAnswer(e.target.value); }}
                style={{flex:1, padding:"0.3rem 0.5rem", background:bg2,
                  border:"1px solid "+(answer===c?"#10b981":border),
                  color:text1, borderRadius:"5px", fontSize:"0.8rem"}} />
            </div>
          ))}
          <div style={{fontSize:"0.65rem", color:text3, marginTop:"0.3rem"}}>
            Click a letter to mark as correct answer · Currently: <span style={{color:"#10b981"}}>{answer || "none selected"}</span>
          </div>
        </>)}

        {!choices.length && (<>
          {lbl("Answer")}
          {inp(answer, setAnswer, "Answer...")}
        </>)}
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
        <button onClick={onClose}
          style={{padding:"0.35rem 0.8rem", background:"transparent", color:text2,
            border:"1px solid #D9D0C0", borderRadius:"6px", fontSize:"0.78rem", cursor:"pointer"}}>
          Cancel
        </button>
      </div>
    </div>
  );
}
