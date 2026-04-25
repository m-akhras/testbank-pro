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
   { "type": "scatter", "points": [{"x":1,"y":3},{"x":2,"y":5}], "xLabel": "x", "yLabel": "y", "regressionLine": {"slope": 1.8, "intercept": 1.2} }
   - "points" is an array of {x, y} objects taken from the question data.
   - "regressionLine.slope" and "regressionLine.intercept" must match the fitted equation ŷ = intercept + slope·x exactly.
${mathNotationBase}
${commonRules}`;
}
