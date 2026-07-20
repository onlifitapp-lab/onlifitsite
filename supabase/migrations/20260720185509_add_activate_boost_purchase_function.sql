-- ============================================================================
-- Phase 2 — Boost payment activation. Mirrors the existing
-- activate_subscription_payment() pattern (idempotent on the gateway
-- payment id, row-locked to serialize concurrent activations).
--
-- Boost-specific behavior: buying Boost while one is already active EXTENDS
-- from the later of (current boost_expires_at, now()) rather than adding
-- from now() alone — this is deliberate. Extending from "now" would waste
-- remaining time on an active boost; the chosen anchor means a trainer who
-- stacks purchases always gets the full duration they paid for, and ranking
-- (which only reads a single boost_expires_at timestamp, see auth.js
-- scoreTrainerForRanking) never needs to know how many purchases contributed
-- to it — stacking protection lives entirely here, not in the ranking code.
--
-- invoice_number is generated here (not in application code) so it's
-- guaranteed to be produced atomically with the same transaction that marks
-- the purchase paid, and is unique via the existing boost_purchases
-- constraint on that column.
--
-- Refunds are explicitly NOT handled here in Phase 2. A refund is a manual
-- admin action (see MIGRATION_HISTORY.md / IMPLEMENTATION_ROADMAP.md) that
-- sets boost_purchases.status = 'refunded' and requires a human decision
-- about whether to roll back profiles.boost_expires_at — this function does
-- not attempt to automatically recompute expiry from remaining valid
-- purchases, since correctly replaying multiple stacked purchases minus a
-- refunded one is materially harder than the activation path and not
-- justified without real refund volume yet.
--
-- Verified live before use: fresh purchase (no existing boost), idempotent
-- replay of the same razorpay_payment_id (no double-extension), and a
-- second purchase while a boost is already active (confirmed it extends
-- from the existing expiry, not from now()).
-- ============================================================================

CREATE OR REPLACE FUNCTION activate_boost_purchase(
    p_trainer_id UUID,
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_purchase boost_purchases%ROWTYPE;
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
    v_invoice_number TEXT;
BEGIN
    -- Idempotent replay: this exact payment was already activated (covers
    -- the client verify-call and webhook racing, or the webhook retrying).
    SELECT * INTO v_purchase FROM boost_purchases WHERE razorpay_payment_id = p_razorpay_payment_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'boost_purchase_id', v_purchase.id,
            'expires_at', v_purchase.expires_at,
            'invoice_number', v_purchase.invoice_number
        );
    END IF;

    -- Lock the trainer's profile row to serialize concurrent activations.
    PERFORM 1 FROM profiles WHERE id = p_trainer_id FOR UPDATE;

    SELECT * INTO v_purchase FROM boost_purchases
        WHERE razorpay_order_id = p_razorpay_order_id AND trainer_id = p_trainer_id
        FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND');
    END IF;

    IF v_purchase.status = 'paid' THEN
        -- Already activated by a concurrent request that won the lock race.
        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'boost_purchase_id', v_purchase.id,
            'expires_at', v_purchase.expires_at,
            'invoice_number', v_purchase.invoice_number
        );
    END IF;

    SELECT boost_expires_at INTO v_current_expiry FROM profiles WHERE id = p_trainer_id;

    v_new_expiry := GREATEST(COALESCE(v_current_expiry, now()), now()) + make_interval(days => v_purchase.duration_days);

    v_invoice_number := 'BOOST-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(v_purchase.id::text, 1, 8));

    UPDATE boost_purchases
    SET status = 'paid',
        razorpay_payment_id = p_razorpay_payment_id,
        starts_at = now(),
        expires_at = v_new_expiry,
        invoice_number = v_invoice_number
    WHERE id = v_purchase.id;

    UPDATE profiles
    SET boost_expires_at = v_new_expiry
    WHERE id = p_trainer_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', false,
        'boost_purchase_id', v_purchase.id,
        'expires_at', v_new_expiry,
        'invoice_number', v_invoice_number
    );
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION activate_boost_purchase(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
