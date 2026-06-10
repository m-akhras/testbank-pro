// §2.3 Limit Laws — the pure derivation core. Combines two operand limits (or one
// operand + a scalar) under a limit law, returning a canonical limit value. This
// is the §2.3 analogue of deriveLimits/continuity: the answer key is DERIVED here,
// never trusted from the model.
//
// PURE: no DOM, no I/O, no expression parsing. The x-polynomial law receives its
// already-evaluated coefficient k = p(a) from the caller (computed with the shared
// expression evaluator) — combineLimits stays free of any evaluator dependency.
//
// Canonical operand representation: FINITE(n) | PINF | NINF | DNE.
// These mirror what deriveLimits emits: a finite number, "+inf", "-inf", or null.

// ── canonical values ────────────────────────────────────────────────────────
export const PINF = Object.freeze({ tag: "pinf" });
export const NINF = Object.freeze({ tag: "ninf" });
export const DNE = Object.freeze({ tag: "dne" });

// Public constructor: validates finiteness, normalizes -0 → 0. Does NOT round —
// so toLimitValue(rawNumber) round-trips a deriveLimits number faithfully.
// (Internal arithmetic uses fin() below, which rounds away float noise.)
export function FINITE(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`FINITE requires a finite number, got ${String(n)}`);
  }
  return { tag: "finite", value: n === 0 ? 0 : n };
}

const isFinite_ = (V) => !!V && V.tag === "finite";
const isPinf = (V) => !!V && V.tag === "pinf";
const isNinf = (V) => !!V && V.tag === "ninf";
const isDne = (V) => !!V && V.tag === "dne";
const isInf = (V) => isPinf(V) || isNinf(V);

function isCanonical(V) {
  return !!V && (V.tag === "finite" || V.tag === "pinf" || V.tag === "ninf" || V.tag === "dne");
}
function assertCanonical(V, name) {
  if (!isCanonical(V)) {
    throw new Error(`combineLimits: ${name} is not a canonical limit value`);
  }
  if (V.tag === "finite" && (typeof V.value !== "number" || !Number.isFinite(V.value))) {
    throw new Error(`combineLimits: ${name} has a malformed finite value`);
  }
}

// Round arithmetic results to 6 decimals (matching deriveLimits' cleanNum) and
// normalize -0 → 0, so float noise like 0.1+0.2 never leaks into an answer key.
function round6(n) {
  const r = Math.round(n * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}
const fin = (n) => FINITE(round6(n));

const infSign = (V) => (isPinf(V) ? 1 : -1);
const mkInf = (sign) => (sign >= 0 ? PINF : NINF);
function negate(V) {
  if (isFinite_(V)) return FINITE(-V.value);
  if (isPinf(V)) return NINF;
  if (isNinf(V)) return PINF;
  return DNE;
}

// ── resolver: raw deriveLimits value → canonical ────────────────────────────
export function toLimitValue(raw) {
  if (raw === null || raw === undefined) return DNE;
  if (raw === "+inf") return PINF;
  if (raw === "-inf") return NINF;
  if (typeof raw === "number" && Number.isFinite(raw)) return FINITE(raw);
  throw new Error(`toLimitValue: unrecognized limit encoding ${JSON.stringify(raw)}`);
}

// ── individual law kernels ──────────────────────────────────────────────────
function add(A, B) {
  if (isDne(A) || isDne(B)) return DNE;
  if (isFinite_(A) && isFinite_(B)) return fin(A.value + B.value);
  if (isFinite_(A) && isInf(B)) return B;
  if (isInf(A) && isFinite_(B)) return A;
  // both infinite: same sign collapses, opposite signs are the ∞−∞ indeterminate
  return A.tag === B.tag ? A : DNE;
}

function multiply(A, B) {
  if (isDne(A) || isDne(B)) return DNE;
  if (isFinite_(A) && isFinite_(B)) return fin(A.value * B.value);
  // at least one infinite → 0·∞ is indeterminate (both orders)
  if (isFinite_(A) && A.value === 0) return DNE;
  if (isFinite_(B) && B.value === 0) return DNE;
  const sA = isInf(A) ? infSign(A) : Math.sign(A.value);
  const sB = isInf(B) ? infSign(B) : Math.sign(B.value);
  return mkInf(sA * sB);
}

function divide(A, B) {
  if (isDne(A) || isDne(B)) return DNE;
  // a finite-zero denominator: finite/0, 0/0, AND inf/0 are all DNE two-sided
  if (isFinite_(B) && B.value === 0) return DNE;
  if (isFinite_(A) && isFinite_(B)) return fin(A.value / B.value); // denom ≠ 0 here
  if (isFinite_(A) && isInf(B)) return FINITE(0); // finite / ±inf → 0 (positive zero)
  if (isInf(A) && isFinite_(B)) return mkInf(infSign(A) * Math.sign(B.value)); // ±inf / finite≠0
  return DNE; // ±inf / ±inf
}

// constMultiple and xPolyTimesF share this: k is a finite scalar (the constant,
// or the polynomial value p(a) the caller already evaluated).
function scaleBy(k, V) {
  if (typeof k !== "number" || !Number.isFinite(k)) {
    throw new Error(`combineLimits: scalar k must be a finite number, got ${String(k)}`);
  }
  if (k === 0) {
    // 0·finite = 0; 0·∞ = DNE; 0·DNE = DNE.
    // FUTURE REFINEMENT (decidable, intentionally NOT implemented here): when k=0
    // and V is a BOUNDED DNE (a jump, i.e. discontinuityKind "jump"), the squeeze
    // gives 0 rather than DNE. That requires the caller to pass the operand's
    // discontinuityKind; combineLimits stays conservative and returns DNE.
    return isFinite_(V) ? FINITE(0) : DNE;
  }
  if (isDne(V)) return DNE;
  if (isFinite_(V)) return fin(k * V.value);
  return mkInf(Math.sign(k) * infSign(V)); // ±inf scaled by sign of k
}

function power(V, n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`combineLimits: power requires an integer n ≥ 1, got ${String(n)}`);
  }
  if (isDne(V)) return DNE;
  if (isFinite_(V)) return fin(Math.pow(V.value, n));
  if (isPinf(V)) return PINF;
  return n % 2 === 0 ? PINF : NINF; // NINF: even power → +∞, odd power → −∞
}

