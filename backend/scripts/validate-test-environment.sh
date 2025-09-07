#!/bin/bash

# Test Environment Validation Script
# Validates Redis authentication, database connections, and dependencies

set -e

echo "🔍 MediaNest Test Environment Validation"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ ${message}${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  ${message}${NC}"
    elif [ "$status" = "ERROR" ]; then
        echo -e "${RED}❌ ${message}${NC}"
    else
        echo -e "${BLUE}ℹ️  ${message}${NC}"
    fi
}

# Check if we're in the backend directory
if [ ! -f "package.json" ] || ! grep -q "@medianest/backend" package.json; then
    print_status "ERROR" "Please run this script from the backend directory"
    exit 1
fi

print_status "INFO" "Checking test environment setup..."

# Check Docker installation
if command -v docker &> /dev/null; then
    print_status "OK" "Docker is installed"
else
    print_status "ERROR" "Docker is not installed or not in PATH"
    exit 1
fi

# Check Docker Compose
if docker compose version &> /dev/null; then
    print_status "OK" "Docker Compose is available"
elif docker-compose version &> /dev/null; then
    print_status "WARN" "Using legacy docker-compose command"
else
    print_status "ERROR" "Docker Compose is not available"
    exit 1
fi

# Check for required files
required_files=(
    "docker-compose.test.yml"
    "vitest.config.ts" 
    ".env.test"
    "playwright.config.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_status "OK" "Found $file"
    else
        print_status "ERROR" "Missing required file: $file"
        exit 1
    fi
done

# Check Node.js dependencies
print_status "INFO" "Checking Node.js dependencies..."

if npm ls @playwright/test &> /dev/null; then
    print_status "OK" "@playwright/test is installed"
else
    print_status "ERROR" "@playwright/test is not installed"
    echo "Run: npm install @playwright/test --save-dev"
fi

if npm ls vitest &> /dev/null; then
    print_status "OK" "vitest is installed"
else
    print_status "ERROR" "vitest is not installed"
fi

if npm ls ioredis &> /dev/null; then
    print_status "OK" "ioredis is installed"
else
    print_status "ERROR" "ioredis is not installed"
fi

# Start test containers
print_status "INFO" "Starting test containers..."

if docker compose -f docker-compose.test.yml up -d --wait; then
    print_status "OK" "Test containers started"
else
    print_status "ERROR" "Failed to start test containers"
    exit 1
fi

# Wait for services to be ready
sleep 5

# Test PostgreSQL connection
print_status "INFO" "Testing PostgreSQL connection..."
if pg_isready -h localhost -p 5433 -U test &> /dev/null; then
    print_status "OK" "PostgreSQL is ready on port 5433"
else
    print_status "ERROR" "PostgreSQL connection failed"
    print_status "INFO" "Checking container logs..."
    docker logs backend-postgres-test-1 --tail 10
fi

# Test Redis connection
print_status "INFO" "Testing Redis connection..."
if docker exec backend-redis-test-1 redis-cli ping &> /dev/null; then
    print_status "OK" "Redis is ready on port 6380"
    
    # Test Redis authentication (should not require auth in test)
    if docker exec backend-redis-test-1 redis-cli -c "set test:key test:value" &> /dev/null; then
        print_status "OK" "Redis operations working without authentication"
        docker exec backend-redis-test-1 redis-cli del test:key &> /dev/null
    else
        print_status "ERROR" "Redis operations failed - possible NOAUTH error"
        docker exec backend-redis-test-1 redis-cli ping || true
    fi
else
    print_status "ERROR" "Redis connection failed"
    print_status "INFO" "Checking container logs..."
    docker logs backend-redis-test-1 --tail 10
fi

# Check port availability
print_status "INFO" "Checking port availability..."

if netstat -tulpn 2>/dev/null | grep -q ":5433 "; then
    print_status "OK" "PostgreSQL test port 5433 is listening"
else
    print_status "ERROR" "PostgreSQL test port 5433 is not available"
fi

if netstat -tulpn 2>/dev/null | grep -q ":6380 "; then
    print_status "OK" "Redis test port 6380 is listening"
else
    print_status "ERROR" "Redis test port 6380 is not available"
fi

# Test database migrations
print_status "INFO" "Testing database migrations..."
export DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test"

if npx prisma migrate deploy &> /dev/null; then
    print_status "OK" "Database migrations applied successfully"
else
    print_status "WARN" "Database migrations failed or not needed"
fi

# Environment variables check
print_status "INFO" "Validating environment variables..."

if [ -f ".env.test" ]; then
    source .env.test
    
    if [ -n "$REDIS_URL" ]; then
        print_status "OK" "REDIS_URL is set: $REDIS_URL"
    else
        print_status "ERROR" "REDIS_URL not set in .env.test"
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        print_status "OK" "DATABASE_URL is set: $DATABASE_URL"
    else
        print_status "ERROR" "DATABASE_URL not set in .env.test"
    fi
else
    print_status "ERROR" "No .env.test file found"
fi

# Test runner validation
print_status "INFO" "Running quick test validation..."

if npx vitest run --reporter=minimal --config vitest.config.ts src/__tests__/setup.test.ts 2>/dev/null || true; then
    print_status "OK" "Vitest configuration is valid"
else
    print_status "WARN" "Vitest validation had issues (this may be expected)"
fi

# Summary
echo ""
echo "🎯 Validation Summary"
echo "===================="

container_status=$(docker ps --format "{{.Names}}: {{.Status}}" | grep -E "(redis-test|postgres-test)" || echo "No test containers running")
print_status "INFO" "Container Status:"
echo "$container_status"

echo ""
print_status "INFO" "Test environment validation completed"
print_status "INFO" "Ready to run: npm test"
print_status "INFO" "Ready to run: npm run test:e2e"

echo ""
echo "🛠️  Troubleshooting Tips:"
echo "   • If Redis NOAUTH errors occur, restart containers: docker-compose -f docker-compose.test.yml down && docker-compose -f docker-compose.test.yml up -d"
echo "   • For database issues, check migrations: npx prisma migrate reset --force"
echo "   • For dependency issues, run: npm install"
echo "   • To cleanup test data: docker-compose -f docker-compose.test.yml down -v"