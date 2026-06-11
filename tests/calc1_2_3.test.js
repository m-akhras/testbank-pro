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

  test("states the required ask-mix (quotient-by-0, DNE jump, xPoly/power/root)", () => {
    expect(gll).toContain("REQUIRED ask mix in EVERY question");
    expect(gll).toMatch(/quotient.*g's two-sided limit is 0/);
    expect(gll).toMatch(/two-sided limit does not exist/);
    expect(gll).toMatch(/xPolyTimesF.*power.*root/);
  });

  test("tells the model the system overwrites answers (do not compute)", () => {
    expect(gll).toContain("OVERWRITES");
    expect(gll).toContain("DO NOT STATE THE ANSWERS");
  });

  test("does NOT contain a part-(f)-style value-plus-limit ask", () => {
    expect(gll).not.toContain("f(-1) + lim");
    expect(gll).toContain("OUT OF SCOPE"); // explicitly forbids value+limit / composition
  });

  test("MC contract uses the INJECTION model, not phrase-matching", () => {
    const mixed = build({ question_style: "mixed" });
    for (const p of [gll, mixed]) {
      // new injection language
      expect(p).toContain("the SYSTEM composes the correct answer text");
      expect(p).toContain("INJECTS it as the answer key");
      expect(p).toMatch(/Author ALL choices as plausible WRONG distractors/);
      // old phrase-matching language is gone
      expect(p).not.toContain("MUST appear VERBATIM");
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
