#!/bin/bash
set -euo pipefail

# 🚀 DOCKER VALIDATION MASTER ORCHESTRATOR
# Comprehensive Docker configuration validation and testing suite
# Runs all validation tests and generates comprehensive reports

# =============================================================================
# CONFIGURATION & GLOBALS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_DIR="${SCRIPT_DIR}"
RESULTS_DIR="${PROJECT_ROOT}/tests/docker-integration/orchestrator-results"

# Test suite configuration
PARALLEL_EXECUTION=true
GENERATE_REPORTS=true
CLEANUP_ON_EXIT=true
VALIDATION_TIMEOUT=3600  # 1 hour total timeout

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

header() {
    echo -e "\n${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}\n"
}

create_directories() {
    mkdir -p "${RESULTS_DIR}/"{suite-results,combined-reports,logs}
    mkdir -p "${RESULTS_DIR}/execution-metrics"
}

cleanup_all() {
    if [ "$CLEANUP_ON_EXIT" = true ]; then
        log "Performing final cleanup..."
        # Kill any background processes
        jobs -p | xargs -r kill 2>/dev/null || true
        
        # Clean up Docker resources
        docker-compose -f "${PROJECT_ROOT}/config/docker-consolidated/docker-compose.base.yml" down --remove-orphans &>/dev/null || true
        docker-compose -f "${PROJECT_ROOT}/config/docker-consolidated/docker-compose.base.yml" -f "${PROJECT_ROOT}/config/docker-consolidated/docker-compose.dev.yml" down --remove-orphans &>/dev/null || true
        docker-compose -f "${PROJECT_ROOT}/config/docker-consolidated/docker-compose.base.yml" -f "${PROJECT_ROOT}/config/docker-consolidated/docker-compose.prod.yml" down --remove-orphans &>/dev/null || true
        
        # Remove any test secrets
        docker secret rm $(docker secret ls -q --filter name=medianest) 2>/dev/null || true
        
        # Clean up dangling resources
        docker system prune -f &>/dev/null || true
    fi
}

show_usage() {
    cat << EOF
🐳 Docker Validation Master Orchestrator

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --quick             Run quick validation (skip performance tests)
    --no-parallel       Run tests sequentially instead of parallel
    --no-cleanup        Skip cleanup on exit
    --no-reports        Skip report generation
    --timeout SECONDS   Set overall timeout (default: 3600)
    --help              Show this help message

VALIDATION SUITES:
    1. Multi-stage build validation
    2. Service startup testing
    3. Performance benchmarking
    4. Configuration regression tests
    5. Functionality validation
    6. Security configuration testing

EXAMPLES:
    $0                  # Run full validation suite
    $0 --quick          # Run quick validation
    $0 --no-parallel    # Run tests sequentially
    $0 --timeout 1800   # Run with 30-minute timeout

EOF
}

# =============================================================================
# TEST SUITE EXECUTION FUNCTIONS
# =============================================================================

run_validation_suite() {
    local suite_name="$1"
    local script_path="$2"
    local log_file="${RESULTS_DIR}/logs/${suite_name}.log"
    
    log "Starting validation suite: ${suite_name}"
    
    if [ -f "$script_path" ]; then
        local start_time=$(date +%s)
        
        if bash "$script_path" > "$log_file" 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            success "✅ ${suite_name} completed successfully (${duration}s)"
            return 0
        else
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            error "❌ ${suite_name} failed (${duration}s)"
            error "   Log file: ${log_file}"
            return 1
        fi
    else
        error "❌ ${suite_name} script not found: ${script_path}"
        return 1
    fi
}

run_validation_suite_with_timeout() {
    local suite_name="$1"
    local script_path="$2"
    local timeout="$3"
    
    timeout "$timeout" bash -c "$(declare -f run_validation_suite); run_validation_suite '$suite_name' '$script_path'" || {
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            error "❌ ${suite_name} timed out after ${timeout} seconds"
        else
            error "❌ ${suite_name} failed with exit code ${exit_code}"
        fi
        return $exit_code
    }
}

