"use client";
import { useState } from "react";
import CourseForm from "../course/CourseForm.jsx";

export default function CoursesScreen({
  // Data
  courses, // from useCourses — all courses rows (both builtin + user)
  saveCourse,
  deleteCourse,
  // Navigation + permissions
  setScreen,
  isAdmin,
  // Styles
  S,
  text1,
  text2,
  text3,
  border,
  accent,
  bg1,
  bg2,
}) {
  const [tab, setTab] = useState("mine");
  const [editing, setEditing] = useState(null); // null | "new" | course id
  const [deletingId, setDeletingId] = useState(null);

  const list = Array.isArray(courses) ? courses : [];
  const mine = list.filter(c => !c.is_builtin);
  const builtin = list.filter(c => c.is_builtin);
  const visible = tab === "mine" ? mine : builtin;

  const editingCourse =
    editing === "new"
      ? null
      : typeof editing === "string" || typeof editing === "number"
        ? list.find(c => c.id === editing) || null
        : null;

  async function handleSave(data) {
    await saveCourse({ ...data, is_builtin: false });
    setEditing(null);
  }

  async function handleDelete(c) {
    if (!confirm(`Delete course "${c.name}"?`)) return;
    setDeletingId(c.id);
    try {
      await deleteCourse(c.id);
    } finally {
      setDeletingId(null);
    }
  }

  const tabBtn = (key, label, count) => (
    <button
      key={key}
      onClick={() => { setTab(key); setEditing(null); }}
      style={{
        background: tab === key ? accent + "22" : "transparent",
        color: tab === key ? accent : text2,
        border: `1px solid ${tab === key ? accent + "66" : border}`,
        borderRadius: "6px",
        padding: "0.4rem 0.9rem",
        fontSize: "0.82rem",
        fontWeight: tab === key ? "600" : "500",
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", opacity: 0.75 }}>({count})</span>
    </button>
  );

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={S.h1}>Courses</h1>
          <p style={S.sub}>Organize the courses you teach and the textbooks you use.</p>
        </div>
        {tab === "mine" && !editing && (
          <button
            style={{ ...S.btn("#10b981", false), fontSize: "0.82rem" }}
            onClick={() => setEditing("new")}
          >
            + New Course
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {tabBtn("mine", "My Courses", mine.length)}
        {tabBtn("builtin", "Built-in Courses", builtin.length)}
      </div>

      {editing && tab === "mine" && (
        <div style={{ marginBottom: "1.25rem" }}>
          <CourseForm
            initial={editingCourse}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
            S={S}
            text1={text1}
            text2={text2}
            text3={text3}
            border={border}
            accent={accent}
            bg1={bg1}
            bg2={bg2}
          />
        </div>
      )}

      {!editing && visible.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📚</div>
          <div style={{ fontSize: "0.95rem", fontWeight: "600", color: text1, marginBottom: "0.35rem" }}>
            {tab === "mine" ? "No courses yet" : "No built-in courses available"}
          </div>
          {tab === "mine" && (
            <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.1rem" }}>
              Click "+ New Course" to add your first one.
            </div>
          )}
        </div>
      )}

      {!editing && visible.map(c => {
        const chapterCount = (c.chapters || []).length;
        const sectionCount = (c.chapters || []).reduce((a, ch) => a + (ch.sections || []).length, 0);
        const hasGlossary = !!(c.glossary_text && c.glossary_text.length > 0);
        const imgCount = (c.reference_images || []).length;
        return (
          <div key={c.id} style={{ ...S.card, borderLeft: `4px solid ${c.color || accent}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1rem", fontWeight: "600", color: text1 }}>{c.name}</span>
                  {c.department && (
                    <span style={{ fontSize: "0.68rem", color: text2, background: bg2, border: "1px solid " + border, borderRadius: "4px", padding: "0.1rem 0.4rem" }}>
                      {c.department}
                    </span>
                  )}
                  {c.is_builtin && (
                    <span style={{ fontSize: "0.68rem", color: accent, background: accent + "18", border: `1px solid ${accent}44`, borderRadius: "4px", padding: "0.1rem 0.4rem" }}>
                      built-in
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.72rem", color: text3 }}>
                  {chapterCount} chapter{chapterCount !== 1 ? "s" : ""} · {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                  {hasGlossary && " · glossary"}
                  {imgCount > 0 && ` · ${imgCount} image${imgCount !== 1 ? "s" : ""}`}
                </div>
                {(c.textbook_name || c.textbook_author || c.textbook_edition) && (
                  <div style={{ fontSize: "0.72rem", color: text2, marginTop: "0.3rem" }}>
                    📘 {[c.textbook_name, c.textbook_author, c.textbook_edition].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                {tab === "mine" && (
                  <>
                    <button
                      style={{ ...S.oBtn(accent), fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
                      onClick={() => setEditing(c.id)}
                    >
                      ✏ Edit
                    </button>
                    <button
                      style={{ ...S.oBtn("#f87171"), fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                      disabled={deletingId === c.id}
                      onClick={() => handleDelete(c)}
                    >
                      {deletingId === c.id ? "…" : "✕"}
                    </button>
                  </>
                )}
                {tab === "builtin" && isAdmin && (
                  <button
                    style={{ ...S.oBtn(accent), fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
                    onClick={() => setEditing(c.id)}
                  >
                    ✏ Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
