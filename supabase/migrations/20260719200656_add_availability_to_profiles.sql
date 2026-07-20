-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN availability jsonb DEFAULT '{
  "timezone": "Asia/Kolkata",
  "days": {
    "monday": [], "tuesday": [], "wednesday": [], "thursday": [],
    "friday": [], "saturday": [], "sunday": []
  }
}'::jsonb;

CREATE INDEX idx_profiles_availability ON profiles USING GIN (availability);
