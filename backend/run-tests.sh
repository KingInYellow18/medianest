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
    
    # Wait for PostgreSQL to be ready
    for i in {1..30}; do
        if docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U test -h localhost > /dev/null 2>&1; then
            echo "Database is ready!"
            break
        fi
        echo -n "."
        sleep 1
    done
    echo
fi

# Run migrations on test database
echo "Running database migrations..."
cd backend

# First generate Prisma client
echo "Generating Prisma client..."
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma generate

# Reset database and apply migrations (for clean state)
echo "Resetting test database..."
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate reset --force --skip-seed

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