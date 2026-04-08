import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink: #0d1117;
          --ink2: #3d4754;
          --ink3: #8896a8;
          --ink4: #b8c4d0;
          --paper: #f7f5f0;
          --paper2: #edeae3;
          --paper3: #e3dfd7;
          --accent: #10b981;
          --accent-dark: #059669;
          --accent-light: #d1fae5;
          --blue: #3b82f6;
          --red: #f43f5e;
          --amber: #f59e0b;
          --purple: #8b5cf6;
          --border: rgba(13,17,23,0.1);
          --border2: rgba(13,17,23,0.06);
        }

        html { scroll-behavior: smooth; }
        body {
          background: var(--paper);
          color: var(--ink);
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        .serif { font-family: 'Fraunces', serif; }

        /* NAV */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 4rem; height: 64px;
          background: rgba(247,245,240,0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }

        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-mark {
          width: 30px; height: 30px; border-radius: 8px;
          background: var(--ink); display: flex; align-items: center;
          justify-content: center; font-weight: 700; font-size: 0.8rem; color: #fff;
        }
        .logo-text { font-size: 0.95rem; font-weight: 500; color: var(--ink); letter-spacing: -0.2px; }
        .logo-text span { color: var(--accent-dark); }

        .nav-links { display: flex; align-items: center; gap: 2rem; }
        .nav-link { color: var(--ink2); text-decoration: none; font-size: 0.875rem; font-weight: 400; transition: color 0.2s; }
        .nav-link:hover { color: var(--ink); }
        .nav-btn {
          background: var(--ink); color: #fff; text-decoration: none;
          padding: 0.5rem 1.25rem; border-radius: 8px;
          font-size: 0.875rem; font-weight: 500; transition: all 0.2s;
        }
        .nav-btn:hover { background: #1e2530; }

        /* HERO */
        .hero {
          min-height: 100vh;
          display: grid; grid-template-columns: 1fr 1fr;
          align-items: center; gap: 4rem;
          padding: 8rem 4rem 4rem;
          max-width: 1300px; margin: 0 auto;
        }

        .hero-left { padding-right: 2rem; }

        .hero-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--accent-light); border-radius: 100px;
          padding: 0.3rem 0.9rem; font-size: 0.75rem; font-weight: 500;
          color: var(--accent-dark); margin-bottom: 2rem; letter-spacing: 0.02em;
        }

        .hero-tag::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent); animation: pulse 2s infinite;
        }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

        .hero h1 {
          font-size: clamp(2.8rem, 4.5vw, 4.5rem);
          font-weight: 300; line-height: 1.08;
          letter-spacing: -2px; margin-bottom: 1.5rem;
          color: var(--ink);
        }

        .hero h1 em { font-style: italic; color: var(--accent-dark); font-weight: 300; }

        .hero p {
          font-size: 1.05rem; color: var(--ink2);
          line-height: 1.75; font-weight: 300;
          margin-bottom: 2.5rem; max-width: 480px;
        }

        .hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

        .btn-primary {
          background: var(--ink); color: #fff; text-decoration: none;
          padding: 0.85rem 2rem; border-radius: 10px;
          font-size: 0.9rem; font-weight: 500; transition: all 0.2s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-primary:hover { background: #1e2530; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(13,17,23,0.15); }

        .btn-outline {
          background: transparent; color: var(--ink2); text-decoration: none;
          padding: 0.85rem 2rem; border-radius: 10px;
          font-size: 0.9rem; font-weight: 400; transition: all 0.2s;
          border: 1px solid var(--border);
        }
        .btn-outline:hover { border-color: var(--ink3); color: var(--ink); }

        /* APP MOCKUP */
        .hero-right { position: relative; }

        .mockup-shell {
          background: #0d1117; border-radius: 16px;
          box-shadow: 0 40px 80px rgba(13,17,23,0.2), 0 0 0 1px rgba(13,17,23,0.08);
          overflow: hidden;
        }

        .mockup-bar {
          background: #161b22; padding: 0.6rem 1rem;
          display: flex; align-items: center; gap: 6px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .mockup-dot { width: 10px; height: 10px; border-radius: 50%; }

        .mockup-body { padding: 0; display: flex; height: 340px; }

        .mock-sidebar {
          width: 180px; background: #0d1117;
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 1rem 0; flex-shrink: 0;
        }

        .mock-logo {
          display: flex; align-items: center; gap: 8px;
          padding: 0 1rem; margin-bottom: 1.5rem;
        }
        .mock-logo-mark { width: 24px; height: 24px; border-radius: 6px; background: #10b981; display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff; }
        .mock-logo-text { font-size: 0.72rem; font-weight: 600; color: #e8e8e0; }

        .mock-section { font-size: 0.55rem; font-weight: 600; color: #475569; letter-spacing: 0.1em; text-transform: uppercase; padding: 0 1rem; margin-bottom: 0.35rem; }

        .mock-nav-item {
          display: flex; align-items: center; gap: 8px;
          padding: 0.35rem 1rem; font-size: 0.65rem; color: #7899b8;
          cursor: pointer;
        }
        .mock-nav-item.active { background: rgba(16,185,129,0.08); color: #10b981; }
        .mock-nav-dot { width: 6px; height: 6px; border-radius: 1px; background: currentColor; opacity: 0.6; }

        .mock-main { flex: 1; padding: 1rem; overflow: hidden; background: #080c14; }

        .mock-header { margin-bottom: 0.75rem; }
        .mock-title { font-size: 0.8rem; font-weight: 700; color: #e8e8e0; margin-bottom: 0.2rem; }
        .mock-sub { font-size: 0.58rem; color: #475569; }

        .mock-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
        .mock-stat { background: #0d1321; border-radius: 8px; padding: 0.6rem; border: 1px solid rgba(255,255,255,0.05); }
        .mock-stat-val { font-size: 1rem; font-weight: 700; color: #10b981; }
        .mock-stat-label { font-size: 0.5rem; color: #475569; margin-top: 2px; }

        .mock-courses { display: grid; grid-template-columns: repeat(2,1fr); gap: 0.4rem; }
        .mock-course { background: #0d1321; border-radius: 6px; padding: 0.5rem; border: 1px solid rgba(255,255,255,0.05); border-top: 2px solid; }
        .mock-course-name { font-size: 0.6rem; font-weight: 600; color: #e8e8e0; }
        .mock-course-sub { font-size: 0.5rem; color: #475569; margin-top: 2px; }

        /* STATS */
        .stats-row {
          display: flex; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
          background: var(--paper2); margin: 0;
        }
        .stat-cell {
          flex: 1; padding: 2.5rem 2rem; text-align: center;
          border-right: 1px solid var(--border);
        }
        .stat-cell:last-child { border-right: none; }
        .stat-num { font-size: 2.5rem; font-weight: 300; font-family: 'Fraunces', serif; color: var(--ink); letter-spacing: -1px; line-height: 1; }
        .stat-num span { color: var(--accent-dark); }
        .stat-lbl { font-size: 0.72rem; color: var(--ink3); margin-top: 0.4rem; letter-spacing: 0.06em; text-transform: uppercase; }

        /* SECTIONS */
        .section { padding: 7rem 4rem; max-width: 1200px; margin: 0 auto; }

        .section-tag {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 0.72rem; font-weight: 500; color: var(--accent-dark);
          letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1.25rem;
        }
        .section-tag::before { content:''; width:16px; height:1px; background:var(--accent-dark); display:block; }

        .section-h2 { font-size: clamp(2rem,3.5vw,3rem); font-weight: 300; letter-spacing: -1px; line-height: 1.1; margin-bottom: 1.25rem; color: var(--ink); }
        .section-p { font-size: 1rem; color: var(--ink2); max-width: 500px; line-height: 1.75; font-weight: 300; }

        /* FEATURES */
        .features-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; margin-top: 5rem; }
        .features-layout.reverse { direction: rtl; }
        .features-layout.reverse > * { direction: ltr; }

        .feature-list { display: flex; flex-direction: column; gap: 1.5rem; }
        .feature-item { display: flex; gap: 1rem; align-items: flex-start; }
        .feature-icon {
          width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 1rem;
          background: var(--paper2); border: 1px solid var(--border);
        }
        .feature-content {}
        .feature-title { font-size: 0.95rem; font-weight: 500; color: var(--ink); margin-bottom: 0.3rem; }
        .feature-desc { font-size: 0.85rem; color: var(--ink2); line-height: 1.65; font-weight: 300; }

        /* BANK MOCKUP */
        .bank-mockup {
          background: #0d1117; border-radius: 14px;
          box-shadow: 0 32px 64px rgba(13,17,23,0.15), 0 0 0 1px rgba(13,17,23,0.08);
          overflow: hidden;
        }
        .bank-bar { background: #161b22; padding: 0.5rem 0.75rem; display:flex;align-items:center;gap:5px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .bank-body { padding: 0.75rem; }
        .bank-filters { display:flex; gap:0.4rem; margin-bottom:0.6rem; }
        .bank-filter { background:#1a2235; border-radius:4px; padding:0.2rem 0.5rem; font-size:0.5rem; color:#7899b8; }
        .bank-q { background:#0d1321; border-radius:6px; padding:0.6rem; margin-bottom:0.4rem; border:1px solid rgba(255,255,255,0.04); }
        .bank-q-meta { display:flex;gap:0.3rem;margin-bottom:0.3rem; }
        .bank-tag { border-radius:3px;padding:0.1rem 0.35rem;font-size:0.45rem;font-weight:600; }
        .bank-q-text { font-size:0.55rem;color:#e8e8e0;line-height:1.4; }
        .bank-q-ans { font-size:0.5rem;color:#10b981;margin-top:0.2rem; }

        /* EXPORT MOCKUP */
        .export-mockup {
          background: #fff; border-radius: 14px;
          box-shadow: 0 32px 64px rgba(13,17,23,0.1), 0 0 0 1px rgba(13,17,23,0.08);
          overflow: hidden; padding: 1.25rem;
        }
        .export-title { font-size: 0.75rem; font-weight: 700; color: #0d1117; margin-bottom: 0.75rem; border-bottom:1px solid #eee; padding-bottom:0.5rem; }
        .export-q { margin-bottom: 0.75rem; }
        .export-q-num { font-size:0.6rem;font-weight:700;color:#0d1117;margin-bottom:0.2rem; }
        .export-q-text { font-size:0.58rem;color:#333;line-height:1.5;margin-bottom:0.3rem; }
        .export-choice { font-size:0.55rem;color:#444;margin-bottom:0.15rem;padding-left:0.75rem; }
        .export-choice.correct { color:#059669;font-weight:600; }
        .export-frac { display:inline-flex;flex-direction:column;align-items:center;font-size:0.55rem;line-height:1.1;vertical-align:middle;margin:0 1px; }
        .export-frac-num { border-bottom:1px solid currentColor;padding:0 2px; }
        .export-frac-den { padding:0 2px; }

        /* WORKFLOW */
        .workflow { display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:4rem;position:relative; }
        .workflow::before { content:'';position:absolute;top:22px;left:10%;right:10%;height:1px;background:linear-gradient(90deg,var(--accent),var(--accent-light));z-index:0; }
        .wf-step { text-align:center;padding:0 1.5rem;position:relative;z-index:1; }
        .wf-num { width:44px;height:44px;border-radius:50%;border:1px solid var(--border);background:var(--paper);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:0.8rem;font-weight:500;color:var(--accent-dark); }
        .wf-title { font-size:0.9rem;font-weight:500;color:var(--ink);margin-bottom:0.4rem; }
        .wf-desc { font-size:0.8rem;color:var(--ink2);line-height:1.6;font-weight:300; }

        /* COURSES */
        .courses-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.75rem;margin-top:3rem; }
        .course-card { background:var(--paper2);border:1px solid var(--border);border-radius:10px;padding:1.25rem;transition:all 0.2s;border-top:3px solid; }
        .course-card:hover { background:var(--paper3);transform:translateY(-2px); }
        .course-name { font-size:0.85rem;font-weight:500;color:var(--ink); }
        .course-detail { font-size:0.72rem;color:var(--ink3);margin-top:0.25rem; }

        /* CTA */
        .cta-section { background:var(--ink);padding:7rem 4rem;text-align:center; }
        .cta-section h2 { font-size:clamp(2rem,4vw,3.5rem);font-weight:300;letter-spacing:-1.5px;color:#fff;margin-bottom:1rem; }
        .cta-section h2 em { font-style:italic;color:#34d399; }
        .cta-section p { color:#7899b8;font-size:1rem;margin-bottom:2.5rem;font-weight:300;max-width:480px;margin-left:auto;margin-right:auto;line-height:1.7; }
        .btn-light { background:#fff;color:var(--ink);text-decoration:none;padding:0.9rem 2.25rem;border-radius:10px;font-size:0.95rem;font-weight:500;transition:all 0.2s;display:inline-flex;align-items:center;gap:8px; }
        .btn-light:hover { background:#f0fdf4;transform:translateY(-1px); }
        .btn-ghost-light { background:transparent;color:#7899b8;text-decoration:none;padding:0.9rem 2.25rem;border-radius:10px;font-size:0.95rem;font-weight:400;transition:all 0.2s;border:1px solid rgba(255,255,255,0.15); }
        .btn-ghost-light:hover { border-color:rgba(255,255,255,0.3);color:#fff; }

        /* FOOTER */
        footer { background:var(--paper2);border-top:1px solid var(--border);padding:2rem 4rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem; }
        footer p { font-size:0.78rem;color:var(--ink3); }
        .footer-links { display:flex;gap:1.5rem; }
        .footer-links a { font-size:0.78rem;color:var(--ink3);text-decoration:none;transition:color 0.2s; }
        .footer-links a:hover { color:var(--ink2); }

        .divider { height:1px;background:var(--border); }

        @media(max-width:900px){
          nav{padding:0 1.5rem;}
          .hero{grid-template-columns:1fr;padding:7rem 1.5rem 3rem;gap:3rem;}
          .hero-right{display:none;}
          .section{padding:4rem 1.5rem;}
          .features-layout{grid-template-columns:1fr;gap:3rem;}
          .workflow{grid-template-columns:repeat(2,1fr);gap:2rem;}
          .workflow::before{display:none;}
          footer{padding:1.5rem;}
          .cta-section{padding:5rem 1.5rem;}
          .stats-row{flex-wrap:wrap;}
          .stat-cell{min-width:50%;border-right:none;border-bottom:1px solid var(--border);}
        }
      `}</style>

      {/* NAV */}
      <nav>
        <a href="/" className="logo">
          <div className="logo-mark">T</div>
          <span className="logo-text">TestBank <span>Pro</span></span>
        </a>
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#workflow" className="nav-link">How it works</a>
          <a href="#courses" className="nav-link">Courses</a>
          <a href="/login" className="nav-btn">Sign In</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-left">
          <div className="hero-tag">AI-Powered Exam Authoring</div>
          <h1 className="serif">
            Build better exams.<br />
            <em>In half the time.</em>
          </h1>
          <p>
            TestBank Pro gives university instructors the tools to generate, validate,
            version, and export exam questions — powered by Claude AI, built for the classroom.
          </p>
          <div className="hero-actions">
            <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestBank Pro - Institutional Access" className="btn-primary">
              Request Access →
            </a>
            <a href="#features" className="btn-outline">See Features</a>
          </div>
        </div>

        {/* App Mockup */}
        <div className="hero-right">
          <div className="mockup-shell">
            <div className="mockup-bar">
              <div className="mockup-dot" style={{background:"#ff5f57"}}/>
              <div className="mockup-dot" style={{background:"#ffbd2e"}}/>
              <div className="mockup-dot" style={{background:"#28c840"}}/>
            </div>
            <div className="mockup-body">
              <div className="mock-sidebar">
                <div className="mock-logo">
                  <div className="mock-logo-mark">T</div>
                  <span className="mock-logo-text">TestBank Pro</span>
                </div>
                <div className="mock-section">Question Bank</div>
                {[{label:"Generate",active:false},{label:"Review",active:false},{label:"Browse & Edit",active:false}].map(item=>(
                  <div key={item.label} className={`mock-nav-item${item.active?" active":""}`}>
                    <div className="mock-nav-dot"/>
                    <span>{item.label}</span>
                  </div>
                ))}
                <div className="mock-section" style={{marginTop:"0.75rem"}}>Exam Builder</div>
                {[{label:"Build & Export",active:true},{label:"Saved Exams",active:false}].map(item=>(
                  <div key={item.label} className={`mock-nav-item${item.active?" active":""}`}>
                    <div className="mock-nav-dot"/>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mock-main">
                <div className="mock-header">
                  <div className="mock-title">Dashboard</div>
                  <div className="mock-sub">Welcome to TestBank Pro — your exam authoring workspace.</div>
                </div>
                <div className="mock-stats">
                  {[{v:"286",l:"Questions in Bank"},{v:"0",l:"Pending Review"},{v:"0",l:"Issues Found"}].map(s=>(
                    <div key={s.l} className="mock-stat">
                      <div className="mock-stat-val">{s.v}</div>
                      <div className="mock-stat-label">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:"0.55rem",color:"#475569",marginBottom:"0.4rem",fontWeight:"600"}}>Courses</div>
                <div className="mock-courses">
                  {[{n:"Calculus 1",c:"#10b981",s:"5 chapters"},{n:"Calculus 2",c:"#8b5cf6",s:"5 chapters"},{n:"QM I",c:"#06b6d4",s:"3 chapters"},{n:"QM II",c:"#f43f5e",s:"7 chapters"}].map(c=>(
                    <div key={c.n} className="mock-course" style={{borderTopColor:c.c}}>
                      <div className="mock-course-name">{c.n}</div>
                      <div className="mock-course-sub">{c.s}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row">
        {[{v:"7",s:"+",l:"Supported Courses"},{v:"286",s:"+",l:"Questions Generated"},{v:"4",s:"x",l:"Exam Versions at Once"},{v:"100",s:"%",l:"Canvas LMS Compatible"}].map(s=>(
          <div key={s.l} className="stat-cell">
            <div className="stat-num">{s.v}<span>{s.s}</span></div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      {/* FEATURES — Question Bank */}
      <section id="features" className="section">
        <div className="section-tag">Question Bank</div>
        <h2 className="section-h2 serif">From question to exam,<br />fully validated.</h2>
        <p className="section-p">Browse, search, and manage hundreds of questions with answer key validation, duplicate detection, and inline editing.</p>

        <div className="features-layout">
          <div className="feature-list">
            {[
              {icon:"⚡",title:"AI Question Generation",desc:"Generate multiple choice, open-ended, and formula questions matched to your textbook section and difficulty — instantly."},
              {icon:"✅",title:"Answer Key Validation",desc:"Automatically detect duplicate choices, missing answers, and key mismatches before any exam reaches students."},
              {icon:"🔍",title:"Smart Search & Filter",desc:"Filter by course, section, difficulty, date, and time. Find any question in seconds across your entire bank."},
              {icon:"✏️",title:"Inline Editing",desc:"Edit questions, choices, and answers directly in the browser without leaving your workflow."},
            ].map(f=>(
              <div key={f.title} className="feature-item">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-content">
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bank Mockup */}
          <div className="bank-mockup">
            <div className="bank-bar">
              <div className="mockup-dot" style={{background:"#ff5f57"}}/>
              <div className="mockup-dot" style={{background:"#ffbd2e"}}/>
              <div className="mockup-dot" style={{background:"#28c840"}}/>
            </div>
            <div className="bank-body">
              <div className="bank-filters">
                {["QM II","Multiple Choice","Medium","April 2026"].map(f=>(
                  <div key={f} className="bank-filter">{f}</div>
                ))}
                <div style={{fontSize:"0.5rem",color:"#475569",marginLeft:"auto",alignSelf:"center"}}>12 matching</div>
              </div>
              {[
                {course:"QM II",section:"6.1",diff:"Easy",text:"The time for a subway train is uniformly distributed between 0 and 12 minutes. Find P(3 < X < 9).",ans:"✓ 0.50",tag:"#f43f5e"},
                {course:"QM II",section:"6.2",diff:"Medium",text:"For a normal distribution with μ = 50 and σ = 10, find P(X > 65).",ans:"✓ 0.0668",tag:"#f43f5e"},
                {course:"Calculus 1",section:"3.2",diff:"Hard",text:"Find the derivative of f(x) = (3x² + 2x)/(x³ - 1) using the quotient rule.",ans:"✓ See explanation",tag:"#10b981"},
              ].map((q,i)=>(
                <div key={i} className="bank-q">
                  <div className="bank-q-meta">
                    <div className="bank-tag" style={{background:q.tag+"22",color:q.tag}}>{q.course}</div>
                    <div className="bank-tag" style={{background:"#1a2235",color:"#7899b8"}}>MC</div>
                    <div className="bank-tag" style={{background:"#1a2235",color:"#7899b8"}}>{q.section}</div>
                    <div className="bank-tag" style={{background:"#1a2235",color:"#7899b8"}}>{q.diff}</div>
                  </div>
                  <div className="bank-q-text">{q.text}</div>
                  <div className="bank-q-ans">{q.ans}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="divider"/>

      {/* FEATURES — Export */}
      <section className="section">
        <div className="section-tag">Export</div>
        <h2 className="section-h2 serif">Professional exports,<br />ready to upload.</h2>
        <p className="section-p">Export to Canvas QTI, Word documents with proper math notation, or print-ready layouts — all in one click.</p>

        <div className="features-layout reverse">
          <div className="feature-list">
            {[
              {icon:"🎓",title:"Canvas QTI Export",desc:"Export exam-ready zip files for Canvas Classic Quizzes. One click per classroom section, correctly formatted."},
              {icon:"📝",title:"Word Export with Math",desc:"Generate clean Word documents with proper fraction notation, auto-scaling brackets, and numbered answer keys."},
              {icon:"🔀",title:"Multi-Version Mutation",desc:"Auto-build A, B, C, D exam versions. Numbers or function mutation — each version is provably different."},
              {icon:"📊",title:"Statistical Charts",desc:"Embed normal, uniform, exponential, and discrete probability charts directly in questions automatically."},
            ].map(f=>(
              <div key={f.title} className="feature-item">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-content">
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Word Export Mockup */}
          <div className="export-mockup">
            <div className="export-title">Midterm Exam — Version A &nbsp;·&nbsp; Calculus 2</div>
            {[
              {num:"1.",section:"[7.4 Inverse Laplace Transform] — Multiple Choice — Easy",
               text:<>Find <em>L</em><sup>-1</sup>{"{"}<span className="export-frac"><span className="export-frac-num">s + 4</span><span className="export-frac-den">(s+4)² + 25</span></span>{"}"}</>,
               choices:["A. e⁻⁴ᵗ cos(5t)","B. e⁻⁴ᵗ sin(5t)","C. 5e⁻⁴ᵗ cos(5t)"],correct:"A. e⁻⁴ᵗ cos(5t)"},
              {num:"2.",section:"[6.2 Normal Distribution] — Multiple Choice — Medium",
               text:"For a normal distribution with μ = 50 and σ = 10, what is P(X > 65)?",
               choices:["A. 0.0668","B. 0.1587","C. 0.3413"],correct:"A. 0.0668"},
            ].map((q,i)=>(
              <div key={i} className="export-q">
                <div className="export-q-num">{q.num} {q.section}</div>
                <div className="export-q-text">{q.text}</div>
                {q.choices.map(c=>(
                  <div key={c} className={`export-choice${c===q.correct?" correct":""}`}>{c===q.correct?"✓ ":""}{c}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider"/>

      {/* WORKFLOW */}
      <section id="workflow" className="section">
        <div className="section-tag">Workflow</div>
        <h2 className="section-h2 serif">From question bank<br />to exam in four steps.</h2>
        <div className="workflow">
          {[
            {n:"01",title:"Generate",desc:"Pick course, chapter, section. AI creates questions matched to your textbook."},
            {n:"02",title:"Review & Edit",desc:"Validate answers, edit inline, flag issues before they reach students."},
            {n:"03",title:"Build Versions",desc:"Select questions, generate A/B/C/D versions for multiple sections."},
            {n:"04",title:"Export",desc:"Download Word, print layout, or Canvas QTI zip with one click."},
          ].map(s=>(
            <div key={s.n} className="wf-step">
              <div className="wf-num">{s.n}</div>
              <div className="wf-title">{s.title}</div>
              <div className="wf-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="divider"/>

      {/* COURSES */}
      <section id="courses" className="section">
        <div className="section-tag">Supported Courses</div>
        <h2 className="section-h2 serif">Built around leading<br />university textbooks.</h2>
        <p className="section-p">Each course includes its full chapter and section structure aligned to the textbook — no setup required.</p>
        <div className="courses-grid">
          {[
            {name:"Calculus 1",detail:"Stewart 9th Ed · 5 chapters",color:"#10b981"},
            {name:"Calculus 2",detail:"Stewart 9th Ed · 5 chapters",color:"#8b5cf6"},
            {name:"Calculus 3",detail:"Stewart 9th Ed · 4 chapters",color:"#f59e0b"},
            {name:"Quantitative Methods I",detail:"Anderson et al. · 3 chapters",color:"#06b6d4"},
            {name:"Quantitative Methods II",detail:"Anderson et al. · 7 chapters",color:"#f43f5e"},
            {name:"Precalculus",detail:"Standard curriculum · 6 chapters",color:"#e879f9"},
            {name:"Discrete Mathematics",detail:"Susanna Epp · 12 chapters",color:"#a855f7"},
          ].map(c=>(
            <div key={c.name} className="course-card" style={{borderTopColor:c.color}}>
              <div className="course-name">{c.name}</div>
              <div className="course-detail">{c.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="cta-section">
        <h2 className="serif">Ready to modernize<br /><em>your department's exams?</em></h2>
        <p>Contact us to discuss institutional access, pricing, and onboarding for your university.</p>
        <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
          <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestBank Pro - Institutional Access" className="btn-light">
            Request Institutional Access →
          </a>
          <a href="/login" className="btn-ghost-light">Sign In</a>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <a href="/" className="logo" style={{textDecoration:"none"}}>
          <div className="logo-mark">T</div>
          <span className="logo-text">TestBank <span>Pro</span></span>
        </a>
        <p>© 2026 TestBank Pro. Built for university instructors.</p>
        <div className="footer-links">
          <a href="/login">Sign In</a>
          <a href="mailto:mohammadalakhrass@yahoo.com">Contact</a>
        </div>
      </footer>
    </>
  );
}
