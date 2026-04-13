# Fix: No Profile Found - Create Admin Account

## Problem
"Success. No rows returned" means you don't have a profile in the `profiles` table yet.

## Diagnosis Steps

### Step 1: Check if You Exist in Auth
Run this in Supabase SQL Editor:

```sql
-- Check if your email exists in authentication
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'YOUR-EMAIL@example.com';
```

---

## Solution A: If Auth User EXISTS (Returns 1 Row)

Your account exists but profile wasn't created. **Manually create it:**

```sql
-- Replace YOUR-EMAIL and YOUR-USER-ID (from auth.users query above)
INSERT INTO profiles (id, email, role, name, created_at, updated_at)
VALUES (
    'YOUR-USER-ID-FROM-ABOVE',  -- Copy from auth.users id column
    'YOUR-EMAIL@example.com',
    'admin',
    'Admin User',
    NOW(),
    NOW()
);

-- Verify it worked
SELECT id, email, role, name FROM profiles WHERE email = 'YOUR-EMAIL@example.com';
```

---

## Solution B: If Auth User DOES NOT EXIST (No Rows)

You haven't signed up yet. Follow these steps:

### Option 1: Sign Up Through Platform (RECOMMENDED)

1. **Go to** `login.html` in your browser
2. **Click** "Sign Up" or "Create Account"
3. **Fill in** your details:
   - Email: your-email@example.com
   - Password: (choose a strong password)
   - Name: Your Name
4. **Complete** the signup process
5. **Then come back** and run this SQL:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';

-- Verify
SELECT email, role FROM profiles WHERE email = 'your-email@example.com';
```

### Option 2: Create Everything Manually

**Step 1: Create Auth User** (Supabase Dashboard → Authentication → Add User)
- Email: your-email@example.com
- Password: (your choice)
- Click "Create User"
- Copy the User ID that gets created

**Step 2: Create Profile**
```sql
-- Replace USER-ID with the ID from step 1
INSERT INTO profiles (id, email, role, name, created_at, updated_at)
VALUES (
    'USER-ID-FROM-AUTH-USERS',
    'your-email@example.com',
    'admin',
    'Admin User',
    NOW(),
    NOW()
);
```

---

## Quick Script - Copy This

Run this **all at once** - it will work regardless of your situation:

```sql
-- This creates admin profile if auth user exists
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get your user ID from auth.users
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'YOUR-EMAIL@example.com'
    LIMIT 1;
    
    -- If user exists, create/update profile
    IF user_uuid IS NOT NULL THEN
        INSERT INTO profiles (id, email, role, name, created_at, updated_at)
        VALUES (user_uuid, 'YOUR-EMAIL@example.com', 'admin', 'Admin User', NOW(), NOW())
        ON CONFLICT (id) 
        DO UPDATE SET role = 'admin', updated_at = NOW();
        
        RAISE NOTICE 'Profile created/updated for user %', user_uuid;
    ELSE
        RAISE NOTICE 'No auth user found with that email. Please sign up first.';
    END IF;
END $$;

-- Check result
SELECT id, email, role, name FROM profiles WHERE email = 'YOUR-EMAIL@example.com';
```

**Replace `YOUR-EMAIL@example.com` with your actual email!**

---

## After Running

You should see output like:
```
NOTICE: Profile created/updated for user a1b2c3d4-e5f6-7890-abcd-ef1234567890

id                                    | email              | role  | name
--------------------------------------|-------------------|-------|------------
a1b2c3d4-e5f6-7890-abcd-ef1234567890 | you@example.com   | admin | Admin User
```

If you see this, **refresh admin-dashboard.html** and you're good to go! ✅

---

## Still Not Working?

Send me the output of:
```sql
-- Check auth users
SELECT email FROM auth.users LIMIT 5;

-- Check profiles
SELECT email, role FROM profiles LIMIT 5;

-- Check your specific email
SELECT 
    (SELECT email FROM auth.users WHERE email = 'YOUR-EMAIL@example.com') as auth_email,
    (SELECT email FROM profiles WHERE email = 'YOUR-EMAIL@example.com') as profile_email;
```
