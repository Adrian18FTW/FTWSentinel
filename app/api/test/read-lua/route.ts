import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Test reading Lua files from source
 * GET /api/test/read-lua
 */
export async function GET(req: NextRequest) {
  const SOURCE_PATH = path.join(process.cwd(), 'source', 'FTWSentinel');
  
  try {
    // Try to read fxmanifest.lua
    const fxmanifestPath = path.join(SOURCE_PATH, 'fxmanifest.lua');
    const fxmanifestExists = existsSync(fxmanifestPath);
    
    let fxmanifestContent = null;
    if (fxmanifestExists) {
      fxmanifestContent = await fs.readFile(fxmanifestPath, 'utf-8');
    }
    
    // Try to list client files
    const clientPath = path.join(SOURCE_PATH, 'client');
    const clientExists = existsSync(clientPath);
    
    let clientFiles: string[] = [];
    if (clientExists) {
      clientFiles = await fs.readdir(clientPath);
    }
    
    return NextResponse.json({
      success: true,
      sourcePath: SOURCE_PATH,
      fxmanifest: {
        path: fxmanifestPath,
        exists: fxmanifestExists,
        length: fxmanifestContent?.length || 0,
        preview: fxmanifestContent?.substring(0, 200) || null,
      },
      client: {
        path: clientPath,
        exists: clientExists,
        files: clientFiles,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
