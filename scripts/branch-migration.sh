#!/bin/bash

# MediaNest Branch Migration Script
# Migrates from current chaotic branch state to 4-branch strategy
# Usage: ./scripts/branch-migration.sh [--dry-run] [--force]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_BUNDLE="medianest-branch-backup-$(date +%Y%m%d-%H%M%S).bundle"
LOG_FILE="branch-migration-$(date +%Y%m%d-%H%M%S).log"

# Target branches for the new strategy
TARGET_BRANCHES=("main" "development" "test" "claude-flowv2")

# Branches to preserve (have valuable work)
PRESERVE_BRANCHES=("dev" "pr-3-frontend-application" "pr-4-frontend-backend-integration")

# Function to log messages
log() {
    echo -e "${1}" | tee -a "$LOG_FILE"
}

# Function to execute commands with logging
execute() {
    local cmd="$1"
    local description="$2"
    
    log "${BLUE}[INFO]${NC} $description"
    log "${BLUE}[CMD]${NC} $cmd"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "${YELLOW}[DRY-RUN]${NC} Would execute: $cmd"
        return 0
    fi
    
    if eval "$cmd" >> "$LOG_FILE" 2>&1; then
        log "${GREEN}[SUCCESS]${NC} $description completed"
        return 0
    else
        log "${RED}[ERROR]${NC} $description failed"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "${BLUE}[INFO]${NC} Checking prerequisites..."
    
    # Check if we're in a git repository
    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        log "${RED}[ERROR]${NC} Not in a git repository"
        exit 1
    fi
    
    # Check if working directory is clean
    if [[ "$FORCE" != "true" ]] && ! git diff-index --quiet HEAD --; then
        log "${RED}[ERROR]${NC} Working directory is not clean. Commit or stash changes first, or use --force"
        exit 1
    fi
    
    # Check if main branch exists
    if ! git show-ref --verify --quiet refs/heads/main; then
        log "${RED}[ERROR]${NC} Main branch does not exist"
        exit 1
    fi
    
    log "${GREEN}[SUCCESS]${NC} Prerequisites check passed"
}

# Function to create backup
create_backup() {
    log "${BLUE}[INFO]${NC} Creating backup of all branches..."
    
    execute "git bundle create '$BACKUP_BUNDLE' --all" "Creating bundle backup"
    
    if [[ -f "$BACKUP_BUNDLE" ]]; then
        log "${GREEN}[SUCCESS]${NC} Backup created: $BACKUP_BUNDLE"
    else
        log "${RED}[ERROR]${NC} Backup creation failed"
        exit 1
    fi
}

# Function to audit existing branches
audit_branches() {
    log "${BLUE}[INFO]${NC} Auditing existing branches..."
    
    echo "=== BRANCH AUDIT REPORT ===" >> "$LOG_FILE"
    echo "Date: $(date)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Local branches
    echo "LOCAL BRANCHES:" >> "$LOG_FILE"
    git for-each-ref --format='%(refname:short) | %(committerdate) | %(authorname) | %(subject)' refs/heads/ | sort >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Remote branches
    echo "REMOTE BRANCHES:" >> "$LOG_FILE"
    git for-each-ref --format='%(refname:short) | %(committerdate) | %(authorname) | %(subject)' refs/remotes/origin/ | sort >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Identify stale branches (older than 30 days)
    echo "STALE BRANCHES (>30 days):" >> "$LOG_FILE"
    git for-each-ref --format='%(refname:short) %(committerdate)' refs/heads/ refs/remotes/origin/ | \
    while read branch date; do
        if [[ $(date -d "$date" +%s) -lt $(date -d "30 days ago" +%s) ]]; then
            echo "$branch | $date" >> "$LOG_FILE"
        fi
    done
    
    log "${GREEN}[SUCCESS]${NC} Branch audit completed"
}

