-- The marketplace discovery query (applyDiscoverabilityFilter() in auth.js)
-- filters profiles on role = 'trainer' AND onboarding_completed = true AND
-- verification_status = 'verified' AND account_status = 'active' AND
-- subscription_expires_at > now(), on every homepage/search/trainers.html
-- load. No index has ever covered any of these columns, so every one of
-- these queries has been a full sequential scan over the entire profiles
-- table (clients and trainers together) -- this is the direct cause of the
-- ">2.5s"/timeout-driven "0 trainers found" bug: the client-side 6s race in
-- getTrainers() gives up and returns an empty cached list before a slow,
-- unindexed scan finishes.
--
-- A partial index restricted to exactly the rows this query cares about
-- (trainer, onboarded, verified, active) means Postgres only has to scan
-- rows that already match the four equality conditions, then range-scan
-- subscription_expires_at directly off the index for the > now() check --
-- no table scan at all in the common case.
CREATE INDEX IF NOT EXISTS idx_profiles_trainer_discoverability
ON profiles (subscription_expires_at)
WHERE role = 'trainer'
  AND onboarding_completed = true
  AND verification_status = 'verified'
  AND account_status = 'active';
