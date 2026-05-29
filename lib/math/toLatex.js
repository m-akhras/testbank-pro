import { normalizeUnicodeMath } from "../normalizeUnicodeMath.js";

function innerLatex(expr) {
  let e = normalizeUnicodeMath(String(expr ?? ""));
  e = e.replace(/\btheta\b/gi, '\\theta');
  e = e.replace(/\bphi\b/gi, '\\phi');
  e = e.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, '\\pi');
  // Powered/inverse trig: sin^-1, sin^(-1), sin^2, sin^{n} -> \sin^{...} (bare, braced).
  // Braced form dodges the ^( and ^digit passes below, so the function name is never split.
  e = e.replace(/(?<!\\)\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\^(\{[^}]+\}|\(-?\d+\)|-?\d+)/g,
    (_, fn, pow) => `\\${fn}^{${pow.replace(/^[({]|[)}]$/g, "")}}`);
  const toks = [];
  function stash2(v) { toks.push(v); return '\x03'+(toks.length-1)+'\x03'; }
  function unstash2(t) { return t.replace(/\x03(\d+)\x03/g, function(_,i){ return toks[parseInt(i)]; }); }
  let p1; do { p1=e; e=e.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)'?\(([^()]*)\)/g, function(m){ return stash2(m); }); } while(e!==p1);
  let p2; do { p2=e; e=e.replace(/\(([^()]+)\)\^(-?[0-9a-zA-Z]+)/g, function(m){ return stash2(m); }); } while(e!==p2);
  let p4; do { p4=e; e=e.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, function(m){ return stash2(m); }); } while(e!==p4);
  let p3;
  do { p3=e; e=e.replace(/sqrt\(([^()]*)\)/g, function(_,x){ return '\\sqrt{'+unstash2(x)+'}'; }); } while(e!==p3);
  e = unstash2(e);
  e = e.replace(/\(([^()]+)\)\^\((-?[0-9]+)\/([0-9]+)\)/g, function(_,b,n,d){ return '\\left('+b+'\\right)^{\\frac{'+n+'}{'+d+'}}'; });
  e = e.replace(/([a-zA-Z0-9])\^\((-?[0-9]+)\/([0-9]+)\)/g, function(_,b,n,d){ return b+'^{\\frac{'+n+'}{'+d+'}}'; });
  e = e.replace(/([a-zA-Z0-9])\^(-?[0-9]+)/g, function(_,b,x){ return b+'^{'+x+'}'; });
  e = e.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, function(_,n,d){ return '\\frac{'+n+'}{'+d+'}'; });
  e = e.replace(/\b([0-9]+)\/([0-9]+)\b/g, function(_,n,d){ return '\\frac{'+n+'}{'+d+'}'; });
  // (?<![a-zA-Z]) instead of \b so "2ln(2)", "3sin(x)" etc. also match
  e = e.replace(/(?<![a-zA-Z])(sin|cos|tan|sec|csc|cot|ln|log|arcsin|arccos|arctan|sinh|cosh|tanh)\(([^)]+)\)/g,
    (_,fn,arg) => `\\${fn}(${arg})`);
  // (?<!\\) prevents re-escaping \sin already produced above; (?!\() skips fn( handled above
  e = e.replace(/(?<!\\)\b(sin|cos|tan|sec|csc|cot|ln|log|arcsin|arccos|arctan|sinh|cosh|tanh)\b(?!\()/g,
    (_,fn) => '\\' + fn);
  return e;
}

