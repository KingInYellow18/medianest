#!/bin/bash

# ============================================
# 📊 DOCUMENTATION PERFORMANCE MONITOR
# Advanced monitoring and optimization tool for MKDocs deployments
# ============================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/docs"
BUILD_DIR="$PROJECT_ROOT/site"
REPORTS_DIR="$PROJECT_ROOT/performance-reports"

# Performance thresholds
MAX_BUILD_TIME=60
MAX_SITE_SIZE_MB=50
MIN_LIGHTHOUSE_SCORE=80
MAX_PAGE_LOAD_MS=3000

# URLs for testing
STAGING_URL="${DOCS_URL_STAGING:-https://staging-docs.medianest.com}"
PRODUCTION_URL="${DOCS_URL_PRODUCTION:-https://docs.medianest.com}"

# Create reports directory
mkdir -p "$REPORTS_DIR"

print_header() {
    echo -e "${PURPLE}============================================${NC}"
    echo -e "${PURPLE}📊 MEDIANEST DOCS PERFORMANCE MONITOR${NC}"
    echo -e "${PURPLE}============================================${NC}"
    echo
}

print_section() {
    echo -e "${CYAN}▶ $1${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check dependencies
check_dependencies() {
    print_section "Checking Dependencies"
    
    local missing_deps=()
    
    # Required tools
    command -v mkdocs >/dev/null || missing_deps+=("mkdocs")
    command -v curl >/dev/null || missing_deps+=("curl")
    command -v jq >/dev/null || missing_deps+=("jq")
    command -v bc >/dev/null || missing_deps+=("bc")
    
    # Optional tools
    if ! command -v lighthouse >/dev/null; then
        print_warning "lighthouse not found (npm install -g lighthouse for detailed audits)"
    fi
    
    if ! command -v html5validator >/dev/null; then
        print_warning "html5validator not found (pip install html5validator for HTML validation)"
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    print_success "All required dependencies found"
    echo
}

# Monitor build performance
monitor_build_performance() {
    print_section "Build Performance Monitoring"
    
    if [[ ! -f "$PROJECT_ROOT/mkdocs.yml" ]]; then
        print_error "mkdocs.yml not found in project root"
        return 1
    fi
    
    # Clean previous build
    rm -rf "$BUILD_DIR"
    
    # Time the build process
    local start_time=$(date +%s.%N)
    
    print_info "Starting MkDocs build..."
    if mkdocs build --clean --quiet; then
        local end_time=$(date +%s.%N)
        local build_time=$(echo "$end_time - $start_time" | bc)
        local build_time_int=$(echo "$build_time / 1" | bc)
        
        print_success "Build completed in ${build_time}s"
        
        # Check build time threshold
        if (( build_time_int > MAX_BUILD_TIME )); then
            print_warning "Build time (${build_time_int}s) exceeds threshold (${MAX_BUILD_TIME}s)"
        else
            print_success "Build time within acceptable limits"
        fi
        
        # Analyze build output
        analyze_build_output "$build_time"
        
    else
        print_error "MkDocs build failed"
        return 1
    fi
    
    echo
}

# Analyze build output
analyze_build_output() {
    local build_time="$1"
    
    print_section "Build Output Analysis"
    
    if [[ ! -d "$BUILD_DIR" ]]; then
        print_error "Build directory not found"
        return 1
    fi
    
    # Count files
    local html_files=$(find "$BUILD_DIR" -name "*.html" | wc -l)
    local css_files=$(find "$BUILD_DIR" -name "*.css" | wc -l)
    local js_files=$(find "$BUILD_DIR" -name "*.js" | wc -l)
    local img_files=$(find "$BUILD_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.svg" -o -name "*.gif" \) | wc -l)
    
    # Calculate sizes
    local total_size_bytes=$(du -sb "$BUILD_DIR" | cut -f1)
    local total_size_mb=$(echo "scale=2; $total_size_bytes / 1024 / 1024" | bc)
    
    # Generate report
    local report_file="$REPORTS_DIR/build-analysis-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_performance": {
    "build_time_seconds": $build_time,
    "total_size_mb": $total_size_mb,
    "total_size_bytes": $total_size_bytes
  },
  "file_counts": {
    "html_files": $html_files,
    "css_files": $css_files,
    "js_files": $js_files,
    "image_files": $img_files
  },
  "thresholds": {
    "max_build_time": $MAX_BUILD_TIME,
    "max_site_size_mb": $MAX_SITE_SIZE_MB,
    "build_time_ok": $(echo "$build_time <= $MAX_BUILD_TIME" | bc),
    "site_size_ok": $(echo "$total_size_mb <= $MAX_SITE_SIZE_MB" | bc)
  }
}
EOF
    
    print_info "Build Statistics:"
    echo "   📄 HTML files: $html_files"
    echo "   🎨 CSS files: $css_files" 
    echo "   ⚡ JS files: $js_files"
    echo "   🖼️  Images: $img_files"
    echo "   💾 Total size: ${total_size_mb}MB"
    
    # Check size threshold
    if (( $(echo "$total_size_mb > $MAX_SITE_SIZE_MB" | bc -l) )); then
        print_warning "Site size (${total_size_mb}MB) exceeds threshold (${MAX_SITE_SIZE_MB}MB)"
    else
        print_success "Site size within acceptable limits"
    fi
    
    print_success "Build analysis saved to: $report_file"
    echo
}

