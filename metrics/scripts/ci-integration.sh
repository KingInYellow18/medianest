#!/bin/bash

# MediaNest Technical Debt Metrics - CI/CD Integration Script
# Automated metrics collection and validation for continuous monitoring

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
METRICS_DIR="${PROJECT_ROOT}/metrics"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENABLE_METRICS_COLLECTION=${ENABLE_METRICS_COLLECTION:-true}
ENABLE_REGRESSION_DETECTION=${ENABLE_REGRESSION_DETECTION:-true}
ENABLE_DASHBOARD_GENERATION=${ENABLE_DASHBOARD_GENERATION:-true}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
GITHUB_TOKEN=${GITHUB_TOKEN:-""}

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

# Validate environment
validate_environment() {
    log_info "Validating CI/CD environment..."
    
    # Check required tools
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed"; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed"; exit 1; }
    
    # Check metrics directory structure
    if [[ ! -d "${METRICS_DIR}" ]]; then
        log_error "Metrics directory not found: ${METRICS_DIR}"
        exit 1
    fi
    
    # Create necessary directories
    mkdir -p "${METRICS_DIR}/data/history"
    mkdir -p "${METRICS_DIR}/alerts"
    mkdir -p "${METRICS_DIR}/generated"
    
    log_success "Environment validation complete"
}

# Install dependencies
install_dependencies() {
    log_info "Installing metrics collection dependencies..."
    
    cd "${PROJECT_ROOT}"
    
    # Install any missing dependencies for metrics collection
    if [[ ! -f "node_modules/.bin/tsc" ]]; then
        npm install typescript --save-dev || true
    fi
    
    log_success "Dependencies installation complete"
}

# Collect current metrics
collect_metrics() {
    if [[ "${ENABLE_METRICS_COLLECTION}" != "true" ]]; then
        log_info "Metrics collection disabled, skipping..."
        return 0
    fi
    
    log_info "Collecting current system metrics..."
    
    cd "${SCRIPT_DIR}"
    
    # Run metrics collector
    if node metrics-collector.js; then
        log_success "Metrics collection completed successfully"
    else
        log_warning "Metrics collection completed with warnings"
    fi
}

# Detect regressions
detect_regressions() {
    if [[ "${ENABLE_REGRESSION_DETECTION}" != "true" ]]; then
        log_info "Regression detection disabled, skipping..."
        return 0
    fi
    
    log_info "Detecting technical debt regressions..."
    
    cd "${SCRIPT_DIR}"
    
    # Run regression detection
    if node -e "
        const { RegressionDetector, TechnicalDebtMonitor } = require('./monitoring-alerts.js');
        const monitor = new TechnicalDebtMonitor();
        const detector = new RegressionDetector(monitor);
        detector.detectRegressions().then(regressions => {
            if (regressions.length > 0) {
                console.log('⚠️ Detected', regressions.length, 'regressions');
                process.exit(1);
            } else {
                console.log('✅ No regressions detected');
                process.exit(0);
            }
        }).catch(err => {
            console.error('❌ Regression detection failed:', err.message);
            process.exit(1);
        });
    "; then
        log_success "No regressions detected"
    else
        log_error "Regressions detected - failing CI pipeline"
        return 1
    fi
}

# Generate dashboards
generate_dashboards() {
    if [[ "${ENABLE_DASHBOARD_GENERATION}" != "true" ]]; then
        log_info "Dashboard generation disabled, skipping..."
        return 0
    fi
    
    log_info "Generating updated dashboards..."
    
    cd "${SCRIPT_DIR}"
    
    if node dashboard-generator.js; then
        log_success "Dashboard generation completed successfully"
    else
        log_warning "Dashboard generation completed with warnings"
    fi
}

