// ─── Shared helpers for export functions ─────────────────────────────────────
export function escapeXML(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// ─── Pipe table detector ──────────────────────────────────────────────────────
export function isPipeTable(text) {
  const s = String(text);
  // Newline-based table
  const lines = s.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines.filter(l => l.startsWith("|")).length >= 2) return true;
  // Inline table: text contains | cell | cell | pattern (at least 2 columns, 2 rows implied by || separator)
  if (s.includes("|") && /\|[^|]+\|[^|]+\|/.test(s)) {
    // Must have at least 3 pipe chars to be a real table
    return (s.match(/\|/g)||[]).length >= 4;
  }
  return false;
}

// Normalize inline table (no newlines) to newline-based table
export function normalizePipeTable(text) {
  const s = String(text);
  if (s.includes("\n")) return s; // already has newlines

  const pipeIdx = s.indexOf("|");
  if (pipeIdx === -1) return s;

  const before = s.slice(0, pipeIdx).trim();
  const rest = s.slice(pipeIdx);

  const sepMatch = rest.match(/\|[-| :]+\|/);
  if (!sepMatch) return s;

  const sepIdx = rest.indexOf(sepMatch[0]);
  const headerPart = rest.slice(0, sepIdx).trim();
  const afterSep = rest.slice(sepIdx + sepMatch[0].length).trim();
  const headerRow = headerPart.replace(/^\||\|$/g,"").split("|").map(c => c.trim());
  const numCols = headerRow.length;

  const rows = [];
  rows.push("| " + headerRow.join(" | ") + " |");
  rows.push("|" + headerRow.map(() => "---").join("|") + "|");

  const allParts = afterSep.split("|").map(p => p.trim());
  let cellBuf = [];
  let remaining = "";

  for (let i = 0; i < allParts.length; i++) {
    const p = allParts[i];
    if (p === "") {
      if (cellBuf.length === numCols) {
        rows.push("| " + cellBuf.join(" | ") + " |");
        cellBuf = [];
      }
      continue;
    }
    cellBuf.push(p);
    if (cellBuf.length === numCols) {
      rows.push("| " + cellBuf.join(" | ") + " |");
      cellBuf = [];
    }
  }
  if (cellBuf.length > 0 && cellBuf.length < numCols) {
    remaining = cellBuf.join(" ").trim();
  }

  const tableText = rows.join("\n");
  const result = (before ? before + "\n" : "") + tableText + (remaining ? "\n" + remaining : "");
  return result;
}

// Split text into table blocks and non-table blocks
export function splitTableBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = [];
  let inTable = false;

  for (const line of lines) {
    const isTableLine = line.trim().startsWith("|");
    if (isTableLine) {
      if (!inTable && current.length) {
        blocks.push({ type:"text", content: current.join("\n") });
        current = [];
      }
      inTable = true;
      current.push(line);
    } else {
      if (inTable && current.length) {
        blocks.push({ type:"table", content: current.join("\n") });
        current = [];
      }
      inTable = false;
      current.push(line);
    }
  }
  if (current.length) blocks.push({ type: inTable ? "table" : "text", content: current.join("\n") });
  return blocks;
}

// Strip prose lines from explanation — keep only lines that look like math equations
export function mathStepsOnly(explanation) {
  if (!explanation) return [];
  const PROSE_START = /^(use|using|apply|applying|note|since|because|let|we|thus|therefore|hence|so|by|from|with|this|the|a |an |for|now|then|here|recall|substitute|plug|expand|simplify|combine|factor|divide|multiply|add|subtract|differentiat|integrat|taking|setting|solving|substitut)/i;
  return explanation.split(/\n/).map(s => s.trim()).filter(line => {
    if (!line) return false;
    // Keep if it contains math operators or equals signs
    if (/[=+\-*/^(){}[\]]/.test(line)) return true;
    // Keep if it starts with a number, =, or a known math pattern
    if (/^[=\-+0-9(]/.test(line)) return true;
    // Drop pure prose lines
    if (PROSE_START.test(line)) return false;
    // Keep everything else (could be partial math)
    return true;
  });
}
