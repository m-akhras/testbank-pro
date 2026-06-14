import {
  classifyQuestionFamily,
  detectSingleFamilySection,
  formatSingleFamilyError,
  findSingleFamilyErrors,
} from "../lib/exams/versionMerge.js";
import { buildReplacePrompt } from "../lib/prompts/index.js";

// Helper: a question is classified from its `question` text + graphConfig fn strings.
const q = (section, question, extra = {}) => ({ section, question, course: "Calculus 1", ...extra });

const S15 = "1.5 Inverse Functions and Logarithms"; // topic-BOUND (exp/log family IS the topic)
const S23 = "2.3 Calculating Limits Using the Limit Laws"; // topic-AGNOSTIC

describe("classifyQuestionFamily — member/family signal (question text + graphConfig fn)", () => {
  test("members are distinguished: ln / log / e^x / b^x / sqrt / rational / polynomial", () => {
    expect(classifyQuestionFamily(q(S15, "State the domain of y = ln(x)."))).toEqual({ member: "ln", family: "exp-log" });
    expect(classifyQuestionFamily(q(S15, "Evaluate log_3(81)."))).toEqual({ member: "log", family: "exp-log" });
    expect(classifyQuestionFamily(q(S15, "Differentiate e^x."))).toEqual({ member: "e^x", family: "exp-log" });
    expect(classifyQuestionFamily(q(S15, "Solve 2^x = 8 for x."))).toEqual({ member: "b^x", family: "exp-log" });
    expect(classifyQuestionFamily(q(S23, "Evaluate lim sqrt(x+4)."))).toEqual({ member: "sqrt", family: "sqrt" });
    expect(classifyQuestionFamily(q(S23, "Evaluate lim (x+1)/(x^2-1)."))).toEqual({ member: "rational", family: "rational" });
    expect(classifyQuestionFamily(q(S23, "Evaluate lim (2x^2 - x + 1)."))).toEqual({ member: "polynomial", family: "polynomial" });
  });
  test("x^2 is polynomial, NOT b^x (letter^digit)", () => {
    expect(classifyQuestionFamily(q(S23, "Simplify x^2 + 3."))).toEqual({ member: "polynomial", family: "polynomial" });
  });
  test("signal can come from graphConfig.fn when the text has none", () => {
    expect(classifyQuestionFamily(q(S15, "Based on the graph above, state the domain.", { graphConfig: { fn: "ln(x)" } })))
      .toEqual({ member: "ln", family: "exp-log" });
  });
  test("pure prose with no function → null (skipped, never flagged)", () => {
    expect(classifyQuestionFamily(q(S23, "Determine whether the limit exists."))).toBeNull();
  });
});

describe("detectSingleFamilySection — topic-aware granularity", () => {
  test("KEY TEST: §1.5 (bound) [ln, log_3, 2^x, e^x] → NOT flagged (varied members, uniform family is correct)", () => {
    const section = [
      q(S15, "State the domain of y = ln(x)."),
      q(S15, "Evaluate log_3(81)."),
      q(S15, "Solve 2^x = 8."),
      q(S15, "Differentiate e^x."),
    ];
    expect(detectSingleFamilySection(section, S15).detected).toBe(false);
  });

  test("§1.5 (bound) [ln, ln, ln, ln] → flagged at MEMBER level, names 'ln'", () => {
    const section = [
      q(S15, "Evaluate ln(2)."), q(S15, "State the domain of ln(x)."),
      q(S15, "Differentiate ln(x)."), q(S15, "Solve ln(x) = 1."),
    ];
    const r = detectSingleFamilySection(section, S15);
    expect(r.detected).toBe(true);
    expect(r.label).toBe("ln");
  });

  test("§2.3 (agnostic) all-rational (4 q) → flagged at FAMILY level, names 'rational'", () => {
    const section = [
      q(S23, "Evaluate lim (x+1)/(x^2-1)."), q(S23, "Evaluate lim (x-2)/(x+3)."),
      q(S23, "Evaluate lim (2x)/(x-1)."), q(S23, "Evaluate lim (x+5)/(x-5)."),
    ];
    const r = detectSingleFamilySection(section, S23);
    expect(r.detected).toBe(true);
    expect(r.label).toBe("rational");
  });

  test("§2.3 (agnostic) [polynomial, ln, sqrt, rational] → NOT flagged", () => {
    const section = [
      q(S23, "Evaluate lim (2x^2 - x + 1)."),
      q(S23, "Evaluate lim ln(x)."),
      q(S23, "Evaluate lim sqrt(x+4)."),
      q(S23, "Evaluate lim (x+1)/(x-1)."),
    ];
    expect(detectSingleFamilySection(section, S23).detected).toBe(false);
  });

  test("2-question all-same section → NOT flagged (below the >= 3 threshold)", () => {
    const section = [q(S23, "Evaluate lim (x+1)/(x-1)."), q(S23, "Evaluate lim (x-2)/(x+2).")];
    expect(detectSingleFamilySection(section, S23).detected).toBe(false);
  });

  test("unclassifiable questions are SKIPPED (don't inflate the count, never flag)", () => {
    const section = [
      q(S23, "Determine whether the limit exists."),
      q(S23, "State which limit law applies."),
      q(S23, "Is the function continuous at x = 1?"),
      q(S23, "Evaluate lim (x+1)/(x-1)."),  // only 1 classifiable
      q(S23, "Evaluate lim (x-2)/(x+2)."),  // only 2 classifiable → < 3
    ];
    expect(detectSingleFamilySection(section, S23).detected).toBe(false);
  });
});

