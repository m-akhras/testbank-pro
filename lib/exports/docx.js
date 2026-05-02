import { isPipeTable, normalizePipeTable, splitTableBlocks, mathStepsOnly } from "./helpers.js";
import { mathToOmml } from "../math/omml.js";
import { graphToBase64PNG, statChartToBase64PNG } from "./graphRendering.js";
import { getCourse } from "../courses/index.js";
import { stripChoiceLabel, isGraphChoice } from "../utils/questions.js";
import { vectorFieldToBase64PNG } from "../../components/display/VectorFieldGraph.js";
import { contourToBase64PNG }     from "../../components/display/ContourGraph.js";
import { regionToBase64PNG }      from "../../components/display/RegionGraph.js";
import { parametricToBase64PNG }  from "../../components/display/ParametricGraph.js";
import { surfaceToBase64PNG }     from "../../components/display/SurfaceGraph.js";
import { pathToBase64PNG }        from "../../components/display/PathGraph.js";
import { isNewGraphConfig, newGraphConfigToPng } from "./newGraphPng.js";

// Rasterize one graph-choice config to a base64 PNG, dispatching by graphType.
// Unknown types fall through to null and the caller emits a missing-graph
// placeholder so the rest of the question still renders.
async function _choiceGraphToPng(choice) {
  if (!choice || !choice.graphConfig) return null;
  switch (choice.graphConfig.graphType) {
    case "vectorField": return vectorFieldToBase64PNG(choice.graphConfig, 300, 280);
    case "contour":     return contourToBase64PNG(choice.graphConfig, 300, 280);
    case "region":      return regionToBase64PNG(choice.graphConfig, 300, 280);
    case "parametric":  return parametricToBase64PNG(choice.graphConfig, 300, 280);
    case "surface":     return surfaceToBase64PNG(choice.graphConfig, 300, 280);
    case "path":        return pathToBase64PNG(choice.graphConfig, 300, 280);
    default:            return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Two export paths, controlled by `includeAnswers`:
//
//   includeAnswers=false → "Word (.docx)" / exam for students
//     • Free-response questions: blank vertical space (pointValue × 1440 twips,
//       clamped 2160–7200) for the student's solution.
//     • MCQ questions: no extra space (choices ARE the answer area).
//     • No answer text or labels appear anywhere.
//
//   includeAnswers=true → "Answer Key (.docx)" / same exam with answers
//     • All questions: a visually distinct inline ✓ Answer block (green left
//       border + light green fill) directly under the question/choices,
//       followed by any solution steps stored on the question.
//     • No blank student space.
//
// Both paths share the same cover page, per-page header, "Page X of Y"
// footer, and per-question layout. There is NO separate "Answer Key" page
// appended at the end of either document.
// ────────────────────────────────────────────────────────────────────────────

// ── Word image XML helper (used by buildDocx and buildDocxCompare) ───────────
let _docxImgCounter = 0;
function makeDocxImageXml(base64png, widthEmu=4800000, heightEmu=2800000) {
  _docxImgCounter++;
  const b64 = base64png.replace(/^data:image\/png;base64,/, "");
  const rid  = `rImg${_docxImgCounter}`;
  const docId = _docxImgCounter;
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docId}" name="Graph${docId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docId}" name="Graph${docId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<GRAPH_REL_PLACEHOLDER rid="${rid}" b64="${b64}"/>`;
}

// ── Template helpers (cover, header, footer) ─────────────────────────────────

function escXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripCourseCodePrefix(title, courseCode) {
  if (!title || !courseCode) return title || "";
  const escaped = courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.replace(/\s+/g, "\\s*");
  const re = new RegExp(`^\\s*${flexible}[\\s\\-:]*`, "i");
  return title.replace(re, "").trim();
}

async function fetchLogoBase64(url) {
  if (!url || typeof window === "undefined") return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();

    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).replace(/^data:image\/png;base64,/, ""));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

    const dims = await new Promise((resolve) => {
      try {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || 0;
          const h = img.naturalHeight || 0;
          URL.revokeObjectURL(objectUrl);
          resolve(w > 0 && h > 0 ? { width: w, height: h } : null);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
        img.src = objectUrl;
      } catch {
        resolve(null);
      }
    });

    return { base64, width: dims?.width || null, height: dims?.height || null };
  } catch { return null; }
}

let _logoDocIdCounter = 9000;
function logoImageXml(rid, widthEmu, heightEmu) {
  _logoDocIdCounter++;
  const id = _logoDocIdCounter;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Logo${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Logo${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function centerPara(text, opts = {}) {
  const { bold = false, italic = false, size = 24, color = "000000", spacing = 160 } = opts;
  const rpr = `<w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
  const ppr = `<w:pPr><w:jc w:val="center"/><w:spacing w:after="${spacing}"/></w:pPr>`;
  return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

function buildBlueBanner(text) {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="11088" w:type="dxa"/>
      <w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="11088"/></w:tblGrid>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="11088" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="1F3A6E"/>
          <w:tcMar><w:top w:w="220" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:left w:w="200" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="FFFFFF"/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>
        </w:p>
      </w:tc>
    </w:tr>
  </w:tbl>`;
}

function buildSpacerBlock(heightTwips = 1600) {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="11088" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="444444"/>
        <w:left w:val="single" w:sz="4" w:color="444444"/>
        <w:bottom w:val="single" w:sz="4" w:color="444444"/>
        <w:right w:val="single" w:sz="4" w:color="444444"/>
        <w:insideH w:val="single" w:sz="4" w:color="444444"/>
        <w:insideV w:val="single" w:sz="4" w:color="444444"/>
      </w:tblBorders>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    <w:tblGrid><w:gridCol w:w="11088"/></w:tblGrid>
    <w:tr>
      <w:trPr><w:trHeight w:val="${heightTwips}" w:hRule="atLeast"/></w:trPr>
      <w:tc>
        <w:tcPr><w:tcW w:w="11088" w:type="dxa"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>`;
}

function buildInfoTable({
  semester, date, time, duration,
  courseTitle, courseCode,
  instructor, sectCombined,
  materialsAllowed,
}) {
  const tcMar = `<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>`;
  const cellBorders = `<w:tcBorders><w:top w:val="single" w:sz="4" w:color="444444"/><w:left w:val="single" w:sz="4" w:color="444444"/><w:bottom w:val="single" w:sz="4" w:color="444444"/><w:right w:val="single" w:sz="4" w:color="444444"/></w:tcBorders>`;

  const mkCell = (text, opts = {}) => {
    const { width, gridSpan = 1, label = false, bold = label, italic = false, centered = false, valign = "center" } = opts;
    const span = gridSpan > 1 ? `<w:gridSpan w:val="${gridSpan}"/>` : "";
    const rPr = `<w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}<w:sz w:val="20"/><w:color w:val="${label ? "222222" : "000000"}"/></w:rPr>`;
    const align = centered ? "center" : "left";
    return `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${width}" w:type="dxa"/>
        ${span}
        ${cellBorders}
        <w:vAlign w:val="${valign}"/>
        ${tcMar}
      </w:tcPr>
      <w:p>
        <w:pPr><w:jc w:val="${align}"/><w:spacing w:after="0"/></w:pPr>
        <w:r>${rPr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>
      </w:p>
    </w:tc>`;
  };

  const mkMaterialsCell = (body) => `<w:tc>
    <w:tcPr>
      <w:tcW w:w="11088" w:type="dxa"/>
      <w:gridSpan w:val="9"/>
      ${cellBorders}
      <w:tcMar><w:top w:w="200" w:type="dxa"/><w:bottom w:w="200" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
      <w:vAlign w:val="top"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="222222"/></w:rPr><w:t xml:space="preserve">Materials Allowed:</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="0"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escXml(body || "")}</w:t></w:r>
    </w:p>
  </w:tc>`;

  const row1 = `<w:tr>${mkCell("Semester", { width: 1700, gridSpan: 1, label: true })}${mkCell(semester || "", { width: 9388, gridSpan: 8 })}</w:tr>`;
  const row2 = `<w:tr>${mkCell("Exam Date", { width: 1700, gridSpan: 1, label: true })}${mkCell(date || "", { width: 1950, gridSpan: 2 })}${mkCell("Exam Time:", { width: 1500, gridSpan: 1, label: true })}${mkCell(time || "", { width: 1950, gridSpan: 2 })}${mkCell("Exam Duration:", { width: 1700, gridSpan: 1, label: true })}${mkCell(duration || "", { width: 2288, gridSpan: 2 })}</w:tr>`;
  const row3 = `<w:tr>${mkCell("Course Title", { width: 1700, gridSpan: 1, label: true })}${mkCell(courseTitle || "", { width: 5400, gridSpan: 5 })}${mkCell("Course Code", { width: 1700, gridSpan: 1, label: true })}${mkCell(courseCode || "", { width: 2288, gridSpan: 2 })}</w:tr>`;
  const row4 = `<w:tr>${mkCell("Instructor", { width: 1700, gridSpan: 1, label: true })}${mkCell(instructor || "", { width: 9388, gridSpan: 8 })}</w:tr>`;
  const row5 = `<w:tr>${mkCell("Name", { width: 1700, gridSpan: 1, label: true })}${mkCell("", { width: 4550, gridSpan: 4 })}${mkCell("ID No.", { width: 850, gridSpan: 1, label: true })}${mkCell("", { width: 2550, gridSpan: 2 })}${mkCell(sectCombined || "Sect.: ", { width: 1438, gridSpan: 1, bold: true, centered: true })}</w:tr>`;
  const row6 = `<w:tr><w:trPr><w:trHeight w:val="1800" w:hRule="atLeast"/></w:trPr>${mkMaterialsCell(materialsAllowed)}</w:tr>`;

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="11088" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="444444"/>
        <w:left w:val="single" w:sz="4" w:color="444444"/>
        <w:bottom w:val="single" w:sz="4" w:color="444444"/>
        <w:right w:val="single" w:sz="4" w:color="444444"/>
        <w:insideH w:val="single" w:sz="4" w:color="444444"/>
        <w:insideV w:val="single" w:sz="4" w:color="444444"/>
      </w:tblBorders>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="1700"/><w:gridCol w:w="1100"/><w:gridCol w:w="850"/><w:gridCol w:w="1500"/><w:gridCol w:w="1100"/><w:gridCol w:w="850"/><w:gridCol w:w="1700"/><w:gridCol w:w="850"/><w:gridCol w:w="1438"/>
    </w:tblGrid>
    ${row1}
    ${row2}
    ${row3}
    ${row4}
    ${row5}
    ${row6}
  </w:tbl>`;
}

function buildGradingTable(questionMarks) {
  const n = questionMarks.length;
  const marks = Array.from({ length: n }, (_, i) => {
    const v = Number(questionMarks[i]);
    return Number.isFinite(v) && v > 0 ? v : 10;
  });
  const total = marks.reduce((a, b) => a + b, 0);

  const totalW = 1588;
  const qW = Math.floor((11088 - totalW) / Math.max(n, 1));
  const tableW = totalW + qW * n;

  const tcMar = `<w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>`;
  const cellBorders = `<w:tcBorders><w:top w:val="single" w:sz="4" w:color="444444"/><w:left w:val="single" w:sz="4" w:color="444444"/><w:bottom w:val="single" w:sz="4" w:color="444444"/><w:right w:val="single" w:sz="4" w:color="444444"/></w:tcBorders>`;

  const headerCell = (label, sub, width, isTotal = false) => `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${cellBorders}
      <w:vAlign w:val="center"/>
      ${tcMar}
    </w:tcPr>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escXml(label)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
      <w:r><w:rPr>${isTotal ? "<w:b/>" : ""}<w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escXml(sub)}</w:t></w:r>
    </w:p>
  </w:tc>`;

  const emptyCell = (width) => `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${cellBorders}
      ${tcMar}
    </w:tcPr>
    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
  </w:tc>`;

  let header = `<w:tr>`;
  for (let i = 0; i < n; i++) {
    header += headerCell(`Q${i + 1}`, `/${marks[i]}`, qW);
  }
  header += headerCell("Total", `/ ${total}`, totalW, true);
  header += `</w:tr>`;

  const scoreHeight = `<w:trPr><w:trHeight w:val="700" w:hRule="atLeast"/></w:trPr>`;
  let scoreRow = `<w:tr>${scoreHeight}`;
  for (let i = 0; i < n; i++) scoreRow += emptyCell(qW);
  scoreRow += emptyCell(totalW);
  scoreRow += `</w:tr>`;

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${tableW}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="444444"/>
        <w:left w:val="single" w:sz="4" w:color="444444"/>
        <w:bottom w:val="single" w:sz="4" w:color="444444"/>
        <w:right w:val="single" w:sz="4" w:color="444444"/>
        <w:insideH w:val="single" w:sz="4" w:color="444444"/>
        <w:insideV w:val="single" w:sz="4" w:color="444444"/>
      </w:tblBorders>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    <w:tblGrid>
      ${Array.from({ length: n }, () => `<w:gridCol w:w="${qW}"/>`).join("")}
      <w:gridCol w:w="${totalW}"/>
    </w:tblGrid>
    ${header}
    ${scoreRow}
  </w:tbl>`;
}

function buildCoverPageXml({
  logoRid, logoCx, logoCy,
  examTitle, courseTitle, courseCode,
  examSemester, examDate, examTime, examDuration,
  materialsAllowed, examInstructions,
  showVersion, versionLabel, showSection, sectionLabel,
  instructor, questionMarks,
}) {
  let xml = "";

  if (logoRid) {
    const cx = logoCx || 3200000;
    const cy = logoCy || 2240000;
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>${logoImageXml(logoRid, cx, cy)}</w:p>`;
  }

  const bannerText = (showVersion && versionLabel) ? `${examTitle} – ${versionLabel}` : (examTitle || "");
  if (bannerText) {
    xml += buildBlueBanner(bannerText);
    xml += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
  }

  const sectCombined = (showSection && sectionLabel)
    ? `Sect.: ${String(sectionLabel).padStart(2, "0")}`
    : "Sect.: ";
  xml += buildInfoTable({
    semester: examSemester || "",
    date: examDate || "",
    time: examTime || "",
    duration: examDuration || "",
    courseTitle: courseTitle || "",
    courseCode: courseCode || "",
    instructor: instructor || "",
    sectCombined,
    materialsAllowed: materialsAllowed || "",
  });

  xml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
  xml += buildSpacerBlock(1600);
  xml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;

  if (Array.isArray(questionMarks) && questionMarks.length > 0) {
    xml += buildGradingTable(questionMarks);
  }

  if (examInstructions) {
    xml += `<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Instructions:</w:t></w:r></w:p>`;
    xml += `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr><w:t xml:space="preserve">${escXml(examInstructions)}</w:t></w:r></w:p>`;
  }

  return xml;
}

function buildHeaderXml({ logoRid, logoCx, logoCy, examTitle, courseCode }) {
  const titleLine = [examTitle, courseCode].filter(Boolean).join(" · ");
  const hCx = logoCx || 762000;
  const hCy = logoCy || 381000;
  const logoCell = logoRid
    ? `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr><w:p>${logoImageXml(logoRid, hCx, hCy)}</w:p></w:tc>`
    : `<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders></w:tcPr><w:p/></w:tc>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:tbl>
    <w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr>
    <w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="7360"/></w:tblGrid>
    <w:tr>
      ${logoCell}
      <w:tc><w:tcPr><w:tcW w:w="7360" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve">${escXml(titleLine)}</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>
  <w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="cccccc"/></w:pBdr><w:spacing w:after="0"/></w:pPr></w:p>
</w:hdr>`;
}

// "Page X of Y" footer, right-aligned with a thin grey divider on top.
function buildFooterPageOfPagesXml() {
  const sty = `<w:rPr><w:sz w:val="18"/><w:color w:val="888888"/></w:rPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr><w:top w:val="double" w:sz="4" w:space="1" w:color="A0AEC0"/></w:pBdr>
      <w:tabs><w:tab w:val="right" w:pos="10080"/></w:tabs>
      <w:spacing w:before="60" w:after="0"/>
      <w:rPr><w:sz w:val="18"/><w:color w:val="888888"/></w:rPr>
    </w:pPr>
    <w:r><w:tab/></w:r>
    <w:r>${sty}<w:t xml:space="preserve">Page </w:t></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="begin"/></w:r>
    <w:r>${sty}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="separate"/></w:r>
    <w:r>${sty}<w:t>1</w:t></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="end"/></w:r>
    <w:r>${sty}<w:t xml:space="preserve"> of </w:t></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="begin"/></w:r>
    <w:r>${sty}<w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="separate"/></w:r>
    <w:r>${sty}<w:t>1</w:t></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;
}

function buildFooterEmptyXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>`;
}

function applyTemplateAssets({ tc, course, classSection = null, questionCount, logoData, zip }) {
  const includeCover  = !!tc.includeCover;
  const includeHeader = !!tc.includeHeader;
  const includeFooter = tc.includeFooter !== false;

  const courseInfo = getCourse(course);
  const courseCode = courseInfo?.courseCode || tc.courseCode || "";
  const cleanedExamTitle = stripCourseCodePrefix(tc.examTitle || "", courseCode);

  let relsAppendix = "";
  let contentTypeOverrides = "";

  let coverLogoCx = null, coverLogoCy = null, headerLogoCx = null, headerLogoCy = null;
  if (logoData?.base64) {
    const imgBytes = Uint8Array.from(atob(logoData.base64), c => c.charCodeAt(0));
    zip.file("word/media/logo.png", imgBytes);

    if (logoData.width && logoData.height) {
      const ratio = logoData.height / logoData.width;
      coverLogoCx = 3200000;
      coverLogoCy = Math.round(3200000 * ratio);
      headerLogoCx = 762000;
      headerLogoCy = Math.round(762000 * ratio);
    }
  }

  const footerXml = includeFooter ? buildFooterPageOfPagesXml() : buildFooterEmptyXml();
  zip.file("word/footer1.xml", footerXml);
  contentTypeOverrides += `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
  relsAppendix += `<Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
  const footerRefXml = `<w:footerReference w:type="default" r:id="rFooter1"/>`;

  let headerRefXml = "";
  if (includeHeader) {
    let headerRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
    if (logoData?.base64) {
      headerRels += `<Relationship Id="rLogoHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>`;
    }
    headerRels += `</Relationships>`;
    zip.file("word/_rels/header1.xml.rels", headerRels);
    const headerXml = buildHeaderXml({
      logoRid: logoData?.base64 ? "rLogoHeader" : null,
      logoCx: headerLogoCx,
      logoCy: headerLogoCy,
      examTitle: cleanedExamTitle,
      courseCode,
    });
    zip.file("word/header1.xml", headerXml);
    contentTypeOverrides += `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`;
    relsAppendix += `<Relationship Id="rHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
    headerRefXml = `<w:headerReference w:type="default" r:id="rHeader1"/>`;
  }

  let coverXml = "";
  if (includeCover) {
    zip.file("word/headerEmpty.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:hdr>`);
    zip.file("word/footerEmpty.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>`);
    contentTypeOverrides += `<Override PartName="/word/headerEmpty.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`;
    contentTypeOverrides += `<Override PartName="/word/footerEmpty.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
    relsAppendix += `<Relationship Id="rHeaderEmpty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerEmpty.xml"/>`;
    relsAppendix += `<Relationship Id="rFooterEmpty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footerEmpty.xml"/>`;

    const questionMarks = Array.from({ length: questionCount }, (_, i) => {
      const v = Number(tc.questionMarks?.[i]);
      return Number.isFinite(v) && v > 0 ? v : 10;
    });
    const instructor =
      tc.instructorBySection?.[classSection]
      ?? tc.instructorBySection?.[String(classSection)]
      ?? tc.instructorBySection?._default
      ?? tc.instructorName
      ?? "";
    const innerCover = buildCoverPageXml({
      logoRid: logoData?.base64 ? "rLogoCover" : null,
      logoCx: coverLogoCx,
      logoCy: coverLogoCy,
      examTitle: cleanedExamTitle,
      courseTitle: tc.courseTitle || course || "",
      courseCode: tc.courseCode || courseCode || "",
      examSemester: tc.examSemester || "",
      examDate: tc.examDate || "",
      examTime: tc.examTime || "",
      examDuration: tc.examDuration || "",
      materialsAllowed: tc.materialsAllowed || "",
      examInstructions: tc.examInstructions || "",
      showVersion: !!tc.showVersion,
      versionLabel: tc.versionLabel || "",
      showSection: !!tc.showSection,
      sectionLabel: tc.sectionLabel || "",
      instructor,
      questionMarks,
    });
    if (logoData?.base64) {
      relsAppendix += `<Relationship Id="rLogoCover" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>`;
    }
    // Cover lives in its own section: empty header/footer refs (no chrome on cover),
    // titlePg + nextPage section break flips to the main content section which has
    // its own header/footer refs and restarts page numbering at 1.
    const section1SectPr = `<w:sectPr>` +
      `<w:pgSz w:w="12240" w:h="15840"/>` +
      `<w:pgMar w:top="1152" w:right="576" w:bottom="1152" w:left="576" w:header="720" w:footer="432" w:gutter="0"/>` +
      `<w:headerReference w:type="default" r:id="rHeaderEmpty"/>` +
      `<w:footerReference w:type="default" r:id="rFooterEmpty"/>` +
      `<w:headerReference w:type="first" r:id="rHeaderEmpty"/>` +
      `<w:footerReference w:type="first" r:id="rFooterEmpty"/>` +
      `<w:titlePg/>` +
      `<w:type w:val="nextPage"/>` +
      `</w:sectPr>`;
    coverXml = innerCover + `<w:p><w:pPr>${section1SectPr}</w:pPr></w:p>`;
  }

  return { coverXml, headerRefXml, footerRefXml, contentTypeOverrides, relsAppendix };
}

// ── Per-question rendering helpers (shared between buildDocx and buildDocxCompare) ──

function _qPara(text, opts={}) {
  const {bold=false, size=24, color="000000", indent=0, spacing=160, rightText=null} = opts;
  const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
  const safe = String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  if (rightText) {
    const ppr = `<w:pPr><w:tabs><w:tab w:val="right" w:pos="10080"/></w:tabs><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    const rightSafe = String(rightText).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const rightRpr = `<w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="444444"/></w:rPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${safe}</w:t></w:r><w:r>${rightRpr}<w:tab/><w:t xml:space="preserve">${rightSafe}</w:t></w:r></w:p>`;
  }
  const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}${bold?'<w:jc w:val="left"/>' :''}</w:pPr>`;
  return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
}

function _qPipeTableToWordXml(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith("|"));
  const rows = tableLines
    .filter(l => !/^\|[-\s|:]+\|$/.test(l))
    .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
  if (!rows.length) return "";

  const numCols = Math.max(...rows.map(r => r.length));
  const colWidth = Math.floor(8640 / numCols);

  const wordRows = rows.map((row, ri) => {
    const isHeader = ri === 0;
    const cells = Array.from({length: numCols}, (_,ci) => {
      const cellText = row[ci] || "";
      const shading = isHeader
        ? `<w:shd w:val="clear" w:color="auto" w:fill="2D2D5A"/>`
        : ci === 0 ? `<w:shd w:val="clear" w:color="auto" w:fill="1A1A3A"/>` : "";
      const textColor = isHeader ? "A0A0CC" : ci === 0 ? "C0C0E0" : "D0D0CC";
      const bold = isHeader || ci === 0;
      const safe = cellText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `<w:tc>
        <w:tcPr>
          <w:tcW w:w="${colWidth}" w:type="dxa"/>
          ${shading}
          <w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
        </w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
          <w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="20"/><w:color w:val="${textColor}"/></w:rPr>
            <w:t xml:space="preserve">${safe}</w:t>
          </w:r>
        </w:p>
      </w:tc>`;
    }).join("");
    const rowProps = isHeader ? `<w:trPr><w:tblHeader/></w:trPr>` : "";
    return `<w:tr>${rowProps}${cells}</w:tr>`;
  }).join("");

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${numCols * colWidth}" w:type="dxa"/>
      <w:tblBorders><w:top w:val="single" w:sz="4" w:color="888888"/><w:left w:val="single" w:sz="4" w:color="888888"/><w:bottom w:val="single" w:sz="4" w:color="888888"/><w:right w:val="single" w:sz="4" w:color="888888"/><w:insideH w:val="single" w:sz="4" w:color="888888"/><w:insideV w:val="single" w:sz="4" w:color="888888"/></w:tblBorders>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    <w:tblGrid>${Array.from({length:numCols},()=>`<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>
    ${wordRows}
  </w:tbl>
  <w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
}

