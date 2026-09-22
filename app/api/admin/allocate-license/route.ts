/**
 * Admin endpoint to allocate a license to a customer
 * POST /api/admin/allocate-license
 * Body: { email: string, license_key: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, initDb, initCustomers } from '@/lib/db';

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

    const { email, license_key } = await req.json();

    if (!email || !license_key) {
      return NextResponse.json(
        { error: 'Missing email or license_key' },
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

    // 2. Verify license exists
    const licenseRows = await sql`
      SELECT id, key, active, expires_at FROM licenses WHERE key = ${license_key} LIMIT 1
    `;

    if (!licenseRows || licenseRows.length === 0) {
      return NextResponse.json(
        { error: `License not found: ${license_key}` },
        { status: 404 }
      );
    }

    const license = licenseRows[0];

    // 3. Check if license is already claimed by another customer
    const claimedRows = await sql`
      SELECT id, email FROM customers 
      WHERE license_key = ${license_key} AND id != ${customer.id} 
      LIMIT 1
    `;

    if (claimedRows && claimedRows.length > 0) {
      return NextResponse.json(
        { 
          error: `License already claimed by: ${claimedRows[0].email} (ID: ${claimedRows[0].id})` 
        },
        { status: 409 }
      );
    }

    // 4. Link license to customer
    await sql`
      UPDATE customers SET license_key = ${license_key} WHERE id = ${customer.id}
    `;

    return NextResponse.json({
      success: true,
      message: `License ${license_key} allocated to ${email}`,
      customer: {
        id: customer.id,
        email: customer.email,
        previous_license: customer.license_key,
        new_license: license_key
      },
      license: {
        id: license.id,
        active: license.active,
        expires_at: license.expires_at
      },
      next_step: 'Customer needs to download the obfuscated build from the customer portal'
    });

  } catch (error) {
    console.error('[admin/allocate-license] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
