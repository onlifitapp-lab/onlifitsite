# Admin Panel - Phase 1 Complete Guide

## 🎯 Overview
The Onlifit Admin Dashboard is a unified platform for managing all aspects of the Onlifit business. Phase 1 includes core features for trainer management, verification, revenue tracking, and bookings.

---

## 🚀 Quick Start

### 1. Setup Admin User
Before accessing the admin dashboard, you need at least one admin user in your database:

```sql
-- Run in Supabase SQL Editor
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

### 2. Access the Dashboard
1. Go to `login.html` and log in with your admin credentials
2. The system will detect your admin role and redirect you to `admin-dashboard.html`
3. If you try to access directly without being an admin, you'll be redirected away

---

## 📊 Features Overview

### Dashboard Tab
**What it shows:**
- Total trainers (with pending verification count)
- Total clients
- Total bookings (with upcoming count)
- Total revenue
- Recent trainer registrations

**Data sources:**
- `profiles` table (trainers and clients)
- `bookings` table (bookings and revenue)

### Trainers Tab
**Key Features:**
- View all trainers in a searchable table
- Filter trainers in real-time
- See verification status at a glance
- Click "View Details" to open verification modal

**Verification Modal:**
- View trainer profile information
- Preview KYC documents (front and back of ID)
- Preview all certifications
- Approve or reject KYC documents
- Approve or reject certificates
- Overall verification status updates automatically
- View the trainer’s public profile (opens in the same tab)
- Permanently delete a trainer (requires admin login and server-side API)

**Permanent Delete Notes:**
- Implemented via `api/delete-trainer.js` (Vercel API route)
- Requires `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
- Deletes dependent records (bookings/messages/etc.) first, then deletes the profile and auth user

**Verification Workflow:**
1. Trainer uploads documents during onboarding
2. Admin reviews documents in modal
3. Admin approves/rejects KYC
4. Admin approves/rejects certificates
5. If both approved → status changes to "verified"
6. If either rejected → status changes to "rejected"

### Revenue Tab
**What it shows:**
- All transactions from completed bookings
- Total revenue summary
- Searchable and exportable data

**Note:** Revenue data comes from the `bookings` table. If you haven't set up bookings/payments yet, this will show a "coming soon" message.

### Bookings Tab
**What it shows:**
- All bookings (upcoming, completed, cancelled)
- Booking details (date, time, client, trainer, amount)
- Searchable table

**Note:** Like revenue, this requires the `bookings` table to exist.

---

## 📁 Export Functionality

### Excel Export (CSV)
- Click "Export Excel" button on any tab
- Downloads a CSV file with all current data
- Opens in Excel, Google Sheets, etc.
- Use for data analysis and reporting

### PDF Export
- Click "Export PDF" button on any tab
- Generates a formatted PDF report
- Includes headers, totals, and timestamp
- Professional format for stakeholders

**Available Exports:**
- ✅ Trainers list with verification status
- ✅ Revenue transactions with totals
- ✅ Bookings with all details

---

## 🔒 Security & Access Control

### Authentication
- The dashboard can open in **Preview mode** without forcing a redirect/login
- Admin actions (approve/reject/delete/etc.) require a real admin session (`profiles.role = 'admin'`)
- Authentication check runs on page load to enable/disable admin actions

### RLS Policies
All data queries use Supabase Row Level Security:
- Admins can view all trainer documents
- Admins can update verification status
- Regular users cannot access admin functions

### Policies Already Set Up
✅ Admin can view all documents in `trainer-documents` bucket
✅ Admin can update `verification_status`, `kyc_verified`, `certificates_verified`

---

## 📋 Testing Checklist

### Before Testing
- [ ] Run `setup-trainer-storage.sql` in Supabase
- [ ] Create at least one admin user (see Quick Start)
- [ ] Have at least one trainer account with uploaded documents
- [ ] Log in as admin

### Dashboard Tab
- [ ] Statistics cards show correct numbers
- [ ] Recent activity table displays trainers
- [ ] Numbers update when data changes

### Trainers Tab
- [ ] Trainers table loads with all trainers
- [ ] Search bar filters trainers correctly
- [ ] Verification badges show correct status
- [ ] "View Details" button opens modal

### Verification Modal
- [ ] Trainer profile information displays
- [ ] KYC images load and can be clicked to view full size
- [ ] Certificates list displays correctly
- [ ] "Approve KYC" button works
- [ ] "Reject KYC" button works
- [ ] "Approve Certificates" button works
- [ ] "Reject Certificates" button works
- [ ] Overall status updates after approval
- [ ] Modal closes after action
- [ ] Changes reflect in trainers table

### Revenue Tab
- [ ] Displays revenue data if bookings exist
- [ ] Shows "coming soon" message if no bookings
- [ ] Search works correctly
- [ ] Total revenue calculates correctly

### Bookings Tab
- [ ] Displays bookings if they exist
- [ ] Shows "coming soon" message if no bookings
- [ ] Search works correctly
- [ ] Status badges display correctly

