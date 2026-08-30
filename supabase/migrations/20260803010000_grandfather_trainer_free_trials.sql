-- ----------------------------------------------------------------------------
-- Grandfathering fix: Phase 1 (20260802100000_free_trial_system.sql) only
-- grants a 90-day free trial to trainers who sign up going forward, via
-- handle_new_user(). Every trainer who existed before that migration has
-- free_trial_expires_at = NULL, which made all of them fail
-- applyDiscoverabilityFilter() in auth.js -- confirmed live: 0 trainers were
-- passing search discoverability in production. This is a one-time backfill
-- for pre-existing trainers only.
--
-- Grants a fresh 90-day trial (starting now) to any trainer who:
--   - has never had a trial (free_trial_expires_at IS NULL)
--   - has no currently-active paid subscription
--
-- Idempotent: the WHERE clause requires free_trial_expires_at IS NULL, and
-- this UPDATE is what sets that column, so a second run matches zero rows.
-- Paid trainers (subscription_expires_at > now()) are excluded by the WHERE
-- clause and untouched -- confirmed zero such trainers exist in production
-- as of this migration, so there is nothing this could regress.
-- ----------------------------------------------------------------------------

UPDATE profiles
SET
    free_trial_started_at = now(),
    free_trial_expires_at = now() + INTERVAL '90 days',
    subscription_plan = COALESCE(NULLIF(subscription_plan, ''), 'free'),
    subscription_status = CASE WHEN subscription_status = 'none' THEN 'free_trial' ELSE subscription_status END
WHERE role = 'trainer'
  AND free_trial_expires_at IS NULL
  AND (subscription_expires_at IS NULL OR subscription_expires_at < now());
