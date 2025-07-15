#!/bin/bash

# MediaNest Comprehensive Test Suite Runner
# This script orchestrates all testing activities across the monorepo

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Default options
COVERAGE=false
WATCH=false
UI=false
FILTER=""
WORKSPACE=""
QUICK=false
CRITICAL_ONLY=false
API_ONLY=false
UNIT_ONLY=false
VERBOSE=false

# Help function
show_help() {
    echo "MediaNest Test Suite Runner"
    echo ""
    echo "Usage: ./run-all-tests.sh [options]"
    echo ""
    echo "Options:"
    echo "  -c, --coverage       Generate coverage reports"
    echo "  -w, --watch         Run tests in watch mode"
    echo "  -u, --ui            Open Vitest UI"
    echo "  -f, --filter <str>  Filter tests by pattern"
    echo "  -s, --workspace <w> Run tests for specific workspace (frontend|backend|shared)"
    echo "  -q, --quick         Run quick smoke tests only"
    echo "  -C, --critical      Run critical path tests only"
    echo "  -A, --api           Run API endpoint tests only"
    echo "  -U, --unit          Run unit tests only"
    echo "  -v, --verbose       Show detailed output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run-all-tests.sh                    # Run all tests"
    echo "  ./run-all-tests.sh -c                 # Run with coverage"
    echo "  ./run-all-tests.sh -s backend         # Run backend tests only"
    echo "  ./run-all-tests.sh -C                 # Run critical paths only"
    echo "  ./run-all-tests.sh -f 'auth'          # Run tests matching 'auth'"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -w|--watch)
            WATCH=true
            shift
            ;;
        -u|--ui)
            UI=true
            shift
            ;;
        -f|--filter)
            FILTER="$2"
            shift 2
            ;;
        -s|--workspace)
            WORKSPACE="$2"
            shift 2
            ;;
        -q|--quick)
            QUICK=true
            shift
            ;;
        -C|--critical)
            CRITICAL_ONLY=true
            shift
            ;;
        -A|--api)
            API_ONLY=true
            shift
            ;;
        -U|--unit)
            UNIT_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Function to print section headers
print_header() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print status
print_status() {
    echo -e "${CYAN}► $1${NC}"
}

# Function to run command with timing
timed_run() {
    local start_time=$(date +%s)
    "$@"
    local exit_code=$?
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Completed in ${duration}s${NC}"
    else
        echo -e "${RED}✗ Failed after ${duration}s${NC}"
    fi
    
    return $exit_code
}

# Main test execution
print_header "🧪 MediaNest Comprehensive Test Suite"
echo ""
echo -e "${BLUE}Test Configuration:${NC}"
echo "  Coverage: $COVERAGE"
echo "  Watch Mode: $WATCH"
echo "  UI Mode: $UI"
echo "  Filter: ${FILTER:-'none'}"
echo "  Workspace: ${WORKSPACE:-'all'}"
echo ""

# Start test infrastructure
print_header "Setting up test environment"

print_status "Starting test databases..."
docker compose -f docker-compose.test.yml up -d postgres-test redis-test

print_status "Waiting for services to be ready..."
sleep 5

print_status "Running database migrations..."
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" \
    cd backend && npx prisma migrate deploy && cd ..

# Export test environment variables
export NODE_ENV=test
export DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test"
export REDIS_URL="redis://localhost:6380"

# Determine what to run
if [ "$CRITICAL_ONLY" = true ]; then
    print_header "Running Critical Path Tests"
    cd backend && timed_run ./run-critical-paths.sh
    exit_code=$?
elif [ "$API_ONLY" = true ]; then
    print_header "Running API Endpoint Tests"
    cd backend && timed_run ./run-api-tests.sh
    exit_code=$?
elif [ "$UNIT_ONLY" = true ]; then
    print_header "Running Unit Tests Only"
    
    # Build test command
    TEST_CMD="npm test"
    
    if [ "$COVERAGE" = true ]; then
        TEST_CMD="npm run test:coverage"
    fi
    
    if [ "$WATCH" = true ]; then
        TEST_CMD="npm run test:watch"
    fi
    
    if [ "$UI" = true ]; then
        TEST_CMD="npm run test:ui"
    fi
    
    if [ -n "$FILTER" ]; then
        TEST_CMD="$TEST_CMD -- -t '$FILTER'"
    fi
    
    if [ -n "$WORKSPACE" ]; then
        print_status "Running $WORKSPACE unit tests..."
        cd "$WORKSPACE" && eval "$TEST_CMD"
        exit_code=$?
    else
        print_status "Running all unit tests..."
        eval "$TEST_CMD"
        exit_code=$?
    fi
