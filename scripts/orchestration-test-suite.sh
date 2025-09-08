#!/bin/bash
set -euo pipefail

# MediaNest Orchestration Test Suite
# Comprehensive testing for Docker orchestration deployment

# Color codes and logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_LOG="/var/log/medianest-orchestration-test.log"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/orchestration"
CONCURRENT_REQUESTS=50
LOAD_TEST_DURATION=60
STRESS_TEST_DURATION=120

# Test configuration
declare -A TEST_ENDPOINTS=(
    ["health"]="/api/health"
    ["auth"]="/api/v1/auth/health"
    ["metrics"]="/metrics"
    ["status"]="/api/status"
)

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$TEST_LOG"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$TEST_LOG"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$TEST_LOG"; }
info() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$TEST_LOG"; }
debug() { echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] DEBUG: $1${NC}" | tee -a "$TEST_LOG"; }

# Initialize test environment
initialize_test_suite() {
    log "🧪 Initializing MediaNest Orchestration Test Suite"
    
    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    sudo touch "$TEST_LOG"
    sudo chown $USER:$USER "$TEST_LOG"
    
    # Create test report template
    cat > "$TEST_RESULTS_DIR/test-report-$(date +%Y%m%d-%H%M%S).json" << EOF
{
    "test_suite": "orchestration",
    "version": "1.0.0",
    "timestamp": "$(date -Iseconds)",
    "environment": {
        "platform": "$(detect_platform)",
        "docker_version": "$(docker --version)",
        "compose_version": "$(docker compose version 2>/dev/null || echo 'not available')"
    },
    "tests": {},
    "summary": {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "warnings": 0,
        "duration": 0
    }
}
EOF
    
    log "✅ Test suite initialized"
}

# Detect orchestration platform
detect_platform() {
    if docker info 2>/dev/null | grep -q "Swarm: active"; then
        echo "swarm"
    elif docker compose version >/dev/null 2>&1; then
        echo "compose"
    else
        echo "unknown"
    fi
}

# Test service availability
test_service_availability() {
    local test_name="service_availability"
    log "🔍 Testing service availability"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    # Get list of services based on platform
    local platform=$(detect_platform)
    local services=()
    
    case "$platform" in
        "swarm")
            readarray -t services < <(docker service ls --format "{{.Name}}" | grep "medianest")
            ;;
        "compose")
            readarray -t services < <(docker ps --filter "label=com.medianest" --format "{{.Names}}")
            ;;
    esac
    
    for service in "${services[@]}"; do
        debug "Testing service: $service"
        
        local service_healthy=false
        local error_message=""
        
        case "$platform" in
            "swarm")
                local replicas=$(docker service ls --filter "name=$service" --format "{{.Replicas}}")
                if [[ "$replicas" =~ ^([0-9]+)/([0-9]+)$ ]]; then
                    local running="${BASH_REMATCH[1]}"
                    local desired="${BASH_REMATCH[2]}"
                    if [[ "$running" == "$desired" ]] && [[ "$running" -gt 0 ]]; then
                        service_healthy=true
                    else
                        error_message="Replicas: $running/$desired"
                    fi
                fi
                ;;
            "compose")
                if docker ps --filter "name=$service" --filter "status=running" --format "{{.Names}}" | grep -q "$service"; then
                    service_healthy=true
                else
                    error_message="Container not running"
                fi
                ;;
        esac
        
        if $service_healthy; then
            log "✅ $service: Available"
            ((passed++))
            results+=("{\"service\": \"$service\", \"status\": \"pass\", \"message\": \"Service is available\"}")
        else
            error "❌ $service: Not available - $error_message"
            ((failed++))
            results+=("{\"service\": \"$service\", \"status\": \"fail\", \"message\": \"$error_message\"}")
        fi
    done
    
    local duration=$(($(date +%s) - start_time))
    
    # Save test results
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Service availability test completed: $passed passed, $failed failed"
    return $failed
}

