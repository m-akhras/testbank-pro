// Shared prompt builder for Quantitative Methods I and II

export const questionTypes = ["normal", "table", "graph", "mix"];

export function buildMutationRules(type) {
  return type === "function"
    ? "function mutation — use a different function type entirely (e.g. if original uses polynomial, use exponential or trigonometric). Same concept difficulty, same steps."
    : "numbers mutation — keep same function types, change only coefficients/constants.";
}

export function buildSectionRules(sectionNum, compact = false) {
  if (sectionNum === 1) {
    return compact
      ? `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change only coefficients/constants, keep same function types.`
      : `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types as originals.`;
  }
  return compact
    ? `- Section ${sectionNum} versions (S${sectionNum}_A, S${sectionNum}_B, ...): keep the SAME distribution type. Change μ, σ, uMin, uMax, or probability direction (< vs >). Update graphConfig to match. NEVER change distribution type.`
    : `- Section ${sectionNum} versions (S${sectionNum}_A, S${sectionNum}_B, ...): numbers/direction mutation — keep the SAME distribution type (e.g. normal stays normal, uniform stays uniform, exponential stays exponential). You may change μ, σ, uMin, uMax, or the probability direction (e.g. P(X<4) → P(X>3) or P(a<X<b)). Update graphConfig shadeFrom, shadeTo, probability, and mu/sigma/uMin/uMax to match. NEVER change the distribution type.`;
}

export const crossSectionRule =
  `- Across sections: SAME distribution type MUST be kept — only numbers, direction (< vs >) or boundary values may change. NEVER switch distribution types across sections.`;

export const crossSectionRuleShort =
  `Across sections: SAME distribution type MUST be kept. Only numbers (μ, σ, uMin, uMax) or probability direction (< vs >) may change. NEVER switch distribution types.`;

