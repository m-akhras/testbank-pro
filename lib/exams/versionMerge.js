// Pure helpers for the version/section generation pipeline: expected-key
// computation, a LOUD completeness guard (so a truncated response can never
// silently drop versions), and the section→state merge that upholds the
// dual-write invariant (classSectionVersions and the active `versions` array are
// always built together from the same source).
//
// No React, no I/O — every effectful dependency (sanitize, graph-merge, id) is
// injected, so this is fully unit-testable.

// The complete set of response keys a version-generation request must return.
// Multi-section: "S{s}_{label}" for every section × label. Single-section
// (version_all): the bare labels ("A", "B", …).
export function expectedVersionKeys(numClassSections, labels) {
  const labs = Array.isArray(labels) ? labels : [];
  if (numClassSections > 1) {
    const keys = [];
    for (let s = 1; s <= numClassSections; s++) {
      for (const l of labs) keys.push(`S${s}_${l}`);
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

// Build classSectionVersions + the active `versions` array from a parsed response
// object, in ONE place so the dual-write invariant cannot drift. Injected:
//   sanitizeFn(q)                  — useGenerate.sanitize
//   mergeGraphFn(origCfg, newCfg)  — useGenerate.mergeVariantGraphConfig
//   makeId()                       — uid
//   masterVersion / masterLocked   — prepend Version A (the locked master) per section
export function buildSectionVersions({
  parsed,
  numClassSections,
  labels,
  selected,
  course = "",
  masterLocked = false,
  masterVersion = null,
  sanitizeFn = (q) => q,
  mergeGraphFn = (_o, n) => n,
  makeId = () => Math.random().toString(36).slice(2),
  now = Date.now(),
}) {
  const multi = numClassSections > 1;
  const sel = Array.isArray(selected) ? selected : [];
  const labs = Array.isArray(labels) ? labels : [];
  const classSectionVersions = {};

  for (let s = 1; s <= numClassSections; s++) {
    const sectionVariants = labs.map((label) => {
      const key = multi ? `S${s}_${label}` : label;
      const qs = Array.isArray(parsed && parsed[key]) ? parsed[key] : [];
      const questions = qs.map((q, i) => {
        const base = {
          ...sanitizeFn(q),
          id: makeId(),
          originalId: sel[i]?.id,
          course: sel[i]?.course || course,
          versionLabel: label,
          classSection: s,
          createdAt: now,
        };
        if (sel[i]?.hasGraph) {
          base.hasGraph = true;
          base.graphConfig = mergeGraphFn(sel[i].graphConfig, q.graphConfig);
        }
        return base;
      });
      return { label, questions, classSection: s };
    });
    classSectionVersions[s] = (masterLocked && masterVersion)
      ? [{ ...masterVersion, classSection: s }, ...sectionVariants]
      : sectionVariants;
  }

  return { classSectionVersions, versions: classSectionVersions[1] || [] };
}
