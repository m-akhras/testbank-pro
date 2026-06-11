// §2.3 Step 3b — calc1_2_3 template: registration, style routing, and the
// dual-spec graph_limit_laws contract. The engine (applyLimitLaws) is tested
// separately in applyLimitLaws.test.js.

import { calc1_2_3_template } from "../lib/templates/calc1_2_3.js";
import { buildTemplatePrompt } from "../lib/templates/buildTemplatePrompt.js";
import { findTemplate } from "../lib/templates/registry.js";

const CONTRACT_MARK = "§2.2 LIMIT SPEC (limit-of-a-function questions ONLY)";

const defaults = {};
for (const f of calc1_2_3_template.fields) defaults[f.id] = f.default;
const build = (over) => buildTemplatePrompt(calc1_2_3_template, { ...defaults, ...over });

describe("calc1_2_3 — registration + required enums", () => {
  test("registry routes the '2.3 ' prefix to calc1_2_3", () => {
    const t = findTemplate("Calculus 1", "2.3 Calculating Limits Using the Limit Laws");
    expect(t).toBeTruthy();
    expect(t.id).toBe("calc1_2_3");
  });

  test("the 3 required *_values enums are non-empty", () => {
    const ssr = calc1_2_3_template.section_specific_rules;
    expect(ssr.subtopic_values.length).toBeGreaterThan(0);
    expect(ssr.function_type_values.length).toBeGreaterThan(0);
    expect(ssr.primary_task_values.length).toBeGreaterThan(0);
  });

  test("field defaults build a valid prompt (validateAnswers passes on defaults)", () => {
    expect(() => buildTemplatePrompt(calc1_2_3_template, { ...defaults })).not.toThrow();
  });

  test("all five styles route to a prompt without throwing", () => {
    for (const s of ["graph_limit_laws", "algebraic", "limit_laws_given", "squeeze_theorem", "piecewise_eval"]) {
      expect(() => build({ question_style: s })).not.toThrow();
    }
  });
});

describe("calc1_2_3 — graph_limit_laws dual-spec contract", () => {
  const gll = build({ question_style: "graph_limit_laws" });

  test("injects LIMIT_SPEC_CONTRACT TWICE (one for f, one for g)", () => {
    expect(gll.split(CONTRACT_MARK).length - 1).toBe(2);
    expect(gll).toContain('emit as the top-level field "limitSpecF"');
    expect(gll).toContain('emit as the top-level field "limitSpecG"');
  });

  test("documents the lawAsks schema (all eight laws + params)", () => {
    expect(gll).toContain('"law": "...", "at": <integer>');
    for (const law of ["sum", "difference", "product", "quotient", "constMultiple", "xPolyTimesF", "power", "root"]) {
      expect(gll).toContain(`"${law}"`);
    }
  });

  test("single-ask rule + BATCH-level mix (per-question mix language gone)", () => {
    expect(gll).toContain("EXACTLY ONE ask per question");
    expect(gll).toContain("BATCH-LEVEL MIX");
    expect(gll).toMatch(/quotient.*g's two-sided limit is 0/);
    expect(gll).toMatch(/xPolyTimesF.*power.*root/);
    expect(gll).not.toContain("REQUIRED ask mix in EVERY question");
    expect(gll).not.toContain("3-6 asks per question");
  });

  test("tells the model the system overwrites the answer (do not compute)", () => {
    expect(gll).toContain("OVERWRITES");
    expect(gll).toContain("DO NOT STATE THE ANSWER");
  });

  test("does NOT contain a part-(f)-style value-plus-limit ask", () => {
    expect(gll).not.toContain("f(-1) + lim");
    expect(gll).toContain("OUT OF SCOPE"); // explicitly forbids value+limit / composition
  });

  test("MC contract: §2.5-style scalar injection, not compound / phrase-matching", () => {
    const mixed = build({ question_style: "mixed" });
    for (const p of [gll, mixed]) {
      // new scalar-injection language
      expect(p).toContain("the system DERIVES the correct scalar answer");
      expect(p).toContain("INJECTS it among your choices");
      expect(p).toMatch(/Author 4 plausible WRONG distractors as bare scalar values/);
      // old language gone
      expect(p).not.toContain("MUST appear VERBATIM");
      expect(p).not.toContain("composes BOTH the correct answer AND all distractors");
      expect(p).not.toContain("uniform compound format");
    }
  });
});

describe("calc1_2_3 — symbolic styles carry no limitSpec contract", () => {
  for (const style of ["algebraic", "limit_laws_given", "squeeze_theorem", "piecewise_eval"]) {
    test(`${style}: no LIMIT_SPEC_CONTRACT, has its symbolic block`, () => {
      const p = build({ question_style: style });
      expect(p).not.toContain(CONTRACT_MARK);
      expect(p).toContain("SYMBOLIC, COMPUTE AND STATE THE ANSWER");
    });
  }
});

describe("calc1_2_3 — symbolic styles are SINGLE-ASK MCQs (batch-level variety)", () => {
  // Per-question multi-part requirements must be gone; variety moves batch-level.
  const mixed = build({ question_style: "mixed" });

  test("limit_laws_given: single-ask + batch variety, no multi-part requirement", () => {
    for (const p of [build({ question_style: "limit_laws_given" }), mixed]) {
      expect(p).toContain("EXACTLY ONE limit per question");
      expect(p).toContain("BATCH-LEVEL VARIETY");
      expect(p).toContain("BARE SCALARS");
      // old per-question multi-part instructions removed
      expect(p).not.toContain("evaluate several combinations");
      expect(p).not.toContain("REQUIRED in every variant");
    }
  });

  test("piecewise_eval: single-ask + batch variety, no per-boundary multi-part requirement", () => {
    for (const p of [build({ question_style: "piecewise_eval" }), mixed]) {
      expect(p).toContain("EXACTLY ONE ask per question");
      expect(p).toContain("BATCH-LEVEL VARIETY");
      expect(p).toContain("BARE SCALARS");
      // old per-question "ask BOTH one-sided limits AND the conclusion" removed
      expect(p).not.toContain("ask BOTH one-sided limits");
      expect(p).not.toContain("at each boundary point, ask BOTH");
    }
  });

  test("algebraic and squeeze_theorem state ONE limit per question", () => {
    expect(build({ question_style: "algebraic" })).toContain("EXACTLY ONE limit per question");
    expect(build({ question_style: "squeeze_theorem" })).toContain("EXACTLY ONE limit per question");
  });
});
