import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const ERRORS_DIR = join(process.cwd(), 'data');
const ERRORS_FILE = join(ERRORS_DIR, 'sentinel_errors.json');

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

interface StoredError extends ErrorReport {
  id: string;
  receivedAt: number;
}

// Simple HMAC verification to ensure requests come from legitimate FTWSentinel servers
function verifyAuth(authHeader: string, serverIp: string, resourceName: string): boolean {
  if (!authHeader) return false;
  
  try {
    const expectedHmac = crypto
      .createHmac('sha256', 'sentinel_error_reporter')
      .update(`${serverIp}:${resourceName}`)
      .digest('hex');
    
    return authHeader === expectedHmac;
  } catch {
    return false;
  }
}

async function ensureErrorsFile(): Promise<void> {
  if (!existsSync(ERRORS_DIR)) {
    await mkdir(ERRORS_DIR, { recursive: true });
  }
  
  if (!existsSync(ERRORS_FILE)) {
    await writeFile(ERRORS_FILE, JSON.stringify({ errors: [] }, null, 2));
  }
}

async function readErrors(): Promise<StoredError[]> {
  await ensureErrorsFile();
  const content = await readFile(ERRORS_FILE, 'utf-8');
  const data = JSON.parse(content);
  return data.errors || [];
}

async function writeErrors(errors: StoredError[]): Promise<void> {
  await ensureErrorsFile();
  await writeFile(ERRORS_FILE, JSON.stringify({ errors }, null, 2));
}

export async function POST(req: NextRequest) {
  try {
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
    
    // Read existing errors
    const existingErrors = await readErrors();
    
    // Add new errors with unique IDs
    const newErrors: StoredError[] = body.errors.map(err => ({
      ...err,
      id: crypto.randomBytes(8).toString('hex'),
      receivedAt: Date.now(),
    }));
    
    // Prepend new errors (most recent first) and limit to 10,000 total
    const updatedErrors = [...newErrors, ...existingErrors].slice(0, 10000);
    
    // Save to file
    await writeErrors(updatedErrors);
    
    console.log(`[Sentinel Errors] Received ${newErrors.length} error(s) from ${body.serverIp}`);
    
    return NextResponse.json({
      success: true,
      received: newErrors.length,
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
