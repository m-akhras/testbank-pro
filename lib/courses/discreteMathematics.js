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

CRITICAL — SET NOTATION ENFORCEMENT (Ch.6, Ch.7, Ch.9):
Every set operation MUST be written using Unicode symbols. Writing the English word for any of these operations is FORBIDDEN and will cause the question to be rejected:

| Operation | REQUIRED symbol | FORBIDDEN word |
|-----------|-----------------|----------------|
| Union | ∪ | "union" |
| Intersection | ∩ | "intersect", "intersection" |
| Complement | A' | "complement of A" |
| Difference | A - B | "A minus B", "A without B" |
| Subset | ⊆ | "subset", "is contained in" |
| Proper subset | ⊂ | "proper subset" |
| Element of | ∈ | "in", "is in", "belongs to" |
| Not element of | ∉ | "not in" |
| Empty set | ∅ | "empty set", "the empty set", "{}" |
| Cardinality | |A| | "size of A", "number of elements" |
| Power set | P(A) | "power set of A" |

These rules apply inside question text, choices, stems, parts, answers, and explanations.
Examples:
- CORRECT: "Find (A ∪ B) ∩ C"
- WRONG: "Find (A union B) intersect C"
- CORRECT: "If x ∈ A and A ⊆ B, then..."
- WRONG: "If x is in A and A is a subset of B, then..."

Before producing the JSON output, scan every string field and convert any remaining English set-operation words to their Unicode symbols.

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
  BRANCHED MCQ (when qType is "Branched MCQ"):
    * Same parts/difficulty scaling as Branched Free Response: Easy 2, Medium 3-4, Hard 4.
    * Each part is a fully independent MCQ — its own question, 4 choices, exactly one correct answer.
    * All parts must reference the SAME stem (same sets / same Venn).
    * Distractors per part follow the MCQ DISTRACTOR RULES below — same-question distractors only.
    * The 4 parts must use DIFFERENT operations from the §6.x OPERATION COVERAGE list. Do not test the same operation 4 times with different inputs.
    * Do NOT include "mark" or "marks" fields anywhere in the JSON. Marks are added manually after generation.
  VENN DIAGRAM: when visualization helps (typical for 6.1, 6.2), include hasGraph:true and graphConfig with the venn schema already documented above. Element counts in the Venn must match the difficulty tier — never use the schema's example numbers.
- 7.1, 7.2, 7.3, 7.4 (Functions): When the question references a mapping or function diagram between sets, set hasGraph:true and emit graphConfig.

  SINGLE MAPPING (7.1, 7.2, basic 7.3/7.4 questions):
  { "type": "mapping", "domain": ["a","b","c"], "codomain": ["1","2","3"], "arrows": [[0,1],[1,2],[2,0]], "domainLabel": "A", "codomainLabel": "B", "functionLabel": "f" }
  - "domain" / "codomain" are arrays of string labels for the elements in each set.
  - "arrows" is an array of [domainIndex, codomainIndex] pairs (zero-indexed) describing the function/mapping.
  - "domainLabel" and "codomainLabel" are optional set names shown above each oval.
  - "functionLabel" (optional) is the function name (e.g. "f") drawn between the ovals.

  COMPOSITION (§7.3 specifically): when the question requires showing TWO functions f: A → B and g: B → C, use the same schema but add a "second" object describing the second function:
  {
    "type": "mapping",
    "domain": ["a","b","c"], "codomain": ["1","2","3"],
    "arrows": [[0,1],[1,2],[2,0]],
    "domainLabel": "A", "codomainLabel": "B", "functionLabel": "f",
    "second": {
      "domain": ["1","2","3"], "codomain": ["x","y","z"],
      "arrows": [[0,2],[1,0],[2,1]],
      "domainLabel": "B", "codomainLabel": "C", "functionLabel": "g"
    }
  }
  - Use this format whenever the §7.3 question asks about composition like "find (g∘f)(a)" or "evaluate g(f(b))".
  - The codomain of the first mapping must equal the domain of the second (both lists must contain the same elements; element labels must match exactly).
  - "functionLabel" is REQUIRED for composition questions (so students can tell f from g).

  INVERSE FUNCTIONS (§7.2): use single mapping with functionLabel showing the function name (e.g. "f" or "f⁻¹").

  IMPORTANT: if the question text mentions composition (g∘f, f∘g, "first apply f then apply g", etc) you MUST emit a graphConfig with the "second" key — otherwise the diagram is incomplete and the question is rejected.

  ELEMENT COUNTS BY DIFFICULTY:
    * Easy: domain 3-4 elements, codomain 3-4 elements. Single-question style: "Is f one-to-one?", "What is f(b)?", "Is f onto?".
    * Medium: domain 4-5 elements, codomain 4-6 elements. Questions involve composition, inverse existence, or combined injective+surjective analysis.
    * Hard: domain 5-7 elements, codomain 5-8 elements; OR composition of TWO mappings (use the "second" composition schema above). Multi-step reasoning required.
  BRANCHED QUESTIONS (when qType is "Branched"):
    * Easy: 2 parts.
    * Medium: 3-4 parts (e.g. injective check, surjective check, find f(x) for given x, evaluate f(g(y))).
    * Hard: 4 parts (injective check, surjective check, inverse existence + value if exists, composition evaluation).
  BRANCHED MCQ (when qType is "Branched MCQ"):
    * Same parts/difficulty scaling as Branched Free Response: Easy 2, Medium 3-4, Hard 4.
    * Each part is a fully independent MCQ — its own question, 4 choices, exactly one correct answer.
    * All parts must reference the SAME stem (same mapping / same function diagram).
    * Distractors per part follow the MCQ DISTRACTOR RULES below — same-question distractors only.
    * The 4 parts must use DIFFERENT operations from the §7.x OPERATION COVERAGE list. Do not test the same operation 4 times with different inputs.
    * Do NOT include "mark" or "marks" fields anywhere in the JSON. Marks are added manually after generation.

