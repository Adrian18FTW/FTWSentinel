import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const ERRORS_FILE = join(process.cwd(), 'data', 'sentinel_errors.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-admin-secret');
    
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!existsSync(ERRORS_FILE)) {
      return NextResponse.json({ errors: [], stats: null });
    }
    
    const content = await readFile(ERRORS_FILE, 'utf-8');
    const data = JSON.parse(content);
    const errors = data.errors || [];
    
    // Calculate statistics
    const stats = {
      totalErrors: errors.length,
      serverCount: new Set(errors.map((e: any) => e.serverIp)).size,
      fileBreakdown: {} as Record<string, number>,
      serverBreakdown: {} as Record<string, number>,
    };
    
    errors.forEach((err: any) => {
      // File breakdown
      if (!stats.fileBreakdown[err.file]) {
        stats.fileBreakdown[err.file] = 0;
      }
      stats.fileBreakdown[err.file]++;
      
      // Server breakdown
      if (!stats.serverBreakdown[err.serverIp]) {
        stats.serverBreakdown[err.serverIp] = 0;
      }
      stats.serverBreakdown[err.serverIp]++;
    });
    
    // Sort file breakdown by count (descending)
    const sortedFiles = Object.entries(stats.fileBreakdown)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [file, count]) => {
        acc[file] = count;
        return acc;
      }, {} as Record<string, number>);
    
    stats.fileBreakdown = sortedFiles;
    
    return NextResponse.json({ errors, stats });
    
  } catch (error) {
    console.error('[Sentinel Errors] Failed to read errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
