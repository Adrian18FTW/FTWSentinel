/**
 * Create admin customer record in database
 * Run with: npx tsx scripts/create-admin-customer.ts
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function createAdminCustomer() {
  try {
    console.log('Creating admin customer record...');
    
    // Check if admin customer exists
    const existing = await sql`
      SELECT id FROM customers WHERE id = 1
    `;
    
    if (existing.length > 0) {
      console.log('✓ Admin customer already exists (ID: 1)');
      return;
    }
    
    // Create admin customer
    await sql`
      INSERT INTO customers (id, email, password, created_at)
      VALUES (1, 'admin@ftwsentinel.com', 'admin_placeholder_password', NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    
    console.log('✓ Admin customer created successfully (ID: 1)');
    console.log('✓ Email: admin@ftwsentinel.com');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminCustomer();
