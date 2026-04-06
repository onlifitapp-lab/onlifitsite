# Google Authentication Setup Guide for Onlifit

Complete step-by-step guide to enable "Sign in with Google" on your Onlifit platform.

---

## Part 1: Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**
2. Click on the project dropdown at the top (next to "Google Cloud")
3. Click **"New Project"**
4. Enter project name: **"Onlifit"** (or any name you prefer)
5. Click **"Create"**
6. Wait for the project to be created (takes ~30 seconds)
7. Make sure your new project is selected in the dropdown

---

### Step 2: Enable Google+ API (Optional but Recommended)

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"People API"**
3. Click on it and click **"Enable"**
4. This allows you to get user profile information (name, photo, etc.)

---

### Step 3: Configure OAuth Consent Screen

1. In the left sidebar, go to **"APIs & Services"** → **"OAuth consent screen"**

2. **Choose User Type:**
   - Select **"External"** (unless you have a Google Workspace)
   - Click **"Create"**

3. **Fill in App Information:**
   - **App name:** `Onlifit`
   - **User support email:** Your email address
   - **App logo:** (Optional) Upload your Onlifit logo
   - **Application home page:** `https://onlifit.in`
   - **Application privacy policy:** `https://onlifit.in/privacy.html` (create later if needed)
   - **Application terms of service:** `https://onlifit.in/terms.html` (create later if needed)
   - **Authorized domains:** Add `onlifit.in`
   - **Developer contact information:** Your email address
   - Click **"Save and Continue"**

4. **Scopes:**
   - Click **"Add or Remove Scopes"**
   - Select these scopes:
     - `userinfo.email`
     - `userinfo.profile`
     - `openid`
   - Click **"Update"**
   - Click **"Save and Continue"**

5. **Test Users (if using External):**
   - Click **"Add Users"**
   - Add your email and any test user emails
   - Click **"Save and Continue"**

6. **Summary:**
   - Review everything
   - Click **"Back to Dashboard"**

---

### Step 4: Create OAuth 2.0 Credentials

1. In the left sidebar, go to **"APIs & Services"** → **"Credentials"**

2. Click **"+ Create Credentials"** at the top

3. Select **"OAuth client ID"**

4. **Application type:** Select **"Web application"**

5. **Name:** `Onlifit Web Client`

6. **Authorized JavaScript origins:**
   - Click **"+ Add URI"**
   - Add: `https://onlifit.in` (your production domain)
   - Add: `https://lnbsgnfrhewdqhuqqotx.supabase.co` (your Supabase project URL)
   - If testing locally, also add: `http://localhost:5500` or `http://localhost:3000`

7. **Authorized redirect URIs:**
   - Click **"+ Add URI"**
   - Add: `https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback`
   - ⚠️ **IMPORTANT:** This MUST match exactly with your Supabase project URL

8. Click **"Create"**

