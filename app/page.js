import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #03080f; --bg2: #060d18; --surface: #0a1628; --surface2: #0f1e35;
          --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.12);
          --accent: #10b981; --accent-dim: rgba(16,185,129,0.12); --accent-glow: rgba(16,185,129,0.25);
          --cyan: #06b6d4; --text: #f0f6ff; --text2: #7899b8; --text3: #2d4a63;
        }
        html { scroll-behavior: smooth; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        .serif { font-family: 'Playfair Display', serif; }
        nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 4rem; height: 68px; background: rgba(3,8,15,0.85); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); }
        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-mark { width: 32px; height: 32px; background: var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: #fff; }
        .logo-text { font-size: 1rem; font-weight: 600; color: var(--text); letter-spacing: -0.3px; }
        .logo-text span { color: var(--accent); }
        .nav-right { display: flex; align-items: center; gap: 2.5rem; }
        .nav-link { color: var(--text2); text-decoration: none; font-size: 0.875rem; transition: color 0.2s; }
        .nav-link:hover { color: var(--text); }
        .nav-btn { background: var(--accent); color: #fff; text-decoration: none; padding: 0.55rem 1.4rem; border-radius: 8px; font-size: 0.875rem; font-weight: 500; transition: all 0.2s; }
        .nav-btn:hover { background: #0ea573; box-shadow: 0 0 20px var(--accent-glow); }
        .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10rem 2rem 6rem; position: relative; overflow: hidden; }
        .hero-glow { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 1000px; height: 500px; background: radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.1) 0%, transparent 65%); pointer-events: none; }
        .hero-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 60px 60px; mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%); pointer-events: none; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.25); border-radius: 100px; padding: 0.4rem 1rem; font-size: 0.78rem; font-weight: 500; color: var(--accent); margin-bottom: 2.5rem; position: relative; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: blink 2s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .hero-title { font-size: clamp(3rem, 6.5vw, 5.5rem); font-weight: 400; line-height: 1.05; letter-spacing: -2px; margin-bottom: 2rem; position: relative; }
        .hero-title em { font-style: italic; background: linear-gradient(135deg, var(--accent), var(--cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-sub { font-size: 1.1rem; color: var(--text2); max-width: 580px; line-height: 1.75; font-weight: 300; margin-bottom: 3rem; position: relative; }
        .hero-actions { display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap; position: relative; }
        .btn-primary { background: var(--accent); color: #fff; text-decoration: none; padding: 0.9rem 2.25rem; border-radius: 10px; font-size: 0.95rem; font-weight: 500; transition: all 0.25s; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .btn-primary:hover { background: #0ea573; transform: translateY(-2px); box-shadow: 0 12px 32px var(--accent-glow); }
        .btn-ghost { background: transparent; color: var(--text2); text-decoration: none; padding: 0.9rem 2.25rem; border-radius: 10px; font-size: 0.95rem; font-weight: 400; transition: all 0.2s; border: 1px solid var(--border2); }
        .btn-ghost:hover { border-color: var(--text3); color: var(--text); background: rgba(255,255,255,0.03); }
        .stats-strip { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); display: flex; align-items: stretch; background: var(--bg2); }
        .stat-item { flex: 1; padding: 2.5rem 2rem; text-align: center; border-right: 1px solid var(--border); position: relative; overflow: hidden; }
        .stat-item:last-child { border-right: none; }
        .stat-item::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 60%; height: 1px; background: linear-gradient(90deg, transparent, var(--accent), transparent); }
        .stat-value { font-size: 2.5rem; font-weight: 600; color: var(--text); letter-spacing: -1.5px; line-height: 1; }
        .stat-value span { color: var(--accent); }
        .stat-label { font-size: 0.75rem; font-weight: 400; color: var(--text3); margin-top: 0.5rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .section { padding: 7rem 4rem; max-width: 1200px; margin: 0 auto; }
        .eyebrow { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px; }
        .eyebrow::before { content: ''; width: 20px; height: 1px; background: var(--accent); display: block; }
        .section-heading { font-size: clamp(2.2rem, 4vw, 3.2rem); font-weight: 400; letter-spacing: -1px; line-height: 1.1; margin-bottom: 1.25rem; }
        .section-body { font-size: 1rem; color: var(--text2); max-width: 540px; line-height: 1.75; font-weight: 300; }
        .features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; margin-top: 5rem; }
        .feat { background: var(--surface); padding: 2.5rem; transition: background 0.25s; }
        .feat:hover { background: var(--surface2); }
        .feat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.2); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; margin-bottom: 1.5rem; }
        .feat-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 0.6rem; letter-spacing: -0.3px; }
        .feat-body { font-size: 0.875rem; color: var(--text2); line-height: 1.65; font-weight: 300; }
        .workflow { display: grid; grid-template-columns: repeat(4,1fr); gap: 0; margin-top: 5rem; position: relative; }
        .workflow::before { content: ''; position: absolute; top: 28px; left: 12.5%; right: 12.5%; height: 1px; background: linear-gradient(90deg, var(--accent), var(--cyan), var(--accent-dim)); z-index: 0; }
        .step { text-align: center; padding: 0 1.5rem; position: relative; z-index: 1; }
        .step-circle { width: 56px; height: 56px; border-radius: 50%; border: 1px solid var(--border2); background: var(--surface); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 0.85rem; font-weight: 600; color: var(--accent); position: relative; }
        .step-circle::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 1px solid var(--accent-dim); }
        .step-title { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 0.5rem; }
        .step-body { font-size: 0.82rem; color: var(--text2); line-height: 1.65; font-weight: 300; }
        .courses-wrap { margin-top: 3.5rem; display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 1rem; }
        .course-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; transition: all 0.2s; }
        .course-card:hover { border-color: var(--border2); background: var(--surface2); }
        .course-dot { width: 8px; height: 8px; border-radius: 50%; margin-bottom: 0.85rem; }
        .course-name { font-size: 0.9rem; font-weight: 500; color: var(--text); }
        .course-detail { font-size: 0.75rem; color: var(--text3); margin-top: 0.25rem; }
        .cta-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 5rem 4rem; text-align: center; position: relative; overflow: hidden; margin: 0 4rem 6rem; }
        .cta-glow { position: absolute; top: -50%; left: 50%; transform: translateX(-50%); width: 600px; height: 400px; background: radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 70%); pointer-events: none; }
        .cta-title { font-size: clamp(2rem,4vw,3.5rem); font-weight: 400; letter-spacing: -1.5px; line-height: 1.08; margin-bottom: 1.25rem; }
        .cta-sub { color: var(--text2); font-size: 1rem; margin-bottom: 2.5rem; font-weight: 300; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.7; }
        footer { border-top: 1px solid var(--border); padding: 2rem 4rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        footer p { font-size: 0.78rem; color: var(--text3); }
        .footer-links { display: flex; gap: 1.5rem; }
        .footer-links a { font-size: 0.78rem; color: var(--text3); text-decoration: none; transition: color 0.2s; }
        .footer-links a:hover { color: var(--text2); }
        .full-divider { height: 1px; background: linear-gradient(90deg, transparent 0%, var(--border) 20%, var(--border) 80%, transparent 100%); }
        @media(max-width:900px) {
          nav{padding:0 1.5rem;} .section{padding:5rem 1.5rem;}
          .features-grid{grid-template-columns:1fr;} .workflow{grid-template-columns:repeat(2,1fr);gap:3rem;}
          .workflow::before{display:none;} footer{padding:1.5rem;} .cta-wrap{padding:3rem 1.5rem;margin:0 1rem 4rem;}
          .stats-strip{flex-wrap:wrap;} .stat-item{min-width:50%;border-right:none;border-bottom:1px solid var(--border);}
        }
      `}</style>

      <nav>
        <a href="/" className="logo">
          <div className="logo-mark">T</div>
          <span className="logo-text">TestBank <span>Pro</span></span>
        </a>
        <div className="nav-right">
          <a href="#features" className="nav-link">Features</a>
          <a href="#workflow" className="nav-link">How it works</a>
          <a href="#courses" className="nav-link">Courses</a>
          <a href="/login" className="nav-btn">Sign In</a>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-glow" />
        <div className="hero-grid" />
        <div className="badge"><div className="badge-dot" />AI-Powered Exam Authoring for Universities</div>
        <h1 className="hero-title serif">Smarter exams.<br /><em>Less time writing them.</em></h1>
        <p className="hero-sub">TestBank Pro gives university instructors the tools to generate, version, validate, and export exam questions — powered by AI, built for the classroom.</p>
        <div className="hero-actions">
          <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestBank Pro - Institutional Access" className="btn-primary">Request Institutional Access →</a>
          <a href="#features" className="btn-ghost">Explore Features</a>
        </div>
      </div>

      <div className="stats-strip">
        {[{v:"7",s:"+",l:"Supported Courses"},{v:"286",s:"+",l:"Questions Generated"},{v:"4",s:"x",l:"Exam Versions at Once"},{v:"100",s:"%",l:"Canvas LMS Compatible"}].map(s=>(
          <div key={s.l} className="stat-item">
            <div className="stat-value">{s.v}<span>{s.s}</span></div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      <section id="features" className="section">
        <div className="eyebrow">Platform Features</div>
        <h2 className="section-heading serif">Everything you need to<br />build better exams.</h2>
        <p className="section-body">Designed for university math and business statistics instructors. From AI generation to Canvas export — all in one place.</p>
        <div className="features-grid">
          {[
            {icon:"⚡",title:"AI Question Generation",body:"Generate multiple choice, open-ended, and formula questions aligned to your textbook section and difficulty level — instantly."},
            {icon:"🔀",title:"Multi-Version Mutation",body:"Auto-build A, B, C, D exam versions. Numbers mutation changes coefficients; function mutation substitutes entire function types."},
            {icon:"📊",title:"Statistical Chart Engine",body:"Automatically embed normal, uniform, exponential, and discrete probability charts directly inside questions — no external tools needed."},
            {icon:"🎓",title:"Canvas QTI Export",body:"Export exam-ready zip files for Canvas Classic Quizzes. One click per classroom section, correctly formatted every time."},
            {icon:"📝",title:"Word & Print Export",body:"Generate clean Word documents with full LaTeX math notation, numbered answer keys, and print-ready A4 formatting."},
            {icon:"✅",title:"Answer Key Validation",body:"Automatically detect duplicate choices, missing answers, and key mismatches before any exam reaches your students."},
          ].map(f=>(
            <div key={f.title} className="feat">
              <div className="feat-icon-wrap">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="full-divider" />

      <section id="workflow" className="section">
        <div className="eyebrow">Workflow</div>
        <h2 className="section-heading serif">From bank to exam<br />in four steps.</h2>
        <div className="workflow">
          {[
            {n:"01",title:"Generate",body:"Pick your course, chapter, and section. AI creates questions matched to your textbook and difficulty."},
            {n:"02",title:"Review & Edit",body:"Validate answers, edit inline, and curate your question bank. Issues are flagged before export."},
            {n:"03",title:"Build Versions",body:"Select questions, set mutation rules, and generate multiple exam versions for different sections."},
            {n:"04",title:"Export",body:"Download Word files, print layouts, or Canvas QTI zips — ready to upload with one click."},
          ].map(s=>(
            <div key={s.n} className="step">
              <div className="step-circle">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="full-divider" />

      <section id="courses" className="section">
        <div className="eyebrow">Supported Courses</div>
        <h2 className="section-heading serif">Built around leading<br />university textbooks.</h2>
        <p className="section-body">Each course includes its full chapter and section structure — no setup required.</p>
        <div className="courses-wrap">
          {[
            {name:"Calculus 1",detail:"Stewart 9th Ed · 5 chapters",color:"#10b981"},
            {name:"Calculus 2",detail:"Stewart 9th Ed · 5 chapters",color:"#8b5cf6"},
            {name:"Calculus 3",detail:"Stewart 9th Ed · 4 chapters",color:"#f59e0b"},
            {name:"Quantitative Methods I",detail:"Anderson et al. · 3 chapters",color:"#06b6d4"},
            {name:"Quantitative Methods II",detail:"Anderson et al. · 7 chapters",color:"#f43f5e"},
            {name:"Precalculus",detail:"Standard curriculum · 6 chapters",color:"#e879f9"},
            {name:"Discrete Mathematics",detail:"Susanna Epp · 12 chapters",color:"#a855f7"},
          ].map(c=>(
            <div key={c.name} className="course-card">
              <div className="course-dot" style={{background:c.color}} />
              <div className="course-name">{c.name}</div>
              <div className="course-detail">{c.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="cta-wrap">
        <div className="cta-glow" />
        <h2 className="cta-title serif">Ready to modernize<br /><em>your department's exams?</em></h2>
        <p className="cta-sub">Contact us to discuss institutional access, pricing, and onboarding for your university.</p>
        <div className="hero-actions">
          <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestBank Pro - Institutional Access" className="btn-primary">Request Institutional Access →</a>
          <a href="/login" className="btn-ghost">Sign In</a>
        </div>
      </div>

      <footer>
        <a href="/" className="logo" style={{textDecoration:'none'}}>
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
