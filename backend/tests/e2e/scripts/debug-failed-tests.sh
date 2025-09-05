#!/bin/bash

# Debug Failed Tests Script
# Helps analyze and debug failed E2E tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Default values
REPORTS_DIR="tests/e2e/reports"
RESULTS_DIR="tests/e2e/test-results"
OPEN_BROWSER=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --open)
            OPEN_BROWSER=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Debug Failed Tests Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --open      Open HTML report in browser"
            echo "  -v, --verbose    Show verbose output"
            echo "  -h, --help  Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option $1"
            exit 1
            ;;
    esac
done

# Check if test results exist
check_test_results() {
    log_info "Checking for test results..."
    
    if [ ! -d "$RESULTS_DIR" ]; then
        log_error "No test results found. Run tests first with: npm run test:e2e"
        exit 1
    fi
    
    # Count test result directories
    local result_count=$(find "$RESULTS_DIR" -maxdepth 1 -type d | wc -l)
    if [ $result_count -le 1 ]; then
        log_warning "No test result directories found"
        return 1
    fi
    
    log_success "Found test results in $RESULTS_DIR"
    return 0
}

# Analyze failed tests
analyze_failures() {
    log_info "Analyzing failed tests..."
    
    local failed_tests=()
    local screenshot_count=0
    local video_count=0
    local trace_count=0
    
    # Find all test result directories
    while IFS= read -r -d '' dir; do
        if [ -d "$dir" ]; then
            local test_name=$(basename "$dir")
            
            # Check for screenshots (indicates failure)
            local screenshots=$(find "$dir" -name "*.png" 2>/dev/null | wc -l)
            if [ $screenshots -gt 0 ]; then
                failed_tests+=("$test_name")
                screenshot_count=$((screenshot_count + screenshots))
                
                if [ "$VERBOSE" = true ]; then
                    log_warning "Failed test: $test_name ($screenshots screenshots)"
                    find "$dir" -name "*.png" | head -3 | while read -r screenshot; do
                        echo "  - $(basename "$screenshot")"
                    done
                fi
            fi
            
            # Count videos and traces
            local videos=$(find "$dir" -name "*.webm" 2>/dev/null | wc -l)
            local traces=$(find "$dir" -name "*.zip" 2>/dev/null | wc -l)
            video_count=$((video_count + videos))
            trace_count=$((trace_count + traces))
        fi
    done < <(find "$RESULTS_DIR" -maxdepth 1 -type d -print0)
    
    # Summary
    echo ""
    log_info "Test Failure Summary:"
    echo "  Failed tests: ${#failed_tests[@]}"
    echo "  Screenshots: $screenshot_count"
    echo "  Videos: $video_count"
    echo "  Traces: $trace_count"
    echo ""
    
    if [ ${#failed_tests[@]} -gt 0 ]; then
        log_warning "Failed test cases:"
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
        done
        echo ""
    fi
}

# Show common failure patterns
analyze_patterns() {
    log_info "Analyzing common failure patterns..."
    
    # Look for common error messages in test results
    local common_errors=(
        "TimeoutError"
        "locator.*not found"
        "Test timeout"
        "Connection refused"
        "ECONNRESET"
        "Navigation timeout"
        "Element not visible"
        "AssertionError"
    )
    
    for error in "${common_errors[@]}"; do
        local count=0
        if command -v grep >/dev/null 2>&1; then
            # Search in all log files
            count=$(find "$RESULTS_DIR" -name "*.txt" -o -name "*.log" | xargs grep -l "$error" 2>/dev/null | wc -l)
            if [ $count -gt 0 ]; then
                log_warning "Found '$error' in $count test(s)"
            fi
        fi
    done
}

# Generate debug report
generate_debug_report() {
    log_info "Generating debug report..."
    
    local report_file="$REPORTS_DIR/debug-report.md"
    mkdir -p "$REPORTS_DIR"
    
    cat > "$report_file" << EOF
# E2E Test Debug Report

Generated on: $(date)

## Test Environment

- Node.js: $(node --version)
- Platform: $(uname -s)
- Architecture: $(uname -m)

## Test Results Summary

EOF

    # Add failure analysis
    if [ -d "$RESULTS_DIR" ]; then
        echo "### Failed Tests" >> "$report_file"
        echo "" >> "$report_file"
        
        find "$RESULTS_DIR" -name "*.png" | while read -r screenshot; do
            local test_dir=$(dirname "$screenshot")
            local test_name=$(basename "$test_dir")
            local screenshot_name=$(basename "$screenshot")
            echo "- **$test_name**: $screenshot_name" >> "$report_file"
        done
        
        echo "" >> "$report_file"
        echo "### Artifacts" >> "$report_file"
        echo "" >> "$report_file"
        echo "- Screenshots: $(find "$RESULTS_DIR" -name "*.png" | wc -l)" >> "$report_file"
        echo "- Videos: $(find "$RESULTS_DIR" -name "*.webm" | wc -l)" >> "$report_file"
        echo "- Traces: $(find "$RESULTS_DIR" -name "*.zip" | wc -l)" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Debug Instructions

### 1. View Screenshots
\`\`\`bash
find tests/e2e/test-results -name "*.png" | head -5
\`\`\`

### 2. Watch Failure Videos
\`\`\`bash
find tests/e2e/test-results -name "*.webm" | head -5
\`\`\`

### 3. Analyze Traces
\`\`\`bash
npx playwright show-trace tests/e2e/test-results/*/trace.zip
\`\`\`

### 4. Re-run Failed Tests in Debug Mode
\`\`\`bash
npx playwright test --debug --grep "failed-test-name"
\`\`\`

### 5. Run with Headed Browser
\`\`\`bash
npx playwright test --headed --grep "failed-test-name"
\`\`\`

## Common Solutions

### Timeout Issues
- Increase timeout values in playwright.config.ts
- Add explicit waits: \`await page.waitForSelector()\`
- Check for slow network or database operations

### Element Not Found
- Verify data-testid attributes exist
- Check if element is within viewport
- Wait for element to be visible: \`await expect(element).toBeVisible()\`

### Navigation Issues
- Ensure proper base URL configuration
- Check for authentication redirects
- Verify route handlers are working

### Database Issues
- Ensure test database is running: \`docker-compose -f docker-compose.e2e.yml ps\`
- Re-seed test data: \`npm run e2e:seed\`
- Check database migrations: \`npx prisma migrate status\`

EOF

    log_success "Debug report generated: $report_file"
    
    if [ "$VERBOSE" = true ]; then
        echo ""
        cat "$report_file"
    fi
}

# Open HTML report
open_report() {
    if [ "$OPEN_BROWSER" = true ]; then
        log_info "Opening HTML report..."
        
        local html_report="$REPORTS_DIR/html/index.html"
        if [ -f "$html_report" ]; then
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "$html_report"
            elif command -v open >/dev/null 2>&1; then
                open "$html_report"
            else
                log_warning "Cannot open browser automatically. Open manually: $html_report"
            fi
        else
            log_error "HTML report not found: $html_report"
        fi
    fi
}

# Show debugging tips
show_tips() {
    log_info "Debugging Tips:"
    echo ""
    echo "🔍 Quick Commands:"
    echo "  npx playwright test --debug              # Debug mode"
    echo "  npx playwright test --headed             # Show browser"
    echo "  npx playwright test --ui                 # Interactive UI"
    echo "  npx playwright show-trace trace.zip     # View trace"
    echo "  npx playwright show-report              # View HTML report"
    echo ""
    echo "📊 Analyze Results:"
    echo "  find tests/e2e/test-results -name '*.png' | head -5    # Recent screenshots"
    echo "  find tests/e2e/test-results -name '*.webm' | head -5   # Recent videos"
    echo "  ls -la tests/e2e/test-results/                        # All test results"
    echo ""
    echo "🛠️  Fix Common Issues:"
    echo "  - Increase timeouts in playwright.config.ts"
    echo "  - Add explicit waits: await page.waitForSelector()"
    echo "  - Check data-testid attributes in components"
    echo "  - Verify test data is properly seeded"
    echo "  - Ensure services are running: docker-compose ps"
    echo ""
    echo "📚 Resources:"
    echo "  - Playwright Docs: https://playwright.dev/docs/debug"
    echo "  - Debugging Guide: https://playwright.dev/docs/debug"
    echo "  - Best Practices: https://playwright.dev/docs/best-practices"
}

# Main execution
main() {
    log_info "Starting E2E test debugging analysis..."
    
    if check_test_results; then
        analyze_failures
        analyze_patterns
        generate_debug_report
        open_report
    fi
    
    show_tips
    
    log_success "Debug analysis completed!"
}

# Run main function
main "$@"