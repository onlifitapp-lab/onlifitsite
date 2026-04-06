# Fix Login Error: "Cannot coerce the result to a single JSON object"

## Problem
After successful signup, login fails with error:
**"Cannot coerce the result to a single JSON object"**

## Cause
This happens when:
1. ❌ Multiple profiles exist for the same user (duplicates)
2. ❌ No profile exists for the user
3. ❌ Using `.single()` when query returns 0 or 2+ rows

---

## ✅ QUICK FIX (Already Applied!)

I've updated `auth.js` to handle this automatically:
- ✅ Removed `.single()` from login query
- ✅ Handles multiple profiles (uses first one)
- ✅ Handles missing profiles (creates one automatically)

**Just refresh your browser** (Ctrl + Shift + R) and try logging in again!

---

## 🔍 Diagnose the Issue (Optional)

If login still fails, run these diagnostics in Supabase SQL Editor:

### **Check for duplicate profiles:**
```sql
SELECT id, email, name, COUNT(*) as count
FROM profiles
GROUP BY id, email, name
HAVING COUNT(*) > 1;
```

**Expected:** No results (no duplicates)
**If duplicates found:** See cleanup section below

### **Check if all auth users have profiles:**
```sql
SELECT 
    u.email,
    p.id as has_profile
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
```

**Expected:** Every row has `has_profile` (not NULL)
**If NULL found:** User is missing a profile

---

## 🧹 Clean Up Duplicates (If Needed)

**⚠️ BACKUP FIRST!** This deletes data.

Run the complete diagnostic script in `CHECK_PROFILES.sql` to:
1. Find duplicates
2. Delete duplicates (keeps oldest)
3. Create missing profiles
4. Verify everything is correct

---

## 🧪 Test Login

1. **Hard refresh browser:** Ctrl + Shift + R
2. Go to `onlifit.html`
3. Click **Login**
4. Enter your credentials
5. Click **Login**
6. ✅ **Should work now!**

---

## 📂 Files Updated

- ✅ **auth.js** - Updated `login()` and `getCurrentUser()` to handle edge cases
- ✅ **CHECK_PROFILES.sql** (NEW) - Diagnostic queries to find issues

---

## 🔧 What Changed in auth.js

### **Before:**
```javascript
.select('*')
.eq('id', user.id)
.single();  // ❌ Fails if 0 or 2+ rows
```

### **After:**
```javascript
.select('*')
.eq('id', user.id);  // ✅ Returns array, handles any number of rows

// Handle edge cases
if (!profiles || profiles.length === 0) {
    // Create missing profile
}
const profile = profiles[0];  // Use first if multiple
```

---

## ❌ Still Not Working?

1. Open browser console (F12)
2. Try logging in
3. Copy the EXACT error message
4. Send it to me with:
   - The email you're trying to log in with
   - When you created the account (today? yesterday?)

I'll help you fix it! 🙏
