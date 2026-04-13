# 🔐 Login Role Detection System

## Overview
Onlifit automatically detects whether a user is a **Trainer** or **Client** based on their account data in the database, then redirects them to the appropriate dashboard.

---

## 🎯 How It Works

### 1. **Email/Password Login** ✅

**User Journey:**
1. User clicks "Login" on onlifit.html
2. Redirected to `login.html`
3. Enters email & password
4. Clicks "Login"

**System Process:**
```javascript
// Step 1: Authenticate user
const { data } = await supabaseClient.auth.signInWithPassword({ email, password });

// Step 2: Fetch profile from database
const { data: profiles } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', data.user.id);

// Step 3: Get role
const role = profiles[0].role; // 'trainer' or 'client'

// Step 4: Auto-redirect
if (role === 'trainer') {
    window.location.href = 'bookings.html';  // Trainer dashboard
} else {
    window.location.href = 'client-dashboard.html';  // Client dashboard
}
```

**Files Involved:**
- `login.html` (lines 246-249) - Redirect logic
- `auth.js` (lines 100-142) - `login()` function

---

### 2. **Google OAuth Login** ✅ (NEW - Just Fixed!)

**For New Users (Signup):**
1. User clicks "Become a Trainer" → `login.html?tab=signup&role=trainer`
2. Clicks "Sign up with Google"
3. System stores role in `localStorage` before OAuth redirect
4. After Google authentication, retrieves role from `localStorage`
5. Updates database profile with correct role
6. Redirects to onboarding

**For Returning Users (Login):**
1. User clicks "Login" → `login.html`
2. Clicks "Login with Google"
3. After Google authentication:
   - NO localStorage data (it's a login, not signup)
   - System fetches user's role from database
   - Auto-redirects based on role:
     - **Trainer** → `bookings.html`
     - **Client** → `client-dashboard.html`

**System Flow:**
```javascript
async function handleOAuthCallback() {
    const user = await getCurrentUser();
    const oauthRole = localStorage.getItem('oauth_role');
    const oauthIsSignup = localStorage.getItem('oauth_is_signup');
    
    // CASE 1: Signup (has localStorage)
    if (oauthRole && oauthIsSignup === 'true') {
        await updateRole(user.id, oauthRole);
        redirect to onboarding based on role
    }
    
    // CASE 2: Login (no localStorage, returning user)
    else if (user && on login page) {
        const profile = await fetchUserProfile(user.id);
        redirect to dashboard based on profile.role
    }
}
```

**Files Involved:**
- `auth.js` (lines 172-269) - `handleOAuthCallback()` function
- `auth.js` (lines 60-91) - `signInWithGoogle()` function
- `login.html` (lines 131-161) - Window onload handler

---

## 📊 Redirect Matrix

| Scenario | Method | Has LocalStorage? | Action | Redirect To |
|----------|--------|-------------------|--------|-------------|
| New Trainer Signup | Email | N/A | Create account with role='trainer' | `trainer-onboarding.html` |
| New Client Signup | Email | N/A | Create account with role='client' | `onboarding.html` |
| New Trainer Signup | Google | Yes (role=trainer) | Set role in DB | `trainer-onboarding.html` |
| New Client Signup | Google | Yes (role=client) | Set role in DB | `onboarding.html` |
| Trainer Login | Email | N/A | Fetch role from DB | `bookings.html` |
| Client Login | Email | N/A | Fetch role from DB | `client-dashboard.html` |
| Trainer Login | Google | No | Fetch role from DB | `bookings.html` |
| Client Login | Google | No | Fetch role from DB | `client-dashboard.html` |

---

## 🔑 Key Features

### ✅ Automatic Detection
- System reads `profiles.role` from database
- No manual selection needed during login
- Works for both email and Google OAuth

### ✅ Role Persistence
- Role is stored in database permanently
- Cannot be changed by URL manipulation
- Secure and reliable

### ✅ Seamless Experience
- Trainers always land on trainer dashboard
- Clients always land on client dashboard
- No confusion or extra clicks

---

## 🧪 Testing

### Test File Created: `test-login-flow.html`

**Features:**
- Shows current logged-in user and role
- Test buttons for different scenarios
- Expected redirect documentation
- Real-time status checking

**How to Test:**

1. **Test Email Login:**
   - Open `test-login-flow.html`
   - Click "Test Trainer Login" or "Test Client Login"
   - Follow instructions
   - Verify redirect matches expected page

2. **Test Google OAuth:**
   - Open `test-login-flow.html`
   - Click "Returning User (Google)"
   - Login with existing Google account
   - System will detect your role and redirect accordingly

3. **Verify Current User:**
   - Open `test-login-flow.html`
   - Click "Refresh User Info"
   - See your role, email, and profile data

---

## 🔧 Technical Details

### Database Schema
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    name TEXT,
    role TEXT CHECK (role IN ('client', 'trainer')),
    phone TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    -- ... other fields
);
```

### Critical Functions

**1. `login(email, password)` - Email Login**
- Location: `auth.js` lines 100-142
- Fetches user profile with role
- Returns complete user object

**2. `handleOAuthCallback()` - Google OAuth Handler**
- Location: `auth.js` lines 172-269
- Handles both signup and login cases
- Auto-redirects based on context

**3. `getCurrentUser()` - Get Logged-In User**
- Location: `auth.js` lines 156-169
- Fetches current user with profile data
- Used throughout the app

---

## 🎬 User Scenarios

### Scenario 1: Trainer Returns to Site
1. Opens onlifit.html
2. Clicks "Login"
3. Enters email/password OR clicks Google
4. **→ Auto-redirected to bookings.html** ✅

### Scenario 2: Client Returns to Site
1. Opens onlifit.html
2. Clicks "Login"
3. Enters email/password OR clicks Google
4. **→ Auto-redirected to client-dashboard.html** ✅

### Scenario 3: New Trainer Joins
1. Clicks "Become a Trainer" on join-us.html
2. Signs up (email or Google)
3. **→ Auto-redirected to trainer-onboarding.html** ✅
4. Completes 5-step form
5. Future logins → bookings.html

---

## 🚨 Important Notes

1. **No Manual Role Selection on Login**
   - Role is automatically detected
   - Users cannot "choose" their role when logging in

2. **Role is Set During Signup Only**
   - Trainers sign up via "Become a Trainer" flow
   - Clients sign up via regular "Sign Up" button
   - Role cannot be changed after signup (currently)

3. **localStorage is Only for OAuth Signup**
   - Used as temporary bridge during Google OAuth
   - Cleared immediately after use
   - Not used for login (only signup)

4. **Database is Source of Truth**
   - `profiles.role` field is authoritative
   - Always fetched fresh on login
   - Cannot be manipulated by frontend

---

## 📝 Summary

**The system now fully supports:**
- ✅ Email/password login with role detection
- ✅ Google OAuth login with role detection
- ✅ Automatic dashboard redirection
- ✅ Separate signup flows for trainers and clients
- ✅ Secure role management in database

**No user action needed** - the system automatically knows who you are and where to send you! 🎉
