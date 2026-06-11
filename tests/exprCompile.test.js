// Unary-minus-before-exponentiation: -2^x must mean -(2^x) (unary minus binds
// LOOSER than ^), and must compile in BOTH evaluators identically — the rendered
// curve (evalFn) and the derived answer key (compileExpression) must never
// diverge. Live failure: "-2^(x)" was "not a compilable expression".

import { compileExpression, wrapExponentBases } from "../lib/utils/exprCompile.js";
import { evalFn } from "../lib/exports/graphRendering.js";
import { validateLimitSpec } from "../lib/limits/limitGraphSpec.js";
import { deriveLimits } from "../lib/limits/deriveLimits.js";

const ce = (e, x) => {
  const f = compileExpression(e, ["x"]);
  expect(f).not.toBeNull(); // must compile
  return f(x);
};

// [expr, x, expected]
const MATRIX = [
  ["-2^(x)", 2, -4],      // the live failure: -(2^2)
  ["-2^(x+1)", 0, -2],    // -(2^1)
  ["-sqrt(x+62)", 2, -8], // unary minus before a call (no power) — already worked
  ["3-2^x", 2, -1],       // BINARY minus preserved: 3 - 2^2
  ["(-2)^2", 2, 4],       // parenthesized base keeps the minus INSIDE
  ["x^2-3", 2, 1],
  ["-x^2", 3, -9],        // -(x^2)
  ["-x", 3, -3],
  ["2^(x-1)+1", 2, 3],
  ["2^x", 3, 8],
];

describe("compileExpression — unary minus before exponentiation", () => {
  for (const [e, x, want] of MATRIX) {
    test(`${e} @x=${x} → ${want}`, () => {
      expect(ce(e, x)).toBe(want);
    });
  }
});

describe("cross-evaluator agreement (compileExpression ⟷ evalFn)", () => {
  for (const [e, x, want] of MATRIX) {
    test(`${e} @x=${x}: both → ${want}`, () => {
      expect(ce(e, x)).toBe(want);
      expect(evalFn(e, x)).toBe(want);
    });
  }
});

describe("wrapExponentBases — value-neutral grouping", () => {
  test("wraps power bases so a leading unary minus stays outside", () => {
    expect(wrapExponentBases("-2**x")).toBe("-(2**x)");
    expect(wrapExponentBases("-x**2")).toBe("-(x**2)");
    expect(wrapExponentBases("-2**(x)")).toBe("-(2**(x))");
  });
  test("leaves a parenthesized (sign-inside) base's minus inside", () => {
    expect(wrapExponentBases("(-2)**2")).toBe("((-2)**2)");
  });
  test("no power → unchanged", () => {
    expect(wrapExponentBases("-Math.sqrt(x+62)")).toBe("-Math.sqrt(x+62)");
    expect(wrapExponentBases("3-2*x")).toBe("3-2*x");
  });
});

describe("end-to-end: a limitSpec using -2^(x) validates and derives correctly", () => {
  const spec = { segments: [{ fn: "-2^(x)", from: 0, to: 3 }] };

  test("validateLimitSpec accepts it (compile + guards pass)", () => {
    expect(() => validateLimitSpec(spec)).not.toThrow();
  });

  test("deriveLimits at an interior point matches the hand value", () => {
    // -2^x is continuous; at x=2 the two-sided limit is -(2^2) = -4.
    expect(deriveLimits(spec, 2).twoSided).toBe(-4);
  });
});