describe("formatSingleFamilyError / findSingleFamilyErrors", () => {
  test("error names the section and offending family/member", () => {
    expect(formatSingleFamilyError(S23, "rational")).toBe(`Section ${S23} came back all-rational — regenerate.`);
  });
  test("findSingleFamilyErrors groups by math section and reports each monoculture", () => {
    const questions = [
      // §2.3 all rational (3) → flagged
      q(S23, "lim (x+1)/(x-1)."), q(S23, "lim (x-2)/(x+2)."), q(S23, "lim (2x)/(x-3)."),
      // §1.5 all ln (3) → flagged
      q(S15, "ln(2)."), q(S15, "ln(x)."), q(S15, "Solve ln(x)=1."),
    ];
    const errs = findSingleFamilyErrors(questions);
    expect(errs).toHaveLength(2);
    expect(errs.some(e => e.includes("all-rational"))).toBe(true);
    expect(errs.some(e => e.includes("all-ln"))).toBe(true);
  });
  test("a varied section produces no error", () => {
    const questions = [
      q(S23, "lim (2x^2-x+1)."), q(S23, "lim ln(x)."), q(S23, "lim sqrt(x+4)."),
    ];
    expect(findSingleFamilyErrors(questions)).toEqual([]);
  });
});

describe("PART A — within-section variety prompt rule", () => {
  test("§1.5 (bound) function-mutation prompt: vary the MEMBER, do NOT default to ln, family stays exp/log", () => {
    const p = buildReplacePrompt(q(S15, "Differentiate e^x."), "function");
    expect(p).toMatch(/vary the MEMBER/);
    expect(p).toMatch(/Do NOT default every question to ln/);
    expect(p).toMatch(/family stays exp\/log/);
    // a bound section must NOT get the family-level rule
    expect(p).not.toMatch(/assign each question a DIFFERENT function family/);
  });

  test("§2.3 (agnostic) function-mutation prompt: DIFFERENT family per question, do NOT make them all ln", () => {
    const p = buildReplacePrompt(q(S23, "Evaluate lim (2x^2 - x + 1)."), "function");
    expect(p).toMatch(/DIFFERENT function family/);
    expect(p).toMatch(/do NOT make them all ln/);
  });

  test("buildReplacePrompt with mutationType 'function' includes the variety rule; 'numbers' does not", () => {
    const fnP = buildReplacePrompt(q(S15, "Differentiate e^x."), "function");
    const numP = buildReplacePrompt(q(S15, "Differentiate e^x."), "numbers");
    expect(fnP).toMatch(/WITHIN-SECTION VARIETY/);
    expect(numP).not.toMatch(/WITHIN-SECTION VARIETY/);
  });
});
