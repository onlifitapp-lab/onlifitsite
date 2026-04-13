# Quick Admin Setup - Make Yourself an Admin

## Problem
You're getting "Access denied. Admin privileges required" because your account doesn't have admin role yet.

## Solution (2 Minutes)

### Step 1: Find Your User ID
Go to Supabase Dashboard → Authentication → Users

Find your email and copy your **User ID** (it looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Step 2: Run This SQL
Go to Supabase Dashboard → SQL Editor → New Query

Paste this and **replace with your actual email**:

```sql
-- Make yourself an admin
UPDATE profiles
SET role = 'admin'
WHERE email = 'YOUR-EMAIL@example.com';

-- Verify it worked
SELECT id, email, role, name 
FROM profiles 
WHERE email = 'YOUR-EMAIL@example.com';
```

Click **RUN** - you should see your profile with `role = 'admin'`

### Step 3: Refresh Admin Dashboard
1. Go back to `admin-dashboard.html`
2. Refresh the page (F5)
3. You should now see the admin dashboard! ✅

---

## Alternative: If You Don't Have a Profile Yet

If the query returns no rows, your profile might not exist. Run this:

```sql
-- Check if profile exists
SELECT * FROM profiles WHERE email = 'YOUR-EMAIL@example.com';
```

**If empty**, you need to:
1. Sign out of Onlifit
2. Sign up again (either as trainer or client)
3. Then run the UPDATE query above to change your role to 'admin'

---

## Quick Reference

### Check Current User
```sql
SELECT email, role FROM profiles WHERE email = 'YOUR-EMAIL@example.com';
```

### Make User Admin
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'YOUR-EMAIL@example.com';
```

### Create Multiple Admins
```sql
UPDATE profiles SET role = 'admin' WHERE email IN (
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
);
```

---

## Troubleshooting

### Still Getting Access Denied?
1. **Clear browser cache** (Ctrl + Shift + Delete)
2. **Log out and log back in**
3. **Check the SQL actually updated** (run SELECT query again)

### Redirecting to Wrong Page?
This is normal - non-admins get redirected to their appropriate dashboard:
- Trainers → `trainer.html`
- Clients → `client-dashboard.html`

### Can't Find Your Email in Supabase?
Go to: **Supabase → Authentication → Users**
Your email should be listed there after signup.

---

## After Setup

Once you're an admin, you can:
✅ View all trainers
✅ Verify KYC documents
✅ Approve/reject certificates
✅ Export data to Excel/PDF
✅ Manage the entire platform

---

**Need Help?**
If you're still stuck, send me:
1. Screenshot of Supabase Authentication → Users (with your email visible)
2. Result of: `SELECT email, role FROM profiles WHERE email = 'your-email';`
