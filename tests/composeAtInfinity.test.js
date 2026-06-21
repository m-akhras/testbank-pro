// §2.6 limits at infinity — answer-text formatter. Exact-output coverage of
// formatLimitValue / composeHorizontalAsymptoteStatement / describeEndBehavior,
// the last fed REAL deriveLimitAtInfinity results so the formatter and engine stay
// in lockstep.

import {
  formatLimitValue,
  composeHorizontalAsymptoteStatement,
  describeEndBehavior,
} from "../lib/limits/composeAtInfinity.js";
import {
  deriveLimitAtInfinity,
  reduced,
  PI_OVER_2,
  NEG_PI_OVER_2,
  PINF,
  NINF,
  DNE,
  UNSUPPORTED,
} from "../lib/limits/limitsAtInfinity.js";

describe("formatLimitValue", () => {
  test("finite rationals (integer and proper fraction, reduced)", () => {
    expect(formatLimitValue(reduced(0, 1))).toBe("0");
    expect(formatLimitValue(reduced(3, 2))).toBe("3/2");
    expect(formatLimitValue(reduced(-2, 1))).toBe("-2");
    expect(formatLimitValue(reduced(4, 2))).toBe("2"); // reduces to den 1
  });
  test("symbolic constants", () => {
    expect(formatLimitValue(PI_OVER_2)).toBe("pi/2");
    expect(formatLimitValue(NEG_PI_OVER_2)).toBe("-pi/2");
  });
  test("infinities and DNE", () => {
    expect(formatLimitValue(PINF)).toBe("infinity");
    expect(formatLimitValue(NINF)).toBe("-infinity");
    expect(formatLimitValue(DNE)).toBe("does not exist (DNE)");
  });
  test("unsupported / unknown throws", () => {
    expect(() => formatLimitValue(UNSUPPORTED)).toThrow(/unsupported value/);
    expect(() => formatLimitValue({ kind: "finiteSym", token: "mystery" })).toThrow(/unsupported value/);
    expect(() => formatLimitValue(null)).toThrow(/unsupported value/);
  });
});

describe("composeHorizontalAsymptoteStatement", () => {
  test("empty -> none", () => {
    expect(composeHorizontalAsymptoteStatement([])).toBe("no horizontal asymptotes");
  });
  test("single value", () => {
    expect(composeHorizontalAsymptoteStatement([reduced(0, 1)])).toBe("y = 0");
  });
  test("two finite values, order preserved", () => {
    expect(composeHorizontalAsymptoteStatement([reduced(-1, 1), reduced(1, 1)]))
      .toBe("y = -1 and y = 1");
  });
  test("two symbolic values, order preserved", () => {
    expect(composeHorizontalAsymptoteStatement([NEG_PI_OVER_2, PI_OVER_2]))
      .toBe("y = -pi/2 and y = pi/2");
  });
});

describe("describeEndBehavior — real deriveLimitAtInfinity results", () => {
  test("rational m == n -> single finite HA", () => {
    expect(describeEndBehavior(deriveLimitAtInfinity({ kind: "rational", num: [3, -1, 1], den: [2, 0, 5] })))
      .toEqual({ plus: "3/2", minus: "3/2", horizontalAsymptotes: "y = 3/2" });
  });
  test("special arctan -> two symbolic HAs", () => {
    expect(describeEndBehavior(deriveLimitAtInfinity({ kind: "special", base: "arctan" })))
      .toEqual({ plus: "pi/2", minus: "-pi/2", horizontalAsymptotes: "y = -pi/2 and y = pi/2" });
  });
  test("special logistic -> 1 / 0 with two HAs", () => {
    expect(describeEndBehavior(deriveLimitAtInfinity({ kind: "special", base: "logistic" })))
      .toEqual({ plus: "1", minus: "0", horizontalAsymptotes: "y = 0 and y = 1" });
  });
  test("rational m > n -> infinities, no HA", () => {
    expect(describeEndBehavior(deriveLimitAtInfinity({ kind: "rational", num: [1, 0, 0], den: [1, 1] })))
      .toEqual({ plus: "infinity", minus: "-infinity", horizontalAsymptotes: "no horizontal asymptotes" });
  });
});
