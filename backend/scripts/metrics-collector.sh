#!/bin/bash

# MediaNest Metrics Collection and Analysis
# Collects detailed metrics for observability and alerting

set -euo pipefail

# Configuration
METRICS_DIR="logs/metrics"
RETENTION_DAYS=30
COLLECTION_INTERVAL=60
API_BASE_URL="http://localhost:3000"

# Create metrics directory
mkdir -p "$METRICS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    local level=$1
    local message=$2
    echo "[$(date -Iseconds)] [$level] $message" | tee -a "$METRICS_DIR/collector.log"
}

# Collect HTTP metrics
collect_http_metrics() {
    local timestamp=$(date -Iseconds)
    local metrics_file="$METRICS_DIR/http-$(date +%Y%m%d).jsonl"
    
    local endpoints=(
        "/health"
        "/api/v1/health" 
        "/api/v1/metrics"
        "/api/v1/auth/session"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local start_time=$(date +%s%3N)
        local response=$(curl -s -o /dev/null -w "%{http_code},%{time_total},%{time_namelookup},%{time_connect},%{time_starttransfer},%{size_download}" --max-time 10 "$API_BASE_URL$endpoint" || echo "000,0,0,0,0,0")
        local end_time=$(date +%s%3N)
        
        IFS=',' read -r http_code total_time dns_time connect_time ttfb size <<< "$response"
        local response_time=$((end_time - start_time))
        
        # Convert curl times to milliseconds
        total_time_ms=$(echo "$total_time * 1000" | bc | cut -d. -f1)
        dns_time_ms=$(echo "$dns_time * 1000" | bc | cut -d. -f1)
        connect_time_ms=$(echo "$connect_time * 1000" | bc | cut -d. -f1)
        ttfb_ms=$(echo "$ttfb * 1000" | bc | cut -d. -f1)
        
        cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"http_response","endpoint":"$endpoint","http_code":$http_code,"response_time_ms":$response_time,"total_time_ms":$total_time_ms,"dns_time_ms":$dns_time_ms,"connect_time_ms":$connect_time_ms,"ttfb_ms":$ttfb_ms,"size_bytes":$size}
EOF
    done
}

# Collect system metrics
collect_system_metrics() {
    local timestamp=$(date -Iseconds)
    local metrics_file="$METRICS_DIR/system-$(date +%Y%m%d).jsonl"
    
    # CPU metrics
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | sed 's/^ *//')
    
    # Memory metrics
    local mem_info=$(free -b | grep Mem)
    local mem_total=$(echo $mem_info | awk '{print $2}')
    local mem_used=$(echo $mem_info | awk '{print $3}')
    local mem_free=$(echo $mem_info | awk '{print $4}')
    local mem_usage_percent=$(echo "scale=2; $mem_used * 100 / $mem_total" | bc)
    
    # Disk metrics
    local disk_info=$(df / | tail -1)
    local disk_total=$(echo $disk_info | awk '{print $2}')
    local disk_used=$(echo $disk_info | awk '{print $3}')
    local disk_free=$(echo $disk_info | awk '{print $4}')
    local disk_usage_percent=$(echo $disk_info | awk '{print $5}' | sed 's/%//')
    
    # Network metrics (if available)
    local network_metrics=""
    if command -v ss >/dev/null 2>&1; then
        local tcp_connections=$(ss -t | wc -l)
        local tcp_listening=$(ss -tl | wc -l)
        network_metrics=",\"tcp_connections\":$tcp_connections,\"tcp_listening\":$tcp_listening"
    fi
    
    cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"system_metrics","cpu_usage_percent":$cpu_usage,"load_average":"$load_avg","memory_total_bytes":$mem_total,"memory_used_bytes":$mem_used,"memory_free_bytes":$mem_free,"memory_usage_percent":$mem_usage_percent,"disk_total_kb":$disk_total,"disk_used_kb":$disk_used,"disk_free_kb":$disk_free,"disk_usage_percent":$disk_usage_percent$network_metrics}
EOF
}

