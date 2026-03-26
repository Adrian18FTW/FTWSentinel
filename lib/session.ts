import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const KEY = process.env.SESSION_SECRET ?? 'dev-only-secret-do-not-use-in-prod';

function getKey(): string {
  const k = process.env.SESSION_SECRET ?? '';
  if (!k && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET env var is required in production');
  }
  return k || KEY;
}
const COOKIE = 'ftw_session';
const MAX_AGE_DEFAULT = 60 * 60 * 24 * 7;      // 7 days
const MAX_AGE_REMEMBER = 60 * 60 * 24 * 30;    // 30 days

function sign(payload: string): string {
  const sig = createHmac('sha256', getKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const expected = sign(payload);
  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return payload;
}

export async function setSession(customerId: number, rememberMe = false) {
  const exp = Math.floor(Date.now() / 1000) + (rememberMe ? MAX_AGE_REMEMBER : MAX_AGE_DEFAULT);
  const payload = `${customerId}:${exp}`;
  const token = sign(payload);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    ...(rememberMe ? { maxAge: MAX_AGE_REMEMBER } : {}), // no maxAge = session cookie
  });
}

export async function getSession(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const [idStr, expStr] = payload.split(':');
  const id = parseInt(idStr, 10);
  const exp = parseInt(expStr, 10);
  if (isNaN(id) || isNaN(exp)) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null; // expired
  return id;
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
