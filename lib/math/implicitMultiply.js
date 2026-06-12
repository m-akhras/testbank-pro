// Implicit-multiplication + degenerate-form cleanup for DISPLAYED math (QTI audit).
//
// The model emits "* noise" the decoded LaTeX/OMML exposes: "2\cdot x", "1\cdot y",
// "x^{1}", "z^{1}". This pass runs on the raw mini-syntax BEFORE the structural
// LaTeX/OMML transforms, while operands are still simple tokens, and rewrites:
//
//   - exponent ^1 / ^{1}  → dropped entirely        (z^1 → z, x^{1} → x; ^10/^1.5 kept)
//   - unit coefficient 1*  → dropped before var/fn/( (1*y → y, -1*y → -y, x+1*y → x+y)
//   - implicit multiplication: "*" between a value and a following variable / "(" / "["
//     is REMOVED so it renders juxtaposed (2*x → 2x, x*y → xy, 2.5*x → 2.5x,
//     2*(x+1) → 2(x+1), 3*ln(x) → 3ln(x)).
//   - "*" between two NUMERIC literals is KEPT (2*3) — juxtaposing them would change
//     the value's meaning, so downstream renders it as an explicit dot/× glyph.
//
// AMBIGUITY GUARD: a LETTER followed by a multi-letter token ("a*ln", "a*xy") keeps
// its "*", because juxtaposition ("aln") is indistinguishable from a single
// identifier and would also break function-name detection. Only NUMBER*function
// (3*ln) is juxtaposed — the downstream fn passes detect a function after a digit.
export function simplifyImplicitMultiplication(input) {
  let e = String(input ?? "");
  // ^1 and ^{1} → drop (but never ^10, ^1.5, ^{12})
  e = e.replace(/\^\{1\}/g, "").replace(/\^1(?![0-9.])/g, "");
  // unit coefficient: <start|operator> 1 * <var|fn|(> → drop the "1*". Fixed point
  // for chains like "1*1*y". The boundary class excludes a leading digit so "21*y"
  // (twenty-one) is never mistaken for a unit coefficient.
  let prev;
  do {
    prev = e;
    e = e.replace(/(^|[-+*/(=,\s])1\s*\*\s*(?=[a-zA-Z(])/g, "$1");
  } while (e !== prev);
  // (1) value * "(" or "["  → juxtapose:  2*(x+1) → 2(x+1), x*(y-1) → x(y-1)
  e = e.replace(/([0-9.)\]}a-zA-Z])\s*\*\s*(?=[(\[])/g, "$1");
  // (2) value * lone variable (single letter NOT followed by another letter) → juxtapose
  e = e.replace(/([0-9.)\]}a-zA-Z])\s*\*\s*(?=[a-zA-Z](?![a-zA-Z]))/g, "$1");
  // (3) NUMBER / ) / ] * multi-letter token (function name or product) → juxtapose.
  //     A LETTER left side is intentionally excluded (keeps "a*ln" disambiguated).
  e = e.replace(/([0-9.)\]}])\s*\*\s*(?=[a-zA-Z]{2,})/g, "$1");
  return e;
}
