-- ============================================================================
-- SECURITY STABILIZATION
-- Enable RLS on client_enquiries and system_settings (default-deny for
-- anon/authenticated — no application code accesses either table directly;
-- all access goes through SECURITY DEFINER RPCs, which bypass RLS via the
-- postgres role's BYPASSRLS attribute). Harden every SECURITY DEFINER
-- function's search_path. Revoke public EXECUTE on an orphaned legacy
-- function that could otherwise fabricate payment records.
-- ============================================================================
-- Idempotent: safe to re-run.


-- ----------------------------------------------------------------------------
-- 1. Enable RLS, default-deny (no policies added — nothing needs direct
--    client-role access to either table today; confirmed via full codebase
--    search before writing this migration).
-- ----------------------------------------------------------------------------
ALTER TABLE client_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 2. Revoke unnecessary blanket grants from anon/authenticated. RLS alone
--    would already block these roles with zero policies, but removing the
--    grants is correct least-privilege hygiene — security shouldn't rest on
--    RLS alone. service_role is untouched (not part of these grants; it
--    bypasses RLS independently via its own BYPASSRLS attribute).
-- ----------------------------------------------------------------------------
REVOKE ALL ON client_enquiries FROM anon, authenticated;
REVOKE ALL ON system_settings FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. Harden search_path on every SECURITY DEFINER function this project
--    created/modified. An unset search_path allows a caller to potentially
--    hijack unqualified table/function references; fixing it to a known
--    schema list closes that class of attack regardless of exploitability
--    today.
-- ----------------------------------------------------------------------------
ALTER FUNCTION try_create_client_enquiry(UUID, UUID, TEXT, TEXT, TEXT)
    SET search_path = public, pg_temp;

ALTER FUNCTION check_onlifit_black_eligibility(UUID)
    SET search_path = public, pg_temp;

ALTER FUNCTION sync_profile_email_verified()
    SET search_path = public, pg_temp;


-- ----------------------------------------------------------------------------
-- 4. Convert calculate_profile_completion_score() to SECURITY DEFINER.
--    Audited as safe: only reads system_settings (shared config) and writes
--    to the triggering row's own profile_completion_score — no arbitrary-row
--    writes, no dynamic SQL, no privilege escalation vector. Required to
--    preserve current behavior: without this, once system_settings gets RLS
--    with no policies, this trigger's read (running as the invoking
--    anon/authenticated role) would silently return nothing and stop
--    computing scores for any client-side profile edit.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_profile_completion_score()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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


-- ----------------------------------------------------------------------------
-- 5. Revoke public EXECUTE on finalize_payment() — an orphaned legacy
--    function (from the archived Razorpay booking/escrow flow) with no
--    internal signature verification. Nothing active calls it; if left
--    publicly callable, any anon/authenticated caller could fabricate a
--    "paid" booking with no real payment. Not dropping the function itself
--    (bookings/payments tables it touches are out of scope for this
--    migration) — only removing its public callability.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION finalize_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
