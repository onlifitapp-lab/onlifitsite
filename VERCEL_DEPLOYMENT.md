# 🚀 Deploy Onlifit to Vercel with Custom Domain

## Step-by-Step Guide for Fresh Deployment

---

## PART 1: Push Updated Code to GitHub

### Step 1: Open Command Prompt / Git Bash

1. Press **Windows Key + R**
2. Type: `cmd` and press Enter
3. Navigate to project:
   ```bash
   cd "C:\Users\Garima Singh\Downloads\Onlifit"
   ```

---

### Step 2: Stage and Commit All Changes

```bash
# Check what's changed
git status

# Add all changes
git add .

# Commit with a message
git commit -m "feat: complete redesign with Google OAuth, trainer signup fixes, and performance optimizations"

# Push to GitHub (this will REPLACE old files)
git push origin main
```

**If it says `main` doesn't exist, try:**
```bash
git push origin master
```

**If it asks for credentials:**
- Use your GitHub username
- For password, use a **Personal Access Token** (not your actual password)
- Or use GitHub Desktop for easier push

---

## PART 2: Deploy to Vercel

### Step 3: Go to Vercel Dashboard

1. Open: **https://vercel.com/dashboard**
2. Sign in with GitHub

---

### Step 4: Option A - If Project Already Exists on Vercel

If you see your Onlifit project in the dashboard:

1. Click on the **Onlifit project**
2. Go to **Deployments** tab
3. Click **Redeploy** button
4. Select **"Use existing Build Cache"** → **OFF** (for fresh build)
5. Click **Redeploy**
6. Wait for deployment to complete (~1-2 minutes)

---

### Step 4: Option B - If Creating New Project

If you need to create fresh:

1. Click **"Add New..."** → **"Project"**
2. Click **"Import"** next to your Onlifit repository
3. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** Leave empty (static site)
   - **Output Directory:** Leave empty
4. Click **"Deploy"**
5. Wait for deployment (~1-2 minutes)

---

## PART 3: Connect Custom Domain (onlifit.in)

### Step 5: Add Domain in Vercel

1. In your Onlifit project on Vercel, go to **Settings** tab
2. Click **"Domains"** in the left sidebar
3. In the "Add Domain" field, type: `onlifit.in`
4. Click **"Add"**
5. Also add: `www.onlifit.in`
6. Click **"Add"**

---

### Step 6: Configure DNS (Your Domain Registrar)

Vercel will show you DNS records to add. You need to add these in your domain registrar (where you bought onlifit.in - GoDaddy, Namecheap, etc.)

**Option A: Using A Records (Recommended)**

Go to your domain registrar's DNS settings and add:

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

```
Type: A
Name: www
Value: 76.76.21.21
TTL: 3600
```

**Option B: Using CNAME (Alternative)**

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

---

### Step 7: Wait for DNS Propagation

1. DNS changes take 5 minutes to 48 hours (usually 10-30 minutes)
2. Vercel will automatically detect when DNS is configured
3. Vercel will auto-issue SSL certificate (HTTPS)
4. You'll see a green checkmark when ready ✅

---

## PART 4: Update Supabase URLs

### Step 8: Update Redirect URLs in Supabase

Since your domain changed from Netlify to Vercel:

1. Go to **Supabase Dashboard**
2. Navigate to **Authentication → URL Configuration**
3. Update **Site URL** to: `https://onlifit.in`
4. Update **Redirect URLs** to include:
   - `https://onlifit.in/**`
   - `https://www.onlifit.in/**`
   - `https://lnbsgnfrhewdqhuqqotx.supabase.co/**`
5. Click **Save**

---

### Step 9: Update Google OAuth URLs

1. Go to **Google Cloud Console**
2. Navigate to **APIs & Services → Credentials**
3. Click on your OAuth client (Onlifit Web Client)
4. Under **Authorized JavaScript origins**, make sure these are added:
   - `https://onlifit.in`
   - `https://www.onlifit.in`
5. Under **Authorized redirect URIs**, make sure this is still there:
   - `https://lnbsgnfrhewdqhuqqotx.supabase.co/auth/v1/callback`
6. Click **Save**

---

## ✅ Verification Checklist

After deployment:

- [ ] Visit https://onlifit.in (should load your site)
- [ ] Check HTTPS is working (green padlock in browser)
- [ ] Test signup with email (should work)
- [ ] Test signup with Google (should work)
- [ ] Test login (should work)
- [ ] Test client dashboard
- [ ] Test trainer signup from join-us.html
- [ ] Check all pages load correctly

---

## 🔧 Vercel Environment Variables (If Needed)

If you have any API keys or secrets (you don't currently), you can add them:

1. Vercel Dashboard → Your Project → **Settings**
2. Click **Environment Variables**
3. Add variables (key-value pairs)
4. Click **Save**
5. Redeploy project to apply

---

## 🚨 Common Issues

### Issue: "Domain not verified"
**Solution:** Check DNS settings in your domain registrar. Make sure you added the A records correctly.

### Issue: "SSL certificate not issued"
**Solution:** Wait 10-30 minutes after DNS propagation. Vercel auto-issues certificates.

### Issue: "Site not updating"
**Solution:** 
1. Clear browser cache
2. Try incognito mode
3. Check if GitHub has latest code
4. Redeploy on Vercel

### Issue: "Google OAuth redirect error"
**Solution:** Make sure you updated Google Cloud Console authorized origins to include onlifit.in

---

## 📊 Expected Timeline

| Step | Time |
|------|------|
| Push to GitHub | 1 minute |
| Vercel deployment | 1-2 minutes |
| DNS propagation | 10-30 minutes |
| SSL certificate | Automatic after DNS |
| Total | 15-35 minutes |

---

## 🎯 Quick Commands Summary

```bash
# Navigate to project
cd "C:\Users\Garima Singh\Downloads\Onlifit"

# Check status
git status

# Stage all changes
git add .

# Commit
git commit -m "Fresh deployment: Google OAuth, trainer fixes, optimizations"

# Push to GitHub
git push origin main

# Then go to Vercel dashboard and redeploy!
```

---

## 💡 Pro Tips

1. **Always push to GitHub first** before deploying to Vercel
2. **Use Vercel's automatic deployments** - every GitHub push = auto deploy
3. **Check deployment logs** if something fails (Vercel → Deployments → View Logs)
4. **Use Vercel preview deployments** for testing before going live
5. **Set up www redirect** to main domain (Vercel does this automatically)

---

## Need Help?

If you get stuck at any step, let me know:
- What error message you see
- Which step you're on
- Screenshot if possible

I'll help you debug! 🚀
