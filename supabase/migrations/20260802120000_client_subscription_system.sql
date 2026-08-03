-- ----------------------------------------------------------------------------
-- Phase 2 — Client Subscription System (₹499/month to unlock WhatsApp contact)
-- Additive only: new system_settings key, new table, new function. Does not
-- touch profiles, trainer subscriptions, Boost, or Free Trial (Phase 1).
-- Every statement is idempotent/safe to re-run.
-- ----------------------------------------------------------------------------

-- 1. system_settings key
INSERT INTO system_settings (key, value, description) VALUES
    ('client_monthly_access_price_inr', '499', 'Monthly price in INR for a client to unlock WhatsApp contact with trainers')
ON CONFLICT (key) DO NOTHING;

-- 2. client_subscriptions table
CREATE TABLE IF NOT EXISTS client_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES profiles(id),
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    amount_paid NUMERIC,
    subscribed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_active
    ON client_subscriptions (client_id, expires_at DESC) WHERE status = 'paid';

-- ----------------------------------------------------------------------------
-- 3. activate_client_subscription — structural mirror of
--    activate_subscription_payment(): idempotency check on
--    razorpay_payment_id first, then update-or-insert the order row, then
--    extend expiry from the client's current max(expires_at) or now(),
--    whichever is later (renewal-extends-from-current-expiry semantics,
--    same as trainer subscriptions).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_client_subscription(
    p_client_id UUID,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_sub client_subscriptions%ROWTYPE;
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_sub FROM client_subscriptions WHERE razorpay_payment_id = p_razorpay_payment_id;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'subscription_id', v_sub.id, 'expires_at', v_sub.expires_at);
    END IF;

    PERFORM 1 FROM profiles WHERE id = p_client_id FOR UPDATE;

    UPDATE client_subscriptions
    SET razorpay_payment_id = p_razorpay_payment_id, status = 'paid', subscribed_at = NOW()
    WHERE razorpay_order_id = p_razorpay_order_id AND razorpay_payment_id IS NULL
    RETURNING id INTO v_sub.id;

    IF v_sub.id IS NULL THEN
        INSERT INTO client_subscriptions (client_id, razorpay_order_id, razorpay_payment_id, amount_paid, subscribed_at, status)
        VALUES (p_client_id, p_razorpay_order_id, p_razorpay_payment_id, p_amount, NOW(), 'paid')
        ON CONFLICT (razorpay_order_id) DO UPDATE SET razorpay_payment_id = EXCLUDED.razorpay_payment_id, status = 'paid', subscribed_at = NOW()
        RETURNING id INTO v_sub.id;
    END IF;

    SELECT MAX(expires_at) INTO v_current_expiry FROM client_subscriptions WHERE client_id = p_client_id AND status = 'paid';
    v_new_expiry := GREATEST(COALESCE(v_current_expiry, NOW()), NOW()) + INTERVAL '30 days';

    UPDATE client_subscriptions SET expires_at = v_new_expiry WHERE id = v_sub.id;

    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'subscription_id', v_sub.id, 'expires_at', v_new_expiry);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
