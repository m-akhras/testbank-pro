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
import BankScreen from "./screens/BankScreen.js";
import VersionsScreen from "./screens/VersionsScreen.js";
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
          <BankScreen
            bank={bank} setBank={setBank}
            bankLoaded={bankLoaded}
            bankIssueCount={bankIssueCount}
            bankDupCount={bankDupCount}
            bankCompact={bankCompact} setBankCompact={setBankCompact}
            bankTabState={bankTabState} setBankTabState={setBankTabState}
            bankSelectMode={bankSelectMode} setBankSelectMode={setBankSelectMode}
            bankSelected={bankSelected} setBankSelected={setBankSelected}
            bankSearch={bankSearch} setBankSearch={setBankSearch}
            filteredBank={filteredBank}
            duplicateIds={duplicateIds}
            usedInExams={usedInExams}
            expandedBatches={expandedBatches} setExpandedBatches={setExpandedBatches}
            course={course} courseObject={courseObject}
            allCourses={allCourses} courseColors={courseColors}
            accent={accent} isAdmin={isAdmin}
            availableSections={availableSections}
            availableYears={availableYears}
            availableMonths={availableMonths}
            availableDays={availableDays}
            availableTimes={availableTimes}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterSection={filterSection} setFilterSection={setFilterSection}
            filterType={filterType} setFilterType={setFilterType}
            filterDiff={filterDiff} setFilterDiff={setFilterDiff}
            filterYear={filterYear} setFilterYear={setFilterYear}
            filterMonth={filterMonth} setFilterMonth={setFilterMonth}
            filterDay={filterDay} setFilterDay={setFilterDay}
            filterTime={filterTime} setFilterTime={setFilterTime}
            filterIssuesOnly={filterIssuesOnly} setFilterIssuesOnly={setFilterIssuesOnly}
            lastGenerated={lastGenerated}
            selectedForExam={selectedForExam} setSelectedForExam={setSelectedForExam}
            mutationType={mutationType} setMutationType={setMutationType}
            versionCount={versionCount} setVersionCount={setVersionCount}
            numClassSections={numClassSections} setNumClassSections={setNumClassSections}
            classSectionVersions={classSectionVersions}
            bulkReplacePrompt={bulkReplacePrompt} setBulkReplacePrompt={setBulkReplacePrompt}
            bulkReplaceIds={bulkReplaceIds} setBulkReplaceIds={setBulkReplaceIds}
            bulkReplacePaste={bulkReplacePaste} setBulkReplacePaste={setBulkReplacePaste}
            bulkReplaceError={bulkReplaceError} setBulkReplaceError={setBulkReplaceError}
            autoGenLoading={autoGenLoading} setAutoGenLoading={setAutoGenLoading}
            autoGenError={autoGenError} setAutoGenError={setAutoGenError}
            pendingType={pendingType} setPendingType={setPendingType}
            pendingMeta={pendingMeta} setPendingMeta={setPendingMeta}
            generatedPrompt={generatedPrompt} setGeneratedPrompt={setGeneratedPrompt}
            pasteInput={pasteInput} setPasteInput={setPasteInput}
            pasteError={pasteError} setPasteError={setPasteError}
            handlePaste={handlePaste}
            inlineEditQId={inlineEditQId} setInlineEditQId={setInlineEditQId}
            graphEditorQId={graphEditorQId} setGraphEditorQId={setGraphEditorQId}
            validateQuestion={validateQuestion}
            autoGenerateVersions={autoGenerateVersions}
            showToast={showToast}
            setConfirmDelete={setConfirmDelete}
            setScreen={setScreen}
          />
        )}

        {/* VERSIONS */}
        {screen === "versions" && (
          <VersionsScreen
            versions={versions} setVersions={setVersions}
            classSectionVersions={classSectionVersions} setClassSectionVersions={setClassSectionVersions}
            activeClassSection={activeClassSection} setActiveClassSection={setActiveClassSection}
            activeVersion={activeVersion} setActiveVersion={setActiveVersion}
            selectedForExam={selectedForExam} setSelectedForExam={setSelectedForExam}
            masterLocked={masterLocked} setMasterLocked={setMasterLocked}
            mastersLoading={mastersLoading} savedMasters={savedMasters}
            masterName={masterName} setMasterName={setMasterName}
            savingMaster={savingMaster}
            loadSavedMasters={loadSavedMasters} loadMaster={loadMaster}
            deleteSavedMaster={deleteSavedMaster} saveMaster={saveMaster}
            versionCount={versionCount} setVersionCount={setVersionCount}
            numClassSections={numClassSections} setNumClassSections={setNumClassSections}
            versionMutationType={versionMutationType} setVersionMutationType={setVersionMutationType}
            mutationType={mutationType}
            generatedPrompt={generatedPrompt} setGeneratedPrompt={setGeneratedPrompt}
            pendingType={pendingType} setPendingType={setPendingType}
            pendingMeta={pendingMeta} setPendingMeta={setPendingMeta}
            pasteInput={pasteInput} setPasteInput={setPasteInput}
            pasteError={pasteError} setPasteError={setPasteError}
            autoGenLoading={autoGenLoading}
            autoGenError={autoGenError}
            autoGenerateVersions={autoGenerateVersions}
            exportLoading={exportLoading} setExportLoading={setExportLoading}
            examSaved={examSaved} setExamSaved={setExamSaved}
            saveExamName={saveExamName} setSaveExamName={setSaveExamName}
            savingExam={savingExam} setSavingExam={setSavingExam}
            versionsViewMode={versionsViewMode} setVersionsViewMode={setVersionsViewMode}
            exportHighlight={exportHighlight}
            inlineEditQId={inlineEditQId} setInlineEditQId={setInlineEditQId}
            validating={validating} validationError={validationError} validationResults={validationResults}
            qtiUseGroups={qtiUseGroups} setQtiUseGroups={setQtiUseGroups}
            qtiPointsPerQ={qtiPointsPerQ} setQtiPointsPerQ={setQtiPointsPerQ}
            qtiExamName={qtiExamName} setQtiExamName={setQtiExamName}
            compareSection={compareSection} setCompareSection={setCompareSection}
            printGraphCache={printGraphCache}
            bank={bank}
            course={course}
            courseObject={courseObject}
            isAdmin={isAdmin}
            accent={accent}
            courseColors={courseColors}
            handlePaste={handlePaste}
            sectionSortKey={sectionSortKey}
            validateQuestion={validateQuestion}
            autoValidateAllVersions={autoValidateAllVersions}
            copyValidationPrompt={copyValidationPrompt}
            triggerReplace={triggerReplace}
            triggerReplaceAuto={triggerReplaceAuto}
            showToast={showToast}
            setScreen={setScreen}
            setShowPrintPreview={setShowPrintPreview}
          />
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
