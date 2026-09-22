/**
 * Script to allocate a license to a customer
 * Usage: npx tsx scripts/allocate-license.ts <email> <license_key>
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { sql } from '@/lib/db';

async function allocateLicense(email: string, licenseKey: string) {
  console.log(`\nAllocating license ${licenseKey} to ${email}...`);

  // 1. Find customer by email
  const customerRows = await sql`
    SELECT id, email, license_key FROM customers WHERE email = ${email} LIMIT 1
  `;

  if (!customerRows || customerRows.length === 0) {
    console.error(`❌ Customer not found: ${email}`);
    process.exit(1);
  }

  const customer = customerRows[0];
  console.log(`✓ Found customer: ID ${customer.id}, Email: ${customer.email}`);

  if (customer.license_key) {
    console.log(`⚠️  Customer already has license: ${customer.license_key}`);
    console.log(`   This will be replaced with: ${licenseKey}`);
  }

  // 2. Verify license exists
  const licenseRows = await sql`
    SELECT id, key, active, expires_at FROM licenses WHERE key = ${licenseKey} LIMIT 1
  `;

  if (!licenseRows || licenseRows.length === 0) {
    console.error(`❌ License not found: ${licenseKey}`);
    process.exit(1);
  }

  const license = licenseRows[0];
  console.log(`✓ Found license: ID ${license.id}, Active: ${license.active}, Expires: ${license.expires_at}`);

  // 3. Check if license is already claimed by another customer
  const claimedRows = await sql`
    SELECT id, email FROM customers WHERE license_key = ${licenseKey} AND id != ${customer.id} LIMIT 1
  `;

  if (claimedRows && claimedRows.length > 0) {
    console.error(`❌ License already claimed by: ${claimedRows[0].email} (ID: ${claimedRows[0].id})`);
    process.exit(1);
  }

  // 4. Link license to customer
  await sql`
    UPDATE customers SET license_key = ${licenseKey} WHERE id = ${customer.id}
  `;

  console.log(`✅ License ${licenseKey} successfully allocated to ${email}`);
  console.log(`\nNext step: Customer needs to download the obfuscated build from the customer portal`);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: npx tsx scripts/allocate-license.ts <email> <license_key>');
  console.error('Example: npx tsx scripts/allocate-license.ts admin@ftwsentinel.com FTWAC-8BE0-7D31-4CE3-6A76');
  process.exit(1);
}

const [email, licenseKey] = args;
allocateLicense(email, licenseKey)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
