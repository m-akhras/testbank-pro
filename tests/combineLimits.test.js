// §2.3 Limit Laws — exhaustive coverage of the pure combineLimits core, including
// every indeterminate-form branch (∞−∞, 0·∞, ∞/∞, finite/0, DNE propagation).

import {
  FINITE,
  PINF,
  NINF,
  DNE,
  toLimitValue,
  combineLimits,
  formatCombined,
} from "../lib/limits/combineLimits.js";
import { deriveLimits } from "../lib/limits/deriveLimits.js";

// Compact assertion helpers on the canonical representation.
const expectFinite = (V, n) => {
  expect(V.tag).toBe("finite");
  expect(V.value).toBe(n);
};
const expectPinf = (V) => expect(V).toBe(PINF);
const expectNinf = (V) => expect(V).toBe(NINF);
const expectDne = (V) => expect(V).toBe(DNE);

describe("combineLimits — sum / difference", () => {
  test("finite ± finite", () => {
    expectFinite(combineLimits("sum", FINITE(2), FINITE(3)), 5);
    expectFinite(combineLimits("difference", FINITE(2), FINITE(3)), -1);
  });
  test("finite with infinity", () => {
    expectPinf(combineLimits("sum", FINITE(4), PINF));
    expectNinf(combineLimits("sum", FINITE(4), NINF));
    expectNinf(combineLimits("difference", FINITE(4), PINF)); // 4 − ∞ = −∞
    expectPinf(combineLimits("difference", FINITE(4), NINF)); // 4 − (−∞) = +∞
  });
  test("same-sign infinities collapse", () => {
    expectPinf(combineLimits("sum", PINF, PINF));
    expectNinf(combineLimits("sum", NINF, NINF));
  });
  test("∞ − ∞ indeterminate forms → DNE (all sign variants)", () => {
    expectDne(combineLimits("sum", PINF, NINF)); // +∞ + (−∞)
    expectDne(combineLimits("sum", NINF, PINF)); // −∞ + (+∞)
    expectDne(combineLimits("difference", PINF, PINF)); // +∞ − (+∞)
    expectDne(combineLimits("difference", NINF, NINF)); // −∞ − (−∞)
  });
  test("DNE propagates in either operand position", () => {
    expectDne(combineLimits("sum", DNE, FINITE(3)));
    expectDne(combineLimits("sum", FINITE(3), DNE));
    expectDne(combineLimits("difference", DNE, PINF));
    expectDne(combineLimits("difference", PINF, DNE));
  });
});

describe("combineLimits — product", () => {
  test("finite·finite", () => {
    expectFinite(combineLimits("product", FINITE(3), FINITE(4)), 12);
    expectFinite(combineLimits("product", FINITE(-3), FINITE(4)), -12);
  });
  test("infinity sign rules", () => {
    expectNinf(combineLimits("product", PINF, NINF));
    expectPinf(combineLimits("product", NINF, NINF));
    expectNinf(combineLimits("product", FINITE(-2), PINF)); // negative · +∞ = −∞
    expectPinf(combineLimits("product", FINITE(5), PINF));
  });
  test("0·∞ indeterminate (both orders) → DNE", () => {
    expectDne(combineLimits("product", PINF, FINITE(0)));
    expectDne(combineLimits("product", FINITE(0), NINF));
  });
  test("DNE propagates in either operand position", () => {
    expectDne(combineLimits("product", DNE, FINITE(2)));
    expectDne(combineLimits("product", PINF, DNE));
  });
});

describe("combineLimits — quotient (critical edge cases)", () => {
  test("finite / finite", () => {
    expectFinite(combineLimits("quotient", FINITE(6), FINITE(2)), 3);
  });
  test("finite-nonzero / 0 → DNE", () => {
    expectDne(combineLimits("quotient", FINITE(5), FINITE(0)));
  });
  test("0 / 0 → DNE", () => {
    expectDne(combineLimits("quotient", FINITE(0), FINITE(0)));
  });
  test("0 / finite → 0", () => {
    const r = combineLimits("quotient", FINITE(0), FINITE(5));
    expectFinite(r, 0);
    expect(Object.is(r.value, 0)).toBe(true); // positive zero, not -0
  });
  test("finite / ±inf → positive 0", () => {
    const r1 = combineLimits("quotient", FINITE(7), PINF);
    expectFinite(r1, 0);
    expect(Object.is(r1.value, 0)).toBe(true);
    const r2 = combineLimits("quotient", FINITE(7), NINF);
    expectFinite(r2, 0);
    expect(Object.is(r2.value, 0)).toBe(true); // NOT -0
  });
  test("±inf / finite≠0 with sign", () => {
    expectPinf(combineLimits("quotient", PINF, FINITE(3)));
    expectNinf(combineLimits("quotient", PINF, FINITE(-3))); // sign flip
    expectPinf(combineLimits("quotient", NINF, FINITE(-3)));
  });
  test("∞ / ∞ → DNE", () => {
    expectDne(combineLimits("quotient", NINF, PINF));
    expectDne(combineLimits("quotient", PINF, PINF));
  });
  test("±inf / 0 → DNE", () => {
    expectDne(combineLimits("quotient", PINF, FINITE(0)));
    expectDne(combineLimits("quotient", NINF, FINITE(0)));
  });
  test("DNE propagates in either operand position", () => {
    expectDne(combineLimits("quotient", DNE, FINITE(2)));
    expectDne(combineLimits("quotient", FINITE(2), DNE));
  });
});

