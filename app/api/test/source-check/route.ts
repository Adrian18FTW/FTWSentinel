import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Diagnostic endpoint to check if source files are available
 * GET /api/test/source-check
 */
export async function GET(req: NextRequest) {
  const SOURCE_PATH = path.join(process.cwd(), 'source', 'FTWSentinel');
  
  const checks = {
    cwd: process.cwd(),
    sourcePath: SOURCE_PATH,
    sourceExists: existsSync(SOURCE_PATH),
    files: [] as string[],
  };

  if (checks.sourceExists) {
    try {
      const files = await fs.readdir(SOURCE_PATH);
      checks.files = files;
    } catch (error: any) {
      return NextResponse.json({
        ...checks,
        error: error.message,
      });
    }
  }

  return NextResponse.json(checks);
}