function _qMathPara(text, opts={}) {
  const {indent=0} = opts;
  const ppr = indent
    ? `<w:pPr><w:keepLines/><w:ind w:left="${indent}"/><w:spacing w:after="80"/></w:pPr>`
    : `<w:pPr><w:keepLines/><w:spacing w:after="80"/></w:pPr>`;

  const normalized = isPipeTable(String(text)) ? normalizePipeTable(String(text)) : String(text);

  if (normalized.includes("|") && isPipeTable(normalized)) {
    const blocks = splitTableBlocks(normalized);
    return blocks.map(block => {
      if (block.type === "table") return _qPipeTableToWordXml(block.content);
      if (!block.content.trim()) return "";
      try {
        const omml = mathToOmml(block.content);
        return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
      } catch(e) {
        const safe = block.content.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
      }
    }).join("");
  }

  try {
    const omml = mathToOmml(normalized);
    return `<w:p>${ppr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
  } catch(e) {
    const safe = normalized.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<w:p>${ppr}<w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
  }
}

// "Question N: <text>     [N marks]" — bold+underlined label, inline math text,
// right-tabbed marks. Returns { xml, inlined }; inlined=false means caller must
// emit the text in a separate paragraph (pipe table can't render inline).
function _qBuildHeader(num, text, marks) {
  const headerRpr = `<w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="22"/></w:rPr>`;
  const textRpr   = `<w:rPr><w:sz w:val="22"/></w:rPr>`;
  const marksRpr  = `<w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="444444"/></w:rPr>`;
  const ppr = `<w:pPr><w:tabs><w:tab w:val="right" w:pos="10080"/></w:tabs><w:spacing w:after="120"/></w:pPr>`;

  const raw = String(text || "");
  const normalized = isPipeTable(raw) ? normalizePipeTable(raw) : raw;
  const hasPipeTable = normalized.includes("|") && isPipeTable(normalized);

  let inlineContent = "";
  let inlined = true;
  if (raw && !hasPipeTable) {
    const segments = normalized.split(/(,\s*|\s*;\s*|\s+and\s+|\s+or\s+)/i);
    const parts = segments.map((seg, idx) => {
      if (!seg) return "";
      if (idx % 2 === 1) {
        const safe = seg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<w:r>${textRpr}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
      }
      const nbsp = seg.replace(/ /g, " ");
      try {
        return mathToOmml(nbsp);
      } catch (e) {
        const safe = nbsp.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<w:r>${textRpr}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
      }
    });
    inlineContent = parts.join("");
  } else if (raw && hasPipeTable) {
    inlined = false;
  }

  const inlineRuns = inlineContent
    ? `<w:r>${textRpr}<w:t xml:space="preserve"> </w:t></w:r>${inlineContent}`
    : "";

  const xml = `<w:p>${ppr}` +
    `<w:r>${headerRpr}<w:t xml:space="preserve">Question ${num}:</w:t></w:r>` +
    inlineRuns +
    `<w:r><w:tab/></w:r>` +
    `<w:r>${marksRpr}<w:t xml:space="preserve">[${marks} marks]</w:t></w:r>` +
    `</w:p>`;
  return { xml, inlined };
}

// Inline answer block (only used when includeAnswers=true). Plain text — no
// borders, no shading, no fills. Bold "✓ Answer:" label, same font/size/color
// as the surrounding question text; solution steps follow as math paragraphs.
function _qAnswerBlock(answer, explanation) {
  const labelRpr = `<w:rPr><w:b/><w:sz w:val="22"/></w:rPr>`;

  // Label on its own paragraph
  const headlinePpr = `<w:pPr><w:spacing w:after="40"/></w:pPr>`;
  let cellContent = `<w:p>${headlinePpr}<w:r>${labelRpr}<w:t xml:space="preserve">✓ Answer:</w:t></w:r></w:p>`;

  // Answer math on its own paragraph wrapped in <m:oMathPara> so it can't break
  if (answer != null && String(answer).length > 0) {
    const ansPpr = `<w:pPr><w:keepLines/><w:spacing w:after="60"/><w:ind w:left="280"/></w:pPr>`;
    try {
      const ansOmml = mathToOmml(String(answer).replace(/\u00a0/g, " "));
      cellContent += `<w:p>${ansPpr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${ansOmml}</m:oMathPara></w:p>`;
    } catch (e) {
      const safe = String(answer).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      cellContent += `<w:p>${ansPpr}<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    }
  }

  if (explanation) {
    const steps = mathStepsOnly(explanation);
    steps.forEach((step, i) => {
      const isLast = i === steps.length - 1;
      const stepPpr = `<w:pPr><w:keepLines/><w:spacing w:after="${isLast ? 0 : 40}"/><w:ind w:left="280"/></w:pPr>`;
      try {
        const omml = mathToOmml(step);
        cellContent += `<w:p>${stepPpr}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
      } catch (e) {
        const safe = String(step).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        cellContent += `<w:p>${stepPpr}<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
      }
    });
  }

  return cellContent;
}

