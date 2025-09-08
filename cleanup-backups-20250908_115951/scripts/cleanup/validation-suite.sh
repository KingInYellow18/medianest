#!/bin/bash

# MediaNest Cleanup Validation Suite
# Comprehensive validation and testing after cleanup operations
# Created: 2025-09-08

set -euo pipefail

# Colors and constants
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly VALIDATION_LOG="$SCRIPT_DIR/validation-$(date +%Y%m%d_%H%M%S).log"

# Configuration
VERBOSE=false
QUICK_CHECK=false
PARALLEL=true

# Validation categories
readonly VALIDATION_CATEGORIES=(
    "structure"     # Project structure integrity
    "dependencies"  # Dependency health
    "compilation"   # Code compilation
    "tests"         # Test execution
    "security"      # Security verification
    "performance"   # Basic performance checks
)

usage() {
    cat << EOF
MediaNest Cleanup Validation Suite

USAGE:
    $0 [OPTIONS] [CATEGORIES...]

CATEGORIES:
    structure     Validate project structure and files
    dependencies  Check dependency integrity and security
    compilation   Verify code compilation and TypeScript
    tests         Run test suites
    security      Security vulnerability scan
    performance   Basic performance validation

OPTIONS:
    --quick              Run quick validation (skip time-intensive checks)
    --no-parallel        Disable parallel validation
    -v, --verbose        Enable verbose output
    -h, --help          Show this help message

EXAMPLES:
    $0                           # Full validation suite
    $0 --quick structure tests   # Quick validation of structure and tests
    $0 --verbose compilation     # Verbose compilation validation

EOF
}

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$VALIDATION_LOG"
    
    case "$level" in
        "INFO")    echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")    echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR")   echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        "PASS")    echo -e "${GREEN}[✓]${NC} $message" ;;
        "FAIL")    echo -e "${RED}[✗]${NC} $message" ;;
    esac
}

verbose_log() {
    [[ "$VERBOSE" == true ]] && log "INFO" "$@"
}

run_validation() {
    local category="$1"
    local result=0
    
    log "INFO" "Starting $category validation..."
    
    case "$category" in
        "structure")
            validate_project_structure
            result=$?
            ;;
        "dependencies")
            validate_dependencies
            result=$?
            ;;
        "compilation")
            validate_compilation
            result=$?
            ;;
        "tests")
            validate_tests
            result=$?
            ;;
        "security")
            validate_security
            result=$?
            ;;
        "performance")
            validate_performance
            result=$?
            ;;
        *)
            log "ERROR" "Unknown validation category: $category"
            return 1
            ;;
    esac
    
    if [[ $result -eq 0 ]]; then
        log "PASS" "$category validation completed successfully"
    else
        log "FAIL" "$category validation failed"
    fi
    
    return $result
}

