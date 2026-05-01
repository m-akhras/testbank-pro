import { escapeXML, mathToCanvasHTML } from "./helpers.js";

// Build the two XML chunks Canvas needs to render the explanation as
// post-submission "neutral feedback" on a question:
//   • inResp     — goes INSIDE <resprocessing>, telling Canvas to display
//                  the feedback whenever the response is processed
//   • afterResp  — goes after </resprocessing> as the <itemfeedback> body
// The explanation is run through mathToCanvasHTML so \dfrac, \int_{a}^{b},
// \sqrt{...} render via Canvas's equation_image <img> tags (the same path
// question text and choices use). Returns empty strings when there is no
// explanation so callers can splice unconditionally.
function _explanationFeedback(q) {
  const raw = q?.explanation;
  if (!raw || !String(raw).trim()) return { inResp: "", afterResp: "" };
  const html = mathToCanvasHTML(String(raw));
  if (!html || !html.trim()) return { inResp: "", afterResp: "" };
  return {
    inResp: `<respcondition continue="Yes"><conditionvar><other/></conditionvar><displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>`,
    afterResp: `<itemfeedback ident="general_fb" view="All"><flow_mat><material><mattext texttype="text/html"><![CDATA[<p>${html}</p>]]></mattext></material></flow_mat></itemfeedback>`,
  };
}
import { graphToBase64PNG, statChartToBase64PNG } from "./graphRendering.js";
import { stripChoiceLabel, isGraphChoice } from "../utils/questions.js";
import { vectorFieldToBase64PNG } from "../../components/display/VectorFieldGraph.js";
import { contourToBase64PNG }     from "../../components/display/ContourGraph.js";
import { regionToBase64PNG }      from "../../components/display/RegionGraph.js";
import { parametricToBase64PNG }  from "../../components/display/ParametricGraph.js";
import { surfaceToBase64PNG }     from "../../components/display/SurfaceGraph.js";
import { pathToBase64PNG }        from "../../components/display/PathGraph.js";
import { isNewGraphConfig, newGraphConfigToPng } from "./newGraphPng.js";

// Dispatch a registered choice-graph config to its base64 PNG. Unknown
// graph types resolve to "" so the placeholder is replaced with an empty
// src — keeps the document valid even if a future config slips through.
async function _choiceGraphConfigToPng(cfg) {
  if (!cfg) return "";
  try {
    switch (cfg.graphType) {
      case "vectorField": return await vectorFieldToBase64PNG(cfg, 300, 280) || "";
      case "contour":     return await contourToBase64PNG(cfg, 300, 280) || "";
      case "region":      return await regionToBase64PNG(cfg, 300, 280) || "";
      case "parametric":  return await parametricToBase64PNG(cfg, 300, 280) || "";
      case "surface":     return await surfaceToBase64PNG(cfg, 300, 280) || "";
      case "path":        return await pathToBase64PNG(cfg, 300, 280) || "";
      default:            return "";
    }
  } catch (_e) {
    return "";
  }
}

// Browser/Node guard — all window access goes through these helpers
const _w = typeof window !== "undefined" ? window : null;
function _graphConfigs() {
  if (!_w) return {};
  _w._qtiGraphConfigs = _w._qtiGraphConfigs || {};
  return _w._qtiGraphConfigs;
}
// Parallel registry for choice-level graphs (stored under unique keys built
// from the item ident and choice index). Resolved to inline base64 PNG data
// URLs in the async zip-wrapper paths below.
function _choiceGraphConfigs() {
  if (!_w) return {};
  _w._qtiChoiceGraphConfigs = _w._qtiChoiceGraphConfigs || {};
  return _w._qtiChoiceGraphConfigs;
}
function _JSZip() { return _w && _w.JSZip; }

// Build a choice's HTML fragment, branching on graph vs string. For graph
// choices, register the config and emit a placeholder img — the placeholder
// is later swapped for an inline base64 data URL by _resolveChoiceGraphs.
function _renderChoiceHtml(c, key) {
  if (isGraphChoice(c)) {
    _choiceGraphConfigs()[key] = c.graphConfig;
    return `<img src="VFCHOICE_PH_${key}" alt="vector field graph" style="max-width:300px;display:block;"/>`;
  }
  return mathToCanvasHTML(stripChoiceLabel(c));
}

