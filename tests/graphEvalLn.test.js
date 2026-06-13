// ln natural-log alias in the graph function-string evaluators (regression for
// curve-less ln graphs). There are exactly two compiled evaluators that sample y
// from an fn string:
//   1. lib/exports/graphRendering.js  evalFn          — the STEM renderer, shared
//      by BOTH the in-app D3 graph (window.renderGraphToSVG) AND the export PNG
//      rasterizer (graphToBase64PNG → renderGraphToSVG). The PNG path is therefore
//      covered transitively here: there is no separate PNG evaluator to test.
//   2. lib/utils/exprCompile.js       compileExpression — the choice-graph / region
//      / parametric / surface / validator evaluator.
// (VectorFieldGraph.js has a third inline evaluator with the same ln alias; the
// shared-form assertions below mirror its behavior.)
//
// LOG CONVENTION (documented, asserted, NOT changed by this fix):
//   - ln  = natural log in EVERY evaluator.
//   - bare "log" = base-10 in the STEM renderer (graphRendering.evalFn).
//   - bare "log" = natural   in the choice/validator compiler (compileExpression).
//   The two render paths diverge on "log"; ln is consistent everywhere.

const { evalFn } = require("../lib/exports/graphRendering.js");
const { compileExpression } = require("../lib/utils/exprCompile.js");

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

describe("graphRendering.evalFn — ln alias (stem + export PNG path)", () => {
  test('"ln(x+1)" produces finite, increasing curve samples matching Math.log(x+1)', () => {
    const domain = [];
    for (let x = 0; x <= 5; x += 0.25) domain.push(x);
    const samples = domain.map((x) => evalFn("ln(x+1)", x));
    const finite = samples.filter((y) => Number.isFinite(y));
    // BEFORE the ln alias: "ln(" was unrecognized → evalFn threw → 0 finite samples.
    // AFTER: every sample is finite.
    expect(finite.length).toBe(samples.length);
    expect(finite.length).toBeGreaterThan(0);
    // strictly increasing
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    // matches Math.log(x+1) at several points
    for (const x of [0, 1, 3]) expect(close(evalFn("ln(x+1)", x), Math.log(x + 1))).toBe(true);
  });

  test('"ln(x)" → 0 at x=1, ~1 at x=e', () => {
    expect(evalFn("ln(x)", 1)).toBe(0);
    expect(close(evalFn("ln(x)", Math.E), 1)).toBe(true);
  });

  test('documented convention: bare "log" is BASE-10 in the stem renderer', () => {
    expect(close(evalFn("log(x)", 10), 1)).toBe(true);   // log10(10) = 1
    expect(close(evalFn("log(x)", 100), 2)).toBe(true);  // log10(100) = 2
  });

  test('explicit "log10" / "log2" resolve correctly', () => {
    expect(close(evalFn("log10(x)", 1000), 3)).toBe(true);
    expect(close(evalFn("log2(x)", 8), 3)).toBe(true);
  });
});

describe("exprCompile.compileExpression — ln alias (choice-graph / validator path)", () => {
  test('"ln(x+1)" compiles and matches Math.log(x+1)', () => {
    const f = compileExpression("ln(x+1)", ["x"]);
    expect(f).not.toBeNull();
    expect(close(f(1), Math.log(2))).toBe(true);
    expect(close(f(3), Math.log(4))).toBe(true);
  });

  test('"ln(x)" → 0 at x=1, ~1 at x=e', () => {
    const f = compileExpression("ln(x)", ["x"]);
    expect(f(1)).toBe(0);
    expect(close(f(Math.E), 1)).toBe(true);
  });

  test('UNIFIED convention: bare "log" is now BASE-10 in this compiler (was natural)', () => {
    const f = compileExpression("log(x)", ["x"]);
    expect(close(f(10), 1)).toBe(true);            // log10(10) = 1
    expect(close(f(100), 2)).toBe(true);           // log10(100) = 2
    expect(close(f(10), Math.log(10))).toBe(false); // explicitly NOT natural anymore
  });
});

