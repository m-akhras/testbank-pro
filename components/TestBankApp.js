}
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { COURSES, getCourse, typeInstructions } from "../lib/courses/index.js";
import { isPipeTable, normalizePipeTable, splitTableBlocks, mathStepsOnly } from "../lib/exports/helpers.js";
import { evalFn, graphToBase64PNG, statChartToBase64PNG } from "../lib/exports/graphRendering.js";
import { buildQTI, buildQTIZip, buildClassroomSectionsQTI, buildQTICompare, buildQTIAllSectionsMerged, canvasExportConfig, validateQTIExport } from "../lib/exports/qti.js";
import { buildAnswerKey, buildDocx, buildDocxCompare } from "../lib/exports/docx.js";
import { dlFile, dlBlob } from "../lib/exports/utils.js";
import { buildGeneratePrompt, buildVersionPrompt, buildAllVersionsPrompt, buildAllSectionsPrompt, buildReplacePrompt, buildConvertPrompt } from "../lib/prompts/index.js";
import MathText from "./display/MathText.js";
import MathTextInline from "./display/MathTextInline.js";
import GraphDisplay from "./display/GraphDisplay.js";
import PastePanel from "./panels/PastePanel.js";
import GraphEditor from "./editors/GraphEditor.js";
import InlineEditor from "./editors/InlineEditor.js";
import CustomCourseBuilder from "./editors/CustomCourseBuilder.js";
import CoursesScreen from "./screens/CoursesScreen.jsx";
import SavedExamsScreen from "./screens/SavedExamsScreen.js";
import HomeScreen from "./screens/HomeScreen.js";
import GenerateScreen from "./screens/GenerateScreen.js";
import ReviewScreen from "./screens/ReviewScreen.js";
import { useCourses } from "../hooks/useCourses.js";
import { seedBuiltinCourses } from "../lib/supabase/seedCourses.js";
import { normalizeUnicodeMath } from "../lib/normalizeUnicodeMath";
import { S, bg0, bg1, bg2, bg3, border, text1, text2, text3, green1, green2, green3, amber1 } from "../styles/theme.js";
import { loadBank, saveQuestion, deleteQuestion } from "../lib/db/questions.js";
import { saveExam, loadExams } from "../lib/db/exams.js";
import { logExport } from "../lib/db/exportHistory.js";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const QTYPES = ["Multiple Choice","Free Response","True/False","Fill in the Blank","Formula","Branched"];
const DIFFICULTIES = ["Easy","Medium","Hard","Mixed"];
const VERSIONS = ["A","B","C","D","E","F","G","H"];

// â”€â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// escapeXML moved to lib/exports/helpers.js (used only by QTI functions)
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// Convert plain-text math to HTML for Canvas QTI display
// Convert plain-text math expression to LaTeX string
// Convert plain-text math to simple HTML entities for Canvas QTI (proven to work)
// â”€â”€â”€ Question Validator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns array of issue strings. Empty array = valid.
function validateQuestion(q) {
  const issues = [];
  if (!q) return ["Empty question object"];

  // blank question text
  const qText = q.type === "Branched" ? q.stem : q.question;
  if (!qText || !String(qText).trim()) issues.push("Question text is empty");

  // blank answer
  if (q.type !== "Branched" && q.type !== "Free Response") {
    if (!q.answer && q.answer !== 0) issues.push("Answer is empty");
  }

  if (q.type === "Multiple Choice" || q.type === "True/False") {
    const choices = q.choices || [];

    // answer must be in choices
    if (q.answer && choices.length && !choices.includes(q.answer)) {
      issues.push("Correct answer does not match any choice");
    }

    // duplicate or equivalent choices
    const normalizeChoice = (c) => String(c ?? "")
      .trim()
      .toLowerCase()
      // strip LaTeX wrappers
      .replace(/\[()[\]]/g, "")
      .replace(/\s+/g, " ")
      // normalize fractions: 1/2 and rac{1}{2} â†’ same
      .replace(/\frac\{(\d+)\}\{(\d+)\}/g, (_, n, d) => `${n}/${d}`)
      // normalize common math: x^2 vs xÂ² etc
      .replace(/\^2/g, "Â²").replace(/\^3/g, "Â³")
      // strip spaces around operators
      .replace(/\s*([+\-*/=])\s*/g, "$1");

    const seen = new Map();
    choices.forEach((c, i) => {
      const norm = normalizeChoice(c);
      if (seen.has(norm)) {
        issues.push(`Choices ${String.fromCharCode(65+seen.get(norm))} and ${String.fromCharCode(65+i)} are duplicate or equivalent`);
      } else {
        seen.set(norm, i);
      }
    });

    // fewer than 2 choices
    if (choices.length < 2) issues.push("Question has fewer than 2 choices");
  }

  if (q.type === "Branched") {
    (q.parts || []).forEach((p, i) => {
      if (!p.answer && p.answer !== 0) issues.push(`Part (${String.fromCharCode(97+i)}) has no answer`);
    });
  }

  if (q.type === "Formula") {
    if (!q.answerFormula) issues.push("Formula question missing answerFormula");
    if (!q.variables || !q.variables.length) issues.push("Formula question missing variables");
  }

  // graph config validation
  if (q.hasGraph && !q.graphConfig) {
    issues.push("Question marked as having a graph but graphConfig is missing");
  }
  if (q.hasGraph && q.graphConfig) {
    const gc = q.graphConfig;
    if (!gc.type) issues.push("Graph missing type");
    if (gc.type === "single" && !gc.fn) issues.push("Single curve graph missing fn");
    if (gc.type === "area" && (!gc.fnTop || !gc.fnBottom)) issues.push("Area graph missing fnTop or fnBottom");
    if (gc.type === "domain" && !gc.boundary) issues.push("Domain graph missing boundary");
    if (gc.type === "piecewise" && (!gc.pieces || !gc.pieces.length)) issues.push("Piecewise graph missing pieces");
    if (gc.type === "multi" && (!gc.fns || !gc.fns.length)) issues.push("Multi graph missing fns array");
    if (gc.type === "bar") {
      if (!gc.labels || !gc.labels.length) issues.push("Bar chart missing labels");
      if (!gc.values || !gc.values.length) issues.push("Bar chart missing values");
      if (gc.labels && gc.values && gc.labels.length !== gc.values.length) issues.push("Bar chart labels and values length mismatch");
    }
    if (gc.type === "histogram" && (!gc.bins || !gc.bins.length)) issues.push("Histogram missing bins");
    if (gc.type === "scatter" && (!gc.points || !gc.points.length)) issues.push("Scatter plot missing points");
    if (gc.type === "discrete_dist" && (!gc.data || !gc.data.length)) issues.push("Discrete distribution missing data");
    if (gc.type === "continuous_dist" || gc.type === "standard_normal") {
      const dt = gc.distType || gc.type;
      if (!dt) issues.push("Continuous distribution missing distType");
      if ((dt === "normal" || dt === "standard_normal") && gc.sigma !== undefined && gc.sigma <= 0) issues.push("Normal distribution sigma must be > 0");
      if (dt === "exponential" && gc.lambda !== undefined && gc.lambda <= 0) issues.push("Exponential distribution lambda must be > 0");
      if (dt === "exponential" && gc.mu !== undefined && gc.mu <= 0) issues.push("Exponential distribution mu must be > 0");
      if (dt === "uniform" && gc.uMin !== undefined && gc.uMax !== undefined && gc.uMin >= gc.uMax) issues.push("Uniform distribution uMin must be < uMax");
    }
    if ((gc.xMin !== undefined && gc.xMax !== undefined) && gc.xMin >= gc.xMax) issues.push("Graph xMin must be less than xMax");
  }

  return issues;
}
// â”€â”€â”€ End Question Validator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// mathToHTML, mathToHTMLInline moved to lib/exports/helpers.js

// â”€â”€â”€ Graph Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// evalFn, renderGraphToSVG, graphToBase64PNG, renderStatChartToSVG, statChartToBase64PNG
// moved to lib/exports/graphRendering.js
// Requires D3 â€” add to app/layout.js <head>:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
//
// graphConfig shape:
// {
//   type: "single" | "piecewise" | "area" | "domain" | "multi"
//
//   // single:
//   fn: "x^2 - 3"
//   holes:  [[x,y], ...]   // open circles
//   points: [[x,y], ...]   // filled dots
//
//   // piecewise:
//   pieces: [{ fn:"x+1", domain:[-3, 0.999] }, ...]
//   holes:  [[x,y], ...]
//   points: [[x,y], ...]
//
//   // area (between two curves, Calc 2):
//   fnTop: "x+2", fnBottom: "x^2", shadeFrom: -1, shadeTo: 2
//
//   // domain (single shaded region, Calc 3):
//   boundary: "x^2", shadeAbove: true, boundaryDashed: true, boundaryLabel: "y = xÂ²"
//
//   // multi (4 graphs as MC options, Calc 3):
//   boundary: "x^2"
//   options: [{ shadeAbove:true, dashed:true, halfX:false, correct:true }, ...]
//
//   // shared:
//   showAxisNumbers: true
//   showGrid: true
//   xDomain: [-5, 5]
//   yDomain: [-5, 5]
// }

// evalFn imported from lib/exports/graphRendering.js

