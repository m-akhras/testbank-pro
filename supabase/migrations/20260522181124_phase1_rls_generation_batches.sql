-- Phase 1: RLS policies for generation_batches
-- Users can only read, insert, update, and delete their own batches.

ALTER TABLE generation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batches"
  ON generation_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own batches"
  ON generation_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batches"
  ON generation_batches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own batches"
  ON generation_batches FOR DELETE
  USING (auth.uid() = user_id);
