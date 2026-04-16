import { isPipeTable, normalizePipeTable, splitTableBlocks, mathToOmml, mathStepsOnly } from "./helpers.js";
import { graphToBase64PNG, statChartToBase64PNG } from "./graphRendering.js";

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

export async function buildDocx(questions, course, vLabel, classSection=null, startNum=1) {
  _docxImgCounter = 0; // reset per export
  // We build the docx XML manually for full math support
  const ns = `xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;

  function para(text, opts={}) {
    const {bold=false, size=24, color="000000", indent=0, spacing=160} = opts;
    const rpr = `<w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr>`;
    const ppr = `<w:pPr><w:spacing w:after="${spacing}"/>${indent?`<w:ind w:left="${indent}"/>`:''}${bold?'<w:jc w:val="left"/>' :''}</w:pPr>`;
    return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</w:t></w:r></w:p>`;
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
    if (q.type === "Branched") {
      body += para(`${num}. [${q.section}] — ${q.difficulty}`, {bold:true, size:24, spacing:80});
      body += mathPara(`Given: ${q.stem}`);
      (q.parts||[]).forEach((p, pi) => {
        body += para(`(${String.fromCharCode(97+pi)})`, {indent:360, size:22, spacing:60});
        body += mathPara(p.question, {indent:360});
        if (p.choices) p.choices.forEach((c,ci) => {
          body += mathPara(`${String.fromCharCode(65+ci)}. ${c}`, {indent:720});
        });
        if (p.answer) body += para(`Answer: ${p.answer}`, {indent:360, size:22, color:"1a7a4a", spacing:80});
      });
    } else {
      body += para(`${num}. [${q.section}] — ${q.type} — ${q.difficulty}`, {bold:true, size:24, spacing:80});
      body += mathPara(q.question);
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

  let documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns} mc:Ignorable="w14 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
  <w:pgNumType w:fmt="decimal" w:start="1"/>
  <w:footerReference w:type="default" r:id="rFooter1"/>
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
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

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
  relsXml += "\n</Relationships>";
  // strip placeholder tags from documentXml
  documentXml = documentXml.replace(imgRe, "");

  // ── Page number footer ──
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
  relsXml = relsXml.replace("</Relationships>",
    `  <Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>\n</Relationships>`);

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

export async function buildDocxCompare(versions, course) {
  _docxImgCounter = 0; // reset per export
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
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
  <w:pgNumType w:fmt="decimal" w:start="1"/>
  <w:footerReference w:type="default" r:id="rFooter1"/>
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
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
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
  relsXmlC += `</Relationships>`;
  documentXml = documentXml.replace(imgReC, "");

  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relsXmlC);

  return await zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
