/**
 * Admin Download Generation Endpoint
 * 
 * Generates a customer-specific obfuscated build of FTWSentinel using WASM obfuscator
 * 
 * POST /api/admin/downloads/generate
 * Headers: { 'x-admin-secret': string }
 * 
 * Returns: ZIP file (FTWSentinel-Admin.zip)
 */

import { NextRequest, NextResponse } from 'next/server';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import * as obfuscator from '@/lib/obfuscator-wasm';
import {
  createDownload,
  getCustomerByEmail,
  logSecurityEvent
} from '@/lib/db';
import {
  generateObfuscationKey,
  extractIdentifiers,
  generateResourceHash,
  createFingerprintSummary
} from '@/lib/fingerprint';

const execAsync = promisify(exec);

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ftwsentinel.com';

// Paths
const SOURCE_PATH = path.join(process.cwd(), 'source', 'FTWSentinel');
const OUTPUT_BASE = '/tmp/builds'; // Use /tmp for Vercel serverless (only writable directory)

/**
 * Recursively read all Lua files from directory
 */
async function readLuaFiles(dir: string, baseDir: string = dir): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively read subdirectories
      const subFiles = await readLuaFiles(fullPath, baseDir);
      Object.assign(files, subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
      // Read Lua file
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = await fs.readFile(fullPath, 'utf-8');
      files[relativePath] = content;
    }
  }
  
  return files;
}

/**
 * Write obfuscated files to output directory
 */
