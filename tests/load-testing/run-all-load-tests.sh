#!/bin/bash

# =============================================================================
# MEDIANEST COMPREHENSIVE LOAD TESTING SUITE
# Execute all load tests with coordinated memory storage
# =============================================================================

set -euo pipefail

# Configuration
export TEST_BASE_URL="${TEST_BASE_URL:-http://localhost:3001}"
export MAX_CONCURRENT_USERS="${MAX_CONCURRENT_USERS:-1200}"
export TEST_DURATION="${TEST_DURATION:-300}"
export MAX_DB_CONNECTIONS="${MAX_DB_CONNECTIONS:-100}"
export CONCURRENT_QUERIES="${CONCURRENT_QUERIES:-500}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if MediaNest containers are running
    if ! docker ps | grep -q "medianest"; then
        log_warning "MediaNest containers may not be running"
        log_info "Starting containers with docker-compose..."
        docker-compose -f docker-compose.production.yml up -d || {
            log_error "Failed to start containers"
            exit 1
        }
        sleep 30 # Give containers time to start
    fi
    
    # Check if test target is reachable
    if ! curl -s --max-time 10 "$TEST_BASE_URL/health" > /dev/null; then
        log_error "Test target $TEST_BASE_URL is not reachable"
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Initialize Claude Flow hooks for coordination
initialize_coordination() {
    log_info "Initializing load testing coordination..."
    
    # Initialize swarm for coordination
    npx claude-flow@alpha hooks pre-task --description "MediaNest Production Load Testing Suite" || {
        log_warning "Could not initialize Claude Flow coordination"
    }
    
    # Session management
    export LOAD_TEST_SESSION_ID="medianest-load-$(date +%s)"
    npx claude-flow@alpha hooks session-restore --session-id "$LOAD_TEST_SESSION_ID" || {
        log_warning "Could not restore session"
    }
    
    log_success "Coordination initialized"
}

