-- E2E Test Database Initialization
-- This file is executed during container startup

-- Ensure database is properly configured
SELECT 'E2E database initialization started' as message;

-- Create any custom extensions if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Log successful initialization  
SELECT 'E2E database initialization completed' as message;