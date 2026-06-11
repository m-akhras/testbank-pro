import {
  expectedVersionKeys,
  findIncompleteKeys,
  formatVersionCompletenessError,
  buildSectionVersions,
  buildOneSectionVariants,
  mergeSection,
} from "../lib/exams/versionMerge.js";

describe("expectedVersionKeys", () => {
  test("multi-section: S{s}_{label} for every section × label", () => {
    expect(expectedVersionKeys(3, ["A", "B", "C"])).toEqual([
      "S1_A", "S1_B", "S1_C", "S2_A", "S2_B", "S2_C", "S3_A", "S3_B", "S3_C",
    ]);
  });
  test("single-section (version_all): bare labels", () => {
    expect(expectedVersionKeys(1, ["A", "B"])).toEqual(["A", "B"]);
  });
});

describe("findIncompleteKeys — completeness guard core", () => {
  const expected = ["S1_A", "S1_B"];
  test("complete response → nothing missing or short", () => {
    const parsed = { S1_A: [1, 2], S1_B: [1, 2] };
    expect(findIncompleteKeys(parsed, expected, 2)).toEqual({ missing: [], short: [] });
  });
  test("absent / empty key → missing", () => {
    expect(findIncompleteKeys({ S1_A: [1, 2] }, expected, 2)).toEqual({ missing: ["S1_B"], short: [] });
    expect(findIncompleteKeys({ S1_A: [1, 2], S1_B: [] }, expected, 2)).toEqual({ missing: ["S1_B"], short: [] });
  });
  test("too-few-questions key → short", () => {
    expect(findIncompleteKeys({ S1_A: [1, 2], S1_B: [1] }, expected, 2)).toEqual({ missing: [], short: ["S1_B"] });
  });
});

describe("formatVersionCompletenessError — loud, names exactly what's missing", () => {
  test("names missing keys and the expected total + range", () => {
    const expected = expectedVersionKeys(5, ["A", "B", "C"]); // 15 keys S1_A…S5_C
    const msg = formatVersionCompletenessError(
      expected,
      { missing: ["S4_B", "S5_A", "S5_B", "S5_C"], short: [] },
      true
    );
    expect(msg).toContain("Expected 15 version sets (S1_A…S5_C)");
    expect(msg).toContain("missing S4_B, S5_A, S5_B, S5_C");
    expect(msg).toContain("likely cut off");
    expect(msg).toContain("Regenerate the missing sections.");
  });
  test("reports short keys too", () => {
    const msg = formatVersionCompletenessError(["S1_A", "S1_B"], { missing: [], short: ["S1_B"] }, false);
    expect(msg).toContain("incomplete (too few questions): S1_B");
    expect(msg).not.toContain("cut off");
  });
});

describe("buildSectionVersions — dual-write invariant", () => {
  const selected = [{ id: "q1" }, { id: "q2" }];
  const labels = ["A", "B"];
  let n;
  const makeId = () => `id${++n}`;
  beforeEach(() => { n = 0; });

  test("2 simulated chunk merges → classSectionVersions per section AND versions === section 1", () => {
    // Two section chunks accumulated into one object (the chunked-generation flow).
    const combined = {};
    Object.assign(combined, {
      S1_A: [{ question: "1A1" }, { question: "1A2" }],
      S1_B: [{ question: "1B1" }, { question: "1B2" }],
    });
    Object.assign(combined, {
      S2_A: [{ question: "2A1" }, { question: "2A2" }],
      S2_B: [{ question: "2B1" }, { question: "2B2" }],
    });
    const { classSectionVersions, versions } = buildSectionVersions({
      parsed: combined, numClassSections: 2, labels, selected,
      sanitizeFn: (q) => q, makeId, now: 1000,
    });
    // dual-write: both sections present, active versions === section 1 (same ref)
    expect(Object.keys(classSectionVersions).sort()).toEqual(["1", "2"]);
    expect(versions).toBe(classSectionVersions[1]);
    expect(classSectionVersions[1].map((v) => v.label)).toEqual(["A", "B"]);
    expect(classSectionVersions[2].map((v) => v.label)).toEqual(["A", "B"]);
    // each version mutated both selected questions, tagged with classSection
    expect(classSectionVersions[2][0].questions).toHaveLength(2);
    expect(classSectionVersions[2][0].questions[0].classSection).toBe(2);
    expect(classSectionVersions[2][0].questions[0].originalId).toBe("q1");
    expect(classSectionVersions[2][0].questions[1].originalId).toBe("q2");
  });

  test("masterLocked prepends Version A (the master) into every section", () => {
    const master = { label: "A", questions: [{ question: "master" }] };
    const { classSectionVersions } = buildSectionVersions({
      parsed: { S1_B: [{ question: "1B" }], S2_B: [{ question: "2B" }] },
      numClassSections: 2, labels: ["B"], selected, masterLocked: true, masterVersion: master,
      sanitizeFn: (q) => q, makeId, now: 1,
    });
    expect(classSectionVersions[1][0].label).toBe("A");
    expect(classSectionVersions[1][0].classSection).toBe(1);
    expect(classSectionVersions[2][0].label).toBe("A");
    expect(classSectionVersions[1][1].label).toBe("B");
  });

  test("single-section (version_all): bare-label keys, classSectionVersions[1] only", () => {
    const { classSectionVersions, versions } = buildSectionVersions({
      parsed: { A: [{ question: "a" }, { question: "b" }], B: [{ question: "c" }, { question: "d" }] },
      numClassSections: 1, labels, selected,
      sanitizeFn: (q) => q, makeId, now: 1,
    });
    expect(Object.keys(classSectionVersions)).toEqual(["1"]);
    expect(versions).toBe(classSectionVersions[1]);
    expect(versions.map((v) => v.label)).toEqual(["A", "B"]);
  });

  test("graph questions: graphConfig merged from the master via mergeGraphFn", () => {
    const sel = [{ id: "q1", hasGraph: true, graphConfig: { type: "single", fn: "x^2" } }];
    const { classSectionVersions } = buildSectionVersions({
      parsed: { S1_A: [{ question: "v", graphConfig: { fn: "x^3" } }] },
      numClassSections: 1, labels: ["A"], selected: sel,
      sanitizeFn: (q) => q,
      mergeGraphFn: (orig, next) => ({ ...orig, ...next }),
      makeId, now: 1,
    });
    // numClassSections:1 uses bare labels — here parsed has S1_A, so it reads "A" → empty.
    // Re-run as multi to exercise the graph merge path with the S-key:
    const multi = buildSectionVersions({
      parsed: { S1_A: [{ question: "v", graphConfig: { fn: "x^3" } }] },
      numClassSections: 2, labels: ["A"], selected: sel,
      sanitizeFn: (q) => q,
      mergeGraphFn: (orig, next) => ({ ...orig, ...next }),
      makeId, now: 1,
    });
    const q = multi.classSectionVersions[1][0].questions[0];
    expect(q.hasGraph).toBe(true);
    expect(q.graphConfig).toEqual({ type: "single", fn: "x^3" });
    void classSectionVersions;
  });
});

