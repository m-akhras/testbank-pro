const { mathToOmml } = require("../lib/math/omml");

describe("OMML digit-base letter-exponent (parallel to toLatex fix)", () => {
  function hasSSup(out) {
    return out.includes("<m:sSup>");
  }
  function rendersAsSup(out, baseStr, expStr) {
    // Find a m:sSup whose base and sup contain the expected strings.
    // OMML wraps each run in <m:r>, so the structure is <m:e><m:r><m:t>...;
    // use [\s\S]*? (not [^<]*) so the match can span the <m:r> wrapper.
    const re = new RegExp(`<m:sSup><m:e>[\\s\\S]*?<m:t[^>]*>${baseStr}</m:t>[\\s\\S]*?</m:e><m:sup>[\\s\\S]*?<m:t[^>]*>${expStr}</m:t>`);
    return re.test(out);
  }
  test("3^x renders as m:sSup with base 3 and sup x", () => {
    const out = mathToOmml("3^x");
    expect(hasSSup(out)).toBe(true);
    expect(rendersAsSup(out, "3", "x")).toBe(true);
  });
  test("2^x renders as m:sSup", () => {
    const out = mathToOmml("2^x");
    expect(hasSSup(out)).toBe(true);
  });
  test("10^x preserves multi-digit base", () => {
    const out = mathToOmml("10^x");
    expect(hasSSup(out)).toBe(true);
    expect(rendersAsSup(out, "10", "x")).toBe(true);
  });
  test("inline in prose: y = 3^x produces m:sSup", () => {
    const out = mathToOmml("y = 3^x");
    expect(hasSSup(out)).toBe(true);
  });
  test("regression: x^2 still works", () => {
    const out = mathToOmml("x^2");
    expect(hasSSup(out)).toBe(true);
    expect(rendersAsSup(out, "x", "2")).toBe(true);
  });
  test("regression: e^x still works", () => {
    const out = mathToOmml("e^x");
    expect(hasSSup(out)).toBe(true);
  });
  test("regression: 3^(x+1) parenthesized exp still works", () => {
    const out = mathToOmml("h(x) = 3^(x+1) - 2");
    expect(hasSSup(out)).toBe(true);
  });
});

