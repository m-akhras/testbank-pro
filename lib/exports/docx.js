import { isPipeTable, normalizePipeTable, splitTableBlocks, mathToOmml, mathStepsOnly } from "./helpers.js";
import { graphToBase64PNG, statChartToBase64PNG } from "./graphRendering.js";
import { getCourse } from "../courses/index.js";

// ── Word image XML helper (used by both buildDocx and buildDocxCompare) ──────
let _docxImgCounter = 0;
function makeDocxImageXml(base64png, widthEmu=4800000, heightEmu=2800000) {
  _docxImgCounter++;
  const b64 = base64png.replace(/^data:image\/png;base64,/, "");
  const rid  = `rImg${_docxImgCounter}`;
  const docId = _docxImgCounter;
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docId}" name="Graph${docId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docId}" name="Graph${docId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<GRAPH_REL_PLACEHOLDER rid="${rid}" b64="${b64}"/>`;
}

// ── Template (cover page, header, footer) helpers ────────────────────────────
function escXml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Strip courseCode prefix (with/without space, case-insensitive) plus any leading separator
function stripCourseCodePrefix(title, courseCode) {
  if (!title || !courseCode) return title || "";
  const escaped = courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Allow internal whitespace in courseCode to match zero or more spaces in the title
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

    // Read natural dimensions; fall back to null so callers use 2:1 default
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

// Blue banner — a single-cell full-width table with shading & white bold text
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

// Empty bordered spacer block (single-cell table with given height, in twips)
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

// Cover info table — 9-col non-uniform grid (1500/900/700/1300/900/700/1500/700/1160 = 9360).
// Wider cols at positions 0, 3, 6 give labels room to fit on one line.
// Total table width 9360 twips (full usable page width with 1440 margins).
function buildInfoTable({
  semester, date, time, duration,
  courseTitle, courseCode,
  instructor, sectCombined,
  materialsAllowed,
}) {
  const tcMar = `<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>`;
  const cellBorders = `<w:tcBorders><w:top w:val="single" w:sz="4" w:color="444444"/><w:left w:val="single" w:sz="4" w:color="444444"/><w:bottom w:val="single" w:sz="4" w:color="444444"/><w:right w:val="single" w:sz="4" w:color="444444"/></w:tcBorders>`;

  // Cell builder. Width is explicit (must match the sum of spanned grid columns).
  // opts: width (required, dxa), gridSpan (default 1), label, italic, bold, centered, valign
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

  // Materials Allowed row — full-width cell, multi-paragraph (label + italic body).
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

  // Row 1 — spans [1, 8] — Semester (1700) | <semester> (9388)
  const row1 = `<w:tr>${mkCell("Semester", { width: 1700, gridSpan: 1, label: true })}${mkCell(semester || "", { width: 9388, gridSpan: 8 })}</w:tr>`;

  // Row 2 — spans [1, 2, 1, 2, 1, 2] — Date(1700)|val(1950)|Time(1500)|val(1950)|Duration(1700)|val(2288)
  const row2 = `<w:tr>${mkCell("Exam Date", { width: 1700, gridSpan: 1, label: true })}${mkCell(date || "", { width: 1950, gridSpan: 2 })}${mkCell("Exam Time:", { width: 1500, gridSpan: 1, label: true })}${mkCell(time || "", { width: 1950, gridSpan: 2 })}${mkCell("Exam Duration:", { width: 1700, gridSpan: 1, label: true })}${mkCell(duration || "", { width: 2288, gridSpan: 2 })}</w:tr>`;

  // Row 3 — spans [1, 5, 1, 2] — Course Title(1700)|val(5400)|Course Code(1700)|val(2288)
  const row3 = `<w:tr>${mkCell("Course Title", { width: 1700, gridSpan: 1, label: true })}${mkCell(courseTitle || "", { width: 5400, gridSpan: 5 })}${mkCell("Course Code", { width: 1700, gridSpan: 1, label: true })}${mkCell(courseCode || "", { width: 2288, gridSpan: 2 })}</w:tr>`;

  // Row 4 — spans [1, 8] — Instructor(1700)|val(9388)
  const row4 = `<w:tr>${mkCell("Instructor", { width: 1700, gridSpan: 1, label: true })}${mkCell(instructor || "", { width: 9388, gridSpan: 8 })}</w:tr>`;

  // Row 5 — spans [1, 4, 1, 2, 1] — Name(1700)|blank(4550)|ID No.(850)|blank(2550)|Sect.: NN(1438)
  const row5 = `<w:tr>${mkCell("Name", { width: 1700, gridSpan: 1, label: true })}${mkCell("", { width: 4550, gridSpan: 4 })}${mkCell("ID No.", { width: 850, gridSpan: 1, label: true })}${mkCell("", { width: 2550, gridSpan: 2 })}${mkCell(sectCombined || "Sect.: ", { width: 1438, gridSpan: 1, bold: true, centered: true })}</w:tr>`;

  // Row 6 — span [9] — Materials Allowed (full width, multi-paragraph)
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

// Grading table — 2 rows. Row 1 each cell: "Q{i}" / "/N". Row 2 empty for instructor.
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

  // Two-paragraph header cell: "Q{i}" then "/N"
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

  // Empty cell for the score row
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

  // 1. Logo (centered) — natural aspect ratio when known. Width capped at ~3.33" (3200000 EMU)
  if (logoRid) {
    const cx = logoCx || 3200000;
    const cy = logoCy || 2240000; // 1.43:1 fallback when natural dims unavailable
    xml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>${logoImageXml(logoRid, cx, cy)}</w:p>`;
  }

  // 2. Blue title banner — flush against the info table; tiny zero-height paragraph
  // is required between adjacent tables in OOXML to prevent merging.
  const bannerText = (showVersion && versionLabel) ? `${examTitle} – ${versionLabel}` : (examTitle || "");
  if (bannerText) {
    xml += buildBlueBanner(bannerText);
    xml += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
  }

  // 3. Info table (Semester / Date+Time+Duration / Course / Instructor / Name+ID+Sect.: NN / Materials)
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

  // 4. Blank spacer block — sized so grading table fits on cover page
  xml += buildSpacerBlock(1600);

  xml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;

  // 5. Grading table (header row with Q{i} + /N, plus an empty score row)
  if (Array.isArray(questionMarks) && questionMarks.length > 0) {
    xml += buildGradingTable(questionMarks);
  }

  // 6. Optional general instructions (placed below the cover layout)
  if (examInstructions) {
    xml += `<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Instructions:</w:t></w:r></w:p>`;
    xml += `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr><w:t xml:space="preserve">${escXml(examInstructions)}</w:t></w:r></w:p>`;
  }

  // No final page break — caller appends section-break paragraph
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

