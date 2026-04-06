# Fix Supabase RLS Policy Error - COMPLETE GUIDE

## Problem
Error: **"new row violates row-level security policy for table 'profiles'"**

This happens when signing up because Supabase Row Level Security (RLS) is blocking the profile creation during user registration.

---

## 🔧 SOLUTION 1: Fix RLS Policies (Recommended - Try This First)

### Step-by-Step Instructions:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `lnbsgnfrhewdqhuqqotx`
3. **Go to SQL Editor** (left sidebar, icon looks like `</>`)
4. **Click "New Query"**
5. **Copy and paste this ENTIRE script**:

```sql
-- Drop all existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profile" ON profiles;

-- Create new policies
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id);
```

6. **Click RUN** (or press F5)
7. **Verify**: You should see a success message

### Test It:
1. Open `onlifit.html` in your browser
2. Click **Sign Up**
3. Fill in: Name, Email, Password, Phone
4. Click **Sign Up**
5. ✅ You should be redirected to the dashboard!

---

## 🔧 SOLUTION 2: Automatic Profile Creation (If Solution 1 Doesn't Work)

This creates profiles automatically using a database trigger, so RLS policies don't interfere.

### Instructions:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this script:

```sql
-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Important**: With this solution, you need to update your signup function to pass metadata:

In `auth.js`, line 16-22, change to:
```javascript
const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
        data: { 
            name, 
            role,
            phone  // Add phone here
        }
    }
});
```

Then **remove** the manual profile insert (lines 28-52), as the trigger handles it automatically.

---

## 🔧 SOLUTION 3: Temporary Fix (Development Only - NOT for Production)

**⚠️ WARNING**: This disables security. Only use for testing!

```sql
-- Temporarily disable RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

To re-enable later:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

---

## 🔍 Debugging Steps

### Check if policies exist:
```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;
```

You should see:
- ✅ `INSERT` policy for `authenticated` role
- ✅ `SELECT` policy for `public` role  
- ✅ `UPDATE` policy for `authenticated` role

### Check if RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';
```

Result should be: `rowsecurity = true`

### Test the auth.uid() function:
```sql
SELECT auth.uid();
```

If this returns `NULL`, you're not authenticated. Make sure you're using the correct API key.

---

## 📋 Common Causes & Fixes

| Problem | Cause | Solution |
|---------|-------|----------|
| `auth.uid() = NULL` | User not authenticated during signup | Use `TO authenticated` in policy |
| Policy too restrictive | `WITH CHECK (false)` or similar | Recreate policy with `WITH CHECK (auth.uid() = id)` |
| Trigger conflicts | Multiple triggers creating profiles | Drop duplicate triggers |
| Wrong API key | Using service_role instead of anon key | Check `supabase-client.js` uses `anon` key |

---

## ✅ Final Verification

After applying the fix, run this to confirm everything works:

```sql
-- Check all policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

---

## 💡 Still Not Working?

If you've tried all solutions and still get the error:

1. **Check browser console** (F12) for detailed error messages
2. **Check Supabase logs**: Dashboard → Logs → API Logs
3. **Verify your API key** in `supabase-client.js` is the **anon public key**, not service_role
4. **Clear browser cache** and try again
5. **Try in Incognito mode** to rule out extension conflicts

---

## 📂 Files to Check

- ✅ `fix-rls-policy.sql` - Complete RLS fix script
- ✅ `auth.js` - Signup function (line 13-60)
- ✅ `supabase-client.js` - API key configuration
- ✅ `supabase-schema.sql` - Original schema (for reference)

---

**Need more help?** Check the Supabase documentation: https://supabase.com/docs/guides/auth/row-level-security
