-- Validation persistence for the question bank
-- Adds three columns to the existing `questions` table so AI-validation results
-- (from the Auto Validate flow in useValidation) survive across sessions.
--
-- Status semantics:
--   'ok'      → AI confirmed the stored answer is correct, no issues
--   'warning' → AI confirmed the answer is correct but flagged ambiguity / formatting
--   'error'   → AI judged the stored answer wrong; corrected_answer + reason captured
--   NULL      → never validated
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`) when
-- upgrading an existing project.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS validation_status TEXT
    CHECK (validation_status IS NULL OR validation_status IN ('ok', 'warning', 'error')),
  ADD COLUMN IF NOT EXISTS validation_issues JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Index speeds up the BankScreen filter dropdown ("Has Errors", "Not Validated", ...)
CREATE INDEX IF NOT EXISTS questions_validation_status_idx
  ON questions (validation_status);
