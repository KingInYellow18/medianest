#!/bin/bash
set -euo pipefail

# MediaNest Comprehensive Health Monitoring System
# Advanced health checks with auto-recovery capabilities

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
HEALTH_LOG="/var/log/medianest-health.log"
HEALTH_STATE_FILE="/tmp/medianest-health-state.json"
PROMETHEUS_URL="http://localhost:9090"
ALERT_WEBHOOK=""
EMAIL_ALERTS=""

# Service definitions with health check configurations
declare -A SERVICES=(
    ["postgres"]="5432:database:critical"
    ["redis-master"]="6379:cache:high"
    ["medianest-app-1"]="3000:application:critical"
    ["medianest-app-2"]="3000:application:critical"
    ["traefik"]="8080:loadbalancer:critical"
    ["prometheus"]="9090:monitoring:medium"
    ["grafana"]="3001:monitoring:low"
    ["cadvisor"]="8081:monitoring:low"
    ["node-exporter"]="9100:monitoring:low"
)

# Health check thresholds
declare -A THRESHOLDS=(
    ["cpu_warning"]=75
    ["cpu_critical"]=90
    ["memory_warning"]=80
    ["memory_critical"]=95
    ["disk_warning"]=85
    ["disk_critical"]=95
    ["response_time_warning"]=2000
    ["response_time_critical"]=5000
)

# Logging functions
log() { 
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$HEALTH_LOG"
}
warn() { 
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$HEALTH_LOG"
}
error() { 
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$HEALTH_LOG"
}
info() { 
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$HEALTH_LOG"
}

# Initialize health monitoring
initialize_health_monitor() {
    log "🏥 Initializing MediaNest Health Monitor"
    
    # Create health state file
    cat > "$HEALTH_STATE_FILE" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "overall_status": "unknown",
    "services": {},
    "system": {},
    "alerts": [],
    "recovery_actions": []
}
EOF
    
    # Ensure log file exists
    sudo touch "$HEALTH_LOG"
    sudo chown $USER:$USER "$HEALTH_LOG"
    
    log "✅ Health monitor initialized"
}

# Check individual service health
check_service_health() {
    local service_name=$1
    local service_config=${SERVICES[$service_name]}
    local port=$(echo "$service_config" | cut -d: -f1)
    local type=$(echo "$service_config" | cut -d: -f2)
    local priority=$(echo "$service_config" | cut -d: -f3)
    
    local status="healthy"
    local response_time=0
    local error_message=""
    
    info "🔍 Checking $service_name ($type, priority: $priority)"
    
    # Port connectivity check
    if ! timeout 5 bash -c "</dev/tcp/localhost/$port"; then
        status="unhealthy"
        error_message="Port $port not accessible"
        error "$service_name: $error_message"
    else
        # Measure response time for HTTP services
        case "$type" in
            "application"|"monitoring"|"loadbalancer")
                local start_time=$(date +%s%N)
                
                case "$service_name" in
                    "medianest-app"*)
                        if ! curl -s -f "http://localhost:$port/api/health" >/dev/null; then
                            status="degraded"
                            error_message="Health endpoint not responding"
                        fi
                        ;;
                    "prometheus")
                        if ! curl -s -f "http://localhost:$port/-/healthy" >/dev/null; then
                            status="degraded"
                            error_message="Prometheus not healthy"
                        fi
                        ;;
                    "grafana")
                        if ! curl -s -f "http://localhost:$port/api/health" >/dev/null; then
                            status="degraded"
                            error_message="Grafana API not responding"
                        fi
                        ;;
                    "traefik")
                        if ! curl -s -f "http://localhost:$port/ping" >/dev/null; then
                            status="degraded"
                            error_message="Traefik not responding"
                        fi
                        ;;
                esac
                
                local end_time=$(date +%s%N)
                response_time=$(( (end_time - start_time) / 1000000 ))
                
                # Check response time thresholds
                if [[ $response_time -gt ${THRESHOLDS["response_time_critical"]} ]]; then
                    status="critical"
                    error_message="Response time critical: ${response_time}ms"
                elif [[ $response_time -gt ${THRESHOLDS["response_time_warning"]} ]]; then
                    if [[ "$status" == "healthy" ]]; then
                        status="warning"
                        error_message="Response time high: ${response_time}ms"
                    fi
                fi
                ;;
                
            "database")
                # Database-specific checks
                if [[ "$service_name" == "postgres" ]]; then
                    if ! pg_isready -h localhost -p "$port" -U medianest >/dev/null 2>&1; then
                        status="unhealthy"
                        error_message="PostgreSQL not ready"
                    fi
                fi
                ;;
                
            "cache")
                # Cache-specific checks
                if [[ "$service_name" == "redis-master" ]]; then
                    if ! timeout 3 redis-cli -h localhost -p "$port" ping >/dev/null 2>&1; then
                        status="unhealthy"
                        error_message="Redis not responding to ping"
                    fi
                fi
                ;;
        esac
    fi
    
    # Update health state
    update_service_state "$service_name" "$status" "$response_time" "$error_message" "$priority"
    
    case "$status" in
        "healthy")
            log "✅ $service_name: Healthy (${response_time}ms)"
            ;;
        "warning")
            warn "$service_name: $error_message"
            ;;
        "degraded")
            warn "$service_name: Degraded - $error_message"
            ;;
        "unhealthy"|"critical")
            error "$service_name: $error_message"
            trigger_recovery_action "$service_name" "$priority" "$error_message"
            ;;
    esac
    
    echo "$status"
}

