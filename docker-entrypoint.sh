#!/bin/sh

# Exit on error
set -e

echo "Starting MediaNest..."

# Run database migrations
echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy

# Start backend server in background
echo "Starting backend server..."
cd /app/backend
npm start &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
until curl -f http://localhost:4000/health > /dev/null 2>&1; do
  echo "Backend not ready yet..."
  sleep 2
done
echo "Backend is ready!"

# Start frontend server
echo "Starting frontend server..."
cd /app/frontend
npm start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID