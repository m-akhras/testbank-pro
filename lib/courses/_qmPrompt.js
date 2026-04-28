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
1. REAL-WORLD CONTEXT: Use realistic business scenarios. NEVER abstract math.
   WRONG: "A variable X is uniformly distributed on [2,10]."
   RIGHT: "Customer waiting time is uniformly distributed between 2 and 10 minutes."
2. SCENARIOS (rotate): waiting times, delivery times, machine lifetimes, sales/revenue, employee metrics, manufacturing defects, financial returns, call center times, project completion.
3. PHRASING: State scenario first, then ask the probability/calculation.
4. NUMBERS: Realistic (waiting times in minutes, salaries in thousands).
5. GRAPH QUESTIONS: "Based on the distribution above, find P(...)" — no parameters in text.
6. EXPONENTIAL: Use Greek μ symbol. Write "mean μ = 4 minutes" NEVER "mean mu = 4" or "λ = 0.25".
7. SECTIONS 4.3, 4.4, 4.5 (two-event probability): When the question involves two events and their probabilities (union, intersection, conditional), set hasGraph:true and emit graphConfig with this shape:
   { "type": "venn", "sets": [{"label":"A","color":"#3b82f6"},{"label":"B","color":"#ef4444"}], "shaded": ["AandB"], "elementsAB": ["0.15"], "elementsA": ["0.25"], "elementsB": ["0.30"], "universeLabel": "S" }
   - "shaded" can contain: "A", "B", "AandB", "AorB", "AnotB", "BnotA".
   - elementsA/B/AB hold probability values (as strings) shown in each region.
8. SECTIONS 14.1, 14.2, 14.3 (simple linear regression): When the question involves a regression equation or scatter plot with a fitted line, set hasGraph:true and emit graphConfig with this shape:
   { "type": "scatter", "points": [{"x":1,"y":12},{"x":2,"y":15}], "xLabel": "Temperature (°F)", "yLabel": "Ice cream sales ($1000s)", "regressionLine": {"slope": 0.8, "intercept": 10} }
   - "points" is an array of {x, y} objects taken from the question data.
   - "regressionLine.intercept" is b₀ and "regressionLine.slope" is b₁ of the fitted line. They must match the y = b₀ + b₁x equation shown in the question text exactly (see rule 9).
   - xLabel and yLabel MUST be the named predictor and response variables WITH UNITS (e.g. "Temperature (°F)", "Ice cream sales ($1000s)"). The chart axes carry the scenario names; the question text uses y/x notation.

