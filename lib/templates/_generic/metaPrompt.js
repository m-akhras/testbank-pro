// lib/templates/_generic/metaPrompt.js
//
// Builds the system prompt that instructs Sonnet to read section materials
// (textbook intro + worked examples, as text and/or images) and produce a
// complete TestArca template .js file for a target section.
//
// The OUTPUT of buildMetaPrompt is the SYSTEM MESSAGE for an Anthropic
// /v1/messages call. The user message (added by the caller in
// app/api/generate-template/route.js) contains the section materials.
//
// This file produces the SECOND prompt in the TestArca pipeline:
//   1. Meta-prompt (THIS FILE) — produces templates from materials.
//      Run once per section, output stored as a .js file in lib/templates/.
//   2. Generation prompt (lib/templates/_generic/buildPrompt.js) — produces
//      questions from a template + instructor's form answers. Run many times.
//
// Template quality for every future section depends on what this file says.

/* ────────────────────────────────────────────────────────────────────
 * The §1.1 reference example, embedded as a string for the meta-prompt
 * to show Sonnet what a fully-formed template looks like.
 *
 * If lib/templates/calc1_1_1.js ever changes structure, this string
 * MUST be updated in lockstep — otherwise Sonnet will produce templates
 * that drift from the actual schema the generation pipeline expects.
 *
 * (We can't just import calc1_1_1.js and stringify it, because we lose
 * the exact formatting and comments that help Sonnet pattern-match. The
 * literal string is what we want.)
 * ────────────────────────────────────────────────────────────────── */

const REFERENCE_TEMPLATE_CALC_1_1 = String.raw`export const calc1_1_1_template = {
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

  section_specific_rules: {
    pairing_constraints: [
      {
        field: "function_types",
        requires_other_when_includes: "piecewise",
        error: "Piecewise must be paired with at least one base function type (polynomial, rational, radical, etc.). Piecewise tells us the structure; the base type tells us what the pieces are made of."
      }
    ],

    conditional_quality_blocks: [
      {
        condition: { field: "function_types", includes: "piecewise" },
        content: \`
PIECEWISE QUALITY REQUIREMENTS:
BAD example (do NOT generate): a "piecewise" function whose three pieces are all horizontal lines (e.g., f(x) = 2 on [-2,0), 5 on [0,2), 7 on [2,4]). That is a step function masquerading as piecewise and tests no real piecewise concept.
GOOD examples:
- f(x) = { x + 1 on [-3, 0],  x^2 on [0, 2] } — linear piece meeting a parabolic piece; tests continuity at x = 0.
- f(x) = { -x on (-infinity, 0),  sqrt(x) on [0, infinity) } — absolute-value-style branch meeting a radical; tests both pieces' domain restrictions.
- f(x) = { x^2 on [-2, 1),  3 - x on [1, 4] } — quadratic-to-linear transition with a jump discontinuity at x = 1.
Pieces should differ from each other. Two pieces both being y = 5 and y = 7 (both constant) is forbidden. At minimum, pieces must vary in slope or curvature.
\`
      }
    ],

    notation_additions: [
      \`LINEAR FUNCTIONS must have a non-zero slope: f(x) = m*x + b where m != 0. Do NOT generate constant functions like f(x) = 5 disguised as "linear" or "polynomial".\`,
      \`A function listed as "polynomial" must be at least degree 1 with a visible variable term — never a constant.\`,
      \`Piecewise pieces obey the same rule: do NOT generate piecewise functions where any piece is a constant. Every piece must have a real variable term.\`
    ],

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
};`;

/* ────────────────────────────────────────────────────────────────────
 * The main builder
 * ────────────────────────────────────────────────────────────────── */

/**
 * Build the system prompt for the template-generator call to Sonnet.
 *
 * @param {Object} target - The section we're producing a template for.
 * @param {string} target.course        - e.g. "Calculus 1"
 * @param {string} target.section       - e.g. "1.3"
 * @param {string} target.sectionTitle  - e.g. "New Functions from Old Functions"
 * @param {string} target.textbook      - e.g. "Stewart Early Transcendentals 9th Ed"
 * @returns {string} The system prompt for the Anthropic call.
 */