# Quality gate validation
validate_quality_gates() {
    log_info "Validating technical debt quality gates..."
    
    local current_metrics_file="${METRICS_DIR}/data/current-metrics.json"
    
    if [[ ! -f "${current_metrics_file}" ]]; then
        log_error "Current metrics file not found"
        return 1
    fi
    
    # Use node to parse and validate JSON metrics
    local validation_result
    validation_result=$(node -e "
        const fs = require('fs');
        const metrics = JSON.parse(fs.readFileSync('${current_metrics_file}', 'utf8'));
        
        let failures = [];
        
        // Security quality gates
        if (metrics.security?.criticalVulnerabilities > 0) {
            failures.push('Critical vulnerabilities present: ' + metrics.security.criticalVulnerabilities);
        }
        
        if (metrics.security?.securityScore < 60) {
            failures.push('Security score too low: ' + (metrics.security?.securityScore || 0));
        }
        
        // Build quality gates  
        if (!metrics.build?.buildSuccess) {
            failures.push('Build process is failing');
        }
        
        if (metrics.build?.typeScriptErrors?.count > 50) {
            failures.push('Too many TypeScript errors: ' + metrics.build.typeScriptErrors.count);
        }
        
        // Performance quality gates
        if (metrics.performance?.lighthouse < 40) {
            failures.push('Lighthouse score too low: ' + (metrics.performance?.lighthouse || 0));
        }
        
        if (failures.length > 0) {
            console.log('QUALITY_GATE_FAILURES');
            failures.forEach(failure => console.log('- ' + failure));
            process.exit(1);
        } else {
            console.log('QUALITY_GATES_PASSED');
            process.exit(0);
        }
    " 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        log_success "All quality gates passed"
        return 0
    else
        log_error "Quality gate validation failed:"
        echo "${validation_result}" | grep "^-" | while read -r line; do
            log_error "  ${line}"
        done
        return 1
    fi
}

# Send notifications
send_notifications() {
    local status="$1"
    local message="$2"
    
    log_info "Sending notifications..."
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        send_slack_notification "${status}" "${message}"
    fi
    
    # GitHub status
    if [[ -n "${GITHUB_TOKEN}" && -n "${GITHUB_SHA:-}" ]]; then
        send_github_status "${status}" "${message}"
    fi
}

send_slack_notification() {
    local status="$1"
    local message="$2"
    
    local color
    case "${status}" in
        "success") color="#36a64f" ;;
        "warning") color="#ffcc00" ;;
        "failure") color="#ff0000" ;;
        *) color="#808080" ;;
    esac
    
    local payload=$(cat <<EOF
{
    "attachments": [{
        "color": "${color}",
        "fields": [{
            "title": "MediaNest Technical Debt Metrics",
            "value": "${message}",
            "short": false
        }],
        "footer": "CI/CD Pipeline",
        "ts": $(date +%s)
    }]
}
EOF
)
    
    if curl -X POST -H 'Content-type: application/json' \
        --data "${payload}" \
        "${SLACK_WEBHOOK_URL}" >/dev/null 2>&1; then
        log_success "Slack notification sent"
    else
        log_warning "Failed to send Slack notification"
    fi
}

send_github_status() {
    local status="$1"
    local message="$2"
    
    local state
    case "${status}" in
        "success") state="success" ;;
        "warning") state="success" ;;
        "failure") state="failure" ;;
        *) state="pending" ;;
    esac
    
    local payload=$(cat <<EOF
{
    "state": "${state}",
    "description": "${message}",
    "context": "technical-debt-metrics"
}
EOF
)
    
    if curl -X POST \
        -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        --data "${payload}" \
        "https://api.github.com/repos/${GITHUB_REPOSITORY}/statuses/${GITHUB_SHA}" \
        >/dev/null 2>&1; then
        log_success "GitHub status updated"
    else
        log_warning "Failed to update GitHub status"
    fi
}

