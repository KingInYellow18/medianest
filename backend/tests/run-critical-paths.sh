#!/bin/bash

# Critical Path Test Runner for MediaNest
# This script runs all critical path tests with proper test database setup

set -e

echo "🧪 MediaNest Critical Path Test Suite"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo -e "${RED}Error: This script must be run from the backend directory${NC}"
    exit 1
fi

# Start test database containers
echo -e "${YELLOW}Starting test database containers...${NC}"
docker compose -f ../docker-compose.test.yml up -d postgres-test redis-test

# Wait for databases to be ready
echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
sleep 5

# Run database migrations on test database
echo -e "${YELLOW}Running test database migrations...${NC}"
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate deploy

# Set test environment
export NODE_ENV=test
export DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test"
export REDIS_URL="redis://localhost:6380"

# Run critical path tests
echo ""
echo -e "${GREEN}Running Critical Path Tests...${NC}"
echo "==============================="

# Array of critical path test files
CRITICAL_TESTS=(
    "tests/integration/critical-paths/auth-flow.test.ts"
    "tests/integration/critical-paths/media-request-flow.test.ts"
    "tests/integration/critical-paths/service-monitoring.test.ts"
    "tests/integration/critical-paths/youtube-download-flow.test.ts"
    "tests/integration/critical-paths/user-isolation.test.ts"
    "tests/integration/critical-paths/error-scenarios.test.ts"
)

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Run each test file
for TEST_FILE in "${CRITICAL_TESTS[@]}"; do
    echo ""
    echo -e "${YELLOW}Running: $(basename $TEST_FILE)${NC}"
    echo "----------------------------------------"
    
    if npx vitest run "$TEST_FILE" --reporter=verbose; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
done

# Summary
echo ""
echo "========================================"
echo -e "${GREEN}Critical Path Test Summary${NC}"
echo "========================================"
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All critical paths tested successfully!${NC}"
    EXIT_CODE=0
else
    echo ""
    echo -e "${RED}❌ Some critical path tests failed. Please review the output above.${NC}"
    EXIT_CODE=1
fi

# Optional: Generate coverage report for critical paths
if [ "$1" == "--coverage" ]; then
    echo ""
    echo -e "${YELLOW}Generating coverage report for critical paths...${NC}"
    npx vitest run tests/integration/critical-paths --coverage
fi

# Cleanup (optional - comment out to keep containers running for debugging)
if [ "$KEEP_TEST_DB" != "true" ]; then
    echo ""
    echo -e "${YELLOW}Cleaning up test containers...${NC}"
    docker compose -f ../docker-compose.test.yml down
fi

echo ""
echo "Test run completed at: $(date)"

exit $EXIT_CODE