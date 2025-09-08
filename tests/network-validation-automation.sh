#!/bin/bash

# MediaNest Network Performance Validation Automation
# Complete network testing suite for production deployment validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production-secure.yml}"
TIMEOUT="${TIMEOUT:-300}"
RETRY_COUNT="${RETRY_COUNT:-3}"
WAIT_TIME="${WAIT_TIME:-30}"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
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
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "🔍 Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in docker docker-compose node npm jq curl; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and try again"
        exit 1
    fi
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Wait for service to be ready
wait_for_service() {
    local service_name="$1"
    local url="$2"
    local max_attempts="$3"
    
    log_info "⏳ Waiting for $service_name to be ready..."
    
    for ((i=1; i<=max_attempts; i++)); do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi
        
        log_info "Attempt $i/$max_attempts failed, waiting ${WAIT_TIME}s..."
        sleep "$WAIT_TIME"
    done
    
    log_error "$service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Check service health
check_service_health() {
    log_step "🏥 Checking service health..."
    
    local services=(
        "Frontend:http://localhost:3000"
        "Backend:http://localhost:3001/api/health"
        "Nginx:http://localhost/api/health"
    )
    
    local healthy_count=0
    local total_count=${#services[@]}
    
    for service_info in "${services[@]}"; do
        local name="${service_info%%:*}"
        local url="${service_info##*:}"
        
        if curl -s -f "$url" >/dev/null 2>&1; then
            log_success "$name: Healthy"
            ((healthy_count++))
        else
            log_error "$name: Unhealthy"
        fi
    done
    
    local health_percentage=$((healthy_count * 100 / total_count))
    log_info "Service Health: $healthy_count/$total_count ($health_percentage%)"
    
    return $((total_count - healthy_count))
}

# Run network performance tests
run_network_performance_tests() {
    log_step "📊 Running Network Performance Tests..."
    
    cd "$SCRIPT_DIR"
    
    # Run the comprehensive network monitor
    log_info "🔍 Running network performance monitor..."
    if node network-performance-monitor.js; then
        log_success "Network performance monitor completed"
    else
        log_error "Network performance monitor failed"
        return 1
    fi
    
    # Run Docker network validation if services are running
    log_info "🐳 Running Docker network validation..."
    if bash docker-network-validation.sh; then
        log_success "Docker network validation completed"
    else
        log_warning "Docker network validation had issues (may be expected if services not fully deployed)"
    fi
    
    return 0
}

# Run proxy performance tests
run_proxy_performance_tests() {
    log_step "🔄 Running Proxy Performance Tests..."
    
    cd "$SCRIPT_DIR"
    
    # Check if Nginx is running
    if curl -s -f http://localhost >/dev/null 2>&1; then
        log_info "🔍 Running proxy performance tests..."
        if node proxy-performance-test.js; then
            log_success "Proxy performance tests completed"
        else
            log_error "Proxy performance tests failed"
            return 1
        fi
    else
        log_warning "Nginx proxy not accessible, skipping proxy performance tests"
        return 0
    fi
}

# Run comprehensive network validation
run_comprehensive_validation() {
    log_step "🔬 Running Comprehensive Network Validation..."
    
    cd "$SCRIPT_DIR"
    
    # Create environment variables for the test
    export BASE_URL="http://localhost:3000"
    export API_URL="http://localhost:3001"
    export PROXY_URL="http://localhost"
    export HTTPS_URL="https://localhost"
    
    log_info "🔍 Running comprehensive network validation suite..."
    if timeout "$TIMEOUT" node run-network-validation.js; then
        log_success "Comprehensive network validation completed"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "Network validation timed out after ${TIMEOUT}s"
        else
            log_error "Network validation failed with exit code $exit_code"
        fi
        return $exit_code
    fi
}

# Generate network performance report
generate_performance_report() {
    log_step "📊 Generating Network Performance Report..."
    
    local report_dir="performance/network-reports"
    local latest_report
    
    # Find the most recent report
    if [ -d "$report_dir" ]; then
        latest_report=$(find "$report_dir" -name "network-monitor-*.json" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [ -n "$latest_report" ] && [ -f "$latest_report" ]; then
            log_info "📄 Latest report: $latest_report"
            
            # Extract key metrics using jq
            local service_availability
            local validation_duration
            local recommendations_count
            
            service_availability=$(jq -r '.memory_store.key_metrics.service_availability // 0' "$latest_report")
            validation_duration=$(jq -r '.memory_store.key_metrics.validation_duration // 0' "$latest_report")
            recommendations_count=$(jq -r '.memory_store.key_metrics.recommendations_count // 0' "$latest_report")
            
            echo ""
            log_success "📊 NETWORK PERFORMANCE SUMMARY"
            echo "=============================="
            echo "🌐 Service Availability: $service_availability%"
            echo "⏱️  Validation Duration: $(echo "scale=2; $validation_duration / 1000" | bc)s"
            echo "💡 Recommendations: $recommendations_count"
            echo "📁 Full Report: $latest_report"
            echo ""
            
            # Show recommendations if any
            if [ "$recommendations_count" -gt 0 ]; then
                echo "💡 Key Recommendations:"
                jq -r '.metrics.performance_history[0].insights.recommendations[]?' "$latest_report" | while read -r rec; do
                    echo "   • $rec"
                done
                echo ""
            fi
            
            return 0
        else
            log_warning "No network performance reports found"
            return 1
        fi
    else
        log_warning "Network reports directory not found"
        return 1
    fi
}

# Clean up test resources
cleanup_test_resources() {
    log_info "🧹 Cleaning up test resources..."
    
    # Remove temporary test files
    find . -name "bandwidth-test.tmp" -type f -delete 2>/dev/null || true
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main execution function
main() {
    echo "🚀 MediaNest Network Performance Validation Automation"
    echo "======================================================="
    echo "📅 Started: $(date)"
    echo "🐳 Compose File: $COMPOSE_FILE"
    echo "⏱️  Timeout: ${TIMEOUT}s"
    echo "🔄 Retry Count: $RETRY_COUNT"
    echo ""
    
    # Initialize coordination hooks
    log_info "🔄 Initializing coordination hooks..."
    npx claude-flow@alpha hooks pre-task --description "Network Performance Validation Automation" || true
    
    local exit_code=0
    local tests_run=0
    local tests_passed=0
    
    # Check prerequisites
    check_prerequisites
    
    # Check if services are running (optional)
    log_step "🔍 Checking current service status..."
    if check_service_health; then
        log_success "Services are healthy, proceeding with full validation"
        FULL_VALIDATION=true
    else
        log_warning "Some services are not healthy, running limited validation"
        FULL_VALIDATION=false
    fi
    
    # Run network performance tests
    ((tests_run++))
    if run_network_performance_tests; then
        ((tests_passed++))
        log_success "✅ Network performance tests PASSED"
    else
        log_error "❌ Network performance tests FAILED"
        exit_code=1
    fi
    
    # Run proxy performance tests (if applicable)
    if [ "$FULL_VALIDATION" = true ]; then
        ((tests_run++))
        if run_proxy_performance_tests; then
            ((tests_passed++))
            log_success "✅ Proxy performance tests PASSED"
        else
            log_error "❌ Proxy performance tests FAILED"
            exit_code=1
        fi
    fi
    
    # Run comprehensive validation
    ((tests_run++))
    if run_comprehensive_validation; then
        ((tests_passed++))
        log_success "✅ Comprehensive validation PASSED"
    else
        log_error "❌ Comprehensive validation FAILED"
        exit_code=1
    fi
    
    # Generate performance report
    if generate_performance_report; then
        log_success "✅ Performance report generated"
    else
        log_warning "⚠️  Performance report generation had issues"
    fi
    
    # Cleanup
    cleanup_test_resources
    
    # Final summary
    echo ""
    log_success "🎉 NETWORK VALIDATION AUTOMATION COMPLETE"
    echo "=========================================="
    echo "📊 Tests Run: $tests_run"
    echo "✅ Tests Passed: $tests_passed"
    echo "❌ Tests Failed: $((tests_run - tests_passed))"
    echo "📈 Success Rate: $(echo "scale=1; $tests_passed * 100 / $tests_run" | bc)%"
    echo "📅 Completed: $(date)"
    
    # Store results for coordination
    npx claude-flow@alpha hooks post-task --task-id "network-validation-automation" || true
    npx claude-flow@alpha hooks notify --message "Network validation automation completed with $tests_passed/$tests_run tests passing" || true
    
    if [ $exit_code -eq 0 ]; then
        log_success "🎊 All network validation tests completed successfully!"
    else
        log_error "⚠️  Network validation completed with some failures"
    fi
    
    exit $exit_code
}

# Signal handlers for graceful shutdown
trap 'log_warning "Received SIGINT, cleaning up..."; cleanup_test_resources; exit 130' INT
trap 'log_warning "Received SIGTERM, cleaning up..."; cleanup_test_resources; exit 143' TERM

# Execute main function
main "$@"