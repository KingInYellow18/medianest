#!/bin/bash
# MediaNest Performance Baseline Script
# Establishes performance baselines after deployment

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-medianest.yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.medianest.yourdomain.com}"
NAMESPACE="medianest-prod"
RESULTS_DIR="./performance-results"
BASELINE_FILE="$RESULTS_DIR/baseline-$(date +%Y%m%d-%H%M%S).json"

# Test Configuration
CONCURRENT_USERS=10
TEST_DURATION=60
RAMP_UP_TIME=30
THINK_TIME=1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to check if required tools are available
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local required_tools=("curl" "jq" "kubectl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    log_success "All prerequisites met"
}

# Function to create results directory
setup_results_dir() {
    mkdir -p "$RESULTS_DIR"
    log_info "Results will be saved to: $RESULTS_DIR"
}

# Function to test single endpoint performance
test_endpoint_performance() {
    local endpoint=$1
    local name=$2
    local method=${3:-GET}
    local data=${4:-}
    
    log_info "Testing $name performance..."
    
    local curl_cmd="curl -s -w '@-' -o /dev/null"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -X POST -H 'Content-Type: application/json' -d '$data'"
    fi
    
    local curl_format='
{
  "time_namelookup": %{time_namelookup},
  "time_connect": %{time_connect},
  "time_appconnect": %{time_appconnect},
  "time_pretransfer": %{time_pretransfer},
  "time_redirect": %{time_redirect},
  "time_starttransfer": %{time_starttransfer},
  "time_total": %{time_total},
  "http_code": %{http_code},
  "size_download": %{size_download},
  "size_upload": %{size_upload},
  "speed_download": %{speed_download},
  "speed_upload": %{speed_upload}
}'
    
    # Run multiple requests to get average
    local total_time=0
    local success_count=0
    local results_file="/tmp/perf_${name}_$$.json"
    
    echo "[" > "$results_file"
    
    for i in {1..10}; do
        local result=$(eval "$curl_cmd '$endpoint'" <<< "$curl_format" 2>/dev/null)
        
        if [ -n "$result" ]; then
            echo "$result" >> "$results_file"
            if [ $i -lt 10 ]; then
                echo "," >> "$results_file"
            fi
            
            local time_total=$(echo "$result" | jq -r '.time_total')
            local http_code=$(echo "$result" | jq -r '.http_code')
            
            if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
                total_time=$(echo "$total_time + $time_total" | bc -l)
                ((success_count++))
            fi
        fi
        
        sleep 0.5
    done
    
    echo "]" >> "$results_file"
    
    if [ $success_count -gt 0 ]; then
        local avg_time=$(echo "scale=4; $total_time / $success_count" | bc -l)
        log_success "$name: Average response time: ${avg_time}s (${success_count}/10 successful)"
        
        # Store results in baseline
        jq --arg name "$name" --arg avg_time "$avg_time" --arg success_rate "$(echo "scale=2; $success_count * 10" | bc -l)" \
           '.endpoints += [{"name": $name, "avg_response_time": ($avg_time | tonumber), "success_rate": ($success_rate | tonumber)}]' \
           "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
    else
        log_error "$name: All requests failed"
    fi
    
    rm -f "$results_file"
}

