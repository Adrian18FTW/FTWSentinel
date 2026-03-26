import { NextRequest, NextResponse } from 'next/server';

// In-memory store (persists per server process)
// Replace with DB/KV if you need persistence across restarts
const availability: Record<string, boolean> = {
  '1month': true,
  '3month': true,
  '6month': true,
};

export async function GET() {
  return NextResponse.json(availability);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { plan, available } = body as { plan: string; available: boolean };
  if (!(plan in availability)) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  }
  availability[plan] = available;
  return NextResponse.json(availability);
}
