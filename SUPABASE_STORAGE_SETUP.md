# 🗄️ Supabase Storage Setup for Onlifit

## Purpose
Store trainer KYC documents and certifications securely in Supabase Storage.

---

## 📦 Step 1: Create Storage Bucket

### In Supabase Dashboard:

1. **Navigate to Storage**
   - Go to https://supabase.com/dashboard
   - Select your Onlifit project
   - Click "Storage" in the left sidebar

2. **Create New Bucket**
   - Click "New Bucket"
   - **Bucket Name:** `trainer-documents`
   - **Public bucket:** ❌ NO (keep it private for security)
   - Click "Create bucket"

---

## 🔐 Step 2: Set Storage Policies (Security)

### Policy 1: Allow Trainers to Upload Their Own Documents

```sql
-- Policy Name: Trainers can upload their own documents
-- Allowed operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Trainers can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**What this does:**
- Only authenticated users can upload
- Users can only upload to folders matching their user ID
- Example: User `abc-123` can only upload to `trainer-documents/abc-123/...`

---

### Policy 2: Allow Trainers to Read Their Own Documents

```sql
-- Policy Name: Trainers can view their own documents
-- Allowed operation: SELECT
-- Target roles: authenticated

CREATE POLICY "Trainers can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### Policy 3: Allow Admins to View All Documents (Optional)

```sql
-- Policy Name: Admins can view all documents
-- Allowed operation: SELECT
-- Target roles: authenticated

CREATE POLICY "Admins can view all documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainer-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

---

### Policy 4: Allow Trainers to Update Their Documents

```sql
-- Policy Name: Trainers can update their own documents
-- Allowed operation: UPDATE
-- Target roles: authenticated

CREATE POLICY "Trainers can update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trainer-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 📁 Step 3: File Organization Structure

Files will be organized by trainer ID:

```
trainer-documents/
├── {user_id_1}/
│   ├── kyc/
│   │   ├── id_front.jpg
│   │   └── id_back.jpg
│   └── certificates/
│       ├── cert_ace_fitness.pdf
│       ├── cert_crossfit_l1.jpg
│       └── cert_nutrition.pdf
├── {user_id_2}/
│   ├── kyc/
│   │   ├── id_front.pdf
│   │   └── id_back.pdf
│   └── certificates/
│       └── cert_issa.pdf
...
```

**Path format:**
- KYC Front: `{userId}/kyc/id_front.{ext}`
- KYC Back: `{userId}/kyc/id_back.{ext}`
- Certificates: `{userId}/certificates/{certName}.{ext}`

---

## 🗃️ Step 4: Update Database Schema

Add new columns to `profiles` table:

```sql
-- Add file URL columns
ALTER TABLE profiles
ADD COLUMN kyc_front_url TEXT,
ADD COLUMN kyc_back_url TEXT,
ADD COLUMN kyc_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN certificate_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN certificates_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Add comment for clarity
COMMENT ON COLUMN profiles.certificate_urls IS 'Array of objects: [{name: "ACE Certified", url: "...", verified: false}]';
```

**Schema Details:**
- `kyc_front_url`: Storage URL for front of ID
- `kyc_back_url`: Storage URL for back of ID
- `kyc_verified`: Admin sets to true after verification
- `certificate_urls`: JSON array of certificate objects
- `certificates_verified`: True if all certificates are verified
- `verification_status`: Overall verification status (pending/verified/rejected)

---

## 🔧 Step 5: Helper Functions

### Upload File to Storage (JavaScript)

```javascript
async function uploadDocument(file, userId, category, filename) {
    try {
        const filePath = `${userId}/${category}/${filename}`;
        
        const { data, error } = await supabaseClient.storage
            .from('trainer-documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true // Allow overwriting
            });
        
        if (error) throw error;
        
        // Get public URL (even though bucket is private, this generates signed URLs)
        const { data: urlData } = supabaseClient.storage
            .from('trainer-documents')
            .getPublicUrl(filePath);
        
        return { success: true, path: data.path, url: urlData.publicUrl };
    } catch (error) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
    }
}
```

### Get Signed URL (for viewing private files)

```javascript
async function getSignedUrl(filePath, expiresIn = 3600) {
    const { data, error } = await supabaseClient.storage
        .from('trainer-documents')
        .createSignedUrl(filePath, expiresIn); // Expires in 1 hour
    
    if (error) throw error;
    return data.signedUrl;
}
```

---

## 📋 Step 6: Allowed File Types

### KYC Documents
- **Accepted formats:** JPG, JPEG, PNG, PDF
- **Max size:** 5MB per file
- **Required:** Both front and back

### Certificates
- **Accepted formats:** JPG, JPEG, PNG, PDF
- **Max size:** 5MB per file
- **Optional:** Can add multiple certificates

---

## 🎨 Step 7: Verification Badge System

Add badges to trainer profiles based on verification status:

```javascript
function getVerificationBadge(profile) {
    if (profile.kyc_verified && profile.certificates_verified) {
        return `
            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                ✓ Verified Trainer
            </span>
        `;
    } else if (profile.kyc_verified) {
        return `
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                ✓ ID Verified
            </span>
        `;
    } else {
        return `
            <span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                ⏳ Pending Verification
            </span>
        `;
    }
}
```

---

## 🔍 Step 8: Admin Verification Dashboard (Future)

Create an admin page to:
1. View uploaded KYC documents
2. Verify/reject documents
3. Update verification status
4. Send notifications to trainers

---

## 📊 Complete Flow

```
1. Trainer uploads KYC (front + back) during onboarding
   ↓
2. Files stored in: trainer-documents/{userId}/kyc/
   ↓
3. URLs saved to profiles.kyc_front_url, kyc_back_url
   ↓
4. Admin reviews documents in admin panel
   ↓
5. Admin clicks "Verify" → profiles.kyc_verified = true
   ↓
6. Trainer profile shows "✓ Verified" badge
   ↓
7. Verified trainers get higher visibility in search
```

---

## 🚀 Quick Setup Commands

Run these in Supabase SQL Editor:

```sql
-- 1. Create bucket (do this in UI instead - easier)

-- 2. Add columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kyc_front_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_back_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certificate_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS certificates_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' 
    CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- 3. Add policies (copy from above)
```

---

## ✅ Checklist

Before going live:
- [ ] Create `trainer-documents` bucket in Supabase
- [ ] Add all 4 storage policies
- [ ] Update profiles table schema
- [ ] Test file upload from onboarding form
- [ ] Test file retrieval
- [ ] Verify policies work (users can only access their files)
- [ ] Create admin verification workflow
- [ ] Add verification badges to trainer profiles

---

## 🔐 Security Notes

1. **Never make bucket public** - Use signed URLs for viewing
2. **Validate file types** on client AND server
3. **Limit file sizes** to prevent abuse
4. **Scan for malware** (consider integrating virus scanning)
5. **Regular backups** of storage bucket
6. **Audit logs** for document access

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify Supabase policies are active
3. Check user has correct role in profiles table
4. Ensure bucket name matches exactly: `trainer-documents`