CRITICAL — MCQ DISTRACTOR RULES (Ch.6, Ch.7):
For Multiple Choice questions, all four choices MUST be answers to the SAME question asked in the stem. NEVER mix in answers to different properties.

WRONG (do not do this):
  Q: "Is f one-to-one?"
  A. True   B. False   C. onto = False   D. inverse exists

CORRECT (all four answer the same question):
  Q: "Is f one-to-one?"
  A. Yes
  B. No, because f(a) = f(c)
  C. No, because element 3 in B has no preimage
  D. Yes, but only if |A| = |B|

DISTRACTOR PATTERNS for §7.2 MCQ (use a mix):
  - Confuse 1-1 with onto: "No, because some element of B has no preimage" (this confuses injective with surjective — it's the classic misread)
  - Wrong reasoning with right answer: pick the correct truth value but cite an irrelevant or wrong reason
  - Off-by-one count: claim two outputs collide when they don't, or vice versa
  - Add an extra unjustified condition: "Yes, but only if |A| = |B|"

DISTRACTOR PATTERNS for §7.1 MCQ (well-defined function):
  - Miss that one domain element maps to two codomain elements (the actual definition violation)
  - Miss that one domain element has no arrow at all (also violation)
  - Distractor: claim it's not a function because two domain elements share the same image (NOT a violation — many-to-one is fine)
  - Distractor: claim it's not a function because the codomain has unused elements (NOT a violation — that's just "not onto")

DISTRACTOR PATTERNS for §7.3 MCQ (composition):
  - Apply g first instead of f first (reverse the composition order)
  - Compute f(g(x)) instead of g(f(x))
  - Stop after applying f without applying g
  - Off-by-one in the codomain index

DISTRACTOR PATTERNS for §6.x set theory MCQ:
  - Forget to take complement at the end
  - Use ∪ where ∩ is needed (or vice versa)
  - Include a boundary element that's actually outside the result
  - Off-by-one in cardinality

GENERAL RULE: every distractor must be the result of a SPECIFIC plausible mistake a student could make on the stated question. Never put answers to a different question in the choice list.

FORBIDDEN: "None of these", "None of the above", "All of the above" are NOT allowed as choices. Every MCQ must have exactly one correct answer among A/B/C/D.

- 8.1, 8.2, 8.3, 8.5: When the question references a relation on a set, set hasGraph:true and emit graphConfig with this exact shape:
  { "type": "relation_digraph", "nodes": ["a","b","c"], "edges": [[0,1],[1,2],[0,0]] }
  - "nodes" is an array of string labels for the elements of the set.
  - "edges" is an array of [fromIndex, toIndex] pairs (zero-indexed). Use the same index twice (e.g. [0,0]) to represent a self-loop, which is essential for showing reflexivity.
- 9.x (Counting/Probability): Counting scenarios from book style. When using Venn diagrams for inclusion-exclusion problems, follow the same Ch.6 element-count tiers by difficulty.
Always use concrete values — never abstract symbols without grounding.

