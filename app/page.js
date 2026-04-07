import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #060910;
          --surface: #0d1520;
          --surface2: #121e2e;
          --border: #1a2d45;
          --accent: #10b981;
          --accent2: #06b6d4;
          --text: #e8f0f8;
          --text2: #7a9ab5;
          --text3: #3d5a72;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
        }

        .serif { font-family: 'Instrument Serif', serif; }

        /* NAV */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 3rem;
          background: rgba(6, 9, 16, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(26, 45, 69, 0.6);
        }

        .nav-logo {
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          font-size: 1.1rem;
          color: var(--text);
          text-decoration: none;
          letter-spacing: -0.3px;
        }

        .nav-logo span { color: var(--accent); }

        .nav-links { display: flex; align-items: center; gap: 2rem; }

        .nav-links a {
          color: var(--text2);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 400;
          transition: color 0.2s;
        }

        .nav-links a:hover { color: var(--text); }

        .nav-cta {
          background: var(--accent) !important;
          color: #fff !important;
          padding: 0.5rem 1.25rem !important;
          border-radius: 6px !important;
          font-weight: 500 !important;
          font-size: 0.88rem !important;
          transition: opacity 0.2s !important;
        }

        .nav-cta:hover { opacity: 0.88 !important; }

        /* HERO */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 8rem 2rem 6rem;
          position: relative;
          overflow: hidden;
        }

        .hero::before {
          content: '';
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .hero::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 100px;
          padding: 0.35rem 1rem;
          font-size: 0.78rem;
          color: var(--accent);
          font-weight: 500;
          letter-spacing: 0.02em;
          margin-bottom: 2.5rem;
        }

        .hero-badge::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .hero h1 {
          font-size: clamp(2.8rem, 6vw, 5rem);
          font-weight: 400;
          line-height: 1.08;
          letter-spacing: -1.5px;
          margin-bottom: 1.75rem;
          max-width: 820px;
        }

        .hero h1 em {
          font-style: italic;
          color: var(--accent);
        }

        .hero p {
          font-size: 1.1rem;
          color: var(--text2);
          max-width: 560px;
          line-height: 1.7;
          font-weight: 300;
          margin-bottom: 3rem;
        }

        .hero-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn-primary {
          background: var(--accent);
          color: #fff;
          padding: 0.85rem 2rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          letter-spacing: -0.2px;
        }

        .btn-primary:hover {
          background: #0da070;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.25);
        }

        .btn-secondary {
          background: transparent;
          color: var(--text2);
          padding: 0.85rem 2rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 400;
          text-decoration: none;
          transition: all 0.2s;
          border: 1px solid var(--border);
        }

        .btn-secondary:hover {
          border-color: var(--text3);
          color: var(--text);
        }

        /* STATS BAR */
        .stats-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4rem;
          padding: 3rem 2rem;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }

        .stat { text-align: center; }

        .stat-num {
          font-size: 2rem;
          font-weight: 600;
          color: var(--text);
          letter-spacing: -1px;
          line-height: 1;
        }

        .stat-num span { color: var(--accent); }

        .stat-label {
          font-size: 0.78rem;
          color: var(--text3);
          margin-top: 0.35rem;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* SECTION */
        section {
          padding: 6rem 2rem;
          max-width: 1100px;
          margin: 0 auto;
        }

        .section-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 1rem;
        }

        .section-title {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 400;
          letter-spacing: -0.8px;
          line-height: 1.12;
          margin-bottom: 1.25rem;
          color: var(--text);
        }

        .section-sub {
          font-size: 1rem;
          color: var(--text2);
          max-width: 520px;
          line-height: 1.7;
          font-weight: 300;
        }

        /* FEATURES GRID */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          margin-top: 4rem;
        }

        .feature-card {
          background: var(--surface);
          padding: 2.5rem;
          transition: background 0.2s;
        }

        .feature-card:hover { background: var(--surface2); }

        .feature-icon {
          width: 40px; height: 40px;
          border-radius: 8px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem;
          margin-bottom: 1.25rem;
        }

        .feature-title {
          font-size: 1rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 0.5rem;
          letter-spacing: -0.2px;
        }

        .feature-desc {
          font-size: 0.88rem;
          color: var(--text2);
          line-height: 1.6;
          font-weight: 300;
        }

        /* HOW IT WORKS */
        .steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 2rem;
          margin-top: 4rem;
        }

        .step {
          position: relative;
          padding-top: 1rem;
        }

        .step-num {
          font-size: 3.5rem;
          font-family: 'Instrument Serif', serif;
          font-style: italic;
          color: var(--border);
          line-height: 1;
          margin-bottom: 1rem;
        }

        .step-title {
          font-size: 1rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 0.5rem;
        }

        .step-desc {
          font-size: 0.88rem;
          color: var(--text2);
          line-height: 1.6;
          font-weight: 300;
        }

        /* COURSES */
        .courses-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 2.5rem;
        }

        .course-pill {
          padding: 0.5rem 1rem;
          border-radius: 100px;
          border: 1px solid var(--border);
          font-size: 0.82rem;
          color: var(--text2);
          font-weight: 400;
          background: var(--surface);
        }

        /* CTA SECTION */
        .cta-section {
          text-align: center;
          padding: 6rem 2rem;
          position: relative;
          overflow: hidden;
          border-top: 1px solid var(--border);
        }

        .cta-section::before {
          content: '';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 600px; height: 400px;
          background: radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .cta-section h2 {
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 400;
          letter-spacing: -1px;
          margin-bottom: 1rem;
        }

        .cta-section p {
          color: var(--text2);
          font-size: 1rem;
          margin-bottom: 2.5rem;
          font-weight: 300;
        }

        /* FOOTER */
        footer {
          border-top: 1px solid var(--border);
          padding: 2rem 3rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        footer p {
          font-size: 0.78rem;
          color: var(--text3);
        }

        .divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
        }

        @media (max-width: 768px) {
          nav { padding: 1rem 1.5rem; }
          .nav-links { gap: 1rem; }
          .stats-bar { gap: 2rem; }
          section { padding: 4rem 1.5rem; }
          footer { padding: 1.5rem; }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <a href="/" className="nav-logo">TestBank <span>Pro</span></a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#courses">Courses</a>
          <a href="/login" className="nav-cta">Sign In</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-badge">AI-Powered Exam Authoring</div>
        <h1 className="serif">
          Stop writing exams<br />from scratch.<br /><em>Build better ones faster.</em>
        </h1>
        <p>
          TestBank Pro helps university instructors generate, manage, and export
          exam questions — with multiple versions, Canvas QTI export, and AI mutation
          built in.
        </p>
        <div className="hero-actions">
          <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestBank Pro - Institution Access Request" className="btn-primary">
            Request Access
          </a>
          <a href="#features" className="btn-secondary">See Features →</a>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-bar">
        <div className="stat">
          <div className="stat-num">7<span>+</span></div>
          <div className="stat-label">Courses Supported</div>
        </div>
        <div className="stat">
          <div className="stat-num">286<span>+</span></div>
          <div className="stat-label">Questions Generated</div>
        </div>
        <div className="stat">
          <div className="stat-num">4<span>x</span></div>
          <div className="stat-label">Exam Versions at Once</div>
        </div>
        <div className="stat">
          <div className="stat-num">100<span>%</span></div>
          <div className="stat-label">Canvas Compatible</div>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features">
        <div className="section-label">Features</div>
        <h2 className="section-title serif">Everything an instructor needs,<br />nothing they don't.</h2>
        <p className="section-sub">
          Built specifically for university math and business statistics courses.
          No bloat, no complexity — just the tools that matter.
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <div className="feature-title">AI Question Generation</div>
            <div className="feature-desc">Generate multiple choice, open-ended, and formula questions instantly. Claude AI follows your textbook structure and section requirements.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔀</div>
            <div className="feature-title">Automatic Version Mutation</div>
            <div className="feature-desc">Build A, B, C, D versions automatically. Numbers mutation changes coefficients; function mutation changes the entire function type.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <div className="feature-title">Statistical Chart Engine</div>
            <div className="feature-desc">Auto-generate normal, uniform, exponential, and discrete probability distribution charts — embedded directly in questions.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎓</div>
            <div className="feature-title">Canvas QTI Export</div>
            <div className="feature-desc">Export directly to Canvas Classic Quizzes format. One click per section — no manual upload, no formatting required.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <div className="feature-title">Word & Print Export</div>
            <div className="feature-desc">Export clean Word documents with full math notation, answer keys, and page numbers. Print-ready in one click.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✅</div>
            <div className="feature-title">Answer Key Validation</div>
            <div className="feature-desc">Automatic detection of duplicate choices, missing answers, and key mismatches — before you export anything.</div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* HOW IT WORKS */}
      <section id="how-it-works">
        <div className="section-label">How it works</div>
        <h2 className="section-title serif">From question bank<br />to exam in minutes.</h2>

        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <div className="step-title">Generate Questions</div>
            <div className="step-desc">Select your course, chapter, and section. AI generates questions matched to your textbook and difficulty level.</div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div className="step-title">Review & Edit</div>
            <div className="step-desc">Validate answers, edit inline, and organize your question bank. Flag issues before they reach students.</div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div className="step-title">Build Versions</div>
            <div className="step-desc">Select questions, set mutation rules, and generate A/B/C/D exam versions for multiple class sections.</div>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <div className="step-title">Export Anywhere</div>
            <div className="step-desc">Download Word documents, print-ready PDFs, or Canvas QTI zip files — all with one click.</div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* COURSES */}
      <section id="courses">
        <div className="section-label">Courses</div>
        <h2 className="section-title serif">Built for math &<br />business statistics.</h2>
        <p className="section-sub">
          Aligned with leading university textbooks. Each course has its own chapter and section structure baked in.
        </p>
        <div className="courses-grid">
          {[
            "Calculus 1", "Calculus 2", "Calculus 3",
            "Quantitative Methods I", "Quantitative Methods II",
            "Precalculus", "Discrete Mathematics"
          ].map(c => (
            <div key={c} className="course-pill">{c}</div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="cta-section">
        <h2 className="serif">Ready to transform<br /><em>how your department exams?</em></h2>
        <p>Contact us to discuss access for your institution.</p>
        <div className="hero-actions" style={{justifyContent:"center"}}>
          <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestBank Pro - Institution Access Request" className="btn-primary">
            Request Institutional Access
          </a>
          <a href="/login" className="btn-secondary">
            Sign In
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <p>© 2026 TestBank Pro. All rights reserved.</p>
        <p>Built for university instructors.</p>
      </footer>
    </>
  );
}
