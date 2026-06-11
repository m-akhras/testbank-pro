import { getCourse, typeInstructions } from "../courses/index.js";
import { buildCourseContext } from "./courseContext.js";
import { findTemplate } from "../templates/registry.js";
import { buildPerQuestionEnrichment } from "../templates/_generic/buildPrompt.js";

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
EXPRESSION FIELD RULES — CRITICAL (applies to every fx, fy, expr, xExpr, yExpr, zExpr, expression in any graphConfig):
- Every expression field must hold a SINGLE parseable math expression. The renderer compiles it as JavaScript-style math: + - * / ^ , parentheses, and the whitelisted functions sin, cos, tan, exp, log, ln, sqrt, abs, atan, asin, acos, sinh, cosh, tanh.
- ALWAYS use "*" for multiplication. Write "2*x", never "2x". (The compiler is lenient about this but the prompt must produce the explicit form so validation never trips.)
- VALID examples: "fx": "-2*x"  ✓  "fx": "y"  ✓  "fy": "sin(x)"  ✓  "expr": "x^2 + y^2"  ✓
- FORBIDDEN — never produce any of these in an expression field:
    "fx": "-2x or y"           ✗ "or" is not math syntax — pick ONE expression
    "fx": "y or x"             ✗ pick ONE — never describe alternatives
    "fx": "either -y or x"     ✗ no English in math fields
    "fx": "x, y"               ✗ no commas — single scalar expression only
    "fx": "<-y, x>"            ✗ no angle brackets — fx is the scalar X-COMPONENT only; the full vector lives across (fx, fy)
    "fx": ""                   ✗ never empty
- For graph-choice MCQs: each of the 4 choices has its own graphConfig with its own concrete fx, fy. The 4 choices represent 4 DIFFERENT vector fields (or contours, regions, etc.) — never put alternatives inside a single expression. Produce 4 separate, distinct fx/fy combinations, one per choice.

QUESTION TEXT IS MANDATORY:
- Every output question MUST have a non-empty "question" field with the full prompt text. This is non-negotiable, even when a graph is attached.
- FORBIDDEN: "question": "", "question": ",", "question": "...", "question": " ".
- CORRECT: "question": "Which graph represents the vector field F(x,y) = <2x, -y>?"

HARD VALIDITY RULES (apply to every output question, no exceptions):
- "question" MUST be a non-empty, non-placeholder string.
- For MCQ: "choices" must contain the same number of entries as the original. Either ALL entries are strings, or ALL entries are {"graphConfig": {...}} objects — never mixed.
- For MCQ: "answer" must be present and (after stripping any "A) "/"B) " prefix) match exactly one choice value (or be a single letter A–D for graph-choice MCQs).

Example correctly mutated vector field MCQ:
{
  "type": "Multiple Choice",
  "question": "Which graph represents the vector field F(x,y) = <2x, -y>?",
  "choices": [
    { "graphConfig": { "graphType": "vectorField", "fx": "-2*x", "fy": "y",  "xRange": [-3,3], "yRange": [-3,3], "gridDensity": 9 } },
    { "graphConfig": { "graphType": "vectorField", "fx": "2*x",  "fy": "-y", "xRange": [-3,3], "yRange": [-3,3], "gridDensity": 9 } },
    { "graphConfig": { "graphType": "vectorField", "fx": "2*x",  "fy": "y",  "xRange": [-3,3], "yRange": [-3,3], "gridDensity": 9 } },
    { "graphConfig": { "graphType": "vectorField", "fx": "-2*x", "fy": "-y", "xRange": [-3,3], "yRange": [-3,3], "gridDensity": 9 } }
  ],
  "answer": "B",
  "explanation": "..."
}`;
}

// ── Shared output-contract pieces ───────────────────────────────────────────
// These are factored out so buildGeneratePrompt and buildExamGeneratorPrompt
// emit a BYTE-IDENTICAL JSON schema + mini-syntax contract. Change them here
// once; both prompt builders stay in lock-step.

// The per-type JSON object shape the model must return. `graphFields` is the
// optional ',"hasGraph":true,"graphConfig":{...}' tail appended for graph qs.
function _questionShape(qType, graphFields = "") {
  const needsChoices = qType === "Multiple Choice" || qType === "True/False";
  if (qType === "Formula") {
    return `{"type":"Formula","section":"...","difficulty":"...","question":"...","variables":[{"name":"a","min":1,"max":9,"precision":0}],"answerFormula":"...","answer":"...","explanation":"..."${graphFields}}`;
  }
  if (needsChoices) {
    return `{"type":"${qType}","section":"...","difficulty":"...","question":"...","choices":[...],"answer":"...","explanation":"..."${graphFields}}`;
  }
  return `{"type":"${qType}","section":"...","difficulty":"...","question":"...","answer":"...","explanation":"..."${graphFields}}`;
}

// The shared rules block — everything from "Be rigorous…" through the JSON
// OUTPUT RULES + mini-syntax clause, WITHOUT the trailing
// "Reply with ONLY a valid JSON array … [shape]" directive (each caller appends
// its own array directive, since the array contents differ).
function _commonRulesBody(graphRule = "") {
  return `
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
  explanation field is plain prose with mini-syntax math, not LaTeX.`;
}

const MATH_NOTATION_BASE = `
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

