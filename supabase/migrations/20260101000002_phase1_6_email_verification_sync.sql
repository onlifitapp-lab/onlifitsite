-- ============================================================================
-- PHASE 1.6 — CORRECTION: email_verified sync (removes admin approval from
-- the discoverability model; verification_status is retained, unused for
-- discoverability, reserved for future KYC/trust-badge features)
-- ============================================================================
-- Idempotent: safe to re-run.

-- ----------------------------------------------------------------------------
-- 1. profiles.email_verified — mirrors auth.users.email_confirmed_at
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 2. Sync mechanism: trigger on auth.users keeps profiles.email_verified
--    in lockstep whenever Supabase confirms an email.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_profile_email_verified()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_email_verified ON auth.users;
CREATE TRIGGER trg_sync_profile_email_verified
    AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_email_verified();

-- ----------------------------------------------------------------------------
-- 3. Backfill existing users from their current auth.users state.
-- ----------------------------------------------------------------------------
UPDATE profiles p
SET email_verified = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u
WHERE p.id = u.id;
