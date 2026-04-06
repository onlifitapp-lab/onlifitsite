-- FIX: Complete Row Level Security Setup for Onlifit
-- Run this entire script in your Supabase SQL Editor to fix signup issues
-- This will DROP and RECREATE all policies with proper permissions

-- ========================================
-- 1. DROP ALL EXISTING POLICIES
-- ========================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profile" ON profiles;

-- ========================================
-- 2. CREATE NEW POLICIES FOR PROFILES
-- ========================================

-- Allow anyone to view profiles (needed for browsing trainers)
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- Allow authenticated users to insert their own profile during signup
CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- ========================================
-- 3. VERIFY POLICIES ARE CREATED
-- ========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- ========================================
-- 4. ALTERNATIVE: Use Database Trigger (Automatic Profile Creation)
-- ========================================
-- If the above still doesn't work, uncomment and run this section:
-- This automatically creates a profile when a user signs up

/*
-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
*/

-- ========================================
-- 5. CHECK RLS STATUS
-- ========================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'bookings', 'messages', 'notifications', 'reviews');

