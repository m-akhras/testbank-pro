# Phase 2 — Final Handoff (end of marathon session, May 25, 2026)

## TL;DR

In one session we built the TestArca AI Template Generator from scratch, shipped it, used it to generate §1.3 (New Functions from Old Functions) live, found 7 issues in real testing, and shipped fixes for all 7. The platform now has:

- A working template generator (admin UI + API + Sonnet integration)
- Two registered templates: §1.1 (hand-written) and §1.3 (AI-generated)
- A significantly richer question-generation prompt (~22K chars per generation)
- New rendering capabilities (graph-as-choices, before/after patterns)
- Per-task question counts (`multi_select_with_counts`)
- Reference examples for textbook-style anchoring
- Nice-number tick spacing in graphs
- Forbidden-character rules to prevent blank graphs and LaTeX leakage
- Diagnostic console warnings for future debugging

## Commit log (in order)

| Commit | What | Files |
|---|---|---|
| c4ffd1e | Phase 2 refactor: extract _generic/ modules | 5 |
| 6c1c84d | Phase 2: move §1.1 rules to data | 1 |
| ed6fda7 | Phase 2: template generator (admin UI + API) | 12 |
| 69b04e9 | Phase 2.5: equals predicate | 2 |
| fe25540 | Phase 2: register §1.3 | 2 |
| 12cce6a | fix: AppContext textbook passthrough | 1 |
| c259992 | fix: GenerateScreen uses shared registry | 1 |
| 8d708c8 | Phase 2.6: graph scale + LaTeX-in-choices | 2 |
| e42c76f | Phase 2.7: nice ticks + image limit 20 | 3 |
| 9cd2e17 | Phase 2.8: blank-graph diagnostics + fn forbidden | 2 |
| (2.9)   | Phase 2.9: graph-as-choices for single/piecewise | 3 |
| d4b831e | Phase 2.10: before/after transformation patterns | 1 |
| (2.11)  | Phase 2.11: reference examples in templates | 2 |
| (2.12)  | Phase 2.12: per-task counts (multi_select_with_counts) | 3 |

Total: ~14 commits, ~30 files touched.

---

## WHAT TO TEST FIRST TOMORROW (priority order)

**Goal: Verify what we shipped tonight actually works as intended.**

### Test 1 — Basic regression (10 min)
1. Open `testarca.com/app/generate`
2. Hard-reload (Ctrl+Shift+R)
3. Pick Calc 1 → §1.1 → defaults → generate 5 questions
4. **Expect:** Questions look like they did before (template form renders, generation works)
5. **Watch for:** No regressions from the cumulative prompt bloat (22K chars now)

### Test 2 — Graph ticks (5 min)
1. From Test 1's output, look at any question with a graph
2. **Expect:** Tick labels are clean integers or clean half-steps (1, 2, 3 or 0.5, 1.0, 1.5)
3. **Bug if you see:** Decimal-ratio ticks like 0.7, 1.4, 2.1

