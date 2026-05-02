// ─── Math → HTML converters (KaTeX-style \(...\) and Canvas equation_image) ──
import { normalizeUnicodeMath } from "../normalizeUnicodeMath";
import { toLatex, toLatexForCanvas } from "./toLatex.js";
import { latexCommandsToMini } from "./latexCommands.js";
import { isPipeTable, normalizePipeTable, splitTableBlocks } from "../exports/helpers.js";

// ─── Math → HTML (for Canvas QTI display) ────────────────────────────────────
export function mathToHTMLInline(s) {
  let r = normalizeUnicodeMath(latexCommandsToMini(String(s ?? "")));

  // ── Script operators: L{f(t)}, F{f(t)}, Z{f(t)} — Laplace, Fourier, Z-transform ──
  r = r.replace(/\b([LFZ])\^\{-1\}\{([^{}]+)\}/g, (_, op, inner) => {
    const rendered = inner.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, (__, b, e) => `${b}<sup>${e}</sup>`);
    return `<i>${op}</i><sup>-1</sup>{${rendered}}`;
  });
  r = r.replace(/\b([LFZ])\{([^{}]+)\}/g, (_, op, inner) => {
    const rendered = inner.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, (__, b, e) => `${b}<sup>${e}</sup>`);
    return `<i>${op}</i>{${rendered}}`;
  });

  // ── Inline math notation in prose — italicize variables and render exponents ──
  // Covers: y=x, x=2, y=x^2, y=e^x, y=ln(x), y=sin(x), etc.
  // Only triggers on known coordinate/function variable names, not prose words

  // y=f(x) style: y=sin(x), y=ln(x), y=e^x, y=x^2, y=sqrt(x), y=|x|
  r = r.replace(/(?<![a-zA-Z])([xyz])\s*=\s*(e\^(?:\{[^}]+\}|-?[0-9a-zA-Z()+\-*/]+)|(?:sin|cos|tan|ln|log|exp|sqrt|csc|sec|cot|arcsin|arccos|arctan)\s*\(?\s*[^,;.!?)\s]+\s*\)?|[xyz](?:\^(?:\{[^}]+\}|-?[0-9a-zA-Z]+))?|[0-9]+(?:\.[0-9]+)?|\|[^|]+\|)(?![a-zA-Z(])/g, (_, lhs, rhs) => {
    const rhsHtml = rhs
      .replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
      .replace(/\^(-?[0-9a-zA-Z()]+)/g, '<sup>$1</sup>');
    return `<i>${lhs}</i>=${rhsHtml}`;
  });

  // Standalone coordinate constraints: x=0, x=2, y=0 (e.g. "bounded by y=0, x=2")
  r = r.replace(/(?<![a-zA-Z=])([xyz])\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)(?![a-zA-Z0-9])/g,
    (_, lhs, rhs) => `<i>${lhs}</i>=${rhs}`);

  // ── Logical operators (text → symbol, for Discrete Math) ──
  // Must do before other replacements to avoid partial matches
  r = r.replace(/\bNOT\s+([a-z])\b/g, '~$1');
  r = r.replace(/\b([a-z])\s+AND\s+([a-z])\b/g, '$1 &and; $2');
  r = r.replace(/\b([a-z])\s+OR\s+([a-z])\b/g, '$1 &or; $2');
  r = r.replace(/\(NOT\s+([^)]+)\)/g, '(~$1)');

  // Symbols already in text — pass through as HTML entities
  r = r.replace(/∧/g, '∧');
  r = r.replace(/∨/g, '∨');
  r = r.replace(/~/g, '~');
  r = r.replace(/→/g, '→');
  r = r.replace(/↔/g, '↔');

  // Set notation — Unicode directly
  r = r.replace(/\bunion\b/gi, '∪');
  r = r.replace(/\bintersect(?:ion)?\b/gi, '∩');
  r = r.replace(/\bsubset\b/gi, '⊂');
  r = r.replace(/\bin\b(?=\s)/g, '∈');

  // Greek letters — Unicode directly for Canvas compatibility
  r = r.replace(/\btheta\b/gi, 'θ');
  r = r.replace(/\bphi\b/gi, 'φ');
  r = r.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, 'π');
  r = r.replace(/\brho\b/gi, 'ρ');
  r = r.replace(/\balpha\b/gi, 'α');
  r = r.replace(/\bbeta\b/gi, 'β');
  r = r.replace(/\bgamma\b/gi, 'γ');
  r = r.replace(/\bdelta\b/gi, 'δ');
  r = r.replace(/\blambda\b/gi, 'λ');
  r = r.replace(/\bsigma\b/gi, 'σ');
  r = r.replace(/\bmu\b/gi, 'μ');
  r = r.replace(/\binfinity\b/gi, '∞');
  r = r.replace(/\binf\b/g, '∞');

  // sqrt — use Unicode √ directly so Canvas renders correctly
  let prev;
  do {
    prev = r;
    r = r.replace(/sqrt\(([^()]+)\)/g, (_, inner) => `√(${inner})`);
  } while (r !== prev);

  // integral
  r = r.replace(/\bdouble\s+integral\s+(.+?)\s+d([a-z])\s*d([a-z])\b/gi,
    (_,f,v1,v2) => `∬${f} d${v1} d${v2}`);
  r = r.replace(/\btriple\s+integral\s+(.+?)\s+d([a-z])\s*d([a-z])\s*d([a-z])\b/gi,
    (_,f,v1,v2,v3) => `∭${f} d${v1} d${v2} d${v3}`);
  r = r.replace(/integral from ([^\s]+) to ([^\s]+) of/gi,
    (_, a, b) => `∫<sub>${a}</sub><sup>${b}</sup>`);
  r = r.replace(/\bintegral of\b/gi, '∫');

  // inequality symbols — use Unicode directly
  r = r.replace(/!=/g, '≠');
  r = r.replace(/(?<![<>])<=(?![>])/g, '≤');
  r = r.replace(/(?<![<>])>=(?![<])/g, '≥');

  // lim as x->a  /  \lim_{x->a}  /  lim_{x→a}
  r = r.replace(/\\lim_\{([^}]+)\}/g,
    (_, sub) => `lim<sub>${sub.replace(/\\to/g,'→').replace(/->/g,'→')}</sub>`);
  r = r.replace(/\blim_\{([^}]+)\}/gi,
    (_, sub) => `lim<sub>${sub.replace(/\\to/g,'→').replace(/->/g,'→')}</sub>`);
  r = r.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)\s*of\b/gi,
    (_, v, a) => `lim<sub>${v}&rarr;${a}</sub>`);
  r = r.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)/gi,
    (_, v, a) => `lim<sub>${v}&rarr;${a}</sub>`);

  // exponents
  r = r.replace(/\(([^()]+)\)\^\(([0-9-]+)\/([0-9]+)\)/g,
    (_, b, n, d) => `(${b})<sup>${n}/${d}</sup>`);
  r = r.replace(/\(([^()]+)\)\^(-?[0-9a-zA-Z]+)/g,
    (_, b, e) => `(${b})<sup>${e}</sup>`);
  r = r.replace(/([a-zA-Z0-9])\^\(([0-9-]+)\/([0-9]+)\)/g,
    (_, b, n, d) => `${b}<sup>${n}/${d}</sup>`);
  r = r.replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g,
    (_, b, e) => `${b}<sup>${e}</sup>`);
  r = r.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g,
    (_, b, e) => `${b}<sup>${e}</sup>`);

  // fractions — keep as plain / for Canvas (frasl entity not reliably rendered)
  r = r.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,
    (_, n, d) => `(${n})/(${d})`);
  r = r.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_, n, d) => `${n}/${d}`);

  // vectors: <a,b> or <a,b,c> → ⟨a,b⟩ (must come BEFORE <= and >= replacements)
  r = r.replace(/<(-?[^<>]+(?:,[^<>]+)+)>/g, (_, inner) => `⟨${inner}⟩`);

  // operators — Unicode directly for Canvas compatibility
  r = r.replace(/\*/g, '·');
  r = r.replace(/<=/g, '≤').replace(/>=/g, '≥');
  r = r.replace(/!=/g, '≠');

  return r;
}

