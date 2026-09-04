import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMinecraftStats, getMinecraftLicense, getMinecraftPlayers } from '@/lib/minecraft-db';

export async function GET() {
  try {
    const customerId = await getSession();
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const license = await getMinecraftLicense(customerId);
    if (!license) {
      return NextResponse.json({ 
        license: null,
        stats: null,
        players: []
      });
    }

    const stats = await getMinecraftStats(customerId);
    const players = await getMinecraftPlayers(customerId, 50);

    return NextResponse.json({ 
      license: {
        key: license.license_key,
        created_at: license.created_at,
        last_validated: license.last_validated,
        server_name: license.server_name,
        server_version: license.server_version,
        is_active: license.is_active
      },
      stats: stats ? {
        total_checks: Number(stats.total_checks),
        total_violations: Number(stats.total_violations),
        total_bans: stats.total_bans,
        total_kicks: stats.total_kicks,
        players_monitored: stats.players_monitored,
        checks_per_second: Number(stats.checks_per_second),
        uptime_seconds: Number(stats.uptime_seconds),
        server_tps: Number(stats.server_tps),
        check_violations: {
          killaura: stats.killaura_violations,
          reach: stats.reach_violations,
          fly: stats.fly_violations,
          speed: stats.speed_violations,
          criticals: stats.criticals_violations,
          velocity: stats.velocity_violations,
          autoclick: stats.autoclick_violations,
          jesus: stats.jesus_violations,
          nofall: stats.nofall_violations,
          step: stats.step_violations,
          spider: stats.spider_violations,
          regeneration: stats.regeneration_violations,
          fasteat: stats.fasteat_violations,
          inventory: stats.inventory_violations,
          fastbreak: stats.fastbreak_violations,
          fastplace: stats.fastplace_violations,
          blockreach: stats.blockreach_violations,
          nuker: stats.nuker_violations,
          scaffold: stats.scaffold_violations,
          badpackets: stats.badpackets_violations,
          timer: stats.timer_violations,
          pingspoof: stats.pingspoof_violations
        },
        updated_at: stats.updated_at
      } : null,
      players: players.map(p => ({
        name: p.player_name,
        violations: p.total_violations,
        banned: p.is_banned,
        last_seen: p.last_seen
      }))
    });
  } catch (error) {
    console.error('[minecraft/stats]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
