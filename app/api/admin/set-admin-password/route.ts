/**
 * One-time admin endpoint to set admin password
 * POST /api/admin/set-admin-password
 * Body: { email: string, password: string }
 * 
 * This endpoint should be called once to set the admin password,
 * then can be removed or disabled in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql, initCustomers } from '@/lib/db';

function requireAdmin(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initCustomers();

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update customer password
    const result = await sql`
      UPDATE customers 
      SET password = ${hashedPassword}
      WHERE email = ${email}
      RETURNING id, email
    `;

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: `Customer not found: ${email}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password set for ${email}`,
      customer: {
        id: result[0].id,
        email: result[0].email
      }
    });

  } catch (error) {
    console.error('[admin/set-admin-password] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
