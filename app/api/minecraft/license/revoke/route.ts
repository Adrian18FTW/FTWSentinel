import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { deactivateMinecraftLicense } from '@/lib/minecraft-db';

export async function POST() {
  try {
    const customerId = await getSession();
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deactivateMinecraftLicense(customerId);

    return NextResponse.json({ 
      success: true,
      message: 'License deactivated successfully'
    });
  } catch (error) {
    console.error('[minecraft/license/revoke]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