# Collect Docker metrics
collect_docker_metrics() {
    local timestamp=$(date -Iseconds)
    local metrics_file="$METRICS_DIR/docker-$(date +%Y%m%d).jsonl"
    
    local containers=("medianest-backend" "medianest-postgres" "medianest-redis")
    
    for container in "${containers[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "$container"; then
            # Get container stats
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}} {{.MemPerc}} {{.NetIO}} {{.BlockIO}}" "$container" 2>/dev/null || echo "0.00% 0B / 0B 0.00% 0B / 0B 0B / 0B")
            
            # Parse stats
            local cpu_percent=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
            local mem_usage=$(echo "$stats" | awk '{print $2}')
            local mem_limit=$(echo "$stats" | awk '{print $4}')
            local mem_percent=$(echo "$stats" | awk '{print $5}' | sed 's/%//')
            local net_input=$(echo "$stats" | awk '{print $6}')
            local net_output=$(echo "$stats" | awk '{print $8}')
            local block_input=$(echo "$stats" | awk '{print $9}')
            local block_output=$(echo "$stats" | awk '{print $11}')
            
            # Get container status
            local container_status=$(docker ps --format "{{.Status}}" --filter "name=$container" | head -1)
            local container_image=$(docker ps --format "{{.Image}}" --filter "name=$container" | head -1)
            
            cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"container_metrics","container":"$container","image":"$container_image","status":"$container_status","cpu_percent":$cpu_percent,"memory_usage":"$mem_usage","memory_limit":"$mem_limit","memory_percent":$mem_percent,"network_input":"$net_input","network_output":"$net_output","block_input":"$block_input","block_output":"$block_output"}
EOF
        else
            cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"container_metrics","container":"$container","status":"not_running"}
EOF
        fi
    done
}

# Collect application metrics
collect_application_metrics() {
    local timestamp=$(date -Iseconds)
    local metrics_file="$METRICS_DIR/application-$(date +%Y%m%d).jsonl"
    
    # Try to get metrics from application endpoint
    if curl -sf "$API_BASE_URL/api/v1/metrics" >/dev/null 2>&1; then
        local app_metrics=$(curl -s "$API_BASE_URL/api/v1/metrics" | jq -c ". + {\"timestamp\":\"$timestamp\",\"type\":\"application_metrics\"}")
        echo "$app_metrics" >> "$metrics_file"
    else
        # Fallback metrics from logs and system
        local log_errors=0
        local log_warnings=0
        
        # Count recent errors and warnings from Docker logs
        for container in medianest-backend medianest-postgres medianest-redis; do
            if docker ps --format "{{.Names}}" | grep -q "$container"; then
                local container_errors=$(docker logs --since "1 minute ago" "$container" 2>&1 | grep -c "ERROR" || echo 0)
                local container_warnings=$(docker logs --since "1 minute ago" "$container" 2>&1 | grep -c "WARNING\|WARN" || echo 0)
                log_errors=$((log_errors + container_errors))
                log_warnings=$((log_warnings + container_warnings))
            fi
        done
        
        # Process metrics
        local process_count=$(ps aux | wc -l)
        local node_processes=$(pgrep -c node || echo 0)
        
        cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"application_metrics","log_errors_1min":$log_errors,"log_warnings_1min":$log_warnings,"total_processes":$process_count,"node_processes":$node_processes}
EOF
    fi
}

# Collect database metrics
collect_database_metrics() {
    local timestamp=$(date -Iseconds)
    local metrics_file="$METRICS_DIR/database-$(date +%Y%m%d).jsonl"
    
    # Try to collect PostgreSQL metrics
    if docker exec medianest-postgres psql -U medianest -d medianest -t -c "SELECT 1;" >/dev/null 2>&1; then
        # Connection count
        local connections=$(docker exec medianest-postgres psql -U medianest -d medianest -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ' || echo 0)
        
        # Database size
        local db_size=$(docker exec medianest-postgres psql -U medianest -d medianest -t -c "SELECT pg_size_pretty(pg_database_size('medianest'));" 2>/dev/null | tr -d ' ' || echo "unknown")
        
        # Slow queries (queries running longer than 1 second)
        local slow_queries=$(docker exec medianest-postgres psql -U medianest -d medianest -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '1 second';" 2>/dev/null | tr -d ' ' || echo 0)
        
        # Transaction stats
        local transactions=$(docker exec medianest-postgres psql -U medianest -d medianest -t -c "SELECT sum(xact_commit + xact_rollback) FROM pg_stat_database WHERE datname = 'medianest';" 2>/dev/null | tr -d ' ' || echo 0)
        
        cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"database_metrics","status":"connected","active_connections":$connections,"database_size":"$db_size","slow_queries":$slow_queries,"total_transactions":$transactions}
EOF
    else
        cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"database_metrics","status":"disconnected"}
EOF
    fi
}

