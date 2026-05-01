// Pure utility functions shared across hooks and TestBankApp.js
import { isExpressionValid } from "./exprCompile.js";

// Field names that hold a SINGLE math expression inside any graph config.
// When validation walks a graphConfig (recursively, so it covers nested
// boundaries / segments / etc.), any string-valued entry under one of
// these keys is required to be a parseable expression — never natural
// language and never a comma-separated tuple.
const _EXPR_FIELD_NAMES = new Set([
  "fx", "fy", "expr", "xExpr", "yExpr", "zExpr", "expression", "rExpr",
]);

// Tokens that the AI sometimes drops into expression fields when it
// treats them as descriptions instead of math ("fx: '-2x or y'", "fx:
// 'either x or sin(x)'"). These never compile and lead to ugly fallback
// text in the docx; flag them with the bad value so the message is
// actionable.
const _NATURAL_LANGUAGE_RE = /\b(or|either|nor|select|with)\b/i;

// Walk an object (graphConfig or any nested object/array within it) and
// flag every string-valued entry under one of the expression field names
// that contains natural-language tokens or a comma. The "and" token is
// only flagged when it stands as a connector — bare "and" is rare in
// math expressions but common in prose.
function _flagBadExprFields(node, prefix, issues) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => _flagBadExprFields(item, `${prefix}[${i}]`, issues));
    return;
  }
  for (const [key, val] of Object.entries(node)) {
    if (typeof val === "string" && _EXPR_FIELD_NAMES.has(key)) {
      const trimmed = val.trim();
      if (!trimmed) {
        issues.push(`${prefix}${key} is empty`);
        continue;
      }
      if (_NATURAL_LANGUAGE_RE.test(trimmed) || /\b(and)\b/i.test(trimmed)) {
        issues.push(`${prefix}${key} contains natural language ("${val}") — must be a single math expression`);
        continue;
      }
      if (trimmed.includes(",")) {
        issues.push(`${prefix}${key} contains a comma ("${val}") — must be a single math expression, not a tuple`);
        continue;
      }
      if (/[<>]/.test(trimmed)) {
        issues.push(`${prefix}${key} contains angle brackets ("${val}") — write the scalar component, not the whole vector`);
        continue;
      }
    }
    if (val && typeof val === "object") {
      _flagBadExprFields(val, `${prefix}${key}.`, issues);
    }
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Strip a leading choice label like "A) ", "B.", "(c)", "d:" off a stored
// choice string. Renderers prepend their own letter (A./B./...), so we never
// want a stale prefix bleeding through. Used at every choice render site
// and inside sanitize() paths so newly imported data lands clean too.
//
// Non-string choices (graph-choice objects) pass through unchanged so the
// caller can detect them via isGraphChoice and route them to the graph
// renderer.
export function stripChoiceLabel(s) {
  if (typeof s !== "string") return s;
  return s.replace(/^\s*\(?[A-Ha-h][\)\.\:]\s*/, "").trim();
}

// A choice may be either a plain string or a graph-bearing object of shape
// { graphConfig: {...} }. Renderers branch on this discriminator before
// touching the value.
export function isGraphChoice(c) {
  return !!(c && typeof c === "object" && c.graphConfig);
}

export function sectionSortKey(section) {
  const m = String(section || "").match(/([A-Za-z]?)(\d+)\.(\d+)/);
  if (!m) return [999, 999];
  const prefix = m[1] ? m[1].charCodeAt(0) - 64 : 0;
  return [prefix * 1000 + parseInt(m[2]), parseInt(m[3])];
}

export function questionSimilarity(a, b) {
  const textA = String(a.question || "").toLowerCase().trim();
  const textB = String(b.question || "").toLowerCase().trim();
  if (!textA || !textB) return 0;
  const wordsA = new Set(textA.split(/\W+/).filter(w => w.length > 3));
  const wordsB = new Set(textB.split(/\W+/).filter(w => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// Allowed surface hint values — kept in sync with SurfaceGraph.js
const _SURFACE_HINTS = ["paraboloid", "saddle", "plane", "cone", "sphere"];
const _REGION_KINDS  = ["function", "function_y", "line", "circle"];
const _PATH_KINDS    = ["function", "function_y", "line", "circle", "parametric"];
const _NEW_GRAPH_TYPES = ["vectorField", "contour", "region", "parametric", "surface", "path"];

// Shared validator for path-style segments — used both as choice config and
// as a top-level graphConfig. `prefix` is prepended to each issue so callers
// can disambiguate (e.g. "Choice A: " vs "Graph: ").
function _validatePathConfig(cfg, issues, prefix = "") {
  if (!Array.isArray(cfg.segments) || cfg.segments.length < 1) {
    issues.push(`${prefix}path must have at least 1 segment`);
    return;
  }
  cfg.segments.forEach((s, si) => {
    if (!s || !_PATH_KINDS.includes(s.kind)) {
      issues.push(`${prefix}segment ${si} has invalid kind`);
      return;
    }
    if (s.kind === "function" && !isExpressionValid(s.expr, ["x"])) {
      issues.push(`${prefix}segment ${si} has invalid function expression`);
    }
    if (s.kind === "function_y" && !isExpressionValid(s.expr, ["y"])) {
      issues.push(`${prefix}segment ${si} has invalid function_y expression`);
    }
    if (s.kind === "line" && (!Array.isArray(s.from) || !Array.isArray(s.to) || s.from.length < 2 || s.to.length < 2)) {
      issues.push(`${prefix}segment ${si} line missing from/to`);
    }
    if (s.kind === "circle" && !(Number(s.radius) > 0)) {
      issues.push(`${prefix}segment ${si} circle has invalid radius`);
    }
    if (s.kind === "parametric") {
      if (!isExpressionValid(s.xExpr, ["t"])) issues.push(`${prefix}segment ${si} invalid xExpr`);
      if (!isExpressionValid(s.yExpr, ["t"])) issues.push(`${prefix}segment ${si} invalid yExpr`);
      if (!Number.isFinite(Number(s.tFrom)) || !Number.isFinite(Number(s.tTo))) {
        issues.push(`${prefix}segment ${si} parametric missing tFrom/tTo`);
      }
    }
  });
  if (cfg.endpoints != null) {
    if (!Array.isArray(cfg.endpoints) || !cfg.endpoints.every(e => e && Array.isArray(e.at) && e.at.length >= 2 && Number.isFinite(Number(e.at[0])) && Number.isFinite(Number(e.at[1])))) {
      issues.push(`${prefix}endpoints must be array of { at: [x, y], ... }`);
    }
  }
}

export function validateQuestion(q) {
  const issues = [];
  if (!q) return ["Empty question object"];

  const qText = q.question;
  if (!qText || !String(qText).trim()) issues.push("Question text is empty");

  if (q.type !== "Free Response" && q.type !== "Branched Free Response") {
    if (!q.answer && q.answer !== 0) issues.push("Answer is empty");
  }

  if (q.type === "Multiple Choice" || q.type === "True/False") {
    const choices = q.choices || [];
    const hasGraphChoices = choices.some(isGraphChoice);

    // Catch the schema corruption mode where the version-mutation prompt
    // came back with some choices as graphConfig objects and some as
    // strings (or all strings that contain the literal "[graph: ...]" the
    // prompt used to embed the originals). Word export can't render mixed
    // choices and the question is unusable until regenerated.
    if (choices.length > 0) {
      const graphCount  = choices.filter(c => c && typeof c === "object" && c.graphConfig).length;
      const stringCount = choices.filter(c => typeof c === "string").length;
      if (graphCount > 0 && graphCount !== choices.length) {
        issues.push(`Mixed choice types: graph-choice MCQs must have all ${choices.length} choices as {graphConfig: {...}} objects, found ${graphCount} graph and ${stringCount} text`);
      }
      // String choices that look like the prompt's [graph: ...] placeholder
      // mean the model echoed the prompt back instead of producing real
      // graph configs — flag explicitly so the user knows to regenerate.
      const echoedPlaceholder = choices.some(c =>
        typeof c === "string" && /^\s*\[?\s*graph\s*:/i.test(c));
      if (echoedPlaceholder) {
        issues.push("One or more choices contain the literal '[graph: ...]' prompt placeholder — the version was generated with the old prompt; regenerate this version");
      }
    }

    if (q.answer && choices.length && !hasGraphChoices) {
      // String-only choices — answer must match one of them
      if (!choices.includes(q.answer)) {
        issues.push("Correct answer does not match any choice");
      }
    }
    if (hasGraphChoices && q.answer != null && String(q.answer).trim() !== "") {
      // Graph-choice MCQs store the answer as a single letter A–H
      if (!/^[A-Ha-h]$/.test(String(q.answer).trim())) {
        issues.push("For graph-choice questions, answer must be a single letter (A/B/C/D)");
      } else {
        const idx = String(q.answer).trim().toUpperCase().charCodeAt(0) - 65;
        if (idx < 0 || idx >= choices.length) {
          issues.push(`Answer letter ${q.answer} has no matching choice`);
        }
      }
    }

    // Duplicate detection — only meaningful for string choices
    const normalizeChoice = (c) => String(c ?? "")
      .trim().toLowerCase()
      .replace(/\[()[\]]/g, "").replace(/\s+/g, " ")
      .replace(/\frac\{(\d+)\}\{(\d+)\}/g, (_, n, d) => `${n}/${d}`)
      .replace(/\^2/g, "²").replace(/\^3/g, "³")
      .replace(/\s*([+\-*/=])\s*/g, "$1");
    const seen = new Map();
    choices.forEach((c, i) => {
      if (isGraphChoice(c)) return; // skip dedup on graph choices
      const norm = normalizeChoice(c);
      if (seen.has(norm)) {
        issues.push(`Choices ${String.fromCharCode(65 + seen.get(norm))} and ${String.fromCharCode(65 + i)} are duplicate or equivalent`);
      } else { seen.set(norm, i); }
    });
    if (choices.length < 2) issues.push("Question has fewer than 2 choices");

    // Per-choice graph validation
    choices.forEach((c, i) => {
      if (!isGraphChoice(c)) return;
      const letter = String.fromCharCode(65 + i);
      const cfg = c.graphConfig;
      if (!cfg.graphType) {
        issues.push(`Choice ${letter}: missing graphType`);
        return;
      }
      // Catch natural-language / comma / angle-bracket pollution in any
      // expression field anywhere in the choice's graphConfig before the
      // type-specific structural checks below — gives a more precise
      // error than "invalid fx expression".
      _flagBadExprFields(cfg, `Choice ${letter}: `, issues);
      if (cfg.graphType === "vectorField") {
        if (!isExpressionValid(cfg.fx, ["x", "y"])) issues.push(`Choice ${letter}: invalid fx expression`);
        if (!isExpressionValid(cfg.fy, ["x", "y"])) issues.push(`Choice ${letter}: invalid fy expression`);
        if (!Array.isArray(cfg.xRange) || cfg.xRange.length !== 2 || !(cfg.xRange[0] < cfg.xRange[1])) {
          issues.push(`Choice ${letter}: xRange must be a 2-element array with range[0] < range[1]`);
        }
        if (!Array.isArray(cfg.yRange) || cfg.yRange.length !== 2 || !(cfg.yRange[0] < cfg.yRange[1])) {
          issues.push(`Choice ${letter}: yRange must be a 2-element array with range[0] < range[1]`);
        }
        if (cfg.gridDensity != null) {
          const d = Number(cfg.gridDensity);
          if (!Number.isFinite(d) || d < 3 || d > 9) {
            issues.push(`Choice ${letter}: gridDensity must be between 3 and 9`);
          }
        }
      } else if (cfg.graphType === "contour") {
        if (!isExpressionValid(cfg.expression, ["x", "y"])) {
          issues.push(`Choice ${letter}: invalid contour expression`);
        }
        if (!Array.isArray(cfg.levels) || cfg.levels.length === 0) {
          issues.push(`Choice ${letter}: contour levels must be a non-empty array`);
        } else if (!cfg.levels.every(l => Number.isFinite(Number(l)))) {
          issues.push(`Choice ${letter}: contour levels must all be finite numbers`);
        }
        if (cfg.resolution != null) {
          const r = Number(cfg.resolution);
          if (!Number.isFinite(r) || r < 30 || r > 150) {
            issues.push(`Choice ${letter}: resolution must be between 30 and 150`);
          }
        }
      } else if (cfg.graphType === "region") {
        if (!Array.isArray(cfg.boundaries) || cfg.boundaries.length < 2) {
          issues.push(`Choice ${letter}: region must have at least 2 boundaries`);
        } else {
          cfg.boundaries.forEach((b, bi) => {
            if (!b || !_REGION_KINDS.includes(b.kind)) {
              issues.push(`Choice ${letter}: boundary ${bi} has invalid kind`);
              return;
            }
            if (b.kind === "function" && !isExpressionValid(b.expr, ["x"])) {
              issues.push(`Choice ${letter}: boundary ${bi} has invalid function expression`);
            }
            if (b.kind === "function_y" && !isExpressionValid(b.expr, ["y"])) {
              issues.push(`Choice ${letter}: boundary ${bi} has invalid function_y expression`);
            }
            if (b.kind === "circle" && !(Number(b.radius) > 0)) {
              issues.push(`Choice ${letter}: boundary ${bi} circle has invalid radius`);
            }
            if (b.kind === "line" && (!Array.isArray(b.from) || !Array.isArray(b.to) || b.from.length < 2 || b.to.length < 2)) {
              issues.push(`Choice ${letter}: boundary ${bi} line missing from/to`);
            }
          });
        }
        if (cfg.vertices != null) {
          if (!Array.isArray(cfg.vertices) || !cfg.vertices.every(v => Array.isArray(v) && v.length >= 2 && Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1])))) {
            issues.push(`Choice ${letter}: vertices must be array of [x, y] pairs`);
          }
        }
      } else if (cfg.graphType === "parametric") {
        const dim = cfg.dimensions === 3 ? 3 : 2;
        if (!isExpressionValid(cfg.xExpr, ["t"])) issues.push(`Choice ${letter}: invalid xExpr`);
        if (!isExpressionValid(cfg.yExpr, ["t"])) issues.push(`Choice ${letter}: invalid yExpr`);
        if (dim === 3 && !isExpressionValid(cfg.zExpr, ["t"])) issues.push(`Choice ${letter}: invalid zExpr`);
        if (!Array.isArray(cfg.tRange) || cfg.tRange.length !== 2 || !(cfg.tRange[0] < cfg.tRange[1])) {
          issues.push(`Choice ${letter}: tRange must be a 2-element array with start < end`);
        }
        if (cfg.samples != null) {
          const s = Number(cfg.samples);
          if (!Number.isFinite(s) || s < 50 || s > 500) {
            issues.push(`Choice ${letter}: samples must be between 50 and 500`);
          }
        }
      } else if (cfg.graphType === "surface") {
        if (!isExpressionValid(cfg.expression, ["x", "y"])) {
          issues.push(`Choice ${letter}: invalid surface expression`);
        }
        if (cfg.meshDensity != null) {
          const m = Number(cfg.meshDensity);
          if (!Number.isFinite(m) || m < 6 || m > 20) {
            issues.push(`Choice ${letter}: meshDensity must be between 6 and 20`);
          }
        }
        if (cfg.hint != null && !_SURFACE_HINTS.includes(cfg.hint)) {
          issues.push(`Choice ${letter}: hint must be one of ${_SURFACE_HINTS.join(", ")}`);
        }
      } else if (cfg.graphType === "path") {
        _validatePathConfig(cfg, issues, `Choice ${letter}: `);
      }
    });
  }

  if (q.type === "Formula") {
    if (!q.answerFormula) issues.push("Formula question missing answerFormula");
    if (!q.variables || !q.variables.length) issues.push("Formula question missing variables");
  }

  if (q.type === "Branched Free Response") {
    const text = String(q.question || "");
    if (!/\(a\)/i.test(text)) issues.push("Branched Free Response: question text missing (a) part marker");
    if (q.answer && !/\(a\)/i.test(String(q.answer))) issues.push("Branched Free Response: answer field missing (a) part labels");
  }

  if (q.hasGraph && !q.graphConfig) {
    issues.push("Question marked as having a graph but graphConfig is missing");
  }
  if (q.hasGraph && q.graphConfig) {
    const gc = q.graphConfig;
    // New-system graph configs use `graphType` instead of the old `type`.
    // Validate them with their own rules; the old-system checks below only
    // apply to D3-rendered configs (single / area / domain / multi / stat charts).
    if (_NEW_GRAPH_TYPES.includes(gc.graphType)) {
      _flagBadExprFields(gc, "Graph: ", issues);
      if (gc.graphType === "path") _validatePathConfig(gc, issues, "Graph: ");
      // Other new-system graphTypes are validated per-choice; top-level rules
      // for region/contour/etc. can be added here as needs arise.
      return issues;
    }
    if (!gc.type) issues.push("Graph missing type");
    if (gc.type === "single" && !gc.fn) issues.push("Single curve graph missing fn");
    if (gc.type === "area" && (!gc.fnTop || !gc.fnBottom)) issues.push("Area graph missing fnTop or fnBottom");
    if (gc.type === "domain" && !gc.boundary) issues.push("Domain graph missing boundary");
    if (gc.type === "piecewise" && (!gc.pieces || !gc.pieces.length)) issues.push("Piecewise graph missing pieces");
    if (gc.type === "multi" && (!gc.fns || !gc.fns.length)) issues.push("Multi graph missing fns array");
    if (gc.type === "bar") {
      if (!gc.labels || !gc.labels.length) issues.push("Bar chart missing labels");
      if (!gc.values || !gc.values.length) issues.push("Bar chart missing values");
      if (gc.labels && gc.values && gc.labels.length !== gc.values.length) issues.push("Bar chart labels and values length mismatch");
    }
    if (gc.type === "histogram" && (!gc.bins || !gc.bins.length)) issues.push("Histogram missing bins");
    if (gc.type === "scatter" && (!gc.points || !gc.points.length)) issues.push("Scatter plot missing points");
    if (gc.type === "discrete_dist" && (!gc.data || !gc.data.length)) issues.push("Discrete distribution missing data");
    if (gc.type === "continuous_dist" || gc.type === "standard_normal") {
      const dt = gc.distType || gc.type;
      if (!dt) issues.push("Continuous distribution missing distType");
      if ((dt === "normal" || dt === "standard_normal") && gc.sigma !== undefined && gc.sigma <= 0) issues.push("Normal distribution sigma must be > 0");
      if (dt === "exponential" && gc.lambda !== undefined && gc.lambda <= 0) issues.push("Exponential distribution lambda must be > 0");
      if (dt === "exponential" && gc.mu !== undefined && gc.mu <= 0) issues.push("Exponential distribution mu must be > 0");
      if (dt === "uniform" && gc.uMin !== undefined && gc.uMax !== undefined && gc.uMin >= gc.uMax) issues.push("Uniform distribution uMin must be < uMax");
    }
    if ((gc.xMin !== undefined && gc.xMax !== undefined) && gc.xMin >= gc.xMax) issues.push("Graph xMin must be less than xMax");
  }

  return issues;
}