// Form A — mini-syntax piecewise:  { expr if cond ; expr if cond ; ... }
// (separators: " if ", " for ", or ","). Emits a single self-wrapped
// \(\begin{cases}...\end{cases}\) block, running each piece through
// innerLatex() so the inner math is BARE LaTeX (no nested \(...\)). Must run
// AFTER toLatex's line-41 short-circuit but BEFORE the brace-consuming passes,
// otherwise the inner sqrt/^/etc. get individually wrapped and shatter the env.
// Conservative: only fires when the block parses as expr/condition pairs, so
// set notation like { 1, 2, 3 } and lone { x } are left untouched.
function piecewiseToCases(s) {
  return String(s).replace(/\{([^{}]+)\}/g, (whole, inner) => {
    const rules = inner.split(";").map(r => r.trim()).filter(Boolean);
    if (rules.length === 0) return whole;

    const REL = /(<=|>=|!=|<|>|=|≤|≥|≠)/;
    const parsed = [];
    for (const rule of rules) {
      const lower = rule.toLowerCase();
      let i = lower.indexOf(" if "), via = "if", seplen = 4;
      if (i === -1) { i = lower.indexOf(" for "); via = "for"; seplen = 5; }
      if (i === -1) { i = rule.indexOf(",");      via = "comma"; seplen = 1; }
      if (i === -1) return whole; // no expr/condition separator → not piecewise
      const expr = rule.slice(0, i).trim();
      const cond = rule.slice(i + seplen).trim();
      if (!expr || !cond) return whole;
      parsed.push({ expr, cond, via });
    }

    // Guard against ordinary braces: require a real if/for keyword OR a
    // condition that carries a relational operator.
    const looksPiecewise =
      parsed.some(p => p.via === "if" || p.via === "for") ||
      parsed.some(p => REL.test(p.cond));
    if (!looksPiecewise) return whole;

    const rows = parsed
      .map(p => `${innerLatex(p.expr)} & \\text{if } ${innerLatex(p.cond)}`)
      .join(" \\\\ ");
    return `\\(\\begin{cases} ${rows} \\end{cases}\\)`;
  });
}

// Form B — raw LaTeX \begin{cases}...\end{cases} the model may emit directly.
// Wrap each occurrence in \(...\) (single-lined) unless already wrapped, so the
// line-41 short-circuit returns it cleanly for KaTeX / Canvas equation_image.
// Backslash content would otherwise trip the short-circuit unwrapped/unrendered.
function wrapRawCases(s) {
  return String(s).replace(/\\begin\{cases\}[\s\S]*?\\end\{cases\}/g, (block, offset, full) => {
    const before = full.slice(0, offset).replace(/\s+$/, "");
    if (before.endsWith("\\(")) return block; // already wrapped — leave alone
    const singleLine = block.replace(/\s*\r?\n\s*/g, " ").trim();
    return `\\(${singleLine}\\)`;
  });
}

// Convert "*" to the correct multiplication glyph by context: \cdot when inside
// a \(...\) LaTeX block (a bare "·" U+00B7 is invalid in math mode and breaks
// KaTeX / Canvas equation_image re-parsing), "·" when outside math (where the
// text renders as plain HTML and "·" is the intended display glyph). Depth-aware
// so nested \(...\) (not yet flattened at call time) are handled. The trailing
// space after \cdot prevents it gluing onto a following letter (\cdotx).
function _convertMultiplicationStars(str) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "\\" && str[i + 1] === "(") { out += "\\("; i++; depth++; continue; }
    if (c === "\\" && str[i + 1] === ")") { out += "\\)"; i++; if (depth > 0) depth--; continue; }
    if (c === "*") { out += depth > 0 ? "\\cdot " : "·"; continue; }
    out += c;
  }
  return out;
}