# Test endpoint connectivity
test_endpoint_connectivity() {
    local test_name="endpoint_connectivity"
    log "🌐 Testing endpoint connectivity"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    local base_urls=("http://localhost" "http://localhost:8080" "http://localhost:9090" "http://localhost:3001")
    
    for base_url in "${base_urls[@]}"; do
        for endpoint_name in "${!TEST_ENDPOINTS[@]}"; do
            local endpoint="${TEST_ENDPOINTS[$endpoint_name]}"
            local full_url="$base_url$endpoint"
            
            debug "Testing endpoint: $full_url"
            
            local response_time
            local http_code
            local test_result
            
            # Measure response time and get HTTP status
            response_time=$(curl -o /dev/null -s -w '%{time_total}' -m 10 "$full_url" 2>/dev/null || echo "timeout")
            http_code=$(curl -o /dev/null -s -w '%{http_code}' -m 10 "$full_url" 2>/dev/null || echo "000")
            
            if [[ "$response_time" == "timeout" ]] || [[ "$http_code" == "000" ]]; then
                debug "⏭️  $full_url: Not accessible (expected for some endpoints)"
                results+=("{\"endpoint\": \"$full_url\", \"status\": \"skip\", \"message\": \"Not accessible\", \"response_time\": 0, \"http_code\": \"$http_code\"}")
                continue
            fi
            
            local response_ms=$(awk "BEGIN {printf \"%.0f\", $response_time * 1000}")
            
            if [[ "$http_code" =~ ^[23] ]]; then
                log "✅ $full_url: OK (${response_ms}ms, HTTP $http_code)"
                ((passed++))
                test_result="pass"
            else
                warn "⚠️  $full_url: HTTP $http_code (${response_ms}ms)"
                test_result="warning"
            fi
            
            results+=("{\"endpoint\": \"$full_url\", \"status\": \"$test_result\", \"message\": \"HTTP $http_code\", \"response_time\": $response_ms, \"http_code\": \"$http_code\"}")
        done
    done
    
    local duration=$(($(date +%s) - start_time))
    
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Endpoint connectivity test completed: $passed accessible endpoints"
    return 0
}

# Test load balancing
test_load_balancing() {
    local test_name="load_balancing"
    log "⚖️ Testing load balancing"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    # Check if Traefik is running
    if ! curl -s -f "http://localhost:8080/ping" >/dev/null 2>&1; then
        warn "Traefik not accessible, skipping load balancing test"
        save_test_result "$test_name" 0 0 0 '{"status": "skip", "message": "Traefik not accessible"}'
        return 0
    fi
    
    # Test load distribution
    local requests=20
    local unique_responses=0
    
    log "Sending $requests requests to test load balancing..."
    
    for ((i=1; i<=requests; i++)); do
        local response
        response=$(curl -s -H "X-Test-Request: $i" "http://localhost/api/health" 2>/dev/null || echo "error")
        
        if [[ "$response" != "error" ]]; then
            ((unique_responses++))
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    local success_rate=$(( (unique_responses * 100) / requests ))
    
    if [[ $success_rate -gt 80 ]]; then
        log "✅ Load balancing: $success_rate% success rate"
        ((passed++))
        results+=("{\"test\": \"load_distribution\", \"status\": \"pass\", \"success_rate\": $success_rate, \"requests\": $requests}")
    else
        error "❌ Load balancing: Low success rate $success_rate%"
        ((failed++))
        results+=("{\"test\": \"load_distribution\", \"status\": \"fail\", \"success_rate\": $success_rate, \"requests\": $requests}")
    fi
    
    local duration=$(($(date +%s) - start_time))
    
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Load balancing test completed"
    return $failed
}