// ── OMML export-pipeline audit fixes (counterpart to the display audit) ──
describe("OMML audit fixes — exact-output", () => {
  const M = (s) => mathToOmml(s);

  // FIX 1: derivatives → real m:f fraction; d/dx(composite) no longer corrupts.
  test("d/dx(sin(x)) — fraction operator + operand preserved (was sin(x)→0)", () => {
    const out = M("d/dx(sin(x))");
    expect(out).toContain("<m:f><m:num><m:r><m:t xml:space=\"preserve\">d</m:t></m:r></m:num><m:den><m:r><m:t xml:space=\"preserve\">dx</m:t></m:r></m:den></m:f>");
    expect(out).toContain("sin(x)");      // operand survived
    expect(out).not.toContain(">0<");      // not the old "dx(0)" corruption
    expect(out).toContain('<m:begChr m:val="("/>');
  });
  test("d/dx[x^2] — bracket operand with inner exponent", () => {
    const out = M("d/dx[x^2]");
    expect(out).toContain("<m:f>");
    expect(out).toContain('<m:begChr m:val="["/>');
    expect(out).toContain("<m:sSup>"); // x^2 inside
  });
  test("dy/dx, d^2y/dx^2, ∂f/∂x render as fractions", () => {
    expect(M("dy/dx")).toContain("<m:num><m:r><m:t xml:space=\"preserve\">dy</m:t></m:r></m:num><m:den><m:r><m:t xml:space=\"preserve\">dx</m:t></m:r></m:den>");
    expect(M("d^2y/dx^2")).toMatch(/<m:f><m:num><m:sSup>.*<\/m:sSup><m:r><m:t[^>]*>y<\/m:t>/);
    expect(M("∂f/∂x")).toContain("<m:num><m:r><m:t xml:space=\"preserve\">∂f</m:t></m:r></m:num><m:den><m:r><m:t xml:space=\"preserve\">∂x</m:t></m:r></m:den>");
  });

  // FIX 2: complete greek words (standalone + exponent).
  test("missing greek words → glyphs (μ ν ξ ω τ), standalone and with exponent", () => {
    expect(M("mu")).toContain(">μ<");
    expect(M("nu")).toContain(">ν<");
    expect(M("xi")).toContain(">ξ<");
    expect(M("omega")).toContain(">ω<");
    // mu^2 must be a single sSup on μ, NOT split into m + u²
    expect(M("mu^2")).toContain("<m:sSup><m:e><m:r><m:t xml:space=\"preserve\">μ</m:t></m:r></m:e><m:sup><m:r><m:t xml:space=\"preserve\">2</m:t></m:r></m:sup></m:sSup>");
    expect(M("mu^2")).not.toContain(">m<");
    expect(M("tau^2")).toContain(">τ<");
  });

  // FIX 3: powered / inverse trig.
  test("sin^2(x) / sin^-1(x) → sSup on the function name", () => {
    expect(M("sin^2(x)")).toContain("<m:sSup><m:e><m:r><m:t xml:space=\"preserve\">sin</m:t></m:r></m:e><m:sup><m:r><m:t xml:space=\"preserve\">2</m:t></m:r></m:sup></m:sSup>");
    expect(M("sin^2(x)")).toContain(">(x)<");
    expect(M("sin^-1(x)")).toContain("<m:sup><m:r><m:t xml:space=\"preserve\">-1</m:t></m:r></m:sup>");
    expect(M("cos^2(theta)")).toContain("(θ)");
  });

  // FIX 4: one-sided limit superscript.
  test("lim x→2^+ / x→2^- → raised + / - in the subscript (not a literal caret)", () => {
    const plus = M("lim x→2^+ f(x)");
    expect(plus).toContain("<m:lim><m:r><m:t xml:space=\"preserve\">x→</m:t></m:r><m:sSup><m:e><m:r><m:t xml:space=\"preserve\">2</m:t></m:r></m:e><m:sup><m:r><m:t xml:space=\"preserve\">+</m:t></m:r></m:sup></m:sSup></m:lim>");
    expect(plus).not.toContain("2^+");
    expect(M("lim x→2^- f(x)")).toContain("<m:sup><m:r><m:t xml:space=\"preserve\">-</m:t></m:r></m:sup>");
    // negative APPROACH (not one-sided) stays a plain value, not a superscript
    expect(M("lim x→-1 f(x)")).toContain("<m:lim><m:r><m:t xml:space=\"preserve\">x→-1</m:t></m:r></m:lim>");
  });

  // FIX 5: parenthesized base + braced exponent.
  test("(x+1)^{10} → sSup (and (x+1)^2 still works)", () => {
    expect(M("(x+1)^{10}")).toContain("<m:sSup><m:e><m:r><m:t xml:space=\"preserve\">(x+1)</m:t></m:r></m:e><m:sup><m:r><m:t xml:space=\"preserve\">10</m:t></m:r></m:sup></m:sSup>");
    expect(M("(x+1)^2")).toContain("<m:sSup><m:e><m:r><m:t xml:space=\"preserve\">(x+1)</m:t></m:r></m:e><m:sup><m:r><m:t xml:space=\"preserve\">2</m:t></m:r></m:sup></m:sSup>");
  });

  // FIX 6: summation / product nary.
  test("sum from i=1 to n [of EXPR] → ∑ nary with limits (+ body)", () => {
    const bare = M("sum from i=1 to n");
    expect(bare).toContain('<m:chr m:val="∑"/>');
    expect(bare).toContain('<m:limLoc m:val="undOvr"/>');
    expect(bare).toContain("<m:sub><m:r><m:t xml:space=\"preserve\">i=1</m:t></m:r></m:sub>");
    expect(bare).toContain("<m:sup><m:r><m:t xml:space=\"preserve\">n</m:t></m:r></m:sup>");
    const withBody = M("sum from i=1 to n of (1)/(n^2)");
    expect(withBody).toMatch(/<m:e><m:f><m:num>.*<\/m:f><\/m:e><\/m:nary>/); // fraction in the body
    expect(M("product from k=1 to n of k")).toContain('<m:chr m:val="∏"/>');
  });
});

