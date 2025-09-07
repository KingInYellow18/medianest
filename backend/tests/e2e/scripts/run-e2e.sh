#!/bin/bash

# E2E Test Runner Script
# Provides convenient commands for running E2E tests locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
BROWSER="chromium"
HEADLESS=true
UI_MODE=false
DEBUG_MODE=false
SPECIFIC_TEST=""
WORKERS=4
TIMEOUT=30000
SETUP_SERVICES=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        --headed)
            HEADLESS=false
            shift
            ;;
        --ui)
            UI_MODE=true
            shift
            ;;
        --debug)
            DEBUG_MODE=true
            shift
            ;;
        -t|--test)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --no-services)
            SETUP_SERVICES=false
            shift
            ;;
        -h|--help)
            echo "E2E Test Runner"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -b, --browser BROWSER    Browser to use (chromium, firefox, webkit)"
            echo "  --headed                 Run in headed mode (show browser window)"
            echo "  --ui                     Run with Playwright UI"
            echo "  --debug                  Run in debug mode"
            echo "  -t, --test TEST          Run specific test file"
            echo "  -w, --workers NUM        Number of parallel workers"
            echo "  --timeout MS             Test timeout in milliseconds"
            echo "  --no-services            Skip starting Docker services"
            echo "  -h, --help               Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                       Run all tests with default settings"
            echo "  $0 --browser firefox     Run tests in Firefox"
            echo "  $0 --headed --debug      Run in headed mode with debugging"
            echo "  $0 --ui                  Run with Playwright UI"
            echo "  $0 -t login.spec.ts      Run only login tests"
            exit 0
            ;;
        *)
            log_error "Unknown option $1"
            exit 1
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18 or higher is required (current: $(node -v))"
        exit 1
    fi
    
    # Check if npm dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found. Installing dependencies..."
        npm ci
    fi
    
    # Check if Playwright browsers are installed
    if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "node_modules/playwright-core/.local-browsers" ]; then
        log_warning "Playwright browsers not found. Installing..."
        npx playwright install
    fi
    
    log_success "Prerequisites check completed"
}

# Setup test services
setup_services() {
    if [ "$SETUP_SERVICES" = false ]; then
        log_info "Skipping service setup (--no-services flag)"
        return
    fi
    
    log_info "Setting up test services..."
    
    # Stop existing services
    docker-compose -f docker-compose.e2e.yml down -v --remove-orphans 2>/dev/null || true
    
    # Start services
    log_info "Starting Docker services..."
    docker-compose -f docker-compose.e2e.yml up -d --build
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.e2e.yml exec -T postgres-e2e pg_isready -U e2e_user -d medianest_e2e >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "PostgreSQL failed to start within timeout"
            docker-compose -f docker-compose.e2e.yml logs postgres-e2e
            exit 1
        fi
        
        log_info "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    # Check Redis
    if ! docker-compose -f docker-compose.e2e.yml exec -T redis-e2e redis-cli ping >/dev/null 2>&1; then
        log_error "Redis failed to start"
        docker-compose -f docker-compose.e2e.yml logs redis-e2e
        exit 1
    fi
    
    log_success "Redis is ready"
    
    # Run database migrations
    log_info "Running database migrations..."
    DATABASE_URL="postgresql://e2e_user:e2e_password@localhost:5434/medianest_e2e" npx prisma migrate deploy
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    # Seed test data
    log_info "Seeding test data..."
    node tests/e2e/scripts/seed-test-data.js
    
    log_success "Test services are ready"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ "$SETUP_SERVICES" = true ]; then
        docker-compose -f docker-compose.e2e.yml down -v --remove-orphans
    fi
}

# Set up trap to cleanup on exit
trap cleanup EXIT

# Run tests
run_tests() {
    log_info "Running E2E tests..."
    
    # Build Playwright command
    CMD="npx playwright test"
    
    if [ "$SPECIFIC_TEST" != "" ]; then
        CMD="$CMD $SPECIFIC_TEST"
    fi
    
    CMD="$CMD --project=$BROWSER"
    CMD="$CMD --workers=$WORKERS"
    CMD="$CMD --timeout=$TIMEOUT"
    
    if [ "$UI_MODE" = true ]; then
        CMD="$CMD --ui"
    elif [ "$DEBUG_MODE" = true ]; then
        CMD="$CMD --debug"
    elif [ "$HEADLESS" = false ]; then
        CMD="$CMD --headed"
    fi
    
    # Set environment variables
    export NODE_ENV=test
    export DATABASE_URL=postgresql://e2e_user:e2e_password@localhost:5434/medianest_e2e
    export REDIS_URL=redis://localhost:6381
    export JWT_SECRET=e2e-jwt-secret-key-for-testing-32-chars-long
    export ENCRYPTION_KEY=e2e-encryption-key-32-chars-long
    export PLEX_CLIENT_ID=e2e-test-client-id
    export PLEX_CLIENT_SECRET=e2e-test-client-secret
    export E2E_BASE_URL=http://localhost:3001
    
    log_info "Command: $CMD"
    log_info "Browser: $BROWSER"
    log_info "Workers: $WORKERS"
    log_info "Headless: $HEADLESS"
    
    # Execute the command
    if eval $CMD; then
        log_success "Tests completed successfully!"
        
        # Show report location
        if [ "$UI_MODE" = false ] && [ "$DEBUG_MODE" = false ]; then
            log_info "HTML report available at: tests/e2e/reports/html/index.html"
            log_info "Open report with: npx playwright show-report"
        fi
    else
        local exit_code=$?
        log_error "Tests failed with exit code $exit_code"
        
        if [ "$UI_MODE" = false ] && [ "$DEBUG_MODE" = false ]; then
            log_info "Check the HTML report for details: tests/e2e/reports/html/index.html"
            log_info "Screenshots and videos are in: tests/e2e/test-results/"
        fi
        
        return $exit_code
    fi
}

# Main execution
main() {
    log_info "Starting E2E test runner..."
    
    check_prerequisites
    setup_services
    run_tests
    
    log_success "E2E test run completed!"
}

# Run main function
main "$@"