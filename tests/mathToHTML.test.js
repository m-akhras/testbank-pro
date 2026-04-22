const { mathToHTML } = require("../lib/exports/helpers");

describe("mathToHTML uses Canvas math_inline spans with LaTeX", () => {
  const input = "y = sqrt(x) and y = x^3 for 0 <= x <= 1";

  test("output contains Canvas math_inline span", () => {
    const out = mathToHTML(input);
    console.log("mathToHTML output:", out);
    expect(out).toContain('class="math_inline"');
  });

  test("output contains LaTeX sqrt inside span", () => {
    expect(mathToHTML(input)).toContain('<span class="math_inline">\\(\\sqrt{');
  });

  test("output does not contain raw √", () => {
    expect(mathToHTML(input)).not.toContain("√");
  });

  test("output uses \\leq inside span, not raw ≤", () => {
    const out = mathToHTML(input);
    expect(out).toContain('<span class="math_inline">\\(\\leq\\)</span>');
    expect(out).not.toContain("≤");
  });

  test("output uses \\geq inside span, not raw ≥", () => {
    const out = mathToHTML("x >= 0");
    expect(out).toContain('<span class="math_inline">\\(\\geq\\)</span>');
    expect(out).not.toContain("≥");
  });

  test("output uses \\neq inside span, not raw ≠", () => {
    const out = mathToHTML("x != y");
    expect(out).toContain('<span class="math_inline">\\(\\neq\\)</span>');
    expect(out).not.toContain("≠");
  });

  test("exponents wrapped in Canvas math_inline span", () => {
    expect(mathToHTML("x^3")).toContain('<span class="math_inline">\\(x^{3}\\)</span>');
  });

  test("pipe table cells also use math_inline spans", () => {
    const table = "| x | sqrt(x) |\n|---|---|\n| 4 | 2 |";
    const out = mathToHTML(table);
    expect(out).toContain("<table");
    expect(out).toContain('<span class="math_inline">\\(\\sqrt{');
  });
});
