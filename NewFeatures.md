FiveM Script Protection System
Architecture & Implementation Guide
This document provides a complete blueprint for building a secure, license‑based protection system for FiveM Lua scripts.
It combines per‑customer encryption, IP‑bound activation, server‑side validation, client‑side decryption, and trap obfuscation to make stealing, sharing, or reverse‑engineering your code as difficult and time‑consuming as possible.

1. Core Principles
Principle	Description
Unique per‑customer builds	Every customer receives a distinct set of encrypted files, bound to their license key.
IP‑bound activation	The license is automatically tied to the server’s public IP on first start. The script only runs on that IP.
Server‑side enforcement	The license validation happens on the server (via your backend API), not solely on the client.
Injected decryption loaders	Every file contains its own loader that decrypts the payload using the license key from sv_license.
Trap decoy	If validation fails, the script displays a fake/misleading output (e.g., ASCII art) and stops.
Obfuscation layering	Even after decryption, the source can be heavily obfuscated (e.g., with Prometheus) to frustrate manual patching.
2. High‑Level Architecture
text
┌─────────────────────────────────────────────────────────────────────┐
│                     YOUR WEBSITE / BACKEND                         │
│  • Customer purchases script                                       │
│  • Backend generates unique license key (e.g., "LIC-ABC-123")      │
│  • Build pipeline reads raw .lua files                            │
│  • For each file: inject loader with license key, encrypt content  │
│  • Package encrypted files + license.cfg → ZIP download           │
│  • Store license in DB (status: pending, bound_ip: null)          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER DOWNLOADS & SETUP                      │
│  • Unzip files to server                                           │
│  • Add `set sv_license "LIC-ABC-123"` to server.cfg               │
│  • Start FiveM server                                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FIVEM RUNTIME (Server & Client)               │
│  1. Script starts, each encrypted file runs its loader.            │
│  2. Loader reads `sv_license` from CVAR.                          │
│  3. Loader fetches server’s public IP (via api.ipify.org).        │
│  4. Loader POSTs (license, IP, file) to your backend.             │
│  5. Backend validates:                                            │
│       - First run → bind IP, return `valid: true`                 │
│       - IP matches → `valid: true`                                │
│       - IP mismatch → `valid: false`                              │
│  6. If valid: loader decrypts the payload using the license key,  │
│     loads and executes the real code.                             │
│  7. If invalid: loader shows trap message and stops.              │
└─────────────────────────────────────────────────────────────────────┘
3. Backend Build Pipeline
Your backend must have a build script that processes raw source files and produces encrypted, customer‑specific outputs.

