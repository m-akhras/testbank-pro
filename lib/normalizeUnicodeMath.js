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
  r = r.replace(/∯/g, 'double surface integral');
  r = r.replace(/∰/g, 'triple volume integral');
  r = r.replace(/∮/g, 'contour integral');
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
  r = r.replace(/∘/g, 'composed with');

  // Calculus
  r = r.replace(/∂/g, 'd');
  r = r.replace(/∇/g, 'nabla');
  r = r.replace(/∆/g, 'Delta');

  // Set / logic (Discrete Math)
  r = r.replace(/∈/g, ' in ').replace(/∉/g, ' not in ');
  r = r.replace(/⊂/g, ' subset ').replace(/⊆/g, ' subset ');
  r = r.replace(/⊃/g, ' superset ').replace(/⊇/g, ' superset ');
  r = r.replace(/∪/g, ' union ').replace(/∩/g, ' intersect ');
  r = r.replace(/∅/g, 'empty set');
  r = r.replace(/∀/g, 'for all').replace(/∃/g, 'there exists').replace(/∄/g, 'there does not exist');
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
  r = r.replace(/⁰/g,'0').replace(/¹/g,'1').replace(/²/g,'2').replace(/³/g,'3')
       .replace(/⁴/g,'4').replace(/⁵/g,'5').replace(/⁶/g,'6').replace(/⁷/g,'7')
       .replace(/⁸/g,'8').replace(/⁹/g,'9').replace(/⁻/g,'-').replace(/⁺/g,'+');
  r = r.replace(/₀/g,'0').replace(/₁/g,'1').replace(/₂/g,'2').replace(/₃/g,'3')
       .replace(/₄/g,'4').replace(/₅/g,'5').replace(/₆/g,'6').replace(/₇/g,'7')
       .replace(/₈/g,'8').replace(/₉/g,'9');

  return r;
}
