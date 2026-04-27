-- ================================================================
-- ADMIN USER DELETION POLICY SETUP
-- Run this in Supabase SQL Editor to enable admin deletion
-- This allows admins to permanently delete users from the system
-- ================================================================

-- ============================================================
-- STEP 1: ADD ADMIN DELETE POLICY FOR PROFILES
-- ============================================================

-- Allow admins to delete user profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- STEP 2: ADD ADMIN DELETE POLICY FOR BOOKINGS
-- ============================================================

-- Allow admins to delete bookings (cascade to remove user history)
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;
CREATE POLICY "Admins can delete bookings"
  ON bookings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- STEP 3: ADD ADMIN DELETE POLICY FOR MESSAGES
-- ============================================================

-- Allow admins to delete messages (remove conversation history)
DROP POLICY IF EXISTS "Admins can delete messages" ON messages;
CREATE POLICY "Admins can delete messages"
  ON messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- STEP 4: ADD ADMIN DELETE POLICY FOR NOTIFICATIONS
-- ============================================================

-- Allow admins to delete user notifications
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- STEP 5: ADD ADMIN DELETE POLICY FOR REVIEWS
-- ============================================================

-- Allow admins to delete reviews
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;
CREATE POLICY "Admins can delete reviews"
  ON reviews
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- STEP 6: ADD ADMIN DELETE POLICY FOR TYPING STATUS
-- ============================================================

-- Allow admins to delete typing status records
DROP POLICY IF EXISTS "Admins can delete typing status" ON typing_status;
CREATE POLICY "Admins can delete typing status"
  ON typing_status
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- VERIFICATION: Check that all policies are created
-- ============================================================

-- Run this query to verify all admin delete policies exist:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive
FROM pg_policies
WHERE tablename IN ('profiles', 'bookings', 'messages', 'notifications', 'reviews', 'typing_status')
  AND policyname LIKE '%delete%'
  AND policyname LIKE '%admin%'
ORDER BY tablename, policyname;

-- Expected output: 6 rows (one for each table)

-- ============================================================
-- TESTING THE DELETION FEATURE
-- ============================================================

-- IMPORTANT: Before testing, make sure you have:
-- 1. Logged in as an admin user
-- 2. Have a test account to delete (NOT your admin account!)
--
-- Steps:
-- 1. Go to admin-dashboard.html
-- 2. Navigate to "Trainers" or "Clients" tab
-- 3. Click "View Details" on a test user
-- 4. Click "Permanently Delete [User Type]"
-- 5. Type "DELETE TRAINER" or "DELETE CLIENT" to confirm
-- 6. User should be completely removed from the system
--
-- After deletion, the user's:
-- - Profile is removed
-- - All bookings are removed
-- - All messages are removed
-- - All notifications are removed
-- - All reviews authored by them are removed
-- - Typing status records are removed
-- - If they try to login, they'll need to create a fresh account

-- ============================================================
-- SUCCESS!
-- ============================================================

-- Admin user deletion is now enabled! 🗑️
--
-- Key features:
-- ✅ Admins can permanently delete user profiles
-- ✅ All associated bookings are cascaded
-- ✅ All messages and chats are removed
-- ✅ User must create fresh account to rejoin
-- ✅ Supports both trainers and clients
--
-- For more info, see the admin dashboard implementation.
