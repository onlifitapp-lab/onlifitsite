# Live Deployment Checklist

## Critical: Fix Supabase Authentication URL Configuration

### Current Issue
- Website redirects broken after Google OAuth signup
- Error: Trainer onboarding redirect to homepage instead of form
- Console error: schema columns missing (FIXED in code)

### STEP 1: Update Supabase Site URL (MUST DO)

1. Go to **Supabase Dashboard** → Your Project → **Authentication** → **URL Configuration**

2. **Set Site URL to canonical www domain:**
   - Current: `https://onlifit.in`
   - Change to: `https://www.onlifit.in`
   - Click **Save changes**

3. **Verify Redirect URLs include both variants:**
   - Must have: `https://www.onlifit.in/**`
   - Must have: `https://onlifit.in/**` 
   - Must have: `https://lnbsgnfrhewdqhuqqotx.supabase.co/**`
   - (Keep existing test URLs if you need them)
   - Click **Save changes**

### STEP 2: Update Google Cloud OAuth Config (MUST DO)

1. Go to **Google Cloud Console** → Your Onlifit Project → **APIs & Services** → **Credentials**

2. Click on your OAuth 2.0 client (Onlifit Web Client)

3. **Update Authorized JavaScript Origins:**
   - Must include: `https://www.onlifit.in`
   - Must include: `https://onlifit.in`
   - Must include: `https://lnbsgnfrhewdqhuqqotx.supabase.co`
   - Click **Save**

4. **Update Authorized Redirect URIs:**
   - Must include: `https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback`
   - Click **Save**

### STEP 3: Verify DNS & SSL

1. Check that `onlifit.in` DNS points to Vercel:
   - Should be: `cname.vercel-dns.com`
   - Test: `nslookup onlifit.in` (on Windows)
   - Or: `dig onlifit.in` (on Mac/Linux)

2. Check SSL certificate is valid:
   - Visit: `https://www.onlifit.in`
   - Visit: `https://onlifit.in`
   - Both should load without certificate warnings

### STEP 4: Deploy Latest Code

```bash
git push origin main
# Vercel will auto-deploy from main branch
```

### STEP 5: Test Login Flow End-to-End

**Test 1: Client signup**
1. Go to `https://www.onlifit.in/login.html?tab=signup`
2. Click "Sign up with Google"
3. Should redirect to client-dashboard.html (or onboarding if new)

**Test 2: Trainer signup** 
1. Go to `https://www.onlifit.in/join-us.html`
2. Click "Start Application"
3. Choose "Email" or "Google"
4. After signup, should redirect to trainer-onboarding.html

**Test 3: Verify no console errors**
- Open DevTools (F12)
- Check Console tab for any errors
- Should see no 400/401 auth errors

---

## Database Verification (Run Once After Deploy)

Run these checks in Supabase SQL Editor to verify trainer data sync:

```sql
-- Check 1: Verify profile schema has required columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('verification_status', 'kyc_verified', 'certificates_verified')
ORDER BY column_name;

-- Check 2: Verify trigger exists for auto profile creation
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND trigger_name = 'on_auth_user_created';

-- Check 3: Check for role mismatches
SELECT email, 
  COALESCE(raw_user_meta_data->>'role', 'client') as auth_role,
  p.role as profile_role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE COALESCE(u.raw_user_meta_data->>'role', 'client') <> COALESCE(p.role, 'client');

-- If Check 3 returns results, run this fix:
UPDATE profiles p
SET role = COALESCE(u.raw_user_meta_data->>'role', 'client'),
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND COALESCE(u.raw_user_meta_data->>'role', 'client') <> COALESCE(p.role, 'client');
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Unsafe attempt to load URL...` | SSL/DNS issue | Verify SSL cert and DNS configuration |
| Redirected to homepage after Google signup | Auth redirect URL mismatch | Check Supabase Site URL is set to www variant |
| Trainer goes to client dashboard instead of onboarding | Profile role mismatch | Run role sync query in DB verification section |
| Support ticket upload fails | Storage policy issue | Ensure ticket_attachments bucket is private |

---

## Code Changes Made (Already Deployed)

✅ Fixed OAuth redirect host consistency (both code and config guide)
✅ Fixed schema query to only request existing columns
✅ Secured support ticket storage (private bucket + owner-scoped policies)
✅ Added automated pre-launch smoke checks

---

**Status: Ready for production after Supabase URL config update**
