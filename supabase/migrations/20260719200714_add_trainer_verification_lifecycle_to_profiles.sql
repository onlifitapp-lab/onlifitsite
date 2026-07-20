-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20); it is a faithful, unmodified copy of the SQL that was actually
-- executed, filed under its real recorded version so `supabase_migrations
-- .schema_migrations` and this repo agree. See MIGRATION_HISTORY.md.
--
-- NOTE: this migration supersedes the verification_status section of
-- 20260101000001_phase1_marketplace_foundation.sql (item 6 in that file),
-- which set the vocabulary to pending/approved/rejected. This migration
-- renames 'approved' to 'verified' and adds 'under_review'. See
-- MIGRATION_HISTORY.md for the full supersession chain.
-- ============================================================================

-- Expand the status vocabulary: pending / under_review / verified / rejected
-- (previously pending / approved / rejected — 'approved' is renamed to
-- 'verified' and 'under_review' is a new intermediate state).
ALTER TABLE profiles DROP CONSTRAINT profiles_verification_status_check;
UPDATE profiles SET verification_status = 'verified' WHERE verification_status = 'approved';
ALTER TABLE profiles ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected'));

ALTER TABLE profiles ADD COLUMN verification_submitted_at timestamptz;
ALTER TABLE profiles ADD COLUMN verification_verified_at timestamptz;
ALTER TABLE profiles ADD COLUMN verification_rejected_reason text;

-- Admin-only enforcement: the existing "Users can update own profile" RLS
-- policy (auth.uid() = id, no column restriction) would otherwise let a
-- trainer overwrite their own verification fields directly, regardless of
-- the separate admin policy. RLS policies OR together and cannot express
-- column-level restriction, so this is enforced with a trigger instead.
CREATE OR REPLACE FUNCTION enforce_verification_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
    NEW.verification_submitted_at IS DISTINCT FROM OLD.verification_submitted_at OR
    NEW.verification_verified_at IS DISTINCT FROM OLD.verification_verified_at OR
    NEW.verification_rejected_reason IS DISTINCT FROM OLD.verification_rejected_reason
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'verification fields can only be modified by an admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_verification_admin_only
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_verification_admin_only();
