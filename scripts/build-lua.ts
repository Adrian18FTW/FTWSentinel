import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync, rmdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createHmac } from 'crypto';

const SOURCE_DIR = resolve('./scripts/source');
const OUTPUT_DIR = resolve('./scripts/output');
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://your-domain.vercel.app';

function generateLicense(): string {
  const hex = Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
  return `LIC-${hex}`;
}

function toHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex');
}

function generateHmac(endpoint: string, license: string): string {
  const secret = process.env.HMAC_SECRET ?? process.env.SIGNING_SECRET ?? 'change-me-in-env';
  const timestamp = Math.floor(Date.now() / 1000);
  return createHmac('sha256', secret).update(`${endpoint}:${license}:${timestamp}`).digest('hex').slice(0, 32);
}

function encryptXor(data: string, key: string): string {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function generateLoader(licenseKey: string, encryptedHex: string, filename: string): string {
  const hmac = generateHmac('v1/validate', licenseKey);
  return `-- ================================================
-- SECURE LOADER: ${filename}
-- License: ${licenseKey}
-- Injected by FTWSentinel
-- ================================================

local function decrypt(hex, key)
  local result = {}
  for i = 1, #hex, 2 do
    local byte = tonumber(hex:sub(i, i+1), 16)
    local keyByte = key:byte(((i/2) - 1) % #key + 1)
    table.insert(result, string.char(bit32.bxor(byte, keyByte)))
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
    
    -- Call backend with HMAC
    local p2 = promise.new()
    PerformHttpRequest("${BASE_URL}/api/v1/validate", "POST", json.encode({
      license = key,
      ip = ip,
      file = "${filename}",
      hmac = "${hmac}"
    }), function(status, body)
      if status == 200 then
        local data = json.decode(body)
        p2:resolve(data and data.valid or false, data and data.token or nil)
      else
        p2:resolve(false, nil)
      end
    end, { ["Content-Type"] = "application/json" })
    
    local valid, token = Citizen.Await(p2)
    if valid then
      _G.__LICENSE_VALIDATED = true
      _G.__LICENSE_KEY = key
      _G.__LICENSE_TOKEN = token
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
    print("║  This script is locked to a specific server IP.         ║")
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
`;
}

function buildCustomerScript(customerId: string | number, files: string[] = []): { license: string; outputDir: string } {
  const license = generateLicense();
  const timestamp = Date.now().toString(36);
  const outputDir = join(OUTPUT_DIR, `${customerId}-${timestamp}`);
  
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const filesToProcess = files.length > 0 ? files : readdirSync(SOURCE_DIR).filter(f => f.endsWith('.lua'));
  
  for (const file of filesToProcess) {
    const raw = readFileSync(join(SOURCE_DIR, file), 'utf8');
    const encrypted = encryptXor(raw, license);
    const hex = toHex(encrypted);
    const loader = generateLoader(license, hex, file);
    writeFileSync(join(outputDir, file), loader, 'utf8');
  }
  
  writeFileSync(join(outputDir, 'license.cfg'), `set sv_license "${license}"\nset sv_license_token "${generateHmac('v1/validate', license)}"\n`);
  
  return { license, outputDir };
}

// Clean output directory
function cleanOutput(): void {
  if (existsSync(OUTPUT_DIR)) {
    const entries = readdirSync(OUTPUT_DIR);
    for (const entry of entries) {
      const fullPath = join(OUTPUT_DIR, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const files = readdirSync(fullPath);
        for (const file of files) {
          unlinkSync(join(fullPath, file));
        }
        rmdirSync(fullPath);
      } else {
        unlinkSync(fullPath);
      }
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const customerId = args[0] ?? 'default';
  const files = args.slice(1);
  
  const result = buildCustomerScript(customerId, files.length > 0 ? files : undefined);
  console.log(`Built: ${result.license} -> ${result.outputDir}`);
}

export { buildCustomerScript, generateLicense, generateHmac, encryptXor, toHex };