validate_project_structure() {
    log "INFO" "=== Validating project structure ==="
    
    local required_files=(
        "package.json"
        "README.md"
        ".gitignore"
    )
    
    local required_dirs=(
        "backend"
        "frontend"
        "shared"
        "docs"
        "scripts"
    )
    
    local missing_files=()
    local missing_dirs=()
    
    # Check required files
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            missing_files+=("$file")
            log "FAIL" "Missing required file: $file"
        else
            verbose_log "Found required file: $file"
        fi
    done
    
    # Check required directories
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$PROJECT_ROOT/$dir" ]]; then
            missing_dirs+=("$dir")
            log "FAIL" "Missing required directory: $dir"
        else
            verbose_log "Found required directory: $dir"
        fi
    done
    
    # Check backend structure
    if [[ -d "$PROJECT_ROOT/backend" ]]; then
        local backend_dirs=(
            "src"
            "src/controllers"
            "src/middleware"
            "src/services"
            "src/utils"
        )
        
        for dir in "${backend_dirs[@]}"; do
            if [[ ! -d "$PROJECT_ROOT/backend/$dir" ]]; then
                log "FAIL" "Missing backend directory: backend/$dir"
                return 1
            else
                verbose_log "Found backend directory: $dir"
            fi
        done
    fi
    
    # Check for cleanup artifacts
    local cleanup_artifacts=(
        "*.cleanup-backup"
        "*-old-*"
        "backups"
        "legacy-audit"
        "debt-analysis"
    )
    
    for pattern in "${cleanup_artifacts[@]}"; do
        if find "$PROJECT_ROOT" -name "$pattern" -type f -o -name "$pattern" -type d | grep -q .; then
            log "WARN" "Found cleanup artifacts matching: $pattern"
        fi
    done
    
    # Validate file permissions
    if [[ ! -x "$PROJECT_ROOT/scripts/cleanup/master-cleanup-orchestrator.sh" ]]; then
        log "FAIL" "Cleanup orchestrator script is not executable"
        return 1
    fi
    
    if [[ ${#missing_files[@]} -gt 0 ]] || [[ ${#missing_dirs[@]} -gt 0 ]]; then
        log "FAIL" "Project structure validation failed"
        return 1
    fi
    
    log "PASS" "Project structure validation passed"
    return 0
}

validate_dependencies() {
    log "INFO" "=== Validating dependencies ==="
    
    local package_dirs=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    local failed_dirs=()
    
    for dir in "${package_dirs[@]}"; do
        if [[ ! -f "$dir/package.json" ]]; then
            verbose_log "Skipping dependency check - no package.json in $(basename "$dir")"
            continue
        fi
        
        log "INFO" "Checking dependencies in $(basename "$dir")"
        
        # Check package.json validity
        if ! jq . "$dir/package.json" >/dev/null 2>&1; then
            log "FAIL" "Invalid package.json in $(basename "$dir")"
            failed_dirs+=("$(basename "$dir")")
            continue
        fi
        
        # Check for package-lock.json
        if [[ ! -f "$dir/package-lock.json" ]]; then
            log "WARN" "Missing package-lock.json in $(basename "$dir")"
        fi
        
        # Check node_modules exists and is not empty
        if [[ ! -d "$dir/node_modules" ]] || [[ -z "$(ls -A "$dir/node_modules" 2>/dev/null)" ]]; then
            log "WARN" "node_modules missing or empty in $(basename "$dir")"
            
            # Try to install dependencies
            log "INFO" "Attempting to install dependencies in $(basename "$dir")"
            if (cd "$dir" && npm install --silent); then
                log "SUCCESS" "Dependencies installed in $(basename "$dir")"
            else
                log "FAIL" "Failed to install dependencies in $(basename "$dir")"
                failed_dirs+=("$(basename "$dir")")
                continue
            fi
        fi
        
        # Validate dependency tree
        if ! (cd "$dir" && npm ls --depth=0 --silent >/dev/null 2>&1); then
            log "WARN" "Dependency tree issues in $(basename "$dir")"
            
            # Try to fix
            if (cd "$dir" && npm install --silent); then
                log "SUCCESS" "Fixed dependency issues in $(basename "$dir")"
            else
                log "FAIL" "Could not fix dependency issues in $(basename "$dir")"
                failed_dirs+=("$(basename "$dir")")
            fi
        fi
        
        # Check for vulnerabilities (unless quick check)
        if [[ "$QUICK_CHECK" == false ]]; then
            local vuln_count
            vuln_count=$(cd "$dir" && npm audit --audit-level=moderate --json 2>/dev/null | jq '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "0")
            
            if [[ "$vuln_count" -gt 0 ]]; then
                log "WARN" "Found $vuln_count vulnerabilities in $(basename "$dir")"
            else
                verbose_log "No vulnerabilities found in $(basename "$dir")"
            fi
        fi
    done
    
    if [[ ${#failed_dirs[@]} -gt 0 ]]; then
        log "FAIL" "Dependency validation failed in: ${failed_dirs[*]}"
        return 1
    fi
    
    log "PASS" "Dependency validation passed"
    return 0
}

validate_compilation() {
    log "INFO" "=== Validating compilation ==="
    
    # Check TypeScript projects
    local ts_projects=(
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    local failed_projects=()
    
    for project in "${ts_projects[@]}"; do
        if [[ ! -f "$project/package.json" ]]; then
            verbose_log "Skipping compilation check - no package.json in $(basename "$project")"
            continue
        fi
        
        # Check if project has TypeScript
        if ! jq -e '.devDependencies.typescript // .dependencies.typescript' "$project/package.json" >/dev/null 2>&1; then
            verbose_log "Skipping TypeScript compilation - not a TypeScript project: $(basename "$project")"
            continue
        fi
        
        log "INFO" "Checking TypeScript compilation in $(basename "$project")"
        
        # Check for tsconfig.json
        if [[ ! -f "$project/tsconfig.json" ]]; then
            log "FAIL" "Missing tsconfig.json in $(basename "$project")"
            failed_projects+=("$(basename "$project")")
            continue
        fi
        
        # Validate tsconfig.json
        if ! jq . "$project/tsconfig.json" >/dev/null 2>&1; then
            log "FAIL" "Invalid tsconfig.json in $(basename "$project")"
            failed_projects+=("$(basename "$project")")
            continue
        fi
        
        # Run TypeScript compilation
        if (cd "$project" && npx tsc --noEmit --skipLibCheck); then
            log "SUCCESS" "TypeScript compilation passed in $(basename "$project")"
        else
            log "FAIL" "TypeScript compilation failed in $(basename "$project")"
            failed_projects+=("$(basename "$project")")
        fi
    done
    
    # Check build scripts
    local build_projects=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
    )
    
    for project in "${build_projects[@]}"; do
        if [[ ! -f "$project/package.json" ]]; then
            continue
        fi
        
        if jq -e '.scripts.build' "$project/package.json" >/dev/null 2>&1; then
            log "INFO" "Testing build script in $(basename "$project")"
            
            if (cd "$project" && npm run build --silent); then
                log "SUCCESS" "Build script passed in $(basename "$project")"
            else
                log "FAIL" "Build script failed in $(basename "$project")"
                failed_projects+=("$(basename "$project")")
            fi
        fi
    done
    
    if [[ ${#failed_projects[@]} -gt 0 ]]; then
        log "FAIL" "Compilation validation failed in: ${failed_projects[*]}"
        return 1
    fi
    
    log "PASS" "Compilation validation passed"
    return 0
}

validate_tests() {
    log "INFO" "=== Validating tests ==="
    
    local test_projects=(
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    local failed_tests=()
    local test_found=false
    
    for project in "${test_projects[@]}"; do
        if [[ ! -f "$project/package.json" ]]; then
            continue
        fi
        
        # Check if project has test script
        if jq -e '.scripts.test' "$project/package.json" >/dev/null 2>&1; then
            test_found=true
            log "INFO" "Running tests in $(basename "$project")"
            
            if [[ "$QUICK_CHECK" == true ]]; then
                # Quick test - just check if test command exists
                if jq -r '.scripts.test' "$project/package.json" | grep -q "test"; then
                    log "SUCCESS" "Test script found in $(basename "$project")"
                else
                    log "WARN" "Test script appears invalid in $(basename "$project")"
                fi
            else
                # Full test execution
                if (cd "$project" && timeout 300 npm test -- --passWithNoTests); then
                    log "SUCCESS" "Tests passed in $(basename "$project")"
                else
                    log "FAIL" "Tests failed in $(basename "$project")"
                    failed_tests+=("$(basename "$project")")
                fi
            fi
        else
            verbose_log "No test script found in $(basename "$project")"
        fi
        
        # Check for test files
        local test_file_count
        test_file_count=$(find "$project" -name "*.test.*" -o -name "*.spec.*" -type f | grep -v node_modules | wc -l)
        
        if [[ "$test_file_count" -gt 0 ]]; then
            verbose_log "Found $test_file_count test files in $(basename "$project")"
        else
            log "WARN" "No test files found in $(basename "$project")"
        fi
    done
    
    if [[ "$test_found" == false ]]; then
        log "WARN" "No test scripts found in any project"
    fi
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        log "FAIL" "Test validation failed in: ${failed_tests[*]}"
        return 1
    fi
    
    log "PASS" "Test validation passed"
    return 0
}

validate_security() {
    log "INFO" "=== Validating security ==="
    
    local security_issues=()
    
    # Check for sensitive files
    local sensitive_patterns=(
        "*.key"
        "*.pem"
        "*.p12"
        "*.pfx"
        ".env*"
        "*secret*"
        "*password*"
    )
    
    for pattern in "${sensitive_patterns[@]}"; do
        while IFS= read -r -d '' file; do
            # Skip files that should be sensitive
            case "$file" in
                *.example|*.template|*.sample) continue ;;
                */node_modules/*) continue ;;
                */docs/*) continue ;;
            esac
            
            # Check if file is tracked by git
            if git -C "$PROJECT_ROOT" ls-files --error-unmatch "$file" >/dev/null 2>&1; then
                log "WARN" "Sensitive file tracked by git: $file"
                security_issues+=("sensitive-file:$file")
            fi
        done < <(find "$PROJECT_ROOT" -name "$pattern" -type f -print0 2>/dev/null)
    done
    
    # Check .gitignore for security patterns
    if [[ -f "$PROJECT_ROOT/.gitignore" ]]; then
        local required_ignores=(
            "*.env"
            "*.key"
            "*.pem"
            "node_modules"
        )
        
        for ignore_pattern in "${required_ignores[@]}"; do
            if ! grep -q "$ignore_pattern" "$PROJECT_ROOT/.gitignore"; then
                log "WARN" ".gitignore missing pattern: $ignore_pattern"
                security_issues+=("missing-gitignore:$ignore_pattern")
            fi
        done
    else
        log "FAIL" ".gitignore file missing"
        security_issues+=("missing-gitignore-file")
    fi
    
    # Check for hardcoded secrets (basic patterns)
    local secret_patterns=(
        "password.*=.*['\"][^'\"]{8,}['\"]"
        "api[_-]?key.*=.*['\"][^'\"]{16,}['\"]"
        "secret.*=.*['\"][^'\"]{16,}['\"]"
    )
    
    for pattern in "${secret_patterns[@]}"; do
        while IFS= read -r file; do
            if [[ -n "$file" ]]; then
                log "WARN" "Potential hardcoded secret in: $file"
                security_issues+=("hardcoded-secret:$file")
            fi
        done < <(find "$PROJECT_ROOT" -name "*.js" -o -name "*.ts" -o -name "*.json" | \
                 grep -v node_modules | \
                 xargs grep -l -i -E "$pattern" 2>/dev/null | head -5)
    done
    
    # Run npm audit if not quick check
    if [[ "$QUICK_CHECK" == false ]]; then
        local package_dirs=(
            "$PROJECT_ROOT"
            "$PROJECT_ROOT/backend"
            "$PROJECT_ROOT/frontend"
            "$PROJECT_ROOT/shared"
        )
        
        for dir in "${package_dirs[@]}"; do
            if [[ -f "$dir/package.json" ]]; then
                local high_vulns
                high_vulns=$(cd "$dir" && npm audit --audit-level=high --json 2>/dev/null | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
                
                if [[ "$high_vulns" -gt 0 ]]; then
                    log "WARN" "Found $high_vulns high-severity vulnerabilities in $(basename "$dir")"
                    security_issues+=("high-vulns:$(basename "$dir"):$high_vulns")
                fi
            fi
        done
    fi
    
    if [[ ${#security_issues[@]} -gt 0 ]]; then
        log "WARN" "Security validation found ${#security_issues[@]} issues"
        return 0  # Don't fail on warnings
    fi
    
    log "PASS" "Security validation passed"
    return 0
}

validate_performance() {
    log "INFO" "=== Validating performance ==="
    
    local performance_issues=()
    
    # Check project size
    local project_size
    project_size=$(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1)
    log "INFO" "Total project size: $project_size"
    
    # Check node_modules size
    local total_nm_size=0
    local nm_dirs=()
    
    while IFS= read -r -d '' nm_dir; do
        nm_dirs+=("$nm_dir")
        local size
        size=$(du -s "$nm_dir" 2>/dev/null | cut -f1)
        total_nm_size=$((total_nm_size + size))
    done < <(find "$PROJECT_ROOT" -name "node_modules" -type d -print0 2>/dev/null)
    
    local total_nm_size_mb=$((total_nm_size / 1024))
    log "INFO" "Total node_modules size: ${total_nm_size_mb}MB across ${#nm_dirs[@]} directories"
    
    if [[ $total_nm_size_mb -gt 2000 ]]; then
        log "WARN" "node_modules size is very large (>${total_nm_size_mb}MB)"
        performance_issues+=("large-node-modules:${total_nm_size_mb}MB")
    fi
    
    # Check for large files
    local large_files
    large_files=$(find "$PROJECT_ROOT" -type f -size +10M -not -path "*/node_modules/*" 2>/dev/null | head -10)
    
    if [[ -n "$large_files" ]]; then
        log "WARN" "Found large files (>10MB):"
        echo "$large_files" | while read -r large_file; do
            local size
            size=$(du -sh "$large_file" | cut -f1)
            log "WARN" "  - $large_file ($size)"
            performance_issues+=("large-file:$large_file:$size")
        done
    fi
    
    # Check build output sizes (if exists)
    local build_dirs=(
        "$PROJECT_ROOT/dist"
        "$PROJECT_ROOT/build"
        "$PROJECT_ROOT/frontend/dist"
        "$PROJECT_ROOT/frontend/build"
    )
    
    for build_dir in "${build_dirs[@]}"; do
        if [[ -d "$build_dir" ]]; then
            local build_size
            build_size=$(du -sh "$build_dir" | cut -f1)
            log "INFO" "Build output size ($(basename "$build_dir")): $build_size"
        fi
    done
    
    # Check for duplicate dependencies (basic check)
    if [[ "$QUICK_CHECK" == false ]]; then
        local package_dirs=(
            "$PROJECT_ROOT/backend"
            "$PROJECT_ROOT/frontend"
            "$PROJECT_ROOT/shared"
        )
        
        local all_deps=()
        for dir in "${package_dirs[@]}"; do
            if [[ -f "$dir/package.json" ]]; then
                local deps
                deps=$(jq -r '.dependencies // {} | keys[]' "$dir/package.json" 2>/dev/null)
                all_deps+=($deps)
            fi
        done
        
        # Find duplicates
        printf '%s\n' "${all_deps[@]}" | sort | uniq -d | while read -r duplicate; do
            if [[ -n "$duplicate" ]]; then
                log "WARN" "Duplicate dependency across projects: $duplicate"
                performance_issues+=("duplicate-dep:$duplicate")
            fi
        done
    fi
    
    if [[ ${#performance_issues[@]} -gt 10 ]]; then
        log "WARN" "Performance validation found ${#performance_issues[@]} issues"
    fi
    
    log "PASS" "Performance validation completed"
    return 0
}

run_parallel_validation() {
    local categories=("$@")
    local pids=()
    local results=()
    
    log "INFO" "Running parallel validation for: ${categories[*]}"
    
    # Start all validations in parallel
    for category in "${categories[@]}"; do
        {
            run_validation "$category"
            echo $? > "/tmp/validation-${category}-$$"
        } &
        pids+=($!)
    done
    
    # Wait for all to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    # Collect results
    local overall_result=0
    for category in "${categories[@]}"; do
        local result
        result=$(cat "/tmp/validation-${category}-$$" 2>/dev/null || echo "1")
        results+=("$category:$result")
        
        if [[ "$result" -ne 0 ]]; then
            overall_result=1
        fi
        
        rm -f "/tmp/validation-${category}-$$"
    done
    
    return $overall_result
}

show_validation_summary() {
    log "INFO" "=== Validation Summary ==="
    
    local log_lines
    log_lines=$(wc -l < "$VALIDATION_LOG")
    
    local pass_count
    pass_count=$(grep -c "\[PASS\]" "$VALIDATION_LOG" || echo "0")
    
    local fail_count  
    fail_count=$(grep -c "\[FAIL\]" "$VALIDATION_LOG" || echo "0")
    
    local warn_count
    warn_count=$(grep -c "\[WARN\]" "$VALIDATION_LOG" || echo "0")
    
    log "INFO" "Validation results:"
    log "INFO" "  ✓ Passed: $pass_count"
    log "INFO" "  ✗ Failed: $fail_count" 
    log "INFO" "  ⚠ Warnings: $warn_count"
    log "INFO" "  📋 Total log entries: $log_lines"
    log "INFO" "  📄 Detailed log: $VALIDATION_LOG"
    
    if [[ "$fail_count" -eq 0 ]]; then
        log "SUCCESS" "All validations passed!"
        return 0
    else
        log "ERROR" "Some validations failed"
        return 1
    fi
}

main() {
    echo -e "${BLUE}MediaNest Cleanup Validation Suite${NC}"
    echo -e "${BLUE}===================================${NC}\n"
    
    local categories_to_run=()
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                QUICK_CHECK=true
                shift
                ;;
            --no-parallel)
                PARALLEL=false
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            structure|dependencies|compilation|tests|security|performance)
                categories_to_run+=("$1")
                shift
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Default to all categories if none specified
    if [[ ${#categories_to_run[@]} -eq 0 ]]; then
        categories_to_run=("${VALIDATION_CATEGORIES[@]}")
    fi
    
    log "INFO" "Starting validation suite"
    log "INFO" "Categories: ${categories_to_run[*]}"
    log "INFO" "Quick check: $QUICK_CHECK"
    log "INFO" "Parallel execution: $PARALLEL"
    log "INFO" "Log file: $VALIDATION_LOG"
    
    # Initialize log
    mkdir -p "$(dirname "$VALIDATION_LOG")"
    echo "MediaNest Cleanup Validation Suite - $(date)" > "$VALIDATION_LOG"
    
    # Run validations
    local overall_result=0
    
    if [[ "$PARALLEL" == true ]] && [[ ${#categories_to_run[@]} -gt 1 ]]; then
        if ! run_parallel_validation "${categories_to_run[@]}"; then
            overall_result=1
        fi
    else
        for category in "${categories_to_run[@]}"; do
            if ! run_validation "$category"; then
                overall_result=1
            fi
        done
    fi
    
    # Show summary
    show_validation_summary
    
    if [[ $overall_result -eq 0 ]]; then
        echo -e "\n${GREEN}✅ Validation completed successfully!${NC}"
        echo -e "📋 Full report: ${BLUE}$VALIDATION_LOG${NC}"
    else
        echo -e "\n${RED}❌ Validation completed with failures${NC}"
        echo -e "📋 Check details: ${BLUE}$VALIDATION_LOG${NC}"
    fi
    
    exit $overall_result
}

main "$@"