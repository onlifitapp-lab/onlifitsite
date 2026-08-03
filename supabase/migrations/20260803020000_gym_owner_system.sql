-- ----------------------------------------------------------------------------
-- Phase 3 — Gym Owner System
-- Additive only: new system_settings key, three new tables, one new function.
-- Does not touch profiles, handle_new_user(), trainer subscriptions, Boost,
-- Free Trial, or client subscriptions. handle_new_user() already correctly
-- handles a 'gym_owner' role with zero changes needed -- every conditional
-- branch checks specifically for 'trainer' with ELSE NULL, and
-- account_status/onboarding_completed are not in that INSERT's column list
-- at all, so both already come from the table's own column defaults
-- ('active' and false respectively) -- exactly what's required here.
-- Every statement is idempotent/safe to re-run.
-- ----------------------------------------------------------------------------

-- 1. system_settings key
INSERT INTO system_settings (key, value, description) VALUES
    ('gym_owner_city_unlock_price_inr', '1999', 'One-time price in INR for a gym owner to unlock full trainer contact access for one city')
ON CONFLICT (key) DO NOTHING;

-- 2. gym_profiles table
CREATE TABLE IF NOT EXISTS gym_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    gym_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    city TEXT NOT NULL,
    number_of_locations INTEGER DEFAULT 1,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. gym_owner_city_access table
CREATE TABLE IF NOT EXISTS gym_owner_city_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_owner_id UUID NOT NULL REFERENCES profiles(id),
    city TEXT NOT NULL,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    amount_paid NUMERIC,
    unlocked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed'))
);

-- 4. gym_requirements table
CREATE TABLE IF NOT EXISTS gym_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_owner_id UUID NOT NULL REFERENCES profiles(id),
    speciality TEXT,
    experience_level TEXT,
    location_preference TEXT,
    employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'both')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. activate_gym_owner_access — structural mirror of
--    activate_client_subscription(): idempotency check on
--    razorpay_payment_id first, then update-or-insert the order row,
--    status='paid', unlocked_at=now(). No expiry -- this is a one-time
--    permanent unlock per city, not a recurring subscription.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_gym_owner_access(
    p_gym_owner_id UUID,
    p_city TEXT,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_access gym_owner_city_access%ROWTYPE;
BEGIN
    SELECT * INTO v_access FROM gym_owner_city_access WHERE razorpay_payment_id = p_razorpay_payment_id;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'access_id', v_access.id, 'unlocked_at', v_access.unlocked_at);
    END IF;

    PERFORM 1 FROM profiles WHERE id = p_gym_owner_id FOR UPDATE;

    UPDATE gym_owner_city_access
    SET razorpay_payment_id = p_razorpay_payment_id, status = 'paid', unlocked_at = NOW(), amount_paid = p_amount
    WHERE razorpay_order_id = p_razorpay_order_id AND razorpay_payment_id IS NULL
    RETURNING id INTO v_access.id;

    IF v_access.id IS NULL THEN
        INSERT INTO gym_owner_city_access (gym_owner_id, city, razorpay_order_id, razorpay_payment_id, amount_paid, unlocked_at, status)
        VALUES (p_gym_owner_id, p_city, p_razorpay_order_id, p_razorpay_payment_id, p_amount, NOW(), 'paid')
        ON CONFLICT (razorpay_order_id) DO UPDATE SET razorpay_payment_id = EXCLUDED.razorpay_payment_id, status = 'paid', unlocked_at = NOW(), amount_paid = EXCLUDED.amount_paid
        RETURNING id INTO v_access.id;
    END IF;

    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'access_id', v_access.id, 'unlocked_at', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
