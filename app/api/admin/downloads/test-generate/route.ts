/**
 * Test endpoint for download generation - with detailed error logging
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import * as obfuscator from '@/lib/obfuscator-wasm';
import { extractIdentifiers, generateObfuscationKey } from '@/lib/fingerprint';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ftwsentinel.com';
const SOURCE_PATH = path.join(process.cwd(), 'source', 'FTWSentinel');

export async function POST(req: NextRequest) {
  const steps: any[] = [];
  
  try {
    // Step 1: Auth check
    steps.push({ step: 1, name: 'Auth check', status: 'started' });
    const secret = req.headers.get('x-admin-secret');
    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized', steps }, { status: 401 });
    }
    steps[0].status = 'success';

    // Step 2: Extract identifiers
    steps.push({ step: 2, name: 'Extract identifiers', status: 'started' });
    const identifiers = extractIdentifiers(req, ADMIN_EMAIL, 1);
    steps[1].status = 'success';
    steps[1].data = { ip: identifiers.ip, email: identifiers.email };

    // Step 3: Generate obfuscation key
    steps.push({ step: 3, name: 'Generate key', status: 'started' });
    const obfuscationKey = generateObfuscationKey(identifiers);
    steps[2].status = 'success';
    steps[2].data = { keyLength: obfuscationKey.length, keyPrefix: obfuscationKey.substring(0, 8) };

    // Step 4: Check source path
    steps.push({ step: 4, name: 'Check source', status: 'started' });
    const sourceExists = existsSync(SOURCE_PATH);
    if (!sourceExists) {
      throw new Error(`Source path does not exist: ${SOURCE_PATH}`);
    }
    const sourceFiles = await fs.readdir(SOURCE_PATH);
    steps[3].status = 'success';
    steps[3].data = { path: SOURCE_PATH, files: sourceFiles };

    // Step 5: Read one Lua file
    steps.push({ step: 5, name: 'Read sample Lua', status: 'started' });
    const fxmanifestPath = path.join(SOURCE_PATH, 'fxmanifest.lua');
    const fxmanifest = await fs.readFile(fxmanifestPath, 'utf-8');
    steps[4].status = 'success';
    steps[4].data = { length: fxmanifest.length };

    // Step 6: Test WASM obfuscator
    steps.push({ step: 6, name: 'Test WASM obfuscator', status: 'started' });
    const testResult = obfuscator.obfuscate_single_file(
      'test.lua',
      'local x = 10\nprint(x)',
      obfuscationKey
    );
    steps[5].status = 'success';
    steps[5].data = { outputLength: testResult.length };

    // Step 7: Check /tmp directory
    steps.push({ step: 7, name: 'Check /tmp', status: 'started' });
    const tmpExists = existsSync('/tmp');
    if (!tmpExists) {
      throw new Error('/tmp does not exist');
    }
    await fs.mkdir('/tmp/test-build', { recursive: true });
    await fs.writeFile('/tmp/test-build/test.txt', 'test');
    const testRead = await fs.readFile('/tmp/test-build/test.txt', 'utf-8');
    await fs.rm('/tmp/test-build', { recursive: true });
    steps[6].status = 'success';
    steps[6].data = { writeable: true, testRead };

    return NextResponse.json({
      success: true,
      message: 'All steps passed',
      steps,
      environment: {
        ADMIN_EMAIL: ADMIN_EMAIL,
        ADMIN_SECRET_LENGTH: ADMIN_SECRET.length,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
      },
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      steps,
    }, { status: 500 });
  }
}
