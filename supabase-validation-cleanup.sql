-- One-off cleanup: reset questions that were flagged with API/transport errors
-- (rate limit, network failure) instead of real validation findings. After
-- this, those questions go back to "Not validated" and can be re-validated.
--
-- Preview first:
--   SELECT id, validation_status, validation_issues
--   FROM questions
--   WHERE validation_status IS NOT NULL
--     AND EXISTS (
--       SELECT 1 FROM jsonb_array_elements_text(validation_issues) AS issue
--       WHERE issue ILIKE '%rate limit%'
--          OR issue ILIKE '%API error%'
--          OR issue ILIKE '%Request failed%'
--          OR issue ILIKE '%network%'
--     );
--
-- Then run the UPDATE.

UPDATE questions
SET validation_status = NULL,
    validation_issues = '[]'::jsonb,
    validated_at = NULL
WHERE validation_status IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(validation_issues) AS issue
    WHERE issue ILIKE '%rate limit%'
       OR issue ILIKE '%API error%'
       OR issue ILIKE '%Request failed%'
       OR issue ILIKE '%network%'
  );
