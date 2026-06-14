import { buildAllVersionsPrompt, buildAllSectionsPrompt } from "../lib/prompts/index.js";
import { expectedVersionKeys } from "../lib/exams/versionMerge.js";

// Off-by-one regression guard: a "3 variants (B, C, D)" selection must emit ALL
// THREE labels in the version list / section keys — never drop the last one. The
// builders take the variant-label array directly, so the count they emit must
// equal the count selected. (The label array itself is VERSIONS.slice(1, 1 +
// versionCount), which yields exactly `versionCount` labels — locked here too.)
const Q = [{ section: "1.4 Exponential Functions", type: "Free Response", question: "f(x) = 2^x" }];

// Pull the comma-separated label list that follows a header on its own line.
const labelsAfter = (prompt, header) => {
  const line = prompt.split("\n").find((l) => l.includes(header)) || "";
  const after = line.split(header)[1] || "";
  // stop at the first " (" (e.g. "(each section also has an anchor A)")
  return after.split(" (")[0].split(",").map((s) => s.trim()).filter(Boolean);
};

describe("buildAllVersionsPrompt — variant count is not dropped", () => {
  test("single-section, 3 variants [B,C,D] → emits all three", () => {
    const p = buildAllVersionsPrompt(Q, "numbers", ["B", "C", "D"], 1, 1, "Calculus 1", {}, null);
    expect(labelsAfter(p, "Versions to create: ")).toEqual(["B", "C", "D"]);
  });

  test("single-section, 2 variants [B,C] → emits exactly B, C", () => {
    const p = buildAllVersionsPrompt(Q, "numbers", ["B", "C"], 1, 1, "Calculus 1", {}, null);
    expect(labelsAfter(p, "Versions to create: ")).toEqual(["B", "C"]);
  });

  test("multi-section (2 sections), 3 variants → version list keeps D and keys include S2_D", () => {
    const p = buildAllVersionsPrompt(Q, "numbers", ["B", "C", "D"], 1, 2, "Calculus 1", {}, null);
    expect(labelsAfter(p, "Versions per section: ")).toEqual(["B", "C", "D"]);
    expect(p).toContain("S2_D");
  });

  test("REGRESSION GUARD: emitted label count === selected variant count (1..5)", () => {
    const ALL = ["B", "C", "D", "E", "F"];
    for (let n = 1; n <= ALL.length; n++) {
      const sel = ALL.slice(0, n);
      const p = buildAllVersionsPrompt(Q, "numbers", sel, 1, 1, "Calculus 1", {}, null);
      expect(labelsAfter(p, "Versions to create: ")).toHaveLength(n);
    }
  });
});

describe("buildAllSectionsPrompt (anchor model) — variant count is not dropped", () => {
  test("2 sections, 3 variants [B,C,D] → per-section variant list keeps D, keys include S2_D", () => {
    const p = buildAllSectionsPrompt(Q, ["B", "C", "D"], 2, "Calculus 1", {}, null);
    expect(labelsAfter(p, "Variant versions per section: ")).toEqual(["B", "C", "D"]);
    expect(p).toContain("S2_D");          // the dropped-last-variant bug would omit this
    expect(p).toContain("S1_D");
  });

  test("2 sections, 2 variants [B,C] → no D anywhere in the keys", () => {
    const p = buildAllSectionsPrompt(Q, ["B", "C"], 2, "Calculus 1", {}, null);
    expect(labelsAfter(p, "Variant versions per section: ")).toEqual(["B", "C"]);
    expect(p).not.toContain("S1_D");
    expect(p).not.toContain("S2_D");
  });

  test("expectedVersionKeys (the merge guard) agrees: 2 sections × [B,C,D] anchorMode includes S2_D", () => {
    const keys = expectedVersionKeys(2, ["B", "C", "D"], { anchorMode: true });
    expect(keys).toEqual(["S1_B", "S1_C", "S1_D", "S2_A", "S2_B", "S2_C", "S2_D"]);
    // each section's variant labels (excluding the anchor A) === the selected 3
    const s2Variants = keys.filter((k) => k.startsWith("S2_") && k !== "S2_A").map((k) => k.slice(3));
    expect(s2Variants).toEqual(["B", "C", "D"]);
  });
});
