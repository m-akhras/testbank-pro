// §2.3 Step 3a — end-to-end derivation wiring for limit-laws questions. Specs and
// asks are built by hand (no template), so these run independently of calc1_2_3.js.

import { applyLimitLaws, applyLimitDerivation } from "../lib/limits/applyLimitLaws.js";
import { applyLimitSpec } from "../lib/limits/applyLimitSpec.js";
import { isLimitTemplateSection } from "../lib/templates/registry.js";

// f: jump at x=2 (left-limit 3, right-limit 1, f(2)=1); finite elsewhere on (2,10).
const specF = {
  segments: [
    { fn: "x+1", from: 0, to: 2, openRight: true }, // x→2⁻ = 3
    { fn: "x-1", from: 2, to: 10 }, // x→2⁺ = 1; f(3)=2, f(8)=7
  ],
  points: [{ x: 2, y: 1 }],
};
// g: finite "x-1" on (0,6) (g(1)=0, g(3)=2); a matched-sign VA at x=8 (in a gap).
const specG = {
  segments: [{ fn: "x-1", from: 0, to: 6 }],
  verticalAsymptotes: [{ x: 8, leftSign: "+inf", rightSign: "+inf" }],
};

const fr = (lawAsks) =>
  applyLimitLaws({ type: "Free Response", limitSpecF: specF, limitSpecG: specG, lawAsks });

describe("applyLimitLaws — end-to-end derivation (FR)", () => {
  test("sum at 3 where both are finite → exact value", () => {
    // f(3)=2, g(3)=2 → 4
    expect(fr([{ law: "sum", at: 3 }]).answer).toBe("4");
  });

  test("quotient at 1 where lim g = 0 → DNE", () => {
    // f(1)=2, g(1)=0 → finite-nonzero / 0 → does not exist
    expect(fr([{ law: "quotient", at: 1 }]).answer).toBe("does not exist (DNE)");
  });

  test("product at the VA (8) with finite-nonzero f → infinity by sign", () => {
    // f(8)=7 (>0), g(8)=+∞ → +∞
    expect(fr([{ law: "product", at: 8 }]).answer).toBe("infinity");
  });

  test("difference at the jump (2) → DNE (f two-sided does not exist)", () => {
    expect(fr([{ law: "difference", at: 2 }]).answer).toBe("does not exist (DNE)");
  });

  test("compiles ONE functionPair graphConfig + hasGraph", () => {
    const q = fr([{ law: "sum", at: 3 }]);
    expect(q.hasGraph).toBe(true);
    expect(q.graphConfig.type).toBe("functionPair");
    expect(q.graphConfig.f.type).toBe("piecewise");
    expect(q.graphConfig.g.type).toBe("piecewise");
  });

  test("SINGLE-ASK: more than one lawAsk is a structural hard-fail", () => {
    expect(() => fr([{ law: "sum", at: 3 }, { law: "quotient", at: 1 }]))
      .toThrow(/single-ask: exactly one lawAsk/);
  });

  test("explanation states the single derived fact", () => {
    expect(fr([{ law: "sum", at: 3 }]).explanation)
      .toBe("The limit of (f + g) as x approaches 3 is 4.");
  });
});

describe("applyLimitLaws — xPolyTimesF (k = p(a) evaluated by the caller)", () => {
  test("poly x^2+1 at a=2 → k=5, times a finite f(2)=2 → 10", () => {
    const q = applyLimitLaws({
      type: "Free Response",
      limitSpecF: { segments: [{ fn: "x", from: 0, to: 4 }] }, // f(2)=2
      limitSpecG: { segments: [{ fn: "x", from: 0, to: 4 }] },
      lawAsks: [{ law: "xPolyTimesF", at: 2, params: { poly: "x^2+1" } }],
    });
    expect(q.answer).toBe("10");
  });

  test("poly x^2+1 at a=2 → k=5, times f=+∞ → infinity", () => {
    const q = applyLimitLaws({
      type: "Free Response",
      limitSpecF: { segments: [], verticalAsymptotes: [{ x: 2, leftSign: "+inf", rightSign: "+inf" }] },
      limitSpecG: { segments: [{ fn: "x", from: 0, to: 4 }] },
      lawAsks: [{ law: "xPolyTimesF", at: 2, params: { poly: "x^2+1" } }],
    });
    expect(q.answer).toBe("infinity");
  });

  test("missing poly → hard-fail", () => {
    expect(() =>
      applyLimitLaws({
        type: "Free Response",
        limitSpecF: specF,
        limitSpecG: specG,
        lawAsks: [{ law: "xPolyTimesF", at: 3 }],
      })
    ).toThrow(/requires params\.poly/);
  });
});

