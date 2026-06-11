import { composeReasonedChoices } from "../lib/limits/composeReasonedChoices.js";
import { applyLimitSpec } from "../lib/limits/applyLimitSpec.js";
import { toLatex } from "../lib/math/toLatex.js";

const valueOf = (choice) => choice.split(", because")[0].trim();
const BANNED = /\b(error|mistake|incorrect|wrong)\b/i; // meta-commentary that gives a choice away

const assertWellFormed = (r) => {
  expect(r.choices).toHaveLength(4);
  expect(new Set(r.choices).size).toBe(4);                          // 4 distinct
  expect(r.choices.filter((c) => c === r.answer)).toHaveLength(1);  // exactly one correct
  expect(r.choices).toContain(r.answer);
  r.choices.forEach((c) => expect(c).toMatch(/,\s*because\s/));     // value, because reason
  r.choices.forEach((c) => expect(c).not.toMatch(BANNED));          // FIX 2: no meta-commentary
};

describe("composeReasonedChoices — math-notation reasons, same-structure distractors", () => {
  // Q2 jump at 0: L = 1, R = 2 (two-sided limit DNE).
  const jump = {
    segments: [
      { fn: "x+1", from: -2, to: 0, openRight: true }, // left → 1
      { fn: "x+2", from: 0, to: 2, openLeft: true },   // right → 2
    ],
    points: [{ x: 0, y: 2 }],
  };

  test("Q2 limit (jump): correct states BOTH one-sided values in lim notation", () => {
    const r = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    assertWellFormed(r);
    expect(r.answer).toBe(
      "does not exist (DNE), because lim x→0^- f(x) = 1 but lim x→0^+ f(x) = 2"
    );
    // distractors are SAME-STRUCTURE perturbed values
    r.choices.filter((c) => c !== r.answer).forEach((c) =>
      expect(c).toMatch(/, because lim x→0\^- f\(x\) = .+ and lim x→0\^\+ f\(x\) = /)
    );
  });

  // Q3 COLLISION: 3x-1 and x^2+1 both → 5 at x = 2.
  const collide = {
    segments: [
      { fn: "3x-1", from: 0, to: 2, openRight: true },
      { fn: "x^2+1", from: 2, to: 4 },
    ],
    points: [{ x: 2, y: 5 }],
  };

  test("Q3 collision fValue: 4 distinct SAME-STRUCTURE choices, no special-casing", () => {
    const r = composeReasonedChoices(collide, { quantity: "fValue", at: 2 });
    assertWellFormed(r);
    expect(r.answer).toBe("5, because x = 2 is in the branch f(x) = x^2+1, so f(2) = 5");
    // every choice uses the identical template, differing only in the value
    r.choices.forEach((c) =>
      expect(c).toMatch(/^.+, because x = 2 is in the branch f\(x\) = x\^2\+1, so f\(2\) = .+$/)
    );
    const values = r.choices.map(valueOf);
    expect(new Set(values).size).toBe(4); // all 4 values distinct (collision handled)
  });

  test("Q3 collision limit: 4 distinct same-structure choices", () => {
    const r = composeReasonedChoices(collide, { quantity: "limit", at: 2 });
    assertWellFormed(r);
    expect(r.answer).toBe("5, because lim x→2^- f(x) = 5 and lim x→2^+ f(x) = 5");
    expect(new Set(r.choices.map(valueOf)).size).toBe(4);
  });

  test("leftLimit / rightLimit name the branch expression with lim notation", () => {
    const l = composeReasonedChoices(jump, { quantity: "leftLimit", at: 0 });
    assertWellFormed(l);
    expect(l.answer).toBe("1, because for x < 0, f(x) = x+1, so lim x→0^- f(x) = 1");
    const rr = composeReasonedChoices(jump, { quantity: "rightLimit", at: 0 });
    assertWellFormed(rr);
    expect(rr.answer).toBe("2, because for x > 0, f(x) = x+2, so lim x→0^+ f(x) = 2");
  });

  // Removable hole: limit 2 exists, f(1) = 4.
  const removable = {
    segments: [
      { fn: "x+1", from: -2, to: 1, openRight: true },
      { fn: "x+1", from: 1, to: 4, openLeft: true },
    ],
    holes: [{ x: 1, y: 2 }],
    points: [{ x: 1, y: 4 }],
  };

  test("removable limit (exists): correct names equal one-sided values; f(a)=4 appears as a distractor value", () => {
    const r = composeReasonedChoices(removable, { quantity: "limit", at: 1 });
    assertWellFormed(r);
    expect(r.answer).toBe("2, because lim x→1^- f(x) = 2 and lim x→1^+ f(x) = 2");
    expect(r.choices.map(valueOf)).toContain("4"); // the f(1)=4 trap value
  });

  test("isContinuous (discontinuous): reason names the failing condition WITH values", () => {
    const r = composeReasonedChoices(jump, { quantity: "isContinuous", at: 0 });
    assertWellFormed(r);
    expect(r.answer).toBe(
      "discontinuous, because lim x→0 f(x) does not exist (lim x→0^- f(x) = 1 ≠ lim x→0^+ f(x) = 2)"
    );
  });

  test("isContinuous (continuous): reason chains the equal one-sided limits and f(a)", () => {
    const cont = { segments: [{ fn: "x+1", from: -2, to: 1 }, { fn: "x+1", from: 1, to: 4 }] };
    const r = composeReasonedChoices(cont, { quantity: "isContinuous", at: 1 });
    assertWellFormed(r);
    expect(r.answer).toBe("continuous, because lim x→1^- f(x) = lim x→1^+ f(x) = f(1) = 2");
  });

  test("removable-hole discontinuity: reason is 'limit = L ≠ f(a) = V'", () => {
    const r = composeReasonedChoices(removable, { quantity: "isContinuous", at: 1 });
    assertWellFormed(r);
    expect(r.answer).toBe("discontinuous, because lim x→1 f(x) = 2 ≠ f(1) = 4");
  });

  test("FIX 2: NO choice ever contains banned meta-commentary", () => {
    for (const ask of ["limit", "leftLimit", "rightLimit", "fValue", "isContinuous"]) {
      for (const spec of [jump, collide, removable]) {
        const r = composeReasonedChoices(spec, { quantity: ask, at: ask === "limit" || ask === "isContinuous" ? (spec === collide ? 2 : spec === removable ? 1 : 0) : (spec === collide ? 2 : spec === removable ? 1 : 0) });
        r.choices.forEach((c) => expect(c).not.toMatch(BANNED));
      }
    }
  });

  test("deterministic: identical output across calls", () => {
    const a = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    const b = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    expect(a).toEqual(b);
  });

  test("RENDER: a composed one-sided-lim reason converts to upright inline \\lim", () => {
    const r = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    const tex = toLatex(r.answer);
    expect(tex).toContain("\\lim_{x\\to0^-}");
    expect(tex).toContain("\\lim_{x\\to0^+}");
    expect(tex).not.toMatch(/\\\\lim/); // no line-break + italic lim
  });
});

