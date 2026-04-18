import { getCourse, typeInstructions } from "../courses/index.js";
import { buildCourseContext } from "./courseContext.js";

// ── Internal helpers ────────────────────────────────────────────────────────

function difficultyPattern(count) {
  const cycle = ["Easy", "Medium", "Hard"];
  return Array.from({length: count}, (_, i) => cycle[i % 3]);
}

// ── Shared constant ─────────────────────────────────────────────────────────

const FR_EXPLANATION_RULE = `For Free Response questions: explanation MUST contain the FULL worked solution — every step a student needs for full marks. Write each step on its own line as a pure math equation (no English prose, no "Use", "Thus", "Let", "We get"). Show ALL intermediate steps — formula, substitution, algebra, final answer. Use (numerator)/(denominator) for all fractions.`;

// ── Prompt builders ─────────────────────────────────────────────────────────

export function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig, courseObject = null) {
  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
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
    const orig = q.type==="Branched" ? q.stem : q.question;
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH: distType=${q.graphConfig.distType||q.graphConfig.type}, mu=${q.graphConfig.mu??"-"}, sigma=${q.graphConfig.sigma??"-"}, uMin=${q.graphConfig.uMin??"-"}, uMax=${q.graphConfig.uMax??"-"}, shadeFrom=${q.graphConfig.shadeFrom??"-"}, shadeTo=${q.graphConfig.shadeTo??"-"}]`
      : "";
    return (i+1)+". ["+q.section+"] ["+mut+" mutation] ["+q.type+"]"+graphNote+" Original: "+orig;
  }).join("\n");
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- For Branched: mutate the shared stem and regenerate ALL parts consistently.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation}\n- Branched: {type, section, difficulty, stem, parts:[{question,answer,explanation}]}\n- If the original question has hasGraph:true, you MUST include hasGraph:true and an updated graphConfig that matches the new numbers (e.g. updated mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability).\nReply with ONLY valid JSON array, no markdown.`;
}

