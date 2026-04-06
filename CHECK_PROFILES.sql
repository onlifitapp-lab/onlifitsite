-- ========================================
-- CHECK AND FIX DUPLICATE PROFILES
-- ========================================
-- Run this to diagnose and fix profile issues

-- ========================================
-- STEP 1: Check for duplicate profiles
-- ========================================
SELECT id, email, name, role, created_at, COUNT(*) as count
FROM profiles
GROUP BY id, email, name, role, created_at
HAVING COUNT(*) > 1;

-- If you see any results, there are duplicates!

-- ========================================
-- STEP 2: See all profiles (check for issues)
-- ========================================
SELECT id, email, name, role, phone, created_at
FROM profiles
ORDER BY created_at DESC;

-- ========================================
-- STEP 3: Delete duplicate profiles (CAREFUL!)
-- ========================================
-- Only run this if you see duplicates in STEP 1
-- This keeps the oldest profile and deletes duplicates

/*
DELETE FROM profiles a
USING profiles b
WHERE a.id = b.id 
AND a.ctid > b.ctid;
*/

-- ========================================
-- STEP 4: Verify - should have exactly one profile per user
-- ========================================
SELECT 
    COUNT(*) as total_profiles,
    COUNT(DISTINCT id) as unique_users
FROM profiles;

-- These two numbers should match!

-- ========================================
-- STEP 5: Check if auth users have profiles
-- ========================================
SELECT 
    u.id,
    u.email,
    u.created_at as auth_created,
    p.id as profile_id,
    p.name as profile_name,
    p.role as profile_role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

-- If profile_id is NULL, the user has no profile!

-- ========================================
-- STEP 6: Create missing profiles for auth users
-- ========================================
-- Only run this if STEP 5 shows users without profiles

/*
INSERT INTO profiles (id, email, name, role)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'name', 'User') as name,
    COALESCE(u.raw_user_meta_data->>'role', 'client') as role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
*/

-- ========================================
-- STEP 7: Final verification
-- ========================================
SELECT 
    'Auth Users' as table_name,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Profiles' as table_name,
    COUNT(*) as count
FROM profiles;

-- Both counts should match (each auth user has exactly one profile)
