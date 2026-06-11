// §2.2 limit-graph logic tests. Covers every case from the uploaded §2.2 images
// (Option A — all discontinuities declared). Pure logic; no rendering.

import { deriveLimits } from "../lib/limits/deriveLimits.js";
import { validateLimitSpec } from "../lib/limits/limitGraphSpec.js";
import { compileToGraphConfig, compileToFunctionPairConfig } from "../lib/limits/compileToGraphConfig.js";
import { applyLimitSpec } from "../lib/limits/applyLimitSpec.js";
import {
  deriveDiscontinuitySet,
  limitDNESet,
  discontinuitySet,
  removableSet,
  composeContinuityStatement,
  composeLimitDNEStatement,
} from "../lib/limits/continuity.js";

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
      // VA sits in a gap beyond the segment (x=6 > to=4) so the phantom-VA guard
      // has no covering segment to contradict it.
      verticalAsymptotes: [{ x: 6, leftSign: "-inf", rightSign: "+inf" }],
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

describe("validateLimitSpec — phantom vertical-asymptote guard", () => {
  // REJECT: a root segment is finite (~2.65) at the declared VA.
  test("rejects a VA where a sqrt segment is finite", () => {
    expect(() =>
      validateLimitSpec({
        segments: [{ fn: "sqrt(x+5)", from: -5, to: 4 }],
        verticalAsymptotes: [{ x: 2, leftSign: "-inf", rightSign: "+inf" }],
      })
    ).toThrow(/declared vertical asymptote at x=2 but segment "sqrt\(x\+5\)" is finite/);
  });

  // REJECT: a polynomial segment never diverges → no real VA.
  test("rejects a VA where a polynomial segment is finite", () => {
    expect(() =>
      validateLimitSpec({
        segments: [{ fn: "x^2+2", from: -3, to: 3 }],
        verticalAsymptotes: [{ x: 1, leftSign: "+inf", rightSign: "+inf" }],
      })
    ).toThrow(/declared vertical asymptote at x=1 but segment "x\^2\+2" is finite/);
  });

  // ACCEPT: a rational bordering x=2 genuinely blows up there.
  test("accepts a VA where a bordering rational diverges", () => {
    expect(() =>
      validateLimitSpec({
        segments: [{ fn: "(x+1)/(x-2)", from: 2, to: 6, openLeft: true }],
        verticalAsymptotes: [{ x: 2, leftSign: "-inf", rightSign: "+inf" }],
      })
    ).not.toThrow();
  });

  // ACCEPT: a VA sitting in a GAP between two segments (no covering segment).
  test("accepts a VA in a gap between segments (no covering segment)", () => {
    expect(() =>
      validateLimitSpec({
        segments: [
          { fn: "x", from: -3, to: 2, openRight: true },
          { fn: "x", from: 4, to: 7, openLeft: true },
        ],
        verticalAsymptotes: [{ x: 3, leftSign: "+inf", rightSign: "-inf" }],
      })
    ).not.toThrow();
  });
});