// Blank student-work space (only used when includeAnswers=false AND non-MCQ).
// Total height = pointValue × 1440 twips, clamped to [2160, 7200] (1.5"–5").
// Emitted as multiple empty paragraphs at 480-twip line height so Word doesn't
// collapse them (a single empty paragraph or a fixed-row table would be
// collapsed/clipped by the layout engine in some Word builds).
function _qBlankSpace(qMarks) {
  const totalTwips = Math.max(2160, Math.min(7200, (Number(qMarks) || 1) * 1440));
  const lineHeight = 480;
  const numParas = Math.max(1, Math.ceil(totalTwips / lineHeight));
  const oneLine = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${lineHeight}" w:lineRule="exact"/></w:pPr></w:p>`;
  let xml = "";
  for (let i = 0; i < numParas; i++) xml += oneLine;
  return xml;
}

// MCQ = the question carries an explicit list of A–E choices (the choices
// occupy the answer area, so no blank student space is needed).
function _isMCQ(q) {
  return Array.isArray(q?.choices) && q.choices.length > 0;
}

// Parse a BFR text block into stem + parts.
// Returns: { stem: string, parts: [{ label: "a", content: string }, ...] }
function _parseBFRParts(text) {
  const t = String(text || "");
  // Match (a), (b), ... (z) at the start of a line (after optional whitespace)
  const re = /(?:^|\n)\s*\(([a-z])\)\s*/gi;
  const matches = [...t.matchAll(re)];
  if (matches.length === 0) return { stem: t.trim(), parts: [] };

  const stem = t.slice(0, matches[0].index).trim();
  const parts = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : t.length;
    const content = t.slice(start, end).trim();
    parts.push({ label: matches[i][1].toLowerCase(), content });
  }
  return { stem, parts };
}

