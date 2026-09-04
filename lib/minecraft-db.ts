import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface MinecraftLicense {
  id: number;
  customer_id: number;
  license_key: string;
  created_at: Date;
  last_validated: Date | null;
  server_name: string;
  server_version: string;
  is_active: boolean;
}

export interface MinecraftStats {
  id: number;
  customer_id: number;
  license_key: string;
  total_checks: bigint;
  total_violations: bigint;
  total_bans: number;
  total_kicks: number;
  players_monitored: number;
  checks_per_second: number;
  uptime_seconds: bigint;
  server_tps: number;
  killaura_violations: number;
  reach_violations: number;
  fly_violations: number;
  speed_violations: number;
  criticals_violations: number;
  velocity_violations: number;
  autoclick_violations: number;
  jesus_violations: number;
  nofall_violations: number;
  step_violations: number;
  spider_violations: number;
  regeneration_violations: number;
  fasteat_violations: number;
  inventory_violations: number;
  fastbreak_violations: number;
  fastplace_violations: number;
  blockreach_violations: number;
  nuker_violations: number;
  scaffold_violations: number;
  badpackets_violations: number;
  timer_violations: number;
  pingspoof_violations: number;
  updated_at: Date;
}

export async function initMinecraftTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS minecraft_licenses (
      id               SERIAL PRIMARY KEY,
      customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      license_key      VARCHAR(64) NOT NULL UNIQUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_validated   TIMESTAMPTZ,
      server_name      VARCHAR(255) NOT NULL DEFAULT '',
      server_version   VARCHAR(64) NOT NULL DEFAULT '',
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT unique_customer_mc_license UNIQUE (customer_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mc_licenses_customer 
    ON minecraft_licenses(customer_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mc_licenses_key 
    ON minecraft_licenses(license_key)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS minecraft_stats (
      id                      SERIAL PRIMARY KEY,
      customer_id             INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      license_key             VARCHAR(64) NOT NULL REFERENCES minecraft_licenses(license_key) ON DELETE CASCADE,
      total_checks            BIGINT NOT NULL DEFAULT 0,
      total_violations        BIGINT NOT NULL DEFAULT 0,
      total_bans              INTEGER NOT NULL DEFAULT 0,
      total_kicks             INTEGER NOT NULL DEFAULT 0,
      players_monitored       INTEGER NOT NULL DEFAULT 0,
      checks_per_second       NUMERIC(10,2) NOT NULL DEFAULT 0,
      uptime_seconds          BIGINT NOT NULL DEFAULT 0,
      server_tps              NUMERIC(5,2) NOT NULL DEFAULT 20.0,
      killaura_violations     INTEGER NOT NULL DEFAULT 0,
      reach_violations        INTEGER NOT NULL DEFAULT 0,
      fly_violations          INTEGER NOT NULL DEFAULT 0,
      speed_violations        INTEGER NOT NULL DEFAULT 0,
      criticals_violations    INTEGER NOT NULL DEFAULT 0,
      velocity_violations     INTEGER NOT NULL DEFAULT 0,
      autoclick_violations    INTEGER NOT NULL DEFAULT 0,
      jesus_violations        INTEGER NOT NULL DEFAULT 0,
      nofall_violations       INTEGER NOT NULL DEFAULT 0,
      step_violations         INTEGER NOT NULL DEFAULT 0,
      spider_violations       INTEGER NOT NULL DEFAULT 0,
      regeneration_violations INTEGER NOT NULL DEFAULT 0,
      fasteat_violations      INTEGER NOT NULL DEFAULT 0,
      inventory_violations    INTEGER NOT NULL DEFAULT 0,
      fastbreak_violations    INTEGER NOT NULL DEFAULT 0,
      fastplace_violations    INTEGER NOT NULL DEFAULT 0,
      blockreach_violations   INTEGER NOT NULL DEFAULT 0,
      nuker_violations        INTEGER NOT NULL DEFAULT 0,
      scaffold_violations     INTEGER NOT NULL DEFAULT 0,
      badpackets_violations   INTEGER NOT NULL DEFAULT 0,
      timer_violations        INTEGER NOT NULL DEFAULT 0,
      pingspoof_violations    INTEGER NOT NULL DEFAULT 0,
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_customer_stats UNIQUE (customer_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mc_stats_customer 
    ON minecraft_stats(customer_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mc_stats_license 
    ON minecraft_stats(license_key)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS minecraft_players (
      id               SERIAL PRIMARY KEY,
      customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      license_key      VARCHAR(64) NOT NULL REFERENCES minecraft_licenses(license_key) ON DELETE CASCADE,
      player_name      VARCHAR(16) NOT NULL,
      total_violations INTEGER NOT NULL DEFAULT 0,
      is_banned        BOOLEAN NOT NULL DEFAULT FALSE,
      last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_customer_player UNIQUE (customer_id, player_name)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mc_players_customer 
    ON minecraft_players(customer_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mc_players_license 
    ON minecraft_players(license_key)
  `;
}

export async function generateMinecraftLicense(customerId: number): Promise<string> {
  await initMinecraftTables();
  
  const existing = await sql`
    SELECT license_key FROM minecraft_licenses WHERE customer_id = ${customerId}
  `;
  
  if (existing.length > 0) {
    return existing[0].license_key;
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = 'MC-';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) key += '-';
  }

  const rows = await sql`
    INSERT INTO minecraft_licenses (customer_id, license_key)
    VALUES (${customerId}, ${key})
    RETURNING license_key
  `;

  await sql`
    INSERT INTO minecraft_stats (customer_id, license_key)
    VALUES (${customerId}, ${key})
  `;

  return rows[0].license_key;
}

export async function getMinecraftLicense(customerId: number): Promise<MinecraftLicense | null> {
  await initMinecraftTables();
  const rows = await sql`
    SELECT * FROM minecraft_licenses WHERE customer_id = ${customerId}
  `;
  return rows[0] ?? null;
}

export async function validateMinecraftLicense(
  licenseKey: string,
  serverName: string,
  serverVersion: string
): Promise<{ valid: boolean; customerId?: number; message?: string }> {
  await initMinecraftTables();

  const rows = await sql`
    SELECT ml.*, c.suspended
    FROM minecraft_licenses ml
    JOIN customers c ON ml.customer_id = c.id
    WHERE ml.license_key = ${licenseKey}
  `;

  if (rows.length === 0) {
    return { valid: false, message: 'License key not found' };
  }

  const license = rows[0];

  if (license.suspended) {
    return { valid: false, message: 'Account suspended' };
  }

  if (!license.is_active) {
    return { valid: false, message: 'License deactivated' };
  }

  await sql`
    UPDATE minecraft_licenses
    SET last_validated = NOW(),
        server_name = ${serverName},
        server_version = ${serverVersion}
    WHERE license_key = ${licenseKey}
  `;

  return { valid: true, customerId: license.customer_id };
}

export async function updateMinecraftStats(
  licenseKey: string,
  stats: {
    total_checks: number;
    total_violations: number;
    total_bans: number;
    total_kicks: number;
    players_monitored: number;
    checks_per_second: number;
    uptime_seconds: number;
    server_tps: number;
    check_violations: Record<string, number>;
  }
): Promise<boolean> {
  await initMinecraftTables();

  const checkViolations = stats.check_violations;

  try {
    await sql`
      UPDATE minecraft_stats
      SET 
        total_checks = ${stats.total_checks},
        total_violations = ${stats.total_violations},
        total_bans = ${stats.total_bans},
        total_kicks = ${stats.total_kicks},
        players_monitored = ${stats.players_monitored},
        checks_per_second = ${stats.checks_per_second},
        uptime_seconds = ${stats.uptime_seconds},
        server_tps = ${stats.server_tps},
        killaura_violations = ${checkViolations.killaura || 0},
        reach_violations = ${checkViolations.reach || 0},
        fly_violations = ${checkViolations.fly || 0},
        speed_violations = ${checkViolations.speed || 0},
        criticals_violations = ${checkViolations.criticals || 0},
        velocity_violations = ${checkViolations.velocity || 0},
        autoclick_violations = ${checkViolations.autoclick || 0},
        jesus_violations = ${checkViolations.jesus || 0},
        nofall_violations = ${checkViolations.nofall || 0},
        step_violations = ${checkViolations.step || 0},
        spider_violations = ${checkViolations.spider || 0},
        regeneration_violations = ${checkViolations.regeneration || 0},
        fasteat_violations = ${checkViolations.fasteat || 0},
        inventory_violations = ${checkViolations.inventory || 0},
        fastbreak_violations = ${checkViolations.fastbreak || 0},
        fastplace_violations = ${checkViolations.fastplace || 0},
        blockreach_violations = ${checkViolations.blockreach || 0},
        nuker_violations = ${checkViolations.nuker || 0},
        scaffold_violations = ${checkViolations.scaffold || 0},
        badpackets_violations = ${checkViolations.badpackets || 0},
        timer_violations = ${checkViolations.timer || 0},
        pingspoof_violations = ${checkViolations.pingspoof || 0},
        updated_at = NOW()
      WHERE license_key = ${licenseKey}
    `;
    return true;
  } catch (error) {
    console.error('Error updating Minecraft stats:', error);
    return false;
  }
}

export async function getMinecraftStats(customerId: number): Promise<MinecraftStats | null> {
  await initMinecraftTables();
  const rows = await sql`
    SELECT * FROM minecraft_stats WHERE customer_id = ${customerId}
  `;
  return rows[0] ?? null;
}

export async function updateMinecraftPlayers(
  licenseKey: string,
  customerId: number,
  players: Array<{ name: string; violations: number; banned: boolean }>
): Promise<void> {
  await initMinecraftTables();

  for (const player of players) {
    await sql`
      INSERT INTO minecraft_players (customer_id, license_key, player_name, total_violations, is_banned, last_seen)
      VALUES (${customerId}, ${licenseKey}, ${player.name}, ${player.violations}, ${player.banned}, NOW())
      ON CONFLICT (customer_id, player_name)
      DO UPDATE SET
        total_violations = ${player.violations},
        is_banned = ${player.banned},
        last_seen = NOW()
    `;
  }
}

export async function getMinecraftPlayers(customerId: number, limit = 100) {
  await initMinecraftTables();
  return sql`
    SELECT player_name, total_violations, is_banned, last_seen
    FROM minecraft_players
    WHERE customer_id = ${customerId}
    ORDER BY last_seen DESC
    LIMIT ${limit}
  `;
}

export async function deactivateMinecraftLicense(customerId: number): Promise<void> {
  await initMinecraftTables();
  await sql`
    UPDATE minecraft_licenses
    SET is_active = FALSE
    WHERE customer_id = ${customerId}
  `;
}

export async function reactivateMinecraftLicense(customerId: number): Promise<void> {
  await initMinecraftTables();
  await sql`
    UPDATE minecraft_licenses
    SET is_active = TRUE
    WHERE customer_id = ${customerId}
  `;
}