9. SECTION 14.1 ONLY (Simple Linear Regression Model) — standard-notation word-problem rules. NON-NEGOTIABLE:

   A. EQUATION ALWAYS IN y = b₀ + b₁x FORM.
      Every regression equation in the stem, choices, and explanation is written in textbook notation: y = b₀ + b₁x with the actual numeric coefficients substituted in (e.g. "y = 10 + 0.8x", "y = 100 + 5x", "y = 120 + 0.18x"). NEVER write the equation with named variables on either side ("Sales = 100 + 5·Advertising" is NOT used in 14.1 questions). NEVER use ŷ / yhat — write y.
      When hasGraph is true, the numeric b₀ and b₁ in the equation MUST equal graphConfig.regressionLine.intercept and .slope.

   B. THE QUESTION MUST DEFINE WHAT x AND y REPRESENT.
      Every question text introduces the scenario and explicitly defines the variables before (or just after) the equation. Use the pattern:
        "A business examines [predictor variable] (units) and [response variable] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]."
      The "where x represents … and y represents …" clause is REQUIRED — students must always know which real-world quantity each symbol stands for.

   C. PREDICTIONS AND INTERPRETATIONS ARE PHRASED IN BUSINESS TERMS.
      Even though the equation uses y and x, the question asks the student to act on the scenario, not on abstract symbols.
        RIGHT: "Predict the sales when temperature is 80°F."
        WRONG: "Find y when x = 80."
        RIGHT: "What does the value 0.8 represent in this regression equation?" (followed by sentence choices in scenario terms)
        WRONG: "What does the slope of y on x represent?"

   D. SCENARIO DIVERSITY — rotate across the question set, do not reuse the same scenario twice in a row:
      - Advertising spend (in $1000s) vs Sales (in $1000s)
      - Hours studied vs Test score
      - Years of experience vs Annual salary (in $1000s)
      - Temperature (°F) vs Ice cream sales (in $1000s)
      - Square footage vs House price (in $1000s)
      - Production volume (units) vs Total cost (in $1000s)
      - Marketing budget (in $1000s) vs Customer acquisitions
      - Number of in-store promotions vs Weekly revenue (in $1000s)
      Always include units in the axis labels (xLabel/yLabel), in the variable definitions in the stem, and in any predicted-value answer choice.

   E. ALLOWED QUESTION TYPES — generate a mix across the set, never all the same type:

      a. Interpret b₀ (y-intercept) in context.
         Stem pattern: "A business examines [predictor] (units) and [response] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]. What does the value <b₀> represent in this regression equation?"
         All four choices are FULL ENGLISH SENTENCES describing the scenario meaning of b₀ — NOT formulas, NOT "y when x = 0".
         Example correct choice: "The predicted sales (in $1000s) when temperature is 0°F."
         Example wrong choice: "y when x = 0."

      b. Interpret b₁ (slope) in context.
         Stem pattern: same setup as (a), ending with: "What does the slope <b₁> mean in this scenario?"
         All four choices are FULL ENGLISH SENTENCES in scenario terms.
         Example correct choice: "For each additional 1°F in temperature, predicted sales increase by $800."
         Example wrong choice: "y increases by 0.8 for each unit of x."

      c. Find b₀ and b₁ from a scatter plot or summary table (Σx, Σy, Σxy, Σx², n).
         Stem ends with: "... the estimated regression equation is approximately:"
         All four choices are equations in y = b₀ + b₁x form (e.g. "y = 10 + 0.8x", "y = 12 + 0.5x"). NEVER named-variable form for these choices.

      d. Identify the full regression equation from a graph.
         Stem describes the scenario, defines x and y, and asks which equation matches the fitted line in the scatter plot.
         All four choices are equations in y = b₀ + b₁x form. NEVER named-variable form.

      e. Predict the response for a given predictor value, phrased as a business question.
         Stem pattern: "A business examines [predictor] (units) and [response] (units). The regression equation is y = <b₀> + <b₁>x, where x represents [predictor] and y represents [response]. Predict the [response in business terms] when [predictor] is [value]."
         RIGHT: "Predict the sales when temperature is 80°F."
         WRONG: "Find y when x = 80."
         All four choices are numeric values WITH UNITS (e.g. "$74,000", "74 thousand dollars").

      f. Direction and strength of the linear relationship from a scatter plot.
         Stem: "Based on the scatter plot of [predictor] vs [response], describe the direction and strength of the linear relationship."
         All four choices are full sentences: "Positive and strong", "Positive and weak", "Negative and moderate", "No linear relationship", etc.

   F. ANSWER CHOICE STYLE — strict per type:
      - Types a, b, f (interpretation): all four choices are FULL ENGLISH SENTENCES describing the scenario meaning, with units. No formulas. No "y when x = …" wording.
      - Types c, d (equation identification): all four choices are equations in y = b₀ + b₁x form. Never "Sales = 100 + 5·Advertising" form for choices.
      - Type e (prediction): all four choices are numeric values with the response variable's units.

   G. FORBIDDEN in 14.1 — these belong in later sections, do NOT generate them here:
      - Residual calculations. The word "residual" must NOT appear anywhere in question text, choices, or explanation.
      - SSE, SSR, SST, MSE, standard error of the estimate (s_e or s).
      - R² / coefficient of determination (that is section 14.3).
      - Hypothesis tests, t-statistics, p-values, or confidence intervals on slope or intercept (those are 14.5).
      - Pure abstract math with no scenario or no x/y definition (the "where x represents … and y represents …" clause is required).
      - "ŷ" or "yhat" (write y instead) and any equation form using named variables on either side ("Sales = 100 + 5·Advertising").
${mathNotationBase}
${commonRules}`;
}
