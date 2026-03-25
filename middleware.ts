import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_IP = '128.127.121.38';

// Routes that require IP allowlist
const PROTECTED = ['/admin', '/api/licenses', '/api/issue', '/api/reset-ip'];

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // /api/validate is intentionally NOT in PROTECTED — FiveM servers call it
  const ip = getIp(req);
  if (ip !== ALLOWED_IP) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/licenses/:path*', '/api/issue/:path*', '/api/reset-ip/:path*'],
};
