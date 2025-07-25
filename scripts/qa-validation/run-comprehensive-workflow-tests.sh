#!/bin/bash
# 4-Tier Workflow Comprehensive Testing Suite
# QA Coordinator Agent - End-to-End Validation Master Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🧪 QA COMPREHENSIVE VALIDATION: 4-Tier Workflow Testing Suite${NC}"
echo "=================================================================="
echo -e "${CYAN}🤖 Designed by QA Coordinator Agent${NC}"
echo -e "${CYAN}📋 Comprehensive testing framework for workflow reorganization${NC}"
echo "=================================================================="

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="/tmp/qa-validation-results-$(date +%s)"
FINAL_REPORT="$RESULTS_DIR/comprehensive-validation-report.json"

# Test suite configuration
declare -A TEST_SUITES
TEST_SUITES=(
    ["branch-structure"]="$SCRIPT_DIR/test-branch-structure.sh"
    ["merge-workflow"]="$SCRIPT_DIR/test-merge-workflow.sh"
    ["environment-deployment"]="$SCRIPT_DIR/test-environment-deployment.sh"
    ["rollback-procedures"]="$SCRIPT_DIR/test-rollback-procedures.sh"
)

# Global validation state
OVERALL_VALIDATION_PASSED=true
CRITICAL_FAILURES=0
WARNING_COUNT=0
TOTAL_TESTS_RUN=0

# Function to log master results
log_master_result() {
    local test_suite="$1"
    local status="$2"
    local details="$3"
    
    ((TOTAL_TESTS_RUN++))
    
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ $test_suite: PASSED${NC}"
        [ -n "$details" ] && echo -e "   Summary: $details"
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}⚠️ $test_suite: PASSED WITH WARNINGS${NC}"
        [ -n "$details" ] && echo -e "   Warnings: $details"
        ((WARNING_COUNT++))
    elif [ "$status" = "skip" ]; then
        echo -e "${YELLOW}⏭️ $test_suite: SKIPPED${NC}"
        [ -n "$details" ] && echo -e "   Reason: $details"
    else
        echo -e "${RED}❌ $test_suite: FAILED${NC}"
        [ -n "$details" ] && echo -e "   Error: $details"
        ((CRITICAL_FAILURES++))
        OVERALL_VALIDATION_PASSED=false
    fi
}

# Function to initialize results directory
initialize_results() {
    mkdir -p "$RESULTS_DIR"
    
    cat > "$FINAL_REPORT" << EOF
{
  "validation_timestamp": "$(date -Iseconds)",
  "validation_type": "comprehensive_4tier_workflow",
  "project_root": "$PROJECT_ROOT",
  "results_directory": "$RESULTS_DIR",
  "test_suites": {},
  "summary": {
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "skipped": 0,
    "critical_failures": 0,
    "overall_status": "pending"
  },
  "recommendations": [],
  "next_steps": []
}
EOF
    
    echo -e "${BLUE}📁 Results directory created: $RESULTS_DIR${NC}"
}

# Function to run individual test suite
run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    
    echo -e "\n${BLUE}🧪 Running Test Suite: $suite_name${NC}"
    echo "=================================================================="
    
    if [ ! -f "$script_path" ]; then
        log_master_result "$suite_name" "fail" "Test script not found: $script_path"
        return 1
    fi
    
    # Make script executable
    chmod +x "$script_path"
    
    # Run the test suite and capture results
    local start_time=$(date +%s)
    local suite_output_file="$RESULTS_DIR/${suite_name}-output.log"
    local suite_result_file="$RESULTS_DIR/${suite_name}-results.json"
    
    if "$script_path" > "$suite_output_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Check for warnings in output
        if grep -q "⚠️\|WARN" "$suite_output_file"; then
            local warning_count=$(grep -c "⚠️\|WARN" "$suite_output_file")
            log_master_result "$suite_name" "warn" "Completed with $warning_count warnings in ${duration}s"
        else
            log_master_result "$suite_name" "pass" "All tests passed in ${duration}s"
        fi
        
        # Copy individual test results if they exist
        local individual_report="/tmp/${suite_name}-validation.json"
        if [ -f "$individual_report" ]; then
            cp "$individual_report" "$suite_result_file"
        fi
        
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_master_result "$suite_name" "fail" "Test suite failed after ${duration}s"
        
        # Show last few lines of error output
        echo -e "${RED}   Last 5 lines of error output:${NC}"
        tail -5 "$suite_output_file" | sed 's/^/   /'
    fi
}

