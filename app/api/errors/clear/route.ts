import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret');
    
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Delete all errors from database
    await sql`DELETE FROM sentinel_errors`;
    
    return NextResponse.json({ 
      success: true, 
      message: 'All errors cleared'
    });
    
  } catch (error) {
    console.error('[Sentinel Errors] Failed to clear errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
