// §2.6 limits at infinity — slices 1 (rational) + 1b (algebraic_root).
//
// PURE + deterministic: no DOM, no rendering, no LLM, no I/O. Given a declared
// spec for a function, it derives the end behavior — the limits as x -> +infinity
// and x -> -infinity — and the resulting horizontal asymptotes. The answer key is
// DERIVED here, never trusted from the model (mirrors deriveLimits / combineLimits).
//
// Handled kinds:
//   'rational'        — slice 1  (degree comparison)
//   'algebraic_root'  — slice 1b (root_minus_linear / root_over_linear)
//   'special'         — slice 2  (exp / exp_neg / arctan / logistic / recip_power)
// Any unknown / malformed spec fails closed to all-unsupported.
//
// VALUE TYPE — a limit value is exactly one of:
//   { kind:'finite', num:<int>, den:<int> }  den>0, reduced (gcd(|num|,den)=1)
//   { kind:'finiteSym', token:<string>, approx:<number> }  exact symbolic constant
//   { kind:'pinf' }         // +infinity
//   { kind:'ninf' }         // -infinity
//   { kind:'dne'  }         // no limit (finite or infinite)
//   { kind:'unsupported' }  // spec outside the handled forms — fail closed
//
// finiteSym is a FINITE value that is an exact symbolic constant (e.g. pi/2), not
// expressible as a reduced rational. Its `approx` is used ONLY for ordering and
// dedup — never for display. This slice defines exactly two tokens; add no others.
// finiteSym is confined to THIS module: deriveLimits / combineLimits value types
// are deliberately untouched.

// ── value constructors ───────────────────────────────────────────────────────
export const PINF = Object.freeze({ kind: "pinf" });
export const NINF = Object.freeze({ kind: "ninf" });
export const DNE = Object.freeze({ kind: "dne" });
export const UNSUPPORTED = Object.freeze({ kind: "unsupported" });

// Symbolic finite constants (slice 2 — special family). Frozen so tests can import
// the identical objects the engine emits and compare by reference / toEqual.
export const PI_OVER_2 = Object.freeze({ kind: "finiteSym", token: "pi_over_2", approx: Math.PI / 2 });
export const NEG_PI_OVER_2 = Object.freeze({ kind: "finiteSym", token: "neg_pi_over_2", approx: -Math.PI / 2 });

// Euclid's gcd on the magnitudes; gcd(0,0)=0, gcd(k,0)=|k|.
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Build a reduced finite value n/d: den>0, common factor divided out, integer k
// stored as {num:k, den:1}, zero normalized to {num:0, den:1}. Throws on d===0
// (a zero denominator is never a finite limit and must be handled before here).
export function reduced(n, d) {
  if (d === 0) throw new Error("reduced: denominator must be non-zero");
  if (n === 0) return { kind: "finite", num: 0, den: 1 };
  // Move any sign onto the numerator so den>0.
  let num = n;
  let den = d;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || 1;
  return { kind: "finite", num: num / g, den: den / g };
}

// Equality for dedup. Two finite values match when their reduced (num, den) match;
// two finiteSym values match when they share a token. Cross-kind (finite vs
// finiteSym) and any non-finite operand are never "equal".
export function valuesEqual(a, b) {
  if (!a || !b) return false;
  if (a.kind === "finite" && b.kind === "finite") {
    return a.num === b.num && a.den === b.den;
  }
  if (a.kind === "finiteSym" && b.kind === "finiteSym") {
    return a.token === b.token;
  }
  return false;
}

const ALL_UNSUPPORTED = {
  plus: UNSUPPORTED,
  minus: UNSUPPORTED,
  horizontalAsymptotes: [],
};
const allUnsupported = () => ({
  plus: UNSUPPORTED,
  minus: UNSUPPORTED,
  horizontalAsymptotes: [],
});

// Drop leading-zero coefficients (highest-degree-first arrays). Returns null when
// the array is empty or identically zero — i.e. there is no true polynomial here.
function stripLeadingZeros(coeffs) {
  if (!Array.isArray(coeffs)) return null;
  let i = 0;
  while (i < coeffs.length && coeffs[i] === 0) i++;
  if (i >= coeffs.length) return null; // empty or all-zero
  return coeffs.slice(i);
}

