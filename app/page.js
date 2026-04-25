"use client";
import { useState } from "react";

export default function LandingPage() {
  const [form, setForm] = useState({ name: "", email: "", institution: "" });
  const [status, setStatus] = useState(null);

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.institution) {
      setStatus("error");
      return;
    }
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setStatus("success"); setForm({ name: "", email: "", institution: "" }); }
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink:    #0f1a12;
          --ink2:   #3d5244;
          --ink3:   #6b8f74;
          --paper:  #f7f5f0;
          --paper2: #f0ede6;
          --paper3: #e8e4db;
          --accent: #2d6a4f;
          --accent2: #52b788;
          --accent3: #d8f3dc;
          --border: #ddd8ce;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--paper);
          color: var(--ink);
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          line-height: 1.6;
          overflow-x: hidden;
        }

        /* NAV */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 4rem;
          background: rgba(247,245,240,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }

        .nav-logo {
          display: flex; align-items: center; gap: 0.6rem;
          text-decoration: none;
        }

        .nav-logo-mark {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 0.9rem; font-weight: 700; color: #fff;
        }

        .nav-logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 1.1rem; font-weight: 700;
          color: var(--ink); letter-spacing: -0.02em;
        }

        .nav-links { display: flex; align-items: center; gap: 2rem; }

        .nav-link {
          font-size: 0.85rem; color: var(--ink2);
          text-decoration: none; font-weight: 400;
          transition: color 0.2s;
        }
        .nav-link:hover { color: var(--ink); }

        .nav-cta {
          background: var(--accent); color: #fff;
          text-decoration: none; padding: 0.5rem 1.25rem;
          border-radius: 6px; font-size: 0.85rem; font-weight: 500;
          transition: all 0.2s;
        }
        .nav-cta:hover { background: #1e4d38; transform: translateY(-1px); }

        /* HERO */
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          padding: 10rem 4rem 6rem;
          position: relative;
          overflow: hidden;
        }

        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, #d8f3dc 0%, transparent 70%);
          pointer-events: none;
        }

        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--accent3); border: 1px solid #b7e4c7;
          border-radius: 100px; padding: 0.3rem 0.9rem;
          font-size: 0.72rem; font-weight: 500; color: var(--accent);
          letter-spacing: 0.05em; text-transform: uppercase;
          margin-bottom: 2.5rem;
        }

        .hero-badge::before {
          content: ''; width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent2);
          animation: pulse 2s infinite;
        }

        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }

        .hero h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(3.5rem, 7vw, 7rem);
          font-weight: 400; line-height: 1.05;
          letter-spacing: -3px; color: var(--ink);
          margin-bottom: 1.5rem; max-width: 900px;
        }

        .hero h1 em {
          font-style: italic; color: var(--accent);
        }

        .hero-sub {
          font-size: 1.1rem; color: var(--ink2);
          max-width: 520px; line-height: 1.8;
          margin-bottom: 3rem; font-weight: 300;
        }

        .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        .btn-primary {
          background: var(--accent); color: #fff;
          text-decoration: none; padding: 0.9rem 2.25rem;
          border-radius: 8px; font-size: 0.9rem; font-weight: 500;
          transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;
          border: none; cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-primary:hover { background: #1e4d38; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(45,106,79,0.3); }

        .btn-outline {
          background: transparent; color: var(--ink2);
          text-decoration: none; padding: 0.9rem 2.25rem;
          border-radius: 8px; font-size: 0.9rem; font-weight: 400;
          border: 1px solid var(--border); transition: all 0.2s;
        }
        .btn-outline:hover { border-color: var(--ink3); color: var(--ink); }

        /* STATS BAR */
        .stats-bar {
          display: flex; justify-content: center; gap: 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--paper2);
        }

        .stat-item {
          flex: 1; max-width: 220px;
          padding: 2rem 1.5rem; text-align: center;
          border-right: 1px solid var(--border);
        }
        .stat-item:last-child { border-right: none; }

        .stat-num {
          font-family: 'Playfair Display', serif;
          font-size: 2.2rem; font-weight: 700; color: var(--accent);
          letter-spacing: -1px; margin-bottom: 0.25rem;
        }

        .stat-label { font-size: 0.78rem; color: var(--ink3); font-weight: 400; }

        /* SECTIONS */
        .section { padding: 7rem 4rem; max-width: 1200px; margin: 0 auto; }

        .section-label {
          font-size: 0.68rem; font-weight: 500; color: var(--accent);
          letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 3.5vw, 3rem);
          font-weight: 400; letter-spacing: -1.5px;
          color: var(--ink); margin-bottom: 1rem; line-height: 1.2;
        }

        .section-title em { font-style: italic; color: var(--accent); }

        .section-sub {
          font-size: 1rem; color: var(--ink2); max-width: 560px;
          line-height: 1.75; font-weight: 300; margin-bottom: 4rem;
        }

        /* FEATURES */
        .features-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
        }

        .feature-card {
          background: var(--paper2); border: 1px solid var(--border);
          border-radius: 12px; padding: 2rem;
          transition: all 0.2s;
        }
        .feature-card:hover { background: var(--paper3); transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.06); }

        .feature-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--accent3); display: flex; align-items: center;
          justify-content: center; font-size: 1.1rem; margin-bottom: 1.25rem;
        }

        .feature-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.05rem; font-weight: 700; color: var(--ink);
          margin-bottom: 0.5rem; letter-spacing: -0.02em;
        }

        .feature-desc { font-size: 0.85rem; color: var(--ink2); line-height: 1.7; font-weight: 300; }

        /* HOW IT WORKS */
        .how-wrap { background: var(--paper2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }

        .steps-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 0; position: relative;
        }

        .step {
          padding: 3rem 2.5rem; border-right: 1px solid var(--border);
          position: relative;
        }
        .step:last-child { border-right: none; }

        .step-num {
          font-family: 'Playfair Display', serif;
          font-size: 3rem; font-weight: 700; color: var(--border);
          line-height: 1; margin-bottom: 1rem; letter-spacing: -2px;
        }

        .step-title {
          font-size: 0.9rem; font-weight: 500; color: var(--ink);
          margin-bottom: 0.5rem;
        }

        .step-desc { font-size: 0.82rem; color: var(--ink2); line-height: 1.7; font-weight: 300; }

        /* COURSES */
        .courses-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .course-card {
          background: var(--paper2); border: 1px solid var(--border);
          border-radius: 10px; padding: 1.5rem;
          border-top: 3px solid; transition: all 0.2s;
        }
        .course-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }

        .course-name {
          font-size: 0.88rem; font-weight: 500; color: var(--ink);
          margin-bottom: 0.35rem;
        }

        .course-detail { font-size: 0.75rem; color: var(--ink3); line-height: 1.5; }

        /* WAITLIST */
        .waitlist-wrap {
          background: var(--ink); padding: 8rem 4rem;
          text-align: center;
        }

        .waitlist-wrap h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 400; letter-spacing: -1.5px;
          color: #fff; margin-bottom: 1rem; line-height: 1.1;
        }

        .waitlist-wrap h2 em { font-style: italic; color: var(--accent2); }

        .waitlist-wrap p {
          color: #7a9e87; font-size: 1rem; font-weight: 300;
          max-width: 440px; margin: 0 auto 3rem; line-height: 1.75;
        }

        .waitlist-form {
          display: flex; flex-direction: column; gap: 1rem;
          max-width: 440px; margin: 0 auto;
        }

        .waitlist-input {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px; padding: 0.85rem 1.25rem;
          font-size: 0.9rem; color: #fff; font-family: 'DM Sans', sans-serif;
          font-weight: 300; outline: none; transition: border-color 0.2s;
          width: 100%;
        }
        .waitlist-input::placeholder { color: rgba(255,255,255,0.3); }
        .waitlist-input:focus { border-color: var(--accent2); }

        .waitlist-btn {
          background: var(--accent2); color: var(--ink);
          border: none; border-radius: 8px; padding: 0.9rem;
          font-size: 0.9rem; font-weight: 500; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
        }
        .waitlist-btn:hover { background: #74c69d; transform: translateY(-1px); }

        .waitlist-success {
          background: rgba(82,183,136,0.15); border: 1px solid rgba(82,183,136,0.3);
          border-radius: 8px; padding: 1.25rem; color: var(--accent2);
          font-size: 0.9rem; max-width: 440px; margin: 0 auto;
        }

        .waitlist-error { color: #f87171; font-size: 0.82rem; margin-top: 0.5rem; }

        /* FOOTER */
        footer {
          background: var(--paper2); border-top: 1px solid var(--border);
          padding: 2rem 4rem;
          display: flex; align-items: center; justify-content: space-between;
        }

        footer p { font-size: 0.78rem; color: var(--ink3); }

        .footer-link {
          font-size: 0.78rem; color: var(--ink3);
          text-decoration: none; transition: color 0.2s;
        }
        .footer-link:hover { color: var(--ink2); }

        @media(max-width: 900px) {
          nav { padding: 1rem 1.5rem; }
          .nav-links { gap: 1rem; }
          .hero { padding: 8rem 1.5rem 4rem; }
          .section { padding: 4rem 1.5rem; }
          .features-grid { grid-template-columns: 1fr; }
          .steps-grid { grid-template-columns: repeat(2,1fr); }
          .step { border-bottom: 1px solid var(--border); }
          .waitlist-wrap { padding: 5rem 1.5rem; }
          footer { padding: 1.5rem; flex-direction: column; gap: 0.75rem; text-align: center; }
          .stats-bar { flex-wrap: wrap; }
          .stat-item { min-width: 50%; border-right: none; border-bottom: 1px solid var(--border); }
        }
      `}</style>

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
        {status === "success" ? (
          <div className="waitlist-success">✓ You're on the list. We'll be in touch soon.</div>
        ) : (
          <div className="waitlist-form">
            <input className="waitlist-input" placeholder="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <input className="waitlist-input" placeholder="Institutional email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <input className="waitlist-input" placeholder="University / Institution" value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} />
            <button className="waitlist-btn" onClick={handleSubmit}>Join the Waitlist →</button>
            {status === "error" && <p className="waitlist-error">Please fill in all fields and try again.</p>}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer>
        <p>© 2025 TestArca. All rights reserved.</p>
        <a href="/login" className="footer-link">Sign In →</a>
      </footer>
    </>
  );
}
