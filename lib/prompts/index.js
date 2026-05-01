import { getCourse, typeInstructions } from "../courses/index.js";
import { buildCourseContext } from "./courseContext.js";

// ── Internal helpers ────────────────────────────────────────────────────────

function difficultyPattern(count) {
  const cycle = ["Easy", "Medium", "Hard"];
  return Array.from({length: count}, (_, i) => cycle[i % 3]);
}

// ── Shared constants ────────────────────────────────────────────────────────

const FR_EXPLANATION_RULE = `For Free Response questions: explanation MUST contain the FULL worked solution — every step a student needs for full marks. Write each step on its own line as a pure math equation (no English prose, no "Use", "Thus", "Let", "We get"). Show ALL intermediate steps — formula, substitution, algebra, final answer. Use (numerator)/(denominator) for all fractions.`;

// New-system graph types — kept in sync with lib/exports/newGraphPng.js.
// Old-system stat-chart and Calc 1/2 D3 configs use `type` instead of
// `graphType` and aren't covered by the new-system mutation rules below.
const NEW_GRAPH_TYPES = ["vectorField", "contour", "region", "parametric", "surface", "path"];

function _isNewSystemGraph(cfg) {
  return !!(cfg && typeof cfg === "object" && NEW_GRAPH_TYPES.includes(cfg.graphType));
}

function _isGraphChoiceObj(c) {
  return !!(c && typeof c === "object" && c.graphConfig);
}

// Render the original choices into the prompt. Graph choices are emitted as
// the literal JSON object the model must mirror in the output, NOT as a
// "[graph: ...]" string — that string was being echoed back verbatim into
// the choices array, which is what caused vector-field MCQs to render as
// raw JSON text in Word export.
function _formatOriginalChoices(choices) {
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const parts = choices.map((c, ci) => {
    const letter = String.fromCharCode(65 + ci);
    if (_isGraphChoiceObj(c)) {
      return `${letter}) {"graphConfig": ${JSON.stringify(c.graphConfig)}}`;
    }
    return `${letter}) ${c}`;
  });
  return ` [ORIGINAL CHOICES: ${parts.join(" | ")}]`;
}

// Build the block of mutation rules that govern new-system graph configs and
// graph-choice MCQs. Returned as the empty string when neither applies, so
// the prompt stays terse for the common case.
function _newSystemGraphRule(selectedQuestions) {
  const hasNewSystemTopLevel = selectedQuestions.some(q => q.hasGraph && _isNewSystemGraph(q.graphConfig));
  const hasGraphChoices = selectedQuestions.some(q =>
    Array.isArray(q.choices) && q.choices.some(_isGraphChoiceObj));
  if (!hasNewSystemTopLevel && !hasGraphChoices) return "";

  const topLevelBlock = hasNewSystemTopLevel ? `
NEW-SYSTEM GRAPH RULE — applies to top-level graphType ∈ {vectorField, contour, region, parametric, surface, path}:
- Preserve the "graphType" field EXACTLY as it appears in the original; never rename or drop it.
- Preserve the structural skeleton:
    • region: same number of boundaries in the same order, same boundary kinds
    • path:   same number of segments in the same order, same segment kinds
    • contour / surface / vectorField / parametric: same set of structural keys
- For "numbers" mutation: change ONLY numeric coefficients/constants and expression numbers. Keep every kind, key, and array length identical to the original.
- For "function" mutation: the underlying expression family may change (e.g. polynomial → trig), but every structural constraint above STILL holds — you may not add or remove a boundary, change a kind, or invent a new graphType.
- Valid boundary kinds for region: ONLY "function", "function_y", "line", "circle". Nothing else.
- Valid segment kinds for path:    ONLY "function", "function_y", "line", "circle", "parametric". Nothing else.
- Never emit "polynomial", "exponential", "curve", or any other word as a kind value — those are families, not kinds.
- Always include "hasGraph": true AND the full updated "graphConfig" in the output for any question whose original had hasGraph:true.` : "";

  const choiceBlock = hasGraphChoices ? `
GRAPH-CHOICE MCQ OUTPUT SHAPE — CRITICAL:
- For any question whose ORIGINAL choices were graph configs (shown above as {"graphConfig": {...}} JSON), the mutated version's "choices" array MUST be exactly 4 (or whatever count the original had) JSON OBJECTS of the same shape — NEVER plain strings.
- Each output choice for a graph-choice MCQ must look like: {"graphConfig": {"graphType": "...", ...}}.
- Do NOT copy the literal text "[graph: ...]" or "{"graphConfig": ...}" you see above into the choices array as a string. Output a real JSON object.
- The "graphType" inside each output choice must match the graphType of the corresponding original choice (and match the question's top-level graphType when present).
- The "answer" field for a graph-choice MCQ MUST be a single uppercase letter — "A", "B", "C", or "D" — referencing a choice index. Never the full graphConfig, never the choice's text.
- All choices in a graph-choice MCQ share the same graphType. You may not mix a graph-choice MCQ with one string choice and three graph choices.` : "";

  return `${topLevelBlock}${choiceBlock}
HARD VALIDITY RULES (apply to every output question, no exceptions):
- "question" MUST be a non-empty string. An empty or missing "question" field is a hard error.
- For MCQ: "choices" must contain the same number of entries as the original. Either ALL entries are strings, or ALL entries are {"graphConfig": {...}} objects — never mixed.
- For MCQ: "answer" must be present and (after stripping any "A) "/"B) " prefix) match exactly one choice value (or be a single letter for graph-choice MCQs).`;
}

