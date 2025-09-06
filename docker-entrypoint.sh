#!/bin/sh

# MediaNest Production Entry Point
# Handles graceful startup and shutdown with proper signal handling

# Exit on error
set -e

# Trap signals for graceful shutdown
trap 'echo "Received shutdown signal, stopping services..."; kill -TERM $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait $BACKEND_PID $FRONTEND_PID; exit 0' TERM INT

echo "Starting MediaNest v1.0.0..."
echo "Environment: ${NODE_ENV:-production}"

# Validate critical environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "ERROR: JWT_SECRET is not set"
    exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "ERROR: ENCRYPTION_KEY is not set"
    exit 1
fi

# Run database migrations with retry logic
echo "Running database migrations..."
cd /app/backend
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if npx prisma migrate deploy; then
        echo "Database migrations completed successfully"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Migration failed (attempt $RETRY_COUNT/$MAX_RETRIES), retrying in 5 seconds..."
        sleep 5
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Failed to run database migrations after $MAX_RETRIES attempts"
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