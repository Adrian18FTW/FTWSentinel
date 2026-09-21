/**
 * Database initialization script for obfuscation system
 * Run with: npx tsx scripts/init-obfuscation-tables.ts
 */

import { initDownloads, initSecurityLogs } from '../lib/db';

async function main() {
  console.log('🔧 Initializing obfuscation system tables...\n');

  try {
    console.log('📦 Creating downloads table...');
    await initDownloads();
    console.log('✅ Downloads table ready\n');

    console.log('🔒 Creating security_logs table...');
    await initSecurityLogs();
    console.log('✅ Security logs table ready\n');

    console.log('🎉 All tables initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing tables:', error);
    process.exit(1);
  }
}

main();
