import { NextRequest, NextResponse } from 'next/server';
import { initDb, createLicense } from '@/lib/db';
import { randomBytes } from 'crypto';

function requireAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret');
  return auth === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    await initDb();
    const body = await req.json();
    const plan = ['1month', '3month', '6month'].includes(body.plan) ? body.plan : '1month';
    const note = typeof body.note === 'string' ? body.note.slice(0, 200) : '';

    // Generate a readable license key: FTWAC-XXXX-XXXX-XXXX-XXXX
    const hex = randomBytes(8).toString('hex').toUpperCase();
    const key = `FTWAC-${hex.slice(0,4)}-${hex.slice(4,8)}-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const license = await createLicense(key, plan, note);
    return NextResponse.json({ key: license.key, plan: license.plan, expires_at: license.expires_at });
  } catch (e) {
    console.error('[issue]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
