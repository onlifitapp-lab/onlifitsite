-- ============================================================================
-- PHASE 2 — Trainer Lead Management CRM (Phase 1: database foundation)
-- Purely additive extension of the existing client_enquiries pipeline
-- (try_create_client_enquiry / api/create-lead.js / booking modal). Does not
-- alter existing duplicate-protection, idempotency, or monthly-cap logic.
-- ============================================================================
-- Idempotent: safe to re-run. Depends on migrations 20260101000001,
-- 20260101000003, 20260101000004.

-- ----------------------------------------------------------------------------
-- 1. client_enquiries — new capture + CRM fields (all nullable, zero impact
--    on existing rows or the existing insert path until callers opt in).
-- ----------------------------------------------------------------------------
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS fitness_goal TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS training_mode TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS preferred_time TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE client_enquiries ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE client_enquiries DROP CONSTRAINT IF EXISTS client_enquiries_priority_check;
ALTER TABLE client_enquiries ADD CONSTRAINT client_enquiries_priority_check
    CHECK (priority IN ('high', 'medium', 'low'));

-- Backfill updated_at for existing rows so it's never NULL going forward.
UPDATE client_enquiries SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_enquiries_trainer_status
    ON client_enquiries(trainer_id, status);

-- Ready for a future reminder job: WHERE follow_up_date <= now() AND
-- status NOT IN ('converted','closed'). No redesign needed when that job
-- is built — the column and index already exist.
CREATE INDEX IF NOT EXISTS idx_client_enquiries_follow_up
    ON client_enquiries(follow_up_date)
    WHERE follow_up_date IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. client_enquiries — RLS read access. The table currently has RLS
--    enabled with zero policies (default-deny, RPC-only access per
--    20260101000004). Adding SELECT-only policies here — INSERT stays
--    RPC-only so the existing cap/duplicate/idempotency guarantees in
--    try_create_client_enquiry() cannot be bypassed by a direct client
--    insert. UPDATE also stays RPC-only (see update_client_enquiry below)
--    so writes are always ownership-checked and always produce a
--    corresponding timeline event.
-- ----------------------------------------------------------------------------
GRANT SELECT ON client_enquiries TO authenticated;

DROP POLICY IF EXISTS client_enquiries_select_own ON client_enquiries;
CREATE POLICY client_enquiries_select_own ON client_enquiries
    FOR SELECT
    TO authenticated
    USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS client_enquiries_select_admin ON client_enquiries;
CREATE POLICY client_enquiries_select_admin ON client_enquiries
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ----------------------------------------------------------------------------
-- 3. client_enquiry_events — single append-only table serving both the
--    lead timeline AND the notes history (a note is an event of type
--    'note_added'). Open-ended event_type means new event kinds are a code
--    change, never another migration.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_enquiry_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    enquiry_id UUID REFERENCES client_enquiries(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_enquiry_events_enquiry_created
    ON client_enquiry_events(enquiry_id, created_at);

ALTER TABLE client_enquiry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON client_enquiry_events FROM anon, authenticated;
GRANT SELECT ON client_enquiry_events TO authenticated;

-- No INSERT policy: events are written only by SECURITY DEFINER RPCs
-- (try_create_client_enquiry, update_client_enquiry) or by the service-role
-- client in api/create-lead.js, both of which bypass RLS already.
DROP POLICY IF EXISTS client_enquiry_events_select_own ON client_enquiry_events;
CREATE POLICY client_enquiry_events_select_own ON client_enquiry_events
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM client_enquiries
        WHERE client_enquiries.id = client_enquiry_events.enquiry_id
          AND client_enquiries.trainer_id = auth.uid()
    ));

DROP POLICY IF EXISTS client_enquiry_events_select_admin ON client_enquiry_events;
CREATE POLICY client_enquiry_events_select_admin ON client_enquiry_events
    FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Enforce append-only at the database level, not just by convention: block