# Update service state in JSON file
update_service_state() {
    local service=$1
    local status=$2
    local response_time=$3
    local error_message=$4
    local priority=$5
    
    # Create temporary file with updated state
    jq --arg service "$service" \
       --arg status "$status" \
       --arg response_time "$response_time" \
       --arg error "$error_message" \
       --arg priority "$priority" \
       --arg timestamp "$(date -Iseconds)" \
       '.services[$service] = {
           "status": $status,
           "response_time": $response_time,
           "error_message": $error,
           "priority": $priority,
           "last_check": $timestamp
       }' "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
    mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
}

# Check system health
check_system_health() {
    log "💻 Checking system health"
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    cpu_usage=${cpu_usage%.*}  # Remove decimal part
    
    # Memory usage
    local memory_info=$(free | grep Mem)
    local total_memory=$(echo "$memory_info" | awk '{print $2}')
    local used_memory=$(echo "$memory_info" | awk '{print $3}')
    local memory_usage=$(( (used_memory * 100) / total_memory ))
    
    # Disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    
    # Docker daemon health
    local docker_status="healthy"
    if ! docker info >/dev/null 2>&1; then
        docker_status="unhealthy"
        error "Docker daemon is not responding"
    fi
    
    # Update system state
    jq --arg cpu "$cpu_usage" \
       --arg memory "$memory_usage" \
       --arg disk "$disk_usage" \
       --arg load "$load_avg" \
       --arg docker "$docker_status" \
       --arg timestamp "$(date -Iseconds)" \
       '.system = {
           "cpu_usage": $cpu,
           "memory_usage": $memory,
           "disk_usage": $disk,
           "load_average": $load,
           "docker_status": $docker,
           "last_check": $timestamp
       }' "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
    mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
    
    # Check thresholds and create alerts
    check_system_thresholds "$cpu_usage" "$memory_usage" "$disk_usage"
    
    info "System: CPU ${cpu_usage}%, Memory ${memory_usage}%, Disk ${disk_usage}%"
}

# Check system resource thresholds
check_system_thresholds() {
    local cpu_usage=$1
    local memory_usage=$2
    local disk_usage=$3
    
    # CPU threshold checks
    if [[ $cpu_usage -gt ${THRESHOLDS["cpu_critical"]} ]]; then
        create_alert "system_cpu_critical" "CPU usage critical: ${cpu_usage}%" "critical"
    elif [[ $cpu_usage -gt ${THRESHOLDS["cpu_warning"]} ]]; then
        create_alert "system_cpu_warning" "CPU usage high: ${cpu_usage}%" "warning"
    fi
    
    # Memory threshold checks
    if [[ $memory_usage -gt ${THRESHOLDS["memory_critical"]} ]]; then
        create_alert "system_memory_critical" "Memory usage critical: ${memory_usage}%" "critical"
    elif [[ $memory_usage -gt ${THRESHOLDS["memory_warning"]} ]]; then
        create_alert "system_memory_warning" "Memory usage high: ${memory_usage}%" "warning"
    fi
    
    # Disk threshold checks
    if [[ $disk_usage -gt ${THRESHOLDS["disk_critical"]} ]]; then
        create_alert "system_disk_critical" "Disk usage critical: ${disk_usage}%" "critical"
    elif [[ $disk_usage -gt ${THRESHOLDS["disk_warning"]} ]]; then
        create_alert "system_disk_warning" "Disk usage high: ${disk_usage}%" "warning"
    fi
}

