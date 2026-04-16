"use client";
import { useRef } from "react";
import { isPipeTable, normalizePipeTable, splitTableBlocks } from "../../lib/exports/helpers.js";
import MathTextInline from "./MathTextInline.js";
import PipeTableHTML from "./PipeTableHTML.js";

export default function MathText({ children }) {
  const ref = useRef(null);
  const src = String(children ?? "");

  if (src.includes("|") && isPipeTable(src)) {
    const normalized = normalizePipeTable(src);
    const blocks = splitTableBlocks(normalized);
    return (
      <span>
        {blocks.map((block, i) =>
          block.type === "table"
            ? <PipeTableHTML key={i} text={block.content} />
            : <MathTextInline key={i}>{block.content}</MathTextInline>
        )}
      </span>
    );
  }

  return <MathTextInline>{src}</MathTextInline>;
}