9. **Save your credentials:**
   - A popup will show your **Client ID** and **Client Secret**
   - Copy both and save them securely (you'll need them for Supabase)
   - Click **"OK"**

**Your credentials will look like:**
```
Client ID: 123456789-abcdefghijklmnop.apps.googleusercontent.com
Client Secret: GOCSPX-abcdefghijk123456789
```

---

## Part 2: Supabase Configuration

### Step 5: Configure Supabase Authentication

1. Go to **[Supabase Dashboard](https://supabase.com/dashboard)**

2. Select your **Onlifit project**

3. In the left sidebar, go to **"Authentication"** → **"Providers"**

4. Scroll down and find **"Google"**

5. Click on **"Google"** to expand it

6. **Enable Google Provider:**
   - Toggle the switch to **ON** (it should turn green)

7. **Enter your credentials:**
   - **Client ID:** Paste the Client ID from Google Cloud Console
   - **Client Secret:** Paste the Client Secret from Google Cloud Console

8. **Configure Additional Settings (Optional):**
   - **Skip nonce check:** Leave unchecked (recommended)
   - **Authorized Client IDs:** Leave empty (unless you have mobile apps)

9. Click **"Save"**

---

## Part 3: Update Your Website URLs (If Needed)

If you're deploying to a custom domain, you need to update the redirect URL:

1. In Supabase Dashboard, go to **"Authentication"** → **"URL Configuration"**

2. **Site URL:** Update to your production URL
   - Set to: `https://onlifit.in`

3. **Redirect URLs:** Add allowed redirect URLs
   - Add: `https://onlifit.in/**`
   - Add: `https://lnbsgnfrhewdqhuqqotx.supabase.co/**`
   - (Optional for local testing): `http://localhost:5500/**`

4. Click **"Save"**

---

## Part 4: Test Google Sign-In

### Step 6: Test the Authentication Flow

1. **Open your Onlifit website**

2. **Go to the signup page:**
   - For clients: `https://onlifit.in/login.html?tab=signup`
   - For trainers: `https://onlifit.in/join-us.html`

3. **Click "Sign up with Google"**

4. **Expected Flow:**
   - Google sign-in popup opens
   - Select your Google account
   - Authorize Onlifit to access your profile
   - Redirected back to Onlifit
   - Profile created automatically
   - Redirected to appropriate dashboard

5. **Check if it worked:**
   - Open browser console (F12)
   - Look for any errors
   - Check if you're logged in

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
**Problem:** The redirect URI doesn't match what you configured in Google Cloud Console

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Make sure this URI is added: `https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback`
4. Copy it EXACTLY from Supabase (Authentication → Providers → Google → Callback URL)

---

### Error: "Access blocked: This app's request is invalid"
**Problem:** OAuth consent screen is not properly configured

**Solution:**
1. Go to Google Cloud Console → OAuth consent screen
2. Make sure it's not in "Testing" mode, or add your email as a test user
3. Verify all required fields are filled

---

### Error: "User not found" or profile not created
**Problem:** Database trigger might not be working

**Solution:**
1. Check that the trigger is installed (run COMPLETE_RLS_FIX.sql)
2. Manually check the profiles table in Supabase
3. Look for the user in Authentication → Users

---

### Google Sign-In Button Not Working
**Problem:** Script loading or function not defined

**Solution:**
1. Check browser console for errors
2. Make sure auth.js is loaded
3. Verify the signInWithGoogle() function exists in auth.js

---

## Important Notes

### Role Assignment for Google Sign-Ups

When users sign up with Google, they need to have a role assigned. The current code handles this:

**For Clients:**
- URL: `login.html?tab=signup&role=client&provider=google`
- Role is automatically set to 'client'

**For Trainers:**
- URL: `login.html?tab=signup&role=trainer&provider=google` (from join-us.html)
- Role is automatically set to 'trainer'

The role is passed via URL parameter and stored in the user's metadata by the database trigger.

---

### Security Best Practices

1. **Never commit credentials to Git:**
   - Client ID and Secret should stay in Supabase only
   - Don't put them in your HTML/JS files

2. **Use HTTPS in production:**
   - Google OAuth requires HTTPS for redirect URIs
   - Local testing can use HTTP

3. **Limit authorized domains:**
   - Only add domains you actually use
   - Remove test domains before going live

4. **Review OAuth consent screen:**
   - Make sure it accurately represents your app
   - Add privacy policy and terms of service

---

## Quick Checklist

Before going live with Google Sign-In:

- [ ] Google Cloud Project created
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created (Client ID + Secret)
- [ ] Authorized redirect URI added: `https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback`
- [ ] Supabase Google provider enabled
- [ ] Client ID and Secret added to Supabase
- [ ] Tested signup flow for both clients and trainers
- [ ] Verified profiles are created with correct roles
- [ ] Checked that users are redirected to correct dashboards

---

## Your Specific Setup

**Supabase Project URL:** `https://lnbsgnfrhewdqhuqqotx.supabase.co`

**Required Redirect URI for Google Cloud Console:**
```
https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback
```

**Client Signup with Google:**
- Link on login.html or home page should include: `?tab=signup&role=client&provider=google`

**Trainer Signup with Google:**
- Link on join-us.html already includes: `?tab=signup&role=trainer&hideRole=true&provider=google`

---

## Need Help?

If you encounter any issues:

1. **Check browser console** (F12) for error messages
2. **Check Supabase logs** (Dashboard → Logs → Authentication)
3. **Verify the redirect URI** matches exactly in both places
4. **Test with a different Google account** (sometimes caching causes issues)
5. **Clear browser cache and cookies** and try again

---

Last Updated: April 6, 2026
