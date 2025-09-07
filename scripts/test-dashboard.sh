#!/bin/bash

# MediaNest Test Dashboard
# Provides a visual overview of test status and coverage

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Unicode characters
CHECK="✓"
CROSS="✗"
WARNING="⚠"
INFO="ℹ"

# Clear screen
clear

# Header
echo -e "${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   MediaNest Test Dashboard                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get test counts from a workspace
get_test_stats() {
    local workspace=$1
    local test_count=0
    local test_files=0
    
    if [ -d "$workspace" ]; then
        # Count test files
        test_files=$(find "$workspace" -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l | xargs)
        
        # Rough estimate of test count (grep for "it(" or "test(")
        if [ $test_files -gt 0 ]; then
            test_count=$(grep -r "it(\|test(" "$workspace" --include="*.test.ts" --include="*.test.tsx" 2>/dev/null | wc -l | xargs)
        fi
    fi
    
    echo "$test_files|$test_count"
}

# Function to check coverage
check_coverage() {
    local workspace=$1
    local coverage_file="$workspace/coverage/coverage-summary.json"
    
    if [ -f "$coverage_file" ]; then
        # Extract coverage percentages using basic tools
        local lines=$(grep -o '"lines":{"total":[0-9]*,"covered":[0-9]*,"skipped":[0-9]*,"pct":[0-9.]*}' "$coverage_file" | grep -o '"pct":[0-9.]*' | cut -d: -f2)
        echo "${lines%.*}"
    else
        echo "N/A"
    fi
}

# Test Infrastructure Status
echo -e "${CYAN}▶ Test Infrastructure Status${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Docker
if command_exists docker; then
    echo -e "  Docker:        ${GREEN}${CHECK} Installed${NC}"
    
    # Check test containers
    if docker ps | grep -q "postgres-test"; then
        echo -e "  Test DB:       ${GREEN}${CHECK} Running${NC}"
    else
        echo -e "  Test DB:       ${YELLOW}${WARNING} Not running${NC} (run: docker compose -f docker-compose.test.yml up -d)"
    fi
    
    if docker ps | grep -q "redis-test"; then
        echo -e "  Test Redis:    ${GREEN}${CHECK} Running${NC}"
    else
        echo -e "  Test Redis:    ${YELLOW}${WARNING} Not running${NC}"
    fi
else
    echo -e "  Docker:        ${RED}${CROSS} Not installed${NC}"
fi

# Check Node/npm
if command_exists node; then
    NODE_VERSION=$(node -v)
    echo -e "  Node.js:       ${GREEN}${CHECK} ${NODE_VERSION}${NC}"
else
    echo -e "  Node.js:       ${RED}${CROSS} Not installed${NC}"
fi

echo ""

# Workspace Test Statistics
echo -e "${CYAN}▶ Test Statistics by Workspace${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend stats
BACKEND_STATS=$(get_test_stats "backend/tests")
BACKEND_FILES=$(echo $BACKEND_STATS | cut -d'|' -f1)
BACKEND_TESTS=$(echo $BACKEND_STATS | cut -d'|' -f2)
BACKEND_COVERAGE=$(check_coverage "backend")

# Frontend stats  
FRONTEND_STATS=$(get_test_stats "frontend/src")
FRONTEND_FILES=$(echo $FRONTEND_STATS | cut -d'|' -f1)
FRONTEND_TESTS=$(echo $FRONTEND_STATS | cut -d'|' -f2)
FRONTEND_COVERAGE=$(check_coverage "frontend")

# Shared stats
SHARED_STATS=$(get_test_stats "shared/src")
SHARED_FILES=$(echo $SHARED_STATS | cut -d'|' -f1)
SHARED_TESTS=$(echo $SHARED_STATS | cut -d'|' -f2)
SHARED_COVERAGE=$(check_coverage "shared")

