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

  Architecture decision: DeepSeek-first pipeline with rigorous deterministic validation as the safety layer. Most failure modes in undergraduate math content (schema bugs, weak distractors, equivalent choices, malformed JSON) are catchable deterministically without expensive models. Claude Sonnet is reserved for rare escalation when DeepSeek's Generator and Solver disagree after multiple attempts.

  Pipeline:
  - Generation Agent: DeepSeek V4 Pro
  - Deterministic validation (code, no LLM): runs FIRST as a free gate; catches schema bugs, missing fields, answer-choice mismatches, duplicate choices, malformed JSON, forbidden notation, equivalent answer choices via mathjs normalization
  - Spec Compliance Agent: DeepSeek V4 Flash + code validation (cheap structural rule check, complementary to deterministic validator)
  - Solver Agent: DeepSeek V4 Pro with thinking mode (independent math verification)
  - Repair Agent: DeepSeek V4 Pro
  - Escalation: Claude Sonnet 4.6 (rare — only when Generator and Solver disagree repeatedly)

  Cost model:
  - ~$0.0035 per question raw (10K questions = $35)
  - With prompt caching on stable template portions: ~$20-25 per 10K
  - Copy-paste flow remains for admin (Mohammad) permanently — API flow is for other users only

  CRITICAL: this strategy is conditional on a quality test. The FIRST Phase 2 task before implementation is a side-by-side comparison:
  - Take 20 representative templates across Calc 1, QM, Discrete
  - Generate the same questions through DeepSeek-only and Sonnet-only pipelines
  - Run both outputs through the deterministic validator
  - Blind-rate outputs on math correctness, distractor quality, notation, exam-readiness

  Decision rule:
  - If DeepSeek output is within ~10% of Sonnet quality on blind ratings, commit to the DeepSeek-first pipeline
  - If DeepSeek is noticeably worse, fall back to hybrid (Sonnet for Generation/Repair, DeepSeek for Solver)
  - If DeepSeek is dramatically worse, fall back to all-Sonnet

  Implementation requirements:
  - **Deterministic validator as a first-class component** in lib/validation/ — schema checks, equivalent-choice detection via mathjs, notation validation, graph config validation
  - **Agent abstraction layer** at lib/agents/router.js with callAgent(agentName, prompt) routing to provider per agent
  - **Agent-to-model config** at lib/agents/config.js with fallback chain per agent so providers can be swapped or fallen back with one-line changes
  - **Per-request logging** from day one: agent name, provider used, token counts, cost, latency, whether fallback fired, whether deterministic validation passed
  - **Prompt caching from day one** — Anthropic supports it natively; DeepSeek's caching has aggressive discounts
  - **Graceful degradation** if DeepSeek API fails: automatic fallback to Sonnet for affected agent temporarily, logged for review
  - **Solver disagreement policy**: re-run with thinking mode; if still disagreeing, escalate to Sonnet
  - **Max repair attempts: 2** per question
  - **Copy-paste flow remains for admin** permanently

  Phase 2 task sequence:
  1. Build agent abstraction layer + per-request logging (foundation for everything else)
  2. Build deterministic validator (the safety net that makes cheap models viable)
  3. Run side-by-side quality test (commit to model choice based on results)
  4. Implement agents one at a time, starting with Generation
  5. Wire fallback logic and monitoring
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
