#!/bin/bash

# MediaNest Security Test Suite Runner
# This script runs all security tests with proper environment setup

set -e

echo "🔒 MediaNest Security Test Suite"
echo "================================="

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set test environment variables
export NODE_ENV=test
export JWT_SECRET=${JWT_SECRET:-"test-jwt-secret-for-security-testing-only"}
export DATABASE_URL=${TEST_DATABASE_URL:-${DATABASE_URL}}
export REDIS_URL=${TEST_REDIS_URL:-${REDIS_URL}}

echo "🗃️  Environment:"
echo "   NODE_ENV: $NODE_ENV"
echo "   DATABASE_URL: ${DATABASE_URL:0:30}..."
echo "   REDIS_URL: ${REDIS_URL:0:30}..."
echo ""

# Function to run a specific security test suite
run_security_test() {
    local test_file=$1
    local test_name=$2
    
    echo "🧪 Running $test_name..."
    if npm test "tests/integration/security/$test_file" -- --reporter=verbose; then
        echo "✅ $test_name: PASSED"
    else
        echo "❌ $test_name: FAILED"
        return 1
    fi
    echo ""
}

# Function to run all security tests
run_all_security_tests() {
    local failed=0
    
    echo "🚀 Running all security test suites..."
    echo ""
    
    # User Data Isolation Tests
    if ! run_security_test "user-data-isolation.test.ts" "User Data Isolation"; then
        failed=1
    fi
    
    # Authentication Bypass Tests
    if ! run_security_test "authentication-bypass.test.ts" "Authentication Bypass Prevention"; then
        failed=1
    fi
    
    # Session Management Tests
    if ! run_security_test "session-management.test.ts" "Session Management Security"; then
        failed=1
    fi
    
    # Authorization and RBAC Tests
    if ! run_security_test "authorization-rbac.test.ts" "Authorization & RBAC"; then
        failed=1
    fi
    
    # Input Validation and Injection Tests
    if ! run_security_test "input-validation-injection.test.ts" "Input Validation & Injection Prevention"; then
        failed=1
    fi
    
    # Rate Limiting Tests
    if ! run_security_test "rate-limiting-bypass.test.ts" "Rate Limiting & Bypass Prevention"; then
        failed=1
    fi
    
    return $failed
}

# Function to run security tests with coverage
run_with_coverage() {
    echo "📊 Running security tests with coverage..."
    npm run test:coverage -- tests/integration/security/ --reporter=verbose
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  all                    Run all security test suites (default)"
    echo "  isolation              Run user data isolation tests"
    echo "  auth-bypass            Run authentication bypass tests"
    echo "  session                Run session management tests"
    echo "  authorization          Run authorization and RBAC tests"
    echo "  validation             Run input validation and injection tests"
    echo "  rate-limit             Run rate limiting tests"
    echo "  coverage               Run all tests with coverage report"
    echo "  help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Run all security tests"
    echo "  $0 isolation           # Run only user isolation tests"
    echo "  $0 coverage            # Run all tests with coverage"
}

# Parse command line arguments
case "${1:-all}" in
    "all")
        if run_all_security_tests; then
            echo "🎉 All security tests PASSED!"
            exit 0
        else
            echo "💥 Some security tests FAILED!"
            exit 1
        fi
        ;;
    "isolation")
        run_security_test "user-data-isolation.test.ts" "User Data Isolation"
        ;;
    "auth-bypass")
        run_security_test "authentication-bypass.test.ts" "Authentication Bypass Prevention"
        ;;
    "session")
        run_security_test "session-management.test.ts" "Session Management Security"
        ;;
    "authorization")
        run_security_test "authorization-rbac.test.ts" "Authorization & RBAC"
        ;;
    "validation")
        run_security_test "input-validation-injection.test.ts" "Input Validation & Injection Prevention"
        ;;
    "rate-limit")
        run_security_test "rate-limiting-bypass.test.ts" "Rate Limiting & Bypass Prevention"
        ;;
    "coverage")
        run_with_coverage
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac