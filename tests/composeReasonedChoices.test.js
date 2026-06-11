import { composeReasonedChoices } from "../lib/limits/composeReasonedChoices.js";
import { applyLimitSpec } from "../lib/limits/applyLimitSpec.js";

// Helpers
const valueOf = (choice) => choice.split(", because")[0].split(", from")[0].split(", by")[0].trim();
const assertWellFormed = (r) => {
  expect(r.choices).toHaveLength(4);
  expect(new Set(r.choices).size).toBe(4);                 // 4 distinct
  expect(r.choices.filter((c) => c === r.answer)).toHaveLength(1); // exactly one correct
  expect(r.choices).toContain(r.answer);
  r.choices.forEach((c) => expect(c).toMatch(/,\s*(because|from|by)\s/)); // value + reason form
};

describe("composeReasonedChoices — derived value+reason MC", () => {
  // Q2 live case: jump at 0, L = 1, R = 2 (two-sided limit DNE).
  const jump = {
    segments: [
      { fn: "x+1", from: -2, to: 0, openRight: true }, // left → 1
      { fn: "x+2", from: 0, to: 2, openLeft: true },   // right → 2
    ],
    points: [{ x: 0, y: 2 }],
  };

  test("Q2 limit (jump): correct = DNE with one-sided limits stated", () => {
    const r = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    assertWellFormed(r);
    expect(r.answer).toContain("does not exist (DNE), because the one-sided limits differ");
    expect(r.answer).toContain("lim x→0^- = 1");
    expect(r.answer).toContain("lim x→0^+ = 2");
    // every distractor's VALUE is not the correct value (DNE)
    const distractors = r.choices.filter((c) => c !== r.answer);
    expect(distractors).toHaveLength(3);
    distractors.forEach((d) => expect(valueOf(d)).not.toBe("does not exist (DNE)"));
    // the one-sided value distractors are present and wrong
    expect(r.choices.some((c) => valueOf(c) === "1")).toBe(true);
    expect(r.choices.some((c) => valueOf(c) === "2")).toBe(true);
  });

  // Q3 case: f(2) = 3, the OTHER branch evaluates to 1 at x=2.
  const fv = {
    segments: [
      { fn: "x-1", from: 0, to: 2, openRight: true }, // x-1 at 2 = 1 (wrong branch)
      { fn: "3", from: 2, to: 4 },                     // f(2) = 3
    ],
    points: [{ x: 2, y: 3 }],
  };

  test("Q3 fValue: correct = 3 from the including branch; distractor uses other branch (1)", () => {
    const r = composeReasonedChoices(fv, { quantity: "fValue", at: 2 });
    assertWellFormed(r);
    expect(r.answer).toBe("3, from the branch whose condition includes x = 2");
    expect(r.choices.some((c) => c.startsWith("1,") && /other branch/.test(c))).toBe(true);
  });

  // Removable-hole: limit 2 exists, f(1) = 4 → the f(a) trap distractor must appear.
  const removable = {
    segments: [
      { fn: "x+1", from: -2, to: 1, openRight: true },
      { fn: "x+1", from: 1, to: 4, openLeft: true },
    ],
    holes: [{ x: 1, y: 2 }],
    points: [{ x: 1, y: 4 }],
  };

  test("removable limit (exists ≠ f(a)): correct = 2, and the f(a)=4 trap is present", () => {
    const r = composeReasonedChoices(removable, { quantity: "limit", at: 1 });
    assertWellFormed(r);
    expect(r.answer).toBe("2, because both one-sided limits equal 2");
    expect(r.choices.some((c) => c.startsWith("4,") && /function value f\(1\)/.test(c))).toBe(true);
  });

  // Degeneracy: limit = L = f(a) (continuous) → no two choices share a value.
  const continuous = {
    segments: [{ fn: "x+1", from: -2, to: 1 }, { fn: "x+1", from: 1, to: 4 }],
  };

  test("degeneracy (f(a) = limit): no duplicate-value choices", () => {
    const r = composeReasonedChoices(continuous, { quantity: "limit", at: 1 });
    assertWellFormed(r);
    const values = r.choices.map(valueOf);
    expect(new Set(values).size).toBe(4); // all 4 values distinct
  });

  test("isContinuous — discontinuous verdict with apt reason", () => {
    const r = composeReasonedChoices(jump, { quantity: "isContinuous", at: 0 });
    assertWellFormed(r);
    expect(r.answer).toBe("discontinuous, because the two-sided limit does not exist");
    expect(r.choices.filter((c) => c === r.answer)).toHaveLength(1);
  });

  test("isContinuous — continuous verdict", () => {
    const r = composeReasonedChoices(continuous, { quantity: "isContinuous", at: 1 });
    assertWellFormed(r);
    expect(r.answer).toBe("continuous, because the two-sided limit exists and equals f(1)");
  });

  test("leftLimit / rightLimit name the covering branch", () => {
    const l = composeReasonedChoices(jump, { quantity: "leftLimit", at: 0 });
    assertWellFormed(l);
    expect(l.answer).toBe("1, from the branch covering x < 0");
    const rr = composeReasonedChoices(jump, { quantity: "rightLimit", at: 0 });
    assertWellFormed(rr);
    expect(rr.answer).toBe("2, from the branch covering x > 0");
  });

  test("deterministic: same spec/ask → identical choices and order", () => {
    const a = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    const b = composeReasonedChoices(jump, { quantity: "limit", at: 0 });
    expect(a).toEqual(b);
  });
});

describe("applyLimitSpec — wiring: noGraph reasoned MC vs graph styles", () => {
  const jump = {
    segments: [
      { fn: "x+1", from: -2, to: 0, openRight: true },
      { fn: "x+2", from: 0, to: 2, openLeft: true },
    ],
    points: [{ x: 0, y: 2 }],
  };

  test("noGraph MC: model's choices are REPLACED with composed value+reason; no graph", () => {
    const q = applyLimitSpec({
      type: "Multiple Choice",
      noGraph: true,
      question: "f(x) = { x+1 if x < 0 ; x+2 if x >= 0 }. Evaluate lim x->0 f(x).",
      limitSpec: jump,
      asks: [{ quantity: "limit", at: 0 }],
      choices: ["placeholder A", "placeholder B", "placeholder C", "placeholder D"],
      answer: "placeholder A",
    });
    expect(q.choices).toHaveLength(4);
    q.choices.forEach((c) => expect(c).toMatch(/,\s*(because|from|by)\s/));
    expect(q.choices).not.toContain("placeholder A");                 // model choices gone
    expect(q.answer).toContain("does not exist (DNE), because the one-sided limits differ");
    expect(q.choices).toContain(q.answer);
    expect(q.hasGraph).toBeFalsy();
    expect(q.graphConfig).toBeUndefined();
  });

  test("GRAPH style UNCHANGED: bare-value choices still matched (no reasons injected)", () => {
    const q = applyLimitSpec({
      type: "Multiple Choice",
      // no noGraph flag → graph style
      question: "From the graph of f, evaluate lim x->0 f(x).",
      limitSpec: jump,
      asks: [{ quantity: "limit", at: 0 }],
      choices: ["1", "2", "does not exist (DNE)", "0"],
    });
    expect(q.answer).toBe("does not exist (DNE)");          // bare value, no reason
    expect(q.answer).not.toMatch(/because/);
    expect(q.hasGraph).toBe(true);
  });
});
