# Testing Sentinel Validate Endpoint

## Issue
The `/api/sentinel/validate` endpoint was returning 404 on Vercel.

## Root Cause
The route file had a dynamic import inside the POST handler:
```typescript
const { sql } = await import('@/lib/db');
```

This can cause issues during Vercel's build process and serverless function initialization.

## Fix Applied
1. Added `sql` to the top-level imports from `@/lib/db`
2. Removed the dynamic import statement inside the POST handler
3. Added a GET handler for health check/debugging

## Testing Steps

### 1. Test GET endpoint (health check)
```bash
curl https://ftw-sentinel.vercel.app/api/sentinel/validate
```

Expected response:
```json
{
  "message": "Sentinel validation endpoint is active",
  "method": "POST",
  "route": "/api/sentinel/validate"
}
```

### 2. Test POST endpoint with your FiveM resource
The POST request from your logs:
```json
{
  "server_ip": "0.0.0.0",
  "license_key": "FTWAC-8BE0-7D31-4CE3-6A76"
}
```

Should now return a proper response instead of 404.

### 3. Manual POST test (optional)
```bash
curl -X POST https://ftw-sentinel.vercel.app/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key":"FTWAC-8BE0-7D31-4CE3-6A76","server_ip":"0.0.0.0"}'
```

## Deployment
1. Commit these changes to git
2. Push to your repository
3. Vercel will automatically rebuild and deploy
4. Wait for deployment to complete
5. Test using the steps above

## What Changed
- **File:** `app/api/sentinel/validate/route.ts`
- **Changes:**
  - Added `sql` to imports
  - Removed dynamic import
  - Added GET handler for debugging
