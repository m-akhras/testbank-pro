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

  test('documented convention: bare "log" is NATURAL log in this compiler (diverges from the stem renderer)', () => {
    const f = compileExpression("log(x)", ["x"]);
    expect(close(f(10), Math.log(10))).toBe(true); // natural, NOT base-10
    expect(close(f(10), 1)).toBe(false);           // explicitly NOT log10
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
