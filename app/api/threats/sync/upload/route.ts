import { NextRequest, NextResponse } from 'next/server';
import { validateMinecraftLicense } from '@/lib/minecraft-db';
import { uploadThreats } from '@/lib/threat-db';
import { checkRateLimit } from '@/lib/minecraft-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, server_id, threats } = body;

    // Validate license key
    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid license key' 
      }, { status: 400 });
    }

    // Rate limiting - 1 upload per hour per license
    const rateLimitKey = `threat_upload_${license_key}`;
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: 'Rate limit exceeded. Threat uploads limited to 1 per hour.' 
      }, { status: 429 });
    }

    // Validate license
    const validation = await validateMinecraftLicense(
      license_key,
      server_id || 'Unknown',
      'Unknown'
    );

    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        message: validation.message 
      }, { status: 403 });
    }

    // Validate threats array
    if (!threats || !Array.isArray(threats)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Threats array required' 
      }, { status: 400 });
    }

    // Limit batch size to 100
    const threatsToUpload = threats.slice(0, 100);

    // Validate threat structure
    for (const threat of threatsToUpload) {
      if (!threat.type || !threat.identifier || !threat.timestamp) {
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid threat data structure' 
        }, { status: 400 });
      }
    }

    // Upload threats to database
    const uploadedCount = await uploadThreats(license_key, threatsToUpload);

    return NextResponse.json({ 
      success: true,
      uploaded: uploadedCount,
      message: `Successfully uploaded ${uploadedCount} threats`
    });
  } catch (error) {
    console.error('[threats/sync/upload]', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error' 
    }, { status: 500 });
  }
}
