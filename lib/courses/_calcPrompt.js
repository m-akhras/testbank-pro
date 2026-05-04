// Shared prompt builder for Calculus 1, 2, and 3
// course param distinguishes Calculus 3 for extra notation rules

export const questionTypes = ["normal", "graph", "mix"];

// Mutation rule text for a single-section per-version label (same for all calc courses)
export function buildMutationRules(type) {
  return type === "function"
    ? "function mutation — use a different function type entirely (e.g. if original uses polynomial, use exponential or trigonometric). Same concept difficulty, same steps."
    : "numbers mutation — keep same function types, change only coefficients/constants.";
}

// Per-section bullet for multi-section builds.
// compact=false → buildAllVersionsPrompt wording; compact=true → buildAllSectionsPrompt wording.
export function buildSectionRules(sectionNum, compact = false) {
  if (sectionNum === 1) {
    return compact
      ? `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change only coefficients/constants, keep same function types.`
      : `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types as originals.`;
  }
  const prev = sectionNum > 2 ? " and all previous sections" : "";
  return compact
    ? `- Section ${sectionNum} versions (S${sectionNum}_A, S${sectionNum}_B, ...): function mutation — assign each question a DIFFERENT function family randomly. Available families: polynomial, exponential (e^x), logarithmic (ln), sin, cos, rational, sqrt. NO two questions in the same section may use the same family. Example for 3 questions: Q1→polynomial, Q2→e^x, Q3→ln. Must differ from Section 1${prev}.`
    : `- Section ${sectionNum} versions (S${sectionNum}_A, S${sectionNum}_B, ...): function mutation — assign each question a DIFFERENT function family. Pick randomly from: polynomial, exponential, logarithmic, sin, cos, rational, sqrt — but NO two questions in the same section may share the same family. For example with 3 questions: Q1 gets polynomial, Q2 gets e^x, Q3 gets ln(x). Must differ from Section 1${prev}.`;
}

// Cross-section rule appended to ADDITIONAL RULES in buildAllVersionsPrompt (multi-section)
export const crossSectionRule =
  `- Across sections, questions must use completely different function families.\n` +
  `- Within each section, EVERY question must come from a DIFFERENT function family — polynomial, exponential, logarithmic, sin, cos, rational, sqrt are all separate families. sin and cos count as the same family.\n` +
  `- Think of it like assigning a unique function family to each question slot: Q1=polynomial, Q2=e^x, Q3=ln, Q4=sin — no repeats.`;

// Shorter form used by buildAllSectionsPrompt
export const crossSectionRuleShort =
  `Across sections: each section must use different functions entirely.`;