# Function to test database performance
test_database_performance() {
    log_info "Testing database performance..."
    
    local backend_pod=$(kubectl get pods -l app=medianest-backend -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    
    if [ -z "$backend_pod" ]; then
        log_error "Backend pod not found"
        return 1
    fi
    
    # Test database connection time
    local db_test_script="
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function testDB() {
        const start = Date.now();
        try {
            await prisma.\$connect();
            const connectTime = Date.now() - start;
            
            const queryStart = Date.now();
            await prisma.\$queryRaw\`SELECT 1\`;
            const queryTime = Date.now() - queryStart;
            
            console.log(JSON.stringify({
                connect_time: connectTime,
                query_time: queryTime,
                status: 'success'
            }));
        } catch (error) {
            console.log(JSON.stringify({
                error: error.message,
                status: 'error'
            }));
        } finally {
            await prisma.\$disconnect();
        }
    }
    
    testDB();
    "
    
    local db_result=$(kubectl exec "$backend_pod" -n "$NAMESPACE" -- node -e "$db_test_script" 2>/dev/null)
    
    if [ -n "$db_result" ]; then
        local connect_time=$(echo "$db_result" | jq -r '.connect_time // 0')
        local query_time=$(echo "$db_result" | jq -r '.query_time // 0')
        
        log_success "Database: Connect time: ${connect_time}ms, Query time: ${query_time}ms"
        
        # Store in baseline
        jq --arg connect_time "$connect_time" --arg query_time "$query_time" \
           '.database = {"connect_time_ms": ($connect_time | tonumber), "query_time_ms": ($query_time | tonumber)}' \
           "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
    else
        log_error "Database performance test failed"
    fi
}

# Function to test Redis performance
test_redis_performance() {
    log_info "Testing Redis performance..."
    
    local redis_pod=$(kubectl get pods -l app=redis -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    
    if [ -z "$redis_pod" ]; then
        log_error "Redis pod not found"
        return 1
    fi
    
    # Test Redis operations
    local redis_test_results=$(kubectl exec "$redis_pod" -n "$NAMESPACE" -- redis-cli --latency-history -i 1 ping 2>/dev/null | head -5)
    
    if [ -n "$redis_test_results" ]; then
        local avg_latency=$(echo "$redis_test_results" | grep -o 'avg=[0-9.]*' | cut -d'=' -f2 | head -1)
        
        if [ -n "$avg_latency" ]; then
            log_success "Redis: Average latency: ${avg_latency}ms"
            
            # Store in baseline
            jq --arg latency "$avg_latency" \
               '.redis = {"avg_latency_ms": ($latency | tonumber)}' \
               "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
        else
            log_warning "Could not parse Redis latency"
        fi
    else
        log_error "Redis performance test failed"
    fi
}

# Function to get resource utilization
get_resource_utilization() {
    log_info "Getting resource utilization..."
    
    # Get pod resource usage
    local pod_metrics=$(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null || echo "")
    
    if [ -n "$pod_metrics" ]; then
        log_info "Current resource utilization:"
        echo "$pod_metrics"
        
        # Parse and store metrics
        local backend_cpu=$(echo "$pod_metrics" | grep medianest-backend | awk '{print $2}' | head -1 | sed 's/m$//')
        local backend_memory=$(echo "$pod_metrics" | grep medianest-backend | awk '{print $3}' | head -1 | sed 's/Mi$//')
        local frontend_cpu=$(echo "$pod_metrics" | grep medianest-frontend | awk '{print $2}' | head -1 | sed 's/m$//')
        local frontend_memory=$(echo "$pod_metrics" | grep medianest-frontend | awk '{print $3}' | head -1 | sed 's/Mi$//')
        
        if [ -n "$backend_cpu" ] && [ -n "$backend_memory" ]; then
            jq --arg cpu "$backend_cpu" --arg memory "$backend_memory" \
               '.resources.backend = {"cpu_millicores": ($cpu | tonumber), "memory_mb": ($memory | tonumber)}' \
               "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
        fi
        
        if [ -n "$frontend_cpu" ] && [ -n "$frontend_memory" ]; then
            jq --arg cpu "$frontend_cpu" --arg memory "$frontend_memory" \
               '.resources.frontend = {"cpu_millicores": ($cpu | tonumber), "memory_mb": ($memory | tonumber)}' \
               "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
        fi
    else
        log_warning "Could not get resource metrics (metrics-server may not be available)"
    fi
}

# Function to run load test (basic)
run_basic_load_test() {
    log_info "Running basic load test..."
    
    local load_test_script="/tmp/load_test_$$.sh"
    
    cat > "$load_test_script" << 'EOF'
#!/bin/bash
URL=$1
CONCURRENT=$2
DURATION=$3

echo "Starting load test: $CONCURRENT concurrent users for ${DURATION}s"

start_time=$(date +%s)
end_time=$((start_time + DURATION))
total_requests=0
success_requests=0

# Function to make requests
make_requests() {
    local user_id=$1
    local requests=0
    local successes=0
    
    while [ $(date +%s) -lt $end_time ]; do
        if curl -s --max-time 10 "$URL" > /dev/null 2>&1; then
            ((successes++))
        fi
        ((requests++))
        sleep 1
    done
    
    echo "$requests $successes"
}

# Start concurrent users
for i in $(seq 1 $CONCURRENT); do
    make_requests $i &
done

# Wait for all background jobs to complete
wait

# Collect results
for job in $(jobs -p); do
    wait $job
done

echo "Load test completed"
EOF

    chmod +x "$load_test_script"
    
    # Run load test
    local load_results=$("$load_test_script" "https://$DOMAIN" "$CONCURRENT_USERS" "$TEST_DURATION" 2>/dev/null)
    
    if [ -n "$load_results" ]; then
        log_success "Basic load test completed"
        
        # Store in baseline
        jq --arg users "$CONCURRENT_USERS" --arg duration "$TEST_DURATION" \
           '.load_test = {"concurrent_users": ($users | tonumber), "duration_seconds": ($duration | tonumber), "status": "completed"}' \
           "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
    else
        log_warning "Load test results not available"
    fi
    
    rm -f "$load_test_script"
}

# Function to test WebSocket performance
test_websocket_performance() {
    log_info "Testing WebSocket performance..."
    
    # Basic WebSocket connectivity test
    local ws_test_result=$(curl -s -I --max-time 10 "https://$API_DOMAIN/socket.io/" 2>/dev/null | head -1)
    
    if echo "$ws_test_result" | grep -q "200\|400"; then
        log_success "WebSocket endpoint is accessible"
        
        jq '.websocket = {"status": "accessible"}' \
           "$BASELINE_FILE" > "${BASELINE_FILE}.tmp" && mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"
    else
        log_warning "WebSocket endpoint test inconclusive"
    fi
}

# Function to initialize baseline file
init_baseline_file() {
    cat > "$BASELINE_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "domain": "$DOMAIN",
  "api_domain": "$API_DOMAIN",
  "version": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "endpoints": [],
  "database": {},
  "redis": {},
  "resources": {},
  "load_test": {},
  "websocket": {}
}
EOF
}

# Function to generate performance report
generate_report() {
    log_info "Generating performance report..."
    
    local report_file="$RESULTS_DIR/performance-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# MediaNest Performance Baseline Report

**Generated**: $(date)
**Domain**: $DOMAIN
**API Domain**: $API_DOMAIN
**Version**: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')

## Summary

This report contains performance baselines established after deployment.

## Endpoint Performance

$(jq -r '.endpoints[] | "- **\(.name)**: \(.avg_response_time)s average response time (\(.success_rate)% success rate)"' "$BASELINE_FILE" 2>/dev/null || echo "No endpoint data available")

## Database Performance

$(jq -r 'if .database.connect_time_ms then "- Connection Time: \(.database.connect_time_ms)ms\n- Query Time: \(.database.query_time_ms)ms" else "No database performance data available" end' "$BASELINE_FILE" 2>/dev/null)

## Redis Performance

$(jq -r 'if .redis.avg_latency_ms then "- Average Latency: \(.redis.avg_latency_ms)ms" else "No Redis performance data available" end' "$BASELINE_FILE" 2>/dev/null)

## Resource Utilization

### Backend
$(jq -r 'if .resources.backend then "- CPU: \(.resources.backend.cpu_millicores)m\n- Memory: \(.resources.backend.memory_mb)MB" else "No backend resource data available" end' "$BASELINE_FILE" 2>/dev/null)

### Frontend
$(jq -r 'if .resources.frontend then "- CPU: \(.resources.frontend.cpu_millicores)m\n- Memory: \(.resources.frontend.memory_mb)MB" else "No frontend resource data available" end' "$BASELINE_FILE" 2>/dev/null)

## Load Test Results

$(jq -r 'if .load_test.status then "- Concurrent Users: \(.load_test.concurrent_users)\n- Duration: \(.load_test.duration_seconds) seconds\n- Status: \(.load_test.status)" else "No load test data available" end' "$BASELINE_FILE" 2>/dev/null)

## Recommendations

- Monitor these baseline metrics regularly
- Set up alerting if performance degrades significantly from these baselines
- Consider scaling if resource utilization consistently exceeds 70%
- Regular performance testing should be conducted to ensure consistent performance

---
*Generated by MediaNest Performance Baseline Script*
EOF

    log_success "Performance report generated: $report_file"
}

# Main function
main() {
    log_info "Starting MediaNest Performance Baseline Tests"
    log_info "Domain: $DOMAIN"
    log_info "API Domain: $API_DOMAIN"
    echo "=========================================="
    
    check_prerequisites
    setup_results_dir
    init_baseline_file
    
    # Run performance tests
    test_endpoint_performance "https://$DOMAIN/api/health" "Frontend Health"
    test_endpoint_performance "https://$API_DOMAIN/api/health" "Backend Health"
    test_endpoint_performance "https://$API_DOMAIN/api/auth/status" "Auth Status"
    test_endpoint_performance "https://$DOMAIN" "Frontend Homepage"
    
    test_database_performance
    test_redis_performance
    get_resource_utilization
    test_websocket_performance
    
    # Run basic load test (optional, can be time-consuming)
    if [ "${RUN_LOAD_TEST:-false}" = "true" ]; then
        run_basic_load_test
    fi
    
    # Generate report
    generate_report
    
    log_success "Performance baseline testing completed!"
    log_info "Baseline data saved to: $BASELINE_FILE"
    log_info "Performance report available in: $RESULTS_DIR"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --api-domain)
            API_DOMAIN="$2"
            shift 2
            ;;
        --load-test)
            RUN_LOAD_TEST=true
            shift
            ;;
        --concurrent-users)
            CONCURRENT_USERS="$2"
            shift 2
            ;;
        --test-duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        --help)
            echo "MediaNest Performance Baseline Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --domain DOMAIN        Frontend domain"
            echo "  --api-domain DOMAIN    API domain"
            echo "  --load-test            Run load test (time-consuming)"
            echo "  --concurrent-users N   Number of concurrent users for load test"
            echo "  --test-duration N      Load test duration in seconds"
            echo "  --help                 Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main