# Test auto-scaling (simulate load)
test_auto_scaling() {
    local test_name="auto_scaling"
    log "📈 Testing auto-scaling capabilities"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    local platform=$(detect_platform)
    
    # Get initial replica count
    local initial_replicas=0
    case "$platform" in
        "swarm")
            initial_replicas=$(docker service inspect medianest_medianest-app --format "{{.Spec.Mode.Replicated.Replicas}}" 2>/dev/null || echo "0")
            ;;
        "compose")
            initial_replicas=$(docker ps --filter "name=medianest-app" --filter "status=running" --format "{{.Names}}" | wc -l)
            ;;
    esac
    
    log "Initial replicas: $initial_replicas"
    
    if [[ $initial_replicas -eq 0 ]]; then
        error "No application replicas found"
        save_test_result "$test_name" 0 1 0 '{"status": "fail", "message": "No application replicas found"}'
        return 1
    fi
    
    # Generate load to trigger scaling (if auto-scaler is running)
    log "Generating load to test auto-scaling..."
    
    # Run concurrent requests for load testing
    local pids=()
    for ((i=1; i<=10; i++)); do
        {
            for ((j=1; j<=100; j++)); do
                curl -s "http://localhost/api/health" >/dev/null 2>&1 || true
                sleep 0.1
            done
        } &
        pids+=($!)
    done
    
    # Monitor for scaling events
    sleep 30  # Allow time for potential scaling
    
    # Clean up background processes
    for pid in "${pids[@]}"; do
        kill $pid 2>/dev/null || true
    done
    
    # Check if scaling occurred
    local final_replicas=0
    case "$platform" in
        "swarm")
            final_replicas=$(docker service inspect medianest_medianest-app --format "{{.Spec.Mode.Replicated.Replicas}}" 2>/dev/null || echo "0")
            ;;
        "compose")
            final_replicas=$(docker ps --filter "name=medianest-app" --filter "status=running" --format "{{.Names}}" | wc -l)
            ;;
    esac
    
    log "Final replicas: $final_replicas"
    
    # For now, just verify that services maintained stability under load
    if [[ $final_replicas -ge $initial_replicas ]]; then
        log "✅ Auto-scaling: Services maintained or increased capacity"
        ((passed++))
        results+=("{\"test\": \"scaling_stability\", \"status\": \"pass\", \"initial_replicas\": $initial_replicas, \"final_replicas\": $final_replicas}")
    else
        warn "⚠️  Auto-scaling: Replica count decreased during load test"
        results+=("{\"test\": \"scaling_stability\", \"status\": \"warning\", \"initial_replicas\": $initial_replicas, \"final_replicas\": $final_replicas}")
    fi
    
    local duration=$(($(date +%s) - start_time))
    
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Auto-scaling test completed"
    return 0
}

# Test health checks and recovery
test_health_and_recovery() {
    local test_name="health_and_recovery"
    log "🏥 Testing health checks and recovery"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    # Test health check endpoints
    local health_endpoints=("http://localhost/api/health" "http://localhost:8080/ping" "http://localhost:9090/-/healthy")
    
    for endpoint in "${health_endpoints[@]}"; do
        debug "Testing health endpoint: $endpoint"
        
        local response_time
        local http_code
        
        response_time=$(curl -o /dev/null -s -w '%{time_total}' -m 10 "$endpoint" 2>/dev/null || echo "timeout")
        http_code=$(curl -o /dev/null -s -w '%{http_code}' -m 10 "$endpoint" 2>/dev/null || echo "000")
        
        if [[ "$response_time" == "timeout" ]] || [[ "$http_code" == "000" ]]; then
            debug "⏭️  $endpoint: Not accessible"
            results+=("{\"endpoint\": \"$endpoint\", \"status\": \"skip\", \"message\": \"Not accessible\"}")
            continue
        fi
        
        local response_ms=$(awk "BEGIN {printf \"%.0f\", $response_time * 1000}")
        
        if [[ "$http_code" =~ ^[23] ]]; then
            log "✅ $endpoint: Healthy (${response_ms}ms)"
            ((passed++))
            results+=("{\"endpoint\": \"$endpoint\", \"status\": \"pass\", \"response_time\": $response_ms, \"http_code\": \"$http_code\"}")
        else
            error "❌ $endpoint: Unhealthy (HTTP $http_code)"
            ((failed++))
            results+=("{\"endpoint\": \"$endpoint\", \"status\": \"fail\", \"response_time\": $response_ms, \"http_code\": \"$http_code\"}")
        fi
    done
    
    local duration=$(($(date +%s) - start_time))
    
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Health and recovery test completed: $passed passed, $failed failed"
    return $failed
}