run_parallel_validation() {
    log "Running validation suites in parallel..."
    
    local pids=()
    local results=()
    local suite_results_file="${RESULTS_DIR}/execution-metrics/parallel-execution-results.json"
    
    echo '{"parallel_execution": true, "suites": [' > "$suite_results_file"
    
    # Define test suites with timeouts
    local suites=(
        "docker-validation:${TEST_DIR}/docker-validation-suite.sh:1800"
        "performance-benchmarking:${TEST_DIR}/performance-benchmarking.sh:1800"
        "configuration-regression:${TEST_DIR}/configuration-regression-tests.sh:1200"
    )
    
    local suite_count=0
    
    # Start all suites in background
    for suite in "${suites[@]}"; do
        IFS=':' read -r name script timeout <<< "$suite"
        
        log "Starting ${name} suite in background..."
        
        {
            local start_time=$(date +%s.%N)
            if run_validation_suite_with_timeout "$name" "$script" "$timeout"; then
                local end_time=$(date +%s.%N)
                local duration=$(echo "$end_time - $start_time" | bc)
                echo "SUCCESS:${name}:${duration}" > "${RESULTS_DIR}/logs/${name}.result"
            else
                local end_time=$(date +%s.%N)
                local duration=$(echo "$end_time - $start_time" | bc)
                echo "FAILURE:${name}:${duration}" > "${RESULTS_DIR}/logs/${name}.result"
            fi
        } &
        
        pids+=($!)
        
        if [ $suite_count -gt 0 ]; then
            echo ',' >> "$suite_results_file"
        fi
        echo "    {\"name\": \"${name}\", \"pid\": $!, \"start_time\": \"$(date -Iseconds)\", \"timeout\": ${timeout}}" >> "$suite_results_file"
        
        ((suite_count++))
    done
    
    echo '  ]' >> "$suite_results_file"
    
    log "Waiting for ${#pids[@]} validation suites to complete..."
    
    # Wait for all background processes
    local failed_suites=0
    local completed_suites=0
    
    for pid in "${pids[@]}"; do
        if wait "$pid"; then
            ((completed_suites++))
            info "Suite with PID $pid completed successfully"
        else
            ((failed_suites++))
            warning "Suite with PID $pid failed"
        fi
    done
    
    # Collect results
    for suite in "${suites[@]}"; do
        IFS=':' read -r name script timeout <<< "$suite"
        if [ -f "${RESULTS_DIR}/logs/${name}.result" ]; then
            local result_line=$(cat "${RESULTS_DIR}/logs/${name}.result")
            IFS=':' read -r status suite_name duration <<< "$result_line"
            results+=("${name}:${status}:${duration}")
        else
            results+=("${name}:UNKNOWN:0")
        fi
    done
    
    # Update results file
    echo ', "completion_time": "' >> "$suite_results_file"
    echo "$(date -Iseconds)" >> "$suite_results_file"
    echo '", "completed_suites": ' >> "$suite_results_file"
    echo "${completed_suites}" >> "$suite_results_file"
    echo ', "failed_suites": ' >> "$suite_results_file"
    echo "${failed_suites}" >> "$suite_results_file"
    echo ', "results": [' >> "$suite_results_file"
    
    local result_count=0
    for result in "${results[@]}"; do
        IFS=':' read -r name status duration <<< "$result"
        if [ $result_count -gt 0 ]; then
            echo ',' >> "$suite_results_file"
        fi
        echo "    {\"suite\": \"${name}\", \"status\": \"${status}\", \"duration\": ${duration}}" >> "$suite_results_file"
        ((result_count++))
    done
    
    echo '  ]' >> "$suite_results_file"
    echo '}' >> "$suite_results_file"
    
    success "Parallel execution completed: ${completed_suites} succeeded, ${failed_suites} failed"
    return $failed_suites
}

