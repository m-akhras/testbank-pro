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
  // After the implicit-mult cleanup (QTI audit) a number*VARIABLE coefficient
  // juxtaposes (2*x → 2x), so the \cdot glyph only survives between two numeric
  // literals (2*3). These tests use number*number to exercise the glyph choice.
  test("piecewise number*number 2*3 becomes \\cdot, no Unicode middle-dot leaks into the cases", () => {
    const out = toLatex("{ 2*3 + 1 if x >= 1 ; x^2 - 3 if x < 1 }");
    expect(out).toContain("\\begin{cases}");
    expect(out).toContain("\\cdot");
    expect(out).not.toContain("·"); // U+00B7 must never appear inside the cases LaTeX
  });

  test("fraction with number*number (2*3)/x uses \\cdot, no middle-dot inside \\(...\\)", () => {
    const out = toLatex("(2*3)/x");
    expect(out).toContain("\\cdot");
    expect(out).not.toContain("·");
  });

  test("regression: bare multiplication 3*5 (not in a math block) still displays as ·", () => {
    const out = toLatex("3*5");
    expect(out).toContain("·");
    expect(out).not.toContain("\\cdot");
  });

  // FIX B — implicit multiplication + degenerate-form cleanup on the LIVE strings.
  test("2*x+1*y → 2x+y (coefficient juxtaposed, unit 1* dropped, no \\cdot)", () => {
    const out = toLatex("2*x+1*y");
    expect(out).toBe("2x+y");
    expect(out).not.toContain("\\cdot");
    expect(out).not.toContain("·");
  });

  test("x^1*y^2/z^1 → exponent ^1 dropped, coefficients juxtaposed (no ^{1}, no \\cdot)", () => {
    const out = toLatex("x^1*y^2/z^1");
    expect(out).not.toContain("^{1}");
    expect(out).not.toContain("\\cdot");
    expect(out).toMatch(/xy/);      // x·y juxtaposed
  });

  test("3*ln(x) → 3\\ln(x) (number*function juxtaposed, function still detected)", () => {
    const out = toLatex("3*ln(x)");
    expect(out).toBe("3\\(\\ln(x)\\)"); // the 3 sits directly on \ln, no \cdot
    expect(out).not.toContain("\\cdot");
  });

  test("2.5*x → 2.5x (decimal coefficient juxtaposed)", () => {
    expect(toLatex("2.5*x")).toBe("2.5x");
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
  test("non-membership: x ∉ A → \\notin", () => {
    expect(toLatex("x ∉ A")).toContain("\\(\\notin\\)");
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

describe("toLatex — powered & inverse trig (no function-name splitting)", () => {
  test("sin^-1(x) → \\sin^{-1}, not split into si\\(n", () => {
    const out = toLatex("sin^-1(x)");
    expect(out).toContain("\\sin^{-1}");
    expect(out).not.toContain("si\\(n");
  });
  test("sin^-1(x) → the single block \\(\\sin^{-1}(x)\\)", () => {
    expect(toLatex("sin^-1(x)")).toContain("\\(\\sin^{-1}(x)\\)");
  });
  test("sin^(-1)(x) → \\sin^{-1}", () => {
    expect(toLatex("sin^(-1)(x)")).toContain("\\sin^{-1}");
  });
  test("sec^(-1)(2) → \\sec^{-1}; cot^(-1)(x) → \\cot^{-1}", () => {
    expect(toLatex("sec^(-1)(2)")).toContain("\\sec^{-1}");
    expect(toLatex("cot^(-1)(x)")).toContain("\\cot^{-1}");
  });
  test("sin^2(x) → \\sin^{2}, not split into si\\(n", () => {
    const out = toLatex("sin^2(x)");
    expect(out).toContain("\\sin^{2}");
    expect(out).not.toContain("si\\(n");
  });
  test("sin^2(x) + cos^2(x) → both \\sin^{2} and \\cos^{2}", () => {
    const out = toLatex("sin^2(x) + cos^2(x)");
    expect(out).toContain("\\sin^{2}");
    expect(out).toContain("\\cos^{2}");
  });
  test("regression: plain sin(x) still → \\sin(x)", () => {
    expect(toLatex("sin(x)")).toContain("\\sin(x)");
  });
  test("regression: generic caret inverse f^-1 still → \\(f^{-1}\\)", () => {
    expect(toLatex("f^-1")).toContain("\\(f^{-1}\\)");
  });
});

describe("toLatex — Unicode superscripts → caret exponent", () => {
  test("f⁻¹ → \\(f^{-1}\\)", () => {
    expect(toLatex("f⁻¹")).toContain("\\(f^{-1}\\)");
  });
  test("f⁻¹(x) → f^{-1}", () => {
    expect(toLatex("f⁻¹(x)")).toContain("f^{-1}");
  });
  test("(g∘f)⁻¹ → \\(\\circ\\) and ^{-1}", () => {
    const out = toLatex("(g∘f)⁻¹");
    expect(out).toContain("\\(\\circ\\)");
    expect(out).toContain("^{-1}");
  });
  test("x² → \\(x^{2}\\)", () => {
    expect(toLatex("x²")).toContain("\\(x^{2}\\)");
  });
  test("x³ + 2x → x^{3}", () => {
    expect(toLatex("x³ + 2x")).toContain("x^{3}");
  });
  test("sin²(x) → \\sin^{2}, not split into si\\(n", () => {
    const out = toLatex("sin²(x)");
    expect(out).toContain("\\sin^{2}");
    expect(out).not.toContain("si\\(n");
  });
  test("regression: ASCII caret x^2 still → \\(x^{2}\\)", () => {
    expect(toLatex("x^2")).toContain("\\(x^{2}\\)");
  });
  test("a₁ + a₂ → a_{1} + a_{2} subscripts", () => {
    const out = toLatex("a₁ + a₂");
    expect(out).toContain("a_{1}");
    expect(out).toContain("a_{2}");
  });
});

describe("toLatex — Unicode subscripts → underscore", () => {
  test("b₀ → \\(b_{0}\\)", () => {
    expect(toLatex("b₀")).toContain("\\(b_{0}\\)");
  });
  test("y = b₀ + b₁x → b_{0} and b_{1}", () => {
    const out = toLatex("y = b₀ + b₁x");
    expect(out).toContain("b_{0}");
    expect(out).toContain("b_{1}");
  });
});

describe("compound rationals with exponents", () => {
  test("(e^{2x} - e^{-2x})/(e^{2x} + e^{-2x}) → one \\dfrac, slash consumed", () => {
    const out = toLatex("(e^{2x} - e^{-2x})/(e^{2x} + e^{-2x})");
    expect(out).toContain("\\dfrac");
    expect(out).toContain("e^{2x}");
    expect(out).toContain("e^{-2x}");
    expect(out).not.toContain(")/(");
  });
  test("regression: bare e^x rational still → \\dfrac", () => {
    expect(toLatex("(e^x - 1)/(e^x + 1)")).toContain("\\dfrac");
  });
  test("regression: bare x^2 rational still → \\dfrac", () => {
    expect(toLatex("(x^2 - 1)/(x^2 + 1)")).toContain("\\dfrac");
  });
  test("oracle: plain (1+x)/(1-x) unchanged", () => {
    expect(toLatex("(1+x)/(1-x)")).toContain("\\(\\dfrac{1+x}{1-x}\\)");
  });
  test("relocated pass: standalone braced exponent e^{2x} → \\(e^{2x}\\)", () => {
    expect(toLatex("e^{2x}")).toContain("\\(e^{2x}\\)");
  });
  test("relocated pass: standalone 2^{kt} + 3 → 2^{kt}", () => {
    expect(toLatex("2^{kt} + 3")).toContain("2^{kt}");
  });
});

describe("fraction whitespace around slash", () => {
  test("(e^x - e^{-x}) / (e^x + e^{-x}) with spaces → one \\dfrac, slash consumed", () => {
    const out = toLatex("(e^x - e^{-x}) / (e^x + e^{-x})");
    expect(out).toContain("\\dfrac");
    expect(out).not.toContain(") / (");
    expect(out).not.toContain(")/(");
  });
  test("no-space form still works", () => {
    expect(toLatex("(e^x - e^{-x})/(e^x + e^{-x})")).toContain("\\dfrac");
  });
  test("spaced + braced exponents → \\dfrac", () => {
    expect(toLatex("(e^{2x} - e^{-2x}) / (e^{2x} + e^{-2x})")).toContain("\\dfrac");
  });
  test("oracle regression: (1+x)/(1-x) byte-identical", () => {
    expect(toLatex("(1+x)/(1-x)")).toContain("\\(\\dfrac{1+x}{1-x}\\)");
  });
  test("over-span guard: (a) + (b)/(c) → \\dfrac{b}{c} only, (a) preserved", () => {
    const out = toLatex("(a) + (b)/(c)");
    expect(out).toContain("\\dfrac{b}{c}");
    expect(out).toContain("(a)");
  });
});

describe("paren-exponent rationals (fix B)", () => {
  test("(e^(x) - e^(-x))/(e^(x) + e^(-x)) → one \\dfrac, slash consumed", () => {
    const out = toLatex("(e^(x) - e^(-x))/(e^(x) + e^(-x))");
    expect(out).toContain("\\dfrac");
    expect(out).not.toContain(")/(");
  });
  test("spaced paren-exponent rational → \\dfrac", () => {
    expect(toLatex("(e^(x) - e^(-x)) / (e^(x) + e^(-x))")).toContain("\\dfrac");
  });
  test("fractional exponent e^(1/2) → \\frac{1}{2}, not garbled", () => {
    const out = toLatex("e^(1/2)");
    expect(out).toContain("\\frac{1}{2}");
    expect(out).not.toContain("\\dfrac{1}");
  });
  test("fractional exponent x^(2/3) → \\frac{2}{3}", () => {
    expect(toLatex("x^(2/3)")).toContain("\\frac{2}{3}");
  });
  test("standalone e^(x) → \\(e^{x}\\)", () => {
    expect(toLatex("e^(x)")).toContain("\\(e^{x}\\)");
  });
  test("3^(x+1) - 2 → 3^{x+1}", () => {
    expect(toLatex("3^(x+1) - 2")).toContain("3^{x+1}");
  });
  test("oracle: (1+x)/(1-x) unchanged", () => {
    expect(toLatex("(1+x)/(1-x)")).toContain("\\(\\dfrac{1+x}{1-x}\\)");
  });
  test("539a837 regression: braced-exponent rational → \\dfrac", () => {
    expect(toLatex("(e^{2x} - e^{-2x})/(e^{2x} + e^{-2x})")).toContain("\\dfrac");
  });
});

describe("toLatex — lim: upright inline lim with tight subscripts (§2.x graph questions)", () => {
  // ISSUE 2 + 3: must emit a SINGLE-backslash \lim (upright, inline) — never
  // "\\lim" (a line break + italic l·i·m).
  const noDoubleLim = (out) => {
    expect(out).toContain("\\lim_{");
    expect(out).not.toMatch(/\\\\lim/); // no double backslash before lim
  };

  test("lim x->2^+ h(x) -> upright inline lim, one-sided superscript", () => {
    const out = toLatex("lim x→2^+ h(x)");
    noDoubleLim(out);
    expect(out).toContain("\\lim_{x\\to2^+}");
  });

  test("lim x->1 [f(x) + g(x)] -> upright inline lim", () => {
    const out = toLatex("lim x→1 [f(x) + g(x)]");
    noDoubleLim(out);
    expect(out).toContain("\\lim_{x\\to1}");
  });

  test("ISSUE 4 — negative target subscript is TIGHT: to-1 (no stray space)", () => {
    const out = toLatex("lim x→-1 (f(x))/(g(x))");
    noDoubleLim(out);
    expect(out).toContain("\\lim_{x\\to-1}");
    expect(out).not.toContain("\\to -1"); // no literal space before the negative
  });

  test("letter target KEEPS a space so to a is not lexed as toa", () => {
    expect(toLatex("lim x→a^- f(x)")).toContain("\\lim_{x\\to a^-}");
  });

  test("ISSUE 3 — limit flows INLINE within a sentence (no line break)", () => {
    const out = toLatex("Determine lim x→2^+ f(x).");
    expect(out).not.toContain("\\\\"); // no LaTeX line break anywhere
    expect(out).toContain("Determine \\(\\lim_{x\\to2^+}\\)");
  });

  // Regressions: OTHER patterns must be byte-for-byte unchanged by the lim edits.
  test("regression: fraction unchanged", () => {
    expect(toLatex("(1)/(2)")).toContain("\\(\\dfrac{1}{2}\\)");
  });
  test("regression: integral unchanged", () => {
    expect(toLatex("integral from 0 to 1 of x^2 dx")).toContain("\\int_{0}^{1} x^{2}\\,dx");
  });
  test("regression: derivative unchanged", () => {
    expect(toLatex("dy/dx")).toContain("\\(\\dfrac{dy}{dx}\\)");
    expect(toLatex("d/dx[x^2]")).toContain("\\dfrac{d}{dx}\\left[x^{2}\\right]");
  });
});

describe("toLatex — audit fixes (repo-wide notation pass)", () => {
  // FIX A: greek word + exponent — the generic exponent pass used to grab the last
  // letter of the spelled-out word ("sigma^2" -> "sigm" + "a^{2}").
  test("greek word + exponent stays a single unit", () => {
    expect(toLatex("sigma^2")).toBe("\\(\\sigma^{2}\\)");
    expect(toLatex("theta^2")).toBe("\\(\\theta^{2}\\)");
    expect(toLatex("lambda^2")).toBe("\\(\\lambda^{2}\\)");
    expect(toLatex("alpha^n")).toBe("\\(\\alpha^{n}\\)");
    expect(toLatex("mu^2")).toBe("\\(\\mu^{2}\\)");
    expect(toLatex("sigma^{2}")).toBe("\\(\\sigma^{2}\\)");
    expect(toLatex("pi^2")).toBe("\\(\\pi^{2}\\)");
    // not split mid-word:
    expect(toLatex("sigma^2")).not.toMatch(/sigm\\\(/);
  });

  // FIX B: parenthesized base + exponent used to leak as a literal caret.
  test("parenthesized base + exponent is wrapped (no literal caret)", () => {
    expect(toLatex("(x+1)^2")).toBe("\\((x+1)^{2}\\)");
    expect(toLatex("(2x-3)^2")).toBe("\\((2x-3)^{2}\\)");
    expect(toLatex("(x-1)^3")).toBe("\\((x-1)^{3}\\)");
    expect(toLatex("(a+b)^n")).toBe("\\((a+b)^{n}\\)");
    expect(toLatex("(x+1)^{10}")).toBe("\\((x+1)^{10}\\)");
  });

  // FIX C: d/dx(...) with a nested-paren operand produced a mismatched \left(\right).
  test("d/dx(...) with nested parens balances delimiters", () => {
    expect(toLatex("d/dx(sin(x))")).toBe("\\(\\dfrac{d}{dx}\\left(\\sin(x)\\right)\\)");
    expect(toLatex("d/dx(e^(x))")).toBe("\\(\\dfrac{d}{dx}\\left(e^{x}\\right)\\)");
    expect(toLatex("d/dx(x^2)")).toBe("\\(\\dfrac{d}{dx}\\left(x^{2}\\right)\\)");
    // no mismatched delimiter:
    expect(toLatex("d/dx(sin(x))")).not.toContain("\\left(\\sin(x\\right)");
  });

  // Regression pins: one per major family — these MUST NOT shift (lib/math serves
  // every course, so the fixes above must be surgical).
  test("PIN: fraction / nested-fraction", () => {
    expect(toLatex("(x+1)/(x-2)")).toBe("\\(\\dfrac{x+1}{x-2}\\)");
    expect(toLatex("(x^2-4)/(x-2)")).toBe("\\(\\dfrac{x^{2}-4}{x-2}\\)");
  });
  test("PIN: integral (definite)", () => {
    expect(toLatex("integral from 0 to 1 of x^2 dx")).toBe("\\(\\int_{0}^{1} x^{2}\\,dx\\)");
  });
  test("PIN: derivatives (dy/dx, second, bracket form)", () => {
    expect(toLatex("dy/dx")).toBe("\\(\\dfrac{dy}{dx}\\)");
    expect(toLatex("d^2y/dx^2")).toBe("\\(\\dfrac{d^{2}y}{dx^{2}}\\)");
    expect(toLatex("d/dx[sin(x)]")).toBe("\\(\\dfrac{d}{dx}\\left[\\sin(x)\\right]\\)");
  });
  test("PIN: Laplace transform", () => {
    expect(toLatex("L{f(t)}")).toBe("\\(\\mathcal{L}\\{f(t)\\}\\)");
    expect(toLatex("L^{-1}{F(s)}")).toBe("\\(\\mathcal{L}^{-1}\\{F(s)\\}\\)");
  });
  test("PIN: inequalities", () => {
    expect(toLatex("x <= 5")).toBe("x \\(\\leq\\) 5");
    expect(toLatex("x != 0")).toBe("x \\(\\neq\\) 0");
  });
  test("PIN: roots, trig powers, exponents, greek, infinity, piecewise, sum", () => {
    expect(toLatex("sqrt(x+1)")).toBe("\\(\\sqrt{x+1}\\)");
    expect(toLatex("sin^2(x)")).toBe("\\(\\sin^{2}(x)\\)");
    expect(toLatex("e^(x)")).toBe("\\(e^{x}\\)");
    expect(toLatex("x^(1/2)")).toBe("\\(x^{\\frac{1}{2}}\\)");
    expect(toLatex("2^x")).toBe("\\(2^{x}\\)");
    expect(toLatex("theta")).toBe("\\(\\theta\\)");
    expect(toLatex("infinity")).toBe("\\(\\infty\\)");
    expect(toLatex("sum from i=1 to n")).toBe("\\(\\sum_{i=1}^{n}\\)");
  });
});
