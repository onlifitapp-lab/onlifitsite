-- ============================================================================
-- Recreated post-hoc on 2026-07-21 to bring supabase/migrations back in sync
-- with production history. This file was NOT run to produce this migration
-- (it was applied directly via the Supabase MCP apply_migration tool on
-- 2026-07-20, during a post-migration regression audit); it is a faithful,
-- unmodified copy of the SQL that was actually executed, filed under its
-- real recorded version. See MIGRATION_HISTORY.md.
--
-- Fixes check_onlifit_black_eligibility() (originally defined in
-- 20260101000001_phase1_marketplace_foundation.sql), which compared
-- verification_status = 'approved'. 20260719200714 renamed that value to
-- 'verified', silently breaking Onlifit Black eligibility for every
-- previously-eligible trainer until this fix.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_onlifit_black_eligibility(trainer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    profile_record RECORD;
    experience_years INTEGER;
    is_eligible BOOLEAN := FALSE;
BEGIN
    SELECT
        verification_status,
        subscription_plan,
        subscription_status,
        experience,
        rating,
        review_count
    INTO profile_record
    FROM profiles
    WHERE id = trainer_id AND role = 'trainer';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    BEGIN
        experience_years := COALESCE(
            NULLIF(regexp_replace(COALESCE(profile_record.experience, '0'), '[^0-9]', '', 'g'), '')::INTEGER,
            0
        );
    EXCEPTION WHEN OTHERS THEN
        experience_years := 0;
    END;

    is_eligible := (
        COALESCE(profile_record.verification_status, '') = 'verified'
        AND LOWER(COALESCE(profile_record.subscription_plan, '')) = 'elite'
        AND LOWER(COALESCE(profile_record.subscription_status, '')) = 'active'
        AND experience_years >= 2
        AND COALESCE(profile_record.rating, 0) >= 4.5
        AND COALESCE(profile_record.review_count, 0) >= 10
    );

    UPDATE profiles
    SET has_black_status = is_eligible,
        updated_at = NOW()
    WHERE id = trainer_id;

    RETURN is_eligible;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
