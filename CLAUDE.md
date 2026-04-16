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

### Request Flow

1. `middleware.js` — Guards `/app` and `/admin` routes; unauthenticated users are redirected to `/login`
2. `app/login/page.js` — Email/password auth via Supabase; only emails in the `approved_emails` table are allowed
3. `app/app/page.js` — Authenticated entry point; renders `components/TestBankApp.js`
4. `app/api/generate/route.js` — The sole API route; calls Anthropic Claude API to generate or validate questions; enforces a 20-requests/hour rate limit via the `api_usage` table

### Key Files

| File | Purpose |
|------|---------|
| `components/TestBankApp.js` | ~7,800-line monolithic component containing all UI logic |
| `app/api/generate/route.js` | Claude API integration; uses `claude-opus-4-5` for generation, `claude-sonnet-4-5` for validation |
| `lib/supabase.js` | Server-side Supabase client |
| `lib/supabase-browser.js` | Browser-side Supabase client factory |
| `app/admin/page.js` | Admin dashboard: approve users, view API usage, set per-user limits |

### TestBankApp.js Structure

This single component (~7,800 lines) contains everything:
- **Math rendering** — Custom KaTeX tokenizer parses LaTeX expressions (e.g., `\int`, `\frac`) inline
- **Pipe table parser** — Detects and renders markdown pipe tables in question text
- **GraphDisplay / GraphEditor** — D3.js-powered graph components supporting functions, piecewise, area-between-curves, and statistical plots
- **InlineEditor** — Allows direct editing of generated question stems, answer choices, and explanations
- **Export** — QTI format export (`buildQTI` function) plus other formats; `canvasExportConfig` defines Canvas LMS settings

### Database Tables

- `questions` — Individual exam questions
- `exams` — Exam version sets
- `export_history` — Export audit trail
- `approved_emails` — Allowlist for user access
- `api_usage` — Per-user hourly request tracking (rate limit enforcement)
- `user_limits` — Per-user monthly generation limits

### Auth Architecture

Supabase Auth is used for authentication. The middleware reads the Supabase session cookie and redirects unauthenticated requests. Admin access is determined by checking if the user's email matches a hardcoded admin email or an `is_admin` flag in the database.

### AI Integration

- Generation requests go to `claude-opus-4-5` via streaming
- Validation requests (checking answer correctness) go to `claude-sonnet-4-5`
- Both are called from `app/api/generate/route.js`; the `action` field in the request body distinguishes generation from validation
