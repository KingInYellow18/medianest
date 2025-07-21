#!/bin/bash

# Priority 2 Testing Suite - MediaNest Backend
# Comprehensive test runner for Priority 2 issues

set -e

echo "🧪 MediaNest Priority 2 Testing Suite"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test categories
RATE_LIMIT_TESTS="backend/tests/integration/middleware/rate-limit.test.ts"
REDIS_TIMEOUT_TESTS="backend/tests/integration/middleware/redis-timeout.test.ts"
ERROR_SCENARIO_TESTS="backend/tests/integration/critical-paths/error-scenarios.test.ts"
CONCURRENT_TESTS="backend/tests/integration/critical-paths/concurrent-operations.test.ts"

# Helper function to run test category
run_test_category() {
    local test_file=$1
    local category_name=$2
    
    echo -e "\n${BLUE}📋 Running $category_name Tests...${NC}"
    echo "File: $test_file"
    
    if [ -f "$test_file" ]; then
        if npx vitest run "$test_file" --reporter=verbose; then
            echo -e "${GREEN}✅ $category_name tests PASSED${NC}"
            return 0
        else
            echo -e "${RED}❌ $category_name tests FAILED${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Test file not found: $test_file${NC}"
        return 1
    fi
}

# Helper function to run test with coverage
run_with_coverage() {
    local test_file=$1
    local category_name=$2
    
    echo -e "\n${BLUE}📊 Running $category_name with Coverage...${NC}"
    
    if npx vitest run "$test_file" --coverage --reporter=verbose; then
        echo -e "${GREEN}✅ $category_name coverage analysis complete${NC}"
        return 0
    else
        echo -e "${RED}❌ $category_name coverage analysis failed${NC}"
        return 1
    fi
}

# Function to display test summary
show_test_summary() {
    echo -e "\n${YELLOW}📊 Priority 2 Test Coverage Summary${NC}"
    echo "======================================"
    echo "✅ Rate Limiting Middleware Tests"
    echo "   - Basic rate limiting functionality"
    echo "   - Custom key generators"
    echo "   - Skip options (successful/failed requests)"
    echo "   - Redis failure scenarios"
    echo "   - Lua script edge cases"
    echo "   - Concurrent request handling"
    echo "   - Pre-configured rate limiters"
    echo "   - Header validation"
    echo "   - Timeout scenarios"
    echo ""
    echo "✅ Redis Timeout and Failure Tests"
    echo "   - Connection timeout handling"
    echo "   - Network error scenarios"
    echo "   - Authentication failures"
    echo "   - Memory and resource errors"
    echo "   - Cluster and failover scenarios"
    echo "   - Lua script execution errors"
    echo "   - Partial failure scenarios"
    echo "   - Error logging and monitoring"
    echo "   - Graceful degradation patterns"
    echo ""
    echo "✅ Error Scenario Tests"
    echo "   - Service unavailability (Plex, Overseerr)"
    echo "   - Database error scenarios"
    echo "   - Authentication error handling"
    echo "   - Rate limiting error responses"
    echo "   - File system errors"
    echo "   - Network error scenarios"
    echo "   - Input validation errors"
    echo "   - Graceful degradation"
    echo "   - Error logging and correlation"
    echo ""
    echo "✅ Concurrent Operations Tests"
    echo "   - High concurrency rate limiting"
    echo "   - Concurrent authentication"
    echo "   - Resource exhaustion scenarios"
    echo "   - Database connection pool edge cases"
    echo "   - Circuit breaker patterns"
    echo "   - Retry logic with exponential backoff"
    echo "   - Edge case input handling"
}

