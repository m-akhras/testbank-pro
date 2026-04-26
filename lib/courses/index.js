import * as calc1   from "./calculus1.js";
import * as calc2   from "./calculus2.js";
import * as calc3   from "./calculus3.js";
import * as qm1     from "./quantitativeMethodsI.js";
import * as qm2     from "./quantitativeMethodsII.js";
import * as precalc from "./precalculus.js";
import * as discrete from "./discreteMathematics.js";

const courseModules = {
  "Calculus 1":             calc1,
  "Calculus 2":             calc2,
  "Calculus 3":             calc3,
  "Quantitative Methods I": qm1,
  "Quantitative Methods II":qm2,
  "Precalculus":            precalc,
  "Discrete Mathematics":   discrete,
};

// Reconstructed COURSES object — shape matches original { color, chapters } per key
export const COURSES = Object.fromEntries(
  Object.entries(courseModules).map(([name, mod]) => [
    name,
    { color: mod.color, chapters: mod.chapters, courseCode: mod.courseCode || "" },
  ])
);

// Returns the full course module (color, chapters, buildPrompt) or null for custom courses
export function getCourse(name) {
  return courseModules[name] || null;
}

export const typeInstructions = {
  "Multiple Choice":  "Generate Multiple Choice questions with exactly 4 choices (A-D). One correct answer, three plausible distractors. Choices must be distinct — no two may be identical or equivalent. Include 'choices' array and 'answer' matching one choice exactly.",
  "Free Response":    "Generate Free Response questions requiring a full worked solution. Include 'explanation' with complete step-by-step solution. Every step on its own line as a pure math equation.",
  "True/False":       "Generate True/False questions. Answer must be exactly 'True' or 'False'. Include 'choices': ['True', 'False'].",
  "Fill in the Blank":"Generate Fill in the Blank questions with a single blank. Answer is the exact word, number, or expression that fills the blank.",
  "Formula":          "Generate Formula questions with randomizable variables. Include 'variables' array [{name, min, max, precision}] and 'answerFormula' as a math expression using variable names. Question text uses [varname] placeholders.",
  "Branched":         "Generate Branched questions with a shared stem and 2-4 parts. Include 'stem' (shared given info) and 'parts' array [{question, answer, explanation}]. All parts share the same stem.",
};
