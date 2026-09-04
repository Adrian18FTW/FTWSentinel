# FTWSentinel Minecraft AntiCheat API Documentation

## Base URL
```
https://nextjs-boilerplate-ny1tz43tw-demonlorderqr-stars-projects.vercel.app
```

## Authentication
All customer-facing endpoints require session authentication via cookies.
Plugin endpoints use license key authentication in the request body.

---

## Customer Endpoints (Requires Login)

### 1. Generate License Key
**POST** `/api/minecraft/license/generate`

Generates a permanent Minecraft license key for the logged-in user.
If a license already exists, returns the existing key.

**Response:**
```json
{
  "license_key": "MC-XXXX-XXXX-XXXX-XXXX",
  "already_exists": false
}
```

---

### 2. Download Plugin
**GET** `/api/minecraft/download`

Downloads the FTWSentinel.jar file and generates a license key if not exists.

**Response:** Binary JAR file

---

### 3. Get Statistics
**GET** `/api/minecraft/stats`

Retrieves all statistics for the logged-in user's Minecraft server.

**Response:**
```json
{
  "license": {
    "key": "MC-XXXX-XXXX-XXXX-XXXX",
    "created_at": "2026-09-04T12:00:00Z",
    "last_validated": "2026-09-04T14:30:00Z",
    "server_name": "My Server",
    "server_version": "Paper-1.21",
    "is_active": true
  },
  "stats": {
    "total_checks": 1500000,
    "total_violations": 523,
    "total_bans": 12,
    "total_kicks": 45,
    "players_monitored": 150,
    "checks_per_second": 125.5,
    "uptime_seconds": 86400,
    "server_tps": 19.8,
    "check_violations": {
      "killaura": 45,
      "reach": 32,
      "fly": 28,
      "speed": 67,
      "criticals": 12,
      "velocity": 89,
      "autoclick": 23,
      "jesus": 5,
      "nofall": 18,
      "step": 9,
      "spider": 3,
      "regeneration": 7,
      "fasteat": 4,
      "inventory": 2,
      "fastbreak": 34,
      "fastplace": 21,
      "blockreach": 15,
      "nuker": 1,
      "scaffold": 56,
      "badpackets": 28,
      "timer": 14,
      "pingspoof": 10
    },
    "updated_at": "2026-09-04T14:30:00Z"
  },
  "players": [
    {
      "name": "PlayerName",
      "violations": 15,
      "banned": false,
      "last_seen": "2026-09-04T14:25:00Z"
    }
  ]
}
```

---

### 4. Revoke License
**POST** `/api/minecraft/license/revoke`

Deactivates the license key (plugin will stop working).

**Response:**
```json
{
  "success": true,
  "message": "License deactivated successfully"
}
```

---

### 5. Reactivate License
**POST** `/api/minecraft/license/reactivate`

Reactivates a previously revoked license key.

**Response:**
```json
{
  "success": true,
  "message": "License reactivated successfully"
}
```

---

## Plugin Endpoints (No Authentication Required)

### 6. Validate License
**POST** `/api/minecraft/license/validate`

Validates a license key on server startup.

**Request Body:**
```json
{
  "license_key": "MC-XXXX-XXXX-XXXX-XXXX",
  "server_name": "My Minecraft Server",
  "server_version": "Paper-1.21.1"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "message": "License validated successfully"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "message": "License key not found"
}
```

**Error Responses:**
- `401` - License key not found
- `403` - Account suspended or license deactivated
- `400` - Invalid request format

---

### 7. Send Statistics
**POST** `/api/minecraft/stats/send`

Sends real-time statistics from the plugin to the backend.
Rate limited to 60 requests per minute per license key.

**Request Body:**
```json
{
  "license_key": "MC-XXXX-XXXX-XXXX-XXXX",
  "server_name": "My Server",
  "server_version": "Paper-1.21.1",
  "total_checks": 1500000,
  "total_violations": 523,
  "total_bans": 12,
  "total_kicks": 45,
  "players_monitored": 150,
  "checks_per_second": 125.5,
  "uptime_seconds": 86400,
  "server_tps": 19.8,
  "check_violations": {
    "killaura": 45,
    "reach": 32,
    "fly": 28,
    "speed": 67,
    "criticals": 12,
    "velocity": 89,
    "autoclick": 23,
    "jesus": 5,
    "nofall": 18,
    "step": 9,
    "spider": 3,
    "regeneration": 7,
    "fasteat": 4,
    "inventory": 2,
    "fastbreak": 34,
    "fastplace": 21,
    "blockreach": 15,
    "nuker": 1,
    "scaffold": 56,
    "badpackets": 28,
    "timer": 14,
    "pingspoof": 10
  },
  "players": [
    {
      "name": "PlayerName",
      "violations": 15,
      "banned": false
    }
  ]
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Stats updated successfully"
}
```

**Response (Rate Limited):**
```json
{
  "success": false,
  "message": "Rate limit exceeded. Try again later."
}
```

---

## Database Schema

### minecraft_licenses
```sql
id               SERIAL PRIMARY KEY
customer_id      INTEGER (FK to customers.id)
license_key      VARCHAR(64) UNIQUE
created_at       TIMESTAMPTZ
last_validated   TIMESTAMPTZ
server_name      VARCHAR(255)
server_version   VARCHAR(64)
is_active        BOOLEAN
```

### minecraft_stats
```sql
id                       SERIAL PRIMARY KEY
customer_id              INTEGER (FK to customers.id)
license_key              VARCHAR(64) (FK to minecraft_licenses.license_key)
total_checks             BIGINT
total_violations         BIGINT
total_bans               INTEGER
total_kicks              INTEGER
players_monitored        INTEGER
checks_per_second        NUMERIC(10,2)
uptime_seconds           BIGINT
server_tps               NUMERIC(5,2)
[check_name]_violations  INTEGER (for each check type)
updated_at               TIMESTAMPTZ
```

### minecraft_players
```sql
id               SERIAL PRIMARY KEY
customer_id      INTEGER (FK to customers.id)
license_key      VARCHAR(64) (FK to minecraft_licenses.license_key)
player_name      VARCHAR(16)
total_violations INTEGER
is_banned        BOOLEAN
last_seen        TIMESTAMPTZ
```

---

## Rate Limiting

- **Stats endpoint**: 60 requests per minute per license key
- Rate limit uses in-memory storage (resets on server restart)
- Excess requests return 429 status code

---

## Error Codes

- `400` - Bad Request (invalid format)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (license invalid/suspended)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Security Notes

1. License keys are permanent and cannot be changed
2. One license per customer account
3. License validation updates last_validated timestamp
4. Statistics are private to each customer
5. Player names are stored but no sensitive data (IPs, chat logs)
6. Rate limiting prevents abuse
7. Session-based authentication for customer endpoints
8. No API keys required for plugin endpoints (license key serves as auth)
