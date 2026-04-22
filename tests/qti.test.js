const { buildQTI } = require("../lib/exports/qti");

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