// renderGraphToSVG, graphToBase64PNG, renderStatChartToSVG, statChartToBase64PNG
// moved to lib/exports/graphRendering.js
// buildQTI, buildQTIZip, buildClassroomSectionsQTI, buildQTICompare, buildQTIAllSectionsMerged,
// canvasExportConfig, validateQTIExport moved to lib/exports/qti.js
// mathToOmml, mathStepsOnly moved to lib/exports/helpers.js
// makeDocxImageXml (private), buildAnswerKey, buildDocx, buildDocxCompare moved to lib/exports/docx.js
// dlFile, dlBlob moved to lib/exports/utils.js
// â”€â”€â”€ Duplicate detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function questionSimilarity(a, b) {
  const textA = String(a.question || a.stem || "").toLowerCase().trim();
  const textB = String(b.question || b.stem || "").toLowerCase().trim();
  if (!textA || !textB) return 0;
  // Simple word overlap ratio
  const wordsA = new Set(textA.split(/\W+/).filter(w => w.length > 3));
  const wordsB = new Set(textB.split(/\W+/).filter(w => w.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// â”€â”€ Question type instructions (used by all prompt builders) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Prompt Builders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// All AI prompt construction functions â€” isolated per course, no React deps
// Used by TestBankApp.js for generation, mutation, and replace operations

// Prompt builders â€” imported from lib/prompts/index.js

// CustomCourseBuilder â€” imported from components/editors/

// â”€â”€â”€ Main App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TestBankAppInner() {
  const [screen, setScreen] = useState("home");
  const [exportHighlight, setExportHighlight] = useState(false);
  const [bank, setBank] = useState([]);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [savedExams, setSavedExams] = useState([]);
  const [course, setCourse] = useState(null);
  const [selectedSections, setSelectedSections] = useState([]);
  const [sectionCounts, setSectionCounts] = useState({});
  const [generateConfirm, setGenerateConfirm] = useState(false);
  const [sectionConfig, setSectionConfig] = useState({});
  const [qType, setQType] = useState("Multiple Choice");
  const [diff, setDiff] = useState("Mixed");
  const [pendingType, setPendingType] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null);
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [lastGenerated, setLastGenerated] = useState([]);
  const [selectedForExam, setSelectedForExam] = useState([]);
  const [mutationType, setMutationType] = useState({});
  const [versionMutationType, setVersionMutationType] = useState({});
  const [versionCount, setVersionCount] = useState(2);
  const [masterLocked, setMasterLocked] = useState(false);
  const [masterName, setMasterName] = useState("");
  const [savedMasters, setSavedMasters] = useState([]);
  const [savingMaster, setSavingMaster] = useState(false);
  const [mastersLoading, setMastersLoading] = useState(false);
  const [versions, setVersions] = useState(() => {
    try {
      const saved = localStorage.getItem("tbp_versions");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [activeVersion, setActiveVersion] = useState(0);
  const [bankSearch, setBankSearch] = useState("");
  const [bankCompact, setBankCompact] = useState(false);
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterDiff, setFilterDiff] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false);
  const [filterDate, setFilterDate] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterDay, setFilterDay] = useState("All");
  const [filterTime, setFilterTime] = useState("All");
  const [bankSelectMode, setBankSelectMode] = useState(false);
  const [bankSelected, setBankSelected] = useState(new Set());
  const [bulkReplacePrompt, setBulkReplacePrompt] = useState("");
  const [bulkReplacePaste, setBulkReplacePaste] = useState("");
  const [bulkReplaceError, setBulkReplaceError] = useState("");
  const [bulkReplaceIds, setBulkReplaceIds] = useState(new Set());
  const [graphEditorQId, setGraphEditorQId] = useState(null); // which question has graph editor open
  const [inlineEditQId,  setInlineEditQId]  = useState(null); // which question has inline editor open
  const [toast, setToast] = useState(null); // {msg, type} â€” auto-dismisses

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function autoGenerate(prompt, onSuccess) {
    setIsGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const result = data.result || data.content?.[0]?.text || data.text || "";
      if (!result) throw new Error("Empty response from API. Try again.");
      if (data.warning) showToast(data.warning, "error");
      onSuccess(result);
    } catch(e) {
      setGenerateError(e.message);
      showToast(e.message, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  const [qtiExamName, setQtiExamName] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printGraphCache, setPrintGraphCache] = useState({});

  // Pre-render graphs for print preview â€” must be after state declarations
  useEffect(() => {
    if (!showPrintPreview) { setPrintGraphCache({}); return; }
    const v = versions[activeVersion];
    if (!v) return;
    const graphQs = v.questions.filter(q => q.hasGraph && q.graphConfig);
    if (!graphQs.length) return;
    (async () => {
      const cache = {};
      for (const q of graphQs) {
        try {
          const isStatChart = q.graphConfig?.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
          const b64 = isStatChart
            ? await statChartToBase64PNG(q.graphConfig, 480, 280)
            : await graphToBase64PNG(q.graphConfig, 480, 280);
          if (b64) cache[q.id || q.question] = b64;
        } catch(e) { console.warn("print graph failed", e); }
      }
      setPrintGraphCache(cache);
    })();
  }, [showPrintPreview, activeVersion]);

  const [dupWarnings, setDupWarnings] = useState([]);
  const [saveExamName, setSaveExamName] = useState("");
  const [savingExam, setSavingExam] = useState(false);
  const [exportLoading, setExportLoading] = useState("");  // label of current export, "" = idle
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [examSaved, setExamSaved] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenError, setAutoGenError] = useState("");
  const [validationResults, setValidationResults] = useState({}); // { questionId: { valid, corrected_answer, reason } }
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [user, setUser] = useState(null);

  const isAdmin = user?.email === "mohammadalakhrass@yahoo.com";
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (!session) window.location.href = "/login";
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        window.location.href = "/login";
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const [versionsViewMode, setVersionsViewMode] = useState("single"); // "single" | "compare"
  const [compareSection, setCompareSection] = useState("All");
  const [selectedQIndices, setSelectedQIndices] = useState([]);
  const [qtiUseGroups, setQtiUseGroups] = useState(false);
  const [qtiPointsPerQ, setQtiPointsPerQ] = useState(1);
  const [bankTabState, setBankTabState] = useState("browse");
  const [expandedBatches, setExpandedBatches] = useState({});
  // â”€â”€ Classroom sections â”€â”€
  const [numClassSections, setNumClassSections] = useState(1);
  const [currentClassSection, setCurrentClassSection] = useState(1);
  const [classSectionVersions, setClassSectionVersions] = useState(() => {
    try {
      const saved = localStorage.getItem("tbp_classSectionVersions");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }); // {1: [...versions], 2: [...versions]}
  const [activeClassSection, setActiveClassSection] = useState(1);

  const [customCourses, setCustomCourses] = useState({});

  const { courses: dbCourses, saveCourse: saveDbCourse, deleteCourse: deleteDbCourse } = useCourses();
  const courseObject = course ? (dbCourses.find(c => c.name === course) || null) : null;

  const allCourses = { ...COURSES, ...customCourses };
  const accent = course ? (allCourses[course]?.color || "#2D6A4F") : "#2D6A4F";

  useEffect(() => {
    loadBank().then(q => { setBank(q); setBankLoaded(true); });
    loadCustomCourses();
    loadExams().then(e => setSavedExams(e));
    loadSavedMasters();
    seedBuiltinCourses().catch(e => console.error("seedBuiltinCourses error:", e));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tbp_versions", JSON.stringify(versions));
    } catch {}
  }, [versions]);

  useEffect(() => {
    try {
      localStorage.setItem("tbp_classSectionVersions", JSON.stringify(classSectionVersions));
    } catch {}
  }, [classSectionVersions]);

  async function loadSavedMasters() {
    setMastersLoading(true);
    try {
      const { data, error } = await supabase
        .from("exams")
        .select("id, name, master_questions, settings, created_at")
        .eq("is_master", true)
        .order("created_at", { ascending: false });
      if (!error && data) setSavedMasters(data);
    } catch(e) { console.error("loadSavedMasters error:", e); }
    finally { setMastersLoading(false); }
  }

  async function saveMaster() {
    if (!masterName.trim()) { showToast("Enter a master name first", "error"); return; }
    setSavingMaster(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("exams").insert({
        name: masterName.trim(),
        is_master: true,
        versions: [],
        master_questions: versions[0].questions,
        settings: { versionCount, numClassSections, versionMutationType, course },
        user_id: user.id,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      showToast("Master saved âœ“");
      setMasterName("");
      loadSavedMasters();
    } catch(e) {
      showToast("Save failed: " + e.message, "error");
    } finally { setSavingMaster(false); }
  }

  async function deleteSavedMaster(id) {
    await supabase.from("exams").delete().eq("id", id);
    setSavedMasters(p => p.filter(m => m.id !== id));
    showToast("Master deleted");
  }

  function loadMaster(master) {
    const { master_questions = [], settings = {} } = master;
    // Resolve each question: prefer live bank version, fall back to saved snapshot
    const resolved = master_questions.map(sq => bank.find(q => q.id === sq.id) || sq);
    setVersions([{ label: "A", questions: resolved }]);
    setMasterLocked(false);
    if (settings.versionCount)      setVersionCount(settings.versionCount);
    if (settings.numClassSections)  setNumClassSections(settings.numClassSections);
    if (settings.versionMutationType) setVersionMutationType(settings.versionMutationType);
    if (settings.course)            setCourse(settings.course);
    setActiveVersion(0);
    setScreen("versions");
    showToast(`Loaded "${master.name}" âœ“`);
  }

  async function loadCustomCourses() {
    try {
      const { data } = await supabase.from("custom_courses").select("*").order("created_at");
      if (!data) return;
      const map = {};
      data.forEach(c => {
        map[c.name] = { color: c.color, chapters: c.chapters || [], id: c.id, textbook: c.textbook };
      });
      setCustomCourses(map);
    } catch(e) { console.error("loadCustomCourses error:", e); }
  }

  async function saveCustomCourse(courseData) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { name: courseData.name, color: courseData.color, chapters: courseData.chapters, textbook: courseData.textbook || "", user_id: user.id };
    if (courseData.id) {
      await supabase.from("custom_courses").update(payload).eq("id", courseData.id);
    } else {
      await supabase.from("custom_courses").insert(payload);
    }
    await loadCustomCourses();
  }

  async function deleteCustomCourse(courseName) {
    const c = customCourses[courseName];
    if (!c?.id) return;
    await supabase.from("custom_courses").delete().eq("id", c.id);
    if (course === courseName) setCourse(null);
    await loadCustomCourses();
  }

  const persistBank = useCallback(async (newBank) => {
    setBank(newBank);
    // individual upserts handled by saveQuestion / deleteQuestion
  }, []);

  async function handlePaste() {
    setPasteError("");
    console.log("handlePaste pendingMeta.selected", pendingMeta?.selected?.map(q => ({id:q.id, hasGraph:q.hasGraph})));
    try {
      const raw = pasteInput.trim();

      // Sanitize any question object from AI â€” guard null/missing fields
      const sanitize = (q) => {
        // Strip title/probability from graphConfig â€” cleaner for Canvas exports
        let graphConfig = q.graphConfig;
        if (graphConfig) {
          const { title, ...rest } = graphConfig;
          graphConfig = rest;
        }
        return {
          ...q,
          type:       q.type       || "Multiple Choice",
          difficulty: q.difficulty || "Medium",
          question:   q.question   || "",
          answer:     q.answer     || "",
          choices:    (q.choices   || []).map(c => c ?? ""),
          explanation: q.explanation || "",
          ...(graphConfig ? { graphConfig } : {}),
        };
      };

      // For version_all, parse as object {A:[...], B:[...]}
      if (pendingType === "version_all") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found. Make sure you copied the full response.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, classSection } = pendingMeta;
        const allVersions = labels.map(label => {
          const qs = parsed[label] || [];
          const versioned = qs.map((q,i) => ({
            ...sanitize(q), id: uid(), originalId: selected[i]?.id,
            course: selected[i]?.course || course,
            versionLabel: label, classSection, createdAt: Date.now(),
            ...(selected[i]?.hasGraph ? {
              hasGraph: true,
              graphConfig: q.graphConfig ? { ...selected[i].graphConfig, ...q.graphConfig } : selected[i].graphConfig,
            } : {}),
          }));
          return { label, questions: versioned, classSection };
        });
        const finalVersions = masterLocked ? [{ ...versions[0], classSection }, ...allVersions] : allVersions;
        setClassSectionVersions({ [classSection]: finalVersions });
        setVersions(finalVersions); setActiveVersion(0);
        setActiveClassSection(classSection);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setExamSaved(false); setSaveExamName("");
        setScreen("versions");
        return;
      }

      // Single paste with all sections: {S1_A:[...], S1_B:[...], S2_A:[...], ...}
      if (pendingType === "version_all_sections") {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (!objMatch) throw new Error("No JSON object found.");
        const parsed = JSON.parse(objMatch[0]);
        const { selected, labels, numClassSections: ncs } = pendingMeta;
        const newSectionVersions = {};
        for(let s=1; s<=ncs; s++) {
          const sectionVariants = labels.map(label => {
            const key = `S${s}_${label}`;
            const qs = parsed[key] || [];
            const versioned = qs.map((q,i) => ({
              ...sanitize(q), id: uid(), originalId: selected[i]?.id,
              course: selected[i]?.course || course,
              versionLabel: label, classSection: s, createdAt: Date.now(),
              ...(selected[i]?.hasGraph ? {
                hasGraph: true,
                graphConfig: q.graphConfig ? { ...selected[i].graphConfig, ...q.graphConfig } : selected[i].graphConfig,
              } : {}),
            }));
            return { label, questions: versioned, classSection: s };
          });
          newSectionVersions[s] = masterLocked
            ? [{ ...versions[0], classSection: s }, ...sectionVariants]
            : sectionVariants;
        }
        setClassSectionVersions(newSectionVersions);
        setVersions(newSectionVersions[1]);
        setActiveVersion(0); setActiveClassSection(1);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setExamSaved(false); setSaveExamName("");
        setScreen("versions");
        return;
      }

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array found. Make sure you copied the full response.");
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

      const sanitized = parsed.map(sanitize);

      if (pendingType === "generate") {
        const tagged = sanitized.map(q => ({ ...q, id: uid(), course: pendingMeta.course, createdAt: Date.now() }));
        // Check for duplicates within same section
        const warnings = [];
        tagged.forEach((newQ, i) => {
          if (newQ.hasGraph) return; // skip duplicate check for graph questions
          const sectionBank = bank.filter(bq => bq.section === newQ.section && bq.course === newQ.course);
          const sim = sectionBank.find(bq => questionSimilarity(newQ, bq) > 0.75);
          if (sim) warnings.push(`Q${i+1} (${newQ.section}) may be similar to an existing question.`);
        });
        setDupWarnings(warnings);
        setLastGenerated(tagged);
        for (const q of tagged) await saveQuestion(q);
        setBank(prev => [...tagged, ...prev]);
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
        setScreen("bank");
      } else if (pendingType === "version") {
        const { selected, label, allVersions, remaining, mutationType: mt } = pendingMeta;
        const versioned = sanitized.map((q,i) => ({
          ...q,
          id: uid(),
          originalId: selected[i]?.id,
          course: selected[i]?.course || course,
          versionLabel: label,
          createdAt: Date.now(),
          // carry graph config from AI response if present, else fall back to original
          ...(selected[i]?.hasGraph ? { hasGraph: true, graphConfig: q.graphConfig || selected[i].graphConfig } : {}),
        }));
        const updated = [...allVersions, { label, questions: versioned }];
        if (remaining.length > 0) {
          const nextLabel = remaining[0]; const nextRemaining = remaining.slice(1);
          const prompt = buildVersionPrompt(selected, mt, nextLabel);
          setGeneratedPrompt(prompt);
          setPendingMeta({ selected, label: nextLabel, allVersions: updated, remaining: nextRemaining, mutationType: mt });
          setPasteInput("");
        } else {
          setVersions(updated); setActiveVersion(0);
          setPendingType(null); setPasteInput(""); setPendingMeta(null);
          setExamSaved(false); setSaveExamName("");
          setScreen("versions");
        }
      } else if (pendingType === "replace") {
        const { vIdx, qIdx } = pendingMeta;
        const newQ = { ...parsed[0], id: uid(), course: versions[vIdx].questions[qIdx]?.course || course, versionLabel: versions[vIdx].label, classSection: versions[vIdx].questions[qIdx]?.classSection };
        const updatedVersions = versions.map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) });
        setVersions(updatedVersions);
        // Also update classSectionVersions so exports use the replaced question
        const cs = versions[vIdx]?.classSection || versions[vIdx]?.questions[0]?.classSection;
        if (cs) {
          setClassSectionVersions(prev => ({
            ...prev,
            [cs]: (prev[cs] || []).map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) })
          }));
        } else {
          // Single section â€” sync all classSectionVersions entries
          setClassSectionVersions(prev => {
            const updated = {...prev};
            Object.keys(updated).forEach(sec => {
              updated[sec] = updated[sec].map((v,vi) => vi !== vIdx ? v : { ...v, questions: v.questions.map((q,qi) => qi !== qIdx ? q : newQ) });
            });
            return updated;
          });
        }
        setPendingType(null); setPasteInput(""); setPendingMeta(null);
      }
    } catch(e) { setPasteError("Error: " + e.message); }
  }

  function triggerGenerate() {
    const prompt = buildGeneratePrompt(course, selectedSections, sectionCounts, qType, diff, sectionConfig, courseObject);
    setGeneratedPrompt(prompt);
    setPendingType("generate"); setPendingMeta({ course }); setPasteInput(""); setPasteError("");
  }

  function sectionSortKey(section) {
    // Extract numeric parts from section like "3.1", "5.4", "A.1", "11.2"
    const m = String(section||"").match(/([A-Za-z]?)(\d+)\.(\d+)/);
    if (!m) return [999, 999];
    const prefix = m[1] ? m[1].charCodeAt(0) - 64 : 0; // A=1, B=2...
    return [prefix * 1000 + parseInt(m[2]), parseInt(m[3])];
  }

  function triggerVersions() {
    const selected = masterLocked
      ? versions[0].questions
      : bank
          .filter(q => selectedForExam.includes(q.id))
          .sort((a, b) => {
            const [aMaj, aMin] = sectionSortKey(a.section);
            const [bMaj, bMin] = sectionSortKey(b.section);
            return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
          });
    const labels = masterLocked ? VERSIONS.slice(1, 1 + versionCount) : VERSIONS.slice(0, versionCount);
    if (numClassSections > 1) {
      const prompt = buildAllSectionsPrompt(selected, labels, numClassSections, course, versionMutationType, courseObject);
      setGeneratedPrompt(prompt);
      setPendingType("version_all_sections");
      setPendingMeta({ selected, labels, numClassSections, versionMutationType });
    } else {
      const prompt = buildAllVersionsPrompt(selected, mutationType, labels, 1, 1, course, versionMutationType, courseObject);
      setGeneratedPrompt(prompt);
      setPendingType("version_all");
      setPendingMeta({ selected, labels, mutationType, classSection: 1, versionMutationType });
    }
    setPasteInput(""); setPasteError("");
  }

  async function autoGenerateVersions(prompt, pendingTypeVal, pendingMetaVal) {
    setAutoGenLoading(true);
    setAutoGenError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text || data.text || "";
      if (!text) throw new Error("Empty response from API. Try again or use Copy Prompt.");
      if (data.warning) showToast(data.warning, "error");
      if (data.stop_reason === "max_tokens" && !text) throw new Error("Response truncated â€” generate fewer questions at once (max 10 recommended).");
      setPasteInput(text);
      setPendingType(pendingTypeVal);
      setPendingMeta(pendingMetaVal);
      setGeneratedPrompt(prompt);
      // auto-submit
      setTimeout(() => { document.getElementById("auto-submit-paste")?.click(); }, 100);
    } catch (e) {
      setAutoGenError(e.message || "Generation failed. Try Copy Prompt instead.");
    } finally {
      setAutoGenLoading(false);
    }
  }

  function triggerReplace(vIdx, qIdx, mutationType="numbers") {
    const prompt = buildReplacePrompt(versions[vIdx].questions[qIdx], mutationType);
    setGeneratedPrompt(prompt);
    setPendingType("replace"); setPendingMeta({ vIdx, qIdx }); setPasteInput(""); setPasteError("");
  }

  async function triggerReplaceAuto(vIdx, qIdx, mutationType="numbers") {
    const baseQ = versions[vIdx].questions[qIdx];
    const prompt = buildReplacePrompt(baseQ, mutationType);
    setGeneratedPrompt(prompt);
    setPendingType("replace");
    setPendingMeta({ vIdx, qIdx });
    setPasteInput(""); setPasteError("");
    await autoGenerateVersions(prompt, "replace", { vIdx, qIdx });
  }

  function defaultSecCfg() {
    const defTypeCounts = { normal: 0, table: 0, graph: 0, mix: 0 };
    return {
      Easy:   { count:0, graphType:"normal", tableRows:4, tableCols:2, typeCounts: {...defTypeCounts} },
      Medium: { count:0, graphType:"normal", tableRows:5, tableCols:3, typeCounts: {...defTypeCounts} },
      Hard:   { count:0, graphType:"normal", tableRows:6, tableCols:3, typeCounts: {...defTypeCounts} },
    };
  }

  function getSectionConfig(sec) { return sectionConfig[sec] || defaultSecCfg(); }
  function setSectionDiff(sec, difficulty, fields, value) {
    // Accept either (sec, diff, fieldName, value) or (sec, diff, {field:value,...})
    const updates = typeof fields === "object" ? fields : { [fields]: value };
    setSectionConfig(prev => {
      const secCfg = prev[sec] || defaultSecCfg();
      return { ...prev, [sec]: { ...secCfg, [difficulty]: { ...secCfg[difficulty], ...updates } } };
    });
  }

  function toggleSection(sec) {
    setSelectedSections(p => p.includes(sec) ? p.filter(s => s !== sec) : [...p, sec]);
    setSectionCounts(p => ({ ...p, [sec]: p[sec] || 3 }));
    setSectionConfig(p => p[sec] ? p : ({ ...p, [sec]: defaultSecCfg() }));
  }

  function toggleChapter(chap) {
    const all = chap.sections.every(s => selectedSections.includes(s));
    if (all) { setSelectedSections(p => p.filter(s => !chap.sections.includes(s))); }
    else {
      setSelectedSections(p => { const n = [...p]; chap.sections.forEach(s => { if (!n.includes(s)) n.push(s); }); return n; });
      setSectionCounts(p => { const n = { ...p }; chap.sections.forEach(s => { if (!n[s]) n[s] = 3; }); return n; });
      setSectionConfig(p => { const n = { ...p }; chap.sections.forEach(s => { if (!n[s]) n[s] = defaultSecCfg(); }); return n; });
    }
  }

  const chapters = course ? (allCourses[course]?.chapters || []) : [];
  const totalQ = selectedSections.reduce((a,s) => {
    const cfg = sectionConfig[s] || defaultSecCfg();
    return a + (cfg.Easy.count||0) + (cfg.Medium.count||0) + (cfg.Hard.count||0);
  }, 0);

  // Get available sections â€” only show when a course is selected, pulled from actual bank questions
  const availableSections = filterCourse === "All"
    ? []
    : [...new Set(bank.filter(q => q.course === filterCourse).map(q => q.section).filter(Boolean))].sort();

  const filteredBank = bank.filter(q => {
    const searchLower = bankSearch.toLowerCase().trim();
    const matchesSearch = !searchLower || (
      (q.question||"").toLowerCase().includes(searchLower) ||
      (q.stem||"").toLowerCase().includes(searchLower) ||
      (q.answer||"").toLowerCase().includes(searchLower) ||
      (q.section||"").toLowerCase().includes(searchLower) ||
      (q.choices||[]).some(c => c != null && String(c).toLowerCase().includes(searchLower))
    );
    return matchesSearch &&
      (filterCourse === "All" || q.course === filterCourse) &&
      (filterType === "All" || q.type === filterType) &&
      (filterDiff === "All" || q.difficulty === filterDiff) &&
      (filterSection === "All" || q.section === filterSection) &&
      (!filterIssuesOnly || validateQuestion(q).length > 0) &&
      (() => {
        if (filterYear === "All") return true;
        const d = new Date(q.createdAt);
        if (String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "All" && String(d.getMonth()) !== filterMonth) return false;
        if (filterDay !== "All" && String(d.getDate()) !== filterDay) return false;
        if (filterTime !== "All" && d.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"}) !== filterTime) return false;
        return true;
      })();
  }).sort((a, b) => {
    const [aMaj, aMin] = sectionSortKey(a.section);
    const [bMaj, bMin] = sectionSortKey(b.section);
    if (aMaj !== bMaj) return aMaj - bMaj;
    if (aMin !== bMin) return aMin - bMin;
    return (a.createdAt || 0) - (b.createdAt || 0); // within same section: oldest first
  });

  // Detect near-duplicate questions in the bank (same section + high word overlap)
  const duplicateIds = new Set();
  for (let i = 0; i < bank.length; i++) {
    for (let j = i + 1; j < bank.length; j++) {
      const a = bank[i]; const b = bank[j];
      if (a.section !== b.section) continue;
      const sim = questionSimilarity(a, b);
      if (sim > 0.75) { duplicateIds.add(a.id); duplicateIds.add(b.id); }
    }
  }
  const bankDupCount = duplicateIds.size;

  // Available years, months, days from bank
  const availableYears = [...new Set(bank.map(q => String(new Date(q.createdAt).getFullYear())))].sort((a,b) => b-a);
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const availableMonths = filterYear === "All" ? [] : [...new Set(
    bank.filter(q => String(new Date(q.createdAt).getFullYear()) === filterYear)
      .map(q => String(new Date(q.createdAt).getMonth()))
  )].sort((a,b) => b-a);
  const availableDays = (filterYear === "All" || filterMonth === "All") ? [] : [...new Set(
    bank.filter(q => {
      const d = new Date(q.createdAt);
      return String(d.getFullYear()) === filterYear && String(d.getMonth()) === filterMonth;
    }).map(q => String(new Date(q.createdAt).getDate()))
  )].sort((a,b) => b-a);
  const availableTimes = (filterYear === "All" || filterMonth === "All" || filterDay === "All") ? [] : [...new Set(
    bank.filter(q => {
      const d = new Date(q.createdAt);
      return String(d.getFullYear()) === filterYear && String(d.getMonth()) === filterMonth && String(d.getDate()) === filterDay;
    }).map(q => new Date(q.createdAt).toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"}))
  )].sort((a,b) => new Date(`1970/01/01 ${b}`) - new Date(`1970/01/01 ${a}`));
  const courseColors = Object.fromEntries(Object.entries(allCourses).map(([k, v]) => [k, v.color]));

  // â”€â”€ Sidebar nav groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const bankIssueCount = bank.filter(q => validateQuestion(q).length > 0).length;

  // Map originalId â†’ count of saved exams that include that question
  const usedInExams = {};
  savedExams.forEach(exam => {
    const versions = exam.versions || [];
    const seen = new Set();
    versions.forEach(v => (v.questions||[]).forEach(q => {
      const key = q.originalId || q.id;
      if (key && !seen.has(key)) { seen.add(key); usedInExams[key] = (usedInExams[key]||0) + 1; }
    }));
  });

  const navGroups = [
    { label: null, items: [
      { id:"home", icon:"âŠŸ", label:"Dashboard" },
    ]},
    { label: "Question Bank", items: [
      ...(isAdmin ? [{ id:"generate", icon:"âœ¦", label:"Generate" }] : []),
      { id:"review",   icon:"â—Ž", label:"Review", badge: lastGenerated.length || null, alert: lastGenerated.length > 0 },
      { id:"bank",     icon:"â–¦", label:"Browse & Edit", badge: bank.length || null },
    ]},
    { label: "Exam Builder", items: [
      { id:"versions", icon:"âŠž", label:"Build & Export" },
      { id:"saved",    icon:"â—ˆ", label:"Saved Exams" },
    ]},
    { label: "Settings", items: [
      { id:"courses",  icon:"ðŸŽ“", label:"Courses", badge: dbCourses.length || null },
    ]},
  ];

  // â”€â”€ Sidebar component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const Sidebar = () => (
    <aside style={S.sidebar}>
      {/* Logo */}
      <div style={S.sidebarLogo}>
        <div style={S.logoMark}>T</div>
        <div>
          <div style={S.logoText}>TestBank Pro</div>
          <div style={S.logoSub}>Exam Authoring Suite</div>
        </div>
      </div>

      {/* Notification banners */}
      {lastGenerated.length > 0 && (
        <div onClick={() => setScreen("review")} style={{
          margin:"0.7rem 0.6rem 0", padding:"0.55rem 0.7rem",
          background:"#FEF3C7", border:"1px solid #FCD34D",
          borderRadius:"8px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:"0.5rem"
        }}>
          <span style={{fontSize:"0.9rem"}}>âš¡</span>
          <div>
            <div style={{fontSize:"0.71rem", color:"#f59e0b", fontWeight:"600", lineHeight:1.3}}>{lastGenerated.length} questions ready to review</div>
            <div style={{fontSize:"0.62rem", color:"#92400E", marginTop:"1px"}}>Click to review â†’</div>
          </div>
        </div>
      )}
      {bankIssueCount > 0 && (
        <div onClick={() => { setFilterIssuesOnly(true); setScreen("bank"); }} style={{
          margin:"0.4rem 0.6rem 0", padding:"0.5rem 0.7rem",
          background:"#FEE2E2", border:"1px solid #FECACA",
          borderRadius:"8px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:"0.5rem"
        }}>
          <span style={{fontSize:"0.9rem"}}>âš ï¸</span>
          <div>
            <div style={{fontSize:"0.71rem", color:"#9B1C1C", fontWeight:"600", lineHeight:1.3}}>{bankIssueCount} question{bankIssueCount>1?"s":""} with issues</div>
            <div style={{fontSize:"0.62rem", color:"#9B1C1C", marginTop:"1px"}}>Click to fix â†’</div>
          </div>
        </div>
      )}

      {/* Nav groups */}
      <div style={{padding:"0.4rem 0", flex:1}}>
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && <div style={S.navSection}>{group.label}</div>}
            {group.items.map(n => (
              <button key={n.id}
                style={{...S.navBtn(screen===n.id), ...(n.alert && screen!==n.id ? {color:"#f59e0b"} : {})}}
                onClick={() => setScreen(n.id)}>
                <span style={S.navIcon}>{n.icon}</span>
                <span style={{flex:1}}>{n.label}</span>
                {n.badge ? <span style={S.navBadge(screen===n.id ? accent : n.alert ? "#f59e0b" : "#3a5a8a")}>{n.badge}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Active course */}
      {course && (
        <div style={{padding:"0.7rem 1rem", borderTop:"1px solid "+border}}>
          <div style={{fontSize:"0.57rem", color:text3, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.3rem"}}>Active Course</div>
          <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
            <div style={{width:"7px", height:"7px", borderRadius:"50%", background:accent, flexShrink:0, boxShadow:"0 0 6px "+accent}}/>
            <span style={{fontSize:"0.74rem", color:accent, fontWeight:"600", lineHeight:1.3}}>{course}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{padding:"0.55rem 1rem", borderTop:"1px solid "+border}}>
        {user && (
          <div style={{marginBottom:"0.4rem"}}>
            <div style={{fontSize:"0.6rem", color:text3, marginBottom:"0.15rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {user.email}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{fontSize:"0.62rem", color:"#475569", background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline"}}>
              Sign out
            </button>
          </div>
        )}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span style={{fontSize:"0.57rem", color:text3}}>TestBank Pro</span>
          <span style={{fontSize:"0.57rem", color:text3, background:bg3, padding:"0.1rem 0.4rem", borderRadius:"4px", fontWeight:"600"}}>v55</span>
        </div>
      </div>
    </aside>
  );

  const [confirmDelete, setConfirmDelete] = useState(null); // {id, label}

  // â”€â”€ Auto-validate all versions (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function autoValidateAllVersions() {
    setValidating(true);
    setValidationError("");
    try {
      const allVersions = Object.keys(classSectionVersions).length > 1
        ? Object.values(classSectionVersions).flat()
        : versions;
      const seen = new Set();
      const uniqueQuestions = [];
      allVersions.forEach(v => {
        v.questions.forEach(q => {
          if (!seen.has(q.id)) { seen.add(q.id); uniqueQuestions.push(q); }
        });
      });
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: uniqueQuestions }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const results = {};
      (data.validated || []).forEach(q => { results[q.id] = q.validation; });
      setValidationResults(results);
    } catch (e) {
      setValidationError(e.message || "Validation failed. Try Copy Validation Prompt instead.");
    }
    setValidating(false);
  }

  // â”€â”€ Copy validation prompt (admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function copyValidationPrompt() {
    const allVersions = Object.keys(classSectionVersions).length > 1
      ? Object.values(classSectionVersions).flat()
      : versions;
    const seen = new Set();
    const uniqueQuestions = [];
    allVersions.forEach(v => {
      v.questions.forEach(q => {
        if (!seen.has(q.id)) { seen.add(q.id); uniqueQuestions.push(q); }
      });
    });
    const questionsText = uniqueQuestions.map((q, i) => {
      const choices = (q.choices || []).map((c, ci) => `  ${String.fromCharCode(65+ci)}) ${c}`).join("\n");
      return `Q${i+1}: ${q.question}\n${choices}\n  Correct Answer: ${q.answer}`;
    }).join("\n\n");
    const prompt = `You are validating math exam questions for a university course.

For each question below, check:
1. Is the correct answer mathematically accurate?
2. Are the distractors plausible student mistakes (not random values)?
3. Is the question clearly worded with no ambiguity?
4. Are any two choices mathematically equivalent? (e.g. 1/2 and 0.5, or x+x and 2x)
5. Are any two choices identical or near-identical in value?

For each issue found, return:
- Question number
- Problem: what is wrong
- Fix: the corrected answer, rewrite, or replacement distractor

If everything is correct, say "All questions verified"

QUESTIONS:
${questionsText}`;
    navigator.clipboard.writeText(prompt);
  }

  if (authLoading) return (
    <div style={{ minHeight:"100vh", background:bg0, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"1.4rem", fontWeight:"800", color:text1, marginBottom:"1.25rem", letterSpacing:"-0.5px" }}>
          TestBank <span style={{ color:"#10b981" }}>Pro</span>
        </div>
        <div style={{ width:"28px", height:"28px", border:"2px solid #1e3a5f", borderTop:"2px solid #10b981", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <Sidebar />

      {/* â”€â”€ Toast notification â”€â”€ */}
      {toast && (
        <div style={{position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:99999,
          padding:"0.65rem 1.1rem", borderRadius:"8px", fontSize:"0.82rem", fontWeight:"600",
          background: toast.type==="error" ? "#7c2d12" : toast.type==="warn" ? "#451a03" : "#052e16",
          color: toast.type==="error" ? "#fca5a5" : toast.type==="warn" ? "#fde68a" : "#86efac",
          border: `1px solid ${toast.type==="error" ? "#f8717144" : toast.type==="warn" ? "#f59e0b44" : "#22c55e44"}`,
          boxShadow:"0 4px 20px rgba(0,0,0,0.4)", animation:"fadeIn 0.2s ease"}}>
          {toast.type==="success" ? "âœ“" : toast.type==="warn" ? "âš " : "âœ•"} {toast.msg}
        </div>
      )}

      {/* â”€â”€ Export loading overlay â”€â”€ */}
      {exportLoading && (
        <div style={{position:"fixed", bottom:"1.5rem", left:"50%", transform:"translateX(-50%)", zIndex:99999,
          padding:"0.65rem 1.4rem", borderRadius:"8px", fontSize:"0.82rem", fontWeight:"600",
          background:"#1B4332", color:"#86efac", border:"1px solid #22c55e44",
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:"0.5rem"}}>
          <span style={{display:"inline-block", animation:"spin 1s linear infinite"}}>âŸ³</span>
          {exportLoading}
        </div>
      )}

      {/* â”€â”€ Delete confirmation dialog â”€â”€ */}
      {confirmDelete && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9998,
          display:"flex", alignItems:"center", justifyContent:"center"}}>
          <div style={{background:bg2, border:"1px solid "+border, borderRadius:"12px",
            padding:"1.5rem", maxWidth:"380px", width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{fontSize:"1rem", fontWeight:"700", color:text1, marginBottom:"0.5rem"}}>Delete Question?</div>
            <div style={{fontSize:"0.82rem", color:"#6b89b8", marginBottom:"1.25rem", lineHeight:1.5}}>
              This will permanently remove the question from your bank. This cannot be undone.
            </div>
            <div style={{display:"flex", gap:"0.75rem"}}>
              <button onClick={async () => {
                await deleteQuestion(confirmDelete.id);
                setBank(prev => prev.filter(q => q.id !== confirmDelete.id));
                setConfirmDelete(null);
                showToast("Question deleted");
              }} style={{flex:1, padding:"0.5rem", background:"#7c2d12", color:"#9B1C1C",
                border:"1px solid #f8717144", borderRadius:"6px", cursor:"pointer", fontWeight:"600", fontSize:"0.82rem"}}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(null)}
                style={{flex:1, padding:"0.5rem", background:"transparent", color:"#6b89b8",
                  border:"1px solid "+border, borderRadius:"6px", cursor:"pointer", fontSize:"0.82rem"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={S.main}>

        {/* â”€â”€ DASHBOARD â”€â”€ */}
        {screen === "home" && (
          <HomeScreen
            screen={screen}
            exportHighlight={exportHighlight}
            setScreen={setScreen}
            setExportHighlight={setExportHighlight}
            lastGenerated={lastGenerated}
            bankLoaded={bankLoaded}
            bank={bank}
            course={course}
            savedExams={savedExams}
            bankIssueCount={bankIssueCount}
            setFilterIssuesOnly={setFilterIssuesOnly}
            allCourses={allCourses}
            courseColors={courseColors}
            setCourse={setCourse}
            setSelectedSections={setSelectedSections}
            setSectionCounts={setSectionCounts}
            setSectionConfig={setSectionConfig}
            customCourses={customCourses}
            saveCustomCourse={saveCustomCourse}
            deleteCustomCourse={deleteCustomCourse}
            isAdmin={isAdmin}
            accent={accent}
          />
        )}



        {/* GENERATE */}
        {screen === "generate" && (
          <GenerateScreen
            setScreen={setScreen}
            course={course}
            setCourse={setCourse}
            allCourses={allCourses}
            selectedSections={selectedSections}
            setSelectedSections={setSelectedSections}
            sectionCounts={sectionCounts}
            setSectionCounts={setSectionCounts}
            sectionConfig={sectionConfig}
            setSectionConfig={setSectionConfig}
            totalQ={totalQ}
            chapters={chapters}
            toggleChapter={toggleChapter}
            toggleSection={toggleSection}
            bank={bank}
            getSectionConfig={getSectionConfig}
            setSectionDiff={setSectionDiff}
            qType={qType}
            setQType={setQType}
            diff={diff}
            generateConfirm={generateConfirm}
            setGenerateConfirm={setGenerateConfirm}
            isGenerating={isGenerating}
            triggerGenerate={triggerGenerate}
            autoGenerate={autoGenerate}
            courseObject={courseObject}
            setPasteInput={setPasteInput}
            generateError={generateError}
            pendingType={pendingType}
            generatedPrompt={generatedPrompt}
            isAdmin={isAdmin}
            pasteInput={pasteInput}
            pasteError={pasteError}
            handlePaste={handlePaste}
            setPendingType={setPendingType}
            setGeneratedPrompt={setGeneratedPrompt}
            accent={accent}
          />
        )}


        {/* REVIEW */}
        {screen === "review" && (
          <ReviewScreen
            setScreen={setScreen}
            lastGenerated={lastGenerated}
            setSelectedForExam={setSelectedForExam}
            dupWarnings={dupWarnings}
            validateQuestion={validateQuestion}
            courseColors={courseColors}
            accent={accent}
          />
        )}

        {/* BANK */}
        {screen === "bank" && (
          <div>
            <div style={{...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap"}}>
              <div>
                <h1 style={S.h1}>Question Bank</h1>
                <p style={S.sub}>{bank.length} questions saved{bankIssueCount > 0 ? ` Â· âš ï¸ ${bankIssueCount} with issues` : " Â· âœ“ all valid"}.</p>
              </div>
              <div style={{display:"flex", gap:"0.5rem", flexShrink:0}}>
                <button style={{...S.ghostBtn(bankCompact ? accent : text3), fontSize:"0.75rem"}} onClick={() => setBankCompact(p => !p)}>
                  {bankCompact ? "â‰¡ Compact" : "â˜° Compact"}
                </button>
                {isAdmin && (
                  <button style={{...S.ghostBtn("#f59e0b"), fontSize:"0.75rem"}} onClick={async () => {
                    const frQs = bank.filter(q => (q.type === "Free Response" || q.type === "Short Answer") && q.explanation);
                    if (!frQs.length) { showToast("No Free Response explanations to clean."); return; }
                    if (!window.confirm(`Clean prose from explanations of ${frQs.length} Free Response questions? This rewrites their explanation field in Supabase.`)) return;
                    let cleaned = 0;
                    for (const q of frQs) {
                      const original = q.explanation;
                      const lines = mathStepsOnly(original);
                      const newExpl = lines.join("\n");
                      if (newExpl !== original) {
                        const updated = { ...q, explanation: newExpl };
                        await saveQuestion(updated);
                        setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                        cleaned++;
                      }
                    }
                    showToast(`Cleaned ${cleaned} explanation${cleaned !== 1 ? "s" : ""} âœ“`);
                  }}>ðŸ§¹ Clean Explanations</button>
                )}
                <button style={{...S.oBtn(text2), fontSize:"0.75rem"}} onClick={() => setScreen("generate")}>+ Generate More</button>
                <button style={{...S.btn("#8b5cf6", false), fontSize:"0.75rem"}} onClick={() => {
                  const ids = lastGenerated.map(q => q.id).filter(Boolean);
                  if (ids.length) setSelectedForExam(prev => [...new Set([...prev, ...ids])]);
                  setScreen("versions");
                }}>Build Exam â†’</button>
              </div>
            </div>

            {/* Tab switcher */}
            <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.5rem", borderBottom:"1px solid "+border, paddingBottom:"0"}}>
              {[{id:"browse",label:"Browse Questions"},{id:"history",label:"Generation History"}].map(tab => (
                <button key={tab.id}
                  style={{
                    background:"transparent", border:"none", color: bankTabState===tab.id ? accent : text2,
                    fontSize:"0.85rem", fontWeight: bankTabState===tab.id ? "600" : "400",
                    padding:"0.5rem 0.25rem", cursor:"pointer",
                    borderBottom: "2px solid "+(bankTabState===tab.id ? accent : "transparent"),
                    marginBottom:"-1px", fontFamily:"'Inter',system-ui,sans-serif"
                  }}
                  onClick={() => setBankTabState(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* â”€â”€ BROWSE TAB â”€â”€ */}
            {bankTabState === "browse" && (<>

            {/* Bulk select toolbar */}
            <div style={{display:"flex", gap:"0.5rem", alignItems:"center", marginBottom:"0.75rem", flexWrap:"wrap"}}>
              <button style={S.ghostBtn(bankSelectMode ? "#f87171" : text2)}
                onClick={() => { setBankSelectMode(!bankSelectMode); setBankSelected(new Set()); }}>
                {bankSelectMode ? `âœ• Cancel Select (${bankSelected.size} selected)` : "â˜‘ Select to Delete"}
              </button>
              {isAdmin && !bankSelectMode && (
                <button style={S.ghostBtn("#8b5cf6")} onClick={async () => {
                  const graphQs = bank.filter(q => q.hasGraph && q.graphConfig && (q.graphConfig.title || q.graphConfig.probability));
                  if (graphQs.length === 0) { showToast("No titles/labels to clean up âœ“"); return; }
                  if (!window.confirm(`Strip title and probability labels from ${graphQs.length} graph question(s)? This makes them cleaner in Canvas.`)) return;
                  let cleaned = 0;
                  for (const q of graphQs) {
                    const { title, probability, ...cleanConfig } = q.graphConfig;
                    const updated = { ...q, graphConfig: cleanConfig };
                    await saveQuestion(updated);
                    setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                    cleaned++;
                  }
                  showToast(`âœ“ Cleaned ${cleaned} graph question${cleaned>1?"s":""}`);
                }}>ðŸ§¹ Clean graph titles</button>
              )}
              {bankSelectMode && bankSelected.size > 0 && (
                <>
                  <button style={S.ghostBtn("#f87171")} onClick={async () => {
                    if (!window.confirm(`Delete ${bankSelected.size} questions? This cannot be undone.`)) return;
                    for (const id of bankSelected) await deleteQuestion(id);
                    setBank(prev => prev.filter(q => !bankSelected.has(q.id)));
                    setBankSelected(new Set()); setBankSelectMode(false);
                  }}>ðŸ—‘ Delete {bankSelected.size} questions</button>
                  <button style={S.ghostBtn("#10b981")} onClick={() => {
                    const selectedQs = bank.filter(q => bankSelected.has(q.id));
                    if (!selectedQs.length) return;
                    const secCfg = {};
                    selectedQs.forEach(q => {
                      const sec = q.section || "Unknown";
                      if (!secCfg[sec]) secCfg[sec] = { Easy:{count:0,graphType:"normal"}, Medium:{count:0,graphType:"normal"}, Hard:{count:0,graphType:"normal"} };
                      const diff = q.difficulty || "Medium";
                      if (secCfg[sec][diff]) secCfg[sec][diff].count++;
                      if (q.hasGraph) secCfg[sec][diff].graphType = "graph";
                    });
                    const sections = Object.keys(secCfg);
                    const qType = selectedQs[0].type || "Multiple Choice";
                    const prompt = buildGeneratePrompt(course, sections, {}, qType, null, secCfg, courseObject);
                    setBulkReplacePrompt(prompt);
                    setBulkReplaceIds(new Set(bankSelected));
                    setBulkReplacePaste(""); setBulkReplaceError("");
                  }}>ðŸ”„ Replace {bankSelected.size} with new</button>
                  <button style={S.ghostBtn(text2)} onClick={() => {
                    const ids = new Set(filteredBank.map(q => q.id));
                    setBankSelected(ids);
                  }}>Select all {filteredBank.length} shown</button>
                </>
              )}
            </div>

            {/* Bulk replace prompt + paste panel */}
            {bulkReplacePrompt && (
              <div style={{background:bg2, border:"1px solid #10b98144", borderRadius:"10px", padding:"1rem", marginBottom:"1rem"}}>
                <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"600", marginBottom:"0.5rem"}}>
                  ðŸ”„ Replace {bulkReplaceIds.size} questions â€” copy prompt to Claude, paste response back:
                </div>
                <div style={{...S.promptBox, maxHeight:"140px"}}>{bulkReplacePrompt}</div>
                <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                  <button style={{...S.oBtn("#10b981"), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                    onClick={() => navigator.clipboard.writeText(bulkReplacePrompt)}>ðŸ“‹ Copy Prompt</button>
                  {isAdmin && <button style={{...S.btn("#10b981", autoGenLoading), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                    disabled={autoGenLoading}
                    onClick={async () => {
                      setAutoGenLoading(true); setAutoGenError("");
                      try {
                        const res = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt:bulkReplacePrompt}) });
                        if (!res.ok) throw new Error(`API error: ${res.status}`);
                        const data = await res.json();
                        const text = data.content?.[0]?.text || data.text || "";
                        if (!text) throw new Error("Empty response.");
                        setBulkReplacePaste(text);
                      } catch(e) { setBulkReplaceError(e.message); }
                      finally { setAutoGenLoading(false); }
                    }}>{autoGenLoading ? "â³ Generating..." : "âš¡ Auto-Generate"}</button>}
                  <button style={{...S.ghostBtn(text3), fontSize:"0.68rem"}}
                    onClick={() => { setBulkReplacePrompt(""); setBulkReplaceIds(new Set()); setBulkReplacePaste(""); setBulkReplaceError(""); }}>Cancel</button>
                </div>
                {bulkReplaceError && <div style={{color:"#f87171", fontSize:"0.75rem", marginBottom:"0.5rem"}}>{bulkReplaceError}</div>}
                <textarea
                  value={bulkReplacePaste}
                  onChange={e => setBulkReplacePaste(e.target.value)}
                  placeholder="Paste Claude's JSON response here..."
                  style={{...S.textarea, minHeight:"80px", marginBottom:"0.5rem"}}
                />
                <button style={S.btn("#10b981", !bulkReplacePaste.trim())} disabled={!bulkReplacePaste.trim()}
                  onClick={async () => {
                    setBulkReplaceError("");
                    try {
                      const match = bulkReplacePaste.match(/\[[\s\S]*\]/);
                      if (!match) throw new Error("No JSON array found. Copy the full response.");
                      const parsed = JSON.parse(match[0]);
                      const sanitize = (q) => ({ ...q, type:q.type||"Multiple Choice", difficulty:q.difficulty||"Medium", question:q.question||"", answer:q.answer||"", choices:(q.choices||[]).map(c=>c??""), explanation:q.explanation||"" });
                      const tagged = parsed.map(q => ({ ...sanitize(q), id:uid(), course, createdAt:Date.now() }));
                      // Delete old questions
                      for (const id of bulkReplaceIds) await deleteQuestion(id);
                      setBank(prev => prev.filter(q => !bulkReplaceIds.has(q.id)));
                      // Save new questions
                      for (const q of tagged) await saveQuestion(q);
                      setBank(prev => [...tagged, ...prev]);
                      setFilterTime("All"); setFilterDay("All");
                      setBankSelected(new Set()); setBankSelectMode(false);
                      setBulkReplacePrompt(""); setBulkReplaceIds(new Set()); setBulkReplacePaste("");
                      showToast(`âœ“ ${tagged.length} questions replaced successfully`, "success");
                    } catch(e) { setBulkReplaceError(e.message || "Failed to parse response."); }
                  }}>âœ“ Submit Replacement</button>
              </div>
            )}

            <div style={{marginBottom:"0.75rem"}}>
              <input
                value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                placeholder="ðŸ”  Search questions, answers, sections..."
                style={{width:"100%", padding:"0.5rem 0.75rem", background:bg2,
                  border:"1px solid "+border, color:text1, borderRadius:"8px",
                  fontSize:"0.83rem", boxSizing:"border-box", outline:"none"}}
              />
            </div>
            <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
              <select style={{...S.sel, width:"155px"}} value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterSection("All"); }}>
                <option>All</option>{Object.keys(allCourses).map(c => <option key={c}>{c}</option>)}
              </select>
              {filterCourse !== "All" && (
                <select style={{...S.sel, width:"220px"}} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                  <option value="All">All Sections</option>
                  {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <select style={{...S.sel, width:"145px"}} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option>All</option>{QTYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select style={{...S.sel, width:"130px"}} value={filterDiff} onChange={e => setFilterDiff(e.target.value)}>
                <option>All</option>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
              <select style={{...S.sel, width:"175px"}} value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth("All"); setFilterDay("All"); setFilterTime("All"); }}>
                <option value="All">All Years</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {filterYear !== "All" && (
                <select style={{...S.sel, width:"145px"}} value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDay("All"); setFilterTime("All"); }}>
                  <option value="All">All Months</option>
                  {availableMonths.map(m => <option key={m} value={m}>{MONTHS[parseInt(m)]}</option>)}
                </select>
              )}
              {filterYear !== "All" && filterMonth !== "All" && (
                <select style={{...S.sel, width:"120px"}} value={filterDay} onChange={e => { setFilterDay(e.target.value); setFilterTime("All"); }}>
                  <option value="All">All Days</option>
                  {availableDays.map(d => <option key={d} value={d}>Day {d}</option>)}
                </select>
              )}
              {filterYear !== "All" && filterMonth !== "All" && filterDay !== "All" && (
                <select style={{...S.sel, width:"130px"}} value={filterTime} onChange={e => setFilterTime(e.target.value)}>
                  <option value="All">All Times</option>
                  {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <span style={{fontSize:"0.78rem", color:text2, alignSelf:"center"}}>{filteredBank.length} matching</span>
              {selectedForExam.length > 0 && (
                <span style={{
                  display:"inline-flex", alignItems:"center", gap:"0.3rem",
                  fontSize:"0.75rem", fontWeight:"700", color:"#fff",
                  background:"#e11d48", borderRadius:"999px",
                  padding:"0.18rem 0.65rem", alignSelf:"center",
                  boxShadow:"0 1px 4px "+accent+"55"
                }}>
                  âœ“ {selectedForExam.length} selected for exam
                  <span
                    title="Clear selection"
                    onClick={() => setSelectedForExam([])}
                    style={{cursor:"pointer", marginLeft:"2px", opacity:0.75, fontWeight:"400", fontSize:"0.72rem"}}>âœ•</span>
                </span>
              )}
              {bankIssueCount > 0 && (
                <button
                  style={{...S.ghostBtn(filterIssuesOnly ? "#f87171" : text3), alignSelf:"center", border: filterIssuesOnly ? "1px solid #f8717144" : "1px solid "+border}}
                  onClick={() => setFilterIssuesOnly(p => !p)}>
                  {filterIssuesOnly ? "âš  Issues only âœ•" : `âš  Show ${bankIssueCount} with issues`}
                </button>
              )}
              {bankDupCount > 0 && (
                <span style={{fontSize:"0.72rem", color:"#f59e0b", alignSelf:"center", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.18rem 0.5rem"}}>
                  âš  {bankDupCount} possible duplicate{bankDupCount>1?"s":""}
                </span>
              )}
            </div>

            {!bankLoaded && <div style={{color:text2}}>Loading from databaseâ€¦</div>}
            {bankLoaded && bank.length === 0 && (
              <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
                <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>ðŸ“­</div>
                <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>Your bank is empty</div>
                <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
                  Generate your first questions to get started.<br/>
                  Choose a course, pick sections, and copy the prompt to Claude.
                </div>
                <button style={S.btn(accent, false)} onClick={() => setScreen("generate")}>
                  âœ¦ Generate Questions
                </button>
              </div>
            )}
            {bankLoaded && bank.length > 0 && filteredBank.length === 0 && (
              <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
                {bank.length === 0 ? "No questions yet. Go to Generate." : "No questions match filters."}
              </div>
            )}

            {bankCompact ? (
              <div style={{border:"1px solid "+border, borderRadius:"10px", overflow:"hidden"}}>
                {filteredBank.map((q, qi) => {
                  const inExam = selectedForExam.includes(q.id);
                  const used = usedInExams[q.id] || 0;
                  const issues = validateQuestion(q);
                  return (
                    <div key={q.id} style={{
                      display:"flex", alignItems:"center", gap:"0.6rem",
                      padding:"0.45rem 0.75rem",
                      borderBottom: qi < filteredBank.length-1 ? "1px solid "+border+"55" : "none",
                      background: inExam ? "#fff1f2" : qi%2===0 ? "transparent" : "#ffffff04",
                      borderLeft: inExam ? "4px solid #e11d48" : "4px solid transparent",
                    }}>
                      <span style={{...S.diffTag(q.difficulty||""), flexShrink:0, fontSize:"0.58rem", padding:"0.05rem 0.3rem"}}>{(q.difficulty||"?")[0]}</span>
                      <span style={{fontSize:"0.68rem", color:text3, flexShrink:0, minWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{(q.section||"").split(" ").slice(0,3).join(" ")}</span>
                      <span style={{flex:1, fontSize:"0.8rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                        {q.type==="Branched" ? q.stem : q.question}
                      </span>
                      {used > 0 && <span style={{fontSize:"0.62rem", color:"#06b6d4", flexShrink:0}}>ðŸ“‹Ã—{used}</span>}
                      {issues.length > 0 && <span style={{fontSize:"0.62rem", color:"#f87171", flexShrink:0}}>âš </span>}
                      <button style={{...S.smBtn, flexShrink:0, color:inExam?"#e11d48":text3, border:"1px solid "+(inExam?"#e11d4844":border)}}
                        onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id=>id!==q.id) : [...p,q.id])}>
                        {inExam?"âœ“":"+"}</button>
                      <button style={{...S.smBtn, flexShrink:0, color:"#7C3AED", border:"1px solid #a78bfa33"}}
                        onClick={() => { setInlineEditQId(inlineEditQId===q.id?null:q.id); setGraphEditorQId(null); }}>âœ</button>
                      <button style={{...S.smBtn, flexShrink:0, color:"#f87171", border:"1px solid #f8717133"}}
                        onClick={() => setConfirmDelete({id:q.id, label:(q.question||q.stem||"").slice(0,60)})}>âœ•</button>
                    </div>
                  );
                })}
              </div>
            ) : filteredBank.map(q => {
              const inExam = selectedForExam.includes(q.id);
              return (
              <div key={q.id} style={{
                ...S.qCard,
                borderColor: inExam ? "#e11d48" : border,
                borderLeftWidth: inExam ? "4px" : "1px",
                background: inExam ? "#fff1f2" : bg1,
                boxShadow: inExam ? "0 0 0 1px #e11d4833, 0 2px 8px #e11d4822" : S.qCard.boxShadow,
              }}>
                <div style={S.qMeta}>
                  <span style={S.tag(courseColors[q.course])}>{q.course}</span>
                  <span style={S.tag()}>{q.type}</span>
                  <span style={S.tag()}>{q.section}</span>
                  <span style={S.tag()}>{q.difficulty}</span>
                  {usedInExams[q.id] > 0 && (
                    <span title={`Used in ${usedInExams[q.id]} saved exam${usedInExams[q.id]>1?"s":""}`}
                      style={{...S.tag(), background:"#06b6d415", color:"#06b6d4", border:"1px solid #06b6d433"}}>
                      ðŸ“‹ Ã—{usedInExams[q.id]}
                    </span>
                  )}
                  {duplicateIds.has(q.id) && (
                    <span title="Possible duplicate â€” similar question exists in same section"
                      style={{...S.tag(), background:"#f59e0b15", color:"#f59e0b", border:"1px solid #f59e0b44"}}>
                      âš  dup
                    </span>
                  )}
                  {bankSelectMode && (
                    <input type="checkbox" checked={bankSelected.has(q.id)}
                      onChange={e => { const s = new Set(bankSelected); e.target.checked ? s.add(q.id) : s.delete(q.id); setBankSelected(s); }}
                      style={{accentColor:"#f87171", width:"15px", height:"15px", marginLeft:"auto", cursor:"pointer"}} />
                  )}
                  {!bankSelectMode && (
                    <button style={{...S.smBtn, marginLeft:"auto", color:"#f87171", border:"1px solid #f8717144"}}
                      onClick={() => setConfirmDelete({id: q.id, label: (q.question||q.stem||"").slice(0,60)})}>
                      âœ•
                    </button>
                  )}
                  <button style={{...S.smBtn, color:"#f59e0b", border:"1px solid #f59e0b44"}}
                    onClick={() => {
                      const prompt = buildReplacePrompt(q, "numbers");
                      setGeneratedPrompt(prompt);
                      setPendingType("bank_replace"); setPendingMeta({qId: q.id}); setPasteInput(""); setPasteError("");
                    }}>â†»</button>
                  <button style={{...S.smBtn, color:"#185FA5", border:"1px solid #60a5fa44"}}
                    onClick={() => { setGraphEditorQId(graphEditorQId === q.id ? null : q.id); setInlineEditQId(null); }}>
                    ðŸ“ˆ{q.hasGraph ? " Edit" : " Graph"}
                  </button>
                  <button style={{...S.smBtn, color: inlineEditQId===q.id ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                    onClick={() => { setInlineEditQId(inlineEditQId===q.id ? null : q.id); setGraphEditorQId(null); }}>
                    âœï¸ Edit
                  </button>
                  <button style={{...S.smBtn, color:inExam?"#e11d48":text2, border:"1px solid "+(inExam?"#e11d4844":border)}}
                    onClick={() => setSelectedForExam(p => p.includes(q.id) ? p.filter(id => id !== q.id) : [...p, q.id])}>
                    {inExam ? "âœ“ In exam" : "+ Exam"}
                  </button>
                </div>

                {q.hasGraph && q.graphConfig && graphEditorQId !== q.id && (
                  <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
                )}
                {graphEditorQId === q.id && (
                  <GraphEditor
                    initialConfig={q.graphConfig || null}
                    onSave={async (cfg) => {
                      const updated = { ...q, hasGraph: true, graphConfig: cfg };
                      await saveQuestion(updated);
                      setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                      setGraphEditorQId(null);
                      showToast("Graph saved âœ“");
                    }}
                    onRemove={async () => {
                      const updated = { ...q, hasGraph: false, graphConfig: null };
                      await saveQuestion(updated);
                      setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                      setGraphEditorQId(null);
                    }}
                    onClose={() => setGraphEditorQId(null)}
                  />
                )}
                {inlineEditQId === q.id && (
                  <InlineEditor
                    q={q}
                    onSave={async (updated) => {
                      await saveQuestion(updated);
                      setBank(prev => prev.map(bq => bq.id === q.id ? updated : bq));
                      setInlineEditQId(null);
                      showToast("Question saved âœ“");
                    }}
                    onClose={() => setInlineEditQId(null)}
                  />
                )}
                {q.type === "Branched" ? (
                  <>
                    <div style={{...S.qText, color:accent+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                    {(q.parts||[]).map((p,pi) => (
                      <div key={pi} style={{marginBottom:"0.5rem", paddingLeft:"0.75rem", borderLeft:"2px solid "+border}}>
                        <div style={{fontSize:"0.7rem", color:text3, marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                        <div style={{...S.qText, marginBottom:"0.2rem"}}><MathText>{p.question}</MathText></div>
                        {p.answer && <div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                    {q.choices && <ul style={S.cList}>{q.choices.map((c,ci) => <li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                    {q.answer && <div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                    {q.explanation && <div style={S.expl}>ðŸ’¡ <MathText>{q.explanation}</MathText></div>}
                  </>
                )}

                {/* Inline bank replace panel */}
                {pendingType === "bank_replace" && pendingMeta?.qId === q.id && generatedPrompt && (
                  <div style={{marginTop:"0.75rem", borderTop:"1px solid #f59e0b33", paddingTop:"0.75rem"}}>
                    <div style={{fontSize:"0.72rem", color:"#f59e0b", fontWeight:"600", marginBottom:"0.4rem"}}>
                      â†» Replace this question â€” copy prompt to Claude, paste response back:
                    </div>
                    <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.35rem", flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.65rem", color:text3, alignSelf:"center"}}>Regenerate:</span>
                      <button style={S.ghostBtn("#f59e0b")} onClick={() => { const p = buildReplacePrompt(q,"numbers"); setGeneratedPrompt(p); }}>Same type</button>
                      <button style={S.ghostBtn("#e879f9")} onClick={() => { const p = buildReplacePrompt(q,"function"); setGeneratedPrompt(p); }}>Diff. function</button>
                    </div>
                    {(q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II" || q.hasGraph) && (
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap", paddingTop:"0.35rem", borderTop:"1px solid "+border}}>
                        <span style={{fontSize:"0.65rem", color:text3, alignSelf:"center"}}>Convert to:</span>
                        {!q.hasGraph && (
                          <button style={S.ghostBtn("#10b981")} onClick={() => { const p = buildConvertPrompt(q,"graph"); setGeneratedPrompt(p); }}>ðŸ“ˆ Graph</button>
                        )}
                        {q.hasGraph && (
                          <button style={S.ghostBtn("#94a3b8")} onClick={() => { const p = buildConvertPrompt(q,"text"); setGeneratedPrompt(p); }}>ðŸ“ Text only</button>
                        )}
                        {(q.course === "Quantitative Methods I" || q.course === "Quantitative Methods II") && (<>
                          {!q.hasGraph && <button style={S.ghostBtn("#185FA5")} onClick={() => { const p = buildConvertPrompt(q,"table"); setGeneratedPrompt(p); }}>ðŸ“Š Table</button>}
                          {q.hasGraph && <button style={S.ghostBtn("#185FA5")} onClick={() => { const p = buildConvertPrompt(q,"table"); setGeneratedPrompt(p); }}>ðŸ“Š Table</button>}
                        </>)}
                      </div>
                    )}
                    <div style={{display:"flex", justifyContent:"flex-end"}}>
                      <button style={{...S.ghostBtn(text3), fontSize:"0.68rem"}} onClick={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}>Cancel</button>
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    {isAdmin && <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.5rem", flexWrap:"wrap"}}>
                      <button style={{...S.oBtn("#f59e0b"), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                        onClick={() => navigator.clipboard.writeText(generatedPrompt)}>ðŸ“‹ Copy Prompt</button>
                      <button style={{...S.btn("#10b981", autoGenLoading), fontSize:"0.72rem", padding:"0.3rem 0.7rem"}}
                        disabled={autoGenLoading}
                        onClick={() => autoGenerateVersions(generatedPrompt, "bank_replace", pendingMeta)}>
                        {autoGenLoading ? "â³ Generating..." : "âš¡ Auto-Generate"}
                      </button>
                    </div>}
                    <PastePanel
                      label="Paste the replacement question JSON here."
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError}
                      handlePaste={async () => {
                        setPasteError("");
                        try {
                          const raw = pasteInput.trim();
                          const match = raw.match(/\[[\s\S]*\]/);
                          if (!match) throw new Error("No JSON array found.");
                          const parsed = JSON.parse(match[0]);
                          const newQ = { ...parsed[0], id: q.id, course: q.course, section: q.section, createdAt: Date.now() };
                          await saveQuestion(newQ);
                          setBank(prev => prev.map(bq => bq.id === q.id ? newQ : bq));
                          setPendingType(null); setPasteInput(""); setGeneratedPrompt("");
                        } catch(e) { setPasteError("Error: " + e.message); }
                      }}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </div>
                )}

                {/* Inline mutation selector â€” only shown when question is selected for exam */}
                {inExam && (
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginTop:"0.6rem", paddingTop:"0.6rem", borderTop:"1px solid "+accent+"33"}}>
                    <span style={{fontSize:"0.68rem", color:accent, fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase"}}>Mutation:</span>
                    <button
                      style={{...S.smBtn, background:(mutationType[q.id]||"numbers")==="numbers"?accent+"22":"transparent", color:(mutationType[q.id]||"numbers")==="numbers"?accent:text2, border:"1px solid "+((mutationType[q.id]||"numbers")==="numbers"?accent+"66":border)}}
                      onClick={() => setMutationType(p => ({...p,[q.id]:"numbers"}))}>
                      numbers
                    </button>
                    <button
                      style={{...S.smBtn, background:mutationType[q.id]==="function"?"#8b5cf622":"transparent", color:mutationType[q.id]==="function"?"#8b5cf6":text2, border:"1px solid "+(mutationType[q.id]==="function"?"#8b5cf666":border)}}
                      onClick={() => setMutationType(p => ({...p,[q.id]:"function"}))}>
                      function
                    </button>
                  </div>
                )}
              </div>
              );
            })}
            {/* end bankCompact ternary */}

            {selectedForExam.length > 0 && (
              <div style={{...S.card, borderColor:accent+"44", marginTop:"1.5rem"}}>
                <div style={{display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap", marginBottom:"0.75rem"}}>
                  <span style={{fontSize:"0.78rem", color:accent, fontWeight:"bold"}}>
                    {selectedForExam.length} question{selectedForExam.length!==1?"s":""} selected
                  </span>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"0.72rem", color:text2}}>Versions per class:</span>
                    <select style={{...S.sel, width:"130px", padding:"0.4rem 0.6rem"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} version{n>1?"s":""}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                    <span style={{fontSize:"0.72rem", color:text2}}>Classroom sections:</span>
                    <input
                      type="number" min={1} max={10} value={numClassSections}
                      onChange={e => setNumClassSections(Math.max(1, parseInt(e.target.value)||1))}
                      style={{width:"52px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}}
                    />
                  </div>
                </div>

                {/* Per-section build buttons */}
                <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.5rem"}}>
                  <button style={S.btn(accent, false)} onClick={() => setScreen("versions")}>
                    âœ¦ Build Exam â†’
                  </button>
                  {Object.keys(classSectionVersions).length > 0 && (
                    <button style={{...S.oBtn("#10b981")}} onClick={() => setScreen("versions")}>
                      ðŸ“‹ View Versions
                    </button>
                  )}
                </div>
                <div style={{fontSize:"0.68rem", color:text3}}>
                  {numClassSections > 1
                    ? "Section 1: numbers mutation (same time). Section 2+: function mutation (different time)."
                    : "Tip: set numbers/function mutation on each question card above â†‘"}
                </div>

                {/* Prompt + paste panel â€” appears after Build is clicked */}
                {(pendingType === "version_all" || pendingType === "version_all_sections") && generatedPrompt && (
                  <div style={{marginTop:"1rem"}}>
                    <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                      ðŸ“‹ {pendingType === "version_all_sections"
                        ? `Copy this prompt â€” generates ALL ${pendingMeta?.numClassSections} sections Ã— ${pendingMeta?.labels?.join(", ")} versions in one go:`
                        : `Copy this prompt â€” generates ${pendingMeta?.labels?.join(", ")} versions:`}
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                      <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                        disabled={autoGenLoading}
                        onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                        {autoGenLoading ? "â³ Generating..." : "âš¡ Generate Versions"}
                      </button>
                      {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                        Copy Prompt
                      </button>}
                    </div>
                    {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                    <PastePanel
                      label={pendingType === "version_all_sections"
                        ? `Paste the JSON object with all section+version keys ({"S1_A":[...], "S1_B":[...], "S2_A":[...], ...}) here.`
                        : `Paste the JSON object with all versions ({"A":[...], "B":[...], ...}) here.`}
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError} handlePaste={handlePaste}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </div>
                )}
              </div>
            )}
            </>)}

            {/* â”€â”€ HISTORY TAB â”€â”€ */}
            {bankTabState === "history" && (() => {
              // Group questions by date batch (same createdAt minute = same batch)
              const batches = [];
              const seen = new Set();
              [...bank].sort((a,b) => b.createdAt - a.createdAt).forEach(q => {
                const minute = Math.floor((q.createdAt||0) / 60000);
                const key = `${q.course}__${minute}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  batches.push({
                    key,
                    course: q.course,
                    minute,
                    createdAt: q.createdAt,
                    questions: bank.filter(bq => {
                      const bMinute = Math.floor((bq.createdAt||0) / 60000);
                      return bq.course === q.course && bMinute === minute;
                    })
                  });
                }
              });

              if (batches.length === 0) return (
                <div style={{...S.card, textAlign:"center", color:text3, padding:"3rem"}}>
                  No generation history yet. Generate questions to see batches here.
                </div>
              );

              return (
                <div>
                  {batches.map((batch, bi) => {
                    const color = courseColors[batch.course] || accent;
                    const sections = [...new Set(batch.questions.map(q => q.section).filter(Boolean))];
                    const date = new Date(batch.createdAt);
                    const dateStr = date.toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
                    const timeStr = date.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"});
                    const expanded = expandedBatches[batch.key] || false;
                    const toggleExpand = () => setExpandedBatches(prev => ({...prev, [batch.key]: !prev[batch.key]}));
                    return (
                      <div key={batch.key} style={{...S.card, borderLeft:`3px solid ${color}`, marginBottom:"0.75rem"}}>
                        <div style={{display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem"}}>
                              <div style={{width:"8px", height:"8px", borderRadius:"50%", background:color, flexShrink:0}}/>
                              <span style={{fontSize:"0.85rem", fontWeight:"600", color:text1}}>{batch.course}</span>
                              <span style={S.tag(color)}>{batch.questions.length} questions</span>
                            </div>
                            <div style={{fontSize:"0.72rem", color:text2, marginBottom:"0.25rem"}}>
                              {dateStr} Â· {timeStr}
                            </div>
                            <div style={{fontSize:"0.7rem", color:text3}}>
                              {sections.slice(0,4).join(" Â· ")}{sections.length > 4 ? ` +${sections.length-4} more` : ""}
                            </div>
                          </div>
                          <div style={{display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap"}}>
                            <button style={S.ghostBtn(color)}
                              onClick={() => toggleExpand()}>
                              {expanded ? "â–² Hide" : "â–¼ Show"} questions
                            </button>
                            <button style={S.ghostBtn(text2)}
                              onClick={() => {
                                setSelectedForExam(prev => {
                                  const ids = batch.questions.map(q => q.id);
                                  const allIn = ids.every(id => prev.includes(id));
                                  return allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])];
                                });
                                setTimeout(() => setScreen("versions"), 0);
                              }}>
                              + Add to Exam
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div style={{marginTop:"0.75rem", borderTop:"1px solid "+border, paddingTop:"0.75rem"}}>
                            {batch.questions.map((q, qi) => (
                              <div key={q.id} style={{padding:"0.4rem 0", borderBottom: qi < batch.questions.length-1 ? "1px solid "+border+"44" : "none", display:"flex", gap:"0.5rem", alignItems:"flex-start"}}>
                                <span style={{...S.diffTag(q.difficulty), flexShrink:0, marginTop:"0.1rem"}}>{(q.difficulty||"?")[0]}</span>
                                <div style={{flex:1, minWidth:0}}>
                                  <div style={{fontSize:"0.75rem", color:text2, marginBottom:"0.1rem"}}>{q.section}</div>
                                  <div style={{fontSize:"0.82rem", color:text1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                                    {q.type==="Branched" ? q.stem : q.question}
                                  </div>
                                </div>
                                <span style={{...S.tag(), flexShrink:0}}>{(q.type||"").split(" ")[0]}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* VERSIONS */}
        {screen === "versions" && (
          <div>
            <div style={S.pageHeader}>
              <h1 style={S.h1}>Exam Builder</h1>
              <p style={S.sub}>{versions.length} version{versions.length !== 1 ? "s" : ""} created{Object.keys(classSectionVersions).length > 1 ? ` Â· ${Object.keys(classSectionVersions).length} classroom sections` : ""}.</p>
            </div>

            {/* Classroom section tabs */}
            {Object.keys(classSectionVersions).length > 1 && (
              <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
                <span style={{fontSize:"0.72rem", color:text2}}>Classroom Section:</span>
                {Object.keys(classSectionVersions).sort().map(sec => (
                  <button key={sec}
                    style={S.vTab(activeClassSection===Number(sec), Number(sec)===1?"#10b981":"#8b5cf6")}
                    onClick={() => { setActiveClassSection(Number(sec)); setVersions(classSectionVersions[sec]); setActiveVersion(0); }}>
                    Section {sec}
                  </button>
                ))}
              </div>
            )}

            {versions.length === 0 && selectedForExam.length === 0 && (
              <>
                <div style={{...S.card, textAlign:"center", padding:"3rem 2rem"}}>
                  <div style={{fontSize:"2.5rem", marginBottom:"1rem"}}>ðŸ“‹</div>
                  <div style={{fontSize:"1rem", fontWeight:"600", color:text1, marginBottom:"0.5rem"}}>No exam built yet</div>
                  <div style={{fontSize:"0.82rem", color:text2, marginBottom:"1.5rem", lineHeight:1.6}}>
                    Select questions from the bank, then click Build Exam here to create multiple versions.
                  </div>
                  <div style={{display:"flex", gap:"0.75rem", justifyContent:"center", flexWrap:"wrap"}}>
                    <button style={S.btn(accent, false)} onClick={() => setScreen("bank")}>â–¦ Browse Question Bank</button>
                    <button style={S.oBtn(text2)} onClick={() => setScreen("generate")}>âœ¦ Generate Questions</button>
                  </div>
                </div>

                {/* â”€â”€ Saved Masters â”€â”€ */}
                {(mastersLoading || savedMasters.length > 0) && (
                  <div style={{...S.card, marginTop:"1rem"}}>
                    <div style={{fontSize:"0.82rem", fontWeight:"700", color:text1, marginBottom:"0.75rem", display:"flex", alignItems:"center", gap:"0.5rem"}}>
                      ðŸ’¾ Saved Masters
                      <button onClick={loadSavedMasters} style={{...S.smBtn, marginLeft:"auto", fontSize:"0.68rem"}}>â†» Refresh</button>
                    </div>
                    {mastersLoading && <div style={{fontSize:"0.78rem", color:text3, textAlign:"center", padding:"1rem"}}>Loadingâ€¦</div>}
                    {!mastersLoading && savedMasters.map(m => (
                      <div key={m.id} style={{display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.6rem 0", borderBottom:"1px solid "+border+"44", flexWrap:"wrap"}}>
                        <div style={{flex:1, minWidth:"150px"}}>
                          <div style={{fontSize:"0.85rem", fontWeight:"600", color:text1}}>{m.name}</div>
                          <div style={{fontSize:"0.68rem", color:text3, marginTop:"0.15rem"}}>
                            {new Date(m.created_at).toLocaleDateString()} Â· {(m.master_questions||[]).length} questions
                            {m.settings?.course ? ` Â· ${m.settings.course}` : ""}
                            {m.settings?.versionCount ? ` Â· ${m.settings.versionCount} variants` : ""}
                          </div>
                        </div>
                        <button
                          style={{...S.btn("#10b981", false), fontSize:"0.78rem", padding:"0.3rem 0.8rem"}}
                          onClick={() => loadMaster(m)}>
                          â–¶ Load
                        </button>
                        <button
                          style={{...S.ghostBtn("#f87171"), fontSize:"0.78rem", padding:"0.3rem 0.7rem"}}
                          onClick={() => deleteSavedMaster(m.id)}>
                          ðŸ—‘
                        </button>
                      </div>
                    ))}
                    {!mastersLoading && savedMasters.length === 0 && (
                      <div style={{fontSize:"0.78rem", color:text3, textAlign:"center", padding:"0.75rem"}}>No saved masters yet.</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* â”€â”€ STAGE 1: Questions selected, ready to create master â”€â”€ */}
            {selectedForExam.length > 0 && (() => {
              const selected = bank
                .filter(q => selectedForExam.includes(q.id))
                .sort((a,b) => {
                  const [aMaj, aMin] = sectionSortKey(a.section);
                  const [bMaj, bMin] = sectionSortKey(b.section);
                  return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
                });
              return (
                <div>
                  <div style={{...S.card, borderColor:accent+"44", marginBottom:"1rem"}}>
                    <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem", flexWrap:"wrap", gap:"0.5rem"}}>
                      <div>
                        <div style={{fontSize:"0.95rem", fontWeight:"600", color:text1, marginBottom:"0.2rem"}}>
                          {selected.length} questions selected
                        </div>
                        <div style={{fontSize:"0.72rem", color:text2}}>
                          {[...new Set(selected.map(q => q.course))].join(", ")} Â· {[...new Set(selected.map(q => q.section))].length} sections
                        </div>
                      </div>
                      <button style={S.ghostBtn("#f87171")} onClick={() => setSelectedForExam([])}>
                        âœ• Clear selection
                      </button>
                    </div>
                    <div style={{display:"flex", flexDirection:"column", gap:"0.3rem", marginBottom:"1rem"}}>
                      {selected.map((q,i) => (
                        <div key={q.id} style={{display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.35rem 0", borderBottom: i < selected.length-1 ? "1px solid "+border+"44" : "none"}}>
                          <span style={S.diffTag(q.difficulty||"")}>{(q.difficulty||"?")[0]}</span>
                          <span style={{...S.tag(courseColors[q.course]), flexShrink:0}}>{(q.section||"").split(" ").slice(0,2).join(" ")}</span>
                          <span style={{fontSize:"0.8rem", color:text2, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                            {q.type==="Branched" ? q.stem : q.question}
                          </span>
                          <button style={{...S.smBtn, color:"#f87171", border:"none", padding:"0.1rem 0.3rem"}}
                            onClick={() => setSelectedForExam(p => p.filter(id => id !== q.id))}>âœ•</button>
                        </div>
                      ))}
                    </div>
                    <button
                      style={{...S.btn("#10b981", false), fontSize:"0.88rem", padding:"0.55rem 1.4rem"}}
                      onClick={() => {
                        setVersions([{ label: "A", questions: selected }]);
                        setActiveVersion(0);
                        setMasterLocked(false);
                      }}>
                      â† Create Master Exam (Version A)
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* â”€â”€ STAGE 2: Master Version A created â€” proof and verify â”€â”€ */}
            {versions.length === 1 && !masterLocked && (() => {
              const v = versions[0];
              return (
                <div>
                  <div style={{background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"8px", padding:"0.75rem 1rem", marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:"0.75rem", flexWrap:"wrap"}}>
                    <span style={{fontSize:"1.1rem"}}>âš ï¸</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:"0.82rem", fontWeight:"600", color:"#f59e0b"}}>Export and proof your master exam before generating variants</div>
                      <div style={{fontSize:"0.72rem", color:text3, marginTop:"0.2rem"}}>Edit any question below, then click â€œMaster Verifiedâ€ when youâ€™re satisfied with Version A.</div>
                    </div>
                  </div>
                  <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                    <button style={S.btn("#10b981", exportLoading !== "")} disabled={exportLoading !== ""} onClick={async () => {
                      setExportLoading("Building Word document...");
                      try {
                        const blob = await buildDocx(v.questions, v.questions[0]?.course||"Calculus", v.label, null);
                        dlBlob(blob, `Version_A_Master_Exam.docx`);
                      } finally { setExportLoading(""); }
                    }}>â¬‡ Word (.docx)</button>
                    <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
                      ðŸ‘ Print Preview
                    </button>
                    <button style={S.oBtn("#f43f5e")} disabled={exportLoading !== ""} onClick={async () => {
                      setExportLoading("Building answer key...");
                      try {
                        const blob = await buildAnswerKey([v], v.questions[0]?.course || "Exam");
                        if (blob) dlBlob(blob, `Version_A_Answer_Key.docx`);
                      } finally { setExportLoading(""); }
                    }}>ðŸ”‘ Answer Key (.docx)</button>
                    <button style={S.oBtn("#8b5cf6")} onClick={async () => {
                      const xml = buildQTI(v.questions, v.questions[0]?.course||"Exam", v.label, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                      const blob = await buildQTIZip(xml, `Version_A`);
                      dlBlob(blob, `Version_A_Canvas_QTI.zip`);
                    }}>â¬‡ QTI (.zip)</button>
                    {exportLoading && <span style={{fontSize:"0.75rem", color:text3, alignSelf:"center"}}>â³ {exportLoading}</span>}
                  </div>
                  {v.questions.map((q,qi) => (
                    <div key={q.id||qi} style={S.qCard}>
                      <div style={S.qMeta}>
                        <span style={{fontWeight:"bold", color:text1}}>Q{qi+1}</span>
                        <span style={S.tag("#f43f5e")}>{q.type}</span>
                        <span style={S.tag()}>{q.section}</span>
                        <span style={S.tag()}>{q.difficulty}</span>
                        <div style={{marginLeft:"auto", display:"flex", gap:"0.3rem"}}>
                          <button style={{...S.smBtn, color: inlineEditQId===`master_${qi}` ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                            onClick={() => setInlineEditQId(inlineEditQId===`master_${qi}` ? null : `master_${qi}`)}>
                            âœï¸
                          </button>
                        </div>
                      </div>
                      {inlineEditQId === `master_${qi}` && (
                        <InlineEditor
                          q={q}
                          onSave={(updated) => {
                            setVersions([{ ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }]);
                            setInlineEditQId(null);
                            showToast("Question updated âœ“");
                          }}
                          onClose={() => setInlineEditQId(null)}
                        />
                      )}
                      {q.type==="Branched" ? (
                        <>
                          <div style={{...S.qText,color:"#f43f5e99"}}>Given: <MathText>{q.stem}</MathText></div>
                          {(q.parts||[]).map((p,pi) => (
                            <div key={pi} style={{marginBottom:"0.6rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                              <div style={{fontSize:"0.7rem",color:text3,marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                              <div style={S.qText}><MathText>{p.question}</MathText></div>
                              {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                              {p.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{p.explanation}</MathText></div>}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div style={S.qText}><MathText>{q.question}</MathText></div>
                          {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                          {q.answer&&<div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                          {q.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{q.explanation}</MathText></div>}
                        </>
                      )}
                    </div>
                  ))}
                  <div style={{marginTop:"1.5rem", padding:"1rem", background:"#052e1688", borderRadius:"8px", border:"1px solid #22c55e44", display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:"0.85rem", fontWeight:"600", color:"#4ade80"}}>Ready to generate variants?</div>
                      <div style={{fontSize:"0.72rem", color:text3, marginTop:"0.2rem"}}>This will lock Version A and let you configure B, C, D variants.</div>
                    </div>
                    <button
                      style={{...S.btn("#10b981", false), fontSize:"0.88rem", padding:"0.55rem 1.4rem"}}
                      onClick={() => setMasterLocked(true)}>
                      âœ… Master Verified â€” Generate Variants
                    </button>
                  </div>

                  {/* â”€â”€ Save Master â”€â”€ */}
                  <div style={{marginTop:"0.75rem", padding:"0.85rem 1rem", background:bg2, borderRadius:"8px", border:"1px solid "+border, display:"flex", alignItems:"center", gap:"0.6rem", flexWrap:"wrap"}}>
                    <span style={{fontSize:"0.75rem", color:text2, fontWeight:"600", whiteSpace:"nowrap"}}>ðŸ’¾ Save Master</span>
                    <input
                      value={masterName}
                      onChange={e => setMasterName(e.target.value)}
                      placeholder="Master name (e.g. Quiz 02 MAT116)"
                      onKeyDown={e => e.key === "Enter" && saveMaster()}
                      style={{flex:1, minWidth:"200px", padding:"0.35rem 0.6rem", background:bg1, border:"1px solid "+border, color:text1, borderRadius:"6px", fontSize:"0.82rem", fontFamily:"inherit"}} />
                    <button
                      onClick={saveMaster}
                      disabled={savingMaster}
                      style={{...S.btn("#4f46e5", savingMaster), fontSize:"0.8rem", padding:"0.35rem 0.9rem", opacity: savingMaster ? 0.6 : 1}}>
                      {savingMaster ? "Savingâ€¦" : "ðŸ’¾ Save Master"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* â”€â”€ STAGE 3: Master verified â€” configure variants â”€â”€ */}
            {versions.length === 1 && masterLocked && (
              <div>
                <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1rem"}}>
                  <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"700", marginBottom:"0.75rem"}}>
                    âœ… Version A locked Â· Now configure variants (B, C, Dâ€¦)
                  </div>
                  <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-end"}}>
                    <div>
                      <div style={S.lbl}>Variants to generate</div>
                      <select style={{...S.sel, width:"160px"}} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
                        {[1,2,3,4,5,6,7].map(n => {
                          const lbls = VERSIONS.slice(1, 1+n);
                          return <option key={n} value={n}>{n} variant{n>1?"s":""} ({lbls.join(", ")})</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <div style={S.lbl}>Classroom sections</div>
                      <input type="number" min={1} max={10} value={numClassSections}
                        style={{...S.input, width:"80px"}}
                        onChange={e => setNumClassSections(Math.max(1, Number(e.target.value)||1))} />
                    </div>
                    <button style={S.btn(accent, false)} onClick={() => {
                      // Stage 3: always use Version A questions directly â€” never re-query bank
                      const masterQs = versions[0].questions;
                      console.log("Stage3 triggerVariants masterQs", masterQs.map(q => ({id:q.id, hasGraph:q.hasGraph, hasGC:!!q.graphConfig})));
                      const varLabels = VERSIONS.slice(1, 1 + versionCount);
                      if (numClassSections > 1) {
                        const prompt = buildAllSectionsPrompt(masterQs, varLabels, numClassSections, course, versionMutationType, courseObject);
                        setGeneratedPrompt(prompt);
                        setPendingType("version_all_sections");
                        setPendingMeta({ selected: masterQs, labels: varLabels, numClassSections, versionMutationType });
                      } else {
                        const prompt = buildAllVersionsPrompt(masterQs, mutationType, varLabels, 1, 1, course, versionMutationType, courseObject);
                        setGeneratedPrompt(prompt);
                        setPendingType("version_all");
                        setPendingMeta({ selected: masterQs, labels: varLabels, mutationType, classSection: 1, versionMutationType });
                      }
                      setPasteInput(""); setPasteError("");
                    }}>
                      â† {numClassSections > 1 ? `Generate All ${numClassSections} Sections` : "Generate Variants"}
                    </button>
                  </div>
                  <div style={{marginTop:"0.75rem"}}>
                    <div style={S.lbl}>Mutation type per version</div>
                    <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.3rem"}}>
                      {VERSIONS.slice(1, 1 + versionCount).map(lbl => {
                        const mut = versionMutationType[lbl] || "numbers";
                        return (
                          <div key={lbl} style={{display:"flex", alignItems:"center", gap:"0.3rem"}}>
                            <span style={{fontSize:"0.72rem", color:text1, fontWeight:"600"}}>Ver {lbl}:</span>
                            <button
                              style={{...S.smBtn, background: mut==="numbers" ? accent+"22" : "transparent", color: mut==="numbers" ? accent : text2, border:"1px solid "+(mut==="numbers" ? accent+"66" : border)}}
                              onClick={() => setVersionMutationType(p => ({...p, [lbl]: "numbers"}))}>
                              numbers
                            </button>
                            <button
                              style={{...S.smBtn, background: mut==="function" ? "#8b5cf622" : "transparent", color: mut==="function" ? "#8b5cf6" : text2, border:"1px solid "+(mut==="function" ? "#8b5cf666" : border)}}
                              onClick={() => setVersionMutationType(p => ({...p, [lbl]: "function"}))}>
                              function
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {pendingType === "version_all" && generatedPrompt && (
                  <>
                    <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                      ðŸ“‹ Copy this prompt â€” paste to Claude â€” paste response back:
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    {(() => {
                      const numQ = pendingMeta?.selected?.length || 0;
                      const numV = pendingMeta?.labels?.length || 0;
                      const ncs = pendingMeta?.numClassSections || 1;
                      const totalVersions = numV * ncs;
                      const cost = (numQ * totalVersions * 400 * 3 / 1_000_000) + (numQ * totalVersions * 350 * 15 / 1_000_000);
                      const label = ncs > 1 ? `${numQ} questions Ã— ${numV} versions Ã— ${ncs} sections` : `${numQ} questions Ã— ${numV} versions`;
                      return <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.5rem"}}>Estimated cost: ~${cost.toFixed(3)} ({label})</div>;
                    })()}
                    <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                      <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                        disabled={autoGenLoading}
                        onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                        {autoGenLoading ? "â³ Generating..." : "âš¡ Generate Variants"}
                      </button>
                      {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
                    </div>
                    {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                    <button id="auto-submit-paste" style={{display:"none"}} onClick={handlePaste} />
                    <PastePanel
                      label="Paste Claude's JSON response here."
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError} handlePaste={handlePaste}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </>
                )}
                {pendingType === "version_all_sections" && generatedPrompt && (
                  <>
                    <div style={{fontSize:"0.78rem", color:accent, fontWeight:"600", marginBottom:"0.5rem"}}>
                      ðŸ“‹ Copy this prompt â€” generates ALL {pendingMeta?.numClassSections} sections Ã— {pendingMeta?.labels?.join(", ")} versions in one go:
                    </div>
                    <div style={S.promptBox}>{generatedPrompt}</div>
                    {(() => {
                      const numQ = pendingMeta?.selected?.length || 0;
                      const numV = pendingMeta?.labels?.length || 0;
                      const ncs = pendingMeta?.numClassSections || 1;
                      const totalVersions = numV * ncs;
                      const cost = (numQ * totalVersions * 400 * 3 / 1_000_000) + (numQ * totalVersions * 350 * 15 / 1_000_000);
                      const label = ncs > 1 ? `${numQ} questions Ã— ${numV} versions Ã— ${ncs} sections` : `${numQ} questions Ã— ${numV} versions`;
                      return <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.5rem"}}>Estimated cost: ~${cost.toFixed(3)} ({label})</div>;
                    })()}
                    <div style={{display:"flex", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap"}}>
                      <button style={{...S.btn("#10b981", autoGenLoading), minWidth:"160px"}}
                        disabled={autoGenLoading}
                        onClick={() => autoGenerateVersions(generatedPrompt, pendingType, pendingMeta)}>
                        {autoGenLoading ? "â³ Generating..." : "âš¡ Generate Variants"}
                      </button>
                      {isAdmin && <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>}
                    </div>
                    {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.75rem"}}>{autoGenError}</div>}
                    <button id="auto-submit-paste" style={{display:"none"}} onClick={handlePaste} />
                    <PastePanel
                      label="Paste the combined JSON response (all sections + versions)."
                      S={S} text2={text2}
                      pasteInput={pasteInput} setPasteInput={setPasteInput}
                      pasteError={pasteError} handlePaste={handlePaste}
                      onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                    />
                  </>
                )}
              </div>
            )}

            {/* â”€â”€ STAGE 4: Variants generated â€” full export and compare flow â”€â”€ */}
            {versions.length > 1 && (
              <>
                {/* Save to DB */}
                {!examSaved && (
                  <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem"}}>
                    <div style={{fontSize:"0.78rem", color:"#10b981", fontWeight:"bold", marginBottom:"0.5rem"}}>ðŸ’¾ Save this exam to database</div>
                    <div style={{display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap"}}>
                      <input
                        style={{...S.input, maxWidth:"300px"}}
                        placeholder="Exam name (e.g. Calculus 1 Midterm)"
                        value={saveExamName}
                        onChange={e => setSaveExamName(e.target.value)}
                      />
                      <button
                        style={S.btn("#10b981", !saveExamName.trim() || savingExam)}
                        disabled={!saveExamName.trim() || savingExam}
                        onClick={async () => {
                          setSavingExam(true);
                          // Save all sections â€” if multi-section, flatten all versions; otherwise just current versions
                          const allVersions = Object.keys(classSectionVersions).length > 1
                            ? Object.values(classSectionVersions).flat()
                            : versions;
                          const result = await saveExam(saveExamName.trim(), allVersions);
                          if (result) setExamSaved(true);
                          setSavingExam(false);
                        }}
                      >
                        {savingExam ? "Savingâ€¦" : "Save Exam"}
                      </button>
                    </div>
                  </div>
                )}
                {examSaved && (
                  <div style={{...S.card, borderColor:"#10b98144", marginBottom:"1.5rem", color:"#10b981"}}>
                    âœ… Exam saved! View it in the Saved Exams tab.
                  </div>
                )}

                {/* View mode toggle */}
                <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
                  <span style={{fontSize:"0.72rem", color:text2, marginRight:"0.25rem"}}>View:</span>
                  <button style={S.vTab(versionsViewMode==="single","#f43f5e")} onClick={() => setVersionsViewMode("single")}>
                    ðŸ“„ Single Version
                  </button>
                  <button style={S.vTab(versionsViewMode==="compare","#8b5cf6")} onClick={() => setVersionsViewMode("compare")}>
                    ðŸ“‹ Canvas Versions
                  </button>
                </div>

                {/* â”€â”€ SINGLE VERSION MODE â”€â”€ */}
                {versionsViewMode === "single" && (() => {
                  const v = versions[activeVersion];
                  return (
                    <>
                      {/* Version tabs */}
                      <div style={{display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        {versions.map((ver,i) => (
                          <button key={ver.label} style={S.vTab(activeVersion===i,"#f43f5e")} onClick={() => setActiveVersion(i)}>
                            Version {ver.label} <span style={{fontSize:"0.68rem", opacity:0.7, marginLeft:"0.3rem"}}>({ver.questions.length}q)</span>
                          </button>
                        ))}
                      </div>


                      {(() => {
                        const allIssues = v.questions.flatMap((q,qi) => {
                          const issues = validateQuestion(q);
                          return issues.map(issue => `Q${qi+1}: ${issue}`);
                        });
                        return allIssues.length > 0 ? (
                          <div style={{background:"#7c2d1222", border:"1px solid #f8717144", borderRadius:"6px",
                            padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.75rem", color:"#9B1C1C"}}>
                            <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>âš ï¸ {allIssues.length} issue{allIssues.length>1?"s":""} found in this version</div>
                            {allIssues.map((issue,i) => <div key={i} style={{opacity:0.85}}>â€¢ {issue}</div>)}
                          </div>
                        ) : null;
                      })()}
                      <div id="export-panel" ref={el => { if (el && exportHighlight) el.scrollIntoView({behavior:"smooth", block:"start"}); }}
                        style={{transition:"outline 0.3s", outline: exportHighlight ? "2px solid #185FA555" : "none", borderRadius:"8px", padding: exportHighlight ? "0.5rem" : "0"}}>
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap"}}>
                        <button style={S.btn("#10b981", exportLoading !== "")} disabled={exportLoading !== ""} onClick={async () => {
                          setExportLoading("Building Word document...");
                          try {
                            const cs = v.questions[0]?.classSection || null;
                            const blob = await buildDocx(v.questions,v.questions[0]?.course||"Calculus",v.label,cs);
                            const secStr = cs ? `_S${cs}` : "";
                            dlBlob(blob,`Version_${v.label}${secStr}_Exam.docx`);
                            if (examSaved && saveExamName) await logExport(saveExamName, "Word", v.label);
                          } finally { setExportLoading(""); }
                        }}>â¬‡ Word (.docx)</button>
                        <button style={S.oBtn("#06b6d4")} onClick={() => setShowPrintPreview(true)}>
                          ðŸ‘ Print Preview
                        </button>
                        {Object.keys(classSectionVersions).length > 1 && (
                          <button style={S.oBtn("#8b5cf6")} disabled={exportLoading !== ""} onClick={async () => {
                            setExportLoading("Building all sections Word...");
                            try {
                              for(const [sec, secVers] of Object.entries(classSectionVersions)){
                                for(const ver of secVers){
                                  const blob=await buildDocx(ver.questions,ver.questions[0]?.course||"Calculus",ver.label,Number(sec));
                                  dlBlob(blob,`S${sec}_Version_${ver.label}_Exam.docx`);
                                }
                              }
                            } finally { setExportLoading(""); }
                          }}>â¬‡ All Sections Word</button>
                        )}
                        <button style={S.oBtn("#f43f5e")} disabled={exportLoading !== ""} onClick={async () => {
                          setExportLoading("Building answer key...");
                          try {
                            const allVers = Object.keys(classSectionVersions).length > 1
                              ? Object.values(classSectionVersions).flat()
                              : versions;
                            const course = allVers[0]?.questions[0]?.course || "Exam";
                            const blob = await buildAnswerKey(allVers, course);
                            if (blob) dlBlob(blob, `${course.replace(/\s+/g,"_")}_Answer_Key.docx`);
                          } finally { setExportLoading(""); }
                        }}>ðŸ”‘ Answer Key (.docx)</button>
                        {isAdmin && (
                          <button style={S.btn("#7c3aed", validating)} disabled={validating} onClick={autoValidateAllVersions}>
                            {validating ? "â³ Validating..." : "âœ… Auto Validate"}
                          </button>
                        )}
                        {isAdmin && (
                          <button style={S.oBtn("#7c3aed")} onClick={() => { copyValidationPrompt(); }}>
                            ðŸ“‹ Copy Validation Prompt
                          </button>
                        )}
                      </div>
                      {isAdmin && validationError && (
                        <div style={{background:"#1a0a0a", border:"1px solid #7f1d1d", borderRadius:"6px", padding:"0.5rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.78rem", color:"#f87171"}}>
                          âš ï¸ {validationError}
                        </div>
                      )}
                      {isAdmin && Object.keys(validationResults).length > 0 && (() => {
                        const issues = Object.entries(validationResults).filter(([,r]) => !r.valid);
                        return (
                          <div style={{background: issues.length === 0 ? "#052e16" : "#1c1002", border:`1px solid ${issues.length === 0 ? "#14532d" : "#f59e0b44"}`, borderRadius:"6px", padding:"0.6rem 0.85rem", marginBottom:"0.75rem", fontSize:"0.78rem", color: issues.length === 0 ? "#4ade80" : "#f59e0b"}}>
                            {issues.length === 0
                              ? "âœ… All questions verified â€” no issues found."
                              : <>
                                  <div style={{fontWeight:"600", marginBottom:"0.3rem"}}>âš ï¸ {issues.length} issue{issues.length>1?"s":""} found</div>
                                  {issues.map(([id, r]) => (
                                    <div key={id} style={{marginBottom:"0.25rem", opacity:0.9}}>
                                      â€¢ <strong>Q{id}:</strong> {r.reason}{r.corrected_answer ? ` â†’ Correct: ${r.corrected_answer}` : ""}
                                    </div>
                                  ))}
                                </>
                            }
                          </div>
                        );
                      })()}

                      {/* Canvas QTI Export Panel */}
                      {Object.keys(classSectionVersions).length > 1 ? (
                        <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                          <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas QTI Export â€” Classroom Sections</div>
                          <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                            <span style={{fontSize:"0.72rem", color:text2, flexShrink:0}}>Quiz name in Canvas:</span>
                            <input
                              placeholder={`e.g. Midterm MAT221`}
                              value={qtiExamName}
                              onChange={e => setQtiExamName(e.target.value)}
                              style={{...S.input, flex:1, maxWidth:"280px", padding:"0.3rem 0.6rem", fontSize:"0.78rem"}}
                            />
                          </div>
                          <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.75rem"}}>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                              <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                                style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                              Group by question number
                            </label>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                              Points per question:
                              <input type="number" min={0.25} max={100} step={0.25} value={qtiPointsPerQ}
                                onChange={e => setQtiPointsPerQ(e.target.value)}
                                style={{width:"60px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                            </label>
                          </div>
                          <div style={{fontSize:"0.72rem", color:text3, marginBottom:"0.75rem"}}>
                            {qtiUseGroups
                              ? "Grouped: one question group per question number â€” Canvas randomly picks 1 version per student."
                              : "Flat: all question versions listed sequentially â€” no Canvas grouping."}
                          </div>
                          <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                            {(() => {
                              const allVers = Object.values(classSectionVersions).flat();
                              const warnings = validateQTIExport(allVers);
                              return warnings.length > 0 && (
                                <div style={{width:"100%", fontSize:"0.7rem", color:"#f59e0b", background:"#451a0322", border:"1px solid #f59e0b44", borderRadius:"4px", padding:"0.35rem 0.6rem", marginBottom:"0.35rem"}}>
                                  âš  {warnings.length} issue{warnings.length>1?"s":""} detected before export: {warnings.slice(0,2).join(" Â· ")}{warnings.length>2?` +${warnings.length-2} more`:""}
                                </div>
                              );
                            })()}
                            {Object.keys(classSectionVersions).sort((a,b)=>Number(a)-Number(b)).map(sec => (
                              <button key={sec} style={S.btn("#8b5cf6", false)} onClick={async () => {
                                const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                                const blobs = await buildClassroomSectionsQTI(
                                  {[sec]: classSectionVersions[sec]},
                                  examTitle, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1
                                );
                                const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g,"_");
                                dlBlob(blobs[sec], `${safeName}_S${sec}_QTI.zip`);
                              }}>â¬‡ Section {sec} QTI (.zip)</button>
                            ))}
                            <button style={S.btn("#10b981", false)} onClick={async () => {
                              const examTitle = qtiExamName.trim() || versions[0]?.questions[0]?.course || "Exam";
                              const blobs = await buildClassroomSectionsQTI(
                                classSectionVersions, examTitle, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1
                              );
                              const safeName = (qtiExamName.trim() || "Section").replace(/[^a-zA-Z0-9]/g,"_");
                              for(const [sec, blob] of Object.entries(blobs)){
                                dlBlob(blob, `${safeName}_S${sec}_QTI.zip`);
                              }
                            }}>â¬‡ All Sections QTI (.zip)</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                          <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas QTI Export</div>
                          <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center", marginBottom:"0.75rem"}}>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                              <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                                style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                              Group by question number
                            </label>
                            <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                              Points per question:
                              <input type="number" min={0.25} max={100} step={0.25} value={qtiPointsPerQ}
                                onChange={e => setQtiPointsPerQ(e.target.value)}
                                style={{width:"60px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                            </label>
                          </div>
                          <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                            {versions.map(v => (
                              <button key={v.label} style={S.oBtn("#8b5cf6")} onClick={async () => {
                                const xml = buildQTI(v.questions, v.questions[0]?.course||"Exam", v.label, qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                                const blob = await buildQTIZip(xml, `Version_${v.label}`);
                                dlBlob(blob, `Version_${v.label}_Canvas_QTI.zip`);
                              }}>â¬‡ V{v.label} QTI (.zip)</button>
                            ))}
                            <button style={S.btn("#8b5cf6", false)} onClick={async () => {
                              const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                              const blob = await buildQTIZip(xml, "AllVersions");
                              dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                            }}>â¬‡ All Versions QTI (.zip)</button>
                          </div>
                        </div>
                      )}
                      </div>{/* end export-panel wrapper */}

                      {v.questions.map((q,qi) => (
                        <div key={q.id||qi} style={S.qCard}>
                          {(() => { const issues = validateQuestion(q); return (
                          <div style={S.qMeta}>
                            <span style={{fontWeight:"bold", color:text1}}>Q{qi+1}</span>
                            <span style={S.tag("#f43f5e")}>{q.type}</span>
                            <span style={S.tag()}>{q.section}</span>
                            <span style={S.tag()}>{q.difficulty}</span>
                            {issues.length > 0 && (
                              <span title={issues.join("\n")} style={{cursor:"help",
                                background:"#7c2d12", color:"#9B1C1C", fontSize:"0.68rem", fontWeight:"600",
                                padding:"0.1rem 0.4rem", borderRadius:"4px", whiteSpace:"nowrap"}}>
                                âš ï¸ {issues.length}
                              </span>
                            )}
                            <div style={{marginLeft:"auto", display:"flex", gap:"0.3rem"}}>
                              <button style={{...S.smBtn, color:"#f59e0b", border:"1px solid #f59e0b44"}}
                                onClick={() => isAdmin ? triggerReplace(activeVersion,qi,"numbers") : triggerReplaceAuto(activeVersion,qi,"numbers")}>â†» Replace</button>
                              <button style={{...S.smBtn, color:"#e879f9", border:"1px solid #e879f944"}}
                                onClick={() => isAdmin ? triggerReplace(activeVersion,qi,"function") : triggerReplaceAuto(activeVersion,qi,"function")}>â†» Diff.</button>
                              <button style={{...S.smBtn, color: inlineEditQId===`v${activeVersion}_${qi}` ? "#60a5fa" : "#a78bfa", border:"1px solid #a78bfa44"}}
                                onClick={() => setInlineEditQId(inlineEditQId===`v${activeVersion}_${qi}` ? null : `v${activeVersion}_${qi}`)}>
                                âœï¸
                              </button>
                            </div>
                          </div>
                          ); })()}
                          {inlineEditQId === `v${activeVersion}_${qi}` && (
                            <InlineEditor
                              q={q}
                              onSave={(updated) => {
                                const updVers = versions.map((v,vi) =>
                                  vi !== activeVersion ? v : { ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }
                                );
                                setVersions(updVers);
                                setClassSectionVersions(prev => {
                                  const next = {...prev};
                                  Object.keys(next).forEach(sec => {
                                    next[sec] = next[sec].map((v,vi) =>
                                      vi !== activeVersion ? v : { ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : updated) }
                                    );
                                  });
                                  return next;
                                });
                                setInlineEditQId(null);
                                showToast("Question updated âœ“");
                              }}
                              onSaveAll={(updated) => {
                                const updVers = versions.map(v => ({
                                  ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : { ...vq, question: updated.question, choices: updated.choices })
                                }));
                                setVersions(updVers);
                                setClassSectionVersions(prev => {
                                  const next = {...prev};
                                  Object.keys(next).forEach(sec => {
                                    next[sec] = next[sec].map(v => ({
                                      ...v, questions: v.questions.map((vq,vqi) => vqi !== qi ? vq : { ...vq, question: updated.question, choices: updated.choices })
                                    }));
                                  });
                                  return next;
                                });
                                setInlineEditQId(null);
                                showToast("Pushed to all versions âœ“");
                              }}
                              onClose={() => setInlineEditQId(null)}
                            />
                          )}
                          {q.hasGraph && q.graphConfig && (
                            <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
                          )}
                          {q.type==="Branched" ? (
                            <>
                              <div style={{...S.qText,color:"#f43f5e99"}}>Given: <MathText>{q.stem}</MathText></div>
                              {(q.parts||[]).map((p,pi) => (
                                <div key={pi} style={{marginBottom:"0.6rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                                  <div style={{fontSize:"0.7rem",color:text3,marginBottom:"0.2rem"}}>({String.fromCharCode(97+pi)})</div>
                                  <div style={S.qText}><MathText>{p.question}</MathText></div>
                                  {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                                  {p.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{p.explanation}</MathText></div>}
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <div style={S.qText}><MathText>{q.question}</MathText></div>
                              {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                              {q.answer&&<div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                              {q.explanation&&<div style={S.expl}>ðŸ’¡ <MathText>{q.explanation}</MathText></div>}
                            </>
                          )}
                          {pendingType === "replace" && pendingMeta?.vIdx === activeVersion && pendingMeta?.qIdx === qi && (
                            <>
                              {isAdmin && generatedPrompt && (
                                <>
                                  <div style={{fontSize:"0.75rem", color:"#f59e0b", fontWeight:"bold", margin:"0.75rem 0 0.4rem"}}>ðŸ“‹ Replacement prompt:</div>
                                  <div style={S.promptBox}>{generatedPrompt}</div>
                                  <div style={{display:"flex", gap:"0.5rem", marginBottom:"0.75rem", flexWrap:"wrap"}}>
                                    <button
                                      style={{...S.btn("#10b981", autoGenLoading), minWidth:"150px"}}
                                      disabled={autoGenLoading}
                                      onClick={() => autoGenerateVersions(generatedPrompt, "replace", pendingMeta)}>
                                      {autoGenLoading ? "â³ Generating..." : "âš¡ Auto-Generate"}
                                    </button>
                                    <button style={S.oBtn("#f59e0b")} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>Copy Prompt</button>
                                  </div>
                                  {autoGenError && <div style={{color:"#f87171", fontSize:"0.78rem", marginBottom:"0.5rem"}}>{autoGenError}</div>}
                                  <PastePanel
                                    label="Paste the replacement question JSON here."
                                    S={S} text2={text2}
                                    pasteInput={pasteInput} setPasteInput={setPasteInput}
                                    pasteError={pasteError} handlePaste={handlePaste}
                                    onCancel={() => { setPendingType(null); setPasteInput(""); setGeneratedPrompt(""); }}
                                  />
                                </>
                              )}
                              {!isAdmin && (
                                <div style={{marginTop:"0.75rem", display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap", padding:"0.6rem 0.75rem", background:"#052e1688", borderRadius:"6px", border:"1px solid #22c55e22"}}>
                                  {autoGenLoading
                                    ? <><span style={{fontSize:"0.75rem", color:"#86efac"}}>â³ Generating replacement...</span></>
                                    : autoGenError
                                      ? <span style={{fontSize:"0.72rem", color:"#f87171"}}>{autoGenError}</span>
                                      : <span style={{fontSize:"0.72rem", color:"#86efac"}}>âœ“ Done</span>
                                  }
                                  <button style={{...S.smBtn, color:text2, marginLeft:"auto"}}
                                    onClick={() => { setPendingType(null); setGeneratedPrompt(""); }}>
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}

                {/* â”€â”€ COMPARE ALL VERSIONS MODE â”€â”€ */}
                {versionsViewMode === "compare" && (() => {
                  const numQ = versions[0]?.questions?.length || 0;
                  const allSections = [...new Set(versions.flatMap(v => v.questions.map(q => q.section)))];
                  const [filterSec, setFilterSec] = [compareSection, setCompareSection];

                  const filteredIndices = Array.from({length:numQ},(_,i)=>i).filter(i => {
                    if (filterSec === "All") return true;
                    return versions.some(v => v.questions[i]?.section === filterSec);
                  });

                  return (
                    <>
                      {/* Section filter */}
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", alignItems:"center", flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.72rem", color:text2}}>Filter section:</span>
                        <select style={{...S.sel, width:"220px"}} value={filterSec} onChange={e => setFilterSec(e.target.value)}>
                          <option value="All">All Sections</option>
                          {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span style={{fontSize:"0.72rem", color:text2}}>{filteredIndices.length} question{filteredIndices.length!==1?"s":""}</span>
                      </div>

                      {/* Canvas Export Settings */}
                      <div style={{...S.card, borderColor:"#8b5cf644", marginBottom:"1rem", padding:"1rem"}}>
                        <div style={{fontSize:"0.72rem", color:"#8b5cf6", fontWeight:"bold", marginBottom:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>Canvas Export Settings</div>
                        <div style={{display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"center"}}>
                          <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2, cursor:"pointer"}}>
                            <input type="checkbox" checked={qtiUseGroups} onChange={e => setQtiUseGroups(e.target.checked)}
                              style={{accentColor:"#8b5cf6", width:"14px", height:"14px"}} />
                            Group by section per version
                          </label>
                          <label style={{display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:text2}}>
                            Points per question:
                            <input type="number" min={0.25} max={100} step={0.25} value={qtiPointsPerQ}
                              onChange={e => setQtiPointsPerQ(e.target.value)}
                              style={{width:"60px", ...S.input, padding:"0.25rem 0.4rem", fontSize:"0.78rem"}} />
                          </label>
                        </div>
                      </div>

                      {/* Export buttons for compare view â€” single grouped file */}
                      <div style={{display:"flex", gap:"0.75rem", marginBottom:"1.25rem", flexWrap:"wrap", alignItems:"center"}}>
                        <span style={{fontSize:"0.72rem", color:accent, fontWeight:"bold"}}>Canvas export â€” one file, all versions:</span>
                        <button style={S.btn("#8b5cf6", false)} onClick={async () => {
                          const xml = buildQTICompare(versions, versions[0]?.questions[0]?.course || "Exam", qtiUseGroups, parseFloat(qtiPointsPerQ) || 1);
                          const blob = await buildQTIZip(xml, "AllVersions");
                          dlBlob(blob, "AllVersions_Canvas_QTI.zip");
                        }}>â¬‡ Export to Canvas (QTI .zip)</button>
                        {Object.keys(classSectionVersions).length > 1 && (
                          <button style={S.btn("#f59e0b", false)} onClick={async () => {
                            const course = versions[0]?.questions[0]?.course || "Exam";
                            const xml = buildQTIAllSectionsMerged(classSectionVersions, course, parseFloat(qtiPointsPerQ) || 1);
                            const blob = await buildQTIZip(xml, "AllSections_Merged");
                            dlBlob(blob, "AllSections_Merged_QTI.zip");
                          }}>â¬‡ All Sections Merged QTI</button>
                        )}
                        <button style={S.btn("#10b981", false)} onClick={async () => {
                          const blob = await buildDocxCompare(versions, versions[0]?.questions[0]?.course || "Exam");
                          dlBlob(blob, "AllVersions_Grouped.docx");
                        }}>â¬‡ Export to Word (all versions)</button>
                      </div>

                      {/* Questions grouped by number, all versions stacked */}
                      {filteredIndices.map(qi => (
                        <div key={qi} style={{marginBottom:"1.5rem"}}>
                          {/* Question group header */}
                          <div style={{fontSize:"0.72rem", color:"#f43f5e", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.5rem", padding:"0.3rem 0.6rem", background:"#f43f5e18", borderRadius:"5px", display:"inline-block"}}>
                            Question {qi+1} â€” {versions[0]?.questions[qi]?.section} â€” {versions[0]?.questions[qi]?.difficulty}
                          </div>

                          {versions.map((v, vi) => {
                            const q = v.questions[qi];
                            if (!q) return null;
                            const vColors = ["#f43f5e","#8b5cf6","#f59e0b","#06b6d4","#10b981"];
                            const vc = vColors[vi % vColors.length];
                            return (
                              <div key={v.label} style={{...S.qCard, borderLeft:`3px solid ${vc}`, marginBottom:"0.4rem"}}>
                                <div style={S.qMeta}>
                                  <span style={{background:vc+"22", color:vc, border:`1px solid ${vc}44`, borderRadius:"4px", padding:"0.15rem 0.5rem", fontSize:"0.7rem", fontWeight:"bold"}}>Version {v.label}</span>
                                  <span style={S.tag()}>{q.type}</span>
                                </div>
                                {q.hasGraph && q.graphConfig && (
                                  <GraphDisplay graphConfig={q.graphConfig} authorMode={false} />
                                )}
                                {q.type==="Branched" ? (
                                  <>
                                    <div style={{...S.qText,color:vc+"cc"}}>Given: <MathText>{q.stem}</MathText></div>
                                    {(q.parts||[]).map((p,pi) => (
                                      <div key={pi} style={{marginBottom:"0.4rem",paddingLeft:"0.75rem",borderLeft:"2px solid "+border}}>
                                        <div style={{fontSize:"0.7rem",color:text3}}>({String.fromCharCode(97+pi)})</div>
                                        <div style={S.qText}><MathText>{p.question}</MathText></div>
                                        {p.answer&&<div style={S.ans}>Answer: <MathText>{p.answer}</MathText></div>}
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    <div style={S.qText}><MathText>{q.question}</MathText></div>
                                    {q.choices&&<ul style={S.cList}>{q.choices.map((c,ci)=><li key={ci} style={S.cItem(c===q.answer)}>{String.fromCharCode(65+ci)}. <MathText>{c}</MathText></li>)}</ul>}
                                    {q.answer&&<div style={S.ans}>âœ“ <MathText>{q.answer}</MathText></div>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* SAVED EXAMS */}
        {screen === "saved" && (
          <SavedExamsScreen S={S} text1={text1} text2={text2} text3={text3} border={border}
            onLoad={(exam) => {
              // Restore exam into Versions tab
              const vers = exam.versions || [];
              // detect sections â€” classSection lives on the version object, fall back to questions[0]
              const sectionNums = [...new Set(vers.map(v => v.classSection ?? v.questions?.[0]?.classSection).filter(Boolean))].sort((a,b)=>a-b);
              if (sectionNums.length > 1) {
                // multi-section
                const secVersions = {};
                sectionNums.forEach(sec => {
                  secVersions[sec] = vers.filter(v => (v.classSection ?? v.questions?.[0]?.classSection) === sec);
                });
                setClassSectionVersions(secVersions);
                setVersions(secVersions[sectionNums[0]] || vers);
              } else {
                setClassSectionVersions({});
                setVersions(vers);
              }
              setActiveVersion(0);
              setMasterLocked(false);
              setExamSaved(true);
              setSaveExamName(exam.name);
              setCourse(vers[0]?.questions?.[0]?.course || null);
              setSelectedForExam([]);
              setScreen("versions");
            }}
          />
        )}

        {/* COURSES */}
        {screen === "courses" && (
          <CoursesScreen
            courses={[
              ...Object.entries(customCourses).map(([name, c]) => ({
                id: c.id,
                name,
                color: c.color,
                chapters: c.chapters || [],
                textbook_name: c.textbook || "",
                is_builtin: false,
              })),
              ...dbCourses.filter(c => c.is_builtin),
            ]}
            saveCourse={async (courseData) => {
              await saveCustomCourse({
                id: courseData.id,
                name: courseData.name,
                color: courseData.color,
                chapters: courseData.chapters || [],
                textbook: courseData.textbook_name || courseData.textbook || "",
              });
            }}
            deleteCourse={async (id) => {
              const entry = Object.entries(customCourses).find(([, c]) => c.id === id);
              if (entry) await deleteCustomCourse(entry[0]);
              else await deleteDbCourse(id);
            }}
            setScreen={setScreen}
            isAdmin={isAdmin}
            S={S}
            text1={text1}
            text2={text2}
            text3={text3}
            border={border}
            accent={accent}
            bg1={bg1}
            bg2={bg2}
          />
        )}

      </main>

      {/* â”€â”€ PRINT PREVIEW MODAL â”€â”€ */}
      {showPrintPreview && (() => {
        const v = versions[activeVersion];
        if (!v) { setShowPrintPreview(false); return null; }
        const cs = v.questions[0]?.classSection;
        const courseName = v.questions[0]?.course || "Exam";
        const titleLabel = cs ? `Section ${cs} â€” Version ${v.label}` : `Version ${v.label}`;

        // check if any graph questions still need rendering
        const graphQs = v.questions.filter(q => q.hasGraph && q.graphConfig);
        const graphsReady = graphQs.every(q => printGraphCache[q.id || q.question]);
        const graphsLoading = graphQs.length > 0 && !graphsReady;

        const getGraphImg = (q) => {
          const b64 = printGraphCache[q.id || q.question];
          if (b64) return `<img src="${b64}" style="max-width:100%;display:block;margin-bottom:8pt;" />`;
          return ""; // graphs not ready yet â€” will re-render when cache updates
        };

        const printHTML = `
          <h2 style="font-size:16pt;margin-bottom:4pt;">${courseName} â€” ${titleLabel}</h2>
          <div style="font-size:10pt;color:#555;margin-bottom:20pt;">Name: _________________________ &nbsp;&nbsp; Date: _____________</div>
          ${v.questions.map((q, qi) => {
            const graphImg = getGraphImg(q);
            if (q.type === "Branched") return `
              <div style="margin-bottom:20pt;page-break-inside:avoid;">
                <div style="font-weight:bold;margin-bottom:4pt;">Question ${qi+1}.</div>
                ${graphImg}
                <div style="margin-bottom:8pt;">Given: ${q.stem}</div>
                ${(q.parts||[]).map((p,pi) => `
                  <div style="margin-left:20pt;margin-bottom:6pt;">
                    (${String.fromCharCode(97+pi)}) ${p.question}
                    ${p.choices ? p.choices.map((c,ci) => `<div style="margin-left:20pt;">${String.fromCharCode(65+ci)}. ${c}</div>`).join("") : ""}
                  </div>`).join("")}
              </div>`;
            return `
              <div style="margin-bottom:20pt;page-break-inside:avoid;">
                <div style="font-weight:bold;margin-bottom:4pt;">Question ${qi+1}.</div>
                ${graphImg}
                <div style="margin-bottom:8pt;">${q.question}</div>
                ${q.choices ? q.choices.map((c,ci) => `
                  <div style="margin:3pt 0 3pt 24pt;">${String.fromCharCode(65+ci)}.&nbsp; ${c}</div>`).join("") : ""}
                ${!q.choices ? `<div style="border-bottom:1px solid #ccc;margin-top:40pt;"></div>` : ""}
              </div>
              <hr style="border:none;border-top:1px solid #eee;margin:0 0 16pt 0;" />`;
          }).join("")}`;

        return (
          <div style={{position:"fixed", top:0, left:0, right:0, bottom:0, width:"100vw", height:"100vh", background:"rgba(0,0,0,0.95)", zIndex:99999, display:"flex", flexDirection:"column", overflow:"hidden"}}>
            {/* Top bar */}
            <div style={{background:bg1, borderBottom:"1px solid #1e2d45", padding:"0.65rem 1.5rem", display:"flex", alignItems:"center", gap:"1rem", flexShrink:0}}>
              <span style={{fontSize:"0.85rem", fontWeight:"600", color:text1, flex:1}}>
                ðŸ‘ Print Preview â€” {courseName} {titleLabel}
              </span>
              <button style={{background:"#2D6A4F", color:"#fff", border:"none", borderRadius:"6px", padding:"0.4rem 1.1rem", fontSize:"0.82rem", fontWeight:"600", cursor:"pointer"}}
                onClick={() => {
                  const win = window.open("","_blank");
                  win.document.write(`<!DOCTYPE html><html><head><title>${courseName} ${titleLabel}</title>
                    <style>
                      body{font-family:"Times New Roman",serif;color:#000;background:#fff;margin:2cm;font-size:12pt;line-height:1.6;}
                      h2{font-size:16pt;margin-bottom:4pt;}
                      hr{border:none;border-top:1px solid #eee;margin:0 0 16pt 0;}
                      table{border-collapse:collapse;margin:8pt 0;}
                      th,td{border:1px solid #999;padding:4pt 10pt;text-align:center;}
                      th{background:#eee;font-weight:bold;}
                      @media print{body{margin:1.5cm;}}
                    </style></head><body>${printHTML}</body></html>`);
                  win.document.close();
                  setTimeout(() => win.print(), 400);
                }}>ðŸ–¨ Print</button>
              <button style={{background:"transparent", color:text2, border:"1px solid #1e2d45", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.82rem", cursor:"pointer"}}
                onClick={() => setShowPrintPreview(false)}>âœ• Close</button>
            </div>

            {/* Preview content */}
            <div style={{flex:1, overflowY:"auto", display:"flex", justifyContent:"center", padding:"2rem 1rem", flexDirection:"column", alignItems:"center"}}>
              {graphsLoading && (
                <div style={{color:"#185FA5", fontSize:"0.85rem", marginBottom:"1rem", padding:"0.5rem 1rem", background:border, borderRadius:"6px"}}>
                  â³ Rendering graphs...
                </div>
              )}
              <div key={Object.keys(printGraphCache).length} style={{background:"#fff", color:"#000", width:"min(21cm, 95vw)", minHeight:"29.7cm", padding:"min(2cm, 4vw)", boxShadow:"0 4px 32px rgba(0,0,0,0.5)", fontFamily:"'Times New Roman',serif", fontSize:"12pt", lineHeight:1.6, boxSizing:"border-box"}}
                dangerouslySetInnerHTML={{__html: printHTML}}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function TestBankApp() {
  return <TestBankAppInner />;
}
