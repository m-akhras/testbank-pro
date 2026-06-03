# Exam Pipeline — Design (validation · regenerate · state propagation · export gate)

> **Status: DESIGN — NOT YET IMPLEMENTED.** This is the authoritative spec for
> the post-composition exam pipeline. No code described under "Decision" /
> "Design" below exists yet; anchors point at the *current* tree so impl prompts
> can wire against real symbols.
>
> **Scope vs. [`exam_generator_spec.md`](./exam_generator_spec.md):** that doc
> specifies the *Exam Generator wizard* (a guided **composition** front door) and
> ends at the handoff into `useExamBuilder` (its §5). **This** doc picks up
> *after* a master exists and governs the **pipeline** that both doors share —
> the existing manual `generate → bank → build → variants/export` flow and the
> wizard alike. It does not restate wizard mechanics; see that doc's §5 for how a
> master is seeded.

---

## 1. The pipeline (one-directional)

```
generate master
      ↓
validate master ──→ fix flagged ──┐
      ↑                            │  (loop until clean at THIS stage)
      └────────────── re-validate ─┘
      ↓
build versions          ← master stage is DONE here; no reaching back
      ↓
validate versions ──→ fix flagged (per-variant) ──┐
      ↑                                            │  (loop until clean)
      └────────────────────────── re-validate ─────┘
      ↓
export (gated)
```

**Invariant — fixes happen at the current stage; no reaching back.** Once
versions are built, the master stage is closed. Late fixes are made on the
**version side** via the regenerate menu (§3), which already dual-writes
`versions` + `classSectionVersions`. Editing the master *after* build is treated
as a destructive rebuild, not an in-place patch (§2).

This ordering exists because the build step is a **one-way snapshot**: variants
B–U are generated *from* the master at build time
(`hooks/useGenerate.js:191`, `:230-232`) and the master's questions array is
shallow-copied into the built set. Nothing re-derives `classSectionVersions`
from the master afterward, so any "reach back" silently desyncs the export
(the live bug Step 1 fixes).

---

## 2. STEP 1 — State-propagation fix (foundation; fixes the live stale-export bug)

### Problem

Seven master-edit handlers in `components/screens/BuildScreen.jsx` write
`setVersions(...)` **only**, never `setClassSectionVersions(...)`, and each
collapses `versions` to a single `[{ label:"A", ... }]` entry — **dropping any
built variants B–U**:

| Anchor | Handler | Action |
|---|---|---|
| `BuildScreen.jsx:229` | `updateMasterQuestion` | edit one question (also the "None of these" toggle path at `:252`) |
| `BuildScreen.jsx:233` | `removeMasterQuestion` | delete a question |
| `BuildScreen.jsx:243` | `handleMasterDragEnd` | reorder |
| `BuildScreen.jsx:268` | `addNoneOfTheseToAll` | bulk add "None of these" |
| `BuildScreen.jsx:434` | InlineEditor `onSave` | inline edit save |
| `BuildScreen.jsx:446` | GraphEditor `onSave` | graph save |
| `BuildScreen.jsx:452` | GraphEditor `onRemove` | graph remove |

After a multi-section build, `classSectionVersions` is the snapshot the export
buttons read (`ExportScreen.jsx:495, :507`, all-sections-merged). Because these
handlers never touch it, editing the master post-build leaves the exported
snapshot **stale** — the export ships pre-edit questions, and the QTI guard
faithfully validates the *stale* snapshot, not the master the user just changed.

For comparison, the **correct dual-write pattern** already exists in three
places and is the template to follow:

- replace branch — `hooks/useGenerate.js:323` (`setVersions`) + `:326/:331`
  (`setClassSectionVersions`)
- export inline edit — `ExportScreen.jsx:664` + `:665`
- validation patch — `_patchLocalVersions`, `hooks/useValidation.js:150` + `:151`

### Decision

**Once versions are built, the master stage is DONE.** We do *not* try to make
master edits propagate into the built set — propagation of late content fixes is
the version side's job (§3). Instead:

- **Pre-build (no built set yet):** master edits are **unchanged**. The seven
  handlers above keep working exactly as today. `classSectionVersions` is empty /
  irrelevant at this point, so there is no desync. (The out-of-scope
  `setVersions`-only sites — `BuildScreen.jsx:212/:286/:355`,
  `useGenerate.js:279/:286/:314`, `useExamBuilder.js:143`,
  `ExamsScreen.jsx:119` — all run pre-build or in the non-class-section flow and
  are deliberately left alone.)

- **Post-build (a built set exists):** editing the master **marks the built set
  STALE** rather than silently diverging:
  - **Export buttons disable** with: **"Master changed — rebuild versions to
    export."**
  - **The edit itself warns first:** **"Editing the master discards variants
    B–U and requires a rebuild. Continue?"** — Yes proceeds with the existing
    collapse-to-`[A]` behavior (now an *explicit* discard); No cancels.

