import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL!);

interface ErrorReport {
  error: string;
  stackTrace: string;
  timestamp: number;
  resourceName: string;
  serverIp: string;
  file: string;
}

interface ErrorPayload {
  errors: ErrorReport[];
  serverIp: string;
  resourceName: string;
  sentAt: number;
}

// Initialize errors table
async function initErrorsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS sentinel_errors (
      id            SERIAL PRIMARY KEY,
      error         TEXT NOT NULL,
      stack_trace   TEXT NOT NULL,
      timestamp     BIGINT NOT NULL,
      resource_name VARCHAR(64) NOT NULL,
      server_ip     VARCHAR(64) NOT NULL,
      file          VARCHAR(255) NOT NULL,
      received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sentinel_errors_received 
    ON sentinel_errors(received_at DESC)
  `;
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sentinel_errors_server 
    ON sentinel_errors(server_ip)
  `;
}

// Simple HMAC verification to ensure requests come from legitimate FTWSentinel servers
function verifyAuth(authHeader: string, serverIp: string, resourceName: string): boolean {
  if (!authHeader) {
    return false;
  }
  
  try {
    const input = `${serverIp}:${resourceName}`;
    const expectedHmac = crypto
      .createHmac('sha256', 'sentinel_error_reporter')
      .update(input)
      .digest('hex');
    
    return authHeader === expectedHmac;
  } catch (err) {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    await initErrorsTable();
    
    const authHeader = req.headers.get('x-sentinel-auth');
    const body: ErrorPayload = await req.json();
    
    // Verify request authenticity
    if (!verifyAuth(authHeader || '', body.serverIp, body.resourceName)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid authentication' },
        { status: 401 }
      );
    }
    
    // Validate payload
    if (!body.errors || !Array.isArray(body.errors) || body.errors.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payload - no errors provided' },
        { status: 400 }
      );
    }
    
    // Insert errors into database
    for (const err of body.errors) {
      await sql`
        INSERT INTO sentinel_errors (error, stack_trace, timestamp, resource_name, server_ip, file)
        VALUES (
          ${err.error},
          ${err.stackTrace},
          ${err.timestamp},
          ${err.resourceName},
          ${err.serverIp},
          ${err.file}
        )
      `;
    }
    
    return NextResponse.json({
      success: true,
      received: body.errors.length,
      message: 'Errors recorded successfully'
    });
    
  } catch (error) {
    console.error('[Sentinel Errors] Failed to process error report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
