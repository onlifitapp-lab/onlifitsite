-- ================================================================
-- ONLIFIT TRAINER DOCUMENTS SETUP
-- Run this in Supabase SQL Editor
-- ================================================================

-- ============================================================
-- STEP 1: UPDATE PROFILES TABLE SCHEMA
-- ============================================================

-- Add KYC and certification columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kyc_front_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_back_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certificate_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS certificates_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' 
    CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Add comments for documentation
COMMENT ON COLUMN profiles.kyc_front_url IS 'Storage URL for front of government ID';
COMMENT ON COLUMN profiles.kyc_back_url IS 'Storage URL for back of government ID';
COMMENT ON COLUMN profiles.kyc_verified IS 'Admin sets to true after verifying KYC documents';
COMMENT ON COLUMN profiles.certificate_urls IS 'JSON array of certificate objects: [{name: "ACE Certified", url: "https://...", verified: false}]';
COMMENT ON COLUMN profiles.certificates_verified IS 'True if all certificates are admin-verified';
COMMENT ON COLUMN profiles.verification_status IS 'Overall verification status: pending (default), verified (all docs approved), rejected (docs rejected)';

-- ============================================================
-- STEP 2: CREATE STORAGE BUCKET
-- ============================================================

-- Note: You must create the bucket "trainer-documents" manually in the Supabase Dashboard
-- Go to: Storage → New Bucket → Name: "trainer-documents" → Public: NO → Create

-- ============================================================
-- STEP 3: SET UP STORAGE POLICIES
-- ============================================================

-- Policy 1: Allow trainers to upload their own documents
CREATE POLICY "Trainers can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow trainers to view their own documents
CREATE POLICY "Trainers can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Allow trainers to update their own documents
CREATE POLICY "Trainers can update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow trainers to delete their own documents
CREATE POLICY "Trainers can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- STEP 4: ADMIN ACCESS POLICIES (OPTIONAL)
-- ============================================================

-- Note: First create an 'admin' role if you haven't already
-- You can add role='admin' to specific user profiles manually

-- Policy 5: Allow admins to view all documents
CREATE POLICY "Admins can view all trainer documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainer-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 6: Allow admins to update verification status
CREATE POLICY "Admins can update verification status"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Index for finding unverified trainers
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status 
ON profiles(verification_status) 
WHERE role = 'trainer';

-- Index for finding verified trainers
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_verified 
ON profiles(kyc_verified) 
WHERE role = 'trainer';

-- ============================================================
-- STEP 6: VERIFICATION HELPER FUNCTIONS (OPTIONAL)
-- ============================================================

-- Function to check if trainer is fully verified
CREATE OR REPLACE FUNCTION is_trainer_verified(trainer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = trainer_id
    AND role = 'trainer'
    AND kyc_verified = TRUE
    AND certificates_verified = TRUE
    AND verification_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get verification badge text
CREATE OR REPLACE FUNCTION get_verification_badge(trainer_id UUID)
RETURNS TEXT AS $$
DECLARE
  trainer_record profiles%ROWTYPE;
BEGIN
  SELECT * INTO trainer_record FROM profiles WHERE id = trainer_id;
  
  IF trainer_record.kyc_verified AND trainer_record.certificates_verified THEN
    RETURN '✓ Verified Trainer';
  ELSIF trainer_record.kyc_verified THEN
    RETURN '✓ ID Verified';
  ELSE
    RETURN '⏳ Pending Verification';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 7: SAMPLE QUERIES
-- ============================================================

-- Find all trainers pending verification
-- SELECT id, name, email, kyc_verified, certificates_verified, verification_status
-- FROM profiles
-- WHERE role = 'trainer' 
-- AND verification_status = 'pending'
-- ORDER BY created_at DESC;

-- Find all fully verified trainers
-- SELECT id, name, email, kyc_front_url, kyc_back_url, certificate_urls
-- FROM profiles
-- WHERE role = 'trainer'
-- AND verification_status = 'verified'
-- ORDER BY created_at DESC;

-- Count trainers by verification status
-- SELECT verification_status, COUNT(*) as count
-- FROM profiles
-- WHERE role = 'trainer'
-- GROUP BY verification_status;

-- ============================================================
-- STEP 8: TEST DATA (OPTIONAL)
-- ============================================================

-- Update a specific trainer to verified status (for testing)
-- UPDATE profiles
-- SET kyc_verified = TRUE,
--     certificates_verified = TRUE,
--     verification_status = 'verified'
-- WHERE email = 'test@trainer.com';

-- ============================================================
-- SUCCESS!
-- ============================================================

-- Your database is now set up for:
-- ✅ Storing KYC document URLs
-- ✅ Storing certificate URLs with verification status
-- ✅ Tracking overall verification status
-- ✅ Secure file storage with RLS policies
-- ✅ Admin verification workflow

-- Next steps:
-- 1. Create the 'trainer-documents' bucket in Supabase Dashboard (Storage → New Bucket)
-- 2. Test uploading files from the trainer onboarding form
-- 3. Build an admin panel to verify documents
-- 4. Add verification badges to trainer profiles
