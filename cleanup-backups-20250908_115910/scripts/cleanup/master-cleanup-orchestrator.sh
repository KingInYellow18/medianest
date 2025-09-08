#!/bin/bash

# MediaNest Technical Debt Cleanup Orchestrator
# Comprehensive automation for technical debt removal
# Created: 2025-09-08

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly LOG_FILE="$PROJECT_ROOT/scripts/cleanup/cleanup-$(date +%Y%m%d_%H%M%S).log"
readonly BACKUP_DIR="$PROJECT_ROOT/cleanup-backups-$(date +%Y%m%d_%H%M%S)"

# Flags
DRY_RUN=false
SKIP_CONFIRMATION=false
VERBOSE=false
CLEANUP_CATEGORIES=()

# Available cleanup categories
readonly CATEGORIES=(
    "files"         # Safe file deletion
    "dependencies"  # Dependency cleanup
    "code"          # Code refactoring
    "docs"          # Documentation reorganization
    "all"           # All categories
)

usage() {
    cat << EOF
MediaNest Technical Debt Cleanup Orchestrator

USAGE:
    $0 [OPTIONS] [CATEGORIES...]

CATEGORIES:
    files         Clean up temporary files, logs, and backups
    dependencies  Resolve security vulnerabilities and version conflicts
    code          Refactor and consolidate code patterns
    docs          Reorganize and consolidate documentation
    all           Run all cleanup categories (default)

OPTIONS:
    -d, --dry-run           Show what would be done without executing
    -y, --yes              Skip confirmation prompts
    -v, --verbose          Enable verbose output
    -h, --help            Show this help message

EXAMPLES:
    $0                     # Interactive cleanup of all categories
    $0 --dry-run files     # Preview file cleanup only
    $0 -y code docs        # Auto-confirm code and docs cleanup
    $0 --verbose all       # Verbose cleanup of everything

EOF
}

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
}

verbose_log() {
    if [[ "$VERBOSE" == true ]]; then
        log "DEBUG" "$@"
    fi
}

create_backup() {
    log "INFO" "Creating comprehensive backup before cleanup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Git commit current state
    if git -C "$PROJECT_ROOT" status --porcelain | grep -q .; then
        log "INFO" "Committing current state to git..."
        git -C "$PROJECT_ROOT" add -A
        git -C "$PROJECT_ROOT" commit -m "Pre-cleanup backup commit - $(date)" || true
    fi
    
    # Create backup of critical directories
    local backup_targets=(
        "package.json"
        "package-lock.json"
        ".env*"
        "scripts"
        "backend/package.json"
        "frontend/package.json"
        "shared/package.json"
        "docs"
        "config"
    )
    
    for target in "${backup_targets[@]}"; do
        if [[ -e "$PROJECT_ROOT/$target" ]]; then
            verbose_log "Backing up $target"
            cp -r "$PROJECT_ROOT/$target" "$BACKUP_DIR/" 2>/dev/null || true
        fi
    done
    
    log "SUCCESS" "Backup created at: $BACKUP_DIR"
}