describe("applyLimitLaws — MC scalar injection (§2.5-style) + malformed asks", () => {
  test("derived scalar injected among distractors (replace last if absent)", () => {
    const q = applyLimitLaws({
      type: "Multiple Choice",
      limitSpecF: specF,
      limitSpecG: specG,
      choices: ["3", "5", "2", "placeholder"], // distractors; "4" absent
      answer: "5", // model's marked answer — ignored
      lawAsks: [{ law: "sum", at: 3 }], // derives "4"
    });
    expect(q.answer).toBe("4"); // bare scalar, system-derived
    expect(q.choices).toContain("4");
    expect(q.choices).toHaveLength(4);
    expect(q.choices[3]).toBe("4"); // replaced the LAST distractor (mirrors §2.5)
  });

  test("reuses a model choice that already equals the derived value", () => {
    const q = applyLimitLaws({
      type: "Multiple Choice",
      limitSpecF: specF,
      limitSpecG: specG,
      choices: ["3", "4", "does not exist (DNE)", "infinity"],
      answer: "3",
      lawAsks: [{ law: "sum", at: 3 }],
    });
    expect(q.answer).toBe("4");
    expect(q.choices).toEqual(["3", "4", "does not exist (DNE)", "infinity"]); // unchanged
  });

  test("DNE answer injected (quotient where lim g = 0)", () => {
    const q = applyLimitLaws({
      type: "Multiple Choice",
      limitSpecF: specF,
      limitSpecG: specG,
      choices: ["0", "2", "infinity", "1"], // "does not exist (DNE)" absent
      lawAsks: [{ law: "quotient", at: 1 }],
    });
    expect(q.answer).toBe("does not exist (DNE)");
    expect(q.choices).toContain("does not exist (DNE)");
  });

  test("MC with fewer than 2 choices → structural hard-fail", () => {
    expect(() =>
      applyLimitLaws({
        type: "Multiple Choice",
        limitSpecF: specF,
        limitSpecG: specG,
        choices: ["only one"],
        lawAsks: [{ law: "sum", at: 3 }],
      })
    ).toThrow(/at least 2 distractor/);
  });

  test("unknown law → hard-fail", () => {
    expect(() => fr([{ law: "frobnicate", at: 3 }])).toThrow(/unknown or missing law/);
  });

  test("non-finite at → hard-fail", () => {
    expect(() => fr([{ law: "sum", at: "two" }])).toThrow(/finite numeric "at"/);
  });

  test("requires BOTH specs", () => {
    expect(() =>
      applyLimitLaws({ type: "Free Response", limitSpecF: specF, lawAsks: [{ law: "sum", at: 3 }] })
    ).toThrow(/requires BOTH limitSpecF and limitSpecG/);
  });

  test("invalid spec fails closed (phantom VA)", () => {
    const phantom = {
      segments: [{ fn: "x+2", from: 0, to: 4 }],
      verticalAsymptotes: [{ x: 2, leftSign: "+inf", rightSign: "+inf" }],
    };
    expect(() =>
      applyLimitLaws({ type: "Free Response", limitSpecF: phantom, limitSpecG: specG, lawAsks: [{ law: "sum", at: 1 }] })
    ).toThrow();
  });
});

describe("applyLimitDerivation — dispatch by question shape", () => {
  const singleSpecQ = {
    type: "Free Response",
    limitSpec: { segments: [{ fn: "x+2", from: 0, to: 4 }], holes: [{ x: 2, y: 4 }] },
    asks: [{ quantity: "limit", at: 2 }],
  };

  test("limitSpec-only routes to applyLimitSpec (single piecewise graph)", () => {
    const viaDispatch = applyLimitDerivation(singleSpecQ);
    const viaDirect = applyLimitSpec(singleSpecQ);
    expect(viaDispatch.answer).toBe("4");
    expect(viaDispatch.graphConfig.type).toBe("piecewise"); // NOT functionPair
    expect(viaDispatch.answer).toBe(viaDirect.answer);
  });

  test("pair shape routes to applyLimitLaws (functionPair graph)", () => {
    const q = applyLimitDerivation({
      type: "Free Response",
      limitSpecF: specF,
      limitSpecG: specG,
      lawAsks: [{ law: "sum", at: 3 }],
    });
    expect(q.graphConfig.type).toBe("functionPair");
    expect(q.answer).toBe("4");
  });

  test("BOTH shapes → ambiguous hard-fail", () => {
    expect(() =>
      applyLimitDerivation({
        type: "Free Response",
        limitSpec: singleSpecQ.limitSpec,
        limitSpecF: specF,
        limitSpecG: specG,
        lawAsks: [{ law: "sum", at: 3 }],
      })
    ).toThrow(/ambiguous/);
  });

  test("plain question (no specs) is a no-op pass-through", () => {
    const plain = { type: "Multiple Choice", question: "Q", choices: ["a", "b"], answer: "a" };
    expect(applyLimitDerivation(plain)).toBe(plain);
  });
});

