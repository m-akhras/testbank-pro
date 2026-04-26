export const courseCode = "MAT 250";
export const color = "#f59e0b";

export const chapters = [
  { ch:"12", title:"Vectors and the Geometry of Space", sections:["12.1 Three-Dimensional Coordinate Systems","12.2 Vectors","12.3 The Dot Product","12.4 The Cross Product","12.5 Equations of Lines and Planes"] },
  { ch:"14", title:"Partial Derivatives", sections:["14.1 Functions of Several Variables","14.2 Limits and Continuity","14.3 Partial Derivatives","14.4 Tangent Planes and Linear Approximations","14.5 The Chain Rule","14.6 Directional Derivatives and the Gradient Vector","14.7 Maximum and Minimum Values"] },
  { ch:"15", title:"Multiple Integrals", sections:["15.1 Double Integrals over Rectangles","15.2 Double Integrals over General Regions","15.3 Double Integrals in Polar Coordinates","15.5 Surface Area","15.6 Triple Integrals"] },
  { ch:"16", title:"Vector Calculus", sections:["16.1 Vector Fields","16.2 Line Integrals"] },
];

export { buildPrompt, buildGeneratePromptRules, buildMutationRules, buildSectionRules, crossSectionRule, crossSectionRuleShort, questionTypes } from "./_calcPrompt.js";