- A small piece of state distinguishes the two modes — e.g. a `builtStale` flag
  (or deriving "a built set exists" from `Object.keys(classSectionVersions)` /
  `versions.length > 1`) set when a master edit lands after build, cleared on a
  fresh build (`useGenerate.js:196-197`, `:237-238`). The export gate (§4) and
  the master-edit confirm both read it.

**Rationale.** This makes the one-way pipeline honest: the build is a snapshot,
the master is its source, and the only safe way to push master changes into a
built set is to rebuild. It removes the "phantom edit" failure mode without
adding a fragile master→sections propagation path. Genuine late fixes go through
the version-side regenerate (§3), which dual-writes correctly.

---

## 3. STEP 2 — Regenerate menu (reuse the replace flow)

One **per-question menu, identical at every stage**, with three actions:

| Action | Meaning | Prompt |
|---|---|---|
| **Re-roll** | brand-new question, same section/type/choice-count; **do not** preserve old numbers/function | **new** `buildReplacePrompt` mode |
| **Mutate** | today's variation: keep concept, vary by `numbers` or `function` | existing `buildReplacePrompt` modes |
| **Fix** | correct a flagged question; prompt **aimed by the validation flag/reason** | existing flow + the flag's `reason` |

### Reuse — no new generation pipeline

All three route through the **existing replace machinery** — the *only* writer
that already syncs both states:

1. **Trigger:** `triggerReplace(vIdx, qIdx, mutationType)`
   (`hooks/useGenerate.js:122-129`).
2. **Prompt:** `buildReplacePrompt(q, mutationType)`
   (`lib/prompts/index.js:542-555`). Already carries numbers/function rules
   (`:543-545`) and a **mandatory MC answer-verification block** (`:546-548`:
   "answer field exactly matches one of the 4 choices … all 4 distinct"), and
   returns a 1-item JSON array.
3. **Apply:** `handlePaste` `"replace"` branch
   (`hooks/useGenerate.js:319-339`) — writes **both** `versions` (`:323`) **and**
   `classSectionVersions` (`:326-329` by `classSection`, else `:331-337` across
   sections). This dual-write is exactly what Step 1 relies on for late fixes.

### New work (small, additive)

- **Re-roll mode** in `buildReplacePrompt`: a third `mutationType` (e.g.
  `"reroll"`) whose rule says *fresh question on the same section/type with the
  same choice count; do not preserve the original numbers or function.* Keep the
  same MC answer-verification tail (`:546-548`) so re-rolled MCQs are still
  guaranteed answer-∈-choices.
- **Fix mode** passes the validation `reason` (from `q.validationIssues`, §4)
  into the prompt so the model targets the specific error, otherwise identical to
  the replace flow.

### Wiring

- **Build (master) screen:** replace the **no-op stub** at `BuildScreen.jsx:416`
  ("Replace from the Bank screen for now") with a real `triggerReplace` →
  3-way menu. **Pre-build, this writes version A** (`versions[0]`); it is a
  normal master edit and is allowed. (Post-build it falls under the §2 rebuild
  rule.)
- **Export (version) screen:** extend the existing ↻ Replace / ↻ Diff. buttons
  (`ExportScreen.jsx:636-647`, currently `numbers`/`function` only) into the same
  3-way menu. Here it **writes the variant slot in both states** via the replace
  branch dual-write.

Same menu component on both surfaces; the only difference is which slot
(`vIdx/qIdx`) it targets.

---

## 4. STEP 3 — Validation at both stages + reconcile inconsistencies

### Run validation at both stages

`autoValidateAllVersions` (`hooks/useValidation.js:161`) already iterates every
question in `versions`. Run it:

- at the **master** stage — `versions` is the single-version set `[A]`;
- after **build** — on the full versions / sections set.

It persists `{validationStatus, validationIssues, validatedAt}` onto each
question (`useValidation.js:210-212`), keyed for the DB by
`dbId = q.originalId || q.id` (`:201`), and mirrors onto both in-memory states
via `_patchLocalVersions` (`:146-159`).

### Inconsistency 1 — two different answer-∈-choices checks → **unify on lenient**

- Static `validateQuestion` uses **exact** membership:
  `choices.includes(q.answer)` (`lib/utils/questions.js:190`).
- The QTI export key is decided by the **lenient** matcher
  `_findCorrectChoiceIdx` (`lib/exports/qti.js:125-139`, wrapped by
  `answerMatchesAChoice` `:145-149` and the export gate's
  `collectUnkeyedMCQuestions`).

