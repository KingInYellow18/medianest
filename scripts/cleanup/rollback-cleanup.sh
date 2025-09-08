#!/bin/bash

# MediaNest Cleanup Rollback Script
# Safely rollback cleanup operations and restore previous state
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

# Configuration
DRY_RUN=false
SKIP_CONFIRMATION=false
VERBOSE=false
ROLLBACK_CATEGORY=""
BACKUP_DIR=""

# Available rollback categories
readonly CATEGORIES=(
    "files"
    "dependencies"
    "code"
    "docs"
    "all"
)

usage() {
    cat << EOF
MediaNest Cleanup Rollback Script

USAGE:
    $0 [OPTIONS] [CATEGORY] [BACKUP_DIR]

CATEGORIES:
    files         Rollback file cleanup operations
    dependencies  Rollback dependency changes
    code          Rollback code refactoring changes
    docs          Rollback documentation reorganization
    all           Rollback all categories

OPTIONS:
    -d, --dry-run           Show what would be rolled back without executing
    -y, --yes              Skip confirmation prompts
    -v, --verbose          Enable verbose output
    -h, --help            Show this help message

ARGUMENTS:
    CATEGORY              Category to rollback (optional, defaults to 'all')
    BACKUP_DIR            Specific backup directory path (optional)

EXAMPLES:
    $0                                    # Interactive rollback selection
    $0 files                             # Rollback file cleanup only
    $0 --dry-run all                     # Preview complete rollback
    $0 code /path/to/backup              # Rollback code changes from specific backup

EOF
}

log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
}

verbose_log() {
    [[ "$VERBOSE" == true ]] && log "INFO" "$@"
}