export { buildPrompt as buildGeneratePromptRules };
export function buildPrompt({ course, totalQ, breakdown, hasGraphQuestions, qType, typeInstruction, commonRules, mathNotationBase }) {
  const tableInstructions = hasGraphQuestions ? `
QM QUESTION TYPES:
1. NORMAL: Real-world business scenario, pure numeric calculation.
2. TABLE: Present data in a pipe table, ask student to compute from it.
   Table types: probability/frequency, joint probability, contingency, payoff/decision, regression output.
   Use exact tableRows and tableCols specified. tableRows = DATA rows (not counting header).
   Example tableRows:4, tableCols:3:
   | X | P(X) | Cumulative P |
   |---|------|--------------|
   | 0 | 0.10 | 0.10 |
   | 1 | 0.25 | 0.35 |
   | 2 | 0.40 | 0.75 |
   | 3 | 0.25 | 1.00 |
   NEVER default to 2-column 4-row when larger size specified.

3. CHART: Include hasGraph:true and graphConfig (NO title or probability fields):
   * Bar: {"type":"bar","labels":["A","B","C"],"values":[10,25,15],"xLabel":"Category","yLabel":"Frequency"}
   * Histogram: {"type":"histogram","bins":[{"x0":10,"x1":20,"count":5}],"xLabel":"Value","yLabel":"Frequency"}
   * Scatter: {"type":"scatter","points":[{"x":1,"y":3}],"xLabel":"x","yLabel":"y","regressionLine":{"slope":1.8,"intercept":1.2}}
   * Discrete dist: {"type":"discrete_dist","data":[{"x":0,"p":0.10},{"x":1,"p":0.35}],"highlightX":2}
   * Normal: {"type":"continuous_dist","distType":"normal","mu":50,"sigma":10,"shadeFrom":65,"shadeTo":null,"probability":"P(X>65)","xLabel":"x"}
   * Standard normal: {"type":"continuous_dist","distType":"standard_normal","mu":0,"sigma":1,"shadeFrom":1.5,"shadeTo":null,"probability":"P(Z>1.5)"}
   * Uniform: {"type":"continuous_dist","distType":"uniform","uMin":2,"uMax":8,"shadeFrom":4,"shadeTo":7,"probability":"P(4<X<7)"}
     CRITICAL: uMin and uMax MUST match actual distribution boundaries. NEVER leave at defaults.
   * Exponential: {"type":"continuous_dist","distType":"exponential","mu":2,"shadeFrom":null,"shadeTo":3,"probability":"P(X<3)"}
     CRITICAL: mu MUST match mean in question. NEVER mismatch.
   SHADING: P(X>a)→shadeFrom=a,shadeTo=null | P(X<b)→shadeFrom=null,shadeTo=b | P(a<X<b)→shadeFrom=a,shadeTo=b
   GRAPH TEXT: "Based on the distribution above, find P(...)" — never state parameters in text.
   IMPORTANT: Do NOT include "title" or "probability" as top-level graphConfig fields — omit them entirely.
` : "";

  return `TESTBANK_GENERATE_REQUEST
Course: ${course} (Anderson, Sweeney, Williams)
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstruction}
${tableInstructions}
You are a college business/statistics professor (Anderson, Sweeney, Williams textbook).

STYLE RULES — every question MUST follow:
1. REAL-WORLD CONTEXT: Use realistic business scenarios. NEVER abstract math, unless the section-specific style_rules in the TEXTBOOK GROUNDING block above explicitly allow it for that section.
   WRONG: "A variable X is uniformly distributed on [2,10]."
   RIGHT: "Customer waiting time is uniformly distributed between 2 and 10 minutes."
2. SCENARIOS (rotate): waiting times, delivery times, machine lifetimes, sales/revenue, employee metrics, manufacturing defects, financial returns, call center times, project completion.
3. PHRASING: State scenario first, then ask the probability/calculation.
4. NUMBERS: Realistic (waiting times in minutes, salaries in thousands).
5. GRAPH QUESTIONS: "Based on the distribution above, find P(...)" — no parameters in text.
6. EXPONENTIAL DISTRIBUTION — μ-only parameterization. NON-NEGOTIABLE for ALL exponential questions across every chapter:
   - Use the mean μ exclusively. The symbols λ, "lambda", and the word "rate" MUST NOT appear in question text, choices, or explanation.
   - Write "mean μ = 4 minutes". NEVER "mean mu = 4", "λ = 0.25", "rate parameter", or "with rate λ".
   - Formulas in scope MUST be expressed in terms of μ:
       E(X) = μ
       Var(X) = μ²
       SD(X) = μ
       PDF: f(x) = (1/μ) · e^(−x/μ) for x ≥ 0
       P(X ≤ x) = 1 − e^(−x/μ); P(X > x) = e^(−x/μ)
   - graphConfig for exponential always passes "mu" (e.g. {"distType":"exponential","mu":4,...}). NEVER pass "lambda".
7. SECTIONS 4.3, 4.4, 4.5 (two-event probability): When the question involves two events and their probabilities (union, intersection, conditional), set hasGraph:true and emit graphConfig with this shape:
   { "type": "venn", "sets": [{"label":"A","color":"#3b82f6"},{"label":"B","color":"#ef4444"}], "shaded": ["AandB"], "elementsAB": ["0.15"], "elementsA": ["0.25"], "elementsB": ["0.30"], "universeLabel": "S" }
   - "shaded" can contain: "A", "B", "AandB", "AorB", "AnotB", "BnotA".
   - elementsA/B/AB hold probability values (as strings) shown in each region.
8. SECTIONS 14.1, 14.2, 14.3 (simple linear regression): When the question involves a regression equation or scatter plot with a fitted line, set hasGraph:true and emit graphConfig with this shape:
   { "type": "scatter", "points": [{"x":1,"y":12},{"x":2,"y":15}], "xLabel": "Temperature (°F)", "yLabel": "Ice cream sales ($1000s)", "regressionLine": {"slope": 0.8, "intercept": 10} }
   - "points" is an array of {x, y} objects taken from the question data.
   - "regressionLine.intercept" is b₀ and "regressionLine.slope" is b₁ of the fitted line. They must match the y = b₀ + b₁x equation shown in the question text exactly.
   - xLabel and yLabel MUST be the named predictor and response variables WITH UNITS (e.g. "Temperature (°F)", "Ice cream sales ($1000s)"). The chart axes carry the scenario names; the question text uses y/x notation.

9. CHAPTER 8 (Interval Estimation) — t-distribution lookup rule:
    For any confidence interval question that uses the t-distribution (population mean with σ unknown, including sections 8.2 and 8.3):
    - DO NOT provide the t critical value (t_{α/2}) directly in the question text, choices, or explanation setup.
    - Instead, give the student the degrees of freedom (df = n − 1) and the confidence level (e.g. "95%"), and require them to look up t_{α/2,df} from a t-distribution table.
    - The stem should explicitly direct the lookup, e.g. "Use the t-distribution table to find the appropriate t critical value." or "Look up t_{α/2} for [df] degrees of freedom at the [X]% confidence level."
    - The explanation/answer key MAY state the looked-up value (so graders can verify), but the QUESTION must require the student to find it.
    For z-distribution intervals (large samples or known σ, sections 8.1, 8.4): standard z critical values (1.645, 1.96, 2.575) MAY be given in the stem OR required by lookup — vary across questions for practice with both modes.

10. EXPECTED VALUE & VARIANCE — required question-type variety. These are ADDITIONS to the existing probability/calculation pool, not replacements. Across any generated set, mix probability questions with E(X) / Var(X) / SD(X) questions so students see both.

    SECTION 5.5 (Binomial Distribution) — include questions of these types in the pool:
    - Find E(X) for a binomial r.v. given n and p, using E(X) = n·p.
    - Find Var(X) given n and p, using Var(X) = n·p·(1 − p).
    - Find SD(X) = √(n·p·(1 − p)).
    - Word problems: expected number of successes and the spread, e.g. "A call center receives 200 calls per day; 12% require a supervisor. Find the expected number requiring a supervisor and the standard deviation."
    Stem and choices use the named scenario (e.g. "expected number of defective units"), not abstract X.

    CHAPTER 6 (Continuous Distributions) — include E(X) / Var(X) / SD(X) questions for each subtype:
    - Uniform on [a, b]: E(X) = (a + b)/2, Var(X) = (b − a)²/12, SD(X) = (b − a)/√12.
      Example stem: "Customer waiting time is uniformly distributed between 2 and 10 minutes. Find the expected waiting time and the standard deviation."
    - Exponential with mean μ: E(X) = μ, Var(X) = μ², SD(X) = μ. (See rule 6 — μ-only, no λ, no "rate".)
      Example stem: "The time between arrivals at a drive-through has mean μ = 3 minutes. Find E(X) and SD(X)."
    - Normal with mean μ and standard deviation σ: E(X) = μ, Var(X) = σ², SD(X) = σ. May be given in the stem OR read from a graph (use showMu/showSigma toggles in graphConfig: hide one and ask the student to read it).
      Example stem: "Daily sales (in $1000s) are normally distributed as shown. Find E(X) and SD(X)."

    All E(X) / Var(X) / SD(X) questions MUST follow the standard QM scenario style: real business context, named units in the answer (e.g. "12 calls", "1.8 minutes²"), no bare X.

${mathNotationBase}

BRANCHED MCQ (when qType is "Branched MCQ"):
- Shared business-scenario stem followed by 2-4 multiple-choice parts.
- Easy: 2 parts. Medium: 3-4 parts. Hard: 4 parts.
- Each part is a fully independent MCQ — its own question, 4 choices, exactly one correct answer.
- All parts reference the SAME stem (same scenario, same data, same distribution).
- Distractors per part: same-question distractors only — never put answers to a different part in the choice list. Distractors should reflect typical mistakes (wrong tail direction, swapped μ/σ, dropped continuity correction, mis-applied complement).
- The 4 parts must each test a DIFFERENT skill (e.g. compute E(X), compute Var(X), compute P(X<a), interpret in context) — do not repeat the same calculation four times.
- Do NOT include "mark" or "marks" fields anywhere in the JSON. Marks are added manually after generation.
${commonRules}`;
}
