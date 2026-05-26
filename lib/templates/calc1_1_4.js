export const calc1_1_4_template = {
  id: "calc1_1_4",
  version: 1,
  course: "Calculus 1",
  section: "1.4",
  sectionTitle: "Exponential Functions",
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
        { value: "laws_of_exponents", label: "Laws of Exponents review (Stewart Ex 1-2)" },
        { value: "definition", label: "Definition of the exponential function y = b^x (Stewart Ex 3)" },
        { value: "number_e", label: "The number e and e^x (Stewart Ex 4)" },
        { value: "graphs", label: "Graphs of y = b^x for various bases (Stewart Ex 5-8)" },
        { value: "transformations", label: "Transformations of exponential functions (Stewart Ex 9-16)" },
        { value: "domain", label: "Domain problems involving exponentials (Stewart Ex 17-18)" },
        { value: "applications", label: "Applications: compound interest, growth, decay" }
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
      label: "Bases to feature in exponential functions",
      type: "multi_select",
      default: ["integer_base", "natural_e", "fractional_base"],
      minSelections: 1,
      options: [
        { value: "integer_base", label: "Integer bases (2, 3, 5, 10)" },
        { value: "natural_e", label: "Natural base e (and e^(-x), e^(kx))" },
        { value: "fractional_base", label: "Fractional bases between 0 and 1 (e.g. (1/2)^x, 0.5^x, 0.1^x)" },
        { value: "decimal_base", label: "Decimal bases (0.9, 0.6, 0.3)" }
      ]
    },
    {
      id: "student_tasks",
      label: "What students compute or identify",
      type: "multi_select_with_counts",
      default: [
        { value: "simplify_exponent_expression", count: 1 },
        { value: "evaluate_exponential", count: 1 },
        { value: "identify_growth_decay", count: 1 },
        { value: "match_equation_to_graph", count: 1 },
        { value: "transformation_of_exponential", count: 1 }
      ],
      minSelections: 1,
      options: [
        { value: "simplify_exponent_expression", label: "Simplify using Laws of Exponents (Stewart Ex 1-2)" },
        { value: "write_exponential_definition", label: "Write the form / state domain / state range of y = b^x (Stewart Ex 3)" },
        { value: "state_definition_of_e", label: "Define or approximate e, identify the natural exponential (Stewart Ex 4)" },
        { value: "evaluate_exponential", label: "Evaluate exponential at a specific x (e.g. find 2^(-3))" },
        { value: "identify_growth_decay", label: "Identify whether y = b^x is increasing or decreasing from b" },
        { value: "match_equation_to_graph", label: "Match exponential equation to its graph (Stewart Ex 5-8)" },
        { value: "transformation_of_exponential", label: "Apply / identify transformation of y = e^x or y = b^x (Stewart Ex 9-16)" },
        { value: "write_transformation_equation", label: "Write equation after transformation of y = e^x (Stewart Ex 15)" },
        { value: "reflection_about_line", label: "Equation after reflection about y = c or x = c (Stewart Ex 16)" },
        { value: "find_domain", label: "Find the domain of a function involving exponentials (Stewart Ex 17-18)" },
        { value: "compound_interest", label: "Compound interest application" },
        { value: "population_growth_decay", label: "Population growth or radioactive decay application" }
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
      placeholder: "e.g., Focus on transformations of e^x. Avoid decay applications. Include at least one compound interest problem."
    }
  ],

  section_specific_rules: {
    pairing_constraints: [],

    reference_examples: [
      {
        stem: "Use the Laws of Exponents to rewrite and simplify the expression: (-2^6) / (4^3).",
        choices: ["-1", "1", "-4", "4"],
        answer: "-1",
        explanation: "Compute the numerator and denominator separately. The numerator is -2^6 = -(2^6) = -64 (the negative sign is NOT inside the exponentiation, so it stays as a sign on the answer). The denominator is 4^3 = 64. Then (-64)/64 = -1. Students who answer 1 forgot that -2^6 means -(2^6), not (-2)^6. Students who answer -4 or 4 miscounted the powers."
      },
      {
        stem: "Use the Laws of Exponents to rewrite and simplify: 2*x^2 * (3*x^5)^2.",
        choices: ["18*x^12", "6*x^7", "18*x^9", "12*x^12"],
        answer: "18*x^12",
        explanation: "Apply (3*x^5)^2 = 3^2 * (x^5)^2 = 9 * x^10. Then 2*x^2 * 9*x^10 = 18 * x^(2+10) = 18*x^12. Students who answer 6*x^7 forgot to square the 3 and used 3*x^5 directly. Students who answer 18*x^9 added exponents 2+5+2 incorrectly. Students who answer 12*x^12 doubled the 3 instead of squaring it."
      },
      {
        stem: "Write an equation that defines the exponential function with base b > 0, and state its domain and range (assume b != 1).",
        choices: [
          "y = b^x; domain (-infinity, infinity); range (0, infinity)",
          "y = b^x; domain (0, infinity); range (-infinity, infinity)",
          "y = x^b; domain (0, infinity); range (0, infinity)",
          "y = b*x; domain (-infinity, infinity); range (-infinity, infinity)"
        ],
        answer: "y = b^x; domain (-infinity, infinity); range (0, infinity)",
        explanation: "The exponential function with base b has the form y = b^x (the variable is in the EXPONENT, not the base). The domain is all real numbers, since b^x is defined for every real x. The range is (0, infinity) since b^x is always positive for b > 0. The choice y = x^b is a power function, not exponential. The choice y = b*x is linear. The second choice swaps domain and range."
      },
      {
        stem: "Starting with the graph of y = e^x, write the equation of the graph that results from reflecting about the y-axis.",
        choices: ["y = e^(-x)", "y = -e^x", "y = e^x - 1", "y = 1/e^x - 1"],
        answer: "y = e^(-x)",
        explanation: "Reflection about the y-axis replaces x with -x, so y = e^x becomes y = e^(-x). The choice y = -e^x is reflection about the x-axis (not y-axis). The choice y = e^x - 1 is a vertical shift. The choice y = 1/e^x - 1 confuses reflection with a different transformation. Note that e^(-x) and 1/e^x are mathematically equal, but the standard form for reflection about the y-axis is e^(-x)."
      },
      {
        stem: "The graph of y = e^x is shown (dashed). The graph of h(x) is shown (solid). The equation of h(x) is y = e^(x - 2) - 1. Which sequence of transformations produces h from y = e^x?",
        choices: [
          "Shift 2 units to the right, then shift 1 unit downward",
          "Shift 2 units to the left, then shift 1 unit downward",
          "Shift 2 units to the right, then shift 1 unit upward",
          "Reflect about the y-axis, then shift 1 unit downward"
        ],
        answer: "Shift 2 units to the right, then shift 1 unit downward",
        explanation: "In h(x) = e^(x - 2) - 1, replacing x with x - 2 shifts the graph 2 units to the right. Subtracting 1 from the output shifts the graph 1 unit downward. The horizontal asymptote moves from y = 0 to y = -1. The second choice reverses the horizontal-shift direction (common error). The third choice reverses the vertical direction. The fourth choice misidentifies the horizontal shift as a reflection."
      },
      {
        stem: "An investment of $1000 is deposited in an account paying 6% annual interest, compounded annually. Write the formula for the account balance A(t) after t years, and find the balance after 5 years.",
        choices: [
          "A(t) = 1000*(1.06)^t; A(5) = $1338.23",
          "A(t) = 1000*(0.06)^t; A(5) = $0.00",
          "A(t) = 1000 + 0.06*t; A(5) = $1300.00",
          "A(t) = 1000*e^(0.06*t); A(5) = $1349.86"
        ],
        answer: "A(t) = 1000*(1.06)^t; A(5) = $1338.23",
        explanation: "Annual compound interest uses the formula A(t) = P*(1 + r)^t, where P = 1000 is the principal and r = 0.06 is the annual rate. So A(t) = 1000*(1.06)^t and A(5) = 1000*(1.06)^5 ≈ $1338.23. The second choice uses (0.06)^t instead of (1.06)^t, which would compute the wrong base. The third choice computes simple interest, not compound. The fourth choice uses continuous compounding A(t) = P*e^(r*t), which gives a different answer ($1349.86) — that formula applies when compounding is CONTINUOUS, not annual."
      }
    ],

    conditional_quality_blocks: [
      {
        condition: { field: "primary_focus", equals: "laws_of_exponents" },
        content: `
LAWS OF EXPONENTS QUALITY REQUIREMENTS (Stewart §1.4 Ex 1-2):
This is review material. Stewart includes it because students need to manipulate exponents before they can work with exponential functions. Use Stewart's exact style.

STEWART'S PHRASING:
- "Use the Laws of Exponents to rewrite and simplify each expression."

STEWART'S CANONICAL EXAMPLES:
- (-2^6) / (4^3) — tests the difference between -2^6 and (-2)^6
- (-3)^6 / 9^6 — tests parenthesization
- 1 / cbrt(x^5) — tests fractional exponents and roots
- (x^3 * x^n) / x^(n+1) — tests laws with symbolic exponents
- b^3 * (3*b^(-1))^(-2) — tests negative exponents
- 2*x^2*y / (3*x^(-2)*y)^2 — tests combination of laws

KEY LAWS to test:
- b^m * b^n = b^(m+n)
- b^m / b^n = b^(m-n)
- (b^m)^n = b^(m*n)
- (a*b)^n = a^n * b^n
- (a/b)^n = a^n / b^n
- b^0 = 1 (when b != 0)
- b^(-n) = 1/b^n
- b^(1/n) = nth_root(b)
- b^(m/n) = nth_root(b^m)

CRITICAL DISTINCTION to test:
- -2^6 vs (-2)^6: the first is -(2^6) = -64, the second is 64. Stewart Ex 1a and 1b are deliberately paired to highlight this.

DISTRACTORS: students confuse -b^n with (-b)^n; students multiply exponents instead of adding when multiplying same-base expressions; students add bases when multiplying same-exponent expressions; students forget that (a*b)^n distributes over both factors.

DO NOT use match_equation_to_graph for this primary_focus. Laws of Exponents is computational, not visual.
`
      },
      {
        condition: { field: "primary_focus", equals: "definition" },
        content: `
DEFINITION OF EXPONENTIAL FUNCTION (Stewart §1.4 Ex 3):
Stewart Exercise 3 is a four-part question that establishes the formal definition.

STEWART'S PHRASING:
- "Write an equation that defines the exponential function with base b > 0."
- "What is the domain of this function?"
- "If b != 1, what is the range of this function?"
- "Sketch the general shape of the graph of the exponential function for each of the following cases. i. b > 1. ii. b = 1. iii. 0 < b < 1."

KEY FACTS:
- Form: y = b^x (variable in EXPONENT, base is constant)
- Domain: (-infinity, infinity)
- Range: (0, infinity) when b != 1
- When b = 1: y = 1 (constant function, not really exponential)
- When b > 1: increasing, horizontal asymptote y = 0 to the left
- When 0 < b < 1: decreasing, horizontal asymptote y = 0 to the right
- All exponential graphs y = b^x pass through (0, 1) regardless of b (since b^0 = 1)

GOOD examples:
- Which equation defines an exponential function: y = b^x, y = x^b, y = b*x, or y = b + x? (Answer: y = b^x)
- What is the domain of y = 3^x? (All reals)
- What is the range of y = (1/2)^x? ((0, infinity))
- Which graph represents y = b^x for 0 < b < 1: decreasing curve in QII passing through (0,1) with asymptote at y=0?

DISTRACTORS: y = x^b (power function, not exponential); y = b*x (linear); swap domain and range; forget that range excludes 0.

Common error: students think (0, infinity) means b^x can equal 0 — it never does, it just approaches 0 asymptotically.
`
      },
      {
        condition: { field: "primary_focus", equals: "number_e" },
        content: `
THE NUMBER e (Stewart §1.4 Ex 4):
Stewart Exercise 4 covers the definition and approximate value of e.

STEWART'S PHRASING:
- "How is the number e defined?"
- "What is an approximate value for e?"
- "What is the natural exponential function?"

KEY FACTS:
- e is defined by Stewart geometrically: the number such that the slope of the tangent line to y = b^x at x = 0 equals 1.
- Equivalently: e is the value of b for which the derivative of b^x at x = 0 is 1 (introduced more formally in Chapter 3).
- Approximate value: e ≈ 2.71828... (irrational, transcendental).
- e is between 2 and 3, closer to 3 (since 2^x has tangent slope ≈ 0.69 at x=0, and 3^x has slope ≈ 1.10).
- Natural exponential function: y = e^x. Same shape as y = b^x for any b > 1, but with the special tangent property.

GOOD examples:
- Which of the following is closest to the value of e? (Choices: 2, 2.718, 3.14, 1.414. Answer: 2.718)
- The natural exponential function is: y = e^x, y = log(x), y = x^e, y = ln(x)? (Answer: y = e^x)
- The number e is defined as the base for which: (Answer: the tangent line to y = b^x at x = 0 has slope 1.)

DISTRACTORS: confuse e with pi (3.14); confuse e^x with ln(x) or log(x); confuse natural exponential e^x with power function x^e.
`
      },
      {
        condition: { field: "primary_focus", equals: "graphs" },
        content: `
GRAPHS OF y = b^x (Stewart §1.4 Ex 5-8):
Stewart Exercises 5-8 are graph-matching questions on a common screen with multiple exponential graphs.

STEWART'S PHRASING:
- "Graph the given functions on a common screen. How are these graphs related?"

STEWART'S CANONICAL SETS:
- Ex 5: y = 2^x, y = e^x, y = 5^x, y = 20^x  — all increasing, all pass through (0,1), all steeper as base grows
- Ex 6: y = e^x, y = e^(-x), y = 8^x, y = 8^(-x)  — pairs reflected about y-axis
- Ex 7: y = 3^x, y = 10^x, y = (1/3)^x, y = (1/10)^x  — increasing vs decreasing pairs (reciprocal bases)
- Ex 8: y = 0.9^x, y = 0.6^x, y = 0.3^x, y = 0.1^x  — all decreasing, all pass through (0,1), all steeper (downward) as base shrinks

KEY OBSERVATIONS:
- All y = b^x graphs (b > 0, b != 1) pass through (0, 1).
- All have horizontal asymptote y = 0.
- b > 1: increasing. Larger b = faster growth = steeper curve.
- 0 < b < 1: decreasing. Smaller b = faster decay = steeper downward curve.
- y = b^x and y = (1/b)^x are reflections about the y-axis (since (1/b)^x = b^(-x)).

GOOD examples using Pattern B (graph choices):
- "Which graph represents y = 0.5^x?" with 4 choices showing different decreasing exponentials.
- "Which graph represents y = 3^x?" with 4 choices showing different increasing exponentials.

For graphConfig: use type "single" with fn like "2^x" or "(0.5)^x" or "exp(x)". Renderer handles e^x as either e^x or exp(x); prefer exp(x) in fn strings (clearer for the renderer). All exponential graphs pass through (0,1) so include "points": [[0, 1]] to anchor the visual.

CRITICAL: choose xDomain narrow enough to show the asymptote behavior AND the steep growth. For y = 2^x, xDomain [-3, 3] is good; yDomain [-1, 9] shows the asymptote at y=0 and the value at x=3 (which is 8). For y = (1/2)^x, mirror: xDomain [-3, 3], yDomain [-1, 9].

DISTRACTORS for graph choices: increasing vs decreasing (most common error), wrong base value (b too large or too small), reflected about wrong axis.
`
      },
      {
        condition: { field: "primary_focus", equals: "transformations" },
        content: `
TRANSFORMATIONS OF EXPONENTIAL FUNCTIONS (Stewart §1.4 Ex 9-16):
This is §1.3's transformation skill applied to exponentials. The §1.3 conditional blocks apply here too — same rules for horizontal shifts (counterintuitive direction), vertical shifts, reflections, stretches.

STEWART'S PHRASING (Ex 9-14):
- "Make a rough sketch by hand of the graph of the function. Use the graphs given in Figures 3 and 15 and, if necessary, the transformations of Section 1.3."

STEWART'S PHRASING (Ex 15-16):
- "Starting with the graph of y = e^x, write the equation of the graph that results from [transformation]."
- "Starting with the graph of y = e^x, find the equation of the graph that results from reflecting about the line y = 4."

STEWART'S CANONICAL TRANSFORMATIONS:
- g(x) = 3^x + 1 — vertical shift up 1
- h(x) = 2*(1/2)^x - 3 — vertical stretch + vertical shift
- y = -e^(-x) — reflection about x-axis after reflection about y-axis (Ex 11)
- y = 4^(x+2) — horizontal shift left 2
- y = 1 - (1/2)*e^(-x) — combined transformations
- y = e^|x| — even-symmetric construction
- Ex 15a: y = e^x - 2 (shift 2 down) — answer: y = e^x - 2
- Ex 15b: y = e^(x-2) (shift 2 right) — answer: y = e^(x-2)
- Ex 15c: -e^x (reflect about x-axis) — answer: y = -e^x
- Ex 15d: e^(-x) (reflect about y-axis) — answer: y = e^(-x)
- Ex 15e: -e^(-x) (reflect about x-axis, then y-axis)
- Ex 16a: reflect y = e^x about y = 4 — answer: y = 8 - e^x (since reflection of (x, e^x) about y = 4 gives (x, 8 - e^x))
- Ex 16b: reflect y = e^x about x = 2 — answer: y = e^(4-x) (since reflection of (x, e^x) about x = 2 gives (4 - x, e^x))

KEY RULES:
- Horizontal asymptote MOVES with vertical shifts: y = e^x has asymptote y = 0; y = e^x - 3 has asymptote y = -3; y = e^x + 1 has asymptote y = 1.
- Horizontal asymptote does NOT move with horizontal shifts: y = e^(x-2) still has asymptote y = 0.
- Reflection about x-axis: y = -e^x. Asymptote stays at y = 0 but graph is now BELOW the x-axis.
- Reflection about y-axis: y = e^(-x). Same asymptote, same starting point (0, 1), but decreasing instead of increasing.
- Reflection about LINE y = c: replace y with 2c - y. So y = e^x becomes y = 2c - e^x.
- Reflection about LINE x = c: replace x with 2c - x. So y = e^x becomes y = e^(2c - x).

USE OVERLAY (SCHEMA A2) for these questions when both the parent (y = e^x) AND the transformed function are concrete. Show parent dashed and transformed solid. Follow the overlay viewing-window rules from §1.3: include both curves' key features (passing through (0,1) for parent; transformed passing point; horizontal asymptote of both).

DISTRACTORS: horizontal direction reversed; vertical direction reversed; reflection about wrong axis; asymptote moved when only horizontal shift occurred; missed asymptote shift when vertical shift occurred.
`
      },
      {
        condition: { field: "primary_focus", equals: "domain" },
        content: `
DOMAIN PROBLEMS INVOLVING EXPONENTIALS (Stewart §1.4 Ex 17-18):
Stewart Exercises 17-18 ask students to find the domain of functions that involve exponentials.

STEWART'S PHRASING:
- "Find the domain of each function."

STEWART'S CANONICAL EXAMPLES:
- f(x) = (1 - e^(x^2)) / (1 - e^(1 - x^2))
- f(x) = (1 + x) / (e^(cos(x)))
- g(t) = sqrt(10^t - 100)
- g(t) = sin(e^t - 1)

KEY OBSERVATIONS:
- e^anything is ALWAYS positive (range (0, infinity)). So 1 - e^anything is never 1; e^anything is never 0.
- The domain restrictions come from the OUTER function (sqrt, division, log), not from the exponential itself.
- e^x is defined for all real x; no domain restriction from the exponential.

GOOD examples:
- f(x) = 1 / (1 - e^x). Domain: x != 0 (since 1 - e^x = 0 when e^x = 1, i.e. x = 0).
- g(t) = sqrt(e^t - 4). Domain: e^t >= 4, so t >= ln(4) = 2*ln(2). (Note: this introduces ln, which is §1.5 — only use if logs are acceptable in your course.)
- g(t) = sqrt(10^t - 100). Domain: 10^t >= 100, so t >= 2.
- f(x) = e^x / (x - 3). Domain: x != 3 (denominator zero).
- f(x) = (1 + x) / e^(cos(x)). Domain: all reals (e^anything is never 0, denominator never vanishes; numerator defined everywhere).

CRITICAL: for the kind of domain analysis that involves SOLVING an exponential equation (e.g. sqrt(10^t - 100) requires 10^t >= 100, hence t >= 2), the student needs basic exponential reasoning OR logarithms. If the course is pre-logarithms, restrict to domain problems whose answer is "all reals" or "x != c" where c is found without taking a log.

DISTRACTORS: claim that e^x = 0 is possible (thereby excluding x = something from domain — never correct); apply domain restriction from the exponential's argument (e^x has no domain restriction); confuse range with domain.
`
      },
      {
        condition: { field: "primary_focus", equals: "applications" },
        content: `
APPLICATIONS OF EXPONENTIAL FUNCTIONS:
Stewart §1.4 covers three standard applications: compound interest, population growth, and radioactive decay.

COMPOUND INTEREST formulas:
- Annual compounding: A(t) = P*(1 + r)^t
- Compounding n times per year: A(t) = P*(1 + r/n)^(n*t)
- Continuous compounding: A(t) = P*e^(r*t)
where P is principal, r is annual rate (as a decimal), t is years.

POPULATION GROWTH:
- General form: P(t) = P_0 * b^t for some base b > 1 (b = 1 + growth rate per time unit).
- Continuous form: P(t) = P_0 * e^(k*t), where k > 0 is the continuous growth rate.

RADIOACTIVE DECAY (half-life):
- A(t) = A_0 * (1/2)^(t/h), where h is the half-life.
- Equivalently: A(t) = A_0 * e^(-k*t), where k = ln(2)/h > 0.

GOOD examples:
- Compound interest: $5000 at 4% compounded annually. Balance after 10 years? A(10) = 5000*(1.04)^10 ≈ $7401.22.
- Compound interest comparison: $1000 at 5% compounded annually vs. continuously over 20 years. Annual: $2653.30; continuous: $2718.28.
- Population: bacteria population doubles every 3 hours; starting 100, after 12 hours? P(12) = 100*2^(12/3) = 100*16 = 1600.
- Decay: substance has half-life 8 days; starting 80g, after 24 days? A(24) = 80*(1/2)^(24/8) = 80*(1/8) = 10g.

REQUIRED DETAIL:
- State the formula explicitly in the explanation.
- Carry units through (dollars, hours, days, grams).
- For compound interest, distinguish annual / quarterly / monthly / continuous when stated in the problem.
- For doubling/halving, the time unit in (1/2)^(t/h) must match the half-life unit.

DISTRACTORS: use simple interest instead of compound (A = P + P*r*t); use base r instead of 1+r (e.g. (0.06)^t instead of (1.06)^t); off-by-one in the exponent's time conversion; forget to use the continuous formula when the problem says "continuously".
`
      },
      {
        condition: { field: "student_tasks", includes: "transformation_of_exponential" },
        content: `
GRAPH POLICY FOR transformation_of_exponential (Stewart §1.4 Ex 9-14):
Follow the same overlay rules as §1.3 describe_transformation_from_equation.

- For "make a rough sketch" questions where the student picks the graph: use Pattern B (graph choices, no stem graph). Stem reads "Which graph represents y = 4^(x+2)?" with four candidate graphs.
- For "starting with y = e^x, write the equation" questions: NO GRAPH. Verbal-to-algebraic. Stem reads like Stewart Ex 15: "Starting with the graph of y = e^x, write the equation of the graph that results from shifting 2 units to the right." Choices are equations.
- For "explain how h is obtained from f" questions where both are concrete: USE OVERLAY (SCHEMA A2). Parent y = e^x dashed, transformed solid. Apply the overlay viewing-window rules: include both curves' passing point (0, 1) for parent, and the transformed's key feature.

THE HORIZONTAL ASYMPTOTE matters here in a way it didn't for §1.3 polynomials and radicals. Vertical shifts MOVE the asymptote; horizontal shifts do NOT. Distractors should exploit this confusion.

EXPRESSION SYNTAX in fn strings for graphConfig:
- For e^x use either "e^x" or "exp(x)" — both work, prefer "exp(x)" for clarity.
- For e^(-x) use "exp(-x)" or "e^(-x)".
- For 2^x use "2^x".
- For (1/2)^x use "(1/2)^x" or "0.5^x".
- For e^(x-2) - 1 use "exp(x - 2) - 1".

REGRESSION-CHECK: the v5 renderer (commit f479ab3) handles -(group)^n, fractional coefficients like (1)/(2)sqrt, and )letter implicit multiplication. So expressions like "-exp(x)" and "(1/2)*exp(x) + 1" should render. If a graph comes back blank for an exponential transformation, file a bug — don't add a template workaround.
`
      },
      {
        condition: { field: "student_tasks", includes: "match_equation_to_graph" },
        content: `
PATTERN B FRAMING FOR match_equation_to_graph in §1.4 (Stewart §1.4 Ex 5-8 style):
When the task is to match an exponential equation to its graph, use Pattern B (no stem graph; four graphConfig choices). The student visualizes b^x in their head and picks the matching graph.

STEM FRAMING:
- "Which graph represents y = 3^x?"
- "Which graph represents y = (1/2)^x?"
- "Which graph represents y = 2^(-x)?"
- "Which graph below shows y = e^(x - 1) + 2?"

GRAPH CHOICES (4 graphConfig objects, "graphType": "single", NOT "type"):
- All four must use the SAME xDomain and yDomain for fair visual comparison.
- For pure y = b^x (no shifts), include "points": [[0, 1]] to anchor the passing-through-(0,1) feature.
- Vary the distractors:
  * Correct answer
  * Reciprocal base (e.g. (1/3)^x when answer is 3^x) — most common confusion
  * Reflected about y-axis (e.g. 3^(-x))
  * Wrong direction (increasing vs decreasing)
- For transformed exponentials, vary horizontal shift direction, vertical shift direction, and reflection.

VIEWING WINDOW for exponentials:
- y = b^x for b > 1: xDomain [-2, 3] or [-3, 3], yDomain to fit the value at the right edge (e.g. for 2^x at x=3, y=8, so yDomain [-1, 10]).
- y = b^x for 0 < b < 1: mirror of above. xDomain [-3, 2] or [-3, 3], yDomain same scale.
- For e^x specifically: xDomain [-2, 2] is tight; yDomain [-1, 8].

DO NOT use xDomain like [-10, 10] — exponentials grow too fast to be visible at that scale.
`
      },
      {
        condition: { field: "student_tasks", includes: "write_transformation_equation" },
        content: `
NO GRAPH FOR write_transformation_equation (Stewart §1.4 Ex 15 style):
Stewart Exercise 15 is verbal-to-algebraic. The student is told "starting with y = e^x" and given a verbal description ("shifting 2 units to the right"), and writes the equation.

For ANY question whose primary_task is "write_transformation_equation":
- DO NOT include hasGraph or graphConfig.
- Stem reads like Stewart Ex 15: "Starting with the graph of y = e^x, write the equation of the graph that results from [verbal description]."
- Choices are equations in e^x notation: y = e^(x-2), y = e^(x+2), y = e^x - 2, etc.

STEWART'S CANONICAL EXAMPLES (Ex 15):
- "shifting 2 units downward" -> y = e^x - 2
- "shifting 2 units to the right" -> y = e^(x - 2)
- "reflecting about the x-axis" -> y = -e^x
- "reflecting about the y-axis" -> y = e^(-x)
- "reflecting about the x-axis and then about the y-axis" -> y = -e^(-x)

DISTRACTORS: confuse e^(x-h) vs e^x - h (horizontal shift vs vertical shift); confuse -e^x with e^(-x) (the two reflections are different); compose reflections incorrectly.

THIS RULE OVERRIDES the global graphs_option setting.
`
      },
      {
        condition: { field: "student_tasks", includes: "reflection_about_line" },
        content: `
REFLECTION ABOUT LINE y = c OR x = c (Stewart §1.4 Ex 16):
Stewart Exercise 16 is more advanced — reflection not about an axis, but about a horizontal or vertical line.

KEY FORMULAS:
- Reflection of y = f(x) about the line y = c: replace y with 2c - y. New equation: y = 2c - f(x).
- Reflection of y = f(x) about the line x = c: replace x with 2c - x. New equation: y = f(2c - x).

STEWART'S EXAMPLES:
- Ex 16a: reflect y = e^x about y = 4 -> y = 2(4) - e^x = 8 - e^x.
- Ex 16b: reflect y = e^x about x = 2 -> y = e^(2(2) - x) = e^(4 - x).

GOOD examples:
- "Starting with y = e^x, find the equation that results from reflecting about the line y = 3." Answer: y = 6 - e^x.
- "Reflect y = 2^x about the line x = -1." Answer: y = 2^(-2 - x).

DISTRACTORS: use c instead of 2c (e.g. y = 4 - e^x instead of y = 8 - e^x); reflect about the wrong axis instead of the line; use the line equation as a shift (y = e^x - 4 or y = e^(x-2) — those are shifts, not reflections about lines).

THIS IS A COMMON SOURCE OF ERROR. The reflection-about-line formula is NOT a shift. The "2c minus" comes from the midpoint property: if P is reflected to P' about the line y = c, the midpoint of PP' lies on y = c.

No graph required for this task. If a graph is included, USE OVERLAY: original y = e^x (dashed), reflected curve (solid), AND draw the reflection line as a horizontal/vertical dashed reference line. The renderer doesn't currently support drawing a reference line, so default to no graph for these questions.
`
      },
      {
        condition: { field: "student_tasks", includes: "find_domain" },
        content: `
DOMAIN AFTER EXPONENTIAL INVOLVEMENT (Stewart §1.4 Ex 17-18):
Same rules as §1.3 find_domain, with one critical addition: e^x and b^x are NEVER zero, so they never create new domain restrictions on their own.

KEY OBSERVATIONS:
- The exponential e^x (or any b^x for b > 0) is defined for all real x.
- e^x > 0 for all x. It never equals 0, never equals negative.
- 1/(e^x) is defined for all x (denominator never zero).
- ln(e^x) is defined for all x (since e^x > 0, log argument is always positive).
- sqrt(e^x) is defined for all x (since e^x > 0).
- sqrt(e^x - 4) requires e^x >= 4, so x >= ln(4). (Logarithms.)

STEWART-STYLE DOMAIN PROBLEMS:
- f(x) = (1 + x) / e^(cos(x)). Domain: all reals (denominator is always positive).
- g(t) = sqrt(10^t - 100). Domain: t >= 2 (since 10^t >= 100 iff t >= 2).
- f(x) = 1/(1 - e^x). Domain: x != 0 (since 1 - e^x = 0 iff x = 0).

DISTRACTORS: claim e^x can equal 0 or be negative; claim the domain restriction comes from the exponential's argument; forget the denominator's zero-set; off-by-one in the log calculation.

If your course is pre-logarithms, restrict to "all reals" domains, "x != c" domains where c is found without ln, and base-10 or base-2 cases where the threshold is a clean power.
`
      }
    ],

    notation_additions: [
      `EXPONENTIAL FUNCTION: write y = b^x where b is the base (constant, b > 0) and x is the exponent (variable). The variable is in the EXPONENT. Power functions are y = x^b (variable in the base) — they are different.`,
      `NEGATIVE EXPONENTS: b^(-n) = 1/b^n. So 2^(-3) = 1/8. e^(-x) = 1/e^x.`,
      `THE NUMBER e: write the literal letter e, e.g. e^x, e^(2*x), e^(-x). Never write 2.718 in place of e — use the symbol.`,
      `NATURAL EXPONENTIAL: y = e^x. Synonyms: "natural exponential function", "exponential function with base e". In fn strings for graphConfig, use either "e^x" or "exp(x)" — both work.`,
      `LAWS OF EXPONENTS: b^m * b^n = b^(m+n), b^m / b^n = b^(m-n), (b^m)^n = b^(m*n), (a*b)^n = a^n * b^n, b^0 = 1.`,
      `SIGN CONVENTION: -b^n means -(b^n), NOT (-b)^n. So -2^4 = -16, but (-2)^4 = 16. Use parentheses to disambiguate.`,
      `HORIZONTAL ASYMPTOTE: y = b^x has horizontal asymptote y = 0. After a vertical shift y = b^x + k, the asymptote is y = k. After a horizontal shift, the asymptote does NOT move.`,
      `COMPOUND INTEREST: A = P*(1 + r/n)^(n*t) for n compoundings per year; A = P*e^(r*t) for continuous compounding. P is principal, r is annual rate (decimal), t is years.`,
      `DOMAIN NOTATION: use interval notation, e.g. (-infinity, infinity), [0, infinity), (-infinity, 5) U (5, infinity). Use "infinity" and "-infinity" as text — never the unicode glyph.`,
      `Do NOT use unicode symbols anywhere. Write <= >= != and "infinity" — never the unicode versions.`
    ],

    subtopic_values: [
      "laws_of_exponents", "definition", "number_e", "graphs",
      "transformations", "domain", "applications"
    ],
    function_type_values: [
      "integer_base", "natural_e", "fractional_base", "decimal_base"
    ],
    primary_task_values: [
      "simplify_exponent_expression", "write_exponential_definition",
      "state_definition_of_e", "evaluate_exponential",
      "identify_growth_decay", "match_equation_to_graph",
      "transformation_of_exponential", "write_transformation_equation",
      "reflection_about_line", "find_domain",
      "compound_interest", "population_growth_decay"
    ]
  }
};
