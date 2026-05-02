// ─── Math text → OMML (Word native math) converter ───────────────────────────
import { normalizeUnicodeMath } from "../normalizeUnicodeMath";
import { latexCommandsToMini } from "./latexCommands.js";

export function mathToOmml(raw) {
  const s = normalizeUnicodeMath(latexCommandsToMini(String(raw ?? "")));

  // OMML builders
  const X = t => t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const oT = t => `<m:r><m:t xml:space="preserve">${X(t)}</m:t></m:r>`;
  const oSqrt = inner => `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${inner}</m:e></m:rad>`;
  const oSup = (base, exp) => `<m:sSup><m:e>${base}</m:e><m:sup>${exp}</m:sup></m:sSup>`;
  const oSub = (base, sub) => `<m:sSub><m:e>${base}</m:e><m:sub>${sub}</m:sub></m:sSub>`;
  const oFrac = (n, d) => `<m:f><m:num>${n}</m:num><m:den>${d}</m:den></m:f>`;
  const oInt = (a, b) => `<m:nary><m:naryPr><m:chr m:val="∫"/><m:limLoc m:val="subSup"/></m:naryPr><m:sub>${oT(a)}</m:sub><m:sup>${oT(b)}</m:sup><m:e>${oT(" ")}</m:e></m:nary>`;
  const oDelim = (begChr, endChr, inner) => `<m:d><m:dPr><m:begChr m:val="${begChr}"/><m:endChr m:val="${endChr}"/><m:grow/></m:dPr><m:e>${inner}</m:e></m:d>`;
  // lim with subscript: base="lim", sub="x→a" — built after renderSegment is defined
  const oLim = (varTo) => `__LIM__${varTo}__ENDLIM__`;

  // Step 1: replace Greek letters and symbols
  let w = s
    // Math inequalities/relations — text to symbols
    .replace(/!=/g, '≠')
    .replace(/<=(?!=)/g, '≤')
    .replace(/>=(?!=)/g, '≥')
    .replace(/->/g, '→')
    .replace(/\.\.\./g, '…')
    // Logical operators — text to symbols (Discrete Math)
    .replace(/\bNOT\s+([a-z])\b/g, '~$1')
    .replace(/\(NOT\s+([^)]+)\)/g, '(~$1)')
    .replace(/\b([a-z])\s+AND\s+([a-z])\b/g, '$1 ∧ $2')
    .replace(/\b([a-z])\s+OR\s+([a-z])\b/g, '$1 ∨ $2')
    .replace(/\btheta\b/gi, 'θ')
    .replace(/\bphi\b/gi, 'φ')
    .replace(/\brho\b/gi, 'ρ')
    .replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, 'π')
    .replace(/\balpha\b/gi, 'α')
    .replace(/\bbeta\b/gi, 'β')
    .replace(/\bgamma\b/gi, 'γ')
    .replace(/\bdelta\b/gi, 'δ')
    .replace(/\blambda\b/gi, 'λ')
    .replace(/\bsigma\b/gi, 'σ')
    .replace(/\binfinity\b/gi, '∞')
    .replace(/\binf\b/g, '∞')
    // vectors: <a,b> or <a,b,c> → ⟨a,b⟩ (must come before XML escaping)
    .replace(/<(-?[^<>]+(?:,[^<>]+)+)>/g, (_, inner) => `⟨${inner}⟩`);

  // Step 2: parse and build OMML directly
  // We'll do a single-pass conversion using a segment array
  // Each segment is either {type:'text', val} or {type:'sqrt'|'sup'|'frac'|'int', ...}

  // Process in priority order using replacements into a neutral token array
  // Use simple unique separator strings unlikely to appear in math text
  const SEP = '\x01';
  const tokens = [];

  function addToken(obj) { tokens.push(obj); return SEP + (tokens.length-1) + SEP; }

  // * → · (before tokenizing)
  w = w.replace(/\s*\*\s*/g, '·');

  // Script operators: L{expr}, F{expr}, Z{expr} — Laplace, Fourier, Z-transform
  // Must be handled BEFORE fn(x) and {expr} passes
  // Also handle L^{-1}{expr} — inverse Laplace (must come first)
  w = w.replace(/\b([LFZ])\^\{(-1)\}\{([^{}]+)\}/g,
    (_, op, exp, inner) => addToken({t:'script', op, sup:"-1", inner}));
  w = w.replace(/\b([LFZ])\{([^{}]+)\}/g,
    (_, op, inner) => addToken({t:'script', op, sup:null, inner}));

  // Stash fn(x) calls like f(x), g'(y), sin(x) — BEFORE exponent processing
  // so (f'(x))^2 becomes (TOKEN)^2 which exponent handler can match
  let prevFn;
  do {
    prevFn = w;
    w = w.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)('?)\(([^()]*)\)/g,
      (_, fn, prime, arg) => addToken({t:'text', val: `${fn}${prime}(${arg})`}));
  } while (w !== prevFn);

  // Stash digit·(expr) products like 4(s+2) so nested parens flatten before fraction pass
  let prevDP;
  do {
    prevDP = w;
    w = w.replace(/([0-9]+)\(([^()]+)\)/g,
      (_, coef, inner) => addToken({t:'text', val: `${coef}(${inner})`}));
  } while (w !== prevDP);

  // Process exponents FIRST (innermost), then sqrt can consume the results

  // (expr)^(n/m)
  let prev2;
  do {
    prev2 = w;
    w = w.replace(/(\([^()]+\)|\x01\d+\x01)\^\(([0-9]+)\/([0-9]+)\)/g,
      (_,base,n,d) => addToken({t:'sup', base, exp:`${n}/${d}`}));
    // (expr)^n
    w = w.replace(/(\([^()]+\)|\x01\d+\x01)\^(-?[0-9a-zA-Zα-ωθφ]+)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^(n/m)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\(([0-9]+)\/([0-9]+)\)/g,
      (_,base,n,d) => addToken({t:'sup', base, exp:`${n}/${d}`}));
    // x^(expr)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\(([^)]+)\)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^{expr}
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^\{([^}]+)\}/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    // x^2 or x^n
    w = w.replace(/([a-zA-Z0-9θφπα-ω])\^(-?[0-9]+(?:\.[0-9]+)?)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
    w = w.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g,
      (_,base,exp) => addToken({t:'sup', base, exp}));
  } while (w !== prev2);

  // Subscripts — mirrors the superscript handling above
  let prev2b;
  do {
    prev2b = w;
    // x_{expr}
    w = w.replace(/([a-zA-Z0-9θφπα-ω\x01\d+\x01])_\{([^}]+)\}/g,
      (_,base,sub) => addToken({t:'sub', base, sub}));
    // x_(expr)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])_\(([^)]+)\)/g,
      (_,base,sub) => addToken({t:'sub', base, sub}));
    // x_xx (multi-char, must come BEFORE single-char to greedy-match longer subs first)
    w = w.replace(/([a-zA-Z])_([a-zA-Z]{2,})/g,
      (_,base,sub) => addToken({t:'sub', base, sub}));
    // x_n (single digit)
    w = w.replace(/([a-zA-Z0-9θφπα-ω])_(-?[0-9]+(?:\.[0-9]+)?)/g,
      (_,base,sub) => addToken({t:'sub', base, sub}));
    // x_y (single letter)
    w = w.replace(/([a-zA-Z])_([a-zA-Z])/g,
      (_,base,sub) => addToken({t:'sub', base, sub}));
  } while (w !== prev2b);

  // NOW handle sqrt — fn calls and exponents already tokenized so parens are flat
  let prev;
  do {
    prev = w;
    w = w.replace(/sqrt\(([^()]*)\)/g, (_,inner) => addToken({t:'sqrt', inner}));
  } while (w !== prev);

  // lim as x->a  /  lim_{x->a}  /  lim x->a
  w = w.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)\s*of\b/gi,
    (_, v, a) => addToken({t:'lim', sub: v.trim() + '→' + a.trim()}));
  w = w.replace(/\blim(?:it)?\s*(?:as\s+)?([a-zA-Z])\s*(?:->|→|\\to)\s*([^\s,;.()]+)/gi,
    (_, v, a) => addToken({t:'lim', sub: v.trim() + '→' + a.trim()}));
  w = w.replace(/\blim\s*_\{([^}]+)\}/gi,
    (_, sub) => addToken({t:'lim', sub: sub.replace(/\\to/g,'→').replace(/->/g,'→')}));
  w = w.replace(/\\lim_\{([^}]+)\}/g,
    (_, sub) => addToken({t:'lim', sub: sub.replace(/\\to/g,'→').replace(/->/g,'→')}));

  // integral from a to b of
  w = w.replace(/integral from ([^\s]+) to ([^\s]+) of/gi,
    (_,a,b) => addToken({t:'int', a, b}));

  // (expr)/(b) fraction — horizontal bar (MUST come before delimiter processing)
  // Run iteratively to handle cases where exponent pass produces (TOKEN+x) denominators
  let prevFrac;
  do {
    prevFrac = w;

    // (expr)/(expr) — both sides single-level parens
    w = w.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // TOKEN/TOKEN
    w = w.replace(/(\x01\d+\x01)\/(\x01\d+\x01)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // (expr)/TOKEN — parenthesized numerator over tokenized denominator
    w = w.replace(/\(([^()]+)\)\/(\x01\d+\x01)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // TOKEN/(expr) — tokenized numerator over parenthesized denominator
    w = w.replace(/(\x01\d+\x01)\/\(([^()]+)\)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // number/(expr) or letter/(expr) — e.g. 1/(s+3)
    w = w.replace(/\b([a-zA-Z0-9]+)\/\(([^()]+)\)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // number/TOKEN or letter/TOKEN — e.g. 4/s^3, 6/TOKEN
    w = w.replace(/\b([a-zA-Z0-9]+)\/(\x01\d+\x01)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // (expr)/number — e.g. (s+2)/3
    w = w.replace(/\(([^()]+)\)\/([0-9]+)\b/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // compound numerator: digit·TOKEN/TOKEN  e.g. 4TOKEN/TOKEN (4 followed by stashed (s+2))
    w = w.replace(/([0-9]+(?:\x01\d+\x01)+)\/(\x01\d+\x01)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

    // compound numerator: digit·TOKEN/(expr)
    w = w.replace(/([0-9]+(?:\x01\d+\x01)+)\/\(([^()]+)\)/g,
      (_,n,d) => addToken({t:'frac', n, d}));

  } while (w !== prevFrac);

  // (a)/[b] or TOKEN/[b] fraction — square bracket denominator
  w = w.replace(/(\([^()]+\)|\x01\d+\x01)\/\[([^\[\]]*(?:\x01\d+\x01[^\[\]]*)*)\]/g,
    (_,n,d) => addToken({t:'frac', n: n.replace(/^\(|\)$/g,''), d}));

  // simple/[b] fraction
  w = w.replace(/([a-zA-Z0-9]+)\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // [a]/[b] fraction
  w = w.replace(/\[([^\[\]]+)\]\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/bare-letter — e.g. 4/s, 1/s
  w = w.replace(/\b([0-9]+)\/([a-zA-Z])\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/number
  w = w.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // (a)/[b] or TOKEN/[b] fraction — square bracket denominator
  w = w.replace(/(\([^()]+\)|\x01\d+\x01)\/\[([^\[\]]*(?:\x01\d+\x01[^\[\]]*)*)\]/g,
    (_,n,d) => addToken({t:'frac', n: n.replace(/^\(|\)$/g,''), d}));

  // simple/[b] fraction
  w = w.replace(/([a-zA-Z0-9]+)\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // [a]/[b] fraction
  w = w.replace(/\[([^\[\]]+)\]\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/bare-letter — e.g. 4/s, 1/s (no exponent or parens on denominator)
  w = w.replace(/\b([0-9]+)\/([a-zA-Z])\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/number
  w = w.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // Auto-scaling delimiters: {expr} — curly braces (AFTER fractions)
  let prevD;
  do {
    prevD = w;
    w = w.replace(/\{([^{}]*)\}/g, (_, inner) => addToken({t:'delim', beg:'{', end:'}', inner}));
  } while (w !== prevD);

  // Auto-scaling parentheses — only when content contains a fraction token
  // Exception: standalone numeric fractions (1/2) don't need parentheses
  let prevP;
  do {
    prevP = w;
    w = w.replace(/\(([^()]*\x01\d+\x01[^()]*)\)/g, (_, inner) => {
      const parts = inner.split(/\x01(\d+)\x01/);
      const tokenIndices = [];
      parts.forEach((p, i) => { if (i % 2 === 1) tokenIndices.push(parseInt(p)); });
      const hasFrac = tokenIndices.some(i => tokens[i]?.t === 'frac');
      if (!hasFrac) return `(${inner})`;
      // Standalone numeric fraction: only a frac token, nothing else
      const isStandalone = parts.every((p, i) => i % 2 === 0 ? p.trim() === '' : true)
        && tokenIndices.length === 1 && tokens[tokenIndices[0]]?.t === 'frac';
      if (isStandalone) return `\x01${tokenIndices[0]}\x01`; // just the fraction, no parens
      return addToken({t:'delim', beg:'(', end:')', inner});
    });
  } while (w !== prevP);

  // Second pass: auto-scale outer parens wrapping delim/sup tokens (handles nested like ((s-1)(s^2+4)))
  let prevP2;
  do {
    prevP2 = w;
    w = w.replace(/\(([^()]*\x01\d+\x01[^()]*)\)/g, (_, inner) => {
      const parts = inner.split(/\x01(\d+)\x01/);
      const tokenIndices = [];
      parts.forEach((p, i) => { if (i % 2 === 1) tokenIndices.push(parseInt(p)); });
      const hasScalable = tokenIndices.some(i => tokens[i] && ['frac','delim','sup','sqrt'].includes(tokens[i].t));
      if (!hasScalable) return `(${inner})`;
      return addToken({t:'delim', beg:'(', end:')', inner});
    });
  } while (w !== prevP2);

  // (a)/[b] or TOKEN/[b] fraction — square bracket denominator
  w = w.replace(/(\([^()]+\)|\x01\d+\x01)\/\[([^\[\]]*(?:\x01\d+\x01[^\[\]]*)*)\]/g,
    (_,n,d) => addToken({t:'frac', n: n.replace(/^\(|\)$/g,''), d}));

  // simple/[b] fraction
  w = w.replace(/([a-zA-Z0-9]+)\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // [a]/[b] fraction
  w = w.replace(/\[([^\[\]]+)\]\/\[([^\[\]]+)\]/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // number/number
  w = w.replace(/\b([0-9]+)\/([0-9]+)\b/g,
    (_,n,d) => addToken({t:'frac', n, d}));

  // Now render: split w by SEP tokens and build OMML
  function renderToken(idx) {
    const tok = tokens[idx];
    if (!tok) return oT('?');
    if (tok.t === 'text') return oT(tok.val);
    if (tok.t === 'script') {
      // L{inner} or L^{-1}{inner} — render inner through full pipeline
      const innerOmml = mathToOmml(tok.inner);
      // Extract the inner m:oMath content
      const innerContent = innerOmml.replace(/^<m:oMath>|<\/m:oMath>$/g, '');
      const opRun = oT(tok.op);
      const supRun = tok.sup ? oSup(oT(tok.op), oT(tok.sup)) : opRun;
      const lbrace = oT('{');
      const rbrace = oT('}');
      return (tok.sup ? oSup(oT(tok.op), oT(tok.sup)) : oT(tok.op)) + lbrace + innerContent + rbrace;
    }
    if (tok.t === 'sqrt') return oSqrt(renderSegment(tok.inner));
    if (tok.t === 'sup') return oSup(renderSegment(tok.base), renderSegment(tok.exp));
    if (tok.t === 'sub') return oSub(renderSegment(tok.base), renderSegment(tok.sub));
    if (tok.t === 'frac') return oFrac(renderSegment(tok.n), renderSegment(tok.d));
    if (tok.t === 'delim') return oDelim(tok.beg, tok.end, renderSegment(tok.inner));
    if (tok.t === 'int') return oInt(tok.a, tok.b);
    if (tok.t === 'lim') return oLim(tok.sub);
    return oT('?');
  }

  function renderSegment(seg) {
    if (!seg) return '';
    const parts = seg.split(/\x01(\d+)\x01/);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { if (parts[i]) out += oT(parts[i]); }
      else out += renderToken(parseInt(parts[i]));
    }
    return out;
  }

  let inner = renderSegment(w);
  // Resolve lim placeholders now that renderSegment is available
  inner = inner.replace(/__LIM__(.*?)__ENDLIM__/g, (_, varTo) =>
    `<m:limLow><m:e><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t xml:space="preserve">lim</m:t></m:r></m:e><m:lim>${renderSegment(varTo)}</m:lim></m:limLow>`
  );
  // Strip any leaked control characters that would break XML
  const clean = inner.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return `<m:oMath>${clean}</m:oMath>`;
}