describe("combineLimits — constMultiple", () => {
  test("k≠0 scales finite and infinity (sign)", () => {
    expectFinite(combineLimits("constMultiple", FINITE(3), null, { k: 2 }), 6);
    expectPinf(combineLimits("constMultiple", PINF, null, { k: 2 }));
    expectNinf(combineLimits("constMultiple", PINF, null, { k: -2 })); // sign flip
  });
  test("k=0: 0·finite = 0, 0·∞ = DNE, 0·DNE = DNE", () => {
    expectFinite(combineLimits("constMultiple", FINITE(9), null, { k: 0 }), 0);
    expectDne(combineLimits("constMultiple", PINF, null, { k: 0 }));
    expectDne(combineLimits("constMultiple", DNE, null, { k: 0 }));
  });
  test("k≠0 · DNE = DNE", () => {
    expectDne(combineLimits("constMultiple", DNE, null, { k: -3 }));
  });
});

describe("combineLimits — xPolyTimesF (identical to constMultiple with k=p(a))", () => {
  test("matches constMultiple for k=4, k=-1, k=0", () => {
    expectFinite(combineLimits("xPolyTimesF", FINITE(2), null, { k: 4 }), 8);
    expectNinf(combineLimits("xPolyTimesF", PINF, null, { k: -1 }));
    expectFinite(combineLimits("xPolyTimesF", FINITE(7), null, { k: 0 }), 0);
    expectDne(combineLimits("xPolyTimesF", PINF, null, { k: 0 }));
  });
});

describe("combineLimits — power", () => {
  test("finite powers", () => {
    expectFinite(combineLimits("power", FINITE(-3), null, { n: 2 }), 9);
    expectFinite(combineLimits("power", FINITE(2), null, { n: 3 }), 8);
  });
  test("infinity by parity", () => {
    expectPinf(combineLimits("power", NINF, null, { n: 2 })); // even → +∞
    expectNinf(combineLimits("power", NINF, null, { n: 3 })); // odd → −∞
    expectPinf(combineLimits("power", PINF, null, { n: 5 }));
  });
  test("DNE → DNE", () => {
    expectDne(combineLimits("power", DNE, null, { n: 2 }));
  });
  test("n < 1 throws (n=0 intentionally rejected)", () => {
    expect(() => combineLimits("power", FINITE(2), null, { n: 0 })).toThrow(/integer n ≥ 1/);
    expect(() => combineLimits("power", FINITE(2), null, { n: -1 })).toThrow(/integer n ≥ 1/);
  });
});

describe("combineLimits — root", () => {
  test("even root", () => {
    expectDne(combineLimits("root", FINITE(-4), null, { n: 2 })); // not real
    expectFinite(combineLimits("root", FINITE(9), null, { n: 2 }), 3);
    expectDne(combineLimits("root", NINF, null, { n: 2 })); // even root of −∞ → DNE
    expectPinf(combineLimits("root", PINF, null, { n: 2 }));
  });
  test("odd root preserves sign (cbrt(-8) = -2, mathematically correct)", () => {
    // NOTE: the task brief's example said "n=3 of FINITE(-8) → -3", which is a
    // typo — the real cube root of -8 is -2. We assert the CORRECT value.
    expectFinite(combineLimits("root", FINITE(-8), null, { n: 3 }), -2);
    expectFinite(combineLimits("root", FINITE(27), null, { n: 3 }), 3);
    expectNinf(combineLimits("root", NINF, null, { n: 3 })); // odd root of −∞ → −∞
  });
  test("DNE → DNE; n < 2 throws", () => {
    expectDne(combineLimits("root", DNE, null, { n: 2 }));
    expect(() => combineLimits("root", FINITE(9), null, { n: 1 })).toThrow(/integer n ≥ 2/);
  });
});

