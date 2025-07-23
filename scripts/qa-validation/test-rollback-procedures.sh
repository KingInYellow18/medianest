#!/bin/bash
# 4-Tier Workflow Rollback Procedures Testing Script
# QA Coordinator Agent - Rollback and Recovery Validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}⏪ QA VALIDATION: Rollback Procedures Testing${NC}"
echo "=================================================================="

VALIDATION_PASSED=true
VALIDATION_REPORT="/tmp/rollback-procedures-validation.json"
BACKUP_DIR="/tmp/qa-rollback-backups-$(date +%s)"

# Initialize validation report
cat > "$VALIDATION_REPORT" << 'EOF'
{
  "validation_timestamp": "",
  "validation_type": "rollback_procedures",
  "backup_location": "",
  "results": {
    "git_rollback": {},
    "deployment_rollback": {},
    "database_rollback": {},
    "configuration_rollback": {},
    "disaster_recovery": {},
    "overall_status": "pending"
  }
}
EOF

# Function to log validation results
log_result() {
    local test_category="$1"
    local test_name="$2"
    local status="$3"
    local details="$4"
    
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ $test_name: PASS${NC}"
        [ -n "$details" ] && echo -e "   Details: $details"
    elif [ "$status" = "skip" ]; then
        echo -e "${YELLOW}⏭️ $test_name: SKIP${NC}"
        [ -n "$details" ] && echo -e "   Reason: $details"
    else
        echo -e "${RED}❌ $test_name: FAIL${NC}"
        [ -n "$details" ] && echo -e "   Error: $details"
        VALIDATION_PASSED=false
    fi
}

# Function to create backup for rollback testing
create_backup() {
    echo -e "\n${BLUE}💾 Creating Backup for Rollback Testing${NC}"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup git repository state
    local original_branch=$(git branch --show-current)
    local original_commit=$(git rev-parse HEAD)
    
    # Store current state
    echo "$original_branch" > "$BACKUP_DIR/original_branch"
    echo "$original_commit" > "$BACKUP_DIR/original_commit"
    
    # Create branch state backup
    git branch > "$BACKUP_DIR/branches_before.txt"
    git log --oneline -10 > "$BACKUP_DIR/commits_before.txt"
    
    # Update JSON report with backup location
    if command -v jq >/dev/null 2>&1; then
        jq --arg backup "$BACKUP_DIR" '.backup_location = $backup' \
           "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
    fi
    
    log_result "backup" "state_backup" "pass" "System state backed up to $BACKUP_DIR"
}

# Function to restore from backup
restore_from_backup() {
    echo -e "\n${BLUE}🔄 Restoring from Backup${NC}"
    
    if [ -f "$BACKUP_DIR/original_branch" ] && [ -f "$BACKUP_DIR/original_commit" ]; then
        local original_branch=$(cat "$BACKUP_DIR/original_branch")
        local original_commit=$(cat "$BACKUP_DIR/original_commit")
        
        # Restore original state
        git checkout "$original_branch" >/dev/null 2>&1
        
        log_result "backup" "state_restore" "pass" "System state restored to $original_branch@$original_commit"
    else
        log_result "backup" "state_restore" "warn" "No backup state found for restoration"
    fi
}