// Every integer? (coefficients must be plain integers for this slice.)
function allIntegers(coeffs) {
  return Array.isArray(coeffs) && coeffs.every((c) => Number.isInteger(c));
}

// Every listed field on `spec` is a present integer (missing => undefined => false).
function intFieldsPresent(spec, keys) {
  return keys.every((k) => Number.isInteger(spec[k]));
}

// The positive-integer square root of `a`, or null when `a` is not a positive
// perfect square (a <= 0, non-integer, or sqrt not an integer).
function perfectSqrt(a) {
  if (!Number.isInteger(a) || a <= 0) return null;
  const r = Math.sqrt(a);
  return Number.isInteger(r) ? r : null;
}

// Numeric ordering key for a finite-valued limit (finite -> num/den, finiteSym ->
// approx). Only ever called on finite / finiteSym values.
function numericKey(v) {
  return v.kind === "finiteSym" ? v.approx : v.num / v.den;
}

// The distinct finite values (rational AND symbolic) among {plus, minus}, deduped
// via valuesEqual and sorted ascending by numeric key. pinf/ninf/dne/unsupported
// contribute nothing.
function horizontalAsymptotesFrom(plus, minus) {
  const finites = [plus, minus].filter(
    (v) => v && (v.kind === "finite" || v.kind === "finiteSym")
  );
  const distinct = [];
  finites.forEach((v) => {
    if (!distinct.some((d) => valuesEqual(d, v))) distinct.push(v);
  });
  distinct.sort((a, b) => numericKey(a) - numericKey(b));
  return distinct;
}

// ── rational derivation (slice 1) ────────────────────────────────────────────
function deriveRational(spec) {
  const numStripped = stripLeadingZeros(spec.num);
  const denStripped = stripLeadingZeros(spec.den);
  if (
    !numStripped || !denStripped ||
    !allIntegers(numStripped) || !allIntegers(denStripped)
  ) {
    return allUnsupported();
  }

  const m = numStripped.length - 1; // numerator degree
  const n = denStripped.length - 1; // denominator degree
  const a = numStripped[0]; // numerator leading coefficient
  const b = denStripped[0]; // denominator leading coefficient

  // m < n: ratio -> 0 at both ends; single HA y = 0.
  if (m < n) {
    const zero = reduced(0, 1);
    return { plus: zero, minus: reduced(0, 1), horizontalAsymptotes: [reduced(0, 1)] };
  }

  // m == n: ratio -> a/b at both ends; single HA y = a/b.
  if (m === n) {
    return {
      plus: reduced(a, b),
      minus: reduced(a, b),
      horizontalAsymptotes: [reduced(a, b)],
    };
  }

  // m > n: unbounded — no finite HA. Signs by leading-coeff ratio and parity.
  const ratioSign = Math.sign(a) * Math.sign(b); // sign of a/b (a,b nonzero)
  const plus = ratioSign > 0 ? PINF : NINF;
  const parity = (m - n) % 2 === 0 ? 1 : -1;
  const s = ratioSign * parity;
  const minus = s > 0 ? PINF : NINF;
  return { plus, minus, horizontalAsymptotes: [] };
}

// ── algebraic_root derivation (slice 1b) ─────────────────────────────────────
// Let r = sqrt(a). SHARED PRECONDITION (else all-unsupported): a and every
// coefficient are integers, and a is a positive perfect square so r is a positive
// integer. Each form then has its own closed-form end behavior.

