# Phase 2 Backlog

Captured at the end of Phase 1 (commit 2e0787a). Items here were intentionally deferred to keep Phase 1 focused and shippable.

## High-priority polish (next session)

### Graph renderer

- **Function label offset control.** Add `fnLabelX` / `fnLabelY` (or similar) fields to graphConfig so the `f(x)` label doesn't overlap the curve. Affects `lib/exports/graphRendering.js`.
- **Axis tick customization.** Add fields to graphConfig like:
  - `xTicks` / `yTicks` — explicit array of values to show
  - `hideZero` — boolean to skip 0 on either axis
  - `tickStep` — control spacing of auto-ticks
  Affects `lib/exports/graphRendering.js` and the prompt schema in `buildTemplatePrompt.js`.

### Template prompt quality tuning

- **Add quality blocks for other function types**, analogous to the piecewise quality block. Each common function family (rational, radical, polynomial) may need explicit "good vs bad" examples to prevent the AI from generating trivial cases (e.g., rational functions where the denominator never causes interesting behavior).
- **Stronger language for piecewise + base type interaction.** Phase 1 showed the AI sometimes interprets "piecewise + polynomial" as "mix of piecewise and polynomial questions" instead of "all piecewise with polynomial pieces." Continue monitoring; tighten prompt if needed.

## Template expansion

- Write templates for Calc 1 Sections 1.2, 1.3, 1.4, 1.5.
- Begin templates for Calc 2 chapters used heavily in teaching.
- Begin templates for QM I / QM II high-enrollment sections.

## Architectural milestones

- **Move templates from JS files to Supabase.** Use the `section_templates` table schema sketched in Phase 1 planning. Build a template loader that picks templates from the DB instead of hardcoded JS.
- **API-based generation with the 4-agent pipeline:**
  - Agent 1: Generation Agent (Opus)
  - Agent 2: Spec Compliance Agent (Sonnet)
  - Agent 3: Solver Agent (Sonnet)
  - Agent 4: Repair Agent (Sonnet)
  Phase 1 uses copy-paste; Phase 2 wires the API and runs verification automatically.
- **Review panel as a dedicated route.** Phase 1 reuses the existing review UI. Phase 2 may want a purpose-built review panel with verification badges, replacement controls, and metadata visibility.
- **Replace flow with sibling-aware regeneration.** Single-question regeneration that knows about kept siblings to avoid duplicates.

## Optional features (lower priority)

- Course Learning Outcomes (CLO) mapping. Optional per-course, opt-in. Schema columns already reserved (`outcome_ids` on questions).
- Per-instructor template ownership. Departmental templates come later.
- Per-question feedback buttons (thumbs-up / thumbs-down) for capturing instructor signal over time.

## Known minor issues from Phase 1

- Function label `f(x)` can overlap curves at certain angles (deferred).
- Axis labels show numbers like 0.8, 1.6, 2.4 from auto-tick spacing rather than rounder integers (deferred until axis tick control added).
- The AI sometimes returns weak distractors when no clean misconception fits the question; current prompt allows one weak distractor per question.

## Phase 1 things to revisit if they cause friction

- LF/CRLF line ending warnings on Windows git commits — cosmetic but noisy. Consider setting `.gitattributes` if it becomes annoying.
- The `subtopic`, `function_type`, `representation_form`, `primary_task` metadata fields the template prompt emits are stored in `data` JSONB but not used by any UI yet. Wire them into Bank filters in Phase 2.
