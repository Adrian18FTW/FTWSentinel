-- Validation Tracking Table
-- Tracks which validation endpoints each license accesses
-- Used to detect bypassed obfuscation validation

CREATE TABLE IF NOT EXISTS validation_tracking (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(255) NOT NULL,
    server_ip INET NOT NULL,
    endpoint_type VARCHAR(50) NOT NULL, -- 'license' or 'obfuscation'
    success BOOLEAN NOT NULL DEFAULT false,
    accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_license_key (license_key),
    INDEX idx_endpoint_type (endpoint_type),
    INDEX idx_accessed_at (accessed_at)
);

-- Validation Alerts Table
-- Stores alerts for suspicious validation patterns
CREATE TABLE IF NOT EXISTS validation_alerts (
    id SERIAL PRIMARY KEY,
    license_key VARCHAR(255) NOT NULL,
    server_ip INET NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    alert_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    auto_action VARCHAR(50), -- 'none', 'flag', 'suspend', 'revoke'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP,
    INDEX idx_license_key (license_key),
    INDEX idx_severity (severity),
    INDEX idx_resolved (resolved),
    INDEX idx_created_at (created_at)
);

-- Create function to check for obfuscation bypass
CREATE OR REPLACE FUNCTION check_obfuscation_bypass(
    p_license_key VARCHAR(255),
    p_server_ip INET
) RETURNS BOOLEAN AS $$
DECLARE
    license_count INT;
    obfuscation_count INT;
    hours_window INT := 24;
BEGIN
    -- Count license validations in last 24 hours
    SELECT COUNT(*) INTO license_count
    FROM validation_tracking
    WHERE license_key = p_license_key
      AND server_ip = p_server_ip
      AND endpoint_type = 'license'
      AND accessed_at > NOW() - INTERVAL '24 hours';
    
    -- Count obfuscation validations in last 24 hours
    SELECT COUNT(*) INTO obfuscation_count
    FROM validation_tracking
    WHERE license_key = p_license_key
      AND server_ip = p_server_ip
      AND endpoint_type = 'obfuscation'
      AND accessed_at > NOW() - INTERVAL '24 hours';
    
    -- If license validated 5+ times but obfuscation never validated, flag it
    IF license_count >= 5 AND obfuscation_count = 0 THEN
        -- Create alert if one doesn't exist already
        INSERT INTO validation_alerts (
            license_key,
            server_ip,
            alert_type,
            alert_message,
            severity,
            auto_action
        )
        SELECT 
            p_license_key,
            p_server_ip,
            'obfuscation_bypass',
            format('License validated %s times without obfuscation validation in 24h', license_count),
            'critical',
            'suspend'
        WHERE NOT EXISTS (
            SELECT 1 FROM validation_alerts
            WHERE license_key = p_license_key
              AND server_ip = p_server_ip
              AND alert_type = 'obfuscation_bypass'
              AND resolved = false
              AND created_at > NOW() - INTERVAL '24 hours'
        );
        
        RETURN TRUE; -- Bypass detected
    END IF;
    
    RETURN FALSE; -- Normal operation
END;
$$ LANGUAGE plpgsql;
