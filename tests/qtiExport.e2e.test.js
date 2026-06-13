// End-to-end wiring guard for the equation-image coalescer. The unit tests
// (mathToHTML.test.js) exercise mathToCanvasHTML directly; this one drives the
// REAL buildClassroomSectionsQTI export and inspects the QTI XML it actually
// writes into the package, proving the coalescer survives the full build path
// (exporter → mathToCanvasHTML → toLatexForCanvas → _coalesceCanvasMath).
//
// The emitted XML is captured from what the exporter passes to JSZip.file(),
// NOT from the debug console.log at qti.js:~676 — so this test keeps verifying
// even if that leftover debug log is removed.

// Records every (path, content) the exporter writes into the zip.
const zipEntries = [];

// Stub the browser globals the exporter reaches for. qti.js captures
// `_w = window` at module-eval time, so these MUST be set before require().
const _hadWindow = Object.prototype.hasOwnProperty.call(global, "window");
const _hadDocument = Object.prototype.hasOwnProperty.call(global, "document");
const _prevWindow = global.window;
const _prevDocument = global.document;

global.window = {
  JSZip: function () {
    this.file = (path, content) => { zipEntries.push({ path, content }); };
    this.generateAsync = async () => "FAKE_BLOB";
  },
};
global.document = { createElement: () => ({}), head: { appendChild: () => {} } };

const { buildClassroomSectionsQTI } = require("../lib/exports/qti.js");

afterAll(() => {
  // Restore globals so this file can't leak window/document into other suites.
  if (_hadWindow) global.window = _prevWindow; else delete global.window;
  if (_hadDocument) global.document = _prevDocument; else delete global.document;
});

describe("QTI export wiring — coalescer survives the full buildClassroomSectionsQTI build", () => {
  // Decode a Canvas equation_image src (double URL-encoded) back to raw LaTeX.
  const decodeSrc = (src) => {
    const m = src.match(/\/equation_images\/(.*?)\?scale=1$/);
    return m ? decodeURIComponent(decodeURIComponent(m[1])) : null;
  };

  let report;
  beforeAll(async () => {
    zipEntries.length = 0;
    const versions = [{
      label: "A",
      questions: [
        { type: "Free Response", section: "2.3 Limit Laws",
          question: "Evaluate lim_{x->2} (2x^2-x+1).", answer: "7", explanation: "" },
        { type: "Free Response", section: "1.5 Inverse Functions",
          question: "Find the inverse of f(x) = e^{2x}+3.", answer: "", explanation: "" },
        { type: "Free Response", section: "2.5 Continuity",
          question: "Simplify the rational expression (x+1)/(x^2-1).", answer: "", explanation: "" },
      ],
    }];

    await buildClassroomSectionsQTI({ "1": versions }, "Calculus 1", true, 1, false);

    // Find the assessment QTI XML the exporter wrote into the zip (NOT console.log).
    const qtiEntry = zipEntries.find(e => typeof e.content === "string" && e.content.includes("<questestinterop"));
    if (!qtiEntry) throw new Error("no QTI XML was written to JSZip.file()");
    const xml = qtiEntry.content;

    const items = [...xml.matchAll(/<item ident="[^"]*" title="(Q\d+)">[\s\S]*?<\/item>/g)].map(m => m[0]);
    report = items.map(item => {
      const cdata = (item.match(/<presentation>[\s\S]*?<!\[CDATA\[<p>([\s\S]*?)<\/p>\]\]>/) || [])[1] || "";
      const imgs = [...cdata.matchAll(/<img class="equation_image"[^>]*>/g)].map(m => m[0]);
      return {
        cdata,
        imageCount: imgs.length,
        eqContents: imgs.map(img => (img.match(/data-equation-content="([^"]*)"/) || [])[1]),
        srcs: imgs.map(img => (img.match(/src="([^"]*)"/) || [])[1]),
        decoded: imgs.map(img => decodeSrc((img.match(/src="([^"]*)"/) || [])[1])),
        skeleton: cdata.replace(/<img[^>]*>/g, "⟦IMG⟧"),
      };
    });
  });

  test("captures the QTI XML from the JSZip stub (independent of the debug console.log)", () => {
    const qtiEntry = zipEntries.find(e => typeof e.content === "string" && e.content.includes("<questestinterop"));
    expect(qtiEntry).toBeDefined();
    expect(qtiEntry.path).toMatch(/_questions\.xml$/);
    expect(report).toHaveLength(3);
  });

  // Shared per-stem invariants: one image, valid Canvas src, no orphan math, one prose marker.
  const sharedInvariants = (r) => {
    expect(r.imageCount).toBe(1);
    // src double-encoded (%255C = \, %252B = +) and ?scale=1
    for (const src of r.srcs) {
      expect(src).toMatch(/\?scale=1$/);
      expect(src).toMatch(/%255C|%252B/);
    }
    // no orphan \(...\) delimiters leaked into the stem HTML
    expect(r.cdata).not.toMatch(/\\\(/);
    expect(r.cdata).not.toMatch(/\\\)/);
    // exactly one image marker in the prose skeleton
    expect((r.skeleton.match(/⟦IMG⟧/g) || []).length).toBe(1);
    // no stray single-character equation image
    for (const c of r.eqContents) expect(c.replace(/\\/g, "").length).toBeGreaterThan(2);
  };

  test('limit stem → ONE image "\\lim_{x\\to2} (2x^{2}-x+1)", prose "Evaluate " + period outside', () => {
    const r = report[0];
    sharedInvariants(r);
    expect(r.eqContents[0]).toBe("\\lim_{x\\to2} (2x^{2}-x+1)");
    expect(r.decoded[0]).toBe("\\lim_{x\\to2} (2x^{2}-x+1)");
    expect(r.skeleton).toBe("Evaluate ⟦IMG⟧.");
    // not fragmented into a lone \lim or lone x^{2} image
    expect(r.eqContents).not.toContain("\\lim_{x\\to2}");
    expect(r.eqContents).not.toContain("x^{2}");
  });

  test('inverse stem → ONE image "e^{2x}+3", no detached "+3", no leaked bare "e"', () => {
    const r = report[1];
    sharedInvariants(r);
    expect(r.eqContents[0]).toBe("e^{2x}+3");
    expect(r.decoded[0]).toBe("e^{2x}+3");
    expect(r.skeleton).toBe("Find the inverse of f(x) = ⟦IMG⟧.");
  });

  test('rational stem → ONE image "\\dfrac{x+1}{x^{2}-1}", prose stays text', () => {
    const r = report[2];
    sharedInvariants(r);
    expect(r.eqContents[0]).toBe("\\dfrac{x+1}{x^{2}-1}");
    expect(r.decoded[0]).toBe("\\dfrac{x+1}{x^{2}-1}");
    expect(r.skeleton).toBe("Simplify the rational expression ⟦IMG⟧.");
  });
});