export function buildAllVersionsPrompt(selectedQuestions, mutationType, labels, classSection=1, numClassSections=1, course="", versionMutationType={}, courseObject=null) {
  const courseContext = buildCourseContext(courseObject);
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
    // Single section — per-version mutation type
    const mutRules = labels.map(lbl => {
      const mut = (versionMutationType && versionMutationType[lbl]) || "numbers";
      return `- Version ${lbl}: ${mut === "function"
        ? "function mutation — use a different function type entirely (e.g. if original uses polynomial, use exponential or trigonometric). Same concept difficulty, same steps."
        : "numbers mutation — keep same function types, change only coefficients/constants."}`;
    }).join("\n");
    const singlePrompt = `TESTBANK_ALL_VERSIONS_REQUEST\nVersions to create: ${versionList}\n\nFor each version, mutate ALL of the following questions:\n${lines}\n\nPER-VERSION MUTATION RULES:\n${mutRules}\n\nADDITIONAL RULES:\n- ALWAYS regenerate a correct answer key for each mutated version.\n- Keep same question type, section, and difficulty.\n- Each version must be DIFFERENT from all others.\n- Within numbers-mutation versions: versions differ only by coefficients/constants.\n- Within function-mutation versions: use different function types from each other.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- NEVER mention the distribution name in the question stem (do not write "exponential distribution", "normal distribution", "uniform distribution", etc.). Instead refer to "the distribution above" or "the distribution shown" or describe it only by its parameters.\n- ${FR_EXPLANATION_RULE}\n\nReturn a JSON object with one key per version label. Each value is a JSON array of mutated questions in the SAME order:\n{\n  "A": [{type, section, difficulty, question, choices, answer, explanation}, ...],\n  "B": [{type, section, difficulty, question, choices, answer, explanation}, ...]\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
    return courseContext ? `${courseContext}\n\n${singlePrompt}` : singlePrompt;
  }

  // Multi-section: single prompt, all sections + versions
  const sectionKeys = [];
  for (let s = 1; s <= numClassSections; s++) {
    for (const lbl of labels) {
      sectionKeys.push(`S${s}_${lbl}`);
    }
  }

  const isQM = course === "Quantitative Methods I" || course === "Quantitative Methods II";
  const sectionRules = Array.from({length: numClassSections}, (_,i) => {
    const s = i+1;
    if (s === 1) return `- Section 1 versions (S1_A, S1_B, ...): numbers mutation — change ONLY coefficients/constants. Keep same function types as originals.`;
    if (isQM) return `- Section ${s} versions (S${s}_A, S${s}_B, ...): numbers/direction mutation — keep the SAME distribution type (e.g. normal stays normal, uniform stays uniform, exponential stays exponential). You may change μ, σ, uMin, uMax, or the probability direction (e.g. P(X<4) → P(X>3) or P(a<X<b)). Update graphConfig shadeFrom, shadeTo, probability, and mu/sigma/uMin/uMax to match. NEVER change the distribution type.`;
    return `- Section ${s} versions (S${s}_A, S${s}_B, ...): function mutation — assign each question a DIFFERENT function family. Pick randomly from: polynomial, exponential, logarithmic, sin, cos, rational, sqrt — but NO two questions in the same section may share the same family. For example with 3 questions: Q1 gets polynomial, Q2 gets e^x, Q3 gets ln(x). Must differ from Section 1${s > 2 ? " and all previous sections" : ""}.`;
  }).join("\n");

  const exampleKeys = sectionKeys.map(k => `"${k}": [{...}]`).join(",\n  ");

  const multiPrompt = `TESTBANK_ALL_SECTIONS_AND_VERSIONS_REQUEST\nClassroom Sections: ${numClassSections}\nVersions per section: ${versionList}\nTotal keys to generate: ${sectionKeys.join(", ")}\n\nFor each key, mutate ALL of the following questions:\n${lines}\n\nMUTATION RULES BY SECTION:\n${sectionRules}\n\nADDITIONAL RULES:\n- Within each section, versions (A, B, C...) must differ from each other by numbers only.\n${isQM ? "- Across sections: SAME distribution type MUST be kept — only numbers, direction (< vs >) or boundary values may change. NEVER switch distribution types across sections." : "- Across sections, questions must use completely different function families.\n- Within each section, EVERY question must come from a DIFFERENT function family — polynomial, exponential, logarithmic, sin, cos, rational, sqrt are all separate families. sin and cos count as the same family.\n- Think of it like assigning a unique function family to each question slot: Q1=polynomial, Q2=e^x, Q3=ln, Q4=sin — no repeats."}\n- ALWAYS regenerate correct answer keys.\n- Keep same question type, section name, and difficulty throughout.\n- Each version must be a JSON array in the SAME question order.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- NEVER mention the distribution name in the question stem (do not write "exponential distribution", "normal distribution", "uniform distribution", etc.). Instead refer to "the distribution above" or "the distribution shown" or describe it only by its parameters.\n- If a question has hasGraph:true, include hasGraph:true and update graphConfig (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability) to match the new numbers.\n- ${FR_EXPLANATION_RULE}\n\nReturn a single JSON object with ALL keys:\n{\n  ${exampleKeys}\n}\nReply with ONLY valid JSON object, no markdown, no explanation.`;
  return courseContext ? `${courseContext}\n\n${multiPrompt}` : multiPrompt;
}

export function buildAllSectionsPrompt(selectedQuestions, labels, numClassSections, course="", versionMutationType={}, courseObject=null) {
  const courseContext = buildCourseContext(courseObject);
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

  const allSectionsPrompt = `TESTBANK_ALL_SECTIONS_REQUEST
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
- NEVER mention the distribution name in the question stem (do not write "exponential distribution", "normal distribution", "uniform distribution", etc.). Instead refer to "the distribution above" or "the distribution shown" or describe it only by its parameters.
- If a question has hasGraph:true, include hasGraph:true and update graphConfig (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability) to match the new numbers.
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
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.type==="Branched" ? q.stem : q.question}\nMutation: ${mutationType} — ${mutationRule}\nRequirements: same section, same question type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Branched"?"Include stem and parts array.":""}\n${q.type==="Free Response"?FR_EXPLANATION_RULE:""}${MC_VERIFY}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
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
Original question: ${q.type === "Branched" ? q.stem : q.question}
Current format: ${q.hasGraph ? "graph" : "text/table"}
Target format: ${targetFormat}
Rule: ${formatRules[targetFormat]}
Keep: same section, same type (${q.type}), same difficulty, same answer.
Reply with ONLY a JSON array containing exactly 1 item, no markdown.`;
}
