-- Fixes silent data loss: trainer-onboarding.html has always collected
-- training_approach, kyc_id_type, kyc_id_number, teaching_style, and
-- training_focus, but these columns never existed on public.profiles.
-- updateProfileWithSchemaFallback() silently stripped them from every
-- save (Postgres "unknown column" error -> drop field -> retry), so every
-- trainer's answers to these fields were discarded with no error surfaced
-- to the trainer or an admin. Applied directly to production via Supabase
-- MCP prior to this commit; this file records that change in git.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_approach text,
  ADD COLUMN IF NOT EXISTS kyc_id_type text,
  ADD COLUMN IF NOT EXISTS kyc_id_number text,
  ADD COLUMN IF NOT EXISTS teaching_style text,
  ADD COLUMN IF NOT EXISTS training_focus text;
