/**
 * Test file for fingerprint generation
 * Run with: npx tsx lib/fingerprint.test.ts
 */

import {
  generateObfuscationKey,
  verifyObfuscationKey,
  deriveEncryptionKey,
  createFingerprintSummary,
  generateResourceHash,
  type CustomerIdentifiers
} from './fingerprint';

function testFingerprintGeneration() {
  console.log('🧪 Testing Fingerprint Generation\n');

  // Test data
  const identifiers: CustomerIdentifiers = {
    ip: '203.0.113.42',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    email: 'admin@example.com',
    timestamp: 1726934400000,
    customerId: 1
  };

  // Generate key
  console.log('📊 Input Identifiers:');
  console.log(JSON.stringify(identifiers, null, 2));
  console.log();

  const key = generateObfuscationKey(identifiers);
  console.log('🔑 Generated Obfuscation Key:');
  console.log(key);
  console.log(`   Length: ${key.length} characters`);
  console.log();

  // Verify determinism (same input = same output)
  const key2 = generateObfuscationKey(identifiers);
  const isDeterministic = key === key2;
  console.log('✅ Determinism Check:', isDeterministic ? 'PASS' : 'FAIL');
  console.log(`   Key 1: ${key.substring(0, 16)}...`);
  console.log(`   Key 2: ${key2.substring(0, 16)}...`);
  console.log();

  // Verify verification function
  const isValid = verifyObfuscationKey(key, identifiers);
  console.log('✅ Verification Check:', isValid ? 'PASS' : 'FAIL');
  console.log();

  // Test uniqueness (different input = different output)
  const differentIdentifiers = { ...identifiers, customerId: 2 };
  const differentKey = generateObfuscationKey(differentIdentifiers);
  const isUnique = key !== differentKey;
  console.log('✅ Uniqueness Check:', isUnique ? 'PASS' : 'FAIL');
  console.log(`   Key 1: ${key.substring(0, 16)}...`);
  console.log(`   Key 2: ${differentKey.substring(0, 16)}...`);
  console.log();

  // Derive encryption key
  const encKey = deriveEncryptionKey(key);
  console.log('🔐 Derived AES-256 Encryption Key:');
  console.log(`   Length: ${encKey.length} bytes`);
  console.log(`   Hex: ${encKey.toString('hex').substring(0, 32)}...`);
  console.log();

  // Create fingerprint summary
  const summary = createFingerprintSummary(identifiers);
  console.log('📝 Fingerprint Summary (for logging):');
  console.log(`   ${summary}`);
  console.log();

  // Test resource hash
  const sampleContent = 'Sample obfuscated Lua code here...';
  const resourceHash = generateResourceHash(sampleContent);
  console.log('🧾 Resource Hash:');
  console.log(`   ${resourceHash}`);
  console.log();

  console.log('✅ All tests completed successfully!');
}

// Run tests
testFingerprintGeneration();
