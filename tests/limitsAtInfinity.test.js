// §2.6 limits at infinity — slice 1 (rational functions). Exact-output coverage of
// the pure deriveLimitAtInfinity core: degree comparison (m<n, m==n, m>n), sign /
// parity rules for the unbounded case, leading-zero stripping, horizontal-asymptote
// dedup, and fail-closed dispatch for unsupported / malformed specs.

import {
  deriveLimitAtInfinity,
  reduced,
  valuesEqual,
  gcd,
  PINF,
  NINF,
  UNSUPPORTED,
  PI_OVER_2,
  NEG_PI_OVER_2,
} from "../lib/limits/limitsAtInfinity.js";

// A finite value literal, always reduced so it equals what the engine emits.
const F = (num, den = 1) => reduced(num, den);
const ZERO = F(0, 1);

// Compact assertion on a whole result object.
const expectResult = (r, plus, minus, ha) => {
  expect(r.plus).toEqual(plus);
  expect(r.minus).toEqual(minus);
  expect(r.horizontalAsymptotes).toEqual(ha);
};

describe("helpers — gcd / reduced / valuesEqual", () => {
  test("gcd magnitudes and zero edge cases", () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(-12, 8)).toBe(4);
    expect(gcd(7, 0)).toBe(7);
    expect(gcd(0, 0)).toBe(0);
  });
  test("reduced normalizes sign, divides gcd, integer -> den 1", () => {
    expect(reduced(4, 2)).toEqual({ kind: "finite", num: 2, den: 1 });
    expect(reduced(-4, 2)).toEqual({ kind: "finite", num: -2, den: 1 });
    expect(reduced(3, -6)).toEqual({ kind: "finite", num: -1, den: 2 }); // sign onto num, den>0
    expect(reduced(0, 5)).toEqual({ kind: "finite", num: 0, den: 1 });
    expect(reduced(6, 4)).toEqual({ kind: "finite", num: 3, den: 2 });
  });
  test("reduced throws on zero denominator", () => {
    expect(() => reduced(1, 0)).toThrow(/non-zero/);
  });
  test("valuesEqual compares reduced finite pairs; non-finite never equal", () => {
    expect(valuesEqual(F(3, 2), reduced(6, 4))).toBe(true);
    expect(valuesEqual(F(3, 2), F(2, 3))).toBe(false);
    expect(valuesEqual(PINF, PINF)).toBe(false);
  });
});

describe("deriveLimitAtInfinity — rational, m < n (-> 0)", () => {
  test("case 1: (x+1)/(x^2+1) -> 0 both ends; HA [0]", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [1, 1], den: [1, 0, 1] });
    expectResult(r, ZERO, ZERO, [ZERO]);
  });
  test("case 8: const / quadratic -> 0 both ends; HA [0]", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [5], den: [1, 0, 1] });
    expectResult(r, ZERO, ZERO, [ZERO]);
  });
  test("case 9: leading-zero strip drops num to degree 1 < 2 -> 0; HA [0]", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [0, 3, 1], den: [1, 0, 1] });
    expectResult(r, ZERO, ZERO, [ZERO]);
  });
});

describe("deriveLimitAtInfinity — rational, m == n (-> a/b)", () => {
  test("case 2: (3x^2 - x + 1)/(2x^2 + 5) -> 3/2; HA [3/2]", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [3, -1, 1], den: [2, 0, 5] });
    expectResult(r, F(3, 2), F(3, 2), [F(3, 2)]);
  });
  test("case 3: cubic/cubic -> 2/1; HA [2]", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [2, 0, 0, 1], den: [1, 0, 0, -7] });
    expectResult(r, F(2, 1), F(2, 1), [F(2, 1)]);
  });
  test("case 4: (-4x)/(2x) -> -2/1; HA [-2]", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [-4, 0], den: [2, 0] });
    expectResult(r, F(-2, 1), F(-2, 1), [F(-2, 1)]);
  });
});

