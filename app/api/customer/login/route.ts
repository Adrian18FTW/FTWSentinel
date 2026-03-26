import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { initCustomers, getCustomerByEmail } from '@/lib/db';
import { setSession } from '@/lib/session';

// In-memory brute force map — resets on cold start, good enough for serverless
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.until) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) return true;
  return false;
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

// Dummy hash to run bcrypt even when user doesn't exist — prevents timing attacks
const DUMMY_HASH = '$2a$12$dummy.hash.to.prevent.timing.attacks.padding.here.xx';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown; password?: unknown; rememberMe?: unknown };
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rememberMe = body.rememberMe === true;

    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    if (email.length > 254 || password.length > 128) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateLimitKey = `login:${ip}`;
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    await initCustomers();
    const customer = await getCustomerByEmail(email);

    // Always run bcrypt to prevent timing-based user enumeration
    const hashToCheck = customer?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!customer || !valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    clearAttempts(rateLimitKey);
    await setSession(customer.id, rememberMe);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[customer/login]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
