#!/bin/bash

# MediaNest Real-Time Monitoring Dashboard
# Provides comprehensive monitoring for staging deployment

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="logs/monitoring-$(date +%Y%m%d-%H%M%S).log"
HEALTH_CHECK_INTERVAL=30
METRICS_PORT=3000
API_BASE_URL="http://localhost:${METRICS_PORT}/api/v1"

# Ensure logs directory exists
mkdir -p logs

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [$level] $message" | tee -a "$LOG_FILE"
}

# Check if service is running
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    if curl -sf "http://localhost:${port}${endpoint}" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Get container stats
get_container_stats() {
    local container_name=$1
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        docker stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" "$container_name" 2>/dev/null || echo "N/A N/A"
    else
        echo "N/A N/A"
    fi
}

# Get API response time
get_response_time() {
    local endpoint=$1
    local start_time=$(date +%s%3N)
    if curl -sf "${API_BASE_URL}${endpoint}" >/dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        echo "$((end_time - start_time))ms"
    else
        echo "FAIL"
    fi
}

# Get database connection status
check_database() {
    if docker exec -it postgres-db psql -U medianest -d medianest -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}Connected${NC}"
    else
        echo -e "${RED}Disconnected${NC}"
    fi
}

# Get Redis status
check_redis() {
    if docker exec -it redis-cache redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}Connected${NC}"
    else
        echo -e "${RED}Disconnected${NC}"
    fi
}

# Get system metrics
get_system_metrics() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')
    local mem_usage=$(free | grep Mem | awk '{printf "%.1f%%", $3/$2 * 100.0}')
    local disk_usage=$(df / | tail -1 | awk '{print $5}')
    
    echo "$cpu_usage $mem_usage $disk_usage"
}

# Monitor authentication flows
monitor_auth() {
    local auth_logs=$(docker logs backend-app 2>&1 | grep -c "auth\|jwt\|login" || echo 0)
    local auth_errors=$(docker logs backend-app 2>&1 | grep -c "auth.*error\|jwt.*error\|login.*error" || echo 0)
    echo "$auth_logs $auth_errors"
}

# Check API endpoints
check_api_endpoints() {
    local endpoints=("/health" "/api/v1/health" "/api/v1/auth/session")
    local status=""
    
    for endpoint in "${endpoints[@]}"; do
        if curl -sf "${API_BASE_URL}${endpoint}" >/dev/null 2>&1; then
            status="${status}${GREEN}✓${NC} "
        else
            status="${status}${RED}✗${NC} "
        fi
    done
    echo -e "$status"
}

# Main monitoring dashboard
show_dashboard() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                           MediaNest Monitoring Dashboard                        ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${NC} Last Updated: $(date '+%Y-%m-%d %H:%M:%S')                                           ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Service Status
    echo -e "${BLUE}🔧 Service Status:${NC}"
    echo "┌─────────────────┬────────┬──────────────┬─────────────────┐"
    echo "│ Service         │ Status │ Response Time│ Container Stats │"
    echo "├─────────────────┼────────┼──────────────┼─────────────────┤"
    
    local backend_status=$(check_service "Backend API" 3000 "/health")
    local backend_response=$(get_response_time "/health")
    local backend_stats=$(get_container_stats "medianest-backend" || echo "N/A N/A")
    printf "│ %-15s │ %-6s │ %-12s │ %-15s │\n" "Backend API" "$backend_status" "$backend_response" "$backend_stats"
    
    local db_status=$(check_database)
    local db_stats=$(get_container_stats "medianest-postgres" || echo "N/A N/A")
    printf "│ %-15s │ %-6s │ %-12s │ %-15s │\n" "PostgreSQL" "$db_status" "N/A" "$db_stats"
    
    local redis_status=$(check_redis)
    local redis_stats=$(get_container_stats "medianest-redis" || echo "N/A N/A")
    printf "│ %-15s │ %-6s │ %-12s │ %-15s │\n" "Redis Cache" "$redis_status" "N/A" "$redis_stats"
    
    echo "└─────────────────┴────────┴──────────────┴─────────────────┘"
    echo
    
    # System Metrics
    echo -e "${PURPLE}📊 System Metrics:${NC}"
    local sys_metrics=($(get_system_metrics))
    echo "┌─────────────┬─────────────┬─────────────┐"
    echo "│ CPU Usage   │ Memory      │ Disk Usage  │"
    echo "├─────────────┼─────────────┼─────────────┤"
    printf "│ %-11s │ %-11s │ %-11s │\n" "${sys_metrics[0]}" "${sys_metrics[1]}" "${sys_metrics[2]}"
    echo "└─────────────┴─────────────┴─────────────┘"
    echo
    
    # API Endpoints
    echo -e "${YELLOW}🌐 API Endpoints:${NC}"
    echo "Health Check: $(check_service "Health" 3000 "/health")"
    echo "API Health:   $(check_service "API" 3000 "/api/v1/health")"
    echo "Auth Session: $(check_service "Auth" 3000 "/api/v1/auth/session")"
    echo
    
    # Authentication Monitoring
    echo -e "${GREEN}🔐 Authentication Monitoring:${NC}"
    local auth_metrics=($(monitor_auth))
    echo "Auth Events: ${auth_metrics[0]} | Auth Errors: ${auth_metrics[1]}"
    echo
    
    # Recent Logs (last 5 lines)
    echo -e "${CYAN}📝 Recent Application Logs:${NC}"
    if docker logs backend-app --tail=5 2>/dev/null; then
        :
    else
        echo "Unable to fetch recent logs"
    fi
    echo
    
    # Performance Metrics
    echo -e "${PURPLE}⚡ Performance Metrics:${NC}"
    local health_response=$(get_response_time "/health")
    local api_health_response=$(get_response_time "/api/v1/health")
    echo "Health Endpoint: $health_response"
    echo "API Health:      $api_health_response"
    echo
    
    # Alert Thresholds
    echo -e "${RED}🚨 Alert Status:${NC}"
    local alerts=0
    
    # Check high response times
    if [[ "$health_response" =~ ^[0-9]+ms$ ]] && [[ "${health_response%ms}" -gt 5000 ]]; then
        echo -e "${RED}⚠️  High response time detected: $health_response${NC}"
        ((alerts++))
    fi
    
    # Check authentication errors
    if [[ "${auth_metrics[1]}" -gt 5 ]]; then
        echo -e "${RED}⚠️  High authentication error rate: ${auth_metrics[1]} errors${NC}"
        ((alerts++))
    fi
    
    if [[ $alerts -eq 0 ]]; then
        echo -e "${GREEN}✅ No active alerts${NC}"
    fi
    
    echo
    echo -e "${CYAN}Press Ctrl+C to exit | Refresh every ${HEALTH_CHECK_INTERVAL}s${NC}"
}

