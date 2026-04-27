# Admin User Deletion Guide

## Overview

The admin dashboard now includes the ability to permanently delete user accounts (both trainers and clients) from the system. When a user is deleted, they are completely removed from the database and will need to create a fresh account to login again.

## Setup Instructions

### Step 1: Run the SQL Migration

Before you can delete users through the admin dashboard, you must first enable the RLS (Row Level Security) policies that allow admin deletion.

1. Go to your **Supabase Project Dashboard**
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `ADMIN_DELETE_USERS.sql` file
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration

**Expected Result:** The system should execute successfully with no errors. You'll see messages about dropping and creating policies.

### Step 2: Verify the Policies Were Created

To confirm the deletion policies are active:

1. In Supabase SQL Editor, run this query:

```sql
SELECT 
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('profiles', 'bookings', 'messages', 'notifications', 'reviews', 'typing_status')
  AND policyname LIKE '%admin%'
  AND policyname LIKE '%delete%'
ORDER BY tablename;
```

2. You should see 6 results:
   - `Admins can delete profiles` - profiles table
   - `Admins can delete bookings` - bookings table
   - `Admins can delete messages` - messages table
   - `Admins can delete notifications` - notifications table
   - `Admins can delete reviews` - reviews table
   - `Admins can delete typing status` - typing_status table

If you see these 6 policies, the setup is complete! ✅

## How to Delete a User

### Deleting a Trainer

1. **Login to Admin Dashboard**
   - Go to your Onlifit admin dashboard
   - Make sure you're logged in as an admin

2. **Navigate to Trainers Tab**
   - Click "Trainers" in the left sidebar
   - Find the trainer you want to delete (use search if needed)

3. **Open Trainer Details**
   - Click "View Details" button next to the trainer

4. **Delete the Trainer**
   - At the bottom of the modal, click **"Permanently Delete Trainer"**
   - A prompt will appear asking for confirmation
   - Type **exactly: `DELETE TRAINER`** (case-sensitive)
   - Click OK

5. **Confirmation**
   - You'll see a success message: "✅ Trainer account permanently deleted"
   - The trainer list will automatically refresh
   - The trainer is now completely removed from the system

### Deleting a Client

1. **Login to Admin Dashboard**
   - Go to your Onlifit admin dashboard
   - Make sure you're logged in as an admin

2. **Navigate to Clients Tab**
   - Click "Clients" in the left sidebar
   - Find the client you want to delete (use search/filters if needed)

3. **Open Client Details**
   - Click "View Details" button next to the client

4. **Delete the Client**
   - At the bottom of the modal, click **"Permanently Delete Client"**
   - A prompt will appear asking for confirmation
   - Type **exactly: `DELETE CLIENT`** (case-sensitive)
   - Click OK

5. **Confirmation**
   - You'll see a success message: "✅ Client account permanently deleted"
   - The client list will automatically refresh
   - The client is now completely removed from the system

## What Gets Deleted

When an admin deletes a user account, the following data is permanently removed:

### For Both Trainers and Clients:
- ✅ **Profile Record** - User profile data (name, email, phone, bio, avatar, etc.)
- ✅ **All Bookings** - Any bookings they created or were part of
- ✅ **All Messages** - All messages they sent and received
- ✅ **All Notifications** - Notifications sent to or about them
- ✅ **Typing Status Records** - Real-time chat status data
- ✅ **Reviews** - Any reviews they authored

### For Trainers Specifically:
- ✅ **Certification Records** - Their uploaded certifications
- ✅ **KYC Documents** - ID verification documents
- ✅ **Service Hours Data** - Booking history and availability

### For Clients Specifically:
- ✅ **Booking History** - All past and future bookings
- ✅ **Payment Records** - Associated with their bookings

## Important Notes

⚠️ **This action cannot be undone!** Once a user is deleted, all their data is permanently removed from the database.

### Before Deleting:

1. **Consider Exporting Data** - If you want to keep records for compliance/auditing, export the user data to Excel or PDF before deleting
2. **Notify the User** - You may want to inform the user before deleting their account
3. **Verify the Right User** - Always double-check you're deleting the correct person
4. **Admin Accounts** - You cannot delete your own admin account (good safety measure!)

### After Deletion:

- The user's profile will no longer appear in the Trainers or Clients lists
- If they try to login, they'll see a login form instead of "account exists" message
- They can create a fresh account with the same email address if desired
- They will start with a completely new profile (no history)

## Troubleshooting

### "Error deleting [user]: Table chats not found"
- **Solution**: This is a harmless warning. The system attempts to delete chats, but that table may not exist in your setup.

### "Error deleting [user]: Permission denied"
- **Solution**: 
  1. Verify your account has the 'admin' role (check in Clients/Trainers tab)
  2. Make sure you ran the ADMIN_DELETE_USERS.sql migration
  3. Try logging out and back in to refresh your session

### "Deletion successful but user still appears in list"
- **Solution**: 
  1. Manually refresh the page (Ctrl+R or Cmd+R)
  2. Click on another tab and back to the Trainers/Clients tab
  3. Check your browser cache is cleared

### "Confirmation dialog keeps appearing"
- **Solution**: Make sure you type **exactly** `DELETE TRAINER` or `DELETE CLIENT` (case-sensitive, with spaces)

## Security Best Practices

1. **Admins Only** - Only admin accounts can delete users
2. **No Self-Deletion** - You cannot delete your own admin account
3. **Confirmation Required** - System asks for explicit confirmation with typed phrase
4. **Audit Logging** - All deletions are logged in your browser console (check Developer Tools)
5. **Database RLS** - Supabase RLS policies enforce admin-only deletion at the database level

## Examples

### Example 1: Delete Banned Trainer
```
Admin: Finds trainer "John Smith" who violated terms
Admin: Clicks "View Details"
Admin: Sees delete button at bottom
Admin: Clicks "Permanently Delete Trainer"
Prompt: "Type DELETE TRAINER to confirm:"
Admin: Types: DELETE TRAINER
System: ✅ Trainer account permanently deleted
Result: John's profile, bookings, messages - all gone
```

### Example 2: Delete Suspended Client Account
```
Admin: Finds client "Sarah Johnson" with suspended account
Admin: Clicks "View Details"
Admin: Sees delete button at bottom
Admin: Clicks "Permanently Delete Client"
Prompt: "Type DELETE CLIENT to confirm:"
Admin: Types: DELETE CLIENT
System: ✅ Client account permanently deleted
Result: Sarah can now create a new account with same email
```

## Related Actions

### Instead of Deleting:

If you just want to **temporarily disable** an account, consider:
- **Suspending**: Change account status to "suspended" (can be reactivated)
- **Banning**: Set a flag to prevent login (data preserved)
- **Warning**: Send a notification and give user a chance to comply

These are gentler alternatives to permanent deletion and preserve audit trails.

## Questions or Issues?

If you encounter problems with user deletion:
1. Check the browser console (F12 → Console tab) for error messages
2. Verify the ADMIN_DELETE_USERS.sql migration was run successfully
3. Ensure your admin account has the correct role
4. Contact your Supabase support if database errors persist

---

**Version**: 1.0  
**Last Updated**: April 26, 2026  
**Feature**: Admin User Deletion System
