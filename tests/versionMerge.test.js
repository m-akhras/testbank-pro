import {
  expectedVersionKeys,
  findIncompleteKeys,
  formatVersionCompletenessError,
  buildSectionVersions,
  assembleSection,
  mergeSection,
} from "../lib/exams/versionMerge.js";
import { buildVersionChunkPrompt, buildAllSectionsPrompt } from "../lib/prompts/index.js";

describe("expectedVersionKeys — anchor model", () => {
  test("anchorMode: S1_A absent (master), S{s}_A present for s ≥ 2", () => {
    expect(expectedVersionKeys(3, ["B", "C"], { anchorMode: true })).toEqual([
      "S1_B", "S1_C",
      "S2_A", "S2_B", "S2_C",
      "S3_A", "S3_B", "S3_C",
    ]);
  });
  test("non-anchor multi: only the variant labels every section", () => {
    expect(expectedVersionKeys(3, ["B", "C"])).toEqual([
      "S1_B", "S1_C", "S2_B", "S2_C", "S3_B", "S3_C",
    ]);
  });
  test("single-section: bare variant labels", () => {
    expect(expectedVersionKeys(1, ["A", "B"])).toEqual(["A", "B"]);
  });
});

describe("findIncompleteKeys / formatVersionCompletenessError", () => {
  test("complete / missing / short", () => {
    expect(findIncompleteKeys({ S2_A: [1, 2] }, ["S2_A"], 2)).toEqual({ missing: [], short: [] });
    expect(findIncompleteKeys({}, ["S2_A"], 2)).toEqual({ missing: ["S2_A"], short: [] });
    expect(findIncompleteKeys({ S2_A: [1] }, ["S2_A"], 2)).toEqual({ missing: [], short: ["S2_A"] });
  });
  test("error names the exact key + truncation note", () => {
    const msg = formatVersionCompletenessError(["S4_B"], { missing: ["S4_B"], short: [] }, true);
    expect(msg).toContain("S4_B");
    expect(msg).toContain("likely cut off");
  });
});

describe("assembleSection / buildSectionVersions — per-section anchor", () => {
  const master = { label: "A", questions: [{ question: "m1" }, { question: "m2" }] };
  const selected = [{ id: "q1" }, { id: "q2" }];
  const variantLabels = ["B", "C"];
  let n;
  const makeId = () => `id${++n}`;
  beforeEach(() => { n = 0; });

  const parsed = {
    S1_B: [{ question: "1B1" }, { question: "1B2" }],
    S1_C: [{ question: "1C1" }, { question: "1C2" }],
    S2_A: [{ question: "2A1" }, { question: "2A2" }], // section 2's GENERATED anchor
    S2_B: [{ question: "2B1" }, { question: "2B2" }],
    S2_C: [{ question: "2C1" }, { question: "2C2" }],
  };

  test("section 1 anchors on the MASTER; section 2 anchors on parsed S2_A", () => {
    const { classSectionVersions, versions } = buildSectionVersions({
      parsed, numClassSections: 2, variantLabels, selected,
      masterLocked: true, masterVersion: master, anchorMode: true,
      sanitizeFn: (q) => q, makeId, now: 1,
    });
    // both sections are A,B,C
    expect(classSectionVersions[1].map((v) => v.label)).toEqual(["A", "B", "C"]);
    expect(classSectionVersions[2].map((v) => v.label)).toEqual(["A", "B", "C"]);
    // section 1 A === the master (verbatim questions)
    expect(classSectionVersions[1][0].questions).toEqual(master.questions);
    // section 2 A === GENERATED (from parsed S2_A), NOT the master
    expect(classSectionVersions[2][0].label).toBe("A");
    expect(classSectionVersions[2][0].questions[0].question).toBe("2A1");
    expect(classSectionVersions[2][0].questions[0].originalId).toBe("q1"); // still maps to master slot
    // dual-write: active versions === section 1
    expect(versions).toBe(classSectionVersions[1]);
  });

  test("S1_A is NOT read from parsed (master is verbatim)", () => {
    const withFakeS1A = { ...parsed, S1_A: [{ question: "SHOULD_BE_IGNORED" }] };
    const { classSectionVersions } = buildSectionVersions({
      parsed: withFakeS1A, numClassSections: 2, variantLabels, selected,
      masterLocked: true, masterVersion: master, anchorMode: true,
      sanitizeFn: (q) => q, makeId, now: 1,
    });
    expect(classSectionVersions[1][0].questions).toEqual(master.questions); // master, not parsed S1_A
  });
});

