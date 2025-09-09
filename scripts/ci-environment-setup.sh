#!/bin/bash

# ========================================================================
# 🔧 CI/CD Environment Setup Script
# ========================================================================
# Purpose: Complete CI/CD environment setup with database, Redis, and services
# Usage: ./scripts/ci-environment-setup.sh [--mode={quick|full|cleanup}]
# Environment: GitHub Actions, Docker, Local Testing
# ========================================================================

set -euo pipefail

# ========================================================================
# 📋 Configuration & Variables
# ========================================================================

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SETUP_MODE="${1:-full}"

# Environment variables with defaults
NODE_ENV="${NODE_ENV:-test}"
CI="${CI:-false}"
DATABASE_URL="${DATABASE_URL:-postgresql://test_user:test_password@localhost:5433/medianest_test}"
REDIS_URL="${REDIS_URL:-redis://localhost:6380}"
SETUP_TIMEOUT="${SETUP_TIMEOUT:-300}"

# Container configuration
POSTGRES_CONTAINER="medianest-postgres-test-ci"
REDIS_CONTAINER="medianest-redis-test-ci"
POSTGRES_PORT="5433"
REDIS_PORT="6380"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================================================
# 🛠️ Utility Functions
# ========================================================================

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

log_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for service to be ready
wait_for_service() {
    local host="$1"
    local port="$2"
    local service_name="$3"
    local timeout="${4:-30}"
    
    log_info "Waiting for $service_name to be ready on $host:$port (timeout: ${timeout}s)"
    
    local count=0
    while ! nc -z "$host" "$port" 2>/dev/null; do
        if [ $count -ge $timeout ]; then
            log_error "$service_name failed to start within ${timeout}s"
            return 1
        fi
        sleep 1
        count=$((count + 1))
    done
    
    log_success "$service_name is ready on $host:$port"
    return 0
}

# Check if container is running
container_running() {
    docker ps --filter "name=$1" --filter "status=running" --format "{{.Names}}" | grep -q "^$1$"
}

# ========================================================================
# 🗄️ Database Setup Functions
# ========================================================================

