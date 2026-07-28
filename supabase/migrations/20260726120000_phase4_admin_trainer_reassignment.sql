-- ============================================================================
-- PHASE 4 — Admin Lead Dashboard: trainer reassignment
-- ============================================================================
-- Extends update_client_enquiry() with one new optional, admin-only
-- parameter (p_assigned_trainer_id) instead of building a parallel update
-- path. Purely additive: existing 5-param call sites (bookings.html's
-- trainer drawer) are unaffected — trainer-facing behavior, the ownership
-- check, and every existing action (status/priority/follow-up/note) are
-- byte-for-byte unchanged.
--
-- Idempotent: safe to re-run. Depends on the Phase 1/2 migrations that
-- created client_enquiries, client_enquiry_events, and the original
-- update_client_enquiry().

CREATE OR REPLACE FUNCTION public.update_client_enquiry(
    p_enquiry_id UUID,
    p_status TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_follow_up_date DATE DEFAULT NULL,
    p_note TEXT DEFAULT NULL,
    p_assigned_trainer_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_row client_enquiries%ROWTYPE;
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_new_trainer_role TEXT;
BEGIN
    SELECT * INTO v_row FROM client_enquiries WHERE id = p_enquiry_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
    END IF;

    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_caller AND role = 'admin') INTO v_is_admin;

    IF v_row.trainer_id IS DISTINCT FROM v_caller AND NOT COALESCE(v_is_admin, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
    END IF;

    -- Reassignment is admin-only, independent of the general ownership
    -- check above: a trainer can edit status/priority/notes on their own
    -- lead, but must never be able to hand it to a different trainer.
    IF p_assigned_trainer_id IS NOT NULL AND p_assigned_trainer_id IS DISTINCT FROM v_row.trainer_id THEN
        IF NOT COALESCE(v_is_admin, false) THEN
            RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
        END IF;

        SELECT role INTO v_new_trainer_role FROM profiles WHERE id = p_assigned_trainer_id;
        IF v_new_trainer_role IS DISTINCT FROM 'trainer' THEN
            RETURN jsonb_build_object('success', false, 'code', 'INVALID_TRAINER');
        END IF;

        INSERT INTO client_enquiry_events (enquiry_id, event_type, meta, actor_id)
        VALUES (p_enquiry_id, 'trainer_reassigned', jsonb_build_object('from', v_row.trainer_id, 'to', p_assigned_trainer_id), v_caller);

        UPDATE client_enquiries SET trainer_id = p_assigned_trainer_id WHERE id = p_enquiry_id;
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

ALTER FUNCTION public.update_client_enquiry(UUID, TEXT, TEXT, DATE, TEXT, UUID)
    SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.update_client_enquiry(UUID, TEXT, TEXT, DATE, TEXT, UUID) TO authenticated;

-- Postgres treats a different parameter list as a new overload, not a
-- replacement (this bit us once already in Phase 2 — see the
-- 20260721110515 cleanup migration). Drop the old 5-arg overload so there
-- is exactly one update_client_enquiry(), matching the same cleanup this
-- project already did for try_create_client_enquiry().
DROP FUNCTION IF EXISTS public.update_client_enquiry(UUID, TEXT, TEXT, DATE, TEXT);
