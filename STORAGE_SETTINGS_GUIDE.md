# 📋 Storage & Settings System Documentation

## Overview
Complete documentation for profile pictures, settings, and certification management in Onlifit.

---

## 🗂️ Storage Architecture

### 1. **Profile Pictures (Avatars)**
- **Bucket**: `avatars` (public)
- **Who**: Both trainers AND clients
- **Location**: `{userId}/avatar-{timestamp}.{ext}`
- **Max Size**: 2MB
- **Formats**: JPG, PNG, GIF
- **Real-time**: ✅ Yes - immediately visible after upload

**How it works:**
1. User uploads photo in settings
2. Saved to Supabase Storage `avatars` bucket
3. Public URL stored in `profiles.avatar_url`
4. Displayed everywhere instantly (nav, dashboard, messages)

---

### 2. **Trainer Certifications**
- **Bucket**: `trainer_certifications` (public, separate from avatars)
- **Who**: Trainers only
- **Location**: `{trainerId}/cert-{timestamp}.{ext}`
- **Max Size**: 5MB
- **Formats**: PDF, JPG, PNG, DOC, DOCX
- **Metadata**: ✅ Stored in database (NO hallucination)

**How it works:**
1. Trainer uploads certification
2. File saved to `trainer_certifications` bucket
3. Metadata saved to `certifications` table:
   - `id`: Unique certification ID
   - `trainer_id`: Links to trainer
   - `trainer_name`: Real trainer name (no fake data)
   - `file_name`: Original filename
   - `file_url`: Public URL
   - `file_type`: PDF, JPG, etc.
   - `file_size`: Bytes
   - `uploaded_at`: Timestamp
   - `verified`: Boolean (admin can verify)
   - `verified_by`: Admin ID who verified
   - `verification_date`: When verified
   - `notes`: Admin notes

**Benefits:**
- ✅ Real data linked to real trainers (no hallucination)
- ✅ Admin verification system
- ✅ File metadata (name, size, type, date)
- ✅ Separate bucket for better organization
- ✅ View/download/delete functionality

---

## ⚙️ Settings System

### Real-time Updates
**YES - All settings are saved in real-time!**

When you click "Save Changes":
1. Data sent to Supabase immediately
2. Database updated
3. Changes reflect everywhere instantly
4. No page refresh needed

---

### Client Settings
Clients can edit:
- ✅ Profile picture
- ✅ Full name
- ✅ Email address
- ✅ Phone number
- ✅ Address
- ✅ Password

---

### Trainer Settings
Trainers can edit everything clients can, PLUS:
- ✅ Specialty (e.g., "Weight Loss, Strength Training")
- ✅ Experience (e.g., "5+ years")
- ✅ About/Bio (describe your training philosophy)
- ✅ **4-Tier Pricing System:**
  - **Hourly Rate** - Per session (e.g., ₹999)
  - **Weekly Package** - 5-7 sessions (e.g., ₹3,499)
  - **Monthly Package** - Unlimited sessions (e.g., ₹9,999)
  - **Transformation** - Long-term program (e.g., ₹25,999 for 3 months)
- ✅ Certification uploads with verification

---

## 🔐 Security (RLS Policies)

### Profile Pictures (avatars bucket)
- ✅ **Anyone** can view (public)
- ✅ **Users** can upload to their own folder only
- ✅ **Users** can delete their own photos only
- ❌ Users cannot access other users' folders

### Certifications (trainer_certifications bucket)
- ✅ **Anyone** can view (for transparency)
- ✅ **Trainers only** can upload
- ✅ **Trainers** can only upload to their own folder
- ✅ **Trainers** can delete their own certifications
- ❌ Trainers cannot access other trainers' folders

### Certifications Database (certifications table)
- ✅ **Anyone** can view (public trust)
- ✅ **Trainers** can insert/update/delete their own
- ✅ **Admins** can update any (for verification)
- ❌ Trainers cannot modify other trainers' certs

---

## 📦 Setup Instructions

### Step 1: Run SQL Migration
```bash
# In Supabase SQL Editor, run:
certification-storage-setup.sql
```

### Step 2: Create Storage Bucket
1. Go to Supabase Dashboard → Storage
2. Click "Create New Bucket"
3. Name: `trainer_certifications`
4. Public: ✅ Yes
5. Click "Create"

### Step 3: Deploy Files
- ✅ `auth.js` (already updated with new functions)
- ✅ `settings.html` (already updated)
- No other changes needed!

---

## 🧪 Testing

