/**
 * Customer fingerprint generation for obfuscation key derivation
 * 
 * Creates a unique, deterministic key from customer identifiers that can be used
 * to encrypt/decrypt customer-specific obfuscated builds.
 */

import crypto from 'crypto';

export interface CustomerIdentifiers {
  ip: string;
  userAgent: string;
  email: string;
  timestamp: number;
  customerId: number;
}

/**
 * Generates a SHA-256 obfuscation key from customer identifiers
 * 
 * Process:
 * 1. Stringify identifiers to JSON
 * 2. Base64 encode the JSON
 * 3. SHA-256 hash the base64 string
 * 
 * @param identifiers - Customer identification data
 * @returns 64-character hex SHA-256 hash
 */
export function generateObfuscationKey(identifiers: CustomerIdentifiers): string {
  // Step 1: Create deterministic JSON string (sorted keys for consistency)
  const raw = JSON.stringify({
    customerId: identifiers.customerId,
    email: identifiers.email,
    ip: identifiers.ip,
    timestamp: identifiers.timestamp,
    userAgent: identifiers.userAgent
  });

  // Step 2: Base64 encode
  const base64 = Buffer.from(raw, 'utf-8').toString('base64');

  // Step 3: SHA-256 hash
  const sha256Hash = crypto
    .createHash('sha256')
    .update(base64)
    .digest('hex');

  return sha256Hash;
}

/**
 * Verifies an obfuscation key matches the expected identifiers
 * Useful for validation and debugging
 * 
 * @param key - The key to verify
 * @param identifiers - Expected identifiers
 * @returns true if key matches identifiers
 */
export function verifyObfuscationKey(
  key: string,
  identifiers: CustomerIdentifiers
): boolean {
  const expectedKey = generateObfuscationKey(identifiers);
  return key === expectedKey;
}

/**
 * Extracts request metadata for fingerprinting
 * Helper function to gather identifiers from a Next.js request
 * 
 * @param req - Next.js request object
 * @param email - Customer email
 * @param customerId - Customer database ID
 * @returns CustomerIdentifiers object
 */
export function extractIdentifiers(
  req: Request,
  email: string,
  customerId: number
): CustomerIdentifiers {
  // Extract IP from headers (Vercel provides x-forwarded-for)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             'unknown';

  // Extract user agent
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Current timestamp
  const timestamp = Date.now();

  return {
    ip,
    userAgent,
    email,
    timestamp,
    customerId
  };
}

/**
 * Generates a resource hash for integrity verification
 * Creates a SHA-256 hash of the obfuscated package contents
 * 
 * @param content - Buffer or string content of the obfuscated package
 * @returns 64-character hex SHA-256 hash
 */
export function generateResourceHash(content: Buffer | string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Generates a secure random salt for additional entropy
 * Can be mixed with fingerprint for extra security
 * 
 * @param length - Desired salt length in bytes (default: 32)
 * @returns Hex-encoded random salt
 */
export function generateSalt(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Derives an AES-256 encryption key from the obfuscation key
 * Converts hex string to 32-byte key suitable for AES-256
 * 
 * @param obfuscationKey - 64-character hex SHA-256 hash
 * @returns 32-byte Buffer for AES-256 encryption
 */
export function deriveEncryptionKey(obfuscationKey: string): Buffer {
  // Take first 32 bytes (64 hex chars) of SHA-256 hash
  // This gives us exactly 256 bits for AES-256
  return Buffer.from(obfuscationKey.substring(0, 64), 'hex').subarray(0, 32);
}

/**
 * Creates a human-readable fingerprint summary for logging
 * Does NOT include sensitive data like full IP or email
 * 
 * @param identifiers - Customer identifiers
 * @returns Sanitized string for logs
 */
export function createFingerprintSummary(identifiers: CustomerIdentifiers): string {
  const ipPrefix = identifiers.ip.split('.').slice(0, 2).join('.');
  const emailDomain = identifiers.email.split('@')[1] || 'unknown';
  const uaShort = identifiers.userAgent.substring(0, 50);
  
  return `Customer${identifiers.customerId}|${ipPrefix}.x.x|*@${emailDomain}|${uaShort}...`;
}