export function buildMetaPrompt({ course, section, sectionTitle, textbook }) {
  if (!course || !section || !sectionTitle || !textbook) {
    throw new Error(
      "buildMetaPrompt: course, section, sectionTitle, and textbook are all required"
    );
  }

  // Map course display name → file-naming slug. This matches the naming
  // convention used by the existing hand-written templates (e.g.
  // lib/templates/calc1_1_1.js for "Calculus 1" Section 1.1). When you
  // add a new course, add its slug here.
  const COURSE_SLUGS = {
    "Calculus 1": "calc1",
    "Calculus 2": "calc2",
    "Calculus 3": "calc3",
    "Quantitative Methods I": "qm1",
    "Quantitative Methods II": "qm2",
    "Precalculus": "precalc",
    "Discrete Mathematics": "discrete",
  };

  const courseSlug = COURSE_SLUGS[course];
  if (!courseSlug) {
    throw new Error(
      `buildMetaPrompt: no slug mapping for course "${course}". ` +
      `Add it to COURSE_SLUGS in lib/templates/_generic/metaPrompt.js.`
    );
  }
  const sectionSlug = section.replace(/\./g, "_");
  const templateId = `${courseSlug}_${sectionSlug}`;
  const exportName = `${templateId}_template`;
  const filename = `${templateId}.js`;

  return `You are an expert curriculum designer producing a TestArca question-template configuration file.

TestArca is an exam-authoring tool for university math instructors. Each section of each textbook has its own "template" — a JavaScript file that declares (a) the form fields an instructor fills in to specify what kind of questions they want, and (b) section-specific rules that constrain how questions are generated.

═══════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════

You will receive section materials (textbook section introduction, worked examples, possibly images of textbook pages) in the user message.

Produce a COMPLETE JavaScript file that exports a template for the following section:

- Course:        ${course}
- Section:       ${section}
- Section title: ${sectionTitle}
- Textbook:      ${textbook}
- Template id:   ${templateId}
- Export name:   ${exportName}
- Save as:       lib/templates/${filename}

═══════════════════════════════════════════════════════════
REFERENCE EXAMPLE — Section 1.1 (already shipped)
═══════════════════════════════════════════════════════════

Here is the complete, working template for Calculus 1 Section 1.1 ("Four Ways to Represent a Function"). Your output for the target section must have the SAME STRUCTURE — same top-level fields, same array of form-field IDs, same shape of section_specific_rules. The CONTENT of each field's options array, the defaults, the placeholder text, and the section_specific_rules CONTENT must all be adapted to the target section's actual concepts.

${REFERENCE_TEMPLATE_CALC_1_1}

═══════════════════════════════════════════════════════════
WHAT TO KEEP FIXED
═══════════════════════════════════════════════════════════

The following must be IDENTICAL in your output (varying only in the per-template metadata at the top):

1. The top-level keys: id, version, course, section, sectionTitle, textbook, fields, section_specific_rules.
2. The 10 field IDs in the "fields" array (in this exact order):
   count, primary_focus, representation_forms, function_types, domain_complexity,
   student_tasks, graphs_option, tables_option, question_type, free_text.
3. The "type" of each field (number, single_select, multi_select, free_text).
4. The presence of minSelections: 1 on every multi_select field.
5. The shape of every section_specific_rules sub-field (pairing_constraints, conditional_quality_blocks, notation_additions, subtopic_values, function_type_values, primary_task_values).

DO NOT add new top-level fields. DO NOT rename any field ID. DO NOT change a field's type. DO NOT skip the section_specific_rules block (it can have empty arrays for sub-fields that don't apply, but it must exist).

═══════════════════════════════════════════════════════════
WHAT TO ADAPT TO THE TARGET SECTION
═══════════════════════════════════════════════════════════

Everything inside the fields must reflect what the target section actually teaches:

A. **Field labels** — minor wording tweaks if needed for clarity in this section's context.

B. **primary_focus.options** — the subtopics this section covers. For example:
   - §1.1 has: evaluation, domain, graph_reading, table_reading, piecewise, symmetry, monotonicity, applied
   - §1.3 (transformations) would have: vertical_shifts, horizontal_shifts, stretches, reflections, composition, combining_operations, applied
   - §5.2 (definite integrals) would have: Riemann_sums, area_under_curve, FTC_application, definite_evaluation, etc.
   Always include "mix" as the first option (recommended default).

C. **representation_forms.options** — almost always the same four (algebraic, graphical, numerical, verbal) since these apply to almost every math topic. Keep them unless the section genuinely cannot use one (e.g. a proof-heavy section might drop "numerical").

D. **function_types.options** — what families of functions this section uses. Some sections have a narrower list than §1.1. Section §1.4 (Exponential Functions) might just have exponential and polynomial. Section §3.5 (Implicit Differentiation) might use radical, rational, trigonometric, implicit. Do NOT blindly copy §1.1's full list.

E. **student_tasks.options** — the cognitive actions students perform. For §1.3 transformations, tasks include: identify_transformation, apply_transformation, match_graph, compute_composition. For §5.2, tasks include: set_up_Riemann_sum, evaluate_definite, apply_FTC, interpret_area.

F. **defaults** — pick the most pedagogically useful defaults for this section. For §1.1 the defaults reflect "introductory function review." For §1.3 they would reflect "first exposure to transformations."

G. **free_text.placeholder** — a section-relevant hint. For §1.3 something like "e.g., Focus on horizontal vs. vertical shift confusion. Include at least one composition question."

═══════════════════════════════════════════════════════════
SECTION_SPECIFIC_RULES — THE HARD PART
═══════════════════════════════════════════════════════════

This block encodes the section's pedagogical knowledge that the generation prompt will inject conditionally. Think carefully about each sub-field for the target section:

**pairing_constraints** — Cross-field validation rules. §1.1 has one: piecewise must be paired with another type. For most sections this is an empty array []. Only include a constraint if there's a real "you can't pick X alone" situation in this section's content.

**conditional_quality_blocks** — Prompt blocks that fire when specific conditions match. Each entry has:
   { condition: { field: "<field_id>", includes: "<value>" }, content: "<extra prompt instructions>" }
Use this when a particular instructor choice triggers a known quality risk. For §1.3, a candidate block might fire when "composition" is selected in primary_focus, reminding the generator about (f∘g)(x) vs (g∘f)(x) order. If you can't think of a real quality risk specific to this section, leave the array empty [].

**notation_additions** — Section-specific notation rules added to the generic notation block. For §1.1: linear functions must have non-zero slope, polynomials must be degree 1+. For §1.3: would include "f(x-h) shifts RIGHT by h (NOT left)" and "h is horizontal shift, k is vertical shift, do not swap." Be specific and actionable. These are bullet-point lines that the generation prompt appends to its notation rules.

**subtopic_values** — The enum values that will appear in each generated question's "subtopic" field. Must match the primary_focus.options values (minus "mix" since that's a meta-value). E.g. if primary_focus has "vertical_shifts" as an option, then subtopic_values must include "vertical_shifts".

**function_type_values** — The enum values that will appear in each generated question's "function_type" field. Must match function_types.options values.

**primary_task_values** — The enum values that will appear in each generated question's "primary_task" field. Must match student_tasks.options values.

The three enum arrays MUST be aligned with their corresponding options. If you list "vertical_shifts" as a primary_focus option but forget to add it to subtopic_values, the generation pipeline will fail validation.

═══════════════════════════════════════════════════════════
NOTATION INSIDE STRING VALUES
═══════════════════════════════════════════════════════════

Wherever your output contains math inside string values (placeholder text, conditional_quality_blocks content, notation_additions, error messages), use mini-syntax — NEVER LaTeX backslash commands:

- Exponents: x^2 not x^{2}, never x²
- Fractions: (a)/(b) not \\\\dfrac{a}{b}
- Square roots: sqrt(x) not \\\\sqrt{x}
- Greek: theta, pi, alpha — not θ, π, α
- Comparisons: <=, >=, != — not ≤, ≥, ≠
- Multiplication: * — not · or ×

═══════════════════════════════════════════════════════════
OUTPUT FORMAT — CRITICAL
═══════════════════════════════════════════════════════════

Your response must be the COMPLETE CONTENTS of the JavaScript file ${filename} — nothing more, nothing less.

- Do NOT wrap your output in markdown code fences (no \`\`\`js or \`\`\`).
- Do NOT include any prose before the export statement.
- Do NOT include any prose after the closing brace + semicolon.
- Do NOT include "Here is your template:" or any preamble.
- Do NOT include comments like "// I adapted this from §1.1" — your output goes directly into a .js file that will be linted and reviewed.

The very first character of your response must be the letter "e" (from "export"). The very last character should be ";" (the closing semicolon of the template object).

Begin with:
  export const ${exportName} = {

End with:
  };

The instructor will save your response verbatim as lib/templates/${filename}, register it in lib/templates/registry.js, and use it to generate questions for ${section} ${sectionTitle}.

The materials for this section follow in the user message.`;
}
