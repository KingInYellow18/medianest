#!/bin/bash

# MediaNest Deployment Health Monitoring
# Comprehensive health checks for staging deployment

set -euo pipefail

# Configuration
HEALTH_ENDPOINTS=(
    "http://localhost:3000/health"
    "http://localhost:3000/api/v1/health"
    "http://localhost:3000/api/v1/metrics"
)

DATABASE_URL=${DATABASE_URL:-"postgresql://medianest:medianest@localhost:5432/medianest"}
REDIS_URL=${REDIS_URL:-"redis://localhost:6379"}

# Alert thresholds
MAX_RESPONSE_TIME=5000  # milliseconds
MIN_SUCCESS_RATE=95     # percentage
MAX_ERROR_RATE=5        # percentage
MAX_CPU_USAGE=80        # percentage
MAX_MEMORY_USAGE=80     # percentage

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
LOG_FILE="logs/health-$(date +%Y%m%d).log"
mkdir -p logs

log() {
    local level=$1
    local message=$2
    local timestamp=$(date -Iseconds)
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Health check functions
check_http_endpoint() {
    local url=$1
    local timeout=${2:-10}
    
    local start_time=$(date +%s%3N)
    local response=$(curl -s -o /dev/null -w "%{http_code},%{time_total}" --max-time "$timeout" "$url" || echo "000,0")
    local end_time=$(date +%s%3N)
    
    local http_code=$(echo "$response" | cut -d',' -f1)
    local response_time=$((end_time - start_time))
    
    echo "$http_code,$response_time"
}

check_database_connection() {
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "200,connected"
        else
            echo "503,disconnected"
        fi
    else
        # Fallback using Docker if psql is not available
        if docker exec -it medianest-postgres psql -U medianest -d medianest -c "SELECT 1;" >/dev/null 2>&1; then
            echo "200,connected"
        else
            echo "503,disconnected"
        fi
    fi
}

check_redis_connection() {
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -u "$REDIS_URL" ping | grep -q "PONG"; then
            echo "200,connected"
        else
            echo "503,disconnected"
        fi
    else
        # Fallback using Docker if redis-cli is not available
        if docker exec -it medianest-redis redis-cli ping | grep -q "PONG"; then
            echo "200,connected"
        else
            echo "503,disconnected"
        fi
    fi
}

get_container_metrics() {
    local container_name=$1
    
    if docker ps --format "{{.Names}}" | grep -q "$container_name"; then
        local stats=$(docker stats --no-stream --format "{{.CPUPerc}} {{.MemPerc}}" "$container_name" 2>/dev/null || echo "0.00% 0.00%")
        local cpu=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
        local mem=$(echo "$stats" | awk '{print $2}' | sed 's/%//')
        echo "$cpu,$mem"
    else
        echo "0,0"
    fi
}

get_system_metrics() {
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    
    # Memory usage
    local mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    
    # Disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    echo "$cpu_usage,$mem_usage,$disk_usage"
}

check_log_errors() {
    local log_source=$1
    local time_window=${2:-"5 minutes ago"}
    
    # Count recent errors
    local error_count=0
    
    if [[ "$log_source" == "docker" ]]; then
        # Check Docker container logs
        for container in medianest-backend medianest-postgres medianest-redis; do
            if docker ps --format "{{.Names}}" | grep -q "$container"; then
                local container_errors=$(docker logs --since "$time_window" "$container" 2>&1 | grep -cE "(ERROR|FATAL|CRITICAL)" || echo 0)
                error_count=$((error_count + container_errors))
            fi
        done
    else
        # Check application logs
        if [[ -f "$log_source" ]]; then
            error_count=$(tail -n 1000 "$log_source" | grep -cE "(ERROR|FATAL|CRITICAL)" || echo 0)
        fi
    fi
    
    echo "$error_count"
}

# Comprehensive health check
run_comprehensive_health_check() {
    local overall_status="healthy"
    local critical_issues=0
    local warnings=0
    
    log "INFO" "Starting comprehensive health check"
    
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                        MediaNest Health Check Report                        ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # 1. HTTP Endpoint Checks
    echo -e "${YELLOW}🌐 HTTP Endpoint Health:${NC}"
    echo "┌─────────────────────────────────────────────┬────────┬──────────────┐"
    echo "│ Endpoint                                    │ Status │ Response Time│"
    echo "├─────────────────────────────────────────────┼────────┼──────────────┤"
    
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        local result=$(check_http_endpoint "$endpoint")
        local http_code=$(echo "$result" | cut -d',' -f1)
        local response_time=$(echo "$result" | cut -d',' -f2)
        
        local status_color="$GREEN"
        local status_text="✓ OK"
        
        if [[ "$http_code" != "200" ]]; then
            status_color="$RED"
            status_text="✗ FAIL"
            ((critical_issues++))
            log "CRITICAL" "HTTP endpoint failed: $endpoint (HTTP $http_code)"
        elif [[ "$response_time" -gt "$MAX_RESPONSE_TIME" ]]; then
            status_color="$YELLOW"
            status_text="⚠ SLOW"
            ((warnings++))
            log "WARNING" "Slow response time: $endpoint (${response_time}ms)"
        fi
        
        printf "│ %-43s │ ${status_color}%-6s${NC} │ %-12s │\n" "$endpoint" "$status_text" "${response_time}ms"
    done
    
    echo "└─────────────────────────────────────────────┴────────┴──────────────┘"
    echo
    
    # 2. Database Health
    echo -e "${YELLOW}🗄️  Database Health:${NC}"
    local db_result=$(check_database_connection)
    local db_status=$(echo "$db_result" | cut -d',' -f1)
    local db_state=$(echo "$db_result" | cut -d',' -f2)
    
    if [[ "$db_status" == "200" ]]; then
        echo -e "${GREEN}✓ PostgreSQL: Connected${NC}"
    else
        echo -e "${RED}✗ PostgreSQL: Disconnected${NC}"
        ((critical_issues++))
        log "CRITICAL" "Database connection failed"
    fi
    
    # 3. Redis Health
    echo -e "${YELLOW}📱 Cache Health:${NC}"
    local redis_result=$(check_redis_connection)
    local redis_status=$(echo "$redis_result" | cut -d',' -f1)
    local redis_state=$(echo "$redis_result" | cut -d',' -f2)
    
    if [[ "$redis_status" == "200" ]]; then
        echo -e "${GREEN}✓ Redis: Connected${NC}"
    else
        echo -e "${RED}✗ Redis: Disconnected${NC}"
        ((critical_issues++))
        log "CRITICAL" "Redis connection failed"
    fi
    echo
    
    # 4. Container Metrics
    echo -e "${YELLOW}🐳 Container Metrics:${NC}"
    echo "┌─────────────────────┬─────────────┬─────────────┐"
    echo "│ Container           │ CPU Usage   │ Memory      │"
    echo "├─────────────────────┼─────────────┼─────────────┤"
    
    local containers=("medianest-backend" "medianest-postgres" "medianest-redis")
    for container in "${containers[@]}"; do
        local metrics=$(get_container_metrics "$container")
        local cpu=$(echo "$metrics" | cut -d',' -f1)
        local mem=$(echo "$metrics" | cut -d',' -f2)
        
        local cpu_color="$GREEN"
        local mem_color="$GREEN"
        
        if (( $(echo "$cpu > $MAX_CPU_USAGE" | bc -l) )); then
            cpu_color="$RED"
            ((warnings++))
            log "WARNING" "High CPU usage in $container: $cpu%"
        fi
        
        if (( $(echo "$mem > $MAX_MEMORY_USAGE" | bc -l) )); then
            mem_color="$RED"
            ((warnings++))
            log "WARNING" "High memory usage in $container: $mem%"
        fi
        
        printf "│ %-19s │ ${cpu_color}%10s%%${NC} │ ${mem_color}%10s%%${NC} │\n" "$container" "$cpu" "$mem"
    done
    
    echo "└─────────────────────┴─────────────┴─────────────┘"
    echo
    
    # 5. System Resources
    echo -e "${YELLOW}💻 System Resources:${NC}"
    local sys_metrics=$(get_system_metrics)
    local sys_cpu=$(echo "$sys_metrics" | cut -d',' -f1)
    local sys_mem=$(echo "$sys_metrics" | cut -d',' -f2)
    local sys_disk=$(echo "$sys_metrics" | cut -d',' -f3)
    
    echo "┌─────────────┬─────────────┬─────────────┐"
    echo "│ CPU Usage   │ Memory      │ Disk Usage  │"
    echo "├─────────────┼─────────────┼─────────────┤"
    
    local cpu_color="$GREEN"
    local mem_color="$GREEN"
    local disk_color="$GREEN"
    
    if (( $(echo "$sys_cpu > $MAX_CPU_USAGE" | bc -l) )); then
        cpu_color="$YELLOW"
        ((warnings++))
    fi
    if (( $(echo "$sys_mem > $MAX_MEMORY_USAGE" | bc -l) )); then
        mem_color="$YELLOW"
        ((warnings++))
    fi
    if (( $(echo "$sys_disk > 85" | bc -l) )); then
        disk_color="$YELLOW"
        ((warnings++))
    fi
    
    printf "│ ${cpu_color}%10s%%${NC} │ ${mem_color}%10s%%${NC} │ ${disk_color}%10s%%${NC} │\n" "$sys_cpu" "$sys_mem" "$sys_disk"
    echo "└─────────────┴─────────────┴─────────────┘"
    echo
    
    # 6. Error Analysis
    echo -e "${YELLOW}🚨 Error Analysis (Last 5 minutes):${NC}"
    local docker_errors=$(check_log_errors "docker" "5 minutes ago")
    local app_errors=$(check_log_errors "logs/application.log" "5 minutes ago")
    
    echo "Docker Container Errors: $docker_errors"
    echo "Application Log Errors: $app_errors"
    
    local total_errors=$((docker_errors + app_errors))
    if [[ $total_errors -gt $MAX_ERROR_RATE ]]; then
        echo -e "${RED}⚠️  High error rate detected: $total_errors errors${NC}"
        ((warnings++))
        log "WARNING" "High error rate: $total_errors errors in last 5 minutes"
    fi
    echo
    
    # 7. Overall Status
    echo -e "${BLUE}📊 Health Check Summary:${NC}"
    echo "┌─────────────────────┬─────────────────────────────────────┐"
    echo "│ Metric              │ Value                               │"
    echo "├─────────────────────┼─────────────────────────────────────┤"
    printf "│ %-19s │ %-35s │\n" "Critical Issues" "$critical_issues"
    printf "│ %-19s │ %-35s │\n" "Warnings" "$warnings"
    printf "│ %-19s │ %-35s │\n" "Total Errors (5m)" "$total_errors"
    
    # Determine overall status
    if [[ $critical_issues -gt 0 ]]; then
        overall_status="critical"
        printf "│ %-19s │ ${RED}%-35s${NC} │\n" "Overall Status" "CRITICAL"
    elif [[ $warnings -gt 5 ]]; then
        overall_status="degraded"
        printf "│ %-19s │ ${YELLOW}%-35s${NC} │\n" "Overall Status" "DEGRADED"
    elif [[ $warnings -gt 0 ]]; then
        overall_status="healthy-warnings"
        printf "│ %-19s │ ${YELLOW}%-35s${NC} │\n" "Overall Status" "HEALTHY (with warnings)"
    else
        overall_status="healthy"
        printf "│ %-19s │ ${GREEN}%-35s${NC} │\n" "Overall Status" "HEALTHY"
    fi
    
    printf "│ %-19s │ %-35s │\n" "Check Timestamp" "$(date -Iseconds)"
    echo "└─────────────────────┴─────────────────────────────────────┘"
    
    # Store results
    npx claude-flow@alpha memory store "health-check-status" "$overall_status" --namespace "observability"
    npx claude-flow@alpha memory store "health-check-timestamp" "$(date -Iseconds)" --namespace "observability"
    
    log "INFO" "Health check completed - Status: $overall_status (Critical: $critical_issues, Warnings: $warnings)"
    
    # Exit with appropriate code
    case $overall_status in
        "critical")
            exit 2
            ;;
        "degraded")
            exit 1
            ;;
        *)
            exit 0
            ;;
    esac
}

