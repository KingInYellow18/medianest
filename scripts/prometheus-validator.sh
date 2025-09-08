#!/bin/bash

# MediaNest Prometheus Metrics Validation Script
# Validates comprehensive monitoring setup for production readiness

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/prometheus-validation-$(date +%Y%m%d-%H%M%S).log"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
APP_URL="${APP_URL:-http://localhost:3000}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"

# Ensure log directory exists
mkdir -p "$PROJECT_ROOT/logs"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    MediaNest Prometheus Validation Suite                    ║${NC}"
echo -e "${CYAN}║                        Production Monitoring Readiness                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo

# Initialize validation results
declare -A validation_results
total_checks=0
passed_checks=0
failed_checks=0
warning_checks=0

# Utility function to log and track results
log_result() {
    local check_name="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    total_checks=$((total_checks + 1))
    validation_results["$check_name"]="$status:$message"
    
    case "$status" in
        "PASS")
            echo -e "${GREEN}✓ $check_name: $message${NC}"
            passed_checks=$((passed_checks + 1))
            ;;
        "FAIL") 
            echo -e "${RED}✗ $check_name: $message${NC}"
            failed_checks=$((failed_checks + 1))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠ $check_name: $message${NC}"
            warning_checks=$((warning_checks + 1))
            ;;
    esac
    
    if [[ -n "$details" ]]; then
        echo "  $details"
    fi
    
    # Log to file
    echo "$(date -Iseconds) [$status] $check_name: $message" >> "$LOG_FILE"
    if [[ -n "$details" ]]; then
        echo "$(date -Iseconds) [DETAILS] $details" >> "$LOG_FILE"
    fi
}

# 1. Prometheus Configuration Validation
echo -e "${BLUE}📊 1. Prometheus Configuration Validation${NC}"
echo "════════════════════════════════════════════════"

# Check prometheus.yml exists
if [[ -f "$PROJECT_ROOT/config/production/prometheus.yml" ]]; then
    log_result "Config File Exists" "PASS" "prometheus.yml configuration file found"
    
    # Validate configuration syntax
    if command -v promtool >/dev/null 2>&1; then
        if promtool check config "$PROJECT_ROOT/config/production/prometheus.yml" >/dev/null 2>&1; then
            log_result "Config Syntax" "PASS" "prometheus.yml syntax is valid"
        else
            log_result "Config Syntax" "FAIL" "prometheus.yml has syntax errors"
        fi
    else
        log_result "Config Syntax" "WARN" "promtool not available for syntax validation"
    fi
    
    # Check for required scrape configs
    if grep -q "job_name.*medianest-app" "$PROJECT_ROOT/config/production/prometheus.yml"; then
        log_result "App Scrape Config" "PASS" "MediaNest application scrape configuration found"
    else
        log_result "App Scrape Config" "FAIL" "MediaNest application scrape configuration missing"
    fi
    
    # Check for alert rules
    if grep -q "rule_files" "$PROJECT_ROOT/config/production/prometheus.yml"; then
        log_result "Alert Rules Config" "PASS" "Alert rules configuration found"
    else
        log_result "Alert Rules Config" "WARN" "Alert rules configuration not found"
    fi
    
else
    log_result "Config File Exists" "FAIL" "prometheus.yml configuration file not found"
fi

# Check alert rules file
if [[ -f "$PROJECT_ROOT/config/production/alert_rules.yml" ]]; then
    log_result "Alert Rules File" "PASS" "alert_rules.yml file found"
    
    # Validate alert rules syntax
    if command -v promtool >/dev/null 2>&1; then
        if promtool check rules "$PROJECT_ROOT/config/production/alert_rules.yml" >/dev/null 2>&1; then
            log_result "Alert Rules Syntax" "PASS" "alert_rules.yml syntax is valid"
        else
            log_result "Alert Rules Syntax" "FAIL" "alert_rules.yml has syntax errors"
        fi
    else
        log_result "Alert Rules Syntax" "WARN" "promtool not available for alert rules validation"
    fi
else
    log_result "Alert Rules File" "FAIL" "alert_rules.yml file not found"
fi

echo

# 2. Metrics Collection Testing
echo -e "${PURPLE}🔍 2. Metrics Collection Testing${NC}"
echo "═════════════════════════════════════"

