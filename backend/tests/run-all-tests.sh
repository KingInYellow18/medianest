#!/bin/bash

# Complete Test Suite Runner for MediaNest
# This script runs all tests including unit, integration, critical paths, and API endpoints

set -e

echo "🧪 MediaNest Complete Test Suite"
echo "================================"
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

# Parse arguments
COVERAGE=false
WATCH=false
FILTER=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --filter)
            FILTER="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--coverage] [--watch] [--filter <pattern>]"
            exit 1
            ;;
    esac
done

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
export REDIS_HOST="localhost"
export REDIS_PORT="6380"
export JWT_SECRET="test-jwt-secret"
export JWT_ISSUER="medianest-test"
export JWT_AUDIENCE="medianest-test"
export PLEX_CLIENT_ID="test-client-id"
export PLEX_CLIENT_SECRET="test-client-secret"
export ENCRYPTION_KEY="test-encryption-key-must-be-32-bytes-long!!"
export LOG_LEVEL="error"

# Test categories
declare -A TEST_CATEGORIES=(
    ["Unit Tests"]="tests/unit/**/*.test.ts"
    ["Integration Tests"]="tests/integration/**/*.test.ts"
    ["Critical Path Tests"]="tests/integration/critical-paths/**/*.test.ts"
    ["API Endpoint Tests"]="tests/api/**/*.test.ts"
)

# Function to run tests
run_tests() {
    local category=$1
    local pattern=$2
    
    echo ""
    echo -e "${BLUE}Running $category...${NC}"
    echo "========================================="
    
    if [ "$WATCH" = true ]; then
        npx vitest "$pattern" --watch
    elif [ "$COVERAGE" = true ]; then
        npx vitest run "$pattern" --coverage
    else
        npx vitest run "$pattern" --reporter=verbose
    fi
    
    return $?
}

# Track results
TOTAL_CATEGORIES=0
PASSED_CATEGORIES=0
FAILED_CATEGORIES=0
FAILED_TESTS=""

# Run tests based on filter or all categories
if [ -n "$FILTER" ]; then
    echo -e "${YELLOW}Running tests matching filter: $FILTER${NC}"
    if [ "$WATCH" = true ]; then
        npx vitest "$FILTER" --watch
    elif [ "$COVERAGE" = true ]; then
        npx vitest run "$FILTER" --coverage
    else
        npx vitest run "$FILTER" --reporter=verbose
    fi
    EXIT_CODE=$?
else
    # Run each test category
    for category in "${!TEST_CATEGORIES[@]}"; do
        pattern="${TEST_CATEGORIES[$category]}"
        
        if run_tests "$category" "$pattern"; then
            echo -e "${GREEN}✓ $category PASSED${NC}"
            ((PASSED_CATEGORIES++))
        else
            echo -e "${RED}✗ $category FAILED${NC}"
            ((FAILED_CATEGORIES++))
            FAILED_TESTS="$FAILED_TESTS\n  - $category"
        fi
        ((TOTAL_CATEGORIES++))
    done
    
    # Summary
    echo ""
    echo "========================================="
    echo -e "${GREEN}Test Suite Summary${NC}"
    echo "========================================="
    echo "Total Categories: $TOTAL_CATEGORIES"
    echo -e "Passed: ${GREEN}$PASSED_CATEGORIES${NC}"
    echo -e "Failed: ${RED}$FAILED_CATEGORIES${NC}"
    
    if [ $FAILED_CATEGORIES -gt 0 ]; then
        echo ""
        echo -e "${RED}Failed Categories:${NC}"
        echo -e "$FAILED_TESTS"
    fi
    
    # Coverage report summary
    if [ "$COVERAGE" = true ] && [ $FAILED_CATEGORIES -eq 0 ]; then
        echo ""
        echo -e "${YELLOW}Generating combined coverage report...${NC}"
        npx vitest run --coverage
        echo ""
        echo -e "${GREEN}Coverage report generated in coverage/ directory${NC}"
        echo "Open coverage/index.html to view detailed report"
    fi
    
    if [ $FAILED_CATEGORIES -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
        EXIT_CODE=0
    else
        echo ""
        echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
        EXIT_CODE=1
    fi
fi

# Test execution time
END_TIME=$(date +%s)
START_TIME=${START_TIME:-$END_TIME}
DURATION=$((END_TIME - START_TIME))
echo ""
echo "Test execution time: ${DURATION} seconds"

# Cleanup (optional - comment out to keep containers running for debugging)
if [ "$KEEP_TEST_DB" != "true" ] && [ "$WATCH" != "true" ]; then
    echo ""
    echo -e "${YELLOW}Cleaning up test containers...${NC}"
    docker compose -f ../docker-compose.test.yml down
fi

echo ""
echo "Test run completed at: $(date)"

# Tips for failed tests
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}Debug tips:${NC}"
    echo "  1. Run with KEEP_TEST_DB=true to inspect database after tests"
    echo "  2. Use --filter to run specific tests"
    echo "  3. Use --watch for interactive test development"
    echo "  4. Check logs in test output for detailed errors"
    echo "  5. Run 'npm run test:ui' for visual test debugging"
fi

exit $EXIT_CODE