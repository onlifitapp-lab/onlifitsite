-- ========================================
-- COMPLETE FIX: Database Trigger Approach
-- ========================================
-- This automatically creates profiles when users sign up
-- Bypasses RLS issues completely
-- Run this ENTIRE script in Supabase SQL Editor

-- ========================================
-- STEP 1: Disable RLS temporarily to clean up
-- ========================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: Drop existing trigger and function
-- ========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ========================================
-- STEP 3: Create function to auto-create profiles
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    name, 
    email, 
    role, 
    phone,
    avatar_url,
    specialty,
    location,
    experience,
    plans,
    tags,
    certifications
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'phone',
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' THEN '🏋️'
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' 
      THEN COALESCE(NEW.raw_user_meta_data->>'specialty', 'Personal Training')
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' 
      THEN COALESCE(NEW.raw_user_meta_data->>'location', 'Online')
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' 
      THEN COALESCE(NEW.raw_user_meta_data->>'experience', '1+ years')
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' 
      THEN '{}'::jsonb
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' 
      THEN ARRAY[]::text[]
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'trainer' 
      THEN ARRAY[]::text[]
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

-- ========================================
-- STEP 4: Create trigger
-- ========================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- STEP 5: Re-enable RLS with simpler policies
-- ========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profile" ON profiles;

-- Create simple policies (INSERT is handled by trigger with SECURITY DEFINER)
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- ========================================
-- STEP 6: Verify everything is set up
-- ========================================
SELECT 'Trigger created successfully!' AS status;

SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
AND event_object_table = 'users'
AND trigger_name = 'on_auth_user_created';

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;
