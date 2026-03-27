-- ============================================================
-- TestBank Pro — Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Questions table
create table if not exists questions (
  id text primary key,
  course text not null,
  section text,
  type text,
  difficulty text,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 2. Exams table (stores full version sets)
create table if not exists exams (
  id bigint generated always as identity primary key,
  name text not null,
  versions jsonb not null,
  created_at timestamptz default now()
);

-- 3. Export history table
create table if not exists export_history (
  id bigint generated always as identity primary key,
  exam_name text not null,
  format text not null,
  version_label text,
  exported_at timestamptz default now()
);

-- 4. Disable Row Level Security for now (enable later when you add auth)
alter table questions disable row level security;
alter table exams disable row level security;
alter table export_history disable row level security;
