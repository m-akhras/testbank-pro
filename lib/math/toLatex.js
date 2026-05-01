import { normalizeUnicodeMath } from "../normalizeUnicodeMath.js";

function innerLatex(expr) {
  let e = normalizeUnicodeMath(String(expr ?? ""));
  e = e.replace(/\btheta\b/gi, '\\theta');
  e = e.replace(/\bphi\b/gi, '\\phi');
  e = e.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, '\\pi');
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

export function toLatex(raw) {
  let s = normalizeUnicodeMath(String(raw ?? ""));

  if (s.includes("\\(")) return s;

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

  // Script operators: L{f(t)}, F{...}, Z{...}, L^{-1}{...}
  s = s.replace(/\b([LFZ])\^\{-1\}\{([^{}]+)\}/g,
    (_,op,inner)=>`\\(\\mathcal{${op}}^{-1}\\{${innerLatex(inner)}\\}\\)`);
  s = s.replace(/\b([LFZ])\{([^{}]+)\}/g,
    (_,op,inner)=>`\\(\\mathcal{${op}}\\{${innerLatex(inner)}\\}\\)`);

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

  s = s.replace(/\be\^\(([^)]+)\)/g, (_,x)=>`\\(e^{${x}}\\)`);
  s = s.replace(/\be\^(-?[a-zA-Z0-9]+)\b/g, (_,x)=>`\\(e^{${x}}\\)`);

  s = s.replace(/\bsum\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\sum_{${v}=${a}}^{${fix(b)}}\\)`);
  s = s.replace(/\bprod(?:uct)?\s+from\s+([a-z])=(\S+)\s+to\s+(\S+)/gi,
    (_,v,a,b)=>`\\(\\prod_{${v}=${a}}^{${fix(b)}}\\)`);

  s = s.replace(/([a-zA-Z0-9])\^(-?[0-9]+(?:\.[0-9]+)?)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);
  s = s.replace(/([a-zA-Z])\^([a-zA-Z][a-zA-Z0-9]*)/g, (_,base,exp)=>`\\(${base}^{${exp}}\\)`);

  s = s.replace(/\b([a-zA-Z])_\{([^}]+)\}/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);
  s = s.replace(/\b([a-zA-Z])_([0-9a-zA-Z])\b/g, (_,b,sub)=>`\\(${b}_{${sub}}\\)`);

  s = s.replace(/<(-?[^<>]+(?:,[^<>]+)+)>/g, (_,inner)=>`\\(\\langle ${inner} \\rangle\\)`);

  s = s.replace(/\|([a-zA-Z0-9 +\-*/^._]+)\|/g, (_,x)=>`\\(\\left|${x}\\right|\\)`);

  s = s.replace(/\binfinity\b/gi, `\\(${inf}\\)`);
  s = s.replace(/\binf\b/g, `\\(${inf}\\)`);
  s = s.replace(/→/g, "\\(\\to\\)");
  s = s.replace(/(?<![a-zA-Z])pi(?![a-zA-Z])/g, "\\(\\pi\\)");
  s = s.replace(/\btheta\b/gi, "\\(\\theta\\)");
  s = s.replace(/\brho\b/gi, "\\(\\rho\\)");
  s = s.replace(/\bphi\b/gi, "\\(\\phi\\)");
  s = s.replace(/\blambda\b/gi, "\\(\\lambda\\)");
  s = s.replace(/\bsigma\b/gi, "\\(\\sigma\\)");
  s = s.replace(/\bdelta\b/gi, "\\(\\delta\\)");
  s = s.replace(/\balpha\b/gi, "\\(\\alpha\\)");
  s = s.replace(/\bbeta\b/gi, "\\(\\beta\\)");
  s = s.replace(/\bgamma\b/gi, "\\(\\gamma\\)");
  s = s.replace(/\btimes\b/g, "\\(\\times\\)");
  s = s.replace(/\bcdot\b/g, "\\(\\cdot\\)");
  s = s.replace(/\bmu\b/gi, "\\(\\mu\\)");
  s = s.replace(/\*/g, "·");

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
    const needsImage = /\\(sqrt|iint|iiint|int|oint|frac|dfrac|lim|sum|prod|mathcal|langle|rangle|partial|nabla|left|right)/.test(latex);

    if (needsImage) {
      const encoded = encodeURIComponent(latex);
      const escaped = latex
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      return `<img class="equation_image" title="${escaped}" src="/equation_images/${encoded}" alt="LaTeX: ${escaped}" data-equation-content="${escaped}" style="vertical-align:middle;display:inline;margin:0 2px;" />`;
    }

    // Simple math — convert to plain HTML inline
    let html = latex;
    html = html.replace(/\^{([^}]+)}/g, "<sup>$1</sup>");
    html = html.replace(/\^(-?\w)/g, "<sup>$1</sup>");
    html = html.replace(/_{([^}]+)}/g, "<sub>$1</sub>");
    html = html.replace(/_(-?\w)/g, "<sub>$1</sub>");
    html = html.replace(/\\leq/g, "≤");
    html = html.replace(/\\geq/g, "≥");
    html = html.replace(/\\neq/g, "≠");
    html = html.replace(/\\to/g, "→");
    html = html.replace(/\\infty/g, "∞");
    html = html.replace(/\\cdot/g, "·");
    html = html.replace(/\\times/g, "×");
    html = html.replace(/\\pi/g, "π");
    html = html.replace(/\\theta/g, "θ");
    html = html.replace(/\\phi/g, "φ");
    html = html.replace(/\\alpha/g, "α");
    html = html.replace(/\\beta/g, "β");
    html = html.replace(/\\gamma/g, "γ");
    html = html.replace(/\\delta/g, "δ");
    html = html.replace(/\\lambda/g, "λ");
    html = html.replace(/\\sigma/g, "σ");
    html = html.replace(/\\mu/g, "μ");
    html = html.replace(/\\rho/g, "ρ");
    html = html.replace(/\\omega/g, "ω");
    html = html.replace(/\\ldots/g, "…");
    html = html.replace(/\\(sin|cos|tan|sec|csc|cot|ln|log|arcsin|arccos|arctan|sinh|cosh|tanh)/g, "$1");
    return html;
  });
}