find_backup_directories() {
    log "INFO" "Searching for cleanup backup directories..."
    
    local backup_dirs=()
    
    # Look for cleanup backup directories
    while IFS= read -r -d '' dir; do
        backup_dirs+=("$dir")
    done < <(find "$PROJECT_ROOT" -maxdepth 1 -name "cleanup-backups-*" -type d -print0 2>/dev/null || true)
    
    if [[ ${#backup_dirs[@]} -eq 0 ]]; then
        log "WARN" "No cleanup backup directories found"
        return 1
    fi
    
    # Sort by modification time (newest first)
    printf '%s\0' "${backup_dirs[@]}" | sort -z -t- -k3nr | while IFS= read -r -d '' dir; do
        local timestamp=$(basename "$dir" | sed 's/cleanup-backups-//')
        local size=$(du -sh "$dir" 2>/dev/null | cut -f1)
        log "INFO" "Found backup: $dir ($(date -d "$timestamp" 2>/dev/null || echo "$timestamp"), $size)"
    done
    
    return 0
}

select_backup_directory() {
    if [[ -n "$BACKUP_DIR" ]]; then
        if [[ ! -d "$BACKUP_DIR" ]]; then
            log "ERROR" "Specified backup directory does not exist: $BACKUP_DIR"
            return 1
        fi
        return 0
    fi
    
    log "INFO" "Available backup directories:"
    
    local backup_dirs=()
    while IFS= read -r -d '' dir; do
        backup_dirs+=("$dir")
    done < <(find "$PROJECT_ROOT" -maxdepth 1 -name "cleanup-backups-*" -type d -print0 2>/dev/null | sort -z -t- -k3nr || true)
    
    if [[ ${#backup_dirs[@]} -eq 0 ]]; then
        log "ERROR" "No backup directories found. Cannot proceed with rollback."
        return 1
    fi
    
    # Show backup options
    for i in "${!backup_dirs[@]}"; do
        local dir="${backup_dirs[$i]}"
        local timestamp=$(basename "$dir" | sed 's/cleanup-backups-//')
        local size=$(du -sh "$dir" 2>/dev/null | cut -f1)
        local date_formatted=$(date -d "$timestamp" 2>/dev/null || echo "$timestamp")
        echo "  $((i + 1)). $dir ($date_formatted, $size)"
    done
    
    if [[ "$SKIP_CONFIRMATION" == false ]]; then
        echo ""
        read -p "Select backup directory (1-${#backup_dirs[@]}, or 0 to cancel): " -r selection
        
        if [[ "$selection" == "0" ]]; then
            log "INFO" "Rollback cancelled by user"
            return 1
        fi
        
        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le ${#backup_dirs[@]} ]]; then
            BACKUP_DIR="${backup_dirs[$((selection - 1))]}"
        else
            log "ERROR" "Invalid selection: $selection"
            return 1
        fi
    else
        # Auto-select most recent backup
        BACKUP_DIR="${backup_dirs[0]}"
    fi
    
    log "INFO" "Selected backup directory: $BACKUP_DIR"
    return 0
}

rollback_git_commits() {
    log "INFO" "=== Rolling back Git commits ==="
    
    # Look for cleanup commits
    local cleanup_commits=$(git -C "$PROJECT_ROOT" log --oneline --grep="cleanup" --grep="Cleanup" --since="1 day ago" | head -5)
    
    if [[ -z "$cleanup_commits" ]]; then
        log "INFO" "No recent cleanup commits found"
        return 0
    fi
    
    log "INFO" "Recent cleanup commits:"
    echo "$cleanup_commits"
    
    if [[ "$DRY_RUN" == false ]]; then
        if [[ "$SKIP_CONFIRMATION" == false ]]; then
            echo ""
            read -p "Do you want to reset to the commit before cleanup? (y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "INFO" "Skipping git rollback"
                return 0
            fi
        fi
        
        # Find the commit hash before cleanup
        local pre_cleanup_commit
        pre_cleanup_commit=$(git -C "$PROJECT_ROOT" log --oneline --grep="Pre-cleanup backup commit" --since="1 day ago" | head -1 | cut -d' ' -f1)
        
        if [[ -n "$pre_cleanup_commit" ]]; then
            log "INFO" "Rolling back to pre-cleanup commit: $pre_cleanup_commit"
            
            if git -C "$PROJECT_ROOT" reset --hard "$pre_cleanup_commit"; then
                log "SUCCESS" "Git rollback completed"
            else
                log "ERROR" "Git rollback failed"
                return 1
            fi
        else
            log "WARN" "Pre-cleanup backup commit not found"
        fi
    else
        log "INFO" "[DRY RUN] Would rollback git commits"
    fi
}

restore_from_backup() {
    local category="$1"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "ERROR" "Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    log "INFO" "=== Restoring $category from backup ==="
    
    case "$category" in
        "files")
            restore_files_from_backup
            ;;
        "dependencies")
            restore_dependencies_from_backup
            ;;
        "code")
            restore_code_from_backup
            ;;
        "docs")
            restore_docs_from_backup
            ;;
        "all")
            restore_files_from_backup
            restore_dependencies_from_backup
            restore_code_from_backup
            restore_docs_from_backup
            ;;
        *)
            log "ERROR" "Unknown category: $category"
            return 1
            ;;
    esac
}

restore_files_from_backup() {
    log "INFO" "Restoring files from backup..."
    
    # Files that might have been deleted during cleanup
    local restore_targets=(
        "server-direct.log"
        "startup.log"
        "backups"
        "legacy-audit"
        "debt-analysis"
    )
    
    for target in "${restore_targets[@]}"; do
        local backup_path="$BACKUP_DIR/$target"
        local restore_path="$PROJECT_ROOT/$target"
        
        if [[ -e "$backup_path" ]]; then
            if [[ "$DRY_RUN" == false ]]; then
                cp -r "$backup_path" "$restore_path"
                log "SUCCESS" "Restored: $target"
            else
                log "INFO" "[DRY RUN] Would restore: $target"
            fi
        else
            verbose_log "Backup not found for: $target"
        fi
    done
}

restore_dependencies_from_backup() {
    log "INFO" "Restoring dependencies from backup..."
    
    local package_files=(
        "package.json"
        "package-lock.json"
        "backend/package.json"
        "backend/package-lock.json"
        "frontend/package.json"
        "frontend/package-lock.json"
        "shared/package.json"
        "shared/package-lock.json"
    )
    
    for package_file in "${package_files[@]}"; do
        local backup_path="$BACKUP_DIR/$package_file"
        local restore_path="$PROJECT_ROOT/$package_file"
        
        if [[ -f "$backup_path" ]]; then
            if [[ "$DRY_RUN" == false ]]; then
                cp "$backup_path" "$restore_path"
                log "SUCCESS" "Restored: $package_file"
                
                # Reinstall dependencies
                local package_dir
                package_dir=$(dirname "$restore_path")
                if [[ -f "$package_dir/package.json" ]]; then
                    log "INFO" "Reinstalling dependencies in $(basename "$package_dir")"
                    (cd "$package_dir" && npm install) || true
                fi
            else
                log "INFO" "[DRY RUN] Would restore: $package_file"
            fi
        else
            verbose_log "Backup not found for: $package_file"
        fi
    done
}

restore_code_from_backup() {
    log "INFO" "Restoring code from backup..."
    
    # Look for .cleanup-backup files created during code cleanup
    find "$PROJECT_ROOT" -name "*.cleanup-backup" -type f | while read -r backup_file; do
        local original_file="${backup_file%.cleanup-backup}"
        
        if [[ "$DRY_RUN" == false ]]; then
            mv "$backup_file" "$original_file"
            log "SUCCESS" "Restored: $(basename "$original_file")"
        else
            log "INFO" "[DRY RUN] Would restore: $(basename "$original_file")"
        fi
    done
    
    # Restore specific code files from backup directory
    local code_backup_dir="$BACKUP_DIR/backend/src"
    if [[ -d "$code_backup_dir" ]]; then
        if [[ "$DRY_RUN" == false ]]; then
            cp -r "$code_backup_dir"/* "$PROJECT_ROOT/backend/src/"
            log "SUCCESS" "Restored backend source code"
        else
            log "INFO" "[DRY RUN] Would restore backend source code"
        fi
    fi
}

restore_docs_from_backup() {
    log "INFO" "Restoring documentation from backup..."
    
    # Remove organized docs directory
    local docs_dir="$PROJECT_ROOT/docs"
    if [[ -d "$docs_dir" ]]; then
        if [[ "$DRY_RUN" == false ]]; then
            rm -rf "$docs_dir"
            log "INFO" "Removed organized documentation directory"
        else
            log "INFO" "[DRY RUN] Would remove organized documentation directory"
        fi
    fi
    
    # Restore scattered documentation files
    local docs_backup_dir="$BACKUP_DIR/docs"
    if [[ -d "$docs_backup_dir" ]]; then
        if [[ "$DRY_RUN" == false ]]; then
            # Find all .md files in backup and restore to original locations
            find "$docs_backup_dir" -name "*.md" -type f | while read -r backup_doc; do
                local relative_path="${backup_doc#$docs_backup_dir/}"
                local restore_path="$PROJECT_ROOT/$relative_path"
                
                mkdir -p "$(dirname "$restore_path")"
                cp "$backup_doc" "$restore_path"
                verbose_log "Restored: $relative_path"
            done
            
            log "SUCCESS" "Restored documentation files"
        else
            log "INFO" "[DRY RUN] Would restore documentation files"
        fi
    fi
}

validate_rollback() {
    log "INFO" "=== Validating rollback ==="
    
    # Check git status
    if git -C "$PROJECT_ROOT" status --porcelain | grep -q .; then
        log "INFO" "Git working directory has changes after rollback"
    else
        log "INFO" "Git working directory is clean"
    fi
    
    # Check if project builds
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        log "INFO" "Testing project build..."
        if [[ "$DRY_RUN" == false ]]; then
            if (cd "$PROJECT_ROOT" && npm run build >/dev/null 2>&1); then
                log "SUCCESS" "Project builds successfully"
            else
                log "WARN" "Project build failed - manual intervention may be required"
            fi
        else
            log "INFO" "[DRY RUN] Would test project build"
        fi
    fi
}

show_rollback_summary() {
    log "INFO" "=== Rollback Summary ==="
    log "INFO" "Backup directory used: $BACKUP_DIR"
    log "INFO" "Category rolled back: $ROLLBACK_CATEGORY"
    
    if [[ "$DRY_RUN" == false ]]; then
        log "SUCCESS" "Rollback completed!"
        log "INFO" "Next steps:"
        log "INFO" "1. Review changes: git status && git diff"
        log "INFO" "2. Test functionality: npm test"
        log "INFO" "3. Start application to verify rollback success"
    else
        log "INFO" "Dry run completed - no changes were made"
    fi
}

main() {
    echo -e "${BLUE}MediaNest Cleanup Rollback${NC}"
    echo -e "${BLUE}===========================${NC}\n"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -y|--yes)
                SKIP_CONFIRMATION=true
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
            files|dependencies|code|docs|all)
                ROLLBACK_CATEGORY="$1"
                shift
                ;;
            *)
                if [[ -z "$ROLLBACK_CATEGORY" ]]; then
                    ROLLBACK_CATEGORY="$1"
                elif [[ -z "$BACKUP_DIR" ]]; then
                    BACKUP_DIR="$1"
                else
                    log "ERROR" "Unknown argument: $1"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Default to 'all' if no category specified
    if [[ -z "$ROLLBACK_CATEGORY" ]]; then
        ROLLBACK_CATEGORY="all"
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN MODE - No changes will be made"
    fi
    
    log "INFO" "Rollback category: $ROLLBACK_CATEGORY"
    
    # Validate environment
    if ! git -C "$PROJECT_ROOT" status >/dev/null 2>&1; then
        log "ERROR" "Not in a git repository. Rollback requires git for safety."
        exit 1
    fi
    
    # Find and select backup directory
    if ! find_backup_directories; then
        log "ERROR" "No backup directories found. Cannot perform rollback."
        exit 1
    fi
    
    if ! select_backup_directory; then
        exit 1
    fi
    
    # Confirm rollback
    if [[ "$SKIP_CONFIRMATION" == false ]] && [[ "$DRY_RUN" == false ]]; then
        echo -e "\n${YELLOW}⚠️  ROLLBACK CONFIRMATION ⚠️${NC}"
        echo "This will rollback cleanup changes for: $ROLLBACK_CATEGORY"
        echo "Using backup: $BACKUP_DIR"
        echo ""
        read -p "Are you sure you want to proceed? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    # Perform rollback
    rollback_git_commits
    restore_from_backup "$ROLLBACK_CATEGORY"
    validate_rollback
    
    # Show summary
    show_rollback_summary
}

# Handle script interruption
trap 'log "ERROR" "Rollback interrupted"; exit 130' INT TERM

main "$@"