// Returns true if the part text starts with a sketch keyword
function _isSketchPart(content) {
  const firstWord = String(content || "").trim().split(/\s+/)[0] || "";
  return /^(sketch|draw|graph|plot)/i.test(firstWord);
}

// Coordinate grid for sketch parts: 4" x 4", 16x16 gridlines, axes through center, no labels.
// Shifted ~30% from left margin via paragraph indent.
function _qBlankGrid() {
  // SVG: 384x384 (= 4 inches at 96dpi). 16 cells, 24px each. Axes through center.
  const size = 384;
  const cells = 16;
  const cell = size / cells;
  const center = size / 2;
  let lines = "";
  for (let i = 0; i <= cells; i++) {
    const p = i * cell;
    // Vertical gridline
    lines += `<v:line from="${p},0" to="${p},${size}" strokecolor="#CCCCCC" strokeweight="0.5pt"/>`;
    // Horizontal gridline
    lines += `<v:line from="0,${p}" to="${size},${p}" strokecolor="#CCCCCC" strokeweight="0.5pt"/>`;
  }
  // Axes through center, slightly darker
  const axes =
    `<v:line from="${center},0" to="${center},${size}" strokecolor="#000000" strokeweight="1pt"/>` +
    `<v:line from="0,${center}" to="${size},${center}" strokecolor="#000000" strokeweight="1pt"/>`;
  // Border
  const border = `<v:rect style="position:absolute;left:0;top:0;width:${size};height:${size}" filled="false" strokecolor="#000000" strokeweight="1pt"/>`;
  // Wrap in OMML-compatible drawing — we use a simple w:p with VML for Word compat
  const vml = `<w:p>
    <w:pPr><w:ind w:left="2160"/><w:spacing w:before="120" w:after="120"/></w:pPr>
    <w:r><w:pict>
      <v:group xmlns:v="urn:schemas-microsoft-com:vml" coordsize="${size},${size}" style="width:288pt;height:288pt">
        ${border}
        ${lines}
        ${axes}
      </v:group>
    </w:pict></w:r>
  </w:p>`;
  return vml;
}

