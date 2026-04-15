// ─── Prompt Builders ─────────────────────────────────────────────────────────
// All AI prompt construction functions — isolated per course, no React deps
// Used by TestBankApp.js for generation, mutation, and replace operations

function difficultyPattern(count) {
  const cycle = ["Easy", "Medium", "Hard"];
  return Array.from({length: count}, (_, i) => cycle[i % 3]);
}


const typeInstructions = {
  "Multiple Choice": "Generate Multiple Choice questions with exactly 4 choices (A-D). One correct answer, three plausible distractors. Choices must be distinct — no two may be identical or equivalent. Include 'choices' array and 'answer' matching one choice exactly.",
  "Free Response": "Generate Free Response questions requiring a full worked solution. Include 'explanation' with complete step-by-step solution. Every step on its own line as a pure math equation.",
  "True/False": "Generate True/False questions. Answer must be exactly 'True' or 'False'. Include 'choices': ['True', 'False'].",
  "Fill in the Blank": "Generate Fill in the Blank questions with a single blank. Answer is the exact word, number, or expression that fills the blank.",
  "Formula": "Generate Formula questions with randomizable variables. Include 'variables' array [{name, min, max, precision}] and 'answerFormula' as a math expression using variable names. Question text uses [varname] placeholders.",
  "Branched": "Generate Branched questions with a shared stem and 2-4 parts. Include 'stem' (shared given info) and 'parts' array [{question, answer, explanation}]. All parts share the same stem.",
};

