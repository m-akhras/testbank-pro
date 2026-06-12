import {
  expectedVersionKeys,
  findIncompleteKeys,
  formatVersionCompletenessError,
  findMissingGraphs,
  formatMissingGraphError,
  clampGraphYDomainToFeatures,
  buildSectionVersions,
  assembleSection,
  mergeSection,
} from "../lib/exams/versionMerge.js";
import { buildVersionChunkPrompt, buildAllSectionsPrompt, buildReplacePrompt } from "../lib/prompts/index.js";
import { sectionTopicConstraints } from "../lib/courses/_calcPrompt.js";

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

// FIX 1 — TOPIC-AWARE FUNCTION MUTATION. The section field defines the topic; a
// "function mutation" must not wander off-topic (§1.4 Exponential → stay exp/log;
// §2.2 limit → any family but NO limits at infinity, which is §2.6).
describe("sectionTopicConstraints — topic scope by section", () => {
  test("1.4 Exponential → topic-BOUND: stay in the exponential/log class", () => {
    const tc = sectionTopicConstraints("1.4 Exponential Functions");
    expect(tc.bound).toBe(true);
    expect(tc.rule).toMatch(/KEEP the exponential\/logarithmic family/);
    expect(tc.rule).toMatch(/Mutate WITHIN it/);
    expect(tc.rule).toMatch(/Do NOT switch to polynomial/);
  });
  test("1.5 Inverse Functions and Logarithms → topic-BOUND", () => {
    const tc = sectionTopicConstraints("1.5 Inverse Functions and Logarithms");
    expect(tc.bound).toBe(true);
    expect(tc.rule).toMatch(/inverse-function \/ logarithm \/ exponential/);
  });
  test("2.2 Limit → topic-AGNOSTIC: any family, but NO limits at infinity (that is §2.6)", () => {
    const tc = sectionTopicConstraints("2.2 The Limit of a Function");
    expect(tc.bound).toBe(false);
    expect(tc.rule).toMatch(/Any function family is on-topic/);
    expect(tc.rule).toMatch(/MAY change the family/);
    expect(tc.rule).toMatch(/NO limits at x → ±∞/);
    expect(tc.rule).toMatch(/§2\.6/);
  });
  test("unmapped section (1.1) → null (generic change-family behavior)", () => {
    expect(sectionTopicConstraints("1.1 Four Ways to Represent a Function")).toBeNull();
  });
});

