"use client";
import MathTextInline from "./MathTextInline.js";

const border = "#D9D0C0";

function parsePipeTable(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith("|"));
  const rows = tableLines
    .filter(l => !/^\|[-\s|:]+\|$/.test(l))
    .map(l => l.replace(/^\||\|$/g,"").split("|").map(c => c.trim()));
  return rows;
}

export default function PipeTableHTML({ text }) {
  const rows = parsePipeTable(text);
  if (!rows.length) return <span>{text}</span>;
  return (
    <table style={{
      borderCollapse:"collapse", fontSize:"0.82rem", margin:"0.5rem 0",
      width:"auto", maxWidth:"100%"
    }}>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => {
            const Tag = ri === 0 ? "th" : "td";
            return (
              <Tag key={ci} style={{
                border:"1px solid "+border,
                padding:"0.3rem 0.6rem",
                background: ri === 0 ? "#1a1a35" : ci === 0 ? "#141428" : "transparent",
                color: ri === 0 ? "#a0a0c0" : "#d0d0cc",
                fontWeight: ri === 0 || ci === 0 ? "bold" : "normal",
                textAlign:"center",
                whiteSpace:"nowrap"
              }}>
                <MathTextInline>{cell}</MathTextInline>
              </Tag>
            );
          })}
        </tr>
      ))}
    </table>
  );
}