setup_postgres() {
    log_step "Setting up PostgreSQL test database"
    
    # Stop existing container if running
    if container_running "$POSTGRES_CONTAINER"; then
        log_info "Stopping existing PostgreSQL container"
        docker stop "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
        docker rm "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
    fi
    
    # Start PostgreSQL container
    log_info "Starting PostgreSQL container"
    docker run -d \
        --name "$POSTGRES_CONTAINER" \
        -e POSTGRES_DB=medianest_test \
        -e POSTGRES_USER=test_user \
        -e POSTGRES_PASSWORD=test_password \
        -e POSTGRES_INITDB_ARGS="--encoding=UTF-8" \
        -p "$POSTGRES_PORT:5432" \
        --tmpfs /var/lib/postgresql/data:noexec,nosuid,size=500m \
        postgres:16-alpine \
        postgres \
        -c fsync=off \
        -c synchronous_commit=off \
        -c full_page_writes=off \
        -c random_page_cost=1.0 \
        -c effective_io_concurrency=200 \
        -c checkpoint_completion_target=0.9 \
        -c wal_buffers=16MB \
        -c default_statistics_target=100
    
    # Wait for PostgreSQL to be ready
    wait_for_service "localhost" "$POSTGRES_PORT" "PostgreSQL" 60
    
    # Initialize database schema
    log_info "Initializing database schema"
    if [ -f "$SCRIPT_DIR/ci-database-init.sql" ]; then
        PGPASSWORD=test_password psql -h localhost -p "$POSTGRES_PORT" -U test_user -d medianest_test \
            -f "$SCRIPT_DIR/ci-database-init.sql"
        log_success "Database schema initialized"
    else
        log_warning "Database initialization script not found, creating basic schema"
        PGPASSWORD=test_password psql -h localhost -p "$POSTGRES_PORT" -U test_user -d medianest_test << 'EOF'
CREATE TABLE IF NOT EXISTS test_health (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'healthy',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO test_health (status) VALUES ('ci_initialized');
EOF
    fi
    
    # Validate database setup
    local row_count
    row_count=$(PGPASSWORD=test_password psql -h localhost -p "$POSTGRES_PORT" -U test_user -d medianest_test \
        -t -c "SELECT COUNT(*) FROM test_health;" | xargs)
    
    if [ "$row_count" -gt "0" ]; then
        log_success "PostgreSQL setup completed ($row_count test records)"
    else
        log_error "PostgreSQL setup validation failed"
        return 1
    fi
}

# ========================================================================
# 📊 Redis Setup Functions
# ========================================================================

setup_redis() {
    log_step "Setting up Redis test cache"
    
    # Stop existing container if running
    if container_running "$REDIS_CONTAINER"; then
        log_info "Stopping existing Redis container"
        docker stop "$REDIS_CONTAINER" >/dev/null 2>&1 || true
        docker rm "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    fi
    
    # Start Redis container
    log_info "Starting Redis container"
    docker run -d \
        --name "$REDIS_CONTAINER" \
        -p "$REDIS_PORT:6379" \
        --tmpfs /data:noexec,nosuid,size=100m \
        redis:7-alpine \
        redis-server \
        --save "" \
        --appendonly no \
        --maxmemory 64mb \
        --maxmemory-policy allkeys-lru
    
    # Wait for Redis to be ready
    wait_for_service "localhost" "$REDIS_PORT" "Redis" 30
    
    # Test Redis functionality
    redis-cli -h localhost -p "$REDIS_PORT" set ci_test_key "ci_test_value"
    local test_value
    test_value=$(redis-cli -h localhost -p "$REDIS_PORT" get ci_test_key)
    
    if [ "$test_value" = "ci_test_value" ]; then
        log_success "Redis setup completed and validated"
    else
        log_error "Redis setup validation failed"
        return 1
    fi
}

# ========================================================================
# 📦 Node.js Environment Setup
# ========================================================================

setup_nodejs_environment() {
    log_step "Setting up Node.js environment"
    
    cd "$PROJECT_ROOT"
    
    # Check Node.js version
    if command_exists node; then
        local node_version
        node_version=$(node --version)
        log_info "Node.js version: $node_version"
    else
        log_error "Node.js not found. Please install Node.js 18+"
        return 1
    fi
    
    # Install dependencies with optimized settings
    log_info "Installing root dependencies"
    npm ci --prefer-offline --no-audit --no-fund --silent
    
    # Install backend dependencies
    if [ -d "backend" ]; then
        log_info "Installing backend dependencies"
        cd backend
        npm ci --prefer-offline --no-audit --no-fund --silent
        cd ..
    fi
    
    # Install frontend dependencies
    if [ -d "frontend" ]; then
        log_info "Installing frontend dependencies"
        cd frontend
        npm ci --prefer-offline --no-audit --no-fund --silent
        cd ..
    fi
    
    # Install shared dependencies
    if [ -d "shared" ]; then
        log_info "Installing shared dependencies"
        cd shared
        npm ci --prefer-offline --no-audit --no-fund --silent
        cd ..
    fi
    
    log_success "Node.js environment setup completed"
}

# ========================================================================
# 🧪 Test Environment Validation
# ========================================================================

validate_test_environment() {
    log_step "Validating test environment"
    
    local validation_failed=false
    
    # Check PostgreSQL
    if ! PGPASSWORD=test_password psql -h localhost -p "$POSTGRES_PORT" -U test_user -d medianest_test \
        -c "SELECT 1;" >/dev/null 2>&1; then
        log_error "PostgreSQL validation failed"
        validation_failed=true
    else
        log_success "PostgreSQL validation passed"
    fi
    
    # Check Redis
    if ! redis-cli -h localhost -p "$REDIS_PORT" ping >/dev/null 2>&1; then
        log_error "Redis validation failed"
        validation_failed=true
    else
        log_success "Redis validation passed"
    fi
    
    # Check Node.js environment
    if ! npm --version >/dev/null 2>&1; then
        log_error "Node.js environment validation failed"
        validation_failed=true
    else
        log_success "Node.js environment validation passed"
    fi
    
    # Check test configurations
    if [ -f "$PROJECT_ROOT/vitest.config.ts" ]; then
        log_success "Vitest configuration found"
    else
        log_warning "Vitest configuration not found"
    fi
    
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        log_success "Package.json found"
    else
        log_error "Package.json not found"
        validation_failed=true
    fi
    
    if [ "$validation_failed" = true ]; then
        log_error "Environment validation failed"
        return 1
    else
        log_success "Environment validation completed successfully"
        return 0
    fi
}

# ========================================================================
# 🧹 Cleanup Functions
# ========================================================================

cleanup_environment() {
    log_step "Cleaning up test environment"
    
    # Stop and remove containers
    if container_running "$POSTGRES_CONTAINER"; then
        log_info "Stopping PostgreSQL container"
        docker stop "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
        docker rm "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
    fi
    
    if container_running "$REDIS_CONTAINER"; then
        log_info "Stopping Redis container"
        docker stop "$REDIS_CONTAINER" >/dev/null 2>&1 || true
        docker rm "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    fi
    
    # Clean up any temporary files
    if [ -d "$PROJECT_ROOT/coverage" ]; then
        log_info "Removing coverage files"
        rm -rf "$PROJECT_ROOT/coverage"
    fi
    
    if [ -d "$PROJECT_ROOT/test-results" ]; then
        log_info "Removing test results"
        rm -rf "$PROJECT_ROOT/test-results"
    fi
    
    log_success "Cleanup completed"
}

# ========================================================================
# 🔧 Test Services Setup
# ========================================================================

setup_test_services() {
    log_step "Setting up test services"
    
    cd "$PROJECT_ROOT"
    
    # Create necessary directories
    mkdir -p coverage test-results logs
    
    # Setup environment variables
    export NODE_ENV=test
    export DATABASE_URL="$DATABASE_URL"
    export REDIS_URL="$REDIS_URL"
    export CI=true
    
    # Generate test configuration
    cat > .env.test << EOF
NODE_ENV=test
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL
JWT_SECRET=test_jwt_secret_12345
ENCRYPTION_KEY=test_encryption_key_12345
LOG_LEVEL=warn
CI=true
NEXTAUTH_SECRET=test_secret_12345
NEXTAUTH_URL=http://localhost:3000
EOF
    
    log_success "Test services setup completed"
}

# ========================================================================
# ⚡ Performance Optimization
# ========================================================================

optimize_for_ci() {
    log_step "Optimizing environment for CI performance"
    
    # Set performance-oriented environment variables
    export NODE_OPTIONS="--max-old-space-size=2048 --no-deprecation"
    export FORCE_COLOR=0
    export NO_COLOR=1
    
    # Configure npm for CI
    npm config set progress false
    npm config set audit-level moderate
    npm config set fund false
    npm config set update-notifier false
    
    log_success "CI optimizations applied"
}

# ========================================================================
# 📊 Status Reporting
# ========================================================================

generate_setup_report() {
    log_step "Generating setup report"
    
    local setup_report="$PROJECT_ROOT/ci-setup-report.json"
    
    cat > "$setup_report" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "mode": "$SETUP_MODE",
    "environment": {
        "node_env": "$NODE_ENV",
        "ci": "$CI",
        "database_url": "$DATABASE_URL",
        "redis_url": "$REDIS_URL"
    },
    "services": {
        "postgres": {
            "container": "$POSTGRES_CONTAINER",
            "port": "$POSTGRES_PORT",
            "status": "$(docker ps --filter "name=$POSTGRES_CONTAINER" --format "{{.Status}}" || echo "not running")"
        },
        "redis": {
            "container": "$REDIS_CONTAINER", 
            "port": "$REDIS_PORT",
            "status": "$(docker ps --filter "name=$REDIS_CONTAINER" --format "{{.Status}}" || echo "not running")"
        }
    },
    "nodejs": {
        "version": "$(node --version 2>/dev/null || echo "not available")",
        "npm_version": "$(npm --version 2>/dev/null || echo "not available")"
    },
    "setup_completed": true
}
EOF
    
    log_success "Setup report generated: $setup_report"
}

