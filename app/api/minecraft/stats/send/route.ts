import { NextRequest, NextResponse } from 'next/server';
import { validateMinecraftLicense, updateMinecraftStats, updateMinecraftPlayers } from '@/lib/minecraft-db';
import { checkRateLimit } from '@/lib/minecraft-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      license_key,
      total_checks,
      total_violations,
      total_bans,
      total_kicks,
      players_monitored,
      checks_per_second,
      uptime_seconds,
      server_tps,
      check_violations,
      players
    } = body;

    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid license key' 
      }, { status: 400 });
    }

    const rateLimit = checkRateLimit(license_key);
    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: 'Rate limit exceeded. Try again later.' 
      }, { status: 429 });
    }

    const validation = await validateMinecraftLicense(
      license_key,
      body.server_name || 'Unknown',
      body.server_version || 'Unknown'
    );

    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        message: validation.message 
      }, { status: 403 });
    }

    const statsData = {
      total_checks: Number(total_checks) || 0,
      total_violations: Number(total_violations) || 0,
      total_bans: Number(total_bans) || 0,
      total_kicks: Number(total_kicks) || 0,
      players_monitored: Number(players_monitored) || 0,
      checks_per_second: Number(checks_per_second) || 0,
      uptime_seconds: Number(uptime_seconds) || 0,
      server_tps: Number(server_tps) || 20.0,
      check_violations: check_violations || {}
    };

    const success = await updateMinecraftStats(license_key, statsData);

    if (!success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to update stats' 
      }, { status: 500 });
    }

    if (players && Array.isArray(players) && players.length > 0 && validation.customerId) {
      await updateMinecraftPlayers(license_key, validation.customerId, players);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Stats updated successfully'
    });
  } catch (error) {
    console.error('[minecraft/stats/send]', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error' 
    }, { status: 500 });
  }
}
