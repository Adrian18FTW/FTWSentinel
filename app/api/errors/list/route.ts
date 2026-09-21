import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret');
    
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch errors from database (limit to 1000 most recent)
    const errors = await sql`
      SELECT 
        id,
        error,
        stack_trace as "stackTrace",
        timestamp,
        resource_name as "resourceName",
        server_ip as "serverIp",
        file,
        received_at as "receivedAt"
      FROM sentinel_errors
      ORDER BY received_at DESC
      LIMIT 1000
    `;
    
    // Calculate statistics
    const totalCount = await sql`SELECT COUNT(*) as count FROM sentinel_errors`;
    const serverCount = await sql`SELECT COUNT(DISTINCT server_ip) as count FROM sentinel_errors`;
    
    const fileBreakdown = await sql`
      SELECT file, COUNT(*) as count
      FROM sentinel_errors
      GROUP BY file
      ORDER BY count DESC
    `;
    
    const serverBreakdown = await sql`
      SELECT server_ip as "serverIp", COUNT(*) as count
      FROM sentinel_errors
      GROUP BY server_ip
      ORDER BY count DESC
    `;
    
    const stats = {
      totalErrors: Number(totalCount[0]?.count || 0),
      serverCount: Number(serverCount[0]?.count || 0),
      fileBreakdown: fileBreakdown.reduce((acc, row) => {
        acc[row.file] = Number(row.count);
        return acc;
      }, {} as Record<string, number>),
      serverBreakdown: serverBreakdown.reduce((acc, row) => {
        acc[row.serverIp] = Number(row.count);
        return acc;
      }, {} as Record<string, number>),
    };
    
    return NextResponse.json({ errors, stats });
    
  } catch (error) {
    console.error('[Sentinel Errors] Failed to read errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
