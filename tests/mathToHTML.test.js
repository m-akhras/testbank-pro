const { mathToHTML, mathToCanvasHTML } = require("../lib/math/html");

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

  test("<= becomes ≤ plain HTML (no equation_image needed)", () => {
    const out = mathToCanvasHTML("x <= 1");
    expect(out).not.toContain('<img class="equation_image"');
    expect(out).toContain("≤");
  });

  test("simple exponent becomes <sup> HTML (no equation_image)", () => {
    const out = mathToCanvasHTML("x^3");
    expect(out).not.toContain('<img class="equation_image"');
    expect(out).toContain("<sup>3</sup>");
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

  test("x^{2} → x<sup>2</sup>, no equation_image", () => {
    const out = mathToCanvasHTML("x^2");
    expect(out).not.toContain('<img class="equation_image"');
    expect(out).toContain("<sup>2</sup>");
  });

  test("y <= x → plain ≤ HTML, no equation_image", () => {
    const out = mathToCanvasHTML("y <= x");
    expect(out).not.toContain('<img class="equation_image"');
    expect(out).toContain("≤");
  });

  test("sqrt(x) → equation_image (complex)", () => {
    const out = mathToCanvasHTML("sqrt(x)");
    expect(out).toContain('<img class="equation_image"');
    expect(out).toContain("\\sqrt");
  });

  test("double integral over D → equation_image (complex)", () => {
    const out = mathToCanvasHTML("double integral over D of f dA");
    expect(out).toContain('<img class="equation_image"');
    expect(out).toContain("\\iint");
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

describe("Bug fixes", () => {
  test("Bug1: sin(x) inside integral → single \\sin, no double backslash", () => {
    const out = mathToCanvasHTML("integral from 0 to 1 of sin(x) dx");
    // '\\\\sin' in JS is the 2-backslash string \\sin — must NOT appear
    expect(out).not.toContain('\\\\sin');
    expect(out).toContain('<img class="equation_image"');
  });

  test("Bug2: nested single integral parses fully into one img, no leaked text", () => {
    const out = mathToCanvasHTML("integral from 0 to 4 of integral from y/2 to sqrt(y) of arctan(x) dx dy");
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out.replace(/<img[^>]*\/>/g, '').trim()).toBe('');
    expect(out).toContain('\\arctan');
  });

  test("Bug3: (2ln(2))/(3) → \\dfrac with \\ln(2), no double backslash", () => {
    const out = mathToHTML("(2ln(2))/(3)");
    expect(out).toContain('\\dfrac');
    expect(out).toContain('\\ln(2)');
    expect(out).not.toContain('\\\\ln');
  });
});

describe("DEBUG — real failing inputs", () => {
  test("DEBUG: double integral over D of sin(x) dA", () => {
    const { mathToCanvasHTML } = require("../lib/math/html");
    const input = "Let D be the region bounded by y=x^2. Evaluate the double integral over D of sin(x) dA.";
    const output = mathToCanvasHTML(input);
    console.log("INPUT:", input);
    console.log("OUTPUT:", output);
  });

  test("DEBUG: nested integral answer choice", () => {
    const { mathToCanvasHTML } = require("../lib/math/html");
    const input = "integral from 0 to 4 of integral from y/2 to sqrt(y) of arctan(x) dx dy";
    const output = mathToCanvasHTML(input);
    console.log("INPUT:", input);
    console.log("OUTPUT:", output);
  });

  test("DEBUG: fraction with ln", () => {
    const { mathToCanvasHTML } = require("../lib/math/html");
    const input = "19/36 + (2ln(2))/(3)";
    const output = mathToCanvasHTML(input);
    console.log("INPUT:", input);
    console.log("OUTPUT:", output);
  });
});