function root(V, n) {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`combineLimits: root requires an integer n ≥ 2, got ${String(n)}`);
  }
  const even = n % 2 === 0;
  if (isDne(V)) return DNE;
  if (isFinite_(V)) {
    const v = V.value;
    if (even) return v < 0 ? DNE : fin(Math.pow(v, 1 / n));
    return fin(Math.sign(v) * Math.pow(Math.abs(v), 1 / n)); // odd root preserves sign
  }
  if (isPinf(V)) return PINF;
  return even ? DNE : NINF; // NINF: even root not real → DNE; odd root → −∞
}

const BINARY_LAWS = new Set(["sum", "difference", "product", "quotient"]);

/**
 * @param {string} law  "sum"|"difference"|"product"|"quotient"|"constMultiple"|"xPolyTimesF"|"power"|"root"
 * @param {object} Vf   canonical operand (FINITE/PINF/NINF/DNE)
 * @param {object} [Vg] canonical second operand (binary laws only)
 * @param {object} [params] { k } for constMultiple/xPolyTimesF, { n } for power/root
 * @returns {object} canonical result
 */
export function combineLimits(law, Vf, Vg, params = {}) {
  assertCanonical(Vf, "Vf");
  if (BINARY_LAWS.has(law)) assertCanonical(Vg, "Vg");

  switch (law) {
    case "sum": return add(Vf, Vg);
    case "difference": return add(Vf, negate(Vg));
    case "product": return multiply(Vf, Vg);
    case "quotient": return divide(Vf, Vg);
    case "constMultiple":
    case "xPolyTimesF": return scaleBy(params.k, Vf);
    case "power": return power(Vf, params.n);
    case "root": return root(Vf, params.n);
    default:
      throw new Error(`combineLimits: unknown law "${String(law)}"`);
  }
}

// Map a canonical result to the exact single-scalar answer strings applyLimitSpec
// already uses (see its internal formatValue). Kept in sync by value; Step 3 may
// consolidate this with that helper when combineLimits is wired into applyLimitSpec.
export function formatCombined(value) {
  assertCanonical(value, "value");
  if (isDne(value)) return "does not exist (DNE)";
  if (isPinf(value)) return "infinity";
  if (isNinf(value)) return "-infinity";
  return String(value.value);
}
