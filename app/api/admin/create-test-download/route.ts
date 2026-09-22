/**
 * Admin endpoint to create a test download record for a customer
 * POST /api/admin/create-test-download
 * Body: { email: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, initDb, initCustomers } from '@/lib/db';
import crypto from 'crypto';

function requireAdmin(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initDb();
    await initCustomers();
    
    // Initialize downloads table
    await sql`
      CREATE TABLE IF NOT EXISTS downloads (
        id                SERIAL PRIMARY KEY,
        customer_id       INTEGER      NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        obfuscation_key   VARCHAR(64)  NOT NULL,
        ip_address        VARCHAR(64)  NOT NULL,
        resource_hash     VARCHAR(128),
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `;

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email' },
        { status: 400 }
      );
    }

    // 1. Find customer by email
    const customerRows = await sql`
      SELECT id, email, license_key FROM customers WHERE email = ${email} LIMIT 1
    `;

    if (!customerRows || customerRows.length === 0) {
      return NextResponse.json(
        { error: `Customer not found: ${email}` },
        { status: 404 }
      );
    }

    const customer = customerRows[0];

    if (!customer.license_key) {
      return NextResponse.json(
        { error: 'Customer does not have a license key allocated' },
        { status: 400 }
      );
    }

    // 2. Generate obfuscation key
    const obfuscationKey = crypto.randomBytes(32).toString('hex');

    // 3. Create download record
    const downloadRows = await sql`
      INSERT INTO downloads (
        customer_id,
        obfuscation_key,
        ip_address,
        resource_hash,
        created_at
      )
      VALUES (
        ${customer.id},
        ${obfuscationKey},
        '127.0.0.1',
        'test_hash_' || ${Date.now()},
        NOW()
      )
      RETURNING *
    `;

    const download = downloadRows[0];

    return NextResponse.json({
      success: true,
      message: `Test download record created for ${email}`,
      customer: {
        id: customer.id,
        email: customer.email,
        license_key: customer.license_key
      },
      download: {
        id: download.id,
        obfuscation_key: obfuscationKey,
        created_at: download.created_at
      },
      note: 'This is a test download record. The obfuscation key can now be used for validation.'
    });

  } catch (error) {
    console.error('[admin/create-test-download] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