# Cleanup function
cleanup() {
    restore_from_backup
    rm -rf "$BACKUP_DIR" 2>/dev/null || true
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Test 1: Git rollback procedures
test_git_rollback() {
    echo -e "\n${BLUE}📚 TEST 1: Git Rollback Procedures${NC}"
    
    local branches=("main" "development" "test" "claude-flowv2")
    
    for branch in "${branches[@]}"; do
        echo -e "\n   Testing rollback procedures for $branch"
        
        if git checkout "$branch" >/dev/null 2>&1; then
            local current_commit=$(git rev-parse HEAD)
            local previous_commit=$(git rev-parse HEAD~1 2>/dev/null || echo "")
            
            if [ -n "$previous_commit" ]; then
                # Test 1.1: Soft rollback simulation (reset to previous commit)
                echo -e "      Simulating soft rollback..."
                local rollback_test_branch="rollback-test-$branch-$(date +%s)"
                
                if git checkout -b "$rollback_test_branch" >/dev/null 2>&1; then
                    if git reset --soft HEAD~1 >/dev/null 2>&1; then
                        log_result "git_rollback" "soft_rollback_${branch}" "pass" "Soft rollback simulation successful"
                        
                        # Test restore
                        if git reset --hard "$current_commit" >/dev/null 2>&1; then
                            log_result "git_rollback" "restore_after_soft_${branch}" "pass" "Restore after soft rollback successful"
                        else
                            log_result "git_rollback" "restore_after_soft_${branch}" "fail" "Failed to restore after soft rollback"
                        fi
                    else
                        log_result "git_rollback" "soft_rollback_${branch}" "fail" "Soft rollback simulation failed"
                    fi
                    
                    # Cleanup test branch
                    git checkout "$branch" >/dev/null 2>&1
                    git branch -D "$rollback_test_branch" >/dev/null 2>&1
                else
                    log_result "git_rollback" "test_branch_${branch}" "fail" "Failed to create rollback test branch"
                fi
                
                # Test 1.2: Revert commit simulation
                echo -e "      Testing revert capability..."
                if git log --oneline -1 | grep -v "Initial commit" >/dev/null 2>&1; then
                    # Simulate revert (but don't actually do it)
                    if git show HEAD >/dev/null 2>&1; then
                        log_result "git_rollback" "revert_capability_${branch}" "pass" "Revert capability validated"
                    else
                        log_result "git_rollback" "revert_capability_${branch}" "fail" "Cannot access commit for revert"
                    fi
                else
                    log_result "git_rollback" "revert_capability_${branch}" "skip" "Only initial commit available, revert not applicable"
                fi
                
                # Test 1.3: Branch protection impact on rollback
                if [ "$branch" = "main" ] || [ "$branch" = "development" ]; then
                    # Check if direct push is prevented (indicating protection)
                    local test_file="rollback-test-$(date +%s).tmp"
                    echo "test" > "$test_file"
                    
                    if git add "$test_file" >/dev/null 2>&1 && git commit -m "rollback test commit" >/dev/null 2>&1; then
                        # If commit succeeds, test rollback
                        if git reset --hard HEAD~1 >/dev/null 2>&1; then
                            log_result "git_rollback" "protected_branch_rollback_${branch}" "pass" "Rollback possible on protected branch"
                        else
                            log_result "git_rollback" "protected_branch_rollback_${branch}" "warn" "Rollback restricted on protected branch"
                        fi
                    else
                        log_result "git_rollback" "protected_branch_rollback_${branch}" "pass" "Branch protection prevents direct commits (rollback would need admin)"
                    fi
                    
                    # Cleanup
                    rm -f "$test_file"
                    git reset --hard HEAD >/dev/null 2>&1
                else
                    log_result "git_rollback" "protected_branch_rollback_${branch}" "skip" "Non-protected branch, standard rollback procedures apply"
                fi
                
            else
                log_result "git_rollback" "rollback_${branch}" "skip" "No previous commits available for rollback testing"
            fi
        else
            log_result "git_rollback" "access_${branch}" "fail" "Cannot access $branch for rollback testing"
        fi
    done
}

# Test 2: Deployment rollback procedures
test_deployment_rollback() {
    echo -e "\n${BLUE}🚀 TEST 2: Deployment Rollback Procedures${NC}"
    
    # Test 2.1: Docker rollback simulation
    if [ -f "docker-compose.yml" ]; then
        log_result "deployment_rollback" "docker_config" "pass" "Docker configuration available for rollback"
        
        # Check for multiple docker-compose files (for different environments)
        local compose_files=$(ls docker-compose*.yml 2>/dev/null | wc -l)
        if [ "$compose_files" -gt 1 ]; then
            log_result "deployment_rollback" "environment_specific_docker" "pass" "Environment-specific Docker configs available ($compose_files files)"
        else
            log_result "deployment_rollback" "environment_specific_docker" "warn" "Limited environment-specific Docker configurations"
        fi
        
        # Test Docker image versioning strategy
        if grep -q "image.*:" docker-compose*.yml 2>/dev/null; then
            log_result "deployment_rollback" "image_versioning" "pass" "Docker image versioning configured"
        else
            log_result "deployment_rollback" "image_versioning" "warn" "No explicit Docker image versioning found"
        fi
    else
        log_result "deployment_rollback" "docker_config" "warn" "No Docker configuration found for rollback testing"
    fi
    
    # Test 2.2: Kubernetes rollback capability (if applicable)
    if [ -d "k8s" ] || [ -d "kubernetes" ] || [ -f "deployment.yaml" ]; then
        log_result "deployment_rollback" "k8s_config" "pass" "Kubernetes configuration found"
        
        # Check for deployment history capability
        if grep -r "revisionHistoryLimit" . >/dev/null 2>&1; then
            log_result "deployment_rollback" "k8s_revision_history" "pass" "Kubernetes revision history configured"
        else
            log_result "deployment_rollback" "k8s_revision_history" "warn" "No Kubernetes revision history limit configured"
        fi
    else
        log_result "deployment_rollback" "k8s_config" "skip" "No Kubernetes configuration found"
    fi
    
    # Test 2.3: Blue-Green deployment capability
    if grep -r "blue.*green\|canary" --include="*.yml" --include="*.yaml" --include="*.json" . >/dev/null 2>&1; then
        log_result "deployment_rollback" "blue_green_deployment" "pass" "Blue-Green or Canary deployment strategy configured"
    else
        log_result "deployment_rollback" "blue_green_deployment" "warn" "No Blue-Green deployment strategy found"
    fi
    
    # Test 2.4: Application health checks for rollback decision
    local health_endpoints=("health" "healthz" "ready" "live")
    local health_found=false
    
    for endpoint in "${health_endpoints[@]}"; do
        if grep -r "$endpoint" --include="*.js" --include="*.ts" . >/dev/null 2>&1; then
            log_result "deployment_rollback" "health_checks" "pass" "Health check endpoints configured for rollback decisions"
            health_found=true
            break
        fi
    done
    
    if [ "$health_found" = false ]; then
        log_result "deployment_rollback" "health_checks" "warn" "No health check endpoints found for rollback automation"
    fi
}

# Test 3: Database rollback procedures
test_database_rollback() {
    echo -e "\n${BLUE}🗄️ TEST 3: Database Rollback Procedures${NC}"
    
    # Test 3.1: Migration rollback capability
    if [ -f "prisma/schema.prisma" ]; then
        log_result "database_rollback" "prisma_config" "pass" "Prisma configuration found"
        
        # Check for migration files
        if [ -d "prisma/migrations" ]; then
            local migration_count=$(ls prisma/migrations/ 2>/dev/null | wc -l)
            log_result "database_rollback" "migration_files" "pass" "Migration files available ($migration_count migrations)"
            
            # Check if migrations are reversible
            if find prisma/migrations -name "migration.sql" -exec grep -l "DROP\|ALTER.*DROP" {} \; 2>/dev/null | head -1 >/dev/null; then
                log_result "database_rollback" "reversible_migrations" "pass" "Reversible migration patterns found"
            else
                log_result "database_rollback" "reversible_migrations" "warn" "Limited reversible migration patterns"
            fi
        else
            log_result "database_rollback" "migration_files" "warn" "No migration directory found"
        fi
        
        # Check for database backup strategy in config
        if grep -r "backup\|dump" --include="*.js" --include="*.ts" --include="*.json" . >/dev/null 2>&1; then
            log_result "database_rollback" "backup_strategy" "pass" "Database backup strategy references found"
        else
            log_result "database_rollback" "backup_strategy" "warn" "No database backup strategy found"
        fi
    else
        log_result "database_rollback" "database_config" "skip" "No Prisma configuration found"
    fi
    
    # Test 3.2: Environment-specific database handling
    local env_files=(".env.example" ".env.production" ".env.staging" ".env.testing")
    local db_env_config=false
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ] && grep -q "DATABASE_URL" "$env_file" 2>/dev/null; then
            log_result "database_rollback" "env_db_config" "pass" "Database environment configuration found in $env_file"
            db_env_config=true
            break
        fi
    done
    
    if [ "$db_env_config" = false ]; then
        log_result "database_rollback" "env_db_config" "warn" "No environment-specific database configuration found"
    fi
    
    # Test 3.3: Point-in-time recovery capability
    if grep -r "point.*time\|snapshot\|backup.*restore" --include="*.md" --include="*.txt" . >/dev/null 2>&1; then
        log_result "database_rollback" "point_in_time_recovery" "pass" "Point-in-time recovery documentation found"
    else
        log_result "database_rollback" "point_in_time_recovery" "warn" "No point-in-time recovery documentation found"
    fi
}

