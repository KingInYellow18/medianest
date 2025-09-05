#!/bin/bash

# API Endpoint Test Runner for MediaNest
# This script runs all API endpoint tests with MSW mocking

set -e

echo "🧪 MediaNest API Endpoint Test Suite"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Run API endpoint tests
echo ""
echo -e "${BLUE}Running API Endpoint Tests with MSW...${NC}"
echo "======================================="

# Array of API test files
API_TESTS=(
    "tests/api/auth.endpoints.test.ts"
    "tests/api/media.endpoints.test.ts"
    "tests/api/services.endpoints.test.ts"
    "tests/api/youtube.endpoints.test.ts"
)

# Track results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_FILES=()

# Function to run a single test file
run_test() {
    local TEST_FILE=$1
    local TEST_NAME=$(basename $TEST_FILE .test.ts)
    
    echo ""
    echo -e "${YELLOW}Testing: ${TEST_NAME} endpoints${NC}"
    echo "----------------------------------------"
    
    if npx vitest run "$TEST_FILE" --reporter=verbose; then
        echo -e "${GREEN}✓ PASSED: ${TEST_NAME}${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAILED: ${TEST_NAME}${NC}"
        ((FAILED_TESTS++))
        FAILED_FILES+=("$TEST_NAME")
        return 1
    fi
}

# Run each test file
for TEST_FILE in "${API_TESTS[@]}"; do
    ((TOTAL_TESTS++))
    run_test "$TEST_FILE" || true
done

# Summary
echo ""
echo "========================================"
echo -e "${BLUE}API Endpoint Test Summary${NC}"
echo "========================================"
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed test suites:${NC}"
    for FAILED in "${FAILED_FILES[@]}"; do
        echo "  - $FAILED"
    done
fi

# Coverage report (optional)
if [ "$1" == "--coverage" ]; then
    echo ""
    echo -e "${YELLOW}Generating coverage report for API tests...${NC}"
    npx vitest run tests/api --coverage
    echo ""
    echo -e "${GREEN}Coverage report generated in coverage/ directory${NC}"
fi

# Run all tests together (optional)
if [ "$1" == "--all" ]; then
    echo ""
    echo -e "${YELLOW}Running all API tests together...${NC}"
    echo "========================================"
    npx vitest run tests/api
fi

# Performance check
if [ "$1" == "--perf" ]; then
    echo ""
    echo -e "${YELLOW}Running performance analysis...${NC}"
    echo "========================================"
    
    for TEST_FILE in "${API_TESTS[@]}"; do
        echo ""
        echo -e "${BLUE}Performance: $(basename $TEST_FILE .test.ts)${NC}"
        time npx vitest run "$TEST_FILE" --reporter=silent
    done
fi

# Exit code
if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All API endpoint tests passed!${NC}"
    EXIT_CODE=0
else
    echo ""
    echo -e "${RED}❌ Some API tests failed. Please review the output above.${NC}"
    EXIT_CODE=1
fi

# Cleanup (optional - comment out to keep containers running for debugging)
if [ "$KEEP_TEST_DB" != "true" ]; then
    echo ""
    echo -e "${YELLOW}Cleaning up test containers...${NC}"
    docker compose -f ../docker-compose.test.yml down
fi

echo ""
echo "Test run completed at: $(date)"
echo ""

# Additional information
echo "Useful commands:"
echo "  - Run specific endpoint: npx vitest run tests/api/auth.endpoints.test.ts"
echo "  - Run with UI: npx vitest --ui tests/api"
echo "  - Keep test DB running: KEEP_TEST_DB=true ./run-api-tests.sh"
echo "  - Generate coverage: ./run-api-tests.sh --coverage"
echo "  - Run all together: ./run-api-tests.sh --all"
echo "  - Performance check: ./run-api-tests.sh --perf"

exit $EXIT_CODE