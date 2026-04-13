# Settings & Profile Management - Setup Guide

## Overview
This guide covers the implementation of user settings and profile management for both clients and trainers in the Onlifit platform.

## Features Implemented

### For All Users (Clients & Trainers):
✅ **Profile Picture Upload** - Upload and update avatar images  
✅ **Personal Information** - Edit name, email, phone, address  
✅ **Real-time Preview** - See changes before saving  
✅ **Error Handling** - Clear feedback on upload/save failures  

### For Trainers Only:
✅ **Professional Details** - Edit specialty, experience, bio  
✅ **Pricing Management** - Update Basic, Standard, and Premium plan prices  
✅ **Plan Labels** - Customize plan descriptions (e.g., "1 Session", "Monthly")  

---

## Step 1: Run Database Migration

### Option A: Run settings-migration.sql
1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy contents of `settings-migration.sql`
4. Paste and **Run**
5. ✅ Wait for success message

### Option B: Manual Setup

If you prefer manual setup:

```sql
-- Add address column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

Then set up storage policies as shown in `settings-migration.sql`.

---

## Step 2: Configure Supabase Storage

### Create Avatars Bucket (If Not Using SQL)
1. Open **Supabase Dashboard**
2. Go to **Storage**
3. Click **New Bucket**
4. Name: `avatars`
5. **Public**: ✅ Yes
6. Click **Create bucket**

### Verify Storage Policies
Check that these policies exist on the `storage.objects` table:
- ✅ "Avatar images are publicly accessible" (SELECT)
- ✅ "Users can upload their own avatar" (INSERT)
- ✅ "Users can update their own avatar" (UPDATE)
- ✅ "Users can delete their own avatar" (DELETE)

---

## Step 3: Deploy Files

### New Files to Deploy:
1. **settings.html** - Complete settings page UI
2. **settings-migration.sql** - Database migration script

### Updated Files to Deploy:
1. **auth.js** - Added avatar upload functions:
   - `uploadAvatar(userId, file)`
   - `getAvatarUrl(path)`
   - `deleteAvatar(userId)`
   
2. **client-dashboard.html** - Added Settings link to sidebar

3. **bookings.html** - Added Settings link to sidebar

4. **supabase-schema.sql** - Updated with address field

---

## Step 4: Test the Features

### Test Profile Picture Upload
1. Login as any user (client or trainer)
2. Navigate to Settings (click Settings in sidebar)
3. Click **Upload New Photo**
4. Select an image file (JPG, PNG, or GIF, max 2MB)
5. **Expected**: Avatar updates immediately with success message
6. Refresh page → **Expected**: Avatar persists

### Test Personal Information Edit
1. In Settings page, update name, email, phone, or address
2. Click **Save Changes**
3. **Expected**: Success message "Settings saved successfully!"
4. Refresh page → **Expected**: Changes persist
5. Go to dashboard → **Expected**: Updated info displays

### Test Trainer Pricing (Trainers Only)
1. Login as a trainer
2. Go to Settings
3. Scroll to **Professional Details**
4. Update pricing plans (labels and prices)
5. Click **Save Changes**
6. **Expected**: Success message
7. Go to trainer profile page → **Expected**: Updated prices display

### Test Error Handling
1. Try uploading a file > 2MB
   - **Expected**: Error "File size must be less than 2MB"
2. Try uploading a non-image file
   - **Expected**: Error "Please upload an image file"
3. Disconnect internet and try to save
   - **Expected**: Error toast with failure message

---

## File Structure

```
Onlifit/
├── settings.html              ← New settings page
├── settings-migration.sql     ← Database migration
├── auth.js                    ← Updated with avatar functions
├── client-dashboard.html      ← Updated with Settings link
├── bookings.html              ← Updated with Settings link
└── supabase-schema.sql        ← Updated with address field
```

---

## How It Works

### Avatar Upload Flow:
1. User selects image → File validated (size, type)
2. File uploaded to Supabase Storage (`avatars/{userId}/{filename}`)
3. Public URL generated
4. `avatar_url` column updated in profiles table
5. Preview updates immediately

### Profile Update Flow:
1. User fills form → Client-side validation
2. Data sent to `updateUserProfile(userId, data)`
3. Profiles table updated in Supabase
4. Success/error message displayed
5. User object refreshed

### Trainer Pricing Flow:
1. Trainer updates plan labels and prices
2. Data structured as JSONB object:
   ```json
   {
     "basic": {"label": "1 Session", "price": 999},
     "standard": {"label": "4 Sessions", "price": 3499},
     "premium": {"label": "Monthly", "price": 9999}
   }
   ```
3. Saved to `plans` column in profiles table
4. Displayed on trainer profile and booking pages

---

## Navigation Updates

### Client Dashboard Sidebar:
```
Dashboard
My Bookings
Find Trainers
Saved Trainers
Settings  ← NEW
```

### Trainer Dashboard Sidebar:
```
Dashboard
Bookings
Messages
Settings  ← NEW
```

Both sidebars now have a direct link to `settings.html`.

---

## Security Features

### Storage Security (RLS):
- ✅ Users can only upload to their own folder (`avatars/{userId}/`)
- ✅ Users can only update/delete their own avatars
- ✅ All avatars are publicly viewable (for profile display)

### Profile Security (RLS):
- ✅ Users can only update their own profile
- ✅ Email updates are restricted (Supabase Auth handles this)
- ✅ All profile data validated before save

---

## Customization Options

### File Size Limit:
Change in `settings.html`:
```javascript
// Line ~292
if (file.size > 2 * 1024 * 1024) { // Current: 2MB
    // Change to 5MB:
    // if (file.size > 5 * 1024 * 1024) {
```

### Allowed File Types:
Change in `settings.html`:
```javascript
// Line ~298
if (!file.type.startsWith('image/')) {
    // To allow specific types:
    // const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    // if (!allowed.includes(file.type)) {
```

### Additional Profile Fields:
Add to `settings.html` form and update in `saveSettings()` function.

---

## Troubleshooting

### Avatar not uploading
**Fix:**
1. Check Supabase Storage → Verify `avatars` bucket exists
2. Check bucket is set to **Public**
3. Verify storage policies are correct
4. Check browser console for errors

### Changes not saving
**Fix:**
1. Check Supabase Dashboard → Logs for errors
2. Verify RLS policies on profiles table
3. Check browser console for errors
4. Ensure user is authenticated

### Avatar not displaying
**Fix:**
1. Check if `avatar_url` is saved in database
2. Verify the URL is accessible (open in new tab)
3. Check CORS settings in Supabase Storage
4. Clear browser cache

### Settings link not appearing
**Fix:**
1. Verify `client-dashboard.html` and `bookings.html` are updated
2. Clear browser cache and hard reload
3. Check that you're logged in

---

## API Reference

### New Functions in auth.js:

#### uploadAvatar(userId, file)
```javascript
// Upload avatar and update profile
const avatarUrl = await uploadAvatar(user.id, fileObject);
```
**Returns:** Public URL string or null on error

#### getAvatarUrl(path)
```javascript
// Get public URL from storage path
const url = await getAvatarUrl('userId/filename.jpg');
```
**Returns:** Public URL string or null

#### deleteAvatar(userId)
```javascript
// Delete all avatars for user
const success = await deleteAvatar(user.id);
```
**Returns:** Boolean (true/false)

#### updateUserProfile(userId, data)
```javascript
// Update profile fields
const result = await updateUserProfile(user.id, {
    name: 'New Name',
    phone: '1234567890',
    address: 'New Address'
});
```
**Returns:** `{success: true}` or `{success: false, error: message}`

---

## Next Steps (Optional Enhancements)

Consider adding:
- 🔐 **Password Change** - Let users update their password
- 🌐 **Social Media Links** - Add Instagram, Facebook, Twitter links
- 📧 **Email Preferences** - Manage notification settings
- 🎨 **Theme Preferences** - Light/dark mode toggle
- 🗑️ **Account Deletion** - Allow users to delete their account
- 📄 **Export Data** - GDPR compliance feature

---

## Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check Supabase Dashboard → Logs
3. Verify all migration steps completed
4. Review storage bucket configuration

All features are production-ready! 🚀
