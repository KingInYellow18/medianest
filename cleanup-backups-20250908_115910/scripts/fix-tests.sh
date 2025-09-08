#!/bin/bash

# MediaNest Test Environment Fix Script
# Resolves common test issues and resets the test environment

echo "🔧 MediaNest Test Fix Script"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.." || exit 1

echo -e "${YELLOW}Step 1: Stopping existing test containers...${NC}"
docker-compose -f docker-compose.test.yml down
check_status "Stopped test containers"

echo -e "${YELLOW}Step 2: Starting fresh test containers...${NC}"
docker-compose -f docker-compose.test.yml up -d
check_status "Started test containers"

echo -e "${YELLOW}Step 3: Waiting for services to be ready...${NC}"
sleep 10
# Check PostgreSQL is ready
until PGPASSWORD=test psql -h localhost -p 5433 -U test -d medianest_test -c '\q' 2>/dev/null; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
check_status "PostgreSQL is ready"

# Check Redis is ready
until redis-cli -p 6380 ping | grep -q PONG; do
    echo "Waiting for Redis..."
    sleep 2
done
check_status "Redis is ready"

echo -e "${YELLOW}Step 4: Building shared package...${NC}"
cd shared && npm run build
check_status "Built shared package"
cd ..

echo -e "${YELLOW}Step 5: Resetting test database...${NC}"
cd backend
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate reset --force --skip-seed
check_status "Reset test database"

echo -e "${YELLOW}Step 6: Running migrations...${NC}"
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate deploy
check_status "Applied database migrations"
cd ..

echo -e "${YELLOW}Step 7: Clearing build caches...${NC}"
rm -rf frontend/.next
rm -rf backend/dist
rm -rf shared/dist
rm -rf coverage
rm -rf test-results
check_status "Cleared build caches"

echo -e "${YELLOW}Step 8: Installing dependencies...${NC}"
npm install
check_status "Installed dependencies"

echo -e "${YELLOW}Step 9: Generating Prisma client...${NC}"
npm run db:generate
check_status "Generated Prisma client"

echo ""
echo -e "${GREEN}✅ Test environment has been reset!${NC}"
echo ""
echo "You can now run tests with:"
echo "  - All tests: npm test"
echo "  - Backend only: cd backend && npm test"
echo "  - Frontend only: cd frontend && npm test"
echo "  - E2E tests: npm run test:e2e"
echo "  - With UI: npm run test:ui"
echo ""
echo "For test architecture documentation, see docs/TESTING_ARCHITECTURE.md"