### Test 3 — Console diagnostics (5 min)
1. Open DevTools → Console
2. Generate 5-10 §1.3 questions
3. **Expect:** If any graph fails to render, console shows `[graphRendering.evalFn]` or `[graphRendering.drawCurve]` warning naming the failing expression
4. **Bug if you see:** Blank graphs with no console messages (means warning didn't fire)

### Test 4 — Regenerate §1.3 with new features (15 min)
This is the big one — tests reference_examples, per-task counts, and graph-as-choices end-to-end:

1. Go to `testarca.com/app/admin/template-generator`
2. Calc 1 → §1.3 (this hides it from sections-without-templates list since §1.3 already has one... BUT the page logic might still let you regenerate it — you'll have to check the admin page UI)
3. **Workaround if §1.3 is hidden:** Pick §1.2 instead, or temporarily remove the §1.3 entry from `lib/templates/registry.js`, deploy, regenerate §1.3, then add the entry back
4. Upload 5-10 textbook pages including 3-5 worked examples (now you can upload up to 20)
5. Generate the template
6. **Expect to see in the generated template:**
   - `student_tasks.type: "multi_select_with_counts"` (NEW shape)
   - `student_tasks.default` is array of `{value, count}` objects
   - `reference_examples` array with 2-4 worked examples extracted from materials
   - Conditional blocks use `equals` for single_select predicates
   - No Unicode glyphs (∘, π, ∞) anywhere
7. Save the new template, register it, push
8. Go to `/app/generate`, pick Calc 1 → §1.3
9. **Expect to see in the form:**
   - student_tasks now renders as per-option counters with −/number/+ controls
   - Total: X (target: Y) indicator at the top
10. Pick counts (e.g., 3 composition, 2 horizontal-shift), set count=5, generate
11. **Expect in output questions:**
    - Roughly 3 composition questions, 2 horizontal-shift (Sonnet won't be perfectly precise)
    - Some questions in "Pattern C" (stem graph + graph choices) for transformation questions
    - Style closer to your textbook (reference_examples were embedded in the generation prompt)
    - No blank graphs (FORBIDDEN CHARACTERS rule applied)
    - Tighter graph windows (DOMAIN AND SCALE guidance applied)
    - No LaTeX in MC choices

If steps 6-11 work end-to-end, the full Phase 2 pipeline is validated. That's the proof of the entire night's work.

---

## KNOWN ISSUES STILL OUTSTANDING

### From early §1.1 testing (docs/PHASE_2_KNOWN_ISSUES.md)
These were deferred earlier and remain:
1. **Piecewise functions rendered as inline prose, no curly braces** — generation prompt issue, partially fixable
2. **Missing endpoint dots on bounded domains** — renderer + prompt issue
3. **Vertical asymptotes rendered as visible curve segments** — renderer bug (drawCurve doesn't detect discontinuities)

### Architectural items deferred
1. **`graphType` vs `type` namespace inconsistency** — we papered over it in Batch 4 with a translation shim in `SinglePiecewiseChoice.jsx`. The right long-term fix is unifying the convention across the codebase. Separate session.
2. **22K-char generation prompts** — every individual addition was deliberate but the total may be approaching diminishing returns. Worth measuring quality vs prompt size in a future review.
3. **§1.1 stays on legacy `multi_select` shape** — by your decision. Will be replaced when you regenerate it with the new template generator.

### Untested in this session
- We did not visually verify any of the 7 batches after deploying. You ran tests "later" (some still pending). The next session's first priority is the test suite above.

---

## ARCHITECTURAL INVARIANTS — DON'T BREAK THESE

1. `versions` and `classSectionVersions` always update together (existing rule)
2. `buildDocx` and `buildDocxCompare` have separate local math functions — fix independently (existing rule)
3. Canvas QTI requires sections as direct children of assessment (existing rule)
4. **NEW:** The `_generic/` prompt builder is the single source of truth for question-generation prompts. Per-section templates contribute data only (rules, examples, enums), not code.
5. **NEW:** Graph configs use `type: "single"|"piecewise"` for stems and `graphType: "single"|"piecewise"` for choices. The renderer reads `type`; the choice dispatcher reads `graphType`. SinglePiecewiseChoice.jsx translates between them.
6. **NEW:** `multi_select_with_counts` answers are `[{value, count}, ...]` arrays. Backward-compat with `multi_select` answers (`string[]`) is preserved everywhere.

---

## SECURITY GAPS NOT ADDRESSED

(Flagged earlier, still gaps:)
- `/api/generate` route has no admin gate — anyone with a session can hit it
- `/api/generate-template` has admin gate (good), uses Sonnet (cost-bearing) — keep eye on Anthropic spend

---

## FILES IN /lib/templates/ AT END OF SESSION

```
lib/templates/
├── buildTemplatePrompt.js    (15 lines, thin shim)
├── calc1_1_1.js              (188 lines, hand-written §1.1, legacy multi_select)
├── calc1_1_3.js              (271 lines, AI-generated §1.3, legacy multi_select)
├── registry.js               (54 lines, 2 entries)
└── _generic/
    ├── buildPrompt.js        (~330 lines after Batch 7)
    ├── distractorRules.js    (45 lines)
    ├── graphSchemas.js       (218 lines, +88 today)
    ├── metaPrompt.js         (~460 lines, +50 today)
    ├── notationRules.js      (54 lines)
    └── outputContract.js     (132 lines, +28 today)
```

## SKILLS / TOOLING

The TestArca admin page now lets you:
- Generate templates from textbook materials (up to 20 images per request)
- Use the new multi_select_with_counts field type once you regenerate templates
- See blank-graph diagnostics in DevTools console

---

## RECOMMENDED IMMEDIATE NEXT ACTION (next session, fresh head)

Pick the smallest meaningful task:

1. **Run Test 1 + Test 2** (15 min) — confirm nothing regressed
2. **If clean, run Test 4** (15 min) — the real end-to-end validation of tonight's work
3. **Document anything unexpected** in this doc before doing more work

If Test 4 reveals problems, those are debug priority. If it works, you've validated the whole pipeline and can go back to teaching prep or wherever else your real work is.

---

End of handoff. Sleep.