// ── Prompt builders ─────────────────────────────────────────────────────────

async function _fetchGroundingBlock(supabase, course, selectedSections) {
  if (!supabase || !course || !Array.isArray(selectedSections) || selectedSections.length === 0) return "";
  try {
    const { data, error } = await supabase
      .from("section_contexts")
      .select("section, key_concepts, key_formulas, notation_rules, common_mistakes, question_style, style_rules, answer_choice_rules")
      .eq("course", course)
      .in("section", selectedSections);
    if (error) {
      console.error("section_contexts fetch error:", error);
      return "";
    }
    if (!Array.isArray(data) || data.length === 0) return "";
    const rows = data.map(r => {
      const parts = [
        `### ${r.section}`,
        `**Key concepts:** ${r.key_concepts || ""}`,
        `**Key formulas:** ${r.key_formulas || ""}`,
        `**Notation rules to follow:** ${r.notation_rules || ""}`,
        `**Textbook question style:** ${r.question_style || ""}`,
        `**Common student mistakes (USE THESE AS DISTRACTORS):** ${r.common_mistakes || ""}`,
      ];
      if (r.style_rules && r.style_rules.trim()) {
        parts.push(`**Style rules for generation:** ${r.style_rules}`);
      }
      if (r.answer_choice_rules && r.answer_choice_rules.trim()) {
        parts.push(`**Answer choice formatting rules:** ${r.answer_choice_rules}`);
      }
      parts.push(`---`);
      return parts.join("\n\n");
    }).join("\n\n");
    return `## TEXTBOOK GROUNDING — Use this content to ground your generation in the actual textbook\n\n${rows}`;
  } catch (e) {
    console.error("section_contexts fetch failed:", e);
    return "";
  }
}

