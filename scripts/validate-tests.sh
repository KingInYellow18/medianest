#!/bin/bash

# MediaNest Test Validation Script
# Checks that all test files follow conventions and are properly configured

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_FILES=0
VALID_FILES=0
ISSUES_FOUND=0

echo -e "${BLUE}MediaNest Test Validation${NC}"
echo "=========================="
echo ""

# Function to check test file
check_test_file() {
    local file=$1
    local issues=""
    
    ((TOTAL_FILES++))
    
    # Check if file has proper imports
    if ! grep -q "import.*vitest" "$file" && ! grep -q "from 'vitest'" "$file"; then
        issues="${issues}  - Missing vitest import\n"
    fi
    
    # Check if file has at least one describe block
    if ! grep -q "describe(" "$file"; then
        issues="${issues}  - No describe blocks found\n"
    fi
    
    # Check if file has at least one test
    if ! grep -q "it(\|test(" "$file"; then
        issues="${issues}  - No test cases found\n"
    fi
    
    # Check for console.log statements (should use proper logging)
    if grep -q "console\.log" "$file"; then
        issues="${issues}  - Contains console.log statements\n"
    fi
    
    # Check for .only() which prevents other tests from running
    if grep -q "\.only(" "$file"; then
        issues="${issues}  - Contains .only() - all tests should run\n"
    fi
    
    # Check for proper async handling
    if grep -q "async.*=>" "$file" || grep -q "async function" "$file"; then
        if ! grep -q "await\|\.then\|\.catch" "$file"; then
            issues="${issues}  - Async function without await/then/catch\n"
        fi
    fi
    
    # Report results
    if [ -z "$issues" ]; then
        echo -e "${GREEN}✓${NC} $file"
        ((VALID_FILES++))
    else
        echo -e "${RED}✗${NC} $file"
        echo -e "${YELLOW}$issues${NC}"
        ((ISSUES_FOUND++))
    fi
}

# Check backend tests
echo -e "${BLUE}Checking Backend Tests...${NC}"
echo "------------------------"
while IFS= read -r -d '' file; do
    check_test_file "$file"
done < <(find backend/tests -name "*.test.ts" -print0 2>/dev/null)
echo ""

# Check frontend tests
echo -e "${BLUE}Checking Frontend Tests...${NC}"
echo "-------------------------"
while IFS= read -r -d '' file; do
    check_test_file "$file"
done < <(find frontend/src -name "*.test.ts" -o -name "*.test.tsx" -print0 2>/dev/null)
echo ""

# Check shared tests
echo -e "${BLUE}Checking Shared Tests...${NC}"
echo "-----------------------"
while IFS= read -r -d '' file; do
    check_test_file "$file"
done < <(find shared/src -name "*.test.ts" -print0 2>/dev/null)
echo ""

# Check test infrastructure
echo -e "${BLUE}Checking Test Infrastructure...${NC}"
echo "------------------------------"

# Check for test setup files
if [ -f "backend/tests/setup.ts" ]; then
    echo -e "${GREEN}✓${NC} Backend test setup found"
else
    echo -e "${RED}✗${NC} Backend test setup missing"
    ((ISSUES_FOUND++))
fi

if [ -f "frontend/tests/setup.ts" ] || [ -f "frontend/src/test/setup.ts" ]; then
    echo -e "${GREEN}✓${NC} Frontend test setup found"
else
    echo -e "${YELLOW}⚠${NC} Frontend test setup not found (may be optional)"
fi

# Check for MSW handlers
if [ -d "backend/tests/mocks" ]; then
    echo -e "${GREEN}✓${NC} MSW mocks directory found"
else
    echo -e "${RED}✗${NC} MSW mocks directory missing"
    ((ISSUES_FOUND++))
fi

# Check for test scripts
if [ -x "run-all-tests.sh" ]; then
    echo -e "${GREEN}✓${NC} Main test runner is executable"
else
    echo -e "${RED}✗${NC} Main test runner not found or not executable"
    ((ISSUES_FOUND++))
fi

echo ""

# Check for common test patterns
echo -e "${BLUE}Checking Test Patterns...${NC}"
echo "------------------------"

# Check for proper error testing
ERROR_TESTS=$(grep -r "rejects\|throw\|catch" --include="*.test.ts" --include="*.test.tsx" . 2>/dev/null | wc -l | xargs)
echo -e "Error handling tests found: ${ERROR_TESTS}"

# Check for mocking usage
MOCK_USAGE=$(grep -r "mock\|Mock\|jest\.fn\|vi\.fn" --include="*.test.ts" --include="*.test.tsx" . 2>/dev/null | wc -l | xargs)
echo -e "Mock usage instances: ${MOCK_USAGE}"

# Check for async tests
ASYNC_TESTS=$(grep -r "async\|await\|waitFor" --include="*.test.ts" --include="*.test.tsx" . 2>/dev/null | wc -l | xargs)
echo -e "Async test patterns: ${ASYNC_TESTS}"

echo ""

# Summary
echo -e "${BLUE}Validation Summary${NC}"
echo "=================="
echo "Total test files checked: $TOTAL_FILES"
echo -e "Valid files: ${GREEN}$VALID_FILES${NC}"
echo -e "Files with issues: ${RED}$(($TOTAL_FILES - $VALID_FILES))${NC}"
echo -e "Total issues found: ${YELLOW}$ISSUES_FOUND${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All tests are properly configured!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some issues need attention. Review the output above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Add 'import { describe, it, expect } from 'vitest'"
    echo "  - Replace console.log with proper test assertions"
    echo "  - Remove .only() from tests before committing"
    echo "  - Ensure async tests use await or return promises"
    exit 1
fi