// Renders the per-question loop body. Order per question:
//   1. graph/image (if any)
//   2. question header  (Q{n}: <text>     [N marks])
//   3. question text overflow paragraph (only if header couldn't inline it)
//   4. Formula variables (Formula type only)
//   5. choices A–E (MCQ only)
//   6. answer area (the ONLY thing that differs between the two paths)
//   7. divider
async function _renderQuestionsBody(questions, startNum, tc, includeAnswers) {
  let body = "";
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = startNum + i;
    const qMarks = (tc?.questionMarks?.[i] != null) ? (Number(tc.questionMarks[i]) || 10) : 10;

    if (q.hasGraph && q.graphConfig) {
      if (q.type === "Branched Free Response" && !includeAnswers) {
        // skip — BFR graphs are for answer key only
      } else {
        try {
          let b64;
          if (isNewGraphConfig(q.graphConfig)) {
            b64 = await newGraphConfigToPng(q.graphConfig, 480, 280);
          } else {
            const _isStat = q.graphConfig.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
            b64 = _isStat ? await statChartToBase64PNG(q.graphConfig, 480, 280) : await graphToBase64PNG(q.graphConfig, 480, 280);
          }
          if (b64) body += makeDocxImageXml(b64);
        } catch (e) { console.warn("graph png failed", e); }
      }
    }

    if (q.type === "Branched Free Response") {
      const parsed = _parseBFRParts(q.question || "");
      const answersParsed = _parseBFRParts(q.answer || "");
      const explanationsParsed = _parseBFRParts(q.explanation || "");

      const answerMap = {};
      answersParsed.parts.forEach(p => { answerMap[p.label] = p.content; });
      const explanationMap = {};
      explanationsParsed.parts.forEach(p => { explanationMap[p.label] = p.content; });

      // Header for the whole question (number + first line of stem if it fits)
      const hdr = _qBuildHeader(num, parsed.stem || "", qMarks);
      body += hdr.xml;
      if (!hdr.inlined) body += _qMathPara(parsed.stem || "");

      parsed.parts.forEach((p) => {
        // Part label + question text (flush left)
        body += _qMathPara(`(${p.label}) ${p.content}`, { spacing: 120 });

        if (_isSketchPart(p.content)) {
          // Sketch parts are exempt from the matched-layout rule.
          // Exam: full coordinate grid + 2 blank lines for description.
          // Answer key: show the answer (if any), with optional graph rendered separately.
          if (includeAnswers) {
            const ans = answerMap[p.label];
            const expl = explanationMap[p.label] || null;
            if (ans) body += _qAnswerBlock(ans, expl);
          } else {
            body += _qBlankGrid();
            body += _qBlankSpace(2);
          }
          return;
        }

        // Non-sketch part: matched layout.
        // Workspace = answer lines + explanation lines + 1 (breathing room).
        const ans = answerMap[p.label] || "";
        const expl = explanationMap[p.label] || "";
        const ansLines = ans.split(/\n+/).filter(l => l.trim().length > 0).length;
        const explLines = expl.split(/\n+/).filter(l => l.trim().length > 0).length;
        // Match the answer key total: label (1) + answer (1) + explanation lines + breathing (1)
        const workspaceLines = Math.max(3, 2 + ansLines + explLines + 1);

        if (includeAnswers) {
          // Render the answer block; pad with blank lines if the rendered content
          // is shorter than workspaceLines so vertical position matches the exam.
          if (ans) {
            body += _qAnswerBlock(ans, expl || null);
          }
          // Label paragraph + answer paragraph + explanation paragraphs
          const emittedLines = 2 + explLines;
          const padLines = Math.max(1, workspaceLines - emittedLines);
          body += _qBlankSpace(padLines);
        } else {
          // Exam: blank workspace of the same total height.
          body += _qBlankSpace(workspaceLines);
        }
      });
      body += `<w:p><w:pPr><w:spacing w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/></w:pBdr></w:pPr></w:p>`;
      continue;  // skip generic dispatch
    }

    const hdr = _qBuildHeader(num, q.question || "", qMarks);
    body += hdr.xml;
    if (!hdr.inlined) body += _qMathPara(q.question || "");

    if (q.type === "Formula" && q.variables) {
      body += _qPara(
        `Variables: ${q.variables.map(v => v.name+"∈["+v.min+","+v.max+"]").join(", ")}`,
        {indent:360, size:20, color:"555555", spacing:60}
      );
    }

    const hasGraphChoices = _isMCQ(q) && q.choices.some(isGraphChoice);

    if (_isMCQ(q)) {
      for (let ci = 0; ci < q.choices.length; ci++) {
        const c = q.choices[ci];
        const letter = String.fromCharCode(65 + ci);
        if (isGraphChoice(c)) {
          // Letter label on its own line, then the rasterized graph
          body += _qPara(`${letter}.`, { indent: 360, size: 22, spacing: 60 });
          try {
            const png = await _choiceGraphToPng(c);
            if (png) body += makeDocxImageXml(png, 2400000, 2240000);
          } catch (e) { console.warn("choice graph png failed", e); }
        } else {
          body += _qMathPara(`${letter}. ${stripChoiceLabel(c)}`, { indent: 360 });
        }
      }
    }

    // Answer area (the ONLY thing that differs between paths)
    if (includeAnswers) {
      if (q.answer != null && String(q.answer).length > 0) {
        if (hasGraphChoices) {
          // Graph-choice MCQs: answer is a letter; emit a plain text answer block
          body += _qPara(`✓ Answer: Choice ${String(q.answer).trim().toUpperCase()}`, { bold: true, size: 22, spacing: 80 });
        } else {
          body += _qAnswerBlock(stripChoiceLabel(q.answer), q.explanation);
        }
      }
    } else if (!_isMCQ(q)) {
      body += _qBlankSpace(qMarks);
    }

    body += `<w:p><w:pPr><w:spacing w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/></w:pBdr></w:pPr></w:p>`;
  }
  return body;
}

