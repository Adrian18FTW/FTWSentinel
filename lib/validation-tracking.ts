/**
 * Validation Tracking System
 * Detects license key abuse and obfuscation bypass attempts
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Ensure tables exist
async function ensureTables() {
  try {
    // Validation tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS validation_tracking (
        id SERIAL PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL,
        server_ip INET NOT NULL,
        endpoint_type VARCHAR(50) NOT NULL,
        success BOOLEAN NOT NULL DEFAULT false,
        accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_validation_license 
      ON validation_tracking(license_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_validation_endpoint 
      ON validation_tracking(endpoint_type)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_validation_accessed 
      ON validation_tracking(accessed_at)
    `;

    // Validation alerts table
    await sql`
      CREATE TABLE IF NOT EXISTS validation_alerts (
        id SERIAL PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL,
        server_ip INET NOT NULL,
        alert_type VARCHAR(100) NOT NULL,
        alert_message TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        auto_action VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN NOT NULL DEFAULT false,
        resolved_at TIMESTAMP
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_alerts_license 
      ON validation_alerts(license_key)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_alerts_resolved 
      ON validation_alerts(resolved)
    `;
  } catch (error: any) {
    // Ignore "already exists" errors
    if (!error?.message?.includes('already exists')) {
      console.error('[Validation Tracking] Table creation error:', error);
    }
  }
}

/**
 * Track validation endpoint access
 */
export async function trackValidation(
  licenseKey: string,
  serverIp: string,
  endpointType: 'license' | 'obfuscation',
  success: boolean
): Promise<void> {
  try {
    await ensureTables();
    
    await sql`
      INSERT INTO validation_tracking (license_key, server_ip, endpoint_type, success)
      VALUES (${licenseKey}, ${serverIp}, ${endpointType}, ${success})
    `;
  } catch (error) {
    console.error('[Validation Tracking] Track error:', error);
  }
}

/**
 * Check for obfuscation bypass pattern
 * Returns true if bypass detected, false otherwise
 */
export async function checkObfuscationBypass(
  licenseKey: string,
  serverIp: string
): Promise<boolean> {
  try {
    await ensureTables();
    
    // Get the timestamp of the most recent obfuscation validation
    const lastObfuscation = await sql`
      SELECT accessed_at
      FROM validation_tracking
      WHERE license_key = ${licenseKey}
        AND server_ip = ${serverIp}
        AND endpoint_type = 'obfuscation'
      ORDER BY accessed_at DESC
      LIMIT 1
    `;
    
    const lastObfuscationTime = lastObfuscation[0]?.accessed_at;
    
    if (!lastObfuscationTime) {
      // No obfuscation validation ever - check how many license validations
      const licenseCount = await sql`
        SELECT COUNT(*) as count
        FROM validation_tracking
        WHERE license_key = ${licenseKey}
          AND server_ip = ${serverIp}
          AND endpoint_type = 'license'
      `;
      
      const count = parseInt(licenseCount[0]?.count || '0');
      
      // If 2+ license validations without any obfuscation = bypass
      if (count >= 2) {
        await createBypassAlert(licenseKey, serverIp, count);
        return true;
      }
    } else {
      // Obfuscation validated before - check if license validated after last obfuscation
      // without a new obfuscation (resource restart without obfuscation call)
      const licenseAfterObfuscation = await sql`
        SELECT COUNT(*) as count
        FROM validation_tracking
        WHERE license_key = ${licenseKey}
          AND server_ip = ${serverIp}
          AND endpoint_type = 'license'
          AND accessed_at > ${lastObfuscationTime}
      `;
      
      const countAfter = parseInt(licenseAfterObfuscation[0]?.count || '0');
      
      // If more than 2 license validations since last obfuscation = resource restarted without obfuscation
      // (allows 2 for grace: one at startup, one for heartbeat)
      if (countAfter > 2) {
        await createBypassAlert(licenseKey, serverIp, countAfter);
        return true;
      }
    }
    
    return false; // Normal operation
  } catch (error) {
    console.error('[Validation Tracking] Check error:', error);
    return false;
  }
}