-- UPDATE/DELETE unconditionally (including for service_role/postgres — a
-- correction to history must be a new event, never a mutation of an old
-- one). event_type stays a free TEXT column (not an enum/CHECK) so a new
-- kind of event — including future AI-driven ones like a lead-scoring
-- snapshot or a weekly-summary marker — is purely additive at the
-- application layer, never another migration.
CREATE OR REPLACE FUNCTION reject_client_enquiry_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'client_enquiry_events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_client_enquiry_events_append_only ON client_enquiry_events;
CREATE TRIGGER trg_client_enquiry_events_append_only
    BEFORE UPDATE OR DELETE ON client_enquiry_events
    FOR EACH ROW EXECUTE FUNCTION reject_client_enquiry_events_mutation();


-- ----------------------------------------------------------------------------
-- 4. try_create_client_enquiry — extended with new OPTIONAL capture
--    parameters appended after the original 5, all DEFAULT NULL. This is
--    backward compatible: the existing call site in api/create-lead.js
--    (which currently passes only the original 5 positional/named args)
--    keeps working unmodified. Duplicate window, idempotency replay, and
--    Pro-plan monthly cap logic are byte-for-byte unchanged from
--    20260101000003 — only the final INSERT and a new 'created' timeline
--    event are added.
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


-- ----------------------------------------------------------------------------
-- 5. update_client_enquiry — the only write path for trainer/admin edits
--    (status, priority, follow-up date, notes). Ownership-checked, and
--    every effective change is recorded as its own timeline event so the
--    events table stays an accurate history without the caller having to
--    orchestrate multiple round trips.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_client_enquiry(
    p_enquiry_id UUID,
    p_status TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_follow_up_date DATE DEFAULT NULL,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_row client_enquiries%ROWTYPE;
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    SELECT * INTO v_row FROM client_enquiries WHERE id = p_enquiry_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
    END IF;

    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_caller AND role = 'admin') INTO v_is_admin;

    IF v_row.trainer_id IS DISTINCT FROM v_caller AND NOT COALESCE(v_is_admin, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;

    IF p_status IS NOT NULL AND p_status IS DISTINCT FROM v_row.status THEN
        IF p_status NOT IN ('new', 'contacted', 'converted', 'closed') THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS');
        END IF;

        INSERT INTO client_enquiry_events (enquiry_id, event_type, meta, actor_id)
        VALUES (p_enquiry_id, 'status_changed', jsonb_build_object('from', v_row.status, 'to', p_status), v_caller);

        UPDATE client_enquiries SET status = p_status WHERE id = p_enquiry_id;
    END IF;

    IF p_priority IS NOT NULL AND p_priority IS DISTINCT FROM v_row.priority THEN
        IF p_priority NOT IN ('high', 'medium', 'low') THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_PRIORITY');
        END IF;

        INSERT INTO client_enquiry_events (enquiry_id, event_type, meta, actor_id)
        VALUES (p_enquiry_id, 'priority_changed', jsonb_build_object('from', v_row.priority, 'to', p_priority), v_caller);

        UPDATE client_enquiries SET priority = p_priority WHERE id = p_enquiry_id;
    END IF;

    IF p_follow_up_date IS NOT NULL AND p_follow_up_date IS DISTINCT FROM v_row.follow_up_date THEN
        INSERT INTO client_enquiry_events (enquiry_id, event_type, meta, actor_id)
        VALUES (p_enquiry_id, 'follow_up_scheduled', jsonb_build_object('date', p_follow_up_date), v_caller);

        UPDATE client_enquiries SET follow_up_date = p_follow_up_date WHERE id = p_enquiry_id;
    END IF;

    IF p_note IS NOT NULL AND trim(p_note) <> '' THEN
        INSERT INTO client_enquiry_events (enquiry_id, event_type, meta, actor_id)
        VALUES (p_enquiry_id, 'note_added', jsonb_build_object('text', trim(p_note)), v_caller);
    END IF;

    UPDATE client_enquiries SET updated_at = NOW() WHERE id = p_enquiry_id;

    RETURN jsonb_build_object('success', true, 'enquiry_id', p_enquiry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION update_client_enquiry(UUID, TEXT, TEXT, DATE, TEXT)
    SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION update_client_enquiry(UUID, TEXT, TEXT, DATE, TEXT) TO authenticated;
