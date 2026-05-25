// lib/templates/_generic/graphSchemas.js
//
// The graphConfig schema documentation included in every generation prompt
// where the template's graphs_option is anything other than "none".
//
// This documents the EXACT schema the renderer accepts. The schema is global —
// changing it requires updating the renderer code in components/TestBankApp.js
// (graphRendering.js layer), not a per-section template. There are no
// section-specific overrides to this block.
//
// IMPORTANT for maintainers: if you add a new graphConfig type (e.g. "scatter",
// "polar"), update this file AND the renderer at the same time. Out-of-sync
// changes will silently produce broken graphs because Sonnet will emit a
// schema the renderer doesn't recognize.

export const GRAPH_SCHEMAS = `═══════════════════════════════════════════════════════════
GRAPH CONFIG (only if graphs are included) — MUST MATCH RENDERER SCHEMA
═══════════════════════════════════════════════════════════

For any question that has a graph, ADD these two top-level fields to the question object (alongside "question", "choices", "answer", etc. — NOT nested anywhere else):

"hasGraph": true,
"graphConfig": { ...one of the schemas below... }

The renderer accepts ONLY these schemas. Choose ONE per graphConfig:

SCHEMA A — Single function curve (most common):
{
  "type": "single",
  "fn": "x^2 - 4*x + 3",
  "xDomain": [-2, 6],
  "yDomain": [-2, 8],
  "holes": [[2, -1]],
  "points": [[3, 0]],
  "fnLabel": "f(x)",
  "showAxisNumbers": true,
  "showGrid": true
}

Required: type ("single"), fn (math expression string)
Optional: xDomain (default [-5,5]), yDomain (auto if omitted), holes (array of [x,y] for open circles), points (array of [x,y] for filled dots), fnLabel, showAxisNumbers, showGrid

SCHEMA B — Piecewise function:
{
  "type": "piecewise",
  "pieces": [
    { "fn": "x + 1", "domain": [-3, 0], "extendsLeft": false, "extendsRight": false },
    { "fn": "x^2",   "domain": [0, 2],  "extendsLeft": false, "extendsRight": false }
  ],
  "xDomain": [-4, 3],
  "holes": [[0, 1]],
  "points": [[0, 0]]
}

Required: type ("piecewise"), pieces (each with fn and domain)
Optional per-piece: extendsLeft (boolean), extendsRight (boolean), see "DOMAIN ENDPOINTS" rules below
Optional global: same chrome options as Schema A (xDomain, yDomain, fnLabel, showAxisNumbers, showGrid, holes, points)

DOMAIN ENDPOINTS — how to represent finite vs. infinite extension:

For each piecewise piece, you must indicate whether its domain endpoints are FINITE (bounded by a specific value) or INFINITE (the piece continues forever in that direction). Use these conventions:

1. FINITE endpoints (most common):
   - Use a number in the domain array
   - The renderer draws the curve from that x to the piece's other endpoint
   - For closed endpoints (included), add the [x, y] coordinate to the global "points" array
   - For open endpoints (excluded), add the [x, y] coordinate to the global "holes" array
   - extendsLeft and extendsRight are false (or omitted)

2. INFINITE extension to the LEFT (piece's domain is (-infinity, b]):
   - Set "domain": [xDomain[0], b]  — use xDomain's lower bound as the visible left edge
   - Set "extendsLeft": true
   - The renderer will draw an arrow on the left end of the curve
   - Do NOT add a "hole" or "point" for the left end (there is no endpoint to mark)
   - The right end (b) still needs a hole or point as appropriate

3. INFINITE extension to the RIGHT (piece's domain is [a, infinity)):
   - Set "domain": [a, xDomain[1]]  — use xDomain's upper bound as the visible right edge
   - Set "extendsRight": true
   - The renderer will draw an arrow on the right end of the curve
   - Do NOT add a "hole" or "point" for the right end
   - The left end (a) still needs a hole or point as appropriate

4. Piece defined on ALL REALS (rare for piecewise but possible):
   - Set "domain": [xDomain[0], xDomain[1]]
   - Set BOTH "extendsLeft": true AND "extendsRight": true
   - Arrows on both ends, no endpoint markers

EXAMPLE — piecewise function defined on all reals:
{
  "type": "piecewise",
  "pieces": [
    { "fn": "-x",  "domain": [-5, 0], "extendsLeft": true, "extendsRight": false },
    { "fn": "x^2", "domain": [0, 3],  "extendsLeft": false, "extendsRight": true }
  ],
  "xDomain": [-5, 3],
  "points": [[0, 0]]
}
Renders as: left piece from x=-5 (arrow) to x=0 (filled dot), right piece from x=0 (filled dot) to x=3 (arrow).

EXAMPLE — piecewise function with one finite and one infinite piece:
{
  "type": "piecewise",
  "pieces": [
    { "fn": "x + 2", "domain": [-3, 1], "extendsLeft": false, "extendsRight": false },
    { "fn": "x^2",   "domain": [1, 4],  "extendsLeft": false, "extendsRight": true }
  ],
  "xDomain": [-4, 4],
  "holes": [[1, 3]],
  "points": [[-3, -1], [1, 1]]
}
Renders as: left piece from x=-3 (filled dot) to x=1 (open circle), right piece from x=1 (filled dot) to x=4 (arrow).

CRITICAL: Use INFINITY in the conceptual domain, but NEVER write "Infinity" or "-Infinity" as a value in the JSON. Always use numbers (matching xDomain edges) plus the boolean extendsLeft/extendsRight flags.

EXPRESSION SYNTAX for "fn" fields:
- Use mini-syntax: x^2, sqrt(x), |x|, (x+1)/(x-2)
- Use * for multiplication: 4*x not 4x
- Use standard math functions: sin, cos, tan, exp, log, ln
- The renderer evaluates fn numerically; constants and elementary functions only

DOMAIN AND SCALE — choose tight, focused viewing windows:
The most common quality problem is choosing xDomain and yDomain too wide, leaving the function tiny in the middle of empty space. Always size the viewing window so the function's interesting behavior fills 60-80% of the visible area.

Concrete rules:
- For a question about a vertex/intercept/breakpoint at point (a, b): include 2-4 units of room on each side, NOT 10.
- For sin/cos: show 1.5 to 2.5 periods. xDomain of [-2*pi, 2*pi] is appropriate (~ [-6.3, 6.3]). NOT [-10, 10].
- For exponentials and logs: show where the function changes meaningfully. exp from x = -3 to x = 3 is enough, not -10 to 10.
- For polynomials: zoom around the relevant roots/vertices. For y = (x-3)^2, use xDomain like [0, 6] not [-10, 10].
- For piecewise: visible window should be just 1-2 units past the outermost breakpoint on each side.
- yDomain: include the function's actual range in the visible x-window, plus ~1 unit of headroom above and below. Do NOT default to [-10, 10] unless that's actually what the function does.
- Prefer xDomain bounds that are clean integers (or multiples of pi for trig). A bound of -2*pi is fine; a bound of -6.283 is not.

The viewer is solving a question, not surveying the whole real line. Crop accordingly.

CRITICAL RULES:
- DO NOT use type "function" — use "single"
- DO NOT use type "points" — use "single" with empty fn (or skip the graph entirely)
- DO NOT nest fn under a "functions" array — fn is a top-level string in graphConfig
- DO NOT use "domain"/"range" — use "xDomain"/"yDomain"
- DO NOT include a "features" array — use "holes" and "points" at the top level instead
- DO NOT include a "color" field — colors are hardcoded by the renderer
- Vertical asymptotes emerge naturally from fn evaluation (e.g. "1/(x-2)") — do not add an "asymptote" feature
- The graph renderer ignores any keys not listed above`;
