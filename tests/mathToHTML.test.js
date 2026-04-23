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

  test("double integral over D of ln(y) dA → exactly one equation_image, no orphan \\(...\\)", () => {
    const out = mathToCanvasHTML("double integral over D of ln(y) dA");
    console.log("double integral ln(y):", out);
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out).not.toMatch(/\\\(/);
    expect(out).not.toMatch(/\\\)/);
  });

  test("double integral over D of sin(x) dA → exactly one equation_image with \\iint_{D} \\sin(x)", () => {
    const out = mathToCanvasHTML("double integral over D of sin(x) dA");
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out).toContain("\\iint_{D}");
    expect(out).toContain("\\sin(x)");
    expect(out).not.toMatch(/\\\(/);
    expect(out).not.toMatch(/\\\)/);
  });

  test("double integral over D of e^x dA → exactly one equation_image with \\iint_{D} e^{x}", () => {
    const out = mathToCanvasHTML("double integral over D of e^x dA");
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out).toContain("\\iint_{D}");
    expect(out).toContain("e^{x}");
    expect(out).not.toMatch(/\\\(/);
    expect(out).not.toMatch(/\\\)/);
  });
});
