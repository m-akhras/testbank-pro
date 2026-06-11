// Pure helpers for the version/section generation pipeline: expected-key
// computation, a LOUD completeness guard (so a truncated response can never
// silently drop versions), and the section→state merge that upholds the
// dual-write invariant (classSectionVersions and the active `versions` array are
// always built together from the same source).
//
// No React, no I/O — every effectful dependency (sanitize, graph-merge, id) is
// injected, so this is fully unit-testable.

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
