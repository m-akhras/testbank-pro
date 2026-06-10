// §2.2 limit-graph logic tests. Covers every case from the uploaded §2.2 images
// (Option A — all discontinuities declared). Pure logic; no rendering.

import { deriveLimits } from "../lib/limits/deriveLimits.js";
import { validateLimitSpec } from "../lib/limits/limitGraphSpec.js";

describe("deriveLimits — §2.2 cases", () => {
  // 1. Removable hole: x+2 on [0,4], hole at (2,4).
  test("removable hole: limit exists, f(a) undefined", () => {
    const spec = {
      segments: [{ fn: "x+2", from: 0, to: 4 }],
      holes: [{ x: 2, y: 4 }],
    };
    const r = deriveLimits(spec, 2);
    expect(r.leftLimit).toBe(4);
    expect(r.rightLimit).toBe(4);
    expect(r.twoSided).toBe(4);
    expect(r.fValue).toBeNull();
    expect(r.continuous).toBe(false);
    expect(r.discontinuityKind).toBe("removable");
  });

  // 2. Limit exists but f(a) differs: hole at (2,4) + filled point (2,6).
  test("removable: limit ≠ f(a) (filled point override)", () => {
    const spec = {
      segments: [{ fn: "x+2", from: 0, to: 4 }],
      holes: [{ x: 2, y: 4 }],
      points: [{ x: 2, y: 6 }],
    };
    const r = deriveLimits(spec, 2);
    expect(r.twoSided).toBe(4);
    expect(r.fValue).toBe(6);
    expect(r.continuous).toBe(false);
    expect(r.discontinuityKind).toBe("removable");
  });

  // 3. Jump: seg A → (3, 4) open circle, seg B filled at (3, 1).
  test("jump: left ≠ right, two-sided DNE", () => {
    const spec = {
      segments: [
        { fn: "x+1", from: 0, to: 3, openRight: true }, // approaches 4 at x→3⁻
        { fn: "x-2", from: 3, to: 6, openLeft: false }, // f(3) = 1, x→3⁺ = 1
      ],
    };
    const r = deriveLimits(spec, 3);
    expect(r.leftLimit).toBe(4);
    expect(r.rightLimit).toBe(1);
    expect(r.twoSided).toBeNull();
    expect(r.fValue).toBe(1);
    expect(r.discontinuityKind).toBe("jump");
    expect(r.continuous).toBe(false);
  });

  // 4. Vertical asymptote at x=3: leftSign -inf, rightSign +inf.
  test("infinite: vertical asymptote", () => {
    const spec = {
      segments: [],
      verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
    };
    const r = deriveLimits(spec, 3);
    expect(r.leftLimit).toBe("-inf");
    expect(r.rightLimit).toBe("+inf");
    expect(r.twoSided).toBeNull();
    expect(r.fValue).toBeNull();
    expect(r.discontinuityKind).toBe("infinite");
    expect(r.verticalAsymptotes).toEqual([3]);
  });

  // 4b. Matching infinities collapse to that infinity (sanity on combine rule).
  test("infinite: both sides +inf → two-sided +inf", () => {
    const spec = {
      segments: [],
      verticalAsymptotes: [{ x: 1, leftSign: "+inf", rightSign: "+inf" }],
    };
    const r = deriveLimits(spec, 1);
    expect(r.twoSided).toBe("+inf");
    expect(r.discontinuityKind).toBe("infinite");
  });

  // 5. Continuous point: smooth segment through (2, 4), no hole/point.
  test("continuous: two-sided == f(a)", () => {
    const spec = { segments: [{ fn: "x+2", from: 0, to: 4 }] };
    const r = deriveLimits(spec, 2);
    expect(r.twoSided).toBe(4);
    expect(r.fValue).toBe(4);
    expect(r.continuous).toBe(true);
    expect(r.discontinuityKind).toBe("none");
  });

  // 6. One-sided only / endpoint-of-domain behavior (right end of domain).
  test("endpoint of domain: only the left limit exists", () => {
    const spec = { segments: [{ fn: "x+2", from: 0, to: 4 }] };
    const r = deriveLimits(spec, 4);
    expect(r.leftLimit).toBe(6);
    expect(r.rightLimit).toBeNull();
    expect(r.twoSided).toBeNull();
    expect(r.fValue).toBe(6); // closed right endpoint is filled
    expect(r.discontinuityKind).toBe("none");
    expect(r.continuous).toBe(false); // no two-sided continuity at the boundary
  });

  // 7. Rational written raw: (x^2-4)/(x-2) with a declared hole at x=2.
  //    The evaluator must SAMPLE toward 2, never AT it (no divide-by-zero).
  test("raw rational with declared hole: approaches 4, never divides at 2", () => {
    const spec = {
      segments: [{ fn: "(x^2-4)/(x-2)", from: 0, to: 4 }],
      holes: [{ x: 2, y: 4 }],
    };
    const r = deriveLimits(spec, 2);
    expect(r.leftLimit).toBe(4);
    expect(r.rightLimit).toBe(4);
    expect(r.twoSided).toBe(4);
    expect(r.fValue).toBeNull();
    expect(r.discontinuityKind).toBe("removable");
  });

  // 8. Exponential segments meeting at a boundary: 2^x on [0,2] and [2,4].
  test("exponential evaluated at a segment boundary", () => {
    const spec = {
      segments: [
        { fn: "2^x", from: 0, to: 2, openRight: true },
        { fn: "2^x", from: 2, to: 4, openLeft: false },
      ],
    };
    const r = deriveLimits(spec, 2);
    expect(r.leftLimit).toBe(4); // 2^2
    expect(r.rightLimit).toBe(4);
    expect(r.twoSided).toBe(4);
    expect(r.fValue).toBe(4);
    expect(r.continuous).toBe(true);
    expect(r.discontinuityKind).toBe("none");
  });
});

describe("validateLimitSpec", () => {
  test("accepts a well-formed spec and returns it", () => {
    const spec = {
      segments: [{ fn: "x+2", from: 0, to: 4, openLeft: false, openRight: true }],
      holes: [{ x: 2, y: 4 }],
      points: [{ x: 2, y: 6 }],
      verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
    };
    expect(validateLimitSpec(spec)).toBe(spec);
  });

  test("throws when spec is not an object", () => {
    expect(() => validateLimitSpec(null)).toThrow(/spec must be an object/);
  });

  test("throws when segments is missing", () => {
    expect(() => validateLimitSpec({})).toThrow(/`segments` must be an array/);
  });

  test("throws on an uncompilable segment fn", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "x +* ", from: 0, to: 1 }] })
    ).toThrow(/not a compilable expression/);
  });

  test("throws when from >= to", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "x", from: 4, to: 0 }] })
    ).toThrow(/require from < to/);
  });

  test("throws on a bad infinity sign", () => {
    expect(() =>
      validateLimitSpec({
        segments: [],
        verticalAsymptotes: [{ x: 1, leftSign: "up", rightSign: "+inf" }],
      })
    ).toThrow(/leftSign must be one of/);
  });

  test("throws on a non-numeric hole coordinate", () => {
    expect(() =>
      validateLimitSpec({ segments: [], holes: [{ x: 2, y: "high" }] })
    ).toThrow(/holes\[0\]\.y must be a finite number/);
  });
});
