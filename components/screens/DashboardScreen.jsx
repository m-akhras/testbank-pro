"use client";
import CustomCourseBuilder from "../editors/CustomCourseBuilder.js";

export default function DashboardScreen({
  bank,
  bankLoaded,
  bankIssueCount,
  lastGenerated,
  savedExams,
  course,
  allCourses,
  courseColors,
  accent,
  exportHighlight,
  setExportHighlight,
  customCourses,
  S,
  text1,
  text2,
  text3,
  border,
  bg1,
  setCourse,
  setSelectedSections,
  setSectionCounts,
  setSectionConfig,
  setScreen,
  setFilterIssuesOnly,
  saveCustomCourse,
  deleteCustomCourse,
  isAdmin,
}) {
  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:"2.5rem"}}>
        <h1 style={{...S.h1, fontSize:"2rem", marginBottom:"0.3rem"}}>Dashboard</h1>
        <p style={{...S.sub, fontSize:"0.85rem"}}>Welcome back — your exam authoring workspace.</p>
      </div>

      {/* Workflow strip */}
      <div style={{marginBottom:"2.5rem"}}>
        <div style={{fontSize:"0.6rem", color:text3, textTransform:"uppercase", letterSpacing:"0.18em", fontWeight:"700", marginBottom:"1rem", fontFamily:"'Inter',system-ui,sans-serif"}}>Your Workflow</div>
        <div style={{display:"flex", gap:"0.5rem", alignItems:"stretch"}}>
          {[
            { step:"1", label:"Generate", sub:"Create with AI", sc:"generate", color:"#2D6A4F", icon:"✦" },
            { step:"2", label:"Review", sub:"Check & save", sc:"review", color:"#92400E", icon:"◎", badge: lastGenerated.length || 0 },
            { step:"3", label:"Build Exam", sub:"Select & version", sc:"versions", color:"#7C3AED", icon:"⊞" },
            { step:"4", label:"Export", sub:"Word · QTI · Print", sc:"export", color:"#185FA5", icon:"⬇" },
          ].map((s, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", flex:1, gap:"0.5rem"}}>
              <div onClick={() => {
                if (s.sc === "export") { setScreen("versions"); setExportHighlight(true); setTimeout(() => setExportHighlight(false), 2500); }
                else setScreen(s.sc);
              }} style={{
                flex:1, padding:"1rem 1.1rem", borderRadius:"12px", cursor:"pointer",
                background:(s.sc === "export" ? exportHighlight : false) ? s.color+"12" : bg1,
                border:"1.5px solid "+((s.sc === "export" ? exportHighlight : false) ? s.color+"60" : border),
                transition:"all 0.15s", display:"flex", alignItems:"center", gap:"0.75rem"
              }}>
                <div style={{width:"34px", height:"34px", borderRadius:"9px", background:s.color+"15",
                  border:"1px solid "+s.color+"30", display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0, position:"relative"}}>
                  <span style={{fontSize:"0.85rem", color:s.color}}>{s.icon}</span>
                  <div style={{position:"absolute", top:"-7px", right:"-7px", width:"16px", height:"16px",
                    borderRadius:"50%", background:s.color, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:"0.55rem", fontWeight:"800", color:"#fff",
                    fontFamily:"'Inter',system-ui,sans-serif"}}>
                    {s.step}
                  </div>
                  {s.badge > 0 && (
                    <div style={{position:"absolute", top:"-7px", left:"-7px", width:"16px", height:"16px",
                      borderRadius:"50%", background:"#92400E", display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:"0.55rem", fontWeight:"800", color:"#fff",
                      fontFamily:"'Inter',system-ui,sans-serif"}}>
                      {s.badge}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{fontSize:"0.82rem", fontWeight:"700", color:text1, fontFamily:"'Inter',system-ui,sans-serif"}}>{s.label}</div>
                  <div style={{fontSize:"0.65rem", color:text3, marginTop:"1px", fontFamily:"'Inter',system-ui,sans-serif"}}>{s.sub}</div>
                </div>
              </div>
              {i < 3 && <div style={{color:text3, fontSize:"0.8rem", flexShrink:0}}>›</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Onboarding checklist */}
      {bankLoaded && bank.length === 0 && (
        <div style={{...S.card, borderColor:"#2D6A4F44", marginBottom:"2rem", background:"#052e1608"}}>
          <div style={{fontSize:"0.78rem", fontWeight:"700", color:"#2D6A4F", marginBottom:"0.75rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>
            🚀 Getting Started
          </div>
          {[
            { done: course !== null, label:"Select a course", action:() => setScreen("generate"), btn:"Go to Generate" },
            { done: bank.length > 0, label:"Generate your first questions", action:() => setScreen("generate"), btn:"Generate" },
            { done: savedExams.length > 0, label:"Build and save an exam", action:() => setScreen("versions"), btn:"Build Exam" },
          ].map((step, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.5rem"}}>
              <div style={{width:"20px", height:"20px", borderRadius:"50%", flexShrink:0,
                background: step.done ? "#2D6A4F" : "#EDE8DE",
                border: "1.5px solid " + (step.done ? "#2D6A4F" : border),
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"0.65rem", color:"#fff", fontWeight:"700"}}>
                {step.done ? "✓" : i+1}
              </div>
              <span style={{fontSize:"0.82rem", color: step.done ? text3 : text1, flex:1,
                textDecoration: step.done ? "line-through" : "none"}}>{step.label}</span>
              {!step.done && (
                <button onClick={step.action}
                  style={{fontSize:"0.72rem", padding:"0.2rem 0.65rem", background:"#2D6A4F",
                    color:"#fff", border:"none", borderRadius:"4px", cursor:"pointer", fontWeight:"600"}}>
                  {step.btn} →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"2.5rem"}}>
        {[
          { label:"Questions in Bank", value:bank.length, color:"#2D6A4F", bg:"#D1FAE5", action:() => setScreen("bank") },
          { label:"Pending Review", value:lastGenerated.length || 0, color:"#92400E", bg:"#FEF3C7", action:() => setScreen("review") },
          { label:"Issues Found", value:bankIssueCount, color:bankIssueCount>0?"#9B1C1C":"#2D6A4F", bg:bankIssueCount>0?"#FEE2E2":"#D1FAE5", action:() => { setFilterIssuesOnly(bankIssueCount > 0); setScreen("bank"); } },
        ].map((s, i) => (
          <div key={i} onClick={s.action} style={{
            background:bg1, border:"1px solid "+border, borderRadius:"14px",
            padding:"1.5rem 1.5rem 1.25rem", cursor:"pointer", transition:"border-color 0.15s",
            borderLeft:"4px solid "+s.color
          }}>
            <div style={{fontSize:"2.2rem", fontWeight:"800", color:s.color, letterSpacing:"-0.04em",
              fontFamily:"'Georgia',serif", lineHeight:1, marginBottom:"0.5rem"}}>{s.value}</div>
            <div style={{fontSize:"0.72rem", color:text2, fontFamily:"'Inter',system-ui,sans-serif", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:"600"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Courses */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"1.25rem"}}>
        <h2 style={S.h2}>Courses</h2>
        <button style={{...S.oBtn(accent), fontSize:"0.72rem", padding:"0.3rem 0.9rem"}} onClick={() => setScreen("generate")}>+ Generate Questions</button>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:"0.85rem", marginBottom:"2.5rem"}}>
        {Object.entries(allCourses).map(([name, { color, chapters }]) => {
          const qCount = bank.filter(q => q.course === name).length;
          return (
            <div key={name} onClick={() => { setCourse(name); setSelectedSections([]); setSectionCounts({}); setSectionConfig({}); setScreen("generate"); }}
              style={{
                background:bg1, borderRadius:"14px", padding:"1.25rem 1.25rem 1rem",
                border:"1px solid "+border, cursor:"pointer",
                borderBottom:"3px solid "+color, transition:"all 0.15s",
                display:"flex", flexDirection:"column", gap:"0.3rem"
              }}>
              <div style={{fontSize:"0.88rem", fontWeight:"700", color:text1, lineHeight:1.3, fontFamily:"'Georgia',serif"}}>{name}</div>
              <div style={{fontSize:"0.68rem", color:text3, fontFamily:"'Inter',system-ui,sans-serif"}}>{(chapters || []).length} chapters</div>
              {qCount > 0 && (
                <div style={{marginTop:"0.5rem", display:"inline-flex", alignItems:"center", gap:"0.35rem",
                  background:color+"12", border:"1px solid "+color+"30", borderRadius:"20px",
                  padding:"0.15rem 0.6rem", width:"fit-content"}}>
                  <div style={{width:"5px", height:"5px", borderRadius:"50%", background:color, flexShrink:0}}/>
                  <span style={{fontSize:"0.65rem", color:color, fontWeight:"600", fontFamily:"'Inter',system-ui,sans-serif"}}>{qCount} questions</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Course Builder */}
      <CustomCourseBuilder
        customCourses={customCourses}
        onSave={saveCustomCourse}
        onDelete={deleteCustomCourse}
        text1={text1} text2={text2} text3={text3} border={border} bg1={bg1} S={S}
        isAdmin={isAdmin}
      />

      {/* Recent questions */}
      {bank.length > 0 && (
        <div style={{marginTop:"2rem"}}>
          <h2 style={{...S.h2, marginBottom:"1rem"}}>Recent Questions</h2>
          <div style={{display:"flex", flexDirection:"column", gap:"0"}}>
            {bank.slice(0, 5).map((q, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:"1rem",
                padding:"0.85rem 0",
                borderBottom: i < 4 ? "1px solid "+border+"88" : "none",
              }}>
                <div style={{flexShrink:0, width:"32px", height:"32px", borderRadius:"8px",
                  background:(courseColors[q.course]||accent)+"18",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"0.65rem", color:courseColors[q.course]||accent, fontWeight:"800",
                  fontFamily:"'Inter',system-ui,sans-serif"}}>
                  {(q.section||"?").split(" ")[0]}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:"flex", gap:"0.4rem", marginBottom:"0.2rem", flexWrap:"wrap"}}>
                    <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                    <span style={S.diffTag(q.difficulty||"")}>{q.difficulty}</span>
                  </div>
                  <div style={{fontSize:"0.82rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"'Georgia',serif"}}>
                    {q.type==="Branched" ? q.stem : q.question}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button style={{...S.oBtn(text2), fontSize:"0.75rem", marginTop:"1rem"}} onClick={() => setScreen("bank")}>
            View all {bank.length} questions →
          </button>
        </div>
      )}
    </div>
  );
}
