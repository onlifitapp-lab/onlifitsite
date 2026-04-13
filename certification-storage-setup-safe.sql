-- SAFE Certification Storage Setup
-- This script can be run multiple times safely

-- Step 1: Drop existing table if you want a clean slate (OPTIONAL - uncomment if needed)
-- DROP TABLE IF EXISTS certifications CASCADE;

-- Step 2: Create certifications table (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'certifications') THEN
        CREATE TABLE certifications (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            trainer_name TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_type TEXT,
            file_size BIGINT,
            uploaded_at TIMESTAMPTZ DEFAULT now(),
            verified BOOLEAN DEFAULT false,
            verification_date TIMESTAMPTZ,
            verified_by UUID REFERENCES profiles(id),
            notes TEXT
        );
        RAISE NOTICE 'Created certifications table';
    ELSE
        RAISE NOTICE 'Table certifications already exists, skipping...';
    END IF;
END $$;

-- Step 3: Create indexes (safe - will skip if exists)
CREATE INDEX IF NOT EXISTS idx_certifications_trainer 
    ON certifications(trainer_id);

CREATE INDEX IF NOT EXISTS idx_certifications_verified 
    ON certifications(verified);

CREATE INDEX IF NOT EXISTS idx_certifications_uploaded 
    ON certifications(uploaded_at DESC);

-- Step 4: Enable RLS
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for certifications table
DROP POLICY IF EXISTS "Anyone can view certifications" ON certifications;
CREATE POLICY "Anyone can view certifications" 
ON certifications FOR SELECT 
USING (true);

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

DROP POLICY IF EXISTS "Trainers can update their own certifications" ON certifications;
CREATE POLICY "Trainers can update their own certifications" 
ON certifications FOR UPDATE 
USING (auth.uid() = trainer_id);

DROP POLICY IF EXISTS "Trainers can delete their own certifications" ON certifications;
CREATE POLICY "Trainers can delete their own certifications" 
ON certifications FOR DELETE 
USING (auth.uid() = trainer_id);

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

-- Step 6: Create trainer_certifications bucket (safe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('trainer_certifications', 'trainer_certifications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Step 7: Storage policies for trainer_certifications bucket
DROP POLICY IF EXISTS "Certifications are publicly viewable" ON storage.objects;
CREATE POLICY "Certifications are publicly viewable" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'trainer_certifications');

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

DROP POLICY IF EXISTS "Trainers can delete their certifications" ON storage.objects;
CREATE POLICY "Trainers can delete their certifications" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'trainer_certifications' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Step 8: Mark old certifications column as deprecated
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'certifications'
    ) THEN
        COMMENT ON COLUMN profiles.certifications IS 'DEPRECATED: Use certifications table instead. Kept for backward compatibility.';
        RAISE NOTICE 'Marked profiles.certifications as deprecated';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ✅ ✅ Certification storage setup completed! ✅ ✅ ✅';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'What was created:';
  RAISE NOTICE '  ✓ certifications table with metadata tracking';
  RAISE NOTICE '  ✓ RLS policies for data security';
  RAISE NOTICE '  ✓ Storage bucket: trainer_certifications';
  RAISE NOTICE '  ✓ Storage policies for file access';
  RAISE NOTICE '  ✓ Performance indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Refresh your browser on settings page';
  RAISE NOTICE '  2. Upload a test certification as trainer';
  RAISE NOTICE '  3. Verify it shows with metadata (name, date, size)';
  RAISE NOTICE '';
  RAISE NOTICE 'Benefits:';
  RAISE NOTICE '  ✓ Real trainer data (no hallucination)';
  RAISE NOTICE '  ✓ Admin verification system';
  RAISE NOTICE '  ✓ Proper file metadata tracking';
  RAISE NOTICE '  ✓ Separate organized storage';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
