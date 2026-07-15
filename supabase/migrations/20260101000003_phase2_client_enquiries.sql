-- ============================================================================
-- PHASE 2 — Client Enquiry Endpoint Rebuild
-- Atomic, idempotent, duplicate-protected enquiry creation against
-- client_enquiries (replacing the old bookings-as-leads write path).
-- ============================================================================
-- Idempotent: safe to re-run. Depends on migration 20260101000001
-- (client_enquiries, system_settings, profiles.subscription_plan/status).

-- ----------------------------------------------------------------------------
-- 1. client_enquiries — add idempotency support
-- ----------------------------------------------------------------------------
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_enquiries_idempotency_key
    ON client_enquiries(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. system_settings — duplicate enquiry protection window
-- ----------------------------------------------------------------------------
INSERT INTO system_settings (key, value, description) VALUES
    ('duplicate_enquiry_window_days', '30', 'A client cannot create a new counted enquiry for the same trainer within this many days of their last one')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. try_create_client_enquiry — atomic, idempotent, duplicate-protected,
--    cap-enforced enquiry creation.
--
-- Concurrency: uses SELECT ... FOR UPDATE on the trainer's own profiles row
-- (not pg_advisory_xact_lock) to serialize concurrent enquiry attempts for
-- the same trainer.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION try_create_client_enquiry(
    p_trainer_id UUID,
    p_client_id UUID,
    p_plan_type TEXT,
    p_source TEXT,
    p_idempotency_key TEXT
) RETURNS JSONB AS $$
DECLARE
    v_existing client_enquiries%ROWTYPE;
    v_duplicate client_enquiries%ROWTYPE;
    v_plan TEXT;
    v_status TEXT;
    v_cap INTEGER;
    v_count INTEGER;
    v_window_days INTEGER;
    v_new client_enquiries%ROWTYPE;
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM client_enquiries WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'enquiry_id', v_existing.id,
                'duplicate', false,
                'idempotent_replay', true
            );
        END IF;
    END IF;

    PERFORM 1 FROM profiles WHERE id = p_trainer_id FOR UPDATE;

    SELECT COALESCE((value)::text::integer, 30) INTO v_window_days
        FROM system_settings WHERE key = 'duplicate_enquiry_window_days';

    SELECT * INTO v_duplicate FROM client_enquiries
        WHERE trainer_id = p_trainer_id
          AND client_id = p_client_id
          AND created_at > NOW() - (COALESCE(v_window_days, 30) || ' days')::INTERVAL
        ORDER BY created_at DESC
        LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'enquiry_id', v_duplicate.id,
            'duplicate', true,
            'idempotent_replay', false
        );
    END IF;

    SELECT subscription_plan, subscription_status INTO v_plan, v_status
        FROM profiles WHERE id = p_trainer_id;

    IF LOWER(COALESCE(v_plan, '')) = 'pro' AND LOWER(COALESCE(v_status, '')) IN ('active', 'grace_period') THEN
        SELECT COALESCE((value)::text::integer, 30) INTO v_cap
            FROM system_settings WHERE key = 'pro_plan_monthly_enquiry_cap';

        SELECT COUNT(*) INTO v_count FROM client_enquiries
            WHERE trainer_id = p_trainer_id
              AND created_at >= date_trunc('month', NOW());

        IF v_count >= COALESCE(v_cap, 30) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ENQUIRY_LIMIT_REACHED'
            );
        END IF;
    END IF;

    INSERT INTO client_enquiries (trainer_id, client_id, plan_type, source, status, idempotency_key)
    VALUES (p_trainer_id, p_client_id, p_plan_type, COALESCE(p_source, 'whatsapp'), 'new', p_idempotency_key)
    RETURNING * INTO v_new;

    RETURN jsonb_build_object(
        'success', true,
        'enquiry_id', v_new.id,
        'duplicate', false,
        'idempotent_replay', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
