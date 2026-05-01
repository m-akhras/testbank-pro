// Tiny math-notation → SVG <tspan> converter. Designed for short labels on
// graph boundaries (e.g. "y = x^2", "theta = pi/2", "x_1"), NOT full LaTeX.
// Returns a single XML string of concatenated <tspan>s, ready to paste
// inside an <svg> <text>...</text> element. Keep this minimal — fractions,
// integrals, and radicals with bars are out of scope.

import { escXml } from "../../components/display/svgRasterize.js";

const GREEK = {
  alpha:"α", beta:"β", gamma:"γ", delta:"δ", epsilon:"ε", zeta:"ζ",
  eta:"η", theta:"θ", iota:"ι", kappa:"κ", lambda:"λ", mu:"μ",
  nu:"ν", xi:"ξ", omicron:"ο", pi:"π", rho:"ρ", sigma:"σ", tau:"τ",
  upsilon:"υ", phi:"φ", chi:"χ", psi:"ψ", omega:"ω",
  Alpha:"Α", Beta:"Β", Gamma:"Γ", Delta:"Δ", Epsilon:"Ε", Zeta:"Ζ",
  Eta:"Η", Theta:"Θ", Iota:"Ι", Kappa:"Κ", Lambda:"Λ", Mu:"Μ",
  Nu:"Ν", Xi:"Ξ", Omicron:"Ο", Pi:"Π", Rho:"Ρ", Sigma:"Σ", Tau:"Τ",
  Upsilon:"Υ", Phi:"Φ", Chi:"Χ", Psi:"Ψ", Omega:"Ω",
};

function _applyGreek(s) {
  // Sort keys longest-first so "alpha" matches before "alp..." and
  // "Lambda" before "La...". Word-boundary on each side.
  const keys = Object.keys(GREEK).sort((a, b) => b.length - a.length);
  let out = s;
  for (const k of keys) {
    const re = new RegExp(`\\b${k}\\b`, "g");
    out = out.replace(re, GREEK[k]);
  }
  return out;
}

// Tokenize on ^ and _ — supports ^{...}/_{...} groups (with nested braces)
// and bare ^X / _X (single character). Returns an array of tokens with
// type "normal" | "sup" | "sub" and a text payload.
function _tokenize(s) {
  const tokens = [];
  let buf = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "^" || c === "_") {
      if (buf) { tokens.push({ type: "normal", text: buf }); buf = ""; }
      const type = c === "^" ? "sup" : "sub";
      i++;
      if (s[i] === "{") {
        let depth = 1;
        i++;
        let inner = "";
        while (i < s.length && depth > 0) {
          if (s[i] === "{") { depth++; inner += s[i]; i++; continue; }
          if (s[i] === "}") { depth--; if (depth === 0) { i++; break; } inner += s[i]; i++; continue; }
          inner += s[i]; i++;
        }
        tokens.push({ type, text: inner });
      } else if (i < s.length) {
        tokens.push({ type, text: s[i] });
        i++;
      }
    } else {
      buf += c;
      i++;
    }
  }
  if (buf) tokens.push({ type: "normal", text: buf });
  return tokens;
}

// Public entry point. Input: a plain string like "y = x^2" or
// "theta_1 + sqrt(2)". Output: a single XML string of <tspan>s suitable
// for splicing inside an <svg><text>...</text> element.
export function mathToSvgTspans(expr) {
  let s = String(expr ?? "");
  s = _applyGreek(s);
  s = s.replace(/\bsqrt\b/g, "√");
  s = s.replace(/\*/g, "·");

  const tokens = _tokenize(s);
  if (tokens.length === 0) return "";

  // Absolute baseline shift per token type. dy in <tspan> is *relative*
  // to the previous glyph, so we emit (newShift - prevShift).
  const SHIFT = { normal: 0, sup: -3, sub: 3 };
  let prev = 0;
  const out = [];
  for (const t of tokens) {
    const target = SHIFT[t.type] || 0;
    const dy = target - prev;
    const fontSize = t.type === "normal" ? "100%" : "75%";
    out.push(`<tspan dy="${dy}" font-size="${fontSize}">${escXml(t.text)}</tspan>`);
    prev = target;
  }
  return out.join("");
}