describe("toLimitValue — resolver round-trips REAL deriveLimits output", () => {
  test("scalar encodings", () => {
    expectFinite(toLimitValue(3), 3);
    expectFinite(toLimitValue(-2.5), -2.5);
    expectPinf(toLimitValue("+inf"));
    expectNinf(toLimitValue("-inf"));
    expectDne(toLimitValue(null));
    expectDne(toLimitValue(undefined));
  });

  test("jump spec → two-sided DNE, one-sided finites", () => {
    const jumpSpec = {
      segments: [
        { fn: "x+1", from: 0, to: 2, openRight: true }, // left-limit 3 at x=2
        { fn: "x", from: 2, to: 4 }, // right-limit 2 at x=2
      ],
      points: [{ x: 2, y: 2 }],
    };
    const d = deriveLimits(jumpSpec, 2);
    expectDne(toLimitValue(d.twoSided)); // null → DNE
    expectFinite(toLimitValue(d.leftLimit), 3);
    expectFinite(toLimitValue(d.rightLimit), 2);
  });

  test("infinite spec (mixed signs) → one-sided ±inf, two-sided DNE", () => {
    const vaMixed = {
      segments: [],
      verticalAsymptotes: [{ x: 3, leftSign: "-inf", rightSign: "+inf" }],
    };
    const d = deriveLimits(vaMixed, 3);
    expectNinf(toLimitValue(d.leftLimit));
    expectPinf(toLimitValue(d.rightLimit));
    expectDne(toLimitValue(d.twoSided)); // mismatched infinities → null
  });

  test("infinite spec (matched signs) → two-sided PINF round-trips", () => {
    const vaMatched = {
      segments: [],
      verticalAsymptotes: [{ x: 1, leftSign: "+inf", rightSign: "+inf" }],
    };
    const d = deriveLimits(vaMatched, 1);
    expectPinf(toLimitValue(d.twoSided)); // "+inf" → PINF
  });

  test("continuous spec → finite two-sided round-trips", () => {
    const contSpec = { segments: [{ fn: "x+2", from: 0, to: 4 }] };
    const d = deriveLimits(contSpec, 2);
    expectFinite(toLimitValue(d.twoSided), 4);
  });

  test("end-to-end: derive f & g, combine via quotient with lim g = 0 → DNE", () => {
    // f finite (2), g two-sided limit 0 → f/g is the classic Stewart DNE case.
    const fSpec = { segments: [{ fn: "x", from: 0, to: 4 }] }; // f(2)→2
    const gSpec = { segments: [{ fn: "x-2", from: 0, to: 4 }] }; // g(2)→0
    const Vf = toLimitValue(deriveLimits(fSpec, 2).twoSided);
    const Vg = toLimitValue(deriveLimits(gSpec, 2).twoSided);
    expectFinite(Vf, 2);
    expectFinite(Vg, 0);
    expectDne(combineLimits("quotient", Vf, Vg));
  });
});

describe("formatCombined — matches applyLimitSpec scalar answer strings", () => {
  test("each canonical value", () => {
    expect(formatCombined(FINITE(3))).toBe("3");
    expect(formatCombined(FINITE(-2.5))).toBe("-2.5");
    expect(formatCombined(PINF)).toBe("infinity");
    expect(formatCombined(NINF)).toBe("-infinity");
    expect(formatCombined(DNE)).toBe("does not exist (DNE)");
  });
});

describe("combineLimits — fail-closed", () => {
  test("unknown law throws", () => {
    expect(() => combineLimits("frobnicate", FINITE(1), FINITE(2))).toThrow(/unknown law/);
  });
  test("malformed operand throws", () => {
    expect(() => combineLimits("sum", 3, FINITE(2))).toThrow(/not a canonical limit value/);
    expect(() => combineLimits("sum", FINITE(1), "+inf")).toThrow(/not a canonical limit value/);
  });
  test("toLimitValue rejects unrecognized encodings (fail closed)", () => {
    expect(() => toLimitValue("banana")).toThrow(/unrecognized/);
    expect(() => toLimitValue(Infinity)).toThrow(/unrecognized/); // deriveLimits never emits raw Infinity
    expect(() => toLimitValue(NaN)).toThrow(/unrecognized/);
  });
  test("FINITE rejects non-finite", () => {
    expect(() => FINITE(Infinity)).toThrow(/finite number/);
    expect(() => FINITE("3")).toThrow(/finite number/);
  });
});