// Find the index of the correct choice. For string-only choices this is the
// existing text-match logic. For graph-bearing choice arrays the answer is
// expected to be a single letter (A/B/C/D) and we resolve it directly.
function _findCorrectChoiceIdx(q) {
  const choices = q.choices || [];
  const hasGraph = choices.some(isGraphChoice);
  if (hasGraph && /^[A-Ha-h]$/.test(String(q.answer || "").trim())) {
    return String(q.answer).trim().toUpperCase().charCodeAt(0) - 65;
  }
  const ansStripped = stripChoiceLabel(q.answer);
  return choices.findIndex(c => {
    if (isGraphChoice(c)) return false;
    const cs = stripChoiceLabel(c);
    return cs === ansStripped ||
      (cs || "").trim() === (ansStripped || "").trim() ||
      mathToCanvasHTML(cs)?.trim() === mathToCanvasHTML(ansStripped)?.trim();
  });
}

// Walk a QTI XML string and replace every VFCHOICE_PH_<key> with
// a data:image/png;base64 URL produced by rasterizing the registered graph
// config. Inline base64 keeps the QTI zip self-contained for choice graphs
// (file-based references are reserved for question-body graphs).
async function _resolveChoiceGraphs(xml) {
  const re = /VFCHOICE_PH_([A-Za-z0-9_-]+)/g;
  const matches = [...xml.matchAll(re)];
  const seen = new Set();
  let out = xml;
  for (const m of matches) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const cfg = _choiceGraphConfigs()[key];
    const dataUrl = await _choiceGraphConfigToPng(cfg);
    out = out.split(`VFCHOICE_PH_${key}`).join(dataUrl || "");
  }
  return out;
}

// Strip title/probability from graphConfig for Canvas export unless flagged to include
export function canvasExportConfig(cfg) {
  if (!cfg) return cfg;
  const result = { ...cfg };
  if (!cfg.exportTitle) { delete result.title; }
  if (!cfg.exportProbLabel) { delete result.probability; }
  return result;
}

// ── Validate versions before QTI export — returns array of warning strings ────
export function validateQTIExport(versionsToCheck) {
  const warnings = [];
  versionsToCheck.forEach(v => {
    (v.questions || []).forEach((q, qi) => {
      const issues = [];
      if (q.hasGraph && !q.graphConfig) issues.push("missing graphConfig");
      if (q.hasGraph && q.graphConfig) {
        const gc = q.graphConfig;
        if (gc.distType === "uniform" && (!gc.uMin && gc.uMin !== 0) || (!gc.uMax && gc.uMax !== 0))
          issues.push("uniform dist missing uMin/uMax");
        if (gc.distType === "exponential" && !gc.mu && !gc.lambda)
          issues.push("exponential dist missing mu");
      }
      if (!q.question) issues.push("empty question text");
      if (q.type === "Multiple Choice" && (!q.choices || q.choices.length < 2))
        issues.push("MC missing choices");
      if (issues.length > 0)
        warnings.push(`${v.label} Q${qi+1}: ${issues.join(", ")}`);
    });
  });
  return warnings;
}