describe("applyLimitDerivation — graph-without-spec guard (mixed hard rule)", () => {
  // A no-spec graph question as the model would emit it (hasGraph + graphConfig,
  // no limitSpec/limitSpecF/G).
  const graphNoSpec = {
    type: "Free Response",
    section: "2.2 The Limit of a Function",
    hasGraph: true,
    graphConfig: { type: "single", fn: "x^2", xDomain: [-3, 3] },
  };

  test("limit-section graph-without-spec → throws", () => {
    expect(() =>
      applyLimitDerivation(graphNoSpec, { requireSpecForGraph: true })
    ).toThrow(/graph but no spec|graph-without-spec rejected/);
  });

  test("non-limit-section graph question → passes through untouched", () => {
    const out = applyLimitDerivation(graphNoSpec, { requireSpecForGraph: false });
    expect(out).toBe(graphNoSpec); // same reference, no-op
  });

  test("default (no opts) does not fire the guard — back-compat", () => {
    expect(applyLimitDerivation(graphNoSpec)).toBe(graphNoSpec);
  });

  test("a spec-backed graph question passes the guard", () => {
    const q = {
      type: "Free Response",
      section: "2.2 The Limit of a Function",
      limitSpec: { segments: [{ fn: "x+2", from: 0, to: 4 }], holes: [{ x: 2, y: 4 }] },
      asks: [{ quantity: "limit", at: 2 }],
    };
    const out = applyLimitDerivation(q, { requireSpecForGraph: true });
    expect(out.answer).toBe("4");
    expect(out.hasGraph).toBe(true);
  });

  test("a symbolic (no-graph, no-spec) question passes even in a limit section", () => {
    const q = { type: "Free Response", section: "2.3 ...", question: "Evaluate lim x->2 (3x-7)", answer: "-1" };
    const out = applyLimitDerivation(q, { requireSpecForGraph: true });
    expect(out).toBe(q); // no graph payload → not flagged
  });
});

describe("isLimitTemplateSection — guard scoping", () => {
  test("true for the three limit-template sections", () => {
    expect(isLimitTemplateSection("Calculus 1", "2.2 The Limit of a Function")).toBe(true);
    expect(isLimitTemplateSection("Calculus 1", "2.3 Calculating Limits Using the Limit Laws")).toBe(true);
    expect(isLimitTemplateSection("Calculus 1", "2.5 Continuity")).toBe(true);
  });

  test("false for non-limit sections / courses", () => {
    expect(isLimitTemplateSection("Calculus 1", "1.3 New Functions from Old Functions")).toBe(false);
    expect(isLimitTemplateSection("Quantitative Methods I", "3.1 Whatever")).toBe(false);
    expect(isLimitTemplateSection("Calculus 1", undefined)).toBe(false);
  });
});

describe("applyLimitLaws — n-th root phrasing (never '#-th')", () => {
  // Small, readable spec (endpoints 0..4 → feature span well under the cap). The
  // root LABEL phrasing is what we assert, not the value, so a fixed at=4 suffices.
  const expl = (n) =>
    applyLimitLaws({
      type: "Free Response",
      limitSpecF: { segments: [{ fn: "x", from: 0, to: 4 }] }, // f(4)=4
      limitSpecG: { segments: [{ fn: "x", from: 0, to: 4 }] },
      lawAsks: [{ law: "root", at: 4, params: { n } }],
    }).explanation;

  test("n=2 → 'square root of f', n=3 → 'cube root of f', n=4 → '4th root of f'", () => {
    expect(expl(2)).toContain("square root of f");
    expect(expl(3)).toContain("cube root of f");
    expect(expl(4)).toContain("4th root of f");
  });

  test("never emits the '#-th root' bug", () => {
    const all = expl(2) + expl(3) + expl(4) + expl(5);
    expect(all).not.toMatch(/-th root/);
  });
});
