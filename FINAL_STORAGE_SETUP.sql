-- ================================================================
-- ONLIFIT FINAL STORAGE BUCKET CONFIGURATION (Step 2)
-- Copy and paste this into the Supabase SQL Editor.
-- This ensures 'avatars' and 'trainer_certifications' store photos correctly securely.
-- ================================================================

-- 1. Create 'avatars' Bucket (Public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars RLS Policies (Allow anyone to view, but only authorized users to upload their own)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);


-- 2. Create 'trainer_certifications' Bucket (Public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('trainer_certifications', 'trainer_certifications', true)
ON CONFLICT (id) DO NOTHING;

-- Certifications RLS Policies
CREATE POLICY "Certifications are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'trainer_certifications');
CREATE POLICY "Trainers can upload certs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trainer_certifications' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Trainers can update certs" ON storage.objects FOR UPDATE USING (bucket_id = 'trainer_certifications' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Trainers can delete certs" ON storage.objects FOR DELETE USING (bucket_id = 'trainer_certifications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add a default avatar field default if it isn't set properly
ALTER TABLE profiles ALTER COLUMN avatar_url SET DEFAULT 'https://ui-avatars.com/api/?name=User&background=random';
