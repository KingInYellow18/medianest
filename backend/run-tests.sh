#!/bin/bash

# Script to run backend tests with test database

echo "Starting test environment..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Start test database if not running
if ! docker compose -f docker-compose.test.yml ps | grep -q "postgres-test.*Up"; then
    echo "Starting test database..."
    docker compose -f docker-compose.test.yml up -d
    echo "Waiting for database to be ready..."
    sleep 5
fi

# Run migrations on test database
echo "Running database migrations..."
cd backend
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate deploy

# Run tests
echo "Running tests..."
npm test

# Capture exit code
TEST_EXIT_CODE=$?

# Optionally stop test database
read -p "Stop test database? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd ..
    docker compose -f docker-compose.test.yml down
fi

exit $TEST_EXIT_CODE