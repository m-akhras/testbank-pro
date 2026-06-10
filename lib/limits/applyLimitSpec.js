// §2.2 Phase 4 (Stage A) — apply a declared LimitSpec to a generated question.
//
// PURE + deterministic: no DOM, no I/O, no mutation of the input. Given a
// question object that carries a "limitSpec" (and an "asks" list), it returns a
// NEW question with:
//   - graphConfig compiled from the spec (+ hasGraph: true)
//   - answer / explanation DERIVED from the spec (the LLM's claimed answer is
//     never trusted — the derived value is the single source of truth)
// For Multiple Choice / True-False it matches the derived value to one of the
// LLM's own choices via the shared lenient matcher; if NONE matches the question
// is provably broken and we THROW (hard-fail) rather than keep it.
//
// A question without a limitSpec is returned UNCHANGED — guaranteeing
// byte-identical behavior for every existing (non-§2.2) question.
//
// Reuses (does not reimplement): validateLimitSpec, compileToGraphConfig,
// deriveLimits, and _findCorrectChoiceIdx.

import { validateLimitSpec } from "./limitGraphSpec.js";
import { compileToGraphConfig } from "./compileToGraphConfig.js";
import { deriveLimits } from "./deriveLimits.js";
import { _findCorrectChoiceIdx } from "../utils/questions.js";

// Render one derived value in the app's mini-syntax convention: numbers verbatim,
// declared infinities as the literal text "infinity"/"-infinity" (renderers turn
// these into ∞ / \infty downstream — never emit the glyph here), and a
// DNE/undefined result as "does not exist (DNE)".
function formatValue(v) {
  if (v === null || v === undefined) return "does not exist (DNE)";
  if (v === "+inf") return "infinity";
  if (v === "-inf") return "-infinity";
  return String(v);
}

// The list of vertical-asymptote x-locations as a readable string.
function formatVAs(xs) {
  if (!Array.isArray(xs) || xs.length === 0) return "none";
  return xs.map((x) => `x = ${x}`).join(", ");
}

// Pull the requested quantity from a deriveLimits result.
function quantityValue(d, quantity) {
  switch (quantity) {
    case "limit": return d.twoSided;
    case "leftLimit": return d.leftLimit;
    case "rightLimit": return d.rightLimit;
    case "fValue": return d.fValue;
    case "verticalAsymptotes": return d.verticalAsymptotes;
    default:
      throw new Error(`§2.2 unknown ask quantity: "${quantity}"`);
  }
}

// Human-readable label for one ask (used in the explanation and multi-ask answer).
function askLabel(quantity, at) {
  switch (quantity) {
    case "limit": return `the limit as x approaches ${at}`;
    case "leftLimit": return `the left-hand limit as x approaches ${at}`;
    case "rightLimit": return `the right-hand limit as x approaches ${at}`;
    case "fValue": return `f(${at})`;
    case "verticalAsymptotes": return "the vertical asymptote(s)";
    default: return quantity;
  }
}

// Format the value of one ask (string form used for both answer text and MC matching).
function askValueString(spec, ask) {
  const d = deriveLimits(spec, ask.at);
  const v = quantityValue(d, ask.quantity);
  return ask.quantity === "verticalAsymptotes" ? formatVAs(v) : formatValue(v);
}

/**
 * @param {object} q a generated question, possibly carrying q.limitSpec / q.asks
 * @returns {object} a new question (or the same reference when no limitSpec)
 */
export function applyLimitSpec(q) {
  if (!q || !q.limitSpec) return q; // no-op: byte-identical for non-§2.2 questions

  validateLimitSpec(q.limitSpec);

  const out = { ...q };
  out.graphConfig = compileToGraphConfig(q.limitSpec);
  out.hasGraph = true;

  const asks = Array.isArray(q.asks) ? q.asks : [];
  if (asks.length === 0) return out; // graph only; nothing to grade

  // Per-ask derived value strings + explanation lines.
  const valueStrings = asks.map((ask) => askValueString(q.limitSpec, ask));
  const explanation = asks
    .map((ask, i) => `${askLabel(ask.quantity, ask.at)} is ${valueStrings[i]}.`)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  // The compound answer: the bare value for a single ask (so it can match an MC
  // choice verbatim), or a labeled list for multiple asks.
  const answerText =
    asks.length === 1
      ? valueStrings[0]
      : asks
          .map((ask, i) => `${askLabel(ask.quantity, ask.at)} = ${valueStrings[i]}`)
          .join("; ");

  out.explanation = explanation;

  const isMC = q.type === "Multiple Choice" || q.type === "True/False";
  if (isMC) {
    // Source of truth is the derived value: match it to one of the LLM's choices.
    const idx = _findCorrectChoiceIdx({ choices: q.choices || [], answer: answerText });
    if (idx < 0) {
      throw new Error(
        `§2.2 derived answer "${answerText}" is not among the choices — question rejected`
      );
    }
    out.answer = (q.choices || [])[idx];
  } else {
    out.answer = answerText;
  }

  return out;
}
