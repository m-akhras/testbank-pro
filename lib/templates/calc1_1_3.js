export const calc1_1_3_template = {
  id: "calc1_1_3",
  version: 3,
  course: "Calculus 1",
  section: "1.3",
  sectionTitle: "New Functions from Old Functions",
  textbook: "Stewart Early Transcendentals 9th Ed",

  fields: [
    {
      id: "count",
      label: "How many questions?",
      type: "number",
      default: 5,
      min: 1,
      max: 20
    },
    {
      id: "primary_focus",
      label: "Primary focus",
      type: "single_select",
      default: "mix",
      options: [
        { value: "mix", label: "A mix across the section (recommended)" },
        { value: "vertical_shifts", label: "Vertical shifts (up/down)" },
        { value: "horizontal_shifts", label: "Horizontal shifts (left/right)" },
        { value: "reflections", label: "Reflections (about x-axis or y-axis)" },
        { value: "vertical_stretches", label: "Vertical stretches and compressions" },
        { value: "horizontal_stretches", label: "Horizontal stretches and compressions" },
        { value: "combined_transformations", label: "Combined transformations (multiple at once)" },
        { value: "composition", label: "Function composition (f o g)" },
        { value: "arithmetic_operations", label: "Arithmetic combinations (f + g, f - g, f * g, f / g)" },
        { value: "decomposition", label: "Decomposition (express F as f o g or f o g o h)" }
      ]
    },
    {
      id: "representation_forms",
      label: "Representation forms to include",
      type: "multi_select",
      default: ["algebraic", "graphical"],
      minSelections: 1,
      options: [
        { value: "algebraic", label: "Algebraic (formula given)" },
        { value: "graphical", label: "Graphical (graph given)" },
        { value: "numerical", label: "Numerical (table given)" },
        { value: "verbal", label: "Verbal (word description)" }
      ]
    },
    {
      id: "function_types",
      label: "Function types to feature",
      type: "multi_select",
      default: ["polynomial", "radical"],
      minSelections: 1,
      options: [
        { value: "polynomial", label: "Polynomial (linear, quadratic, cubic)" },
        { value: "rational", label: "Rational" },
        { value: "radical", label: "Radical (square/cube roots)" },
        { value: "absolute_value", label: "Absolute value" },
        { value: "piecewise", label: "Piecewise" },
        { value: "trigonometric", label: "Trigonometric" },
        { value: "exponential", label: "Exponential" },
        { value: "logarithmic", label: "Logarithmic" }
      ]
    },
    {
      id: "domain_complexity",
      label: "Domain complexity",
      type: "single_select",
      default: "moderate",
      options: [
        { value: "trivial", label: "Trivial (polynomials, all reals)" },
        { value: "moderate", label: "Moderate (standard restrictions)" },
        { value: "advanced", label: "Advanced (transformations affecting domain)" },
        { value: "mix", label: "Mix across questions" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select_with_counts",
      default: [
        { value: "write_equation_from_description", count: 2 },
        { value: "describe_transformation_from_equation", count: 1 },
        { value: "match_equation_to_graph", count: 1 },
        { value: "compute_composition", count: 1 }
      ],
      minSelections: 1,
      options: [
        { value: "write_equation_from_description", label: "Write equation from verbal transformation description (Stewart Ex 1)" },
        { value: "describe_transformation_from_equation", label: "Describe transformation given the equation (Stewart Ex 2)" },
        { value: "match_equation_to_graph", label: "Match equation to labeled graph (Stewart Ex 3)" },
        { value: "draw_transformed_graph", label: "Draw graph of transformed function (Stewart Ex 4, 5)" },
        { value: "sketch_from_parent", label: "Sketch by starting from a standard parent function (Stewart Ex 9-26)" },
        { value: "combine_arithmetic", label: "Combine f and g arithmetically with domain (Stewart Ex 33-34)" },
        { value: "compute_composition", label: "Compute f o g, g o f, f o f, g o g with domain (Stewart Ex 35-40)" },
        { value: "compose_three_functions", label: "Compute f o g o h (Stewart Ex 41-44)" },
        { value: "decompose_into_composition", label: "Express F as f o g or f o g o h (Stewart Ex 45-54)" },
        { value: "evaluate_composition", label: "Evaluate (f o g)(a) at a specific point" },
        { value: "find_domain", label: "Find domain after transformation or combination" }
      ]
    },
    {
      id: "graphs_option",
      label: "Include graphs?",
      type: "single_select",
      default: "many",
      options: [
        { value: "none", label: "No graphs" },
        { value: "some", label: "Some questions include graphs (~30-40%)" },
        { value: "many", label: "Many questions include graphs (~60-70%)" },
        { value: "all", label: "All questions use graphs" }
      ]
    },
    {
      id: "tables_option",
      label: "Include tables?",
      type: "single_select",
      default: "none",
      options: [
        { value: "none", label: "No tables" },
        { value: "few", label: "One or two questions use a table" },
        { value: "several", label: "Several questions use tables" }
      ]
    },
    {
      id: "question_type",
      label: "Question type",
      type: "single_select",
      default: "multiple_choice",
      options: [
        { value: "multiple_choice", label: "Multiple Choice" },
        { value: "free_response", label: "Free Response" },
        { value: "mix", label: "Mix of both" }
      ]
    },
    {
      id: "free_text",
      label: "Additional instructions (optional)",
      type: "free_text",
      default: "",
      placeholder: "e.g., Focus on horizontal vs. vertical shift confusion. Include at least one composition question. Avoid trigonometric examples."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    reference_examples: [
      {
        stem: "Suppose the graph of f is given. Write an equation for the graph that is obtained by shifting 3 units to the right.",
        choices: ["y = f(x - 3)", "y = f(x + 3)", "y = f(x) - 3", "y = f(x) + 3"],
        answer: "y = f(x - 3)",
        explanation: "Replacing x with x - 3 shifts the graph horizontally to the RIGHT by 3 units. Students commonly choose y = f(x + 3) thinking 'plus means right' — but the input shift is opposite to intuition. The remaining options describe vertical shifts."
      },
      {
        stem: "Explain how the graph of y = f(x + 8) is obtained from the graph of y = f(x).",
        choices: [
          "Shift the graph 8 units to the left",
          "Shift the graph 8 units to the right",
          "Shift the graph 8 units upward",
          "Shift the graph 8 units downward"
        ],
        answer: "Shift the graph 8 units to the left",
        explanation: "Replacing x with x + 8 shifts the graph horizontally to the LEFT by 8 units (input shifts go opposite to the sign). The other options are common errors: confusing left/right direction or confusing input change with output change."
      },
      {
        stem: "Explain how the graph of y = 8f(x) is obtained from the graph of y = f(x).",
        choices: [
          "Stretch the graph vertically by a factor of 8",
          "Compress the graph vertically by a factor of 8",
          "Stretch the graph horizontally by a factor of 8",
          "Compress the graph horizontally by a factor of 8"
        ],
        answer: "Stretch the graph vertically by a factor of 8",
        explanation: "Multiplying the OUTPUT by 8 stretches the graph vertically by factor 8 (every y-value becomes 8 times larger). Students confuse this with y = f(8x), which is a HORIZONTAL compression by factor 8."
      },
      {
        stem: "If f(x) = sqrt(25 - x^2) and g(x) = sqrt(x + 1), find f + g and state its domain.",
        choices: [
          "(f + g)(x) = sqrt(25 - x^2) + sqrt(x + 1), domain [-1, 5]",
          "(f + g)(x) = sqrt(25 - x^2) + sqrt(x + 1), domain [-5, 5]",
          "(f + g)(x) = sqrt(25 - x^2 + x + 1), domain [-1, 5]",
          "(f + g)(x) = sqrt(25 - x^2) + sqrt(x + 1), domain (-1, 5)"
        ],
        answer: "(f + g)(x) = sqrt(25 - x^2) + sqrt(x + 1), domain [-1, 5]",
        explanation: "Sum of two functions: add the formulas, no algebraic simplification. The domain of f is [-5, 5] (from 25 - x^2 >= 0). The domain of g is [-1, infinity) (from x + 1 >= 0). The domain of f + g is the INTERSECTION: [-1, 5]. Endpoints included since both functions are defined at x = -1 and x = 5."
      },
      {
        stem: "If f(x) = x^3 + 5 and g(x) = cube_root(x), find f o g.",
        choices: [
          "(f o g)(x) = x + 5",
          "(f o g)(x) = cube_root(x^3 + 5)",
          "(f o g)(x) = x^3 + 5",
          "(f o g)(x) = (x + 5)^3"
        ],
        answer: "(f o g)(x) = x + 5",
        explanation: "Composition (f o g)(x) = f(g(x)) means apply g first, then f. Compute g(x) = cube_root(x), then substitute into f: f(cube_root(x)) = (cube_root(x))^3 + 5 = x + 5. Students who chose cube_root(x^3 + 5) computed (g o f)(x) instead — the order matters."
      },
      {
        stem: "Express the function F(x) = (2x + x^2)^4 in the form f o g.",
        choices: [
          "f(x) = x^4, g(x) = 2x + x^2",
          "f(x) = 2x + x^2, g(x) = x^4",
          "f(x) = x^2, g(x) = 2x + x^4",
          "f(x) = (2x)^4, g(x) = x^2"
        ],
        answer: "f(x) = x^4, g(x) = 2x + x^2",
        explanation: "Decomposition: find an inner function g and an outer function f such that f(g(x)) = F(x). Here the inner expression being raised to the 4th power is 2x + x^2 — that's g. The outer operation is 'raise to the 4th power' — that's f(x) = x^4. Verify: f(g(x)) = f(2x + x^2) = (2x + x^2)^4. The standard convention is g handles what's inside the outermost operation."
      }
    ],

    conditional_quality_blocks: [
      {
        condition: { field: "student_tasks", includes: "write_equation_from_description" },
        content: `
NO GRAPH FOR write_equation_from_description (Stewart §1.3 Ex 1 style):
When the task is "write the equation for the graph obtained by shifting/reflecting/stretching f", the question is purely verbal-to-algebraic. Stewart's Exercise 1 has NO graph for these — only the verbal description ("shift 3 units to the right") and the student writes the equation.

For ANY question whose primary_task is "write_equation_from_description":
- DO NOT include hasGraph or graphConfig in the question object.
- The stem should read like Stewart Ex 1: "Suppose the graph of f is given. Write an equation for the graph that is obtained by [verbal transformation description]."
- Do NOT specify what f is concretely (e.g. do not say "f(x) = sqrt(x)"). Stewart's Ex 1 deliberately uses abstract f so students reason about the transformation rule itself, not the specific function.
- Choices are equations in f notation: y = f(x - 3), y = f(x + 3), y = f(x) - 3, y = f(x) + 3.

This eliminates the visual confusion of showing the BEFORE graph while asking for the AFTER equation.
`
      },
      {
        condition: { field: "student_tasks", includes: "describe_transformation_from_equation" },
        content: `
NO GRAPH FOR describe_transformation_from_equation (Stewart §1.3 Ex 2 style):
When the task is "describe how the graph of y = [transformed equation] is obtained from y = f(x)", the question is purely algebraic-to-verbal. Stewart's Exercise 2 has NO graph for these — only the equation and the student describes the transformation in words.

For ANY question whose primary_task is "describe_transformation_from_equation":
- DO NOT include hasGraph or graphConfig in the question object.
- The stem should read like Stewart Ex 2: "Explain how the graph of y = f(x + 8) is obtained from the graph of y = f(x)."
- Keep f abstract — do not specify f(x) = something concrete unless the question is explicitly about a parent function transformation (like y = -(x-1)^2 + 2 as a transformation of y = x^2).
- Choices are verbal descriptions: "Shift 8 units to the left", "Shift 8 units to the right", etc.

This eliminates the visual confusion of showing one graph while asking about the algebraic transformation of an unrelated f.
`
      },
      {
        condition: { field: "student_tasks", includes: "match_equation_to_graph" },
        content: `
PATTERN B FRAMING FOR match_equation_to_graph (Stewart §1.3 Ex 3 style):
When the task is to match an equation to a graph, use Pattern B (no stem graph; four graphConfig choices). The student visualizes the parent function in their head and picks the choice that matches the transformed equation.

STEM FRAMING (use this style, anchored to a familiar parent):
- "Starting from the parent function f(x) = x^2, which graph represents y = -(x - 1)^2 + 2?"
- "Starting from the parent function f(x) = sqrt(x), which graph represents y = 2*sqrt(x + 3) - 1?"
- "Starting from y = |x|, which of the following graphs represents y = -|x - 2| + 3?"

The "starting from..." phrasing makes the before/after relationship explicit even though only the AFTER candidates are drawn. Use a familiar parent (x^2, sqrt(x), |x|, x^3, 1/x, sin(x)) so students don't need to see the parent rendered.

GRAPH CHOICES (4 graphConfig objects, each using "graphType": "single", NOT "type"):
- All four must use the SAME xDomain and yDomain so visual comparison is fair.
- Vary the transformation parameters across the choices to hit canonical errors:
  * Correct answer
  * Horizontal direction reversed (e.g. (x+1)^2 vs (x-1)^2)
  * Vertical direction reversed (e.g. +2 vs -2)
  * Reflection omitted (e.g. (x-1)^2 + 2 instead of -(x-1)^2 + 2)
- Each choice should include a "points" array marking the vertex/key feature so the visual anchor is clear.

CRITICAL RENDERER WORKAROUND:
The current renderer has a known bug with leading-minus-on-squared-term expressions like "-(x-1)^2 + 2" — they render as a single dot with no curve. To avoid this:
- EXPAND the squared expression: write "-x^2 + 2*x + 1" instead of "-(x-1)^2 + 2".
- For y = -(x - h)^2 + k, expand to "-x^2 + (2*h)*x + (k - h^2)".
- For y = -2*(x - h)^2 + k, expand to "-2*x^2 + (4*h)*x + (k - 2*h^2)".
- For y = (x - h)^2 + k (no leading minus), the original form is fine: "(x - h)^2 + k" renders correctly.

This expansion workaround is temporary until the renderer is patched.

DO NOT use match_equation_to_graph for parent functions the renderer can't handle. Stick to polynomials, sqrt, absolute value, x^3, 1/x, sin, cos.
`
      },
      {
        condition: { field: "primary_focus", equals: "horizontal_shifts" },
        content: `
HORIZONTAL SHIFT QUALITY REQUIREMENTS (Stewart §1.3):
The most common student error is confusing the direction: f(x - h) shifts RIGHT by h units (NOT left), and f(x + h) shifts LEFT by h units (NOT right).

STEWART'S PHRASING (use this style):
- "Suppose the graph of f is given. Write an equation for the graph that is obtained by shifting 3 units to the right."
- "Explain how the graph of y = f(x + 8) is obtained from the graph of y = f(x)."

These are NOT abstract memorization questions. They are concrete: given a verbal description, write the equation; or given the equation, describe the transformation.

GOOD examples (textbook-style):
- Give the equation y = f(x - 4) and ask what transformation produces this from y = f(x). Answer: shift 4 units to the right.
- Give the verbal description "shift 3 units to the left" and ask for the equation. Answer: y = f(x + 3).
- Given y = sqrt(x), find the equation of the graph obtained by shifting 4 units to the left. Answer: y = sqrt(x + 4).

BAD example (do NOT generate): A question that asks the student to memorize a rule with no concrete graph or function context.

DISTRACTORS: include the opposite direction shift as the most attractive wrong answer. Also include a vertical shift (e.g. y = f(x) + 3) as a "confused input/output" distractor.

When stating the transformation in prose, use Stewart's exact phrasing: "shifted 3 units to the right" or "shifted 3 units to the left" — never "shifted by 3" or "shifted positively by 3".
`
      },
      {
        condition: { field: "primary_focus", equals: "combined_transformations" },
        content: `
COMBINED TRANSFORMATIONS QUALITY REQUIREMENTS (Stewart §1.3):
Stewart introduces combined transformations through specific worked patterns. Match these.

STEWART'S PHRASING:
- "Explain how each graph is obtained from the graph of y = f(x)." [Stewart Ex 2]
- "Use transformations to create a function whose graph is as shown." [Stewart Ex 6-7]

STEWART'S CANONICAL COMBINATIONS (use these patterns):
- y = -f(x) - 1 (reflect about x-axis, then shift down)
- y = 8f((1/8)x) (vertical stretch combined with horizontal stretch)
- y = 2f(x + 6) (horizontal shift combined with vertical stretch)
- y = -(x - 1)^2 + 3 (transformation of standard parent y = x^2)
- y = -sqrt(3x - x^2) (reflection of an existing graph)

ORDER MATTERS for the input side. When you see f(2(x - 3)), the operations are: horizontal shift right by 3, then horizontal compression by factor 2 (applied to the input). Stewart's convention: read the input transformations from the inside out.

GOOD examples:
- Start with y = x^2. Apply: reflect about x-axis, then shift left 1 unit, then up 3 units. Write the equation. Answer: y = -(x + 1)^2 + 3.
- Given the graph of f, sketch the graph of y = 2f(x + 6). Describe each transformation.
- Express y = (x + 1)^3 + 2 as a transformation of the parent function y = x^3.

LIMIT to 2-3 transformations per question. More than that becomes algebraic bookkeeping rather than conceptual.

DISTRACTORS: students apply transformations in the wrong order, or confuse input-side (horizontal) with output-side (vertical) transformations. Include at least one distractor that swaps shift directions.
`
      },
      {
        condition: { field: "primary_focus", equals: "composition" },
        content: `
COMPOSITION QUALITY REQUIREMENTS (Stewart §1.3):
Stewart introduces composition with concrete examples like Exercises 35-40 ("Find f o g, g o f, f o f, and g o g, and their domains").

STEWART'S PHRASING:
- "Find f o g, g o f, f o f, and g o g, and their domains."
- "Find f o g o h."

STEWART'S CANONICAL PAIRS (use this style of f, g):
- f(x) = x^3 + 5, g(x) = cube_root(x)
- f(x) = 1/x, g(x) = 2x + 1
- f(x) = 1/sqrt(x), g(x) = x + 1
- f(x) = sqrt(5 - x), g(x) = sqrt(x - 1)

KEY RULES:
1. (f o g)(x) = f(g(x)) means apply g first, then f. Order matters.
2. The domain of f o g is {x in domain(g) : g(x) in domain(f)}. Always state the domain.
3. When f and g have natural domain restrictions (sqrt, 1/x, etc.), domain analysis is the harder part.

GOOD examples:
- f(x) = sqrt(x), g(x) = x - 5. Find (f o g)(x) and its domain. Answer: sqrt(x - 5), domain [5, infinity).
- f(x) = 1/x, g(x) = 2x + 1. Find (f o g)(x) and its domain. Answer: 1/(2x + 1), domain x != -1/2.
- f(x) = 2x + 1, g(x) = x^2. Evaluate (f o g)(3). Answer: g(3) = 9, then f(9) = 19.

BAD example (do NOT generate): Composition of two simple polynomials with no domain issue — students never see why composition matters.

DISTRACTORS: most attractive wrong answer is (g o f)(x) when (f o g)(x) was asked. Also include "f(x) * g(x)" as a "confused composition with multiplication" distractor.

REQUIRED: at least one question must require stating the domain explicitly, not just the formula.
`
      },
      {
        condition: { field: "primary_focus", equals: "arithmetic_operations" },
        content: `
ARITHMETIC COMBINATIONS QUALITY REQUIREMENTS (Stewart §1.3):
Stewart treats this as Exercises 33-34: "Find f + g, f - g, fg, and f/g, and state their domains."

STEWART'S PHRASING:
- "Find f + g, f - g, fg, and f/g, and state their domains."

STEWART'S CANONICAL PAIRS:
- f(x) = sqrt(25 - x^2), g(x) = sqrt(x + 1)
- f(x) = 1/(x - 1), g(x) = 1/x - 2

KEY RULES:
1. (f + g)(x) = f(x) + g(x), (f - g)(x) = f(x) - g(x), (fg)(x) = f(x)*g(x): domain is intersection of domain(f) and domain(g).
2. (f/g)(x) = f(x)/g(x): domain is intersection MINUS points where g(x) = 0.
3. Stewart writes the result without algebraic simplification — keep the formulas separated.

GOOD examples:
- f(x) = sqrt(x), g(x) = sqrt(2 - x). Find f + g and its domain. Answer: sqrt(x) + sqrt(2 - x), domain [0, 2].
- f(x) = 1/(x - 1), g(x) = 1/x. Find (f/g)(x) and its domain. Answer: x/(x - 1), domain x != 0 and x != 1.

DOMAIN MATTERS: pick f and g with non-trivial domain restrictions so the intersection question is meaningful. Avoid pairs where both are polynomials (intersection is all reals, uninteresting).

DISTRACTORS: students forget to exclude g(x) = 0 in division; students take the UNION of domains instead of intersection; students try to algebraically simplify and lose domain information.
`
      },
      {
        condition: { field: "primary_focus", equals: "decomposition" },
        content: `
DECOMPOSITION QUALITY REQUIREMENTS (Stewart §1.3):
Stewart Exercises 45-54: "Express the function in the form f o g" or "f o g o h".

STEWART'S PHRASING:
- "Express the function F(x) = (2x + x^2)^4 in the form f o g."
- "Express the function R(x) = sqrt(sqrt(x) - 1) in the form f o g o h."

STEWART'S CANONICAL EXAMPLES:
- F(x) = (2x + x^2)^4   -> f(x) = x^4, g(x) = 2x + x^2
- F(x) = cos^2(x)        -> f(x) = x^2, g(x) = cos(x)
- F(x) = cube_root(x) / (1 + cube_root(x))   -> f(x) = x / (1 + x), g(x) = cube_root(x)
- R(x) = sqrt(sqrt(x) - 1)   -> f(x) = sqrt(x), g(x) = x - 1, h(x) = sqrt(x)

KEY RULES:
1. The OUTER function f is the last operation applied.
2. The INNER function g (or g then h) is what f acts on.
3. Decomposition is not unique — but the "natural" decomposition isolates the innermost composite structure.
4. Verify by computing f(g(x)) and checking it equals F(x).

GOOD examples:
- F(x) = (3x + 1)^5    -> f(x) = x^5, g(x) = 3x + 1
- F(x) = sin(x^2 + 1)  -> f(x) = sin(x), g(x) = x^2 + 1
- F(x) = 1/(x + 1)^2   -> f(x) = 1/x^2, g(x) = x + 1  (or f(x) = 1/x, g(x) = (x+1)^2)

DISTRACTORS: swap f and g (composition is not commutative); pick a "decomposition" that doesn't actually compose to F; split incorrectly (e.g. f handles part of the inner expression).

REQUIRED: explanation should verify the decomposition by computing f(g(x)) and showing it equals F(x).
`
      },
      {
        condition: { field: "student_tasks", includes: "find_domain" },
        content: `
DOMAIN AFTER TRANSFORMATION OR COMBINATION (Stewart §1.3):
Stewart consistently asks "and state their domains" or "and their domains" after combination or composition questions.

KEY RULES:
1. Vertical transformations (f(x) + k, c*f(x), -f(x)): domain UNCHANGED.
2. Horizontal shifts: if domain(f) = [a, b], then domain of f(x - h) is [a + h, b + h].
3. Horizontal stretches: if domain(f) = [a, b], then domain of f(c*x) is [a/c, b/c] for c > 0.
4. Arithmetic combinations (f + g, f - g, fg): domain is intersection of domain(f) and domain(g).
5. Division (f/g): intersection of domains, minus points where g(x) = 0.
6. Composition (f o g): {x in domain(g) : g(x) in domain(f)}.

STEWART'S DOMAIN PATTERNS (use these function types):
- Square roots: sqrt(x - a) has domain [a, infinity)
- Reciprocals: 1/(x - a) has domain x != a
- Combined: sqrt((x - a)/(x - b)) requires sign analysis

GOOD examples:
- f(x) = sqrt(x), g(x) = sqrt(2 - x). Find domain of f + g. Answer: [0, 2].
- f(x) = 1/x, g(x) = 1/(x + 1). Find domain of f/g. Answer: x != 0 and x != -1 (g != 0 also requires x != -1, already excluded by g's domain).
- f(x) = sqrt(x - 1), g(x) = sqrt(x + 1). Find domain of f o g. Answer: [0, infinity), because g(x) >= 0 requires x >= -1, and we need g(x) >= 1, i.e. sqrt(x + 1) >= 1, i.e. x >= 0.

BAD example: f and g are both polynomials (intersection is all reals — trivial).

DISTRACTORS: students take union instead of intersection; students forget to exclude division-by-zero points; students give domain of f instead of domain of f o g.
`
      },
      {
        condition: { field: "function_types", includes: "piecewise" },
        content: `
PIECEWISE TRANSFORMATION QUALITY REQUIREMENTS:
When transforming a piecewise function, each piece transforms independently, but the breakpoints (the x-values where the formula changes) also transform under horizontal transformations.

KEY RULE: If f is piecewise with breakpoint at x = a, then:
- f(x - h) has breakpoint at x = a + h (shifted right by h).
- f(x + h) has breakpoint at x = a - h (shifted left by h).
- Vertical transformations do NOT move breakpoints.

GOOD examples:
- f(x) = { x for x < 0; x^2 for x >= 0 }. Write f(x - 2). Answer: { x - 2 for x < 2; (x - 2)^2 for x >= 2 }. Breakpoint moves from x = 0 to x = 2.
- f(x) = { -x for x < 1; x for x >= 1 }. Write f(x) + 3. Answer: { -x + 3 for x < 1; x + 3 for x >= 1 }. Breakpoint stays at x = 1.

LIMIT piecewise functions to 2-3 pieces. Clearly indicate domain intervals.
`
      }
    ],

    notation_additions: [
      `HORIZONTAL SHIFTS: f(x - h) shifts the graph RIGHT by h units (NOT left). f(x + h) shifts the graph LEFT by h units (NOT right). Use Stewart's phrasing: "shifted 3 units to the right" — never "shifted by 3" or "shifted positively by 3".`,
      `VERTICAL SHIFTS: f(x) + k shifts the graph UP by k units. f(x) - k shifts the graph DOWN by k units.`,
      `VERTICAL STRETCH/COMPRESSION: c*f(x) where c > 1 stretches vertically. c*f(x) where 0 < c < 1 compresses vertically. The factor c multiplies the OUTPUT (y-values).`,
      `HORIZONTAL STRETCH/COMPRESSION: f(c*x) where c > 1 compresses horizontally (squeezes toward y-axis). f(c*x) where 0 < c < 1 stretches horizontally. The factor c multiplies the INPUT (x-values). Note the inverse relationship: larger c means narrower graph.`,
      `REFLECTIONS: -f(x) reflects about the x-axis. f(-x) reflects about the y-axis.`,
      `COMPOSITION NOTATION: write (f o g)(x) — never use the unicode circle operator. (f o g)(x) = f(g(x)) means apply g FIRST, then f.`,
      `ARITHMETIC COMBINATIONS: (f + g)(x) = f(x) + g(x), (f - g)(x) = f(x) - g(x), (fg)(x) = f(x)*g(x), (f/g)(x) = f(x)/g(x) where g(x) != 0. Stewart uses "fg" (no operator) for product, not "f*g".`,
      `CUBE ROOT: write cube_root(x) — never use the unicode radical glyph. In LaTeX-rendered output, this becomes \\sqrt[3]{x}; in fn strings for graphConfig, use the literal text cube_root(x) or x^(1/3).`,
      `DOMAIN NOTATION: use interval notation with brackets [ ] for closed endpoints and parentheses ( ) for open endpoints. Use "infinity" and "-infinity" as text — never the unicode glyph. Example: [0, infinity), (-infinity, 5], (1, 3) U (3, 5].`,
      `Do NOT use unicode symbols anywhere. Write <= >= != and "infinity" — never the unicode versions.`
    ],

    subtopic_values: [
      "vertical_shifts", "horizontal_shifts", "reflections",
      "vertical_stretches", "horizontal_stretches", "combined_transformations",
      "composition", "arithmetic_operations", "decomposition"
    ],
    function_type_values: [
      "polynomial", "rational", "radical", "absolute_value",
      "piecewise", "trigonometric", "exponential", "logarithmic"
    ],
    primary_task_values: [
      "write_equation_from_description", "describe_transformation_from_equation",
      "match_equation_to_graph", "draw_transformed_graph", "sketch_from_parent",
      "combine_arithmetic", "compute_composition", "compose_three_functions",
      "decompose_into_composition", "evaluate_composition", "find_domain"
    ]
  }
};