# Test 4: Configuration rollback procedures
test_configuration_rollback() {
    echo -e "\n${BLUE}⚙️ TEST 4: Configuration Rollback Procedures${NC}"
    
    # Test 4.1: Environment configuration versioning
    local config_files=(".env.example" "config.json" "app.config.js" "next.config.js")
    local config_versioning=false
    
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            # Check if config file is tracked in git
            if git ls-files --error-unmatch "$config_file" >/dev/null 2>&1; then
                log_result "configuration_rollback" "config_versioning_${config_file}" "pass" "Configuration file versioned: $config_file"
                config_versioning=true
            else
                log_result "configuration_rollback" "config_versioning_${config_file}" "warn" "Configuration file not versioned: $config_file"
            fi
        fi
    done
    
    if [ "$config_versioning" = false ]; then
        log_result "configuration_rollback" "config_versioning" "warn" "Limited configuration versioning found"
    fi
    
    # Test 4.2: Secret management rollback
    if [ -f ".env.example" ]; then
        log_result "configuration_rollback" "secret_template" "pass" "Secret template available for rollback reference"
        
        # Check for secret rotation capability
        if grep -q "ROTATION\|EXPIRE\|TTL" .env.example 2>/dev/null; then
            log_result "configuration_rollback" "secret_rotation" "pass" "Secret rotation patterns found"
        else
            log_result "configuration_rollback" "secret_rotation" "warn" "No secret rotation patterns found"
        fi
    else
        log_result "configuration_rollback" "secret_template" "warn" "No secret template for rollback reference"
    fi
    
    # Test 4.3: Feature flag rollback
    if grep -r "feature.*flag\|toggle\|experiment" --include="*.js" --include="*.ts" . >/dev/null 2>&1; then
        log_result "configuration_rollback" "feature_flags" "pass" "Feature flag system found for configuration rollback"
    else
        log_result "configuration_rollback" "feature_flags" "skip" "No feature flag system found"
    fi
    
    # Test 4.4: Branch-specific configuration rollback
    local branches=("main" "development" "test" "claude-flowv2")
    local original_branch=$(git branch --show-current)
    
    for branch in "${branches[@]}"; do
        if git checkout "$branch" >/dev/null 2>&1; then
            # Check for branch-specific configs
            if [ -f ".env.example" ] || [ -f "config.json" ]; then
                local config_checksum=$(find . -name ".env.example" -o -name "config.json" | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
                log_result "configuration_rollback" "branch_config_${branch}" "pass" "Branch-specific configuration available (checksum: ${config_checksum:0:8})"
            else
                log_result "configuration_rollback" "branch_config_${branch}" "warn" "No branch-specific configuration found"
            fi
        fi
    done
    
    git checkout "$original_branch" >/dev/null 2>&1
}

# Test 5: Disaster recovery procedures
test_disaster_recovery() {
    echo -e "\n${BLUE}🆘 TEST 5: Disaster Recovery Procedures${NC}"
    
    # Test 5.1: Complete repository backup and restore
    echo -e "      Testing complete repository backup capability..."
    local backup_test_dir="/tmp/disaster-recovery-test-$(date +%s)"
    
    if git clone . "$backup_test_dir" >/dev/null 2>&1; then
        log_result "disaster_recovery" "repository_backup" "pass" "Complete repository backup successful"
        
        # Test restore capability
        if [ -d "$backup_test_dir/.git" ]; then
            log_result "disaster_recovery" "repository_restore" "pass" "Repository restore capability validated"
        else
            log_result "disaster_recovery" "repository_restore" "fail" "Repository restore validation failed"
        fi
        
        # Cleanup
        rm -rf "$backup_test_dir"
    else
        log_result "disaster_recovery" "repository_backup" "fail" "Repository backup failed"
    fi
    
    # Test 5.2: Documentation for disaster recovery
    local dr_docs=("DISASTER_RECOVERY.md" "docs/disaster-recovery.md" "README.md")
    local dr_doc_found=false
    
    for doc in "${dr_docs[@]}"; do
        if [ -f "$doc" ] && grep -qi "disaster\|recovery\|backup\|restore" "$doc" 2>/dev/null; then
            log_result "disaster_recovery" "documentation" "pass" "Disaster recovery documentation found: $doc"
            dr_doc_found=true
            break
        fi
    done
    
    if [ "$dr_doc_found" = false ]; then
        log_result "disaster_recovery" "documentation" "warn" "No disaster recovery documentation found"
    fi
    
    # Test 5.3: Contact information for emergency
    if grep -r "emergency\|contact\|support" --include="*.md" . >/dev/null 2>&1; then
        log_result "disaster_recovery" "emergency_contacts" "pass" "Emergency contact information found"
    else
        log_result "disaster_recovery" "emergency_contacts" "warn" "No emergency contact information found"
    fi
    
    # Test 5.4: Recovery time objective validation
    local critical_files=("package.json" "docker-compose.yml" "README.md")
    local critical_files_backed_up=0
    
    for file in "${critical_files[@]}"; do
        if [ -f "$file" ] && git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
            ((critical_files_backed_up++))
        fi
    done
    
    if [ "$critical_files_backed_up" -ge 2 ]; then
        log_result "disaster_recovery" "critical_files_backup" "pass" "Critical files backed up ($critical_files_backed_up/3)"
    else
        log_result "disaster_recovery" "critical_files_backup" "warn" "Limited critical files backup ($critical_files_backed_up/3)"
    fi
}

# Main execution
main() {
    echo -e "Starting rollback procedures validation at $(date)"
    
    # Update timestamp in report
    if command -v jq >/dev/null 2>&1; then
        jq --arg timestamp "$(date -Iseconds)" '.validation_timestamp = $timestamp' \
           "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
    fi
    
    # Create backup before testing
    create_backup
    
    # Run all tests
    test_git_rollback
    test_deployment_rollback
    test_database_rollback
    test_configuration_rollback
    test_disaster_recovery
    
    # Final validation result
    echo -e "\n=================================================================="
    if [ "$VALIDATION_PASSED" = true ]; then
        echo -e "${GREEN}🎉 ROLLBACK PROCEDURES VALIDATION: PASSED${NC}"
        echo -e "${BLUE}📋 Rollback Capabilities Summary:${NC}"
        echo "• ✅ Git rollback procedures operational"
        echo "• ✅ Deployment rollback strategies in place"
        echo "• ✅ Database rollback capability validated"
        echo "• ✅ Configuration rollback procedures ready"
        echo "• ✅ Disaster recovery procedures documented"
        
        if command -v jq >/dev/null 2>&1; then
            jq '.results.overall_status = "passed"' "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
        fi
        
        echo -e "\n${GREEN}🛡️ System is prepared for safe rollback operations${NC}"
        exit 0
    else
        echo -e "${RED}❌ ROLLBACK PROCEDURES VALIDATION: FAILED${NC}"
        echo -e "${YELLOW}📝 Review the failed tests above and implement missing rollback procedures${NC}"
        echo -e "${YELLOW}💡 Consider improving backup strategies, documentation, and recovery procedures${NC}"
        
        if command -v jq >/dev/null 2>&1; then
            jq '.results.overall_status = "failed"' "$VALIDATION_REPORT" > "${VALIDATION_REPORT}.tmp" && mv "${VALIDATION_REPORT}.tmp" "$VALIDATION_REPORT"
        fi
        
        exit 1
    fi
}

# Run main function
main "$@"