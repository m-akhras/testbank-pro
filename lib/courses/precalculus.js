export const color = "#e879f9";

export const chapters = [
  { ch:"A", title:"Fundamentals of Algebra", sections:["A.1 Exponents and Radicals","A.2 Polynomials and Factoring","A.3 Rational Expressions","A.4 Solving Equations","A.5 Linear Inequalities in One Variable"] },
  { ch:"1", title:"Functions and Their Graphs", sections:["1.1 Rectangular Coordinates and Graphs of Equations","1.2 Linear Equations and Functions","1.3 Functions and Their Graphs","1.4 Analyzing Graphs of Functions","1.5 Parent Functions","1.6 Transformations of Functions","1.7 Composite and Inverse Functions"] },
  { ch:"2", title:"Polynomial and Rational Functions", sections:["2.1 Quadratic Functions","2.2 Polynomial Functions","2.3 Synthetic Division","2.4 Complex Numbers","2.5 Zeros of Polynomial Functions","2.6 Rational Functions"] },
  { ch:"3", title:"Exponential and Logarithmic Functions", sections:["3.1 Exponential Functions and Their Graphs","3.2 Logarithmic Functions and Their Graphs","3.3 Properties of Logarithms","3.4 Exponential and Logarithmic Equations","3.5 Exponential and Logarithmic Models"] },
  { ch:"4", title:"Trigonometry", sections:["4.1 Radian and Degree Measure","4.2 The Unit Circle","4.3 Right Triangle Trigonometry","4.4 Trigonometric Functions of Any Angle","4.5 Graphs of Sine and Cosine Functions","4.6 Inverse Trigonometric Functions"] },
  { ch:"5", title:"Analytic Trigonometry", sections:["5.1 Using Fundamental Identities","5.2 Verifying Trigonometric Identities","5.3 Solving Trigonometric Equations","5.4 Sum and Difference Formulas","5.5 Multiple-Angle and Product-to-Sum Formulas"] },
];

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