export async function buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig, courseObject = null, supabase = null) {
  const courseModule = getCourse(course);
  const courseContext = buildCourseContext(courseObject);
  const groundingBlock = await _fetchGroundingBlock(supabase, course, selectedSections);

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

  const graphFields = hasGraphQuestions ? `,"hasGraph":true,"graphConfig":{"type":"...","fn":"...","xDomain":[...]}` : "";
  const shape = _questionShape(qType, graphFields);

  const graphRule = hasGraphQuestions ? `\nFor graph questions you MUST include "hasGraph":true and "graphConfig":{type, fn, xDomain} at the top level of the question object. For non-graph questions omit both fields entirely. Never write "Based on the graph above" without including hasGraph:true.` : "";

  const commonRules = `${_commonRulesBody(graphRule)}

Reply with ONLY a valid JSON array, no markdown fences, no explanation:
[${shape}, ...]`;

  const mathNotationBase = MATH_NOTATION_BASE;

  const courseObj = getCourse(course);
  if (courseObj) {
    const basePrompt = courseObj.buildPrompt({ course, totalQ, breakdown, hasGraphQuestions, qType, typeInstruction: typeInstructions[qType], commonRules, mathNotationBase });
    const preface = [courseContext, groundingBlock].filter(Boolean).join("\n\n");
    return preface ? `${preface}\n\n${basePrompt}` : basePrompt;
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
  const preface = [courseContext, groundingBlock].filter(Boolean).join("\n\n");
  return preface ? `${preface}\n\n${customPrompt}` : customPrompt;
}

// ── Exam Generator (guided wizard, TIGHT mode) ──────────────────────────────

// Wizard question type → canonical question type used across the tree
// (theme.QTYPES / validateQuestion). Drafts store the wizard value.
export const EXAM_GENERATOR_TYPE_MAP = {
  MCQ: "Multiple Choice",
  "open-ended": "Free Response",
  branched: "Branched Free Response",
};

export function examGeneratorCanonicalType(wizardType) {
  return EXAM_GENERATOR_TYPE_MAP[wizardType] || "Free Response";
}

// Partition drafts MCQ-first (stable within each group). Exported so the screen
// can mirror the exact order the prompt — and therefore the seeded versions[A]
// — will use. handlePaste seeds versions in model-output order, so emitting the
// prompt MCQ-first is what makes the final order MCQ-first.
export function orderDraftsMcqFirst(drafts = []) {
  const mcq = [], rest = [];
  for (const d of drafts) (d.type === "MCQ" ? mcq : rest).push(d);
  return [...mcq, ...rest];
}

/**
 * buildExamGeneratorPrompt — assembles the single-generation prompt for the
 * guided wizard. TIGHT mode: the instructor has already composed each question;
 * the model fills ONLY choices/answer/difficulty/explanation and must not
 * rewrite the wording.
 *
 * Output contract is identical to buildGeneratePrompt (a JSON array, no fences,
 * each element matching the same per-type _questionShape). The body differs:
 * instead of section-count-derived counts, it lists each draft explicitly and
 * IN ORDER (already MCQ-first). Textbook grounding (course context +
 * section_contexts) is preserved via the same helpers buildGeneratePrompt uses.
 *
 * @param {Array<{type,section,wording,details}>} drafts — wizard draft list
 * @param {string} course
 * @param {object|null} courseObject
 * @param {object|null} supabase — optional client for textbook grounding
 */
export async function buildExamGeneratorPrompt(drafts, course, courseObject = null, supabase = null) {
  const ordered = orderDraftsMcqFirst(drafts || []);
  const courseContext = buildCourseContext(courseObject);
  const distinctSections = [...new Set(ordered.map(d => d.section).filter(Boolean))];
  const groundingBlock = await _fetchGroundingBlock(supabase, course, distinctSections);

  // Reference object shape per canonical type present in this batch.
  const typesPresent = [...new Set(ordered.map(d => examGeneratorCanonicalType(d.type)))];
  const shapeRef = typesPresent.map(t => `- ${t}: ${_questionShape(t)}`).join("\n");

  // Explicit, ordered per-question specs (the wizard's content, verbatim).
  const specs = ordered.map((d, i) => {
    const canon = examGeneratorCanonicalType(d.type);
    const details = (d.details || "").trim();
    // When the draft's section has a template AND the instructor filled the
    // template form, append SUPPLEMENTARY style/distractor guidance derived from
    // that template. TIGHT mode is preserved — the enrichment frames itself as
    // hints for the parts the model fills, not as a generation spec.
    const tmpl = d.templateAnswers ? findTemplate(course, d.section) : null;
    const enrichment = tmpl ? buildPerQuestionEnrichment(tmpl, d.templateAnswers) : "";
    return [
      `Question ${i + 1} — type: ${canon}, section: ${d.section}`,
      `  wording: ${d.wording}`,
      `  details: ${details || "(none)"}`,
    ].join("\n") + enrichment;
  }).join("\n\n");

  const body = `TESTBANK_EXAM_GENERATOR_REQUEST
Course: ${course}

You are a university professor preparing exam questions for ${course}. The instructor has already composed the exact questions below. Generate exactly these ${ordered.length} question(s), IN ORDER.

CRITICAL — TIGHT MODE:
- Use each question's provided wording as the question stem essentially VERBATIM. You may fix only grammar, spacing, or math notation; you may NOT rephrase, reframe, change the numbers/functions, or substitute a different question.
- Honor the provided details (base, evaluation point, coefficients, interval, etc.) exactly.
- Fill in ONLY the mechanical parts the instructor left out: for Multiple Choice, write 4 distinct choices and the correct "answer" (the answer must, after stripping any "A) " prefix, match exactly one choice value); for every type, write the worked "explanation". Assign an appropriate "difficulty" (Easy | Medium | Hard) and return it.
- Each output object's "section" MUST equal the section given for that question, and "type" MUST equal the type given. Do not add, drop, reorder, or merge questions.

Questions to generate (in this exact order):

${specs}

Output object shape by type:
${shapeRef}
${MATH_NOTATION_BASE}
${_commonRulesBody("")}

Reply with ONLY a valid JSON array of exactly ${ordered.length} object(s), in the same order as the questions listed above, no markdown fences, no explanation.`;

  const preface = [courseContext, groundingBlock].filter(Boolean).join("\n\n");
  return preface ? `${preface}\n\n${body}` : body;
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
  return `TESTBANK_VERSION_REQUEST\nVersion: ${versionLabel}\n\nMutate the following questions to create Version ${versionLabel}:\n${lines}\n\nMUTATION RULES:\n- numbers mutation: keep exact same function type and concept, only change coefficients/constants. Same difficulty, same steps.\n- function mutation: change to different but equivalent-difficulty function of same concept. Same difficulty, same steps.\n- ALWAYS regenerate the correct answer key for the mutated version.\n- Keep same question type, section, and difficulty.\n- For Multiple Choice: all 4 choices must be distinct values — no two choices may be identical or equivalent.\n- For Multiple Choice: if the original has a "None of these" or "All of the above" option, you MUST preserve it as a choice in the mutated version. Keep the same number of choices as the original.\n- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda). Write "μ = 4" not "λ = 0.25".\n- ${FR_EXPLANATION_RULE}\n\nGRAPH RULE — CRITICAL (old-system / stat charts):\n- For every question whose ORIGINAL had hasGraph:true, the mutated version MUST also include "hasGraph": true AND a complete "graphConfig" object.\n- Start from the ORIGINAL graphConfig shown above and update EVERY numeric field that is implied by the new question's numbers (e.g. mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability, lambda, xDomain). Keep the graph's STRUCTURAL fields identical to the original — type/graphType, distType, and layout flags (showAxisNumbers, showGrid, etc.) must not change. HOWEVER, the function content is NOT structural: for function graphs the numbers live INSIDE the function strings (fn for single, fnTop/fnBottom for area, boundary for domain, pieces for piecewise, fx/fy for parametric/vector types). When the question's numbers or function change, you MUST update those function strings (and any shadeFrom/shadeTo/xDomain/mu/sigma/uMin/uMax that depend on them) so the graph matches the mutated question. A graph still showing the original function while the question text shows new numbers is a broken question.\n- For numbers mutation: same distribution / function family, but shadeFrom/shadeTo/uMin/uMax/mu/sigma must reflect the new question's numbers.\n- For function mutation: distType / fn may change; return the new structural fields too.\n${newGraphRule}\n\nReturn a JSON array of mutated questions in the SAME order preserving the original structure:\n- Regular: {type, section, difficulty, question, answer, explanation, choices if MC, hasGraph?, graphConfig?}\n- Formula: {type, section, difficulty, question, variables, answerFormula, answer, explanation, hasGraph?, graphConfig?}\nReply with ONLY valid JSON array, no markdown.`;
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
    ? `\n- GRAPH RULE: For every question whose ORIGINAL had hasGraph:true, every mutated version MUST also include "hasGraph": true AND a complete "graphConfig" object. Start from the ORIGINAL graphConfig (shown inline above as JSON) and update every numeric field that is implied by the new question's numbers (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability, lambda, xDomain). Keep the graph's STRUCTURAL fields identical to the original — type/graphType, distType, and layout flags (showAxisNumbers, showGrid, etc.) must not change. HOWEVER, the function content is NOT structural: for function graphs the numbers live INSIDE the function strings (fn for single, fnTop/fnBottom for area, boundary for domain, pieces for piecewise, fx/fy for parametric/vector types). When the question's numbers or function change, you MUST update those function strings (and any shadeFrom/shadeTo/xDomain/mu/sigma/uMin/uMax that depend on them) so the graph matches the mutated question. A graph still showing the original function while the question text shows new numbers is a broken question.`
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

// sectionsToEmit (optional): absolute section numbers to emit keys for. When set
// (e.g. [3]), the prompt asks for ONLY that section's keys (S3_A…) so the request
// stays under the model's output cap. numClassSections is still passed so the
// per-section mutation rule ("Section 3 … must differ from Section 1") is correct.
export function buildAllSectionsPrompt(selectedQuestions, labels, numClassSections, course="", versionMutationType={}, courseObject=null, sectionsToEmit=null) {
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
    ? `\n- GRAPH RULE: For every question whose ORIGINAL had hasGraph:true, every mutated version MUST also include "hasGraph": true AND a complete "graphConfig" object. Start from the ORIGINAL graphConfig (shown inline above as JSON) and update every numeric field that is implied by the new question's numbers (mu, sigma, uMin, uMax, shadeFrom, shadeTo, probability, lambda, xDomain). Keep the graph's STRUCTURAL fields identical to the original — type/graphType, distType, and layout flags (showAxisNumbers, showGrid, etc.) must not change. HOWEVER, the function content is NOT structural: for function graphs the numbers live INSIDE the function strings (fn for single, fnTop/fnBottom for area, boundary for domain, pieces for piecewise, fx/fy for parametric/vector types). When the question's numbers or function change, you MUST update those function strings (and any shadeFrom/shadeTo/xDomain/mu/sigma/uMin/uMax that depend on them) so the graph matches the mutated question. A graph still showing the original function while the question text shows new numbers is a broken question.`
    : "";

  // Sections this prompt emits (default: all). A single-section chunk passes [s].
  const sections = Array.isArray(sectionsToEmit) && sectionsToEmit.length
    ? sectionsToEmit
    : Array.from({ length: numClassSections }, (_, i) => i + 1);

  // Build version keys: S1_A, S1_B, S2_A, S2_B etc.
  const allKeys = [];
  for (const s of sections) {
    labels.forEach(v => allKeys.push(`S${s}_${v}`));
  }

  const courseModule2 = getCourse(course);
  const sectionRules = sections.map(s => {
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

// ── Per section×version chunk (anchor model) ────────────────────────────────
// One API call → ONE version key (S{sectionNum}_{label}), mutated from an EXPLICIT
// base question set (the master, or this section's already-generated anchor A).
//   mutation "function": the section's ANCHOR — change each base question's
//     function family (keep difficulty/structure/section topic); cross-section
//     differentiation comes from the course's buildSectionRules(sectionNum).
//   mutation "numbers": a within-section variant — change ONLY numbers/coefficients
//     of the base, keeping the same functions (so B/C share their section's A family).
export function buildVersionChunkPrompt({
  baseQuestions, sectionNum, label, mutation, course = "", courseObject = null,
}) {
  const courseContext = buildCourseContext(courseObject);
  const base = Array.isArray(baseQuestions) ? baseQuestions : [];
  const anyGraph = base.some(q => q.hasGraph && q.graphConfig);
  const lines = base.map((q, i) => {
    const graphNote = q.hasGraph && q.graphConfig
      ? ` [HAS GRAPH — base graphConfig: ${JSON.stringify(q.graphConfig)}]`
      : "";
    return (i + 1) + ". [" + q.section + "] [" + q.type + "]" + graphNote + _formatOriginalChoices(q.choices) + " Base: " + q.question;
  }).join("\n");
  const key = `S${sectionNum}_${label}`;
  const courseModule = getCourse(course);
  const newGraphRule = _newSystemGraphRule(base);
  const graphShape = anyGraph ? `, hasGraph?, graphConfig?` : "";
  const graphRule = anyGraph
    ? `\n- GRAPH RULE: every base question with hasGraph:true must keep "hasGraph": true AND a complete "graphConfig"; update the function strings / numeric fields so the graph matches the mutated question (structural fields type/graphType/distType/layout stay identical).`
    : "";

  const mutRule = mutation === "function"
    ? `FUNCTION mutation (this is the ANCHOR version A for classroom section ${sectionNum}): change the FUNCTION FAMILY of each base question (e.g. polynomial → exponential / trigonometric / logarithmic / rational / sqrt). Keep each question's DIFFICULTY, STRUCTURE, step count, section, and topic identical. ${courseModule?.buildSectionRules(sectionNum, true) ?? ""}`
    : `NUMBERS mutation: change ONLY the numbers / coefficients / constants of each base question. Keep the SAME function family, structure, difficulty, section, and topic as the base (the base IS this section's anchor — every version in the section shares its function family).`;

  const prompt = `TESTBANK_VERSION_CHUNK_REQUEST
Generate EXACTLY ONE version key: ${key}
${mutation === "function"
    ? `This is the anchor exam for classroom section ${sectionNum} — a function variation of the master below.`
    : `Mutate from the base below (this section's anchor exam).`}

Base questions to mutate (in order):
${lines}

MUTATION RULE:
- ${mutRule}
- ALWAYS regenerate the correct answer key for the mutated version.
- Keep the same question type, section name, and difficulty as the base.
- For Multiple Choice: all 4 choices must be distinct values; preserve any "None of these"/"All of the above" option; keep the same number of choices as the base.
- EXPONENTIAL DISTRIBUTION: always use μ (mu) as the parameter — NEVER λ (lambda).
- NEVER mention the distribution name in the question stem; refer to "the distribution above/shown" or its parameters.${graphRule}
${newGraphRule}
- ${FR_EXPLANATION_RULE}

Return a JSON object with EXACTLY one key "${key}" whose value is a JSON array of the mutated questions in the SAME order as the base:
{ "${key}": [{type, section, difficulty, question, choices, answer, explanation${graphShape}}, ...] }
Reply with ONLY a valid JSON object, no markdown, no explanation.`;
  return courseContext ? `${courseContext}\n\n${prompt}` : prompt;
}

// Per-section PASTE prompt (anchor model, stepper): asks for ONE section's keys
// in a single response. Section 1 → S1_{variants} as numbers mutations of the
// master (the master IS A, shown as base, not regenerated). Section s ≥ 2 → the
// model first generates S{s}_A (function mutation of the master) then S{s}_{variants}
// as numbers mutations of its OWN just-generated A — all in one JSON object.
export function buildSectionPastePrompt({
  baseQuestions, sectionNum, variantLabels, anchorLabel = "A", course = "", courseObject = null,
}) {
  const courseContext = buildCourseContext(courseObject);
  const base = Array.isArray(baseQuestions) ? baseQuestions : [];
  const labs = Array.isArray(variantLabels) ? variantLabels : [];
  const anyGraph = base.some(q => q.hasGraph && q.graphConfig);
  const lines = base.map((q, i) => {
    const graphNote = q.hasGraph && q.graphConfig ? ` [HAS GRAPH — base graphConfig: ${JSON.stringify(q.graphConfig)}]` : "";
    return (i + 1) + ". [" + q.section + "] [" + q.type + "]" + graphNote + _formatOriginalChoices(q.choices) + " Base: " + q.question;
  }).join("\n");
  const courseModule = getCourse(course);
  const newGraphRule = _newSystemGraphRule(base);
  const graphShape = anyGraph ? `, hasGraph?, graphConfig?` : "";
  const isS1 = sectionNum === 1;
  const genLabels = isS1 ? labs : [anchorLabel, ...labs];
  const keys = genLabels.map(l => `S${sectionNum}_${l}`);
  const anchorRules = isS1
    ? `- Section 1's version ${anchorLabel} IS the master above (unchanged — do NOT output it). Generate ${keys.join(", ")} as NUMBERS mutations of the master: change ONLY numbers/coefficients, keep the SAME functions, structure, section, and difficulty.`
    : `- FIRST generate S${sectionNum}_${anchorLabel}: a FUNCTION mutation of the master above — change each question's function family, keeping difficulty/structure/section/topic. ${courseModule?.buildSectionRules(sectionNum, true) ?? ""}\n- THEN generate ${labs.map(l => `S${sectionNum}_${l}`).join(", ")} as NUMBERS mutations of the S${sectionNum}_${anchorLabel} you just generated — same function family as your ${anchorLabel}, change only numbers/coefficients. (Every version in this section shares S${sectionNum}_${anchorLabel}'s functions.)`;
  const example = keys.map(k => `  "${k}": [{type, section, difficulty, question, choices, answer, explanation${graphShape}}, ...]`).join(",\n");
  const prompt = `TESTBANK_SECTION_PASTE_REQUEST
Classroom section ${sectionNum}. Generate exactly these keys: ${keys.join(", ")}.

Master / base questions (in order):
${lines}

ANCHOR RULES:
${anchorRules}
- ALWAYS regenerate the correct answer key for each version. Keep the same question type, section name, and difficulty.
- For Multiple Choice: all 4 choices distinct; preserve any "None of these"/"All of the above"; keep the choice count.
- EXPONENTIAL DISTRIBUTION: use μ (mu), NEVER λ (lambda). NEVER name the distribution in the stem.
${newGraphRule}
- ${FR_EXPLANATION_RULE}

Return a JSON object with EXACTLY these keys:
{
${example}
}
Reply with ONLY a valid JSON object, no markdown, no explanation.`;
  return courseContext ? `${courseContext}\n\n${prompt}` : prompt;
}

export function buildReplacePrompt(q, mutationType="numbers", reason="") {
  const mutationRule = mutationType === "reroll"
    ? "RE-ROLL: produce a BRAND-NEW question in the same concept area. It MUST differ from the original in BOTH its numbers AND its structure/scenario — do NOT merely reskin or renumber the original. Keep the same section, type, difficulty, and (for MC) the same number of choices."
    : mutationType === "fix"
    ? "FIX: keep the question as close to the original as possible (same scenario, same numbers where valid) and correct ONLY the flagged defect described below. Do not gratuitously change the problem."
    : mutationType === "function"
    ? "Use a DIFFERENT function type (e.g. if original uses polynomial, use exponential or trigonometric). Same concept area, same difficulty, same steps count."
    : "Keep the same function type, change only the numbers/coefficients.";
  const FIX_NOTE = (mutationType === "fix" || reason)
    ? `\nFIX THE FOLLOWING DEFECT (this is why the question is being regenerated — your replacement MUST resolve it):\n- ${reason || "(no reason provided)"}`
    : "";
  const MC_VERIFY = q.type === "Multiple Choice"
    ? `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch.\n- Confirm the answer field exactly matches one of the 4 choices (same value, same notation).\n- Confirm all 4 choices are distinct — no two may be equal or mathematically equivalent.\n- If any check fails, fix the question before returning.`
    : `\nANSWER VERIFICATION (mandatory — do this before returning JSON):\n- Solve the question yourself from scratch and confirm your answer field is correct.\n- If it is wrong, fix it before returning.`;
  const graphNote = q.hasGraph && q.graphConfig
    ? `\nORIGINAL graphConfig: ${JSON.stringify(q.graphConfig)}`
    : "";
  const choicesNote = _formatOriginalChoices(q.choices);
  const newGraphRule = _newSystemGraphRule([q]);
  return `TESTBANK_REPLACE_REQUEST\nGenerate 1 replacement question.\nSection: ${q.section} | Type: ${q.type} | Difficulty: ${q.difficulty}\nOriginal: ${q.question}${graphNote}${choicesNote}\nMutation: ${mutationType} — ${mutationRule}${FIX_NOTE}\nRequirements: same section, same question type, same difficulty, DIFFERENT question.\nUse plain-text math notation.\n${q.type==="Multiple Choice"?"Include 4 choices and correct answer.":""}\n${q.type==="Formula"?"Include variables array and answerFormula.":""}\n${q.type==="Free Response"?FR_EXPLANATION_RULE:""}\n${q.type==="Branched Free Response"?"Format the question with a stem followed by parts labeled (a), (b), (c)... Match the same labels in the answer and explanation fields. "+FR_EXPLANATION_RULE:""}${MC_VERIFY}${newGraphRule}\nReply with ONLY a JSON array containing exactly 1 item, no markdown.`;
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
