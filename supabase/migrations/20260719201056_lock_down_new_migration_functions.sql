-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
--
-- Prompted by a post-apply run of Supabase's security advisor (get_advisors),
-- which flagged two issues introduced by the migrations immediately above:
-- enforce_verification_admin_only() (a trigger-only function) was directly
-- callable via PostgREST RPC by anon/authenticated, and
-- immutable_array_to_string() had a mutable search_path.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION enforce_verification_admin_only() FROM public, anon, authenticated;

ALTER FUNCTION immutable_array_to_string(text[], text) SET search_path = public;
