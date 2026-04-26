-- ─────────────────────────────────────────────────────────────────
-- TestArca — user_settings table (per-user Word export template)
-- Run once in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────

create table if not exists user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  university_name      text,
  university_logo_url  text,
  instructor_name      text,
  updated_at           timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "users read own settings"   on user_settings;
drop policy if exists "users insert own settings" on user_settings;
drop policy if exists "users update own settings" on user_settings;

create policy "users read own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "users insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "users update own settings"
  on user_settings for update
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- STORAGE BUCKET — manual steps (Supabase dashboard → Storage):
--   1. Create bucket named exactly:  user-logos
--   2. Mark as PUBLIC (public read)
--   3. Add policies (Storage → user-logos → Policies):
--
--      Policy 1 — "authenticated upload":
--        Allowed operations: INSERT, UPDATE
--        Target roles: authenticated
--        USING expression: bucket_id = 'user-logos'
--        WITH CHECK expression: bucket_id = 'user-logos'
--
--      Policy 2 — "public read" (auto-applied when bucket is public):
--        Allowed operations: SELECT
--        Target roles: anon, authenticated
-- ─────────────────────────────────────────────────────────────────
