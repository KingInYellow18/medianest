-- ========================================================================
-- 🗄️ CI/CD Database Initialization Script
-- ========================================================================
-- Purpose: Initialize test database with schema and sample data for CI/CD
-- Environment: Test/CI pipelines
-- Database: PostgreSQL 16+
-- ========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ========================================================================
-- 🔧 Database Configuration for CI Performance
-- ========================================================================

-- Optimize for CI/CD test performance (speed over durability)
SET fsync = OFF;
SET synchronous_commit = OFF;
SET full_page_writes = OFF;
SET checkpoint_completion_target = 0.9;
SET wal_buffers = '16MB';
SET default_statistics_target = 100;

-- ========================================================================
-- 👥 User Management Schema
-- ========================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    last_login TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create indexes for user operations
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- ========================================================================
-- 📁 Media File Management Schema
-- ========================================================================

CREATE TABLE IF NOT EXISTS media_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES media_categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) UNIQUE, -- SHA-256 hash for deduplication
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES media_categories(id),
    title VARCHAR(255),
    description TEXT,
    alt_text TEXT,
    tags TEXT[], -- Array of tags
    metadata JSONB DEFAULT '{}', -- Additional metadata (EXIF, dimensions, etc.)
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (
        processing_status IN ('pending', 'processing', 'completed', 'failed')
    ),
    processing_error TEXT,
    thumbnail_path TEXT,
    preview_path TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create indexes for media file operations
CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON media_files(user_id);
CREATE INDEX IF NOT EXISTS idx_media_files_category_id ON media_files(category_id);
CREATE INDEX IF NOT EXISTS idx_media_files_uuid ON media_files(uuid);
CREATE INDEX IF NOT EXISTS idx_media_files_file_hash ON media_files(file_hash);
CREATE INDEX IF NOT EXISTS idx_media_files_mime_type ON media_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_files_processing_status ON media_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_media_files_is_public ON media_files(is_public);
CREATE INDEX IF NOT EXISTS idx_media_files_tags ON media_files USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_files_metadata ON media_files USING GIN(metadata);

-- ========================================================================
-- 📂 Collection Management Schema
-- ========================================================================

CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    cover_image_id INTEGER REFERENCES media_files(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_media (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    media_file_id INTEGER NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, media_file_id)
);

-- Create indexes for collections
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_uuid ON collections(uuid);
CREATE INDEX IF NOT EXISTS idx_collections_is_public ON collections(is_public);
CREATE INDEX IF NOT EXISTS idx_collection_media_collection_id ON collection_media(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_media_media_file_id ON collection_media(media_file_id);

-- ========================================================================
-- 🔐 Authentication & Session Management
-- ========================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_tokens (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    expires_at TIMESTAMP,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL
);

-- Create indexes for authentication
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);

-- ========================================================================
-- 📊 Audit & Activity Logging
-- ========================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ========================================================================
-- 🏥 Health Check & System Monitoring
-- ========================================================================

CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'degraded')),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Health check table for CI/CD monitoring
CREATE TABLE IF NOT EXISTS ci_health_checks (
    id SERIAL PRIMARY KEY,
    pipeline_id VARCHAR(100),
    test_suite VARCHAR(50),
    status VARCHAR(20) DEFAULT 'running' CHECK (
        status IN ('running', 'passed', 'failed', 'skipped')
    ),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    error_details TEXT
);

-- ========================================================================
-- 🧪 Test Data Insertion
-- ========================================================================

-- Insert test categories
INSERT INTO media_categories (name, description) VALUES 
('Images', 'Photo and image files'),
('Videos', 'Video and movie files'),
('Documents', 'Document and text files'),
('Audio', 'Music and audio files'),
('Archives', 'Compressed and archive files')
ON CONFLICT (name) DO NOTHING;

-- Insert test users
INSERT INTO users (
    email, username, password_hash, first_name, last_name, role, email_verified
) VALUES 
-- Test user (password: testpassword123)
('test@example.com', 'testuser', 
 '$2b$10$rOzWbkZtZl.QpC4YKKjJkOzfOqKJj5QGyhUBTCl1VtcxE1Pg8F3Ni', 
 'Test', 'User', 'user', TRUE),
 
-- Admin user (password: adminpassword123)
('admin@example.com', 'admin', 
 '$2b$10$rOzWbkZtZl.QpC4YKKjJkOzfOqKJj5QGyhUBTCl1VtcxE1Pg8F3Ni', 
 'Admin', 'User', 'admin', TRUE),
 
-- Moderator user (password: modpassword123)
('mod@example.com', 'moderator',
 '$2b$10$rOzWbkZtZl.QpC4YKKjJkOzfOqKJj5QGyhUBTCl1VtcxE1Pg8F3Ni', 
 'Mod', 'User', 'moderator', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Insert test media files
INSERT INTO media_files (
    filename, original_filename, file_path, file_size, mime_type, 
    file_hash, user_id, category_id, title, description, tags, is_public
) VALUES 
('test-image-1.jpg', 'sample-photo.jpg', '/uploads/test-image-1.jpg', 
 245760, 'image/jpeg', 'a1b2c3d4e5f6...', 1, 1, 'Test Image 1', 
 'A sample test image for CI/CD', ARRAY['test', 'sample', 'ci'], TRUE),
 
('test-video-1.mp4', 'sample-video.mp4', '/uploads/test-video-1.mp4', 
 5242880, 'video/mp4', 'b2c3d4e5f6g7...', 1, 2, 'Test Video 1',
 'A sample test video for CI/CD', ARRAY['test', 'video', 'sample'], FALSE),
 
('test-document-1.pdf', 'sample-doc.pdf', '/uploads/test-document-1.pdf', 
 102400, 'application/pdf', 'c3d4e5f6g7h8...', 2, 3, 'Test Document 1',
 'A sample test document for CI/CD', ARRAY['test', 'document', 'pdf'], TRUE);

-- Insert test collections
INSERT INTO collections (name, description, user_id, is_public) VALUES 
('Test Collection 1', 'A test collection for CI/CD testing', 1, TRUE),
('Private Collection', 'A private test collection', 1, FALSE),
('Admin Collection', 'Admin test collection', 2, TRUE);

-- Associate media files with collections
INSERT INTO collection_media (collection_id, media_file_id, sort_order) VALUES 
(1, 1, 1),
(1, 2, 2),
(2, 3, 1),
(3, 1, 1);

-- Insert initial system health record
INSERT INTO system_health (service_name, status, response_time_ms) VALUES 
('database', 'healthy', 5),
('redis', 'healthy', 2),
('api', 'healthy', 15),
('file-storage', 'healthy', 8);

-- Insert CI health check record
INSERT INTO ci_health_checks (pipeline_id, test_suite, status) VALUES 
('init', 'database_setup', 'passed');

-- ========================================================================
-- 🔧 Database Functions & Triggers
-- ========================================================================

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_files_updated_at ON media_files;
CREATE TRIGGER update_media_files_updated_at 
    BEFORE UPDATE ON media_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at 
    BEFORE UPDATE ON collections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_categories_updated_at ON media_categories;
CREATE TRIGGER update_media_categories_updated_at 
    BEFORE UPDATE ON media_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================================================
-- 📊 Performance Views for Testing
-- ========================================================================

-- View for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.username,
    COUNT(DISTINCT mf.id) as media_count,
    COUNT(DISTINCT c.id) as collection_count,
    SUM(mf.file_size) as total_storage_bytes,
    u.created_at,
    u.last_login
FROM users u
LEFT JOIN media_files mf ON u.id = mf.user_id AND mf.deleted_at IS NULL
LEFT JOIN collections c ON u.id = c.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.username, u.created_at, u.last_login;

-- View for media file statistics  
CREATE OR REPLACE VIEW media_stats AS
SELECT 
    mc.name as category_name,
    COUNT(*) as file_count,
    SUM(mf.file_size) as total_size_bytes,
    AVG(mf.file_size) as avg_size_bytes,
    SUM(mf.view_count) as total_views,
    SUM(mf.download_count) as total_downloads
FROM media_files mf
JOIN media_categories mc ON mf.category_id = mc.id
WHERE mf.deleted_at IS NULL
GROUP BY mc.id, mc.name;

-- ========================================================================
-- 🧪 Test Validation Queries
-- ========================================================================

-- Validate schema creation
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    user_count INTEGER;
    media_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    -- Count indexes  
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    -- Count test users
    SELECT COUNT(*) INTO user_count FROM users;
    
    -- Count test media files
    SELECT COUNT(*) INTO media_count FROM media_files;
    
    RAISE NOTICE 'Database initialization complete:';
    RAISE NOTICE '  Tables created: %', table_count;
    RAISE NOTICE '  Indexes created: %', index_count;
    RAISE NOTICE '  Test users: %', user_count;
    RAISE NOTICE '  Test media files: %', media_count;
    
    -- Validate essential data exists
    IF user_count < 3 THEN
        RAISE EXCEPTION 'Insufficient test users created';
    END IF;
    
    IF media_count < 3 THEN
        RAISE EXCEPTION 'Insufficient test media files created';
    END IF;
    
    RAISE NOTICE '✅ Database validation passed';
END $$;

-- ========================================================================
-- 🔒 Security Settings
-- ========================================================================

-- Ensure row-level security is ready for future implementation
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions for CI test user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO test_user;

-- ========================================================================
-- 📝 Final Status Report
-- ========================================================================

-- Insert final status
INSERT INTO ci_health_checks (pipeline_id, test_suite, status, completed_at, duration_ms) 
VALUES ('init', 'database_initialization', 'passed', CURRENT_TIMESTAMP, 1000);

-- Success message
SELECT 
    '🎉 CI/CD Database initialization completed successfully!' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as tables_created,
    (SELECT COUNT(*) FROM users) as test_users_created,
    (SELECT COUNT(*) FROM media_files) as test_media_created;