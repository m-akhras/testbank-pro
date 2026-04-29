# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js development server
npm run build    # Build for production
npm start        # Start production server
```

There is no test runner configured.

## Environment Setup

Required `.env.local` variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `ANTHROPIC_API_KEY` — Claude API key (server-side only, used in the generate route)

Database schema is in `supabase-setup.sql` — run it in Supabase SQL editor when setting up a new project.

## Architecture

**TestBank Pro** is an AI-powered exam question generator for college-level mathematics, built as a Next.js 14 full-stack app using the App Router.

The codebase is split along three axes: **hooks** own state and business logic, **screens** render that state into a UI, and **AppContext** wires the hooks to the screens. There is no longer a single monolithic component — the previous `components/TestBankApp.js` has been broken up into the layers described below.

### Request Flow

1. `middleware.js` — Guards `/app` and `/admin` routes; unauthenticated users are redirected to `/login`
2. `app/login/page.js` — Email/password auth via Supabase; only emails in the `approved_emails` table are allowed
3. `app/app/page.js` — Authenticated entry point; redirects to `/app/dashboard`
4. `app/app/layout.js` — Wraps every `/app/*` route with `<AppContext.Provider>` (which initializes all hooks once) so screens can pull state via `useAppContext()`
5. `app/api/generate/route.js` — Calls Anthropic Claude API for question generation/validation; enforces a 20-requests/hour rate limit via the `api_usage` table
6. `app/api/extract-pdf/` — PDF text extraction endpoint for paste-from-PDF flows

### Hooks (state + business logic)

Each hook owns one concern and is initialized once inside `AppContext`. Screens never instantiate a hook directly — they read from `useAppContext()`.

| Hook | Owns |
|------|------|
| `hooks/useBank.js` | Question bank CRUD: load/save questions, filtering, tagging |
| `hooks/useCourses.js` | Course catalog access (built-in + custom user courses) |
| `hooks/useGenerate.js` | Generation state machine: prompt building, streaming, paste-import flow |
| `hooks/useExamBuilder.js` | Exam composition: versions, class sections, question marks, save/load named exams |
| `hooks/useExport.js` | Export orchestration: print preview, graph PNG cache, export-history logging |
| `hooks/useValidation.js` | AI-driven answer validation: per-question and bulk auto-validate |

### Screens (per-route pages)

Each `/app/<feature>/page.js` reads state from `useAppContext()` and renders the matching screen component. Screens are presentation-only — they don't fetch or mutate state directly.

| Route | Screen component |
|-------|------------------|
| `/app/dashboard` | `components/screens/DashboardScreen.jsx` |
| `/app/generate` | `components/screens/GenerateScreen.jsx` |
| `/app/bank` | `components/screens/BankScreen.jsx` |
| `/app/build` | `components/screens/BuildScreen.jsx` (drives `VersionsScreen.js` for the version-by-version composition flow) |
| `/app/export` | `components/screens/ExportScreen.jsx` |
| `/app/exams` | `components/screens/ExamsScreen.jsx` (saved exams) |
| `/app/courses` | `components/screens/CoursesScreen.jsx` (custom course management) |
| `/app/admin` | Admin dashboard: approve users, view API usage, set per-user limits |
| `/app/settings` | User settings (university name/logo, instructor name) |

### Shared UI components

- `components/question/QuestionCard.jsx` — single source of truth for rendering one question (choices, answer reveal, edit affordances). Reused across `BankScreen`, `BuildScreen`, `ExportScreen`, validation screens.
- `components/question/QuestionEditor.jsx` — inline edit form for choices/explanations
- `components/editors/GraphEditor.js` — D3-powered graph editor (functions, piecewise, area, statistical plots)
- `components/editors/InlineEditor.js` — generic inline-edit primitive
- `components/display/MathText.js` / `MathTextInline.js` / `PipeTableHTML.js` — KaTeX-based math + markdown pipe-table renderers used wherever question content appears
- `components/display/GraphDisplay.js` — read-only graph viewer
- `components/modals/ExportTemplateModal.jsx` — collects cover/header/footer settings before any `.docx` export
- `components/layout/Sidebar.jsx` / `Toast.jsx` / `ConfirmModal.jsx` — shell chrome
- `components/ExportFunctionsProvider.jsx` — provides export helpers (`buildDocx`, `buildQTI`, etc.) via context so screens don't import `lib/exports/*` directly

### Course-owned prompt rules

Each course in `lib/courses/` exports its own metadata (course code, title, sections) and the prompt rules used to generate its questions. The shared math-prompt logic lives in `_calcPrompt.js` (calculus family) and `_qmPrompt.js` (quantitative methods family); each course module re-exports the relevant rules.

| File | Purpose |
|------|---------|
| `lib/courses/index.js` | Aggregates all courses; `COURSES` array + `getCourse(name)` lookup |
| `lib/courses/calculus1.js` / `calculus2.js` / `calculus3.js` | Calc course metadata + prompt rules |
| `lib/courses/precalculus.js` | Precalc metadata + rules |
| `lib/courses/quantitativeMethodsI.js` / `quantitativeMethodsII.js` | QM I/II metadata + rules |
| `lib/courses/discreteMathematics.js` | Discrete math metadata + rules |
| `lib/courses/_calcPrompt.js` / `_qmPrompt.js` | Shared prompt scaffolding for the family |

When adding a new course: create a new file in `lib/courses/`, register it in `index.js`, and re-export the appropriate prompt module.

### Exports (`lib/exports/`)

- `docx.js` — Word `.docx` builder. **Single render path** for both the Word (.docx) button and the Answer Key (.docx) button — see "Export template system" below.
- `qti.js` — Canvas QTI export (`buildQTI`, `buildQTIZip`, `buildQTICompare`, `buildClassroomSectionsQTI`, `buildQTIAllSectionsMerged`, `validateQTIExport`, `canvasExportConfig`)
- `graphRendering.js` — D3-driven SVG/PNG rendering for graphs and stat charts (`renderGraphToSVG`, `graphToBase64PNG`, `statChartToBase64PNG`)
- `helpers.js` — Math/markdown helpers shared across exports: KaTeX-style tokenizer, `mathToOmml` (LaTeX → Office Math XML), `mathToHTML`, pipe-table parsing, `mathStepsOnly` (explanation → step list)
- `utils.js` — `dlBlob`, `dlFile` download helpers
- `index.js` — Barrel re-export of every public export helper

### Export template system (current)

Both the **Word (.docx)** and the **Answer Key (.docx)** buttons go through the same code path. The flow:

1. Either button calls `openWordExportModal(type, payload)` on `ExportScreen`. `type` is `"single"` (Word, one version), `"sections"` (Word, all sections), `"compare"` (Word, version comparison), or `"answerKey"` (Answer Key, all versions).
2. `ExportTemplateModal` collects `templateConfig` (cover toggle, header/footer toggles, semester, exam date/time, materials allowed, per-question marks, etc.) and confirms.
3. The confirm handler calls `buildDocx(questions, course, vLabel, classSection, startNum, templateConfig, includeAnswers)`.
4. **The only difference between the two buttons is `includeAnswers`** — `false` for Word, `true` for Answer Key. Cover, header, footer, page numbering, and per-question rendering are byte-identical.

Inside `buildDocx`:
- `_renderQuestionsBody(questions, startNum, tc, includeAnswers)` is the single shared per-question loop.
- For each question: graph image → header (`Question N: ... [N marks]`) → optional Formula variables → choices A–E (if MCQ) → **answer area** → divider.
- The answer area is the only branch:
  - `includeAnswers=false` + non-MCQ → `_qBlankSpace(qMarks)` emits multiple empty paragraphs (480 twips each) sized at `pointValue × 1440` twips, clamped 2160–7200 (1.5"–5").
  - `includeAnswers=false` + MCQ → no extra space (the choices ARE the answer area).
  - `includeAnswers=true` → `_qAnswerBlock(answer, explanation)` emits a bold `✓ Answer:` line followed by solution steps from `mathStepsOnly(explanation)`. No fills, no borders, no shading — plain text matching the question font.
- `_assembleDocxBlob` then wraps the body XML, splices in the cover page section (its own section with empty header/footer + `titlePg`), wires up logo/header/footer rels, and zips the result.

There is **no separate "Answer Key" page** appended at the end of either document. The answer key only exists as inline blocks under each question when `includeAnswers=true`.

### Database tables

- `questions` — Individual exam questions
- `exams` — Saved exam version sets
- `export_history` — Export audit trail
- `approved_emails` — Allowlist for user access
- `api_usage` — Per-user hourly request tracking (rate limit enforcement)
- `user_limits` — Per-user monthly generation limits
- `user_settings` — Per-user university name, logo URL, instructor name (used to hydrate the export template modal)

### Auth Architecture

Supabase Auth handles authentication. The middleware reads the Supabase session cookie and redirects unauthenticated requests. Admin access is determined by checking if the user's email matches the hardcoded `ADMIN_EMAIL` in `context/AppContext.js` or an `is_admin` flag in the database.

### AI Integration

- Generation requests stream from `claude-opus-4-5`
- Validation requests (checking answer correctness) go to `claude-sonnet-4-5`
- Both are called from `app/api/generate/route.js`; the `action` field in the request body distinguishes generation from validation

## File size reference

Quick-reference snapshot from `wc -l` on the major source directories. Use it to gauge where complexity lives before diving in.

| File | Lines |
|------|------:|
| `lib/exports/docx.js` | 1011 |
| `lib/exports/graphRendering.js` | 1246 |
| `lib/exports/helpers.js` | 619 |
| `lib/exports/qti.js` | 666 |
| `lib/exports/utils.js` | 13 |
| `lib/exports/index.js` | 5 |
| `lib/courses/_calcPrompt.js` | 92 |
| `lib/courses/_qmPrompt.js` | 93 |
| `lib/courses/calculus1.js` | 12 |
| `lib/courses/calculus2.js` | 12 |
| `lib/courses/calculus3.js` | 11 |
| `lib/courses/discreteMathematics.js` | 97 |
| `lib/courses/precalculus.js` | 63 |
| `lib/courses/quantitativeMethodsI.js` | 10 |
| `lib/courses/quantitativeMethodsII.js` | 14 |
| `lib/courses/index.js` | 39 |
| `hooks/useBank.js` | 156 |
| `hooks/useCourses.js` | 48 |
| `hooks/useExamBuilder.js` | 245 |
| `hooks/useExport.js` | 67 |
| `hooks/useGenerate.js` | 333 |
| `hooks/useValidation.js` | 103 |
| `context/AppContext.js` | 155 |
| `context/ExportContext.js` | 35 |
| `context/ExportFunctionsContext.js` | 4 |
| `components/ExportFunctionsProvider.jsx` | 53 |

The largest concentrations of logic are `lib/exports/graphRendering.js` (D3 rendering) and `lib/exports/docx.js` (template + Word XML). Hook complexity is led by `useGenerate.js` (streaming + prompt orchestration) and `useExamBuilder.js` (multi-version/multi-section state).