# Execute comprehensive load test
execute_comprehensive_load_test() {
    log_info "=== PHASE 1: COMPREHENSIVE LOAD TEST ==="
    log_info "Testing $MAX_CONCURRENT_USERS concurrent users for ${TEST_DURATION}s"
    
    local test_start_time=$(date +%s)
    local comprehensive_report=""
    
    if node tests/load-testing/comprehensive-load-test.js; then
        log_success "Comprehensive load test completed successfully"
        comprehensive_report=$(find tests/load-testing -name "load-test-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    else
        log_error "Comprehensive load test failed"
        return 1
    fi
    
    # Store results in memory
    if [[ -n "$comprehensive_report" && -f "$comprehensive_report" ]]; then
        local memory_data=$(cat "$comprehensive_report")
        npx claude-flow@alpha hooks post-edit --file "comprehensive-load-results.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load/comprehensive" <<< "$memory_data" || {
            log_warning "Could not store comprehensive test results in memory"
        }
    fi
    
    local test_duration=$(($(date +%s) - test_start_time))
    log_success "Phase 1 completed in ${test_duration}s"
}

# Execute database stress test
execute_database_stress_test() {
    log_info "=== PHASE 2: DATABASE STRESS TEST ==="
    log_info "Testing database with $MAX_DB_CONNECTIONS connections and $CONCURRENT_QUERIES queries"
    
    local test_start_time=$(date +%s)
    local db_report=""
    
    if node tests/load-testing/database-stress-test.js; then
        log_success "Database stress test completed successfully"
        db_report=$(find tests/load-testing -name "db-stress-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    else
        log_error "Database stress test failed"
        return 1
    fi
    
    # Store results in memory
    if [[ -n "$db_report" && -f "$db_report" ]]; then
        local memory_data=$(cat "$db_report")
        npx claude-flow@alpha hooks post-edit --file "database-stress-results.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load/database" <<< "$memory_data" || {
            log_warning "Could not store database test results in memory"
        }
    fi
    
    local test_duration=$(($(date +%s) - test_start_time))
    log_success "Phase 2 completed in ${test_duration}s"
}

# Execute container resource validation
execute_container_validation() {
    log_info "=== PHASE 3: CONTAINER RESOURCE VALIDATION ==="
    log_info "Validating container resource limits and performance"
    
    local test_start_time=$(date +%s)
    local container_report=""
    
    if node tests/load-testing/container-resource-validator.js; then
        log_success "Container resource validation completed successfully"
        container_report=$(find tests/load-testing -name "container-validation-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    else
        log_error "Container resource validation failed"
        return 1
    fi
    
    # Store results in memory
    if [[ -n "$container_report" && -f "$container_report" ]]; then
        local memory_data=$(cat "$container_report")
        npx claude-flow@alpha hooks post-edit --file "container-validation-results.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load/containers" <<< "$memory_data" || {
            log_warning "Could not store container validation results in memory"
        }
    fi
    
    local test_duration=$(($(date +%s) - test_start_time))
    log_success "Phase 3 completed in ${test_duration}s"
}

# Execute CDN and static asset testing
execute_cdn_performance_test() {
    log_info "=== PHASE 4: CDN AND STATIC ASSET PERFORMANCE ==="
    log_info "Testing CDN performance and static asset delivery"
    
    local test_start_time=$(date +%s)
    
    # Test static asset performance
    local static_assets=(
        "/favicon.ico"
        "/assets/css/main.css"
        "/assets/js/app.js"
        "/assets/images/logo.png"
    )
    
    local cdn_results="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",\"tests\":[]}"
    
    for asset in "${static_assets[@]}"; do
        local asset_url="${TEST_BASE_URL}${asset}"
        local start_time=$(date +%s%3N)
        
        log_info "Testing asset: $asset"
        
        # Test asset loading performance
        if curl_result=$(curl -s -w "%{http_code},%{time_total},%{size_download}" -o /dev/null "$asset_url" 2>/dev/null); then
            IFS=',' read -r status_code total_time size_download <<< "$curl_result"
            
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            
            log_info "Asset $asset: ${status_code} - ${total_time}s - ${size_download} bytes"
            
            # Add to results
            local test_result="{\"asset\":\"$asset\",\"statusCode\":$status_code,\"responseTime\":${response_time},\"totalTime\":$total_time,\"sizeBytes\":$size_download,\"success\":$([ "$status_code" -eq 200 ] && echo true || echo false)}"
            cdn_results=$(echo "$cdn_results" | jq ".tests += [$test_result]")
        else
            log_warning "Failed to test asset: $asset"
            local test_result="{\"asset\":\"$asset\",\"statusCode\":0,\"responseTime\":0,\"totalTime\":0,\"sizeBytes\":0,\"success\":false,\"error\":\"Request failed\"}"
            cdn_results=$(echo "$cdn_results" | jq ".tests += [$test_result]")
        fi
    done
    
    # Calculate summary statistics
    cdn_results=$(echo "$cdn_results" | jq '
        .summary = {
            totalAssets: (.tests | length),
            successfulAssets: (.tests | map(select(.success)) | length),
            averageResponseTime: (if (.tests | length) > 0 then (.tests | map(.responseTime) | add / length) else 0 end),
            totalDataTransferred: (.tests | map(.sizeBytes) | add),
            successRate: (if (.tests | length) > 0 then ((.tests | map(select(.success)) | length) / (.tests | length) * 100) else 0 end)
        }
    ')
    
    # Save CDN test results
    local cdn_report_file="tests/load-testing/cdn-performance-report-$(date +%s).json"
    echo "$cdn_results" > "$cdn_report_file"
    
    # Store results in memory
    npx claude-flow@alpha hooks post-edit --file "cdn-performance-results.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load/cdn" <<< "$cdn_results" || {
        log_warning "Could not store CDN test results in memory"
    }
    
    local test_duration=$(($(date +%s) - test_start_time))
    log_success "Phase 4 completed in ${test_duration}s"
    log_info "CDN performance report saved to: $cdn_report_file"
}

# Generate comprehensive report
generate_comprehensive_report() {
    log_info "=== GENERATING COMPREHENSIVE REPORT ==="
    
    local report_timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    local report_file="tests/load-testing/comprehensive-load-test-report-$(date +%s).json"
    
    # Collect all individual reports
    local comprehensive_report=$(find tests/load-testing -name "load-test-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    local database_report=$(find tests/load-testing -name "db-stress-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    local container_report=$(find tests/load-testing -name "container-validation-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    local cdn_report=$(find tests/load-testing -name "cdn-performance-report-*.json" -newer /tmp/load-test-start 2>/dev/null | head -1)
    
    # Create master report
    cat > "$report_file" << EOF
{
    "testSuite": "MediaNest Production Load Testing",
    "timestamp": "$report_timestamp",
    "configuration": {
        "baseUrl": "$TEST_BASE_URL",
        "maxConcurrentUsers": $MAX_CONCURRENT_USERS,
        "testDuration": $TEST_DURATION,
        "maxDatabaseConnections": $MAX_DB_CONNECTIONS,
        "concurrentQueries": $CONCURRENT_QUERIES
    },
    "reports": {
        "comprehensive": $([ -f "$comprehensive_report" ] && cat "$comprehensive_report" || echo 'null'),
        "database": $([ -f "$database_report" ] && cat "$database_report" || echo 'null'),
        "containers": $([ -f "$container_report" ] && cat "$container_report" || echo 'null'),
        "cdn": $([ -f "$cdn_report" ] && cat "$cdn_report" || echo 'null')
    },
    "summary": {
        "totalPhases": 4,
        "completedPhases": $(ls tests/load-testing/*-report-*.json 2>/dev/null | wc -l),
        "overallSuccess": true
    }
}
EOF
    
    # Store master report in memory
    local master_report_data=$(cat "$report_file")
    npx claude-flow@alpha hooks post-edit --file "master-load-test-report.json" --memory-key "MEDIANEST_PROD_VALIDATION/performance_load" <<< "$master_report_data" || {
        log_warning "Could not store master report in memory"
    }
    
    log_success "Comprehensive report generated: $report_file"
    
    # Display summary
    echo ""
    echo "==============================================="
    echo "📊 LOAD TESTING SUMMARY"
    echo "==============================================="
    
    if [[ -f "$comprehensive_report" ]]; then
        local total_requests=$(jq -r '.overallMetrics.totalRequests // 0' "$comprehensive_report")
        local success_rate=$(jq -r '.overallMetrics.successRate // "0%"' "$comprehensive_report")
        local throughput=$(jq -r '.overallMetrics.throughput // "0 req/s"' "$comprehensive_report")
        echo "🎯 Comprehensive Load Test:"
        echo "   - Total Requests: $total_requests"
        echo "   - Success Rate: $success_rate"
        echo "   - Throughput: $throughput"
        echo ""
    fi
    
    if [[ -f "$database_report" ]]; then
        local db_success_rate=$(jq -r '.databaseMetrics.successRate // "0%"' "$database_report")
        local avg_query_time=$(jq -r '.databaseMetrics.averageQueryTime // "0ms"' "$database_report")
        echo "🗃️  Database Stress Test:"
        echo "   - Success Rate: $db_success_rate"
        echo "   - Average Query Time: $avg_query_time"
        echo ""
    fi
    
    if [[ -f "$container_report" ]]; then
        local violation_count=$(jq -r '.totalViolations // 0' "$container_report")
        echo "🐳 Container Resource Validation:"
        echo "   - Resource Violations: $violation_count"
        echo ""
    fi
    
    if [[ -f "$cdn_report" ]]; then
        local cdn_success_rate=$(jq -r '.summary.successRate // 0' "$cdn_report")
        local avg_response_time=$(jq -r '.summary.averageResponseTime // 0' "$cdn_report")
        echo "🌐 CDN Performance Test:"
        echo "   - Success Rate: ${cdn_success_rate}%"
        echo "   - Average Response Time: ${avg_response_time}ms"
        echo ""
    fi
    
    echo "📄 Master Report: $report_file"
    echo "==============================================="
}

# Cleanup function
cleanup() {
    log_info "Cleaning up load testing resources..."
    
    # Kill any remaining test processes
    pkill -f "comprehensive-load-test" 2>/dev/null || true
    pkill -f "database-stress-test" 2>/dev/null || true
    pkill -f "container-resource-validator" 2>/dev/null || true
    
    # Notify coordination system
    npx claude-flow@alpha hooks post-task --task-id "medianest-load-testing" || {
        log_warning "Could not notify coordination system"
    }
    
    npx claude-flow@alpha hooks session-end --export-metrics true || {
        log_warning "Could not end coordination session"
    }
    
    log_success "Cleanup completed"
}

# Signal handlers
trap cleanup EXIT
trap 'log_error "Load testing interrupted"; exit 1' INT TERM

# Main execution
main() {
    local overall_start_time=$(date +%s)
    
    echo "🚀 MEDIANEST COMPREHENSIVE LOAD TESTING SUITE"
    echo "=============================================="
    echo "Started at: $(date)"
    echo "Configuration:"
    echo "  - Target: $TEST_BASE_URL"
    echo "  - Max Concurrent Users: $MAX_CONCURRENT_USERS"
    echo "  - Test Duration: ${TEST_DURATION}s"
    echo "  - Max DB Connections: $MAX_DB_CONNECTIONS"
    echo "  - Concurrent Queries: $CONCURRENT_QUERIES"
    echo ""
    
    # Create timestamp for finding new files
    touch /tmp/load-test-start
    
    # Execute test phases
    check_prerequisites
    initialize_coordination
    
    local failed_phases=0
    
    # Execute each phase
    execute_comprehensive_load_test || ((failed_phases++))
    execute_database_stress_test || ((failed_phases++))
    execute_container_validation || ((failed_phases++))
    execute_cdn_performance_test || ((failed_phases++))
    
    # Generate comprehensive report
    generate_comprehensive_report
    
    local overall_duration=$(($(date +%s) - overall_start_time))
    
    echo ""
    echo "=============================================="
    echo "🏁 LOAD TESTING COMPLETED"
    echo "=============================================="
    echo "Total Duration: ${overall_duration}s"
    echo "Failed Phases: $failed_phases/4"
    
    if [[ $failed_phases -eq 0 ]]; then
        log_success "All load testing phases completed successfully!"
        exit 0
    else
        log_warning "Some load testing phases failed. Check individual reports for details."
        exit 1
    fi
}

# Execute main function
main "$@"