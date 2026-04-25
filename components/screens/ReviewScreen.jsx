"use client";
import QuestionCard from "../question/QuestionCard.jsx";

export default function ReviewScreen({
  lastGenerated,
  dupWarnings,
  accent,
  courseColors,
  S,
  text1,
  text2,
  text3,
  border,
  setScreen,
  setSelectedForExam,
  validateQuestion,
}) {
  return (
    <div>
      <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
        <div>
          <h1 style={S.h1}>Review Generated Questions</h1>
          <p style={S.sub}>{lastGenerated.length} questions generated and saved to your bank.</p>
        </div>
        <div style={{display:"flex", gap:"0.5rem", flexShrink:0}}>
          <button style={{...S.oBtn(text2), fontSize:"0.75rem"}} onClick={() => setScreen("generate")}>← Generate More</button>
          <button style={{...S.oBtn(accent), fontSize:"0.75rem"}} onClick={() => setScreen("bank")}>Browse Bank →</button>
          <button style={{...S.btn("#8b5cf6", false), fontSize:"0.75rem"}} onClick={() => {
            const ids = lastGenerated.map(q => q.id).filter(Boolean);
            if (ids.length) setSelectedForExam(prev => [...new Set([...prev, ...ids])]);
            setScreen("versions");
          }}>Build Exam →</button>
        </div>
      </div>

      {lastGenerated.length === 0 && (
        <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
          <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>✨</div>
          <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>No questions to review</div>
          <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
            Generate questions first, then paste the JSON here to review them before saving to your bank.
          </div>
          <button style={S.btn(accent, false)} onClick={() => setScreen("generate")}>✦ Generate Questions</button>
        </div>
      )}

      {dupWarnings.length > 0 && (
        <div style={{...S.card, borderColor:"#f59e0b44", background:"#f59e0b08", marginBottom:"1rem"}}>
          <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"600", marginBottom:"0.4rem"}}>⚠ Possible duplicates detected (same section)</div>
          {dupWarnings.map((w, i) => (
            <div key={i} style={{fontSize:"0.72rem", color:text2, marginBottom:"0.2rem"}}>• {w}</div>
          ))}
          <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.4rem"}}>These questions were still saved — review and delete if needed.</div>
        </div>
      )}

      {lastGenerated.map((q, qi) => (
        <QuestionCard
          key={q.id || qi}
          q={q}
          index={qi + 1}
          issues={validateQuestion(q)}
          authorMode={true}
          S={S}
          accent={courseColors[q.course]}
          text1={text1}
          text2={text2}
          text3={text3}
          border={border}
        />
      ))}
    </div>
  );
}
