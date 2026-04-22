const { normalizeUnicodeMath } = require("../lib/normalizeUnicodeMath");

describe("normalizeUnicodeMath", () => {
  test("converts √(x) to sqrt(x)", () => {
    expect(normalizeUnicodeMath("√(x+1)")).toBe("sqrt(x+1)");
  });

  test("converts bare √x to sqrt(x)", () => {
    expect(normalizeUnicodeMath("√x")).toBe("sqrt(x)");
  });

  test("converts ∬ to 'double integral'", () => {
    expect(normalizeUnicodeMath("∬_D f dA")).toContain("double integral");
  });

  test("does not produce literal LaTeX delimiters for ∬", () => {
    const result = normalizeUnicodeMath("∬_D f dA");
    expect(result).not.toContain("\\(\\iint\\)");
  });

  test("handles ∬_D → 'double integral over D'", () => {
    expect(normalizeUnicodeMath("∬_D f dA")).toContain("double integral over D");
  });

  test("dedupes 'double integral double integral' artifacts", () => {
    expect(normalizeUnicodeMath("double integral double integral_D f dA"))
      .not.toContain("double integral double integral");
  });

  test("converts π to 'pi'", () => {
    expect(normalizeUnicodeMath("sin(π/2)")).toBe("sin(pi/2)");
  });

  test("converts Unicode superscripts", () => {
    expect(normalizeUnicodeMath("x²+y²")).toBe("x2+y2");
  });

  test("preserves already-escaped LaTeX Greek letters", () => {
    expect(normalizeUnicodeMath("\\alpha + α")).toBe("\\alpha + alpha");
  });
});