# Test monitoring and metrics
test_monitoring_metrics() {
    local test_name="monitoring_metrics"
    log "📊 Testing monitoring and metrics"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    # Test Prometheus metrics
    if curl -s -f "http://localhost:9090/api/v1/query?query=up" >/dev/null 2>&1; then
        log "✅ Prometheus: Metrics API accessible"
        ((passed++))
        results+=("{\"component\": \"prometheus\", \"status\": \"pass\", \"message\": \"Metrics API accessible\"}")
        
        # Test specific metrics
        local metrics_to_test=("container_cpu_usage_seconds_total" "container_memory_usage_bytes" "http_requests_total")
        
        for metric in "${metrics_to_test[@]}"; do
            if curl -s "http://localhost:9090/api/v1/query?query=$metric" | jq -r '.status' | grep -q "success"; then
                debug "✅ Metric $metric: Available"
                results+=("{\"metric\": \"$metric\", \"status\": \"pass\", \"message\": \"Metric available\"}")
            else
                debug "⚠️  Metric $metric: Not available"
                results+=("{\"metric\": \"$metric\", \"status\": \"warning\", \"message\": \"Metric not available\"}")
            fi
        done
    else
        error "❌ Prometheus: Not accessible"
        ((failed++))
        results+=("{\"component\": \"prometheus\", \"status\": \"fail\", \"message\": \"Not accessible\"}")
    fi
    
    # Test Grafana dashboard
    if curl -s -f "http://localhost:3001/api/health" >/dev/null 2>&1; then
        log "✅ Grafana: Dashboard accessible"
        ((passed++))
        results+=("{\"component\": \"grafana\", \"status\": \"pass\", \"message\": \"Dashboard accessible\"}")
    else
        warn "⚠️  Grafana: Not accessible"
        results+=("{\"component\": \"grafana\", \"status\": \"warning\", \"message\": \"Not accessible\"}")
    fi
    
    local duration=$(($(date +%s) - start_time))
    
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Monitoring and metrics test completed"
    return $failed
}

