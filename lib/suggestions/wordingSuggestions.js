// lib/suggestions/wordingSuggestions.js
//
// Wording suggestions for the Exam Generator wizard's "wording" step.
// Pure resolver — no React, no window globals, no module-level Supabase client.
// The caller passes in `bank` (array) and a `supabase` client.
//
// Source priority (deduped across sources, capped at 5):
//   1. template   → findTemplate(course, section): reference_examples[].stem
//                   + concrete quoted phrasings in conditional_quality_blocks
//   2. bank       → bank rows for this exact course+section, distinct stems
//   3. grounding  → section_contexts.question_style + style_rules, concrete
//                   example stems only (placeholder/rule lines skipped)
//
// needsFallback is true when fewer than 3 suggestions were found, so the UI
// can offer the AI "✨ suggest" copy/paste path.

import { findTemplate } from "../templates/registry.js";

const CAP = 5;

// Words that mark a line as an actual question stem (not a rule or heading).
const STEM_HINT =
  /\b(find|explain|write|express|suppose|which|predict|compute|evaluate|describe|identify|determine|sketch|state|calculate|interpret|graph|based on|how|what|consider|given)\b/i;

// Normalize for cross-source dedupe: lowercase, collapse whitespace, drop
// trailing sentence punctuation.
function normalizeKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/, "");
}

// Template-style placeholders (e.g. "[predictor]", "<b₀>", "<response>") mark a
// phrasing as an abstract pattern, not a concrete stem. "<=" / ">=" are NOT
// placeholders (the char after "<"/">" is "=", which the patterns below skip).
function hasPlaceholder(s) {
  return /\[[a-z]/i.test(s) || /<[a-z_]/i.test(s) || /<[bβ][₀₁0-9]/.test(s);
}

function looksLikeStem(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (t.length < 15 || t.length > 320) return false;
  if (!/\s/.test(t)) return false; // must be more than one token
  return t.endsWith("?") || STEM_HINT.test(t);
}

// Pull concrete, quoted example stems out of freeform rule/style text. Quoted
// phrasings in the templates and section_contexts are the section's actual
// example wordings; unquoted prose is rules we skip.
function extractQuotedStems(text) {
  if (!text || typeof text !== "string") return [];
  const out = [];
  const re = /"([^"]{15,320})"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const cand = m[1].trim();
    if (hasPlaceholder(cand)) continue;
    if (looksLikeStem(cand)) out.push(cand);
  }
  return out;
}

// Mirror of _fetchGroundingBlock's read pattern, narrowed to one section and
// only the two columns that carry concrete example wordings.
async function fetchGroundingStems(supabase, course, section) {
  if (!supabase || !course || !section) return [];
  try {
    const { data, error } = await supabase
      .from("section_contexts")
      .select("question_style, style_rules")
      .eq("course", course)
      .eq("section", section);
    if (error) {
      console.error("wordingSuggestions section_contexts fetch error:", error);
      return [];
    }
    if (!Array.isArray(data) || data.length === 0) return [];
    const stems = [];
    for (const r of data) {
      stems.push(...extractQuotedStems(r.question_style || ""));
      stems.push(...extractQuotedStems(r.style_rules || ""));
    }
    return stems;
  } catch (e) {
    console.error("wordingSuggestions section_contexts fetch failed:", e);
    return [];
  }
}

/**
 * Resolve up to 5 concrete wording suggestions for a course+section.
 *
 * @param {string} course
 * @param {string} section  — the full section string (e.g. "1.3 New Functions…")
 * @param {{ bank?: Array, supabase?: object|null }} deps
 * @returns {Promise<{ suggestions: Array<{text:string, source:string}>, needsFallback: boolean }>}
 */
export async function getWordingSuggestions(course, section, { bank = [], supabase = null } = {}) {
  const seen = new Set();
  const suggestions = [];

  const push = (text, source) => {
    if (suggestions.length >= CAP) return;
    if (!text || typeof text !== "string") return;
    const t = text.trim();
    if (!t) return;
    const key = normalizeKey(t);
    if (!key || seen.has(key)) return;
    seen.add(key);
    suggestions.push({ text: t, source });
  };

  if (!course || !section) {
    return { suggestions: [], needsFallback: true };
  }

  // 1. Template — reference_examples + concrete phrasings in quality blocks.
  const template = findTemplate(course, section);
  if (template) {
    const ssr = template.section_specific_rules || {};
    for (const ex of ssr.reference_examples || []) {
      if (ex && typeof ex.stem === "string") push(ex.stem, "template");
    }
    for (const blk of ssr.conditional_quality_blocks || []) {
      for (const s of extractQuotedStems(blk && blk.content)) push(s, "template");
    }
  }

  // 2. Bank — real authored stems for this exact course+section.
  for (const q of bank || []) {
    if (suggestions.length >= CAP) break;
    if (!q || q.course !== course || q.section !== section) continue;
    const stem = String(q.stem || q.question || "").trim();
    if (stem.length >= 12 && stem.length <= 320) push(stem, "bank");
  }

  // 3. Grounding — section_contexts concrete example stems.
  if (suggestions.length < CAP) {
    const gstems = await fetchGroundingStems(supabase, course, section);
    for (const s of gstems) push(s, "grounding");
  }

  const capped = suggestions.slice(0, CAP);
  return { suggestions: capped, needsFallback: capped.length < 3 };
}

/**
 * Build a small prompt asking Claude for concrete example stems for one
 * course+section. Output contract: ONLY a JSON array of strings.
 *
 * @param {string} course
 * @param {string} section
 * @param {string} [groundingBlock] — optional textbook-grounding text to inline
 * @returns {string}
 */
export function buildWordingSuggestionPrompt(course, section, groundingBlock = "") {
  const ground =
    groundingBlock && groundingBlock.trim()
      ? `\n\nUse this section's textbook grounding to match its style and notation:\n${groundingBlock}\n`
      : "";
  return `TESTBANK_WORDING_SUGGESTIONS_REQUEST
Course: ${course}
Section: ${section}

Write 4-5 CONCRETE example exam-question stems (wordings only — no answer choices, no solutions) for the section above. Each stem must:
- be a complete, self-contained question a student could answer
- use specific numbers/functions (concrete — never abstract templates with placeholders)
- match the typical textbook style and difficulty of this section
- use plain-text math notation: sqrt(x), x^2, (a)/(b), pi, theta — never LaTeX commands or Unicode math symbols${ground}

Reply with ONLY a valid JSON array of strings (each string is one question stem), no markdown fences, no preamble, no commentary:
["stem 1", "stem 2", "stem 3", "stem 4"]`;
}

/**
 * Safely parse a pasted JSON array-of-strings. Tolerates surrounding prose and
 * markdown code fences. Returns a string[] (possibly empty) — never throws.
 *
 * @param {string} raw
 * @returns {string[]}
 */
export function parseWordingSuggestions(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    let t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const first = t.indexOf("[");
    const last = t.lastIndexOf("]");
    if (first === -1 || last === -1 || last <= first) return [];
    const arr = JSON.parse(t.slice(first, last + 1));
    if (!Array.isArray(arr)) return [];
    return arr.map(x => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  } catch {
    return [];
  }
}
