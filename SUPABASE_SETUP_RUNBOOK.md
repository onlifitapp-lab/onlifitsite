# Supabase Production Setup - Step-by-Step Runbook

**Date**: May 13, 2026  
**Status**: Ready to deploy  
**Time to complete**: ~15 minutes

---

## Prerequisites
- You have a Supabase project created
- You have access to the Supabase SQL Editor
- All app code has been deployed to Vercel or your hosting platform

---

## Step 1: Core Schema (5 min)

Go to **Supabase Dashboard → SQL Editor** and paste the entire content of:
**[supabase-schema.sql](supabase-schema.sql)**

Click **Run** and wait for success. This creates:
- ✅ profiles table
- ✅ bookings table
- ✅ messages table
- ✅ typing_status table
- ✅ notifications table
- ✅ reviews table
- ✅ RLS policies for all tables
- ✅ Realtime publication for messages, bookings, notifications, typing_status

**Expected output**: No errors. If you get duplicate policy errors, that's expected on reruns—just continue.

---

## Step 2: Support Tickets & Attachments (3 min)

Paste the entire content of:
**[SUPPORT_TICKETS_SCHEMA.sql](SUPPORT_TICKETS_SCHEMA.sql)**

Click **Run**. This creates:
- ✅ support_tickets table
- ✅ ticket_messages table
- ✅ ticket_attachments table
- ✅ ticket_attachments storage bucket (private)
- ✅ RLS policies for ticket attachments (user-scoped access)
- ✅ Realtime publication for tickets_realtime

**Expected output**: No errors.

---

## Step 3: Avatar & Trainer Certificate Storage (2 min)

Paste the entire content of:
**[FINAL_STORAGE_SETUP.sql](FINAL_STORAGE_SETUP.sql)**

Click **Run**. This creates:
- ✅ avatars storage bucket (public)
- ✅ trainer_certifications storage bucket (public)
- ✅ RLS policies for both buckets (user-scoped uploads, public reads)

**Expected output**: No errors.

---

## Step 4: Trainer Document Storage (2 min)

Paste the entire content of:
**[setup-trainer-storage.sql](setup-trainer-storage.sql)**

Click **Run**. This creates:
- ✅ trainer-documents storage bucket (private)
- ✅ Profile columns for KYC verification (kyc_front_url, kyc_back_url, kyc_verified, certificate_urls, verification_status)
- ✅ RLS policies for trainer documents (trainer-scoped uploads, admin read access)

**Expected output**: No errors. If you see "column already exists", that's fine—continue.

---

## Step 5 (Optional): Admin Panel Tables

If you plan to use the admin dashboard with subscriptions, promo codes, and advanced notifications, paste:
**[phase2-admin-schema.sql](phase2-admin-schema.sql)**

Click **Run**. This adds optional admin features.

**Expected output**: No errors.

---

## Verification Checklist

After all scripts have run, verify in the Supabase Dashboard:

### Tables
- [ ] profiles
- [ ] bookings
- [ ] messages
- [ ] typing_status
- [ ] notifications
- [ ] reviews
- [ ] support_tickets
- [ ] ticket_messages
- [ ] ticket_attachments
- [ ] user_activity_log (if Phase 2 ran)

### Storage Buckets
- [ ] avatars (public)
- [ ] trainer_certifications (public)
- [ ] trainer-documents (private)
- [ ] ticket_attachments (private)

### RLS Policies
- [ ] All tables show "Row Level Security: ON"
- [ ] Each table has at least 2 policies (e.g., "Public read", "User-scoped access")

### Real-time Publications
- [ ] supabase_realtime (for messages, bookings, notifications, typing_status)
- [ ] tickets_realtime (for support_tickets, ticket_messages)

---

## Post-Deployment Test Flow

Once Supabase is configured:

1. **Client Signup**
   - Open app → Sign up with email
   - Verify profile created in `profiles` table
   - Check role defaults to 'client'

