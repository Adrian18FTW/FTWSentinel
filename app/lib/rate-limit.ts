import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const WINDOW_MS = 60000;
const MAX_REQUESTS = 10;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();
const HMAC_SECRET = process.env.HMAC_SECRET ?? process.env.SIGNING_SECRET ?? '';

if (!HMAC_SECRET) {
  console.warn('[rate-limit] HMAC_SECRET or SIGNING_SECRET not set in environment');
}

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  
  if (entry && entry.resetTime > now) {
    if (entry.count >= MAX_REQUESTS) {
      return false;
    }
    entry.count++;
    return true;
  }
  
  store.set(ip, { count: 1, resetTime: now + WINDOW_MS });
  return true;
}

export function verifyHmac(endpoint: string, license: string, providedHmac: string): boolean {
  if (!HMAC_SECRET || !providedHmac) return false;
  
  // HMAC is: endpoint:license:timestamp signed. We check against current and previous minute
  // since client may have slightly different clock. The format is HMAC of a time-bound token.
  const timestamp = Math.floor(Date.now() / 1000);
  
  for (let offset = 0; offset < 120; offset += 60) {
    const expected = createHmac('sha256', HMAC_SECRET)
      .update(`${endpoint}:${license}:${timestamp - offset}`)
      .digest('hex').slice(0, 32);
    
    if (expected.length === providedHmac.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ providedHmac.charCodeAt(i);
      }
      if (diff === 0) return true;
    }
  }
  
  return false;
}

export async function withRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 
             req.headers.get('cf-connecting-ip') ?? 
             'unknown';
  
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { valid: false, reason: 'rate_limited', message: 'Too many requests' },
      { status: 429 }
    );
  }
  
  return null;
}

export function requireHmac(req: NextRequest, body: { license?: string; key?: string; hmac?: string }): boolean {
  const license = body.license ?? body.key ?? '';
  const hmac = body.hmac ?? '';
  
  if (!license || !hmac) return false;
  
  return verifyHmac('v1/validate', license, hmac);
}