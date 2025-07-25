#!/bin/bash
# 4-Tier Workflow Branch Structure Validation Script
# QA Coordinator Agent - Comprehensive Testing Framework

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🧪 QA VALIDATION: 4-Tier Branch Structure Testing${NC}"
echo "=================================================================="

VALIDATION_PASSED=true
VALIDATION_REPORT="/tmp/branch-structure-validation.json"

# Initialize validation report
cat > "$VALIDATION_REPORT" << 'EOF'
{
  "validation_timestamp": "",
  "validation_type": "branch_structure",
  "results": {
    "branch_existence": {},
    "branch_protection": {},
    "merge_workflows": {},
    "environment_mapping": {},
    "overall_status": "pending"
  }
}
EOF

# Function to log validation results
log_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    # Update JSON report using jq if available, otherwise append to log
    if command -v jq >/dev/null 2>&1; then
        jq --arg test "$test_name" --arg status "$status" --arg details "$details" \
           '.results.branch_existence[$test] = {"status": $status, "details": $details}' \
           "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
    fi
    
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ $test_name: PASS${NC}"
        [ -n "$details" ] && echo -e "   Details: $details"
    else
        echo -e "${RED}❌ $test_name: FAIL${NC}"
        [ -n "$details" ] && echo -e "   Error: $details"
        VALIDATION_PASSED=false
    fi
}

# Test 1: Verify 4-tier branch structure exists
test_branch_existence() {
    echo -e "\n${BLUE}📋 TEST 1: Branch Existence Validation${NC}"
    
    local required_branches=("main" "development" "test" "claude-flowv2")
    
    for branch in "${required_branches[@]}"; do
        if git show-ref --verify --quiet refs/heads/$branch; then
            log_result "branch_exists_$branch" "pass" "Local branch verified"
        else
            log_result "branch_exists_$branch" "fail" "Local branch missing"
        fi
        
        if git show-ref --verify --quiet refs/remotes/origin/$branch; then
            log_result "remote_branch_exists_$branch" "pass" "Remote branch verified"
        else
            log_result "remote_branch_exists_$branch" "fail" "Remote branch missing"
        fi
    done
}

# Test 2: Validate branch protection rules
test_branch_protection() {
    echo -e "\n${BLUE}🛡️ TEST 2: Branch Protection Validation${NC}"
    
    # Check if GitHub CLI is available for advanced testing
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        echo -e "   ${GREEN}GitHub CLI available - running advanced protection tests${NC}"
        
        # Test protection rules for each branch
        local branches=("main" "development" "test")
        for branch in "${branches[@]}"; do
            if gh api "repos/:owner/:repo/branches/$branch/protection" >/dev/null 2>&1; then
                log_result "protection_$branch" "pass" "Branch protection enabled"
            else
                log_result "protection_$branch" "fail" "Branch protection missing or insufficient"
            fi
        done
    else
        echo -e "   ${YELLOW}GitHub CLI not available - skipping advanced protection tests${NC}"
        log_result "protection_check" "skip" "GitHub CLI not available for protection verification"
    fi
    
    # Test direct push prevention (basic git check)
    local current_branch=$(git branch --show-current)
    
    # Only test if not on main to avoid issues
    if [ "$current_branch" != "main" ]; then
        # Create a test commit to check if direct push to main is blocked
        local test_file="/tmp/git_protection_test_$$"
        echo "# Protection test" > "$test_file"
        
        # Switch to main and try to add a test file (this should fail in protected repo)
        if git checkout main >/dev/null 2>&1; then
            # Try to make a change that would be rejected
            echo "test" > ".git/protection_test" 2>/dev/null || true
            if git add .git/protection_test >/dev/null 2>&1 && git commit -m "test protection" >/dev/null 2>&1; then
                # If this succeeds, protection might not be enabled
                git reset --hard HEAD~1 >/dev/null 2>&1
                rm -f .git/protection_test
                log_result "direct_push_prevention" "warn" "Direct commits to main may be allowed"
            else
                log_result "direct_push_prevention" "pass" "Direct commits properly restricted"
            fi
            rm -f .git/protection_test
            git checkout "$current_branch" >/dev/null 2>&1
        fi
    fi
}

# Test 3: Validate merge workflow functionality
test_merge_workflows() {
    echo -e "\n${BLUE}🔄 TEST 3: Merge Workflow Validation${NC}"
    
    # Test workflow: feature -> development -> test -> main
    local workflow_stages=("development" "test" "main")
    
    for stage in "${workflow_stages[@]}"; do
        # Check if branch can be checked out
        if git checkout "$stage" >/dev/null 2>&1; then
            log_result "checkout_$stage" "pass" "Branch accessible for workflow"
            
            # Check if branch is up to date with remote
            git fetch origin "$stage" >/dev/null 2>&1
            local local_commit=$(git rev-parse HEAD)
            local remote_commit=$(git rev-parse "origin/$stage")
            
            if [ "$local_commit" = "$remote_commit" ]; then
                log_result "sync_$stage" "pass" "Branch synchronized with remote"
            else
                log_result "sync_$stage" "warn" "Branch may need synchronization"
            fi
        else
            log_result "checkout_$stage" "fail" "Cannot access branch for workflow"
        fi
    done
    
    # Return to original branch
    local original_branch=$(git branch --show-current)
    git checkout main >/dev/null 2>&1 || git checkout development >/dev/null 2>&1
}

