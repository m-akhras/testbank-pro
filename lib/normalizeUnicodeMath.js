export function normalizeUnicodeMath(s) {
  let r = String(s ?? "");

  // Square roots — iterative for nested √(√(x))
  let prev;
  do { prev = r; r = r.replace(/√\(([^()]*)\)/g, 'sqrt($1)'); } while (r !== prev);
  r = r.replace(/√([a-zA-Z0-9])/g, 'sqrt($1)');

  // Cube / nth roots
  r = r.replace(/∛\(([^()]*)\)/g, 'cbrt($1)');
  r = r.replace(/∛([a-zA-Z0-9])/g, 'cbrt($1)');
  r = r.replace(/∜\(([^()]*)\)/g, 'sqrt[4]($1)');

  // Integrals
  r = r.replace(/∯/g, 'double integral');
  r = r.replace(/∰/g, 'triple integral');
  r = r.replace(/∮/g, 'integral');
  r = r.replace(/∬/g, 'double integral');
  r = r.replace(/∭/g, 'triple integral');
  r = r.replace(/∫/g, 'integral');

  // Sums / products / infinity
  r = r.replace(/∑/g, 'sum');
  r = r.replace(/∏/g, 'product');
  r = r.replace(/∞/g, 'infinity');

  // Arrows
  r = r.replace(/⟶/g, '->').replace(/→/g, '->').replace(/⟹/g, '=>');
  r = r.replace(/⟺/g, '<=>').replace(/↔/g, '<=>');
  r = r.replace(/↦/g, '|->').replace(/⟼/g, '|->');

  // Operators / relations
  r = r.replace(/×/g, 'times').replace(/÷/g, '/').replace(/·/g, '*');
  r = r.replace(/≤/g, '<=').replace(/≧/g, '>=').replace(/≥/g, '>=');
  r = r.replace(/≠/g, '!=').replace(/≈/g, '~=').replace(/≡/g, '===');
  r = r.replace(/≪/g, '<<').replace(/≫/g, '>>');
  r = r.replace(/±/g, '+/-').replace(/∓/g, '-/+');
  r = r.replace(/∝/g, 'proportional to');
  r = r.replace(/∴/g, 'therefore').replace(/∵/g, 'because');
  r = r.replace(/⊕/g, 'XOR').replace(/⊗/g, 'tensor');

  // Calculus
  r = r.replace(/∇/g, 'nabla');
  r = r.replace(/∆/g, 'Delta');

  // Logic operators (Discrete Math Ch.2 — round-trips back to symbols via html.js)
  r = r.replace(/¬/g, 'NOT ').replace(/∧/g, ' AND ').replace(/∨/g, ' OR ');
  r = r.replace(/⊻/g, ' XOR ').replace(/⊤/g, 'True').replace(/⊥/g, 'False');

  // Statistics
  r = r.replace(/x̄/g, 'x-bar').replace(/ȳ/g, 'y-bar');
  r = r.replace(/x̂/g, 'x-hat').replace(/ŷ/g, 'y-hat');
  r = r.replace(/p̂/g, 'p-hat');
  r = r.replace(/σ²/g, 'sigma^2').replace(/χ²/g, 'chi^2');

  // Physics / circuits
  r = r.replace(/ℏ/g, 'hbar');
  r = r.replace(/ℓ/g, 'l');
  r = r.replace(/℃/g, 'degrees C').replace(/℉/g, 'degrees F');
  r = r.replace(/Å/g, 'Angstrom');
  r = r.replace(/⟨/g, '<').replace(/⟩/g, '>');

  // Greek letters — full set, skip if already escaped with \
  r = r.replace(/(?<!\\)α/g,'alpha').replace(/(?<!\\)β/g,'beta').replace(/(?<!\\)γ/g,'gamma');
  r = r.replace(/(?<!\\)δ/g,'delta').replace(/(?<!\\)ε/g,'epsilon').replace(/(?<!\\)ζ/g,'zeta');
  r = r.replace(/(?<!\\)η/g,'eta').replace(/(?<!\\)θ/g,'theta').replace(/(?<!\\)ι/g,'iota');
  r = r.replace(/(?<!\\)κ/g,'kappa').replace(/(?<!\\)λ/g,'lambda').replace(/(?<!\\)μ/g,'mu');
  r = r.replace(/(?<!\\)ν/g,'nu').replace(/(?<!\\)ξ/g,'xi').replace(/(?<!\\)π/g,'pi');
  r = r.replace(/(?<!\\)ρ/g,'rho').replace(/(?<!\\)σ/g,'sigma').replace(/(?<!\\)τ/g,'tau');
  r = r.replace(/(?<!\\)υ/g,'upsilon').replace(/(?<!\\)φ/g,'phi').replace(/(?<!\\)χ/g,'chi');
  r = r.replace(/(?<!\\)ψ/g,'psi').replace(/(?<!\\)ω/g,'omega');
  r = r.replace(/(?<!\\)Γ/g,'Gamma').replace(/(?<!\\)Δ/g,'Delta').replace(/(?<!\\)Θ/g,'Theta');
  r = r.replace(/(?<!\\)Λ/g,'Lambda').replace(/(?<!\\)Ξ/g,'Xi').replace(/(?<!\\)Π/g,'Pi');
  r = r.replace(/(?<!\\)Σ/g,'Sigma').replace(/(?<!\\)Υ/g,'Upsilon').replace(/(?<!\\)Φ/g,'Phi');
  r = r.replace(/(?<!\\)Ψ/g,'Psi').replace(/(?<!\\)Ω/g,'Omega');

  // Superscript / subscript Unicode digits
  // Superscript Unicode → caret exponent. Map each glyph to its ASCII char, then
  // emit ^X for a single char or ^{XYZ} for a contiguous run. Bare ^X renders in
  // all three paths (toLatex, OMML, inline-HTML <sup>); braces only for runs
  // (rare in practice — Discrete authors single f⁻¹). Must run BEFORE subscript
  // handling so the run regex doesn't span into subscripts.
  r = r.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (run) => {
    const map = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+' };
    const ascii = run.replace(/./g, (c) => map[c] ?? c);
    return ascii.length === 1 ? `^${ascii}` : `^{${ascii}}`;
  });
  r = r.replace(/₀/g,'0').replace(/₁/g,'1').replace(/₂/g,'2').replace(/₃/g,'3')
       .replace(/₄/g,'4').replace(/₅/g,'5').replace(/₆/g,'6').replace(/₇/g,'7')
       .replace(/₈/g,'8').replace(/₉/g,'9');

  // Dedupe "double integral double integral" artifacts from old AI outputs
  r = r.replace(/double\s+integral\s+double\s+integral/gi, 'double integral');
  r = r.replace(/triple\s+integral\s+triple\s+integral/gi, 'triple integral');
  // Handle "double integral_D" → "double integral over D"
  r = r.replace(/double\s+integral_(\w+)/gi, 'double integral over $1');
  r = r.replace(/triple\s+integral_(\w+)/gi, 'triple integral over $1');

  // Auto-brace multi-character subscripts: f_xx → f_{xx}
  // Single-char subscripts (_x, _1) and already-braced subscripts (_{xx}) are untouched
  r = r.replace(/_([a-zA-Z]{2,})(?![a-zA-Z}])/g, '_{$1}');

  return r;
}
