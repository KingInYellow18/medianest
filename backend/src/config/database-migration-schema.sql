-- Database Schema for Production Database Integration
-- Add tables for notification and service monitoring

-- Notifications table
CREATE TABLE IF NOT EXISTS notification (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'system')),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    actions JSONB,
    persistent BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Service metrics table for monitoring
CREATE TABLE IF NOT EXISTS service_metric (
    id VARCHAR(255) PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded', 'maintenance')),
    response_time_ms INTEGER,
    uptime_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    metadata JSONB,
    incident_id VARCHAR(255)
);

-- Service incidents table
CREATE TABLE IF NOT EXISTS service_incident (
    id VARCHAR(255) PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    affected_users INTEGER,
    metadata JSONB
);

-- Indexes for performance optimization
-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notification(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON notification(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_expires_at ON notification(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_type ON notification(type);
CREATE INDEX IF NOT EXISTS idx_notification_persistent ON notification(persistent) WHERE persistent = true;

-- Service metrics indexes
CREATE INDEX IF NOT EXISTS idx_service_metric_name_timestamp ON service_metric(service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_service_metric_timestamp ON service_metric(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_service_metric_status ON service_metric(status);
CREATE INDEX IF NOT EXISTS idx_service_metric_service_status ON service_metric(service_name, status);

-- Service incidents indexes
CREATE INDEX IF NOT EXISTS idx_service_incident_service_name ON service_incident(service_name);
CREATE INDEX IF NOT EXISTS idx_service_incident_status ON service_incident(status);
CREATE INDEX IF NOT EXISTS idx_service_incident_severity ON service_incident(severity);
CREATE INDEX IF NOT EXISTS idx_service_incident_started_at ON service_incident(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_incident_active ON service_incident(service_name, status) WHERE status != 'resolved';

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_pending ON notification(user_id, created_at DESC) 
    WHERE read_at IS NULL AND dismissed_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

CREATE INDEX IF NOT EXISTS idx_service_metric_recent ON service_metric(service_name, timestamp DESC) 
    WHERE timestamp > NOW() - INTERVAL '7 days';

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notification_user_type_created ON notification(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_metric_name_status_time ON service_metric(service_name, status, timestamp DESC);

-- Add foreign key constraints if user table exists
-- ALTER TABLE notification ADD CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;

-- Comments for documentation
COMMENT ON TABLE notification IS 'User notifications with persistence and expiration support';
COMMENT ON TABLE service_metric IS 'Service health metrics and monitoring data';
COMMENT ON TABLE service_incident IS 'Service incidents and outage tracking';

COMMENT ON COLUMN notification.data IS 'JSON data payload for notification context';
COMMENT ON COLUMN notification.actions IS 'JSON array of available actions for notification';
COMMENT ON COLUMN notification.persistent IS 'Whether notification persists after being read';
COMMENT ON COLUMN notification.expires_at IS 'Automatic expiration timestamp';

COMMENT ON COLUMN service_metric.uptime_percentage IS 'Uptime percentage at time of measurement';
COMMENT ON COLUMN service_metric.response_time_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN service_metric.metadata IS 'Additional metric context and debugging info';

COMMENT ON COLUMN service_incident.affected_users IS 'Estimated number of affected users';
COMMENT ON COLUMN service_incident.metadata IS 'Additional incident context and resolution notes';