### Export Functions
- [ ] Export Trainers to Excel downloads CSV
- [ ] Export Trainers to PDF generates PDF
- [ ] Export Revenue to Excel works
- [ ] Export Revenue to PDF works
- [ ] Export Bookings to Excel works
- [ ] Export Bookings to PDF works

### Security
- [ ] Non-admin users cannot access dashboard
- [ ] Logged out users redirect to login
- [ ] Admin can only see their allowed data
- [ ] Logout button works correctly

---

## 🛠️ Troubleshooting

### "Access Denied" Error
**Problem:** Getting redirected even though you're an admin
**Solution:** 
```sql
-- Verify your role in Supabase
SELECT id, email, role FROM profiles WHERE email = 'your-email@example.com';

-- If role is not 'admin', update it:
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Dashboard Shows Zero for Everything
**Problem:** All statistics show 0
**Solution:** 
- Check if you have any trainers/clients in the database
- Verify the `profiles` table has data
- Check browser console for errors

### "Error Loading Trainers"
**Problem:** Trainers tab shows error
**Solution:**
- Verify `profiles` table exists
- Check RLS policies are set up
- Ensure admin user has proper permissions
- Check browser console for specific error

### KYC/Certificate Images Not Loading
**Problem:** Images show placeholder or broken
**Solution:**
- Verify Supabase Storage bucket exists: `trainer-documents`
- Check RLS policies allow admin to view files
- Verify URLs in database are correct
- Test accessing URL directly in browser

### "No Revenue Data" / "No Bookings"
**Problem:** Revenue and Bookings tabs show empty state
**Solution:** This is EXPECTED if you haven't built the booking system yet. These tabs will populate once:
- `bookings` table is created
- Clients start booking trainers
- Payment integration is complete

### Export Not Working
**Problem:** Export buttons don't download files
**Solution:**
- Check browser console for errors
- Verify jsPDF and autoTable libraries are loaded
- Check if data exists to export
- Try different browser

---

## 🗂️ Database Schema Reference

### Required Tables

**profiles** (already exists)
```sql
- id (UUID)
- email (TEXT)
- role (TEXT) -- 'admin', 'trainer', 'client'
- name (TEXT)
- phone (TEXT)
- specialization (TEXT)
- kyc_front_url (TEXT)
- kyc_back_url (TEXT)
- kyc_verified (BOOLEAN)
- certificate_urls (JSONB)
- certificates_verified (BOOLEAN)
- verification_status (TEXT) -- 'pending', 'verified', 'rejected'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**bookings** (optional for Phase 1, needed for revenue/bookings features)
```sql
- id (UUID)
- client_id (UUID) -- references profiles(id)
- trainer_id (UUID) -- references profiles(id)
- booking_date (DATE)
- booking_time (TIME)
- booking_type (TEXT)
- amount (NUMERIC)
- status (TEXT) -- 'upcoming', 'completed', 'cancelled'
- created_at (TIMESTAMP)
```

---

## 🔮 Coming in Phase 2

Features marked as "Coming Soon" in the dashboard:
- 🧑‍💼 **Clients Management** - View and manage client accounts
- 📋 **Plans Management** - Create and manage subscription/booking plans
- 💬 **Support Management** - Handle customer support tickets

These will be added as additional tabs in the same unified dashboard.

---

## 🎨 Customization

### Changing Colors
The admin panel uses a purple gradient. To customize:

```css
/* Sidebar gradient */
.sidebar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Primary button color */
.btn-primary {
    background: #667eea;
}
```

### Adding More Stats
To add a new stat card to the dashboard:

```html
<div class="stat-card">
    <h3>Your Metric</h3>
    <div class="value" id="stat-your-metric">0</div>
    <div class="change">↑ Change indicator</div>
</div>
```

Then update the `loadDashboard()` function to fetch and display the data.

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify Supabase connection in `supabase-client.js`
3. Ensure all SQL scripts have been run
4. Check RLS policies in Supabase dashboard
5. Review this guide's troubleshooting section

---

## ✅ Success Criteria

Your admin panel is working correctly when:
- ✅ Admin can log in and access dashboard
- ✅ Statistics display accurate numbers
- ✅ Trainers table shows all trainers
- ✅ Verification modal displays documents
- ✅ Approve/reject actions update database
- ✅ Export functions generate files
- ✅ Non-admins cannot access the page

---

## 🎉 What's Next?

With Phase 1 complete, you now have:
- ✅ Full admin authentication
- ✅ Trainer management and verification
- ✅ Revenue and bookings tracking (ready for data)
- ✅ Professional export capabilities
- ✅ Unified dashboard architecture

**Recommended Next Steps:**
1. Test the trainer onboarding flow end-to-end
2. Create a few test trainers with documents
3. Practice the verification workflow
4. Set up the bookings system (Phase 2 prep)
5. Design the payment integration

**Phase 2 Planning:**
- Clients management tab
- Booking system with calendar
- Payment gateway integration
- Email notifications for verification
- Advanced analytics and charts
