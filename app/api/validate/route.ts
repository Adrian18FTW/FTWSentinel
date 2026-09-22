import { NextRequest, NextResponse } from 'next/server';
import { initDb, getLicense, bindIp, touchLicense, logValidation } from '@/lib/db';
import { signToken } from '@/lib/sign';
import { withRateLimit, verifyHmac } from '@/lib/rate-limit';
import { trackValidation, checkObfuscationBypass, executeAutoActions } from '@/lib/validation-tracking';

const HMAC_SECRET = process.env.HMAC_SECRET ?? process.env.SIGNING_SECRET ?? '';

export async function POST(req: NextRequest) {
  const rateLimited = await withRateLimit(req);
  if (rateLimited) return rateLimited;

  try {
    await initDb();

    const body = await req.json();
    const key = (body.key ?? body.license) as string | undefined;
    const ip = body.ip as string | undefined;
    const file = typeof body.file === 'string' ? body.file : undefined;
    const providedHmac = typeof body.hmac === 'string' ? body.hmac : '';

    if (!key || typeof key !== 'string' || key.length < 8) {
      return NextResponse.json({ valid: false, reason: 'missing_key', message: 'License key is required' }, { status: 400 });
    }

    if (HMAC_SECRET && providedHmac) {
      if (!verifyHmac('v1/validate', key, providedHmac)) {
        await logValidation(key, ip ?? 'unknown', file ?? '', 'hmac_failed');
        return NextResponse.json({ valid: false, reason: 'invalid_hmac', message: 'Request authentication failed' }, { status: 401 });
      }
    }

    // Use the IP from the request header if not provided (FiveM sends its own)
    const clientIp = ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    const license = await getLicense(key);

    if (!license) return NextResponse.json({ valid: false, reason: 'not_found', message: 'Unknown license' }, { status: 200 });
    if (!license.active) return NextResponse.json({ valid: false, reason: 'revoked', message: 'Revoked' }, { status: 200 });
    if (new Date(license.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'expired', message: 'License expired' }, { status: 200 });

    let message: string;

    // IP binding: first use locks the IP forever
    if (!license.ip_locked || license.ip === '') {
      await bindIp(key, clientIp);
      message = 'Activated';
      console.log(`[validate] License ${key} activated — bound to ${clientIp}${file ? ` (file: ${file})` : ''}`);
    } else if (license.ip !== clientIp) {
      console.warn(`[validate] IP mismatch for ${key} — bound: ${license.ip}, got: ${clientIp}${file ? ` (file: ${file})` : ''}`);
      return NextResponse.json({ valid: false, reason: 'ip_mismatch', message: `IP mismatch. Bound to ${license.ip}`, bound_ip: license.ip }, { status: 200 });
    } else {
      await touchLicense(key);
      message = 'Valid';
    }

    const token = signToken(key, clientIp, new Date(license.expires_at));
    
    await logValidation(key, clientIp, file ?? '', 'success');
    
    // Track license validation
    await trackValidation(key, clientIp, 'license', true);
    
    // Check for obfuscation bypass (license validated but obfuscation never called)
    const bypassDetected = await checkObfuscationBypass(key, clientIp);
    if (bypassDetected) {
      // Execute auto-actions (suspend/revoke)
      await executeAutoActions(key);
      
      // Return revoked status
      return NextResponse.json({ 
        valid: false, 
        reason: 'security_violation', 
        message: 'License suspended due to security violation' 
      }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      message,
      token,
      plan: license.plan,
      expires_at: license.expires_at,
    });
  } catch (e) {
    console.error('[validate]', e);
    return NextResponse.json({ valid: false, reason: 'server_error', message: 'Internal server error' }, { status: 500 });
  }
}
