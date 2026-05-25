# Phase 2 — Known issues in question-generation output (§1.1 testing)

**Discovered:** May 25, 2026 — first end-to-end run of the §1.1 template against the live app.
**Status:** Documented, deferred. The template builder and refactored generation pipeline both work; these are downstream issues in either the generation prompt or the SVG renderer.

**Test setup:** Generated 20 questions for Calc 1 §1.1 with primary_focus=mix, function_types including piecewise + others, default difficulty mix.

---

## Issue 1 — Piecewise functions rendered as prose, not standard notation

**Symptom:** Question stem reads `"Let f(x) = x^2 - 2 for x < 1 and f(x) = 3 - 2x for x >= 1. What is f(4)?"` — inline prose, no standard piecewise notation (the big curly brace listing each piece).

**Expected:** Standard piecewise notation with the curly brace, e.g.
```
        ┌ x^2 - 2,   x < 1
f(x) = ┤
        └ 3 - 2x,    x >= 1
```

**Where to fix (likely):** Generation prompt. The output contract or notation rules need a section explaining how to format piecewise functions in question stems. May also need renderer support if the prompt produces a specific mini-syntax that the KaTeX layer doesn't currently understand.

**Effort:** Medium. Need to design the syntax (probably something like `piecewise: {"x^2 - 2": "x < 1", "3 - 2x": "x >= 1"}` or a multi-line LaTeX `cases` environment), update buildPrompt's output contract, and verify the renderer handles it.

---

## Issue 2 — Some questions render with blank graphs

**Symptom:** Out of 20 generated questions, at least 2 had graphs with axes and tick labels rendered but no function curve plotted. The `f(x)` label was also missing.

**Where to fix (unknown — need diagnosis first):**
- Possibility A: Generation prompt produces invalid `graphConfig` (wrong field names, malformed fn syntax, NaN values, out-of-bounds xDomain) and the renderer silently fails.
- Possibility B: Renderer has a bug where certain valid graphConfigs render as empty.

**Diagnosis required:** Inspect the raw question JSON via the "Edit" button on a blank-graph question. Check the `graphConfig` field for:
- Field names matching the schema (`type`, `fn`, `xDomain`, etc.)
- `fn` value as a valid mini-syntax string (not LaTeX, not raw text)
- `xDomain`/`yDomain` as `[number, number]` with finite values
- For piecewise: each piece has valid `fn` and `domain`

**Effort:** Small once diagnosed; medium if it turns out to be a renderer bug.

---

## Issue 3 — Decimal axis tick labels (3.2, 4.9, 0.7, etc.)

**Symptom:** Multiple graphs show ticks like `-4, -3.2, -2.4, -1.6, ...` instead of clean integers like `-4, -3, -2, -1, ...`. Looks unprofessional.

**Where to fix:** Renderer. The tick-generation algorithm currently divides the visible range by ~10 to pick tick spacing. For an xDomain of `[-4, 4]` it computes `8 / 10 = 0.8` per tick.

**Fix design:** Prefer integer tick spacing when the visible range is small (e.g. always emit integers if range <= 20, ceiling at 1.0 spacing). Fall back to decimals only when the range is large enough that integer ticks would be too dense.

**Effort:** Medium. Localized change to the tick-computation function in graphRendering.js.

---

## Issue 4 — Vertical asymptote rendered as a visible curve segment

**Symptom:** Image 5 (rational function with asymptote at x = 2) shows a near-vertical line connecting the two branches of the function across the asymptote. Students will read this as part of the function.

**Where to fix:** Renderer. The plotter is sampling points across the asymptote and joining them with a straight line.

**Fix design:** Detect discontinuities by checking for sudden y-value swings between consecutive samples (e.g. |y[i+1] - y[i]| > some threshold relative to yDomain). When detected, lift the pen between those points instead of drawing a line.

**Effort:** Medium. Standard issue for function plotters; well-understood algorithms exist.

---

## Issue 5 — Missing endpoint markers (closed dots) on bounded domains

**Symptom:** Image 6 (radical function with domain `[-3, ∞)`) shows the curve starting at x = -3 but with no filled dot indicating the endpoint is included. Students cannot distinguish included vs. excluded endpoints visually.

**Where to fix:** Renderer. The renderer needs to draw:
- A filled circle at each closed endpoint (square bracket in interval notation)
- An open circle at each open endpoint (parenthesis in interval notation)

**Fix design:** When a piecewise piece has `extendsLeft: false` and a finite left domain bound, emit a marker at `(leftBound, fn(leftBound))`. The marker should be a filled circle if the bound is closed, open if it's open. Same for right endpoints.

**Effort:** Small-medium. The renderer already supports `holes` and `points` arrays; the generation prompt should emit them, OR the renderer should auto-emit them based on the piece's domain + extendsLeft/extendsRight flags.

---

## Prioritization (suggested order for next session)

1. **Issue 2 (blank graphs)** — highest impact. Unblock by inspecting raw JSON. If it's a prompt bug, fix the prompt. If renderer, fix renderer.
2. **Issue 4 (asymptote line)** — mathematically wrong, students see false connections between branches.
3. **Issue 1 (piecewise notation)** — high pedagogical importance; piecewise is a §1.1 focus topic.
4. **Issue 5 (endpoint dots)** — pedagogically wrong but cosmetic-feeling.
5. **Issue 3 (decimal ticks)** — cosmetic, lowest priority.

---

## What's working

For the record, despite these issues:
- The §1.1 template loads correctly in the UI
- Validation rules fire (piecewise pairing constraint, etc.)
- The generation prompt is produced correctly (16K+ chars, all expected blocks present)
- The 20 questions came back as valid JSON
- 18 of 20 had renderable graphs
- The questions themselves are pedagogically reasonable (correct answers, distractors trace to real misconceptions, explanations are accurate)

So the architecture is sound. These are bugs in the question-rendering polish layer, not in the prompt or template system.