# Real-time log monitoring
monitor_logs() {
    echo -e "${BLUE}Starting real-time log monitoring...${NC}"
    log "INFO" "Started log monitoring"
    
    # Monitor multiple log sources
    {
        docker logs -f backend-app 2>&1 | sed 's/^/[BACKEND] /' &
        docker logs -f medianest-postgres 2>&1 | sed 's/^/[DATABASE] /' &
        docker logs -f medianest-redis 2>&1 | sed 's/^/[REDIS] /' &
    } | while IFS= read -r line; do
        echo "$(date '+%H:%M:%S') $line" | tee -a "$LOG_FILE"
        
        # Alert on critical patterns
        if echo "$line" | grep -qE "(ERROR|FATAL|CRITICAL)"; then
            log "ERROR" "Critical log entry detected: $line"
        fi
    done
}

# Performance baseline collection
collect_baseline() {
    log "INFO" "Collecting performance baseline"
    
    echo -e "${YELLOW}🔍 Collecting Performance Baseline...${NC}"
    
    local baseline_file="logs/baseline-$(date +%Y%m%d-%H%M%S).json"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -Iseconds)\","
        echo "  \"health_response_time\": \"$(get_response_time "/health")\","
        echo "  \"api_health_response_time\": \"$(get_response_time "/api/v1/health")\","
        echo "  \"system_metrics\": {"
        local sys_metrics=($(get_system_metrics))
        echo "    \"cpu_usage\": \"${sys_metrics[0]}\","
        echo "    \"memory_usage\": \"${sys_metrics[1]}\","
        echo "    \"disk_usage\": \"${sys_metrics[2]}\""
        echo "  },"
        echo "  \"container_stats\": {"
        echo "    \"backend\": \"$(get_container_stats "medianest-backend")\","
        echo "    \"database\": \"$(get_container_stats "medianest-postgres")\","
        echo "    \"redis\": \"$(get_container_stats "medianest-redis")\""
        echo "  },"
        echo "  \"service_health\": {"
        echo "    \"backend\": $(check_service "Backend" 3000 "/health" >/dev/null && echo "true" || echo "false"),"
        echo "    \"database\": $(check_database >/dev/null && echo "true" || echo "false"),"
        echo "    \"redis\": $(check_redis >/dev/null && echo "true" || echo "false")"
        echo "  }"
        echo "}"
    } > "$baseline_file"
    
    log "INFO" "Baseline saved to $baseline_file"
    echo -e "${GREEN}✅ Baseline collection complete${NC}"
}