// Alias so callers can use the same name as other course exports
export { buildPrompt as buildGeneratePromptRules };
export function buildPrompt({ course, totalQ, breakdown, hasGraphQuestions, qType, typeInstruction, commonRules, mathNotationBase }) {
  const isCalc3 = course === "Calculus 3";

  const calc3Rules = isCalc3 ? `
CALCULUS 3 NOTATION:
- Vectors: MUST use angle brackets <a,b> or <a,b,c> — NEVER parentheses (a,b) for vectors.
- Points use parentheses: (2,2) is a point. <2,2> is a vector. Never confuse them.

SECTION 14.5 (CHAIN RULE) — NOTATION RULES (overrides the default subscript convention used in 14.3 / 14.7):

ALWAYS use Leibniz (operator) notation for partial and ordinary derivatives in 14.5 questions, answers, and explanations. The cancellation pattern in the chain rule (∂z/∂r = (∂z/∂x)(∂x/∂r) + (∂z/∂y)(∂y/∂r) — "x's cancel, y's cancel") is only legible in Leibniz form, which is how Stewart teaches the chain rule.

REQUIRED forms (write them in plain-text mini-syntax — the renderer handles the symbols):
  partial z / partial x                    → renders as ∂z/∂x
  partial z / partial r                    → renders as ∂z/∂r
  d y / d t                                → renders as dy/dt
  partial f / partial x                    → renders as ∂f/∂x
  partial^2 z / partial x^2                → renders as ∂²z/∂x²
  partial^2 z / (partial x partial y)      → renders as ∂²z/(∂x∂y)

Backslash (LaTeX) form is also accepted by the renderer if you prefer:
  \\partial z / \\partial x
  \\partial^2 z / \\partial x^2

FORBIDDEN in 14.5 (these subscript forms are reserved for 14.3 / 14.7):
  z_x, z_r, z_s, z_t           ✗ never in 14.5
  f_x, f_y, f_xx, f_xy         ✗ never in 14.5
  y_t, x_r                     ✗ never in 14.5

The chain rule must be stated explicitly in the explanation, in Leibniz form:
  partial z / partial r = (partial z / partial x)(partial x / partial r) + (partial z / partial y)(partial y / partial r)
  partial z / partial s = (partial z / partial x)(partial x / partial s) + (partial z / partial y)(partial y / partial s)
  d z / d t              = (partial z / partial x)(d x / d t)             + (partial z / partial y)(d y / d t)

Apply Leibniz notation to:
  - the question text (e.g. "Find ∂z/∂r in terms of x, y, r, and s.")
  - every choice (if MC)
  - the answer field
  - every step of the explanation — state the chain rule first, compute each partial, then substitute

Worked example for a 14.5 question:
  question: "Let z = f(x, y) = x^2*y + y^3, where x = r^2 - s and y = r*s^2. Find partial z / partial r in terms of x, y, r, and s."
  answer:   "partial z / partial r = 2*x*y*(2*r) + (x^2 + 3*y^2)*(s^2)"
  explanation:
    "partial z / partial r = (partial z / partial x)*(partial x / partial r) + (partial z / partial y)*(partial y / partial r)
     = (2*x*y)*(2*r) + (x^2 + 3*y^2)*(s^2)"

Subscript notation REMAINS the convention in OTHER chapter-14 sections — do not change them:
  - 14.3 Partial Derivatives:   f_x, f_y, f_xx, f_yy, f_xy as usual
  - 14.7 Maximum and Minimum:   f_xx, f_yy, f_xy required for the D-test
  - 14.6 Directional Derivatives: gradient ∇f and dot products as usual
The Leibniz override applies ONLY to 14.5 chain-rule questions.

14.7 Maximum and Minimum Values — rotate through 5 types:
TYPE 1: Find/classify ALL critical points (2-4 points). Functions: x^3+y^3-3x-3y, x^3-3xy+y^3, x^4-2x^2+y^2.
TYPE 2: Classify a GIVEN critical point (a,b). Choices: local min/max/saddle/inconclusive.
TYPE 3: Interpret fxx, fyy, fxy values. Compute D=fxx*fyy-(fxy)^2.
TYPE 4: Which function has given property at origin?
TYPE 5: How many critical points does f have?
D>0 fxx>0→local min; D>0 fxx<0→local max; D<0→saddle; D=0→inconclusive.
Easy: 1 critical point ok. Medium: 2 required. Hard: 3-4 required.
Distractors: use correct-looking coordinates with wrong classification or sign errors.
14.7 CRITICAL-POINT QUESTIONS ARE PURE TEXT — DO NOT generate any graph for
TYPES 1–5 above. The student computes D = fxx*fyy - (fxy)^2 by hand. Set
hasGraph: false (or omit it) and DO NOT emit graphConfig at the top level
or in choices. Graphs only appear in 14.7 for "which surface is z = f(x,y)"
identification questions — see "surface identification" below.

GRAPH-CHOICE MCQs — REQUIRED for these sections when the question is a
"which graph / which region / which curve / which surface" identification
prompt (NOT for computational answers):

  - 16.1       → graphType: "vectorField"   (gridDensity: 9 required)
  - 16.2       → graphType: "path" at the top level — see "16.2 LINE
                 INTEGRALS" block below. Use "vectorField" choices ONLY
                 for "which vector field is F(x,y) = ..." identification
                 questions, NOT for line-integral computations
  - 14.1, 14.6 → graphType: "contour"        (level curves of z = f(x,y))
  - 15.2, 15.3 → see "15.2/15.3 region rule" below — different from the
                 others: the region is a TOP-LEVEL graph, not a choice
  - 13.1       → graphType: "parametric"     (2D plane curves OR 3D space curves)
  - 14.1, 14.7 → graphType: "surface"        (3D surface identification ONLY,
                 NOT 14.7 critical-point classification)

For "which graph represents F(x,y) = ..." / "which level-curve diagram is
z = ..." / "which curve is r(t) = ..." / "which surface is z = f(x,y)"
questions, emit MCQ choices as graphs instead of text. Each choice is an
object:

"choices": [
  { "graphConfig": { "graphType": "vectorField", "fx": "-y", "fy": "x",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 9 } },
  { "graphConfig": { "graphType": "vectorField", "fx": "y", "fy": "-x",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 9 } },
  { "graphConfig": { "graphType": "vectorField", "fx": "x", "fy": "y",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 9 } },
  { "graphConfig": { "graphType": "vectorField", "fx": "-x", "fy": "-y",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 9 } }
]

Rules for graph-choice MCQs:
- "answer" is the LETTER of the correct choice ("A"/"B"/"C"/"D"), NOT the graphConfig.
- DO NOT set q.hasGraph or q.graphConfig at the top level — for graph-choice
  MCQs the graphs live INSIDE choices. (The 15.2/15.3 region rule is the one
  exception — see below.)
- All four choices must use the same xRange, yRange (and gridDensity for
  vector fields, resolution for contours, etc.) so graphs are visually
  comparable.
- For vectorField: use gridDensity: 9 (preferred) or 7. Do not use
  gridDensity below 7 — sparse fields are hard to read in print.
- fx and fy are math expressions in x and y. Supported: + - * / ^, sin, cos,
  tan, exp, log, ln, sqrt, abs. Use simple polynomial / trig forms.
- Distractors: rotate (swap signs / swap fx with fy / change a coefficient)
  so each graph is visually distinct from the correct one. Never duplicate
  two graphs.
- Use graph choices ONLY for "which graph / region / curve / surface"
  identification prompts. For computational MCQs ("compute the divergence",
  "evaluate the integral"), use string choices as usual.

GRAPH-CHOICE MCQs — additional types beyond vector fields:

For sections 14.1, 14.6 (level curves of multivariable functions):
  Use graphType: "contour".
  Canonical examples:
    z = x^2 + y^2  → levels [1, 4, 9, 16]              (concentric circles)
    z = x^2 - y^2  → levels [-4, -1, 0, 1, 4]          (saddle hyperbolas)
    z = xy         → levels [-4, -1, 1, 4]             (rectangular hyperbolas)
    z = sqrt(x^2 + y^2) → levels [1, 2, 3]             (concentric circles, even spacing)
  Schema:
    { "graphType": "contour", "expression": "x^2+y^2",
      "xRange":[-3,3], "yRange":[-3,3], "levels":[1,4,9,16],
      "showAxes":true, "showLabels":true, "resolution":80 }

15.2/15.3 REGION RULE — different from the other graph types above.
Sections 15.2 and 15.3 ask "evaluate ∬_D ... where D is the region shown".
The single region is shown ABOVE the question as a TOP-LEVEL graph and the
choices are NUMERIC answers (string choices, not graph choices).

For these questions emit a top-level graph using the new system:
  q.hasGraph: true,
  q.graphConfig: { "graphType": "region", "boundaries": [...], "vertices": [...], ... }

DO NOT use the OLD graph schema (type: "area" / fnTop / fnBottom /
shadeFrom / shadeTo) for 15.2 or 15.3 region-of-integration questions.
The old "area" type renders as an empty axis grid for general regions
because fnTop/fnBottom can't express triangle perimeters or x = g(y)
boundaries. ALWAYS use graphType "region" for 15.2/15.3 regions.

graphType "region" details:
  Always provide boundaries in traversal order around the region perimeter.
  Always include vertex dots at intersection points.
  Examples:
    Triangle (0,0),(3,0),(3,3):
      "boundaries": [
        {"kind":"line", "from":[0,0], "to":[3,0],
         "label": {"text":"y = 0", "at":0.5, "offsetY":12}},
        {"kind":"line", "from":[3,0], "to":[3,3],
         "label": {"text":"x = 3", "at":0.5, "offsetX":14, "align":"left"}},
        {"kind":"line", "from":[3,3], "to":[0,0],
         "label": {"text":"y = x", "at":0.5, "offsetY":-8}}
      ],
      "vertices": [
        {"at":[0,0], "label":"(0, 0)", "offsetY":14},
        {"at":[3,0], "label":"(3, 0)", "offsetY":14},
        {"at":[3,3], "label":"(3, 3)", "offsetX":12}
      ]
    Between y=x^2 and y=2x:
      "boundaries": [
        {"kind":"function", "expr":"x^2",   "from":0, "to":2,
         "label": {"text":"y = x^2", "at":0.7, "offsetY":-8}},
        {"kind":"function", "expr":"2*x",   "from":0, "to":2,
         "label": {"text":"y = 2x",  "at":0.5, "offsetY":-10}}
      ],
      "vertices": [
        {"at":[0,0], "label":"(0, 0)", "offsetY":14},
        {"at":[2,4], "label":"(2, 4)", "offsetX":12}
      ]
  Schema:
    { "graphType": "region", "boundaries": [...], "vertices": [...],
      "shaded": true, "hatchAngle": 45,
      "xRange":[-0.5,3], "yRange":[-0.5,5],
      "axisLabels": {"x":["0","2"], "y":[], "fontSize": 14} }
  Boundary kinds: "function" (y = expr in x), "function_y" (x = expr in y),
  "line" (segment with from/to), "circle" (center+radius, optional arcFrom/arcTo in degrees).

  axisLabels.fontSize is optional (default 12). Use 14 for printed exam
  clarity on most diagrams; bump higher only when the panel is sparse.

  Vertices accept two forms — pick whichever fits the question:
    [-2, 4]                                      → unlabeled dot
    { "at": [1, 1], "label": "(1, 1)", "offsetY": -10 }
                                                 → dot + coordinate label
  Object form fields: at (required [x,y]), label (string), offsetX,
  offsetY (pixels — negative offsetY is up; default offsetY 14 places
  the label below the dot), align ("left"/"center"/"right"), fontSize
  (default 13). Labels render with a white halo so they stay readable
  over the hatch. Use object form whenever the vertex coordinates carry
  pedagogical weight (intersection points, region corners) — use plain
  arrays for purely decorative dots.

For region questions, ALWAYS label each boundary curve. Add a "label" field
to each boundary:

  label: { text: "y = x^2", at: 0.7, offsetY: -8 }

Field meanings:
  - text:    the boundary equation as a plain string. Supports ^N for
             superscripts (e.g. "x^2", "y = e^{2x}"), _N for subscripts,
             Greek names (alpha → α, theta → θ, pi → π, sigma → σ, ...),
             and "sqrt" (renders as √). Avoid fractions / integrals.
  - at:      0..1 fraction along the curve where the label anchors.
             Default 0.5 (midpoint). Use distinct "at" values when two
             boundaries are close together so labels don't collide.
  - offsetX: horizontal nudge in pixels (default 0).
  - offsetY: vertical nudge in pixels, NEGATIVE = up (default -10, i.e.
             label sits 10px above the curve).
  - align:   "left" | "center" | "right" (default "center"). For vertical
             lines like x = 3, "left" places text right of the line.
  - fontSize: pixel font size (default 14). Optional — bump to 16 or 18
             for emphasis on the most important boundary, or shrink to 12
             on a busy diagram. Most labels should keep the default.

Per-kind label conventions:
  - function (y = expr):   label.text = "y = <expr>", e.g. "y = x^2".
  - function_y (x = expr): label.text = "x = <expr>", e.g. "x = sqrt(y)".
  - line (axis-aligned):   label.text = the line's equation, e.g. "x = 2",
                           "y = 0". For diagonal lines, write "y = mx + b".
  - circle:                label.text = the circle's equation, e.g.
                           "x^2 + y^2 = 4". Anchor "at" runs along the arc.

Every boundary in a region question must carry a label. Choose offsets so
that the four labels of a quadrilateral, or the two labels between bounding
curves, never overlap each other or the hatch fill.

For section 13.1 (parametric curves, space curves):
  Use graphType: "parametric".
  Set dimensions:2 for plane curves, dimensions:3 for space curves.
  Always include showStartDot:true and showDirectionArrow:true so students can
  see orientation.
  Schema (2D):
    { "graphType":"parametric", "dimensions":2,
      "xExpr":"cos(t)", "yExpr":"sin(t)",
      "tRange":[0, 6.2832], "samples":200,
      "showStartDot":true, "showDirectionArrow":true, "showAxes":true,
      "xRange":[-1.5,1.5], "yRange":[-1.5,1.5] }
  Schema (3D, helix):
    { "graphType":"parametric", "dimensions":3,
      "xExpr":"cos(t)", "yExpr":"sin(t)", "zExpr":"t",
      "tRange":[0, 12.56], "samples":300,
      "showStartDot":true, "showDirectionArrow":true, "showAxes":true,
      "isoScale":30 }

For sections 14.1 and 14.7 SURFACE-IDENTIFICATION questions
("which surface is z = f(x,y)?") — NOT for 14.7 critical-point
classification, which is pure text:
  Use graphType: "surface".
  Set hint to one of "paraboloid" | "saddle" | "plane" | "cone" | "sphere"
  when the surface is one of these standard families. Otherwise omit hint
  (generic mesh fallback). Hinted surfaces look much cleaner — prefer them
  whenever applicable.
  Examples:
    z = x^2 + y^2 → hint:"paraboloid"
    z = x^2 - y^2 → hint:"saddle"
    z = 2 - x - y → hint:"plane"
    z = sqrt(x^2 + y^2) → hint:"cone"
  Schema:
    { "graphType":"surface", "expression":"x^2+y^2",
      "xRange":[-2,2], "yRange":[-2,2],
      "meshDensity":12, "isoScale":30,
      "showAxes":true, "hint":"paraboloid" }

All graph-choice MCQs (every type above): "answer" is the LETTER of the
correct choice, never the graphConfig itself. All four choices in one
question must use the same graphType (don't mix vector fields with surfaces
in one question).

SECTION 16.2 LINE INTEGRALS — REQUIRED VARIETY:

Across a batch of 16.2 questions, ROTATE through these forms graded by
difficulty:

TYPE A — Scalar line integral ∫_C f(x,y) ds
  • Easy/Medium/Hard: any difficulty.
  • Same form across difficulties; harder = harder integrand or path.

TYPE B — Differential form, graded by difficulty AND path count:

  • Easy:   single term (∫P dx OR ∫Q dy), ONE path
  • Medium: single term (∫P dx OR ∫Q dy), TWO paths (piecewise C_1 ∪ C_2)
  • Hard:   combined (∫P dx + Q dy), ALTERNATING path count across the batch

For Hard TYPE B alternating path count:
  - When the batch has 1 Hard TYPE B question → use 1 path
  - When the batch has 2+ Hard TYPE B questions → alternate: 1st = 1 path,
    2nd = 2 paths, 3rd = 1 path, 4th = 2 paths, ...
  - This gives students practice on both single-curve and piecewise
    combined integrals.

For Medium TYPE B with two paths: keep the integrand consistent across
both segments (same P or same Q) — students integrate over each piece
and add. Don't switch from ∫P dx on C_1 to ∫Q dy on C_2.

TYPE A (∫f ds) and TYPE C (∫F·dr) — path count is flexible:
  • These types are left flexible for now (sub-flavor system will refine
    later). Use single path for Easy, single or piecewise for Medium/Hard
    based on what fits the integrand naturally.

TYPE C — Vector form ∫_C F · dr
  • Easy/Medium/Hard: any difficulty.
  • Always combined form (F = ⟨P, Q⟩ has both components by definition).

Across a batch, distribute roughly:
  • 35% TYPE A
  • 45% TYPE B (split: ~half single-term ∫P dx or ∫Q dy, ~half combined)
  • 20% TYPE C

For TYPE B and TYPE C: explanation MUST include the parameterization step
(let x = g(t), y = h(t), then dx = g'(t)dt, dy = h'(t)dt) — that's the
core pedagogical content. For TYPE B with single-term ∫P dx only, the
explanation should still show dy = h'(t)dt is computed even if not used,
so students understand what's happening.

PATH COMPLEXITY summary by difficulty (overrides previous PATH COMPLEXITY rules):
  • Easy:   1 segment (TYPE B always; TYPE A/C usually)
  • Medium: 1 or 2 segments depending on TYPE
            - TYPE B: always 2 segments (per TYPE B rules above)
            - TYPE A/C: 1 segment usually, 2 ok if natural
  • Hard:   alternating for TYPE B (per rules above); 1 or 2 for TYPE A/C

For ALL 16.2 questions, attach a graph showing the path. Use:
  hasGraph: true
  graphConfig: {
    graphType: "path",
    segments: [...],
    endpoints: [...],
    xRange: [...],
    yRange: [...]
  }

NEVER use the old type:"single" with fn for 16.2 — that renders a
function plot, not a path.

Each segment may have:
  - kind: "function" (y = f(x), with from/to over x), "function_y"
    (x = f(y), with from/to over y), "line" (from [x1,y1] to [x2,y2]),
    "circle" (center [cx,cy], radius, arcFrom/arcTo in degrees), or
    "parametric" (xExpr, yExpr in t, with tFrom/tTo).
  - label: { text, at, offsetX, offsetY, align, fontSize } — same shape
    as region boundary labels; supports x^2 superscripts, _1 subscripts,
    Greek names, sqrt → √. fontSize defaults to 14 — bump to 16/18 for
    emphasis on the curve label (e.g. the C in a single-segment path).
  - directionArrow: true (default) — small filled-triangle arrowhead at
    arrowAt (default 0.5) showing path orientation.

Each endpoint is { at: [x,y], label: "(0,0)", offsetX, offsetY, align,
fontSize }. The label is rendered with a white halo so it stays readable
over hatch or curves. Endpoint fontSize defaults to 13 (slightly smaller
than segment labels so the curve name dominates).

Example single curve (TYPE A, parabola):
  graphConfig: {
    graphType: "path",
    segments: [{
      kind: "function", expr: "x^2", from: 0, to: 1,
      label: { text: "C: y = x^2", at: 0.6, offsetY: -10 },
      directionArrow: true, arrowAt: 0.5
    }],
    endpoints: [
      { at: [0,0], label: "(0,0)", offsetY: 14 },
      { at: [1,1], label: "(1,1)", offsetX: 10 }
    ],
    xRange: [-0.3, 1.5], yRange: [-0.3, 1.5]
  }

Example piecewise (TYPE B Hard, two line segments):
  graphConfig: {
    graphType: "path",
    segments: [
      {
        kind: "line", from: [0,0], to: [2,0],
        label: { text: "C_1", at: 0.5, offsetY: -12 },
        directionArrow: true
      },
      {
        kind: "line", from: [2,0], to: [2,3],
        label: { text: "C_2", at: 0.5, offsetX: 12 },
        directionArrow: true
      }
    ],
    endpoints: [
      { at: [0,0], label: "(0,0)", offsetY: 14 },
      { at: [2,0], label: "(2,0)", offsetY: 14 },
      { at: [2,3], label: "(2,3)", offsetX: 10 }
    ],
    xRange: [-0.3, 3], yRange: [-0.3, 3.5]
  }

Example circular arc (TYPE C Hard):
  graphConfig: {
    graphType: "path",
    segments: [{
      kind: "circle", center: [0,0], radius: 1, arcFrom: 0, arcTo: 90,
      label: { text: "C: x^2 + y^2 = 1", at: 0.5, offsetX: 12, offsetY: -8 },
      directionArrow: true, arrowAt: 0.5
    }],
    endpoints: [
      { at: [1,0], label: "(1,0)", offsetY: 14 },
      { at: [0,1], label: "(0,1)", offsetX: -14 }
    ],
    xRange: [-0.3, 1.5], yRange: [-0.3, 1.5]
  }

ALWAYS include direction arrows on each segment to show orientation.
ALWAYS label endpoints with their coordinates.
ALWAYS label each segment (use C, C_1, C_2, etc.).

For path graphs you may also pass axisLabels with an optional fontSize:
  axisLabels: { x: ["-1", "0", "1", "2"], y: ["-1", "0", "1", "2"], fontSize: 14 }
fontSize defaults to 12; use 14 on printed exams. Omit axisLabels
entirely when no axis tick numbering is needed — the panel will then
show only the axis lines themselves.` : "";

  const calcGraphInstructions = hasGraphQuestions ? `
GRAPH QUESTIONS:
- 1 function → type "single", fn = expression. e.g. {"type":"single","fn":"x^2-3","showAxisNumbers":true,"showGrid":true,"xDomain":[-4,4]}
- 2 functions → type "area", fnTop/fnBottom, shadeFrom/shadeTo at intersections. e.g. {"type":"area","fnTop":"x+2","fnBottom":"x^2","shadeFrom":-1,"shadeTo":2,"showAxisNumbers":true,"showGrid":true,"xDomain":[-3,4]}
- Region/domain → type "domain". e.g. {"type":"domain","boundary":"x^2","shadeAbove":true,"boundaryDashed":true,"boundaryLabel":"y = x²","showAxisNumbers":true,"showGrid":true,"xDomain":[-3,3]}
- Holes: "holes":[[x,y]] open circles, "points":[[x,y]] filled dots.
- NO yDomain (auto-calculated). DO include xDomain.
- Text: "Based on the graph above, ..." — never describe graph in text.
- graphConfig expressions MUST exactly match functions in question text.

CHAPTER 15 INTEGRALS — show 2D region R in xy-plane, never the 3D surface:
15.1 Rectangles: type "area", fnTop=upper y constant, fnBottom=lower y constant, shadeFrom/shadeTo=x bounds.
  Vary bounds widely. Examples: R=[1,4]x[1,3], R=[-1,2]x[1,3], R=[2,5]x[0,3].
  {"type":"area","fnTop":"3","fnBottom":"1","shadeFrom":1,"shadeTo":4,"fnTopLabel":"y=3","fnBottomLabel":"y=1","showAxisNumbers":true,"showGrid":true,"xDomain":[0,5],"yDomain":[0,4]}
15.2 General regions: USE THE NEW graphType "region" SCHEMA (see CALCULUS 3
  rules below) — NOT type "area". General 2D regions for double integrals
  almost always have piecewise boundaries (line segments, x = g(y) sides,
  triangle perimeters) that the old fnTop/fnBottom/area schema cannot
  express; rendering it produces an empty axis grid.
15.3 Polar: USE THE NEW graphType "region" SCHEMA with circle / arc
  boundaries — NOT type "area".` : "";

  return `TESTBANK_GENERATE_REQUEST
Course: ${course} (Stewart Early Transcendentals 9th Edition)
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstruction}
${calcGraphInstructions}
${calc3Rules}
You are a college math professor writing exam questions from Stewart Calculus Early Transcendentals 9th Edition. Questions must be rigorous, formally written, and match Stewart style.
${mathNotationBase}
- L{f(t)} Laplace notation: L{t^2}, L{e^(at)}, L^{-1}{F(s)}
- Fractions: (numerator)/(denominator) — e.g. (10)/(s^3), (1)/((s-3)^2)
- Nested denominator: (1)/((s-a)^2) — double parens

BRANCHED MCQ (when qType is "Branched MCQ"):
- Shared stem (e.g. "Let f(x) = x^2 - 4x + 3 on [0, 5]") followed by 2-4 multiple-choice parts.
- Easy: 2 parts. Medium: 3-4 parts. Hard: 4 parts.
- Each part is a fully independent MCQ — its own question, 4 choices, exactly one correct answer.
- All parts reference the SAME stem (same function, same interval, same scenario).
- Distractors per part: same-question distractors only — never put answers to a different part in the choice list. Distractors should reflect the typical sign / off-by-one / chain-rule mistakes for the topic.
- The 4 parts must each test a DIFFERENT operation (e.g. find domain, find critical points, evaluate definite integral, classify extremum) — do not test the same skill four times.
- Do NOT include "mark" or "marks" fields anywhere in the JSON. Marks are added manually after generation.
${commonRules}`;
}
