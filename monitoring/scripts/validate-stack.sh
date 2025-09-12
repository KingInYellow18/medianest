#!/bin/bash

# MEDIANEST PLG Stack Validation Script
# Comprehensive validation of Prometheus, Loki, Grafana observability stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$MONITORING_DIR")"

# Configuration
PROMETHEUS_URL="http://localhost:9090"
LOKI_URL="http://localhost:3100"
GRAFANA_URL="http://localhost:3002"
BACKEND_METRICS_URL="http://localhost:4000/metrics"

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

check_service() {
    local service_name="$1"
    local url="$2"
    local timeout="${3:-10}"
    
    log_info "Checking $service_name at $url..."
    
    if curl -f -s --max-time "$timeout" "$url" > /dev/null; then
        log_success "$service_name is responding"
        return 0
    else
        log_error "$service_name is not responding at $url"
        return 1
    fi
}

check_docker_services() {
    log_info "Checking Docker services status..."
    
    local services=(
        "medianest-prometheus"
        "medianest-loki"
        "medianest-grafana"
        "medianest-promtail"
        "medianest-node-exporter"
        "medianest-cadvisor"
        "medianest-postgres-exporter"
        "medianest-redis-exporter"
    )
    
    local all_healthy=true
    
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            log_success "Docker service $service is running"
        else
            log_error "Docker service $service is not running or healthy"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        log_success "All Docker services are running"
        return 0
    else
        log_error "Some Docker services are not healthy"
        return 1
    fi
}

