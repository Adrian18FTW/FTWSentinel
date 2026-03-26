import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { initCustomers, createCustomer, getCustomerByEmail, getLicense, sql } from '@/lib/db';
import { setSession } from '@/lib/session';

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.until) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: unknown; password?: unknown; licenseKey?: unknown };
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const licenseKey = typeof body.licenseKey === 'string' ? body.licenseKey.trim() : '';

    // Input validation
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    if (password.length > 128) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    if (licenseKey && licenseKey.length > 64) return NextResponse.json({ error: 'Invalid license key' }, { status: 400 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (isRateLimited(`register:${ip}`)) {
      return NextResponse.json({ error: 'Too many registrations. Try again later.' }, { status: 429 });
    }

    await initCustomers();

    const existing = await getCustomerByEmail(email);
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    // Validate license key and ensure it isn't already claimed
    if (licenseKey) {
      const license = await getLicense(licenseKey);
      if (!license || !license.active) {
        return NextResponse.json({ error: 'Invalid or inactive license key' }, { status: 400 });
      }
      // Check if another customer already owns this key
      const claimed = await sql`SELECT id FROM customers WHERE license_key = ${licenseKey} LIMIT 1`;
      if (claimed.length > 0) {
        return NextResponse.json({ error: 'License key already linked to an account' }, { status: 409 });
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const customer = await createCustomer(email, hash, licenseKey || undefined);
    await setSession(customer.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[customer/register]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
