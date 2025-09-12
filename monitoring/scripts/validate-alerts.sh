#!/bin/bash
# MEDIANEST Alert Configuration Validation Script
# Validates Prometheus alert rules and AlertManager configuration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_DIR="$(dirname "$SCRIPT_DIR")"
PROMETHEUS_DIR="$MONITORING_DIR/prometheus"
ALERTMANAGER_DIR="$MONITORING_DIR/alertmanager"

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

# Validation counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

check_command() {
    local cmd=$1
    local name=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if command -v "$cmd" >/dev/null 2>&1; then
        log_success "$name is available"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        log_error "$name is not available in PATH"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

validate_yaml() {
    local file=$1
    local name=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ ! -f "$file" ]; then
        log_error "$name: File not found - $file"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
    
    # Check if we have a YAML validator
    if command -v yamllint >/dev/null 2>&1; then
        if yamllint -d relaxed "$file" >/dev/null 2>&1; then
            log_success "$name: YAML syntax is valid"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            log_error "$name: YAML syntax errors found"
            yamllint -d relaxed "$file" || true
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    elif command -v python3 >/dev/null 2>&1; then
        if python3 -c "import yaml; yaml.safe_load(open('$file'))" >/dev/null 2>&1; then
            log_success "$name: YAML syntax is valid"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            log_error "$name: YAML syntax errors found"
            python3 -c "import yaml; yaml.safe_load(open('$file'))" || true
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    else
        log_warning "$name: Cannot validate YAML syntax (no validator available)"
        WARNINGS=$((WARNINGS + 1))
        return 0
    fi
}

validate_prometheus_rules() {
    local file=$1
    local name=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if command -v promtool >/dev/null 2>&1; then
        if promtool check rules "$file" >/dev/null 2>&1; then
            log_success "$name: Prometheus rules are valid"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            log_error "$name: Prometheus rule validation failed"
            promtool check rules "$file" || true
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    else
        log_warning "$name: Cannot validate Prometheus rules (promtool not available)"
        WARNINGS=$((WARNINGS + 1))
        return 0
    fi
}