3.1. Generate License Key
javascript
const crypto = require('crypto');
function generateLicense() {
    return 'LIC-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}
3.2. Encryption Function
Use a strong algorithm (AES‑256 is recommended, but XOR is shown for simplicity – upgrade to AES with a library).

javascript
function encrypt(data, key) {
    // Simple XOR – replace with AES for production
    let result = '';
    for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}
3.3. Inject the Loader Wrapper
For each file, inject a Lua loader that:

Checks if _G.__LICENSE_VALIDATED is already set (to avoid repeated validation).

Reads GetConvar("sv_license", "").

Fetches server IP via api.ipify.org.

Calls your backend API POST /v1/validate.

If valid: sets _G.__LICENSE_KEY, then decrypts and executes the payload.

If invalid: prints trap and returns.

Sample loader template (placed at the top of each file):

lua
-- ================================================
-- SECURE LOADER: ${filename}
-- License: ${licenseKey}
-- Injected by your-site.com
-- ================================================

local function decrypt(hex, key)
    local result = {}
    for i = 1, #hex, 2 do
        local byte = tonumber(hex:sub(i, i+1), 16)
        local keyByte = key:byte(((i/2) - 1) % #key + 1)
        table.insert(result, string.char(bit.bxor(byte, keyByte)))
    end
    return table.concat(result)
end

if not _G.__LICENSE_VALIDATED then
    local function validate()
        local key = GetConvar("sv_license", "")
        if key == "" then
            print("^1[License] sv_license not set")
            return false, nil
        end
        -- Fetch IP
        local p = promise.new()
        PerformHttpRequest("https://api.ipify.org", "GET", "", function(status, body)
            p:resolve((status == 200 and body) and body:gsub("%s+", "") or "unknown")
        end)
        local ip = Citizen.Await(p)
        -- Call backend
        local p2 = promise.new()
        PerformHttpRequest("https://api.your-site.com/v1/validate", "POST", json.encode({
            license = key,
            ip = ip,
            file = "${filename}"
        }), function(status, body)
            if status == 200 then
                local data = json.decode(body)
                p2:resolve(data and data.valid or false)
            else
                p2:resolve(false)
            end
        end, { ["Content-Type"] = "application/json" })
        local valid = Citizen.Await(p2)
        if valid then
            _G.__LICENSE_VALIDATED = true
            _G.__LICENSE_KEY = key
            print("^2[License] Validated")
            return true, key
        else
            print("^1[License] Validation failed")
            return false, nil
        end
    end

    local ok, key = validate()
    if not ok then
        print("╔══════════════════════════════════════════════════════════╗")
        print("║  INVALID LICENSE – TRAP ACTIVATED                      ║")
        print("╚══════════════════════════════════════════════════════════╝")
        return
    end
end

-- Decrypt and execute the real payload
local hex = "${encryptedHex}"
local decrypted = decrypt(hex, _G.__LICENSE_KEY)
if decrypted and #decrypted > 0 then
    local func, err = loadstring(decrypted)
    if func then func() else print("^1[Loader] Error in ${filename}: "..tostring(err)) end
else
    print("^1[Loader] Decryption failed")
end
3.4. Build Loop
javascript
const fs = require('fs');
const path = require('path');

function buildCustomerScript(customerId, files) {
    const license = generateLicense();
    const outputDir = path.join('./builds', customerId, Date.now().toString(36));
    fs.mkdirSync(outputDir, { recursive: true });

    for (const file of files) {
        const raw = fs.readFileSync(path.join('./source', file), 'utf8');
        // Optional: replace watermark placeholder
        const marked = raw.replace(/__LICENSE_PLACEHOLDER__/g, license);
        const encrypted = encrypt(marked, license);
        const hex = toHex(encrypted);
        const loader = generateLoader(license, hex, file);
        fs.writeFileSync(path.join(outputDir, file), loader, 'utf8');
    }

    // Write license.cfg for convenience
    fs.writeFileSync(path.join(outputDir, 'license.cfg'), `sv_license "${license}"\n`);

    return { license, outputDir };
}
3.5. Store License in Database
After build, store:

json
{
    "licenseKey": "LIC-...",
    "customerId": "...",
    "boundIp": null,
    "status": "pending",
    "createdAt": "..."
}
4. Backend Validation API
Your backend must expose a POST /v1/validate endpoint.

4.1. Request Body
json
{
    "license": "LIC-ABC-123",
    "ip": "203.0.113.5",
    "file": "client.lua"  // optional, for logging
}
4.2. Validation Logic
javascript
app.post('/v1/validate', (req, res) => {
    const { license, ip } = req.body;
    const record = db.get(license);

    if (!record) return res.json({ valid: false, message: 'Unknown license' });
    if (record.status === 'revoked') return res.json({ valid: false, message: 'Revoked' });

    if (record.boundIp === null) {
        // First activation – bind IP
        record.boundIp = ip;
        record.status = 'active';
        record.firstSeen = new Date();
        return res.json({ valid: true, message: 'Activated' });
    }

    if (record.boundIp === ip) {
        record.lastSeen = new Date();
        return res.json({ valid: true, message: 'Valid' });
    }

    return res.json({ valid: false, message: `IP mismatch. Bound to ${record.boundIp}` });
});
4.3. Security Considerations
Use HTTPS.

Add a shared secret / HMAC to prevent spoofing.

Implement rate limiting.

Keep logs of activation attempts.

5. Client‑Side (Decrypted Source) Watermark
Even after decryption, the source code should contain additional checks to prevent sharing of decrypted code.

5.1. Inside the decrypted source, add:
lua
-- client_raw.lua (before obfuscation)
local function validateEnvironment()
    local p = promise.new()
    TriggerServerEvent("license:clientValidate", function(ok) p:resolve(ok) end)
    local ok = Citizen.Await(p)
    if not ok then
        error("License enforcement triggered")
    end
end
validateEnvironment()
-- ... rest of your code ...
5.2. Server‑side event:
lua
RegisterNetEvent("license:clientValidate")
AddEventHandler("license:clientValidate", function()
    local src = source
    if IsLicenseValid() then  -- re-uses the IP validation
        TriggerClientEvent("license:clientValidateResponse", src, true)
    else
        TriggerClientEvent("license:clientValidateResponse", src, false)
    end
end)
This ensures that even if an attacker manually decrypts the payload, the extracted code will still call back to the server and fail on any unauthorized IP.

6. Trap Obfuscation (The Decoy)
If validation fails, the loader prints a fake message and does not execute the real code.
You can also make the loader appear to execute a fake script – for example, a crippled version that looks real but does nothing.

Example trap payload:

lua
print("╔══════════════════════════════════════════════════════════╗")
print("║  TRAP TRIGGERED – This code is locked.                 ║")
print("╚══════════════════════════════════════════════════════════╝")
-- Optionally, run a harmless decoy function
function fakeLogic()
    -- Looks real but is just noise
end
To make it even more convincing, you can embed a large block of obfuscated decoy code that simulates a script but does nothing useful.

7. Additional Obfuscation Layers
Before encrypting your raw source, run it through an obfuscation tool like Prometheus with "Strong" settings. This will:

Flatten control flow (convert to state machine).

Encrypt strings and numbers.

Inject dead code.

Rename variables.

This means that even after decryption, the attacker faces heavily obfuscated code – making it extremely tedious to locate and patch the watermark checks.

8. Performance Optimizations
Global cache: Use _G.__LICENSE_VALIDATED to avoid validating multiple times per file.

Lazy decryption: Only decrypt when the file is actually needed (e.g., on require or first usage).

Batch validation: Instead of each file calling the API, let the first file validate and store the result globally.

9. Attack Surface Analysis
Attack Vector	Defense Mechanism
Copy encrypted files to another server	IP mismatch → backend returns invalid → loader stops
Patch loader to skip validation	Loader is injected into every file; must patch all files (and each can have a slightly different structure if you randomise)
Intercept license key from memory	Key is exposed, but the encrypted hex payload is still required; decryption only works with the correct key
Manually decrypt payload with the key	The decrypted source still contains server‑side watermark checks; they will fail on unauthorized IP
Remove watermark checks from decrypted source	The source is heavily obfuscated (control‑flow flattened) – finding and patching all checks is extremely time‑consuming
10. Final Workflow Summary
Customer purchases script on your website.

Backend build pipeline:

Generates unique license.

Injects loader into each source file.

Encrypts the entire file content.

Packages encrypted files + license.cfg.

Stores license (pending) in DB.

Customer downloads and uploads files to their server.

Customer adds set sv_license "LIC-..." to server.cfg.

Server starts:

Each file runs its loader.

Loader reads sv_license and fetches IP.

Loader calls your backend API.

On first run: API binds IP → valid: true.

On subsequent runs: API checks IP match → valid: true/false.

If valid: loader decrypts payload → executes real code.

If invalid: loader shows trap → stops.

11. Recommended Tech Stack
Backend: Node.js (Express) + SQLite/PostgreSQL + crypto (AES-256) + jsonwebtoken (optional for extra signing).

Encryption: AES-256‑CBC with a random IV (store IV alongside encrypted data) – more secure than XOR.

FiveM: Uses native PerformHttpRequest, GetConvar, Citizen.Await (promise support).

Obfuscation: Use Prometheus (Lua) before encryption.

12. Next Steps for Implementation
Set up your backend API with database.

Write the build script that processes your source directory.

Test locally with a test sv_license and dummy IP.

Deploy and integrate with your payment system.

13. Questions for the Implementer
Before you start coding, it is critical to clarify the following points with the person who requested this system.
Please ask them these questions:

Which encryption algorithm should we use?

XOR (simple, fast) or AES‑256 (more secure, requires a Lua crypto library for decryption)?

Where will your backend be hosted?

URL, rate limits, expected uptime, and failover strategy if the API is unreachable.

Do you require support for dynamic IPs?

If customers have changing IPs, we need a “license reset” flow or allow domain‑based binding.

How many files are you protecting?

2–3 files? Or 20+? This affects performance and the need for caching.

Will you obfuscate the source before encryption?

If yes, which tool (e.g., Prometheus) and what settings?

Should the trap be a simple message, or should we simulate a fake working script?

A convincing decoy makes the trap more frustrating.

How should we handle license revocation?

Via admin panel? Automatic if the IP changes too often?

Do you need support for multiple servers under one license?

This would require a pool of allowed IPs.

What is your target FiveM version?

Ensure compatibility with Citizen.Await and PerformHttpRequest.

Do you have a web admin panel already, or should we build the license management UI from scratch?