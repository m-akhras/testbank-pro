export const courseCode = "MAT 200";
export const color ="#a855f7";

export const chapters = [
  { ch:"1", title:"Speaking Mathematically", sections:["1.1 Variables","1.2 The Language of Sets","1.3 The Language of Relations and Functions","1.4 The Language of Graphs"] },
  { ch:"2", title:"The Logic of Compound Statements", sections:["2.1 Logical Form and Logical Equivalence","2.2 Conditional Statements","2.3 Valid and Invalid Arguments","2.4 Application: Digital Logic Circuits","2.5 Application: Number Systems and Circuits for Addition"] },
  { ch:"3", title:"The Logic of Quantified Statements", sections:["3.1 Predicates and Quantified Statements I","3.2 Predicates and Quantified Statements II","3.3 Statements with Multiple Quantifiers","3.4 Arguments with Quantified Statements"] },
  { ch:"4", title:"Elementary Number Theory and Methods of Proof", sections:["4.1 Direct Proof and Counterexample I: Introduction","4.2 Direct Proof and Counterexample II: Writing Advice","4.3 Direct Proof and Counterexample III: Rational Numbers","4.4 Direct Proof and Counterexample IV: Divisibility","4.5 Direct Proof and Counterexample V: Division into Cases","4.6 Direct Proof and Counterexample VI: Floor and Ceiling","4.7 Indirect Argument: Contradiction and Contraposition","4.8 Indirect Argument: Two Classical Theorems","4.9 Application: Algorithms","4.10 Application: Handshaking"] },
  { ch:"5", title:"Sequences, Mathematical Induction, and Recursion", sections:["5.1 Sequences","5.2 Mathematical Induction I: Proving Formulas","5.3 Mathematical Induction II: Applications","5.4 Strong Mathematical Induction and the Well-Ordering Principle","5.5 Application: Correctness of Algorithms","5.6 Defining Sequences Recursively","5.7 Solving Recurrence Relations by Iteration","5.8 Second-Order Linear Homogeneous Recurrence Relations","5.9 General Recursive Definitions and Structural Induction"] },
  { ch:"6", title:"Set Theory", sections:["6.1 Set Theory: Definitions and the Element Method of Proof","6.2 Properties of Sets","6.3 Disproofs and Algebraic Proofs","6.4 Boolean Algebras, Russell's Paradox, and the Halting Problem"] },
  { ch:"7", title:"Properties of Functions", sections:["7.1 Functions Defined on General Sets","7.2 One-to-One, Onto, and Inverse Functions","7.3 Composition of Functions","7.4 Cardinality with Applications to Computability"] },
  { ch:"8", title:"Properties of Relations", sections:["8.1 Relations on Sets","8.2 Reflexivity, Symmetry, and Transitivity","8.3 Equivalence Relations","8.4 Modular Arithmetic with Applications to Cryptography","8.5 Partial Order Relations"] },
  { ch:"9", title:"Counting and Probability", sections:["9.1 Introduction to Probability","9.2 Possibility Trees and the Multiplication Rule","9.3 Counting Elements of Disjoint Sets: The Addition Rule","9.4 The Pigeonhole Principle","9.5 Counting Subsets of a Set: Combinations","9.6 r-Combinations with Repetition Allowed","9.7 Pascal's Formula and the Binomial Theorem","9.8 Probability Axioms and Expected Value","9.9 Conditional Probability, Bayes' Formula, and Independent Events"] },
  { ch:"10", title:"Theory of Graphs and Trees", sections:["10.1 Trails, Paths, and Circuits","10.2 Matrix Representations of Graphs","10.3 Isomorphisms of Graphs","10.4 Trees: Examples and Basic Properties","10.5 Rooted Trees","10.6 Spanning Trees and a Shortest Path Algorithm"] },
  { ch:"11", title:"Analysis of Algorithm Efficiency", sections:["11.1 Real-Valued Functions of a Real Variable and Their Graphs","11.2 O-, Omega-, and Theta-Notations","11.3 Application: Analysis of Algorithm Efficiency I","11.4 Exponential and Logarithmic Functions: Graphs and Orders","11.5 Application: Analysis of Algorithm Efficiency II"] },
  { ch:"12", title:"Regular Expressions and Finite-State Automata", sections:["12.1 Formal Languages and Regular Expressions","12.2 Finite-State Automata","12.3 Simplifying Finite-State Automata"] },
];

export const questionTypes = ["normal"];

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