export function mathToHTML(s) {
  const r = normalizeUnicodeMath(latexCommandsToMini(String(s ?? "")));

  // ── Pipe table → HTML table (must do FIRST before any other replacements) ──
  if (isPipeTable(r)) {
    const normalized = normalizePipeTable(r);
    const blocks = splitTableBlocks(normalized);
    return blocks.map(block => {
      if (block.type !== "table") return toLatex(block.content);
      // Convert pipe table to HTML table
      const lines = block.content.split("\n").map(l => l.trim()).filter(Boolean);
      const rows = lines.filter(l => !/^\|[-\s|:]+\|$/.test(l))
        .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
      if (!rows.length) return "";
      const tableStyle = 'style="border-collapse:collapse;margin:8px 0;font-size:0.9em;"';
      const thStyle = 'style="border:1px solid #999;padding:4px 10px;background:#dde;text-align:center;font-weight:bold;"';
      const tdStyle = 'style="border:1px solid #ccc;padding:4px 10px;text-align:center;"';
      const tdFirstStyle = 'style="border:1px solid #ccc;padding:4px 10px;font-weight:bold;background:#eef;"';
      const htmlRows = rows.map((row, ri) =>
        `<tr>${row.map((cell, ci) => {
          const tag = ri === 0 ? "th" : "td";
          const style = ri === 0 ? thStyle : ci === 0 ? tdFirstStyle : tdStyle;
          return `<${tag} ${style}>${toLatex(cell)}</${tag}>`;
        }).join("")}</tr>`
      ).join("");
      return `<table ${tableStyle}><tbody>${htmlRows}</tbody></table>`;
    }).join("");
  }

  return toLatex(r);
}