# Test site performance
test_site_performance() {
    local site_url="$1"
    local environment="$2"
    
    print_section "Testing Site Performance - $environment"
    
    # Start local server if testing local build
    local server_pid=""
    local test_url="$site_url"
    
    if [[ "$site_url" == "local" ]]; then
        if [[ ! -d "$BUILD_DIR" ]]; then
            print_error "No local build found. Run build monitoring first."
            return 1
        fi
        
        print_info "Starting local test server..."
        cd "$BUILD_DIR"
        python3 -m http.server 8080 &
        server_pid=$!
        test_url="http://localhost:8080"
        
        # Wait for server to start
        sleep 3
        
        if ! curl -fs "$test_url" > /dev/null; then
            print_error "Failed to start local test server"
            [[ -n "$server_pid" ]] && kill "$server_pid"
            return 1
        fi
        
        cd "$PROJECT_ROOT"
    fi
    
    # Test basic connectivity
    print_info "Testing connectivity to: $test_url"
    
    if curl -fs --max-time 30 "$test_url" > /dev/null; then
        print_success "Site is accessible"
    else
        print_error "Site is not accessible"
        [[ -n "$server_pid" ]] && kill "$server_pid"
        return 1
    fi
    
    # Measure response times
    print_info "Measuring response times..."
    
    local endpoints=(
        ""
        "api/"
        "user-guides/"
        "developers/"
        "search/"
    )
    
    local response_times=()
    
    for endpoint in "${endpoints[@]}"; do
        local url="${test_url}/${endpoint}"
        print_info "Testing: $url"
        
        local time_total=$(curl -w '%{time_total}' -o /dev/null -s --max-time 15 "$url" 2>/dev/null || echo "0")
        local time_ms=$(echo "$time_total * 1000" | bc)
        local time_ms_int=$(echo "$time_ms / 1" | bc)
        
        response_times+=("$time_ms_int")
        
        if (( time_ms_int > MAX_PAGE_LOAD_MS )); then
            print_warning "$endpoint: ${time_ms_int}ms (exceeds ${MAX_PAGE_LOAD_MS}ms threshold)"
        else
            print_success "$endpoint: ${time_ms_int}ms"
        fi
    done
    
    # Calculate average response time
    local total_time=0
    for time in "${response_times[@]}"; do
        total_time=$((total_time + time))
    done
    local avg_time=$((total_time / ${#response_times[@]}))
    
    print_info "Average response time: ${avg_time}ms"
    
    # Run Lighthouse audit if available
    if command -v lighthouse >/dev/null; then
        run_lighthouse_audit "$test_url" "$environment"
    else
        print_warning "Skipping Lighthouse audit (not installed)"
    fi
    
    # Cleanup local server
    if [[ -n "$server_pid" ]]; then
        kill "$server_pid" 2>/dev/null || true
    fi
    
    echo
}

# Run Lighthouse audit
run_lighthouse_audit() {
    local site_url="$1"
    local environment="$2"
    
    print_info "Running Lighthouse audit..."
    
    local report_file="$REPORTS_DIR/lighthouse-${environment}-$(date +%Y%m%d-%H%M%S).json"
    
    if lighthouse "$site_url" \
        --output json \
        --output-path "$report_file" \
        --chrome-flags="--headless --no-sandbox" \
        --only-categories=performance,accessibility,best-practices,seo \
        --preset=desktop \
        --quiet 2>/dev/null; then
        
        # Parse results
        local perf_score=$(jq -r '.categories.performance.score * 100' "$report_file" 2>/dev/null || echo "0")
        local acc_score=$(jq -r '.categories.accessibility.score * 100' "$report_file" 2>/dev/null || echo "0")
        local bp_score=$(jq -r '.categories["best-practices"].score * 100' "$report_file" 2>/dev/null || echo "0")
        local seo_score=$(jq -r '.categories.seo.score * 100' "$report_file" 2>/dev/null || echo "0")
        
        print_info "Lighthouse Scores:"
        echo "   🚀 Performance: ${perf_score}%"
        echo "   ♿ Accessibility: ${acc_score}%"
        echo "   ✅ Best Practices: ${bp_score}%"
        echo "   🔍 SEO: ${seo_score}%"
        
        # Check thresholds
        local perf_score_int=$(echo "$perf_score / 1" | bc)
        if (( perf_score_int < MIN_LIGHTHOUSE_SCORE )); then
            print_warning "Performance score (${perf_score_int}%) below threshold (${MIN_LIGHTHOUSE_SCORE}%)"
        else
            print_success "Performance score meets requirements"
        fi
        
        print_success "Lighthouse report saved to: $report_file"
        
    else
        print_warning "Lighthouse audit failed"
    fi
}

# Monitor link health
monitor_link_health() {
    local site_url="$1"
    local environment="$2"
    
    print_section "Link Health Monitoring - $environment"
    
    if command -v linkchecker >/dev/null; then
        print_info "Running comprehensive link check..."
        
        local report_file="$REPORTS_DIR/linkcheck-${environment}-$(date +%Y%m%d-%H%M%S).txt"
        
        linkchecker \
            --config=/dev/null \
            --check-extern \
            --recursion-level=2 \
            --timeout=15 \
            --threads=4 \
            --output=text \
            "$site_url" > "$report_file" 2>&1 || true
        
        # Count broken links
        local broken_links=$(grep -c "^Error:" "$report_file" 2>/dev/null || echo "0")
        local warnings=$(grep -c "^Warning:" "$report_file" 2>/dev/null || echo "0")
        
        if [[ "$broken_links" -gt 0 ]]; then
            print_warning "Found $broken_links broken links"
            grep "^Error:" "$report_file" | head -5
        else
            print_success "No broken links found"
        fi
        
        if [[ "$warnings" -gt 0 ]]; then
            print_info "$warnings warnings found (check report for details)"
        fi
        
        print_success "Link check report saved to: $report_file"
        
    else
        print_warning "linkchecker not available (pip install linkchecker for link validation)"
    fi
    
    echo
}

# Generate comprehensive report
generate_comprehensive_report() {
    print_section "Generating Comprehensive Performance Report"
    
    local report_file="$REPORTS_DIR/comprehensive-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# 📊 MediaNest Documentation Performance Report

**Generated:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**Project:** MediaNest Documentation  
**Report ID:** $(date +%Y%m%d-%H%M%S)

## Summary

This report provides comprehensive performance analysis of the MediaNest documentation system.

### Key Metrics

| Metric | Value | Status |
|--------|-------|---------|
| Build Time | $(ls -t "$REPORTS_DIR"/build-analysis-*.json | head -1 | xargs cat | jq -r '.build_performance.build_time_seconds // "N/A"')s | $(ls -t "$REPORTS_DIR"/build-analysis-*.json | head -1 | xargs cat | jq -r 'if .thresholds.build_time_ok == 1 then "✅ OK" else "⚠️ Warning" end // "N/A"') |
| Site Size | $(ls -t "$REPORTS_DIR"/build-analysis-*.json | head -1 | xargs cat | jq -r '.build_performance.total_size_mb // "N/A"')MB | $(ls -t "$REPORTS_DIR"/build-analysis-*.json | head -1 | xargs cat | jq -r 'if .thresholds.site_size_ok == 1 then "✅ OK" else "⚠️ Warning" end // "N/A"') |
| HTML Files | $(ls -t "$REPORTS_DIR"/build-analysis-*.json | head -1 | xargs cat | jq -r '.file_counts.html_files // "N/A"') | ℹ️ Info |
| Total Files | $(ls -t "$REPORTS_DIR"/build-analysis-*.json | head -1 | xargs cat | jq -r '(.file_counts.html_files + .file_counts.css_files + .file_counts.js_files + .file_counts.image_files) // "N/A"') | ℹ️ Info |

### Performance Thresholds

- **Max Build Time:** ${MAX_BUILD_TIME}s
- **Max Site Size:** ${MAX_SITE_SIZE_MB}MB
- **Min Lighthouse Score:** ${MIN_LIGHTHOUSE_SCORE}%
- **Max Page Load Time:** ${MAX_PAGE_LOAD_MS}ms

## Recommendations

### Build Optimization
- Consider implementing incremental builds for large documentation sets
- Optimize images and assets to reduce site size
- Use caching strategies for frequently accessed content

### Performance Improvements
- Implement CDN for static assets
- Enable compression (gzip/brotli) on server
- Optimize CSS and JavaScript bundles
- Consider lazy loading for images

### Monitoring
- Set up continuous monitoring for production deployments  
- Implement alerting for performance degradation
- Regular link health checks to prevent broken links

## Files Generated

$(ls -la "$REPORTS_DIR"/ | tail -n +2 | while read line; do echo "- $line"; done)

---

*Report generated by MediaNest Documentation Performance Monitor*
EOF
    
    print_success "Comprehensive report generated: $report_file"
    print_info "Report contains detailed analysis and recommendations"
    echo
}

# Clean old reports
cleanup_old_reports() {
    print_section "Cleaning Up Old Reports"
    
    # Keep only last 10 reports of each type
    for report_type in build-analysis lighthouse linkcheck comprehensive-report; do
        local old_files=$(ls -t "$REPORTS_DIR"/${report_type}-*.* 2>/dev/null | tail -n +11 || true)
        if [[ -n "$old_files" ]]; then
            echo "$old_files" | xargs rm -f
            local count=$(echo "$old_files" | wc -l)
            print_info "Cleaned up $count old $report_type reports"
        fi
    done
    
    print_success "Report cleanup completed"
    echo
}

# Main execution
main() {
    print_header
    
    # Parse command line arguments
    local mode="${1:-full}"
    local url="${2:-local}"
    
    case "$mode" in
        "build")
            check_dependencies
            monitor_build_performance
            ;;
        "test")
            if [[ "$url" == "local" ]]; then
                check_dependencies
                test_site_performance "local" "local"
            else
                test_site_performance "$url" "remote"
            fi
            ;;
        "staging")
            test_site_performance "$STAGING_URL" "staging"
            monitor_link_health "$STAGING_URL" "staging"
            ;;
        "production")
            test_site_performance "$PRODUCTION_URL" "production"
            monitor_link_health "$PRODUCTION_URL" "production"
            ;;
        "full")
            check_dependencies
            monitor_build_performance
            test_site_performance "local" "local"
            generate_comprehensive_report
            cleanup_old_reports
            ;;
        "cleanup")
            cleanup_old_reports
            ;;
        *)
            echo "Usage: $0 [build|test|staging|production|full|cleanup] [url]"
            echo ""
            echo "Modes:"
            echo "  build      - Monitor build performance only"
            echo "  test       - Test site performance (local or URL)"
            echo "  staging    - Test staging environment"
            echo "  production - Test production environment" 
            echo "  full       - Complete performance analysis (default)"
            echo "  cleanup    - Clean old reports"
            echo ""
            echo "Examples:"
            echo "  $0 build"
            echo "  $0 test https://docs.medianest.com"
            echo "  $0 staging"
            echo "  $0 production"
            exit 1
            ;;
    esac
    
    print_section "Performance Monitoring Complete"
    print_success "All monitoring tasks completed successfully!"
    print_info "Reports available in: $REPORTS_DIR"
}

# Execute main function with all arguments
main "$@"