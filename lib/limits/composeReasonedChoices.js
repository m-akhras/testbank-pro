// Spec-backed piecewise MC (§2.5 analyze_piecewise / §2.3 piecewise_eval, noGraph):
// the SYSTEM composes BOTH the correct choice AND the distractors as
// "value, because <reason>", every value/reason taken ONLY from facts deriveLimits
// returns for THIS spec. The model never writes a reason.
//
// DESIGN: the PRIMARY distractor style is SAME-STRUCTURE PERTURBED VALUES — every
// choice uses the correct reason TEMPLATE with different numbers (drawn from derived
// facts: the other branch's value at a, f(a), the value at a nearby integer), so the
// FORMAT gives nothing away and the student must compute. Reasons use proper math
// notation (one-sided limits as "lim x→a^- f(x)") in the app's mini-syntax, with the
// actual derived numbers. NO meta-commentary ("computational error", "mistake", …)
// is ever emitted — that would eliminate a choice for free.
//
// PURE + deterministic. Always exactly 4 distinct choices, exactly one correct,
// content-sorted (correct not always first).

import { deriveLimits } from "./deriveLimits.js";
import { toLimitValue, formatCombined } from "./combineLimits.js";
import { compileExpression } from "../utils/exprCompile.js";

const DNE = "does not exist (DNE)";
const fmt = (v) => formatCombined(toLimitValue(v)); // number | ±inf | null → mini-syntax
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Each segment's expression + finite value at x (the pool for perturbed distractors
// and for naming the branch in a reason).
function branchesAt(spec, x) {
  const out = [];
  for (const s of spec.segments || []) {
    const f = compileExpression(s.fn, ["x"]);
    if (!f) continue;
    const v = f(x);
    if (isNum(v)) out.push({ expr: s.fn, val: round6(v) });
  }
  return out;
}

// The branch expression on a given side of a (the one ending at a, or starting at a).
function adjacentExpr(spec, a, side) {
  for (const s of spec.segments || []) {
    if (side === "left" && Math.abs(s.to - a) < 1e-9) return s.fn;
    if (side === "right" && Math.abs(s.from - a) < 1e-9) return s.fn;
  }
  for (const s of spec.segments || []) {
    if (side === "left" && s.from < a && a <= s.to + 1e-9) return s.fn;
    if (side === "right" && s.from - 1e-9 <= a && a < s.to) return s.fn;
  }
  return null;
}

// The branch expression whose interval actually CONTAINS x = a (for f(a)).
function coveringExpr(spec, a) {
  for (const s of spec.segments || []) {
    const aboveLo = a > s.from + 1e-9 || (Math.abs(a - s.from) < 1e-9 && !s.openLeft);
    const belowHi = a < s.to - 1e-9 || (Math.abs(a - s.to) < 1e-9 && !s.openRight);
    if (aboveLo && belowHi) return s.fn;
  }
  return null;
}

// Distinct finite candidate numbers drawn from derived facts, for perturbed values.
function numericPool(d, spec, a) {
  const vals = [];
  for (const v of [d.leftLimit, d.rightLimit, d.fValue]) if (isNum(v)) vals.push(round6(v));
  for (const b of branchesAt(spec, a)) vals.push(b.val);
  for (const b of branchesAt(spec, a - 1)) vals.push(b.val);
  for (const b of branchesAt(spec, a + 1)) vals.push(b.val);
  const seen = new Set();
  const out = [];
  for (const v of vals) { const k = String(v); if (!seen.has(k)) { seen.add(k); out.push(v); } }
  return out;
}

// Assemble exactly 4: correct + perturbed distractors (dedup by leading VALUE so two
// choices never share a value and no distractor can equal the correct value). Pads
// with correct±k via the SAME template — NEVER a meta-commentary reason.
function assemble(correct, candidates, mkFromValue, padBase) {
  const seen = new Set([correct.value]);
  const chosen = [correct];
  for (const c of candidates) {
    if (chosen.length === 4) break;
    if (seen.has(c.value)) continue;
    chosen.push({ ...c, correct: false });
    seen.add(c.value);
  }
  let k = 1;
  while (chosen.length < 4 && isNum(padBase) && k <= 60) {
    for (const delta of [k, -k]) {
      if (chosen.length === 4) break;
      const c = mkFromValue(round6(padBase + delta));
      if (!seen.has(c.value)) { chosen.push({ ...c, correct: false }); seen.add(c.value); }
    }
    k += 1;
  }
  chosen.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  return { choices: chosen.map((c) => c.text), answer: chosen.find((c) => c.correct).text };
}