function buildFooterPageOfPagesXml() {
  // Thin grey top border, right-aligned "N | P a g e" with letter-spacing on "Page".
  const sty = `<w:rPr><w:sz w:val="18"/><w:color w:val="888888"/></w:rPr>`;
  const styLetter = `<w:rPr><w:sz w:val="18"/><w:color w:val="888888"/><w:spacing w:val="40"/></w:rPr>`;
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
    <w:r>${sty}<w:fldChar w:fldCharType="begin"/></w:r>
    <w:r>${sty}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="separate"/></w:r>
    <w:r>${sty}<w:t>1</w:t></w:r>
    <w:r>${sty}<w:fldChar w:fldCharType="end"/></w:r>
    <w:r>${sty}<w:t xml:space="preserve"> | </w:t></w:r>
    <w:r>${styLetter}<w:t>Page</w:t></w:r>
  </w:p>
</w:ftr>`;
}

function buildFooterEmptyXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>`;
}

// Wires logo + header + cover assets into the zip and rels XML.
// Returns { coverXml, headerRefXml, footerRefXml, contentTypeOverrides, relsAppendix }.
function applyTemplateAssets({ tc, course, classSection = null, questionCount, logoData, zip }) {
  const includeCover  = !!tc.includeCover;
  const includeHeader = !!tc.includeHeader;
  const includeFooter = tc.includeFooter !== false;

  const courseInfo = getCourse(course);
  const courseCode = courseInfo?.courseCode || tc.courseCode || "";
  const cleanedExamTitle = stripCourseCodePrefix(tc.examTitle || "", courseCode);

  let relsAppendix = "";
  let contentTypeOverrides = "";

  // Logo image — write bytes once, reuse rids per consumer (cover + header).
  // Compute EMU dimensions from natural aspect ratio when available; fall back to legacy 2:1 / 1.4:1 values.
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

  // Footer (always added — preserves prior default behavior of showing page #).
  // includeFooter=false → empty footer.
  const footerXml = includeFooter ? buildFooterPageOfPagesXml() : buildFooterEmptyXml();
  zip.file("word/footer1.xml", footerXml);
  contentTypeOverrides += `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
  relsAppendix += `<Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
  const footerRefXml = `<w:footerReference w:type="default" r:id="rFooter1"/>`;

  // Header (only when includeHeader)
  let headerRefXml = "";
  if (includeHeader) {
    // Header has its own rels file; embed the logo there if present
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

  // Cover page (uses rLogoCover from the document.xml.rels)
  // Cover lives in its own section so headers/footers and page-numbering exclude it.
  let coverXml = "";
  if (includeCover) {
    // Empty header & footer for the cover's first-page references (clean cover, no chrome)
    zip.file("word/headerEmpty.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:hdr>`);
    zip.file("word/footerEmpty.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>`);
    contentTypeOverrides += `<Override PartName="/word/headerEmpty.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`;
    contentTypeOverrides += `<Override PartName="/word/footerEmpty.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
    relsAppendix += `<Relationship Id="rHeaderEmpty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="headerEmpty.xml"/>`;
    relsAppendix += `<Relationship Id="rFooterEmpty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footerEmpty.xml"/>`;

    // Per-question marks: default each to 10, length matches the top-level question count
    const questionMarks = Array.from({ length: questionCount }, (_, i) => {
      const v = Number(tc.questionMarks?.[i]);
      return Number.isFinite(v) && v > 0 ? v : 10;
    });
    // Resolve instructor for this section, with fallback to "_default"
    const instructor =
      tc.instructorBySection?.[classSection]
      ?? tc.instructorBySection?.[String(classSection)]
      ?? tc.instructorBySection?._default
      ?? tc.instructorName // legacy from user_settings
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
    // Section-break paragraph terminating the cover's section.
    // titlePg + first refs to empty header/footer = clean page 1.
    // default refs to empty too, so any spillover stays clean.
    // Section 2 (main content) inherits from the body's final sectPr, which restarts page numbering at 1.
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

export async function buildAnswerKey(versions, course) {
  const JSZip = window.JSZip;
  if (!JSZip) { alert("JSZip not loaded"); return null; }

  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  // Plain text paragraph
  function plainPara(text, opts={}) {
    const {bold=false, size=22, color="000000", indent=0, spacing=120} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    const safe = String(text??'').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
  }

  // Math paragraph using OMML
  function mathPara(text, opts={}) {
    const {size=22, color="000000", indent=0, spacing=120} = opts;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    try {
      const omml = mathToOmml(String(text??''));
      const rpr = `<m:rPr><m:sz m:val="${size}"/></m:rPr>`;
      const colorRun = color !== "000000"
        ? `<w:r><w:rPr><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t> </w:t></w:r>`
        : '';
      return `<w:p>${ppr}${colorRun}<m:oMathPara><m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>${omml}</m:oMathPara></w:p>`;
    } catch(e) {
      return plainPara(text, opts);
    }
  }

  const mcTypes = ["Multiple Choice","True/False","Fill in the Blank"];
  let body = "";

  for (const v of versions) {
    const cs = v.questions[0]?.classSection;
    const heading = cs
      ? `${course} — Section ${cs} Version ${v.label} — Answer Key`
      : `${course} — Version ${v.label} — Answer Key`;

    body += plainPara(heading, {bold:true, size:28, spacing:200});

    v.questions.forEach((q, qi) => {
      const num = qi + 1;
      const isFR = q.type === "Free Response" || q.type === "Short Answer";
      const isBranched = q.type === "Branched";
      const isMC = q.type === "Multiple Choice" || q.type === "True/False";

      // ── Question header: Q1. [Section] — Type — Difficulty ──
      const sectionLabel = q.section ? `[${q.section}]` : "";
      const meta = `${sectionLabel}  ${q.type||""}  —  ${q.difficulty||""}`;
      body += plainPara(`Q${num}.  ${meta}`, {bold:true, size:22, color:"1a3a6a", spacing:40});

      // ── Question text ──
      if (isBranched) {
        body += mathPara(q.stem || "", {size:20, color:"333333", indent:280, spacing:40});
        (q.parts||[]).forEach((p, pi) => {
          body += mathPara(`(${String.fromCharCode(97+pi)})  ${p.question||""}`, {size:20, color:"333333", indent:560, spacing:30});
        });
      } else {
        body += mathPara(q.question || "", {size:20, color:"333333", indent:280, spacing:40});
      }

      // ── Answer ──
      if (isBranched) {
        (q.parts||[]).forEach((p, pi) => {
          if (!p.answer) return;
          body += mathPara(`(${String.fromCharCode(97+pi)})  Answer:  ${p.answer}`, {size:21, color:"1a7a4a", indent:560, spacing:30});
          if (p.explanation) {
            const steps = mathStepsOnly(p.explanation);
            steps.forEach((step) => {
              body += mathPara(step, {size:19, color:"444444", indent:840, spacing:25});
            });
          }
        });
      } else if (isFR) {
        if (q.answer) body += mathPara(`Answer:  ${q.answer}`, {size:21, color:"1a7a4a", indent:560, spacing:30});
        if (q.explanation) {
          const steps = mathStepsOnly(q.explanation);
          steps.forEach((step) => {
            body += mathPara(step, {size:19, color:"444444", indent:840, spacing:25});
          });
        }
      } else if (isMC && q.choices && q.answer) {
        const idx = q.choices.indexOf(q.answer);
        const letter = idx >= 0 ? String.fromCharCode(65+idx) : "";
        body += mathPara(`Answer:  ${letter ? letter+".  " : ""}${q.answer}`, {size:21, color:"1a4a8a", indent:560, spacing:30});
      } else if (q.answer) {
        body += mathPara(`Answer:  ${q.answer}`, {size:21, color:"1a7a4a", indent:560, spacing:30});
      }

      // Divider between questions
      body += `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="dddddd"/></w:pBdr></w:pPr></w:p>`;
    });

    body += `<w:p><w:pPr><w:spacing w:after="400"/></w:pPr></w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns}>
<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  zip.file("word/document.xml", documentXml);
  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}

export async function buildDocx(questions, course, vLabel, classSection=null, startNum=1, templateConfig=null) {
  _docxImgCounter = 0; // reset per export
  const tc = templateConfig || null;
  const logoData = tc?.universityLogoUrl && (tc.includeCover || tc.includeHeader)
    ? await fetchLogoBase64(tc.universityLogoUrl)
    : null;
  // We build the docx XML manually for full math support
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=160, rightText=null} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const safe = String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    if (rightText) {
      // Right-tab paragraph: question text on left, marks aligned to ~9000 twips on right
      const ppr = `<w:pPr><w:tabs><w:tab w:val="right" w:pos="10080"/></w:tabs><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
      const rightSafe = String(rightText).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const rightRpr = `<w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="444444"/></w:rPr>`;
      return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${safe}</w:t></w:r><w:r>${rightRpr}<w:tab/><w:t xml:space="preserve">${rightSafe}</w:t></w:r></w:p>`;
    }
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}${bold?'<w:jc w:val="left"/>' :''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
  }

  // Convert pipe table text to Word table XML
  function pipeTableToWordXml(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const tableLines = lines.filter(l => l.startsWith("|"));
    const rows = tableLines
      .filter(l => !/^\|[-\s|:]+\|$/.test(l))
      .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
    if (!rows.length) return "";

    const numCols = Math.max(...rows.map(r => r.length));
    const colWidth = Math.floor(8640 / numCols); // fit in content width (DXA)

    const border = `<w:top w:val="single" w:sz="4" w:color="888888"/><w:left w:val="single" w:sz="4" w:color="888888"/><w:bottom w:val="single" w:sz="4" w:color="888888"/><w:right w:val="single" w:sz="4" w:color="888888"/>`;

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
            <w:tcBorders>${"#D9D0C0"}</w:tcBorders>
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
        <w:tblBorders>${"#D9D0C0".repeat ? border : border}</w:tblBorders>
        <w:tblLook w:val="04A0"/>
      </w:tblPr>
      <w:tblGrid>${Array.from({length:numCols},()=>`<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>
      ${wordRows}
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
  }

  function mathPara(text, opts={}) {
    const {indent=0} = opts;
    const ppr = indent
      ? `<w:pPr><w:keepLines/><w:ind w:left="${indent}"/><w:spacing w:after="80"/></w:pPr>`
      : `<w:pPr><w:keepLines/><w:spacing w:after="80"/></w:pPr>`;

    // Normalize inline tables, then check for pipe tables
    const normalized = isPipeTable(String(text)) ? normalizePipeTable(String(text)) : String(text);

    if (normalized.includes("|") && isPipeTable(normalized)) {
      const blocks = splitTableBlocks(normalized);
      return blocks.map(block => {
        if (block.type === "table") return pipeTableToWordXml(block.content);
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

  // Build a question header line: "Question N:" bold+underlined, then text inline,
  // then right-tabbed [N marks]. Returns { xml, inlined } where inlined=false when
  // the text contained a pipe table and could not be rendered inline (caller must
  // emit a separate mathPara afterwards).
  function buildQuestionHeader(num, text, marks) {
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
      try {
        // mathToOmml returns <m:oMath>...</m:oMath> — inline math, valid as <w:p> child
        inlineContent = mathToOmml(normalized);
      } catch (e) {
        const safe = normalized.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        inlineContent = `<w:r>${textRpr}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
      }
    } else if (raw && hasPipeTable) {
      inlined = false; // caller renders the table-bearing text in a separate paragraph
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

  let body = "";
  // Title
  const titleLabel = classSection ? `Section ${classSection} — Version ${vLabel}` : `Exam Version ${vLabel}`;
  body += para(`${course} — ${titleLabel}`, {bold:true, size:32, spacing:120});

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = startNum + i;
    // ── graph image (buildDocx) ──
    if (q.hasGraph && q.graphConfig) {
      try {
        const _isStat = q.graphConfig.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
        const b64 = _isStat ? await statChartToBase64PNG(q.graphConfig, 480, 280) : await graphToBase64PNG(q.graphConfig, 480, 280);
        if (b64) body += makeDocxImageXml(b64);
      } catch(e) { console.warn("graph png failed", e); }
    }
    // Per-question marks (top-level only, never per-part). Default 10 if missing.
    const qMarks = (tc?.questionMarks?.[i] != null) ? (Number(tc.questionMarks[i]) || 10) : 10;
    if (q.type === "Branched") {
      const hdr = buildQuestionHeader(num, q.stem || "", qMarks);
      body += hdr.xml;
      // If the stem contains a pipe table, mathPara emits the table separately.
      if (!hdr.inlined) body += mathPara(q.stem || "");
      (q.parts||[]).forEach((p, pi) => {
        body += para(`(${String.fromCharCode(97+pi)})`, {indent:360, size:22, spacing:60});
        body += mathPara(p.question, {indent:360});
        if (p.choices) p.choices.forEach((c,ci) => {
          body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:720});
        });
        if (p.answer) body += para(`Answer: ${p.answer}`, {indent:360, size:22, color:"1a7a4a", spacing:80});
      });
    } else {
      const hdr = buildQuestionHeader(num, q.question || "", qMarks);
      body += hdr.xml;
      if (!hdr.inlined) body += mathPara(q.question || "");
      if (q.type==="Formula" && q.variables) {
        body += para(`Variables: ${q.variables.map(v=>v.name+"∈["+v.min+","+v.max+"]").join(", ")}`, {indent:360, size:20, color:"555555", spacing:60});
      }
      if (q.choices) q.choices.forEach((c,ci) => {
        body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:360});
      });
      if (q.answer) body += mathPara(`✓ Answer: ${q.answer}`, {indent:0, size:22, color:"1a7a4a", spacing:60});
      if (q.explanation) body += mathPara(`Note: ${q.explanation}`, {indent:0, size:20, color:"666666", spacing:120});
    }
    body += `<w:p><w:pPr><w:spacing w:after="40"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/></w:pBdr></w:pPr></w:p>`;
  }

  // Will be populated when templateConfig is set, replacing the inline footer block below.
  let __tmplAssets = null;
  let __sectPrRefs = `  <w:footerReference w:type="default" r:id="rFooter1"/>`;
  if (tc) {
    // Note: zip is created later. We build the assets inline once we have it (see below).
  }

  let documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14 wp14">
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

  // Build minimal docx zip using JSZip loaded from CDN
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new window.JSZip();

  // Apply template assets (cover/header/footer) if templateConfig was provided
  __tmplAssets = tc ? applyTemplateAssets({ tc, course, classSection, questionCount: questions.length, logoData, zip }) : null;

  // Compose Content_Types — extra footer/header overrides come from __tmplAssets when present
  const tmplContentTypeOverrides = __tmplAssets?.contentTypeOverrides || `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
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

  // Splice cover page + sectPr references into the document XML
  if (__tmplAssets) {
    if (__tmplAssets.coverXml) {
      // Cover page goes BEFORE the existing body content
      documentXml = documentXml.replace("<w:body>\n", `<w:body>\n${__tmplAssets.coverXml}\n`);
    }
    documentXml = documentXml.replace("__SECTPR_REFS__",
      `${__tmplAssets.headerRefXml}\n  ${__tmplAssets.footerRefXml}`);
  } else {
    documentXml = documentXml.replace("__SECTPR_REFS__", `  <w:footerReference w:type="default" r:id="rFooter1"/>`);
  }

  // extract image data from GRAPH_REL_PLACEHOLDER tags and wire into zip
  const imgRe = /<GRAPH_REL_PLACEHOLDER rid="([^"]+)" b64="([^"]+)"\/>/g;
  const imgMatches = [...documentXml.matchAll(imgRe)];
  let relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  let imgIdx = 1;
  for (const m of imgMatches) {
    const rid = m[1]; // use the rid from the placeholder tag directly
    const b64 = m[2];
    const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    zip.file(`word/media/graph${imgIdx}.png`, imgBytes);
    relsXml += `
  <Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/graph${imgIdx}.png"/>`;
    imgIdx++;
  }
  // strip placeholder tags from documentXml
  documentXml = documentXml.replace(imgRe, "");

  if (__tmplAssets) {
    // Header/footer/logo rels come from the template helper
    relsXml += `\n  ${__tmplAssets.relsAppendix}`;
  } else {
    // ── Page number footer (legacy default when no templateConfig) ──
    const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:t>1</w:t></w:r>
    <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;
    zip.file("word/footer1.xml", footerXml);
    relsXml += `\n  <Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
  }
  relsXml += "\n</Relationships>";

  // ── Answer key page ──
  let answerKeyBody = para("Answer Key", {bold:true, size:28, spacing:120});
  answerKeyBody += para(titleLabel, {size:20, color:"555555", spacing:200});
  const mcTypes = ["Multiple Choice","True/False","Fill in the Blank"];
  const isFreeResponse = (q) => q.type === "Free Response" || q.type === "Short Answer";
  const divider = `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="dddddd"/></w:pBdr></w:pPr></w:p>`;

  questions.forEach((q, i) => {
    const num = i + 1;
    const isMC = q.type === "Multiple Choice" || q.type === "True/False";
    const isBranched = q.type === "Branched";
    const isFR = isFreeResponse(q);

    // Q header: number + section + type + difficulty
    const meta = `${q.section ? "["+q.section+"]  " : ""}${q.type||""}  —  ${q.difficulty||""}`;
    answerKeyBody += para(`Q${num}.  ${meta}`, {bold:true, size:22, color:"1a3a6a", spacing:40});

    // Question text
    if (isBranched) {
      answerKeyBody += mathPara(q.stem||"", {indent:280, size:20, color:"333333", spacing:35});
      (q.parts||[]).forEach((p, pi) => {
        answerKeyBody += mathPara(`(${String.fromCharCode(97+pi)})  ${p.question||""}`, {indent:560, size:20, color:"333333", spacing:30});
      });
    } else {
      answerKeyBody += mathPara(q.question||"", {indent:280, size:20, color:"333333", spacing:35});
    }

    // Answer(s)
    if (isBranched) {
      (q.parts||[]).forEach((p, pi) => {
        if (!p.answer) return;
        answerKeyBody += mathPara(`(${String.fromCharCode(97+pi)})  Answer:  ${p.answer}`, {indent:560, size:21, color:"1a7a4a", spacing:30});
        if (p.explanation) {
          mathStepsOnly(p.explanation).forEach((step) => {
            answerKeyBody += mathPara(step, {indent:840, size:18, color:"555555", spacing:25});
          });
        }
      });
    } else if (isFR) {
      if (q.answer) answerKeyBody += mathPara(`Answer:  ${q.answer}`, {indent:560, size:21, color:"1a7a4a", spacing:30});
      if (q.explanation) {
        mathStepsOnly(q.explanation).forEach((step) => {
          answerKeyBody += mathPara(step, {indent:840, size:18, color:"444444", spacing:25});
        });
      }
    } else if (isMC && q.choices && q.answer) {
      const idx = q.choices.indexOf(q.answer);
      const letter = idx >= 0 ? String.fromCharCode(65+idx) : "";
      answerKeyBody += mathPara(`Answer:  ${letter ? letter+".  " : ""}${q.answer}`, {indent:560, size:21, color:"1a4a8a", spacing:35});
    } else if (q.answer) {
      answerKeyBody += mathPara(`Answer:  ${q.answer}`, {indent:560, size:21, color:"1a7a4a", spacing:35});
    }

    answerKeyBody += divider;
  });

  // page break before answer key
  documentXml = documentXml.replace("</w:body>",
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${answerKeyBody}</w:body>`);

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXml);

  const blob = await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  return blob;
}

export async function buildDocxCompare(versions, course, templateConfig=null) {
  _docxImgCounter = 0; // reset per export
  const tc = templateConfig || null;
  const logoData = tc?.universityLogoUrl && (tc.includeCover || tc.includeHeader)
    ? await fetchLogoBase64(tc.universityLogoUrl)
    : null;
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=120} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</w:t></w:r></w:p>`;
  }

  function mathPara(text, opts={}) {
    const {indent=0} = opts;
    const ppr = `<w:pPr><w:spacing w:after="60"/>${indent?`<w:ind w:left="${indent}"/>`:''}</w:pPr>`;

    // Normalize and detect pipe tables
    const normalized = isPipeTable(String(text)) ? normalizePipeTable(String(text)) : String(text);
    if (normalized.includes("|") && isPipeTable(normalized)) {
      const blocks = splitTableBlocks(normalized);
      return blocks.map(block => {
        if (block.type === "table") {
          // Build Word table XML inline
          const lines = block.content.split("\n").map(l => l.trim()).filter(Boolean);
          const rows = lines.filter(l => !/^\|[-\s|:]+\|$/.test(l))
            .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
          if (!rows.length) return "";
          const numCols = Math.max(...rows.map(r => r.length));
          const colWidth = Math.floor(8640 / numCols);
          const border = `<w:top w:val="single" w:sz="4" w:color="888888"/><w:left w:val="single" w:sz="4" w:color="888888"/><w:bottom w:val="single" w:sz="4" w:color="888888"/><w:right w:val="single" w:sz="4" w:color="888888"/>`;
          const wordRows = rows.map((row, ri) => {
            const isHeader = ri === 0;
            const cells = Array.from({length: numCols}, (_,ci) => {
              const cellText = (row[ci]||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
              const shading = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="2D2D5A"/>` : ci===0 ? `<w:shd w:val="clear" w:color="auto" w:fill="1A1A3A"/>` : "";
              const textColor = isHeader ? "A0A0CC" : ci===0 ? "C0C0E0" : "D0D0CC";
              return `<w:tc><w:tcPr><w:tcW w:w="${colWidth}" w:type="dxa"/><w:tcBorders>${"#D9D0C0"}</w:tcBorders>${shading}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr>${isHeader?'<w:b/>':''}<w:sz w:val="20"/><w:color w:val="${textColor}"/></w:rPr><w:t xml:space="preserve">${cellText}</w:t></w:r></w:p></w:tc>`;
            }).join("");
            return `<w:tr>${isHeader?'<w:trPr><w:tblHeader/></w:trPr>':''}${cells}</w:tr>`;
          }).join("");
          return `<w:tbl><w:tblPr><w:tblW w:w="${numCols*colWidth}" w:type="dxa"/></w:tblPr><w:tblGrid>${Array.from({length:numCols},()=>`<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>${wordRows}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
        }
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

  const vLabels = versions.map(v => v.label).join(", ");
  const numQ = versions[0]?.questions?.length || 0;
  const vColors = ["1a7a4a","6d28d9","b45309","0e7490","be185d"];

  let body = para(`${course} — All Versions (${vLabels})`, {bold:true, size:32, spacing:100});
  body += para("Version Comparison — Grouped by Question Number", {size:22, color:"555555", spacing:200});

  for (let qi = 0; qi < numQ; qi++) {
    body += `<w:p><w:pPr><w:spacing w:after="60"/><w:pBdr><w:top w:val="single" w:sz="6" w:space="1" w:color="334155"/></w:pBdr></w:pPr></w:p>`;
    body += para(`Question ${qi+1} — ${versions[0]?.questions[qi]?.section || ""} — ${versions[0]?.questions[qi]?.difficulty || ""}`, {bold:true, size:26, color:"334155", spacing:80});

    for (let vi = 0; vi < versions.length; vi++) {
      const v = versions[vi];
      const q = v.questions[qi];
      if (!q) continue;
      const vc = vColors[vi % vColors.length];
      body += para(`Version ${v.label}`, {bold:true, size:22, color:vc, spacing:60});
      // ── graph image (buildDocxCompare) ──
      if (q.hasGraph && q.graphConfig) {
        try {
          const _isStat = q.graphConfig.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(q.graphConfig.type);
          const b64 = _isStat ? await statChartToBase64PNG(q.graphConfig, 480, 280) : await graphToBase64PNG(q.graphConfig, 480, 280);
          if (b64) body += makeDocxImageXml(b64);
        } catch(e) { console.warn("graph png failed", e); }
      }
      body += mathPara(q.question);
      if (q.choices) q.choices.forEach((c,ci) => {
        body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:360});
      });
      body += mathPara(`Answer: ${q.answer}`);
    }
  }

  let documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14">
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

  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new window.JSZip();

  const __tmplAssetsC = tc ? applyTemplateAssets({ tc, course, classSection: null, questionCount: numQ, logoData, zip }) : null;
  const tmplCTypeOverridesC = __tmplAssetsC?.contentTypeOverrides || "";

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${tmplCTypeOverridesC}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);

  // Splice cover + sectPr refs
  if (__tmplAssetsC) {
    if (__tmplAssetsC.coverXml) {
      documentXml = documentXml.replace("<w:body>\n", `<w:body>\n${__tmplAssetsC.coverXml}\n`);
    }
    documentXml = documentXml.replace("__SECTPR_REFS__",
      `${__tmplAssetsC.headerRefXml}\n  ${__tmplAssetsC.footerRefXml}`);
  } else {
    documentXml = documentXml.replace("__SECTPR_REFS__", "");
  }

  // extract image data from GRAPH_REL_PLACEHOLDER tags (buildDocxCompare)
  const imgReC = /<GRAPH_REL_PLACEHOLDER rid="([^"]+)" b64="([^"]+)"\/>/g;
  const imgMatchesC = [...documentXml.matchAll(imgReC)];
  let relsXmlC = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  let imgIdxC = 1;
  for (const m of imgMatchesC) {
    const rid = m[1]; // use rid from placeholder directly
    const b64 = m[2];
    const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    zip.file(`word/media/graph${imgIdxC}.png`, imgBytes);
    relsXmlC += `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/graph${imgIdxC}.png"/>`;
    imgIdxC++;
  }
  if (__tmplAssetsC) {
    relsXmlC += __tmplAssetsC.relsAppendix;
  }
  relsXmlC += `</Relationships>`;
  documentXml = documentXml.replace(imgReC, "");

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXmlC);

  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