describe("buildVersionChunkPrompt — topic-aware function mutation wording", () => {
  test("§1.4 base (all topic-bound): stay-in-class wording, NOT the change-family lead-in", () => {
    const base = [{ type: "Free Response", section: "1.4 Exponential Functions", question: "Sketch f(x) = 2^x." }];
    const p = buildVersionChunkPrompt({ baseQuestions: base, sectionNum: 2, label: "A", mutation: "function", course: "Calculus 1" });
    expect(p).toContain("TOPIC-BOUND mutation");
    expect(p).toMatch(/KEEP the exponential\/logarithmic family/);     // stay-in-class scope
    expect(p).not.toContain("change the FUNCTION FAMILY");              // generic lead-in dropped
  });

  test("§2.2 base (topic-agnostic): keeps change-family lead-in + no-infinity-limits scope", () => {
    const base = [{ type: "Free Response", section: "2.2 The Limit of a Function", question: "Find lim x→3 of f." }];
    const p = buildVersionChunkPrompt({ baseQuestions: base, sectionNum: 2, label: "A", mutation: "function", course: "Calculus 1" });
    expect(p).toContain("change the FUNCTION FAMILY");                  // still allowed to change family
    expect(p).toMatch(/NO limits at x → ±∞/);                          // but stay in §2.2 techniques
    expect(p).toMatch(/answerable using ONLY the section's own techniques/); // global rule
  });
});

// Per-question Regenerate menu (buildReplacePrompt) must apply the SAME topic-aware
// function-mutation scope as the version/section path — it previously used a
// topic-blind "use a different function type" rule.
describe("buildReplacePrompt — topic-aware function mutation", () => {
  test("§1.4 'function' regenerate: stay-in-class rule, NOT the generic change-type lead-in", () => {
    const q = { course: "Calculus 1", section: "1.4 Exponential Functions", type: "Free Response", difficulty: "Medium", question: "Sketch f(x) = 2^x." };
    const p = buildReplacePrompt(q, "function");
    expect(p).toContain("TOPIC-BOUND");
    expect(p).toMatch(/KEEP the exponential\/logarithmic family/);     // stay-in-class scope
    expect(p).not.toContain("Use a DIFFERENT function type");           // generic lead-in dropped
  });

  test("§2.2 'function' regenerate: keeps change-type lead-in + no-infinity-limits scope", () => {
    const q = { course: "Calculus 1", section: "2.2 The Limit of a Function", type: "Free Response", difficulty: "Medium", question: "Find lim x→3 of f." };
    const p = buildReplacePrompt(q, "function");
    expect(p).toContain("Use a DIFFERENT function type");
    expect(p).toMatch(/NO limits at x → ±∞/);
    expect(p).toMatch(/answerable using ONLY the section's own techniques/);
  });

  test("graph-bearing 'function' regenerate blocks ln/log", () => {
    const q = { course: "Calculus 1", section: "2.5 Continuity", type: "Free Response", difficulty: "Medium", hasGraph: true, graphConfig: { type: "single", fn: "x^2", xDomain: [-3, 3] }, question: "Where is f discontinuous?" };
    const p = buildReplacePrompt(q, "function");
    expect(p).toMatch(/do NOT mutate into logarithmic \(ln\/log\) functions/);
  });

  test("'numbers' regenerate is unchanged (no topic scope injected)", () => {
    const q = { course: "Calculus 1", section: "1.4 Exponential Functions", type: "Free Response", difficulty: "Medium", question: "Sketch f(x) = 2^x." };
    const p = buildReplacePrompt(q, "numbers");
    expect(p).toContain("Keep the same function type, change only the numbers/coefficients.");
    expect(p).not.toContain("TOPIC-BOUND");
  });
});

// FIX 2 — LOUD MISSING-GRAPH GUARD. Completeness only counts keys/questions, so a
// mutation that dropped a graph slipped through. Fail by NAME instead.
describe("findMissingGraphs / formatMissingGraphError", () => {
  const base = [
    { question: "q1" },
    { question: "q2" },
    { question: "q3" },
    { hasGraph: true, graphConfig: { type: "single", fn: "x^2-3", xDomain: [-4, 4] }, question: "q4 has a graph" },
  ];

  test("graph-bearing base + graphless variant → names the exact question", () => {
    const parsed = { S3_B: [{ question: "m1" }, { question: "m2" }, { question: "m3" }, { question: "m4 — no graphConfig" }] };
    const missing = findMissingGraphs(parsed, ["S3_B"], base);
    expect(missing).toEqual(["S3_B question 4"]);
    const msg = formatMissingGraphError(missing);
    expect(msg).toContain("S3_B question 4");
    expect(msg).toMatch(/base question has a graph but the mutation returned none/);
  });

  test("variant that kept a usable graphConfig passes", () => {
    const parsed = { S3_B: [{}, {}, {}, { graphConfig: { type: "single", fn: "e^x", xDomain: [-2, 2] } }] };
    expect(findMissingGraphs(parsed, ["S3_B"], base)).toEqual([]);
  });

  test("base without a graph is never flagged (e.g. graph-choice MCQ / plain text)", () => {
    const textBase = [{ question: "plain" }];
    expect(findMissingGraphs({ S1_B: [{ question: "x" }] }, ["S1_B"], textBase)).toEqual([]);
  });
});

// FIX 3a — ln/log excluded from graph-question mutations (renderer ln is unclear).
describe("graph-question mutation — ln/log blocklist", () => {
  test("graph-bearing base function mutation forbids logarithmic family", () => {
    const base = [{ type: "Free Response", section: "2.5 Continuity", hasGraph: true, graphConfig: { type: "single", fn: "x^2", xDomain: [-3, 3] }, question: "Where is f discontinuous?" }];
    const p = buildVersionChunkPrompt({ baseQuestions: base, sectionNum: 2, label: "A", mutation: "function", course: "Calculus 1" });
    expect(p).toMatch(/do NOT mutate into logarithmic \(ln\/log\) functions/);
  });
  test("graph-less base has no ln blocklist line", () => {
    const base = [{ type: "Free Response", section: "2.5 Continuity", question: "Find lim." }];
    const p = buildVersionChunkPrompt({ baseQuestions: base, sectionNum: 2, label: "A", mutation: "function", course: "Calculus 1" });
    expect(p).not.toMatch(/do NOT mutate into logarithmic/);
  });
});

// FIX 3b — yDomain feature clamp: variant configs skip compileToGraphConfig's
// auto-scale, so a blown-up branch crushes discontinuity features flat (image 3).
describe("clampGraphYDomainToFeatures", () => {
  test("features span 3 but yDomain reaches 200 → clamp to the feature span padded", () => {
    const cfg = { type: "single", fn: "e^(2x)", holes: [[1, 2], [2, 5]], yDomain: [0, 200] };
    const out = clampGraphYDomainToFeatures(cfg);
    expect(out.yDomain).not.toEqual([0, 200]);
    const span = out.yDomain[1] - out.yDomain[0];
    expect(span).toBeLessThan(12);          // ~ feature span (3) + padding, never 200
    expect(out.yDomain[0]).toBeLessThanOrEqual(2);   // contains the lowest feature
    expect(out.yDomain[1]).toBeGreaterThanOrEqual(5); // contains the highest feature
  });

  test("no explicit yDomain (renderer would auto-scale) → pin to feature span", () => {
    const cfg = { type: "single", fn: "e^(2x)", points: [[0, 1], [1, 4]] };
    const out = clampGraphYDomainToFeatures(cfg);
    expect(Array.isArray(out.yDomain)).toBe(true);
    expect(out.yDomain[1] - out.yDomain[0]).toBeLessThan(12);
  });

  test("already-sane explicit yDomain (within ~4× feature span) is left untouched", () => {
    const cfg = { type: "single", fn: "x^2", holes: [[1, 2], [2, 5]], yDomain: [0, 10] };
    expect(clampGraphYDomainToFeatures(cfg)).toBe(cfg);
  });

  test("config with no feature points is left untouched", () => {
    const cfg = { type: "single", fn: "x^2", yDomain: [0, 500] };
    expect(clampGraphYDomainToFeatures(cfg)).toBe(cfg);
  });
});