§6.x OPERATION COVERAGE (Set Theory):
When generating Ch.6 questions, draw operations from the FULL Susanna Epp Ch.6 toolkit. Do not over-rely on union/intersection. Within any batch of 3+ questions for §6.x (or any 4-part Branched), ensure the parts/questions collectively cover at least 4 different operations from this list:

  1. Union (A ∪ B)
  2. Intersection (A ∩ B)
  3. Set difference (A − B)
  4. Complement (A')
  5. De Morgan: (A ∪ B)' = A' ∩ B' or (A ∩ B)' = A' ∪ B'
  6. Cartesian product (A × B) — list ordered pairs explicitly
  7. Power set P(A) — list all subsets (use only for sets with 2-4 elements, since 2^n grows fast)
  8. Cardinality of power set: |P(A)| = 2^|A|
  9. Symmetric difference (A △ B = (A − B) ∪ (B − A))
  10. Subset check (is A ⊆ B?)
  11. Proper subset check (is A ⊂ B?)
  12. Disjoint check (is A ∩ B = ∅?)
  13. Inclusion-exclusion: |A ∪ B| = |A| + |B| − |A ∩ B|
  14. Set-builder predicate: {x ∈ U | P(x)}
  15. Element method: is x ∈ (some expression)?

For Branched §6.x with 4 parts: use 4 DIFFERENT operations from this list. Do NOT generate "find A∩B / find A∪B / find (A∪B)' / find |A∩B|" — that's effectively one operation tested four times. Instead, mix categories: e.g. (a) compute A − B, (b) verify De Morgan on the same sets, (c) list P(A∩C), (d) check whether B ⊆ A.

§7.x OPERATION COVERAGE (Functions):
When generating Ch.7 questions, draw from the full Susanna Epp Ch.7 toolkit:

  1. Is this a well-defined function? (definition check on a diagram)
  2. Find f(x) for a specific x — direct evaluation
  3. Find f(S) for a subset S of the domain — image of a set
  4. Find f⁻¹(T) for a subset T of the codomain — preimage of a set
  5. Identify the range of f
  6. Is f one-to-one? (with justification or counterexample)
  7. Is f onto? (with justification or counterexample)
  8. Is f a bijection?
  9. Does f have an inverse? If so, give f⁻¹(specific element)
  10. Compute (g∘f)(x) — composition evaluation
  11. Compute (f∘g)(x) — verify order matters
  12. Identity function recognition: is f the identity on A?
  13. Equality of functions: do f and g agree?

For Branched §7.x with 4 parts: use 4 DIFFERENT operations. Do NOT do "is f 1-1 / is f onto / find f(a) / find f⁻¹(b)" every time — that's the laziest possible Ch.7 set. Mix in image of a subset, preimage, range, or composition with the identity.

§7.3 specifically (composition): include ALL of these patterns across questions:
  - Evaluate (g∘f) at a specific element
  - Evaluate (f∘g) at the same element to show order matters
  - Find the range of g∘f (not just one value)
  - Determine whether g∘f is 1-1 / onto, given that f and g individually are
  - Find (g∘f)⁻¹ when both inverses exist

§7.4 specifically (cardinality / one-to-one correspondence): emphasize set equivalence (|A| = |B| via bijection), countability questions, pigeonhole-flavored existence questions.

§2.2 OPERATION COVERAGE (Conditional Statements):
§2.2 covers four transformations of a conditional p → q. Do not over-rely on contrapositive. Across any batch of §2.2 questions, distribute roughly equally:

  1. Converse: q → p
  2. Inverse: ~p → ~q
  3. Contrapositive: ~q → ~p
  4. Negation of a conditional: ~(p → q) ≡ p ∧ ~q
  5. Biconditional: p ↔ q recognition (when do p → q and q → p both hold?)
  6. Logical equivalence verification: which pairs are equivalent? (conditional ≡ contrapositive; converse ≡ inverse)
  7. Vacuously true conditionals (p false → q anything)

Don't ask "what is the contrapositive of X?" three times in a row. Rotate through converse / inverse / contrapositive / negation. Include at least one logical-equivalence question per batch (e.g. "Which of the following is equivalent to p → q?" with choices that include the contrapositive (correct), the converse (wrong, common mistake), the inverse (wrong, common mistake), and ~p → q (wrong)).
${commonRules}`;
}

export { buildPrompt as buildGeneratePromptRules };
