// §2.3 Limit Laws — apply two declared LimitSpecs (f and g) + a list of law-asks
// to a generated question. The §2.3 analogue of applyLimitSpec: every answer is
// DERIVED (deriveLimits → toLimitValue → combineLimits → formatCombined), never
// trusted from the model. For Multiple Choice the system composes the correct
// answer AND every distractor (in the same compound format), so the model's
// choices are placeholders only — a wrongly-worded model answer can no longer be
// (a) accepted or (b) rejected.
//
// PURE + deterministic: no DOM, no I/O, no mutation of the input. Reuses
// validateLimitSpec, compileToFunctionPairConfig, deriveLimits, combineLimits,
// formatCombined, and compileExpression — nothing new.

import { validateLimitSpec } from "./limitGraphSpec.js";
import { compileToFunctionPairConfig } from "./compileToGraphConfig.js";
import { deriveLimits } from "./deriveLimits.js";
import {
  toLimitValue, combineLimits, formatCombined, FINITE, PINF, NINF, DNE,
} from "./combineLimits.js";
import { applyLimitSpec } from "./applyLimitSpec.js";
import { compileExpression } from "../utils/exprCompile.js";

const LAWS = new Set([
  "sum", "difference", "product", "quotient",
  "constMultiple", "xPolyTimesF", "power", "root",
]);

function round6(n) {
  const r = Math.round(n * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

// Natural-language name for the n-th root of f: "square root" / "cube root" /
// "4th root" — never "2-th".
function rootPhrase(n) {
  if (n === 2) return "square root of f";
  if (n === 3) return "cube root of f";
  return `${n}th root of f`;
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
    case "root": return `the limit of the ${rootPhrase(p.n)} as x approaches ${a}`;
    default: return `the limit as x approaches ${a}`;
  }
}

const sameCanon = (a, b) =>
  !!a && !!b && a.tag === b.tag && (a.tag !== "finite" || a.value === b.value);

// Pedagogically-plausible WRONG canonical values for one ask, each distinct from
// `correct`. Used to compose system distractors. Deterministic.
function wrongValuesFor(ask, dF, dG, Vf, params, correct) {
  const out = [];
  const push = (v) => {
    if (v && !sameCanon(v, correct) && !out.some((o) => sameCanon(o, v))) out.push(v);
  };

  // (1) "forgot it's two-sided DNE" — use a one-sided combined value.
  for (const side of ["left", "right"]) {
    const VfS = toLimitValue(side === "left" ? dF.leftLimit : dF.rightLimit);
    const VgS = toLimitValue(side === "left" ? dG.leftLimit : dG.rightLimit);
    try { push(combineLimits(ask.law, VfS, VgS, params)); } catch (_e) { /* skip */ }
  }
  // (2) power: forgot to raise → the base; root: forgot to take root → the radicand.
  if ((ask.law === "power" || ask.law === "root") && Vf.tag === "finite") push(FINITE(Vf.value));
  // (3) infinity → sign flip.
  if (correct.tag === "pinf") push(NINF);
  if (correct.tag === "ninf") push(PINF);
  // (4) "nonzero/0 = 0" mistake → claim 0 where it's actually DNE.
  if (correct.tag === "dne") push(FINITE(0));
  // (5) finite → off-by-one / sign-flip / "claims DNE".
  if (correct.tag === "finite") {
    push(FINITE(correct.value + 1));
    push(FINITE(correct.value - 1));
    if (correct.value !== 0) push(FINITE(-correct.value));
    push(DNE);
  }
  // (6) generic fallbacks so there's always material.
  push(DNE);
  push(FINITE(0));
  push(FINITE(1));
  return out;
}

// Resolve one law-ask into a record: validated params, the correct canonical
// value + its formatted string, and a list of plausible-wrong values (canonical).
// Fails closed on any malformed law/params (never guesses).
function buildAskRecord(specF, specG, ask) {
  if (!ask || !LAWS.has(ask.law)) {
    throw new Error(`§2.3 unknown or missing law "${ask && ask.law}"`);
  }
  if (typeof ask.at !== "number" || !Number.isFinite(ask.at)) {
    throw new Error(`§2.3 law-ask "${ask.law}" requires a finite numeric "at"`);
  }

  const dF = deriveLimits(specF, ask.at);
  const dG = deriveLimits(specG, ask.at);
  const Vf = toLimitValue(dF.twoSided);
  const Vg = toLimitValue(dG.twoSided);

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
  const correct = combineLimits(ask.law, Vf, Vg, params);
  return {
    label: lawLabel({ ...ask, params }),
    correct,
    correctStr: formatCombined(correct),
    wrongs: wrongValuesFor(ask, dF, dG, Vf, params, correct),
  };
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

  const records = asks.map((ask) => buildAskRecord(q.limitSpecF, q.limitSpecG, ask));

  // Compose a compound string from per-ask formatted parts: a bare value for a
  // single ask, or "<label> = <value>; ..." for several.
  const composeCompound = (parts) =>
    asks.length === 1
      ? parts[0]
      : asks.map((ask, i) => `${records[i].label} = ${parts[i]}`).join("; ");

  const correctStrs = records.map((r) => r.correctStr);
  const answerText = composeCompound(correctStrs);

  out.explanation = records
    .map((r) => `${r.label} is ${r.correctStr}.`)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  const isMC = q.type === "Multiple Choice" || q.type === "True/False";
  if (isMC) {
    // The SYSTEM composes the correct answer AND every distractor, all in the same
    // compound format, so the correct choice no longer stands out as the only
    // long-form one (and a wrongly-worded model answer can't be accepted OR
    // rejected). The model's choices are placeholders; we build them all here.
    // Each distractor = the correct compound with one (or more) ask's value
    // swapped for a plausible-wrong value. Deterministic.
    const seen = new Set([answerText]);
    const distractors = [];
    const tryAdd = (parts) => {
      if (distractors.length >= 3) return;
      const comp = composeCompound(parts);
      if (!seen.has(comp)) { seen.add(comp); distractors.push(comp); }
    };
    // First: ONE distractor per ask (varied across asks — each wrong in a
    // different part, mirroring distinct student errors).
    for (let j = 0; j < records.length && distractors.length < 3; j++) {
      for (const w of records[j].wrongs) {
        const parts = correctStrs.slice();
        parts[j] = formatCombined(w);
        const before = distractors.length;
        tryAdd(parts);
        if (distractors.length > before) break; // one per ask, move on
      }
    }
    // Then top up (few-ask questions): more single-ask perturbations.
    for (let j = 0; j < records.length && distractors.length < 3; j++) {
      for (const w of records[j].wrongs) {
        if (distractors.length >= 3) break;
        const parts = correctStrs.slice();
        parts[j] = formatCombined(w);
        tryAdd(parts);
      }
    }
    // Pad (rare) with multi-part perturbations seeded by an offset.
    for (let salt = 0; distractors.length < 3 && salt < 24; salt++) {
      const parts = correctStrs.map((s, i) => {
        const ws = records[i].wrongs;
        return ws.length ? formatCombined(ws[(i + salt) % ws.length]) : s;
      });
      tryAdd(parts);
    }

    // Deterministically place the correct answer among the (≥3) distractors.
    const seed = [...answerText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const correctPos = distractors.length >= 3 ? seed % 4 : 0;
    const finalChoices = [];
    let di = 0;
    for (let i = 0; i < (distractors.length >= 3 ? 4 : distractors.length + 1); i++) {
      finalChoices.push(i === correctPos ? answerText : distractors[di++]);
    }
    out.choices = finalChoices;
    out.answer = answerText;
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