function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig) {
  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const isCalc3 = course === "Calculus 3";
  const isCalc = course === "Calculus 1" || course === "Calculus 2" || isCalc3;
  const isDiscrete = course === "Discrete Mathematics";
  const isPrecalc = course === "Precalculus";

  const useCfg = sectionConfig && Object.keys(sectionConfig).length > 0;

  const totalQ = useCfg
    ? selectedSections.reduce((a,s) => {
        const c = sectionConfig[s] || { Easy:{count:1}, Medium:{count:1}, Hard:{count:1} };
        return a + (c.Easy.count||0) + (c.Medium.count||0) + (c.Hard.count||0);
      }, 0)
    : selectedSections.reduce((a,s)=>a+(sectionCounts[s]||3),0);

  const breakdown = useCfg
    ? selectedSections.map(s => {
        const c = sectionConfig[s] || { Easy:{count:1,graphType:"normal"}, Medium:{count:1,graphType:"normal"}, Hard:{count:1,graphType:"normal"} };
        const types = isQM ? ["normal","table","graph","mix"] : ["normal","graph","mix"];
        const lines = ["Easy","Medium","Hard"]
          .filter(d => (c[d].count||0) > 0)
          .map(d => {
            const count = c[d].count || 0;
            const typeCounts = c[d].typeCounts || {};
            const hasTypeCounts = types.some(t => (typeCounts[t]||0) > 0);
            if (hasTypeCounts) {
              const parts = types
                .filter(t => (typeCounts[t]||0) > 0)
                .map(t => {
                  const n = typeCounts[t];
                  const tableNote = (t==="table"||t==="mix") ? ` [tableRows:${c[d].tableRows||4}, tableCols:${c[d].tableCols||2}]` : "";
                  const mixNote = t==="mix" ? ` [REQUIRED: ${Math.ceil(n*0.4)} chart(s), ${Math.ceil(n*0.3)} table(s), rest text]` : "";
                  return `${n} ${t==="normal"?"text":t}${tableNote}${mixNote}`;
                }).join(", ");
              return `  ${d}: ${count} question(s) [${parts}]`;
            }
            const gt = c[d].graphType || "normal";
            const tableNote = gt === "table" || gt === "mix" ? ` [tableRows: ${c[d].tableRows||4}, tableCols: ${c[d].tableCols||2}]` : "";
            const mixNote = gt === "mix" && count > 0 ? ` [REQUIRED: ${Math.ceil(count*0.4)} chart(s), ${Math.ceil(count*0.3)} table(s), rest text]` : "";
            return `  ${d}: ${count} question(s) [graphType: ${gt}${tableNote}${mixNote}]`;
          });
        return `${s}:\n${lines.join("\n")}`;
      }).join("\n")
    : selectedSections.map(s => {
        const count = sectionCounts[s]||3;
        const pattern = difficultyPattern(count).join(", ");
        return `${s}: ${count} question(s) [difficulties: ${pattern}]`;
      }).join("\n");

  const hasGraphQuestions = useCfg && selectedSections.some(s => {
    const c = sectionConfig[s];
    return c && ["Easy","Medium","Hard"].some(d => {
      const gt = c[d].graphType;
      const tc = c[d].typeCounts || {};
      return gt === "graph" || gt === "mix" || gt === "table" ||
             (tc.graph||0) > 0 || (tc.mix||0) > 0 || (tc.table||0) > 0;
    });
  });

  const needsChoices = qType==="Multiple Choice"||qType==="True/False";
  const shape = qType==="Branched"
    ? `{"type":"Branched","section":"...","difficulty":"...","stem":"...","parts":[{"question":"...","answer":"...","explanation":"..."}]}`
    : qType==="Formula"
    ? `{"type":"Formula","section":"...","difficulty":"...","question":"...","variables":[{"name":"a","min":1,"max":9,"precision":0}],"answerFormula":"...","answer":"...","explanation":"..."}`
    : needsChoices
    ? `{"type":"${qType}","section":"...","difficulty":"...","question":"...","choices":[...],"answer":"...","explanation":"..."}`
    : `{"type":"${qType}","section":"...","difficulty":"...","question":"...","answer":"...","explanation":"..."}`;

  const commonRules = `
Be rigorous, numerically specific, university-level.
Each question must have a 'section' field with the exact section name.
Each question must have a 'difficulty' field.

Reply with ONLY a valid JSON array, no markdown fences, no explanation:
[${shape}, ...]`;

  const mathNotationBase = `
MATH NOTATION RULES:
- Exponents: x^2, s^3, (s-3)^2
- Fractions: ALWAYS (numerator)/(denominator) — e.g. (10)/(s^3)
- Never use square brackets for denominators — always (parentheses)`;

  // ── QM I & QM II ────────────────────────────────────────────────────────────
  if (isQM) {
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
Type instructions: ${typeInstructions[qType]}
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
${mathNotationBase}
${commonRules}`;
  }

  // ── Calculus 1, 2, 3 ────────────────────────────────────────────────────────
  if (isCalc) {
    const calc3Rules = isCalc3 ? `
CALCULUS 3 NOTATION:
- Vectors: MUST use angle brackets <a,b> or <a,b,c> — NEVER parentheses (a,b) for vectors.
- Points use parentheses: (2,2) is a point. <2,2> is a vector. Never confuse them.

14.7 Maximum and Minimum Values — rotate through 5 types:
TYPE 1: Find/classify ALL critical points (2-4 points). Functions: x^3+y^3-3x-3y, x^3-3xy+y^3, x^4-2x^2+y^2.
TYPE 2: Classify a GIVEN critical point (a,b). Choices: local min/max/saddle/inconclusive.
TYPE 3: Interpret fxx, fyy, fxy values. Compute D=fxx*fyy-(fxy)^2.
TYPE 4: Which function has given property at origin?
TYPE 5: How many critical points does f have?
D>0 fxx>0→local min; D>0 fxx<0→local max; D<0→saddle; D=0→inconclusive.
Easy: 1 critical point ok. Medium: 2 required. Hard: 3-4 required.
Distractors: use correct-looking coordinates with wrong classification or sign errors.` : "";

    const calcGraphInstructions = hasGraphQuestions ? `
GRAPH QUESTIONS:
- 1 function → type "single", fn = expression. e.g. {"type":"single","fn":"x^2-3","showAxisNumbers":true,"showGrid":true,"xDomain":[-4,4]}
- 2 functions → type "area", fnTop/fnBottom, shadeFrom/shadeTo at intersections. e.g. {"type":"area","fnTop":"x+2","fnBottom":"x^2","shadeFrom":-1,"shadeTo":2,"showAxisNumbers":true,"showGrid":true,"xDomain":[-3,4]}
- Region/domain → type "domain". e.g. {"type":"domain","boundary":"x^2","shadeAbove":true,"boundaryDashed":true,"boundaryLabel":"y = x²","showAxisNumbers":true,"showGrid":true,"xDomain":[-3,3]}
- Holes: "holes":[[x,y]] open circles, "points":[[x,y]] filled dots.
- NO yDomain (auto-calculated). DO include xDomain.
- Text: "Based on the graph above, ..." — never describe graph in text.
- graphConfig expressions MUST exactly match functions in question text.

CHAPTER 15 INTEGRALS — show 2D region R in xy-plane, never the 3D surface:
15.1 Rectangles: type "area", fnTop=upper y constant, fnBottom=lower y constant, shadeFrom/shadeTo=x bounds.
  Vary bounds widely. Examples: R=[1,4]x[1,3], R=[-1,2]x[1,3], R=[2,5]x[0,3].
  {"type":"area","fnTop":"3","fnBottom":"1","shadeFrom":1,"shadeTo":4,"fnTopLabel":"y=3","fnBottomLabel":"y=1","showAxisNumbers":true,"showGrid":true,"xDomain":[0,5],"yDomain":[0,4]}
15.2 General regions: type "area", fnTop/fnBottom=boundary curves, shadeFrom/shadeTo=intersection x-values.
15.3 Polar: use type "area" for approximate Cartesian equivalent.` : "";

    return `TESTBANK_GENERATE_REQUEST
Course: ${course} (Stewart Early Transcendentals 9th Edition)
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstructions[qType]}
${calcGraphInstructions}
${calc3Rules}
You are a college math professor writing exam questions from Stewart Calculus Early Transcendentals 9th Edition. Questions must be rigorous, formally written, and match Stewart style.
${mathNotationBase}
- L{f(t)} Laplace notation: L{t^2}, L{e^(at)}, L^{-1}{F(s)}
- Fractions: (numerator)/(denominator) — e.g. (10)/(s^3), (1)/((s-3)^2)
- Nested denominator: (1)/((s-a)^2) — double parens
${commonRules}`;
  }

  // ── Discrete Mathematics ─────────────────────────────────────────────────────
  if (isDiscrete) {
    return `TESTBANK_GENERATE_REQUEST
Course: ${course} (Susanna Epp — Discrete Mathematics with Applications)
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstructions[qType]}

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
- 6.x: Sets with explicitly listed elements.
- 9.x: Counting scenarios from book style.
Always use concrete values — never abstract symbols without grounding.
${commonRules}`;
  }

  // ── Precalculus ──────────────────────────────────────────────────────────────
  if (isPrecalc) {
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
Type instructions: ${typeInstructions[qType]}
${precalcGraph}
You are a college math professor writing Precalculus exam questions. Questions should be clear, rigorous, appropriate for students transitioning from algebra to calculus.
${mathNotationBase}
${commonRules}`;
  }

  // ── Custom courses (fallback) ────────────────────────────────────────────────
  return `TESTBANK_GENERATE_REQUEST
Course: ${course}
Type: ${qType}
Total questions: ${totalQ}

Sections, counts, and config:
${breakdown}

IMPORTANT: Follow the exact count and difficulty per section strictly.
Type instructions: ${typeInstructions[qType]}
You are a university professor writing exam questions for ${course}. Be rigorous, numerically specific, university-level.
${mathNotationBase}
${commonRules}`;
}

