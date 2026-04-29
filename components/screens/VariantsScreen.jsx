"use client";
import PastePanel from "../panels/PastePanel.js";

const VERSIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function VariantsScreen({
  versions,
  masterLocked,
  versionCount,
  setVersionCount,
  numClassSections,
  setNumClassSections,
  versionMutationType,
  setVersionMutationType,
  autoGenLoading,
  autoGenError,
  triggerVersions,
  autoGenerateVersions,
  pendingType,
  setPendingType,
  pendingMeta,
  generatedPrompt,
  setGeneratedPrompt,
  pasteInput,
  setPasteInput,
  pasteError,
  handlePaste,
  setScreen,
  isAdmin,
  course,
  S,
  text1,
  text2,
  text3,
  border,
  accent,
  bg1,
  bg2,
}) {
  const master = versions[0];
  const hasMaster = !!(master && master.questions && master.questions.length > 0);

  // Empty state — direct nav to /app/variants without a master in memory.
  if (!hasMaster) {
    return (
      <div>
        <div style={S.pageHeader}>
          <h1 style={S.h1}>Generate Variants</h1>
          <p style={S.sub}>Create multiple AI-generated variants from a master version.</p>
        </div>
        <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚡</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: text1, marginBottom: "0.5rem" }}>
            No master locked
          </div>
          <div style={{ fontSize: "0.82rem", color: text2, marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Build or load a master version first, then come back to generate variants from it.
          </div>
          <button style={S.btn(accent, false)} onClick={() => setScreen && setScreen("build")}>
            Go to Build →
          </button>
        </div>
      </div>
    );
  }

  const numQ = master.questions.length;
  const totalVersions = versionCount * numClassSections;
  const overLimit = numQ * totalVersions > 15;
  const estTokens = Math.round(numQ * totalVersions * 400 + 1500);
  const estCost = ((numQ * totalVersions * 400 * 3) / 1_000_000 + (numQ * totalVersions * 350 * 15) / 1_000_000).toFixed(3);
  const variantLabels = VERSIONS.slice(1, 1 + versionCount);

  const promptReady = (pendingType === "version_all" || pendingType === "version_all_sections") && !!generatedPrompt;

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={S.h1}>Generate Variants</h1>
          <p style={S.sub}>Configure how many variants to produce from your locked master, then generate.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <button style={{ ...S.oBtn(text2), fontSize: "0.75rem" }} onClick={() => setScreen && setScreen("build")}>← Back to Build</button>
        </div>
      </div>

      {/* Master summary */}
      <div style={{ background: "#052e1688", border: "1px solid #22c55e44", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.1rem" }}>✅</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "#4ade80" }}>
            Master Version A locked · {numQ} question{numQ !== 1 ? "s" : ""}
            {course ? ` · ${course}` : ""}
          </div>
          <div style={{ fontSize: "0.72rem", color: text3, marginTop: "0.2rem" }}>Variants below will be generated from this master.</div>
        </div>
      </div>

      {/* Configure variants */}
      <div style={{ ...S.card, borderColor: "#8b5cf644" }}>
        <div style={{ fontSize: "0.88rem", fontWeight: "600", color: text1, marginBottom: "0.75rem" }}>⚙ Configure Variants</div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={S.lbl}>Variants to generate (after Version A)</div>
            <select style={{ ...S.sel, width: "200px" }} value={versionCount} onChange={e => setVersionCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <option key={n} value={n}>
                  {n} variant{n > 1 ? "s" : ""} ({VERSIONS.slice(1, 1 + n).join(", ")})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={S.lbl}>Classroom sections</div>
            <input
              type="number"
              min={1}
              max={10}
              value={numClassSections}
              style={{ ...S.input, width: "80px" }}
              onChange={e => setNumClassSections(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>

        <div style={{ marginTop: "0.9rem" }}>
          <div style={S.lbl}>Mutation type per variant</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
            {variantLabels.map(lbl => {
              const mut = versionMutationType[lbl] || "numbers";
              return (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.72rem", color: text1, fontWeight: "600" }}>Ver {lbl}:</span>
                  <button
                    style={{ ...S.smBtn, background: mut === "numbers" ? accent + "22" : "transparent", color: mut === "numbers" ? accent : text2, border: "1px solid " + (mut === "numbers" ? accent + "66" : border) }}
                    onClick={() => setVersionMutationType(p => ({ ...p, [lbl]: "numbers" }))}
                  >
                    numbers
                  </button>
                  <button
                    style={{ ...S.smBtn, background: mut === "function" ? "#8b5cf622" : "transparent", color: mut === "function" ? "#8b5cf6" : text2, border: "1px solid " + (mut === "function" ? "#8b5cf666" : border) }}
                    onClick={() => setVersionMutationType(p => ({ ...p, [lbl]: "function" }))}
                  >
                    function
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "1rem", padding: "0.75rem 0.9rem", background: bg2, borderRadius: "8px", border: "1px solid " + border }}>
          <div style={{ fontSize: "0.78rem", color: text1, fontWeight: "600", marginBottom: "0.3rem" }}>Estimated cost</div>
          <div style={{ fontSize: "0.75rem", color: text2 }}>
            {numQ} questions × {versionCount} variant{versionCount > 1 ? "s" : ""}
            {numClassSections > 1 ? ` × ${numClassSections} sections` : ""} = {numQ * totalVersions} generated items
          </div>
          <div style={{ fontSize: "0.75rem", color: text2, marginTop: "0.2rem" }}>
            ~{estTokens.toLocaleString()} tokens · ~${estCost}
          </div>
          {overLimit && (
            <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "0.45rem", padding: "0.4rem 0.6rem", background: "#451a0322", borderRadius: "6px", border: "1px solid #f59e0b44" }}>
              ⚠ {numQ * totalVersions} items may exceed Claude's output — consider fewer questions or fewer versions at once.
            </div>
          )}
        </div>
      </div>

      {/* Build prompt action */}
      <div style={{ marginTop: "1rem", padding: "1rem", background: "#052e1688", borderRadius: "8px", border: "1px solid #22c55e44", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#4ade80" }}>Ready to generate variants?</div>
          <div style={{ fontSize: "0.72rem", color: text3, marginTop: "0.2rem" }}>
            Will produce {versionCount} variant{versionCount > 1 ? "s" : ""}
            {numClassSections > 1 ? ` × ${numClassSections} classroom sections` : ""} from this master.
          </div>
        </div>
        <button
          style={{ ...S.btn("#8b5cf6", false), fontSize: "0.88rem", padding: "0.55rem 1.4rem" }}
          onClick={() => triggerVersions && triggerVersions()}
        >
          📋 Build Prompt →
        </button>
      </div>

      {/* Prompt preview + auto-generate + paste panel */}
      {promptReady && (
        <div style={{ marginTop: "1.5rem" }}>
          <hr style={S.divider} />
          <div style={{ fontSize: "0.78rem", color: accent, fontWeight: "600", marginBottom: "0.5rem" }}>
            📋 Generate Variants
            {pendingType === "version_all_sections" && (
              <> — all {pendingMeta?.numClassSections} sections × {pendingMeta?.labels?.join(", ")}</>
            )}
          </div>
          <div style={S.promptBox}>{generatedPrompt}</div>
          {(() => {
            const nq = pendingMeta?.selected?.length || 0;
            const nv = pendingMeta?.labels?.length || 0;
            const ncs = pendingMeta?.numClassSections || 1;
            const totalV = nv * ncs;
            const cost = ((nq * totalV * 400 * 3) / 1_000_000 + (nq * totalV * 350 * 15) / 1_000_000).toFixed(3);
            const label = ncs > 1 ? `${nq} questions × ${nv} versions × ${ncs} sections` : `${nq} questions × ${nv} versions`;
            return (
              <div style={{ fontSize: "0.72rem", color: text3, marginBottom: "0.5rem" }}>
                Estimated cost: ~${cost} ({label})
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button
              style={{ ...S.btn("#10b981", autoGenLoading), minWidth: "160px" }}
              disabled={autoGenLoading}
              onClick={async () => {
                await autoGenerateVersions(generatedPrompt, pendingType, pendingMeta);
                // On successful handlePaste the parent will setScreen("export")
              }}
            >
              {autoGenLoading ? "⏳ Generating..." : "⚡ Generate Variants"}
            </button>
            {isAdmin && (
              <button style={S.oBtn(accent)} onClick={() => navigator.clipboard.writeText(generatedPrompt)}>
                Copy Prompt
              </button>
            )}
          </div>
          {autoGenError && <div style={{ color: "#f87171", fontSize: "0.78rem", marginBottom: "0.75rem" }}>{autoGenError}</div>}
          <button id="auto-submit-paste" style={{ display: "none" }} onClick={handlePaste} />
          <PastePanel
            label={pendingType === "version_all_sections" ? "Paste the combined JSON response (all sections + versions)." : "Paste Claude's JSON response here."}
            S={S}
            text2={text2}
            pasteInput={pasteInput}
            setPasteInput={setPasteInput}
            pasteError={pasteError}
            handlePaste={handlePaste}
            onCancel={() => {
              setPendingType(null);
              setPasteInput("");
              setGeneratedPrompt("");
            }}
          />
        </div>
      )}
    </div>
  );
}