# Test application metrics endpoint
if curl -sf "$APP_URL/metrics" >/dev/null 2>&1; then
    log_result "App Metrics Endpoint" "PASS" "Application /metrics endpoint is accessible"
    
    # Check for specific metrics
    metrics_response=$(curl -s "$APP_URL/metrics" 2>/dev/null || echo "")
    
    if echo "$metrics_response" | grep -q "http_requests_total"; then
        log_result "HTTP Metrics" "PASS" "HTTP request metrics are being collected"
    else
        log_result "HTTP Metrics" "WARN" "HTTP request metrics not found in /metrics output"
    fi
    
    if echo "$metrics_response" | grep -q "database_connections_active"; then
        log_result "Database Metrics" "PASS" "Database connection metrics are being collected"
    else
        log_result "Database Metrics" "WARN" "Database connection metrics not found"
    fi
    
    if echo "$metrics_response" | grep -q "nodejs_"; then
        log_result "Node.js Metrics" "PASS" "Node.js runtime metrics are being collected"
    else
        log_result "Node.js Metrics" "WARN" "Node.js runtime metrics not found"
    fi
    
else
    log_result "App Metrics Endpoint" "FAIL" "Application /metrics endpoint is not accessible at $APP_URL"
fi

# Test Prometheus server connectivity
if curl -sf "$PROMETHEUS_URL/api/v1/status/config" >/dev/null 2>&1; then
    log_result "Prometheus Server" "PASS" "Prometheus server is accessible"
    
    # Check targets status
    targets_response=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null || echo '{"data":{"activeTargets":[]}}')
    active_targets=$(echo "$targets_response" | jq -r '.data.activeTargets | length' 2>/dev/null || echo "0")
    
    if [[ "$active_targets" -gt 0 ]]; then
        log_result "Prometheus Targets" "PASS" "Prometheus has $active_targets active target(s)"
        
        # Check for MediaNest app target
        if echo "$targets_response" | jq -r '.data.activeTargets[].labels.job' 2>/dev/null | grep -q "medianest-app"; then
            log_result "App Target Health" "PASS" "MediaNest application target is being monitored"
        else
            log_result "App Target Health" "WARN" "MediaNest application target not found in active targets"
        fi
    else
        log_result "Prometheus Targets" "WARN" "No active targets found in Prometheus"
    fi
    
else
    log_result "Prometheus Server" "FAIL" "Prometheus server is not accessible at $PROMETHEUS_URL"
fi

echo

# 3. Grafana Dashboard Validation
echo -e "${GREEN}📈 3. Grafana Dashboard Validation${NC}"
echo "══════════════════════════════════════════"

# Check Grafana connectivity
if curl -sf "$GRAFANA_URL/api/health" >/dev/null 2>&1; then
    log_result "Grafana Server" "PASS" "Grafana server is accessible"
    
    # Check for dashboard configuration file
    if [[ -f "$PROJECT_ROOT/config/production/grafana-dashboards.json" ]]; then
        log_result "Dashboard Config" "PASS" "Grafana dashboard configuration found"
        
        # Validate JSON syntax
        if jq empty "$PROJECT_ROOT/config/production/grafana-dashboards.json" 2>/dev/null; then
            log_result "Dashboard JSON" "PASS" "Dashboard JSON syntax is valid"
        else
            log_result "Dashboard JSON" "FAIL" "Dashboard JSON has syntax errors"
        fi
        
        # Check for essential panels
        dashboard_content=$(cat "$PROJECT_ROOT/config/production/grafana-dashboards.json")
        if echo "$dashboard_content" | jq -r '.dashboard.panels[].title' 2>/dev/null | grep -q -i "response time"; then
            log_result "Response Time Panel" "PASS" "Response time visualization panel found"
        else
            log_result "Response Time Panel" "WARN" "Response time visualization panel not found"
        fi
        
        if echo "$dashboard_content" | jq -r '.dashboard.panels[].title' 2>/dev/null | grep -q -i "error rate"; then
            log_result "Error Rate Panel" "PASS" "Error rate visualization panel found"
        else
            log_result "Error Rate Panel" "WARN" "Error rate visualization panel not found"
        fi
        
    else
        log_result "Dashboard Config" "WARN" "Grafana dashboard configuration not found"
    fi
    
else
    log_result "Grafana Server" "FAIL" "Grafana server is not accessible at $GRAFANA_URL"
fi

echo

# 4. Alert Rule Testing
echo -e "${RED}🚨 4. Alert Rule Testing${NC}"
echo "═════════════════════════════════"

