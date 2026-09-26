/**
 * Admin Customer License Renewal Endpoint
 * 
 * POST /api/admin/customers/renew
 * Headers: { 'x-admin-secret': string }
 * Body: { customerId: number, period: '1month' | '3month' | '6month' }
 * 
 * Extends the customer's license expiry date by the specified period
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

// Period durations in milliseconds
const PERIOD_DURATIONS = {
  '1month': 30 * 24 * 60 * 60 * 1000,
  '3month': 90 * 24 * 60 * 60 * 1000,
  '6month': 180 * 24 * 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    // Verify admin secret
    const secret = req.headers.get('x-admin-secret');
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, period } = await req.json();

    // Validate inputs
    if (!customerId || typeof customerId !== 'number') {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    if (!period || !PERIOD_DURATIONS[period as keyof typeof PERIOD_DURATIONS]) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    // Get customer and their license
    const customers = await sql`
      SELECT id, license_key FROM customers WHERE id = ${customerId}
    `;

    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];

    if (!customer.license_key) {
      return NextResponse.json({ error: 'Customer has no license' }, { status: 400 });
    }

    // Get the license details
    const licenses = await sql`
      SELECT id, expires_at, active FROM licenses WHERE key = ${customer.license_key}
    `;

    if (licenses.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    const license = licenses[0];

    // Calculate new expiry date
    // If license is expired, start from now. If active, extend from current expiry
    const currentExpiry = new Date(license.expires_at);
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;
    
    const durationMs = PERIOD_DURATIONS[period as keyof typeof PERIOD_DURATIONS];
    const newExpiry = new Date(baseDate.getTime() + durationMs);

    // Update license
    await sql`
      UPDATE licenses 
      SET expires_at = ${newExpiry.toISOString()},
          active = true,
          plan = ${period}
      WHERE id = ${license.id}
    `;

    console.log(`[admin/customers/renew] Extended license ${customer.license_key} by ${period} (customer: ${customerId})`);

    return NextResponse.json({ 
      success: true,
      newExpiry: newExpiry.toISOString(),
      message: `License extended by ${period.replace('month', ' month(s)')}`
    });

  } catch (error) {
    console.error('[admin/customers/renew] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