# Function to create target branches
create_target_branches() {
    log "${BLUE}[INFO]${NC} Creating target branches for 4-branch strategy..."
    
    # Ensure we're on main branch
    execute "git checkout main" "Switching to main branch"
    execute "git pull origin main" "Updating main branch"
    
    # Create development branch if it doesn't exist
    if ! git show-ref --verify --quiet refs/heads/development; then
        execute "git checkout -b development" "Creating development branch"
        execute "git push -u origin development" "Pushing development branch to remote"
    else
        log "${YELLOW}[WARNING]${NC} Development branch already exists"
    fi
    
    # Create test branch if it doesn't exist
    if ! git show-ref --verify --quiet refs/heads/test; then
        execute "git checkout main" "Switching to main branch"
        execute "git checkout -b test" "Creating test branch"
        execute "git push -u origin test" "Pushing test branch to remote"
    else
        log "${YELLOW}[WARNING]${NC} Test branch already exists"
    fi
    
    # Handle claude-flowv2 branch (might exist as claude-flow2)
    if ! git show-ref --verify --quiet refs/heads/claude-flowv2; then
        if git show-ref --verify --quiet refs/heads/claude-flow2; then
            # Rename existing claude-flow2 to claude-flowv2
            execute "git checkout claude-flow2" "Switching to claude-flow2 branch"
            execute "git branch -m claude-flowv2" "Renaming claude-flow2 to claude-flowv2"
            execute "git push -u origin claude-flowv2" "Pushing renamed branch to remote"
            execute "git push origin --delete claude-flow2" "Deleting old branch name from remote"
        else
            execute "git checkout main" "Switching to main branch"
            execute "git checkout -b claude-flowv2" "Creating claude-flowv2 branch"
            execute "git push -u origin claude-flowv2" "Pushing claude-flowv2 branch to remote"
        fi
    else
        log "${YELLOW}[WARNING]${NC} claude-flowv2 branch already exists"
    fi
}

# Function to merge valuable branches
merge_valuable_branches() {
    log "${BLUE}[INFO]${NC} Merging valuable branches into appropriate targets..."
    
    # Merge dev branch into development
    if git show-ref --verify --quiet refs/heads/dev; then
        execute "git checkout development" "Switching to development branch"
        execute "git merge dev --no-ff -m 'Merge dev branch into development as part of branch strategy migration'" "Merging dev into development"
    fi
    
    # Merge valuable PR branches into development
    for branch in "${PRESERVE_BRANCHES[@]}"; do
        if git show-ref --verify --quiet "refs/heads/$branch"; then
            log "${BLUE}[INFO]${NC} Processing branch: $branch"
            execute "git checkout development" "Switching to development branch"
            
            # Check if branch has unique commits
            if git merge-base --is-ancestor "$branch" development; then
                log "${YELLOW}[WARNING]${NC} Branch $branch has no unique commits, skipping merge"
            else
                execute "git merge $branch --no-ff -m 'Merge $branch into development (branch strategy migration)'" "Merging $branch into development"
            fi
        fi
    done
}

# Function to clean up obsolete branches
cleanup_branches() {
    log "${BLUE}[INFO]${NC} Cleaning up obsolete branches..."
    
    # Define patterns for branches to delete
    local delete_patterns=(
        "pr-*"
        "pr/*" 
        "codex/*"
        "*-codex/*"
        "dependabot/*"
    )
    
    # Local branch cleanup
    log "${BLUE}[INFO]${NC} Cleaning up local branches..."
    for pattern in "${delete_patterns[@]}"; do
        git branch | grep -E "^[[:space:]]*${pattern//\*/.*}$" | while read -r branch; do
            branch=$(echo "$branch" | xargs)  # trim whitespace
            if [[ "$branch" != "main" && "$branch" != "development" && "$branch" != "test" && "$branch" != "claude-flowv2" ]]; then
                execute "git branch -D $branch" "Deleting local branch: $branch"
            fi
        done
    done
    
    # Clean up merged branches (except protected ones)
    git branch --merged development | grep -v -E "(main|development|test|claude-flowv2|\*)" | while read -r branch; do
        branch=$(echo "$branch" | xargs)
        execute "git branch -d $branch" "Deleting merged branch: $branch"
    done
    
    # Remote branch cleanup
    if [[ "$FORCE" == "true" ]]; then
        log "${BLUE}[INFO]${NC} Cleaning up remote branches (forced)..."
        for pattern in "${delete_patterns[@]}"; do
            git branch -r | grep -E "origin/${pattern//\*/.*}" | sed 's/origin\///' | while read -r branch; do
                branch=$(echo "$branch" | xargs)
                if [[ "$branch" != "main" && "$branch" != "development" && "$branch" != "test" && "$branch" != "claude-flowv2" ]]; then
                    execute "git push origin --delete $branch" "Deleting remote branch: $branch"
                fi
            done
        done
    fi
    
    # Clean up remote tracking branches
    execute "git remote prune origin" "Pruning remote tracking branches"
}

