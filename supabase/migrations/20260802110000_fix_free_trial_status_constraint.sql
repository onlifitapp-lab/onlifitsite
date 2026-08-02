-- ----------------------------------------------------------------------------
-- Fix for a bug found during Phase 1 verification: handle_new_user() (see
-- 20260802100000_free_trial_system.sql) sets subscription_status = 'free_trial'
-- for new trainers, but profiles_subscription_status_check never allowed that
-- value — every new trainer signup has been failing since that migration
-- went live. This adds 'free_trial' to the allowed set. Idempotent: safe to
-- re-run (DROP ... IF EXISTS, then unconditional re-create with the same name).
-- ----------------------------------------------------------------------------

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status = ANY (ARRAY['none'::text, 'active'::text, 'grace_period'::text, 'expired'::text, 'free_trial'::text]));
