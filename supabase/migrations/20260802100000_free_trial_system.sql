-- ----------------------------------------------------------------------------
-- Phase 1 — Free Trial Logic for Trainers
-- Adds a 90-day free trial for new trainers, gated by a monthly lead cap of
-- 5 (vs. Pro's existing 30). Every statement is idempotent/safe to re-run.
-- ----------------------------------------------------------------------------

-- 1. system_settings keys
INSERT INTO system_settings (key, value, description) VALUES
    ('free_trial_duration_days', '90', 'Length of a new trainer''s free trial period, in days'),
    ('free_trial_monthly_lead_cap', '5', 'Maximum client enquiries per month for trainers on the free trial (vs. 30 for Pro)')
ON CONFLICT (key) DO NOTHING;

-- 2. profiles columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_trial_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_trial_expires_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 3. handle_new_user — rewritten to append free-trial + subscription-state
--    columns for new trainers only. Byte-for-byte identical to the live
--    production definition except for these 4 additions (verified against
--    pg_get_functiondef output before writing this migration).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    phone,
    avatar_url,
    specialty,
    location,
    experience,
    plans,
    tags,
    certifications,
    free_trial_started_at,
    free_trial_expires_at,
    subscription_plan,
    subscription_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'phone',
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' THEN '🏋️'
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN COALESCE(NEW.raw_user_meta_data->>'specialty', 'Personal Training')
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN COALESCE(NEW.raw_user_meta_data->>'location', 'Online')
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN COALESCE(NEW.raw_user_meta_data->>'experience', '1+ years')
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN '{}'::jsonb
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN ARRAY[]::text[]
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN ARRAY[]::text[]
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN now()
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN now() + (COALESCE((SELECT value::text::int FROM system_settings WHERE key = 'free_trial_duration_days'), 90) || ' days')::interval
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN 'free'
      ELSE NULL
    END,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer'
      THEN 'free_trial'
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$function$
;

-- ----------------------------------------------------------------------------
-- 4. try_create_client_enquiry — adds a free-trial cap branch alongside the
--    existing Pro-plan cap branch. Signature, idempotency/duplicate-window
--    logic, and the Pro-plan branch itself are byte-for-byte unchanged from
--    supabase/migrations/20260721110428_phase2_lead_management_crm.sql.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION try_create_client_enquiry(
    p_trainer_id UUID,
    p_client_id UUID,
    p_plan_type TEXT,
    p_source TEXT,
    p_idempotency_key TEXT,
    p_client_name TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_fitness_goal TEXT DEFAULT NULL,
    p_training_mode TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_budget TEXT DEFAULT NULL,
    p_preferred_time TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium'
) RETURNS JSONB AS $$
DECLARE
    v_existing client_enquiries%ROWTYPE;
    v_duplicate client_enquiries%ROWTYPE;
    v_plan TEXT;
    v_status TEXT;
    v_free_trial_expires_at TIMESTAMPTZ;
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

    SELECT subscription_plan, subscription_status, free_trial_expires_at
        INTO v_plan, v_status, v_free_trial_expires_at
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
    ELSIF LOWER(COALESCE(v_status, '')) = 'free_trial' AND v_free_trial_expires_at IS NOT NULL AND v_free_trial_expires_at > NOW() THEN
        SELECT COALESCE((value)::text::integer, 5) INTO v_cap
            FROM system_settings WHERE key = 'free_trial_monthly_lead_cap';

        SELECT COUNT(*) INTO v_count FROM client_enquiries
            WHERE trainer_id = p_trainer_id
              AND created_at >= date_trunc('month', NOW());

        IF v_count >= COALESCE(v_cap, 5) THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ENQUIRY_LIMIT_REACHED'
            );
        END IF;
    END IF;

    INSERT INTO client_enquiries (
        trainer_id, client_id, plan_type, source, status, idempotency_key,
        client_name, phone_number, fitness_goal, training_mode, location,
        budget, preferred_time, message, priority, updated_at
    )
    VALUES (
        p_trainer_id, p_client_id, p_plan_type, COALESCE(p_source, 'whatsapp'), 'new', p_idempotency_key,
        p_client_name, p_phone_number, p_fitness_goal, p_training_mode, p_location,
        p_budget, p_preferred_time, p_message, COALESCE(p_priority, 'medium'), NOW()
    )
    RETURNING * INTO v_new;

    INSERT INTO client_enquiry_events (enquiry_id, event_type, meta, actor_id)
    VALUES (v_new.id, 'created', jsonb_build_object('source', v_new.source, 'plan_type', v_new.plan_type), p_client_id);

    RETURN jsonb_build_object(
        'success', true,
        'enquiry_id', v_new.id,
        'duplicate', false,
        'idempotent_replay', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION try_create_client_enquiry(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) SET search_path = public, pg_temp;