# Generate CI report
generate_ci_report() {
    log_info "Generating CI/CD metrics report..."
    
    local report_file="${METRICS_DIR}/generated/ci-report.md"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "${report_file}" << EOF
# MediaNest Technical Debt - CI/CD Report

**Generated:** ${timestamp}
**Build:** ${GITHUB_RUN_NUMBER:-"local"}
**Commit:** ${GITHUB_SHA:-"$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"}

## Metrics Collection Status

$(if [[ "${ENABLE_METRICS_COLLECTION}" == "true" ]]; then
    echo "✅ Metrics collection: ENABLED and completed"
else
    echo "⚠️ Metrics collection: DISABLED"
fi)

## Regression Detection

$(if [[ "${ENABLE_REGRESSION_DETECTION}" == "true" ]]; then
    echo "✅ Regression detection: ENABLED and completed"
else
    echo "⚠️ Regression detection: DISABLED"
fi)

## Quality Gates

$(validate_quality_gates > /dev/null 2>&1 && echo "✅ Quality gates: PASSED" || echo "❌ Quality gates: FAILED")

## Dashboard Generation

$(if [[ "${ENABLE_DASHBOARD_GENERATION}" == "true" ]]; then
    echo "✅ Dashboard generation: ENABLED and completed"
else
    echo "⚠️ Dashboard generation: DISABLED"
fi)

## Next Steps

- Review generated dashboards in \`metrics/generated/\`
- Check alert history in \`metrics/alerts/\`
- Monitor progress tracking in \`metrics/data/progress-tracking.json\`

---

*Report generated by MediaNest Technical Debt CI/CD Integration*
EOF

    log_success "CI/CD report generated: ${report_file}"
}

# Archive metrics data
archive_metrics() {
    log_info "Archiving metrics data..."
    
    local archive_dir="${METRICS_DIR}/data/archive/$(date +%Y/%m)"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p "${archive_dir}"
    
    # Archive current metrics with timestamp
    if [[ -f "${METRICS_DIR}/data/current-metrics.json" ]]; then
        cp "${METRICS_DIR}/data/current-metrics.json" "${archive_dir}/metrics_${timestamp}.json"
    fi
    
    # Archive progress tracking
    if [[ -f "${METRICS_DIR}/data/progress-tracking.json" ]]; then
        cp "${METRICS_DIR}/data/progress-tracking.json" "${archive_dir}/progress_${timestamp}.json"
    fi
    
    # Clean up old archives (keep 90 days)
    find "${METRICS_DIR}/data/archive" -name "*.json" -mtime +90 -delete 2>/dev/null || true
    
    log_success "Metrics data archived"
}

# Main execution function
main() {
    local start_time=$(date +%s)
    local status="success"
    local message="Technical debt metrics pipeline completed successfully"
    
    log_info "Starting MediaNest Technical Debt Metrics CI/CD Pipeline"
    log_info "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    
    # Trap to ensure cleanup on exit
    trap 'cleanup_on_exit' EXIT
    
    # Execute pipeline steps
    {
        validate_environment
        install_dependencies
        collect_metrics
        
        if ! detect_regressions; then
            status="failure"
            message="Technical debt regressions detected - pipeline failed"
        elif ! validate_quality_gates; then
            status="failure"  
            message="Quality gate validation failed - pipeline failed"
        else
            generate_dashboards
            archive_metrics
            generate_ci_report
        fi
    } || {
        status="failure"
        message="Technical debt metrics pipeline failed with errors"
    }
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "Pipeline completed in ${duration} seconds with status: ${status}"
    
    # Send notifications
    send_notifications "${status}" "${message} (Duration: ${duration}s)"
    
    # Exit with appropriate code
    if [[ "${status}" == "failure" ]]; then
        log_error "Pipeline failed - exiting with code 1"
        exit 1
    else
        log_success "Pipeline completed successfully"
        exit 0
    fi
}

cleanup_on_exit() {
    log_info "Cleaning up temporary files..."
    # Add any necessary cleanup here
}

# Handle command line arguments
case "${1:-main}" in
    "collect")
        validate_environment
        collect_metrics
        ;;
    "detect")
        validate_environment
        detect_regressions
        ;;
    "generate")
        validate_environment
        generate_dashboards
        ;;
    "validate")
        validate_environment
        validate_quality_gates
        ;;
    "report")
        generate_ci_report
        ;;
    "main"|"")
        main
        ;;
    *)
        echo "Usage: $0 [collect|detect|generate|validate|report|main]"
        echo ""
        echo "Commands:"
        echo "  collect   - Collect metrics only"
        echo "  detect    - Run regression detection only"
        echo "  generate  - Generate dashboards only"
        echo "  validate  - Run quality gate validation only"
        echo "  report    - Generate CI report only"
        echo "  main      - Run full pipeline (default)"
        exit 1
        ;;
esac