# Create alert
create_alert() {
    local alert_id=$1
    local message=$2
    local severity=$3
    
    # Add alert to state file
    jq --arg id "$alert_id" \
       --arg message "$message" \
       --arg severity "$severity" \
       --arg timestamp "$(date -Iseconds)" \
       '.alerts += [{
           "id": $id,
           "message": $message,
           "severity": $severity,
           "timestamp": $timestamp,
           "resolved": false
       }]' "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
    mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
    
    # Send notifications
    send_alert_notification "$alert_id" "$message" "$severity"
}

# Send alert notifications
send_alert_notification() {
    local alert_id=$1
    local message=$2
    local severity=$3
    
    case "$severity" in
        "critical")
            error "🚨 CRITICAL ALERT: $message"
            ;;
        "warning")
            warn "⚠️  WARNING ALERT: $message"
            ;;
        *)
            info "ℹ️  INFO ALERT: $message"
            ;;
    esac
    
    # Send webhook notification if configured
    if [[ -n "$ALERT_WEBHOOK" ]]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"alert_id\":\"$alert_id\",\"message\":\"$message\",\"severity\":\"$severity\",\"timestamp\":\"$(date -Iseconds)\"}" \
            >/dev/null 2>&1 || true
    fi
    
    # Send email notification if configured
    if [[ -n "$EMAIL_ALERTS" ]] && command -v mail >/dev/null; then
        echo "$message" | mail -s "MediaNest Alert: $alert_id" "$EMAIL_ALERTS" 2>/dev/null || true
    fi
}

# Trigger recovery actions
trigger_recovery_action() {
    local service=$1
    local priority=$2
    local error_message=$3
    
    log "🔄 Triggering recovery action for $service (priority: $priority)"
    
    local action_taken="none"
    
    case "$priority" in
        "critical")
            # Attempt service restart for critical services
            case "$service" in
                "postgres")
                    log "Attempting PostgreSQL recovery..."
                    if docker restart medianest-postgres 2>/dev/null; then
                        action_taken="container_restart"
                        log "✅ PostgreSQL container restarted"
                        sleep 30  # Wait for service to stabilize
                    else
                        error "❌ Failed to restart PostgreSQL container"
                    fi
                    ;;
                "medianest-app"*)
                    log "Attempting application recovery..."
                    if docker restart "$service" 2>/dev/null; then
                        action_taken="container_restart"
                        log "✅ $service container restarted"
                        sleep 30
                    else
                        error "❌ Failed to restart $service container"
                    fi
                    ;;
                "traefik")
                    log "Attempting load balancer recovery..."
                    if docker restart medianest-lb 2>/dev/null; then
                        action_taken="container_restart"
                        log "✅ Traefik container restarted"
                        sleep 20
                    else
                        error "❌ Failed to restart Traefik container"
                    fi
                    ;;
            esac
            ;;
        "high")
            # Scale up replicas for high priority services
            log "Attempting to scale up $service..."
            action_taken="scale_attempted"
            ;;
        *)
            # Log only for lower priority services
            log "Monitoring $service - manual intervention may be required"
            action_taken="monitoring"
            ;;
    esac
    
    # Record recovery action
    jq --arg service "$service" \
       --arg action "$action_taken" \
       --arg error "$error_message" \
       --arg timestamp "$(date -Iseconds)" \
       '.recovery_actions += [{
           "service": $service,
           "action": $action,
           "error": $error,
           "timestamp": $timestamp
       }]' "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
    mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
}

