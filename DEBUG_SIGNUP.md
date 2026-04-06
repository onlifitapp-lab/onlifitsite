# Debug Trainer Signup Issue

## Problem
User signed up through "Join as a Trainer" flow but got assigned 'client' role instead of 'trainer'.

## Diagnostic Steps

### 1. Check Current User's Role in Database
Run this in Supabase SQL Editor to see what role was actually saved:

```sql
-- Check the most recent user
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Check their profile
SELECT 
  id,
  email,
  name,
  role,
  phone,
  specialty,
  location
FROM profiles
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Check if Trigger Exists
```sql
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
AND event_object_table = 'users';
```

### 3. Test the Flow

#### What SHOULD happen:
1. User clicks "Sign up via Email" on join-us.html
2. Redirects to: `login.html?tab=signup&role=trainer&hideRole=true`
3. Login.html sets `selectedRole = 'trainer'` (line 142)
4. User fills form and submits
5. Calls `signUp(name, email, password, 'trainer', {}, phone)` (line 191)
6. auth.js passes role in `options.data.role`
7. Database trigger reads from `raw_user_meta_data->>'role'`
8. Profile created with role='trainer'

#### What MIGHT be going wrong:
- Scripts loading with `defer` might cause timing issues
- URL parameter might not be read correctly
- Trigger might not be installed or might be using old version

### 4. Temporary Fix - Update Existing User's Role

If you need to fix the current user immediately, run this in Supabase SQL Editor:

```sql
-- First, find your user ID
SELECT id, email, role FROM profiles WHERE email = 'YOUR_EMAIL_HERE';

-- Then update the role
UPDATE profiles 
SET role = 'trainer',
    specialty = 'Personal Training',
    location = 'Online',
    experience = '1+ years',
    plans = '{}'::jsonb,
    tags = ARRAY[]::text[],
    certifications = ARRAY[]::text[]
WHERE email = 'YOUR_EMAIL_HERE';

-- Verify it worked
SELECT id, email, role, specialty, location FROM profiles WHERE email = 'YOUR_EMAIL_HERE';
```

### 5. Code Fix Needed

The issue is likely in login.html where scripts are deferred. When scripts are deferred, they load asynchronously and might not be available when the inline script runs.

**Current problematic code (login.html lines 124-127):**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>
<script src="supabase-client.js" defer></script>
<script src="auth.js" defer></script>
<script>
    // This inline script runs immediately, but deferred scripts haven't loaded yet!
    let selectedRole = 'client';
    window.onload = () => {
        // ...
    }
</script>
```

**Should be:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<script src="auth.js"></script>
<script>
    // Now this runs after scripts are loaded
    let selectedRole = 'client';
    // ...
</script>
```

OR use DOMContentLoaded to ensure everything is ready.
