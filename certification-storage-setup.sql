-- Certification Storage Setup
-- Run this in Supabase SQL Editor to create proper certification storage

-- 1. Create trainer_certifications bucket in Supabase Storage UI
-- Go to: Supabase Dashboard > Storage > Create New Bucket
-- Bucket name: trainer_certifications
-- Public: Yes (so clients can view trainer credentials)

-- 2. Create certifications table to store metadata
CREATE TABLE IF NOT EXISTS certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trainer_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT, -- e.g., 'pdf', 'jpg', 'png'
    file_size BIGINT, -- file size in bytes
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    verified BOOLEAN DEFAULT false, -- Admin can verify certifications
    verification_date TIMESTAMPTZ,
    verified_by UUID REFERENCES profiles(id), -- Admin who verified
    notes TEXT -- Admin notes about the certification
);

-- 3. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_certifications_trainer 
    ON certifications(trainer_id);

CREATE INDEX IF NOT EXISTS idx_certifications_verified 
    ON certifications(verified);

CREATE INDEX IF NOT EXISTS idx_certifications_uploaded 
    ON certifications(uploaded_at DESC);

-- 4. Enable RLS
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for certifications table
-- Anyone can view all certifications (public)
DROP POLICY IF EXISTS "Anyone can view certifications" ON certifications;
CREATE POLICY "Anyone can view certifications" 
ON certifications FOR SELECT 
USING (true);

-- Trainers can insert their own certifications
DROP POLICY IF EXISTS "Trainers can upload their own certifications" ON certifications;
CREATE POLICY "Trainers can upload their own certifications" 
ON certifications FOR INSERT 
WITH CHECK (
    auth.uid() = trainer_id 
    AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'trainer'
    )
);

-- Trainers can update their own certifications
DROP POLICY IF EXISTS "Trainers can update their own certifications" ON certifications;
CREATE POLICY "Trainers can update their own certifications" 
ON certifications FOR UPDATE 
USING (auth.uid() = trainer_id);

-- Trainers can delete their own certifications
DROP POLICY IF EXISTS "Trainers can delete their own certifications" ON certifications;
CREATE POLICY "Trainers can delete their own certifications" 
ON certifications FOR DELETE 
USING (auth.uid() = trainer_id);

-- Admins can update any certification (for verification)
DROP POLICY IF EXISTS "Admins can verify certifications" ON certifications;
CREATE POLICY "Admins can verify certifications" 
ON certifications FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- 6. Storage policies for trainer_certifications bucket
-- Allow public access to view certifications
DROP POLICY IF EXISTS "Certifications are publicly viewable" ON storage.objects;
CREATE POLICY "Certifications are publicly viewable" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'trainer_certifications');

-- Trainers can upload to their own folder
DROP POLICY IF EXISTS "Trainers can upload certifications" ON storage.objects;
CREATE POLICY "Trainers can upload certifications" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'trainer_certifications' 
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'trainer'
    )
);

-- Trainers can delete their own certifications
DROP POLICY IF EXISTS "Trainers can delete their certifications" ON storage.objects;
CREATE POLICY "Trainers can delete their certifications" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'trainer_certifications' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 7. Update profiles table to remove old certifications array
-- Keep it for backward compatibility but mark as deprecated
COMMENT ON COLUMN profiles.certifications IS 'DEPRECATED: Use certifications table instead. Kept for backward compatibility.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Certification storage setup completed!';
  RAISE NOTICE '';
  RAISE NOTICE 'What was created:';
  RAISE NOTICE '  ✓ certifications table with metadata tracking';
  RAISE NOTICE '  ✓ RLS policies for data security';
  RAISE NOTICE '  ✓ Storage policies for trainer_certifications bucket';
  RAISE NOTICE '  ✓ Indexes for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Go to Supabase Dashboard > Storage';
  RAISE NOTICE '  2. Create bucket: "trainer_certifications" (public)';
  RAISE NOTICE '  3. Update settings.html to use new certification system';
  RAISE NOTICE '';
  RAISE NOTICE 'Benefits:';
  RAISE NOTICE '  ✓ Proper metadata (trainer name, upload date, file size)';
  RAISE NOTICE '  ✓ Admin verification system';
  RAISE NOTICE '  ✓ No hallucination - real data linked to real trainers';
  RAISE NOTICE '  ✓ Separate bucket for better organization';
END $$;
