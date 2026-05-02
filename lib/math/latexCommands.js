// AI explanations sometimes emit raw LaTeX commands (\dfrac{}{}, \sqrt{},
// \cdot, \to, …) instead of the project's mini-syntax. mathToOmml /
// mathToHTML / mathToCanvasHTML all speak mini-syntax, so we normalize
// the most common LaTeX commands to mini-syntax up-front. Same conversion
// the on-screen renderer does via lib/math/toLatex's wrapper, but reduced
// to plain rewriting (no \( \) wrapping) so the downstream pipelines pick
// it up natively.
export function latexCommandsToMini(input) {
  let s = String(input ?? "");
  // \dfrac / \frac / \tfrac {a}{b} → (a)/(b). One level of brace nesting
  // covers ~all AI output. Run to a fixed point so nested fractions resolve.
  let prev;
  do {
    prev = s;
    s = s.replace(/\\[dt]?frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
      (_, n, d) => `(${n})/(${d})`);
  } while (s !== prev);
  // \sqrt{x} → sqrt(x); \sqrt[n]{x} → leave alone (rare in explanations).
  do {
    prev = s;
    s = s.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, x) => `sqrt(${x})`);
  } while (s !== prev);
  // Common operators / Greek / relations the AI emits via \-commands.
  s = s.replace(/\\cdot\b/g,   "*");
  s = s.replace(/\\times\b/g,  "*");
  s = s.replace(/\\to\b/g,     "->");
  s = s.replace(/\\infty\b/g,  "infinity");
  s = s.replace(/\\leq\b/g,    "<=");
  s = s.replace(/\\geq\b/g,    ">=");
  s = s.replace(/\\neq\b/g,    "!=");
  s = s.replace(/\\pm\b/g,     "±");
  s = s.replace(/\\mp\b/g,     "∓");
  s = s.replace(/\\ldots\b/g,  "...");
  s = s.replace(/\\cdots\b/g,  "...");
  s = s.replace(/\\pi\b/g,     "pi");
  s = s.replace(/\\theta\b/g,  "theta");
  s = s.replace(/\\phi\b/g,    "phi");
  s = s.replace(/\\alpha\b/g,  "alpha");
  s = s.replace(/\\beta\b/g,   "beta");
  s = s.replace(/\\gamma\b/g,  "gamma");
  s = s.replace(/\\delta\b/g,  "delta");
  s = s.replace(/\\sigma\b/g,  "sigma");
  s = s.replace(/\\lambda\b/g, "lambda");
  s = s.replace(/\\mu\b/g,     "mu");
  s = s.replace(/\\rho\b/g,    "rho");
  s = s.replace(/\\omega\b/g,  "omega");
  return s;
}