describe("incremental per-section paste merge (anchor model)", () => {
  const master = { label: "A", questions: [{ question: "m1" }] };
  const selected = [{ id: "q1" }];
  const variantLabels = ["B", "C"];
  let n;
  const makeId = () => `id${++n}`;
  beforeEach(() => { n = 0; });
  const aOpts = (parsed, sectionNum) => ({
    parsed, sectionNum, multi: true, variantLabels, anchorLabel: "A", selected,
    masterLocked: true, masterVersion: master, anchorMode: true,
    sanitizeFn: (q) => q, makeId, now: 1,
  });

  test("two sequential section pastes leave BOTH sections populated + dual-write", () => {
    // Section 1 paste (model returns S1_B, S1_C; A = master).
    const s1 = assembleSection(aOpts({ S1_B: [{ question: "1B" }], S1_C: [{ question: "1C" }] }, 1));
    let state = mergeSection({}, 1, s1);
    expect(state.classSectionVersions[1].map((v) => v.label)).toEqual(["A", "B", "C"]);
    expect(state.classSectionVersions[1][0].questions).toEqual(master.questions);
    expect(state.versions).toBe(state.classSectionVersions[1]);

    // Section 2 paste (model returns S2_A, S2_B, S2_C). Must NOT wipe section 1.
    const s2 = assembleSection(aOpts({ S2_A: [{ question: "2A" }], S2_B: [{ question: "2B" }], S2_C: [{ question: "2C" }] }, 2));
    state = mergeSection(state.classSectionVersions, 2, s2);
    expect(Object.keys(state.classSectionVersions).sort()).toEqual(["1", "2"]);
    expect(state.classSectionVersions[1]).toBe(s1);                 // section 1 preserved
    expect(state.classSectionVersions[2].map((v) => v.label)).toEqual(["A", "B", "C"]);
    expect(state.classSectionVersions[2][0].questions[0].question).toBe("2A"); // section 2 A generated
    expect(state.versions).toBe(state.classSectionVersions[1]);     // dual-write: still section 1
  });
});

describe("buildVersionChunkPrompt — base threading + mutation mode", () => {
  const master = [
    { type: "Free Response", section: "1.1", question: "Differentiate x^2." },
    { type: "Multiple Choice", section: "1.1", question: "Limit of (x^2-1)/(x-1)?", choices: ["1", "2", "3", "4"] },
  ];

  test("A-chunk (s=3): master is the base, FUNCTION mutation + cross-section rule", () => {
    const p = buildVersionChunkPrompt({ baseQuestions: master, sectionNum: 3, label: "A", mutation: "function", course: "Calculus 1" });
    expect(p).toContain("ONE version key: S3_A");
    expect(p).toContain("FUNCTION mutation");
    expect(p).toContain("Differentiate x^2.");           // master question as base
    expect(p).toMatch(/Must differ from Section 1/i);    // cross-section differentiation
    expect(p).toContain('"S3_A"');
  });

  test("B-chunk (s=2): the section's anchor questions are the base, NUMBERS mutation", () => {
    const anchorQs = [
      { type: "Free Response", section: "1.1", question: "Integrate e^x." }, // S2_A's generated functions
      { type: "Multiple Choice", section: "1.1", question: "Limit of sin(x)/x?", choices: ["0", "1", "2", "3"] },
    ];
    const p = buildVersionChunkPrompt({ baseQuestions: anchorQs, sectionNum: 2, label: "B", mutation: "numbers", course: "Calculus 1" });
    expect(p).toContain("ONE version key: S2_B");
    expect(p).toContain("NUMBERS mutation");
    expect(p).toContain("change ONLY the numbers");
    expect(p).toContain("Integrate e^x.");               // base = the section's anchor, not the master
    expect(p).not.toContain("Differentiate x^2.");        // NOT the master
  });
});

// REGRESSION (a905fd2 drift): the combined multi-section Copy Prompt asked only
// for the variant keys (S{s}_B/C) while handlePaste's guard expects the anchor
// keys S{s}_A for s ≥ 2. Pin the combined prompt's key set === the guard's so
// they can never drift again.
describe("buildAllSectionsPrompt — combined prompt synced to anchor model", () => {
  const master = [
    { type: "Free Response", section: "1.1", question: "Differentiate x^2." },
    { type: "Multiple Choice", section: "1.1", question: "Limit of (x^2-1)/(x-1)?", choices: ["1", "2", "3", "4"] },
  ];

  test("prompt key set === guard expected keys (3 sections × [B,C] → 8 keys incl. S2_A, S3_A)", () => {
    const p = buildAllSectionsPrompt(master, ["B", "C"], 3, "Calculus 1");
    const expected = expectedVersionKeys(3, ["B", "C"], { anchorMode: true });
    expect(expected).toHaveLength(8);                     // S1_B,S1_C,S2_A,S2_B,S2_C,S3_A,S3_B,S3_C
    // the prompt's declared key list line equals the guard's expected keys, in order
    const declared = p.match(/All version keys to generate: (.+)/)[1].split(",").map((s) => s.trim());
    expect(declared).toEqual(expected);
    // every expected key appears in the JSON output-shape example block too
    for (const k of expected) expect(p).toContain(`"${k}":`);
    // anchor present for s ≥ 2, absent for s = 1 (master)
    expect(declared).toContain("S2_A");
    expect(declared).toContain("S3_A");
    expect(declared).not.toContain("S1_A");
  });

  test("anchor-first instruction for s ≥ 2; section 1 keeps the master as A (not regenerated)", () => {
    const p = buildAllSectionsPrompt(master, ["B", "C"], 3, "Calculus 1");
    expect(p).toMatch(/FIRST generate S2_A:/);
    expect(p).toMatch(/THEN generate S2_B, S2_C as NUMBERS mutations/);
    expect(p).toMatch(/Section 1's version A IS the master/);
    expect(p).toMatch(/do NOT output S1_A/);
  });
});
