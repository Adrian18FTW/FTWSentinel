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

export async function initCustomers() {
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id           SERIAL PRIMARY KEY,
      email        VARCHAR(255) NOT NULL UNIQUE,
      password     VARCHAR(255) NOT NULL,
      license_key  VARCHAR(64),
      suspended    BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  // Add suspended column if upgrading from older schema
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE`;
}

export async function createCustomer(email: string, password: string, licenseKey?: string) {
  const rows = await sql`
    INSERT INTO customers (email, password, license_key)
    VALUES (${email}, ${password}, ${licenseKey ?? null})
    RETURNING id, email, license_key, created_at
  `;
  return rows[0];
}

export async function getCustomerByEmail(email: string) {
  const rows = await sql`SELECT * FROM customers WHERE email = ${email} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getCustomerById(id: number) {
  const rows = await sql`SELECT id, email, license_key, created_at FROM customers WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAllCustomers() {
  return sql`SELECT id, email, license_key, suspended, created_at FROM customers ORDER BY created_at DESC`;
}

export async function setCustomerSuspended(id: number, suspended: boolean) {
  await sql`UPDATE customers SET suspended = ${suspended} WHERE id = ${id}`;
}

export async function deleteCustomer(id: number) {
  await sql`DELETE FROM customers WHERE id = ${id}`;
}

export async function linkCustomerLicense(customerId: number, licenseKey: string) {
  await sql`UPDATE customers SET license_key = ${licenseKey} WHERE id = ${customerId}`;
}

export async function isLicenseClaimed(licenseKey: string): Promise<boolean> {
  const rows = await sql`SELECT id FROM customers WHERE license_key = ${licenseKey} LIMIT 1`;
  return rows.length > 0;
}

export async function resetLicenseIp(id: number) {
  await sql`UPDATE licenses SET ip = '', ip_locked = FALSE WHERE id = ${id}`;
}

export async function activateLicense(id: number) {
  await sql`UPDATE licenses SET active = TRUE WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Validation log — keeps a record of every activation attempt from FiveM
// ---------------------------------------------------------------------------

export async function initValidateLog() {
  await sql`
    CREATE TABLE IF NOT EXISTS validate_log (
      id          SERIAL PRIMARY KEY,
      license_key VARCHAR(64)  NOT NULL,
      ip          VARCHAR(64)  NOT NULL,
      file        VARCHAR(256) NOT NULL DEFAULT '',
      result      VARCHAR(32)  NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  // Index on license_key for fast per-key history lookups
  await sql`
    CREATE INDEX IF NOT EXISTS validate_log_key_idx ON validate_log (license_key)
  `;
}

export async function logValidation(
  licenseKey: string,
  ip: string,
  file: string,
  result: string
) {
  await initValidateLog();
  await sql`
    INSERT INTO validate_log (license_key, ip, file, result)
    VALUES (${licenseKey}, ${ip}, ${file}, ${result})
  `;
}

export async function getValidateLog(licenseKey: string, limit = 50) {
  await initValidateLog();
  return sql`
    SELECT * FROM validate_log
    WHERE license_key = ${licenseKey}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export { sql };

