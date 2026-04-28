-- Per-operation rate-limit buckets for /api/generate
--
-- Adds an `operation` column to api_usage so generation (Opus, expensive) and
-- validation (Sonnet, cheap, batch-y) can be rate-limited independently.
-- Existing rows backfill to 'generate' since that was the only path before.
--
-- Limits live in app code (RATE_LIMITS in app/api/generate/route.js):
--   generate → 20/hour
--   validate → 100/hour
--
-- Run once in the Supabase SQL editor when upgrading.

ALTER TABLE api_usage
  ADD COLUMN IF NOT EXISTS operation TEXT NOT NULL DEFAULT 'generate';

CREATE INDEX IF NOT EXISTS api_usage_user_op_created_idx
  ON api_usage (user_id, operation, created_at DESC);