async function createBypassAlert(licenseKey: string, serverIp: string, validationCount: number) {
  // Check if alert already exists
  const existingAlert = await sql`
    SELECT id FROM validation_alerts
    WHERE license_key = ${licenseKey}
      AND server_ip = ${serverIp}
      AND alert_type = 'obfuscation_bypass'
      AND resolved = false
      AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  `;
  
  if (existingAlert.length === 0) {
    // Create new alert
    await sql`
      INSERT INTO validation_alerts (
        license_key,
        server_ip,
        alert_type,
        alert_message,
        severity,
        auto_action
      )
      VALUES (
        ${licenseKey},
        ${serverIp},
        'obfuscation_bypass',
        ${`${validationCount} license validations without corresponding obfuscation validation`},
        'critical',
        'suspend'
      )
    `;
    
    console.log(`[Validation Tracking] CRITICAL: Obfuscation bypass detected for ${licenseKey} from ${serverIp}`);
  }
}

/**
 * Get unresolved alerts for a license
 */
export async function getUnresolvedAlerts(licenseKey: string) {
  try {
    await ensureTables();
    
    const result = await sql`
      SELECT *
      FROM validation_alerts
      WHERE license_key = ${licenseKey}
        AND resolved = false
      ORDER BY created_at DESC
    `;
    
    return result;
  } catch (error) {
    console.error('[Validation Tracking] Get alerts error:', error);
    return [];
  }
}

/**
 * Execute auto-actions for critical alerts
 */
export async function executeAutoActions(licenseKey: string): Promise<void> {
  try {
    await ensureTables();
    
    // Get unresolved critical alerts with auto-actions
    const alerts = await sql`
      SELECT *
      FROM validation_alerts
      WHERE license_key = ${licenseKey}
        AND resolved = false
        AND severity = 'critical'
        AND auto_action IS NOT NULL
      ORDER BY created_at DESC
    `;
    
    for (const alert of alerts) {
      if (alert.auto_action === 'suspend') {
        // Mark license as suspended in licenses table
        await sql`
          UPDATE licenses
          SET active = false
          WHERE key = ${licenseKey}
        `;
        
        console.log(`[Validation Tracking] Auto-suspended license: ${licenseKey}`);
      } else if (alert.auto_action === 'revoke') {
        // Fully revoke the license
        await sql`
          UPDATE licenses
          SET active = false
          WHERE key = ${licenseKey}
        `;
        
        console.log(`[Validation Tracking] Auto-revoked license: ${licenseKey}`);
      }
      
      // Mark alert as resolved
      await sql`
        UPDATE validation_alerts
        SET resolved = true, resolved_at = NOW()
        WHERE id = ${alert.id}
      `;
    }
  } catch (error) {
    console.error('[Validation Tracking] Execute auto-actions error:', error);
  }
}

/**
 * Get validation statistics for a license
 */
export async function getValidationStats(licenseKey: string) {
  try {
    await ensureTables();
    
    const result = await sql`
      SELECT 
        endpoint_type,
        COUNT(*) as total_requests,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
        MAX(accessed_at) as last_access
      FROM validation_tracking
      WHERE license_key = ${licenseKey}
        AND accessed_at > NOW() - INTERVAL '30 days'
      GROUP BY endpoint_type
    `;
    
    return result;
  } catch (error) {
    console.error('[Validation Tracking] Get stats error:', error);
    return [];
  }
}

/**
 * Clean up old tracking records (keep last 30 days)
 */
export async function cleanupOldRecords(): Promise<void> {
  try {
    await ensureTables();
    
    await sql`
      DELETE FROM validation_tracking
      WHERE accessed_at < NOW() - INTERVAL '30 days'
    `;
    
    await sql`
      DELETE FROM validation_alerts
      WHERE resolved = true
        AND resolved_at < NOW() - INTERVAL '30 days'
    `;
  } catch (error) {
    console.error('[Validation Tracking] Cleanup error:', error);
  }
}
