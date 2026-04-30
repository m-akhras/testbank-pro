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

14.7 Maximum and Minimum Values — rotate through 5 types:
TYPE 1: Find/classify ALL critical points (2-4 points). Functions: x^3+y^3-3x-3y, x^3-3xy+y^3, x^4-2x^2+y^2.
TYPE 2: Classify a GIVEN critical point (a,b). Choices: local min/max/saddle/inconclusive.
TYPE 3: Interpret fxx, fyy, fxy values. Compute D=fxx*fyy-(fxy)^2.
TYPE 4: Which function has given property at origin?
TYPE 5: How many critical points does f have?
D>0 fxx>0→local min; D>0 fxx<0→local max; D<0→saddle; D=0→inconclusive.
Easy: 1 critical point ok. Medium: 2 required. Hard: 3-4 required.
Distractors: use correct-looking coordinates with wrong classification or sign errors.

VECTOR FIELD GRAPH MCQs (sections 16.1, 16.2, and 14.6 only):
For "which graph represents F(x,y) = ..." or "which vector field is shown" questions,
you may emit MCQ choices as graphs instead of text. Each choice is an object:

"choices": [
  { "graphConfig": { "graphType": "vectorField", "fx": "-y", "fy": "x",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 5 } },
  { "graphConfig": { "graphType": "vectorField", "fx": "y", "fy": "-x",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 5 } },
  { "graphConfig": { "graphType": "vectorField", "fx": "x", "fy": "y",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 5 } },
  { "graphConfig": { "graphType": "vectorField", "fx": "-x", "fy": "-y",
                     "xRange": [-2,2], "yRange": [-2,2], "gridDensity": 5 } }
]

Rules for graph-choice MCQs:
- "answer" is the LETTER of the correct choice ("A"/"B"/"C"/"D"), NOT the graphConfig.
- All four choices must use the same xRange, yRange, and gridDensity so the
  graphs are visually comparable.
- fx and fy are math expressions in x and y. Supported: + - * / ^, sin, cos,
  tan, exp, log, ln, sqrt, abs. Use simple polynomial / trig forms.
- Distractors: rotate (swap signs / swap fx with fy) so each graph is
  visually distinct from the correct one. Never duplicate two graphs.
- Use graph choices ONLY for "which graph" / "which vector field" prompts.
  For text-style MCQs ("which formula gives the curl..."), use string choices
  as usual. This is an additional capability, not the default.

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

For sections 15.2, 15.3 (regions of integration in double integrals):
  Use graphType: "region".
  Always provide boundaries in traversal order around the region perimeter.
  Always include vertex dots at intersection points.
  Examples:
    Triangle (0,0),(3,0),(3,3):
      "boundaries": [
        {"kind":"line", "from":[0,0], "to":[3,0]},
        {"kind":"line", "from":[3,0], "to":[3,3]},
        {"kind":"line", "from":[3,3], "to":[0,0]}
      ],
      "vertices": [[0,0],[3,0],[3,3]]
    Between y=x^2 and y=2x:
      "boundaries": [
        {"kind":"function", "expr":"x^2",   "from":0, "to":2},
        {"kind":"function", "expr":"2*x",   "from":0, "to":2}
      ],
      "vertices": [[0,0],[2,4]]
  Schema:
    { "graphType": "region", "boundaries": [...], "vertices": [...],
      "shaded": true, "hatchAngle": 45,
      "xRange":[-0.5,3], "yRange":[-0.5,5],
      "axisLabels": {"x":["0","2"], "y":[]} }
  Boundary kinds: "function" (y = expr in x), "function_y" (x = expr in y),
  "line" (segment with from/to), "circle" (center+radius, optional arcFrom/arcTo in degrees).

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

For sections 14.1, 14.7 (3D surfaces, z = f(x,y)):
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
in one question).` : "";

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
15.2 General regions: type "area", fnTop/fnBottom=boundary curves, shadeFrom/shadeTo=intersection x-values.
15.3 Polar: use type "area" for approximate Cartesian equivalent.` : "";

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
${commonRules}`;
}