export function toLatex(raw) {
  let s = normalizeUnicodeMath(String(raw ?? ""));

  // Form B: wrap any raw \begin{cases}...\end{cases} so the short-circuit below
  // returns it cleanly. Must run BEFORE line-41's `includes("\\(")` check.
  s = wrapRawCases(s);

  // Wrap any bare LaTeX commands (\dfrac{}{}, \sqrt{}, \int_{}^{}, ...)
  // *before* deciding whether to short-circuit. The walker is depth-aware
  // so it skips content already inside \(...\); without this pass, mixed
  // content like "\(x = 2\) divided by \dfrac{8}{3}" would hit the
  // short-circuit below and the bare \dfrac would render as plain text.
  s = _wrapRawLatexCommands(s);

  if (s.includes("\\(")) return s;

  // Form A: convert mini-syntax piecewise blocks { expr if cond ; ... } here —
  // past the short-circuit, but before the brace-consuming passes (~line 124+)
  // so the cases env is grabbed whole before its inner math is transformed.
  s = piecewiseToCases(s);

  // \in set-membership — only recognise with backslash prefix, never bare "in"
  s = s.replace(/\\in(?![a-zA-Z])/g, "\\(\\in\\)");

  const inf = "\\infty";
  const fix = x => x.replace(/\binf(inity)?\b/gi, inf).trim();

  s = s.replace(/\bdouble\s+integral\s+over\s+(\w+)\s+of\s+(.+?)\s+dA\b/gi,
    (_,region,f) => `\\(\\iint_{${region}} ${innerLatex(f)}\\,dA\\)`);

  // Fallback: AI sometimes omits "of" → "double integral over D f(x,y) dA"
  s = s.replace(/\bdouble\s+integral\s+over\s+(\w+)\s+(.+?)\s+dA\b/gi,
    (_,region,f) => `\\(\\iint_{${region}} ${innerLatex(f)}\\,dA\\)`);

  s = s.replace(/\btriple\s+integral\s+over\s+(\w+)\s+of\s+(.+?)\s+dV\b/gi,
    (_,region,f) => `\\(\\iiint_{${region}} ${innerLatex(f)}\\,dV\\)`);

  // Fallback: AI sometimes omits "of" → "triple integral over E f(x,y,z) dV"
  s = s.replace(/\btriple\s+integral\s+over\s+(\w+)\s+(.+?)\s+dV\b/gi,
    (_,region,f) => `\\(\\iiint_{${region}} ${innerLatex(f)}\\,dV\\)`);

  s = s.replace(/\bdouble\s+integral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+integral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+(.+?)\s+d([a-z])\s*d([a-z])\b/gi,
    (_,a,b,c,d,f,v1,v2) => `\\(\\int_{${fix(a)}}^{${fix(b)}}\\int_{${fix(c)}}^{${fix(d)}} ${innerLatex(f)}\\,d${v1}\\,d${v2}\\)`);

  s = s.replace(/\bdouble\s+integral\s+of\s+(.+?)\s+dA\b/gi,
    (_,f) => `\\(\\iint ${innerLatex(f)}\\,dA\\)`);

  s = s.replace(/\bdouble\s+integral\s+(.+?)\s+d([a-z])\s*d([a-z])\b/gi,
    (_,f,v1,v2) => `\\(\\iint ${innerLatex(f)}\\,d${v1}\\,d${v2}\\)`);

  s = s.replace(/\btriple\s+integral\s+(.+?)\s+d([a-z])\s*d([a-z])\s*d([a-z])\b/gi,
    (_,f,v1,v2,v3) => `\\(\\iiint ${innerLatex(f)}\\,d${v1}\\,d${v2}\\,d${v3}\\)`);

  // Nested single integrals: "integral from a to b of integral from c to d of f dv1 dv2"
  s = s.replace(/\bintegral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+integral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+(.+?)\s+d([a-z])\s*d([a-z])\b/gi,
    (_,a,b,c,d,f,v1,v2) => `\\(\\int_{${fix(innerLatex(a))}}^{${fix(innerLatex(b))}}\\int_{${fix(innerLatex(c))}}^{${fix(innerLatex(d))}} ${innerLatex(f)}\\,d${v1}\\,d${v2}\\)`);

  s = s.replace(/\bintegral\s+from\s+(\S+)\s+to\s+(\S+)\s+of\s+(.+?)\s+d([a-z])\b/gi,
    (_,a,b,f,v)=>`\\(\\int_{${fix(innerLatex(a))}}^{${fix(innerLatex(b))}} ${innerLatex(f)}\\,d${v}\\)`);
  s = s.replace(/\bintegral\s+of\s+(.+?)\s+d([a-z])\b/gi,
    (_,f,v)=>`\\(\\int ${innerLatex(f)}\\,d${v}\\)`);

  s = s.replace(/!=/g, '\\(\\neq\\)');
  s = s.replace(/(?<![<>])<=(?![>=])/g, '\\(\\leq\\)');
  s = s.replace(/(?<![<>])>=(?![<=])/g, '\\(\\geq\\)');

  // Set theory & composition: Unicode → wrapped LaTeX (Canvas equation_images need
  // commands, not glyphs). Runs on plain-authored text (Discrete authors raw ∪ ∩ ∈).
  s = s.replace(/∪/g, '\\(\\cup\\)');
  s = s.replace(/∩/g, '\\(\\cap\\)');
  s = s.replace(/⊆/g, '\\(\\subseteq\\)');
  s = s.replace(/⊂/g, '\\(\\subset\\)');
  s = s.replace(/∅/g, '\\(\\emptyset\\)');
  s = s.replace(/△/g, '\\(\\triangle\\)');
  s = s.replace(/−/g, '-');                 // U+2212 minus → ASCII hyphen (LaTeX-safe)
  s = s.replace(/∉/g, '\\(\\notin\\)');
  s = s.replace(/∈/g, '\\(\\in\\)');
  s = s.replace(/∘/g, '\\(\\circ\\)');
  // Interval union as bare "U" between closing/opening brackets only (Calc domain/range).
  // Guarded so a variable named U (e.g. "Let U be a set", "f: U → V") is never touched.
  s = s.replace(/([)\]])\s*U\s*([(\[])/g, '$1 \\(\\cup\\) $2');

  // Ellipsis
  s = s.replace(/\.\.\./g, "\\(\\ldots\\)");

  // Logical operators (Discrete Math): NOT x, x AND y, x OR y
  s = s.replace(/\(NOT\s+([^)]+)\)/g, (_,x)=>`\\(\\lnot(${x})\\)`);
  s = s.replace(/\bNOT\s+([a-z])\b/g, (_,x)=>`\\(\\lnot ${x}\\)`);
  s = s.replace(/\b([a-z])\s+AND\s+([a-z])\b/g, (_,a,b)=>`\\(${a} \\land ${b}\\)`);
  s = s.replace(/\b([a-z])\s+OR\s+([a-z])\b/g,  (_,a,b)=>`\\(${a} \\lor ${b}\\)`);

  // lim x->a without "as" — must come before the "lim as" patterns
  s = s.replace(/\blim(?:it)?\s+(?!as\b)([a-zA-Z,\s]+?)\s*(?:->|→|\\to)\s*([^\s,;.(]+)\s*of\b/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);
  s = s.replace(/\blim(?:it)?\s+(?!as\b)([a-zA-Z,\s]+?)\s*(?:->|→|\\to)\s*([^\s,;.(]+)/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);

  s = s.replace(/\blim(?:it)?\s+as\s+\(([^)]+)\)\s*(?:->|→)\s*\(([^)]+)\)/gi,
    (_,v,a)=>`\\(\\lim_{(${v})\\to(${fix(a)})}\\)`);
  s = s.replace(/\blim(?:it)?\s+as\s+([a-zA-Z,\s]+?)\s*(?:->|→|\\to)\s*([^\s,;.(]+)\s*of\b/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);
  s = s.replace(/\blim(?:it)?\s+as\s+([a-zA-Z,\s]+?)\s*(?:->|→|\\to)\s*([^\s,;.(]+)/gi,
    (_,v,a)=>`\\(\\lim_{${v.trim()}\\to ${fix(a)}}\\)`);
  s = s.replace(/(?<!\\\()\blim_\{([^}]+)\}/gi,
    (_,sub)=>`\\(\\lim_{${sub.replace(/->/g,'\\to')}}\\)`);

  // Bare -> arrow (remaining after all lim patterns have consumed their arrows)
  s = s.replace(/(?<![<])->/g, "\\(\\to\\)");

  s = s.replace(/\bd\/d([a-z])\s*\[([^\]]+)\]/g, (_,v,f)=>`\\(\\dfrac{d}{d${v}}\\left[${f}\\right]\\)`);
  s = s.replace(/\bd\/d([a-z])\s*\(([^)]+)\)/g,  (_,v,f)=>`\\(\\dfrac{d}{d${v}}\\left(${f}\\right)\\)`);
  s = s.replace(/\bd\^2([a-zA-Z])\/d([a-z])\^2\b/g, (_,y,x)=>`\\(\\dfrac{d^2${y}}{d${x}^2}\\)`);
  s = s.replace(/\bd([a-zA-Z])\/d([a-z])\b/g,    (_,y,x)=>`\\(\\dfrac{d${y}}{d${x}}\\)`);
  s = s.replace(/\bd\/d([a-z])\b/g,              (_,v)  =>`\\(\\dfrac{d}{d${v}}\\)`);

  s = s.replace(/∂([a-zA-Z0-9]*)\/∂([a-z])/g, (_,f,v)=>`\\(\\dfrac{\\partial ${f}}{\\partial ${v}}\\)`);
  s = s.replace(/∂/g, '\\(\\partial\\)');   // any ∂ not caught by the ∂f/∂x pass above

  // Script operators: L{f(t)}, F{...}, Z{...}, L^{-1}{...}
  s = s.replace(/\b([LFZ])\^\{-1\}\{([^{}]+)\}/g,
    (_,op,inner)=>`\\(\\mathcal{${op}}^{-1}\\{${innerLatex(inner)}\\}\\)`);
  s = s.replace(/\b([LFZ])\{([^{}]+)\}/g,
    (_,op,inner)=>`\\(\\mathcal{${op}}\\{${innerLatex(inner)}\\}\\)`);

  // Powered/inverse trig: sin^-1(x), sin^(-1)(x), sin^2(x), sin^{n}(x) -> \(\sin^{...}(x)\).
  // Stashed (\x04) so the generic exponent passes below can't grab the power off the last
  // letter of the function name and split it (sin -> si + n^{...}); restored after them.
  const _trigToks = [];
  s = s.replace(
    /(?<!\\)\b(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh)\^(\{[^}]+\}|\(-?\d+\)|-?\d+)(?:\s*\(([^()]*)\))?/g,
    (_, fn, pow, arg) => {
      const p = pow.replace(/^[({]|[)}]$/g, "");
      const body = arg != null ? `\\${fn}^{${p}}(${innerLatex(arg)})` : `\\${fn}^{${p}}`;
      _trigToks.push(`\\(${body}\\)`);
      return `\x04${_trigToks.length - 1}\x04`;
    }
  );

  const tokens = [];
  function stash(val) { tokens.push(val); return `\x02${tokens.length-1}\x02`; }
  function unstash(t) { return t.replace(/\x02(\d+)\x02/g, (_,i) => tokens[parseInt(i)]); }

  let pp;
  do {
    pp = s;
    s = s.replace(/\(([^()]+)\)\^(\{[^}]+\}|-?[0-9]+(?:\.[0-9]+)?|[a-zA-Z])/g,
      (m) => stash(m));
  } while (s !== pp);

  s = s.replace(/\b(?!sqrt\b|cbrt\b)([a-zA-Z][a-zA-Z0-9]*)'?\(([^()]*)\)/g, function(m, fn) {
    if (fn === 'sqrt' || fn === 'cbrt') return m;
    return stash(m);
  });

  let prev;
  do {
    prev = s;
    s = s.replace(/sqrt\(([^()]*)\)/g, (_, x) => {
      const inner = unstash(x);
      return `\\(\\sqrt{${innerLatex(inner)}}\\)`;
    });
  } while (s !== prev);
  s = s.replace(/cbrt\(([^()]*)\)/g, (_, x) => `\\(\\sqrt[3]{${unstash(x)}}\\)`);

  s = unstash(s);

  s = s.replace(/([a-zA-Z0-9])\^\(([^)]+)\)/g, (_,base,exp) => {
    const expLatex = exp.replace(/(-?[0-9]+)\/([0-9]+)/g, (_,a,b) => `\\frac{${a}}{${b}}`);
    return `\\(${base}^{${expLatex}}\\)`;
  });
  s = s.replace(/([a-zA-Z0-9])\^\{([^}]+)\}/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  s = s.replace(/\bfrac\(([^,)]+),\s*([^)]+)\)/g, (_,a,b)=>`\\(\\dfrac{${a.trim()}}{${b.trim()}}\\)`);

  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)\^([0-9]+)/g, (_,a,b,n)=>`\\(\\dfrac{${a}}{(${b})^{${n}}}\\)`);
  // One level of nesting in numerator: handles (2ln(2))/(3), (f(x)+g(x))/(n), etc.
  s = s.replace(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\/\(([^()]+)\)/g,
    (_,n,d) => `\\(\\dfrac{${innerLatex(n)}}{${innerLatex(d)}}\\)`);
  s = s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\(([^()]+)\)\/([a-zA-Z0-9][a-zA-Z0-9^+\-*]*)/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\b([a-zA-Z0-9]+\^[0-9]+)\/([a-zA-Z0-9]+(?:\^[0-9]+)?)\b/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);
  s = s.replace(/\b([0-9]+)\/([0-9]+)\b/g, (_,a,b)=>`\\(\\dfrac{${a}}{${b}}\\)`);

  // Square-bracket fractions: [a]/[b], (a)/[b], n/[b]
  s = s.replace(/\[([^\[\]]+)\]\/\[([^\[\]]+)\]/g, (_,n,d)=>`\\(\\dfrac{${n}}{${d}}\\)`);
  s = s.replace(/\(([^()]+)\)\/\[([^\[\]]+)\]/g, (_,n,d)=>`\\(\\dfrac{${n}}{${d}}\\)`);
  s = s.replace(/\b([a-zA-Z0-9]+)\/\[([^\[\]]+)\]/g, (_,n,d)=>`\\(\\dfrac{${n}}{${d}}\\)`);

  // number/letter fraction: 1/x, 3/n, etc.
  s = s.replace(/\b([0-9]+)\/([a-zA-Z])\b/g, (_,n,d)=>`\\(\\dfrac{${n}}{${d}}\\)`);

  // Convert exp(arg) → e^(arg) so the existing e^ passes render it as e^{arg}.
  // Run BEFORE the e^ passes so they pick up the converted form.
  s = s.replace(/\bexp\(([^)]+)\)/g, "e^($1)");
  s = s.replace(/\be\^\(([^)]+)\)/g, (_,x)=>`\\(e^{${x}}\\)`);
  s = s.replace(/\be\^(-?[a-zA-Z0-9]+)\b/g, (_,x)=>`\\(e^{${x}}\\)`);

  s = s.replace(/\bsum\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\sum_{${v}=${a}}^{${fix(b)}}\\)`);
  s = s.replace(/\bprod(?:uct)?\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\prod_{${v}=${a}}^{${fix(b)}}\\)`);

  s = s.replace(/([a-zA-Z0-9])\^(-?[0-9]+(?:\.[0-9]+)?)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);
  // NEW: digit base + letter exponent (e.g. 2^x, 3^x, 10^x). \b prevents
  // matching the trailing digit of a non-base identifier like x1^y.
  s = s.replace(/\b([0-9]+)\^([a-zA-Z][a-zA-Z0-9]*)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);
  s = s.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  // Restore powered/inverse trig stashed above, now safely past the exponent passes.
  s = s.replace(/\x04(\d+)\x04/g, (_, i) => _trigToks[parseInt(i, 10)]);

  s = s.replace(/\b([a-zA-Z])_\{([^}]+)\}/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);
  // No trailing \b: a subscript digit may butt directly against a variable
  // (e.g. "b_1x" from "y = b0 + b1x") and must still convert → \(b_{1}\)x.
  s = s.replace(/\b([a-zA-Z])_([0-9a-zA-Z])/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);

  s = s.replace(/<(-?[^<>]+(?:,[^<>]+)+)>/g, (_,inner)=>`\\(\\langle ${inner} \\rangle\\)`);

  s = s.replace(/\|([a-zA-Z0-9 +\-*/^._]+)\|/g, (_,x)=>`\\(\\left|${x}\\right|\\)`);

  s = s.replace(/\binfinity\b/gi, `\\(${inf}\\)`);
  s = s.replace(/\binf\b/g, `\\(${inf}\\)`);
  s = s.replace(/→/g, "\\(\\to\\)");
  s = s.replace(/(?<![a-zA-Z\\])pi(?![a-zA-Z])/g, "\\(\\pi\\)");
  s = s.replace(/(?<!\\)\btheta\b/gi, "\\(\\theta\\)");
  s = s.replace(/\brho\b/gi, "\\(\\rho\\)");
  s = s.replace(/(?<!\\)\bphi\b/gi, "\\(\\phi\\)");
  s = s.replace(/\blambda\b/gi, "\\(\\lambda\\)");
  s = s.replace(/\bsigma\b/gi, "\\(\\sigma\\)");
  s = s.replace(/\bdelta\b/gi, "\\(\\delta\\)");
  s = s.replace(/\balpha\b/gi, "\\(\\alpha\\)");
  s = s.replace(/\bbeta\b/gi, "\\(\\beta\\)");
  s = s.replace(/\bgamma\b/gi, "\\(\\gamma\\)");
  s = s.replace(/\btimes\b/g, "\\(\\times\\)");
  s = s.replace(/\bcdot\b/g, "\\(\\cdot\\)");
  s = s.replace(/\bmu\b/gi, "\\(\\mu\\)");
  // Multiplication glyph: \cdot inside \(...\) LaTeX (a bare "·" breaks KaTeX /
  // Canvas equation_image), "·" only in plain text outside math. Runs AFTER the
  // word-based times/cdot passes above, so the \cdot it emits is never
  // re-matched by the \bcdot\b pass (which would corrupt it to \(\cdot\)).
  s = _convertMultiplicationStars(s);

  // Standalone trig/log — runs last so integrals have already consumed their inner expressions
  s = s.replace(/(?<!\\)\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log)\(([^)]+)\)/g,
    (_,fn,arg)=>`\\(\\${fn}(${innerLatex(arg)})\\)`);

  // Final pass: AI explanations sometimes contain raw LaTeX commands
  // (\dfrac{}{}, \sqrt{}, \int_{}^{}, \sum, ...) without surrounding
  // \(...\) math delimiters, so KaTeX never sees them and they render as
  // plain text. Walk the string, tracking whether we're already inside
  // \(...\) (so transforms above don't get double-wrapped), and wrap any
  // bare LaTeX commands we find.
  s = _wrapRawLatexCommands(s);

  // Collapse any nested \(...\) the exponent passes may have produced *inside*
  // already-emitted LaTeX (e.g. sqrt() with an exponent radicand yields
  // \(\sqrt{\(x^{2}\)}\)). Without flattening, the display tokenizer's lazy
  // /\(...\)/ split breaks on the inner \) and the \sqrt leaks as literal text.
  // Same approach toLatexForCanvas already uses.
  s = flattenMathDelimiters(s);

  return s;
}