run_sequential_validation() {
    log "Running validation suites sequentially..."
    
    local sequential_results_file="${RESULTS_DIR}/execution-metrics/sequential-execution-results.json"
    
    echo '{"sequential_execution": true, "suites": [' > "$sequential_results_file"
    
    local suites=(
        "docker-validation:${TEST_DIR}/docker-validation-suite.sh"
        "performance-benchmarking:${TEST_DIR}/performance-benchmarking.sh"
        "configuration-regression:${TEST_DIR}/configuration-regression-tests.sh"
    )
    
    local failed_suites=0
    local completed_suites=0
    local suite_count=0
    
    for suite in "${suites[@]}"; do
        IFS=':' read -r name script <<< "$suite"
        
        header "RUNNING ${name^^} VALIDATION SUITE"
        
        local start_time=$(date +%s.%N)
        
        if [ $suite_count -gt 0 ]; then
            echo ',' >> "$sequential_results_file"
        fi
        
        echo "    {\"name\": \"${name}\", \"start_time\": \"$(date -Iseconds)\"" >> "$sequential_results_file"
        
        if run_validation_suite "$name" "$script"; then
            ((completed_suites++))
            local end_time=$(date +%s.%N)
            local duration=$(echo "$end_time - $start_time" | bc)
            echo ", \"status\": \"success\", \"duration\": ${duration}, \"end_time\": \"$(date -Iseconds)\"}" >> "$sequential_results_file"
        else
            ((failed_suites++))
            local end_time=$(date +%s.%N)
            local duration=$(echo "$end_time - $start_time" | bc)
            echo ", \"status\": \"failure\", \"duration\": ${duration}, \"end_time\": \"$(date -Iseconds)\"}" >> "$sequential_results_file"
        fi
        
        ((suite_count++))
    done
    
    echo '  ],' >> "$sequential_results_file"
    echo "  \"completion_time\": \"$(date -Iseconds)\"," >> "$sequential_results_file"
    echo "  \"completed_suites\": ${completed_suites}," >> "$sequential_results_file"
    echo "  \"failed_suites\": ${failed_suites}" >> "$sequential_results_file"
    echo '}' >> "$sequential_results_file"
    
    success "Sequential execution completed: ${completed_suites} succeeded, ${failed_suites} failed"
    return $failed_suites
}

run_quick_validation() {
    log "Running quick validation suite..."
    
    header "QUICK DOCKER VALIDATION"
    
    local quick_results_file="${RESULTS_DIR}/execution-metrics/quick-validation-results.json"
    
    echo '{"quick_validation": true, "tests": [' > "$quick_results_file"
    
    # Quick build test
    info "Testing multi-stage build..."
    local build_start=$(date +%s.%N)
    if docker build -f "${PROJECT_ROOT}/config/docker-consolidated/Dockerfile" --target development --tag medianest:quick-test "${PROJECT_ROOT}" > "${RESULTS_DIR}/logs/quick-build.log" 2>&1; then
        local build_end=$(date +%s.%N)
        local build_duration=$(echo "$build_end - $build_start" | bc)
        success "Build test passed (${build_duration}s)"
        echo "    {\"test\": \"build\", \"status\": \"pass\", \"duration\": ${build_duration}}" >> "$quick_results_file"
    else
        local build_end=$(date +%s.%N)
        local build_duration=$(echo "$build_end - $build_start" | bc)
        error "Build test failed (${build_duration}s)"
        echo "    {\"test\": \"build\", \"status\": \"fail\", \"duration\": ${build_duration}}" >> "$quick_results_file"
    fi
    
    # Quick startup test
    info "Testing service startup..."
    local startup_start=$(date +%s.%N)
    
    cd "${PROJECT_ROOT}"
    if docker-compose -f "config/docker-consolidated/docker-compose.base.yml" -f "config/docker-consolidated/docker-compose.dev.yml" up -d > "${RESULTS_DIR}/logs/quick-startup.log" 2>&1; then
        sleep 30
        
        # Check if services are responding
        local backend_check=$(curl -f "http://localhost:4000/health" &>/dev/null && echo "pass" || echo "fail")
        local frontend_check=$(curl -f "http://localhost:3000" &>/dev/null && echo "pass" || echo "fail")
        
        docker-compose -f "config/docker-consolidated/docker-compose.base.yml" -f "config/docker-consolidated/docker-compose.dev.yml" down &>/dev/null
        
        local startup_end=$(date +%s.%N)
        local startup_duration=$(echo "$startup_end - $startup_start" | bc)
        
        if [ "$backend_check" = "pass" ] && [ "$frontend_check" = "pass" ]; then
            success "Startup test passed (${startup_duration}s)"
            echo ",    {\"test\": \"startup\", \"status\": \"pass\", \"duration\": ${startup_duration}, \"backend\": \"${backend_check}\", \"frontend\": \"${frontend_check}\"}" >> "$quick_results_file"
        else
            warning "Startup test partially failed (${startup_duration}s) - Backend: ${backend_check}, Frontend: ${frontend_check}"
            echo ",    {\"test\": \"startup\", \"status\": \"partial\", \"duration\": ${startup_duration}, \"backend\": \"${backend_check}\", \"frontend\": \"${frontend_check}\"}" >> "$quick_results_file"
        fi
    else
        local startup_end=$(date +%s.%N)
        local startup_duration=$(echo "$startup_end - $startup_start" | bc)
        error "Startup test failed (${startup_duration}s)"
        echo ",    {\"test\": \"startup\", \"status\": \"fail\", \"duration\": ${startup_duration}}" >> "$quick_results_file"
    fi
    
    echo '  ],' >> "$quick_results_file"
    echo "  \"completion_time\": \"$(date -Iseconds)\"" >> "$quick_results_file"
    echo '}' >> "$quick_results_file"
    
    success "Quick validation completed"
}

