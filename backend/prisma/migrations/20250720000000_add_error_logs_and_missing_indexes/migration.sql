-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "error_code" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "stack_trace" TEXT,
    "request_path" TEXT NOT NULL,
    "request_method" TEXT NOT NULL,
    "status_code" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_correlation_id_idx" ON "error_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "error_logs_created_at_idx" ON "error_logs"("created_at");

-- CreateIndex
CREATE INDEX "error_logs_user_id_idx" ON "error_logs"("user_id");

-- CreateIndex for media_requests (missing from initial migration)
CREATE INDEX "media_requests_user_id_status_idx" ON "media_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "media_requests_created_at_idx" ON "media_requests"("created_at");

-- CreateIndex
CREATE INDEX "media_requests_tmdb_id_media_type_idx" ON "media_requests"("tmdb_id", "media_type");

-- CreateIndex for service_status
CREATE INDEX "service_status_last_check_at_idx" ON "service_status"("last_check_at");

-- CreateIndex for rate_limits
CREATE INDEX "rate_limits_user_id_endpoint_idx" ON "rate_limits"("user_id", "endpoint");

-- CreateIndex
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits"("window_start");

-- CreateIndex for session_tokens
CREATE INDEX "session_tokens_user_id_idx" ON "session_tokens"("user_id");

-- CreateIndex
CREATE INDEX "session_tokens_expires_at_idx" ON "session_tokens"("expires_at");

-- CreateIndex for sessions
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;