# Test alert rule evaluation
if curl -sf "$PROMETHEUS_URL/api/v1/rules" >/dev/null 2>&1; then
    rules_response=$(curl -s "$PROMETHEUS_URL/api/v1/rules" 2>/dev/null || echo '{"data":{"groups":[]}}')
    rule_groups=$(echo "$rules_response" | jq -r '.data.groups | length' 2>/dev/null || echo "0")
    
    if [[ "$rule_groups" -gt 0 ]]; then
        log_result "Alert Rules Loaded" "PASS" "Alert rules are loaded in Prometheus ($rule_groups groups)"
        
        # Check for critical alerts
        if echo "$rules_response" | jq -r '.data.groups[].rules[].name' 2>/dev/null | grep -q -i "ApplicationDown"; then
            log_result "Critical Alerts" "PASS" "Critical application alerts are configured"
        else
            log_result "Critical Alerts" "WARN" "Critical application alerts not found"
        fi
        
        # Check for warning alerts
        if echo "$rules_response" | jq -r '.data.groups[].rules[].name' 2>/dev/null | grep -q -i "HighErrorRate\|HighResponseTime"; then
            log_result "Warning Alerts" "PASS" "Warning alerts are configured"
        else
            log_result "Warning Alerts" "WARN" "Warning alerts not found"
        fi
        
    else
        log_result "Alert Rules Loaded" "WARN" "No alert rules found in Prometheus"
    fi
    
    # Test alert manager connectivity
    if curl -sf "$PROMETHEUS_URL/api/v1/alertmanagers" >/dev/null 2>&1; then
        alertmanagers_response=$(curl -s "$PROMETHEUS_URL/api/v1/alertmanagers" 2>/dev/null || echo '{"data":{"activeAlertmanagers":[]}}')
        active_alertmanagers=$(echo "$alertmanagers_response" | jq -r '.data.activeAlertmanagers | length' 2>/dev/null || echo "0")
        
        if [[ "$active_alertmanagers" -gt 0 ]]; then
            log_result "AlertManager Connection" "PASS" "AlertManager is connected and active"
        else
            log_result "AlertManager Connection" "WARN" "No active AlertManager instances found"
        fi
    else
        log_result "AlertManager Connection" "FAIL" "Cannot query AlertManager status from Prometheus"
    fi
    
else
    log_result "Alert Rules Loaded" "FAIL" "Cannot query alert rules from Prometheus"
fi

echo

# 5. Performance and Cardinality Check
echo -e "${YELLOW}⚡ 5. Performance and Cardinality Check${NC}"
echo "════════════════════════════════════════════"

# Test metrics cardinality
if curl -sf "$PROMETHEUS_URL/api/v1/label/__name__/values" >/dev/null 2>&1; then
    metrics_response=$(curl -s "$PROMETHEUS_URL/api/v1/label/__name__/values" 2>/dev/null || echo '{"data":[]}')
    metric_count=$(echo "$metrics_response" | jq -r '.data | length' 2>/dev/null || echo "0")
    
    if [[ "$metric_count" -gt 0 ]]; then
        log_result "Metrics Cardinality" "PASS" "Prometheus is collecting $metric_count different metrics"
        
        if [[ "$metric_count" -lt 10000 ]]; then
            log_result "Cardinality Level" "PASS" "Metric cardinality is within acceptable range ($metric_count < 10,000)"
        elif [[ "$metric_count" -lt 50000 ]]; then
            log_result "Cardinality Level" "WARN" "Metric cardinality is high ($metric_count), monitor for performance impact"
        else
            log_result "Cardinality Level" "FAIL" "Metric cardinality is very high ($metric_count), may impact performance"
        fi
    else
        log_result "Metrics Cardinality" "WARN" "No metrics found or unable to query metric names"
    fi
    
    # Check Prometheus performance
    prometheus_status=$(curl -s "$PROMETHEUS_URL/api/v1/status/tsdb" 2>/dev/null || echo '{"data":{}}')
    if echo "$prometheus_status" | jq -e '.data.seriesCountByMetricName' >/dev/null 2>&1; then
        log_result "Prometheus Performance" "PASS" "Prometheus TSDB is healthy and responding"
    else
        log_result "Prometheus Performance" "WARN" "Unable to retrieve Prometheus TSDB status"
    fi
    
else
    log_result "Metrics Cardinality" "FAIL" "Cannot query metric names from Prometheus"
fi

