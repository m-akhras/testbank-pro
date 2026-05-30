const { _segmentProseMath, _emitSegmentedParagraph } = require("../lib/exports/docx");

// Count occurrences of a literal substring.
function count(haystack, needle) {
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

// Assert open/close tag counts match for a set of (non-self-closing) tag names.
// Open tags may carry attributes, so "<w:p>" and "<w:p ..." both count.
function assertBalanced(xml, tags) {
  for (const tag of tags) {
    const opens = (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, "g")) || []).length;
    const closes = (xml.match(new RegExp(`</${tag}>`, "g")) || []).length;
    expect(`${tag}:${opens}`).toBe(`${tag}:${closes}`);
  }
}

const STEM =
  "Let f(x) = \\frac{e^{x} - e^{-x}}{e^{x} + e^{-x}}. Find f^{-1}(x) for -1 < x < 1";

describe("_emitSegmentedParagraph — prose/math stem segmentation", () => {
  test("1. mixed stem: one <w:p>, prose words in text runs, single intact fraction", () => {
    const out = _emitSegmentedParagraph(STEM, "");

    // Exactly one paragraph.
    expect(count(out, "<w:p>")).toBe(1);
    expect(count(out, "</w:p>")).toBe(1);

    // Each prose word lives inside a <w:t> text run.
    for (const word of ["Let", "Find", "for"]) {
      const re = new RegExp(`<w:t[^>]*>[^<]*${word}[^<]*</w:t>`);
      expect(re.test(out)).toBe(true);
    }

    // The fraction renders exactly once...
    expect(count(out, "<m:f>")).toBe(1);
    // ...and is NOT split across two oMath blocks: between the opening <m:f>
    // and its closing </m:f> there is no oMath boundary.
    const start = out.indexOf("<m:f>");
    const end = out.indexOf("</m:f>") + "</m:f>".length;
    const fracXml = out.slice(start, end);
    expect(fracXml.includes("</m:oMath>")).toBe(false);
    expect(fracXml.includes("<m:oMath>")).toBe(false);

    assertBalanced(out, ["w:p", "w:r", "w:t", "m:oMath", "m:f", "m:r", "m:t"]);
  });

  test("2. pure-math choice \\frac{1}{2}: no prose runs, fraction intact in one oMath", () => {
    const out = _emitSegmentedParagraph("\\frac{1}{2}", "");

    // No prose text runs at all (math uses <m:t>, not <w:t>).
    expect(out.includes("<w:t")).toBe(false);

    expect(count(out, "<m:oMath>")).toBe(1);
    expect(count(out, "<m:f>")).toBe(1);

    assertBalanced(out, ["w:p", "m:oMath", "m:f", "m:r", "m:t"]);
  });

  test("3. x^2 is never prose — renders as <m:sSup>, not literal text", () => {
    const segs = _segmentProseMath("x^2");
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("math");

    const out = _emitSegmentedParagraph("x^2", "");
    expect(out.includes("<m:sSup>")).toBe(true);
    // Not emitted as a literal "x^2" prose run.
    expect(/<w:t[^>]*>[^<]*x\^2[^<]*<\/w:t>/.test(out)).toBe(false);

    assertBalanced(out, ["w:p", "m:oMath", "m:sSup", "m:r", "m:t"]);
  });

  test("4. classification: prose words vs math tokens", () => {
    const segs = _segmentProseMath(STEM);
    // Alternating prose/math islands; first segment is the prose "Let ".
    expect(segs[0].type).toBe("prose");
    expect(segs[0].text.startsWith("Let")).toBe(true);
    // The fraction stays in a single math segment (one <m:f> after rendering).
    const mathSegs = segs.filter((s) => s.type === "math");
    const fracSeg = mathSegs.find((s) => s.text.includes("\\frac"));
    expect(fracSeg).toBeDefined();
    expect(count(fracSeg.text, "\\frac")).toBe(1);
  });
});

describe("_segmentProseMath — sentence-final punctuation peeling (decimal-safe)", () => {
  test("1. trailing period after math ends up in a prose <w:t>, not <m:oMath>", () => {
    const text = "Find f^{-1}(x).";
    const segs = _segmentProseMath(text);
    // No math segment retains a trailing period.
    for (const s of segs.filter((x) => x.type === "math")) {
      expect(/[.,;:?!]$/.test(s.text)).toBe(false);
    }
    // A prose segment carries the period.
    expect(segs.some((s) => s.type === "prose" && s.text.includes("."))).toBe(true);

    const out = _emitSegmentedParagraph(text, "");
    // The period is inside a <w:t> run...
    expect(/<w:t[^>]*>[^<]*\.[^<]*<\/w:t>/.test(out)).toBe(true);
    // ...and the math (m:sSub for the inverse) carries no literal period text.
    const mStart = out.indexOf("<m:oMath>");
    const mEnd = out.lastIndexOf("</m:oMath>") + "</m:oMath>".length;
    const mathXml = out.slice(mStart, mEnd);
    expect(/<m:t[^>]*>[^<]*\.[^<]*<\/m:t>/.test(mathXml)).toBe(false);
  });

  test("2. decimal 3.14 stays intact inside one math segment / one <m:oMath>", () => {
    const text = "Use 3.14 for pi.";
    const segs = _segmentProseMath(text);
    const numSeg = segs.find((s) => s.type === "math" && s.text.includes("3.14"));
    expect(numSeg).toBeDefined();
    // 3 and 14 not separated, decimal point preserved.
    expect(numSeg.text.includes("3.14")).toBe(true);

    const out = _emitSegmentedParagraph(text, "");
    // "3.14" survives as a contiguous string somewhere in the output.
    expect(out.includes("3.14") || /3<[^>]*>?\.?<?[^>]*>?14/.test(out)).toBe(true);
    // No prose <w:t> run splits the number into "3." + "14".
    expect(/<w:t[^>]*>[^<]*3\.<\/w:t>/.test(out)).toBe(false);
  });

  test("3. P(X < 0.5) — decimal intact and closing ) is NOT peeled (stays math)", () => {
    const text = "P(X < 0.5)";
    const segs = _segmentProseMath(text);
    const mathSegs = segs.filter((s) => s.type === "math");
    // Everything is one math island ending in ")".
    expect(mathSegs.length).toBe(1);
    expect(mathSegs[0].text.endsWith(")")).toBe(true);
    expect(mathSegs[0].text.includes("0.5")).toBe(true);
    // No prose segment was created for ")".
    expect(segs.some((s) => s.type === "prose" && s.text.trim() === ")")).toBe(false);
  });

  test("4. regression: tanh stem still one <w:p>, intact fraction, prose words", () => {
    const out = _emitSegmentedParagraph(STEM, "");
    expect(count(out, "<w:p>")).toBe(1);
    expect(count(out, "</w:p>")).toBe(1);
    expect(count(out, "<m:f>")).toBe(1);
    const start = out.indexOf("<m:f>");
    const end = out.indexOf("</m:f>") + "</m:f>".length;
    const fracXml = out.slice(start, end);
    expect(fracXml.includes("<m:oMath>")).toBe(false);
    expect(fracXml.includes("</m:oMath>")).toBe(false);
    for (const word of ["Let", "Find", "for"]) {
      expect(new RegExp(`<w:t[^>]*>[^<]*${word}[^<]*</w:t>`).test(out)).toBe(true);
    }
  });
});