// Free Response explanation rule — shared across all prompts
const FR_EXPLANATION_RULE = `For Free Response questions: explanation MUST contain the FULL worked solution — every step a student needs for full marks. Write each step on its own line as a pure math equation (no English prose, no "Use", "Thus", "Let", "We get"). Show ALL intermediate steps — formula, substitution, algebra, final answer. Use (numerator)/(denominator) for all fractions.`;

function buildVersionPrompt(selectedQuestions, mutationType, versionLabel) {
  const lines = selectedQuestions.map((q,i) => {
    const mut = mutationType[q.id]||"numbers";
    const orig = q.type==="Branched" ? q.stem : q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- For Branched: mutate the shared stem and regenerate ALL parts consistently.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation}\n- Branched: {type, section, difficulty, stem, parts:[{question,answer,explanation}]}\n- If the original question has hasGraph:true, you MUST include hasGraph:true and an updated graphConfig that matches the new numbers (e.g. updated mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability).\nReply with ONLY valid JSON array, no markdown.`;
}


// Single combined prompt for ALL classroom sections AND versions at once
function buildAllVersionsPrompt(selectedQuestions, mutationType, labels, classSection=1, numClassSections=1, course="") {
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.type==="Branched" ? q.stem : q.question;
    const mut = mutationType[q.id] || "numbers";
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+q.type+"] [mutation: "+mut+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");

  if (numClassSections <= 1) {
    // Single section — respect per-question mutation type
    const hasFunctionMut = selectedQuestions.some(q => mutationType[q.id] === "function");
    const mutRules = selectedQuestions.map((q,i) => {
      const mut = mutationType[q.id] || "numbers";
      return `- Q${i+1}: ${mut === "function"
        ? "function mutation — use a DIFFERENT function type (e.g. if original uses polynomial, use exponential or trigonometric). Same concept difficulty, same steps."
        : "numbers mutation — keep exact same function type, change only coefficients/constants."}`;
    }).join("\n");
    return `TESTBANK_ALL_VERSIONS_REQUEST\nVersions to create: ${versionList}\n\nFor each version, mutate ALL of the following questions:\n${lines}\n\nPER-QUESTION MUTATION RULES:\n${mutRules}\n\nADDITIONAL RULES:\n- ALWAYS regenerate a correct answer key for each mutated version.\n- Keep same question type, section, and difficulty.\n- Each version must be DIFFERENT from all others.\n- Within numbers-mutation questions: versions differ only by coefficients/constants.\n- Within function-mutation questions: versions use different function types from each other.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON object with one key per version label. Each value is a JSON array of mutated questions in the SAME order:\n{\n  "A": [{type, section, difficulty, question, choices, answer, explanation}, ...],\n  "B": [{type, section, difficulty, question, choices, answer, explanation}, ...]\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
  }

  // Multi-section: single prompt, all sections + versions
  const sectionKeys = [];
  for (let s = 1; s <= numClassSections; s++) {
    for (const lbl of labels) {
      sectionKeys.push(`S${s}_${lbl}`);
    }
  }

  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const allFunctionFamilies = ["polynomial (e.g. x^3-2x)", "exponential (e.g. e^(2x))", "logarithmic (e.g. ln(x+1))", "trigonometric-sin (e.g. sin(2x))", "trigonometric-cos (e.g. cos(x^2))", "rational (e.g. 1/(x^2+1))", "square root (e.g. sqrt(x^2+1))"];
  const sectionRules = Array.from({length: numClassSections}, (_,i) => {
    const s = i+1;
    if (s === 1) return `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types as originals.`;
    if (isQM) return `- Section ${s} versions (S${s}_A, S${s}_B, ...): numbers/direction mutation — keep the SAME distribution type (e.g. normal stays normal, uniform stays uniform, exponential stays exponential). You may change μ, σ, uMin, uMax, or the probability direction (e.g. P(X<4) → P(X>3) or P(a<X<b)). Update graphConfig shadeFrom, shadeTo, probability, and mu/sigma/uMin/uMax to match. NEVER change the distribution type.`;
    return `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family. Pick randomly from: polynomial, exponential, logarithmic, sin, cos, rational, sqrt — but NO two questions in the same section may share the same family. For example with 3 questions: Q1 gets polynomial, Q2 gets e^x, Q3 gets ln(x). Must differ from Section 1${s > 2 ? " and all previous sections" : ""}.`;
  }).join("\n");

  const exampleKeys = sectionKeys.map(k => `"${k}": [{...}]`).join(",\n  ");

  return `TESTBANK_ALL_SECTIONS_AND_VERSIONS_REQUEST\nClassroom Sections: ${numClassSections}\nVersions per section: ${versionList}\nTotal keys to generate: ${sectionKeys.join(", ")}\n\nFor each key, mutate ALL of the following questions:\n${lines}\n\nMUTATION RULES BY SECTION:\n${sectionRules}\n\nADDITIONAL RULES:\n- Within each section, versions (A, B, C...) must differ from each other by numbers only.\n${isQM ? "- Across sections: SAME distribution type MUST be kept — only numbers, direction (< vs >) or boundary values may change. NEVER switch distribution types across sections." : "- Across sections, questions must use completely different function families.\n- Within each section, EVERY question must come from a DIFFERENT function family — polynomial, exponential, logarithmic, sin, cos, rational, sqrt are all separate families. sin and cos count as the same family.\n- Think of it like assigning a unique function family to each question slot: Q1=polynomial, Q2=e^x, Q3=ln, Q4=sin — no repeats."}\n- ALWAYS regenerate correct answer keys.\n- Keep same question type, section name, and difficulty throughout.\n- Each version must be a JSON array in the SAME question order.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- If a question has hasGraph:true, include hasGraph:true and update graphConfig (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability) to match the new numbers.\n- ${FR_EXPLANATION_RULE}\n\nReturn a single JSON object with ALL keys:\n{\n  ${exampleKeys}\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
}

// Single combined prompt for ALL classroom sections at once
// Returns one prompt that asks for S1_A, S1_B, S2_A, S2_B etc.
function buildAllSectionsPrompt(selectedQuestions, labels, numClassSections, course="") {
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.type==="Branched" ? q.stem : q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+q.type+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");

  // Build version keys: S1_A, S1_B, S2_A, S2_B etc.
  const allKeys = [];
  for(let s=1; s<=numClassSections; s++) {
    labels.forEach(v => allKeys.push(`S${s}_${v}`));
  }

  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const sectionRules = Array.from({length:numClassSections},(_,i)=>i+1).map(s => {
    if (s === 1) return `- Section 1 versions (S${s}_A, S${s}_B, ...): numbers mutation — change only coefficients/constants, keep same function types.`;
    if (isQM) return `- Section ${s} versions (S${s}_A, S${s}_B, ...): keep the SAME distribution type. Change μ, σ, uMin, uMax, or probability direction (< vs >). Update graphConfig to match. NEVER change distribution type.`;
    return `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family randomly. Available families: polynomial, exponential (e^x), logarithmic (ln), sin, cos, rational, sqrt. NO two questions in the same section may use the same family. Example for 3 questions: Q1→polynomial, Q2→e^x, Q3→ln. Must differ from Section 1${s>2?" and all previous sections":""}.`;
  }).join("\n");

  const exampleKeys = allKeys.slice(0,4).map(k => `  "${k}": [{type, section, difficulty, question, choices, answer, explanation}, ...]`).join(",\n");

  return `TESTBANK_ALL_SECTIONS_REQUEST
Classroom sections: ${numClassSections}
Versions per section: ${versionList}
All version keys to generate: ${allKeys.join(", ")}

For each version key, mutate ALL of the following questions:
${lines}

MUTATION RULES BY SECTION:
${sectionRules}
- Within each section: each version (A, B, C...) must differ from other versions by numbers only.
- ${isQM ? "Across sections: SAME distribution type MUST be kept. Only numbers (μ, σ, uMin, uMax) or probability direction (< vs >) may change. NEVER switch distribution types." : "Across sections: each section must use different functions entirely."}
- ALWAYS regenerate a correct answer key for each mutated version.
- Keep same question type, section name, and difficulty.
- EXPONENTIAL DISTRIBUTION: always use μ (mu) — NEVER λ (lambda).
- If a question has hasGraph:true, include hasGraph:true and update graphConfig (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability) to match the new numbers.
- ${FR_EXPLANATION_RULE}

Return a JSON object with one key per version label (${allKeys.join(", ")}):
{
${exampleKeys},
  ...
}
Reply with ONLY valid JSON object, no markdown, no explanation.`;
}

function buildReplacePrompt(q, mutationType="numbers") {
  const mutationRule = mutationType === "function"
    ? "Use a DIFFERENT function type (e.g. if original uses polynomial, use exponential or trigonometric). Same concept area, same difficulty, same steps count."
    : "Keep the same function type, change only the numbers/coefficients.";
  const MC_VERIFY = q.type === "Multiple Choice"
    ? `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch.\n- Confirm the answer field exactly matches one of the 4 choices (same value, same notation).\n- Confirm all 4 choices are distinct — no two may be equal or mathematically equivalent.\n- If any check fails, fix the question before returning.`
    : `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch and confirm your answer field is correct.\n- If it is wrong, fix it before returning.`;
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.type==="Branched" ? q.stem : q.question}\nMutation: ${mutationType} — ${mutationRule}\nRequirements: same section, same question type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Branched"?"Include stem and parts array.":""}\n${q.type==="Free Response"?FR_EXPLANATION_RULE:""}${MC_VERIFY}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}

function buildConvertPrompt(q, targetFormat) {
  const isQM = q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II";
  const formatRules = {
    "text": "Convert to a pure text/calculation question. Remove any graph or table. Keep the same concept, numbers, and answer.",
    "table": `Convert to a table-based question. Present the data in a pipe table like:
| X | Value |
|---|-------|
| 1 | ...   |
Keep the same concept and answer. Remove any graphConfig.`,
    "graph": isQM
      ? `Convert to a graph question. Add hasGraph:true and appropriate graphConfig based on the concept:
- For distributions: use continuous_dist with correct distType, mu, sigma, shadeFrom/shadeTo, probability
- For frequency data: use bar or histogram
- For correlation: use scatter
- Keep same question concept and answer. Question text should say "Based on the distribution/chart above, ..."`
      : `Convert to a graph question. Add hasGraph:true and graphConfig with type based on functions in the question:
- 1 function → type:"single", fn:"..."
- 2 functions → type:"area", fnTop:"...", fnBottom:"...", shadeFrom:x0, shadeTo:x1
Keep same concept and answer. Question text should say "Based on the graph above, ..."`,
  };
  return `TESTBANK_CONVERT_REQUEST
Convert this question to a different format.
Section: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty} | Course: ${q.course}
Original question: ${q.type === "Branched" ? q.stem : q.question}
Current format: ${q.hasGraph ? "graph" : "text/table"}
Target format: ${targetFormat}
Rule: ${formatRules[targetFormat]}
Keep: same section, same type (${q.type}), same difficulty, same answer.
Reply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}


export {
  typeInstructions,
  FR_EXPLANATION_RULE,
  buildGeneratePrompt,
  buildVersionPrompt,
  buildAllVersionsPrompt,
  buildAllSectionsPrompt,
  buildReplacePrompt,
  buildConvertPrompt,
  difficultyPattern,
};