# Test query performance
if curl -sf "$PROMETHEUS_URL/api/v1/query?query=up" >/dev/null 2>&1; then
    query_start=$(date +%s%3N)
    curl -s "$PROMETHEUS_URL/api/v1/query?query=up" >/dev/null 2>&1
    query_end=$(date +%s%3N)
    query_time=$((query_end - query_start))
    
    if [[ "$query_time" -lt 1000 ]]; then
        log_result "Query Performance" "PASS" "Simple queries respond in ${query_time}ms"
    elif [[ "$query_time" -lt 5000 ]]; then
        log_result "Query Performance" "WARN" "Query response time is elevated (${query_time}ms)"
    else
        log_result "Query Performance" "FAIL" "Query response time is too high (${query_time}ms)"
    fi
else
    log_result "Query Performance" "FAIL" "Cannot execute test queries against Prometheus"
fi

echo

# Summary Report
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                           Validation Summary Report                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${BLUE}📊 Validation Statistics:${NC}"
echo "  Total Checks: $total_checks"
echo -e "  ${GREEN}✓ Passed: $passed_checks${NC}"
echo -e "  ${YELLOW}⚠ Warnings: $warning_checks${NC}"
echo -e "  ${RED}✗ Failed: $failed_checks${NC}"
echo

# Calculate overall health score
health_score=$(( (passed_checks * 100) / total_checks ))
echo -e "${BLUE}🎯 Overall Health Score: ${NC}"
if [[ "$health_score" -ge 90 ]]; then
    echo -e "${GREEN}$health_score% - EXCELLENT${NC}"
    overall_status="PRODUCTION READY"
elif [[ "$health_score" -ge 75 ]]; then
    echo -e "${YELLOW}$health_score% - GOOD${NC}"
    overall_status="MOSTLY READY"
elif [[ "$health_score" -ge 50 ]]; then
    echo -e "${YELLOW}$health_score% - NEEDS IMPROVEMENT${NC}"
    overall_status="NEEDS WORK"
else
    echo -e "${RED}$health_score% - CRITICAL ISSUES${NC}"
    overall_status="NOT READY"
fi

echo
echo -e "${BLUE}🏆 Production Readiness: ${NC}"
if [[ "$failed_checks" -eq 0 && "$warning_checks" -le 3 ]]; then
    echo -e "${GREEN}✅ $overall_status - Monitoring system is production-ready${NC}"
elif [[ "$failed_checks" -le 2 ]]; then
    echo -e "${YELLOW}⚠️  $overall_status - Minor issues need attention${NC}"
else
    echo -e "${RED}❌ $overall_status - Critical issues must be resolved${NC}"
fi

echo
echo -e "${BLUE}📋 Recommendations:${NC}"

if [[ "$failed_checks" -gt 0 ]]; then
    echo "• Address all failed checks before production deployment"
fi

if [[ "$warning_checks" -gt 5 ]]; then
    echo "• Review warning items to optimize monitoring setup"
fi

if ! curl -sf "$PROMETHEUS_URL" >/dev/null 2>&1; then
    echo "• Start Prometheus server: docker-compose --profile monitoring up -d"
fi

if ! curl -sf "$APP_URL/metrics" >/dev/null 2>&1; then
    echo "• Start MediaNest application with metrics enabled"
fi

if [[ ! -f "$PROJECT_ROOT/config/production/prometheus.yml" ]]; then
    echo "• Create Prometheus configuration file"
fi

echo
echo -e "${BLUE}📄 Detailed Log: ${NC}$LOG_FILE"
echo -e "${BLUE}🔍 Next Steps: ${NC}"
echo "1. Review detailed log file for specific issues"
echo "2. Address any failed validation checks"
echo "3. Set up continuous monitoring alerts"
echo "4. Test alert notification delivery"
echo "5. Create monitoring runbooks and procedures"

# Store validation results in memory for other tools
npx claude-flow@alpha memory store "MEDIANEST_PROD_VALIDATION/prometheus_monitoring" "$(cat <<EOF
{
  "validation_timestamp": "$(date -Iseconds)",
  "total_checks": $total_checks,
  "passed_checks": $passed_checks,
  "warning_checks": $warning_checks,
  "failed_checks": $failed_checks,
  "health_score": $health_score,
  "overall_status": "$overall_status",
  "log_file": "$LOG_FILE",
  "prometheus_url": "$PROMETHEUS_URL",
  "application_url": "$APP_URL",
  "grafana_url": "$GRAFANA_URL",
  "recommendations": [
    "Address failed validation checks",
    "Review warning items for optimization",
    "Test alert notification delivery",
    "Create monitoring runbooks"
  ]
}
EOF
)" --namespace "production-validation" 2>/dev/null || echo "Note: Memory storage not available"

exit $(( failed_checks > 0 ? 1 : 0 ))