# Main execution
main() {
    local failed_tests=0
    local total_categories=4
    
    echo -e "${BLUE}🚀 Starting Priority 2 Test Suite...${NC}"
    
    # Check if we're in the right directory
    if [ ! -d "backend/tests" ]; then
        echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
        exit 1
    fi
    
    # Check if required test files exist
    echo -e "\n${BLUE}🔍 Checking test files...${NC}"
    local missing_files=0
    
    for test_file in "$RATE_LIMIT_TESTS" "$REDIS_TIMEOUT_TESTS" "$ERROR_SCENARIO_TESTS" "$CONCURRENT_TESTS"; do
        if [ ! -f "$test_file" ]; then
            echo -e "${RED}❌ Missing: $test_file${NC}"
            ((missing_files++))
        else
            echo -e "${GREEN}✅ Found: $test_file${NC}"
        fi
    done
    
    if [ $missing_files -gt 0 ]; then
        echo -e "\n${RED}❌ $missing_files test file(s) missing. Please ensure all test files are present.${NC}"
        exit 1
    fi
    
    echo -e "\n${GREEN}✅ All test files found!${NC}"
    
    # Run each test category
    echo -e "\n${YELLOW}🧪 Executing Test Categories...${NC}"
    
    # 1. Rate Limiting Tests
    if ! run_test_category "$RATE_LIMIT_TESTS" "Rate Limiting Middleware"; then
        ((failed_tests++))
    fi
    
    # 2. Redis Timeout Tests
    if ! run_test_category "$REDIS_TIMEOUT_TESTS" "Redis Timeout & Failure"; then
        ((failed_tests++))
    fi
    
    # 3. Error Scenario Tests
    if ! run_test_category "$ERROR_SCENARIO_TESTS" "Error Scenarios"; then
        ((failed_tests++))
    fi
    
    # 4. Concurrent Operations Tests
    if ! run_test_category "$CONCURRENT_TESTS" "Concurrent Operations"; then
        ((failed_tests++))
    fi
    
    # Final Results
    echo -e "\n${YELLOW}📋 Test Execution Summary${NC}"
    echo "=========================="
    echo "Total categories: $total_categories"
    echo "Passed: $((total_categories - failed_tests))"
    echo "Failed: $failed_tests"
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ALL PRIORITY 2 TESTS PASSED!${NC}"
        show_test_summary
        echo -e "\n${GREEN}✅ Priority 2 issues have comprehensive test coverage${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ $failed_tests test categories failed${NC}"
        echo -e "${YELLOW}💡 Review the failed tests above and fix any issues${NC}"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "MediaNest Priority 2 Testing Suite"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  --help, -h        Show this help message"
        echo "  --coverage        Run tests with coverage analysis"
        echo "  --summary         Show test coverage summary only"
        echo "  --rate-limit      Run only rate limiting tests"
        echo "  --redis           Run only Redis timeout tests"
        echo "  --errors          Run only error scenario tests"
        echo "  --concurrent      Run only concurrent operations tests"
        echo ""
        echo "Test Categories:"
        echo "  1. Rate Limiting Middleware Tests"
        echo "  2. Redis Timeout and Failure Tests"
        echo "  3. Error Scenario Tests"
        echo "  4. Concurrent Operations Tests"
        exit 0
        ;;
    --coverage)
        echo -e "${BLUE}🔍 Running Priority 2 tests with coverage analysis...${NC}"
        for test_file in "$RATE_LIMIT_TESTS" "$REDIS_TIMEOUT_TESTS" "$ERROR_SCENARIO_TESTS" "$CONCURRENT_TESTS"; do
            category_name=$(basename "$test_file" .test.ts)
            run_with_coverage "$test_file" "$category_name"
        done
        ;;
    --summary)
        show_test_summary
        exit 0
        ;;
    --rate-limit)
        run_test_category "$RATE_LIMIT_TESTS" "Rate Limiting Middleware"
        exit $?
        ;;
    --redis)
        run_test_category "$REDIS_TIMEOUT_TESTS" "Redis Timeout & Failure"
        exit $?
        ;;
    --errors)
        run_test_category "$ERROR_SCENARIO_TESTS" "Error Scenarios"
        exit $?
        ;;
    --concurrent)
        run_test_category "$CONCURRENT_TESTS" "Concurrent Operations"
        exit $?
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
        ;;
esac