# Comprehensive health check
run_comprehensive_health_check() {
    local verbose=${1:-false}
    
    log "🏥 Starting comprehensive health check"
    
    # Initialize if needed
    if [[ ! -f "$HEALTH_STATE_FILE" ]]; then
        initialize_health_monitor
    fi
    
    # Update timestamp
    jq --arg timestamp "$(date -Iseconds)" \
       '.timestamp = $timestamp' "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
    mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
    
    # Check system health
    check_system_health
    
    # Check all services
    local overall_status="healthy"
    local unhealthy_services=0
    local degraded_services=0
    
    for service in "${!SERVICES[@]}"; do
        local service_status=$(check_service_health "$service")
        
        case "$service_status" in
            "unhealthy"|"critical")
                overall_status="unhealthy"
                ((unhealthy_services++))
                ;;
            "degraded")
                if [[ "$overall_status" != "unhealthy" ]]; then
                    overall_status="degraded"
                fi
                ((degraded_services++))
                ;;
            "warning")
                if [[ "$overall_status" == "healthy" ]]; then
                    overall_status="warning"
                fi
                ;;
        esac
    done
    
    # Update overall status
    jq --arg status "$overall_status" \
       '.overall_status = $status' "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
    mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
    
    # Print summary
    echo
    echo "==================== HEALTH CHECK SUMMARY ===================="
    echo "Overall Status: $overall_status"
    echo "Timestamp: $(date)"
    echo "Unhealthy Services: $unhealthy_services"
    echo "Degraded Services: $degraded_services"
    echo
    
    if [[ "$verbose" == "true" ]]; then
        echo "Detailed Status:"
        jq -r '.services | to_entries[] | "\(.key): \(.value.status) (\(.value.response_time)ms)"' "$HEALTH_STATE_FILE"
        echo
        
        echo "System Resources:"
        jq -r '.system | "CPU: \(.cpu_usage)%, Memory: \(.memory_usage)%, Disk: \(.disk_usage)%"' "$HEALTH_STATE_FILE"
        echo
        
        echo "Active Alerts:"
        jq -r '.alerts[] | select(.resolved == false) | "\(.severity): \(.message)"' "$HEALTH_STATE_FILE"
    fi
    
    echo "==========================================================="
    
    log "Health check completed - Overall status: $overall_status"
}

# Continuous monitoring daemon
start_monitoring_daemon() {
    local interval=${1:-60}
    
    log "🔄 Starting health monitoring daemon (interval: ${interval}s)"
    
    while true; do
        run_comprehensive_health_check false
        
        # Clean up old alerts (older than 24 hours)
        jq --arg cutoff "$(date -d '24 hours ago' -Iseconds)" \
           '.alerts = [.alerts[] | select(.timestamp > $cutoff)]' \
           "$HEALTH_STATE_FILE" > "${HEALTH_STATE_FILE}.tmp" && \
        mv "${HEALTH_STATE_FILE}.tmp" "$HEALTH_STATE_FILE"
        
        sleep "$interval"
    done
}

# Generate health report
generate_health_report() {
    local output_file=${1:-"health-report-$(date +%Y%m%d-%H%M%S).json"}
    
    log "📊 Generating health report: $output_file"
    
    # Add report metadata
    jq --arg generated "$(date -Iseconds)" \
       --arg version "1.0.0" \
       '. + {
           "report": {
               "generated": $generated,
               "version": $version,
               "type": "comprehensive_health_report"
           }
       }' "$HEALTH_STATE_FILE" > "$output_file"
    
    log "✅ Health report generated: $output_file"
}

# Main function
main() {
    case "${1:-help}" in
        "init")
            initialize_health_monitor
            ;;
        "check")
            run_comprehensive_health_check "${2:-false}"
            ;;
        "daemon")
            start_monitoring_daemon "${2:-60}"
            ;;
        "report")
            generate_health_report "${2:-}"
            ;;
        "status")
            if [[ -f "$HEALTH_STATE_FILE" ]]; then
                jq -r '.overall_status' "$HEALTH_STATE_FILE"
            else
                echo "unknown"
            fi
            ;;
        *)
            echo "MediaNest Health Monitor"
            echo
            echo "Usage: $0 {init|check|daemon|report|status} [options]"
            echo
            echo "Commands:"
            echo "  init                    Initialize health monitoring"
            echo "  check [verbose]         Run single health check"
            echo "  daemon [interval]       Start monitoring daemon"
            echo "  report [filename]       Generate health report"
            echo "  status                  Show current overall status"
            echo
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Health monitor interrupted"; exit 1' INT TERM

# Execute main function
main "$@"