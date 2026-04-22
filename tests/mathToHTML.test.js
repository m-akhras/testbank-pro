const { mathToHTML } = require("../lib/exports/helpers");

describe("mathToHTML uses LaTeX wrapping (not raw Unicode)", () => {
  const input = "y = sqrt(x) and y = x^3 for 0 <= x <= 1";

  test("output contains LaTeX sqrt", () => {
    const out = mathToHTML(input);
    console.log("mathToHTML output:", out);
    expect(out).toContain("\\(\\sqrt{");
  });

  test("output does not contain raw √", () => {
    expect(mathToHTML(input)).not.toContain("√");
  });

  test("output uses \\leq not ≤", () => {
    const out = mathToHTML(input);
    expect(out).toContain("\\leq");
    expect(out).not.toContain("≤");
  });

  test("output uses \\geq not ≥", () => {
    expect(mathToHTML("x >= 0")).toContain("\\geq");
    expect(mathToHTML("x >= 0")).not.toContain("≥");
  });

  test("output uses \\neq not ≠", () => {
    expect(mathToHTML("x != y")).toContain("\\neq");
    expect(mathToHTML("x != y")).not.toContain("≠");
  });

  test("exponents wrapped in LaTeX", () => {
    expect(mathToHTML("x^3")).toContain("\\(x^{3}\\)");
  });

  test("pipe table cells also use LaTeX", () => {
    const table = "| x | sqrt(x) |\n|---|---|\n| 4 | 2 |";
    const out = mathToHTML(table);
    expect(out).toContain("<table");
    expect(out).toContain("\\(\\sqrt{");
  });
});
