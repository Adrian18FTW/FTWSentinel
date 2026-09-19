import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const ERRORS_DIR = join(process.cwd(), 'data');
const ERRORS_FILE = join(ERRORS_DIR, 'sentinel_errors.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret');
    
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Ensure directory exists
    if (!existsSync(ERRORS_DIR)) {
      await mkdir(ERRORS_DIR, { recursive: true });
    }
    
    // Clear all errors by writing empty array
    await writeFile(ERRORS_FILE, JSON.stringify({ errors: [] }, null, 2));
    
    console.log('[Sentinel Errors] All errors cleared by admin');
    
    return NextResponse.json({ success: true, message: 'All errors cleared' });
    
  } catch (error) {
    console.error('[Sentinel Errors] Failed to clear errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
