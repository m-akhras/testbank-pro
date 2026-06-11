// Spec-backed piecewise MC (§2.5 analyze_piecewise / §2.3 piecewise_eval, noGraph):
// the SYSTEM composes BOTH the correct choice AND the distractors as
// "value, because reason", every value/reason taken ONLY from facts deriveLimits
// returns for THIS spec (left, right, two-sided, f(a), continuity). The model never
// writes a reason — its choices are replaced wholesale.
//
// PURE + deterministic. Always returns exactly 4 distinct choices, exactly one
// correct, in a content-sorted (correct-not-always-first) order.

import { deriveLimits } from "./deriveLimits.js";
import { toLimitValue, formatCombined } from "./combineLimits.js";
import { compileExpression } from "../utils/exprCompile.js";

const DNE = "does not exist (DNE)";
const fmt = (v) => formatCombined(toLimitValue(v)); // number | ±inf | null → mini-syntax

// Value of each segment fn at x=a (finite only) — the pool for "wrong branch"
// distractors. A removable singularity (0/0) or blow-up yields NaN/∞ and is dropped.
function branchValuesAt(spec, a) {
  const out = [];
  for (const s of spec.segments || []) {
    const f = compileExpression(s.fn, ["x"]);
    if (!f) continue;
    const v = f(a);
    if (typeof v === "number" && Number.isFinite(v)) out.push(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

// Assemble exactly 4 choices: the correct one first, then distractor candidates in
// priority order. dedupeBy "value" (numeric asks: no two choices share a value, and
// no distractor may equal the correct value → never accidentally correct) or "text"
// (isContinuous: the verdict repeats, the REASON distinguishes). Pads with perturbed
// numeric distractors if the templates ran short.
function assemble(correct, candidates, dedupeBy) {
  const keyOf = (c) => (dedupeBy === "value" ? c.value : c.text);
  const chosen = [correct];
  const used = new Set([keyOf(correct)]);
  for (const c of candidates) {
    if (chosen.length === 4) break;
    if (dedupeBy === "value" && c.value === correct.value) continue; // would be correct
    const k = keyOf(c);
    if (used.has(k)) continue;
    chosen.push(c);
    used.add(k);
  }
  let pad = 1;
  while (chosen.length < 4 && pad <= 30) {
    const base = Number(correct.value);
    const pv = Number.isFinite(base) ? String(base + pad) : String(pad);
    const cand = { value: pv, text: `${pv}, because of a computational error`, correct: false };
    const k = keyOf(cand);
    if (pv !== correct.value && !used.has(k)) { chosen.push(cand); used.add(k); }
    pad += 1;
  }
  // Content-sorted so CORRECT isn't always first (deterministic, no randomness).
  chosen.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  return { choices: chosen.map((c) => c.text), answer: chosen.find((c) => c.correct).text };
}

/**
 * @param {object} spec a validated LimitSpec
 * @param {{quantity:string, at:number}} ask
 * @returns {{choices: string[], answer: string}}
 */
export function composeReasonedChoices(spec, ask) {
  const a = ask.at;
  const d = deriveLimits(spec, a);
  const L = d.leftLimit, R = d.rightLimit, TW = d.twoSided, FV = d.fValue;
  const Ls = fmt(L), Rs = fmt(R), FVs = fmt(FV);
  const branches = branchValuesAt(spec, a);
  const C = (value, text, correct = false) => ({ value: String(value), text, correct });

  switch (ask.quantity) {
    case "limit": {
      if (TW !== null) {
        // Two-sided limit EXISTS (= L = R).
        const tw = fmt(TW);
        const cands = [];
        if (FV !== null && FVs !== tw) cands.push(C(FVs, `${FVs}, because the limit equals the function value f(${a})`)); // removable-hole trap
        cands.push(C(DNE, FV !== null && FVs !== tw
          ? `${DNE}, because f(${a}) differs from the limit`              // classic misconception
          : `${DNE}, because the formula changes at x = ${a}`));
        const wrong = branches.find((b) => fmt(b) !== tw);
        if (wrong !== undefined) cands.push(C(fmt(wrong), `${fmt(wrong)}, from evaluating the wrong branch at x = ${a}`));
        return assemble(C(tw, `${tw}, because both one-sided limits equal ${tw}`, true), cands, "value");
      }
      // Two-sided limit DOES NOT EXIST (jump: one-sided limits differ).
      const correct = C(DNE, `${DNE}, because the one-sided limits differ (lim x→${a}^- = ${Ls}, lim x→${a}^+ = ${Rs})`, true);
      const cands = [
        C(Ls, `${Ls}, because the limit equals the left-hand value`),
        C(Rs, `${Rs}, because the limit equals the right-hand value`),
      ];
      if (FV !== null) cands.push(C(FVs, `${FVs}, because the limit equals the function value f(${a})`));
      else cands.push(C("0", `0, because the two one-sided values cancel`));
      return assemble(correct, cands, "value");
    }

    case "leftLimit":
    case "rightLimit": {
      const isLeft = ask.quantity === "leftLimit";
      const val = isLeft ? L : R, other = isLeft ? R : L;
      const vs = fmt(val), os = fmt(other);
      const sideOf = (left) => `the branch covering x ${left ? "<" : ">"} ${a}`;
      const correct = C(vs, `${vs}, from ${sideOf(isLeft)}`, true);
      const cands = [
        C(os, `${os}, from ${sideOf(!isLeft)}`),                                  // other side's branch
      ];
      if (FV !== null) cands.push(C(FVs, `${FVs}, because it equals the function value f(${a})`));
      cands.push(C(DNE, `${DNE}, because the branches differ at x = ${a}`));
      return assemble(correct, cands, "value");
    }

    case "fValue": {
      if (FV !== null) {
        const correct = C(FVs, `${FVs}, from the branch whose condition includes x = ${a}`, true);
        const cands = [];
        const wrong = branches.find((b) => fmt(b) !== FVs);
        if (wrong !== undefined) cands.push(C(fmt(wrong), `${fmt(wrong)}, from the other branch evaluated at x = ${a}`));
        if (L !== null && Ls !== FVs) cands.push(C(Ls, `${Ls}, because it equals the one-sided limit`));
        cands.push(C(DNE, `${DNE}, because x = ${a} is a breakpoint`));
        return assemble(correct, cands, "value");
      }
      // f(a) undefined (no branch's condition includes a).
      const correct = C("undefined", `undefined, because no branch's condition includes x = ${a}`, true);
      const cands = [];
      if (L !== null) cands.push(C(Ls, `${Ls}, from the left-hand branch at x = ${a}`));
      if (R !== null && Rs !== Ls) cands.push(C(Rs, `${Rs}, from the right-hand branch at x = ${a}`));
      cands.push(C("0", `0, by default at a breakpoint`));
      return assemble(correct, cands, "value");
    }

    case "isContinuous": {
      // The verdict repeats across choices; the REASON is what's graded, so dedupe
      // by full text.
      if (d.continuous) {
        const correct = C("continuous", `continuous, because the two-sided limit exists and equals f(${a})`, true);
        const cands = [
          C("discontinuous", `discontinuous, because the formula changes at x = ${a}`),
          C("continuous", `continuous, because f(${a}) is defined`),
          C("discontinuous", `discontinuous, because the one-sided limits differ`),
        ];
        return assemble(correct, cands, "text");
      }
      // Discontinuous — pick the most apt true reason, then plausible wrong ones.
      let reason;
      if (TW === null) reason = `the two-sided limit does not exist`;
      else if (FV === null) reason = `f(${a}) is undefined`;
      else reason = `the limit differs from f(${a})`;
      const correct = C("discontinuous", `discontinuous, because ${reason}`, true);
      const cands = [
        C("continuous", `continuous, because f(${a}) is defined`),
        C("continuous", `continuous, because the formula is defined on both sides`),
        C("discontinuous", `discontinuous, because the formula changes at x = ${a}`),
      ];
      return assemble(correct, cands, "text");
    }

    default:
      throw new Error(`composeReasonedChoices: unsupported ask quantity "${ask.quantity}"`);
  }
}

export const REASONED_QUANTITIES = new Set([
  "limit", "leftLimit", "rightLimit", "fValue", "isContinuous",
]);
