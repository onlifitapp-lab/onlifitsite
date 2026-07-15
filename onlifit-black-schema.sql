-- Onlifit Black Eligibility Function
-- Run this in your Supabase SQL Editor
-- This function checks and updates Onlifit Black status for trainers

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add subscription columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_plan') THEN
        ALTER TABLE profiles ADD COLUMN subscription_plan TEXT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_expires_at') THEN
        ALTER TABLE profiles ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'verification_status') THEN
        ALTER TABLE profiles ADD COLUMN verification_status TEXT DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE profiles ADD COLUMN whatsapp_number TEXT DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'clerk_id') THEN
        ALTER TABLE profiles ADD COLUMN clerk_id TEXT DEFAULT NULL;
    END IF;
END $$;


-- Function: check_onlifit_black_eligibility
-- Criteria for Onlifit Black:
--   1. verification_status = 'verified'
--   2. subscription_plan = 'elite'
--   3. experience >= 2 (years)
--   4. rating >= 4.5
--   5. review_count >= 10
CREATE OR REPLACE FUNCTION check_onlifit_black_eligibility(trainer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    profile_record RECORD;
    experience_years INTEGER;
    is_eligible BOOLEAN := FALSE;
BEGIN
    SELECT
        verification_status,
        subscription_plan,
        subscription_status,
        experience,
        rating,
        review_count
    INTO profile_record
    FROM profiles
    WHERE id = trainer_id AND role = 'trainer';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Parse experience text to years (handles "2 years", "3", "2+", etc.)
    BEGIN
        experience_years := COALESCE(
            NULLIF(regexp_replace(COALESCE(profile_record.experience, '0'), '[^0-9]', '', 'g'), '')::INTEGER,
            0
        );
    EXCEPTION WHEN OTHERS THEN
        experience_years := 0;
    END;

    -- Check all five criteria
    is_eligible := (
        COALESCE(profile_record.verification_status, '') = 'verified'
        AND LOWER(COALESCE(profile_record.subscription_plan, '')) = 'elite'
        AND LOWER(COALESCE(profile_record.subscription_status, '')) = 'active'
        AND experience_years >= 2
        AND COALESCE(profile_record.rating, 0) >= 4.5
        AND COALESCE(profile_record.review_count, 0) >= 10
    );

    -- Update the has_black_status column
    UPDATE profiles
    SET has_black_status = is_eligible,
        updated_at = NOW()
    WHERE id = trainer_id;

    RETURN is_eligible;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Batch update: Check all trainers' eligibility
CREATE OR REPLACE FUNCTION refresh_all_black_status()
RETURNS void AS $$
DECLARE
    trainer RECORD;
BEGIN
    FOR trainer IN SELECT id FROM profiles WHERE role = 'trainer'
    LOOP
        PERFORM check_onlifit_black_eligibility(trainer.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Index for faster subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_plan, subscription_status)
    WHERE role = 'trainer';

-- Index for Onlifit Black queries
CREATE INDEX IF NOT EXISTS idx_profiles_black_status ON profiles(has_black_status)
    WHERE role = 'trainer' AND has_black_status = TRUE;
