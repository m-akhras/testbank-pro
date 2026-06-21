// §2.6 limits at infinity — answer-text formatter. PURE + deterministic: no DOM,
// no I/O. Turns the value objects deriveLimitAtInfinity produces into the app's
// mini-syntax answer strings (NO unicode — "pi", "infinity", never the glyphs).
//
// Reuses the value type from ./limitsAtInfinity.js; nothing here redefines a value
// constant or constructor.

import {
  PI_OVER_2,
  NEG_PI_OVER_2,
  PINF,
  NINF,
  DNE,
  UNSUPPORTED,
  reduced,
} from "./limitsAtInfinity.js";

// finiteSym token -> display string. Exactly the two tokens the engine emits.
const SYM_TEXT = {
  pi_over_2: "pi/2",
  neg_pi_over_2: "-pi/2",
};

/**
 * Render a single limit value in the app's mini-syntax.
 * @param {object} v a value object from deriveLimitAtInfinity
 * @returns {string}
 */
export function formatLimitValue(v) {
  if (v && typeof v === "object") {
    switch (v.kind) {
      case "finite":
        return v.den === 1 ? `${v.num}` : `${v.num}/${v.den}`;
      case "finiteSym":
        if (Object.prototype.hasOwnProperty.call(SYM_TEXT, v.token)) {
          return SYM_TEXT[v.token];
        }
        break; // unknown token -> fall through to throw
      case "pinf":
        return "infinity";
      case "ninf":
        return "-infinity";
      case "dne":
        return "does not exist (DNE)";
      default:
        break; // unsupported / unknown -> throw
    }
  }
  throw new Error("formatLimitValue: unsupported value");
}

/**
 * Compose the horizontal-asymptote sentence from the engine's HA list. The list
 * arrives already deduped and ascending — order is preserved.
 * @param {object[]} haList finite / finiteSym value objects
 * @returns {string}
 */
export function composeHorizontalAsymptoteStatement(haList) {
  if (!Array.isArray(haList) || haList.length === 0) {
    return "no horizontal asymptotes";
  }
  return haList.map((v) => `y = ${formatLimitValue(v)}`).join(" and ");
}

/**
 * Full end-behavior description for a deriveLimitAtInfinity result.
 * @param {{plus:object, minus:object, horizontalAsymptotes:object[]}} result
 * @returns {{plus:string, minus:string, horizontalAsymptotes:string}}
 */
export function describeEndBehavior(result) {
  return {
    plus: formatLimitValue(result.plus),
    minus: formatLimitValue(result.minus),
    horizontalAsymptotes: composeHorizontalAsymptoteStatement(result.horizontalAsymptotes),
  };
}