check_prometheus() {
    log_info "Validating Prometheus..."
    
    # Check if Prometheus is accessible
    if ! check_service "Prometheus" "$PROMETHEUS_URL"; then
        return 1
    fi
    
    # Check API endpoints
    local endpoints=(
        "/api/v1/targets"
        "/api/v1/rules"
        "/api/v1/query?query=up"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$PROMETHEUS_URL$endpoint" > /dev/null; then
            log_success "Prometheus endpoint $endpoint is accessible"
        else
            log_error "Prometheus endpoint $endpoint is not accessible"
            return 1
        fi
    done
    
    # Check scrape targets
    log_info "Checking Prometheus scrape targets..."
    local targets_response
    targets_response=$(curl -s "$PROMETHEUS_URL/api/v1/targets")
    
    if echo "$targets_response" | jq -e '.data.activeTargets[] | select(.health != "up")' > /dev/null 2>&1; then
        log_warning "Some Prometheus targets are not healthy:"
        echo "$targets_response" | jq -r '.data.activeTargets[] | select(.health != "up") | "\(.scrapeUrl): \(.lastError)"'
    else
        log_success "All Prometheus targets are healthy"
    fi
    
    return 0
}

check_loki() {
    log_info "Validating Loki..."
    
    # Check if Loki is accessible
    if ! check_service "Loki" "$LOKI_URL/ready"; then
        return 1
    fi
    
    # Check Loki API endpoints
    local endpoints=(
        "/loki/api/v1/labels"
        "/metrics"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$LOKI_URL$endpoint" > /dev/null; then
            log_success "Loki endpoint $endpoint is accessible"
        else
            log_error "Loki endpoint $endpoint is not accessible"
            return 1
        fi
    done
    
    # Check for recent logs
    log_info "Checking for recent logs in Loki..."
    local query_url="$LOKI_URL/loki/api/v1/query_range"
    local now=$(date +%s)
    local one_hour_ago=$((now - 3600))
    
    local logs_response
    logs_response=$(curl -s -G "$query_url" \
        --data-urlencode "query={job=\"docker\"}" \
        --data-urlencode "start=${one_hour_ago}000000000" \
        --data-urlencode "end=${now}000000000" \
        --data-urlencode "limit=1")
    
    if echo "$logs_response" | jq -e '.data.result[0]' > /dev/null 2>&1; then
        log_success "Loki is receiving logs"
    else
        log_warning "No recent logs found in Loki (this might be normal for a new setup)"
    fi
    
    return 0
}

check_grafana() {
    log_info "Validating Grafana..."
    
    # Check if Grafana is accessible
    if ! check_service "Grafana" "$GRAFANA_URL/api/health"; then
        return 1
    fi
    
    # Check Grafana API with basic auth
    local auth="admin:medianest123"
    
    # Check datasources
    log_info "Checking Grafana datasources..."
    local datasources_response
    datasources_response=$(curl -s -u "$auth" "$GRAFANA_URL/api/datasources")
    
    if echo "$datasources_response" | jq -e '.[0]' > /dev/null 2>&1; then
        log_success "Grafana datasources are configured"
        echo "$datasources_response" | jq -r '.[] | "  - \(.name) (\(.type)): \(.url)"'
    else
        log_error "No Grafana datasources found"
        return 1
    fi
    
    # Check dashboards
    log_info "Checking Grafana dashboards..."
    local dashboards_response
    dashboards_response=$(curl -s -u "$auth" "$GRAFANA_URL/api/search?type=dash-db")
    
    local dashboard_count
    dashboard_count=$(echo "$dashboards_response" | jq '. | length')
    
    if [ "$dashboard_count" -gt 0 ]; then
        log_success "Found $dashboard_count Grafana dashboards"
        echo "$dashboards_response" | jq -r '.[] | "  - \(.title)"'
    else
        log_warning "No Grafana dashboards found"
    fi
    
    return 0
}

check_application_metrics() {
    log_info "Validating application metrics endpoint..."
    
    # Check if backend is running
    if ! check_service "Backend" "http://localhost:4000/health" 5; then
        log_warning "Backend application is not running - skipping metrics validation"
        return 0
    fi
    
    # Check metrics endpoint
    if check_service "Backend Metrics" "$BACKEND_METRICS_URL" 5; then
        log_success "Application metrics endpoint is accessible"
        
        # Check for expected metrics
        local metrics_response
        metrics_response=$(curl -s "$BACKEND_METRICS_URL")
        
        local expected_metrics=(
            "http_requests_total"
            "http_request_duration_ms"
            "nodejs_version_info"
            "process_cpu_user_seconds_total"
        )
        
        for metric in "${expected_metrics[@]}"; do
            if echo "$metrics_response" | grep -q "^$metric"; then
                log_success "Found metric: $metric"
            else
                log_warning "Missing metric: $metric"
            fi
        done
    else
        log_warning "Application metrics endpoint is not accessible"
    fi
    
    return 0
}

check_logs_integration() {
    log_info "Validating logs integration..."
    
    # Check if logs are being shipped to Loki
    local query_url="$LOKI_URL/loki/api/v1/query_range"
    local now=$(date +%s)
    local five_minutes_ago=$((now - 300))
    
    # Check for application logs
    local app_logs_response
    app_logs_response=$(curl -s -G "$query_url" \
        --data-urlencode "query={job=\"medianest-backend\"}" \
        --data-urlencode "start=${five_minutes_ago}000000000" \
        --data-urlencode "end=${now}000000000" \
        --data-urlencode "limit=1")
    
    if echo "$app_logs_response" | jq -e '.data.result[0]' > /dev/null 2>&1; then
        log_success "Application logs are being shipped to Loki"
    else
        log_warning "No recent application logs found in Loki"
    fi
    
    # Check for Docker container logs
    local container_logs_response
    container_logs_response=$(curl -s -G "$query_url" \
        --data-urlencode "query={job=\"docker\"}" \
        --data-urlencode "start=${five_minutes_ago}000000000" \
        --data-urlencode "end=${now}000000000" \
        --data-urlencode "limit=1")
    
    if echo "$container_logs_response" | jq -e '.data.result[0]' > /dev/null 2>&1; then
        log_success "Docker container logs are being shipped to Loki"
    else
        log_warning "No recent Docker container logs found in Loki"
    fi
    
    return 0
}

check_performance_impact() {
    log_info "Checking performance impact..."
    
    # Check resource usage of monitoring containers
    local monitoring_containers=(
        "monitoring-prometheus-1"
        "monitoring-loki-1"
        "monitoring-grafana-1"
        "monitoring-promtail-1"
    )
    
    for container in "${monitoring_containers[@]}"; do
        if docker ps --filter "name=$container" --format "table {{.Names}}\t{{.Status}}" | grep -q "$container"; then
            local stats
            stats=$(docker stats "$container" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}")
            log_info "$container resource usage:"
            echo "$stats"
        fi
    done
    
    return 0
}

run_integration_tests() {
    log_info "Running integration tests..."
    
    # Test metric query
    log_info "Testing Prometheus metric query..."
    local query_response
    query_response=$(curl -s -G "$PROMETHEUS_URL/api/v1/query" \
        --data-urlencode "query=up")
    
    if echo "$query_response" | jq -e '.data.result[0]' > /dev/null 2>&1; then
        log_success "Prometheus queries are working"
    else
        log_error "Prometheus queries are not working"
        return 1
    fi
    
    # Test log query
    log_info "Testing Loki log query..."
    local log_query_response
    log_query_response=$(curl -s -G "$LOKI_URL/loki/api/v1/query" \
        --data-urlencode "query={job=~\".*\"}")
    
    if echo "$log_query_response" | jq -e '.data' > /dev/null 2>&1; then
        log_success "Loki queries are working"
    else
        log_warning "Loki queries returned no data (might be normal for new setup)"
    fi
    
    return 0
}

generate_validation_report() {
    local report_file="$MONITORING_DIR/VALIDATION_REPORT.md"
    
    log_info "Generating validation report: $report_file"
    
    cat > "$report_file" << 'EOF'
# MEDIANEST PLG Stack Validation Report

**Validation Date**: $(date)
**Validation Script**: monitoring/scripts/validate-stack.sh

## Validation Results

### Docker Services Status
$(docker ps --filter "name=monitoring-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

### Service Endpoints
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100  
- **Grafana**: http://localhost:3001 (admin/medianest123)
- **Backend Metrics**: http://localhost:4000/metrics

### Validation Summary
EOF

    # Add current validation results to report
    echo "Report template created at: $report_file"
    log_success "Validation report generated"
}

main() {
    echo "======================================"
    echo "MEDIANEST PLG Stack Validation"
    echo "======================================"
    
    local validation_passed=true
    
    # Check Docker services
    if ! check_docker_services; then
        validation_passed=false
    fi
    
    # Check individual services
    if ! check_prometheus; then
        validation_passed=false
    fi
    
    if ! check_loki; then
        validation_passed=false
    fi
    
    if ! check_grafana; then
        validation_passed=false
    fi
    
    # Check application integration
    check_application_metrics
    check_logs_integration
    
    # Performance and integration tests
    check_performance_impact
    run_integration_tests
    
    # Generate report
    generate_validation_report
    
    echo "======================================"
    if [ "$validation_passed" = true ]; then
        log_success "PLG Stack validation completed successfully!"
        echo "Access your monitoring stack:"
        echo "  Grafana:    http://localhost:3001 (admin/medianest123)"
        echo "  Prometheus: http://localhost:9090"
        echo "  Loki:       http://localhost:3100"
    else
        log_error "PLG Stack validation failed - check logs above"
        exit 1
    fi
    echo "======================================"
}

# Run validation if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi