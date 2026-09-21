/**
 * Runtime Validation Endpoint for Obfuscation Key Retrieval
 * 
 * This endpoint is called by FTWSentinel on resource start to retrieve
 * the deobfuscation key needed to decrypt customer-specific builds.
 * 
 * POST /api/sentinel/validate
 * Body: {
 *   license_key: string,
 *   server_ip: string,
 *   resource_hash?: string,
 *   timestamp: number
 * }
 * 
 * Returns: {
 *   success: boolean,
 *   deobfuscation_key?: string,
 *   ttl?: number,
 *   key_expiry?: number,
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initDb,
  getLicense,
  getCustomerByEmail,
  getLatestDownload,
  logSecurityEvent,
  isLicenseClaimed
} from '@/lib/db';
import { withRateLimit } from '@/lib/rate-limit';

const KEY_TTL_SECONDS = 3600; // 1 hour

export async function POST(req: NextRequest) {
  // Rate limiting (prevent brute force)
  const rateLimited = await withRateLimit(req);
  if (rateLimited) return rateLimited;

  try {
    await initDb();

    const body = await req.json();
    const {
      license_key,
      server_ip,
      resource_hash,
      timestamp
    } = body;

    // Basic validation
    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid license_key' },
        { status: 400 }
      );
    }

    if (!server_ip || typeof server_ip !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid server_ip' },
        { status: 400 }
      );
    }

    // 1. Validate license key
    const license = await getLicense(license_key);

    if (!license) {
      await logSecurityEvent(
        'KEY_REQUEST_INVALID_LICENSE',
        { license_key, server_ip, timestamp },
        server_ip
      );
      
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive license' },
        { status: 403 }
      );
    }

    if (!license.active) {
      await logSecurityEvent(
        'KEY_REQUEST_INACTIVE_LICENSE',
        { license_key, server_ip, timestamp },
        server_ip
      );
      
      return NextResponse.json(
        { success: false, error: 'License is not active' },
        { status: 403 }
      );
    }

    // Check expiration
    if (new Date(license.expires_at) < new Date()) {
      await logSecurityEvent(
        'KEY_REQUEST_EXPIRED_LICENSE',
        { license_key, server_ip, expires_at: license.expires_at },
        server_ip
      );
      
      return NextResponse.json(
        { success: false, error: 'License has expired' },
        { status: 403 }
      );
    }

    // 2. Check if license is bound to a specific server IP
    if (license.ip_locked && license.ip && license.ip !== server_ip) {
      await logSecurityEvent(
        'KEY_REQUEST_IP_MISMATCH',
        { 
          license_key, 
          bound_ip: license.ip, 
          request_ip: server_ip,
          timestamp 
        },
        server_ip
      );
      
      return NextResponse.json(
        { 
          success: false, 
          error: `License is bound to IP ${license.ip}. Current IP: ${server_ip}` 
        },
        { status: 403 }
      );
    }

    // 3. Find the customer who owns this license
    const isClaimed = await isLicenseClaimed(license_key);
    
    if (!isClaimed) {
      await logSecurityEvent(
        'KEY_REQUEST_UNCLAIMED_LICENSE',
        { license_key, server_ip },
        server_ip
      );
      
      return NextResponse.json(
        { success: false, error: 'License not claimed by any customer' },
        { status: 404 }
      );
    }

    // 4. Get the customer's latest download record
    // We need to query by license key to find the customer
    const customers = await getLicense(license_key).then(async (lic) => {
      if (!lic) return null;
      // Query all customers and find the one with this license
      const { sql } = await import('@/lib/db');
      const rows = await sql`
        SELECT id FROM customers WHERE license_key = ${license_key} LIMIT 1
      `;
      return rows[0] || null;
    });

    if (!customers) {
      await logSecurityEvent(
        'KEY_REQUEST_NO_CUSTOMER',
        { license_key, server_ip },
        server_ip
      );
      
      return NextResponse.json(
        { success: false, error: 'Customer record not found' },
        { status: 404 }
      );
    }

    const download = await getLatestDownload(customers.id);

    if (!download) {
      await logSecurityEvent(
        'KEY_REQUEST_NO_DOWNLOAD',
        { customer_id: customers.id, license_key, server_ip },
        server_ip,
        customers.id
      );
      
      return NextResponse.json(
        { success: false, error: 'No download record found for customer' },
        { status: 404 }
      );
    }

    // 5. Optional: Verify resource hash matches
    if (resource_hash && download.resource_hash) {
      if (resource_hash !== download.resource_hash) {
        await logSecurityEvent(
          'HASH_MISMATCH',
          { 
            expected: download.resource_hash, 
            received: resource_hash,
            customer_id: customers.id,
            license_key,
            server_ip
          },
          server_ip,
          customers.id,
          license_key
        );
        
        return NextResponse.json(
          { 
            success: false, 
            error: 'Resource integrity check failed. Build may be tampered.' 
          },
          { status: 403 }
        );
      }
    }

    // 6. Log successful validation
    await logSecurityEvent(
      'KEY_REQUEST_SUCCESS',
      { 
        customer_id: customers.id,
        license_key,
        server_ip,
        download_id: download.id,
        timestamp
      },
      server_ip,
      customers.id,
      license_key
    );

    // 7. Return deobfuscation key with TTL
    const now = Date.now();
    const keyExpiry = now + (KEY_TTL_SECONDS * 1000);

    return NextResponse.json({
      success: true,
      deobfuscation_key: download.obfuscation_key,
      ttl: KEY_TTL_SECONDS,
      key_expiry: keyExpiry
    });

  } catch (error) {
    console.error('[sentinel/validate] Error:', error);
    
    // Log the error without exposing details to client
    await logSecurityEvent(
      'KEY_REQUEST_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    );
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
