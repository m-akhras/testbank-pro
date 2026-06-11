// "Mixed" question style across §2.2 / §2.5 / §2.3 + the §2.5 classify removal.

import { calc1_2_2_template } from "../lib/templates/calc1_2_2.js";
import { calc1_2_5_template } from "../lib/templates/calc1_2_5.js";
import { calc1_2_3_template } from "../lib/templates/calc1_2_3.js";
import { buildTemplatePrompt } from "../lib/templates/buildTemplatePrompt.js";

const CONTRACT_MARK = "§2.2 LIMIT SPEC (limit-of-a-function questions ONLY)";
const HARD_RULE =
  "ANY question that presents a graph MUST carry the appropriate spec (limitSpec, or limitSpecF+limitSpecG+lawAsks). A graph question without a spec is INVALID and will be rejected.";

const styleField = (t) => t.fields.find((f) => f.id === "question_style");
const buildMixed = (t) => {
  const answers = {};
  for (const f of t.fields) answers[f.id] = f.default;
  return buildTemplatePrompt(t, { ...answers, question_style: "mixed" });
};
const countOccurrences = (s, sub) => s.split(sub).length - 1;

describe("Mixed style — present + default in all three limit templates", () => {
  for (const t of [calc1_2_2_template, calc1_2_5_template, calc1_2_3_template]) {
    test(`${t.id}: question_style has "mixed" and defaults to it`, () => {
      const f = styleField(t);
      expect(f.default).toBe("mixed");
      expect(f.options.map((o) => o.value)).toContain("mixed");
    });
  }
});

describe("Mixed prompt — owned contracts + verbatim hard rule", () => {
  test("§2.2 mixed: contract once + symbolic styles + hard rule", () => {
    const p = buildMixed(calc1_2_2_template);
    expect(countOccurrences(p, CONTRACT_MARK)).toBe(1);
    expect(p).toContain("PIECEWISE-EXISTENCE STYLE");
    expect(p).toContain("INFINITE-LIMIT STYLE");
    expect(p).toContain("FIND-VERTICAL-ASYMPTOTE STYLE");
    expect(p).toContain(HARD_RULE);
  });

  test("§2.5 mixed: contract once + symbolic styles + hard rule", () => {
    const p = buildMixed(calc1_2_5_template);
    expect(countOccurrences(p, CONTRACT_MARK)).toBe(1);
    expect(p).toContain("FIND-CONSTANT STYLE");
    expect(p).toContain("ANALYZE-PIECEWISE STYLE");
    expect(p).toContain(HARD_RULE);
  });

  test("§2.3 mixed: contract TWICE (f and g) + all four symbolic styles + hard rule", () => {
    const p = buildMixed(calc1_2_3_template);
    expect(countOccurrences(p, CONTRACT_MARK)).toBe(2);
    expect(p).toContain("ALGEBRAIC STYLE");
    expect(p).toContain("LIMIT-LAWS-GIVEN STYLE");
    expect(p).toContain("SQUEEZE-THEOREM STYLE");
    expect(p).toContain("PIECEWISE-EVAL STYLE");
    expect(p).toContain(HARD_RULE);
  });
});

describe("§2.5 — discontinuity-classification removed everywhere", () => {
  const styles = ["mixed", "graph_continuity", "find_constant", "analyze_piecewise"];

  test("no classify_explain style in the enum", () => {
    const vals = styleField(calc1_2_5_template).options.map((o) => o.value);
    expect(vals).not.toContain("classify_explain");
    expect(vals).toEqual(["mixed", "graph_continuity", "find_constant", "analyze_piecewise"]);
  });

  test("no classify option in the student-tasks field or primary_task_values", () => {
    const tasks = calc1_2_5_template.fields.find((f) => f.id === "student_tasks");
    expect(tasks.options.map((o) => o.value)).not.toContain("classify_discontinuity");
    expect(tasks.default).not.toContain("classify_discontinuity");
    expect(calc1_2_5_template.section_specific_rules.primary_task_values)
      .not.toContain("classify_discontinuity");
  });

  test("no 'classifyDiscontinuity' ask anywhere in any §2.5 prompt", () => {
    for (const s of styles) {
      const answers = {};
      for (const f of calc1_2_5_template.fields) answers[f.id] = f.default;
      const p = buildTemplatePrompt(calc1_2_5_template, { ...answers, question_style: s });
      expect(p).not.toContain("classifyDiscontinuity");
      expect(p).not.toContain("CLASSIFY-AND-EXPLAIN");
    }
  });
});
