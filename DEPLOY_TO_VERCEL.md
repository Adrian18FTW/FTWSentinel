# 🚀 Deploy to Vercel - Complete Guide

## Architecture: Private Submodule Approach ✅

```
FTWSentinel-Backend/               (Public or Private)
├── source/
│   └── FTWSentinel/              (Git Submodule → Private Repo)
│       ├── client/
│       ├── server/
│       ├── shared/
│       └── fxmanifest.lua
├── lib/
│   └── obfuscator-wasm/
└── app/
    └── api/
        └── admin/downloads/generate/
```

**Benefits:**
✅ Source code stays in private repo
✅ Automatically pulled during deployment
✅ Version controlled separately
✅ Can be updated independently

---

## 🚦 Pre-Deployment Steps

### Step 1: Upload Source to Private Repo

```powershell
cd "c:\Users\Admin\Desktop\FTWSentinel Update #2\FTWSentinel"

# Initialize git (if not already)
git init

# Add remote (your private repo)
git remote add origin https://github.com/Adrian18FTW/FTWSentinel-src.git

# Add all source files
git add .

# Commit
git commit -m "Initial commit: FTWSentinel unobfuscated source"

# Push to private repo
git push -u origin main
```

### Step 2: Add as Submodule to Backend

```powershell
cd "c:\Users\Admin\Desktop\FTWSentinel Update #2\FTWSentinel - Backend"

# Add private repo as submodule
git submodule add https://github.com/Adrian18FTW/FTWSentinel-src.git source/FTWSentinel

# This creates:
# - source/FTWSentinel/ folder (gitignored content, tracked by submodule)
# - .gitmodules file (tracks submodule reference)

# Commit the submodule reference
git add .gitmodules source/FTWSentinel
git commit -m "Add FTWSentinel source as private submodule"
```

### Step 3: Update Backend Code

✅ Already done! Updated path to: `source/FTWSentinel`

### Step 4: Commit Backend Changes

```powershell
cd "c:\Users\Admin\Desktop\FTWSentinel Update #2\FTWSentinel - Backend"

# Add all new files
git add .
git status  # Review changes

# Commit
git commit -m "Add WASM obfuscator and customer-specific download system

- Add WASM obfuscator (lib/obfuscator-wasm/)
- Add customer fingerprint system (lib/fingerprint.ts)
- Add download generation endpoint (api/admin/downloads/generate/)
- Add validation endpoint (api/sentinel/validate/)
- Add database schema for downloads and security logs
- Add FTWSentinel source as private submodule
- Configure Next.js for WASM support"

# Push to your backend repo
git push origin main
```

---

## 🔐 Configure Vercel for Private Submodule Access

Vercel needs permission to clone your private submodule during build.

### Option A: GitHub Personal Access Token (Recommended)

1. **Generate Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name: `Vercel Deployment`
   - Scopes: Check `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token** (you won't see it again!)

2. **Add to Vercel:**
   - Go to: https://vercel.com/ftws-entinel/ftw-sentinel/settings/environment-variables
   - Add new variable:
     - **Name:** `GIT_CREDENTIALS`
     - **Value:** `https://Adrian18FTW:<YOUR_TOKEN>@github.com`
     - **Environment:** Production, Preview, Development (all)
   - Save

3. **Add Build Command Override (if needed):**
   - Go to: Project Settings → Build & Development Settings
   - **Install Command:** (leave default or set to)
     ```bash
     git submodule update --init --recursive && npm install
     ```

### Option B: Vercel GitHub App Access

1. Go to: https://github.com/Adrian18FTW/FTWSentinel-src/settings/access
2. Invite Vercel's GitHub App
3. Grant read access

---

## 🌐 Environment Variables on Vercel

Ensure these are set in Vercel Dashboard:

**Required Variables:**
- `ADMIN_SECRET` - Your admin authentication secret
- `DATABASE_URL` - Neon Postgres connection string
- `ADMIN_EMAIL` - admin@ftwsentinel.com
- `GIT_CREDENTIALS` - (if using Option A above)

**Optional Variables:**
- `NEXT_PUBLIC_BASE_URL` - Your Vercel domain
- `NOWPAYMENTS_API_KEY` - Payment gateway key
- `NOWPAYMENTS_IPN_SECRET` - Payment IPN secret

---

