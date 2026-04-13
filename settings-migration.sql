-- Settings Feature Migration
-- Run this in your Supabase SQL Editor to add settings support

-- 1. Add address column to profiles table (if not exists)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Update profiles table to ensure all necessary columns exist
-- These might already exist, but we're making sure
DO $$ 
BEGIN
    -- Check and add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;
END $$;

-- 3. Storage bucket for avatars (if not already created in Storage UI)
-- Note: This is for reference. Create the bucket in Supabase Dashboard > Storage
-- Bucket name: avatars
-- Public: Yes

-- 4. Storage policies for avatars bucket
-- Run these ONLY if you haven't already set up storage policies

-- Allow public access to view avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: Anyone can view avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Policy: Users can upload their own avatar
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own avatar
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Settings feature migration completed!';
  RAISE NOTICE 'Features added:';
  RAISE NOTICE '  ✓ Address field in profiles';
  RAISE NOTICE '  ✓ Avatar storage bucket and policies';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify avatars bucket exists in Supabase Storage';
  RAISE NOTICE '  2. Deploy settings.html and updated auth.js';
  RAISE NOTICE '  3. Add settings links to dashboards';
END $$;
