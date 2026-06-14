// Pure helpers for the version/section generation pipeline: expected-key
// computation, a LOUD completeness guard (so a truncated response can never
// silently drop versions), and the section→state merge that upholds the
// dual-write invariant (classSectionVersions and the active `versions` array are
// always built together from the same source).
//
// No React, no I/O — every effectful dependency (sanitize, graph-merge, id) is
// injected, so this is fully unit-testable. (sectionTopicConstraints is a pure,
// import-only lookup — not an effectful dep — used by the single-family guard.)

import { sectionTopicConstraints } from "../courses/_calcPrompt.js";

// The complete set of response keys a version-generation request must return.
// `variantLabels` are the labels generated EVERY section (the variants after the
// anchor, e.g. ["B","C"]).
//
// ANCHOR MODEL (anchorMode, the per-section-anchor design): Section 1's anchor
// (A) is the locked master, prepended VERBATIM — so S1_A is NOT generated. Each
// section s ≥ 2 generates its OWN anchor S{s}_A (a function mutation of the
// master), so its expected keys include the anchor. Thus for 3 sections × [B,C]:
//   S1_B, S1_C, S2_A, S2_B, S2_C, S3_A, S3_B, S3_C.
// Without anchorMode (legacy multi / single version_all): no anchor is generated.
export function expectedVersionKeys(numClassSections, variantLabels, { anchorMode = false, anchorLabel = "A" } = {}) {
  const labs = Array.isArray(variantLabels) ? variantLabels : [];
  if (numClassSections > 1) {
    const keys = [];
    for (let s = 1; s <= numClassSections; s++) {
      const gen = (anchorMode && s >= 2) ? [anchorLabel, ...labs] : labs;
      for (const l of gen) keys.push(`S${s}_${l}`);
    }
    return keys;
  }
  return [...labs];
}

// Which expected keys are absent/empty (missing) or have fewer questions than
// expected (short). expectedCount is the number of selected questions each
// version must mutate; pass 0/undefined to skip the count check.
export function findIncompleteKeys(parsed, expectedKeys, expectedCount) {
  const missing = [];
  const short = [];
  for (const k of expectedKeys) {
    const v = parsed && parsed[k];
    if (!Array.isArray(v) || v.length === 0) { missing.push(k); continue; }
    if (typeof expectedCount === "number" && expectedCount > 0 && v.length < expectedCount) {
      short.push(k);
    }
  }
  return { missing, short };
}

// LOUD, actionable error naming exactly which version sets are absent/short.
// e.g. "Expected 15 version sets (S1_A…S5_C); response is missing S4_B, S5_A,
// S5_B, S5_C. The model's response was likely cut off. Regenerate the missing
// sections."
export function formatVersionCompletenessError(expectedKeys, { missing = [], short = [] } = {}, truncated = false) {
  const n = expectedKeys.length;
  const range = n > 1 ? ` (${expectedKeys[0]}…${expectedKeys[n - 1]})` : ` (${expectedKeys[0] || ""})`;
  let msg = `Expected ${n} version set${n !== 1 ? "s" : ""}${range}`;
  if (missing.length) msg += `; response is missing ${missing.join(", ")}`;
  if (short.length) msg += `; incomplete (too few questions): ${short.join(", ")}`;
  msg += ".";
  if (truncated) msg += " The model's response was likely cut off.";
  if (missing.length || short.length) msg += " Regenerate the missing sections.";
  return msg;
}

// LOUD missing-graph guard (live audit, FIX 2). The completeness guard only counts
// keys/questions, so a mutation that silently dropped a graph slipped through: the
// merge then either fell back to the master's stale graphConfig or shipped a
// graph-less question. For every expected key, for each BASE question that carries a
// graph (hasGraph + graphConfig), the variant's i-th question MUST return a usable
// graphConfig (a non-empty plain object). Returns ["S3_B question 4", …] for the
// callers to fail on — never silently graph-less. Graph-CHOICE MCQs (graphs live in
// `choices`, hasGraph:false) are correctly skipped since the base has no top-level graph.
function _usableGraphConfig(cfg) {
  return !!cfg && typeof cfg === "object" && !Array.isArray(cfg) && Object.keys(cfg).length > 0;
}
export function findMissingGraphs(parsed, expectedKeys, selected) {
  const sel = Array.isArray(selected) ? selected : [];
  const missing = [];
  for (const k of expectedKeys) {
    const arr = Array.isArray(parsed && parsed[k]) ? parsed[k] : [];
    sel.forEach((bq, i) => {
      if (!(bq && bq.hasGraph && _usableGraphConfig(bq.graphConfig))) return;
      if (!_usableGraphConfig(arr[i] && arr[i].graphConfig)) {
        missing.push(`${k} question ${i + 1}`);
      }
    });
  }
  return missing;
}