// Strip title/probability from graphConfig for Canvas export unless flagged to include
export function buildQTI(questions, course, vLabel, useGroups=false, pointsPerQ=1) {
  const canvasQ = questions.filter(q => q.type !== "Branched Free Response");

  // register graph configs so buildQTIZip can resolve placeholders
  canvasQ.forEach((q, i) => {
    if (q.hasGraph && q.graphConfig) {
      _graphConfigs()[`q${i+1}`] = q.graphConfig;
    }
  });

  function makeItem(q, id, num) {
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${id}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + `Q${num}. ` + mathToCanvasHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    const fb = _explanationFeedback(q);
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="c${ci}"><material><mattext texttype="text/html">${_renderChoiceHtml(c, `${id}_${ci}`)}</mattext></material></response_label>`
      ).join("");
      const correct = _findCorrectChoiceIdx(q);
      return `<item ident="${id}" title="Q${num}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_lid ident="r${id}" rcardinality="Single">
      <render_choice shuffle="false">${cx}</render_choice>
    </response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="No">
      <conditionvar><varequal respident="r${id}">c${correct}</varequal></conditionvar>
      <setvar action="Set" varname="SCORE">${pointsPerQ}</setvar>
    </respcondition>
    ${fb.inResp}
  </resprocessing>
  ${fb.afterResp}
</item>`;
    }
    return `<item ident="${id}" title="Q${num}">
  ${meta}
  <presentation>
    <material><mattext texttype="text/html">${qhtml}</mattext></material>
    <response_str ident="r${id}" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="${pointsPerQ}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    ${fb.inResp}
  </resprocessing>
  ${fb.afterResp}
</item>`;
  }

  if (!useGroups) {
    const items = canvasQ.map((q,i) => makeItem(q, `q${i+1}`, i+1)).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — Version ${vLabel}" ident="assessment1">
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`;
  }

  // Canvas Classic Quizzes grouped format
  // Each section = one Canvas question group
  const sectionMap = {};
  canvasQ.forEach((q,i) => {
    const sec = q.section || "General";
    if (!sectionMap[sec]) sectionMap[sec] = [];
    sectionMap[sec].push({q, globalIdx: i});
  });

  const groupSections = Object.entries(sectionMap).map(([sec, qs], gi) => {
    const pickCount = qs.length; // pick all — user can reduce in Canvas
    const items = qs.map(({q, globalIdx}, li) =>
      makeItem(q, `g${gi}q${li+1}`, globalIdx+1)
    ).join("\n");
    return `    <section ident="group_${gi}" title="${escapeXML(sec)}">
      <selection_ordering>
        <selection>
          <selection_number>${pickCount}</selection_number>
          <selection_extension>
            <points_per_item>${pointsPerQ}</points_per_item>
          </selection_extension>
        </selection>
      </selection_ordering>
${items}
    </section>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment title="${escapeXML(course)} — Version ${vLabel}" ident="assessment1">
    <section ident="root_section">
${groupSections}
    </section>
  </assessment>
</questestinterop>`;
}

// ─── Wrap QTI XML in Canvas-compatible ZIP ────────────────────────────────────
export async function buildQTIZip(qtiXml, title) {
  if (!_JSZip()) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const assessmentId = `assessment_${Math.random().toString(16).slice(2,10)}`;
  const folder = safeTitle;
  const qtiFile = `${folder}/assessment_qti.xml`;
  const metaFile = `${folder}/assessment_meta.xml`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man${assessmentId}"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1.xsd">
  <metadata><schema>IMS Content</schema><schemaversion>1.1</schemaversion></metadata>
  <organizations/>
  <resources>
    <resource identifier="${assessmentId}" type="imsqti_xmlv1p2" href="${qtiFile}">
      <file href="${qtiFile}"/>
      <file href="${metaFile}"/>
    </resource>
  </resources>
</manifest>`;

  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="${assessmentId}" xmlns="http://canvas.instructure.com/xsd/cccv1p0">
  <title>${escapeXML(title)}</title>
  <shuffle_answers>false</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <quiz_type>assignment</quiz_type>
  <allowed_attempts>1</allowed_attempts>
  <show_correct_answers>false</show_correct_answers>
</quiz>`;

  const zip = new (_JSZip())();

  // ── resolve graph placeholders — store PNGs in web_resources/, reference via $IMS-CC-FILEBASE$ ──
  const placeholderRe = /GRAPH_PLACEHOLDER_([^"]+)/g;
  const phMatches = [...qtiXml.matchAll(placeholderRe)];
  const seen = new Set();
  let imgIdx = 0;
  const webResources = []; // { path, identifier }
  for (const m of phMatches) {
    const pid = m[1];
    if (seen.has(pid)) continue;
    seen.add(pid);
    imgIdx++;
    const _gc = _graphConfigs();
    let cfg = _gc[pid];
    if (!cfg) {
      const keys = Object.keys(_gc);
      if (keys.length > 0) cfg = _gc[keys[Math.min(imgIdx-1, keys.length-1)]];
    }
    if (cfg) {
      try {
        let b64;
        if (isNewGraphConfig(cfg)) {
          b64 = await newGraphConfigToPng(cfg, 480, 280);
        } else {
          const _isStatQTI = cfg.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(cfg.type);
          b64 = _isStatQTI ? await statChartToBase64PNG(canvasExportConfig(cfg), 480, 280) : await graphToBase64PNG(canvasExportConfig(cfg), 480, 280);
        }
        if (b64) {
          const imgName = `graph_${imgIdx}.png`;
          const imgPath = `web_resources/${imgName}`;
          const imgBytes = Uint8Array.from(atob(b64.replace(/^data:image\/png;base64,/, "")), ch => ch.charCodeAt(0));
          zip.file(imgPath, imgBytes);
          webResources.push({ path: imgPath, identifier: `graph_res_${imgIdx}` });
          qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join(`$IMS-CC-FILEBASE$${imgPath}`);
        } else {
          qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
        }
      } catch(e) {
        console.warn("graph png failed", e);
        qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
      }
    } else {
      qtiXml = qtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
    }
  }

  // Choice-graph placeholders: rasterize and inline as base64 data URLs.
  qtiXml = await _resolveChoiceGraphs(qtiXml);

  // Add web_resources to manifest so Canvas can resolve them
  const imgResourcesXml = webResources.map(r =>
    `    <resource identifier="${r.identifier}" type="webcontent" href="${r.path}"><file href="${r.path}"/></resource>`
  ).join("\n");
  const patchedManifest = imgResourcesXml
    ? manifest.replace("</resources>", imgResourcesXml + "\n  </resources>")
    : manifest;

  zip.file("imsmanifest.xml", patchedManifest);
  console.log("=== QTI XML OUTPUT ===");
  console.log(qtiXml);
  console.log("=== END QTI XML ===");
  zip.file(qtiFile, qtiXml);
  zip.file(metaFile, meta);

  return await zip.generateAsync({type:"blob", mimeType:"application/zip"});
}

// ─── Classroom Sections Canvas QTI export ─────────────────────────────────────
export async function buildClassroomSectionsQTI(classSectionVersions, course, useGroups=true, pointsPerQ=1) {
  if (!_JSZip()) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function uid8() { return Math.random().toString(16).slice(2,10).padEnd(8,'0'); }

  function makeItem(q, ident, qnum) {
    // register graph config keyed by ident so buildQTIZip resolver always matches
    if (q.hasGraph && q.graphConfig) {
      _graphConfigs()[ident] = q.graphConfig;
    }
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${ident}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + mathToCanvasHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata><qtimetadata>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata></itemmetadata>`;

    const fb = _explanationFeedback(q);
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="${ident}_${ci}"><material><mattext texttype="text/html"><![CDATA[<p>${_renderChoiceHtml(c, `${ident}_${ci}`)}</p>]]></mattext></material></response_label>`
      ).join("\n          ");
      const correct = _findCorrectChoiceIdx(q);
      const correctIdent = `${ident}_${correct}`;
      return `    <item ident="${ident}" title="Q${qnum}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="No">
          ${cx}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
      <respcondition continue="No"><conditionvar><varequal respident="response1">${correctIdent}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
      ${fb.inResp}
      </resprocessing>
      ${fb.afterResp}
    </item>`;
    }
    return `    <item ident="${ident}" title="Q${qnum}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_str ident="response1" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        ${fb.inResp}
      </resprocessing>
      ${fb.afterResp}
    </item>`;
  }

  const sortedSecs = Object.keys(classSectionVersions).sort((a,b) => Number(a)-Number(b));
  const blobs = {};

  for (const sec of sortedSecs) {
    const secVersions = classSectionVersions[sec]; // array of {label, questions}
    const numQ = secVersions[0]?.questions?.length || 0;
    const assessId = `mat_s${sec}_${uid8()}`;
    const title = `${course} Section ${sec} Exam`;
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    const qtiFile = `${safeTitle}/${safeTitle}_questions.xml`;

    let sectionsXml = "";

    if (useGroups) {
      // Grouped: one <section title="Q1"> containing all versions of Q1, etc.
      for (let qi = 0; qi < numQ; qi++) {
        const sectionId = `g${uid8()}`;
        let items = "";
        secVersions.forEach((v) => {
          const q = v.questions[qi];
          if (!q || q.type === "Branched Free Response") return;
          const ident = `i${uid8()}`;
          items += makeItem(q, ident, qi+1) + "\n";
        });
        sectionsXml += `  <section ident="${sectionId}" title="Q${qi+1}">
    <selection_ordering>
      <selection>
        <selection_number>1</selection_number>
        <selection_extension><points_per_item>${pointsPerQ}</points_per_item></selection_extension>
      </selection>
    </selection_ordering>
${items}  </section>\n`;
      }
    } else {
      // Flat: all versions of all questions in one section, ordered V-A Q1, V-B Q1, V-A Q2, V-B Q2...
      const sectionId = `g${uid8()}`;
      let items = "";
      for (let qi = 0; qi < numQ; qi++) {
        secVersions.forEach((v) => {
          const q = v.questions[qi];
          if (!q || q.type === "Branched Free Response") return;
          const ident = `i${uid8()}`;
          items += makeItem(q, ident, qi+1) + "\n";
        });
      }
      sectionsXml = `  <section ident="${sectionId}" title="All Questions">\n${items}  </section>\n`;
    }

    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${assessId}" title="${escapeXML(title)}">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
${sectionsXml}  </assessment>
</questestinterop>`;

    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<quiz identifier="${assessId}" xmlns="http://canvas.instructure.com/xsd/cccv1p0">
  <title>${escapeXML(title)}</title>
  <shuffle_answers>false</shuffle_answers>
  <scoring_policy>keep_highest</scoring_policy>
  <quiz_type>assignment</quiz_type>
  <points_possible>${numQ * pointsPerQ}</points_possible>
  <allowed_attempts>1</allowed_attempts>
  <show_correct_answers>false</show_correct_answers>
</quiz>`;

    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${assessId}_manifest" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1.xsd">
  <metadata><schema>IMS Content</schema><schemaversion>1.1</schemaversion></metadata>
  <organizations/>
  <resources>
    <resource identifier="${assessId}" type="imsqti_xmlv1p2" href="${qtiFile}">
      <file href="${qtiFile}"/>
      <file href="${safeTitle}/${safeTitle}_meta.xml"/>
    </resource>
  </resources>
</manifest>`;

    const zip = new (_JSZip())();

    // ── resolve graph placeholders — store PNGs in web_resources/ ──
    let resolvedQtiXml = qtiXml;
    const phRe = /GRAPH_PLACEHOLDER_([^"]+)/g;
    const phMatches = [...resolvedQtiXml.matchAll(phRe)];
    const seenPh = new Set();
    let secImgIdx = 0;
    const secWebResources = [];
    for (const m of phMatches) {
      const pid = m[1];
      if (seenPh.has(pid)) continue;
      seenPh.add(pid);
      secImgIdx++;
      const cfg = _graphConfigs()[pid];
      if (cfg) {
        try {
          let b64;
          if (isNewGraphConfig(cfg)) {
            b64 = await newGraphConfigToPng(cfg, 480, 280);
          } else {
            const _isStat = cfg.type && ["bar","histogram","scatter","discrete_dist","continuous_dist","standard_normal"].includes(cfg.type);
            b64 = _isStat ? await statChartToBase64PNG(canvasExportConfig(cfg), 480, 280) : await graphToBase64PNG(canvasExportConfig(cfg), 480, 280);
          }
          if (b64) {
            const imgName = `graph_${secImgIdx}.png`;
            const imgPath = `web_resources/${imgName}`;
            const imgBytes = Uint8Array.from(atob(b64.replace(/^data:image\/png;base64,/, "")), ch => ch.charCodeAt(0));
            zip.file(imgPath, imgBytes);
            secWebResources.push({ path: imgPath, identifier: `graph_res_${secImgIdx}` });
            resolvedQtiXml = resolvedQtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join(`$IMS-CC-FILEBASE$${imgPath}`);
          } else {
            resolvedQtiXml = resolvedQtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
          }
        } catch(e) {
          resolvedQtiXml = resolvedQtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
        }
      } else {
        resolvedQtiXml = resolvedQtiXml.split(`GRAPH_PLACEHOLDER_${pid}`).join("");
      }
    }

    // Choice-graph placeholders: rasterize and inline as base64 data URLs.
    resolvedQtiXml = await _resolveChoiceGraphs(resolvedQtiXml);

    const imgResourcesXml = secWebResources.map(r =>
      `    <resource identifier="${r.identifier}" type="webcontent" href="${r.path}"><file href="${r.path}"/></resource>`
    ).join("\n");
    const patchedManifest = imgResourcesXml
      ? manifest.replace("</resources>", imgResourcesXml + "\n  </resources>")
      : manifest;

    zip.file("imsmanifest.xml", patchedManifest);
    console.log("=== QTI XML OUTPUT ===");
    console.log(resolvedQtiXml);
    console.log("=== END QTI XML ===");
    zip.file(qtiFile, resolvedQtiXml);
    zip.file(`${safeTitle}/${safeTitle}_meta.xml`, metaXml);
    blobs[sec] = await zip.generateAsync({type:"blob", mimeType:"application/zip"});
  }

  return blobs; // { "1": Blob, "2": Blob, ... }
}

// ─── Compare-mode exports (grouped by question number across versions) ─────────
export function buildQTICompare(versions, course, useGroups=false, pointsPerQ=1) {
  const numQ = versions[0]?.questions?.length || 0;
  const vLabels = versions.map(v => v.label).join(", ");

  function makeItem(q, id, pointsPer) {
    if (q.hasGraph && q.graphConfig) {
      _graphConfigs()[id] = q.graphConfig;
    }
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${id}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + mathToCanvasHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPer}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    const fb = _explanationFeedback(q);
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="${id}_${ci}"><material><mattext texttype="text/html"><![CDATA[<p>${_renderChoiceHtml(c, `${id}_${ci}`)}</p>]]></mattext></material></response_label>`
      ).join("");
      const correct = _findCorrectChoiceIdx(q);
      return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="No">${cx}</render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No"><conditionvar><varequal respident="response1">${id}_${correct}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
        ${fb.inResp}
      </resprocessing>
      ${fb.afterResp}
    </item>`;
    }
    return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_str ident="response1" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        ${fb.inResp}
      </resprocessing>
      ${fb.afterResp}
    </item>`;
  }

  function uid8() { return Math.random().toString(16).slice(2,10).padEnd(8,'0'); }

  if (!useGroups) {
    let items = "";
    for (let qi = 0; qi < numQ; qi++) {
      versions.forEach(v => {
        const q = v.questions[qi];
        if (!q || q.type === "Branched Free Response") return;
        items += makeItem(q, `i${uid8()}`, pointsPerQ) + "\n";
      });
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment title="${escapeXML(course)}" ident="assessment1">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
    <section ident="root_section">
${items}    </section>
  </assessment>
</questestinterop>`;
  }

  // Grouped: one section per question number, no labels on groups or items
  const groupSections = [];
  for (let qi = 0; qi < numQ; qi++) {
    const sectionId = `g${uid8()}`;
    const items = versions.map(v => {
      const q = v.questions[qi];
      if (!q || q.type === "Branched Free Response") return "";
      return makeItem(q, `i${uid8()}`, pointsPerQ);
    }).filter(Boolean).join("\n");
    groupSections.push(`  <section ident="${sectionId}">
    <selection_ordering>
      <selection>
        <selection_number>1</selection_number>
        <selection_extension><points_per_item>${pointsPerQ}</points_per_item></selection_extension>
      </selection>
    </selection_ordering>
${items}
  </section>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment title="${escapeXML(course)}" ident="assessment1">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
${groupSections.join("\n")}
  </assessment>
</questestinterop>`;
}

// ─── Merged All-Sections QTI: Q1 pool = S1_A + S1_B + S2_A + S2_B + ... ──────
export function buildQTIAllSectionsMerged(classSectionVersions, course, pointsPerQ=1) {
  function uid8() { return Math.random().toString(16).slice(2,10).padEnd(8,'0'); }
  // register graph configs inline per-item (keyed by id) instead of pre-registering

  // Get all sections sorted
  const sortedSecs = Object.keys(classSectionVersions).sort((a,b) => Number(a)-Number(b));
  if (!sortedSecs.length) return null;

  // numQ = questions per version (all sections should have same count)
  const numQ = classSectionVersions[sortedSecs[0]]?.[0]?.questions?.length || 0;

  function makeItem(q, id) {
    if (q.hasGraph && q.graphConfig) {
      _graphConfigs()[id] = q.graphConfig;
    }
    const graphImg = (q.hasGraph && q.graphConfig)
      ? `<img src="GRAPH_PLACEHOLDER_${id}" alt="graph" style="max-width:480px;display:block;margin-bottom:8px;"/>`
      : "";
    const qhtml = graphImg + mathToCanvasHTML(q.question || "");
    const isMC = q.type === "Multiple Choice" && q.choices;
    const qType = isMC ? "multiple_choice_question" : "short_answer_question";
    const meta = `<itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.multiple_choice.v0p1</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${qType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pointsPerQ}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
    const fb = _explanationFeedback(q);
    if (isMC) {
      const cx = q.choices.map((c,ci) =>
        `<response_label ident="${id}_${ci}"><material><mattext texttype="text/html"><![CDATA[<p>${_renderChoiceHtml(c, `${id}_${ci}`)}</p>]]></mattext></material></response_label>`
      ).join("");
      const correct = _findCorrectChoiceIdx(q);
      return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_lid ident="response1" rcardinality="Single">
          <render_choice shuffle="No">${cx}</render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No"><conditionvar><varequal respident="response1">${id}_${correct}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>
        ${fb.inResp}
      </resprocessing>
      ${fb.afterResp}
    </item>`;
    }
    return `    <item ident="${id}">
      ${meta}
      <presentation>
        <material><mattext texttype="text/html"><![CDATA[<p>${qhtml}</p>]]></mattext></material>
        <response_str ident="response1" rcardinality="Single"><render_fib rows="5" columns="80"/></response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        ${fb.inResp}
      </resprocessing>
      ${fb.afterResp}
    </item>`;
  }

  // Build one group per question number, pooling ALL sections × ALL versions
  const groupSections = [];
  for (let qi = 0; qi < numQ; qi++) {
    const sectionId = `g${uid8()}`;
    let items = "";
    // For each section, for each version, add Q[qi]
    sortedSecs.forEach(sec => {
      const secVersions = classSectionVersions[sec] || [];
      secVersions.forEach(v => {
        const q = v.questions[qi];
        if (!q || q.type === "Branched Free Response") return;
        items += makeItem(q, `i${uid8()}`) + "\n";
      });
    });
    const totalItems = sortedSecs.reduce((sum, sec) =>
      sum + (classSectionVersions[sec]||[]).filter(v => v.questions[qi] && v.questions[qi].type !== "Branched Free Response").length, 0);
    groupSections.push(`  <section ident="${sectionId}">
    <selection_ordering>
      <selection>
        <selection_number>1</selection_number>
        <selection_extension><points_per_item>${pointsPerQ}</points_per_item></selection_extension>
      </selection>
    </selection_ordering>
${items}
  </section>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment title="${escapeXML(course)}" ident="assessment1">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
${groupSections.join("\n")}
  </assessment>
</questestinterop>`;
}