## 🚀 Deploy to Vercel

### Method 1: Git Push (Automatic)

```powershell
# Already done in Step 4 above
git push origin main

# Vercel will automatically:
# 1. Clone backend repo
# 2. Clone submodule (FTWSentinel-src)
# 3. Build Next.js with WASM
# 4. Deploy to production
```

### Method 2: Vercel CLI (Manual)

```powershell
cd "c:\Users\Admin\Desktop\FTWSentinel Update #2\FTWSentinel - Backend"

# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

### Method 3: Vercel Dashboard

1. Go to: https://vercel.com/ftws-entinel/ftw-sentinel
2. Click "Deployments" tab
3. Click "Redeploy" on latest deployment

---

## ✅ Post-Deployment Verification

### 1. Check Build Logs

Look for:
```
✓ Cloning submodules
✓ Installing dependencies
✓ Building application
✓ Generating build assets
```

### 2. Test WASM Obfuscator

```powershell
# Test endpoint (should return test results)
curl https://your-domain.vercel.app/api/test/obfuscator
```

Expected response:
```json
{
  "success": true,
  "tests": {
    "version": { "result": "2.0.0", "passed": true },
    "singleFileBasic": { "passed": true },
    "singleFileEncrypted": { "hasMarker": true, "passed": true },
    "batchObfuscation": { "passed": true },
    "errorHandling": { "passed": true }
  },
  "summary": { "allTestsPassed": true }
}
```

### 3. Test Admin Download

```powershell
# Get your ADMIN_SECRET from Vercel env vars
$adminSecret = "your-admin-secret-here"

# Generate download
curl -X POST https://your-domain.vercel.app/api/admin/downloads/generate `
  -H "x-admin-secret: $adminSecret" `
  -o FTWSentinel-Admin.zip
```

Expected:
- HTTP 200
- ZIP file downloaded
- Contains obfuscated Lua files
- Files contain validation markers

### 4. Verify Database Logging

Check your Neon database:
```sql
-- Check downloads table
SELECT * FROM downloads ORDER BY created_at DESC LIMIT 5;

-- Check security logs
SELECT * FROM security_logs ORDER BY timestamp DESC LIMIT 10;
```

---

## 🐛 Troubleshooting

### Issue: "Submodule not found" during build

**Solution:** Check GIT_CREDENTIALS is set correctly
```powershell
# Verify format
https://USERNAME:TOKEN@github.com
```

### Issue: "WASM module not found"

**Solution:** Ensure lib/obfuscator-wasm/ is committed
```powershell
git add lib/obfuscator-wasm/
git commit -m "Add WASM module"
git push
```

### Issue: "Source files not found"

**Solution:** Verify submodule is initialized
```powershell
git submodule update --init --recursive
```

### Issue: Build timeout

**Solution:** Increase build timeout in Vercel settings (Pro plan)

---

## 📊 Expected Performance

| Metric | Value |
|--------|-------|
| Build time | 2-4 minutes |
| Cold start (API) | 500ms - 1s |
| Obfuscation time | 2-5 seconds |
| ZIP generation | 500ms |
| Total download time | 3-6 seconds |

---

## 🔄 Updating Source Code

When you update FTWSentinel source:

```powershell
# In FTWSentinel repo
cd "c:\Users\Admin\Desktop\FTWSentinel Update #2\FTWSentinel"
git add .
git commit -m "Update source code"
git push

# In Backend repo (update submodule reference)
cd "c:\Users\Admin\Desktop\FTWSentinel Update #2\FTWSentinel - Backend"
cd source/FTWSentinel
git pull origin main
cd ../..
git add source/FTWSentinel
git commit -m "Update FTWSentinel source to latest"
git push

# Vercel will automatically redeploy
```

---

## 🎯 Next Steps After Deployment

1. ✅ Test download generation
2. ✅ Verify obfuscation works
3. ✅ Check database logging
4. ⏳ Implement runtime validation (Task #8)
5. ⏳ Test end-to-end flow
6. ⏳ Add customer purchase flow
7. ⏳ Set up monitoring/alerts

---

## 🆘 Support

If deployment fails:
1. Check Vercel build logs
2. Verify all environment variables are set
3. Test WASM locally: `node test-wasm.mjs`
4. Check submodule access: `git submodule update --init`

---

**Ready to deploy!** 🚀
