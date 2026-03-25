import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id          SERIAL PRIMARY KEY,
      key         VARCHAR(64)  NOT NULL UNIQUE,
      ip          VARCHAR(64)  NOT NULL DEFAULT '',
      ip_locked   BOOLEAN      NOT NULL DEFAULT FALSE,
      plan        VARCHAR(16)  NOT NULL DEFAULT '1month',
      expires_at  TIMESTAMPTZ  NOT NULL,
      active      BOOLEAN      NOT NULL DEFAULT TRUE,
      note        TEXT         NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      last_seen   TIMESTAMPTZ
    )
  `;
}

export async function getLicense(key: string) {
  const rows = await sql`SELECT * FROM licenses WHERE key = ${key} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAllLicenses() {
  return sql`SELECT * FROM licenses ORDER BY created_at DESC`;
}

export async function createLicense(key: string, plan: string, note: string) {
  const months = plan === '3month' ? 3 : plan === '6month' ? 6 : 1;
  const rows = await sql`
    INSERT INTO licenses (key, plan, expires_at, note)
    VALUES (
      ${key},
      ${plan},
      NOW() + (${months} || ' months')::INTERVAL,
      ${note}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function bindIp(key: string, ip: string) {
  await sql`
    UPDATE licenses
    SET ip = ${ip}, ip_locked = TRUE, last_seen = NOW()
    WHERE key = ${key}
  `;
}

export async function touchLicense(key: string) {
  await sql`UPDATE licenses SET last_seen = NOW() WHERE key = ${key}`;
}

export async function revokeLicense(id: number) {
  await sql`UPDATE licenses SET active = FALSE WHERE id = ${id}`;
}

export async function deleteLicense(id: number) {
  await sql`DELETE FROM licenses WHERE id = ${id}`;
}

export { sql };
