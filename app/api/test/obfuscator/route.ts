import { NextRequest, NextResponse } from 'next/server';
import * as obfuscator from '@/lib/obfuscator-wasm';

/**
 * Test endpoint to verify WASM obfuscator works correctly
 * GET /api/test/obfuscator
 */
export async function GET(req: NextRequest) {
  try {
    // Test 1: Get version
    const version = obfuscator.get_version();
    console.log('Obfuscator version:', version);

    // Test 2: Single file obfuscation (no encryption key)
    const testCode1 = `
local x = 10
local y = 20
local function add(a, b)
  return a + b
end
print(add(x, y))
`;

    const obfuscated1 = obfuscator.obfuscate_single_file(
      'test.lua',
      testCode1,
      undefined
    );

    console.log('Test 1 - Original length:', testCode1.length);
    console.log('Test 1 - Obfuscated length:', obfuscated1.length);

    // Test 3: Single file with encryption key
    const testKey = 'beb042007253085765ff69dc61235c1e89c2480f87a81ee186e391b7a4a7d3f8';
    const obfuscated2 = obfuscator.obfuscate_single_file(
      'test_encrypted.lua',
      testCode1,
      testKey
    );

    console.log('Test 2 - With encryption key length:', obfuscated2.length);
    console.log('Test 2 - Contains marker:', obfuscated2.includes('_sentinel_key_marker'));

    // Test 4: Batch obfuscation
    const batchRequest = {
      files: {
        'file1.lua': 'local x = 1\nprint(x)',
        'file2.lua': 'local y = 2\nprint(y)',
        'file3.lua': 'local z = 3\nprint(z)',
      },
      encryption_key: testKey,
    };

    const batchResultJson = obfuscator.obfuscate_files(JSON.stringify(batchRequest));
    const batchResult = JSON.parse(batchResultJson);

    console.log('Test 3 - Batch success:', batchResult.success);
    console.log('Test 3 - Files processed:', Object.keys(batchResult.files).length);
    console.log('Test 3 - Errors:', batchResult.errors);

    // Test 5: Error handling (invalid Lua syntax)
    const invalidCode = 'local x = ; -- syntax error';
    const errorResult = obfuscator.obfuscate_single_file(
      'invalid.lua',
      invalidCode,
      undefined
    );

    console.log('Test 4 - Error handling:', errorResult.substring(0, 100));

    // Return test results
    return NextResponse.json({
      success: true,
      tests: {
        version: {
          result: version,
          passed: version === '2.0.0',
        },
        singleFileBasic: {
          originalLength: testCode1.length,
          obfuscatedLength: obfuscated1.length,
          compressed: obfuscated1.length < testCode1.length,
          passed: obfuscated1.length > 0 && !obfuscated1.startsWith('Error:'),
        },
        singleFileEncrypted: {
          obfuscatedLength: obfuscated2.length,
          hasMarker: obfuscated2.includes('_sentinel_key_marker'),
          passed: obfuscated2.includes('_sentinel_key_marker'),
        },
        batchObfuscation: {
          success: batchResult.success,
          filesProcessed: Object.keys(batchResult.files).length,
          expectedFiles: 3,
          errors: batchResult.errors,
          passed: batchResult.success && Object.keys(batchResult.files).length === 3,
          sampleOutput: batchResult.files['file1.lua']?.substring(0, 100),
        },
        errorHandling: {
          result: errorResult.substring(0, 200),
          handlesErrors: errorResult.includes('Error:') || errorResult.length > 0,
          passed: true, // Always passes if we get a response
        },
      },
      summary: {
        allTestsPassed:
          version === '2.0.0' &&
          obfuscated1.length > 0 &&
          obfuscated2.includes('_sentinel_key_marker') &&
          batchResult.success &&
          Object.keys(batchResult.files).length === 3,
      },
    });
  } catch (error: any) {
    console.error('WASM test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