// ─── Canvas QTI variant: equation_image <img> tags instead of \(...\) ────────
export function mathToCanvasHTML(s) {
  const r = normalizeUnicodeMath(String(s ?? ""));
  if (isPipeTable(r)) {
    const normalized = normalizePipeTable(r);
    const blocks = splitTableBlocks(normalized);
    return blocks.map(block => {
      if (block.type !== "table") return toLatexForCanvas(block.content);
      const lines = block.content.split("\n").map(l => l.trim()).filter(Boolean);
      const rows = lines.filter(l => !/^\|[-\s|:]+\|$/.test(l))
        .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
      if (!rows.length) return "";
      const tableStyle = 'style="border-collapse:collapse;margin:8px 0;font-size:0.9em;"';
      const thStyle = 'style="border:1px solid #999;padding:4px 10px;background:#dde;text-align:center;font-weight:bold;"';
      const tdStyle = 'style="border:1px solid #ccc;padding:4px 10px;text-align:center;"';
      const tdFirstStyle = 'style="border:1px solid #ccc;padding:4px 10px;font-weight:bold;background:#eef;"';
      const htmlRows = rows.map((row, ri) =>
        `<tr>${row.map((cell, ci) => {
          const tag = ri === 0 ? "th" : "td";
          const style = ri === 0 ? thStyle : ci === 0 ? tdFirstStyle : tdStyle;
          return `<${tag} ${style}>${toLatexForCanvas(cell)}</${tag}>`;
        }).join("")}</tr>`
      ).join("");
      return `<table ${tableStyle}><tbody>${htmlRows}</tbody></table>`;
    }).join("");
  }
  return toLatexForCanvas(r);
}