// ── Prompt builders ─────────────────────────────────────────────────────────

export function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig, courseObject = null) {
  const courseModule = getCourse(course);
  const courseContext = buildCourseContext(courseObject);

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
        const types = courseModule?.questionTypes || ["normal","graph","mix"];
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
  const graphFields = hasGraphQuestions ? `,"hasGraph":true,"graphConfig":{"type":"...","fn":"...","xDomain":[...]}` : "";
  const shape = qType==="Formula"
    ? `{"type":"Formula","section":"...","difficulty":"...","question":"...","variables":[{"name":"a","min":1,"max":9,"precision":0}],"answerFormula":"...","answer":"...","explanation":"..."${graphFields}}`
    : needsChoices
    ? `{"type":"${qType}","section":"...","difficulty":"...","question":"...","choices":[...],"answer":"...","explanation":"..."${graphFields}}`
    : `{"type":"${qType}","section":"...","difficulty":"...","question":"...","answer":"...","explanation":"..."${graphFields}}`;

  const graphRule = hasGraphQuestions ? `\nFor graph questions you MUST include "hasGraph":true and "graphConfig":{type, fn, xDomain} at the top level of the question object. For non-graph questions omit both fields entirely. Never write "Based on the graph above" without including hasGraph:true.` : "";

  const commonRules = `
Be rigorous, numerically specific, university-level.
Each question must have a 'section' field with the exact section name.
Each question must have a 'difficulty' field.${graphRule}

JSON OUTPUT RULES (CRITICAL — output must parse as valid JSON):
- All string values must be on a SINGLE LINE. Use \\n for any line breaks
  inside a string (rare — mostly avoid line breaks in strings entirely).
- Never include raw tabs or carriage returns inside string values.
- Never wrap output in markdown code fences (no \`\`\`json ... \`\`\`).
- Reply with ONLY the JSON array — no preamble, no postamble, no
  explanation text outside the array.
- All math notation inside strings stays on one line: write "x^2 + y^2",
  not split across lines.
- For 'explanation', 'question', and 'answer': use the mini-syntax above
  (sqrt(x), (a)/(b), x^2, theta, pi, integral from a to b of f dx).
  DO NOT emit raw LaTeX commands like \\dfrac{a}{b}, \\sqrt{x}, \\int_{a}^{b}
  inside these strings — the renderer expects the mini-syntax. The
  explanation field is plain prose with mini-syntax math, not LaTeX.

Reply with ONLY a valid JSON array, no markdown fences, no explanation:
[${shape}, ...]`;

  const mathNotationBase = `
MATH NOTATION RULES:
- Exponents: x^2, s^3, (s-3)^2
- Fractions: ALWAYS (numerator)/(denominator) — e.g. (10)/(s^3)
- Never use square brackets for denominators — always (parentheses)
- NEVER use Unicode math symbols. Write them in words:
  - Square roots: sqrt(x), NOT √x
  - Cube roots: cbrt(x), NOT ∛x
  - Superscripts: x^2, x^3, NOT x² x³
  - Subscripts: x_1, x_n, NOT x₁ xₙ
  - Greek letters: alpha, beta, theta, pi, sigma, NOT α β θ π σ
  - Comparison: <=, >=, !=, NOT ≤ ≥ ≠
  - Multiplication: *, NOT · or ×
  - Infinity: infinity, NOT ∞
- Integrals — write in plain English, exactly as follows:
  - Single integral with bounds: "integral from a to b of f(x) dx"
  - Double integral with bounds: "double integral from a to b of integral from c to d of f(x,y) dx dy"
  - Double integral over a region: "double integral over D of f(x,y) dA" (NOT ∬_D or ∬D)
  - Triple integral over a region: "triple integral over E of f(x,y,z) dV"
  - Contour integral: "contour integral of f dz"`;

  const courseObj = getCourse(course);
  if (courseObj) {
    const basePrompt = courseObj.buildPrompt({ course, totalQ, breakdown, hasGraphQuestions, qType, typeInstruction: typeInstructions[qType], commonRules, mathNotationBase });
    return courseContext ? `${courseContext}\n\n${basePrompt}` : basePrompt;
  }

  // ── Custom courses (fallback) ────────────────────────────────────────────────
  const customPrompt = `TESTBANK_GENERATE_REQUEST
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
  return courseContext ? `${courseContext}\n\n${customPrompt}` : customPrompt;
}

export function buildVersionPrompt(selectedQuestions, mutationType, versionLabel) {
  const lines = selectedQuestions.map((q,i) => {
    const mut = mutationType[q.id]||"numbers";
    const orig = q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH — original graphConfig: ${JSON.stringify(q.graphConfig)}]`
      : "";
    const choicesNote = _formatOriginalChoices(q.choices);
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"]"+graphNote+choicesNote+" Original: "+orig;
  }).join("\n");
  const newGraphRule = _newSystemGraphRule(selectedQuestions);
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- For Multiple Choice: if the original has a "None of these" or "All of the above" option, you MUST preserve it as a choice in the mutated version. Keep the same number of choices as the original.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nGRAPH RULE — CRITICAL (old-system / stat charts):\n- For every question whose ORIGINAL had hasGraph:true, the mutated version MUST also include "hasGraph": true AND a complete "graphConfig" object.\n- Start from the ORIGINAL graphConfig shown above and update EVERY numeric field that is implied by the new question's numbers (e.g. mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability, lambda, xDomain). Keep all structural fields (type, distType, fn, layout flags) identical to the original.\n- For numbers mutation: same distribution / function family, but shadeFrom/shadeTo/uMin/uMax/mu/sigma must reflect the new question's numbers.\n- For function mutation: distType / fn may change; return the new structural fields too.\n${newGraphRule}\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC, hasGraph?, graphConfig?}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation, hasGraph?, graphConfig?}\nReply with ONLY valid JSON array, no markdown.`;
}

export function buildAllVersionsPrompt(selectedQuestions, mutationType, labels, classSection=1, numClassSections=1, course="", versionMutationType={}, courseObject=null) {
  const courseContext = buildCourseContext(courseObject);
  const anyGraph = selectedQuestions.some(q => q.hasGraph && q.graphConfig);
  // Per-question lines no longer carry a "[mutation: X]" annotation — the
  // per-version rules block below is the authority. Mixing the two used to
  // make the model fall back to the per-question hint and ignore the
  // version-level setting (e.g. Version B set to "numbers" came back as
  // function-mutated because some question had its own "function" tag).
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH — original graphConfig: ${JSON.stringify(q.graphConfig)}]`
      : "";
    const choicesNote = _formatOriginalChoices(q.choices);
    return (i+1)+". ["+q.section+"] ["+q.type+"]"+graphNote+choicesNote+" Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");
  const newGraphRule = _newSystemGraphRule(selectedQuestions);

  const graphRule = anyGraph
    ? `\n- GRAPH RULE: For every question whose ORIGINAL had hasGraph:true, every mutated version MUST also include "hasGraph": true AND a complete "graphConfig" object. Start from the ORIGINAL graphConfig (shown inline above as JSON) and update every numeric field that is implied by the new question's numbers (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability, lambda, xDomain). Keep structural fields (type, distType, fn, layout flags) identical for "numbers" mutation; you may change them only for "function" mutation. The graphConfig must accurately reflect the variant's NEW numbers, not the original's.`
    : "";
  const graphShape = anyGraph ? `, hasGraph?, graphConfig?` : "";

  const courseModule = getCourse(course);

  if (numClassSections <= 1) {
    // Single section — per-version mutation type
    const mutRules = labels.map(lbl => {
      const mut = (versionMutationType && versionMutationType[lbl]) || "numbers";
      const ruleText = courseModule?.buildMutationRules(mut)
        ?? (mut === "function"
          ? "function mutation — use a different function type entirely (e.g. if original uses polynomial, use exponential or trigonometric). Same concept difficulty, same steps."
          : "numbers mutation — keep same function types, change only coefficients/constants.");
      return `- Version ${lbl}: ${ruleText}`;
    }).join("\n");
    const singlePrompt = `TESTBANK_ALL_VERSIONS_REQUEST\nVersions to create: ${versionList}\n\nFor each version, mutate ALL of the following questions:\n${lines}\n\nPER-VERSION MUTATION RULES (these are the authority — apply the rule for the version key you are currently emitting):\n${mutRules}\n\nADDITIONAL RULES:\n- ALWAYS regenerate a correct answer key for each mutated version.\n- Keep same question type, section, and difficulty.\n- Each version must be DIFFERENT from all others.\n- Within numbers-mutation versions: versions differ only by coefficients/constants.\n- Within function-mutation versions: use different function types from each other.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- For Multiple Choice: if the original has a "None of these" or "All of the above" option, you MUST preserve it as a choice in the mutated version. Keep the same number of choices as the original.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- MATH NOTATION: Use plain-text math only. Superscripts: A^c, B^c. Intersection: A ∩ B. Union: A ∪ B. Set complement notation must always be written as X^c (letter followed by ^c). Never use LaTeX backslash commands.\n- NEVER mention the distribution name in the question stem (do not write "exponential distribution", "normal distribution", "uniform distribution", etc.). Instead refer to "the distribution above" or "the distribution shown" or describe it only by its parameters.${graphRule}\n${newGraphRule}\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON object with one key per version label. Each value is a JSON array of mutated questions in the SAME order:\n{\n  "A": [{type, section, difficulty, question, choices, answer, explanation${graphShape}}, ...],\n  "B": [{type, section, difficulty, question, choices, answer, explanation${graphShape}}, ...]\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
    return courseContext ? `${courseContext}\n\n${singlePrompt}` : singlePrompt;
  }

  // Multi-section: single prompt, all sections + versions
  const sectionKeys = [];
  for (let s = 1; s <= numClassSections; s++) {
    for (const lbl of labels) {
      sectionKeys.push(`S${s}_${lbl}`);
    }
  }

  const sectionRules = Array.from({length: numClassSections}, (_,i) => {
    const s = i+1;
    return courseModule?.buildSectionRules(s, false)
      ?? (s === 1
        ? `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types as originals.`
        : `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family. Pick randomly from: polynomial, exponential, logarithmic, sin, cos, rational, sqrt — but NO two questions in the same section may share the same family. For example with 3 questions: Q1 gets polynomial, Q2 gets e^x, Q3 gets ln(x). Must differ from Section 1${s > 2 ? " and all previous sections" : ""}.`);
  }).join("\n");

  const exampleKeys = sectionKeys.map(k => `"${k}": [{type, section, difficulty, question, choices, answer, explanation${graphShape}}, ...]`).join(",\n  ");

  const multiPrompt = `TESTBANK_ALL_SECTIONS_AND_VERSIONS_REQUEST\nClassroom Sections: ${numClassSections}\nVersions per section: ${versionList}\nTotal keys to generate: ${sectionKeys.join(", ")}\n\nFor each key, mutate ALL of the following questions:\n${lines}\n\nMUTATION RULES BY SECTION:\n${sectionRules}\n\nADDITIONAL RULES:\n- Within each section, versions (A, B, C...) must differ from each other by numbers only.\n${courseModule?.crossSectionRule ?? "- Across sections, questions must use completely different function families.\n- Within each section, EVERY question must come from a DIFFERENT function family — polynomial, exponential, logarithmic, sin, cos, rational, sqrt are all separate families. sin and cos count as the same family.\n- Think of it like assigning a unique function family to each question slot: Q1=polynomial, Q2=e^x, Q3=ln, Q4=sin — no repeats."}\n- ALWAYS regenerate correct answer keys.\n- Keep same question type, section name, and difficulty throughout.\n- Each version must be a JSON array in the SAME question order.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- For Multiple Choice: if the original has a "None of these" or "All of the above" option, you MUST preserve it as a choice in the mutated version. Keep the same number of choices as the original.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- MATH NOTATION: Use plain-text math only. Superscripts: A^c, B^c. Intersection: A ∩ B. Union: A ∪ B. Set complement notation must always be written as X^c (letter followed by ^c). Never use LaTeX backslash commands.\n- NEVER mention the distribution name in the question stem (do not write "exponential distribution", "normal distribution", "uniform distribution", etc.). Instead refer to "the distribution above" or "the distribution shown" or describe it only by its parameters.${graphRule}\n${newGraphRule}\n- ${FR_EXPLANATION_RULE}\n\nReturn a single JSON object with ALL keys:\n{\n  ${exampleKeys}\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
  return courseContext ? `${courseContext}\n\n${multiPrompt}` : multiPrompt;
}

export function buildAllSectionsPrompt(selectedQuestions, labels, numClassSections, course="", versionMutationType={}, courseObject=null) {
  const courseContext = buildCourseContext(courseObject);
  const anyGraph = selectedQuestions.some(q => q.hasGraph && q.graphConfig);
  const lines = selectedQuestions.map((q,i) => {
    const orig = q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH — original graphConfig: ${JSON.stringify(q.graphConfig)}]`
      : "";
    const choicesNote = _formatOriginalChoices(q.choices);
    return (i+1)+". ["+q.section+"] ["+q.type+"]"+graphNote+choicesNote+" Original: "+orig;
  }).join("\n");
  const versionList = labels.join(", ");
  const graphShape2 = anyGraph ? `, hasGraph?, graphConfig?` : "";
  const newGraphRule2 = _newSystemGraphRule(selectedQuestions);
  const graphRule2 = anyGraph
    ? `\n- GRAPH RULE: For every question whose ORIGINAL had hasGraph:true, every mutated version MUST also include "hasGraph": true AND a complete "graphConfig" object. Start from the ORIGINAL graphConfig (shown inline above as JSON) and update every numeric field that is implied by the new question's numbers (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability, lambda, xDomain). Keep structural fields (type, distType, fn, layout flags) identical for "numbers" mutation; you may change them only for "function" mutation. The graphConfig must accurately reflect the variant's NEW numbers, not the original's.`
    : "";

  // Build version keys: S1_A, S1_B, S2_A, S2_B etc.
  const allKeys = [];
  for(let s=1; s<=numClassSections; s++) {
    labels.forEach(v => allKeys.push(`S${s}_${v}`));
  }

  const courseModule2 = getCourse(course);
  const sectionRules = Array.from({length:numClassSections},(_,i)=>i+1).map(s => {
    return courseModule2?.buildSectionRules(s, true)
      ?? (s === 1
        ? `- Section 1 versions (S${s}_A, S${s}_B, ...): numbers mutation — change only coefficients/constants, keep same function types.`
        : `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family randomly. Available families: polynomial, exponential (e^x), logarithmic (ln), sin, cos, rational, sqrt. NO two questions in the same section may use the same family. Example for 3 questions: Q1→polynomial, Q2→e^x, Q3→ln. Must differ from Section 1${s>2?" and all previous sections":""}.`);
  }).join("\n");

  const exampleKeys = allKeys.slice(0,4).map(k => `  "${k}": [{type, section, difficulty, question, choices, answer, explanation${graphShape2}}, ...]`).join(",\n");

  const allSectionsPrompt = `TESTBANK_ALL_SECTIONS_REQUEST
Classroom sections: ${numClassSections}
Versions per section: ${versionList}
All version keys to generate: ${allKeys.join(", ")}

For each version key, mutate ALL of the following questions:
${lines}

MUTATION RULES BY SECTION:
${sectionRules}
- Within each section: each version (A, B, C...) must differ from other versions by numbers only.
- ${courseModule2?.crossSectionRuleShort ?? "Across sections: each section must use different functions entirely."}
- ALWAYS regenerate a correct answer key for each mutated version.
- Keep same question type, section name, and difficulty.
- EXPONENTIAL DISTRIBUTION: always use μ (mu) — NEVER λ (lambda).
- NEVER mention the distribution name in the question stem (do not write "exponential distribution", "normal distribution", "uniform distribution", etc.). Instead refer to "the distribution above" or "the distribution shown" or describe it only by its parameters.${graphRule2}
${newGraphRule2}
- ${FR_EXPLANATION_RULE}

Return a JSON object with one key per version label (${allKeys.join(", ")}):
{
${exampleKeys},
  ...
}
Reply with ONLY valid JSON object, no markdown, no explanation.`;
  return courseContext ? `${courseContext}\n\n${allSectionsPrompt}` : allSectionsPrompt;
}

export function buildReplacePrompt(q, mutationType="numbers") {
  const mutationRule = mutationType === "function"
    ? "Use a DIFFERENT function type (e.g. if original uses polynomial, use exponential or trigonometric). Same concept area, same difficulty, same steps count."
    : "Keep the same function type, change only the numbers/coefficients.";
  const MC_VERIFY = q.type === "Multiple Choice"
    ? `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch.\n- Confirm the answer field exactly matches one of the 4 choices (same value, same notation).\n- Confirm all 4 choices are distinct — no two may be equal or mathematically equivalent.\n- If any check fails, fix the question before returning.`
    : `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch and confirm your answer field is correct.\n- If it is wrong, fix it before returning.`;
  const graphNote = q.hasGraph && q.graphConfig
    ? `\nORIGINAL graphConfig: ${JSON.stringify(q.graphConfig)}`
    : "";
  const choicesNote = _formatOriginalChoices(q.choices);
  const newGraphRule = _newSystemGraphRule([q]);
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.question}${graphNote}${choicesNote}\nMutation: ${mutationType} — ${mutationRule}\nRequirements: same section, same question type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Free Response"?FR_EXPLANATION_RULE:""}\n${q.type==="Branched Free Response"?"Format the question with a stem followed by parts labeled (a), (b), (c)... Match the same labels in the answer and explanation fields. "+FR_EXPLANATION_RULE:""}${MC_VERIFY}${newGraphRule}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}

export function buildConvertPrompt(q, targetFormat) {
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
Original question: ${q.question}
Current format: ${q.hasGraph ? "graph" : "text/table"}
Target format: ${targetFormat}
Rule: ${formatRules[targetFormat]}
Keep: same section, same type (${q.type}), same difficulty, same answer.
Reply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}
