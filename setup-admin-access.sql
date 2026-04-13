-- ================================================================
-- ADMIN PANEL SETUP - Quick Setup Script
-- Run this in Supabase SQL Editor to enable admin access
-- ================================================================

-- ============================================================
-- STEP 1: CREATE YOUR FIRST ADMIN USER
-- ============================================================

-- Option A: Update an existing user to admin
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';  -- ⚠️ CHANGE THIS TO YOUR EMAIL

-- Option B: If you need to create a new admin profile manually
-- (Only use if profile doesn't exist after signup)
-- INSERT INTO profiles (id, email, role, name)
-- VALUES (
--   'user-uuid-from-auth-users',  -- Get this from auth.users table
--   'admin@example.com',
--   'admin',
--   'Admin User'
-- );

-- ============================================================
-- STEP 2: VERIFY ADMIN POLICIES EXIST
-- ============================================================

-- Check if admin policies are already set up
-- (These should exist if you ran setup-trainer-storage.sql)

-- List existing policies on storage.objects
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- If you don't see admin policies, run these:

-- Allow admins to view all trainer documents
-- CREATE POLICY "Admins can view all trainer documents"
-- ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'trainer-documents'
--   AND EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.role = 'admin'
--   )
-- );

-- Allow admins to update verification status
-- CREATE POLICY "Admins can update verification status"
-- ON profiles
-- FOR UPDATE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.role = 'admin'
--   )
-- )
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM profiles
--     WHERE profiles.id = auth.uid()
--     AND profiles.role = 'admin'
--   )
-- );

-- ============================================================
-- STEP 3: VERIFY YOUR ADMIN SETUP
-- ============================================================

-- Check if your admin user exists
SELECT id, email, role, name
FROM profiles
WHERE role = 'admin';

-- Should return at least one row with your email

-- ============================================================
-- STEP 4: TEST ADMIN ACCESS
-- ============================================================

-- 1. Go to login.html
-- 2. Log in with your admin email/password
-- 3. You should be redirected to admin-dashboard.html
-- 4. If you see "Access Denied", check the role was set correctly above

-- ============================================================
-- OPTIONAL: CREATE MULTIPLE ADMIN USERS
-- ============================================================

-- If you need multiple admins, repeat for each:
-- UPDATE profiles
-- SET role = 'admin'
-- WHERE email = 'another-admin@example.com';

-- ============================================================
-- TROUBLESHOOTING
-- ============================================================

-- Problem: "Access Denied" when trying to access admin dashboard
-- Solution: Verify role is set correctly
SELECT id, email, role FROM profiles WHERE email = 'your-email@example.com';

-- Problem: Can't update verification status
-- Solution: Check admin policies exist
SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname LIKE '%admin%';

-- Problem: Can't view trainer documents
-- Solution: Check storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%admin%';

-- ============================================================
-- SUCCESS!
-- ============================================================

-- Your admin panel is now ready! 🎉
-- 
-- Next steps:
-- 1. Log in with your admin account
-- 2. Navigate to admin-dashboard.html
-- 3. Start managing trainers and verifications
-- 4. Test the export functionality
-- 
-- For full documentation, see ADMIN_PANEL_GUIDE.md
