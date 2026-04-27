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

-- ========================================
-- STEP 8: Check auth role vs profile role mismatch
-- ========================================
-- This is the key check for your trainer redirect issue.
-- If auth_role is trainer but profile_role is client, onboarding will fail.

SELECT
        u.id,
        u.email,
        COALESCE(u.raw_user_meta_data->>'role', 'client') AS auth_role,
        COALESCE(p.role, 'missing') AS profile_role,
        u.created_at AS auth_created,
        p.created_at AS profile_created
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE COALESCE(u.raw_user_meta_data->>'role', 'client') <> COALESCE(p.role, 'missing')
ORDER BY u.created_at DESC;

-- ========================================
-- STEP 9: Check trigger health (auto profile creation)
-- ========================================

SELECT
        trigger_name,
        event_object_schema,
        event_object_table,
        action_timing,
        event_manipulation,
        action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
    AND event_object_table = 'users'
    AND trigger_name = 'on_auth_user_created';

-- ========================================
-- STEP 10: Repair mismatched roles (SAFE)
-- ========================================
-- Run this to sync profile role from auth metadata.
-- This is safe and id-based.

/*
UPDATE profiles p
SET
        role = COALESCE(u.raw_user_meta_data->>'role', 'client'),
        updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
    AND COALESCE(u.raw_user_meta_data->>'role', 'client') <> COALESCE(p.role, 'client');
*/

-- ========================================
-- STEP 11: Force latest Join-Us users to trainer (if needed)
-- ========================================
-- Emergency fallback for the exact issue you're facing.
-- Uncomment only if the user signed up from Join Us and still got role client.

/*
UPDATE profiles
SET role = 'trainer', updated_at = NOW()
WHERE id IN (
        SELECT u.id
        FROM auth.users u
        LEFT JOIN profiles p ON p.id = u.id
        WHERE COALESCE(u.raw_user_meta_data->>'role', '') = 'trainer'
            AND COALESCE(p.role, 'client') <> 'trainer'
);
*/

-- ========================================
-- STEP 12: Final trainer-role verification
-- ========================================

SELECT
        u.email,
        COALESCE(u.raw_user_meta_data->>'role', 'client') AS auth_role,
        p.role AS profile_role,
        p.updated_at
FROM auth.users u
JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 20;

-- ========================================
-- STEP 13: Promote one account to trainer (schema-safe)
-- ========================================
-- Use this when you need to test trainer flow with an existing email.
-- Replace the email in both places before running.

/*
-- 13A) Set auth metadata role = trainer
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"trainer"}'::jsonb
WHERE email = 'your-email@gmail.com';

-- 13B) Set profile role = trainer (always safe)
UPDATE profiles
SET role = 'trainer',
    updated_at = NOW()
WHERE email = 'your-email@gmail.com';

-- 13C) OPTIONAL: Only run if column exists in your schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'onboarding_completed'
    ) THEN
        EXECUTE $$
            UPDATE profiles
            SET onboarding_completed = FALSE
            WHERE email = 'your-email@gmail.com'
        $$;
    END IF;
END $$;

-- 13D) Verify role sync for this email
SELECT
    u.email,
    COALESCE(u.raw_user_meta_data->>'role', 'client') AS auth_role,
    p.role AS profile_role,
    p.updated_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'your-email@gmail.com';
*/
