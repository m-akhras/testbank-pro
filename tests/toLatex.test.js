const { toLatex } = require("../lib/math/toLatex");

describe("toLatex — region-based integrals", () => {
  test("double integral over D WITH 'of' → \\iint_{D}", () => {
    const out = toLatex("double integral over D of y*e^x dA");
    console.log("with 'of':", out);
    expect(out).toContain("\\iint_{D}");
    expect(out).toContain("dA");
  });

  test("double integral over D WITHOUT 'of' → \\iint_{D}", () => {
    const out = toLatex("double integral over D y*e^x dA");
    console.log("without 'of':", out);
    expect(out).toContain("\\iint_{D}");
    expect(out).toContain("dA");
  });

  test("full sentence without 'of' matches", () => {
    const input = "Evaluate the double integral over D y·e^x dA, where D is the region bounded by y = x and y = x^2 for 0 <= x <= 1.";
    const out = toLatex(input);
    console.log("full sentence:", out);
    expect(out).toContain("\\iint_{D}");
  });

  test("triple integral over E WITH 'of' → \\iiint_{E}", () => {
    const out = toLatex("triple integral over E of xyz dV");
    expect(out).toContain("\\iiint_{E}");
    expect(out).toContain("dV");
  });

  test("triple integral over E WITHOUT 'of' → \\iiint_{E}", () => {
    const out = toLatex("triple integral over E xyz dV");
    expect(out).toContain("\\iiint_{E}");
    expect(out).toContain("dV");
  });

  test("'of' variant is not double-matched by fallback", () => {
    const out = toLatex("double integral over D of f(x,y) dA");
    const count = (out.match(/\\iint/g) || []).length;
    expect(count).toBe(1);
  });
});
