import { NextRequest, NextResponse } from 'next/server';
import { validateMinecraftLicense } from '@/lib/minecraft-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, server_name, server_version } = body;

    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json({ 
        valid: false, 
        message: 'Invalid license key format' 
      }, { status: 400 });
    }

    if (!server_name || typeof server_name !== 'string') {
      return NextResponse.json({ 
        valid: false, 
        message: 'Server name required' 
      }, { status: 400 });
    }

    if (!server_version || typeof server_version !== 'string') {
      return NextResponse.json({ 
        valid: false, 
        message: 'Server version required' 
      }, { status: 400 });
    }

    const result = await validateMinecraftLicense(
      license_key,
      server_name,
      server_version
    );

    if (!result.valid) {
      return NextResponse.json({ 
        valid: false, 
        message: result.message 
      }, { status: 403 });
    }

    return NextResponse.json({ 
      valid: true,
      message: 'License validated successfully'
    });
  } catch (error) {
    console.error('[minecraft/license/validate]', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Server error' 
    }, { status: 500 });
  }
}
