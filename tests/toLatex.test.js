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

describe("toLatex — piecewise → \\begin{cases}", () => {
  test("Form A (if separator) → wrapped cases env with \\text{if } and inner LaTeX", () => {
    const out = toLatex("{ x^2 - 1 if x < 0 ; sqrt(x + 4) if x >= 0 }");
    expect(out).toContain("\\begin{cases}");
    expect(out).toContain("\\end{cases}");
    expect(out).toContain("\\text{if }");
    expect(out).toContain("\\sqrt{x + 4}");        // innerLatex output shape
    expect(out).toMatch(/^\\\(.*\\\)$/);            // self-wrapped in \( ... \)
  });

  test("Form A (comma separator) also produces cases with \\text{if }", () => {
    const out = toLatex("{ x^2, x < 0 ; sqrt(x), x >= 0 }");
    expect(out).toContain("\\begin{cases}");
    expect(out).toContain("\\text{if }");
  });

  test("Form A output is single-line (no real newline)", () => {
    const out = toLatex("{ x^2 - 1 if x < 0 ; sqrt(x + 4) if x >= 0 }");
    expect(out).not.toContain("\n");
  });

  test("Form B raw \\begin{cases} is wrapped in \\( \\) and preserved", () => {
    const out = toLatex("\\begin{cases} x^2 & x<0 \\\\ x & x>=0 \\end{cases}");
    expect(out).toContain("\\begin{cases}");
    expect(out).toMatch(/^\\\(.*\\\)$/);
  });

  test("negative: set notation { 1, 2, 3 } is NOT turned into a cases env", () => {
    const out = toLatex("{ 1, 2, 3 }");
    expect(out).not.toContain("\\begin{cases}");
  });
});

describe("toLatex — multiplication glyph: \\cdot inside LaTeX, · outside", () => {
  test("piecewise coefficient 2*x becomes \\cdot, no Unicode middle-dot leaks into the cases", () => {
    const out = toLatex("{ 2*x + 1 if x >= 1 ; x^2 - 3 if x < 1 }");
    expect(out).toContain("\\begin{cases}");
    expect(out).toContain("\\cdot");
    expect(out).not.toContain("·"); // U+00B7 must never appear inside the cases LaTeX
  });

  test("fraction with multiplication (2*x)/3 uses \\cdot, no middle-dot inside \\(...\\)", () => {
    const out = toLatex("(2*x)/3");
    expect(out).toContain("\\cdot");
    expect(out).not.toContain("·");
  });

  test("regression: bare multiplication 3*5 (not in a math block) still displays as ·", () => {
    const out = toLatex("3*5");
    expect(out).toContain("·");
    expect(out).not.toContain("\\cdot");
  });
});

describe("toLatex — set theory, composition, partial derivative", () => {
  test("union: A ∪ B → \\cup", () => {
    expect(toLatex("A ∪ B")).toContain("\\(\\cup\\)");
  });
  test("intersection: A ∩ B → \\cap", () => {
    expect(toLatex("A ∩ B")).toContain("\\(\\cap\\)");
  });
  test("membership: x ∈ A → \\in", () => {
    expect(toLatex("x ∈ A")).toContain("\\(\\in\\)");
  });
  test("subset: A ⊆ B → \\subseteq; A ⊂ B → \\subset", () => {
    expect(toLatex("A ⊆ B")).toContain("\\(\\subseteq\\)");
    expect(toLatex("A ⊂ B")).toContain("\\(\\subset\\)");
  });
  test("empty set: ∅ → \\emptyset", () => {
    expect(toLatex("∅")).toContain("\\(\\emptyset\\)");
  });
  test("composition: f ∘ g → \\circ, never 'composed with'", () => {
    const out = toLatex("f ∘ g");
    expect(out).toContain("\\(\\circ\\)");
    expect(out).not.toContain("composed with");
  });
  test("interval union bare U between brackets → \\cup", () => {
    expect(toLatex("(-infinity, 3) U (3, infinity)")).toContain("\\(\\cup\\)");
  });
  test("negative: 'Let U be the universal set' is NOT converted to \\cup", () => {
    expect(toLatex("Let U be the universal set")).not.toContain("\\cup");
  });
  test("partial derivative: ∂f/∂x → \\partial and \\dfrac", () => {
    const out = toLatex("∂f/∂x");
    expect(out).toContain("\\partial");
    expect(out).toContain("\\dfrac");
  });
});
