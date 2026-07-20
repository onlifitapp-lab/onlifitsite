-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN goals text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN services text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN training_styles text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN languages text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN target_audience text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN equipment text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN training_modes text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN specializations text[] DEFAULT '{}';

CREATE INDEX idx_profiles_goals ON profiles USING GIN (goals);
CREATE INDEX idx_profiles_services ON profiles USING GIN (services);
CREATE INDEX idx_profiles_training_styles ON profiles USING GIN (training_styles);
CREATE INDEX idx_profiles_languages ON profiles USING GIN (languages);
CREATE INDEX idx_profiles_target_audience ON profiles USING GIN (target_audience);
CREATE INDEX idx_profiles_equipment ON profiles USING GIN (equipment);
CREATE INDEX idx_profiles_training_modes ON profiles USING GIN (training_modes);
CREATE INDEX idx_profiles_specializations ON profiles USING GIN (specializations);

-- Backfill: existing single-value `goal` becomes the first element of `goals`
UPDATE profiles
  SET goals = ARRAY[goal]
  WHERE goal IS NOT NULL AND goal <> '' AND (goals IS NULL OR goals = '{}');

COMMENT ON COLUMN profiles.goal IS
  'DEPRECATED as of 2026-07-20: superseded by goals text[]. Retained temporarily for backward compatibility with existing read/write paths. Plan removal in a later migration once all code reads/writes goals instead.';