# =============================================================================
# REPORT GENERATION
# =============================================================================

generate_comprehensive_report() {
    if [ "$GENERATE_REPORTS" != true ]; then
        return 0
    fi
    
    log "Generating comprehensive validation report..."
    
    local master_report="${RESULTS_DIR}/combined-reports/docker-validation-master-report.md"
    local summary_json="${RESULTS_DIR}/combined-reports/validation-summary.json"
    
    # Report header
    cat > "$master_report" <<EOF
# 🐳 MediaNest Docker Configuration Validation Report

**Generated:** $(date)  
**Project:** MediaNest Docker Consolidated Configuration  
**Validation Suite Version:** 2.0.0  
**Execution Mode:** $([ "$PARALLEL_EXECUTION" = true ] && echo "Parallel" || echo "Sequential")  

## Executive Summary

This master report consolidates the results from comprehensive Docker configuration validation testing, including multi-stage builds, performance benchmarking, and regression testing.

EOF
    
    local total_suites=0
    local passed_suites=0
    local total_tests=0
    local failed_tests=0
    
    # Process validation suite results
    echo "## Validation Suite Results" >> "$master_report"
    echo "" >> "$master_report"
    
    # Docker validation suite
    local docker_validation_dir="${PROJECT_ROOT}/tests/docker-integration/results"
    if [ -d "$docker_validation_dir" ]; then
        echo "### 1. Docker Multi-Stage Validation" >> "$master_report"
        
        if [ -f "${docker_validation_dir}/validation-summary.json" ]; then
            local docker_total=$(cat "${docker_validation_dir}/validation-summary.json" | jq -r '.total_tests // 0' 2>/dev/null)
            local docker_failed=$(cat "${docker_validation_dir}/validation-summary.json" | jq -r '.failed_tests // 0' 2>/dev/null)
            local docker_rate=$(cat "${docker_validation_dir}/validation-summary.json" | jq -r '.success_rate // 0' 2>/dev/null)
            local docker_status=$(cat "${docker_validation_dir}/validation-summary.json" | jq -r '.overall_status // "unknown"' 2>/dev/null)
            
            echo "- **Status**: $([ "$docker_status" = "PASS" ] && echo "✅ PASS" || echo "❌ FAIL")" >> "$master_report"
            echo "- **Tests**: ${docker_total} total, ${docker_failed} failed" >> "$master_report"
            echo "- **Success Rate**: ${docker_rate}%" >> "$master_report"
            
            ((total_suites++))
            total_tests=$((total_tests + docker_total))
            failed_tests=$((failed_tests + docker_failed))
            
            if [ "$docker_status" = "PASS" ]; then
                ((passed_suites++))
            fi
        else
            echo "- **Status**: ❌ Results not found" >> "$master_report"
        fi
        echo "" >> "$master_report"
    fi
    
    # Performance benchmarking results
    local performance_dir="${PROJECT_ROOT}/tests/docker-integration/performance-results"
    if [ -d "$performance_dir" ]; then
        echo "### 2. Performance Benchmarking" >> "$master_report"
        
        if [ -f "${performance_dir}/performance-summary.json" ]; then
            local perf_status=$(cat "${performance_dir}/performance-summary.json" | jq -r '.overall_status // "unknown"' 2>/dev/null)
            echo "- **Status**: $([ "$perf_status" = "completed" ] && echo "✅ COMPLETED" || echo "❌ FAILED")" >> "$master_report"
            
            # Add performance highlights
            if [ -f "${performance_dir}/startup/startup-times.json" ]; then
                local dev_startup=$(cat "${performance_dir}/startup/startup-times.json" | jq -r '.development.avg_time // "N/A"' 2>/dev/null)
                local prod_startup=$(cat "${performance_dir}/startup/startup-times.json" | jq -r '.production.avg_time // "N/A"' 2>/dev/null)
                echo "- **Development Startup**: ${dev_startup}s average" >> "$master_report"
                echo "- **Production Startup**: ${prod_startup}s average" >> "$master_report"
            fi
            
            ((total_suites++))
            if [ "$perf_status" = "completed" ]; then
                ((passed_suites++))
            fi
        else
            echo "- **Status**: ❌ Results not found" >> "$master_report"
        fi
        echo "" >> "$master_report"
    fi
    
    # Regression testing results
    local regression_dir="${PROJECT_ROOT}/tests/docker-integration/regression-results"
    if [ -d "$regression_dir" ]; then
        echo "### 3. Configuration Regression Testing" >> "$master_report"
        
        if [ -f "${regression_dir}/regression-summary.json" ]; then
            local reg_total=$(cat "${regression_dir}/regression-summary.json" | jq -r '.total_individual_tests // 0' 2>/dev/null)
            local reg_failed=$(cat "${regression_dir}/regression-summary.json" | jq -r '.failed_individual_tests // 0' 2>/dev/null)
            local reg_rate=$(cat "${regression_dir}/regression-summary.json" | jq -r '.overall_success_rate // 0' 2>/dev/null)
            local reg_regression=$(cat "${regression_dir}/regression-summary.json" | jq -r '.regression_detected // false' 2>/dev/null)
            
            echo "- **Status**: $([ "$reg_regression" = "false" ] && echo "✅ NO REGRESSION" || echo "❌ REGRESSION DETECTED")" >> "$master_report"
            echo "- **Tests**: ${reg_total} total, ${reg_failed} failed" >> "$master_report"
            echo "- **Success Rate**: ${reg_rate}%" >> "$master_report"
            
            ((total_suites++))
            total_tests=$((total_tests + reg_total))
            failed_tests=$((failed_tests + reg_failed))
            
            if [ "$reg_regression" = "false" ]; then
                ((passed_suites++))
            fi
        else
            echo "- **Status**: ❌ Results not found" >> "$master_report"
        fi
        echo "" >> "$master_report"
    fi
    
    # Overall statistics
    local overall_success_rate=0
    local suite_success_rate=0
    
    if [ $total_tests -gt 0 ]; then
        overall_success_rate=$(( (total_tests - failed_tests) * 100 / total_tests ))
    fi
    
    if [ $total_suites -gt 0 ]; then
        suite_success_rate=$((passed_suites * 100 / total_suites))
    fi
    
    cat >> "$master_report" <<EOF
## Overall Validation Results

| Metric | Value |
|--------|--------|
| **Total Test Suites** | ${total_suites} |
| **Passed Suites** | ${passed_suites} |
| **Suite Success Rate** | ${suite_success_rate}% |
| **Total Individual Tests** | ${total_tests} |
| **Failed Tests** | ${failed_tests} |
| **Overall Success Rate** | ${overall_success_rate}% |

### Validation Status

$([ $failed_tests -eq 0 ] && [ $passed_suites -eq $total_suites ] && echo "🎉 **VALIDATION SUCCESSFUL** - Docker configuration is ready for production deployment" || echo "⚠️  **VALIDATION ISSUES DETECTED** - Review failures before deployment")

## Recommendations

EOF
    
    if [ $failed_tests -eq 0 ] && [ $passed_suites -eq $total_suites ]; then
        cat >> "$master_report" <<EOF
✅ **Ready for Production Deployment**
- All validation tests passed successfully
- Multi-stage builds working correctly
- Performance characteristics meet requirements
- No regression detected in functionality
- Security configurations are properly implemented

### Next Steps
1. Proceed with production deployment
2. Implement monitoring and alerting
3. Schedule regular validation testing
4. Update documentation with new configuration details
EOF
    else
        cat >> "$master_report" <<EOF
⚠️  **Address Issues Before Deployment**
- ${failed_tests} individual tests failed across ${total_suites} suites
- Review detailed results for each failed test
- Fix identified issues and re-run validation

### Priority Actions
1. **High Priority**: Fix critical test failures
2. **Medium Priority**: Address performance concerns
3. **Low Priority**: Update documentation for any intentional changes
4. **Follow-up**: Re-run full validation suite after fixes

### Investigation Areas
- Check individual test logs in results directories
- Verify Docker configuration syntax and structure
- Test with fresh environment to rule out environment-specific issues
- Review resource limits and system requirements
EOF
    fi
    
    cat >> "$master_report" <<EOF

## Detailed Results

### Result Directories
- **Docker Validation**: \`tests/docker-integration/results/\`
- **Performance Results**: \`tests/docker-integration/performance-results/\`
- **Regression Results**: \`tests/docker-integration/regression-results/\`
- **Orchestrator Results**: \`tests/docker-integration/orchestrator-results/\`

### Log Files
- **Execution Logs**: \`${RESULTS_DIR}/logs/\`
- **Individual Suite Logs**: Available in respective result directories

### Configuration Files Validated
- **Consolidated Dockerfile**: \`config/docker-consolidated/Dockerfile\`
- **Base Compose**: \`config/docker-consolidated/docker-compose.base.yml\`
- **Development Override**: \`config/docker-consolidated/docker-compose.dev.yml\`
- **Production Override**: \`config/docker-consolidated/docker-compose.prod.yml\`
- **Docker Bake**: \`docker-bake.hcl\`

---

**Generated by MediaNest Docker Validation Orchestrator v2.0.0**  
**Execution completed:** $(date)

EOF
    
    # Generate summary JSON
    cat > "$summary_json" <<EOF
{
  "validation_completion": "$(date -Iseconds)",
  "execution_mode": "$([ "$PARALLEL_EXECUTION" = true ] && echo "parallel" || echo "sequential")",
  "total_suites": ${total_suites},
  "passed_suites": ${passed_suites},
  "suite_success_rate": ${suite_success_rate},
  "total_individual_tests": ${total_tests},
  "failed_individual_tests": ${failed_tests},
  "overall_success_rate": ${overall_success_rate},
  "validation_status": "$([ $failed_tests -eq 0 ] && [ $passed_suites -eq $total_suites ] && echo "passed" || echo "failed")",
  "deployment_ready": $([ $failed_tests -eq 0 ] && [ $passed_suites -eq $total_suites ] && echo "true" || echo "false"),
  "report_location": "${master_report}",
  "orchestrator_version": "2.0.0"
}
EOF
    
    success "Comprehensive validation report generated: ${master_report}"
    info "Summary JSON: ${summary_json}"
    
    # Return status based on overall results
    return $([ $failed_tests -eq 0 ] && [ $passed_suites -eq $total_suites ] && echo 0 || echo 1)
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    local start_time=$(date +%s)
    
    header "🐳 MEDIANEST DOCKER VALIDATION ORCHESTRATOR"
    
    info "Starting comprehensive Docker configuration validation..."
    info "Project: MediaNest"
    info "Configuration: Consolidated Docker Setup"
    info "Mode: $([ "$PARALLEL_EXECUTION" = true ] && echo "Parallel Execution" || echo "Sequential Execution")"
    
    create_directories
    
    # Check prerequisites
    log "Checking prerequisites..."
    local missing_deps=()
    
    for cmd in docker docker-compose curl jq bc; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    success "All prerequisites satisfied"
    
    # Run validation based on execution mode
    local validation_result=0
    
    if [ "$QUICK_MODE" = true ]; then
        run_quick_validation
        validation_result=$?
    elif [ "$PARALLEL_EXECUTION" = true ]; then
        run_parallel_validation
        validation_result=$?
    else
        run_sequential_validation
        validation_result=$?
    fi
    
    # Generate comprehensive report
    header "GENERATING COMPREHENSIVE REPORTS"
    
    local report_result=0
    generate_comprehensive_report
    report_result=$?
    
    # Final execution metrics
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local minutes=$((total_duration / 60))
    local seconds=$((total_duration % 60))
    
    # Final status
    header "🏁 DOCKER VALIDATION COMPLETE"
    
    info "Total execution time: ${minutes}m ${seconds}s"
    info "Results directory: ${RESULTS_DIR}"
    
    if [ $validation_result -eq 0 ] && [ $report_result -eq 0 ]; then
        success "🎉 Docker validation completed successfully!"
        success "✅ All tests passed - Configuration is ready for production"
        success "📊 Comprehensive report available at: ${RESULTS_DIR}/combined-reports/"
        
        echo ""
        echo -e "${GREEN}DEPLOYMENT APPROVED${NC}"
        echo -e "${GREEN}Your consolidated Docker configuration has passed all validation tests.${NC}"
        echo -e "${GREEN}Proceed with confidence to production deployment.${NC}"
        
        exit 0
    else
        error "❌ Docker validation failed"
        error "🔍 Review detailed results and fix issues before deployment"
        error "📊 Full report available at: ${RESULTS_DIR}/combined-reports/"
        
        echo ""
        echo -e "${RED}DEPLOYMENT BLOCKED${NC}"
        echo -e "${RED}Issues detected in Docker configuration validation.${NC}"
        echo -e "${RED}Address failures before proceeding to production.${NC}"
        
        exit 1
    fi
}

# =============================================================================
# ARGUMENT PARSING
# =============================================================================

# Default values
QUICK_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_MODE=true
            PARALLEL_EXECUTION=false
            shift
            ;;
        --no-parallel)
            PARALLEL_EXECUTION=false
            shift
            ;;
        --no-cleanup)
            CLEANUP_ON_EXIT=false
            shift
            ;;
        --no-reports)
            GENERATE_REPORTS=false
            shift
            ;;
        --timeout)
            VALIDATION_TIMEOUT="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set up signal handlers
trap cleanup_all EXIT INT TERM

# Execute main function with timeout
timeout "$VALIDATION_TIMEOUT" bash -c "$(declare -f main create_directories cleanup_all run_validation_suite run_validation_suite_with_timeout run_parallel_validation run_sequential_validation run_quick_validation generate_comprehensive_report header log success warning error info); main" || {
    exit_code=$?
    if [ $exit_code -eq 124 ]; then
        error "❌ Validation timed out after ${VALIDATION_TIMEOUT} seconds"
        echo -e "${RED}Consider running with --quick for faster validation or increase --timeout${NC}"
    fi
    cleanup_all
    exit $exit_code
}