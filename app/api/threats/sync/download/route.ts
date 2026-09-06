import { NextRequest, NextResponse } from 'next/server';
import { validateMinecraftLicense } from '@/lib/minecraft-db';
import { downloadThreats } from '@/lib/threat-db';
import { checkRateLimit } from '@/lib/minecraft-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key } = body;

    // Validate license key
    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid license key' 
      }, { status: 400 });
    }

    // Rate limiting - 1 download per hour per license
    const rateLimitKey = `threat_download_${license_key}`;
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: 'Rate limit exceeded. Threat downloads limited to 1 per hour.' 
      }, { status: 429 });
    }

    // Validate license
    const validation = await validateMinecraftLicense(
      license_key,
      'Unknown',
      'Unknown'
    );

    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        message: validation.message 
      }, { status: 403 });
    }

    // Download global threat intelligence
    const threatData = await downloadThreats();

    return NextResponse.json({ 
      success: true,
      malicious_ips: threatData.malicious_ips,
      cheat_signatures: threatData.cheat_signatures,
      total_threats: threatData.total_threats,
      last_updated: threatData.last_updated
    });
  } catch (error) {
    console.error('[threats/sync/download]', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error' 
    }, { status: 500 });
  }
}
