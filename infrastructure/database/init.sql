-- MediaNest Database Initialization Script
-- This script creates initial data and configurations

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert default service configurations
INSERT INTO service_config (service_name, service_url, enabled, config_data)
VALUES 
  ('plex', 'http://localhost:32400', true, '{"timeout": 5000}'::jsonb),
  ('overseerr', 'http://localhost:5055', true, '{"timeout": 5000}'::jsonb),
  ('uptime-kuma', 'http://localhost:3001', true, '{"timeout": 3000}'::jsonb)
ON CONFLICT (service_name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_requests_user_status ON media_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_media_requests_created ON media_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_downloads_status ON youtube_downloads(status);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires ON session_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON rate_limits(user_id, endpoint, window_start);

-- Create function for updating last_login_at
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_login_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger will be created by Prisma migrations