# Function to run prerequisite checks
run_prerequisite_checks() {
    echo -e "\n${BLUE}🔍 Running Prerequisite Checks${NC}"
    echo "=================================================================="
    
    local prereq_passed=true
    
    # Check 1: Git repository
    if [ -d "$PROJECT_ROOT/.git" ]; then
        echo -e "${GREEN}✅ Git repository found${NC}"
    else
        echo -e "${RED}❌ Not a git repository${NC}"
        prereq_passed=false
    fi
    
    # Check 2: Required branches exist
    local required_branches=("main" "development" "test" "claude-flowv2")
    for branch in "${required_branches[@]}"; do
        if git show-ref --verify --quiet refs/heads/$branch; then
            echo -e "${GREEN}✅ Branch exists: $branch${NC}"
        else
            echo -e "${RED}❌ Missing required branch: $branch${NC}"
            prereq_passed=false
        fi
    done
    
    # Check 3: Test scripts exist
    local missing_scripts=0
    for suite_name in "${!TEST_SUITES[@]}"; do
        local script_path="${TEST_SUITES[$suite_name]}"
        if [ -f "$script_path" ]; then
            echo -e "${GREEN}✅ Test script found: $suite_name${NC}"
        else
            echo -e "${RED}❌ Missing test script: $script_path${NC}"
            ((missing_scripts++))
            prereq_passed=false
        fi
    done
    
    # Check 4: Required tools
    local tools=("git" "jq")
    for tool in "${tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Tool available: $tool${NC}"
        else
            echo -e "${YELLOW}⚠️ Optional tool missing: $tool${NC}"
            echo -e "   Some features may be limited without $tool"
        fi
    done
    
    if [ "$prereq_passed" = false ]; then
        echo -e "\n${RED}❌ PREREQUISITE CHECKS FAILED${NC}"
        echo -e "${YELLOW}Fix the issues above before running comprehensive validation${NC}"
        exit 1
    else
        echo -e "\n${GREEN}✅ All prerequisite checks passed${NC}"
    fi
}

