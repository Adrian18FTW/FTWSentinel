# Testing /api/sentinel/validate Endpoint

## Test Cases

### 1. Valid Request (Success)
```bash
curl -X POST http://localhost:3000/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "YOUR_LICENSE_KEY",
    "server_ip": "203.0.113.42",
    "timestamp": 1726934400000
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "deobfuscation_key": "beb0420072530857dabdb00241e926f5d61fc722dc29dccbef8cfbe1a7b154b7",
  "ttl": 3600,
  "key_expiry": 1726938000000
}
```

### 2. Missing License Key
```bash
curl -X POST http://localhost:3000/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{
    "server_ip": "203.0.113.42"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Missing or invalid license_key"
}
```

### 3. Invalid License Key
```bash
curl -X POST http://localhost:3000/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "INVALID_KEY_12345",
    "server_ip": "203.0.113.42",
    "timestamp": 1726934400000
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Invalid or inactive license"
}
```

### 4. IP Mismatch (License Bound to Different IP)
```bash
curl -X POST http://localhost:3000/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "YOUR_LICENSE_KEY",
    "server_ip": "198.51.100.99",
    "timestamp": 1726934400000
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "License is bound to IP 203.0.113.42. Current IP: 198.51.100.99"
}
```

### 5. Resource Hash Mismatch (Tampered Build)
```bash
curl -X POST http://localhost:3000/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "YOUR_LICENSE_KEY",
    "server_ip": "203.0.113.42",
    "resource_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "timestamp": 1726934400000
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Resource integrity check failed. Build may be tampered."
}
```

### 6. Expired License
```bash
curl -X POST http://localhost:3000/api/sentinel/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "EXPIRED_LICENSE_KEY",
    "server_ip": "203.0.113.42",
    "timestamp": 1726934400000
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "License has expired"
}
```

## Security Events Logged

All validation attempts are logged to `security_logs` table with the following events:

- `KEY_REQUEST_SUCCESS` - Successful key retrieval
- `KEY_REQUEST_INVALID_LICENSE` - Invalid license key provided
- `KEY_REQUEST_INACTIVE_LICENSE` - License is revoked/inactive
- `KEY_REQUEST_EXPIRED_LICENSE` - License has expired
- `KEY_REQUEST_IP_MISMATCH` - Server IP doesn't match bound IP
- `KEY_REQUEST_UNCLAIMED_LICENSE` - License not claimed by customer
- `KEY_REQUEST_NO_CUSTOMER` - Customer record not found
- `KEY_REQUEST_NO_DOWNLOAD` - No download record exists
- `HASH_MISMATCH` - Resource hash mismatch (tampered build)
- `KEY_REQUEST_ERROR` - Server error during validation

## Rate Limiting

The endpoint is protected by rate limiting (configured in `lib/rate-limit.ts`).
Multiple failed attempts from the same IP will be temporarily blocked.

## Key Expiry

- Keys are returned with a TTL of 3600 seconds (1 hour)
- FTWSentinel must re-request the key after expiry
- This forces periodic re-validation and allows for real-time license revocation
