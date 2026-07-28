-- Allow a trainer to self-service resubmit verification after a rejection.
--
-- Context: enforce_verification_admin_only() (added in
-- 20260719200714_add_trainer_verification_lifecycle_to_profiles.sql) blocks
-- ANY write to verification_status / verification_submitted_at /
-- verification_verified_at / verification_rejected_reason unless the caller
-- is an admin. That is still correct for approving/rejecting a trainer, but
-- it also blocked the one self-service transition a rejected trainer needs:
-- flipping their own verification_status from 'rejected' back to 'pending'
-- after re-uploading corrected documents, so the admin queue picks them up
-- again. This migration carves out exactly that one transition; a trainer
-- can never set their own status to 'verified', and can never touch
-- verification_verified_at or verification_rejected_reason themselves.
CREATE OR REPLACE FUNCTION enforce_verification_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  is_self_resubmission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  is_self_resubmission := (
    auth.uid() = OLD.id
    AND OLD.verification_status = 'rejected'
    AND NEW.verification_status = 'pending'
    AND NEW.verification_verified_at IS NOT DISTINCT FROM OLD.verification_verified_at
    AND NEW.verification_rejected_reason IS NOT DISTINCT FROM OLD.verification_rejected_reason
  );

  IF (
    NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
    NEW.verification_submitted_at IS DISTINCT FROM OLD.verification_submitted_at OR
    NEW.verification_verified_at IS DISTINCT FROM OLD.verification_verified_at OR
    NEW.verification_rejected_reason IS DISTINCT FROM OLD.verification_rejected_reason
  ) AND NOT is_admin AND NOT is_self_resubmission THEN
    RAISE EXCEPTION 'verification fields can only be modified by an admin';
  END IF;

  RETURN NEW;
END;
$$;
