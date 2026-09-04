import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { generateMinecraftLicense, getMinecraftLicense } from '@/lib/minecraft-db';

export async function POST() {
  try {
    const customerId = await getSession();
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingLicense = await getMinecraftLicense(customerId);
    if (existingLicense) {
      return NextResponse.json({ 
        license_key: existingLicense.license_key,
        already_exists: true 
      });
    }

    const licenseKey = await generateMinecraftLicense(customerId);

    return NextResponse.json({ 
      license_key: licenseKey,
      already_exists: false
    });
  } catch (error) {
    console.error('[minecraft/license/generate]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