# ========================================================================
# 🚀 Main Execution Logic
# ========================================================================

main() {
    local start_time
    start_time=$(date +%s)
    
    log_step "Starting CI/CD environment setup (mode: $SETUP_MODE)"
    
    # Check prerequisites
    if ! command_exists docker; then
        log_error "Docker is required but not installed"
        exit 1
    fi
    
    if ! command_exists psql; then
        log_warning "PostgreSQL client not found, attempting to install"
        # Try to install PostgreSQL client on Ubuntu/Debian
        if command_exists apt-get; then
            sudo apt-get update && sudo apt-get install -y postgresql-client
        fi
    fi
    
    if ! command_exists redis-cli; then
        log_warning "Redis client not found, attempting to install"
        # Try to install Redis client on Ubuntu/Debian
        if command_exists apt-get; then
            sudo apt-get update && sudo apt-get install -y redis-tools
        fi
    fi
    
    case "$SETUP_MODE" in
        "quick")
            log_info "Running quick setup (containers only)"
            setup_postgres
            setup_redis
            validate_test_environment
            ;;
        "full")
            log_info "Running full setup (complete environment)"
            cleanup_environment
            optimize_for_ci
            setup_postgres
            setup_redis
            setup_nodejs_environment
            setup_test_services
            validate_test_environment
            generate_setup_report
            ;;
        "cleanup")
            log_info "Running cleanup only"
            cleanup_environment
            exit 0
            ;;
        *)
            log_error "Invalid mode: $SETUP_MODE. Use: quick, full, or cleanup"
            exit 1
            ;;
    esac
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "CI/CD environment setup completed in ${duration}s"
    
    # Display summary
    echo -e "\n${GREEN}🎉 Setup Summary:${NC}"
    echo -e "  Mode: $SETUP_MODE"
    echo -e "  Duration: ${duration}s"
    echo -e "  PostgreSQL: localhost:$POSTGRES_PORT"
    echo -e "  Redis: localhost:$REDIS_PORT"
    echo -e "  Database URL: $DATABASE_URL"
    echo -e "  Redis URL: $REDIS_URL"
    echo -e "\n${BLUE}Next steps:${NC}"
    echo -e "  1. Run tests: npm run test"
    echo -e "  2. Run with coverage: npm run test:coverage"
    echo -e "  3. Cleanup when done: $0 cleanup"
}

# ========================================================================
# 🔧 Script Entry Point
# ========================================================================

# Handle command line arguments
case "${1:-full}" in
    --mode=*)
        SETUP_MODE="${1#*=}"
        ;;
    quick|full|cleanup)
        SETUP_MODE="$1"
        ;;
    --help|-h)
        echo "Usage: $0 [quick|full|cleanup]"
        echo "  quick   - Setup containers only (fast)"
        echo "  full    - Complete environment setup (default)"
        echo "  cleanup - Clean up all resources"
        exit 0
        ;;
    *)
        if [ -n "${1:-}" ]; then
            log_warning "Unknown option: $1, using full setup"
        fi
        SETUP_MODE="full"
        ;;
esac

# Trap cleanup on exit
trap cleanup_environment EXIT INT TERM

# Run main function
main "$@"