# Exam Generator — Spec

> **Status:** Design locked, not yet built. This document is a specification only.
> No screens, state, or wiring exist yet. Build in the phases at the bottom.

## 1. Purpose & Positioning

The **Exam Generator** is a guided, step-by-step wizard for composing an exam one
question at a time. It is a **second door** into the existing exam engine — *not* a
replacement for anything.

- The current flow (template form → generate → Question Bank → Build Exam →
  Variants/Export) **stays exactly as it is**. It remains the path for the
  admin / power user who wants full manual control.
- The Exam Generator is the **guided path** for users who want the app to do the
  thinking: it asks a short series of questions per exam-question and proposes
  good wordings and specifics drawn from template intelligence and the existing
  bank.
- **The user never sees a template.** Template intelligence runs *behind* the
  wizard to power suggestions. There is no template form anywhere in this flow.

Both doors ultimately produce the same artifacts: canonical questions in the
**Question Bank** and a versioned exam handed to the existing version-builder /
Exam Editor.

---

## 2. Core Flow

The wizard has two stages: an **Add Question** loop that fills a **Draft List**,
then a **Build Exam** step that hands off to the existing engine.

### 2.1 ADD QUESTION (repeats once per question)

Steps run in this order. Order matters — type is picked first so every later
suggestion is smarter.

1. **Question type** — `MCQ` / `open-ended` / `branched`.
   Picked **FIRST** so downstream suggestions (wording, details) can be tailored
   to the type.
2. **Chapter (required) + Section (optional).**
   - Chapter is required.
   - Section is optional. Blank section = chapter-wide suggestions (suggestions
     are drawn from across the whole chapter).
   - **Chapter-only does NOT fall back to a generic suggestion set** — it widens
     the suggestion pool to the chapter, but suggestions stay topic-specific.
3. **Wording** — the app shows **4–5 suggested wordings** for a question on this
   topic, sourced from template intelligence + existing bank questions on the
   same topic. The user **picks one, edits the picked one, or types their own.**
   - This is a *pick-from-options* step, not a single pre-filled draft.
4. **Function / details** — the app suggests the specifics that the chosen
   wording needs (e.g. base of an exponential, evaluation point, coefficients,
   interval). The user **picks or edits.**

→ When the four steps are done, the question **drops into the Draft List.**

### 2.2 DRAFT LIST

- A running list: `Q1, Q2, Q3 …`
- Tap any draft to **edit / delete / reorder**.
- An **“Add Question +”** action restarts the Add-Question loop for the next
  question.
- This is the working surface between composing and building — the user can
  iterate freely here before committing to an exam.

### 2.3 BUILD EXAM

5. **How many versions?** (e.g. A, B, C…)
6. **Mutation type** — `numbers` or `functions` (what varies between versions).

Then the wizard:

- **Assembles** the draft questions with **MCQ questions ordered FIRST**, then
  open-ended / branched questions. (MCQ-first is the default ordering — see open
  question on whether this is a hard rule.)
- **Saves the canonical questions to the BANK with NO mutations.** The bank
  always holds the clean, un-mutated source question.
- **Creates the versioned exam (with mutations)** and **hands off to the existing
  version-builder / Exam Editor**, where the user finishes, previews, and exports
  exactly as today.

---

## 3. Locked Decisions

These are settled. Record them so later sessions don't relitigate:

- **Suggestions are never a form.** Suggestions = *template intelligence + bank
  exemplars*, surfaced as pick-lists inside the wizard. The template is never
  shown.
- **Suggestion source splits by role:**
  - **ADMIN** → copy-paste prompt path (admin pastes the model output back).
  - **USERS** (non-admin) → API path (the app calls the API directly).
  - This mirrors the existing generate flow's admin-vs-user split.
- **Chapter without section — the wording carries its section.**
  Picking a wording implicitly tags the section. Example: choosing *“Which graph
  represents y = 3^x?”* auto-tags that wording's section. The user does not have
  to set the section manually when they pick a section-bearing wording.
  Chapter-only does **not** fall back to a generic suggestion set.
- **Wording step shows 4–5 options to choose from** — not a single editable
  draft. Pick / edit-the-pick / type-your-own.
- **MCQ-first assembly is the default ordering** when building the exam.

---

## 4. Navigation & Where the Screen Lives

> ⚠️ **Reality check vs. older notes.** The brief described navigation as “a
> `screen` state with `setScreen(...)` and a nav list.” The **live tree differs**:
> there is no single `screen` `useState`. Navigation is **Next.js App Router,
> file-based**, with a thin `setScreen()` wrapper over the router. The spec below
> reflects what is actually in the repo today.

What actually exists:

- **Routing is file-based** under `app/app/<feature>/page.js`. Each feature is a
  real route (`/app/generate`, `/app/bank`, `/app/build`, `/app/variants`,
  `/app/export`, `/app/exams`, `/app/courses`, `/app/admin`, `/app/settings`,
  `/app/dashboard`).
- **`setScreen(s)` exists** but it is a wrapper over the router, not a state
  setter:
  ```js
  const setScreen = (s) => { if (SCREEN_ROUTES[s]) router.push(SCREEN_ROUTES[s]); };
  ```
  It is defined in **`context/AppContext.js`** (≈ line 65) and is also duplicated
  locally inside individual page files (e.g. `app/app/generate/page.js` ≈ line
  24). Hooks call `setScreen("review")`, `setScreen("versions")`, etc.
- **`SCREEN_ROUTES`** is the canonical screen-name → route-path registry. It lives
  in **`context/AppContext.js`** (≈ lines 13–18) and is **duplicated** in several
  `page.js` files. It maps logical names to paths, e.g.
  `build`/`versions` → `/app/build`, `variants` → `/app/variants`,
  `saved`/`exams` → `/app/exams`.
- **The nav list is `NAV_GROUPS`** in **`components/layout/Sidebar.jsx`**
  (≈ lines 9–35). It is grouped into `CONTENT`, `EXAMS`, `SETTINGS`. Each item is
  `{ href, icon, label, badgeKey?, adminOnly? }` and navigates via
  `router.push(item.href)`. Active state is derived from `usePathname()`.

**So the Exam Generator is a new screen value following that pattern** — concretely:

1. **New route:** `app/app/exam-generator/page.js` (the screen component lives in
   `components/screens/ExamGeneratorScreen.jsx`, presentation-only, reading state
   from `useAppContext()` like every other screen).
2. **Register the screen name:** add an `examGenerator: "/app/exam-generator"`
   entry to **every** `SCREEN_ROUTES` map (the one in `context/AppContext.js`
   *and* the duplicated copies in page files), so `setScreen("examGenerator")`
   works from hooks.
3. **Add a nav entry:** a new item in `NAV_GROUPS` in `Sidebar.jsx` (likely under
   `CONTENT` or `EXAMS`), e.g.
   `{ href: "/app/exam-generator", icon: "🧭", label: "Exam Generator" }`.

The wizard's own state (current step, draft list, per-question working values)
should live in a **new hook** (`hooks/useExamGenerator.js`) initialized once in
`AppContext` alongside the existing hooks, consistent with the
hooks-own-state / screens-render / AppContext-wires architecture.

---

## 5. Handoff Into the Existing Engine (Build Exam → Versions)

The wizard's Build Exam step does **not** reinvent versioning. It seeds the
existing `useExamBuilder` state and routes to the version-builder, mirroring how
`useExamBuilder.loadMaster()` already works today (`hooks/useExamBuilder.js`
≈ lines 140–151):

- `versions` is an array of `{ label, questions }`. The master is always label
  `"A"` (`hooks/useExamBuilder.js` line 8, `VERSIONS`).
- `loadMaster()` sets `versions = [{ label: "A", questions }]`, sets
  `versionCount`, `versionMutationType`, then calls `setScreen("versions")`.

The Exam Generator's Build Exam step should, in the same spirit:

1. **Save canonical drafts to the bank, un-mutated** (via the bank hook), so each
   draft has a stable `id`.
2. **Seed the master version:** `setVersions([{ label: "A", questions: canonical }])`
   with MCQ-first ordering applied to `canonical`.
3. **Set build settings** from wizard answers: `setVersionCount(n)`,
   `setVersionMutationType(...)` (from `numbers` / `functions`), and lock the
   master as appropriate (`setMasterLocked(...)`).
4. **Route to the existing flow:** `setScreen("versions")` (i.e. `/app/build` /
   Variants), where `triggerVersions()` (`hooks/useExamBuilder.js` ≈ lines
   153–177) builds the per-version prompt and the existing copy-paste / API
   generation produces the mutated versions. Export is unchanged.

This keeps the **bank as the single source of canonical (un-mutated) questions**
and the **exam as the versioned (mutated) artifact**, exactly as today.

---

## 6. Build Phasing

Each phase ends at a working, testable state so multi-session work has clean
boundaries.

### Phase A — Shell (typing only, no intelligence)
- New **“Exam Generator”** screen + route + `SCREEN_ROUTES` entry + `NAV_GROUPS`
  nav item.
- Full **Add-Question walkthrough**: type → chapter/section → wording → details,
  with the **suggestion steps STUBBED as plain text inputs** (no API, no
  copy-paste prompt yet).
- **Draft-list state** with edit / delete / reorder and “Add Question +”.
- **Ends working:** a user can compose a draft exam entirely by typing.

### Phase B — Wire Build Exam to the existing engine
- Implement Build Exam (versions count + mutation type).
- **Save canonical questions to the bank with no mutations.**
- Seed `useExamBuilder` and **hand off to the version-builder / Exam Editor**
  (per §5).
- **Ends working:** the wizard produces a real, exportable exam.

### Phase C — Suggestion engine (admin / copy-paste path first)
- Wording + details suggestions sourced from **template intelligence + bank
  exemplars**.
- Implement the **admin copy-paste path** first.
- **Ends working:** admins get real 4–5 wording suggestions + detail suggestions.

### Phase D — API suggestion path for non-admin users
- The **USER (API) path** for suggestions.
- Couples to API + auth work (role split, rate limits).
- **Ends working:** non-admin users get suggestions without copy-paste.

### Phase E — Branched walk + MCQ-first ordering polish
- Branched **stem-then-parts** walkthrough.
- MCQ-first ordering polish at assembly time.
- **Ends working:** branched questions compose cleanly and ordering is final.

---

## 7. Open Questions — DO NOT DECIDE YET

Leave these flagged for a later call:

- **Copy-paste batching:** does the admin paste **once per question**, or
  **compose all questions then paste once** at the end? (Affects Phase C UX and
  how the draft list interacts with the copy-paste prompt.)
- **Branched questions:** does the wizard **walk stem-then-parts** (one step per
  part), or **suggest the whole branched structure at once**? (Affects Phase E.)
- **MCQ-first ordering:** is MCQ-first a **hard rule**, or a **user-overridable
  default** at the Build Exam step?
