// §2.3 Limit Laws — apply two declared LimitSpecs (f and g) + a list of law-asks
// to a generated question. The §2.3 analogue of applyLimitSpec: every answer is
// DERIVED (deriveLimits → toLimitValue → combineLimits → formatCombined), never
// trusted from the model. For MC the derived value must be among the model's
// choices or the question HARD-FAILS (rides the same pasteError path as §2.2).
//
// PURE + deterministic: no DOM, no I/O, no mutation of the input. Reuses
// validateLimitSpec, compileToFunctionPairConfig, deriveLimits, combineLimits,
// formatCombined, _findCorrectChoiceIdx, and compileExpression — nothing new.

import { validateLimitSpec } from "./limitGraphSpec.js";
import { compileToFunctionPairConfig } from "./compileToGraphConfig.js";
import { deriveLimits } from "./deriveLimits.js";
import { toLimitValue, combineLimits, formatCombined } from "./combineLimits.js";
import { applyLimitSpec } from "./applyLimitSpec.js";
import { _findCorrectChoiceIdx } from "../utils/questions.js";
import { compileExpression } from "../utils/exprCompile.js";

const LAWS = new Set([
  "sum", "difference", "product", "quotient",
  "constMultiple", "xPolyTimesF", "power", "root",
]);

function round6(n) {
  const r = Math.round(n * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

// Human-readable label for one law-ask (explanation + multi-ask answer).
function lawLabel(ask) {
  const a = ask.at;
  const p = ask.params || {};
  switch (ask.law) {
    case "sum": return `the limit of (f + g) as x approaches ${a}`;
    case "difference": return `the limit of (f - g) as x approaches ${a}`;
    case "product": return `the limit of (f * g) as x approaches ${a}`;
    case "quotient": return `the limit of f/g as x approaches ${a}`;
    case "constMultiple": return `the limit of ${p.k}*f as x approaches ${a}`;
    case "xPolyTimesF": return `the limit of (${p.poly})*f as x approaches ${a}`;
    case "power": return `the limit of f^${p.n} as x approaches ${a}`;
    case "root": return `the limit of the ${p.n}-th root of f as x approaches ${a}`;
    default: return `the limit as x approaches ${a}`;
  }
}

// Resolve one law-ask to its formatted answer string. Fails closed on any
// malformed law/params (never guesses).
function resolveAsk(specF, specG, ask) {
  if (!ask || !LAWS.has(ask.law)) {
    throw new Error(`§2.3 unknown or missing law "${ask && ask.law}"`);
  }
  if (typeof ask.at !== "number" || !Number.isFinite(ask.at)) {
    throw new Error(`§2.3 law-ask "${ask.law}" requires a finite numeric "at"`);
  }

  const Vf = toLimitValue(deriveLimits(specF, ask.at).twoSided);
  const Vg = toLimitValue(deriveLimits(specG, ask.at).twoSided);

  const params = { ...(ask.params || {}) };

  if (ask.law === "constMultiple") {
    if (typeof params.k !== "number" || !Number.isFinite(params.k)) {
      throw new Error(`§2.3 constMultiple requires a finite params.k`);
    }
  } else if (ask.law === "xPolyTimesF") {
    // Evaluate k = p(at) here (combineLimits never parses expressions).
    if (typeof params.poly !== "string" || !params.poly.trim()) {
      throw new Error(`§2.3 xPolyTimesF requires params.poly (an expression string)`);
    }
    const fn = compileExpression(params.poly, ["x"]);
    if (!fn) throw new Error(`§2.3 xPolyTimesF poly "${params.poly}" is not compilable`);
    const k = fn(ask.at);
    if (typeof k !== "number" || !Number.isFinite(k)) {
      throw new Error(`§2.3 xPolyTimesF poly "${params.poly}" is not finite at x=${ask.at}`);
    }
    params.k = round6(k);
  } else if (ask.law === "power") {
    if (!Number.isInteger(params.n) || params.n < 1) {
      throw new Error(`§2.3 power requires an integer params.n ≥ 1`);
    }
  } else if (ask.law === "root") {
    if (!Number.isInteger(params.n) || params.n < 2) {
      throw new Error(`§2.3 root requires an integer params.n ≥ 2`);
    }
  }

  // combineLimits enforces the same constraints again (defense in depth) and
  // applies the locked indeterminate-form rules.
  return formatCombined(combineLimits(ask.law, Vf, Vg, params));
}

/**
 * @param {object} q a question carrying q.limitSpecF + q.limitSpecG + q.lawAsks
 * @returns {object} a new question (graphConfig compiled, answer/explanation derived)
 */
export function applyLimitLaws(q) {
  if (!q || (!q.limitSpecF && !q.limitSpecG && !q.lawAsks)) return q; // no-op
  if (!q.limitSpecF || !q.limitSpecG) {
    throw new Error("§2.3 a limit-laws question requires BOTH limitSpecF and limitSpecG");
  }

  validateLimitSpec(q.limitSpecF);
  validateLimitSpec(q.limitSpecG);

  const out = { ...q };
  out.graphConfig = compileToFunctionPairConfig(q.limitSpecF, q.limitSpecG);
  out.hasGraph = true;

  const asks = Array.isArray(q.lawAsks) ? q.lawAsks : [];
  if (asks.length === 0) return out; // graph only; nothing to grade

  const answers = asks.map((ask) => resolveAsk(q.limitSpecF, q.limitSpecG, ask));

  out.explanation = asks
    .map((ask, i) => `${lawLabel(ask)} is ${answers[i]}.`)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  const answerText =
    asks.length === 1
      ? answers[0]
      : asks.map((ask, i) => `${lawLabel(ask)} = ${answers[i]}`).join("; ");

  const isMC = q.type === "Multiple Choice" || q.type === "True/False";
  if (isMC) {
    const idx = _findCorrectChoiceIdx({ choices: q.choices || [], answer: answerText });
    if (idx < 0) {
      throw new Error(
        `§2.3 derived answer "${answerText}" is not among the choices — question rejected`
      );
    }
    out.answer = (q.choices || [])[idx];
  } else {
    out.answer = answerText;
  }

  return out;
}

// Single dispatch point for the limit engine. A question with the §2.3 pair shape
// (limitSpecF/limitSpecG/lawAsks) routes to applyLimitLaws; a §2.2/§2.5 question
// (limitSpec) routes to applyLimitSpec exactly as today; a plain question is a
// no-op. Carrying BOTH shapes is ambiguous → hard-fail (never guess).
//
// opts.requireSpecForGraph (set by the caller ONLY for limit-template sections):
// a graph question that arrives with a graph payload but NO spec is a "mixed"
// failure mode — the model drew a graph but forgot the spec that derives its
// answer. Reject it loudly. This NEVER fires for non-limit sections (the caller
// passes false), so QM / Calc-3 graphConfig questions pass through untouched.
export function applyLimitDerivation(q, opts = {}) {
  if (!q) return q;
  const hasPair = !!(q.limitSpecF || q.limitSpecG || q.lawAsks);
  const hasSingle = !!q.limitSpec;
  if (hasPair && hasSingle) {
    throw new Error(
      "§2.3 ambiguous question: carries both a single limitSpec and a limitSpecF/limitSpecG pair"
    );
  }
  const result = hasPair ? applyLimitLaws(q) : applyLimitSpec(q);

  if (opts.requireSpecForGraph && !hasPair && !hasSingle) {
    const hasGraphPayload = !!(result.hasGraph || result.graphConfig);
    if (hasGraphPayload) {
      throw new Error(
        "limit-section graph question carries a graph but no spec — a graph question " +
        "MUST emit a limitSpec (or limitSpecF+limitSpecG+lawAsks); graph-without-spec rejected"
      );
    }
  }
  return result;
}