async function writeObfuscatedFiles(
  files: Record<string, string>,
  outputDir: string
): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const outputPath = path.join(outputDir, relativePath);
    const outputFileDir = path.dirname(outputPath);
    
    // Create directory structure
    await fs.mkdir(outputFileDir, { recursive: true });
    
    // Write obfuscated content
    await fs.writeFile(outputPath, content, 'utf-8');
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify admin authentication
    const secret = req.headers.get('x-admin-secret');
    
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Extract identifiers from request
    const identifiers = extractIdentifiers(req, ADMIN_EMAIL, 1); // Admin is customer ID 1
    
    console.log('[admin/downloads/generate] Starting build generation');
    console.log('[admin/downloads/generate] Fingerprint:', createFingerprintSummary(identifiers));

    // 3. Generate obfuscation key
    const obfuscationKey = generateObfuscationKey(identifiers);
    console.log('[admin/downloads/generate] Obfuscation key:', obfuscationKey.substring(0, 16) + '...');

    // 4. Create unique output directory
    const timestamp = Date.now();
    const outputDir = path.join(OUTPUT_BASE, `admin_${timestamp}`);
    const outputPath = path.join(outputDir, 'FTWSentinel_obf');
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // 5. Read all Lua files from source
    console.log('[admin/downloads/generate] Reading source files from:', SOURCE_PATH);
    
    let sourceFiles: Record<string, string>;
    try {
      sourceFiles = await readLuaFiles(SOURCE_PATH);
      console.log('[admin/downloads/generate] Read', Object.keys(sourceFiles).length, 'Lua files');
    } catch (error) {
      console.error('[admin/downloads/generate] Failed to read source files:', error);
      
      await logSecurityEvent(
        'SOURCE_READ_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          sourcePath: SOURCE_PATH
        },
        identifiers.ip,
        1
      );
      
      return NextResponse.json(
        { error: 'Failed to read source files' },
        { status: 500 }
      );
    }

    // 6. Run WASM obfuscator
    console.log('[admin/downloads/generate] Running WASM obfuscator...');
    console.log('[admin/downloads/generate] Obfuscation key:', obfuscationKey.substring(0, 16) + '...');
    
    const obfuscationRequest = {
      files: sourceFiles,
      encryption_key: obfuscationKey
    };
    
    let obfuscatedFiles: Record<string, string>;
    try {
      const resultJson = obfuscator.obfuscate_files(JSON.stringify(obfuscationRequest));
      const result = JSON.parse(resultJson);
      
      if (!result.success) {
        throw new Error('Obfuscation failed: ' + result.errors.join(', '));
      }
      
      obfuscatedFiles = result.files;
      console.log('[admin/downloads/generate] Obfuscated', Object.keys(obfuscatedFiles).length, 'files');
      
      if (result.errors.length > 0) {
        console.warn('[admin/downloads/generate] Obfuscation warnings:', result.errors);
      }
    } catch (error) {
      console.error('[admin/downloads/generate] Obfuscation error:', error);
      
      await logSecurityEvent(
        'OBFUSCATION_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          identifiers: createFingerprintSummary(identifiers)
        },
        identifiers.ip,
        1
      );
      
      return NextResponse.json(
        { error: 'Obfuscation failed. Check server logs for details.' },
        { status: 500 }
      );
    }

    // 7. Write obfuscated files to output directory
    console.log('[admin/downloads/generate] Writing obfuscated files to:', outputPath);
    
    try {
      await writeObfuscatedFiles(obfuscatedFiles, outputPath);
      
      // Also copy non-Lua files (fxmanifest, UI files, etc.)
      console.log('[admin/downloads/generate] Copying non-Lua files...');
      
      // Copy fxmanifest.lua
      const fxmanifestSrc = path.join(SOURCE_PATH, 'fxmanifest.lua');
      const fxmanifestDst = path.join(outputPath, 'fxmanifest.lua');
      if (existsSync(fxmanifestSrc)) {
        await fs.copyFile(fxmanifestSrc, fxmanifestDst);
      }
      
      // Copy ui directory
      const uiSrc = path.join(SOURCE_PATH, 'ui');
      const uiDst = path.join(outputPath, 'ui');
      if (existsSync(uiSrc)) {
        await fs.cp(uiSrc, uiDst, { recursive: true });
      }
      
      // Copy sentinel_alias.txt if exists
      const aliasSrc = path.join(SOURCE_PATH, 'sentinel_alias.txt');
      const aliasDst = path.join(outputPath, 'sentinel_alias.txt');
      if (existsSync(aliasSrc)) {
        await fs.copyFile(aliasSrc, aliasDst);
      }
      
      console.log('[admin/downloads/generate] Files written successfully');
    } catch (error) {
      console.error('[admin/downloads/generate] File write error:', error);
      
      await logSecurityEvent(
        'FILE_WRITE_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        identifiers.ip,
        1
      );
      
      // Cleanup
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
      
      return NextResponse.json(
        { error: 'Failed to write obfuscated files' },
        { status: 500 }
      );
    }

    // 8. Create ZIP archive
    console.log('[admin/downloads/generate] Creating ZIP archive...');
    
    const zipPath = path.join(outputDir, 'FTWSentinel-Admin.zip');
    const zipCmd = process.platform === 'win32'
      ? `powershell Compress-Archive -Path "${outputPath}\\*" -DestinationPath "${zipPath}" -Force`
      : `cd "${outputPath}" && zip -r "${zipPath}" .`;
    
    try {
      await execAsync(zipCmd);
      
      if (!existsSync(zipPath)) {
        throw new Error('ZIP creation failed');
      }
    } catch (error) {
      console.error('[admin/downloads/generate] ZIP creation error:', error);
      
      await logSecurityEvent(
        'ZIP_CREATION_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        identifiers.ip,
        1
      );
      
      // Cleanup
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
      
      return NextResponse.json(
        { error: 'Failed to create ZIP archive' },
        { status: 500 }
      );
    }

    // 9. Calculate resource hash
    const zipBuffer = await fs.readFile(zipPath);
    const resourceHash = generateResourceHash(zipBuffer);
    
    console.log('[admin/downloads/generate] Resource hash:', resourceHash.substring(0, 16) + '...');

    // 10. Store download record in database
    try {
      await createDownload(
        1, // Admin customer ID
        obfuscationKey,
        identifiers.ip,
        identifiers.userAgent,
        identifiers.email,
        new Date(identifiers.timestamp),
        resourceHash
      );
      
      await logSecurityEvent(
        'DOWNLOAD_GENERATED',
        {
          fingerprint: createFingerprintSummary(identifiers),
          obfuscationKey: obfuscationKey.substring(0, 16) + '...',
          resourceHash: resourceHash.substring(0, 16) + '...',
          size: zipBuffer.length
        },
        identifiers.ip,
        1
      );
      
      console.log('[admin/downloads/generate] Download record created');
    } catch (error) {
      console.error('[admin/downloads/generate] Database error:', error);
      // Don't fail the download if DB logging fails
    }

    // 11. Return ZIP file
    const response = new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="FTWSentinel-Admin.zip"',
        'Content-Length': zipBuffer.length.toString(),
        'X-Obfuscation-Key': obfuscationKey.substring(0, 16) + '...', // Partial key for debugging
        'X-Resource-Hash': resourceHash.substring(0, 16) + '...'
      }
    });

    // 12. Cleanup build directory (async, don't wait)
    fs.rm(outputDir, { recursive: true, force: true }).catch(err => {
      console.error('[admin/downloads/generate] Cleanup error:', err);
    });

    console.log('[admin/downloads/generate] Build completed successfully');
    
    return response;

  } catch (error) {
    console.error('[admin/downloads/generate] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
