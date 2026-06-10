// §2.2 limit-graph logic tests. Covers every case from the uploaded §2.2 images
// (Option A — all discontinuities declared). Pure logic; no rendering.

import { deriveLimits } from "../lib/limits/deriveLimits.js";
import { validateLimitSpec } from "../lib/limits/limitGraphSpec.js";
import { compileToGraphConfig } from "../lib/limits/compileToGraphConfig.js";

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

describe("compileToGraphConfig — §2.2 → existing piecewise graphConfig", () => {
  // 1. Removable hole → the hole coordinate is carried; no filled point.
  test("removable hole: piece + hole, no points", () => {
    const cfg = compileToGraphConfig({
      segments: [{ fn: "x+2", from: 0, to: 4 }],
      holes: [{ x: 2, y: 4 }],
    });
    expect(cfg.type).toBe("piecewise");
    expect(cfg.pieces).toEqual([{ fn: "x+2", domain: [0, 4] }]);
    expect(cfg.holes).toEqual([[2, 4]]);
    expect(cfg.points).toEqual([]);
    expect(cfg.verticalAsymptotes).toEqual([]);
  });

  // 2. limit ≠ f(a): hole carried AND the filled override.
  test("removable with override: hole [2,4] + point [2,6]", () => {
    const cfg = compileToGraphConfig({
      segments: [{ fn: "x+2", from: 0, to: 4 }],
      holes: [{ x: 2, y: 4 }],
      points: [{ x: 2, y: 6 }],
    });
    expect(cfg.holes).toEqual([[2, 4]]);
    expect(cfg.points).toEqual([[2, 6]]);
  });

  // 3. Jump: open circle at the LEFT-LIMIT endpoint (from the open segment end)
  //    AND the filled dot at f(a). Same x, different y → both survive dedupe.
  test("jump: open circle [3,4] AND filled dot [3,1]", () => {
    const cfg = compileToGraphConfig({
      segments: [
        { fn: "x+1", from: 0, to: 3, openRight: true }, // open circle at (3,4)
        { fn: "x-2", from: 3, to: 6 }, // line reaches (3,1)
      ],
      points: [{ x: 3, y: 1 }], // declared filled f(3)=1
    });
    expect(cfg.pieces).toEqual([
      { fn: "x+1", domain: [0, 3] },
      { fn: "x-2", domain: [3, 6] },
    ]);
    expect(cfg.holes).toContainEqual([3, 4]); // left-limit endpoint, open
    expect(cfg.points).toContainEqual([3, 1]); // actual value, filled
  });

  // 4. Vertical asymptote → additive verticalAsymptotes passthrough.
  test("VA: config.verticalAsymptotes carries [3]", () => {
    const cfg = compileToGraphConfig({
      segments: [],
      verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
    });
    expect(cfg.type).toBe("piecewise");
    expect(cfg.verticalAsymptotes).toEqual([3]);
    expect(cfg.pieces).toEqual([]);
    expect(cfg.holes).toEqual([]);
    expect(cfg.points).toEqual([]);
  });

  // 5. Continuous: no holes, no points.
  test("continuous: piece only, no holes/points", () => {
    const cfg = compileToGraphConfig({ segments: [{ fn: "x+2", from: 0, to: 4 }] });
    expect(cfg.pieces).toEqual([{ fn: "x+2", domain: [0, 4] }]);
    expect(cfg.holes).toEqual([]);
    expect(cfg.points).toEqual([]);
    expect(cfg.xDomain).toEqual([-0.5, 4.5]); // span 4 → pad 0.5
  });

  // 7. Raw rational: declared hole carried verbatim; fn never sampled AT x=2.
  test("raw rational: hole [2,4] carried, no divide-by-zero", () => {
    const cfg = compileToGraphConfig({
      segments: [{ fn: "(x^2-4)/(x-2)", from: 0, to: 4 }],
      holes: [{ x: 2, y: 4 }],
    });
    expect(cfg.pieces).toEqual([{ fn: "(x^2-4)/(x-2)", domain: [0, 4] }]);
    expect(cfg.holes).toEqual([[2, 4]]);
    expect(cfg.points).toEqual([]);
  });

  // 8. Exponential open endpoint → open circle y computed via compileExpression.
  test("exponential: open right endpoint yields hole [2,4] (2^2)", () => {
    const cfg = compileToGraphConfig({
      segments: [
        { fn: "2^x", from: 0, to: 2, openRight: true },
        { fn: "2^x", from: 2, to: 4 },
      ],
    });
    expect(cfg.holes).toEqual([[2, 4]]);
    expect(cfg.points).toEqual([]);
  });

  // Dedupe: an open endpoint whose coordinate equals a declared hole isn't doubled.
  test("dedupe: open endpoint coinciding with a declared hole is not duplicated", () => {
    const cfg = compileToGraphConfig({
      segments: [{ fn: "x+2", from: 0, to: 2, openRight: true }],
      holes: [{ x: 2, y: 4 }],
    });
    expect(cfg.holes).toEqual([[2, 4]]); // single entry
  });

  test("rejects a malformed spec before compiling", () => {
    expect(() => compileToGraphConfig({})).toThrow(/`segments` must be an array/);
  });
});