describe("deriveLimitAtInfinity — rational, m > n (unbounded, sign/parity)", () => {
  test("case 5: x^2/(x+...) odd degree gap, a/b>0 -> plus +inf, minus -inf; HA []", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [1, 0, 0], den: [1, 1] });
    expectResult(r, PINF, NINF, []);
  });
  test("case 6: -2x^2/x odd gap, a/b<0 -> plus -inf, minus +inf; HA []", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [-2, 0, 0], den: [1, 0] });
    expectResult(r, NINF, PINF, []);
  });
  test("case 7: x^3/x even degree gap, a/b>0 -> plus +inf, minus +inf; HA []", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [1, 0, 0, 0], den: [1, 0] });
    expectResult(r, PINF, PINF, []);
  });
});

describe("deriveLimitAtInfinity — fail closed (unsupported / malformed)", () => {
  test("case 10: algebraic_root kind -> all unsupported (later slice)", () => {
    const r = deriveLimitAtInfinity({ kind: "algebraic_root", foo: 1 });
    expectResult(r, UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 11: rational with empty numerator -> all unsupported", () => {
    const r = deriveLimitAtInfinity({ kind: "rational", num: [], den: [1] });
    expectResult(r, UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 12: unknown kind -> all unsupported", () => {
    const r = deriveLimitAtInfinity({ kind: "bogus" });
    expectResult(r, UNSUPPORTED, UNSUPPORTED, []);
  });
  test("all-zero coefficients and non-object specs also fail closed", () => {
    expectResult(deriveLimitAtInfinity({ kind: "rational", num: [0, 0], den: [1] }),
      UNSUPPORTED, UNSUPPORTED, []);
    expectResult(deriveLimitAtInfinity(null), UNSUPPORTED, UNSUPPORTED, []);
    expectResult(deriveLimitAtInfinity({ kind: "special" }), UNSUPPORTED, UNSUPPORTED, []);
  });
});

// ── slice 1b: algebraic_root family ──────────────────────────────────────────
const RML = (fields) =>
  deriveLimitAtInfinity({ kind: "algebraic_root", form: "root_minus_linear", ...fields });
const ROL = (fields) =>
  deriveLimitAtInfinity({ kind: "algebraic_root", form: "root_over_linear", ...fields });

describe("deriveLimitAtInfinity — algebraic_root: root_minus_linear", () => {
  test("case 1: p = r -> finite plus, +inf minus; HA [1/2]", () => {
    expectResult(RML({ a: 1, b: 1, c: 0, p: 1, q: 0 }), F(1, 2), PINF, [F(1, 2)]);
  });
  test("case 2: p = -r -> +inf plus, finite minus; HA [-1/2]", () => {
    expectResult(RML({ a: 1, b: 1, c: 0, p: -1, q: 0 }), PINF, F(-1, 2), [F(-1, 2)]);
  });
  test("case 3: p = r with q -> 2; HA [2]", () => {
    expectResult(RML({ a: 4, b: 12, c: 1, p: 2, q: 1 }), F(2, 1), PINF, [F(2, 1)]);
  });
  test("case 4: cancellation to 0; HA [0]", () => {
    expectResult(RML({ a: 1, b: 2, c: 0, p: 1, q: 1 }), ZERO, PINF, [ZERO]);
  });
  test("case 5: p > r both ends infinite (mixed signs) -> HA []", () => {
    expectResult(RML({ a: 1, b: 0, c: 1, p: 2, q: 0 }), NINF, PINF, []);
  });
  test("case 6: a not a perfect square -> all unsupported", () => {
    expectResult(RML({ a: 2, b: 1, c: 0, p: 1, q: 0 }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 7: missing q -> all unsupported", () => {
    expectResult(RML({ a: 1, b: 1, c: 0, p: 1 }), UNSUPPORTED, UNSUPPORTED, []);
  });
});

describe("deriveLimitAtInfinity — algebraic_root: root_over_linear", () => {
  test("case 8: r/d and -r/d -> HA [-1, 1]", () => {
    expectResult(ROL({ a: 1, b: 0, c: 1, d: 1, e: 1 }), F(1, 1), F(-1, 1), [F(-1, 1), F(1, 1)]);
  });
  test("case 9: negative d flips signs -> HA [-3, 3]", () => {
    expectResult(ROL({ a: 9, b: 0, c: 1, d: -1, e: 2 }), F(-3, 1), F(3, 1), [F(-3, 1), F(3, 1)]);
  });
  test("case 10: reduces to ±1 -> HA [-1, 1]", () => {
    expectResult(ROL({ a: 4, b: 3, c: 0, d: 2, e: -5 }), F(1, 1), F(-1, 1), [F(-1, 1), F(1, 1)]);
  });
  test("case 11: d === 0 -> all unsupported", () => {
    expectResult(ROL({ a: 1, b: 0, c: 1, d: 0, e: 5 }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 12: a not a perfect square -> all unsupported", () => {
    expectResult(ROL({ a: 3, b: 0, c: 0, d: 1, e: 0 }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("unknown form on algebraic_root -> all unsupported", () => {
    expectResult(
      deriveLimitAtInfinity({ kind: "algebraic_root", form: "mystery", a: 1 }),
      UNSUPPORTED, UNSUPPORTED, []
    );
  });
});

// ── slice 2: special family ──────────────────────────────────────────────────
const SP = (fields) => deriveLimitAtInfinity({ kind: "special", ...fields });

describe("valuesEqual — finiteSym extension", () => {
  test("same token equal; different token / cross-kind not", () => {
    expect(valuesEqual(PI_OVER_2, PI_OVER_2)).toBe(true);
    expect(valuesEqual(PI_OVER_2, NEG_PI_OVER_2)).toBe(false);
    expect(valuesEqual(PI_OVER_2, F(1))).toBe(false);
  });
});

describe("deriveLimitAtInfinity — special family", () => {
  test("case 1: exp -> +inf / 0; HA [0]", () => {
    expectResult(SP({ base: "exp" }), PINF, ZERO, [ZERO]);
  });
  test("case 2: exp_neg -> 0 / +inf; HA [0]", () => {
    expectResult(SP({ base: "exp_neg" }), ZERO, PINF, [ZERO]);
  });
  test("case 3: arctan -> pi/2 / -pi/2; HA [-pi/2, pi/2]", () => {
    expectResult(SP({ base: "arctan" }), PI_OVER_2, NEG_PI_OVER_2, [NEG_PI_OVER_2, PI_OVER_2]);
  });
  test("case 4: logistic -> 1 / 0; HA [0, 1]", () => {
    expectResult(SP({ base: "logistic" }), F(1), ZERO, [ZERO, F(1)]);
  });
  test("case 5: recip_power n=1 -> 0 / 0; HA [0]", () => {
    expectResult(SP({ base: "recip_power", n: 1 }), ZERO, ZERO, [ZERO]);
  });
  test("case 6: recip_power n=3 -> 0 / 0; HA [0]", () => {
    expectResult(SP({ base: "recip_power", n: 3 }), ZERO, ZERO, [ZERO]);
  });
  test("case 7: recip_power n=0 -> all unsupported", () => {
    expectResult(SP({ base: "recip_power", n: 0 }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 8: recip_power without n -> all unsupported", () => {
    expectResult(SP({ base: "recip_power" }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 9: recip_power n=2.5 (non-integer) -> all unsupported", () => {
    expectResult(SP({ base: "recip_power", n: 2.5 }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 10: unknown base -> all unsupported", () => {
    expectResult(SP({ base: "mystery" }), UNSUPPORTED, UNSUPPORTED, []);
  });
  test("case 11: special without base -> all unsupported", () => {
    expectResult(SP({}), UNSUPPORTED, UNSUPPORTED, []);
  });
});
