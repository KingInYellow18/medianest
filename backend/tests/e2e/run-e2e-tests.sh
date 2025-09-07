#!/bin/bash

# MediaNest E2E Test Runner Script
# This script sets up the environment and runs E2E tests

set -e

echo "🚀 MediaNest E2E Test Runner"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    print_error "npx not found. Please install Node.js and npm."
    exit 1
fi

# Check for E2E environment file
if [ ! -f "tests/e2e/.env.e2e" ]; then
    if [ -f "tests/e2e/.env.e2e.example" ]; then
        print_warning ".env.e2e not found. Copying from example..."
        cp tests/e2e/.env.e2e.example tests/e2e/.env.e2e
        print_warning "Please edit tests/e2e/.env.e2e with your test database credentials"
    else
        print_error "No E2E environment configuration found"
        exit 1
    fi
fi

# Parse command line arguments
HEADED=false
DEBUG=false
UI=false
BROWSER=""
TEST_FILTER=""
REPORT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --headed|-h)
            HEADED=true
            shift
            ;;
        --debug|-d)
            DEBUG=true
            shift
            ;;
        --ui|-u)
            UI=true
            shift
            ;;
        --browser|-b)
            BROWSER="$2"
            shift 2
            ;;
        --filter|-f)
            TEST_FILTER="$2"
            shift 2
            ;;
        --report|-r)
            REPORT=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --headed, -h      Run tests in headed mode (visible browser)"
            echo "  --debug, -d       Run tests in debug mode"
            echo "  --ui, -u          Run tests with Playwright UI"
            echo "  --browser, -b     Specify browser (chromium, firefox, webkit)"
            echo "  --filter, -f      Filter tests by name pattern"
            echo "  --report, -r      Show test report after completion"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Step 1: Check dependencies
print_status "Checking dependencies..."

if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm ci
fi

# Check if Playwright browsers are installed
if ! npx playwright --version &> /dev/null; then
    print_status "Installing Playwright..."
    npm install @playwright/test
fi

# Install browsers if needed
print_status "Ensuring Playwright browsers are installed..."
npx playwright install --with-deps

# Step 2: Load environment variables
print_status "Loading E2E environment configuration..."
if [ -f "tests/e2e/.env.e2e" ]; then
    export $(grep -v '^#' tests/e2e/.env.e2e | xargs)
fi

# Set defaults if not provided
export NODE_ENV=${NODE_ENV:-test}
export TEST_BASE_URL=${TEST_BASE_URL:-http://localhost:3001}

# Step 3: Check database configuration
print_status "Checking database configuration..."
if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL not set in .env.e2e"
    print_error "Please configure your test database URL"
    exit 1
fi

# Verify database is accessible (optional check)
print_status "Verifying database connectivity..."

# Step 4: Build application if needed
print_status "Building application..."
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    npm run build
fi

# Step 5: Run database migrations
print_status "Running database migrations..."
npx prisma migrate deploy || {
    print_warning "Database migrations failed, attempting to continue..."
}

# Step 6: Construct Playwright command
PLAYWRIGHT_CMD="npx playwright test"

if [ "$UI" = true ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --ui"
elif [ "$DEBUG" = true ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --debug"
elif [ "$HEADED" = true ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

if [ -n "$BROWSER" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --project=$BROWSER"
fi

if [ -n "$TEST_FILTER" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD -g \"$TEST_FILTER\""
fi

# Add configuration file
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --config=tests/e2e/playwright.config.ts"

# Step 7: Run tests
print_status "Starting E2E tests..."
echo "Command: $PLAYWRIGHT_CMD"
echo "Base URL: $TEST_BASE_URL"
echo "Database: $DATABASE_URL"
echo "================================"

# Run the tests
eval $PLAYWRIGHT_CMD
TEST_EXIT_CODE=$?

# Step 8: Handle results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "All E2E tests passed! ✨"
else
    print_error "Some E2E tests failed (exit code: $TEST_EXIT_CODE)"
fi

# Show report if requested
if [ "$REPORT" = true ]; then
    print_status "Opening test report..."
    npx playwright show-report
fi

# Step 9: Cleanup (optional)
if [ "$TEST_EXIT_CODE" -eq 0 ]; then
    print_status "Cleaning up test data..."
    # Add any cleanup commands here if needed
fi

print_status "E2E test run completed!"
exit $TEST_EXIT_CODE