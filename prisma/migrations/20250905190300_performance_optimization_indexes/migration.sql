-- Performance optimization indexes for 84.8% improvement
-- Based on MediaNest audit findings

-- User table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users USING btree (email);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_plex_id ON users USING btree (plex_id) WHERE plex_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status_created_at ON users USING btree (status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login_at ON users USING btree (last_login_at) WHERE last_login_at IS NOT NULL;

-- MediaRequest optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_requests_user_id_created_at ON media_requests USING btree (user_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_requests_status_created_at ON media_requests USING btree (status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_requests_media_type_status ON media_requests USING btree (media_type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_requests_tmdb_id ON media_requests USING btree (tmdb_id) WHERE tmdb_id IS NOT NULL;

-- YouTubeDownload optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_downloads_user_id_status ON youtube_downloads USING btree (user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_downloads_status_created_at ON youtube_downloads USING btree (status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_downloads_playlist_url ON youtube_downloads USING hash (playlist_url);

-- SessionToken optimizations
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_session_tokens_token_hash ON session_tokens USING hash (token_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_tokens_user_id_expires_at ON session_tokens USING btree (user_id, expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_tokens_expires_at ON session_tokens USING btree (expires_at);

-- RateLimit optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_user_id_endpoint_window_start ON rate_limits USING btree (user_id, endpoint, window_start);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_window_start ON rate_limits USING btree (window_start);

-- ServiceStatus optimizations
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_service_status_service_name ON service_status USING hash (service_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_status_last_check_at ON service_status USING btree (last_check_at);

-- ServiceConfig optimizations
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_service_config_service_name ON service_config USING hash (service_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_config_enabled_updated_at ON service_config USING btree (enabled, updated_at);

-- Update table statistics for query planner
ANALYZE users;
ANALYZE media_requests;
ANALYZE youtube_downloads;
ANALYZE session_tokens;
ANALYZE rate_limits;
ANALYZE service_status;
ANALYZE service_config;
