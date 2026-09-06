import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { generateMinecraftLicense } from '@/lib/minecraft-db';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const customerId = await getSession();
    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await generateMinecraftLicense(customerId);

    // Store JAR in private folder - NOT accessible via public URL
    const jarPath = join(process.cwd(), 'private', 'downloads', 'FTWSentinel.jar');
    
    try {
      const fileBuffer = await readFile(jarPath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/java-archive',
          'Content-Disposition': 'attachment; filename="FTWSentinel.jar"',
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (fileError) {
      return NextResponse.json({ 
        error: 'Download file not available',
        message: 'Please contact support to get the plugin JAR file'
      }, { status: 404 });
    }
  } catch (error) {
    console.error('[minecraft/download]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
