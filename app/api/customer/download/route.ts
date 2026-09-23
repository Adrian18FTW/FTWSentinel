/**
 * Customer Download Generation Endpoint
 * 
 * Generates a customer-specific obfuscated build of FTWSentinel
 * Requires customer to be authenticated and have an active license
 * 
 * POST /api/customer/download
 * 
 * Returns: ZIP file (FTWSentinel.zip)
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import AdmZip from 'adm-zip';
import * as obfuscator from '@/lib/obfuscator-wasm';
import {
  createDownload,
  getCustomerById,
  getLicense,
  logSecurityEvent,
  initDownloads
} from '@/lib/db';
import {
  generateObfuscationKey,
  extractIdentifiers,
  generateResourceHash,
  createFingerprintSummary
} from '@/lib/fingerprint';
import { getSession } from '@/lib/session';

// Paths
const SOURCE_PATH = path.join(process.cwd(), 'source', 'FTWSentinel');
const OUTPUT_BASE = process.env.VERCEL ? '/tmp/builds' : path.join(process.cwd(), 'builds');

/**
 * Recursively read all Lua files from directory
 */
async function readLuaFiles(dir: string, baseDir: string = dir): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await readLuaFiles(fullPath, baseDir);
      Object.assign(files, subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
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
    
    await fs.mkdir(outputFileDir, { recursive: true });
    await fs.writeFile(outputPath, content, 'utf-8');
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify customer authentication
    const customerId = await getSession();
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get customer record
    const customer = await getCustomerById(customerId);
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // 3. Verify customer has a license
    if (!customer.license_key) {
      await logSecurityEvent(
        'DOWNLOAD_NO_LICENSE',
        { customerId, email: customer.email },
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        customerId
      );
      
      return NextResponse.json(
        { error: 'No license linked to your account' },
        { status: 403 }
      );
    }

    // 4. Verify license is active and not expired
    const license = await getLicense(customer.license_key);
    
    if (!license) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      );
    }

    if (!license.active) {
      await logSecurityEvent(
        'DOWNLOAD_INACTIVE_LICENSE',
        { customerId, email: customer.email, license_key: customer.license_key },
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        customerId,
        customer.license_key
      );
      
      return NextResponse.json(
        { error: 'License is not active' },
        { status: 403 }
      );
    }

    if (new Date(license.expires_at) < new Date()) {
      await logSecurityEvent(
        'DOWNLOAD_EXPIRED_LICENSE',
        { customerId, email: customer.email, license_key: customer.license_key, expires_at: license.expires_at },
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        customerId,
        customer.license_key
      );
      
      return NextResponse.json(
        { error: 'License has expired' },
        { status: 403 }
      );
    }

    // 5. Extract identifiers with enhanced fingerprinting
    const identifiers = extractIdentifiers(
      req,
      customer.email,
      customer.id,
      customer.license_key,
      customer.created_at
    );

    await logSecurityEvent(
      'DOWNLOAD_STARTED',
      { 
        customerId,
        email: customer.email,
        license_key: customer.license_key,
        fingerprint: createFingerprintSummary(identifiers)
      },
      identifiers.ip,
      customerId,
      customer.license_key
    );

    // 6. Generate obfuscation key from enhanced identifiers
    const obfuscationKey = generateObfuscationKey(identifiers);

    // 7. Create unique output directory
    const timestamp = Date.now();
    const outputDir = path.join(OUTPUT_BASE, `customer_${customerId}_${timestamp}`);
    const outputPath = path.join(outputDir, 'FTWSentinel_obf');
    
    await fs.mkdir(outputDir, { recursive: true });

    // 8. Read all Lua files from source
    let sourceFiles: Record<string, string>;
    try {
      sourceFiles = await readLuaFiles(SOURCE_PATH);
    } catch (error) {
      console.error('[customer/download] Failed to read source files:', error);
      
      await logSecurityEvent(
        'DOWNLOAD_SOURCE_READ_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          sourcePath: SOURCE_PATH,
          customerId,
          email: customer.email
        },
        identifiers.ip,
        customerId,
        customer.license_key
      );
      
      return NextResponse.json(
        { error: 'Failed to read source files' },
        { status: 500 }
      );
    }

    // 9. Run WASM obfuscator
    const obfuscationRequest = {
      files: sourceFiles,
      encryption_key: obfuscationKey
    };
    
    let obfuscatedFiles: Record<string, string>;
    
    try {
      const result = obfuscator.obfuscate_multi_file(JSON.stringify(obfuscationRequest));
      
      obfuscatedFiles = result.files;
      
      if (result.errors.length > 0) {
        console.error('[customer/download] Obfuscation warnings:', result.errors);
        
        await logSecurityEvent(
          'DOWNLOAD_OBFUSCATION_WARNINGS',
          { 
            warnings: result.errors.slice(0, 10),
            customerId,
            email: customer.email
          },
          identifiers.ip,
          customerId,
          customer.license_key
        );
      }
    } catch (error) {
      console.error('[customer/download] Obfuscation failed:', error);
      
      await logSecurityEvent(
        'DOWNLOAD_OBFUSCATION_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId,
          email: customer.email
        },
        identifiers.ip,
        customerId,
        customer.license_key
      );
      
      return NextResponse.json(
        { error: 'Obfuscation failed' },
        { status: 500 }
      );
    }

    // 10. Write obfuscated files to output directory
    try {
      await writeObfuscatedFiles(obfuscatedFiles, outputPath);
      
      // Copy fxmanifest.lua
      const fxManifestPath = path.join(SOURCE_PATH, 'fxmanifest.lua');
      if (existsSync(fxManifestPath)) {
        await fs.copyFile(fxManifestPath, path.join(outputPath, 'fxmanifest.lua'));
      }
      
      // Copy UI files if they exist
      const uiPath = path.join(SOURCE_PATH, 'ui');
      if (existsSync(uiPath)) {
        const uiOutputPath = path.join(outputPath, 'ui');
        await fs.cp(uiPath, uiOutputPath, { recursive: true });
      }
    } catch (error) {
      console.error('[customer/download] File write error:', error);
      
      await logSecurityEvent(
        'DOWNLOAD_FILE_WRITE_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId,
          email: customer.email
        },
        identifiers.ip,
        customerId,
        customer.license_key
      );
      
      return NextResponse.json(
        { error: 'Failed to write files' },
        { status: 500 }
      );
    }

    // 11. Create ZIP archive
    const zipPath = path.join(outputDir, 'FTWSentinel.zip');
    
    try {
      const zip = new AdmZip();
      zip.addLocalFolder(outputPath, 'FTWSentinel');
      zip.writeZip(zipPath);
      
      if (!existsSync(zipPath)) {
        throw new Error('ZIP file was not created');
      }
    } catch (error) {
      console.error('[customer/download] ZIP creation failed:', error);
      
      await logSecurityEvent(
        'DOWNLOAD_ZIP_FAILED',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          customerId,
          email: customer.email
        },
        identifiers.ip,
        customerId,
        customer.license_key
      );
      
      return NextResponse.json(
        { error: 'Failed to create ZIP archive' },
        { status: 500 }
      );
    }

    // 12. Read ZIP file
    const zipBuffer = await fs.readFile(zipPath);
    const resourceHash = generateResourceHash(zipBuffer);

    // 13. Store download record in database
    try {
      await initDownloads();
      
      await createDownload(
        customerId,
        obfuscationKey,
        identifiers.ip,
        resourceHash
      );
    } catch (error) {
      console.error('[customer/download] Database error:', error);
      // Non-critical error - continue with download
    }

    // 14. Log successful download
    await logSecurityEvent(
      'DOWNLOAD_SUCCESS',
      { 
        customerId,
        email: customer.email,
        license_key: customer.license_key,
        resource_hash: resourceHash.substring(0, 16) + '...',
        size_bytes: zipBuffer.length
      },
      identifiers.ip,
      customerId,
      customer.license_key
    );

    // 15. Clean up temporary files
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      console.error('[customer/download] Cleanup failed:', error);
      // Non-critical error
    }

    // 16. Return ZIP file
    const response = new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="FTWSentinel_${customer.license_key}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

    return response;

  } catch (error) {
    console.error('[customer/download] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
