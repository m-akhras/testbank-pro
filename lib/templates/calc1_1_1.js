export const calc1_1_1_template = {
  id: "calc1_1_1",
  version: 1,
  course: "Calculus 1",
  section: "1.1",
  sectionTitle: "Four Ways to Represent a Function",
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
        { value: "evaluation", label: "Function evaluation" },
        { value: "domain", label: "Domain analysis" },
        { value: "graph_reading", label: "Reading from graphs" },
        { value: "table_reading", label: "Reading from tables" },
        { value: "piecewise", label: "Piecewise functions" },
        { value: "symmetry", label: "Symmetry (even/odd/neither)" },
        { value: "monotonicity", label: "Increasing/decreasing intervals" },
        { value: "applied", label: "Real-world modeling" }
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
      default: ["polynomial", "rational"],
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
        { value: "advanced", label: "Advanced (combined or contextual)" },
        { value: "mix", label: "Mix across questions" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select",
      default: ["evaluate", "find_domain"],
      minSelections: 1,
      options: [
        { value: "evaluate", label: "Evaluate f at given values" },
        { value: "find_domain", label: "Determine the domain" },
        { value: "find_range", label: "Determine the range" },
        { value: "find_x_for_value", label: "Find x such that f(x) = c" },
        { value: "classify_symmetry", label: "Identify even/odd/neither" },
        { value: "find_intervals", label: "Identify intervals of increase/decrease" },
        { value: "sketch_identify", label: "Sketch or identify a graph" },
        { value: "interpret_context", label: "Interpret in context (word problem)" }
      ]
    },
    {
      id: "graphs_option",
      label: "Include graphs?",
      type: "single_select",
      default: "some",
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
      placeholder: "e.g., Make at least one question test f(x+h) vs f(x)+h. Avoid trigonometric examples."
    }
  ],

  // Section-specific rules consumed by lib/templates/_generic/buildPrompt.js.
  // Adding these does not change behavior for any existing caller; the new
  // generic builder reads them, the old monolithic buildTemplatePrompt.js
  // ignores them.
  section_specific_rules: {
    // Cross-field validation rules. Throw at form-submit time if violated.
    pairing_constraints: [
      {
        field: "function_types",
        requires_other_when_includes: "piecewise",
        error: "Piecewise must be paired with at least one base function type (polynomial, rational, radical, etc.). Piecewise tells us the structure; the base type tells us what the pieces are made of."
      }
    ],

    // Extra prompt blocks injected when conditions match.
    conditional_quality_blocks: [
      {
        condition: { field: "function_types", includes: "piecewise" },
        content: `
PIECEWISE QUALITY REQUIREMENTS:
BAD example (do NOT generate): a "piecewise" function whose three pieces are all horizontal lines (e.g., f(x) = 2 on [-2,0), 5 on [0,2), 7 on [2,4]). That is a step function masquerading as piecewise and tests no real piecewise concept.
GOOD examples:
- f(x) = { x + 1 on [-3, 0],  x^2 on [0, 2] } — linear piece meeting a parabolic piece; tests continuity at x = 0.
- f(x) = { -x on (-infinity, 0),  sqrt(x) on [0, infinity) } — absolute-value-style branch meeting a radical; tests both pieces' domain restrictions.
- f(x) = { x^2 on [-2, 1),  3 - x on [1, 4] } — quadratic-to-linear transition with a jump discontinuity at x = 1.
Pieces should differ from each other. Two pieces both being y = 5 and y = 7 (both constant) is forbidden. At minimum, pieces must vary in slope or curvature.
`
      }
    ],

    // Extra rules appended to the bottom of the generic notation block.
    notation_additions: [
      `LINEAR FUNCTIONS must have a non-zero slope: f(x) = m*x + b where m != 0. Do NOT generate constant functions like f(x) = 5 disguised as "linear" or "polynomial".`,
      `A function listed as "polynomial" must be at least degree 1 with a visible variable term — never a constant.`,
      `Piecewise pieces obey the same rule: do NOT generate piecewise functions where any piece is a constant. Every piece must have a real variable term.`
    ],

    // Enum values for the OUTPUT FORMAT block.
    subtopic_values: [
      "function_evaluation", "domain_analysis", "graph_reading", "table_reading",
      "piecewise", "symmetry", "monotonicity", "applied_modeling"
    ],
    function_type_values: [
      "polynomial", "rational", "radical", "absolute_value",
      "piecewise", "trigonometric", "exponential", "logarithmic"
    ],
    primary_task_values: [
      "evaluate", "find_domain", "find_range", "find_x_for_value",
      "classify_symmetry", "find_intervals", "sketch_identify", "interpret_context"
    ]
  }
};