// Dedup isContinuous verdict+reason choices by full TEXT (the verdict repeats; the
// REASON is graded). Exactly 4, exactly one correct, content-sorted.
function assembleText(correct, candidates) {
  const seen = new Set([correct.text]);
  const chosen = [correct];
  for (const c of candidates) {
    if (chosen.length === 4) break;
    if (seen.has(c.text)) continue;
    chosen.push({ ...c, correct: false });
    seen.add(c.text);
  }
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
  const pool = numericPool(d, spec, a);

  switch (ask.quantity) {
    case "limit": {
      // SAME-STRUCTURE: every choice claims the two one-sided values (A, B); the
      // leading value and connective follow from whether they agree.
      const lim = (A, B) => {
        const As = fmt(A), Bs = fmt(B);
        const eq = As === Bs;
        return {
          value: eq ? As : DNE,
          text: `${eq ? As : DNE}, because lim x→${a}^- f(x) = ${As} ${eq ? "and" : "but"} lim x→${a}^+ f(x) = ${Bs}`,
        };
      };
      const cands = pool.map((p) => lim(p, p));
      if (pool.length >= 2) cands.push(lim(pool[0], pool[1])); // a DNE-structured variant
      const padBase = [L, R, FV].find(isNum);
      return assemble({ ...lim(L, R), correct: true }, cands, (v) => lim(v, v), padBase);
    }

    case "leftLimit":
    case "rightLimit": {
      const isLeft = ask.quantity === "leftLimit";
      const val = isLeft ? L : R;
      const rel = isLeft ? "<" : ">", sign = isLeft ? "-" : "+";
      const expr = adjacentExpr(spec, a, isLeft ? "left" : "right");
      const mk = (v) => {
        const vs = fmt(v);
        const exprPart = expr ? `f(x) = ${expr}, so ` : "";
        return { value: vs, text: `${vs}, because for x ${rel} ${a}, ${exprPart}lim x→${a}^${sign} f(x) = ${vs}` };
      };
      const padBase = [val, isLeft ? R : L, FV].find(isNum);
      return assemble({ ...mk(val), correct: true }, pool.map(mk), mk, padBase);
    }

    case "fValue": {
      const expr = coveringExpr(spec, a);
      const mk = (v) => {
        const vs = fmt(v);
        const where = expr
          ? `x = ${a} is in the branch f(x) = ${expr}, so f(${a}) = ${vs}`
          : `f(${a}) = ${vs} is the value defined at x = ${a}`;
        return { value: vs, text: `${vs}, because ${where}` };
      };
      if (FV === null) {
        // f(a) undefined — the correct VALUE is "undefined"; distractors are branch values.
        const correct = { value: "undefined", text: `undefined, because no branch's condition includes x = ${a}`, correct: true };
        const mkv = (v) => { const vs = fmt(v); return { value: vs, text: `${vs}, because f(${a}) = ${vs}` }; };
        const padBase = [L, R].find(isNum);
        return assemble(correct, pool.map(mkv), mkv, padBase);
      }
      const padBase = [FV, L, R].find(isNum);
      return assemble({ ...mk(FV), correct: true }, pool.map(mk), mk, padBase);
    }

    case "isContinuous": {
      const Ls = fmt(L), Rs = fmt(R), FVs = fmt(FV), TWs = fmt(TW);
      if (d.continuous) {
        const correct = {
          text: `continuous, because lim x→${a}^- f(x) = lim x→${a}^+ f(x) = f(${a}) = ${FVs}`,
          correct: true,
        };
        return assembleText(correct, [
          { text: `discontinuous, because f(x) changes formula at x = ${a}` },
          { text: `discontinuous, because lim x→${a} f(x) ≠ f(${a})` },
          { text: `continuous, because f(${a}) is defined` },
        ]);
      }
      // Discontinuous — name the failing condition WITH the derived values.
      let reason;
      if (TW === null && isNum(L) === isNum(R)) {
        reason = `lim x→${a} f(x) does not exist (lim x→${a}^- f(x) = ${Ls} ≠ lim x→${a}^+ f(x) = ${Rs})`;
      } else if (FV === null) {
        reason = `f(${a}) is not defined`;
      } else {
        reason = `lim x→${a} f(x) = ${TWs} ≠ f(${a}) = ${FVs}`;
      }
      const correct = { text: `discontinuous, because ${reason}`, correct: true };
      return assembleText(correct, [
        { text: `continuous, because lim x→${a}^- f(x) = lim x→${a}^+ f(x) = f(${a})` },
        { text: `continuous, because f(${a}) is defined` },
        { text: `discontinuous, because f(x) changes formula at x = ${a}` },
      ]);
    }

    default:
      throw new Error(`composeReasonedChoices: unsupported ask quantity "${ask.quantity}"`);
  }
}

export const REASONED_QUANTITIES = new Set([
  "limit", "leftLimit", "rightLimit", "fValue", "isContinuous",
]);
