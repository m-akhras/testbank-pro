// §2.3 Step 3a — end-to-end derivation wiring for limit-laws questions. Specs and
// asks are built by hand (no template), so these run independently of calc1_2_3.js.

import { applyLimitLaws, applyLimitDerivation } from "../lib/limits/applyLimitLaws.js";
import { applyLimitSpec } from "../lib/limits/applyLimitSpec.js";

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

  test("multi-ask answer lists each labeled part", () => {
    const q = fr([
      { law: "sum", at: 3 },
      { law: "quotient", at: 1 },
    ]);
    expect(q.answer).toMatch(/the limit of \(f \+ g\) as x approaches 3 = 4/);
    expect(q.answer).toMatch(/the limit of f\/g as x approaches 1 = does not exist \(DNE\)/);
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

describe("applyLimitLaws — MC hard-fail + malformed asks", () => {
  test("MC whose choices omit the derived value is rejected", () => {
    expect(() =>
      applyLimitLaws({
        type: "Multiple Choice",
        limitSpecF: specF,
        limitSpecG: specG,
        choices: ["1", "2", "3"], // derived sum at 3 is "4" — absent
        answer: "2",
        lawAsks: [{ law: "sum", at: 3 }],
      })
    ).toThrow(/not among the choices/);
  });

  test("MC matches the derived value when present", () => {
    const q = applyLimitLaws({
      type: "Multiple Choice",
      limitSpecF: specF,
      limitSpecG: specG,
      choices: ["3", "4", "does not exist (DNE)", "infinity"],
      answer: "3",
      lawAsks: [{ law: "sum", at: 3 }],
    });
    expect(q.answer).toBe("4");
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
