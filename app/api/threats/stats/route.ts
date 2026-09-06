import { NextRequest, NextResponse } from 'next/server';
import { getThreatStats } from '@/lib/threat-db';

export async function GET(req: NextRequest) {
  try {
    const stats = await getThreatStats();

    return NextResponse.json({ 
      success: true,
      stats: {
        total_threats: stats.total,
        malicious_ips: stats.ips,
        cheat_signatures: stats.signatures,
        high_confidence: stats.highConfidence
      }
    });
  } catch (error) {
    console.error('[threats/stats]', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error' 
    }, { status: 500 });
  }
}