# Collect Redis metrics
collect_redis_metrics() {
    local timestamp=$(date -Iseconds)
    local metrics_file="$METRICS_DIR/redis-$(date +%Y%m%d).jsonl"
    
    if docker exec medianest-redis redis-cli ping >/dev/null 2>&1; then
        # Get Redis info
        local redis_info=$(docker exec medianest-redis redis-cli info memory 2>/dev/null || echo "")
        local redis_stats=$(docker exec medianest-redis redis-cli info stats 2>/dev/null || echo "")
        
        # Extract key metrics
        local used_memory=$(echo "$redis_info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r' || echo 0)
        local used_memory_peak=$(echo "$redis_info" | grep "used_memory_peak:" | cut -d: -f2 | tr -d '\r' || echo 0)
        local total_commands=$(echo "$redis_stats" | grep "total_commands_processed:" | cut -d: -f2 | tr -d '\r' || echo 0)
        local connected_clients=$(docker exec medianest-redis redis-cli info clients 2>/dev/null | grep "connected_clients:" | cut -d: -f2 | tr -d '\r' || echo 0)
        
        # Get key count
        local key_count=$(docker exec medianest-redis redis-cli dbsize 2>/dev/null || echo 0)
        
        cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"redis_metrics","status":"connected","used_memory_bytes":$used_memory,"used_memory_peak_bytes":$used_memory_peak,"total_commands":$total_commands,"connected_clients":$connected_clients,"key_count":$key_count}
EOF
    else
        cat >> "$metrics_file" << EOF
{"timestamp":"$timestamp","type":"redis_metrics","status":"disconnected"}
EOF
    fi
}

