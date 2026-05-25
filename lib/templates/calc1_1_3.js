export const calc1_1_3_template = {
  id: "calc1_1_3",
  version: 1,
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
        { value: "arithmetic_operations", label: "Arithmetic combinations (f + g, f - g, f * g, f / g)" }
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
      type: "multi_select",
      default: ["identify_transformation", "apply_transformation"],
      minSelections: 1,
      options: [
        { value: "identify_transformation", label: "Identify what transformation(s) were applied" },
        { value: "apply_transformation", label: "Apply transformation(s) to create new function" },
        { value: "write_equation", label: "Write equation after transformation" },
        { value: "match_graph", label: "Match transformed graph to equation" },
        { value: "sketch_graph", label: "Sketch graph after transformation" },
        { value: "compute_composition", label: "Compute function composition (f o g)(x)" },
        { value: "evaluate_composition", label: "Evaluate composition at a point" },
        { value: "combine_arithmetic", label: "Combine functions arithmetically (f + g, etc.)" },
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
      default: "few",
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

    conditional_quality_blocks: [
      {
        condition: { field: "primary_focus", equals: "horizontal_shifts" },
        content: `
HORIZONTAL SHIFT QUALITY REQUIREMENTS:
The most common student error is confusing the direction: f(x - h) shifts RIGHT by h units (NOT left), and f(x + h) shifts LEFT by h units (NOT right).

BAD example (do NOT generate): A question that asks "Does f(x - 3) shift left or right?" without any pedagogical scaffolding. This tests rote memorization, not understanding.

GOOD examples:
- Give the graph of y = f(x) and ask students to sketch or identify y = f(x - 2). The correct answer shows the entire graph shifted 2 units to the RIGHT.
- Give y = sqrt(x) and ask for the equation of the graph obtained by shifting 4 units to the left. The correct answer is y = sqrt(x + 4).
- Multiple-choice with the question "The graph of y = f(x + 5) is obtained from y = f(x) by shifting:" with options including "5 units left", "5 units right", etc. The correct answer is "5 units left".

In the distractors, include the opposite direction shift as the most attractive wrong answer. This tests whether students have overcome the common misconception.

When stating the transformation in prose, use clear language: "shifted 3 units to the right" or "shifted 3 units left" — do NOT say "shifted by 3" without specifying direction.
`
      },
      {
        condition: { field: "primary_focus", equals: "combined_transformations" },
        content: `
COMBINED TRANSFORMATIONS QUALITY REQUIREMENTS:
When multiple transformations are applied, the ORDER matters for compositions but NOT for independent transformations.

BAD example (do NOT generate): A question that combines 5 different transformations (shift, stretch, reflect, etc.) in a single function like y = -3*f(2*(x - 4)) + 7 without asking students to parse the order or understand the individual effects. This is overwhelming and tests nothing specific.

GOOD examples:
- Start with y = x^2. Apply a vertical stretch by factor 2, then shift up 3 units. Write the equation. Answer: y = 2*x^2 + 3.
- Start with y = sqrt(x). Reflect about the x-axis, then shift right 1 unit. Write the equation. Answer: y = -sqrt(x - 1).
- Given the graph of y = f(x), sketch or identify the graph of y = 2*f(x - 1) + 3. The transformations are: horizontal shift right 1 (applied to input), vertical stretch by 2 (applied to output), vertical shift up 3 (applied to output).

Limit combined transformations to 2-3 operations maximum. When mixing horizontal and vertical transformations, remind students that horizontal transformations (shifts, stretches) act on the INPUT (inside the function), while vertical transformations (shifts, stretches, reflections about x-axis) act on the OUTPUT (outside the function).

Common quality distractor: students apply transformations in the wrong order or confuse which transformations affect the input vs. output.
`
      },
      {
        condition: { field: "primary_focus", equals: "composition" },
        content: `
COMPOSITION QUALITY REQUIREMENTS:
Function composition is directional: (f o g)(x) = f(g(x)) means "apply g first, then apply f to the result." The order matters and is not commutative in general.

BAD example (do NOT generate): Asking students to compute (f o g)(x) when both f and g are overly complicated (e.g., rational functions with multiple terms). This tests algebraic stamina, not composition understanding.

GOOD examples:
- f(x) = x^2, g(x) = x + 3. Find (f o g)(x). Answer: f(g(x)) = f(x + 3) = (x + 3)^2 = x^2 + 6*x + 9.
- f(x) = sqrt(x), g(x) = x - 5. Find (g o f)(x). Answer: g(f(x)) = g(sqrt(x)) = sqrt(x) - 5.
- f(x) = 2*x + 1, g(x) = x^2. Evaluate (f o g)(3). Answer: g(3) = 9, then f(9) = 2*9 + 1 = 19.
- Given that (f o g)(x) = x^2 + 4*x + 4 and g(x) = x + 2, find f(x). (Decomposition problem — harder but good for advanced students.)

Include at least one question where students must evaluate (f o g)(a) at a specific point, not just find the formula for (f o g)(x). This tests whether they understand the two-step process.

Common error to exploit in distractors: students compute (g o f)(x) when asked for (f o g)(x), or they add/multiply the functions instead of composing.
`
      },
      {
        condition: { field: "student_tasks", includes: "find_domain" },
        content: `
DOMAIN AFTER TRANSFORMATION QUALITY REQUIREMENTS:
Transformations can affect the domain in non-obvious ways, especially horizontal transformations.

Key rules:
1. Vertical shifts, vertical stretches, reflections about the x-axis: do NOT change the domain.
2. Horizontal shifts: if the domain of f is [a, b], then the domain of f(x - h) is [a + h, b + h] (shifted right by h), and the domain of f(x + h) is [a - h, b - h] (shifted left by h).
3. Horizontal stretches/compressions: if the domain of f is [a, b], then the domain of f(c*x) is [a/c, b/c] (when c > 0). If c < 0, the domain is also reflected.
4. Composition (f o g)(x) = f(g(x)): the domain is the set of all x in the domain of g such that g(x) is in the domain of f. This requires checking both functions' domains.
5. Arithmetic combinations (f + g, f - g, f * g): domain is the intersection of the domains of f and g. For f/g, further exclude points where g(x) = 0.

BAD example (do NOT generate): Asking "What is the domain of f(x - 3)?" when f is a polynomial (all reals). The answer is still all reals, so the transformation had no effect. This is a trivial question.

GOOD examples:
- f(x) = sqrt(x) has domain [0, infinity). What is the domain of f(x - 4) = sqrt(x - 4)? Answer: [4, infinity).
- f(x) = 1/x has domain (-infinity, 0) U (0, infinity). What is the domain of 2*f(x) = 2/x? Answer: same domain (vertical stretch does not change domain).
- f(x) = sqrt(x), g(x) = x - 5. Find the domain of (f o g)(x) = f(g(x)) = sqrt(x - 5). Answer: [5, infinity).
- f(x) = sqrt(x - 1), g(x) = 1/(x - 2). Find the domain of (f + g)(x). Answer: [1, 2) U (2, infinity) (intersection of [1, infinity) and (-infinity, 2) U (2, infinity), excluding x = 2).

Focus on cases where the transformation or combination actually restricts or shifts the domain. Avoid trivial cases.
`
      },
      {
        condition: { field: "function_types", includes: "piecewise" },
        content: `
PIECEWISE TRANSFORMATION QUALITY REQUIREMENTS:
When transforming a piecewise function, each piece transforms independently, but the breakpoints (the x-values where the formula changes) also transform.

Key rule: If f is piecewise with breakpoints at x = a, x = b, etc., then:
- f(x - h) has breakpoints at x = a + h, x = b + h, etc. (shifted right by h).
- f(x + h) has breakpoints at x = a - h, x = b - h, etc. (shifted left by h).
- Vertical transformations (shifts, stretches, reflections about x-axis) do NOT move the breakpoints; they only change the y-values.

BAD example (do NOT generate): A piecewise function with 4+ pieces and complex transformations. Students will get lost in bookkeeping and miss the conceptual point.

GOOD examples:
- f(x) = { x for x < 0; x^2 for x >= 0 }. Write the equation for f(x - 2). Answer: f(x - 2) = { x - 2 for x < 2; (x - 2)^2 for x >= 2 }. The breakpoint moved from x = 0 to x = 2.
- f(x) = { -x for x < 1; x for x >= 1 }. Write the equation for f(x) + 3. Answer: f(x) + 3 = { -x + 3 for x < 1; x + 3 for x >= 1 }. The breakpoint stayed at x = 1.
- Given the graph of a piecewise f, sketch the graph of -f(x). This reflects each piece about the x-axis; breakpoints do not move horizontally.

Limit piecewise functions to 2-3 pieces. Clearly show the domain intervals for each piece. If giving a graph, label the breakpoints.
`
      }
    ],

    notation_additions: [
      `HORIZONTAL SHIFTS: f(x - h) shifts the graph RIGHT by h units (NOT left). f(x + h) shifts the graph LEFT by h units (NOT right). Use consistent language: "shifted 3 units to the right" means replace x with x - 3.`,
      `VERTICAL SHIFTS: f(x) + k shifts the graph UP by k units. f(x) - k shifts the graph DOWN by k units. This is more intuitive than horizontal shifts.`,
      `VERTICAL STRETCH/COMPRESSION: c*f(x) where c > 1 stretches vertically (pulls away from x-axis). c*f(x) where 0 < c < 1 compresses vertically (pushes toward x-axis). The factor c multiplies the OUTPUT (y-values).`,
      `HORIZONTAL STRETCH/COMPRESSION: f(c*x) where c > 1 compresses horizontally (squeezes toward y-axis). f(c*x) where 0 < c < 1 stretches horizontally (pulls away from y-axis). The factor c multiplies the INPUT (x-values). Note the inverse relationship: larger c means narrower graph.`,
      `REFLECTIONS: -f(x) reflects about the x-axis (flips vertically). f(-x) reflects about the y-axis (flips horizontally).`,
      `COMPOSITION NOTATION: (f o g)(x) = f(g(x)) means apply g first, then f. The order matters. Do NOT write f(g(x)) as f*g(x) or f o g(x) without parentheses.`,
      `ARITHMETIC COMBINATIONS: (f + g)(x) = f(x) + g(x), (f - g)(x) = f(x) - g(x), (f * g)(x) = f(x)*g(x), (f/g)(x) = f(x)/g(x) where g(x) != 0.`,
      `When combining multiple transformations, apply horizontal transformations (shifts, stretches, reflections about y-axis) to the INPUT first, then apply vertical transformations (shifts, stretches, reflections about x-axis) to the OUTPUT.`,
      `Do NOT use unicode symbols. Write compositions as (f o g)(x) or "f composed with g" — never use the unicode circle operator. Write <= >= != — never unicode comparison symbols.`
    ],

    subtopic_values: [
      "vertical_shifts", "horizontal_shifts", "reflections",
      "vertical_stretches", "horizontal_stretches", "combined_transformations",
      "composition", "arithmetic_operations"
    ],
    function_type_values: [
      "polynomial", "rational", "radical", "absolute_value",
      "piecewise", "trigonometric", "exponential", "logarithmic"
    ],
    primary_task_values: [
      "identify_transformation", "apply_transformation", "write_equation",
      "match_graph", "sketch_graph", "compute_composition",
      "evaluate_composition", "combine_arithmetic", "find_domain"
    ]
  }
};
