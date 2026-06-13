import { buildExportFilename, sanitizeFilenamePart, sectionRangeLabel } from "../lib/exports/filename.js";

// QTI audit FIX C — descriptive, Windows-safe export filenames.
//   {course}_{examName|sectionRange}_{scope}_{YYYY-MM-DD}.{ext}
const D = new Date(2026, 5, 12); // 2026-06-12 (month is 0-based)
const calc1 = [
  { section: "1.4 Exponential Functions" },
  { section: "2.2 The Limit of a Function" },
  { section: "2.5 Continuity" },
];

describe("buildExportFilename", () => {
  test("named exam → course_examName_scope_date", () => {
    const f = buildExportFilename({ course: "Calculus 1", examName: "Midterm 1", scope: "S2", ext: "zip", date: D });
    expect(f).toBe("Calculus-1_Midterm-1_S2_2026-06-12.zip");
  });

  test("unnamed master → falls back to the section range (Ch1.4-2.5)", () => {
    const f = buildExportFilename({ course: "Calculus 1", examName: "", questions: calc1, scope: "AllSections-Word", ext: "docx", date: D });
    expect(f).toBe("Calculus-1_Ch1.4-2.5_AllSections-Word_2026-06-12.docx");
  });

  test("per-section scope carries its own section", () => {
    const f = buildExportFilename({ course: "Calculus 1", examName: "Final", scope: "S3", ext: "zip", date: D });
    expect(f).toBe("Calculus-1_Final_S3_2026-06-12.zip");
  });

  test("illegal Windows characters are stripped, spaces → '-'", () => {
    const f = buildExportFilename({ course: "Calculus 1", examName: 'Quiz: A/B \\ "draft" <2>?*|', scope: "Merged", ext: "zip", date: D });
    expect(f).not.toMatch(/[<>:"/\\|?*]/);
    // : / \ " < > ? * | all removed; spaces collapsed to single "-"
    expect(f).toBe("Calculus-1_Quiz-AB-draft-2_Merged_2026-06-12.zip");
  });

  test("single-section exam → Ch1.4 (no range)", () => {
    const f = buildExportFilename({ course: "Calculus 1", examName: "", questions: [{ section: "1.4 Exp" }], scope: "VA", ext: "docx", date: D });
    expect(f).toBe("Calculus-1_Ch1.4_VA_2026-06-12.docx");
  });

  test("everything empty still yields a safe dated name", () => {
    expect(buildExportFilename({ course: "", examName: "", questions: [], scope: "", ext: "zip", date: D })).toBe("2026-06-12.zip");
  });

  test("over-long exam name is capped (~60 chars)", () => {
    const long = "A".repeat(120);
    const f = buildExportFilename({ course: "C", examName: long, scope: "S1", ext: "zip", date: D });
    const namePart = f.split("_")[1];
    expect(namePart.length).toBeLessThanOrEqual(60);
  });
});

describe("sanitizeFilenamePart / sectionRangeLabel", () => {
  test("spaces and underscores → single '-'; trims edges", () => {
    expect(sanitizeFilenamePart("  Mid term__1  ")).toBe("Mid-term-1");
  });
  test("strips reserved chars but keeps dots and #", () => {
    expect(sanitizeFilenamePart("Ch1.4-2.5")).toBe("Ch1.4-2.5");
    expect(sanitizeFilenamePart("Exam#2:final")).toBe("Exam#2final");
  });
  test("section range across a question set", () => {
    expect(sectionRangeLabel(calc1)).toBe("Ch1.4-2.5");
    expect(sectionRangeLabel([{ section: "3.1 x" }])).toBe("Ch3.1");
    expect(sectionRangeLabel([])).toBe("");
  });

  test("strips LEADING/TRAILING dots and spaces but keeps internal dots (Windows-safe)", () => {
    expect(sanitizeFilenamePart("Final.")).toBe("Final");        // trailing dot gone
    expect(sanitizeFilenamePart(".hidden")).toBe("hidden");      // leading dot gone
    expect(sanitizeFilenamePart("Exam 2. ")).toBe("Exam-2");     // trailing ". " gone
    expect(sanitizeFilenamePart("Ch1.4-2.5")).toBe("Ch1.4-2.5"); // internal dots kept
    // no token ever ends in a dot or space
    for (const raw of ["Final.", "ws ", "a..", "..", "name. "]) {
      const out = sanitizeFilenamePart(raw);
      expect(out).not.toMatch(/[. ]$/);
    }
  });

  test("a name capped at the length limit never ends in a dot or dash", () => {
    const f = buildExportFilename({ course: "C", examName: "A.".repeat(50), scope: "S1", ext: "zip", date: D });
    const namePart = f.split("_")[1];
    expect(namePart.length).toBeLessThanOrEqual(60);
    expect(namePart).not.toMatch(/[-.]$/);
  });
});
