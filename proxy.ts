import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_IP = '128.127.120.93';

const PROTECTED = ['/admin', '/api/licenses', '/api/issue', '/api/reset-ip'];

function getIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return '0.0.0.0';
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  const isProtected = PROTECTED.some(p => 
    pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const ip = getIp(req);

  if (ip !== ALLOWED_IP) {
    return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  proxy: [
    '/admin/:path*',
    '/api/licenses/:path*',
    '/api/issue/:path*',
    '/api/reset-ip/:path*',
  ],
};