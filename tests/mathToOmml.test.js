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
