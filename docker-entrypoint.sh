#!/bin/sh
# ==============================================================================
# MediaNest Production Container Entry Point
# ==============================================================================
# This script manages the startup and shutdown lifecycle of MediaNest services
# Features:
# - Graceful signal handling (SIGTERM, SIGINT)  
# - Database migration with retry logic
# - Service health monitoring and recovery
# - Proper process management for container orchestration
# ==============================================================================

# Shell configuration for production reliability
# Exit immediately if any command fails (fail-fast principle)
set -e
# Enable pipefail to catch errors in command pipelines
set -o pipefail

# Signal handling for graceful container shutdown
# Docker sends SIGTERM for graceful shutdown, SIGKILL after timeout
# This trap ensures proper cleanup of background processes
trap 'echo "🛑 Received shutdown signal, stopping services gracefully..."; kill -TERM $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait $BACKEND_PID $FRONTEND_PID; echo "✅ All services stopped cleanly"; exit 0' TERM INT

echo "Starting MediaNest v1.0.0..."
echo "Environment: ${NODE_ENV:-production}"

# ==============================================================================
# ENVIRONMENT VALIDATION - Ensure critical variables are configured
# ==============================================================================
# Validate required environment variables before starting services
# Prevents runtime failures and provides clear error messages

echo "🔍 Validating environment configuration..."

# Database connection validation
# DATABASE_URL is critical for all database operations (authentication, content storage)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "   Required format: postgresql://user:password@host:port/database"
    echo "   Example: postgresql://medianest:password@postgres:5432/medianest"
    exit 1
fi

# JWT secret validation  
# JWT_SECRET is critical for user authentication and session management
if [ -z "$JWT_SECRET" ]; then
    echo "❌ ERROR: JWT_SECRET environment variable is not set"
    echo "   Generate with: openssl rand -base64 32"
    echo "   This secret signs all authentication tokens - keep secure!"
    exit 1
fi

# Encryption key validation
# ENCRYPTION_KEY is critical for encrypting sensitive user data at rest
if [ -z "$ENCRYPTION_KEY" ]; then
    echo "❌ ERROR: ENCRYPTION_KEY environment variable is not set" 
    echo "   Generate with: openssl rand -base64 32"
    echo "   This key encrypts sensitive data - backup securely!"
    exit 1
fi

echo "✅ Environment validation passed"

# ==============================================================================
# DATABASE MIGRATION - Apply schema changes with retry logic  
# ==============================================================================
# Database migrations must complete successfully before starting application services
# Retry logic handles temporary database unavailability during container orchestration

echo "🗄️ Applying database migrations..."
cd /app/backend

# Migration retry configuration
MAX_RETRIES=5        # Maximum retry attempts for resilient deployment
RETRY_COUNT=0        # Current attempt counter
RETRY_DELAY=5        # Seconds to wait between retry attempts

# Migration retry loop with exponential backoff consideration
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "📋 Migration attempt $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    # Execute Prisma migrations (applies pending schema changes)
    if npx prisma migrate deploy; then
        echo "✅ Database migrations completed successfully"
        echo "📊 Database schema is now up-to-date"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⚠️  Migration failed (attempt $RETRY_COUNT/$MAX_RETRIES)"
            echo "🔄 Retrying in $RETRY_DELAY seconds..."
            echo "   Common causes: Database not ready, network connectivity, lock conflicts"
            sleep $RETRY_DELAY
        fi
    fi
done

# Final failure check after all retry attempts exhausted
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ CRITICAL ERROR: Failed to run database migrations after $MAX_RETRIES attempts"
    echo "   Check database connectivity and schema integrity"
    echo "   Container will exit to prevent data corruption"
    exit 1
fi

# Start backend server in background
echo "Starting backend server on port ${PORT:-4000}..."
cd /app/backend
npm start &
BACKEND_PID=$!

# Wait for backend to be ready with timeout
echo "Waiting for backend to be ready..."
TIMEOUT=60
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -f http://localhost:${PORT:-4000}/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    echo "Backend not ready yet... ($ELAPSED/$TIMEOUT seconds)"
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "ERROR: Backend failed to start within $TIMEOUT seconds"
    kill -TERM $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend server
echo "Starting frontend server on port 3000..."
cd /app/frontend
npm start &
FRONTEND_PID=$!

# Log startup completion
echo "MediaNest started successfully!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Monitor processes
while true; do
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERROR: Backend process died unexpectedly"
        kill -TERM $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "ERROR: Frontend process died unexpectedly"
        kill -TERM $BACKEND_PID 2>/dev/null
        exit 1
    fi
    
    # Check health endpoint
    if ! curl -f http://localhost:${PORT:-4000}/health > /dev/null 2>&1; then
        echo "WARNING: Backend health check failed"
    fi
    
    sleep 30
done