export function formatMissingGraphError(missing = []) {
  if (!missing.length) return "";
  return `Graph lost in mutation — ${missing.join(", ")}: the base question has a graph but the mutation returned none. Regenerate.`;
}

// SINGLE-FAMILY (monoculture) GUARD — the carpeted-section fix. The anchor model
// mutates each section's anchor as ONE "use a different family from other sections"
// decision; the model then carpets the WHOLE section with that family (S3 all e^x,
// S4 all ln). There is cross-section variety language but no within-section one, so
// this guard rejects a freshly-mutated section that came back monochrome — at the
// granularity the section's TOPIC demands.
//
// Family signal (fragile — no family field exists): inferred from the QUESTION text
// + graphConfig fn strings ONLY. Answer/explanation are deliberately excluded — an
// answer often introduces a different family (a polynomial question whose answer
// carries a sqrt). A question yielding NO signal is classified null and SKIPPED, so
// the guard never false-positives on unclassifiable input.
function _fnSignalText(q) {
  if (!q || typeof q !== "object") return "";
  const parts = [typeof q.question === "string" ? q.question : ""];
  const cfg = q.graphConfig;
  if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
    for (const k of ["fn", "fnTop", "fnBottom", "boundary", "expression", "fx", "fy"]) {
      if (typeof cfg[k] === "string") parts.push(cfg[k]);
    }
    if (Array.isArray(cfg.pieces)) {
      for (const p of cfg.pieces) if (p && typeof p.fn === "string") parts.push(p.fn);
    }
  }
  return parts.join("  ");
}

