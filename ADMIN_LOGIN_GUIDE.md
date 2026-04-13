# Admin Login - Setup & Usage

## New Feature: Dedicated Admin Login Page

I've created `admin-login.html` - a dedicated login page specifically for admins.

## How to Use

### 1. Access the Admin Login
Go to: `admin-login.html` in your browser

### 2. Login with Your Credentials
- **Email:** Your email address
- **Password:** Your password

### 3. What Happens Next

The system will:
1. ✅ Authenticate your credentials
2. ✅ Check if you have `role = 'admin'` in the database
3. ✅ If yes → Redirect to admin dashboard
4. ❌ If no → Show "Access denied" error

---

## Setting Up Your Admin Account

### Step 1: Make Sure You Have an Account

Go to Supabase SQL Editor and run:
```sql
-- Check if your account exists
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

**If this returns NO rows:**
- You don't have an account yet
- Sign up at `login.html` first
- Then come back to step 2

### Step 2: Set Your Role to Admin

```sql
-- Make your account an admin
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';

-- Verify it worked
SELECT email, role FROM profiles WHERE email = 'your-email@example.com';
```

You should see: `role = admin`

### Step 3: Login via Admin Login Page

1. Go to `admin-login.html`
2. Enter your email and password
3. Click "Login to Admin Dashboard"
4. You should be redirected to the admin dashboard! ✅

---

## Features

### Security Checks
- ✅ Authenticates with Supabase
- ✅ Verifies admin role from database
- ✅ Auto-signs out non-admins
- ✅ Prevents unauthorized access

### User Experience
- Professional black/white design
- Clear error messages
- Loading states
- Auto-redirect if already logged in

### Error Handling
- "Invalid credentials" → Wrong email/password
- "Access denied" → Account exists but not admin
- "Could not load profile" → Database issue

---

## Troubleshooting

### "Invalid login credentials"
- Double-check your email and password
- Make sure you've signed up at `login.html` first

### "Access denied. This account does not have admin privileges"
- Your account exists but role is not 'admin'
- Run the UPDATE query above to set role = 'admin'

### Still Not Working?

Run this diagnostic:
```sql
-- Check everything
SELECT 
    a.email as auth_email,
    p.email as profile_email,
    p.role as role,
    p.name as name
FROM auth.users a
LEFT JOIN profiles p ON a.id = p.id
WHERE a.email = 'your-email@example.com';
```

**Expected output:**
```
auth_email          | profile_email       | role  | name
--------------------|--------------------|----|------------
you@example.com     | you@example.com    | admin | Your Name
```

If `role` is not 'admin', run:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

---

## Quick Start Summary

1. **Sign up** at `login.html` (if you haven't)
2. **Run SQL** to make yourself admin (see above)
3. **Go to** `admin-login.html`
4. **Login** with your credentials
5. **Access** the admin dashboard! 🎉

---

## Benefits of Dedicated Admin Login

✅ **Clearer flow** - Know exactly where to login as admin
✅ **Better security** - Explicit admin verification
✅ **Better UX** - Clear error messages for admins
✅ **Debugging** - Easier to see what's going wrong

---

## URL Structure

```
login.html           → Regular user login (client/trainer)
admin-login.html     → Admin login only
admin-dashboard.html → Admin dashboard (requires admin login)
```

---

**Try it now:** Open `admin-login.html` and login with your credentials!