These can disagree (e.g. `"B) -4"` vs choice `"-4"`): static flags it, the
export keys it fine — or vice-versa. **The lenient matcher is the source of
truth** because it determines what actually ships to Canvas. **Unify
`validateQuestion`'s MC answer-∈-choices check onto `_findCorrectChoiceIdx`** so
the badge, the validator, and the export gate never disagree. (Scope the change
to the answer-membership check; leave the other structural checks — empty text,
mixed graph choices, `[graph: …]` echo — as they are.)

### Inconsistency 2 — export screen hides AI status → **surface it**

The export version list renders **only** the static `validateQuestion` ⚠️ count
(`ExportScreen.jsx:622`, `:630-634`) and does **not** use `QuestionCard`, so the
AI `<ValidationBadge>` never appears there. Surface the AI `validationStatus`
(and the inherited badge, below) on the export-side cards too, so the
fix-before-export loop is visible where exports happen.

### Inconsistency 3 — variant badge inheritance → **confirm, don't fight it**

`QuestionCard.jsx:216-237`: a question with no `validationStatus` of its own but
with an `originalId` inherits the bank source's status
(`bankArr.find(b => b.id === q.originalId)`, `:226`), shown as `inherited:true`.
Because every variant shares one `originalId`, **all variants display the
parent's badge until they have a real status of their own.** The post-build
**version-validation pass writes each variant its own `validationStatus`** (via
`_patchLocalVersions`), at which point the inherited badge is superseded.

**Confirmed intended behavior:** inheritance is a *placeholder* shown only when
no real per-variant status exists yet. After the version-validation pass runs,
each variant shows its own verdict. The design does **not** remove inheritance
(it's the right pre-validation default); it just ensures the version pass always
runs before export so inheritance isn't what the user ships on.

### Export gate (honor system — the user owns the exam)

The gate runs on click for all QTI buttons (today's `guardQTI` in
`components/screens/ExportScreen.jsx`, built on `collectUnkeyedMCQuestions`).

- **HARD BLOCK (un-overridable):** any choice-bearing question whose answer is
  **∉ its choices under the lenient guard** (`collectUnkeyedMCQuestions`). These
  ship **keyless** to Canvas ("couldn't determine the correct answers") — never
  allowed out. This is the existing blocking guard; keep it blocking.
- **SOFT CONFIRM (overridable):** any **other** uncleared flag
  (`validationStatus === "error"|"warning"`, or static structural issues) →
  confirmation dialog: **"N flagged questions weren't fixed. Export anyway?"** —
  **Yes** ships, **No** returns to the list. The user owns the exam; we warn
  loudly but don't prevent.
- **Stale built set (from §2):** while `builtStale` is set, export buttons are
  **disabled** with "Master changed — rebuild versions to export." This is
  upstream of the flag gate (you can't even reach the dialog until you rebuild).

---

## 5. Build sequence (note for implementers)

Ship in this order — each step stands alone and is independently testable:

1. **Step 1 (state-propagation fix)** — first. Small, and it fixes the *live*
   stale multi-section export bug on its own.
2. **Step 2 (regenerate menu)** — depends on nothing in Step 3; gives users the
   in-stage fix tool the pipeline assumes.
3. **Step 3 (validation both stages + reconcile + gate)** — last; relies on the
   regenerate menu existing (the "Fix" action) and on Step 1's stale handling
   for the gate's disabled state.

---

## 6. Anchor index (current tree — for impl prompts)

| Concern | Symbol / file:line |
|---|---|
| Master-edit handlers (Step 1 scope) | `BuildScreen.jsx:229, 233, 243, 268, 434, 446, 452` |
| Build snapshot (master→versions copy) | `useGenerate.js:191`, `:230-232`; commits `:196-197`, `:237-238` |
| Dual-write exemplars | `useGenerate.js:323`+`:326/:331`; `ExportScreen.jsx:664`+`:665`; `useValidation.js:150`+`:151` |
| Replace trigger / prompt / apply | `useGenerate.js:122-129`; `lib/prompts/index.js:542-555`; `useGenerate.js:319-339` |
| Replace UI (extend) / Build stub (replace) | `ExportScreen.jsx:636-647`; `BuildScreen.jsx:416` |
| Validation run / persist / patch | `useValidation.js:161`, `:133-140`, `:201`, `:146-159` |
| Badge + inheritance | `QuestionCard.jsx:216-237`, `:258-269` |
| Static vs lenient matcher | `lib/utils/questions.js:190` vs `lib/exports/qti.js:125-139`, `:145-149` |
| Export gate | `collectUnkeyedMCQuestions` (`lib/exports/qti.js`) + `guardQTI` (`ExportScreen.jsx`) |
| Master seeding (cross-ref wizard §5) | `useExamBuilder.js:140-151`, `triggerVersions` `:153-177` |