# Generate metrics report
generate_metrics_report() {
    local report_date=${1:-$(date +%Y%m%d)}
    local report_file="$METRICS_DIR/report-$report_date.json"
    
    echo -e "${BLUE}Generating metrics report for $report_date...${NC}"
    
    # Collect all metrics files for the date
    local http_file="$METRICS_DIR/http-$report_date.jsonl"
    local system_file="$METRICS_DIR/system-$report_date.jsonl"
    local docker_file="$METRICS_DIR/docker-$report_date.jsonl"
    local application_file="$METRICS_DIR/application-$report_date.jsonl"
    local database_file="$METRICS_DIR/database-$report_date.jsonl"
    local redis_file="$METRICS_DIR/redis-$report_date.jsonl"
    
    # Initialize report
    cat > "$report_file" << EOF
{
  "date": "$report_date",
  "generated_at": "$(date -Iseconds)",
  "summary": {
EOF
    
    # HTTP metrics summary
    if [[ -f "$http_file" ]]; then
        local total_requests=$(wc -l < "$http_file" || echo 0)
        local error_requests=$(grep -c '"http_code":[45][0-9][0-9]' "$http_file" || echo 0)
        local success_rate=$(echo "scale=2; ($total_requests - $error_requests) * 100 / $total_requests" | bc 2>/dev/null || echo 0)
        local avg_response_time=$(jq -s 'map(.response_time_ms) | add / length' "$http_file" 2>/dev/null || echo 0)
        
        cat >> "$report_file" << EOF
    "http": {
      "total_requests": $total_requests,
      "error_requests": $error_requests,
      "success_rate_percent": $success_rate,
      "avg_response_time_ms": $avg_response_time
    },
EOF
    fi
    
    # System metrics summary
    if [[ -f "$system_file" ]]; then
        local avg_cpu=$(jq -s 'map(.cpu_usage_percent) | add / length' "$system_file" 2>/dev/null || echo 0)
        local max_cpu=$(jq -s 'map(.cpu_usage_percent) | max' "$system_file" 2>/dev/null || echo 0)
        local avg_memory=$(jq -s 'map(.memory_usage_percent) | add / length' "$system_file" 2>/dev/null || echo 0)
        local max_memory=$(jq -s 'map(.memory_usage_percent) | max' "$system_file" 2>/dev/null || echo 0)
        
        cat >> "$report_file" << EOF
    "system": {
      "avg_cpu_usage_percent": $avg_cpu,
      "max_cpu_usage_percent": $max_cpu,
      "avg_memory_usage_percent": $avg_memory,
      "max_memory_usage_percent": $max_memory
    },
EOF
    fi
    
    # Application metrics summary
    if [[ -f "$application_file" ]]; then
        local total_errors=$(jq -s 'map(.log_errors_1min // 0) | add' "$application_file" 2>/dev/null || echo 0)
        local total_warnings=$(jq -s 'map(.log_warnings_1min // 0) | add' "$application_file" 2>/dev/null || echo 0)
        
        cat >> "$report_file" << EOF
    "application": {
      "total_errors": $total_errors,
      "total_warnings": $total_warnings
    }
EOF
    fi
    
    # Close summary and add raw data references
    cat >> "$report_file" << EOF
  },
  "data_files": {
    "http_metrics": "$http_file",
    "system_metrics": "$system_file",
    "docker_metrics": "$docker_file",
    "application_metrics": "$application_file",
    "database_metrics": "$database_file",
    "redis_metrics": "$redis_file"
  }
}
EOF
    
    echo -e "${GREEN}✓ Report generated: $report_file${NC}"
    
    # Display summary
    echo -e "${YELLOW}📊 Daily Summary for $report_date:${NC}"
    jq -r '
      "HTTP Requests: \(.summary.http.total_requests // "N/A")",
      "Success Rate: \(.summary.http.success_rate_percent // "N/A")%",
      "Avg Response Time: \(.summary.http.avg_response_time_ms // "N/A")ms",
      "Max CPU Usage: \(.summary.system.max_cpu_usage_percent // "N/A")%",
      "Max Memory Usage: \(.summary.system.max_memory_usage_percent // "N/A")%",
      "Total Errors: \(.summary.application.total_errors // "N/A")",
      "Total Warnings: \(.summary.application.total_warnings // "N/A")"
    ' "$report_file"
}

