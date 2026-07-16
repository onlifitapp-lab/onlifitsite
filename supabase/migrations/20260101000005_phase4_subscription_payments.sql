ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('pro','elite')),
    razorpay_order_id TEXT UNIQUE NOT NULL,
    razorpay_payment_id TEXT UNIQUE,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_payments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION sync_subscription_expiry(p_trainer_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE profiles
    SET subscription_status = 'grace_period'
    WHERE id = p_trainer_id
      AND subscription_status = 'active'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < NOW();

    UPDATE profiles
    SET subscription_status = 'expired'
    WHERE id = p_trainer_id
      AND subscription_status = 'grace_period'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION activate_subscription_payment(
    p_trainer_id UUID,
    p_plan TEXT,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_amount NUMERIC
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment subscription_payments%ROWTYPE;
    v_current_expiry TIMESTAMPTZ;
    v_current_plan TEXT;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_payment FROM subscription_payments WHERE razorpay_payment_id = p_razorpay_payment_id;
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'payment_id', v_payment.id);
    END IF;

    PERFORM 1 FROM profiles WHERE id = p_trainer_id FOR UPDATE;

    UPDATE subscription_payments
    SET razorpay_payment_id = p_razorpay_payment_id, status = 'paid'
    WHERE razorpay_order_id = p_razorpay_order_id AND razorpay_payment_id IS NULL
    RETURNING id INTO v_payment.id;

    IF v_payment.id IS NULL THEN
        INSERT INTO subscription_payments (trainer_id, plan, razorpay_order_id, razorpay_payment_id, amount, status)
        VALUES (p_trainer_id, p_plan, p_razorpay_order_id, p_razorpay_payment_id, p_amount, 'paid')
        ON CONFLICT (razorpay_order_id) DO UPDATE SET razorpay_payment_id = EXCLUDED.razorpay_payment_id, status = 'paid'
        RETURNING id INTO v_payment.id;
    END IF;

    SELECT subscription_expires_at, subscription_plan INTO v_current_expiry, v_current_plan
        FROM profiles WHERE id = p_trainer_id;

    v_new_expiry := GREATEST(COALESCE(v_current_expiry, NOW()), NOW()) + INTERVAL '30 days';

    UPDATE profiles
    SET subscription_plan = p_plan,
        subscription_status = 'active',
        subscription_expires_at = v_new_expiry
    WHERE id = p_trainer_id;

    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'payment_id', v_payment.id, 'expires_at', v_new_expiry);
END;
$$ LANGUAGE plpgsql;
