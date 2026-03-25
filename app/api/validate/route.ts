import { NextRequest, NextResponse } from 'next/server';
import { initDb, getLicense, bindIp, touchLicense } from '@/lib/db';
import { signToken } from '@/lib/sign';

export async function POST(req: NextRequest) {
  try {
    await initDb();

    const body = await req.json();
    const { key, ip } = body as { key?: string; ip?: string };

    if (!key || typeof key !== 'string' || key.length < 8) {
      return NextResponse.json({ valid: false, reason: 'missing_key' }, { status: 400 });
    }

    // Use the IP from the request header if not provided (FiveM sends its own)
    const clientIp = ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    const license = await getLicense(key);

    if (!license) return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 200 });
    if (!license.active) return NextResponse.json({ valid: false, reason: 'revoked' }, { status: 200 });
    if (new Date(license.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'expired' }, { status: 200 });

    // IP binding: first use locks the IP forever
    if (!license.ip_locked || license.ip === '') {
      await bindIp(key, clientIp);
    } else if (license.ip !== clientIp) {
      return NextResponse.json({ valid: false, reason: 'ip_mismatch', bound_ip: license.ip }, { status: 200 });
    } else {
      await touchLicense(key);
    }

    const token = signToken(key, clientIp, new Date(license.expires_at));

    return NextResponse.json({
      valid: true,
      token,
      plan: license.plan,
      expires_at: license.expires_at,
    });
  } catch (e) {
    console.error('[validate]', e);
    return NextResponse.json({ valid: false, reason: 'server_error' }, { status: 500 });
  }
}
