export const color = "#e879f9";

export const chapters = [
  { ch:"A", title:"Fundamentals of Algebra", sections:["A.1 Exponents and Radicals","A.2 Polynomials and Factoring","A.3 Rational Expressions","A.4 Solving Equations","A.5 Linear Inequalities in One Variable"] },
  { ch:"1", title:"Functions and Their Graphs", sections:["1.1 Rectangular Coordinates and Graphs of Equations","1.2 Linear Equations and Functions","1.3 Functions and Their Graphs","1.4 Analyzing Graphs of Functions","1.5 Parent Functions","1.6 Transformations of Functions","1.7 Composite and Inverse Functions"] },
  { ch:"2", title:"Polynomial and Rational Functions", sections:["2.1 Quadratic Functions","2.2 Polynomial Functions","2.3 Synthetic Division","2.4 Complex Numbers","2.5 Zeros of Polynomial Functions","2.6 Rational Functions"] },
  { ch:"3", title:"Exponential and Logarithmic Functions", sections:["3.1 Exponential Functions and Their Graphs","3.2 Logarithmic Functions and Their Graphs","3.3 Properties of Logarithms","3.4 Exponential and Logarithmic Equations","3.5 Exponential and Logarithmic Models"] },
  { ch:"4", title:"Trigonometry", sections:["4.1 Radian and Degree Measure","4.2 The Unit Circle","4.3 Right Triangle Trigonometry","4.4 Trigonometric Functions of Any Angle","4.5 Graphs of Sine and Cosine Functions","4.6 Inverse Trigonometric Functions"] },
  { ch:"5", title:"Analytic Trigonometry", sections:["5.1 Using Fundamental Identities","5.2 Verifying Trigonometric Identities","5.3 Solving Trigonometric Equations","5.4 Sum and Difference Formulas","5.5 Multiple-Angle and Product-to-Sum Formulas"] },
];

export const questionTypes = ["normal", "graph", "mix"];

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
  const prev = sectionNum > 2 ? " and all previous sections" : "";
  return compact
    ? `- Section ${sectionNum} versions (S${sectionNum}_A, S${sectionNum}_B, ...): function mutation — assign each question a DIFFERENT function family randomly. Available families: polynomial, exponential (e^x), logarithmic (ln), sin, cos, rational, sqrt. NO two questions in the same section may use the same family. Example for 3 questions: Q1→polynomial, Q2→e^x, Q3→ln. Must differ from Section 1${prev}.`
    : `- Section ${sectionNum} versions (S${sectionNum}_A, S${sectionNum}_B, ...): function mutation — assign each question a DIFFERENT function family. Pick randomly from: polynomial, exponential, logarithmic, sin, cos, rational, sqrt — but NO two questions in the same section may share the same family. For example with 3 questions: Q1 gets polynomial, Q2 gets e^x, Q3 gets ln(x). Must differ from Section 1${prev}.`;
}

export const crossSectionRule =
  `- Across sections, questions must use completely different function families.\n` +
  `- Within each section, EVERY question must come from a DIFFERENT function family — polynomial, exponential, logarithmic, sin, cos, rational, sqrt are all separate families. sin and cos count as the same family.\n` +
  `- Think of it like assigning a unique function family to each question slot: Q1=polynomial, Q2=e^x, Q3=ln, Q4=sin — no repeats.`;

export const crossSectionRuleShort =
  `Across sections: each section must use different functions entirely.`;

export function buildPrompt({ course, totalQ, breakdown, hasGraphQuestions, qType, typeInstruction, commonRules, mathNotationBase }) {
  const precalcGraph = hasGraphQuestions ? `
GRAPH QUESTIONS: Use type "single" for function graphs.
{"type":"single","fn":"...","showAxisNumbers":true,"showGrid":true,"xDomain":[-5,5]}
Text: "Based on the graph above, ..." — never describe graph in text.` : "";

  return `TESTBANK_GENERATE_REQUEST
Course: ${course} (Standard Precalculus curriculum)
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstruction}
${precalcGraph}
You are a college math professor writing Precalculus exam questions. Questions should be clear, rigorous, appropriate for students transitioning from algebra to calculus.
${mathNotationBase}
${commonRules}`;
}

export { buildPrompt as buildGeneratePromptRules };