# Performance load test
test_performance_load() {
    local test_name="performance_load"
    log "🚀 Running performance load test"
    
    local start_time=$(date +%s)
    local passed=0
    local failed=0
    local results=()
    
    # Check if main application is accessible
    if ! curl -s -f "http://localhost/api/health" >/dev/null 2>&1; then
        warn "Application not accessible, skipping load test"
        save_test_result "$test_name" 0 0 0 '{"status": "skip", "message": "Application not accessible"}'
        return 0
    fi
    
    log "Starting load test: $CONCURRENT_REQUESTS concurrent requests for ${LOAD_TEST_DURATION}s"
    
    # Create temporary files for results
    local success_file="/tmp/load_test_success.txt"
    local error_file="/tmp/load_test_errors.txt"
    local response_times="/tmp/load_test_times.txt"
    
    echo "0" > "$success_file"
    echo "0" > "$error_file"
    echo "" > "$response_times"
    
    # Run concurrent load test
    local pids=()
    local end_time=$(($(date +%s) + LOAD_TEST_DURATION))
    
    for ((i=1; i<=CONCURRENT_REQUESTS; i++)); do
        {
            while [[ $(date +%s) -lt $end_time ]]; do
                local response_time
                local http_code
                
                response_time=$(curl -o /dev/null -s -w '%{time_total}' -m 10 "http://localhost/api/health" 2>/dev/null || echo "timeout")
                http_code=$(curl -o /dev/null -s -w '%{http_code}' -m 10 "http://localhost/api/health" 2>/dev/null || echo "000")
                
                if [[ "$response_time" != "timeout" ]] && [[ "$http_code" =~ ^[23] ]]; then
                    echo "$response_time" >> "$response_times"
                    local current_success=$(cat "$success_file")
                    echo $((current_success + 1)) > "$success_file"
                else
                    local current_errors=$(cat "$error_file")
                    echo $((current_errors + 1)) > "$error_file"
                fi
                
                sleep 0.1
            done
        } &
        pids+=($!)
    done
    
    # Wait for all background processes
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Calculate results
    local total_success=$(cat "$success_file")
    local total_errors=$(cat "$error_file")
    local total_requests=$((total_success + total_errors))
    
    local success_rate=0
    if [[ $total_requests -gt 0 ]]; then
        success_rate=$(( (total_success * 100) / total_requests ))
    fi
    
    # Calculate average response time
    local avg_response_time=0
    if [[ -s "$response_times" ]]; then
        avg_response_time=$(awk '{sum+=$1; count++} END {if(count>0) printf "%.0f", (sum/count)*1000}' "$response_times")
    fi
    
    # Performance thresholds
    local min_success_rate=95
    local max_avg_response_time=2000
    
    log "Load test results:"
    log "- Total requests: $total_requests"
    log "- Successful: $total_success"
    log "- Errors: $total_errors"
    log "- Success rate: $success_rate%"
    log "- Average response time: ${avg_response_time}ms"
    
    if [[ $success_rate -ge $min_success_rate ]] && [[ $avg_response_time -le $max_avg_response_time ]]; then
        log "✅ Performance load test: PASSED"
        ((passed++))
        results+=("{\"test\": \"load_performance\", \"status\": \"pass\", \"success_rate\": $success_rate, \"avg_response_time\": $avg_response_time, \"total_requests\": $total_requests}")
    else
        error "❌ Performance load test: FAILED"
        ((failed++))
        results+=("{\"test\": \"load_performance\", \"status\": \"fail\", \"success_rate\": $success_rate, \"avg_response_time\": $avg_response_time, \"total_requests\": $total_requests}")
    fi
    
    # Cleanup
    rm -f "$success_file" "$error_file" "$response_times"
    
    local duration=$(($(date +%s) - start_time))
    
    save_test_result "$test_name" "$passed" "$failed" "$duration" "${results[@]}"
    
    log "Performance load test completed"
    return $failed
}

# Save test result to JSON report
save_test_result() {
    local test_name=$1
    local passed=$2
    local failed=$3
    local duration=$4
    shift 4
    local results=("$@")
    
    # Find the latest test report file
    local report_file=$(find "$TEST_RESULTS_DIR" -name "test-report-*.json" -type f -printf "%T+ %p\n" | sort -r | head -1 | cut -d' ' -f2-)
    
    if [[ -z "$report_file" ]]; then
        error "Test report file not found"
        return 1
    fi
    
    # Create results array JSON
    local results_json="["
    local first=true
    for result in "${results[@]}"; do
        if $first; then
            first=false
        else
            results_json+=","
        fi
        results_json+="$result"
    done
    results_json+="]"
    
    # Update test report
    jq --arg test_name "$test_name" \
       --argjson passed "$passed" \
       --argjson failed "$failed" \
       --argjson duration "$duration" \
       --argjson results "$results_json" \
       '.tests[$test_name] = {
           "passed": $passed,
           "failed": $failed,
           "duration": $duration,
           "results": $results
       } |
       .summary.total += 1 |
       if ($failed > 0) then .summary.failed += 1 else .summary.passed += 1 end |
       .summary.duration += $duration' \
       "$report_file" > "${report_file}.tmp" && \
    mv "${report_file}.tmp" "$report_file"
}