// Drift-net: every pattern the audit marked CORRECT, pinned to exact output.
describe("OMML regression pins (audit CORRECT patterns)", () => {
  const M = (s) => mathToOmml(s);
  test("fraction + nested-denominator", () => {
    expect(M("(x+1)/(x-2)")).toBe('<m:oMath><m:f><m:num><m:r><m:t xml:space="preserve">x+1</m:t></m:r></m:num><m:den><m:r><m:t xml:space="preserve">x-2</m:t></m:r></m:den></m:f></m:oMath>');
    expect(M("(1)/((s-3)^2)")).toBe('<m:oMath><m:f><m:num><m:r><m:t xml:space="preserve">1</m:t></m:r></m:num><m:den><m:sSup><m:e><m:r><m:t xml:space="preserve">(s-3)</m:t></m:r></m:e><m:sup><m:r><m:t xml:space="preserve">2</m:t></m:r></m:sup></m:sSup></m:den></m:f></m:oMath>');
  });
  test("exponents: x^2, x^(1/2), 2^x, sigma^2", () => {
    expect(M("x^2")).toBe('<m:oMath><m:sSup><m:e><m:r><m:t xml:space="preserve">x</m:t></m:r></m:e><m:sup><m:r><m:t xml:space="preserve">2</m:t></m:r></m:sup></m:sSup></m:oMath>');
    expect(M("x^(1/2)")).toContain('<m:sup><m:r><m:t xml:space="preserve">1/2</m:t></m:r></m:sup>');
    expect(M("2^x")).toBe('<m:oMath><m:sSup><m:e><m:r><m:t xml:space="preserve">2</m:t></m:r></m:e><m:sup><m:r><m:t xml:space="preserve">x</m:t></m:r></m:sup></m:sSup></m:oMath>');
    expect(M("sigma^2")).toBe('<m:oMath><m:sSup><m:e><m:r><m:t xml:space="preserve">σ</m:t></m:r></m:e><m:sup><m:r><m:t xml:space="preserve">2</m:t></m:r></m:sup></m:sSup></m:oMath>');
  });
  test("sqrt, Laplace, inequalities, greek glyph, infinity, abs", () => {
    expect(M("sqrt(x+1)")).toBe('<m:oMath><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e><m:r><m:t xml:space="preserve">x+1</m:t></m:r></m:e></m:rad></m:oMath>');
    expect(M("L^{-1}{F(s)}")).toContain('<m:sSup><m:e><m:r><m:t xml:space="preserve">L</m:t></m:r></m:e><m:sup><m:r><m:t xml:space="preserve">-1</m:t></m:r></m:sup></m:sSup>');
    expect(M("x <= 5")).toBe('<m:oMath><m:r><m:t xml:space="preserve">x ≤ 5</m:t></m:r></m:oMath>');
    expect(M("x != 0")).toBe('<m:oMath><m:r><m:t xml:space="preserve">x ≠ 0</m:t></m:r></m:oMath>');
    expect(M("theta")).toBe('<m:oMath><m:r><m:t xml:space="preserve">θ</m:t></m:r></m:oMath>');
    expect(M("infinity")).toBe('<m:oMath><m:r><m:t xml:space="preserve">∞</m:t></m:r></m:oMath>');
    expect(M("|x-2|")).toBe('<m:oMath><m:r><m:t xml:space="preserve">|x-2|</m:t></m:r></m:oMath>');
  });
  test("two-sided limit with fraction operand", () => {
    expect(M("lim x→2 (x^2-4)/(x-2)")).toContain('<m:limLow><m:e><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t xml:space="preserve">lim</m:t></m:r></m:e><m:lim><m:r><m:t xml:space="preserve">x→2</m:t></m:r></m:lim></m:limLow>');
  });
});

