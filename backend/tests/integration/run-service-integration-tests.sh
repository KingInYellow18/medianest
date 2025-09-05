#!/bin/bash

# Service Integration Test Runner for MediaNest
# This script runs comprehensive service integration contract tests

set -e

echo "🚀 Starting MediaNest Service Integration Tests"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test categories
PLEX_TESTS="tests/integration/integrations/plex-api-client.test.ts"
OVERSEERR_TESTS="tests/integration/integrations/overseerr-api-client.test.ts"
UPTIME_KUMA_TESTS="tests/integration/integrations/uptime-kuma-client.test.ts"
CIRCUIT_BREAKER_TESTS="tests/integration/utils/circuit-breaker.test.ts"
SERVICE_DEGRADATION_TESTS="tests/integration/services/service-degradation.test.ts"
WEBSOCKET_TESTS="tests/integration/websocket/websocket-events.test.ts"

# Function to run test category
run_test_category() {
    local test_name=$1
    local test_files=$2
    
    echo -e "${YELLOW}Running $test_name Tests...${NC}"
    
    if npx vitest run $test_files --reporter=verbose; then
        echo -e "${GREEN}✅ $test_name tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name tests failed${NC}"
        return 1
    fi
}

# Function to run all tests
run_all_tests() {
    local failed_tests=""
    
    echo -e "${YELLOW}Running all Service Integration Tests...${NC}"
    
    # Plex API Client Tests
    if ! run_test_category "Plex API Client" "$PLEX_TESTS"; then
        failed_tests="$failed_tests\n- Plex API Client"
    fi
    
    echo ""
    
    # Overseerr API Client Tests
    if ! run_test_category "Overseerr API Client" "$OVERSEERR_TESTS"; then
        failed_tests="$failed_tests\n- Overseerr API Client"
    fi
    
    echo ""
    
    # Uptime Kuma Client Tests
    if ! run_test_category "Uptime Kuma Client" "$UPTIME_KUMA_TESTS"; then
        failed_tests="$failed_tests\n- Uptime Kuma Client"
    fi
    
    echo ""
    
    # Circuit Breaker Tests
    if ! run_test_category "Circuit Breaker" "$CIRCUIT_BREAKER_TESTS"; then
        failed_tests="$failed_tests\n- Circuit Breaker"
    fi
    
    echo ""
    
    # Service Degradation Tests
    if ! run_test_category "Service Degradation" "$SERVICE_DEGRADATION_TESTS"; then
        failed_tests="$failed_tests\n- Service Degradation"
    fi
    
    echo ""
    
    # WebSocket Event Tests
    if ! run_test_category "WebSocket Events" "$WEBSOCKET_TESTS"; then
        failed_tests="$failed_tests\n- WebSocket Events"
    fi
    
    echo ""
    echo "================================================"
    
    if [ -z "$failed_tests" ]; then
        echo -e "${GREEN}🎉 All Service Integration Tests Passed!${NC}"
        echo -e "${GREEN}✅ Plex API client contract compliance validated${NC}"
        echo -e "${GREEN}✅ Overseerr integration scenarios tested${NC}"
        echo -e "${GREEN}✅ Circuit breaker functionality verified${NC}"
        echo -e "${GREEN}✅ Service degradation handling confirmed${NC}"
        echo -e "${GREEN}✅ Uptime Kuma WebSocket client tested${NC}"
        echo -e "${GREEN}✅ Real-time event handling validated${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failed:${NC}"
        echo -e "${RED}$failed_tests${NC}"
        return 1
    fi
}

# Function to run tests with coverage
run_with_coverage() {
    echo -e "${YELLOW}Running Service Integration Tests with Coverage...${NC}"
    
    npx vitest run \
        $PLEX_TESTS \
        $OVERSEERR_TESTS \
        $UPTIME_KUMA_TESTS \
        $CIRCUIT_BREAKER_TESTS \
        $SERVICE_DEGRADATION_TESTS \
        $WEBSOCKET_TESTS \
        --coverage \
        --reporter=verbose
}

# Function to run specific test type
run_specific_test() {
    case $1 in
        "plex")
            run_test_category "Plex API Client" "$PLEX_TESTS"
            ;;
        "overseerr")
            run_test_category "Overseerr API Client" "$OVERSEERR_TESTS"
            ;;
        "uptime-kuma")
            run_test_category "Uptime Kuma Client" "$UPTIME_KUMA_TESTS"
            ;;
        "circuit-breaker")
            run_test_category "Circuit Breaker" "$CIRCUIT_BREAKER_TESTS"
            ;;
        "degradation")
            run_test_category "Service Degradation" "$SERVICE_DEGRADATION_TESTS"
            ;;
        "websocket")
            run_test_category "WebSocket Events" "$WEBSOCKET_TESTS"
            ;;
        *)
            echo -e "${RED}Unknown test type: $1${NC}"
            echo "Available types: plex, overseerr, uptime-kuma, circuit-breaker, degradation, websocket"
            exit 1
            ;;
    esac
}

# Function to show help
show_help() {
    echo "MediaNest Service Integration Test Runner"
    echo ""
    echo "Usage: $0 [OPTION] [TEST_TYPE]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -c, --coverage  Run tests with coverage report"
    echo "  -a, --all       Run all service integration tests (default)"
    echo ""
    echo "Test Types:"
    echo "  plex           Run Plex API client tests only"
    echo "  overseerr      Run Overseerr API client tests only"
    echo "  uptime-kuma    Run Uptime Kuma client tests only"
    echo "  circuit-breaker Run Circuit breaker tests only"
    echo "  degradation    Run Service degradation tests only"
    echo "  websocket      Run WebSocket event tests only"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 --coverage        # Run all tests with coverage"
    echo "  $0 plex             # Run only Plex API tests"
    echo "  $0 degradation      # Run only service degradation tests"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the backend directory${NC}"
    exit 1
fi

# Parse command line arguments
case $1 in
    "-h"|"--help")
        show_help
        exit 0
        ;;
    "-c"|"--coverage")
        run_with_coverage
        ;;
    "-a"|"--all"|"")
        run_all_tests
        ;;
    *)
        run_specific_test $1
        ;;
esac