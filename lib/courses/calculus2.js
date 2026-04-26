export const courseCode = "MAT 117";
export const color = "#8b5cf6";

export const chapters = [
  { ch:"3", title:"Differentiation Rules (cont.)", sections:["3.9 Related Rates","3.10 Linear Approximations and Differentials","3.11 Hyperbolic Functions"] },
  { ch:"6", title:"Applications of Integration", sections:["6.1 Areas Between Curves","6.2 Volumes","6.3 Volumes by Cylindrical Shells"] },
  { ch:"7", title:"Techniques of Integration", sections:["7.1 Integration by Parts","7.2 Trigonometric Integrals","7.3 Trigonometric Substitution","7.4 Integration of Rational Functions by Partial Fractions","7.8 Improper Integrals"] },
  { ch:"8", title:"Further Applications of Integration", sections:["8.1 Arc Length","8.2 Surface Area of Revolution"] },
  { ch:"11", title:"Sequences, Series, and Power Series", sections:["11.1 Sequences","11.2 Series","11.3 The Integral Test and Estimates of Sums","11.4 The Comparison Tests","11.5 Alternating Series and Absolute Convergence","11.6 The Ratio and Root Tests","11.8 Power Series","11.10 Taylor and Maclaurin Series"] },
];

export { buildPrompt, buildGeneratePromptRules, buildMutationRules, buildSectionRules, crossSectionRule, crossSectionRuleShort, questionTypes } from "./_calcPrompt.js";
