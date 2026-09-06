import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface ThreatData {
  id: number;
  type: string;
  identifier: string;
  source_license: string;
  timestamp: Date;
  confidence_score: number;
  report_count: number;
  created_at: Date;
  updated_at: Date;
}

export async function initThreatTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS minecraft_threats (
      id                SERIAL PRIMARY KEY,
      type              VARCHAR(32) NOT NULL,
      identifier        VARCHAR(255) NOT NULL,
      source_license    VARCHAR(64) NOT NULL REFERENCES minecraft_licenses(license_key) ON DELETE CASCADE,
      timestamp         BIGINT NOT NULL,
      confidence_score  NUMERIC(3,2) NOT NULL DEFAULT 0.5,
      report_count      INTEGER NOT NULL DEFAULT 1,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT unique_threat UNIQUE (type, identifier)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_threats_type 
    ON minecraft_threats(type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_threats_identifier 
    ON minecraft_threats(identifier)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_threats_updated 
    ON minecraft_threats(updated_at)
  `;

  // Clean up threats older than 30 days
  await sql`
    DELETE FROM minecraft_threats 
    WHERE updated_at < NOW() - INTERVAL '30 days'
  `;
}

export async function uploadThreats(
  licenseKey: string,
  threats: Array<{ type: string; identifier: string; timestamp: number }>
): Promise<number> {
  await initThreatTables();

  let uploadedCount = 0;

  for (const threat of threats) {
    try {
      // Check if threat already exists
      const existing = await sql`
        SELECT id, report_count, confidence_score 
        FROM minecraft_threats 
        WHERE type = ${threat.type} AND identifier = ${threat.identifier}
      `;

      if (existing.length > 0) {
        // Update existing threat - increase confidence and report count
        const newReportCount = existing[0].report_count + 1;
        const newConfidence = Math.min(0.99, existing[0].confidence_score + 0.05);

        await sql`
          UPDATE minecraft_threats
          SET 
            report_count = ${newReportCount},
            confidence_score = ${newConfidence},
            updated_at = NOW()
          WHERE type = ${threat.type} AND identifier = ${threat.identifier}
        `;
      } else {
        // Insert new threat
        await sql`
          INSERT INTO minecraft_threats (type, identifier, source_license, timestamp, confidence_score)
          VALUES (${threat.type}, ${threat.identifier}, ${licenseKey}, ${threat.timestamp}, 0.5)
        `;
      }

      uploadedCount++;
    } catch (error) {
      console.error('Error uploading threat:', error);
    }
  }

  return uploadedCount;
}

export async function downloadThreats(): Promise<{
  malicious_ips: string[];
  cheat_signatures: string[];
  total_threats: number;
  last_updated: number;
}> {
  await initThreatTables();

  // Get high-confidence threats (confidence >= 0.6) from last 7 days
  const threats = await sql`
    SELECT type, identifier, confidence_score, updated_at
    FROM minecraft_threats
    WHERE confidence_score >= 0.6
      AND updated_at >= NOW() - INTERVAL '7 days'
    ORDER BY confidence_score DESC, report_count DESC
    LIMIT 1000
  `;

  const maliciousIps: string[] = [];
  const cheatSignatures: string[] = [];
  let lastUpdated = 0;

  for (const threat of threats) {
    if (threat.type === 'IP') {
      maliciousIps.push(threat.identifier);
    } else if (threat.type === 'CHEAT_SIG') {
      cheatSignatures.push(threat.identifier);
    }

    const threatTime = new Date(threat.updated_at).getTime();
    if (threatTime > lastUpdated) {
      lastUpdated = threatTime;
    }
  }

  return {
    malicious_ips: maliciousIps,
    cheat_signatures: cheatSignatures,
    total_threats: threats.length,
    last_updated: lastUpdated || Date.now()
  };
}

export async function getThreatStats(): Promise<{
  total: number;
  ips: number;
  signatures: number;
  highConfidence: number;
}> {
  await initThreatTables();

  const total = await sql`
    SELECT COUNT(*) as count FROM minecraft_threats
  `;

  const ips = await sql`
    SELECT COUNT(*) as count FROM minecraft_threats WHERE type = 'IP'
  `;

  const signatures = await sql`
    SELECT COUNT(*) as count FROM minecraft_threats WHERE type = 'CHEAT_SIG'
  `;

  const highConfidence = await sql`
    SELECT COUNT(*) as count FROM minecraft_threats WHERE confidence_score >= 0.8
  `;

  return {
    total: Number(total[0]?.count || 0),
    ips: Number(ips[0]?.count || 0),
    signatures: Number(signatures[0]?.count || 0),
    highConfidence: Number(highConfidence[0]?.count || 0)
  };
}

export async function searchThreat(identifier: string): Promise<ThreatData | null> {
  await initThreatTables();

  const rows = await sql`
    SELECT * FROM minecraft_threats 
    WHERE identifier = ${identifier}
    ORDER BY confidence_score DESC
    LIMIT 1
  `;

  return (rows[0] as ThreatData) ?? null;
}