# Display stats
printf "  %-15s %10s %15s %15s\n" "Workspace" "Files" "Tests (est.)" "Coverage"
printf "  %-15s %10s %15s %15s\n" "─────────" "─────" "───────────" "────────"
printf "  %-15s %10s %15s %15s\n" "Backend" "$BACKEND_FILES" "~$BACKEND_TESTS" "$BACKEND_COVERAGE%"
printf "  %-15s %10s %15s %15s\n" "Frontend" "$FRONTEND_FILES" "~$FRONTEND_TESTS" "$FRONTEND_COVERAGE%"
printf "  %-15s %10s %15s %15s\n" "Shared" "$SHARED_FILES" "~$SHARED_TESTS" "$SHARED_COVERAGE%"

echo ""

# Test Categories
echo -e "${CYAN}▶ Test Categories${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count test files by category
CRITICAL_TESTS=$(find backend/tests/integration/critical-paths -name "*.test.ts" 2>/dev/null | wc -l | xargs)
API_TESTS=$(find backend/tests/api -name "*.test.ts" 2>/dev/null | wc -l | xargs)
UNIT_TESTS=$(find . -path "*/unit/*" -name "*.test.ts" 2>/dev/null | wc -l | xargs)
INTEGRATION_TESTS=$(find . -path "*/integration/*" -name "*.test.ts" 2>/dev/null | wc -l | xargs)

echo -e "  ${WHITE}Critical Paths:${NC}  $CRITICAL_TESTS test suites"
echo -e "  ${WHITE}API Endpoints:${NC}   $API_TESTS test suites"
echo -e "  ${WHITE}Unit Tests:${NC}      $UNIT_TESTS test suites"
echo -e "  ${WHITE}Integration:${NC}     $INTEGRATION_TESTS test suites"

echo ""

# Quick Commands
echo -e "${CYAN}▶ Quick Test Commands${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${WHITE}Run all tests:${NC}         ./run-all-tests.sh"
echo -e "  ${WHITE}Run with coverage:${NC}     ./run-all-tests.sh --coverage"
echo -e "  ${WHITE}Run critical paths:${NC}    ./run-all-tests.sh --critical"
echo -e "  ${WHITE}Run API tests:${NC}         ./run-all-tests.sh --api"
echo -e "  ${WHITE}Open test UI:${NC}          ./run-all-tests.sh --ui"
echo -e "  ${WHITE}Watch mode:${NC}            ./run-all-tests.sh --watch"

echo ""

# Recent Test Runs (if log exists)
LOG_FILE="test-results.log"
if [ -f "$LOG_FILE" ]; then
    echo -e "${CYAN}▶ Recent Test Runs${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -5 "$LOG_FILE" | while read line; do
        echo "  $line"
    done
    echo ""
fi

# Coverage Goals
echo -e "${CYAN}▶ Coverage Goals${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${WHITE}Overall:${NC}         60-70%"
echo -e "  ${WHITE}Auth/Security:${NC}   80%"
echo -e "  ${WHITE}API Endpoints:${NC}   70%"
echo -e "  ${WHITE}Services:${NC}        70%"
echo -e "  ${WHITE}Repositories:${NC}    60%"

echo ""

# Test Health Check
echo -e "${CYAN}▶ Test Suite Health${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for common issues
ISSUES=0

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo -e "  ${YELLOW}${WARNING} Root dependencies not installed${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -d "backend/node_modules" ]; then
    echo -e "  ${YELLOW}${WARNING} Backend dependencies not installed${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "  ${YELLOW}${WARNING} Frontend dependencies not installed${NC}"
    ISSUES=$((ISSUES + 1))
fi

# Check for test scripts
if [ ! -x "run-all-tests.sh" ]; then
    echo -e "  ${YELLOW}${WARNING} Main test runner not executable${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "  ${GREEN}${CHECK} All systems operational${NC}"
else
    echo -e "  ${INFO} Run 'npm install' to fix dependency issues"
fi

echo ""

# Footer
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Dashboard generated at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""