# Quick health check
quick_health_check() {
    echo -e "${BLUE}Quick Health Check${NC}"
    
    local issues=0
    
    # Check main endpoint
    local main_health=$(check_http_endpoint "http://localhost:3000/health")
    local main_status=$(echo "$main_health" | cut -d',' -f1)
    
    if [[ "$main_status" == "200" ]]; then
        echo -e "${GREEN}✓ Application: Healthy${NC}"
    else
        echo -e "${RED}✗ Application: Unhealthy${NC}"
        ((issues++))
    fi
    
    # Check database
    local db_health=$(check_database_connection)
    local db_status=$(echo "$db_health" | cut -d',' -f1)
    
    if [[ "$db_status" == "200" ]]; then
        echo -e "${GREEN}✓ Database: Connected${NC}"
    else
        echo -e "${RED}✗ Database: Disconnected${NC}"
        ((issues++))
    fi
    
    # Check Redis
    local redis_health=$(check_redis_connection)
    local redis_status=$(echo "$redis_health" | cut -d',' -f1)
    
    if [[ "$redis_status" == "200" ]]; then
        echo -e "${GREEN}✓ Cache: Connected${NC}"
    else
        echo -e "${RED}✗ Cache: Disconnected${NC}"
        ((issues++))
    fi
    
    if [[ $issues -eq 0 ]]; then
        echo -e "${GREEN}Overall: All systems healthy${NC}"
        exit 0
    else
        echo -e "${RED}Overall: $issues issue(s) detected${NC}"
        exit 1
    fi
}

# Continuous monitoring
continuous_monitoring() {
    local interval=${1:-60}
    
    log "INFO" "Starting continuous monitoring (interval: ${interval}s)"
    
    while true; do
        echo -e "${CYAN}[$(date)] Running health check...${NC}"
        
        if quick_health_check >/dev/null 2>&1; then
            echo -e "${GREEN}✓ All systems healthy${NC}"
        else
            echo -e "${RED}⚠️  Issues detected - running full health check${NC}"
            run_comprehensive_health_check
        fi
        
        sleep "$interval"
    done
}

# Main function
main() {
    case "${1:-comprehensive}" in
        "comprehensive"|"full")
            run_comprehensive_health_check
            ;;
        "quick")
            quick_health_check
            ;;
        "continuous")
            continuous_monitoring "${2:-60}"
            ;;
        *)
            echo "Usage: $0 [comprehensive|quick|continuous [interval]]"
            echo ""
            echo "  comprehensive  Run full health check (default)"
            echo "  quick         Run quick health check"
            echo "  continuous    Run continuous monitoring"
            exit 1
            ;;
    esac
}

main "$@"