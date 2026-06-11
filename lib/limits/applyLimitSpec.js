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
import {
  deriveDiscontinuitySet,
  composeContinuityStatement,
  composeLimitDNEStatement,
} from "./continuity.js";
import { _findCorrectChoiceIdx } from "../utils/questions.js";
import { toLimitValue, formatCombined } from "./combineLimits.js";

// §2.5 whole-spec asks (no ask.at): the correct answer is composed by the system
// from the derived discontinuity set; the model only supplies distractors.
const GLOBAL_QUANTITIES = new Set(["limitDNESet", "discontinuitySet", "removableSet"]);

// Render one derived scalar (number / "+inf" / "-inf" / null) in the app's
// mini-syntax convention. SINGLE SOURCE OF TRUTH is combineLimits.formatCombined
// (numbers verbatim, infinities as "infinity"/"-infinity", DNE/undefined as
// "does not exist (DNE)"); here we just bridge the raw deriveLimits encoding
// through toLimitValue. §2.3 (combineLimits) shares the exact same formatter.
const formatValue = (v) => formatCombined(toLimitValue(v));

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
    case "isContinuous": return `f at x = ${at}`;
    default: return quantity;
  }
}

// Format the value of one POINT ask (string form, used for answer text + MC match).
function askValueString(spec, ask) {
  const d = deriveLimits(spec, ask.at);
  switch (ask.quantity) {
    case "isContinuous":
      return d.continuous ? "continuous" : "discontinuous";
    case "verticalAsymptotes":
      return formatVAs(quantityValue(d, ask.quantity));
    default:
      return formatValue(quantityValue(d, ask.quantity));
  }
}

/**
 * @param {object} q a generated question, possibly carrying q.limitSpec / q.asks
 * @returns {object} a new question (or the same reference when no limitSpec)
 */
export function applyLimitSpec(q) {
  if (!q || !q.limitSpec) return q; // no-op: byte-identical for non-§2.2 questions

  validateLimitSpec(q.limitSpec);

  // Function-letter consistency: a single-spec graph is always drawn (and its
  // derived statements composed) as "f". If the question TEXT names the function
  // with any other letter (e.g. "function h", "h(x)", "g(x)"), the prose would
  // contradict the curve label "f" and the derived "f is…" answer — reject it.
  // (Pairs use f and g via applyLimitLaws, which doesn't run this guard.)
  if (typeof q.question === "string") {
    const bad = [...q.question.matchAll(/\b([a-z])\s*\(\s*x\s*\)/g)]
      .map((m) => m[1].toLowerCase())
      .find((c) => c !== "f");
    if (bad) {
      throw new Error(
        `single-spec limit question must call the function f, but the text uses "${bad}" ` +
        `(e.g. ${bad}(x)) — rename the function to f to match the graph and answer key`
      );
    }
  }

  const out = { ...q };
  // q.noGraph: spec-backed symbolic questions (analyze_piecewise, piecewise_eval)
  // that DISPLAY the function as text and use the spec ONLY as the answer's source
  // of truth — validate + derive + run MC injection exactly as below, but attach NO
  // graph. The graph-without-spec dispatch guard is unaffected (the spec is present).
  if (!q.noGraph) {
    out.graphConfig = compileToGraphConfig(q.limitSpec);
    out.hasGraph = true;
  }

  const asks = Array.isArray(q.asks) ? q.asks : [];
  if (asks.length === 0) return out; // graph only; nothing to grade

  const isMC = q.type === "Multiple Choice" || q.type === "True/False";

  // ── §2.5 GLOBAL (whole-spec) ask ───────────────────────────────────────────
  // The correct statement is composed by the SYSTEM from the derived set; the
  // model only supplies distractors. A global ask must stand alone.
  if (asks.some((a) => GLOBAL_QUANTITIES.has(a.quantity))) {
    if (asks.length !== 1) {
      throw new Error("§2.5 a global continuity ask must be the only ask in its question");
    }
    const ask = asks[0];
    // Locked to "f" — matches the renderer's default curve label and the mandated
    // contract wording, so the composed statement never drifts to another letter.
    const opts = { fn: "f" };
    const records = deriveDiscontinuitySet(q.limitSpec);

    let statement;
    if (ask.quantity === "limitDNESet") {
      const items = records.filter((r) => r.kind === "jump" || r.kind === "infinite");
      statement = composeLimitDNEStatement(items, opts);
    } else if (ask.quantity === "removableSet") {
      const items = records.filter((r) => r.kind === "removable");
      statement = composeContinuityStatement(items, ask.mode || "discontinuous_at", opts);
    } else {
      // discontinuitySet — every discontinuity.
      statement = composeContinuityStatement(records, ask.mode || "discontinuous_at", opts);
    }

    // Answer stays kind-free; the explanation may describe the behavior in PROSE
    // (pedagogy) — not via a "(kind)" annotation appended to the statement.
    if (records.length) {
      const art = (k) => (k === "infinite" ? "an" : "a");
      const reasons = records
        .map((r) => `at x = ${r.x}, ${art(r.kind)} ${r.kind} discontinuity`)
        .join("; ");
      out.explanation = `${composeContinuityStatement(records, "discontinuous_at", opts)} — ${reasons}.`;
    } else {
      out.explanation = composeContinuityStatement(records, "discontinuous_at", opts);
    }

    if (isMC) {
      const choices = Array.isArray(q.choices) ? [...q.choices] : [];
      if (choices.length < 2) {
        throw new Error("§2.5 global continuity MC needs at least 2 distractor choices");
      }
      // Guarantee the system-composed correct statement is present & is the key.
      // Reuse it if the model happened to include it; otherwise replace a distractor.
      let idx = _findCorrectChoiceIdx({ choices, answer: statement });
      if (idx < 0) {
        choices[choices.length - 1] = statement;
        idx = choices.length - 1;
      }
      out.choices = choices;
      out.answer = choices[idx];
    } else {
      out.answer = statement;
    }
    return out;
  }

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
