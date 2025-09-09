-- MediaNest Database Initialization Script
-- Creates database extensions and initial setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user if not exists (for development)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medianest') THEN
        CREATE ROLE medianest LOGIN PASSWORD 'medianest_dev_password';
    END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE medianest_dev TO medianest;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medianest;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medianest;

-- Set default search path
ALTER DATABASE medianest_dev SET search_path TO public;

-- Performance optimizations
COMMENT ON DATABASE medianest_dev IS 'MediaNest Development Database - Initialized by Docker';