# Function to configure branch protection
configure_protection() {
    log "${BLUE}[INFO]${NC} Branch protection configuration..."
    log "${YELLOW}[WARNING]${NC} Branch protection rules need to be configured manually in GitHub/GitLab"
    log "${BLUE}[INFO]${NC} See .github/branch-protection.yml for configuration details"
    log "${BLUE}[INFO]${NC} Apply these settings in your repository's Settings > Branches section"
}

# Function to verify migration
verify_migration() {
    log "${BLUE}[INFO]${NC} Verifying migration..."
    
    # Check that all target branches exist
    local all_exist=true
    for branch in "${TARGET_BRANCHES[@]}"; do
        if git show-ref --verify --quiet "refs/heads/$branch"; then
            log "${GREEN}[SUCCESS]${NC} Branch $branch exists"
        else
            log "${RED}[ERROR]${NC} Branch $branch does not exist"
            all_exist=false
        fi
    done
    
    # Check branch relationships
    execute "git checkout main" "Switching to main branch"
    execute "git log --oneline -10" "Showing recent commits on main"
    
    execute "git checkout development" "Switching to development branch"
    execute "git log --oneline -10" "Showing recent commits on development"
    
    if [[ "$all_exist" == "true" ]]; then
        log "${GREEN}[SUCCESS]${NC} Migration verification passed"
        return 0
    else
        log "${RED}[ERROR]${NC} Migration verification failed"
        return 1
    fi
}

# Function to generate migration report
generate_report() {
    log "${BLUE}[INFO]${NC} Generating migration report..."
    
    local report_file="branch-migration-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# MediaNest Branch Migration Report

**Date:** $(date)
**Migration Script Version:** 1.0

## Migration Summary

This report documents the migration from the previous chaotic branch state to the new 4-branch strategy.

### Target Branch Architecture
- **main**: Production-ready code
- **development**: Feature integration and staging
- **test**: Testing and QA validation  
- **claude-flowv2**: AI development workflows

### Migration Actions Performed

#### Branches Created
$(for branch in "${TARGET_BRANCHES[@]}"; do
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        echo "- ✅ $branch"
    else
        echo "- ❌ $branch (failed to create)"
    fi
done)

#### Branches Merged
$(for branch in "${PRESERVE_BRANCHES[@]}"; do
    echo "- $branch → development"
done)

#### Cleanup Summary
- Removed obsolete PR branches
- Removed experimental codex branches  
- Removed old dependabot branches
- Pruned stale remote tracking branches

### Post-Migration Tasks
- [ ] Configure branch protection rules in GitHub/GitLab
- [ ] Update CI/CD pipeline triggers
- [ ] Train team on new workflow
- [ ] Update documentation links

### Backup Information
- **Backup File:** $BACKUP_BUNDLE
- **Log File:** $LOG_FILE
- **Report File:** $report_file

### Next Steps
1. Apply branch protection rules from .github/branch-protection.yml
2. Configure automated deployments for each branch
3. Train development team on new workflow
4. Monitor adoption and optimize based on usage

EOF

    log "${GREEN}[SUCCESS]${NC} Migration report generated: $report_file"
}

# Main execution function
main() {
    local DRY_RUN=false
    local FORCE=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--dry-run] [--force] [--help]"
                echo ""
                echo "Options:"
                echo "  --dry-run    Show what would be done without executing"
                echo "  --force      Force migration even with uncommitted changes"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    log "${GREEN}[START]${NC} MediaNest Branch Migration Script"
    log "${BLUE}[INFO]${NC} Dry run mode: $DRY_RUN"
    log "${BLUE}[INFO]${NC} Force mode: $FORCE"
    log "${BLUE}[INFO]${NC} Log file: $LOG_FILE"
    
    # Execute migration steps
    check_prerequisites
    
    if [[ "$DRY_RUN" != "true" ]]; then
        create_backup
    fi
    
    audit_branches
    create_target_branches
    merge_valuable_branches
    cleanup_branches
    configure_protection
    verify_migration
    generate_report
    
    log "${GREEN}[COMPLETE]${NC} Branch migration completed successfully!"
    log "${BLUE}[INFO]${NC} Next steps:"
    log "  1. Review the migration report"
    log "  2. Configure branch protection rules"
    log "  3. Update CI/CD pipelines"
    log "  4. Train your team on the new workflow"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        log "${YELLOW}[BACKUP]${NC} Don't forget to keep your backup file: $BACKUP_BUNDLE"
    fi
}

# Export functions for potential external usage
export -f log execute check_prerequisites create_backup audit_branches
export -f create_target_branches merge_valuable_branches cleanup_branches
export -f configure_protection verify_migration generate_report

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi