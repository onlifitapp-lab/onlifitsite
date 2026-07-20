-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
--
-- NOTE: the CHECK constraint below was written without checking the live
-- trainer-onboarding.html form first, and did not match its real option
-- values ('< 1h', '< 2h', etc). It was corrected later the same day by
-- 20260719201538_fix_response_time_constraint_to_match_live_form.sql.
-- Left exactly as originally applied here — immutable history.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN response_time text
  CHECK (response_time IN ('within_1_hour', 'within_a_day', 'within_2_days', 'varies'));
