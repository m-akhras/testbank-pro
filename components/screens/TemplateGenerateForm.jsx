"use client";
import { useState, useMemo } from "react";
import { makeStyles, green1, text2, text3 } from "../../lib/theme.js";
import { buildTemplatePrompt } from "../../lib/templates/buildTemplatePrompt.js";

export default function TemplateGenerateForm({ template, onPromptReady, onCancel }) {
  const S = useMemo(() => makeStyles(green1), []);

  // Initialize state from template defaults
  const [answers, setAnswers] = useState(() => {
    const init = {};
    for (const field of template.fields) {
      init[field.id] = field.default;
    }
    return init;
  });

  const [error, setError] = useState(null);

  // Update one field
  const updateField = (fieldId, value) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    setError(null);
  };

  // Toggle multi-select value
  const toggleMulti = (fieldId, value) => {
    setAnswers(prev => {
      const current = prev[fieldId] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [fieldId]: next };
    });
    setError(null);
  };

  // Set count for one option in a multi_select_with_counts field.
  // count <= 0 means "unselected" but the entry stays in the array so toggling
  // back is fast (UX preserves position). Total count is the sum of counts.
  const setOptionCount = (fieldId, value, count) => {
    const clamped = Math.max(0, Math.min(20, parseInt(count, 10) || 0));
    setAnswers(prev => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      const existing = current.find(e => e && e.value === value);
      let next;
      if (existing) {
        next = current.map(e => (e.value === value ? { ...e, count: clamped } : e));
      } else {
        next = [...current, { value, count: clamped, difficulty: "medium" }];
      }
      return { ...prev, [fieldId]: next };
    });
    setError(null);
  };

  // Build prompt button handler
  const handleBuildPrompt = () => {
    try {
      const prompt = buildTemplatePrompt(template, answers);
      onPromptReady(prompt, answers);
    } catch (e) {
      setError(e.message);
    }
  };

  // Render a single field based on type
  const renderField = (field) => {
    if (field.type === "number") {
      return (
        <div key={field.id} style={S.field}>
          <div style={S.lbl}>{field.label}</div>
          <input
            type="number"
            style={S.input}
            value={answers[field.id] ?? ""}
            min={field.min}
            max={field.max}
            onChange={(e) => updateField(field.id, parseInt(e.target.value, 10) || 0)}
          />
        </div>
      );
    }

    if (field.type === "single_select") {
      return (
        <div key={field.id} style={{ ...S.field, minWidth: "200px" }}>
          <div style={S.lbl}>{field.label}</div>
          <select
            style={S.sel}
            value={answers[field.id] ?? ""}
            onChange={(e) => updateField(field.id, e.target.value)}
          >
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === "multi_select") {
      const selected = answers[field.id] || [];
      return (
        <div key={field.id} style={{ width: "100%", marginBottom: "1.25rem" }}>
          <div style={S.lbl}>{field.label}</div>
          <div style={S.sGrid}>
            {field.options.map(opt => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  style={S.sBtn(isSelected)}
                  onClick={() => toggleMulti(field.id, opt.value)}
                >
                  <span style={S.chk(isSelected)}>{isSelected ? "✓" : ""}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === "multi_select_with_counts") {
      const entries = Array.isArray(answers[field.id]) ? answers[field.id] : [];
      const totalCount = entries.reduce((s, e) => s + (Number(e?.count) > 0 ? Number(e.count) : 0), 0);
      const questionCount = Number(answers.count) || 0;
      return (
        <div key={field.id} style={{ width: "100%", marginBottom: "1.25rem" }}>
          <div style={S.lbl}>
            {field.label}
            <span style={{
              marginLeft: "0.7rem",
              fontWeight: 400,
              fontSize: "0.78rem",
              color: totalCount === questionCount ? green1 : text3,
            }}>
              Total: {totalCount} {questionCount > 0 ? `(target: ${questionCount})` : ""}
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {field.options.map(opt => {
              const entry = entries.find(e => e && e.value === opt.value);
              const count = entry ? Number(entry.count) || 0 : 0;
              const isActive = count > 0;
              return (
                <div
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.7rem",
                    padding: "0.55rem 0.8rem",
                    background: isActive ? "#F0FDF4" : "#FFFFFF",
                    border: isActive ? `1px solid ${green1}` : "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOptionCount(field.id, opt.value, Math.max(0, count - 1))}
                    style={{
                      width: "28px", height: "28px",
                      border: "1px solid #D1D5DB", background: "#fff",
                      borderRadius: "6px", cursor: "pointer", fontSize: "1rem",
                      lineHeight: 1, color: text2,
                    }}
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={count}
                    onChange={(e) => setOptionCount(field.id, opt.value, e.target.value)}
                    style={{
                      width: "44px", textAlign: "center", padding: "0.3rem",
                      border: "1px solid #D1D5DB", borderRadius: "6px",
                      fontSize: "0.85rem", fontWeight: 600, color: text2,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setOptionCount(field.id, opt.value, count + 1)}
                    style={{
                      width: "28px", height: "28px",
                      border: "1px solid #D1D5DB", background: "#fff",
                      borderRadius: "6px", cursor: "pointer", fontSize: "1rem",
                      lineHeight: 1, color: text2,
                    }}
                  >+</button>
                  <span style={{ flex: 1, fontSize: "0.85rem", color: text2 }}>{opt.label}</span>
                  {isActive && (
                    <select
                      value={entry?.difficulty || "medium"}
                      onChange={(e) => {
                        const difficulty = e.target.value;
                        setAnswers(prev => {
                          const cur = Array.isArray(prev[field.id]) ? prev[field.id] : [];
                          let next = cur.map(item =>
                            item.value === opt.value ? { ...item, difficulty } : item
                          );
                          // Defensive: if the entry doesn't exist yet, create it (shouldn't happen when count > 0)
                          if (!next.find(i => i.value === opt.value)) {
                            next = [...next, { value: opt.value, count, difficulty }];
                          }
                          return { ...prev, [field.id]: next };
                        });
                        setError(null);
                      }}
                      style={{
                        marginLeft: "0.4rem",
                        padding: "0.3rem 0.5rem",
                        border: "1px solid #D1D5DB",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: text2,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="mix_easy">Mix: mostly easy</option>
                      <option value="mix_balanced">Mix: balanced</option>
                      <option value="mix_hard">Mix: mostly hard</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === "free_text") {
      return (
        <div key={field.id} style={{ width: "100%", marginBottom: "1.25rem" }}>
          <div style={S.lbl}>{field.label}</div>
          <textarea
            style={{
              ...S.input,
              minHeight: "80px",
              fontFamily: "inherit",
              resize: "vertical"
            }}
            value={answers[field.id] ?? ""}
            placeholder={field.placeholder || ""}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        </div>
      );
    }

    return null;
  };

  // Group fields: number+single_select fields go in rows; multi_select, multi_select_with_counts, and free_text go full width
  const fieldRows = [];
  let currentRow = [];
  for (const field of template.fields) {
    if (
      field.type === "multi_select" ||
      field.type === "multi_select_with_counts" ||
      field.type === "free_text"
    ) {
      if (currentRow.length > 0) {
        fieldRows.push({ kind: "row", fields: currentRow });
        currentRow = [];
      }
      fieldRows.push({ kind: "full", field });
    } else {
      currentRow.push(field);
      if (currentRow.length === 3) {
        fieldRows.push({ kind: "row", fields: currentRow });
        currentRow = [];
      }
    }
  }
  if (currentRow.length > 0) {
    fieldRows.push({ kind: "row", fields: currentRow });
  }

  return (
    <div style={S.card}>
      <h2 style={{
        fontFamily: "'Georgia', serif",
        fontSize: "1.4rem",
        color: text2,
        margin: "0 0 0.3rem 0"
      }}>
        Template Generator — {template.course}, Section {template.section}
      </h2>
      <div style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: "0.85rem",
        color: text3,
        marginBottom: "1.5rem"
      }}>
        {template.sectionTitle} · {template.textbook}
      </div>

      {fieldRows.map((item, idx) => {
        if (item.kind === "row") {
          return (
            <div key={idx} style={S.row}>
              {item.fields.map(renderField)}
            </div>
          );
        } else {
          return renderField(item.field);
        }
      })}

      {error && (
        <div style={{
          padding: "0.7rem 1rem",
          backgroundColor: "#FEE2E2",
          color: "#991B1B",
          borderRadius: "8px",
          fontSize: "0.85rem",
          marginBottom: "1rem"
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end" }}>
        {onCancel && (
          <button type="button" style={S.oBtn(text3)} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" style={S.btn(green1, false)} onClick={handleBuildPrompt}>
          Build Prompt →
        </button>
      </div>
    </div>
  );
}