validate_environment() {
    log "INFO" "Validating environment..."
    
    # Check if we're in a git repository
    if ! git -C "$PROJECT_ROOT" status >/dev/null 2>&1; then
        log "ERROR" "Not in a git repository. Cleanup requires git for safety."
        exit 1
    fi
    
    # Check for uncommitted changes
    if git -C "$PROJECT_ROOT" status --porcelain | grep -q .; then
        log "WARN" "Uncommitted changes detected. They will be committed as backup."
    fi
    
    # Check required tools
    local required_tools=("node" "npm" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log "ERROR" "Required tool '$tool' not found"
            exit 1
        fi
    done
    
    log "SUCCESS" "Environment validation passed"
}

run_cleanup_category() {
    local category="$1"
    local script_path="$SCRIPT_DIR/cleanup-${category}.sh"
    
    if [[ ! -f "$script_path" ]]; then
        log "ERROR" "Cleanup script not found: $script_path"
        return 1
    fi
    
    log "INFO" "Running $category cleanup..."
    
    local cmd=("$script_path")
    [[ "$DRY_RUN" == true ]] && cmd+=("--dry-run")
    [[ "$SKIP_CONFIRMATION" == true ]] && cmd+=("--yes")
    [[ "$VERBOSE" == true ]] && cmd+=("--verbose")
    
    if "${cmd[@]}"; then
        log "SUCCESS" "$category cleanup completed successfully"
        return 0
    else
        log "ERROR" "$category cleanup failed"
        return 1
    fi
}

show_summary() {
    log "INFO" "=== CLEANUP SUMMARY ==="
    log "INFO" "Backup location: $BACKUP_DIR"
    log "INFO" "Log file: $LOG_FILE"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN completed - no changes were made"
    else
        log "INFO" "Cleanup completed - review git changes before proceeding"
    fi
    
    # Show disk space saved
    if [[ -d "$PROJECT_ROOT" ]]; then
        local current_size=$(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1)
        log "INFO" "Current project size: $current_size"
    fi
}

confirm_action() {
    if [[ "$SKIP_CONFIRMATION" == true ]] || [[ "$DRY_RUN" == true ]]; then
        return 0
    fi
    
    echo -e "\n${YELLOW}⚠️  IMPORTANT SAFETY NOTICE ⚠️${NC}"
    echo "This cleanup will make significant changes to your project:"
    echo "• Delete temporary files, logs, and backup directories"
    echo "• Update dependencies and resolve security issues"
    echo "• Refactor code patterns and consolidate files"
    echo "• Reorganize documentation structure"
    echo ""
    echo "A comprehensive backup will be created before any changes."
    echo -e "Backup location: ${BLUE}$BACKUP_DIR${NC}"
    echo ""
    
    read -p "Do you want to proceed? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "INFO" "Cleanup cancelled by user"
        exit 0
    fi
}

main() {
    echo -e "${BLUE}MediaNest Technical Debt Cleanup Orchestrator${NC}"
    echo -e "${BLUE}=============================================${NC}\n"
    
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
                CLEANUP_CATEGORIES+=("$1")
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
    if [[ ${#CLEANUP_CATEGORIES[@]} -eq 0 ]]; then
        CLEANUP_CATEGORIES=("all")
    fi
    
    # Initialize log
    mkdir -p "$(dirname "$LOG_FILE")"
    log "INFO" "Starting MediaNest Technical Debt Cleanup"
    log "INFO" "Categories: ${CLEANUP_CATEGORIES[*]}"
    log "INFO" "Dry run: $DRY_RUN"
    
    # Validate environment
    validate_environment
    
    # Confirm action
    confirm_action
    
    # Create backup (unless dry run)
    if [[ "$DRY_RUN" == false ]]; then
        create_backup
    fi
    
    # Process categories
    local failed_categories=()
    for category in "${CLEANUP_CATEGORIES[@]}"; do
        if [[ "$category" == "all" ]]; then
            # Run all categories except 'all'
            for cat in "${CATEGORIES[@]}"; do
                if [[ "$cat" != "all" ]]; then
                    if ! run_cleanup_category "$cat"; then
                        failed_categories+=("$cat")
                    fi
                fi
            done
        else
            if ! run_cleanup_category "$category"; then
                failed_categories+=("$category")
            fi
        fi
    done
    
    # Show summary
    show_summary
    
    # Report failures
    if [[ ${#failed_categories[@]} -gt 0 ]]; then
        log "WARN" "Some cleanup categories failed: ${failed_categories[*]}"
        exit 1
    fi
    
    log "SUCCESS" "All cleanup operations completed successfully!"
    
    if [[ "$DRY_RUN" == false ]]; then
        echo -e "\n${GREEN}✅ Cleanup completed successfully!${NC}"
        echo -e "📁 Backup: ${BLUE}$BACKUP_DIR${NC}"
        echo -e "📋 Log: ${BLUE}$LOG_FILE${NC}"
        echo -e "\n${YELLOW}Next steps:${NC}"
        echo "1. Review git changes: git status && git diff"
        echo "2. Run tests: npm test"
        echo "3. Start application to verify functionality"
    fi
}

# Handle script interruption
trap 'log "ERROR" "Script interrupted"; exit 130' INT TERM

main "$@"