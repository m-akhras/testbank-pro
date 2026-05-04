// Shared design tokens + style factory for route pages.
// Mirrors the S object inside TestBankApp.js so extracted screens render identically.

export const bg0    = "#F2EDE4";
export const bg1    = "#FDFAF5";
export const bg2    = "#F7F2E9";
export const bg3    = "#EDE8DE";
export const border = "#D9D0C0";
export const text1  = "#1C1A16";
export const text2  = "#6B6355";
export const text3  = "#A89E8E";
export const green1 = "#2D6A4F";
export const green2 = "#1B4332";
export const amber1 = "#92400E";

export const QTYPES = ["Multiple Choice", "Free Response", "True/False", "Fill in the Blank", "Formula", "Branched Free Response", "Branched MCQ"];
export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"];
export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function makeStyles(accent = green1) {
  return {
    app: { display: "flex", minHeight: "100vh", background: bg0, fontFamily: "'Georgia',serif", color: text1 },
    main: { flex: 1, minWidth: 0, padding: "2.5rem 3rem", maxWidth: "980px" },
    pageHeader: { marginBottom: "2rem", borderBottom: "1px solid " + border, paddingBottom: "1.25rem" },
    h1: { fontSize: "1.75rem", fontWeight: "700", letterSpacing: "-0.03em", marginBottom: "0.25rem", color: text1, fontFamily: "'Georgia',serif" },
    h2: { fontSize: "1.1rem", fontWeight: "700", letterSpacing: "-0.02em", marginBottom: "0.5rem", color: text1, fontFamily: "'Georgia',serif" },
    sub: { color: text2, fontSize: "0.83rem", marginBottom: "0", lineHeight: 1.6, fontFamily: "'Inter',system-ui,sans-serif" },

    card:   { background: bg1, border: "1px solid " + border, borderRadius: "14px", padding: "1.5rem", marginBottom: "1rem", boxShadow: "0 1px 3px rgba(45,106,79,0.06)" },
    cardSm: { background: bg1, border: "1px solid " + border, borderRadius: "10px", padding: "1rem",   marginBottom: "0.75rem", boxShadow: "0 1px 2px rgba(45,106,79,0.04)" },
    statCard: () => ({ background: bg1, border: "1px solid " + border, borderRadius: "14px", padding: "1.25rem", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(45,106,79,0.06)" }),
    statAccent: (c) => ({ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: c }),

    courseChip: (c, active) => ({
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: "0.4rem 0.9rem", borderRadius: "20px", cursor: "pointer", border: "none",
      background: active ? c + "20" : bg2,
      color: active ? c : text2,
      fontSize: "0.78rem", fontWeight: active ? "600" : "400",
      outline: active ? "1.5px solid " + c + "77" : "1px solid " + border,
      fontFamily: "'Inter',system-ui,sans-serif", transition: "all 0.15s",
    }),
    courseDot: (c) => ({ width: "7px", height: "7px", borderRadius: "50%", background: c, flexShrink: 0 }),

    sGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.35rem" },
    sBtn: (sel) => ({
      background: sel ? green1 + "15" : bg2,
      border: "1px solid " + (sel ? green1 + "55" : border),
      borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer",
      color: sel ? green1 : text2, fontSize: "0.78rem", textAlign: "left",
      fontFamily: "'Inter',system-ui,sans-serif", display: "flex", alignItems: "center", gap: "0.45rem", transition: "all 0.15s",
    }),
    chk: (sel) => ({
      width: "14px", height: "14px", borderRadius: "4px",
      border: "1.5px solid " + (sel ? green1 : text3),
      background: sel ? green1 : "transparent", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "9px", color: "#fff", fontWeight: "bold",
    }),

    row:   { display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" },
    field: { flex: 1, minWidth: "120px" },
    lbl:   { display: "block", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: text3, marginBottom: "0.4rem", fontWeight: "600", fontFamily: "'Inter',system-ui,sans-serif" },
    sel:   { width: "100%", background: bg2, border: "1px solid " + border, borderRadius: "8px", padding: "0.6rem 0.8rem", color: text1, fontSize: "0.83rem", fontFamily: "'Inter',system-ui,sans-serif" },
    input: { background: bg2, border: "1px solid " + border, borderRadius: "8px", padding: "0.6rem 0.8rem", color: text1, fontSize: "0.83rem", fontFamily: "'Inter',system-ui,sans-serif", width: "100%" },

    btn: (bg, dis) => ({
      background: dis ? bg3 : bg, color: dis ? text3 : "#fff",
      border: "none", borderRadius: "9px", padding: "0.65rem 1.4rem",
      fontSize: "0.83rem", fontWeight: "600", cursor: dis ? "not-allowed" : "pointer",
      fontFamily: "'Inter',system-ui,sans-serif", display: "inline-flex", alignItems: "center", gap: "0.45rem",
      transition: "opacity 0.15s", opacity: dis ? 0.5 : 1,
    }),
    oBtn: (c) => ({
      background: "transparent", color: c, border: "1px solid " + c + "66",
      borderRadius: "9px", padding: "0.55rem 1.1rem", fontSize: "0.78rem",
      cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif",
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
    }),
    smBtn: { background: bg2, border: "1px solid " + border, color: text2, borderRadius: "6px", padding: "0.2rem 0.55rem", fontSize: "0.68rem", cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif" },
    ghostBtn: (c) => ({
      background: c + "15", color: c, border: "1px solid " + c + "33", borderRadius: "6px",
      padding: "0.25rem 0.6rem", fontSize: "0.7rem", cursor: "pointer",
      fontFamily: "'Inter',system-ui,sans-serif", fontWeight: "500",
    }),

    tag: (c) => ({
      display: "inline-flex", alignItems: "center", gap: "0.25rem",
      background: (c || green1) + "15", border: "1px solid " + (c || green1) + "33",
      color: (c || green1), borderRadius: "5px", padding: "0.1rem 0.45rem",
      fontSize: "0.65rem", fontWeight: "600", marginRight: "0.25rem",
      fontFamily: "'Inter',system-ui,sans-serif",
    }),
    diffTag: (d) => {
      const dc = d === "Easy" ? "#2D6A4F" : d === "Medium" ? "#92400E" : "#9B1C1C";
      const bgc = d === "Easy" ? "#D1FAE5" : d === "Medium" ? "#FEF3C7" : "#FEE2E2";
      return { display: "inline-block", background: bgc, color: dc, border: "none", borderRadius: "4px", padding: "0.1rem 0.45rem", fontSize: "0.62rem", fontWeight: "700", fontFamily: "'Inter',system-ui,sans-serif" };
    },
    divider: { border: "none", borderTop: "1px solid " + border, margin: "1.5rem 0" },

    qCard: { background: bg1, border: "1px solid " + border, borderRadius: "12px", padding: "1.1rem", marginBottom: "0.6rem", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: "0 1px 2px rgba(45,106,79,0.04)" },
    qMeta: { fontSize: "0.62rem", color: text3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.4rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", fontFamily: "'Inter',system-ui,sans-serif" },
    qText: { fontSize: "0.88rem", color: text1, lineHeight: 1.75, marginBottom: "0.65rem", fontFamily: "'Georgia',serif" },
    cList: { listStyle: "none", padding: 0, margin: 0, marginBottom: "0.5rem" },
    cItem: (correct) => ({
      padding: "0.35rem 0.65rem", marginBottom: "0.2rem", borderRadius: "6px",
      background: correct ? "#D1FAE5" : "transparent",
      border: "1px solid " + (correct ? "#2D6A4F44" : border),
      color: correct ? green2 : text2, fontSize: "0.83rem",
      display: "flex", alignItems: "flex-start", gap: "0.5rem",
      fontFamily: "'Inter',system-ui,sans-serif",
    }),
    ans:  { fontSize: "0.8rem", color: green2, background: "#D1FAE5", border: "1px solid #2D6A4F30", borderRadius: "6px", padding: "0.35rem 0.7rem", marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: "'Inter',system-ui,sans-serif" },
    expl: { fontSize: "0.76rem", color: text2, fontStyle: "italic", marginTop: "0.2rem", lineHeight: 1.6, fontFamily: "'Georgia',serif" },
    vTab: (active, c) => ({ background: active ? c + "20" : "transparent", border: "1px solid " + (active ? c + "66" : border), color: active ? c : text2, borderRadius: "8px", padding: "0.4rem 0.9rem", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif", fontWeight: active ? "600" : "400" }),

    pasteBox:  { background: bg1, border: "1px solid " + green1 + "33", borderRadius: "12px", padding: "1.25rem", marginTop: "1.5rem" },
    textarea:  { width: "100%", minHeight: "110px", background: bg0, border: "1px solid " + border, borderRadius: "8px", padding: "0.75rem", color: text1, fontSize: "0.8rem", fontFamily: "'JetBrains Mono','Fira Code',monospace", resize: "vertical" },
    promptBox: { background: bg0, border: "1px solid " + border, borderRadius: "8px", padding: "1rem", marginBottom: "1rem", fontSize: "0.72rem", color: text2, fontFamily: "'JetBrains Mono','Fira Code',monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "180px", overflowY: "auto" },
  };
}
