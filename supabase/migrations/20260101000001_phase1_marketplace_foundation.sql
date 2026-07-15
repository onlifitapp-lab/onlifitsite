-- ============================================================================
-- PHASE 1 — MARKETPLACE FOUNDATION
-- Onlifit: Verified Trainer Marketplace
-- ============================================================================
-- Purely foundational. No API/UI/search/business-logic behavior changes.
-- Idempotent: safe to run multiple times, safe on a partially-applied DB.
--
-- Defensive normalization: every CHECK constraint below is preceded by an
-- UPDATE that coerces ANY non-conforming value (not just the one known
-- legacy value) to a safe default. ALTER TABLE ADD CONSTRAINT validates
-- every existing row in the table, not just rows touched by a preceding
-- targeted UPDATE — a narrower normalization caused a production failure
-- previously; this version closes that entire class of failure.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. system_settings — configurable business values (pricing, caps, weights)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
    ('pro_plan_price_inr', '999', 'Pro plan monthly price in INR'),
    ('elite_plan_price_inr', '2999', 'Elite plan monthly price in INR'),
    ('pro_plan_monthly_enquiry_cap', '30', 'Maximum client enquiries per month for Pro plan trainers. Elite is unlimited.'),
    ('boost_3day_price_inr', '499', '3-day boost price in INR'),
    ('boost_7day_price_inr', '999', '7-day boost price in INR'),
    ('boost_3day_duration_days', '3', 'Duration in days for the 3-day boost'),
    ('boost_7day_duration_days', '7', 'Duration in days for the 7-day boost'),
    ('profile_completion_discovery_threshold', '90', 'Minimum profile completion percentage required to be discoverable'),
    ('profile_completion_weights', '{
        "name": 10,
        "avatar_url": 15,
        "bio": 15,
        "specialty": 10,
        "experience": 10,
        "location": 10,
        "plans": 15,
        "whatsapp_number": 10,
        "certifications": 5
    }', 'Weight (out of 100) each profile field contributes toward profile_completion_score')
