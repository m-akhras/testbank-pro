const { buildQTI, buildQTICompare, validateQTIExport, answerMatchesAChoice } = require("../lib/exports/qti");

describe("QTI export structure", () => {
  const sampleQ = {
    id: "test1",
    type: "Multiple Choice",
    question: "What is 2+2?",
    choices: ["3", "4", "5", "6"],
    answer: "4",
    section: "1.1",
    difficulty: "Easy",
    course: "Test"
  };

  test("correct answer ident exists as a response_label ident", () => {
    const xml = buildQTI([sampleQ], "Test", "A", false, 1);
    const varequalMatch = xml.match(/<varequal[^>]*>([^<]+)<\/varequal>/);
    expect(varequalMatch).not.toBeNull();
    const correctIdent = varequalMatch[1];
    expect(xml).toContain(`<response_label ident="${correctIdent}"`);
  });

  test("varequal respident matches response_lid ident", () => {
    const xml = buildQTI([sampleQ], "Test", "A", false, 1);
    const respidMatch = xml.match(/<varequal respident="([^"]+)"/);
    expect(respidMatch).not.toBeNull();
    const respident = respidMatch[1];
    expect(xml).toContain(`<response_lid ident="${respident}"`);
  });

  test("answer must be present in choices", () => {
    expect(sampleQ.choices).toContain(sampleQ.answer);
  });

  test("exports valid XML (no unclosed tags)", () => {
    const xml = buildQTI([sampleQ], "Test", "A", false, 1);
    const openItems = (xml.match(/<item /g) || []).length;
    const closeItems = (xml.match(/<\/item>/g) || []).length;
    expect(openItems).toBe(closeItems);
  });
});

describe("answerMatchesAChoice — lenient shared matcher", () => {
  const base = { type: "Multiple Choice", section: "1.1", difficulty: "Medium", course: "Test", question: "Q" };

  test("true on exact match", () => {
    expect(answerMatchesAChoice({ ...base, choices: ["3", "4", "5", "6"], answer: "4" })).toBe(true);
  });

  test("true when answer 'B) -4' matches choice '-4' via strip-label", () => {
    expect(answerMatchesAChoice({ ...base, choices: ["3", "-4", "5", "6"], answer: "B) -4" })).toBe(true);
  });

  test("FALSE when answer '7' is not among ['12','-4','20','0']", () => {
    expect(answerMatchesAChoice({ ...base, choices: ["12", "-4", "20", "0"], answer: "7" })).toBe(false);
  });

  test("true for non-MC types (out of scope)", () => {
    expect(answerMatchesAChoice({ type: "Free Response", answer: "x^2 + C" })).toBe(true);
  });
});

describe("answer-not-in-choices defensive guard — NEVER emit a negative ident", () => {
  const badQ = {
    id: "bad1",
    type: "Multiple Choice",
    question: "Pick the value of the expression.",
    choices: ["12", "-4", "20", "0"],
    answer: "7", // intentionally not among the choices
    section: "1.1",
    difficulty: "Medium",
    course: "Test",
  };

  test("buildQTI: no 'c-1' / '_-1' ident, but stem + all choices still emitted", () => {
    const xml = buildQTI([badQ], "Test", "A", false, 1);
    expect(xml).not.toContain("c-1");
    expect(xml).not.toMatch(/_-1\b/);
    // Question imports unkeyed → no correct-answer marking at all.
    expect(xml).not.toContain("<varequal");
    // …but the item, stem and every choice are still present.
    expect(xml).toContain("Pick the value of");
    expect(xml).toContain("12");
    expect(xml).toContain("-4");
    expect(xml).toContain("20");
  });

  test("buildQTICompare: no '_-1' ident, but stem + choices still emitted", () => {
    const xml = buildQTICompare([{ label: "A", questions: [badQ] }], "Test", false, 1);
    expect(xml).not.toMatch(/_-1\b/);
    expect(xml).not.toContain("<varequal");
    expect(xml).toContain("Pick the value of");
    expect(xml).toContain("12");
    expect(xml).toContain("-4");
  });

  test("regression: a GOOD MC question is still keyed (guard doesn't suppress valid answers)", () => {
    const goodQ = { ...badQ, answer: "-4" };
    const xml = buildQTICompare([{ label: "A", questions: [goodQ] }], "Test", false, 1);
    expect(xml).toContain("<varequal");
    expect(xml).not.toMatch(/_-1\b/);
  });
});

describe("validateQTIExport — answer-not-in-choices warning", () => {
  test("emits a specific non-blocking warning for the mismatch", () => {
    const badQ = {
      type: "Multiple Choice",
      question: "Pick one.",
      choices: ["12", "-4", "20", "0"],
      answer: "7",
      section: "1.1",
    };
    const warnings = validateQTIExport([{ label: "A", questions: [badQ] }]);
    expect(warnings.some(w => /not among the choices/.test(w))).toBe(true);
    expect(warnings.some(w => w.includes("A Q1"))).toBe(true);
  });

  test("no such warning when the answer matches a choice", () => {
    const goodQ = {
      type: "Multiple Choice",
      question: "Pick one.",
      choices: ["12", "-4", "20", "0"],
      answer: "-4",
      section: "1.1",
    };
    const warnings = validateQTIExport([{ label: "A", questions: [goodQ] }]);
    expect(warnings.some(w => /not among the choices/.test(w))).toBe(false);
  });
});
