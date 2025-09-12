#!/bin/bash

# MediaNest Git Hooks Health Check
# Comprehensive monitoring and validation of Git hooks performance and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo -e "\n${BOLD}${BLUE}$1${NC}"
    echo "$(printf '=%.0s' {1..50})"
}

print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((CHECKS_PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((CHECKS_FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Performance threshold constants
MAX_PRECOMMIT_TIME=2.0
MAX_COMMITMSG_TIME=0.5
MAX_TOTAL_TIME=2.5

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Parse time output to seconds
time_to_seconds() {
    local time_str="$1"
    # Extract time in various formats and convert to seconds
    echo "$time_str" | grep -oP '\d+\.\d+s|real\s+\d+m\d+\.\d+s' | head -1 | sed 's/[^0-9.]//g' || echo "0"
}

print_header "MediaNest Git Hooks Health Check"
echo "Timestamp: $(date)"
echo "Repository: $(pwd)"
echo "Git branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"

# 1. Environment Check
print_header "1. Environment Validation"

print_check "Git repository status"
if [ -d ".git" ]; then
    print_pass "Valid Git repository"
else
    print_fail "Not in a Git repository"
    exit 1
fi

print_check "Node.js availability"
if command_exists node; then
    node_version=$(node --version)
    print_pass "Node.js available: $node_version"
else
    print_fail "Node.js not found"
fi

print_check "npm availability"
if command_exists npm; then
    npm_version=$(npm --version)
    print_pass "npm available: $npm_version"
else
    print_fail "npm not found"
fi

# 2. Dependencies Check
print_header "2. Dependencies Validation"

print_check "Package.json exists"
if [ -f "package.json" ]; then
    print_pass "package.json found"
else
    print_fail "package.json not found"
    exit 1
fi

print_check "Husky installation"
if npm list husky >/dev/null 2>&1; then
    husky_version=$(npm list husky --depth=0 2>/dev/null | grep husky | awk '{print $2}' | head -1)
    print_pass "Husky installed: $husky_version"
else
    print_fail "Husky not installed - run: npm install --save-dev husky"
fi

print_check "Lint-staged installation"
if npm list lint-staged >/dev/null 2>&1; then
    staged_version=$(npm list lint-staged --depth=0 2>/dev/null | grep lint-staged | awk '{print $2}' | head -1)
    print_pass "lint-staged installed: $staged_version"
else
    print_fail "lint-staged not installed - run: npm install --save-dev lint-staged"
fi

print_check "Commitlint installation"
if npm list @commitlint/cli >/dev/null 2>&1; then
    commitlint_version=$(npm list @commitlint/cli --depth=0 2>/dev/null | grep @commitlint/cli | awk '{print $2}' | head -1)
    print_pass "commitlint installed: $commitlint_version"
else
    print_fail "@commitlint/cli not installed - run: npm install --save-dev @commitlint/cli"
fi

# 3. Hook Files Check
print_header "3. Hook Files Validation"

print_check "Husky directory exists"
if [ -d ".husky" ]; then
    print_pass ".husky directory found"
else
    print_fail ".husky directory not found - run: npx husky init"
fi

print_check "Pre-commit hook exists"
if [ -f ".husky/pre-commit" ]; then
    if [ -x ".husky/pre-commit" ]; then
        print_pass "pre-commit hook exists and is executable"
    else
        print_fail "pre-commit hook exists but is not executable - run: chmod +x .husky/pre-commit"
    fi
else
    print_fail "pre-commit hook not found"
fi

print_check "Commit-msg hook exists"
if [ -f ".husky/commit-msg" ]; then
    if [ -x ".husky/commit-msg" ]; then
        print_pass "commit-msg hook exists and is executable"
    else
        print_fail "commit-msg hook exists but is not executable - run: chmod +x .husky/commit-msg"
    fi
else
    print_fail "commit-msg hook not found"
fi

# 4. Configuration Files Check
print_header "4. Configuration Validation"

print_check "Lint-staged configuration"
if [ -f "lint-staged.config.js" ] || [ -f ".lintstagedrc.js" ] || [ -f ".lintstagedrc" ]; then
    print_pass "lint-staged configuration found"
    
    # Check for conflicting configs
    config_count=$(find . -maxdepth 1 -name "lint-staged.config.js" -o -name ".lintstagedrc.js" -o -name ".lintstagedrc" | wc -l)
    if [ $config_count -gt 1 ]; then
        print_warn "Multiple lint-staged configs found - may cause conflicts"
    fi
else
    print_fail "lint-staged configuration not found"
fi

print_check "Commitlint configuration"
if [ -f "commitlint.config.js" ] || [ -f ".commitlintrc.js" ]; then
    print_pass "commitlint configuration found"
else
    print_fail "commitlint configuration not found"
fi

print_check "Prettier configuration"
if [ -f ".prettierrc" ] || [ -f ".prettierrc.js" ] || [ -f "prettier.config.js" ]; then
    print_pass "prettier configuration found"
else
    print_warn "prettier configuration not found - using defaults"
fi

# 5. Performance Testing
print_header "5. Performance Testing"

print_check "Creating test files for performance measurement"
test_js_file="/tmp/medianest_hook_test_$(date +%s).js"
test_commit_msg="/tmp/medianest_commit_test_$(date +%s)"

echo "console.log('Hook performance test');" > "$test_js_file"
echo "test: hook performance measurement" > "$test_commit_msg"

if git add "$test_js_file" 2>/dev/null; then
    print_check "Testing pre-commit hook performance"
    
    start_time=$(date +%s.%3N)
    if timeout 30 npx lint-staged --config lint-staged.config.js 2>/dev/null >/dev/null; then
        end_time=$(date +%s.%3N)
        duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        if [ "$(echo "$duration <= $MAX_PRECOMMIT_TIME" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
            print_pass "Pre-commit performance: ${duration}s (target: <${MAX_PRECOMMIT_TIME}s)"
        else
            print_warn "Pre-commit performance: ${duration}s (exceeds target of ${MAX_PRECOMMIT_TIME}s)"
        fi
    else
        print_fail "Pre-commit hook failed or timed out"
    fi
    
    # Clean up
    git reset HEAD "$test_js_file" 2>/dev/null >/dev/null
else
    print_warn "Could not stage test file - skipping performance test"
fi

print_check "Testing commit-msg hook performance"
start_time=$(date +%s.%3N)
if timeout 10 npx commitlint --config commitlint.config.js < "$test_commit_msg" 2>/dev/null >/dev/null; then
    end_time=$(date +%s.%3N)
    duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    if [ "$(echo "$duration <= $MAX_COMMITMSG_TIME" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
        print_pass "Commit-msg performance: ${duration}s (target: <${MAX_COMMITMSG_TIME}s)"
    else
        print_warn "Commit-msg performance: ${duration}s (exceeds target of ${MAX_COMMITMSG_TIME}s)"
    fi
else
    print_fail "Commit-msg hook failed or timed out"
fi

# Clean up test files
rm -f "$test_js_file" "$test_commit_msg"

# 6. Repository Health Metrics
print_header "6. Repository Health Metrics"

print_check "Git status performance"
git_status_time=$(time git status --porcelain 2>&1 | grep real | awk '{print $2}' | sed 's/[^0-9.]//g' || echo "0")
if [ "$(echo "$git_status_time <= 0.1" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
    print_pass "Git status time: ${git_status_time}s (target: <0.1s)"
else
    print_warn "Git status time: ${git_status_time}s (may be slow for large repos)"
fi

print_check "Repository size analysis"
git_dir_size=$(du -sh .git 2>/dev/null | awk '{print $1}' || echo "unknown")
staged_files=$(git diff --cached --name-only 2>/dev/null | wc -l || echo "0")
modified_files=$(git diff --name-only 2>/dev/null | wc -l || echo "0")

print_info "Git directory size: $git_dir_size"
print_info "Currently staged files: $staged_files"
print_info "Modified files: $modified_files"

# 7. Bypass Mechanisms Check
print_header "7. Bypass Mechanisms Validation"

print_check "Emergency bypass capability"
if grep -q "MEDIANEST_SKIP_HOOKS" .husky/pre-commit 2>/dev/null; then
    print_pass "Emergency bypass mechanism available"
else
    print_fail "Emergency bypass mechanism not found in hooks"
fi

print_check "Development bypass capability"
if grep -q "MEDIANEST_SKIP_PRECOMMIT" .husky/pre-commit 2>/dev/null; then
    print_pass "Development bypass mechanism available"
else
    print_fail "Development bypass mechanism not found in hooks"
fi

print_check "Bypass helper script"
if [ -f "scripts/git-hooks-bypass.sh" ] && [ -x "scripts/git-hooks-bypass.sh" ]; then
    print_pass "Bypass helper script available"
else
    print_warn "Bypass helper script not found or not executable"
fi

# 8. Integration Check
print_header "8. Integration Validation"

print_check "Package.json scripts integration"
if grep -q "hooks:" package.json; then
    print_pass "Hook management scripts found in package.json"
else
    print_warn "Hook management scripts not found in package.json"
fi

print_check "Current bypass status"
if [ "$MEDIANEST_SKIP_HOOKS" = "1" ]; then
    print_warn "Emergency bypass currently ACTIVE"
elif [ "$MEDIANEST_SKIP_PRECOMMIT" = "1" ]; then
    print_warn "Pre-commit bypass currently ACTIVE"
else
    print_pass "No bypass flags currently set"
fi

# 9. Security Check
print_header "9. Security Validation"

print_check "Hook file permissions"
hook_security_issues=0

if [ -f ".husky/pre-commit" ]; then
    perms=$(ls -l .husky/pre-commit | awk '{print $1}')
    if [[ "$perms" =~ ^-rwx.*$ ]]; then
        print_pass "pre-commit hook has secure permissions"
    else
        print_warn "pre-commit hook permissions: $perms"
        ((hook_security_issues++))
    fi
fi

if [ -f ".husky/commit-msg" ]; then
    perms=$(ls -l .husky/commit-msg | awk '{print $1}')
    if [[ "$perms" =~ ^-rwx.*$ ]]; then
        print_pass "commit-msg hook has secure permissions"
    else
        print_warn "commit-msg hook permissions: $perms"
        ((hook_security_issues++))
    fi
fi

print_check "Hook content validation"
suspicious_patterns=("curl " "wget " "rm -rf /" "eval " "exec ")
security_warnings=0

for hook in .husky/pre-commit .husky/commit-msg; do
    if [ -f "$hook" ]; then
        for pattern in "${suspicious_patterns[@]}"; do
            if grep -q "$pattern" "$hook" 2>/dev/null; then
                print_warn "Potentially suspicious pattern '$pattern' found in $hook"
                ((security_warnings++))
            fi
        done
    fi
done

if [ $security_warnings -eq 0 ]; then
    print_pass "No suspicious patterns detected in hooks"
fi

# 10. Summary Report
print_header "10. Health Check Summary"

total_checks=$((CHECKS_PASSED + CHECKS_FAILED))
pass_rate=$(echo "scale=1; $CHECKS_PASSED * 100 / $total_checks" | bc -l 2>/dev/null || echo "0")

echo -e "\n${BOLD}RESULTS SUMMARY${NC}"
echo "================"
echo -e "${GREEN}Checks passed: ${CHECKS_PASSED}${NC}"
echo -e "${RED}Checks failed: ${CHECKS_FAILED}${NC}"
echo -e "${YELLOW}Warnings: ${WARNINGS}${NC}"
echo -e "Pass rate: ${pass_rate}%"

# Overall health status
if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "\n${GREEN}${BOLD}🎉 EXCELLENT HEALTH${NC}"
        echo "All checks passed with no warnings."
    else
        echo -e "\n${YELLOW}${BOLD}✅ GOOD HEALTH${NC}"
        echo "All critical checks passed, but there are $WARNINGS warnings to address."
    fi
    health_status="HEALTHY"
    exit_code=0
else
    if [ $CHECKS_FAILED -le 2 ]; then
        echo -e "\n${YELLOW}${BOLD}⚠️  NEEDS ATTENTION${NC}"
        echo "Some non-critical issues found. Git hooks may not work optimally."
    else
        echo -e "\n${RED}${BOLD}❌ UNHEALTHY${NC}"
        echo "Multiple critical issues found. Git hooks likely not functioning."
    fi
    health_status="UNHEALTHY"
    exit_code=1
fi

# Recommendations
echo -e "\n${BOLD}RECOMMENDATIONS${NC}"
echo "=================="

if [ $CHECKS_FAILED -gt 0 ]; then
    echo "🔧 Run the following to fix critical issues:"
    echo "   ./scripts/git-hooks-optimizer.sh"
    echo "   npm install"
    echo "   npx husky prepare"
fi

if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  Address warnings to optimize performance:"
    echo "   Review configuration conflicts"
    echo "   Check file permissions"
    echo "   Consider bypass flag cleanup"
fi

echo -e "\n📊 Performance targets:"
echo "   Pre-commit: <${MAX_PRECOMMIT_TIME}s"
echo "   Commit-msg: <${MAX_COMMITMSG_TIME}s"
echo "   Total: <${MAX_TOTAL_TIME}s"

echo -e "\n🔗 Resources:"
echo "   Architecture guide: docs/git-hooks-architecture-analysis.md"
echo "   Bypass guide: docs/git-hooks-bypass-guide.md"
echo "   Performance test: npm run hooks:performance"

# Write results to log file (optional)
if [ "$1" = "--log" ]; then
    log_file="git-hooks-health-$(date +%Y%m%d-%H%M%S).log"
    {
        echo "MediaNest Git Hooks Health Check Report"
        echo "Generated: $(date)"
        echo "Status: $health_status"
        echo "Passed: $CHECKS_PASSED, Failed: $CHECKS_FAILED, Warnings: $WARNINGS"
        echo "Pass Rate: ${pass_rate}%"
    } > "$log_file"
    echo -e "\n📝 Detailed results logged to: $log_file"
fi

exit $exit_code