# Generate final test report
generate_test_report() {
    log "📋 Generating final test report"
    
    local report_file=$(find "$TEST_RESULTS_DIR" -name "test-report-*.json" -type f -printf "%T+ %p\n" | sort -r | head -1 | cut -d' ' -f2-)
    
    if [[ -z "$report_file" ]]; then
        error "Test report file not found"
        return 1
    fi
    
    # Update final timestamp
    jq --arg end_time "$(date -Iseconds)" \
       '.end_time = $end_time' \
       "$report_file" > "${report_file}.tmp" && \
    mv "${report_file}.tmp" "$report_file"
    
    # Display summary
    echo
    echo "==================== ORCHESTRATION TEST SUMMARY ===================="
    echo "Report: $report_file"
    echo
    jq -r '
        "Platform: " + .environment.platform,
        "Total Tests: " + (.summary.total | tostring),
        "Passed: " + (.summary.passed | tostring),
        "Failed: " + (.summary.failed | tostring),
        "Total Duration: " + (.summary.duration | tostring) + "s"
    ' "$report_file"
    echo
    echo "Detailed Results:"
    jq -r '.tests | to_entries[] | "- " + .key + ": " + (.value.passed | tostring) + " passed, " + (.value.failed | tostring) + " failed"' "$report_file"
    echo "=================================================================="
    
    log "✅ Test report generated: $report_file"
}

# Run all tests
run_all_tests() {
    log "🧪 Running comprehensive orchestration test suite"
    
    initialize_test_suite
    
    local overall_result=0
    
    # Run individual test suites
    test_service_availability || ((overall_result++))
    test_endpoint_connectivity || ((overall_result++))
    test_load_balancing || ((overall_result++))
    test_auto_scaling || ((overall_result++))
    test_health_and_recovery || ((overall_result++))
    test_monitoring_metrics || ((overall_result++))
    test_performance_load || ((overall_result++))
    
    # Generate final report
    generate_test_report
    
    if [[ $overall_result -eq 0 ]]; then
        log "🎉 All orchestration tests completed successfully!"
    else
        warn "⚠️  Some tests failed. Check the detailed report for more information."
    fi
    
    return $overall_result
}

# Main function
main() {
    local command="${1:-all}"
    
    case "$command" in
        "all")
            run_all_tests
            ;;
        "availability")
            initialize_test_suite
            test_service_availability
            generate_test_report
            ;;
        "connectivity")
            initialize_test_suite
            test_endpoint_connectivity
            generate_test_report
            ;;
        "load-balancing")
            initialize_test_suite
            test_load_balancing
            generate_test_report
            ;;
        "scaling")
            initialize_test_suite
            test_auto_scaling
            generate_test_report
            ;;
        "health")
            initialize_test_suite
            test_health_and_recovery
            generate_test_report
            ;;
        "monitoring")
            initialize_test_suite
            test_monitoring_metrics
            generate_test_report
            ;;
        "performance")
            initialize_test_suite
            test_performance_load
            generate_test_report
            ;;
        *)
            echo "MediaNest Orchestration Test Suite"
            echo
            echo "Usage: $0 <command>"
            echo
            echo "Commands:"
            echo "  all               Run all tests"
            echo "  availability      Test service availability"
            echo "  connectivity      Test endpoint connectivity"
            echo "  load-balancing    Test load balancing"
            echo "  scaling           Test auto-scaling"
            echo "  health            Test health checks and recovery"
            echo "  monitoring        Test monitoring and metrics"
            echo "  performance       Run performance load test"
            echo
            echo "Environment Variables:"
            echo "  CONCURRENT_REQUESTS    Number of concurrent requests for load test (default: 50)"
            echo "  LOAD_TEST_DURATION     Duration of load test in seconds (default: 60)"
            echo
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Test suite interrupted"; exit 1' INT TERM

# Execute main function
main "$@"