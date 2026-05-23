-- Phase 1: Template-based generation schema
-- Adds support for template metadata, agent verification results,
-- replacement history, batch tracking, and reserves a column for
-- future learning-outcome mapping (Phase 3).

ALTER TABLE questions ADD COLUMN IF NOT EXISTS template_id text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS template_version int;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS template_answers jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS verification_status text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS agent_reasoning jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS previous_attempts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS outcome_ids uuid[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  course text,
  section text,
  template_id text,
  template_version int,
  template_answers jsonb,
  status text DEFAULT 'review',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_questions_batch_id ON questions(batch_id);
CREATE INDEX IF NOT EXISTS idx_questions_template_id ON questions(template_id);
CREATE INDEX IF NOT EXISTS idx_generation_batches_user_id ON generation_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_batches_status ON generation_batches(status);
