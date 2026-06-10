// §2.5 Continuity — whole-spec discontinuity enumeration + canonical statement
// composition. PURE + deterministic: no DOM, no I/O. Built ENTIRELY on the
// existing point-wise deriveLimits (no new evaluator). Under Option A the set of
// candidate discontinuity x's is finite and fully declared, so enumeration is
// provably complete: there are no hidden discontinuities to scan for.

import { validateLimitSpec } from "./limitGraphSpec.js";
import { deriveLimits } from "./deriveLimits.js";

// Enumerate every "interesting" x (segment ends, holes, points, VAs), evaluate
// deriveLimits at each, and return — sorted ascending — the ones that are an
// actual discontinuity (kind !== "none", which excludes continuous joins AND
// domain endpoints / one-sided-only edges). Each record is
// { x, kind, continuous, twoSided }.
export function deriveDiscontinuitySet(spec) {
  validateLimitSpec(spec);
  const segments = spec.segments || [];
  const holes = spec.holes || [];
  const points = spec.points || [];
  const vas = spec.verticalAsymptotes || [];

  const xs = new Set();
  segments.forEach((s) => { xs.add(s.from); xs.add(s.to); });
  holes.forEach((h) => xs.add(h.x));
  points.forEach((p) => xs.add(p.x));
  vas.forEach((v) => xs.add(v.x));

  return [...xs]
    .sort((a, b) => a - b)
    .map((x) => {
      const d = deriveLimits(spec, x);
      return { x, kind: d.discontinuityKind, continuous: d.continuous, twoSided: d.twoSided };
    })
    .filter((r) => r.kind !== "none"); // drop continuous joins and domain endpoints
}

// x's where the two-sided limit fails to exist = jumps + infinite limits.
// NOTE: we filter by kind, not "twoSided is not a finite number". The latter
// would also catch domain endpoints (one-sided edges have twoSided = null), which
// are NOT limit-DNE features. kind ∈ {jump, infinite} is the intended set, and a
// matched-∞ VA (twoSided = "+inf"/"-inf") is included via kind "infinite".
export function limitDNESet(spec) {
  return deriveDiscontinuitySet(spec)
    .filter((r) => r.kind === "jump" || r.kind === "infinite")
    .map((r) => r.x);
}

// x's where f is discontinuous (every kind: removable / jump / infinite).
export function discontinuitySet(spec) {
  return deriveDiscontinuitySet(spec).map((r) => r.x);
}

// x's where the limit EXISTS but f is not continuous = removable discontinuities.
export function removableSet(spec) {
  return deriveDiscontinuitySet(spec)
    .filter((r) => r.kind === "removable")
    .map((r) => r.x);
}

// Join "x = 1", "x = 2", "x = 3" → "x = 1, x = 2 and x = 3" (Oxford-style, with
// "and" before the last; two items → "a and b"; one → "a").
function joinList(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// Normalize items (numbers or { x, kind }) to sorted { x, kind } records.
function normItems(items) {
  return (items || [])
    .map((it) => (typeof it === "number" ? { x: it } : it))
    .slice()
    .sort((a, b) => a.x - b.x);
}

/**
 * Canonical continuity prose. Modes:
 *   "discontinuous_at"  → "f is discontinuous at x = 1 and x = 3"
 *   "continuous_except" → "f is continuous except at x = 1 and x = 3"
 *   "with_reasons"      → "f is discontinuous at x = 1 (removable) and x = 3 (jump)"
 * Empty set → "f is continuous everywhere" (all modes).
 * opts.fn sets the function letter (default "f").
 */
export function composeContinuityStatement(items, mode = "discontinuous_at", opts = {}) {
  const f = opts.fn || "f";
  const norm = normItems(items);
  if (norm.length === 0) return `${f} is continuous everywhere`;

  const list =
    mode === "with_reasons"
      ? joinList(norm.map((it) => `x = ${it.x} (${it.kind})`))
      : joinList(norm.map((it) => `x = ${it.x}`));

  switch (mode) {
    case "continuous_except": return `${f} is continuous except at ${list}`;
    case "with_reasons":      return `${f} is discontinuous at ${list}`;
    case "discontinuous_at":
    default:                  return `${f} is discontinuous at ${list}`;
  }
}

// Limit-phrased statement for the limitDNESet global ask (the continuity modes
// don't fit a limit question). Empty → "...exists at every marked point".
export function composeLimitDNEStatement(items, opts = {}) {
  const f = opts.fn || "f";
  const norm = normItems(items);
  if (norm.length === 0) {
    return `the two-sided limit of ${f} exists at every marked point`;
  }
  return `the two-sided limit of ${f} does not exist at ${joinList(norm.map((it) => `x = ${it.x}`))}`;
}