ON CONFLICT (key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. client_enquiries — dedicated source of truth for client-to-trainer contact
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_enquiries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    plan_type TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
    source TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_enquiries_trainer_created
    ON client_enquiries(trainer_id, created_at);


-- ----------------------------------------------------------------------------
-- 3. profiles — profile_completion_score, last_active_at
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completion_score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

UPDATE profiles SET last_active_at = created_at WHERE last_active_at IS NULL;


-- ----------------------------------------------------------------------------
-- 4. profiles — subscription_plan / subscription_status (foundational)
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT;

UPDATE profiles
SET subscription_plan = 'free'
WHERE subscription_plan IS NULL
   OR subscription_plan NOT IN ('free', 'pro', 'elite');

ALTER TABLE profiles ALTER COLUMN subscription_plan SET DEFAULT 'free';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_plan_check
    CHECK (subscription_plan IN ('free', 'pro', 'elite'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;

UPDATE profiles
SET subscription_status = 'none'
WHERE subscription_status IS NULL
   OR subscription_status NOT IN ('none', 'active', 'grace_period', 'expired');

ALTER TABLE profiles ALTER COLUMN subscription_status SET DEFAULT 'none';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('none', 'active', 'grace_period', 'expired'));


-- ----------------------------------------------------------------------------
-- 5. profiles — account_status CHECK constraint
-- ----------------------------------------------------------------------------
UPDATE profiles
SET account_status = 'active'
WHERE account_status IS NULL
   OR account_status NOT IN ('active', 'suspended', 'deactivated');

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_account_status_check
    CHECK (account_status IN ('active', 'suspended', 'deactivated'));


-- ----------------------------------------------------------------------------
-- 6. profiles — verification_status
--    Column name unchanged; only allowed values change. Legacy 'verified'
--    maps to 'approved'; any other unexpected value is coerced to 'pending'
--    as a safe fallback so the constraint below cannot fail on stray data.
-- ----------------------------------------------------------------------------
UPDATE profiles SET verification_status = 'approved' WHERE verification_status = 'verified';

UPDATE profiles
SET verification_status = 'pending'
WHERE verification_status IS NULL
   OR verification_status NOT IN ('pending', 'approved', 'rejected');

-- The original constraint (from setup-trainer-storage.sql) was created as an
-- unnamed inline column constraint, which Postgres auto-names
-- "profiles_verification_status_check" by default — the same name this
-- migration uses. DROP IF EXISTS + ADD covers both a legacy unnamed
-- constraint carrying that auto-generated name and a previous run of this
-- exact migration.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_verification_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_verification_status_check
    CHECK (verification_status IN ('pending', 'approved', 'rejected'));


-- ----------------------------------------------------------------------------
-- 7. check_onlifit_black_eligibility() — compares against 'approved'
-- ----------------------------------------------------------------------------
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

    BEGIN
        experience_years := COALESCE(
            NULLIF(regexp_replace(COALESCE(profile_record.experience, '0'), '[^0-9]', '', 'g'), '')::INTEGER,
            0
        );
    EXCEPTION WHEN OTHERS THEN
        experience_years := 0;
    END;

    is_eligible := (
        COALESCE(profile_record.verification_status, '') = 'approved'
        AND LOWER(COALESCE(profile_record.subscription_plan, '')) = 'elite'
        AND LOWER(COALESCE(profile_record.subscription_status, '')) = 'active'
        AND experience_years >= 2
        AND COALESCE(profile_record.rating, 0) >= 4.5
        AND COALESCE(profile_record.review_count, 0) >= 10
    );

    UPDATE profiles
    SET has_black_status = is_eligible,
        updated_at = NOW()
    WHERE id = trainer_id;

    RETURN is_eligible;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 8. profile_completion_score trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_profile_completion_score()
RETURNS TRIGGER AS $$
DECLARE
    weights JSONB;
    score INTEGER := 0;
BEGIN
    IF NEW.role IS DISTINCT FROM 'trainer' THEN
        RETURN NEW;
    END IF;

    SELECT value INTO weights FROM system_settings WHERE key = 'profile_completion_weights';
    IF weights IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.name IS NOT NULL AND trim(NEW.name) <> '' THEN
        score := score + COALESCE((weights->>'name')::INTEGER, 0);
    END IF;
    IF NEW.avatar_url IS NOT NULL AND trim(NEW.avatar_url) <> '' THEN
        score := score + COALESCE((weights->>'avatar_url')::INTEGER, 0);
    END IF;
    IF NEW.bio IS NOT NULL AND trim(NEW.bio) <> '' THEN
        score := score + COALESCE((weights->>'bio')::INTEGER, 0);
    END IF;
    IF NEW.specialty IS NOT NULL AND trim(NEW.specialty) <> '' THEN
        score := score + COALESCE((weights->>'specialty')::INTEGER, 0);
    END IF;
    IF NEW.experience IS NOT NULL AND trim(NEW.experience) <> '' THEN
        score := score + COALESCE((weights->>'experience')::INTEGER, 0);
    END IF;
    IF NEW.location IS NOT NULL AND trim(NEW.location) <> '' THEN
        score := score + COALESCE((weights->>'location')::INTEGER, 0);
    END IF;
    IF NEW.plans IS NOT NULL AND NEW.plans::TEXT <> '{}' AND NEW.plans::TEXT <> 'null' THEN
        score := score + COALESCE((weights->>'plans')::INTEGER, 0);
    END IF;
    IF NEW.whatsapp_number IS NOT NULL AND trim(NEW.whatsapp_number) <> '' THEN
        score := score + COALESCE((weights->>'whatsapp_number')::INTEGER, 0);
    END IF;
    IF NEW.certifications IS NOT NULL AND array_length(NEW.certifications, 1) > 0 THEN
        score := score + COALESCE((weights->>'certifications')::INTEGER, 0);
    END IF;

    NEW.profile_completion_score := LEAST(score, 100);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_profile_completion_score ON profiles;
CREATE TRIGGER trg_calculate_profile_completion_score
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION calculate_profile_completion_score();

UPDATE profiles SET updated_at = updated_at WHERE role = 'trainer';