// ── OMML piecewise big-brace cases (Part A) ──
describe("OMML piecewise cases (m:d + m:eqArr)", () => {
  const M = (s) => mathToOmml(s);
  // tag-balance + escape well-formedness check
  function wf(xml) {
    const st = []; const re = /<(\/?)([a-zA-Z:]+)([^<>]*?)(\/?)>/g; let m, li = 0;
    while ((m = re.exec(xml))) {
      const t = xml.slice(li, m.index);
      if (/&(?!amp;|lt;|gt;|quot;|#\d+;)/.test(t) || /[<>]/.test(t)) return "BAD-ESC";
      li = re.lastIndex; const [, c, n, , sc] = m;
      if (sc) continue;
      if (c) { if (st.pop() !== n) return "UNBAL:" + n; } else st.push(n);
    }
    return st.length ? "UNCLOSED" : "OK";
  }

  test("2-branch → big left brace + eqArr, sSup in a row, ≥ condition glyph", () => {
    const out = M("{ x^2 if x < 0 ; 2x if x >= 0 }");
    expect(wf(out)).toBe("OK");
    expect(out).toContain('<m:begChr m:val="{"/><m:endChr m:val=""/>'); // only a left brace
    expect(out).toContain("<m:eqArr>");
    expect((out.match(/<m:e>/g) || []).length).toBeGreaterThanOrEqual(2); // ≥2 rows
    expect(out).toContain("<m:sSup>");      // x^2 rendered
    expect(out).toContain("x ≥ 0");          // condition glyph
    expect(out).toContain("  if  ");
  });

  test("4-branch well-formed with =, <, >, ≥ conditions", () => {
    const out = M("{ -x if x < 0 ; 0 if x = 0 ; x if x > 0 ; 5 if x >= 10 }");
    expect(wf(out)).toBe("OK");
    expect(out).toContain("<m:eqArr>");
    const rows = (out.match(/  if  /g) || []).length;
    expect(rows).toBe(4);
    expect(out).toContain("x = 0");
    expect(out).toContain("x ≥ 10");
  });

  test("GUARDRAIL: Laplace L{f(t)} / L^{-1}{F(s)} are NOT cases", () => {
    expect(M("L{f(t)}")).not.toContain("<m:eqArr>");
    expect(M("L{f(t)}")).toContain("\\mathcal".length ? "<m:r>" : ""); // still a script run
    expect(M("L^{-1}{F(s)}")).not.toContain("<m:eqArr>");
  });

  test("GUARDRAIL: set-builder / ordinary braces are NOT cases", () => {
    expect(M("{x | x > 0}")).not.toContain("<m:eqArr>");
    expect(M("the set {1, 2, 3}")).not.toContain("<m:eqArr>");
    expect(wf(M("the set {1, 2, 3}"))).toBe("OK");
  });
});

describe("OMML implicit multiplication + degenerate cleanup (QTI audit, FIX B)", () => {
  test("2*x juxtaposes (no middle-dot ·)", () => {
    const out = mathToOmml("2*x");
    expect(out).not.toContain("·");
    expect(out).toContain("2x");
  });
  test("number*number 2*3 KEEPS an explicit middle-dot", () => {
    expect(mathToOmml("2*3")).toContain("·");
  });
  test("unit coefficient 1*y drops the 1 (renders y, no ·)", () => {
    const out = mathToOmml("1*y");
    expect(out).not.toContain("·");
    expect(out).toContain("y");
  });
  test("z^1 drops the exponent (no superscript 1)", () => {
    const out = mathToOmml("z^1");
    expect(out).not.toContain("<m:sSup>");
    expect(out).toContain("z");
  });
});
