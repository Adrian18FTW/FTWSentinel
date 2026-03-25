import { createHmac } from 'crypto';

const SECRET = process.env.SIGNING_SECRET ?? 'change-me-in-env';

// Returns a short token the AC can verify locally without another API call.
// Format: HMAC-SHA256(key:ip:expiry_unix, SIGNING_SECRET) truncated to 32 hex chars.
export function signToken(key: string, ip: string, expiresAt: Date): string {
  const payload = `${key}:${ip}:${Math.floor(expiresAt.getTime() / 1000)}`;
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

export function verifyToken(key: string, ip: string, expiresAt: Date, token: string): boolean {
  const expected = signToken(key, ip, expiresAt);
  // Constant-time compare
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
