-- ============================================================
-- TestBank Pro — courses table migration
-- Run this once in the Supabase SQL Editor.
-- Safe to re-run: each step is idempotent.
-- ============================================================

-- Add textbook_author column (missing in the original schema)
alter table courses add column if not exists textbook_author text;

-- Make department optional so seeds that omit it don't fail
alter table courses alter column department drop not null;

-- Optional: speed up is_builtin lookups used by the seed/migration flow
create index if not exists courses_is_builtin_idx on courses (is_builtin);
