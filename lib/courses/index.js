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
  "Free Response":    "Generate Free Response questions requiring a full worked solution. Include 'explanation' with complete step-by-step solution. Every step on its own line as a PURE MATH EQUATION — no English words like 'Therefore', 'Thus', 'We get', 'Substituting', 'So', 'Hence', 'Let'. Show ALL intermediate steps: formula, substitution, algebra, final answer. Use (numerator)/(denominator) for all fractions.",
  "True/False":       "Generate True/False questions. Answer must be exactly 'True' or 'False'. Include 'choices': ['True', 'False'].",
  "Fill in the Blank":"Generate Fill in the Blank questions with a single blank. Answer is the exact word, number, or expression that fills the blank.",
  "Formula":          "Generate Formula questions with randomizable variables. Include 'variables' array [{name, min, max, precision}] and 'answerFormula' as a math expression using variable names. Question text uses [varname] placeholders.",
  "Branched Free Response": `Generate a multi-part free-response question. The question text should contain a stem (the shared given information) followed by 2-5 parts labeled (a), (b), (c)... Each part is a separate sub-question building on the stem. Format the question field exactly like this:

[Stem text describing the given scenario or setup.]

(a) [First sub-question text]

(b) [Second sub-question text]

(c) [Third sub-question text]

The answer field MUST use the same (a), (b), (c)... labels with each part's answer. The explanation field MUST use the same labels with full worked solutions per part.

Each part is independent — students get blank workspace under each part to write their work. If a part starts with the word "Sketch", "Draw", "Graph", or "Plot", students will be given a blank coordinate grid instead of blank lines. For sketch parts, you may optionally include a graphConfig at the question level for the answer key (only for 2D-renderable sketches). DO NOT include "stem" or "parts" fields — use only the standard fields: question, answer, explanation.

For each part's explanation: every step on its own line as a PURE MATH EQUATION. NO English words like 'Therefore', 'Thus', 'We get', 'Substituting', 'So', 'Hence', 'Let'. Show ALL intermediate steps: formula, substitution, algebra, final answer. Keep the answer key terse — pure math, no narrative.`,
  "Branched MCQ": `Generate Branched MCQ questions: a shared stem followed by 2-4 multiple-choice parts. Include 'stem' (shared given info, may include hasGraph:true and graphConfig) and 'parts' array. Each part must have: { question, choices (array of 4 strings), answer (must match one choice exactly), explanation }. Do NOT include a 'mark' or 'marks' field — marks are filled in manually after generation. All parts share the same stem and (if present) the same graphConfig. Distractors must follow the same MCQ DISTRACTOR RULES as standalone MCQ — all four choices answer the same question, never mix in answers to other properties.

Output shape (top-level fields on the question object):
{
  "type": "Branched MCQ",
  "section": "...", "difficulty": "...",
  "stem": "Shared given information for all parts.",
  "hasGraph": true,
  "graphConfig": { ... },
  "parts": [
    { "question": "Part (a) question text", "choices": ["A choice", "B choice", "C choice", "D choice"], "answer": "B choice", "explanation": "..." },
    { "question": "Part (b) question text", "choices": ["...", "...", "...", "..."], "answer": "...", "explanation": "..." }
  ]
}

Do NOT put the part text inside 'question' (the top-level 'question' field is unused for Branched MCQ — the stem lives in 'stem' and each part has its own 'question'). NEVER include "marks" or "mark" anywhere in the output.`,
};