elif [ "$QUICK" = true ]; then
    print_header "Running Quick Smoke Tests"
    
    # Quick smoke tests - just the essentials
    print_status "Running backend smoke tests..."
    cd backend && npx vitest run tests/integration/critical-paths/auth-flow.test.ts
    
    print_status "Running frontend smoke tests..."
    cd ../frontend && npx vitest run src/hooks/__tests__/useWebSocket.test.ts
    
    print_status "Running shared smoke tests..."
    cd ../shared && npx vitest run src/utils/__tests__/crypto.test.ts
    
    exit_code=$?
else
    # Run full test suite
    print_header "Running Full Test Suite"
    
    # Track overall results
    TOTAL_SUITES=0
    PASSED_SUITES=0
    FAILED_SUITES=()
    
    # Function to run tests for a workspace
    run_workspace_tests() {
        local workspace=$1
        local name=$2
        
        print_header "Testing $name"
        cd "$workspace"
        
        # Build command based on options
        local cmd="npm test"
        
        if [ "$COVERAGE" = true ]; then
            cmd="npm run test:coverage"
        fi
        
        if [ "$WATCH" = true ]; then
            cmd="npm run test:watch"
        fi
        
        if [ "$UI" = true ]; then
            cmd="npm run test:ui"
        fi
        
        if [ -n "$FILTER" ]; then
            cmd="$cmd -- -t '$FILTER'"
        fi
        
        ((TOTAL_SUITES++))
        
        if timed_run eval "$cmd"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES+=("$name")
        fi
        
        cd "$SCRIPT_DIR"
    }
    
    # Run tests based on workspace selection
    if [ -z "$WORKSPACE" ] || [ "$WORKSPACE" = "all" ]; then
        # Run all workspaces
        run_workspace_tests "shared" "Shared Package"
        run_workspace_tests "backend" "Backend API"
        run_workspace_tests "frontend" "Frontend UI"
    else
        # Run specific workspace
        case $WORKSPACE in
            frontend)
                run_workspace_tests "frontend" "Frontend UI"
                ;;
            backend)
                run_workspace_tests "backend" "Backend API"
                ;;
            shared)
                run_workspace_tests "shared" "Shared Package"
                ;;
            *)
                echo -e "${RED}Unknown workspace: $WORKSPACE${NC}"
                exit 1
                ;;
        esac
    fi
    
    # Summary
    print_header "Test Suite Summary"
    echo ""
    echo "Total Workspaces: $TOTAL_SUITES"
    echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
    echo -e "Failed: ${RED}${#FAILED_SUITES[@]}${NC}"
    
    if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}Failed workspaces:${NC}"
        for failed in "${FAILED_SUITES[@]}"; do
            echo "  - $failed"
        done
        exit_code=1
    else
        echo ""
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit_code=0
    fi
fi

# Coverage report aggregation
if [ "$COVERAGE" = true ] && [ -z "$WORKSPACE" ]; then
    print_header "Aggregating Coverage Reports"
    
    print_status "Generating combined coverage report..."
    # Note: This would require nyc or similar tool for aggregation
    echo -e "${YELLOW}Coverage reports available in:${NC}"
    echo "  - frontend/coverage/"
    echo "  - backend/coverage/"
    echo "  - shared/coverage/"
fi

# Cleanup
if [ "$KEEP_TEST_DB" != "true" ] && [ "$WATCH" != "true" ] && [ "$UI" != "true" ]; then
    print_header "Cleaning up"
    print_status "Stopping test containers..."
    docker compose -f docker-compose.test.yml down
fi

# Final report
print_header "Test Run Complete"
echo ""
echo "Run time: $(date)"
echo "Exit code: $exit_code"
echo ""

# Helpful commands
if [ $exit_code -ne 0 ]; then
    echo -e "${YELLOW}To debug failing tests:${NC}"
    echo "  - Run with UI: ./run-all-tests.sh -u"
    echo "  - Keep test DB: KEEP_TEST_DB=true ./run-all-tests.sh"
    echo "  - Run specific test: npm test -- path/to/test.ts"
    echo "  - Run in watch mode: ./run-all-tests.sh -w"
fi

exit $exit_code