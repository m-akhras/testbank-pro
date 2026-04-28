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
   { "type": "scatter", "points": [{"x":1,"y":12},{"x":2,"y":15}], "xLabel": "Promotions per week", "yLabel": "Weekly revenue ($1000s)", "regressionLine": {"slope": 1.8, "intercept": 10.2} }
   - "points" is an array of {x, y} objects taken from the question data.
   - "regressionLine.intercept" is b₀ and "regressionLine.slope" is b₁ of the fitted line. They must match the named-variable equation shown in the question text exactly (see rule 9).
   - xLabel and yLabel MUST be the named predictor and response variables WITH UNITS (e.g. "Promotions per week", "Weekly revenue ($1000s)"). NEVER bare "x" or "y".

9. SECTION 14.1 ONLY (Simple Linear Regression Model) — strict word-problem rules. NON-NEGOTIABLE:

   A. NAMED VARIABLES — required for interpretation and prediction (types a, b, e, f below); optional for equation identification (types c, d).
      For types a, b, e, f: "x", "y", and "ŷ" (or "yhat") MUST NOT appear in the question text, the regression equation given in the stem, the answer choices, or the explanation. Use the named scenario variables on BOTH sides of every equation.
        WRONG (interpretation): "Given y = 14 + 2.2x, what does 2.2 mean?"
        WRONG (prediction):     "Find y when x = 5."
        WRONG:                  "ŷ = 100 + 5x" (still uses x and ŷ).
        RIGHT (interpretation): "The estimated regression line is Sales = 100 + 5 · Advertising. What does 5 represent in this equation?"
        RIGHT (prediction):     "Predict Sales when Advertising spend is $10,000."
      For types c and d (equation identification from a graph or summary table): x/y notation IS acceptable in BOTH the stem and the answer choices, because students need to recognize fitted equations in either form. Both "Sales = 20 + 5 · Advertising" and "y = 20 + 5x" are valid choice formats. You may mix named and x/y forms across the four choices for these types.

   B. EQUATION FORM when the equation appears in the stem (types a, b, e).
      Always write as: <Response> = b₀ + b₁ · <Predictor>
      with named variables and the actual numeric coefficients substituted in.
      Examples: "Sales = 100 + 5 · Advertising", "Salary = 32 + 2.4 · Experience", "Price = 120 + 0.18 · SquareFeet".
      When hasGraph is true, the numeric b₀ and b₁ in this equation MUST equal graphConfig.regressionLine.intercept and .slope respectively.

   C. SCENARIO DIVERSITY — rotate across the question set, do not reuse the same scenario twice in a row:
      - Advertising spend (in $1000s) vs Sales (in $1000s)
      - Hours studied vs Test score
      - Years of experience vs Annual salary (in $1000s)
      - Temperature (°F) vs Ice cream sales
      - Square footage vs House price (in $1000s)
      - Production volume (units) vs Total cost (in $1000s)
      - Marketing budget (in $1000s) vs Customer acquisitions
      - Number of in-store promotions vs Weekly revenue (in $1000s)
      Always include units in the axis labels (xLabel/yLabel) and in any predicted-value answer choice.

   D. ALLOWED QUESTION TYPES — generate a mix across the set, never all the same type:
      a. Interpret b₀ (y-intercept) in context.
         Stem pattern: "<Scenario sentence>. The estimated regression line is <Response> = <b₀> + <b₁> · <Predictor>. What does the value <b₀> represent in this regression equation?"
         All four choices are FULL ENGLISH SENTENCES using the named variables and units — NEVER formulas, NEVER x/y.
         Example correct choice: "The predicted Sales (in $1000s) when Advertising spend is $0."
         Example wrong choice: "y when x = 0."

      b. Interpret b₁ (slope) in context.
         Stem pattern: "... What does the slope <b₁> mean in this scenario?"
         All four choices are FULL ENGLISH SENTENCES using named variables and units.
         Example correct choice: "For each additional $1,000 spent on Advertising, predicted Sales increase by $5,000."
         Example wrong choice: "y increases by 5 for each unit of x."

      c. Find b₀ and b₁ from a scatter plot or a summary table (Σx, Σy, Σxy, Σx², n).
         Stem ends with: "... the estimated regression equation is approximately:"
         All four choices are equations. EITHER named-variable form (e.g. "Sales = 100 + 5 · Advertising") OR x/y form (e.g. "y = 100 + 5x") is acceptable; you may also mix the two across the four choices.

      d. Identify the full regression equation from a graph.
         Stem refers to the named variables and asks which equation matches the fitted line in the scatter plot.
         Choices may use named-variable form, x/y form, or a mix — both are valid here.

      e. Predict the response for a given predictor value, phrased as a business question.
         RIGHT: "Predict the weekly Sales when Advertising spend is $10,000."
         WRONG: "Find y when x = 10."
         All four choices are numeric values WITH UNITS (e.g. "$150,000", "150 thousand dollars").

      f. Direction and strength of the linear relationship from a scatter plot.
         Stem: "Based on the scatter plot of <Predictor> vs <Response>, describe the direction and strength of the linear relationship."
         All four choices are full sentences: "Positive and strong", "Positive and weak", "Negative and moderate", "No linear relationship", etc.

   E. ANSWER CHOICE STYLE — strict per type:
      - Types a, b, f (interpretation): all four choices are FULL ENGLISH SENTENCES with named variables and units. No formulas. No bare x / y / ŷ.
      - Types c, d (equation identification): all four choices are equations. Named-variable form ("Sales = 100 + 5 · Advertising") and x/y form ("y = 100 + 5x") are BOTH acceptable, including mixed.
      - Type e (prediction): all four choices are numeric values with the response variable's units.

   F. FORBIDDEN in 14.1 — these belong in later sections, do NOT generate them here:
      - Residual calculations. The word "residual" must NOT appear anywhere in question text, choices, or explanation.
      - SSE, SSR, SST, MSE, standard error of the estimate (s_e or s).
      - R² / coefficient of determination (that is section 14.3).
      - Hypothesis tests, t-statistics, p-values, or confidence intervals on slope or intercept (those are 14.5).
      - Pure abstract math without a business scenario.
      - Bare "x" / "y" / "ŷ" in interpretation or prediction questions (types a, b, e, f). Equation-identification questions (c, d) may use them.
${mathNotationBase}
${commonRules}`;
}
