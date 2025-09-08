#!/bin/bash

# MediaNest Application Monitoring Validation Script
# This script runs comprehensive application-level observability testing

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_DIR="$PROJECT_ROOT/logs/validation"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
VALIDATION_LOG="$LOG_DIR/app_monitoring_validation_$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo -e "$1" | tee -a "$VALIDATION_LOG"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# Header
log_info "🚀 MediaNest Application Monitoring Validation Suite"
log_info "📅 Started: $(date)"
log_info "📁 Project: $PROJECT_ROOT"
log_info "📝 Log: $VALIDATION_LOG"
log ""

# Check if backend is running
check_backend_health() {
    log_info "🔍 Checking if backend is running..."
    
    if curl -s -f "http://localhost:3000/health" > /dev/null 2>&1; then
        log_success "✅ Backend is running and responding"
        return 0
    else
        log_warning "⚠️ Backend is not responding at http://localhost:3000"
        return 1
    fi
}

# Start backend if not running
start_backend_if_needed() {
    if ! check_backend_health; then
        log_info "🚀 Starting MediaNest backend..."
        
        cd "$BACKEND_DIR"
        
        # Check if npm dependencies are installed
        if [ ! -d "node_modules" ]; then
            log_info "📦 Installing backend dependencies..."
            npm install
        fi
        
        # Build if needed
        if [ ! -d "dist" ]; then
            log_info "🔨 Building backend..."
            npm run build
        fi
        
        # Start in background
        log_info "🚀 Starting backend server..."
        npm start > "$LOG_DIR/backend_$TIMESTAMP.log" 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > "$LOG_DIR/backend_$TIMESTAMP.pid"
        
        # Wait for backend to start
        log_info "⏳ Waiting for backend to start..."
        for i in {1..30}; do
            if check_backend_health; then
                log_success "✅ Backend started successfully"
                return 0
            fi
            sleep 2
        done
        
        log_error "❌ Backend failed to start within 60 seconds"
        return 1
    fi
    
    return 0
}

# Stop backend if we started it
cleanup_backend() {
    if [ -f "$LOG_DIR/backend_$TIMESTAMP.pid" ]; then
        BACKEND_PID=$(cat "$LOG_DIR/backend_$TIMESTAMP.pid")
        if kill -0 $BACKEND_PID 2>/dev/null; then
            log_info "🛑 Stopping backend server (PID: $BACKEND_PID)"
            kill $BACKEND_PID
            rm "$LOG_DIR/backend_$TIMESTAMP.pid"
        fi
    fi
}

# Install validation dependencies
install_validation_deps() {
    log_info "📦 Installing validation dependencies..."
    
    cd "$SCRIPT_DIR"
    
    # Check if package.json exists, create if not
    if [ ! -f "package.json" ]; then
        cat > package.json << EOF
{
  "name": "medianest-monitoring-validation",
  "version": "1.0.0",
  "description": "MediaNest Application Monitoring Validation Suite",
  "main": "app-monitoring-validator.ts",
  "scripts": {
    "validate": "ts-node app-monitoring-validator.ts",
    "validate:dev": "ts-node-dev --respawn app-monitoring-validator.ts"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "ws": "^8.14.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.2.0",
    "ts-node": "^10.9.0",
    "ts-node-dev": "^2.0.0"
  }
}
EOF
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    log_success "✅ Validation dependencies ready"
}

# Run the validation suite
run_validation() {
    log_info "🧪 Running Application Monitoring Validation Suite..."
    
    cd "$SCRIPT_DIR"
    
    # Compile and run TypeScript validator
    if npx ts-node app-monitoring-validator.ts 2>&1 | tee -a "$VALIDATION_LOG"; then
        VALIDATION_EXIT_CODE=0
        log_success "✅ Application monitoring validation completed successfully"
    else
        VALIDATION_EXIT_CODE=$?
        log_error "❌ Application monitoring validation failed with exit code: $VALIDATION_EXIT_CODE"
    fi
    
    return $VALIDATION_EXIT_CODE
}

# Generate summary report
generate_summary() {
    log ""
    log_info "📊 Generating validation summary..."
    
    # Count log entries
    TOTAL_TESTS=$(grep -c "Testing\|Validating" "$VALIDATION_LOG" 2>/dev/null || echo "0")
    PASSED_TESTS=$(grep -c "✅" "$VALIDATION_LOG" 2>/dev/null || echo "0")
    FAILED_TESTS=$(grep -c "❌" "$VALIDATION_LOG" 2>/dev/null || echo "0")
    WARNING_TESTS=$(grep -c "⚠️" "$VALIDATION_LOG" 2>/dev/null || echo "0")
    
    log ""
    log_info "📋 VALIDATION SUMMARY"
    log_info "===================="
    log_info "📊 Total Tests: $TOTAL_TESTS"
    log_info "✅ Passed: $PASSED_TESTS"
    log_info "❌ Failed: $FAILED_TESTS"
    log_info "⚠️ Warnings: $WARNING_TESTS"
    log_info "📝 Full Log: $VALIDATION_LOG"
    log_info "⏱️ Duration: $((SECONDS/60))m $((SECONDS%60))s"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "🎉 All critical monitoring capabilities validated successfully!"
        return 0
    else
        log_warning "⚠️ Some monitoring capabilities need attention"
        return 1
    fi
}

# Main execution
main() {
    local STARTED_BACKEND=false
    
    # Set up cleanup trap
    trap cleanup_backend EXIT
    
    # Start validation process
    log_info "🔧 Setting up validation environment..."
    
    # Install dependencies
    install_validation_deps
    
    # Start backend if needed
    if ! check_backend_health; then
        if start_backend_if_needed; then
            STARTED_BACKEND=true
        else
            log_error "❌ Cannot start backend server - validation aborted"
            exit 1
        fi
    fi
    
    # Run the validation suite
    local validation_result=0
    run_validation || validation_result=$?
    
    # Generate summary
    local summary_result=0
    generate_summary || summary_result=$?
    
    # Final status
    log ""
    if [ $validation_result -eq 0 ] && [ $summary_result -eq 0 ]; then
        log_success "🎯 MediaNest Application Monitoring Validation: PASSED"
        exit 0
    else
        log_error "🚨 MediaNest Application Monitoring Validation: FAILED"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "MediaNest Application Monitoring Validation Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --no-backend   Skip backend startup (assume already running)"
        echo "  --debug        Enable debug logging"
        echo ""
        echo "This script validates MediaNest's application monitoring capabilities:"
        echo "  • Application Performance Monitoring (APM)"
        echo "  • Database query monitoring and slow query detection"  
        echo "  • Memory leak detection and garbage collection monitoring"
        echo "  • Distributed tracing across microservices"
        echo "  • Health check endpoints functionality"
        echo "  • Database and Redis connectivity health checks"
        echo "  • Business metrics and KPI collection"
        echo "  • Real-time monitoring and WebSocket connections"
        echo ""
        exit 0
        ;;
    "--no-backend")
        check_backend_health() { return 0; }
        start_backend_if_needed() { return 0; }
        cleanup_backend() { return 0; }
        ;;
    "--debug")
        set -x
        ;;
esac

# Run main function
main "$@"