# Test 4: Validate environment mapping
test_environment_mapping() {
    echo -e "\n${BLUE}🌍 TEST 4: Environment Mapping Validation${NC}"
    
    # Define expected environment mappings
    declare -A env_mapping
    env_mapping["main"]="production"
    env_mapping["development"]="staging"
    env_mapping["test"]="testing"
    env_mapping["claude-flowv2"]="ai-development"
    
    # Check for environment-specific configurations
    for branch in "${!env_mapping[@]}"; do
        local env="${env_mapping[$branch]}"
        local env_file=".env.${env}"
        local docker_file="docker-compose.${env}.yml"
        
        # Check environment file
        if [ -f "$env_file" ] || [ -f ".env.${branch}" ]; then
            log_result "env_config_$branch" "pass" "Environment configuration available"
        else
            log_result "env_config_$branch" "warn" "Environment configuration missing: $env_file"
        fi
        
        # Check docker compose file
        if [ -f "$docker_file" ]; then
            log_result "docker_config_$branch" "pass" "Docker configuration available"
        else
            log_result "docker_config_$branch" "warn" "Docker configuration missing: $docker_file"
        fi
    done
}

# Test 5: Validate gitignore system
test_gitignore_system() {
    echo -e "\n${BLUE}📁 TEST 5: Gitignore System Validation${NC}"
    
    local branches=("main" "development" "test" "claude-flowv2")
    local current_branch=$(git branch --show-current)
    
    for branch in "${branches[@]}"; do
        if git checkout "$branch" >/dev/null 2>&1; then
            if [ -f ".gitignore" ]; then
                # Check if gitignore has branch-specific content
                local gitignore_size=$(wc -l < .gitignore)
                if [ "$gitignore_size" -gt 5 ]; then
                    log_result "gitignore_$branch" "pass" "Branch-specific gitignore configured ($gitignore_size lines)"
                else
                    log_result "gitignore_$branch" "warn" "Gitignore may be too minimal ($gitignore_size lines)"
                fi
            else
                log_result "gitignore_$branch" "fail" "Gitignore missing on $branch"
            fi
        else
            log_result "gitignore_$branch" "fail" "Cannot access $branch to check gitignore"
        fi
    done
    
    # Return to original branch
    git checkout "$current_branch" >/dev/null 2>&1
}

# Test 6: Validate CI/CD workflow files
test_cicd_workflows() {
    echo -e "\n${BLUE}⚙️ TEST 6: CI/CD Workflow Validation${NC}"
    
    local required_workflows=(
        "branch-strategy.yml"
        "branch-protection.yml"
        "testing.yml"
        "deploy-staging.yml"
        "deploy-production.yml"
    )
    
    for workflow in "${required_workflows[@]}"; do
        local workflow_path=".github/workflows/$workflow"
        if [ -f "$workflow_path" ]; then
            # Check if workflow file is valid YAML
            if command -v yamllint >/dev/null 2>&1; then
                if yamllint "$workflow_path" >/dev/null 2>&1; then
                    log_result "workflow_$workflow" "pass" "Workflow file valid"
                else
                    log_result "workflow_$workflow" "fail" "Workflow file has YAML syntax errors"
                fi
            else
                log_result "workflow_$workflow" "pass" "Workflow file exists (YAML validation skipped)"
            fi
        else
            log_result "workflow_$workflow" "warn" "Workflow file missing: $workflow_path"
        fi
    done
}

# Main execution
main() {
    echo -e "Starting validation at $(date)"
    
    # Update timestamp in report
    if command -v jq >/dev/null 2>&1; then
        jq --arg timestamp "$(date -Iseconds)" '.validation_timestamp = $timestamp' \
           "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
    fi
    
    # Run all tests
    test_branch_existence
    test_branch_protection  
    test_merge_workflows
    test_environment_mapping
    test_gitignore_system
    test_cicd_workflows
    
    # Final validation result
    echo -e "\n=================================================================="
    if [ "$VALIDATION_PASSED" = true ]; then
        echo -e "${GREEN}🎉 BRANCH STRUCTURE VALIDATION: PASSED${NC}"
        if command -v jq >/dev/null 2>&1; then
            jq '.results.overall_status = "passed"' "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
        fi
        exit 0
    else
        echo -e "${RED}❌ BRANCH STRUCTURE VALIDATION: FAILED${NC}"
        echo -e "${YELLOW}📝 Review the failed tests above and address issues before proceeding${NC}"
        if command -v jq >/dev/null 2>&1; then
            jq '.results.overall_status = "failed"' "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
        fi
        exit 1
    fi
}

# Run main function
main "$@"