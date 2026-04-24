"use client";
import GraphDisplay from "../display/GraphDisplay.js";
import MathText from "../display/MathText.js";
import { S, text1, text2, text3, border } from "../../styles/theme.js";

export default function ReviewScreen({
  setScreen,
  lastGenerated,
  setSelectedForExam,
  dupWarnings,
  validateQuestion,
  courseColors,
  accent,
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
          {dupWarnings.map((w,i) => (
            <div key={i} style={{fontSize:"0.72rem", color:text2, marginBottom:"0.2rem"}}>• {w}</div>
          ))}
          <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.4rem"}}>These questions were still saved — review and delete if needed.</div>
        </div>
      )}
      {lastGenerated.map((q, qi) => (
        <div key={q.id || qi} style={S.qCard}>
          {(() => { const issues = validateQuestion(q); return (
          <div style={S.qMeta}>
            <span>Q{qi+1}</span>
            <span style={S.tag(courseColors[q.course])}>{q.course}</span>
            <span style={S.tag()}>{q.type}</span>
            <span style={S.tag()}>{q.section}</span>
            <span style={S.tag()}>{q.difficulty}</span>
            {issues.length > 0 && (
              <span title={issues.join("\n")} style={{marginLeft:"auto", cursor:"help",
                background:"#7c2d12", color:"#9B1C1C", fontSize:"0.68rem", fontWeight:"600",
                padding:"0.1rem 0.4rem", borderRadius:"4px", whiteSpace:"nowrap"}}>
                ⚠️ {issues.length} issue{issues.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          ); })()}
          {q.hasGraph && q.graphConfig && (
            <GraphDisplay graphConfig={q.graphConfig} authorMode={true} />
          )}
          {q.type === "Branched" ? (
            <>
              <div style={{...S.qText, color:accent+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
              {(q.parts||[]).map((p,pi) => (
                <div key={pi} style={{marginBottom:"0.6rem", paddingLeft:"0.75rem", borderLeft:"2px solid "+border}}>
                  <div style={{fontSize:"0.7rem", color:text3, marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                  <div style={S.qText}><MathText>{p.question}</MathText></div>
                  {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                  {p.explanation && <div style={S.expl}>💡 <MathText>{p.explanation}</MathText></div>}
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={S.qText}><MathText>{q.question}</MathText></div>
              {q.choices && <ul style={S.cList}>{q.choices.map((c,ci) => <li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
              {q.answer && <div style={S.ans}>✓ <MathText>{q.answer}</MathText></div>}
              {q.explanation && <div style={S.expl}>💡 <MathText>{q.explanation}</MathText></div>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
