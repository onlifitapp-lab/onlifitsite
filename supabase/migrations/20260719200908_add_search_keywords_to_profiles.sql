-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
--
-- NOTE: the first attempt at this migration used the built-in
-- array_to_string() directly inside the generated column expression and
-- Postgres rejected it ("generation expression is not immutable") because
-- array_to_string is marked STABLE, not IMMUTABLE, in pg_proc. That failed
-- attempt was never recorded in schema_migrations (Postgres rolled it back
-- before any row was inserted there). The SQL below is the version that
-- actually succeeded and is recorded under this version.
-- ============================================================================

CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT array_to_string($1, $2) $$;

ALTER TABLE profiles ADD COLUMN search_keywords text
  GENERATED ALWAYS AS (
    regexp_replace(
      trim(
        lower(
          immutable_array_to_string(
            COALESCE(goals, '{}') ||
            COALESCE(services, '{}') ||
            COALESCE(languages, '{}') ||
            COALESCE(equipment, '{}') ||
            COALESCE(training_styles, '{}') ||
            COALESCE(specializations, '{}') ||
            COALESCE(target_audience, '{}') ||
            COALESCE(training_modes, '{}'),
            ' '
          )
        )
      ),
      '[_\s]+', ' ', 'g'
    )
  ) STORED;

CREATE INDEX idx_profiles_search_keywords ON profiles USING GIN (to_tsvector('english', search_keywords));
