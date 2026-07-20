-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20, during a post-migration regression audit); it is a faithful,
-- unmodified copy of the SQL that was actually executed, filed under its
-- real recorded version. See MIGRATION_HISTORY.md.
--
-- Fixes 20260719200759_add_response_time_to_profiles.sql: that migration's
-- CHECK constraint used invented vocabulary that did not match the live
-- trainer-onboarding.html <select> (which uses '< 1h', '< 2h', '< 3h',
-- '< 6h', '< 12h', '< 24h'). Every onboarding submission would have hard-
-- failed the constraint. This migration replaces it with the real values.
-- ============================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_response_time_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_response_time_check
  CHECK (response_time IS NULL OR response_time IN ('< 1h', '< 2h', '< 3h', '< 6h', '< 12h', '< 24h'));
