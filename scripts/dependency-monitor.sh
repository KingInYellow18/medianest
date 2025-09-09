#!/bin/bash
# MediaNest Dependency Monitoring Script
# Purpose: Automated dependency health checks and reporting

set -e

# Colors and logging functions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}
EMAIL_ALERTS=${EMAIL_ALERTS:-"false"}
REPORT_DIR="reports"
DATE=$(date +%Y%m%d-%H%M%S)

# Create reports directory
mkdir -p "$REPORT_DIR"

# Function to check outdated packages
check_outdated() {
    local dir=$1
    local module_name=$(basename "$dir")
    [[ "$module_name" == "." ]] && module_name="root"
    
    log_info "Checking outdated packages in $module_name..."
    
    cd "$dir"
    local outdated_output
    if outdated_output=$(npm outdated --json 2>/dev/null); then
        local outdated_count=$(echo "$outdated_output" | jq '. | length // 0')
        if [[ "$outdated_count" -gt 0 ]]; then
            log_warning "$module_name: $outdated_count outdated packages"
            echo "$outdated_output" > "../$REPORT_DIR/outdated-${module_name}-${DATE}.json"
        else
            log_success "$module_name: All packages up to date"
        fi
    fi
    cd - > /dev/null
}

# Function to check security vulnerabilities
check_security() {
    local dir=$1
    local module_name=$(basename "$dir")
    [[ "$module_name" == "." ]] && module_name="root"
    
    log_info "Checking security vulnerabilities in $module_name..."
    
    cd "$dir"
    local audit_output
    if audit_output=$(npm audit --json 2>/dev/null); then
        local vuln_count=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.total // 0')
        local critical=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.critical // 0')
        local high=$(echo "$audit_output" | jq -r '.metadata.vulnerabilities.high // 0')
        
        if [[ "$vuln_count" -gt 0 ]]; then
            log_warning "$module_name: $vuln_count vulnerabilities (Critical: $critical, High: $high)"
            echo "$audit_output" > "../$REPORT_DIR/security-${module_name}-${DATE}.json"
            
            # Alert for critical/high vulnerabilities
            if [[ "$critical" -gt 0 ]] || [[ "$high" -gt 0 ]]; then
                log_error "$module_name: URGENT - Critical or High vulnerabilities detected!"
                return 1
            fi
        else
            log_success "$module_name: No security vulnerabilities"
        fi
    fi
    cd - > /dev/null
}

# Function to analyze bundle sizes (frontend only)
analyze_bundle_size() {
    if [[ -d "frontend" ]]; then
        log_info "Analyzing frontend bundle size..."
        
        cd frontend
        if [[ -f "package.json" ]] && grep -q "analyze" package.json; then
            if npm run analyze:bundle 2>/dev/null; then
                log_success "Bundle analysis completed"
            else
                log_warning "Bundle analysis not available or failed"
            fi
        fi
        cd ..
    fi
}

# Function to check dependency licenses
check_licenses() {
    log_info "Checking dependency licenses..."
    
    # Create license report for all modules
    {
        echo "# Dependency License Report"
        echo "Generated: $(date)"
        echo
        
        for dir in . backend frontend shared; do
            if [[ -f "$dir/package.json" ]]; then
                module_name=$(basename "$dir")
                [[ "$module_name" == "." ]] && module_name="root"
                
                echo "## $module_name"
                echo
                cd "$dir"
                
                # Use license-checker if available, otherwise basic analysis
                if command -v license-checker >/dev/null 2>&1; then
                    license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD' --summary 2>/dev/null || true
                else
                    # Basic license extraction from package.json
                    jq -r '.dependencies, .devDependencies | to_entries[] | "\(.key): \(.value)"' package.json 2>/dev/null | head -10
                fi
                echo
                cd - > /dev/null
            fi
        done
    } > "$REPORT_DIR/licenses-${DATE}.md"
    
    log_success "License report generated"
}