// Classify one question → { member, family } | null. `member` distinguishes ln vs
// e^x vs 2^x (needed for topic-BOUND exp/log sections, where the family is uniform
// by design); `family` groups all exp/log together (for topic-AGNOSTIC sections).
// Ordered: specific tokens first; first hit wins. null when nothing matches.
export function classifyQuestionFamily(q) {
  const t = _fnSignalText(q);
  if (!t.trim()) return null;
  if (/arc(sin|cos|tan|sec|csc|cot)|(sin|cos|tan)\s*\^\s*\(?\s*-\s*1/i.test(t))
    return { member: "inverse-trig", family: "inverse-trig" };
  if (/\bsqrt\s*\(|\bcbrt\s*\(|√/i.test(t)) return { member: "sqrt", family: "sqrt" };
  if (/\bln\s*\(/i.test(t)) return { member: "ln", family: "exp-log" };
  if (/\blog(?:_?\d+|10|2)?\s*\(/i.test(t)) return { member: "log", family: "exp-log" };
  if (/\be\s*\^|\bexp\s*\(/i.test(t)) return { member: "e^x", family: "exp-log" };
  // base^variable: digit^x or (1/2)^x — NOT x^2 (that is polynomial, letter^digit).
  if (/(?<![A-Za-z])\d+\s*\^\s*[A-Za-z]|\)\s*\^\s*[A-Za-z]/.test(t))
    return { member: "b^x", family: "exp-log" };
  if (/\b(sin|cos|tan|sec|csc|cot)\s*\(/i.test(t)) return { member: "trig", family: "trig" };
  // rational: a "/" whose denominator begins with a variable (or "(var") — "1/x",
  // "(x+1)/(x-1)". A constant denominator ("x/2", "1/2") does NOT match.
  if (/\/\s*\(?\s*[A-Za-z]/.test(t)) return { member: "rational", family: "rational" };
  // polynomial: x^2 / coefficient·x (3x) / x±const — a math variable pattern, so
  // pure prose ("find the domain") stays null and is skipped.
  if (/[A-Za-z]\s*\^\s*\d|\d[A-Za-z]|[A-Za-z]\s*[-+]\s*\d/.test(t))
    return { member: "polynomial", family: "polynomial" };
  return null;
}

// Detect a monoculture section. `section` (the math section string) selects the
// granularity via sectionTopicConstraints: topic-BOUND → MEMBER level (ln vs e^x vs
// 2^x are distinct, uniform family is CORRECT); agnostic/null → FAMILY level.
// Returns { detected, label } — detected ONLY when >= 3 classifiable questions ALL
// share the same key. Sub-3 classifiable → never flagged (legit tiny section).
export function detectSingleFamilySection(sectionQuestions, section) {
  const qs = Array.isArray(sectionQuestions) ? sectionQuestions : [];
  const tc = sectionTopicConstraints(section);
  const bound = !!(tc && tc.bound);
  const keys = [];
  for (const q of qs) {
    const c = classifyQuestionFamily(q);
    if (!c) continue;                       // unclassifiable → skip (no false-positive)
    keys.push(bound ? c.member : c.family);
  }
  if (keys.length >= 3 && new Set(keys).size === 1) {
    return { detected: true, label: keys[0], bound };
  }
  return { detected: false, label: null, bound };
}

export function formatSingleFamilyError(section, label) {
  return `Section ${section} came back all-${label} — regenerate.`;
}

// Caller-facing helper: group a freshly-mutated version's questions by their math
// `section` field (bound-ness is per-section), run the monoculture check per group,
// and return one error string per monoculture group ([] when none). Callers throw
// on a non-empty result, exactly like the missing-graph guard.
export function findSingleFamilyErrors(questions) {
  const groups = new Map();
  for (const q of (Array.isArray(questions) ? questions : [])) {
    const s = (q && q.section != null) ? String(q.section) : "";
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(q);
  }
  const errors = [];
  for (const [s, qs] of groups) {
    const r = detectSingleFamilySection(qs, s);
    if (r.detected) errors.push(formatSingleFamilyError(s, r.label));
  }
  return errors;
}

// yDOMAIN FEATURE CLAMP (live audit image 3, FIX 3). Variant graphConfigs come
// straight from the model — they never pass through compileToGraphConfig, so the
// feature-driven yDomain auto-scale never runs. A §2.5 discontinuity graph whose
// exp/quadratic branch blows up to ~200 will auto-scale the y-axis to 200 and crush
// the holes/points flat. We DELIBERATELY avoid evaluating the function strings (an
// unreliable mini-interpreter); instead we anchor on the EXPLICIT feature points
// (holes/points y-values). When those span a SMALL range, pin yDomain to that span
// (padded) so the discontinuity stays legible — unless an explicit yDomain already
// sits within ~4× the feature span (then it's already sane, leave it). Cheap and
// reliable: pure arithmetic on data already in the config, no expression parsing.
function _featureYs(cfg) {
  const ys = [];
  for (const arr of [cfg.holes, cfg.points]) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      const y = Array.isArray(p) ? p[1] : (p && typeof p === "object" ? p.y : undefined);
      if (typeof y === "number" && isFinite(y)) ys.push(y);
    }
  }
  return ys;
}
export function clampGraphYDomainToFeatures(cfg) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return cfg;
  const ys = _featureYs(cfg);
  if (ys.length < 1) return cfg;               // nothing to anchor on
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const featureSpan = Math.max(hi - lo, 1);    // floor so a single point still pads
  const yd = cfg.yDomain;
  const hasYD = Array.isArray(yd) && yd.length === 2 && yd.every(n => typeof n === "number" && isFinite(n));
  const ydSpan = hasYD ? Math.abs(yd[1] - yd[0]) : Infinity; // no yDomain ⇒ renderer auto-scales (treat as unbounded)
  if (ydSpan <= 4 * featureSpan) return cfg;   // explicit yDomain already sane
  const pad = featureSpan * 0.5 + 1;
  return { ...cfg, yDomain: [lo - pad, hi + pad] };
}

// Build ONE section's variant list ({ label, questions, classSection } per label)
// from a parsed response. `multi` selects the key shape: "S{s}_{label}" (sections
// mode) vs the bare label (single-section version_all). Master-agnostic — callers
// prepend the locked Version A. Injected effectful deps keep this pure-testable.
export function buildOneSectionVariants({
  parsed,
  sectionNum,
  multi = true,
  labels,
  selected,
  course = "",
  sanitizeFn = (q) => q,
  mergeGraphFn = (_o, n) => n,
  makeId = () => Math.random().toString(36).slice(2),
  now = Date.now(),
}) {
  const sel = Array.isArray(selected) ? selected : [];
  const labs = Array.isArray(labels) ? labels : [];
  return labs.map((label) => {
    const key = multi ? `S${sectionNum}_${label}` : label;
    const qs = Array.isArray(parsed && parsed[key]) ? parsed[key] : [];
    const questions = qs.map((q, i) => {
      const base = {
        ...sanitizeFn(q),
        id: makeId(),
        originalId: sel[i]?.id,
        course: sel[i]?.course || course,
        versionLabel: label,
        classSection: sectionNum,
        createdAt: now,
      };
      if (sel[i]?.hasGraph) {
        base.hasGraph = true;
        base.graphConfig = mergeGraphFn(sel[i].graphConfig, q.graphConfig);
      }
      return base;
    });
    return { label, questions, classSection: sectionNum };
  });
}

// Build ONE complete section's version list [A, B, C], choosing the anchor (A)
// per the model. `variantLabels` = the non-anchor labels generated every section.
//   ANCHOR MODEL (anchorMode + masterLocked):
//     - section 1: A = the master prepended VERBATIM; B,C from parsed S1_B/S1_C
//     - section s ≥ 2: A,B,C ALL from parsed (S{s}_A is the generated function
//       anchor; S{s}_B/C were generated as numbers mutations of S{s}_A)
//   LEGACY / single: prepend the master as A (if locked) + parsed variantLabels.
export function assembleSection({
  parsed,
  sectionNum,
  multi = true,
  variantLabels,
  anchorLabel = "A",
  selected,
  course = "",
  masterLocked = false,
  masterVersion = null,
  anchorMode = false,
  sanitizeFn = (q) => q,
  mergeGraphFn = (_o, n) => n,
  makeId = () => Math.random().toString(36).slice(2),
  now = Date.now(),
}) {
  const deps = { parsed, sectionNum, multi, selected, course, sanitizeFn, mergeGraphFn, makeId, now };
  if (anchorMode && masterLocked && masterVersion) {
    if (sectionNum === 1) {
      const variants = buildOneSectionVariants({ ...deps, labels: variantLabels });
      return [{ ...masterVersion, classSection: sectionNum }, ...variants];
    }
    // s ≥ 2: the anchor A is a GENERATED key, not the master.
    return buildOneSectionVariants({ ...deps, labels: [anchorLabel, ...variantLabels] });
  }
  const variants = buildOneSectionVariants({ ...deps, labels: variantLabels });
  return (masterLocked && masterVersion)
    ? [{ ...masterVersion, classSection: sectionNum }, ...variants]
    : variants;
}

// Build classSectionVersions + the active `versions` array from a parsed response
// object, in ONE place so the dual-write invariant cannot drift.
export function buildSectionVersions({
  parsed,
  numClassSections,
  variantLabels,
  anchorLabel = "A",
  selected,
  course = "",
  masterLocked = false,
  masterVersion = null,
  anchorMode = false,
  sanitizeFn = (q) => q,
  mergeGraphFn = (_o, n) => n,
  makeId = () => Math.random().toString(36).slice(2),
  now = Date.now(),
}) {
  const multi = numClassSections > 1;
  const classSectionVersions = {};
  for (let s = 1; s <= numClassSections; s++) {
    classSectionVersions[s] = assembleSection({
      parsed, sectionNum: s, multi, variantLabels, anchorLabel, selected, course,
      masterLocked, masterVersion, anchorMode, sanitizeFn, mergeGraphFn, makeId, now,
    });
  }
  return { classSectionVersions, versions: classSectionVersions[1] || [] };
}

// Incrementally merge ONE section's variants into the existing map WITHOUT wiping
// the others (the per-section paste stepper). Re-derives the active `versions`
// array as section 1 (the dual-write invariant), preserving every prior section.
export function mergeSection(prevClassSectionVersions, sectionNum, sectionVariants) {
  const classSectionVersions = { ...(prevClassSectionVersions || {}), [sectionNum]: sectionVariants };
  return {
    classSectionVersions,
    versions: classSectionVersions[1] || classSectionVersions[sectionNum] || [],
  };
}
