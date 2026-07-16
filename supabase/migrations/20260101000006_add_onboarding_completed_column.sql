-- CRITICAL FIX: profiles.onboarding_completed never existed despite being
-- read throughout auth.js/login-google.js for onboarding-redirect gating.
-- Every login evaluated !undefined -> true, forcing every trainer back into
-- onboarding regardless of actual completion state.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Backfill: trainers with real profile data already completed onboarding in
-- practice (this column never existed to track it before). Blank/fresh
-- profiles correctly remain FALSE.
UPDATE profiles
SET onboarding_completed = TRUE
WHERE role = 'trainer'
  AND (specialty IS NOT NULL OR bio IS NOT NULL OR plans IS NOT NULL);