describe("validateLimitSpec — undeclared-pole guard", () => {
  // PART A — interior pole (odd): the production wrong-DNE bug.
  test("rejects an interior odd pole (x+1)/(x-1) on [0,3]", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "(x+1)/(x-1)", from: 0, to: 3 }] })
    ).toThrow(/diverges at the interior point/);
  });

  // PART A — interior pole even, even when a (declared) VA exists elsewhere.
  test("rejects an interior even pole 1/(x-1)^2 on [0,3]", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "1/(x-1)^2", from: 0, to: 3 }] })
    ).toThrow(/diverges at the interior point/);
  });

  // The exact production bug spec: interval CONTAINS the pole x=1 as an interior point.
  test("rejects the production wrong-DNE spec (pole strictly inside)", () => {
    expect(() =>
      validateLimitSpec({
        segments: [{ fn: "(x+1)/(x-1)", from: -2, to: 4 }],
        verticalAsymptotes: [{ x: 1, leftSign: "-inf", rightSign: "+inf" }], // irrelevant: pole is interior
      })
    ).toThrow(/diverges at the interior point/);
  });

  // PART B — boundary pole with NO declared VA → rejected.
  test("rejects a boundary pole with no declared VA", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "(x+1)/(x-1)", from: 1, to: 3 }] })
    ).toThrow(/diverges at the boundary x=1 but no vertical asymptote is declared/);
  });

  // PART B — boundary pole WITH a declared VA → legal, passes.
  test("accepts a boundary pole when a VA is declared there", () => {
    expect(() =>
      validateLimitSpec({
        segments: [{ fn: "(x+1)/(x-1)", from: 1, to: 3, openLeft: true }],
        verticalAsymptotes: [{ x: 1, leftSign: "-inf", rightSign: "+inf" }],
      })
    ).not.toThrow();
  });

  // ACCEPT — steep-but-finite must not false-positive.
  test("accepts steep-but-finite exp(x) and x^3", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "exp(x)", from: -2, to: 5 }] })
    ).not.toThrow();
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "x^3", from: -4, to: 4 }] })
    ).not.toThrow();
  });

  // ACCEPT — clean cases, including a declared removable hole (0/0 = NaN, bounded).
  test("accepts clean segments and a declared removable hole", () => {
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "x+2", from: 0, to: 4 }] })
    ).not.toThrow();
    expect(() =>
      validateLimitSpec({ segments: [{ fn: "sqrt(x+5)", from: -5, to: 4 }] })
    ).not.toThrow();
    expect(() =>
      validateLimitSpec({
        segments: [{ fn: "(x^2-4)/(x-2)", from: 0, to: 4 }],
        holes: [{ x: 2, y: 4 }],
      })
    ).not.toThrow();
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

  // Fix 3: an integer x-tick step is emitted for denser axis labels.
  test("emits xTickStep so x integers are labeled across the domain", () => {
    const small = compileToGraphConfig({ segments: [{ fn: "x+2", from: 0, to: 4 }] });
    expect(small.xTickStep).toBe(1); // span 5 ≤ 12 → step 1

    // A wide domain (segments far apart) scales the step up to keep ~12 labels.
    const wide = compileToGraphConfig({
      segments: [
        { fn: "x", from: -20, to: -18, openRight: true },
        { fn: "x", from: 18, to: 20, openLeft: true },
      ],
    });
    const span = wide.xDomain[1] - wide.xDomain[0];
    expect(wide.xTickStep).toBe(Math.ceil(span / 12));
    expect(wide.xTickStep).toBeGreaterThan(1);
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

describe("applyLimitSpec — §2.2 spec → derived answer key + graph", () => {
  const removableSpec = {
    segments: [{ fn: "x+2", from: 0, to: 4 }],
    holes: [{ x: 2, y: 4 }],
  };

  // FR single ask: the two-sided limit at the hole.
  test("FR single ask: answer reflects the derived limit, graph compiled", () => {
    const q = applyLimitSpec({
      type: "Free Response",
      question: "Find the limit as x approaches 2.",
      answer: "(model guess, ignored)",
      explanation: "(model guess, ignored)",
      limitSpec: removableSpec,
      asks: [{ quantity: "limit", at: 2 }],
    });
    expect(q.answer).toBe("4");
    expect(q.hasGraph).toBe(true);
    expect(q.graphConfig).toEqual({
      type: "piecewise",
      pieces: [{ fn: "x+2", domain: [0, 4] }],
      holes: [[2, 4]],
      points: [],
      verticalAsymptotes: [],
      xDomain: [-0.5, 4.5],
      xTickStep: 1, // span 5 ≤ 12 → integer step
    });
    expect(q.explanation).toMatch(/limit as x approaches 2 is 4/i);
  });

  // FR multi-ask on a jump: left / right / two-sided / f(a) each stated.
  test("FR multi-ask jump: answer states each derived fact", () => {
    const jumpSpec = {
      segments: [
        { fn: "x+1", from: 0, to: 3, openRight: true }, // left limit 4
        { fn: "x-2", from: 3, to: 6 }, // right limit 1
      ],
      points: [{ x: 3, y: 1 }], // f(3) = 1
    };
    const q = applyLimitSpec({
      type: "Free Response",
      question: "At x = 3, find the one-sided limits, the limit, and f(3).",
      limitSpec: jumpSpec,
      asks: [
        { quantity: "leftLimit", at: 3 },
        { quantity: "rightLimit", at: 3 },
        { quantity: "limit", at: 3 },
        { quantity: "fValue", at: 3 },
      ],
    });
    expect(q.answer).toMatch(/left-hand limit as x approaches 3 = 4/);
    expect(q.answer).toMatch(/right-hand limit as x approaches 3 = 1/);
    expect(q.answer).toMatch(/limit as x approaches 3 = does not exist \(DNE\)/);
    expect(q.answer).toMatch(/f\(3\) = 1/);
  });

  // VA: asks verticalAsymptotes → answer lists the VA x-locations.
  test("FR vertical asymptotes: answer lists the VA x's", () => {
    const vaSpec = {
      segments: [],
      verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
    };
    const q = applyLimitSpec({
      type: "Free Response",
      question: "List the vertical asymptotes.",
      limitSpec: vaSpec,
      asks: [{ quantity: "verticalAsymptotes", at: 0 }],
    });
    expect(q.answer).toBe("x = 3");
    expect(q.graphConfig.verticalAsymptotes).toEqual([3]);
  });

  // MC match: derived "4" matches a choice → answer set to that choice string.
  test("MC match: derived value matched to a choice", () => {
    const q = applyLimitSpec({
      type: "Multiple Choice",
      question: "What is the limit as x approaches 2?",
      choices: ["2", "4", "6", "does not exist (DNE)"],
      answer: "6", // model guess — ignored
      limitSpec: removableSpec,
      asks: [{ quantity: "limit", at: 2 }],
    });
    expect(q.answer).toBe("4");
  });

  // MC hard-fail: derived "4" but no choice equals it → throws (question rejected).
  test("MC hard-fail: derived value not among choices throws", () => {
    expect(() =>
      applyLimitSpec({
        type: "Multiple Choice",
        question: "What is the limit as x approaches 2?",
        choices: ["2", "3", "5", "6"],
        answer: "3",
        limitSpec: removableSpec,
        asks: [{ quantity: "limit", at: 2 }],
      })
    ).toThrow(/not among the choices/);
  });

  // No-op: a question without limitSpec is returned byte-identical.
  test("no-op: question without limitSpec passes through unchanged", () => {
    const q = {
      type: "Multiple Choice",
      question: "Plain question",
      choices: ["a", "b", "c", "d"],
      answer: "b",
    };
    const out = applyLimitSpec(q);
    expect(out).toBe(q); // same reference — truly untouched
  });
});

describe("§2.5 continuity — enumeration, statements, point + global asks", () => {
  // Representative spec with ALL three discontinuity kinds + a continuous join:
  //  - continuous join at x = 0.5 (same fn both sides) — must NOT appear in any set
  //  - removable hole at x = 1 (limit 2 exists, f(1) undefined)
  //  - jump at x = 2 (left-limit 3 ≠ right-limit 2, f(2)=2)
  //  - infinite VA at x = 3 (declared, in a gap)
  const spec = {
    segments: [
      { fn: "x+1", from: 0, to: 0.5 },
      { fn: "x+1", from: 0.5, to: 2, openRight: true },
      { fn: "x", from: 2, to: 2.5 },
    ],
    holes: [{ x: 1, y: 2 }],
    points: [{ x: 2, y: 2 }],
    verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
  };

  test("deriveDiscontinuitySet → exactly {1:removable, 2:jump, 3:infinite}", () => {
    const set = deriveDiscontinuitySet(spec);
    expect(set.map((r) => [r.x, r.kind])).toEqual([
      [1, "removable"],
      [2, "jump"],
      [3, "infinite"],
    ]);
    // the continuous join at 0.5 (and the domain endpoints) are absent
    expect(set.some((r) => r.x === 0.5)).toBe(false);
  });

  test("selectors: limitDNESet / discontinuitySet / removableSet", () => {
    expect(limitDNESet(spec)).toEqual([2, 3]); // jumps + infinite
    expect(discontinuitySet(spec)).toEqual([1, 2, 3]);
    expect(removableSet(spec)).toEqual([1]);
  });

  test("composeContinuityStatement: all modes + edge cases", () => {
    const three = deriveDiscontinuitySet(spec);
    expect(composeContinuityStatement(three, "discontinuous_at")).toBe(
      "f is discontinuous at x = 1, x = 2 and x = 3"
    );
    expect(composeContinuityStatement(three, "continuous_except")).toBe(
      "f is continuous except at x = 1, x = 2 and x = 3"
    );
    expect(composeContinuityStatement(three, "with_reasons")).toBe(
      "f is discontinuous at x = 1 (removable), x = 2 (jump) and x = 3 (infinite)"
    );
    expect(composeContinuityStatement([1], "discontinuous_at")).toBe(
      "f is discontinuous at x = 1"
    );
    expect(composeContinuityStatement([], "discontinuous_at")).toBe(
      "f is continuous everywhere"
    );
    expect(composeContinuityStatement([1, 3], "discontinuous_at", { fn: "g" })).toBe(
      "g is discontinuous at x = 1 and x = 3"
    );
    expect(composeLimitDNEStatement([2, 3])).toBe(
      "the two-sided limit of f does not exist at x = 2 and x = 3"
    );
  });

  test("point ask: isContinuous", () => {
    const ask = (quantity, at) =>
      applyLimitSpec({ type: "Free Response", limitSpec: spec, asks: [{ quantity, at }] }).answer;

    expect(ask("isContinuous", 0.5)).toBe("continuous"); // the continuous join
    expect(ask("isContinuous", 1)).toBe("discontinuous"); // the removable hole
    expect(ask("isContinuous", 2)).toBe("discontinuous"); // the jump
    expect(ask("isContinuous", 3)).toBe("discontinuous"); // the infinite VA
  });

  test("global FR ask: system composes the canonical answer", () => {
    const q = applyLimitSpec({
      type: "Free Response",
      limitSpec: spec,
      asks: [{ quantity: "discontinuitySet", mode: "discontinuous_at" }],
    });
    expect(q.answer).toBe("f is discontinuous at x = 1, x = 2 and x = 3");
    expect(q.explanation).toMatch(/removable/);
    expect(q.explanation).toMatch(/jump/);
    expect(q.explanation).toMatch(/infinite/);
  });

  test("global MC ask: system injects the correct statement among distractors", () => {
    const correct = "f is discontinuous at x = 1, x = 2 and x = 3";
    const q = applyLimitSpec({
      type: "Multiple Choice",
      limitSpec: spec,
      // distractors only (all WRONG) — the model never supplies the correct one
      choices: [
        "f is discontinuous at x = 2 only",
        "f is continuous everywhere",
        "f is discontinuous at x = 1 and x = 2",
      ],
      answer: "f is continuous everywhere", // model guess — ignored
      asks: [{ quantity: "discontinuitySet", mode: "discontinuous_at" }],
    });
    expect(q.answer).toBe(correct); // system-derived key
    expect(q.choices).toContain(correct); // injected (replaced the last distractor)
    expect(q.choices).toHaveLength(3);
    expect(q.choices[2]).toBe(correct);
    // the model's wrong guess did NOT become the answer
    expect(q.answer).not.toBe("f is continuous everywhere");
  });

  test("global MC ask: reuses a matching choice if the model already included it", () => {
    const correct = "f is discontinuous at x = 1, x = 2 and x = 3";
    const q = applyLimitSpec({
      type: "Multiple Choice",
      limitSpec: spec,
      choices: ["f is continuous everywhere", correct, "f is discontinuous at x = 2 only"],
      asks: [{ quantity: "discontinuitySet" }],
    });
    expect(q.answer).toBe(correct);
    expect(q.choices).toEqual([
      "f is continuous everywhere",
      correct,
      "f is discontinuous at x = 2 only",
    ]); // unchanged — no injection needed
  });

  test("global MC hard-fails with fewer than 2 distractor choices", () => {
    expect(() =>
      applyLimitSpec({
        type: "Multiple Choice",
        limitSpec: spec,
        choices: ["f is continuous everywhere"],
        asks: [{ quantity: "discontinuitySet" }],
      })
    ).toThrow(/at least 2 distractor/);
  });

  test("point MC hard-fails when the derived value is not among choices", () => {
    expect(() =>
      applyLimitSpec({
        type: "Multiple Choice",
        limitSpec: spec,
        choices: ["continuous", "yes", "no", "none"], // missing derived "discontinuous"
        answer: "continuous",
        asks: [{ quantity: "isContinuous", at: 1 }], // x=1 is a removable hole → discontinuous
      })
    ).toThrow(/not among the choices/);
  });

  test("a global ask must stand alone (not mixed with other asks)", () => {
    expect(() =>
      applyLimitSpec({
        type: "Free Response",
        limitSpec: spec,
        asks: [
          { quantity: "discontinuitySet" },
          { quantity: "limit", at: 2 },
        ],
      })
    ).toThrow(/must be the only ask/);
  });
});

describe("compileToFunctionPairConfig — §2.3 two specs → one functionPair config", () => {
  const jumpSpec = {
    segments: [
      { fn: "x+1", from: 0, to: 2, openRight: true },
      { fn: "x", from: 2, to: 4 },
    ],
    points: [{ x: 2, y: 2 }],
  };
  const vaSpec = {
    segments: [],
    verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
  };

  test("nests both compiled sub-configs under type functionPair", () => {
    const cfg = compileToFunctionPairConfig(jumpSpec, vaSpec);
    expect(cfg.type).toBe("functionPair");
    // each sub-config is byte-identical to a standalone compileToGraphConfig
    expect(cfg.f).toEqual(compileToGraphConfig(jumpSpec));
    expect(cfg.g).toEqual(compileToGraphConfig(vaSpec));
    expect(cfg.f.type).toBe("piecewise");
    expect(cfg.g.type).toBe("piecewise");
  });

  test("throws (fail closed) when EITHER spec fails validation", () => {
    // phantom VA: a finite segment declared as a vertical asymptote → rejected.
    const phantomVA = {
      segments: [{ fn: "x+2", from: 0, to: 4 }],
      verticalAsymptotes: [{ x: 2, leftSign: "+inf", rightSign: "+inf" }],
    };
    expect(() => compileToFunctionPairConfig(phantomVA, vaSpec)).toThrow();
    expect(() => compileToFunctionPairConfig(jumpSpec, phantomVA)).toThrow();
    // interior pole strictly inside a segment → rejected.
    const interiorPole = { segments: [{ fn: "1/(x-1)", from: 0, to: 2 }] };
    expect(() => compileToFunctionPairConfig(interiorPole, vaSpec)).toThrow();
  });
});
