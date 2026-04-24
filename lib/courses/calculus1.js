export const color = "#10b981";

export const chapters = [
  { ch:"1", title:"Functions and Models", sections:["1.1 Four Ways to Represent a Function","1.2 Mathematical Models: A Catalog of Essential Functions","1.3 New Functions from Old Functions","1.4 Exponential Functions","1.5 Inverse Functions and Logarithms"] },
  { ch:"2", title:"Limits and Derivatives", sections:["2.2 The Limit of a Function","2.3 Calculating Limits Using the Limit Laws","2.5 Continuity","2.6 Limits at Infinity; Horizontal Asymptotes","2.8 The Derivative as a Function"] },
  { ch:"3", title:"Differentiation Rules", sections:["3.1 Derivatives of Polynomials and Exponential Functions","3.2 The Product and Quotient Rules","3.3 Derivatives of Trigonometric Functions","3.4 The Chain Rule","3.5 Implicit Differentiation","3.6 Derivatives of Logarithmic and Inverse Trigonometric Functions"] },
  { ch:"4", title:"Applications of Differentiation", sections:["4.1 Maximum and Minimum Values","4.2 The Mean Value Theorem","4.3 What Derivatives Tell Us about the Shape of a Graph","4.4 Indeterminate Forms and l'Hopital's Rule","4.9 Antiderivatives"] },
  { ch:"5", title:"Integrals", sections:["5.2 The Definite Integral","5.3 The Fundamental Theorem of Calculus","5.4 Indefinite Integrals and the Net Change Theorem","5.5 The Substitution Rule"] },
];

export { buildPrompt, buildGeneratePromptRules, buildMutationRules, buildSectionRules, crossSectionRule, crossSectionRuleShort, questionTypes } from "./_calcPrompt.js";