export function buildPrompt({ course, totalQ, breakdown, qType, typeInstruction, commonRules }) {
  return `TESTBANK_GENERATE_REQUEST
Course: ${course} (Susanna Epp — Discrete Mathematics with Applications)
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstruction}

You are a college professor writing exam questions based on Susanna Epp's Discrete Mathematics with Applications. Follow the book's exact question style — change values but not structure.

LOGICAL NOTATION (always use symbols, never spell out):
~p (NOT), p ∧ q (AND), p ∨ q (OR), p → q (conditional), p ↔ q (biconditional)

TRUTH TABLE RULES (Ch.2):
- Show ALL input columns (p,q,r) — never hide inputs.
- Fill most output values, replace EXACTLY ONE with "?" for student to find.
- Use True/False (not 0/1, not T/F).
- NEVER show complete table — gives away answer.

SECTION RULES:
- 2.1: Partial truth tables, hide one cell per expression.
- 2.2: → notation; converse, inverse, contrapositive.
- 2.3: Premises/conclusion with ∧ ∨ ~ → notation; valid/invalid.
- 3.x: Specific domains and predicates with concrete values.
- 4.x: Specific integer/rational claims; proof type or step verification.
- 5.x: Specific n values; base case or inductive step.
- 6.1, 6.2, 6.3: When the question involves set operations (union, intersection, complement, difference), set hasGraph:true and emit graphConfig with this shape:
  { "type": "venn", "sets": [{"label":"A","color":"#3b82f6"},{"label":"B","color":"#ef4444"}], "shaded": ["AandB"], "elementsA": ["1","3"], "elementsB": ["4","5"], "elementsAB": ["2"], "universeLabel": "U" }
  - "shaded" can contain: "A", "B", "AandB", "AorB", "AnotB", "BnotA"
  - "elementsA" / "elementsB" / "elementsAB" are optional string arrays of element labels to display inside each region.
- 6.x (Set Theory): Use sets with EXPLICITLY LISTED ELEMENTS — never abstract symbols.
  ELEMENT COUNTS BY DIFFICULTY:
    * Easy: U has 6-8 elements; each set A, B has 3-4 elements with some overlap. Single-step operations only (A∪B, A∩B, A', cardinality, subset check).
    * Medium: U has 10-14 elements; sets A, B (and optionally C) have 4-6 elements each. Two-step operations like (A∪B)∩C, A-(B∪C), |A∪B∪C|, De Morgan checks.
    * Hard: U has 14-20 elements; sets A, B, C have 6-8 elements each. Multi-step expressions, set-builder predicates over concrete domains, nested complements.
  BRANCHED QUESTIONS (when qType is "Branched"):
    * Easy: 2 parts.
    * Medium: 3-4 parts (e.g. compute A∪B, then A∩C, then (A∪B)-C, then |that|).
    * Hard: 4 parts.
  VENN DIAGRAM: when visualization helps (typical for 6.1, 6.2), include hasGraph:true and graphConfig with the venn schema already documented above. Element counts in the Venn must match the difficulty tier — never use the schema's example numbers.
- 7.1, 7.2, 7.3, 7.4: When the question references a mapping or function diagram between sets, set hasGraph:true and emit graphConfig with this exact shape:
  { "type": "mapping", "domain": ["a","b","c"], "codomain": ["1","2","3"], "arrows": [[0,1],[1,2],[2,0]], "domainLabel": "A", "codomainLabel": "B" }
  - "domain" / "codomain" are arrays of string labels for the elements in each set.
  - "arrows" is an array of [domainIndex, codomainIndex] pairs (zero-indexed) describing the function/mapping.
  - "domainLabel" and "codomainLabel" are optional set names shown above each oval.
- 7.1, 7.2, 7.3, 7.4 (Functions): When the question is about a function/mapping between two sets, set hasGraph:true and use the mapping graphConfig schema documented above.
  ELEMENT COUNTS BY DIFFICULTY:
    * Easy: domain 3-4 elements, codomain 3-4 elements. Single-question style: "Is f one-to-one?", "What is f(b)?", "Is f onto?".
    * Medium: domain 4-5 elements, codomain 4-6 elements. Questions involve composition, inverse existence, or combined injective+surjective analysis.
    * Hard: domain 5-7 elements, codomain 5-8 elements; OR composition of TWO mappings (describe both in the stem text). Multi-step reasoning required.
  BRANCHED QUESTIONS (when qType is "Branched"):
    * Easy: 2 parts.
    * Medium: 3-4 parts (e.g. injective check, surjective check, find f(x) for given x, evaluate f(g(y))).
    * Hard: 4 parts (injective check, surjective check, inverse existence + value if exists, composition evaluation).
- 8.1, 8.2, 8.3, 8.5: When the question references a relation on a set, set hasGraph:true and emit graphConfig with this exact shape:
  { "type": "relation_digraph", "nodes": ["a","b","c"], "edges": [[0,1],[1,2],[0,0]] }
  - "nodes" is an array of string labels for the elements of the set.
  - "edges" is an array of [fromIndex, toIndex] pairs (zero-indexed). Use the same index twice (e.g. [0,0]) to represent a self-loop, which is essential for showing reflexivity.
- 9.x (Counting/Probability): Counting scenarios from book style. When using Venn diagrams for inclusion-exclusion problems, follow the same Ch.6 element-count tiers by difficulty.
Always use concrete values — never abstract symbols without grounding.
${commonRules}`;
}

export { buildPrompt as buildGeneratePromptRules };
