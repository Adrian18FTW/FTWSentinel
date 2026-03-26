import { NextRequest, NextResponse } from 'next/server';
import { initDb, resetLicenseIp } from '@/lib/db';

function requireAdmin(req: NextRequest): boolean {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

// Unbinds the IP from a license so it can be rebound on next validation.
// Admin-only — used when a customer legitimately moves to a new server IP.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    await initDb();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    await resetLicenseIp(Number(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[reset-ip]', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