2. **Trainer Join Us Flow**
   - Click "Join Us" → "Start Application" → Sign up with Google
   - Complete onboarding form
   - Verify profile role = 'trainer' in database
   - Check KYC URLs stored in kyc_front_url, kyc_back_url

3. **Booking Creation**
   - As client, search trainers → Book a session
   - Verify booking record created in `bookings` table
   - Check notification created in `notifications` table

4. **Messaging**
   - Send message to trainer
   - Verify message row created in `messages` table
   - Check typing status updates in real-time

5. **Support Ticket**
   - Create support ticket with attachment
   - Verify ticket in `support_tickets` table
   - Verify file uploaded to `ticket_attachments` bucket
   - Check file accessible via signed URL only to ticket owner

6. **Logout & Re-login**
   - Logout (should clear localStorage)
   - Login again as same user
   - Verify no profile duplication in database

---

## Common Issues & Fixes

### Issue: "Relation 'public.profiles' already exists"
**Solution**: This is expected on reruns. The scripts use `CREATE TABLE IF NOT EXISTS`, so they skip existing tables. Just click Run again or continue to the next script.

### Issue: "Policy 'Users can update own profile' already exists"
**Solution**: Expected. The scripts drop and recreate policies. Click Run again and it will proceed.

### Issue: "Bucket 'avatars' already exists"
**Solution**: Expected. The `ON CONFLICT (id) DO NOTHING` clause handles this. Continue to the next step.

### Issue: RLS Policies not showing in Dashboard
**Solution**: Refresh the Supabase browser tab. RLS policies sometimes take 2-3 seconds to appear after creation.

### Issue: Storage bucket created but policies not applied
**Solution**: If a bucket exists but has no policies, the script was interrupted. Copy the storage policy section from the SQL file and run only that part.

### Issue: "user_id column does not exist in support_tickets"
**Solution**: This means the script ran but hit an error. Check the support_tickets table exists. If not, paste [SUPPORT_TICKETS_SCHEMA.sql](SUPPORT_TICKETS_SCHEMA.sql) again.

---

## Database Constraints & Integrity

All tables enforce referential integrity:
- Bookings reference valid profiles (client and trainer must exist)
- Messages reference valid profiles
- Notifications reference valid profiles
- Reviews reference valid profiles (trainer and client)
- Support tickets reference profiles

**Important**: If you delete a user profile, all related bookings, messages, etc. are automatically cascaded deleted (by `ON DELETE CASCADE`). This is intentional for GDPR compliance.

---

## Next Steps After Setup

1. ✅ Deploy the app code to Vercel (if not already done)
2. ✅ Set environment variables in Vercel (Supabase URL, anon key, service role key)
3. ✅ Test the full trainer signup flow on staging
4. ✅ Monitor real-time message delivery in the app
5. ✅ Create test admin user and verify admin policies work
6. ✅ Load test with concurrent users before going live

---

## Rollback Plan

If you need to remove everything and start fresh:

```sql
-- Drop all tables (this cascades to dependent data)
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_activity_log CASCADE;
DROP TABLE IF EXISTS promo_code_usage CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS typing_status CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop publications
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
DROP PUBLICATION IF EXISTS tickets_realtime CASCADE;

-- Drop storage buckets
DELETE FROM storage.buckets WHERE id IN ('avatars', 'trainer_certifications', 'trainer-documents', 'ticket_attachments');
```

Then re-run all SQL scripts from Step 1.

---

## Support

If you encounter issues during setup:

1. Check the SQL error message in Supabase (copy the full text)
2. Verify the table or bucket doesn't already exist with that exact name
3. Confirm all prerequisites are met (Supabase project active, correct role on auth user)
4. Try running a single statement at a time to isolate the error
5. Check the [PRODUCTION_AUDIT_REPORT.md](PRODUCTION_AUDIT_REPORT.md) for deployment context

---

**Status**: Ready to deploy ✅  
**Last Updated**: May 13, 2026  
**Owner**: DevOps Team