# Function to generate comprehensive report
generate_comprehensive_report() {
    echo -e "\n${BLUE}📊 Generating Comprehensive Report${NC}"
    echo "=================================================================="
    
    # Update final report with summary
    if command -v jq >/dev/null 2>&1; then
        local passed_count=$((TOTAL_TESTS_RUN - CRITICAL_FAILURES))
        
        jq --arg total "$TOTAL_TESTS_RUN" \
           --arg passed "$passed_count" \
           --arg failed "$CRITICAL_FAILURES" \
           --arg warnings "$WARNING_COUNT" \
           --arg status "$([ "$OVERALL_VALIDATION_PASSED" = true ] && echo "passed" || echo "failed")" \
           '.summary.total_tests = ($total | tonumber) |
            .summary.passed = ($passed | tonumber) |
            .summary.failed = ($failed | tonumber) |
            .summary.warnings = ($warnings | tonumber) |
            .summary.critical_failures = ($failed | tonumber) |
            .summary.overall_status = $status' \
           "$FINAL_REPORT" > "${FINAL_REPORT}.tmp" && mv "${FINAL_REPORT}.tmp" "$FINAL_REPORT"
    fi
    
    # Add recommendations based on results
    local recommendations=()
    if [ "$CRITICAL_FAILURES" -gt 0 ]; then
        recommendations+=("Address critical failures before proceeding with workflow reorganization")
        recommendations+=("Review detailed test results in $RESULTS_DIR")
        recommendations+=("Consider implementing missing branch protection or configuration")
    fi
    
    if [ "$WARNING_COUNT" -gt 0 ]; then
        recommendations+=("Review warnings and implement recommended improvements")
        recommendations+=("Consider adding missing documentation or configuration files")
    fi
    
    if [ "$OVERALL_VALIDATION_PASSED" = true ]; then
        recommendations+=("4-tier workflow is ready for implementation")
        recommendations+=("Consider running validation again after any infrastructure changes")
        recommendations+=("Implement continuous monitoring for workflow health")
    fi
    
    # Create markdown report
    local markdown_report="$RESULTS_DIR/comprehensive-validation-report.md"
    cat > "$markdown_report" << EOF
# 4-Tier Workflow Comprehensive Validation Report

## Executive Summary

**Validation Status**: $([ "$OVERALL_VALIDATION_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")  
**Test Date**: $(date)  
**Total Test Suites**: $TOTAL_TESTS_RUN  
**Critical Failures**: $CRITICAL_FAILURES  
**Warnings**: $WARNING_COUNT  

## Test Suite Results

EOF
    
    # Add individual test suite results
    for suite_name in "${!TEST_SUITES[@]}"; do
        echo "### $suite_name" >> "$markdown_report"
        echo "" >> "$markdown_report"
        
        local log_file="$RESULTS_DIR/${suite_name}-output.log"
        if [ -f "$log_file" ]; then
            echo "**Status**: $(grep -q "PASSED" "$log_file" && echo "✅ PASSED" || echo "❌ FAILED")" >> "$markdown_report"
            echo "" >> "$markdown_report"
            echo "**Details**: See \`${suite_name}-output.log\`" >> "$markdown_report"
        else
            echo "**Status**: ⏭️ SKIPPED (script not found)" >> "$markdown_report"
        fi
        echo "" >> "$markdown_report"
    done
    
    # Add recommendations
    echo "## Recommendations" >> "$markdown_report"
    echo "" >> "$markdown_report"
    for rec in "${recommendations[@]}"; do
        echo "- $rec" >> "$markdown_report"
    done
    
    echo -e "${GREEN}📄 Markdown report generated: $markdown_report${NC}"
    echo -e "${GREEN}📋 JSON report available: $FINAL_REPORT${NC}"
}

# Function to display final summary
display_final_summary() {
    echo -e "\n=================================================================="
    echo -e "${PURPLE}🏁 COMPREHENSIVE VALIDATION SUMMARY${NC}"
    echo "=================================================================="
    
    echo -e "${BLUE}📊 Test Results Overview:${NC}"
    echo "   Total Test Suites: $TOTAL_TESTS_RUN"
    echo "   Passed: $((TOTAL_TESTS_RUN - CRITICAL_FAILURES))"
    echo "   Failed: $CRITICAL_FAILURES"
    echo "   Warnings: $WARNING_COUNT"
    
    echo -e "\n${BLUE}📁 Results Location:${NC}"
    echo "   Directory: $RESULTS_DIR"
    echo "   JSON Report: $FINAL_REPORT"
    echo "   Markdown Report: $RESULTS_DIR/comprehensive-validation-report.md"
    
    if [ "$OVERALL_VALIDATION_PASSED" = true ]; then
        echo -e "\n${GREEN}🎉 COMPREHENSIVE VALIDATION: PASSED${NC}"
        echo -e "${GREEN}✅ 4-Tier Workflow is ready for implementation!${NC}"
        echo ""
        echo -e "${BLUE}📋 Workflow Summary:${NC}"
        echo "• ✅ Branch structure validated"
        echo "• ✅ Merge workflows operational"
        echo "• ✅ Environment deployments ready"
        echo "• ✅ Rollback procedures validated"
        echo ""
        echo -e "${GREEN}🚀 You can proceed with confidence!${NC}"
        
        if [ "$WARNING_COUNT" -gt 0 ]; then
            echo -e "\n${YELLOW}📝 Note: $WARNING_COUNT warnings were found${NC}"
            echo -e "${YELLOW}Review the detailed reports to address non-critical issues${NC}"
        fi
        
    else
        echo -e "\n${RED}❌ COMPREHENSIVE VALIDATION: FAILED${NC}"
        echo -e "${RED}🛑 $CRITICAL_FAILURES critical failures detected${NC}"
        echo ""
        echo -e "${YELLOW}📝 Required Actions:${NC}"
        echo "• Review failed test suites in detail"
        echo "• Address critical infrastructure issues"
        echo "• Re-run validation after fixes"
        echo "• Do not proceed with workflow reorganization until all tests pass"
        echo ""
        echo -e "${RED}⚠️ Proceeding without fixing failures could result in:${NC}"
        echo "• Loss of git history or branches"
        echo "• Deployment failures"
        echo "• Inability to rollback changes"
        echo "• Disruption to development workflow"
    fi
    
    echo -e "\n${BLUE}🔗 Next Steps:${NC}"
    if [ "$OVERALL_VALIDATION_PASSED" = true ]; then
        echo "1. Review any warnings in the detailed reports"
        echo "2. Implement the 4-tier workflow reorganization"
        echo "3. Set up continuous monitoring"
        echo "4. Train team on new workflow procedures"
    else
        echo "1. Review the detailed failure reports in $RESULTS_DIR"
        echo "2. Fix critical infrastructure issues"
        echo "3. Re-run this comprehensive validation"
        echo "4. Only proceed after all tests pass"
    fi
    
    echo "=================================================================="
}

# Function to handle script interruption
cleanup() {
    echo -e "\n${YELLOW}⚠️ Validation interrupted${NC}"
    echo -e "Partial results available in: $RESULTS_DIR"
    exit 130
}

# Trap to handle Ctrl+C
trap cleanup SIGINT

# Main execution function
main() {
    echo -e "Starting comprehensive 4-tier workflow validation at $(date)"
    echo -e "Project root: $PROJECT_ROOT"
    echo -e "Script directory: $SCRIPT_DIR"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Initialize results
    initialize_results
    
    # Run prerequisite checks
    run_prerequisite_checks
    
    # Run each test suite
    echo -e "\n${PURPLE}🧪 RUNNING TEST SUITES${NC}"
    echo "=================================================================="
    
    for suite_name in "${!TEST_SUITES[@]}"; do
        run_test_suite "$suite_name" "${TEST_SUITES[$suite_name]}"
    done
    
    # Generate comprehensive report
    generate_comprehensive_report
    
    # Display final summary
    display_final_summary
    
    # Exit with appropriate code
    if [ "$OVERALL_VALIDATION_PASSED" = true ]; then
        exit 0
    else
        exit 1
    fi
}

# Usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "4-Tier Workflow Comprehensive Testing Suite"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  --skip-prereq           Skip prerequisite checks"
    echo "  --suite <name>          Run only specific test suite"
    echo "  --results-dir <path>    Custom results directory"
    echo ""
    echo "Available test suites:"
    for suite in "${!TEST_SUITES[@]}"; do
        echo "  - $suite"
    done
    echo ""
    echo "Examples:"
    echo "  $0                      # Run all test suites"
    echo "  $0 --suite branch-structure"
    echo "  $0 --results-dir /custom/path"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        --skip-prereq)
            SKIP_PREREQ=true
            shift
            ;;
        --suite)
            SINGLE_SUITE="$2"
            shift 2
            ;;
        --results-dir)
            RESULTS_DIR="$2"
            FINAL_REPORT="$RESULTS_DIR/comprehensive-validation-report.json"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Handle single suite execution
if [ -n "$SINGLE_SUITE" ]; then
    if [ -z "${TEST_SUITES[$SINGLE_SUITE]}" ]; then
        echo -e "${RED}❌ Unknown test suite: $SINGLE_SUITE${NC}"
        echo "Available suites: ${!TEST_SUITES[*]}"
        exit 1
    fi
    
    # Run only the specified suite
    echo -e "${BLUE}Running single test suite: $SINGLE_SUITE${NC}"
    initialize_results
    
    if [ "$SKIP_PREREQ" != true ]; then
        run_prerequisite_checks
    fi
    
    run_test_suite "$SINGLE_SUITE" "${TEST_SUITES[$SINGLE_SUITE]}"
    generate_comprehensive_report
    display_final_summary
    exit $?
fi

# Run main function
main "$@"