describe("per section×version auto chunk — single-key validation", () => {
  test("a one-key chunk validates like any other (complete / missing / short)", () => {
    const key = "S2_B";
    expect(findIncompleteKeys({ S2_B: [1, 2] }, [key], 2)).toEqual({ missing: [], short: [] });
    expect(findIncompleteKeys({}, [key], 2)).toEqual({ missing: ["S2_B"], short: [] });
    expect(findIncompleteKeys({ S2_B: [1] }, [key], 2)).toEqual({ missing: [], short: ["S2_B"] });
  });
  test("single-key completeness error names the exact key", () => {
    const msg = formatVersionCompletenessError(["S4_B"], { missing: ["S4_B"], short: [] }, true);
    expect(msg).toContain("S4_B");
    expect(msg).toContain("likely cut off");
  });
});

describe("buildOneSectionVariants + mergeSection — incremental per-section paste", () => {
  const selected = [{ id: "q1" }, { id: "q2" }];
  const labels = ["A", "B"];
  let n;
  const makeId = () => `id${++n}`;
  const opts = (parsed, sectionNum) => ({
    parsed, sectionNum, multi: true, labels, selected, sanitizeFn: (q) => q, makeId, now: 1,
  });
  beforeEach(() => { n = 0; });

  test("buildOneSectionVariants tags label / classSection / originalId per section", () => {
    const variants = buildOneSectionVariants(opts({ S2_A: [{ q: "a1" }, { q: "a2" }], S2_B: [{ q: "b1" }, { q: "b2" }] }, 2));
    expect(variants.map((v) => v.label)).toEqual(["A", "B"]);
    expect(variants[0].classSection).toBe(2);
    expect(variants[0].questions[0].originalId).toBe("q1");
    expect(variants[0].questions[1].originalId).toBe("q2");
  });

  test("two sequential section pastes leave BOTH sections populated (no wipe) + dual-write", () => {
    // Paste 1 → section 1 merges into an empty map.
    const s1 = buildOneSectionVariants(opts({ S1_A: [{ q: "1A" }], S1_B: [{ q: "1B" }] }, 1));
    let state = mergeSection({}, 1, s1);
    expect(Object.keys(state.classSectionVersions)).toEqual(["1"]);
    expect(state.versions).toBe(state.classSectionVersions[1]); // active = section 1

    // Paste 2 → section 2 merges into the EXISTING map; section 1 must survive.
    const s2 = buildOneSectionVariants(opts({ S2_A: [{ q: "2A" }], S2_B: [{ q: "2B" }] }, 2));
    state = mergeSection(state.classSectionVersions, 2, s2);
    expect(Object.keys(state.classSectionVersions).sort()).toEqual(["1", "2"]);
    expect(state.classSectionVersions[1]).toBe(s1);     // section 1 NOT wiped
    expect(state.classSectionVersions[2]).toBe(s2);
    expect(state.versions).toBe(state.classSectionVersions[1]); // dual-write: still section 1
    expect(state.classSectionVersions[1].map((v) => v.label)).toEqual(["A", "B"]);
    expect(state.classSectionVersions[2].map((v) => v.label)).toEqual(["A", "B"]);
  });

  test("re-pasting a section replaces only that section", () => {
    const s1 = buildOneSectionVariants(opts({ S1_A: [{ q: "1A" }], S1_B: [{ q: "1B" }] }, 1));
    const s2 = buildOneSectionVariants(opts({ S2_A: [{ q: "2A" }], S2_B: [{ q: "2B" }] }, 2));
    let state = mergeSection(mergeSection({}, 1, s1).classSectionVersions, 2, s2);
    const s2b = buildOneSectionVariants(opts({ S2_A: [{ q: "2A2" }], S2_B: [{ q: "2B2" }] }, 2));
    state = mergeSection(state.classSectionVersions, 2, s2b);
    expect(state.classSectionVersions[1]).toBe(s1);  // section 1 untouched
    expect(state.classSectionVersions[2]).toBe(s2b); // section 2 replaced
  });
});
