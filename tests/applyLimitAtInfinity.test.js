// §2.6 limits at infinity — apply layer + dispatcher integration. Drives real
// derive-specs end to end: graphConfig compilation, derived answer/HA, the new
// graph/derive consistency + pole + symbolic-only guards, MC matching, no-op, and
// applyLimitDerivation routing/ambiguity.

import { applyLimitAtInfinitySpec } from "../lib/limits/applyLimitAtInfinity.js";
import { applyLimitDerivation } from "../lib/limits/applyLimitLaws.js";

// Ratio-3 rational with a clean pole-free display curve.
const ratio3 = () => ({
  derive: { kind: "rational", num: [3, 0, 1], den: [1, 0, 1] }, // (3x^2+1)/(x^2+1)
  graph: { fn: "(3*x^2+1)/(x^2+1)", xDomain: [-10, 10] },
});

describe("applyLimitAtInfinitySpec — rational end behavior", () => {
  test("endBehavior: graph compiled, HA derived, answer mentions 3 both ends", () => {
    const q = applyLimitAtInfinitySpec({
      type: "Free Response",
      limitAtInfinitySpec: ratio3(),
      asks: [{ quantity: "endBehavior" }],
    });
    expect(q.hasGraph).toBe(true);
    expect(q.graphConfig.type).toBe("single");
    expect(q.graphConfig.fn).toBe("(3*x^2+1)/(x^2+1)");
    expect(q.graphConfig.horizontalAsymptotes).toEqual([{ y: 3, label: "3" }]);
    expect(q.answer).toBe("as x→infinity, f(x)→3; as x→-infinity, f(x)→3");
    expect((q.answer.match(/3/g) || []).length).toBe(2); // 3 at both ends
  });

  test("horizontalAsymptotes ask -> 'y = 3'", () => {
    const q = applyLimitAtInfinitySpec({
      type: "Free Response",
      limitAtInfinitySpec: ratio3(),
      asks: [{ quantity: "horizontalAsymptotes" }],
    });
    expect(q.answer).toBe("y = 3");
  });

  test("graph only (no asks) -> graphConfig but no answer change", () => {
    const q = applyLimitAtInfinitySpec({ type: "Free Response", limitAtInfinitySpec: ratio3() });
    expect(q.hasGraph).toBe(true);
    expect(q.answer).toBeUndefined();
  });
});

describe("applyLimitAtInfinitySpec — Multiple Choice", () => {
  test("derived 'y = 3' matches a choice", () => {
    const q = applyLimitAtInfinitySpec({
      type: "Multiple Choice",
      limitAtInfinitySpec: ratio3(),
      choices: ["y = 3", "y = 1", "y = 0", "none"],
      asks: [{ quantity: "horizontalAsymptotes" }],
    });
    expect(q.answer).toBe("y = 3");
  });

  test("derived value absent from choices -> throws", () => {
    expect(() =>
      applyLimitAtInfinitySpec({
        type: "Multiple Choice",
        limitAtInfinitySpec: ratio3(),
        choices: ["y = 1", "y = 0", "y = 2", "none"],
        asks: [{ quantity: "horizontalAsymptotes" }],
      })
    ).toThrow(/not among the choices/);
  });
});

describe("applyLimitAtInfinitySpec — guards", () => {
  test("consistency: derived ratio 3 but curve tends to 1 -> throws", () => {
    expect(() =>
      applyLimitAtInfinitySpec({
        type: "Free Response",
        limitAtInfinitySpec: {
          derive: { kind: "rational", num: [3, 0, 1], den: [1, 0, 1] }, // -> 3
          graph: { fn: "(x^2+1)/(x^2+1)", xDomain: [-10, 10] }, // -> 1
        },
        asks: [{ quantity: "endBehavior" }],
      })
    ).toThrow(/tail contradicts/);
  });

  test("pole: display curve diverges in-window -> throws", () => {
    expect(() =>
      applyLimitAtInfinitySpec({
        type: "Free Response",
        limitAtInfinitySpec: {
          derive: { kind: "rational", num: [1, 0], den: [1, 0] }, // x/x -> 1
          graph: { fn: "1/(x-2)", xDomain: [-10, 10] }, // pole at x=2
        },
        asks: [{ quantity: "endBehavior" }],
      })
    ).toThrow(/diverges in-window/);
  });

  test("symbolic-only: arctan derive WITH a graph block -> throws", () => {
    expect(() =>
      applyLimitAtInfinitySpec({
        type: "Free Response",
        limitAtInfinitySpec: {
          derive: { kind: "special", base: "arctan" },
          graph: { fn: "x/(1+abs(x))", xDomain: [-10, 10] },
        },
        asks: [{ quantity: "endBehavior" }],
      })
    ).toThrow(/symbolic-only/);
  });

  test("unsupported derive spec -> throws", () => {
    expect(() =>
      applyLimitAtInfinitySpec({
        type: "Free Response",
        limitAtInfinitySpec: { derive: { kind: "bogus" }, graph: { fn: "x", xDomain: [-1, 1] } },
        asks: [],
      })
    ).toThrow(/unsupported/);
  });

  test("missing graph block -> throws", () => {
    expect(() =>
      applyLimitAtInfinitySpec({
        type: "Free Response",
        limitAtInfinitySpec: { derive: { kind: "rational", num: [1], den: [1, 0] } },
      })
    ).toThrow(/requires both/);
  });
});

describe("applyLimitAtInfinitySpec — no-op", () => {
  test("question without limitAtInfinitySpec is returned unchanged (same ref)", () => {
    const q = { type: "Free Response", question: "plain", answer: "42" };
    expect(applyLimitAtInfinitySpec(q)).toBe(q);
  });
});

describe("applyLimitDerivation — §2.6 routing + ambiguity", () => {
  test("routes a limitAtInfinitySpec question to the §2.6 apply layer", () => {
    const q = applyLimitDerivation({
      type: "Free Response",
      limitAtInfinitySpec: ratio3(),
      asks: [{ quantity: "horizontalAsymptotes" }],
    });
    expect(q.hasGraph).toBe(true);
    expect(q.answer).toBe("y = 3");
  });

  test("carrying BOTH a §2.6 spec and a §2.2 limitSpec -> ambiguous throw", () => {
    expect(() =>
      applyLimitDerivation({
        type: "Free Response",
        limitAtInfinitySpec: ratio3(),
        limitSpec: { segments: [{ fn: "x", from: 0, to: 2 }] },
      })
    ).toThrow(/ambiguous/);
  });

  test("a plain question still no-ops through the dispatcher", () => {
    const q = { type: "Free Response", question: "plain", answer: "7" };
    expect(applyLimitDerivation(q)).toBe(q);
  });
});
