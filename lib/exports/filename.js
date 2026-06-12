// Descriptive, Windows-safe export filenames (QTI audit FIX C). Replaces the ad-hoc
// generic names ("AllVersions_Grouped.docx", "Version_A_Canvas_QTI.zip") with a
// uniform, self-describing pattern across EVERY export button:
//
//   {course}_{examName}_{scope}_{date}.{ext}
//
//   examName = the saved exam name when one exists (sanitized), else the master's
//              section range (e.g. "Ch1.4-2.5"); scope = "S3" / "AllSections" /
//              "Compare" / "Merged" / "VA" per export mode; date = YYYY-MM-DD.
//
//   "Calculus-1_Midterm-1_S2_2026-06-12.zip"
//   "Calculus-1_Ch1.4-2.5_AllSections-Word_2026-06-12.docx"

// Windows-reserved characters + control chars — never allowed in a filename.
// Spaces are NOT stripped here; they become "-" in sanitizeFilenamePart.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g;

// Sanitize ONE filename token: drop illegal chars, spaces/underscores → "-",
// collapse repeats, trim leading/trailing "-", cap length. Returns "" for
// empty/garbage so callers can fall back to the next choice.
export function sanitizeFilenamePart(raw, maxLen = 60) {
  let s = String(raw ?? "").replace(ILLEGAL, "").trim();
  s = s.replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+$/, "");
  return s;
}

// "1.4 Exponential Functions" → "1.4"; bare "2" → "2"; "" otherwise.
function sectionNum(section) {
  const m = String(section ?? "").match(/\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}

// Master section range across a question set → "Ch1.4-2.5" (or "Ch1.4" when the
// whole exam sits in one section). "" when no sections are present.
export function sectionRangeLabel(questions) {
  const nums = (Array.isArray(questions) ? questions : [])
    .map(q => sectionNum(q && q.section)).filter(Boolean);
  if (!nums.length) return "";
  const sorted = [...new Set(nums)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  return lo === hi ? `Ch${lo}` : `Ch${lo}-${hi}`;
}

function ymd(date) {
  const d = (date instanceof Date && !isNaN(date)) ? date : new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function buildExportFilename({ course, examName, questions, scope, ext = "zip", date } = {}) {
  const parts = [];
  const c = sanitizeFilenamePart(course);
  if (c) parts.push(c);
  // examName wins; otherwise the master's section range; otherwise nothing.
  const name = sanitizeFilenamePart(examName) || sanitizeFilenamePart(sectionRangeLabel(questions));
  if (name) parts.push(name);
  const sc = sanitizeFilenamePart(scope);
  if (sc) parts.push(sc);
  parts.push(ymd(date));
  const base = parts.join("_") || "Export";
  const cleanExt = String(ext ?? "").replace(/^\./, "").replace(ILLEGAL, "") || "dat";
  return `${base}.${cleanExt}`;
}