# Function to generate comprehensive health report
generate_health_report() {
    local report_file="$REPORT_DIR/health-report-${DATE}.json"
    
    log_info "Generating comprehensive health report..."
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"project\": \"MediaNest\","
        echo "  \"modules\": {"
        
        local first=true
        for dir in . backend frontend shared; do
            if [[ -f "$dir/package.json" ]]; then
                [[ "$first" == true ]] && first=false || echo ","
                
                module_name=$(basename "$dir")
                [[ "$module_name" == "." ]] && module_name="root"
                
                echo "    \"$module_name\": {"
                cd "$dir"
                
                # Basic stats
                deps=$(jq -r '.dependencies | keys | length // 0' package.json 2>/dev/null)
                devDeps=$(jq -r '.devDependencies | keys | length // 0' package.json 2>/dev/null)
                
                # Security info
                audit_json=$(npm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"total":0}}}')
                vulns=$(echo "$audit_json" | jq -r '.metadata.vulnerabilities.total // 0')
                critical=$(echo "$audit_json" | jq -r '.metadata.vulnerabilities.critical // 0')
                high=$(echo "$audit_json" | jq -r '.metadata.vulnerabilities.high // 0')
                
                # Outdated packages
                outdated_json=$(npm outdated --json 2>/dev/null || echo '{}')
                outdated_count=$(echo "$outdated_json" | jq '. | length // 0')
                
                echo "      \"dependencies\": $deps,"
                echo "      \"devDependencies\": $devDeps,"
                echo "      \"security\": {"
                echo "        \"total\": $vulns,"
                echo "        \"critical\": $critical,"
                echo "        \"high\": $high"
                echo "      },"
                echo "      \"outdated\": $outdated_count"
                echo "    }"
                
                cd - > /dev/null
            fi
        done
        
        echo "  }"
        echo "}"
    } > "$report_file"
    
    log_success "Health report generated: $report_file"
}

# Function to send alerts
send_alerts() {
    local has_critical_issues=$1
    
    if [[ "$has_critical_issues" == "true" ]] && [[ -n "$SLACK_WEBHOOK" ]]; then
        log_info "Sending Slack alert for critical issues..."
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 MediaNest Dependency Alert: Critical or High security vulnerabilities detected! Check reports in $REPORT_DIR/\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || log_warning "Failed to send Slack alert"
    fi
}

# Function to cleanup old reports
cleanup_old_reports() {
    log_info "Cleaning up old reports (keeping last 10)..."
    
    # Keep only the 10 most recent files of each type
    for pattern in "health-report-*.json" "security-*.json" "outdated-*.json" "licenses-*.md"; do
        if ls "$REPORT_DIR"/$pattern >/dev/null 2>&1; then
            ls -t "$REPORT_DIR"/$pattern | tail -n +11 | xargs -r rm -f
        fi
    done
    
    log_success "Old reports cleaned up"
}

# Main monitoring function
main() {
    echo "🔍 MediaNest Dependency Monitor"
    echo "=============================="
    echo "📅 $(date)"
    echo "📁 $(pwd)"
    echo
    
    local has_critical_issues=false
    
    # Check each module
    for dir in . backend frontend shared; do
        if [[ -f "$dir/package.json" ]]; then
            echo
            echo "📦 Checking $(basename "$dir" | sed 's/^\.$/root/')..."
            
            # Check outdated packages
            check_outdated "$dir"
            
            # Check security (critical function)
            if ! check_security "$dir"; then
                has_critical_issues=true
            fi
        fi
    done
    
    echo
    
    # Additional analysis
    analyze_bundle_size
    check_licenses
    generate_health_report
    
    # Send alerts if needed
    send_alerts "$has_critical_issues"
    
    # Cleanup
    cleanup_old_reports
    
    echo
    if [[ "$has_critical_issues" == "true" ]]; then
        log_error "CRITICAL ISSUES DETECTED! Review security reports immediately."
        echo "📋 Reports available in: $REPORT_DIR/"
        exit 1
    else
        log_success "All dependency health checks passed! 🎉"
        echo "📋 Reports available in: $REPORT_DIR/"
        exit 0
    fi
}

# Usage information
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "MediaNest Dependency Monitor"
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Environment variables:"
    echo "  SLACK_WEBHOOK    - Slack webhook URL for alerts"
    echo "  EMAIL_ALERTS     - Enable email alerts (true/false)"
    echo
    echo "Examples:"
    echo "  $0                              # Run monitoring"
    echo "  SLACK_WEBHOOK=https://... $0    # Run with Slack alerts"
    echo
    exit 0
fi

# Run main function
main "$@"