describe("applyLimitSpec — wiring (noGraph replaces choices; graph styles unchanged)", () => {
  const jump = {
    segments: [
      { fn: "x+1", from: -2, to: 0, openRight: true },
      { fn: "x+2", from: 0, to: 2, openLeft: true },
    ],
    points: [{ x: 0, y: 2 }],
  };

  test("noGraph MC: model choices replaced with composed value+reason; no graph", () => {
    const q = applyLimitSpec({
      type: "Multiple Choice",
      noGraph: true,
      question: "f(x) = { x+1 if x < 0 ; x+2 if x >= 0 }. Evaluate lim x->0 f(x).",
      limitSpec: jump,
      asks: [{ quantity: "limit", at: 0 }],
      choices: ["pA", "pB", "pC", "pD"],
      answer: "pA",
    });
    expect(q.choices).toHaveLength(4);
    expect(q.choices).not.toContain("pA");
    expect(q.answer).toBe(
      "does not exist (DNE), because lim x→0^- f(x) = 1 but lim x→0^+ f(x) = 2"
    );
    expect(q.choices).toContain(q.answer);
    expect(q.hasGraph).toBeFalsy();
    expect(q.graphConfig).toBeUndefined();
  });

  test("GRAPH style unchanged: bare-value matching, no reasons", () => {
    const q = applyLimitSpec({
      type: "Multiple Choice",
      question: "From the graph of f, evaluate lim x->0 f(x).",
      limitSpec: jump,
      asks: [{ quantity: "limit", at: 0 }],
      choices: ["1", "2", "does not exist (DNE)", "0"],
    });
    expect(q.answer).toBe("does not exist (DNE)");
    expect(q.answer).not.toMatch(/because/);
    expect(q.hasGraph).toBe(true);
  });
});