// ── Three-way agreement: the whole point of the unification ──────────────────
// All three function-string evaluators must agree on log/ln so a curve renders
// identically whether it's a stem graph (graphRendering.evalFn), a choice graph
// (exprCompile.compileExpression), or a vector-field component
// (VectorFieldGraph._compileExpression). This guard prevents the base-10/natural
// divergence from silently returning.
describe("three-way evaluator agreement — log=base-10, ln=natural everywhere", () => {
  const { _compileExpression } = require("../components/display/VectorFieldGraph.js");

  // Adapt each evaluator to a common (expr, x) → number shape.
  const A = (expr, x) => evalFn(expr, x);                                   // graphRendering (stem + PNG)
  const B = (expr, x) => { const f = compileExpression(expr, ["x"]); return f ? f(x) : NaN; }; // exprCompile (choice/validator)
  const C = (expr, x) => { const f = _compileExpression(expr); return f ? f(x, 0) : NaN; };    // VectorFieldGraph (x,y)
  const evals = { graphRendering: A, exprCompile: B, vectorField: C };

  const agree = (expr, x, expected) => {
    for (const [name, fn] of Object.entries(evals)) {
      const got = fn(expr, x);
      expect(`${name}: ${got}`).toBe(`${name}: ${expected}`); // labeled so a failure names the offender
    }
  };

  test('log(x) @10 = 1 in all three', () => agree("log(x)", 10, 1));
  test('log(x) @100 = 2 in all three', () => agree("log(x)", 100, 2));
  test('ln(x) @e = 1 in all three', () => {
    for (const [name, fn] of Object.entries(evals)) {
      expect(close(fn("ln(x)", Math.E), 1)).toBe(true);
      expect(`${name}-ok`).toBe(`${name}-ok`);
    }
  });

  test('change-of-base log(x)/log(2) @8 = 3 in all three (base cancels — what stored data relies on)', () => {
    for (const [name, fn] of Object.entries(evals)) {
      expect(close(fn("log(x)/log(2)", 8), 3)).toBe(true);
    }
  });

  // Real stored §1.5 fn (audit confirmed all 6 log( rows are change-of-base form).
  // The base cancels, so this renders IDENTICALLY under the old natural-log and the
  // new base-10 convention — proving the unification needed no data migration.
  test('stored fixture "log(x + 2)/log(2)" is base-agnostic (natural vs base-10 give the same curve)', () => {
    const fnStr = "log(x + 2)/log(2)";
    for (const x of [0, 2, 6, 14]) {
      const expected = Math.log2(x + 2); // log_2(x+2)
      // base-10 form (new): log10(x+2)/log10(2)
      const base10 = Math.log10(x + 2) / Math.log10(2);
      // natural form (old): ln(x+2)/ln(2)
      const natural = Math.log(x + 2) / Math.log(2);
      expect(close(base10, expected)).toBe(true);
      expect(close(natural, expected)).toBe(true);
      // and every live evaluator matches
      for (const fn of Object.values(evals)) expect(close(fn(fnStr, x), expected)).toBe(true);
    }
  });
});

describe("graphRendering.evalFn — loud failure logging (no silent blank curves)", () => {
  test("a broken fn string console.errors once (throttled per fn), returns NaN", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      // unique name so the module-level throttle Set hasn't seen it from another test
      const bad = "zzzbroken_unique_47(x)";
      const r1 = evalFn(bad, 2);
      const r2 = evalFn(bad, 3); // second call must NOT re-log (throttle)
      expect(Number.isNaN(r1)).toBe(true);
      expect(Number.isNaN(r2)).toBe(true);
      const hits = spy.mock.calls.filter((c) => String(c.join(" ")).includes(bad));
      expect(hits.length).toBe(1);
      expect(String(hits[0].join(" "))).toMatch(/fn failed to evaluate/i);
    } finally {
      spy.mockRestore();
    }
  });

  test("a valid ln fn does NOT log an error", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      evalFn("ln(x+1)", 2);
      const hits = spy.mock.calls.filter((c) => String(c.join(" ")).includes("ln(x+1)"));
      expect(hits.length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