# Load testing with curl
run_load_test() {
    echo -e "${YELLOW}🚀 Running Load Test...${NC}"
    log "INFO" "Starting load test"
    
    local concurrent_requests=10
    local total_requests=100
    local test_endpoint="/api/v1/health"
    
    echo "Testing endpoint: $API_BASE_URL$test_endpoint"
    echo "Concurrent requests: $concurrent_requests"
    echo "Total requests: $total_requests"
    
    # Create temporary directory for results
    local temp_dir=$(mktemp -d)
    local results_file="logs/load-test-$(date +%Y%m%d-%H%M%S).txt"
    
    # Run parallel requests
    for i in $(seq 1 $concurrent_requests); do
        {
            for j in $(seq 1 $((total_requests / concurrent_requests))); do
                local start_time=$(date +%s%3N)
                local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL$test_endpoint")
                local end_time=$(date +%s%3N)
                local response_time=$((end_time - start_time))
                echo "$http_code,$response_time" >> "$temp_dir/results_$i.csv"
            done
        } &
    done
    
    wait
    
    # Aggregate results
    {
        echo "Load Test Results - $(date)"
        echo "=================================="
        echo "Endpoint: $test_endpoint"
        echo "Total Requests: $total_requests"
        echo "Concurrent: $concurrent_requests"
        echo ""
        
        # Combine all results
        cat "$temp_dir"/results_*.csv > "$temp_dir/all_results.csv"
        
        # Calculate statistics
        local successful_requests=$(grep -c "^200," "$temp_dir/all_results.csv" || echo 0)
        local error_requests=$(grep -c "^[45][0-9][0-9]," "$temp_dir/all_results.csv" || echo 0)
        local avg_response_time=$(awk -F',' '{sum+=$2; count++} END {print (count>0) ? int(sum/count) : 0}' "$temp_dir/all_results.csv")
        
        echo "Successful Requests: $successful_requests"
        echo "Error Requests: $error_requests"
        echo "Success Rate: $(echo "scale=2; $successful_requests * 100 / $total_requests" | bc)%"
        echo "Average Response Time: ${avg_response_time}ms"
        
        # Response time percentiles
        sort -t',' -k2 -n "$temp_dir/all_results.csv" | awk -F',' '{print $2}' > "$temp_dir/response_times.txt"
        local p50=$(sed -n "$((total_requests * 50 / 100))p" "$temp_dir/response_times.txt")
        local p95=$(sed -n "$((total_requests * 95 / 100))p" "$temp_dir/response_times.txt")
        local p99=$(sed -n "$((total_requests * 99 / 100))p" "$temp_dir/response_times.txt")
        
        echo "P50 Response Time: ${p50}ms"
        echo "P95 Response Time: ${p95}ms"
        echo "P99 Response Time: ${p99}ms"
        
    } | tee "$results_file"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log "INFO" "Load test completed. Results saved to $results_file"
    echo -e "${GREEN}✅ Load test complete${NC}"
}

# Health check with alerting
health_check_with_alerts() {
    log "INFO" "Running health check with alerting"
    
    local critical_alerts=0
    local warning_alerts=0
    
    # Check backend health
    if ! check_service "Backend" 3000 "/health" >/dev/null; then
        log "CRITICAL" "Backend API health check failed"
        ((critical_alerts++))
    fi
    
    # Check database connection
    if ! check_database >/dev/null; then
        log "CRITICAL" "Database connection failed"
        ((critical_alerts++))
    fi
    
    # Check Redis connection
    if ! check_redis >/dev/null; then
        log "CRITICAL" "Redis connection failed"
        ((critical_alerts++))
    fi
    
    # Check response times
    local health_time=$(get_response_time "/health")
    if [[ "$health_time" =~ ^[0-9]+ms$ ]] && [[ "${health_time%ms}" -gt 5000 ]]; then
        log "WARNING" "High response time detected: $health_time"
        ((warning_alerts++))
    fi
    
    # Summary
    if [[ $critical_alerts -eq 0 && $warning_alerts -eq 0 ]]; then
        log "INFO" "All health checks passed"
        echo -e "${GREEN}✅ All health checks passed${NC}"
    else
        log "WARNING" "Health check summary: $critical_alerts critical, $warning_alerts warnings"
        echo -e "${RED}⚠️  Health check issues: $critical_alerts critical, $warning_alerts warnings${NC}"
    fi
}

# Main function
main() {
    local command=${1:-"dashboard"}
    
    case $command in
        "dashboard")
            log "INFO" "Starting monitoring dashboard"
            while true; do
                show_dashboard
                sleep $HEALTH_CHECK_INTERVAL
            done
            ;;
        "logs")
            monitor_logs
            ;;
        "baseline")
            collect_baseline
            ;;
        "load-test")
            run_load_test
            ;;
        "health-check")
            health_check_with_alerts
            ;;
        "help"|"-h"|"--help")
            echo "MediaNest Monitoring Dashboard"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  dashboard    Show real-time monitoring dashboard (default)"
            echo "  logs         Monitor application logs in real-time"
            echo "  baseline     Collect performance baseline metrics"
            echo "  load-test    Run load testing against API endpoints"
            echo "  health-check Run health checks with alerting"
            echo "  help         Show this help message"
            ;;
        *)
            echo "Unknown command: $command"
            echo "Use '$0 help' for available commands"
            exit 1
            ;;
    esac
}

# Cleanup on exit
trap 'echo -e "\n${CYAN}Monitoring stopped${NC}"; log "INFO" "Monitoring stopped"; exit 0' INT TERM

# Store monitoring status
npx claude-flow@alpha memory store "monitoring-status" "active" --namespace "observability"

# Run main function
main "$@"