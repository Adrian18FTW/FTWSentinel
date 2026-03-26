import { NextRequest, NextResponse } from 'next/server';
import { getPlanAvailability, setPlanAvailability } from '@/lib/db';

export async function GET() {
  const availability = await getPlanAvailability();
  return NextResponse.json(availability);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { plan, available } = await req.json() as { plan: string; available: boolean };
  const validPlans = ['1month', '3month', '6month'];
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  }
  const updated = await setPlanAvailability(plan, available);
  return NextResponse.json(updated);
}