// sqrt(a x^2 + b x + c) - (p x + q).
// As x -> +inf the curve approaches the slant line p x + q from the root; the
// residual is finite only when p matches the root's slope r (then it is
// (b - 2 p q)/(2 r)); a steeper/shallower p sends it to ∓inf. The x -> -inf branch
// mirrors this with slope -r (the root behaves like |x|·r = -r·x there).
function deriveRootMinusLinear(spec) {
  if (!intFieldsPresent(spec, ["a", "b", "c", "p", "q"])) return allUnsupported();
  const r = perfectSqrt(spec.a);
  if (r === null) return allUnsupported();

  const { b, p, q } = spec;
  const base = b - 2 * p * q; // c never affects the result

  let plus;
  if (p === r) plus = reduced(base, 2 * r);
  else plus = p < r ? PINF : NINF;

  let minus;
  if (p === -r) minus = reduced(-base, 2 * r);
  else minus = p > -r ? PINF : NINF;

  return { plus, minus, horizontalAsymptotes: horizontalAsymptotesFrom(plus, minus) };
}

// sqrt(a x^2 + b x + c) / (d x + e), d !== 0.
// For large |x|, sqrt(a x^2 + ...) ~ r·|x|, so the ratio -> r/d as x -> +inf and
// -r/d as x -> -inf (the |x| flips sign). b, c, e do not affect the leading
// behavior; the two ends are always distinct finite values.
function deriveRootOverLinear(spec) {
  if (!intFieldsPresent(spec, ["a", "b", "c", "d", "e"])) return allUnsupported();
  const r = perfectSqrt(spec.a);
  if (r === null) return allUnsupported();
  if (spec.d === 0) return allUnsupported();

  const plus = reduced(r, spec.d);
  const minus = reduced(-r, spec.d);
  return { plus, minus, horizontalAsymptotes: horizontalAsymptotesFrom(plus, minus) };
}

function deriveAlgebraicRoot(spec) {
  switch (spec.form) {
    case "root_minus_linear":
      return deriveRootMinusLinear(spec);
    case "root_over_linear":
      return deriveRootOverLinear(spec);
    default:
      return allUnsupported(); // unknown / missing form — fail closed
  }
}

// ── special family (slice 2) ─────────────────────────────────────────────────
// Named transcendental / power forms whose end behavior is a fixed pair of values.
// Each base returns {plus, minus}; horizontalAsymptotes are derived uniformly.
function deriveSpecial(spec) {
  let plus;
  let minus;
  switch (spec.base) {
    case "exp": // e^x
      plus = PINF;
      minus = reduced(0, 1);
      break;
    case "exp_neg": // e^(-x)
      plus = reduced(0, 1);
      minus = PINF;
      break;
    case "arctan": // arctan x
      plus = PI_OVER_2;
      minus = NEG_PI_OVER_2;
      break;
    case "logistic": // e^x / (1 + e^x)
      plus = reduced(1, 1);
      minus = reduced(0, 1);
      break;
    case "recip_power": // 1 / x^n, requires integer n >= 1
      if (!Number.isInteger(spec.n) || spec.n < 1) return allUnsupported();
      plus = reduced(0, 1);
      minus = reduced(0, 1);
      break;
    default:
      return allUnsupported(); // unknown / missing base — fail closed
  }
  return { plus, minus, horizontalAsymptotes: horizontalAsymptotesFrom(plus, minus) };
}

/**
 * Derive the end behavior of a declared function spec.
 *
 * @param {object} spec  e.g. { kind:'rational', num:[3,-1,1], den:[2,0,5] }
 *                       or   { kind:'algebraic_root', form:'root_over_linear', a, b, c, d, e }
 * @returns {{
 *   plus:  {kind:'finite',num:number,den:number}|{kind:'pinf'}|{kind:'ninf'}|{kind:'dne'}|{kind:'unsupported'},
 *   minus: {kind:'finite',num:number,den:number}|{kind:'pinf'}|{kind:'ninf'}|{kind:'dne'}|{kind:'unsupported'},
 *   horizontalAsymptotes: {kind:'finite',num:number,den:number}[],
 * }}
 */
export function deriveLimitAtInfinity(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return allUnsupported();
  }
  switch (spec.kind) {
    case "rational":
      return deriveRational(spec);
    case "algebraic_root":
      return deriveAlgebraicRoot(spec);
    case "special":
      return deriveSpecial(spec);
    default:
      return allUnsupported(); // unknown / malformed — fail closed
  }
}

// Re-export the constant object shape for callers that prefer it directly.
export { ALL_UNSUPPORTED };
