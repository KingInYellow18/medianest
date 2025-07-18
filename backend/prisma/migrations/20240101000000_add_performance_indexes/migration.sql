-- Add indexes for MediaRequest table
CREATE INDEX IF NOT EXISTS "media_requests_userId_status_idx" ON "media_requests" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "media_requests_createdAt_idx" ON "media_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "media_requests_tmdbId_mediaType_idx" ON "media_requests" ("tmdb_id", "media_type");

-- Add indexes for ServiceStatus table
CREATE INDEX IF NOT EXISTS "service_status_lastCheckAt_idx" ON "service_status" ("last_check_at");

-- Add indexes for RateLimit table
CREATE INDEX IF NOT EXISTS "rate_limits_userId_endpoint_idx" ON "rate_limits" ("user_id", "endpoint");
CREATE INDEX IF NOT EXISTS "rate_limits_windowStart_idx" ON "rate_limits" ("window_start");

-- Add indexes for SessionToken table
CREATE INDEX IF NOT EXISTS "session_tokens_userId_idx" ON "session_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "session_tokens_expiresAt_idx" ON "session_tokens" ("expires_at");

-- Add indexes for Session table
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" ("expires");