### Test Profile Picture Upload
1. Login as trainer or client
2. Go to Settings
3. Click "Upload New Photo"
4. Select image (JPG/PNG, <2MB)
5. ✅ Should upload immediately
6. ✅ Should appear in nav bar instantly
7. ✅ Should appear in dashboard

### Test Trainer Certification Upload
1. Login as trainer
2. Go to Settings
3. Scroll to "Certifications & Credentials"
4. Click upload area or drop files
5. Select PDF/image (<5MB)
6. ✅ Should upload with progress
7. ✅ Should display with:
   - File name
   - Upload date
   - File size
   - File type
   - "Pending Review" badge
   - View button (opens in new tab)
   - Delete button

### Test Settings Save
1. Change any setting (name, phone, pricing, etc.)
2. Click "Save Changes"
3. ✅ "Settings saved successfully!" message
4. Refresh page
5. ✅ Changes should persist

---

## 🎨 UI Features

### Certification Display
Each certification shows:
- 📄 Document icon
- **File name** (e.g., "ACE-CPT-Certificate.pdf")
- **Upload date** (e.g., "Apr 8, 2026")
- **File size** (e.g., "1.2 MB")
- **File type** (e.g., "PDF")
- **Status badge**: 
  - "✓ Verified" (green) - Admin verified
  - "Pending Review" (gray) - Not yet verified
- **Actions**:
  - 👁️ View (opens in new tab)
  - 🗑️ Delete (with confirmation)

---

## 🔍 Data Integrity

### No Hallucination Guarantee
- ✅ **trainer_name** stored when uploading (real name from database)
- ✅ **trainer_id** links to actual trainer profile
- ✅ **uploaded_at** automatic timestamp (not editable)
- ✅ **file_url** points to real file in storage
- ✅ **file_size** and **file_type** from actual file metadata

### Foreign Key Constraints
```sql
-- If trainer is deleted, their certifications are auto-deleted
trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE

-- Verification tracking
verified_by UUID REFERENCES profiles(id)
```

---

## 🚀 Performance

### Optimized Indexes
```sql
-- Fast lookups by trainer
CREATE INDEX idx_certifications_trainer ON certifications(trainer_id);

-- Filter by verification status
CREATE INDEX idx_certifications_verified ON certifications(verified);

-- Sort by upload date
CREATE INDEX idx_certifications_uploaded ON certifications(uploaded_at DESC);
```

---

## 📊 Database Schema

### certifications Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| trainer_id | UUID | Foreign key to profiles |
| trainer_name | TEXT | Trainer's name (no hallucination) |
| file_name | TEXT | Original filename |
| file_url | TEXT | Public URL in storage |
| file_type | TEXT | pdf, jpg, png, doc, docx |
| file_size | BIGINT | File size in bytes |
| uploaded_at | TIMESTAMPTZ | Auto timestamp |
| verified | BOOLEAN | Admin verification flag |
| verification_date | TIMESTAMPTZ | When verified |
| verified_by | UUID | Admin who verified |
| notes | TEXT | Admin notes |

---

## 🛠️ New Functions in auth.js

### `uploadCertification(trainerId, trainerName, file)`
Uploads certification with full metadata tracking.

**Returns:**
```javascript
{ success: true, certification: {id, trainer_name, file_url, ...} }
// or
{ success: false, error: "error message" }
```

### `getTrainerCertifications(trainerId)`
Gets all certifications for a trainer.

**Returns:**
```javascript
[
  {
    id: "uuid",
    trainer_name: "John Doe",
    file_name: "ACE-CPT.pdf",
    file_url: "https://...",
    file_size: 1234567,
    uploaded_at: "2026-04-08T...",
    verified: false,
    ...
  }
]
```

### `deleteCertification(certId, trainerId)`
Deletes certification (file + database record).

**Returns:**
```javascript
{ success: true }
// or
{ success: false, error: "error message" }
```

---

## ✅ What's Complete

- [x] Profile picture upload (trainers + clients)
- [x] Settings page with all fields
- [x] Password change
- [x] 4-tier pricing system
- [x] Certification upload with metadata
- [x] Certification verification system
- [x] Admin can verify certifications
- [x] Real-time database updates
- [x] Separate storage buckets
- [x] No hallucination - real data only
- [x] RLS security policies
- [x] Performance indexes

---

## 🎯 Usage Summary

| Feature | Bucket | Database | Who Can Use |
|---------|--------|----------|-------------|
| Profile Pictures | `avatars` | `profiles.avatar_url` | Trainers + Clients |
| Certifications | `trainer_certifications` | `certifications` table | Trainers only |
| Settings | - | `profiles` | Trainers + Clients |

**Everything updates in real-time!** No refresh needed.