# Clean old metrics
cleanup_old_metrics() {
    local retention_days=${1:-$RETENTION_DAYS}
    
    echo -e "${YELLOW}Cleaning up metrics older than $retention_days days...${NC}"
    
    find "$METRICS_DIR" -name "*.jsonl" -type f -mtime +$retention_days -exec rm {} \; 2>/dev/null || true
    find "$METRICS_DIR" -name "report-*.json" -type f -mtime +$retention_days -exec rm {} \; 2>/dev/null || true
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Single collection cycle
collect_all_metrics() {
    log "INFO" "Starting metrics collection cycle"
    
    collect_http_metrics
    collect_system_metrics
    collect_docker_metrics
    collect_application_metrics
    collect_database_metrics
    collect_redis_metrics
    
    log "INFO" "Metrics collection cycle completed"
    
    # Store status in memory
    npx claude-flow@alpha memory store "metrics-last-collected" "$(date -Iseconds)" --namespace "observability"
}

# Continuous collection
continuous_collection() {
    local interval=${1:-$COLLECTION_INTERVAL}
    
    log "INFO" "Starting continuous metrics collection (interval: ${interval}s)"
    
    # Trap cleanup
    trap 'log "INFO" "Metrics collection stopped"; exit 0' INT TERM
    
    while true; do
        collect_all_metrics
        
        # Generate daily report if it's a new day
        local current_date=$(date +%Y%m%d)
        local last_report_date=$(cat "$METRICS_DIR/.last_report_date" 2>/dev/null || echo "")
        
        if [[ "$current_date" != "$last_report_date" && -n "$last_report_date" ]]; then
            generate_metrics_report "$last_report_date"
            cleanup_old_metrics
        fi
        
        echo "$current_date" > "$METRICS_DIR/.last_report_date"
        
        sleep "$interval"
    done
}

# Alert analysis
analyze_alerts() {
    local date=${1:-$(date +%Y%m%d)}
    
    echo -e "${RED}🚨 Alert Analysis for $date:${NC}"
    
    local alert_count=0
    
    # Check HTTP metrics for issues
    local http_file="$METRICS_DIR/http-$date.jsonl"
    if [[ -f "$http_file" ]]; then
        local error_rate=$(jq -s 'map(select(.http_code >= 400)) | length' "$http_file" 2>/dev/null || echo 0)
        local high_latency=$(jq -s 'map(select(.response_time_ms > 5000)) | length' "$http_file" 2>/dev/null || echo 0)
        
        if [[ $error_rate -gt 5 ]]; then
            echo -e "${RED}⚠️  High error rate: $error_rate failed requests${NC}"
            ((alert_count++))
        fi
        
        if [[ $high_latency -gt 5 ]]; then
            echo -e "${RED}⚠️  High latency detected: $high_latency slow requests${NC}"
            ((alert_count++))
        fi
    fi
    
    # Check system metrics for issues
    local system_file="$METRICS_DIR/system-$date.jsonl"
    if [[ -f "$system_file" ]]; then
        local high_cpu_count=$(jq -s 'map(select(.cpu_usage_percent > 80)) | length' "$system_file" 2>/dev/null || echo 0)
        local high_memory_count=$(jq -s 'map(select(.memory_usage_percent > 80)) | length' "$system_file" 2>/dev/null || echo 0)
        local high_disk_count=$(jq -s 'map(select(.disk_usage_percent > 85)) | length' "$system_file" 2>/dev/null || echo 0)
        
        if [[ $high_cpu_count -gt 0 ]]; then
            echo -e "${RED}⚠️  High CPU usage detected: $high_cpu_count occurrences${NC}"
            ((alert_count++))
        fi
        
        if [[ $high_memory_count -gt 0 ]]; then
            echo -e "${RED}⚠️  High memory usage detected: $high_memory_count occurrences${NC}"
            ((alert_count++))
        fi
        
        if [[ $high_disk_count -gt 0 ]]; then
            echo -e "${RED}⚠️  High disk usage detected: $high_disk_count occurrences${NC}"
            ((alert_count++))
        fi
    fi
    
    # Check application metrics for issues
    local app_file="$METRICS_DIR/application-$date.jsonl"
    if [[ -f "$app_file" ]]; then
        local total_errors=$(jq -s 'map(.log_errors_1min // 0) | add' "$app_file" 2>/dev/null || echo 0)
        
        if [[ $total_errors -gt 50 ]]; then
            echo -e "${RED}⚠️  High error rate in logs: $total_errors errors${NC}"
            ((alert_count++))
        fi
    fi
    
    if [[ $alert_count -eq 0 ]]; then
        echo -e "${GREEN}✅ No alerts detected${NC}"
    else
        echo -e "${RED}Total alerts: $alert_count${NC}"
    fi
    
    # Store alert status
    npx claude-flow@alpha memory store "alert-count-$date" "$alert_count" --namespace "observability"
}

# Main function
main() {
    case "${1:-collect}" in
        "collect")
            collect_all_metrics
            ;;
        "continuous")
            continuous_collection "${2:-60}"
            ;;
        "report")
            generate_metrics_report "${2:-$(date +%Y%m%d)}"
            ;;
        "alerts")
            analyze_alerts "${2:-$(date +%Y%m%d)}"
            ;;
        "cleanup")
            cleanup_old_metrics "${2:-30}"
            ;;
        *)
            echo "Usage: $0 [collect|continuous|report|alerts|cleanup] [options]"
            echo ""
            echo "  collect           Collect metrics once"
            echo "  continuous [int]  Continuous collection (default: 60s)"
            echo "  report [date]     Generate daily report"
            echo "  alerts [date]     Analyze alerts for date"
            echo "  cleanup [days]    Clean old metrics (default: 30 days)"
            exit 1
            ;;
    esac
}

main "$@"