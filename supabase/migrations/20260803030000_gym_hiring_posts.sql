-- ----------------------------------------------------------------------------
-- Phase 3 (revised) — Gym Hiring Post system
-- Additive only: new system_settings keys, one new table, one new index,
-- one new function. Does not touch gym_profiles, gym_owner_city_access
-- (unused, left as-is), handle_new_user(), trainer subscriptions, Boost,
-- Free Trial, or client subscriptions.
-- Every statement is idempotent/safe to re-run.
-- ----------------------------------------------------------------------------

-- 1. system_settings keys
INSERT INTO system_settings (key, value, description) VALUES
    ('gym_1post_price_inr', '1999', 'Price in INR for a gym owner to post 1 hiring listing'),
    ('gym_2post_price_inr', '2999', 'Price in INR for a gym owner to post 2 hiring listings'),
    ('gym_3post_price_inr', '3999', 'Price in INR for a gym owner to post 3 hiring listings'),
    ('gym_hiring_post_duration_days', '30', 'Number of days a gym hiring post stays active before expiring')
ON CONFLICT (key) DO NOTHING;

-- 2. gym_hiring_posts table
CREATE TABLE IF NOT EXISTS gym_hiring_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_owner_id UUID NOT NULL REFERENCES profiles(id),
    gym_profile_id UUID NOT NULL REFERENCES gym_profiles(id),
    speciality TEXT NOT NULL,
    experience_level TEXT NOT NULL,
    location TEXT NOT NULL,
    employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'both')),
    gym_whatsapp TEXT NOT NULL,
    description TEXT,
    post_count INTEGER NOT NULL DEFAULT 1 CHECK (post_count IN (1, 2, 3)),
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    amount_paid NUMERIC,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'failed')),
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index for the public job board query (status='active' AND expires_at > now())
CREATE INDEX IF NOT EXISTS idx_gym_hiring_posts_active
ON gym_hiring_posts (status, expires_at DESC)
WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- 4. activate_gym_hiring_post — same idempotent pattern as
--    activate_client_subscription()/activate_gym_owner_access(): idempotency
--    check on razorpay_payment_id first, then update the row to
--    status='active', posted_at=now(), expires_at = now() +
--    gym_hiring_post_duration_days (read from system_settings, fallback 30).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_gym_hiring_post(
    p_post_id UUID,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_post gym_hiring_posts%ROWTYPE;
    v_duration_days INTEGER;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_post FROM gym_hiring_posts WHERE razorpay_payment_id = p_razorpay_payment_id;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'post_id', v_post.id, 'expires_at', v_post.expires_at);
    END IF;

    SELECT COALESCE((value)::text::integer, 30) INTO v_duration_days
        FROM system_settings WHERE key = 'gym_hiring_post_duration_days';

    v_expires_at := NOW() + (COALESCE(v_duration_days, 30) || ' days')::INTERVAL;

    UPDATE gym_hiring_posts
    SET razorpay_payment_id = p_razorpay_payment_id,
        amount_paid = p_amount,
        status = 'active',
        posted_at = NOW(),
        expires_at = v_expires_at
    WHERE id = p_post_id AND razorpay_order_id = p_razorpay_order_id
    RETURNING id INTO v_post.id;

    IF v_post.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'POST_NOT_FOUND');
    END IF;

    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'post_id', v_post.id, 'expires_at', v_expires_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