function _wrapRawLatexCommands(input) {
  // Patterns we recognize as "bare LaTeX command + balanced argument(s)".
  // Each matches greedily but only one level of brace nesting deep — enough
  // for typical AI output (\dfrac{8}{3}, \sqrt{x^2+1}, \int_{0}^{2\pi}).
  const PATTERNS = [
    /^(\\[dt]?frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/,
    /^(\\sqrt(?:\[[^\]]*\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/,
    /^(\\(?:int|iint|iiint|oint|sum|prod|lim)(?:_\{[^{}]*\})?(?:\^\{[^{}]*\})?)/,
    /^(\\(?:partial|nabla|cdot|times|to|infty|leq|geq|neq|pm|mp|ldots|cdots)(?![a-zA-Z]))/,
  ];
  let out = "";
  let i = 0;
  let depth = 0; // nesting depth inside \( ... \)
  while (i < input.length) {
    if (input.charCodeAt(i) === 92 && input.charCodeAt(i + 1) === 40) { // \(
      out += "\\(";
      i += 2;
      depth++;
      continue;
    }
    if (input.charCodeAt(i) === 92 && input.charCodeAt(i + 1) === 41) { // \)
      out += "\\)";
      i += 2;
      if (depth > 0) depth--;
      continue;
    }
    if (depth === 0 && input[i] === "\\") {
      const tail = input.slice(i);
      let matched = null;
      for (const re of PATTERNS) {
        const m = tail.match(re);
        if (m) { matched = m[1]; break; }
      }
      if (matched) {
        out += "\\(" + matched + "\\)";
        i += matched.length;
        continue;
      }
    }
    out += input[i];
    i++;
  }
  return out;
}

// Walk s and collapse nested \(...\) so the outer pair absorbs all inner ones.
// Regex can't handle this correctly when inner LaTeX contains bare ( or ) chars.
function flattenMathDelimiters(s) {
  let result = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length && s[i + 1] === '(') {
      i += 2;
      let depth = 1;
      let inner = '';
      while (i < s.length) {
        if (s[i] === '\\' && i + 1 < s.length && s[i + 1] === '(') {
          depth++;
          i += 2;
        } else if (s[i] === '\\' && i + 1 < s.length && s[i + 1] === ')') {
          depth--;
          i += 2;
          if (depth === 0) break;
        } else {
          inner += s[i];
          i++;
        }
      }
      result += '\\(' + inner + '\\)';
    } else {
      result += s[i];
      i++;
    }
  }
  return result;
}

export function toLatexForCanvas(raw) {
  let s = toLatex(raw);
  s = flattenMathDelimiters(s);
  return s.replace(/\\\((.+?)\\\)/g, (_, latex) => {
    // Always emit Canvas equation_image tags for every math block. The toLatex
    // pipeline has already wrapped math in \(...\) — trust that as the math/prose
    // boundary and let Canvas's equation editor handle every math expression
    // consistently. Previously only "complex" math (sqrt, frac, int...) became
    // equation editor blocks while simple math (x^2, 3^x) was emitted as inline
    // HTML — causing inconsistent UX where some math was editable in Canvas and
    // some was plain text.
    // Canvas requires the equation_images src to be DOUBLE URL-encoded and to
    // carry ?scale=1; with single encoding the image renders/edits wrong. The
    // title/alt/data-equation-content stay single HTML-entity-escaped raw LaTeX.
    // data-ignore-a11y-check matches what Canvas's own editor emits.
    const encoded = encodeURIComponent(encodeURIComponent(latex));
    const escaped = latex
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<img class="equation_image" title="${escaped}" src="/equation_images/${encoded}?scale=1" alt="LaTeX: ${escaped}" data-equation-content="${escaped}" data-ignore-a11y-check="" style="vertical-align:middle;display:inline;margin:0 2px;" />`;
  });
}
