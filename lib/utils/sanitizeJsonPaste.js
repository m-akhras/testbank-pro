/**
 * Sanitize AI-generated JSON before JSON.parse.
 *
 * AI sometimes emits raw newlines / tabs / carriage returns inside string
 * literals (multi-line explanations, multi-line LaTeX), which JSON.parse
 * rejects with "Bad control character in string literal." This walks the
 * input character by character, tracks whether we're inside a "string",
 * and escapes any raw control chars found inside strings.
 *
 * Also strips:
 *   - markdown code fences (```json ... ```)
 *   - leading/trailing whitespace
 *   - leading/trailing non-JSON text (anything before the first [ or {
 *     and anything after the matching last ] or })
 */
export function sanitizeJsonPaste(raw) {
  if (typeof raw !== "string") return raw;

  let s = raw.trim();

  // Strip markdown code fences (anywhere — opening / closing).
  s = s.replace(/^```(?:json|JSON)?\s*/m, "").replace(/\s*```\s*$/m, "");

  // Trim to first [ or { — drops any preamble like "Here is the JSON:".
  const firstBracketCandidates = [s.indexOf("["), s.indexOf("{")].filter(i => i >= 0);
  if (firstBracketCandidates.length > 0) {
    const firstBracket = Math.min(...firstBracketCandidates);
    if (firstBracket > 0) s = s.slice(firstBracket);
  }
  // Trim trailing postamble after the last ] or }.
  const lastBracket = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (lastBracket >= 0 && lastBracket < s.length - 1) {
    s = s.slice(0, lastBracket + 1);
  }

  // Walk the string. Track whether we're inside a "string" literal and
  // whether the previous char was a backslash (escape state). Any raw
  // control char inside a string gets converted to its \-escape form;
  // other sub-0x20 chars inside strings get dropped (invisible noise).
  let result = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) continue; // drop other invisibles
    }
    result += ch;
  }

  return result;
}

/**
 * Best-effort detection of a truncated JSON response — when the API hits
 * its token cap mid-stream, the input ends mid-string or mid-bracket.
 * Returns true if the brackets are unbalanced or the last "string ends
 * without a closing quote.
 */
export function looksTruncated(raw) {
  if (typeof raw !== "string" || !raw.length) return false;
  let depthBracket = 0; // []
  let depthBrace   = 0; // {}
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"')  { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "[") depthBracket++;
    else if (ch === "]") depthBracket--;
    else if (ch === "{") depthBrace++;
    else if (ch === "}") depthBrace--;
  }
  return inString || depthBracket !== 0 || depthBrace !== 0;
}

/**
 * Parse AI-generated JSON with sanitization first; surface a useful
 * error if it still fails. Distinguishes truncated payloads from
 * genuine syntax errors so the caller can show the right message.
 */
export function parseAiJson(raw) {
  const cleaned = sanitizeJsonPaste(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    if (err instanceof SyntaxError) {
      if (looksTruncated(cleaned)) {
        throw new Error("Response was cut off mid-stream (truncated JSON). Try regenerating with fewer questions or a higher token limit.");
      }
      throw new Error(`JSON parse error: ${err.message}. Try regenerating, or paste the response into a JSON validator to find the issue.`);
    }
    throw err;
  }
}
