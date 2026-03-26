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

export async function initPlanAvailability() {
  await sql`
    CREATE TABLE IF NOT EXISTS plan_availability (
      plan      VARCHAR(16) PRIMARY KEY,
      available BOOLEAN     NOT NULL DEFAULT TRUE
    )
  `;
  // Seed defaults if empty
  await sql`
    INSERT INTO plan_availability (plan, available)
    VALUES ('1month', TRUE), ('3month', TRUE), ('6month', TRUE)
    ON CONFLICT (plan) DO NOTHING
  `;
}

export async function getPlanAvailability(): Promise<Record<string, boolean>> {
  await initPlanAvailability();
  const rows = await sql`SELECT plan, available FROM plan_availability`;
  const result: Record<string, boolean> = { '1month': true, '3month': true, '6month': true };
  for (const row of rows) result[row.plan] = row.available;
  return result;
}

export async function setPlanAvailability(plan: string, available: boolean): Promise<Record<string, boolean>> {
  await initPlanAvailability();
  await sql`
    INSERT INTO plan_availability (plan, available)
    VALUES (${plan}, ${available})
    ON CONFLICT (plan) DO UPDATE SET available = ${available}
  `;
  return getPlanAvailability();
}

export async function initCryptoOrders() {
  await sql`
    CREATE TABLE IF NOT EXISTS crypto_orders (
      id            SERIAL PRIMARY KEY,
      payment_id    VARCHAR(128) NOT NULL UNIQUE,
      plan          VARCHAR(16)  NOT NULL,
      email         TEXT         NOT NULL DEFAULT '',
      amount_usd    NUMERIC(10,2) NOT NULL,
      currency      VARCHAR(16)  NOT NULL,
      status        VARCHAR(32)  NOT NULL DEFAULT 'waiting',
      license_key   VARCHAR(64),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
}

export async function createCryptoOrder(
  paymentId: string,
  plan: string,
  email: string,
  amountUsd: number,
  currency: string
) {
  const rows = await sql`
    INSERT INTO crypto_orders (payment_id, plan, email, amount_usd, currency)
    VALUES (${paymentId}, ${plan}, ${email}, ${amountUsd}, ${currency})
    RETURNING *
  `;
  return rows[0];
}

export async function getCryptoOrder(paymentId: string) {
  const rows = await sql`SELECT * FROM crypto_orders WHERE payment_id = ${paymentId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function completeCryptoOrder(paymentId: string, licenseKey: string) {
  await sql`
    UPDATE crypto_orders
    SET status = 'finished', license_key = ${licenseKey}, updated_at = NOW()
    WHERE payment_id = ${paymentId}
  `;
}

export async function updateCryptoOrderStatus(paymentId: string, status: string) {
  await sql`
    UPDATE crypto_orders SET status = ${status}, updated_at = NOW()
    WHERE payment_id = ${paymentId}
  `;
}

export { sql };
