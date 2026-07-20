-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
-- ============================================================================

ALTER TABLE blog_posts ADD COLUMN meta_title text;
ALTER TABLE blog_posts ADD COLUMN meta_description text;
ALTER TABLE blog_posts ADD COLUMN related_trainer_ids uuid[] DEFAULT '{}';
ALTER TABLE blog_posts ADD COLUMN featured boolean NOT NULL DEFAULT false;
ALTER TABLE blog_posts ADD COLUMN excerpt text;
ALTER TABLE blog_posts ADD COLUMN reading_time integer;
ALTER TABLE blog_posts ADD COLUMN author_name text;
ALTER TABLE blog_posts ADD COLUMN canonical_url text;

-- reading_time (integer) replaces read_time (free text) as the single
-- source of truth. Backfill by extracting the leading integer from the
-- existing free-text values (e.g. "5 min read" -> 5), then drop read_time.
UPDATE blog_posts
  SET reading_time = NULLIF(substring(read_time from '^\d+'), '')::integer
  WHERE read_time ~ '^\d+';

ALTER TABLE blog_posts DROP COLUMN read_time;

CREATE INDEX idx_blog_posts_featured ON blog_posts(featured) WHERE featured = true;