// ── Document assembly ────────────────────────────────────────────────────────

const _DOCX_NS = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

async function _ensureJSZip() {
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
}

// Wraps a body XML string in the document, applies cover/header/footer template
// assets, wires graph image rels, and returns the final docx Blob.
async function _assembleDocxBlob({ body, course, classSection, tc, logoData, questionCount }) {
  let documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${_DOCX_NS} mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1080" w:bottom="1440" w:left="1080" w:header="720" w:footer="720"/>
  <w:pgNumType w:fmt="decimal" w:start="1"/>
__SECTPR_REFS__
</w:sectPr>
</w:body>
</w:document>`;

  await _ensureJSZip();
  const zip = new window.JSZip();

  const tmplAssets = tc ? applyTemplateAssets({ tc, course, classSection, questionCount, logoData, zip }) : null;
  const tmplContentTypeOverrides = tmplAssets?.contentTypeOverrides || `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  ${tmplContentTypeOverrides}
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  if (tmplAssets) {
    if (tmplAssets.coverXml) {
      // Cover page section is spliced in BEFORE the body content (its own section
      // with empty header/footer). The body's section then carries the per-page
      // header + "Page X of Y" footer, with page numbering restarting at 1.
      documentXml = documentXml.replace("<w:body>\n", `<w:body>\n${tmplAssets.coverXml}\n`);
    }
    documentXml = documentXml.replace("__SECTPR_REFS__",
      `${tmplAssets.headerRefXml}\n  ${tmplAssets.footerRefXml}`);
  } else {
    documentXml = documentXml.replace("__SECTPR_REFS__", `  <w:footerReference w:type="default" r:id="rFooter1"/>`);
  }

  // Wire graph image rels
  const imgRe = /<GRAPH_REL_PLACEHOLDER rid="([^"]+)" b64="([^"]+)"\/>/g;
  const imgMatches = [...documentXml.matchAll(imgRe)];
  let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  let imgIdx = 1;
  for (const m of imgMatches) {
    const rid = m[1];
    const b64 = m[2];
    const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    zip.file(`word/media/graph${imgIdx}.png`, imgBytes);
    relsXml += `
  <Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/graph${imgIdx}.png"/>`;
    imgIdx++;
  }
  documentXml = documentXml.replace(imgRe, "");

  if (tmplAssets) {
    relsXml += `\n  ${tmplAssets.relsAppendix}`;
  } else {
    // Fallback "Page X of Y" footer for callers that don't pass a templateConfig.
    zip.file("word/footer1.xml", buildFooterPageOfPagesXml());
    relsXml += `\n  <Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
  }
  relsXml += "\n</Relationships>";

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}

// ── Public exports ───────────────────────────────────────────────────────────

// "Word (.docx)" / "Answer Key (.docx)" share this single implementation.
// includeAnswers=false → exam (blank space for student work)
// includeAnswers=true  → same exam with inline ✓ Answer blocks
// There is NO separate "Answer Key" page appended at the end either way.
export async function buildDocx(questions, course, vLabel, classSection=null, startNum=1, templateConfig=null, includeAnswers=false) {
  _docxImgCounter = 0;
  const tc = templateConfig || null;
  const logoData = tc?.universityLogoUrl && (tc.includeCover || tc.includeHeader)
    ? await fetchLogoBase64(tc.universityLogoUrl)
    : null;

  const titleLabel = classSection ? `Section ${classSection} — Version ${vLabel}` : `Exam Version ${vLabel}`;
  let body = _qPara(`${course} — ${titleLabel}`, {bold:true, size:32, spacing:120});
  body += await _renderQuestionsBody(questions, startNum, tc, includeAnswers);

  return await _assembleDocxBlob({
    body,
    course,
    classSection,
    tc,
    logoData,
    questionCount: questions.length,
  });
}

// Multi-version comparison view, grouped by question number across versions.
// Follows the SAME answer-area logic as buildDocx: includeAnswers=false leaves
// a blank space for free-response per version; includeAnswers=true emits an
// inline ✓ Answer block per version. Cover/header/footer chrome is identical
// to buildDocx (provided the caller passes templateConfig).
export async function buildDocxCompare(versions, course, templateConfig=null, includeAnswers=false) {
  _docxImgCounter = 0;
  const tc = templateConfig || null;
  const logoData = tc?.universityLogoUrl && (tc.includeCover || tc.includeHeader)
    ? await fetchLogoBase64(tc.universityLogoUrl)
    : null;

  const vLabels = versions.map(v => v.label).join(", ");
  const numQ = versions[0]?.questions?.length || 0;
  const vColors = ["1a7a4a","6d28d9","b45309","0e7490","be185d"];

  let body = _qPara(`${course} — All Versions (${vLabels})`, {bold:true, size:32, spacing:100});
  body += _qPara("Version Comparison — Grouped by Question Number", {size:22, color:"555555", spacing:200});

  for (let qi = 0; qi < numQ; qi++) {
    body += `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="334155"/></w:pBdr></w:pPr></w:p>`;
    body += _qPara(`Question ${qi+1} — ${versions[0]?.questions[qi]?.section || ""} — ${versions[0]?.questions[qi]?.difficulty || ""}`, {bold:true, size:26, color:"334155", spacing:80});

    const qMarks = (tc?.questionMarks?.[qi] != null) ? (Number(tc.questionMarks[qi]) || 10) : 10;

    for (let vi = 0; vi < versions.length; vi++) {
      const v = versions[vi];
      const q = v.questions[qi];
      if (!q) continue;
      const vc = vColors[vi % vColors.length];
      body += _qPara(`Version ${v.label}`, {bold:true, size:22, color:vc, spacing:60});

      if (q.hasGraph && q.graphConfig) {
        if (q.type === "Branched Free Response" && !includeAnswers) {
          // skip — BFR graphs are for answer key only
        } else {
          try {
            let b64;
            if (isNewGraphConfig(q.graphConfig)) {
              b64 = await newGraphConfigToPng(q.graphConfig, 480, 280);
            } else {
              const _isStat = q.graphConfig.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
              b64 = _isStat ? await statChartToBase64PNG(q.graphConfig, 480, 280) : await graphToBase64PNG(q.graphConfig, 480, 280);
            }
            if (b64) body += makeDocxImageXml(b64);
          } catch (e) { console.warn("graph png failed", e); }
        }
      }

      body += _qMathPara(q.question || "");

      const hasGraphChoices = _isMCQ(q) && q.choices.some(isGraphChoice);

      if (_isMCQ(q)) {
        for (let ci = 0; ci < q.choices.length; ci++) {
          const c = q.choices[ci];
          const letter = String.fromCharCode(65 + ci);
          if (isGraphChoice(c)) {
            body += _qPara(`${letter}.`, { indent: 360, size: 22, spacing: 60 });
            try {
              const png = await _choiceGraphToPng(c);
              if (png) body += makeDocxImageXml(png, 2400000, 2240000);
            } catch (e) { console.warn("choice graph png failed", e); }
          } else {
            body += _qMathPara(`${letter}. ${stripChoiceLabel(c)}`, { indent: 360 });
          }
        }
      }

      // Answer area follows the exact same rule as buildDocx.
      if (includeAnswers) {
        if (q.answer != null && String(q.answer).length > 0) {
          if (hasGraphChoices) {
            body += _qPara(`✓ Answer: Choice ${String(q.answer).trim().toUpperCase()}`, { bold: true, size: 22, spacing: 80 });
          } else {
            body += _qAnswerBlock(stripChoiceLabel(q.answer), q.explanation);
          }
        }
      } else if (!_isMCQ(q)) {
        body += _qBlankSpace(qMarks);
      }
    }
  }

  return await _assembleDocxBlob({
    body,
    course,
    classSection: null,
    tc,
    logoData,
    questionCount: numQ,
  });
}
