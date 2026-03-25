import { NextRequest, NextResponse } from 'next/server';
import { initDb, getAllLicenses, revokeLicense, deleteLicense } from '@/lib/db';

function requireAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret');
  return auth === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await initDb();
  const licenses = await getAllLicenses();
  return NextResponse.json(licenses);
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });
  if (action === 'revoke') await revokeLicense(Number(id));
  else if (action === 'delete') await deleteLicense(Number(id));
  else return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
