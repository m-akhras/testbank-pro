// lib/templates/_generic/notationRules.js
//
// Generic math notation rules applied to every section's generation prompt.
// The textbook reference line is interpolated from template.textbook
// (every template declares one). Section-specific extra rules (e.g.
// "linear must have non-zero slope") are appended at the end via
// section_specific_rules.notation_additions.
//
// Convention: mini-syntax (sqrt(x), (a)/(b), x^2, theta) — NEVER LaTeX backslash commands.
// The downstream renderer (KaTeX layer in TestBankApp.js) and the Word OMML
// exporter both depend on this convention. Changes here propagate to every
// course and every section.

const NOTATION_BODY = `- Functions: f, g, h (default), or context-appropriate names for applied problems
- Variables: x (default), t for time, r for radius, etc.
- Exponents: x^2, x^3, (x-3)^2 — never x² or x³
- Fractions: ALWAYS (numerator)/(denominator) — e.g. (x+1)/(x-3) — never use square brackets or LaTeX
- Square roots: sqrt(x) — never use √, never use \\\\sqrt{}
- Cube roots: cbrt(x) — never use ∛, never use \\\\cbrt{}
- Greek letters: alpha, beta, theta, pi, sigma — never use α β θ π σ
- Comparison: <=, >=, != — never use ≤ ≥ ≠
- Multiplication: * — never use · or ×
- Infinity: infinity — never use ∞
- Absolute value: |x|
- Domain in interval notation: [a, b], (a, b], (-infinity, a), (-infinity, a) U (a, infinity)
- NEVER emit raw LaTeX commands like \\\\dfrac{}{}, \\\\sqrt{}, \\\\int_{}^{} — the renderer expects mini-syntax`;

/**
 * Build the full notation block for a prompt.
 *
 * Layout (matches original buildTemplatePrompt.js):
 *   NOTATION (mini-syntax, NOT LaTeX backslash commands):
 *   - Use ${textbook} notation throughout        ← interpolated from template
 *   - Functions: f, g, h ...                     ← generic body
 *   - Variables: ...
 *   ... (all generic notation rules)
 *   - NEVER emit raw LaTeX commands ...
 *   - <section_specific_rule_1>                  ← from notation_additions
 *   - <section_specific_rule_2>
 *
 * @param {string} textbook - The template.textbook string.
 * @param {string[]} additions - Lines from section_specific_rules.notation_additions.
 * @returns {string} The full notation block ready to interpolate.
 */
export function buildNotationBlock(textbook, additions = []) {
  if (!textbook) {
    throw new Error("buildNotationBlock: textbook is required");
  }
  const textbookLine = `- Use ${textbook} notation throughout`;
  const additionLines = Array.isArray(additions) && additions.length > 0
    ? "\n" + additions.map(line => `- ${line.replace(/^-\s*/, "")}`).join("\n")
    : "";
  return `NOTATION (mini-syntax, NOT LaTeX backslash commands):\n${textbookLine}\n${NOTATION_BODY}${additionLines}`;
}
