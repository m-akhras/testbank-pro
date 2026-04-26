import "./landing.css";

export default function LandingPage() {
  return (
    <>
      {/* NAV */}
      <nav>
        <a href="/" className="nav-logo">
          <div className="nav-logo-mark">T</div>
          <span className="nav-logo-text">TestArca</span>
        </a>
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#how" className="nav-link">How it works</a>
          <a href="#courses" className="nav-link">Courses</a>
          <a href="/login" className="nav-link">Sign In</a>
          <a href="#waitlist" className="nav-cta">Request Access</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-badge">Invite-only · Now accepting applications</div>
        <h1>
          Exam questions,<br />
          <em>authored by AI.</em><br />
          Trusted by instructors.
        </h1>
        <p className="hero-sub">
          TestArca helps university instructors generate, validate, version, and export exam questions — with diagrams, graphs, and full export to Canvas and Word.
        </p>
        <div className="hero-actions">
          <a href="#waitlist" className="btn-primary">Request Access →</a>
          <a href="#features" className="btn-outline">See Features</a>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-bar">
        {[
          { num: "7+", label: "Courses supported" },
          { num: "10×", label: "Faster than manual authoring" },
          { num: "A–H", label: "Exam versions per session" },
          { num: "100%", label: "Canvas LMS compatible" },
        ].map((s, i) => (
          <div key={i} className="stat-item">
            <div className="stat-num">{s.num}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <div id="features">
        <div className="section">
          <div className="section-label">Features</div>
          <h2 className="section-title">Everything an instructor<br /><em>actually needs</em></h2>
          <p className="section-sub">Built by an instructor, for instructors. Every feature exists because it solves a real classroom problem.</p>
          <div className="features-grid">
            {[
              { icon: "✦", title: "AI Question Generation", desc: "Generate multiple-choice and open-ended questions per chapter and section, with automatic difficulty tagging and distractors based on real student misconceptions." },
              { icon: "◎", title: "Automatic Diagrams", desc: "Questions that need graphs, mapping diagrams, Venn diagrams, scatter plots, or distribution curves get them generated automatically — no manual drawing." },
              { icon: "⊞", title: "Exam Versioning", desc: "Generate up to 8 unique exam versions from a single master, with number mutations and function swaps to prevent sharing." },
              { icon: "▦", title: "Question Bank", desc: "Every question is saved to your personal bank, searchable by course, section, difficulty, and date. Spot and remove duplicates automatically." },
              { icon: "⬇", title: "One-Click Export", desc: "Export to Canvas QTI (Classic Quizzes), Word (.docx) with proper math formatting, or print-ready PDF — all from one screen." },
              { icon: "✓", title: "Answer Validation", desc: "Every generated question is validated by a second AI pass to catch wrong answers before they reach students." },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" className="how-wrap">
        <div className="section">
          <div className="section-label">How it works</div>
          <h2 className="section-title">From syllabus to exam<br /><em>in minutes</em></h2>
        </div>
        <div className="steps-grid">
          {[
            { num: "01", title: "Select your course & sections", desc: "Pick the course, chapter, and sections you want to cover. Set difficulty and question count." },
            { num: "02", title: "Generate questions", desc: "TestArca calls Claude AI to produce questions with distractors, explanations, and diagrams where appropriate." },
            { num: "03", title: "Review & edit", desc: "Inspect every question. Edit text, swap choices, fix graphs, or replace any question you don't like." },
            { num: "04", title: "Build & export", desc: "Lock your master, generate versioned exams, and export to Canvas or Word with one click." },
          ].map((s, i) => (
            <div key={i} className="step">
              <div className="step-num">{s.num}</div>
              <div className="step-title">{s.title}</div>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* COURSES */}
      <div id="courses">
        <div className="section">
          <div className="section-label">Courses</div>
          <h2 className="section-title">Built for <em>technical disciplines</em></h2>
          <p className="section-sub">Each course has its own question rules, graph types, notation standards, and export formatting — no generic templates.</p>
          <div className="courses-grid">
            {[
              { name: "Mathematics", detail: "Calculus, Precalculus, Discrete Math — with function graphs, mapping diagrams, and proof questions", color: "#10b981" },
              { name: "Business & Statistics", detail: "Quantitative Methods I & II — with distribution charts, regression plots, and Venn diagrams", color: "#f43f5e" },
              { name: "Engineering", detail: "Coming soon — circuit diagrams, force analysis, and domain-specific graph types", color: "#f59e0b" },
              { name: "Physics", detail: "Coming soon — kinematics graphs, vector diagrams, and lab-style questions", color: "#3b82f6" },
              { name: "Biology", detail: "Coming soon — classification, cell diagrams, and image-based identification questions", color: "#8b5cf6" },
              { name: "Custom Courses", detail: "Build your own course with custom notation rules, graph types, and question formats", color: "#06b6d4" },
            ].map((c, i) => (
              <div key={i} className="course-card" style={{ borderTopColor: c.color }}>
                <div className="course-name">{c.name}</div>
                <p className="course-detail">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WAITLIST */}
      <div id="waitlist" className="waitlist-wrap">
        <h2>Ready to save<br /><em>hours every semester?</em></h2>
        <p>TestArca is invite-only. Join the waitlist and we'll reach out when access opens for your institution.</p>
        <a href="mailto:mohammadalakhrass@yahoo.com?subject=TestArca Access Request" className="btn-primary">
          Request Access →
        </a>
      </div>

      {/* FOOTER */}
      <footer>
        <p>© 2025 TestArca. All rights reserved.</p>
        <a href="/login" className="footer-link">Sign In →</a>
      </footer>
    </>
  );
}
