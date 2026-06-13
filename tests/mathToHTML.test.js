const { mathToHTML, mathToCanvasHTML, mathToHTMLInline } = require("../lib/math/html");

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

  test("<= now emits equation_image (always-image contract)", () => {
    const out = mathToCanvasHTML("x <= 1");
    expect(out).toContain('<img class="equation_image"');
    // The LaTeX source encoded in the img should contain \leq
    expect(out).toContain("leq");
  });

  test("simple exponent emits equation_image (always-image contract)", () => {
    const out = mathToCanvasHTML("x^3");
    expect(out).toContain('<img class="equation_image"');
    // src is DOUBLE URL-encoded (Canvas requirement): x^{3} → %5E%7B3%7D → %255E%257B3%257D
    expect(out).toContain("x%255E%257B3%257D");
    expect(out).toMatch(/src="\/equation_images\/[^"]*\?scale=1"/);
    expect(out).toContain("data-ignore-a11y-check");
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

  test("x^2 emits equation_image (always-image contract)", () => {
    const out = mathToCanvasHTML("x^2");
    expect(out).toContain('<img class="equation_image"');
    expect(out).toContain("x%255E%257B2%257D"); // double-encoded x^{2}
  });

  test("y <= x emits equation_image (always-image contract)", () => {
    const out = mathToCanvasHTML("y <= x");
    expect(out).toContain('<img class="equation_image"');
    expect(out).toContain("leq");
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

describe("Greek-in-fraction double-escape regression (fix for pi/2 leak)", () => {
  test("pi inside (num)/(den) fraction emits single-backslash \\pi", () => {
    const out = require("../lib/math/toLatex").toLatex("(pi)/(2)");
    expect(out).toContain("\\dfrac{\\pi}{2}");
    expect(out).not.toContain("\\\\pi");
  });
  test("theta inside fraction emits single-backslash \\theta", () => {
    const out = require("../lib/math/toLatex").toLatex("(theta)/(2)");
    expect(out).toContain("\\dfrac{\\theta}{2}");
    expect(out).not.toContain("\\\\theta");
  });
  test("phi inside fraction emits single-backslash \\phi", () => {
    const out = require("../lib/math/toLatex").toLatex("(phi)/(2)");
    expect(out).toContain("\\dfrac{\\phi}{2}");
    expect(out).not.toContain("\\\\phi");
  });
  test("pi in denominator also stays single-escaped", () => {
    const out = require("../lib/math/toLatex").toLatex("(x)/(pi)");
    expect(out).toContain("\\dfrac{x}{\\pi}");
    expect(out).not.toContain("\\\\pi");
  });
  test("bare pi outside fraction still wraps", () => {
    const out = require("../lib/math/toLatex").toLatex("pi");
    expect(out).toContain("\\(\\pi\\)");
  });
  test("pi in stem reference like [-pi, pi] still wraps", () => {
    const out = require("../lib/math/toLatex").toLatex("interval [-pi, pi]");
    expect(out).toContain("\\(\\pi\\)");
    expect(out).not.toContain("\\\\pi");
  });
  test("sigma (not in innerLatex) remains correct", () => {
    const out = require("../lib/math/toLatex").toLatex("(sigma)/(2)");
    expect(out).toContain("\\dfrac{\\sigma}{2}");
  });
});

describe("Digit-base letter-exponent regression (b^x for §1.4 exponentials)", () => {
  const { toLatex } = require("../lib/math/toLatex");
  test("3^x wraps as \\(3^{x}\\)", () => {
    expect(toLatex("3^x")).toBe("\\(3^{x}\\)");
  });
  test("2^x wraps", () => {
    expect(toLatex("2^x")).toBe("\\(2^{x}\\)");
  });
  test("10^x preserves multi-digit base", () => {
    expect(toLatex("10^x")).toBe("\\(10^{x}\\)");
  });
  test("100^x preserves multi-digit base", () => {
    expect(toLatex("100^x")).toBe("\\(100^{x}\\)");
  });
  test("inline in prose: y = 3^x is shown dashed", () => {
    expect(toLatex("y = 3^x is shown dashed")).toContain("\\(3^{x}\\)");
  });
  test("Canvas-bound stem: which sequence produces h(x) = 3^(x+1)", () => {
    // 3^(x+1) was already working via the parenthesized-exponent pass
    expect(toLatex("h(x) = 3^(x+1) - 2")).toContain("\\(3^{x+1}\\)");
  });
  test("regression: x^2 still works", () => {
    expect(toLatex("x^2")).toBe("\\(x^{2}\\)");
  });
  test("regression: e^x still works", () => {
    expect(toLatex("e^x")).toContain("\\(e^{x}\\)");
  });
  test("does not match digit-suffix of identifier: x1^y stays literal", () => {
    expect(toLatex("x1^y")).toBe("x1^y");
  });
});

describe("exp(x) → e^x conversion", () => {
  const { toLatex } = require("../lib/math/toLatex");
  const { mathToOmml } = require("../lib/math/omml");
  test("toLatex: exp(x) → \\(e^{x}\\)", () => {
    expect(toLatex("exp(x)")).toContain("\\(e^{x}\\)");
  });
  test("toLatex: y = exp(x) → y = \\(e^{x}\\)", () => {
    expect(toLatex("y = exp(x)")).toContain("\\(e^{x}\\)");
  });
  test("toLatex: exp(x - 1) → e^(x-1) wrapped", () => {
    expect(toLatex("exp(x - 1)")).toContain("\\(e^{x - 1}\\)");
  });
  test("toLatex: exp(-x) renders with negative exponent", () => {
    expect(toLatex("exp(-x)")).toContain("\\(e^{-x}\\)");
  });
  test("omml: exp(x) produces m:sSup with base e", () => {
    const out = mathToOmml("exp(x)");
    expect(out).toContain("<m:sSup>");
    expect(out).toContain("<m:t xml:space=\"preserve\">e</m:t>");
  });
  test("omml: y = exp(x) inline", () => {
    const out = mathToOmml("y = exp(x)");
    expect(out).toContain("<m:sSup>");
  });
});

describe("Canvas always-image rendering", () => {
  const { toLatexForCanvas } = require("../lib/math/toLatex");
  test("simple x^2 now emits equation_image (not <sup>)", () => {
    const out = toLatexForCanvas("x^2");
    expect(out).toContain("equation_image");
    expect(out).not.toContain("<sup>");
  });
  test("simple 3^x now emits equation_image", () => {
    const out = toLatexForCanvas("3^x");
    expect(out).toContain("equation_image");
  });
  test("exp(x) emits equation_image via e^x path", () => {
    const out = toLatexForCanvas("exp(x)");
    expect(out).toContain("equation_image");
  });
  test("sqrt still emits equation_image (regression)", () => {
    const out = toLatexForCanvas("sqrt(x+1)");
    expect(out).toContain("equation_image");
  });
  test("prose between math blocks stays as text", () => {
    const out = toLatexForCanvas("Find x^2 in the equation");
    // "Find" and "in the equation" should NOT be wrapped in equation_image
    // Only the x^2 should be
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out).toContain("Find ");
    expect(out).toContain(" in the equation");
  });
});

describe("piecewise cases — Canvas equation_image", () => {
  const { mathToCanvasHTML } = require("../lib/math/html");

  test("Form A piecewise → exactly one equation_image with encoded \\begin{cases}", () => {
    const out = mathToCanvasHTML("{ x^2 - 1 if x < 0 ; sqrt(x + 4) if x >= 0 }");
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out).toContain("%255Cbegin%257Bcases%257D"); // DOUBLE URL-encoded \begin{cases}
    expect(out).toMatch(/src="\/equation_images\/[^"]*\?scale=1"/);
    expect(out).toContain("data-ignore-a11y-check");
    expect(out).not.toMatch(/\\\(/);              // no orphan \(
    expect(out).not.toMatch(/\\\)/);              // no orphan \)
  });

  test("piecewise inside a sentence → one image, surrounding prose preserved", () => {
    const out = mathToCanvasHTML("Let f(x) = { x^2 if x<0 ; x if x>=0 }. Find f(-2).");
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
    expect(out).toContain("Let f(x) =");
    expect(out).toContain("Find f(-2)");
  });
});

describe("multiplication in Canvas equation_image uses \\cdot, never raw ·", () => {
  // Post implicit-mult cleanup: number*number keeps the \cdot glyph; number*variable
  // juxtaposes. Use 2*3 to exercise the glyph, and assert 2*x juxtaposes.
  test("piecewise with a 2*3 product → encoded \\cdot, no raw · or %C2%B7", () => {
    const out = mathToCanvasHTML("{ 2*3 + 1 if x >= 1 ; x^2 - 3 if x < 1 }");
    expect(out).toContain('<img class="equation_image"');
    expect(out).toContain("%255Ccdot");  // DOUBLE URL-encoded \cdot in the equation_image src
    expect(out).toMatch(/src="\/equation_images\/[^"]*\?scale=1"/);
    expect(out).toContain("data-ignore-a11y-check");
    expect(out).not.toMatch(/·/);        // no raw U+00B7 anywhere in the output
    expect(out).not.toMatch(/%C2%B7/);   // no single-encoded U+00B7 either
  });

  test("a 2*x coefficient juxtaposes (2x) — no \\cdot noise in the equation_image", () => {
    const out = mathToCanvasHTML("{ 2*x + 1 if x >= 1 ; x^2 - 3 if x < 1 }");
    expect(out).toContain("2x");          // juxtaposed coefficient
    expect(out).not.toContain("%255Ccdot");
    expect(out).not.toMatch(/·/);
  });
});

describe("fraction whitespace around slash — single equation_image", () => {
  test("(e^x - e^{-x}) / (e^x + e^{-x}) → exactly ONE equation_image (not fragments)", () => {
    const out = mathToCanvasHTML("(e^x - e^{-x}) / (e^x + e^{-x})");
    const imgCount = (out.match(/<img class="equation_image"/g) || []).length;
    expect(imgCount).toBe(1);
  });
});

describe("mathToHTMLInline — subscript rendering (<sub>)", () => {
  test("b_0 → <sub>0</sub>", () => {
    expect(mathToHTMLInline("b_0")).toContain("<sub>0</sub>");
  });
  test("b_{1} → <sub>1</sub>", () => {
    expect(mathToHTMLInline("b_{1}")).toContain("<sub>1</sub>");
  });
  test("regression: x^2 still → <sup>2</sup> (exponent path intact)", () => {
    expect(mathToHTMLInline("x^2")).toContain("<sup>2</sup>");
  });
});

describe("Canvas equation_image src form — double-encoded + ?scale=1 + a11y flag (ALL math)", () => {
  test("sqrt(x+5): src is double-encoded, ends with ?scale=1, img has data-ignore-a11y-check", () => {
    const out = mathToCanvasHTML("sqrt(x+5)");
    expect(out).toContain('<img class="equation_image"');
    // \sqrt{x+5} → %5Csqrt%7Bx%2B5%7D → double → %255Csqrt%257Bx%252B5%257D
    expect(out).toContain("%255Csqrt%257Bx%252B5%257D");
    expect(out).toMatch(/src="\/equation_images\/[^"]*\?scale=1"/);
    expect(out).toContain('data-ignore-a11y-check=""');
    // title/alt/data-equation-content stay single HTML-entity-escaped raw LaTeX
    expect(out).toContain('data-equation-content="\\sqrt{x+5}"');
  });
});

// ── Coalesce fragmented equation images in QTI stems ─────────────────────────
// toLatex wraps each atomic sub-expression in its own \(...\); toLatexForCanvas
// used to emit one equation_image per span, shattering a single expression into
// multiple images with loose math text + a leaked bare base char. These assert
// the export-side coalescing repairs the model's under-delimiting.
describe("QTI stem coalescing — fragmented math merged into one equation_image", () => {
  const imgCount = (s) => (s.match(/<img class="equation_image"/g) || []).length;
  const content = (s) => (s.match(/data-equation-content="([^"]*)"/) || [])[1];

  test('"Evaluate lim_{x->2} (2x^2-x+1)." → ONE image after "Evaluate ", full expression, no loose math', () => {
    const out = mathToCanvasHTML("Evaluate lim_{x->2} (2x^2-x+1).");
    // before this fix the same stem produced 2+ images (\lim_{x\to2} and x^{2})
    expect(imgCount(out)).toBe(1);
    const c = content(out);
    expect(c).toContain("\\lim_{x\\to2}");
    expect(c).toContain("2x^{2}-x+1");          // coefficient + tail merged in
    // prose stays text, sentence period stays outside the image
    expect(out).toMatch(/^Evaluate <img/);
    expect(out.replace(/<img[^>]*\/>/g, "X")).toBe("Evaluate X.");
    // no orphan \(...\) delimiters, no stray single-char (\lim alone / x alone) image
    expect(out).not.toMatch(/\\\(/);
    expect(out).not.toMatch(/data-equation-content="\\lim_\{x\\to2\}"/); // not a lone-lim image
    expect(out).not.toMatch(/data-equation-content="x\^\{2\}"/);         // not a lone-x^2 image
  });

  test('"f(x) = e^{2x}+3" → ONE image "e^{2x}+3", no detached "+3", no leaked "e"', () => {
    const out = mathToCanvasHTML("f(x) = e^{2x}+3");
    expect(imgCount(out)).toBe(1);
    expect(content(out)).toBe("e^{2x}+3");
    // the "+3" must be inside the image, not a loose text node after it
    expect(out.replace(/<img[^>]*\/>/g, "X")).toBe("f(x) = X");
  });

  test('"e^{1\\cdot x}+2" → renders "e^{x}+2" (degenerate 1\\cdot gone), single image', () => {
    const out = mathToCanvasHTML("e^{1\\cdot x}+2");
    expect(imgCount(out)).toBe(1);
    expect(content(out)).toBe("e^{x}+2");
    expect(content(out)).not.toContain("\\cdot");
    expect(content(out)).not.toContain("1");
  });

  test("pure-prose stem keeps prose as text, only math as image(s)", () => {
    const out = mathToCanvasHTML("Combine into a single logarithm: log(x) + log(y)");
    expect(out).toContain("Combine into a single logarithm:");
    expect(imgCount(out)).toBeGreaterThanOrEqual(1);
    // the prose prefix is never swallowed into an image
    expect(out).toMatch(/^Combine into a single logarithm: <img/);
    expect(out).not.toMatch(/\\\(/);
  });

  test("before→after image-count drop for the lim case (2+ → 1)", () => {
    // Reconstruct the pre-coalesce span count from toLatex (one image per \(...\) span).
    const { toLatex } = require("../lib/math/toLatex");
    const spans = (toLatex("Evaluate lim_{x->2} (2x^2-x+1).").match(/\\\(/g) || []).length;
    expect(spans).toBeGreaterThanOrEqual(2);   // toLatex still fragments into 2+ spans
    const out = mathToCanvasHTML("Evaluate lim_{x->2} (2x^2-x+1).");
    expect(imgCount(out)).toBe(1);             // coalescer collapses them to 1 image
  });

  test("degenerate cleanup does NOT eat a legit number·number product in a math context", () => {
    // 2*3 inside a piecewise (math) block → 2\cdot 3; juxtaposing would change meaning
    const out = mathToCanvasHTML("{ 2*3 + 1 if x >= 1 ; x^2 - 3 if x < 1 }");
    expect(content(out)).toContain("\\cdot");
  });
});

// ── Glue-boundary guard ──────────────────────────────────────────────────────
// The coalescer must merge math fragments connected by mathematical glue WITHOUT
// swallowing standalone prose words (a lone-letter token only counts as glue when
// it's flanked by operators/digits, never when it's a word with spaces both sides).
describe("glue boundary — prose between math spans is never absorbed", () => {
  const imgCount = (s) => (s.match(/<img class="equation_image"/g) || []).length;
  const contents = (s) => [...s.matchAll(/data-equation-content="([^"]*)"/g)].map((m) => m[1]);
  const skeleton = (s) => s.replace(/<img[^>]*\/>/g, "⟦IMG⟧"); // collapse images to a marker

  test('#1 lone "a" word is never wrapped; whole prose stem stays text', () => {
    const out = mathToCanvasHTML("Find a so that f(x) = a x + 1 passes through (0,3).");
    expect(imgCount(out)).toBe(0);
    // unchanged prose — the standalone-word boundary holds, nothing merged
    expect(out).toBe("Find a so that f(x) = a x + 1 passes through (0,3).");
  });

  test('#2 " at " / " where " stay text; one image x^{2}', () => {
    const out = mathToCanvasHTML("Evaluate f at x = 2 where f(x) = x^2.");
    expect(imgCount(out)).toBe(1);
    expect(contents(out)).toEqual(["x^{2}"]);
    expect(skeleton(out)).toBe("Evaluate f at x = 2 where f(x) = ⟦IMG⟧.");
    expect(out).toContain(" at ");
    expect(out).toContain(" where ");
  });

  test("#3 inter-sentence prose and trailing f(x) stay text; one image \\lim_{x\\to1}", () => {
    const out = mathToCanvasHTML("The function f is continuous. Determine lim_{x->1} f(x).");
    expect(imgCount(out)).toBe(1);
    expect(contents(out)).toEqual(["\\lim_{x\\to1}"]);
    // prose before the math sentence AND the trailing " f(x)" are not absorbed
    expect(skeleton(out)).toBe("The function f is continuous. Determine ⟦IMG⟧ f(x).");
  });

  test('#4 coefficient/operators merge into one image; "on [0, 4]" stays prose', () => {
    const out = mathToCanvasHTML("Let f(x) = 2x^2 - 3x + 1 on [0, 4]. Find the absolute maximum of f on the interval.");
    expect(imgCount(out)).toBe(1);
    expect(contents(out)).toEqual(["2x^{2} - 3x + 1"]); // leading coeff + trailing tail merged
    expect(skeleton(out)).toBe("Let f(x) = ⟦IMG⟧ on [0, 4]. Find the absolute maximum of f on the interval.");
  });
});
