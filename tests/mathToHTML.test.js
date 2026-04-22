const { mathToHTML, mathToCanvasHTML } = require("../lib/exports/helpers");

describe("mathToHTML — KaTeX-style \\(...\\) output (unchanged)", () => {
  test("sqrt wraps in \\(\\sqrt{...}\\)", () => {
    expect(mathToHTML("sqrt(x)")).toContain("\\(\\sqrt{x}\\)");
  });

  test("does not contain equation_image", () => {
    expect(mathToHTML("sqrt(x)")).not.toContain("equation_image");
  });

  test("<= becomes \\(\\leq\\)", () => {
    expect(mathToHTML("x <= 1")).toContain("\\(\\leq\\)");
    expect(mathToHTML("x <= 1")).not.toContain("≤");
  });
});

describe("mathToCanvasHTML — Canvas equation_image output", () => {
  test("sqrt produces equation_image img tag", () => {
    const out = mathToCanvasHTML("sqrt(x)");
    console.log("mathToCanvasHTML('sqrt(x)'):", out);
    expect(out).toContain('<img class="equation_image"');
  });

  test("equation_image src contains URL-encoded LaTeX", () => {
    const out = mathToCanvasHTML("sqrt(x)");
    expect(out).toContain("/equation_images/");
    expect(out).toContain("\\sqrt");
  });

  test("output does NOT contain literal \\(...\\) delimiters", () => {
    const out = mathToCanvasHTML("sqrt(x)");
    expect(out).not.toMatch(/\\\(.*\\\)/);
  });

  test("<= becomes equation_image with \\leq", () => {
    const out = mathToCanvasHTML("x <= 1");
    expect(out).toContain('<img class="equation_image"');
    expect(out).toContain("\\leq");
    expect(out).not.toContain("≤");
  });

  test("exponent produces equation_image", () => {
    const out = mathToCanvasHTML("x^3");
    expect(out).toContain('<img class="equation_image"');
  });

  test("pipe table cells use equation_image", () => {
    const table = "| x | sqrt(x) |\n|---|---|\n| 4 | 2 |";
    const out = mathToCanvasHTML(table);
    expect(out).toContain("<table");
    expect(out).toContain('<img class="equation_image"');
  });

  test("plain text passes through unchanged", () => {
    const out = mathToCanvasHTML("Find the area.");
    expect(out).toBe("Find the area.");
  });
});