check_alert_completeness() {
    local file=$1
    local name=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local required_fields=("alert" "expr" "labels" "annotations")
    local missing_fields=()
    
    # Basic check for required fields in alert rules
    for field in "${required_fields[@]}"; do
        if ! grep -q "^[[:space:]]*${field}:" "$file"; then
            missing_fields+=("$field")
        fi
    done
    
    if [ ${#missing_fields[@]} -eq 0 ]; then
        log_success "$name: All required alert fields present"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_error "$name: Missing required fields: ${missing_fields[*]}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

check_security_coverage() {
    local security_alerts=("BruteForceAttackDetected" "SuspiciousAuthenticationActivity" "SQLInjectionAttempt" "XSSAttemptDetected" "RateLimitExceeded")
    local file="$PROMETHEUS_DIR/alerts/security-alerts.yml"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local missing_alerts=()
    for alert in "${security_alerts[@]}"; do
        if ! grep -q "alert: $alert" "$file"; then
            missing_alerts+=("$alert")
        fi
    done
    
    if [ ${#missing_alerts[@]} -eq 0 ]; then
        log_success "Security alerts: All critical security alerts are configured"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warning "Security alerts: Missing alerts: ${missing_alerts[*]}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

check_business_coverage() {
    local business_alerts=("MediaRequestQueueBacklog" "PlexIntegrationFailure" "LowUserConversionRate")
    local file="$PROMETHEUS_DIR/alerts/business-alerts.yml"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local missing_alerts=()
    for alert in "${business_alerts[@]}"; do
        if ! grep -q "alert: $alert" "$file"; then
            missing_alerts+=("$alert")
        fi
    done
    
    if [ ${#missing_alerts[@]} -eq 0 ]; then
        log_success "Business alerts: All critical business alerts are configured"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_warning "Business alerts: Missing alerts: ${missing_alerts[*]}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

check_notification_channels() {
    local config="$ALERTMANAGER_DIR/alertmanager.yml"
    local required_receivers=("security-critical" "critical-alerts" "application-alerts" "business-alerts")
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    local missing_receivers=()
    for receiver in "${required_receivers[@]}"; do
        if ! grep -q "name: '$receiver'" "$config"; then
            missing_receivers+=("$receiver")
        fi
    done
    
    if [ ${#missing_receivers[@]} -eq 0 ]; then
        log_success "AlertManager: All required notification receivers are configured"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        log_error "AlertManager: Missing receivers: ${missing_receivers[*]}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

generate_alert_summary() {
    local summary_file="$MONITORING_DIR/ALERT_CONFIGURATION_SUMMARY.md"
    
    cat > "$summary_file" << 'EOF'
# MEDIANEST Alert Configuration Summary

## Overview
This document provides a comprehensive overview of the alert configuration for the MEDIANEST PLG (Prometheus, Loki, Grafana) observability stack.

## Alert Categories

### 1. Application Alerts (`alerts/application-alerts.yml`)
**Critical business logic and API health monitoring**

#### Authentication & Security
- `AuthServiceDown` - Authentication service unavailability (Critical)
- `HighAuthFailureRate` - High authentication failure rate (Critical)
- `SuspiciousAuthActivity` - Rate limiting on auth endpoints (Warning)

#### API Performance
- `CriticalAPIResponseTime` - 95th percentile > 2s (Critical)
- `HighAPIErrorRate` - Server error rate > 1% (Critical)
- `MediaControllerErrors` - Media endpoint errors (Warning)

#### Business Logic
- `MediaRequestQueueBacklog` - Queue > 100 items (Warning)
- `CriticalMediaRequestBacklog` - Queue > 500 items (Critical)
- `PlexIntegrationFailure` - Plex API error rate > 20% (Critical)

#### JWT & Session Management
- `HighJWTVerificationFailures` - JWT failures > 1/sec (Warning)
- `SessionTokenLeakage` - Invalid token attempts > 5/sec (Critical)

### 2. Infrastructure Alerts (`alerts/infrastructure-alerts.yml`)
**System resources, containers, and infrastructure health**

#### System Resources
- `HighCPUUsage` / `CriticalCPUUsage` - CPU > 80% / 95%
- `HighMemoryUsage` / `CriticalMemoryUsage` - Memory > 85% / 95%
- `LowDiskSpace` / `CriticalDiskSpace` - Disk > 85% / 95%
- `HighDiskIOWait` - I/O wait > 20%

#### Container Monitoring
- `ContainerDown` - cAdvisor monitoring unavailable
- `HighContainerMemoryUsage` - Container memory > 85%
- `ContainerCPUThrottling` - CPU throttling detected
- `ContainerRestartLoop` - Frequent container restarts

#### Node Health
- `NodeDown` - Node exporter unreachable
- `HighLoadAverage` - Load > 2x CPU cores
- `NetworkInterfaceDown` - Network interface failure

### 3. Business Alerts (`alerts/business-alerts.yml`)
**User activity, conversion metrics, and business KPIs**

#### User Engagement
- `LowUserConversionRate` - Search-to-request conversion < 5%
- `UserSessionDropoff` - Session dropout > 70%
- `NoNewUserRegistrations` - No registrations in 6h

#### Media Processing
- `MediaRequestProcessingDelay` - Processing time > 300s
- `HighMediaRequestFailureRate` - Request failure rate > 10%
- `MediaRequestQueueStalled` - Queue stalled with items

#### Integration Health
- `PlexServiceDegraded` - Plex error/timeout rate > 15%
- `OverseerrServiceUnavailable` - Overseerr service down
- `ExternalAPIRateLimitHit` - Rate limiting detected

### 4. Security Alerts (`alerts/security-alerts.yml`)
**Authentication failures, rate limiting, and suspicious activity**

#### Authentication Security
- `BruteForceAttackDetected` - > 5 auth failures/sec (Critical)
- `SuspiciousAuthenticationActivity` - Multiple IP failures (Warning)
- `PrivilegeEscalationAttempt` - Privilege escalation detected (Critical)

#### API Security
- `RateLimitExceeded` - Rate limiting triggered (Warning)
- `CriticalRateLimitExceeded` - Heavy rate limiting (Critical)
- `SQLInjectionAttempt` - SQL injection detected (Critical)
- `XSSAttemptDetected` - XSS attempt detected (Critical)

#### Data Security
- `UnauthorizedDataAccess` - Unauthorized access attempt (Critical)
- `DataExfiltrationAttempt` - Large data transfer attempts (Critical)
- `SensitiveDataExposure` - Sensitive data exposure (Critical)

## Notification Routing

### Critical Security Alerts
- **Channels**: Slack (#security-alerts), Email (security team), PagerDuty
- **Escalation**: Immediate (0s group wait, 10m repeat)
- **Features**: Rich formatting, runbook links, action buttons

### Critical Infrastructure
- **Channels**: Slack (#alerts-critical), Email (ops team)
- **Escalation**: Immediate (0s group wait, 15m repeat)
- **Features**: Dashboard links, severity indicators

### Application & Business
- **Channels**: Slack (respective channels), Email (team-specific)
- **Escalation**: Standard (30s-2m group wait, 1-4h repeat)
- **Features**: Context-aware routing, inhibition rules

## Environment Variables

### SMTP Configuration
- `SMTP_HOST` - SMTP server hostname
- `SMTP_USERNAME` / `SMTP_PASSWORD` - Authentication
- `OPS_EMAIL` / `SECURITY_EMAIL` / `BUSINESS_EMAIL` - Team contacts

### Webhook Integration
- `SLACK_WEBHOOK_URL` - Slack integration
- `PAGERDUTY_WEBHOOK_URL` - PagerDuty integration
- `DEFAULT_WEBHOOK_URL` - Generic webhook endpoint

## Alert Thresholds

### Critical Thresholds
- **API Error Rate**: > 1% (5xx errors)
- **Response Time**: P95 > 2 seconds
- **Memory Usage**: > 95% sustained 2 minutes
- **CPU Usage**: > 95% sustained 2 minutes
- **Authentication Failures**: > 5 failures/second

### Warning Thresholds
- **API Error Rate**: > 0.5% 
- **Response Time**: P95 > 1 second
- **Memory Usage**: > 85% sustained 5 minutes
- **Queue Depth**: > 100 items for 10 minutes
- **Cache Hit Rate**: < 85%

## Inhibition Rules
- Critical alerts inhibit lower severity for same service
- Service down alerts inhibit related component alerts
- Node down alerts inhibit container alerts
- Infrastructure failures inhibit business alerts during outages

## Validation
Use the validation script to check configuration:
```bash
./monitoring/scripts/validate-alerts.sh
```

## Maintenance
- Review alert effectiveness monthly
- Update thresholds based on historical data
- Test notification channels quarterly
- Validate runbook links and procedures
EOF

    log_success "Generated alert configuration summary: $summary_file"
}

main() {
    echo "======================================"
    echo "MEDIANEST Alert Configuration Validator"
    echo "======================================"
    echo
    
    log_info "Starting validation of alert configuration..."
    echo
    
    # Check prerequisites
    log_info "Checking prerequisites..."
    check_command "yaml" "YAML processor" || true
    check_command "promtool" "Prometheus tool" || true
    echo
    
    # Validate Prometheus configuration
    log_info "Validating Prometheus configuration..."
    validate_yaml "$PROMETHEUS_DIR/prometheus.yml" "Prometheus config"
    echo
    
    # Validate alert rule files
    log_info "Validating alert rule files..."
    for alert_file in "$PROMETHEUS_DIR/alerts"/*.yml; do
        if [ -f "$alert_file" ]; then
            filename=$(basename "$alert_file")
            validate_yaml "$alert_file" "$filename"
            validate_prometheus_rules "$alert_file" "$filename" || true
            check_alert_completeness "$alert_file" "$filename"
        fi
    done
    echo
    
    # Validate AlertManager configuration
    log_info "Validating AlertManager configuration..."
    validate_yaml "$ALERTMANAGER_DIR/alertmanager.yml" "AlertManager config"
    check_notification_channels
    echo
    
    # Check alert coverage
    log_info "Checking alert coverage..."
    check_security_coverage
    check_business_coverage
    echo
    
    # Validate Grafana notification configuration
    log_info "Validating Grafana notification configuration..."
    if [ -f "$MONITORING_DIR/grafana/provisioning/notifiers.yml" ]; then
        validate_yaml "$MONITORING_DIR/grafana/provisioning/notifiers.yml" "Grafana notifiers"
    else
        log_warning "Grafana notifiers configuration not found"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo
    
    # Generate summary
    log_info "Generating alert configuration summary..."
    generate_alert_summary
    echo
    
    # Final summary
    echo "======================================"
    echo "VALIDATION SUMMARY"
    echo "======================================"
    echo "Total checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        log_success "All critical validations passed!"
        exit 0
    else
        log_error "Some validations failed. Please review the errors above."
        exit 1
    fi
}

# Run main function
main "$@"