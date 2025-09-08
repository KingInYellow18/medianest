#!/bin/bash

# MediaNest File Cleanup Script
# Safely removes temporary files, logs, backups, and build artifacts
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

calculate_size() {
    local path="$1"
    if [[ -e "$path" ]]; then
        du -sh "$path" 2>/dev/null | cut -f1 || echo "0B"
    else
        echo "0B"
    fi
}

safe_remove() {
    local target="$1"
    local description="$2"
    
    if [[ ! -e "$target" ]]; then
        verbose_log "Skipping $description - not found: $target"
        return 0
    fi
    
    local size
    size=$(calculate_size "$target")
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "[DRY RUN] Would remove $description ($size): $target"
        return 0
    fi
    
    log "INFO" "Removing $description ($size): $target"
    
    if [[ -d "$target" ]]; then
        rm -rf "$target"
    else
        rm -f "$target"
    fi
    
    log "SUCCESS" "Removed $description ($size)"
}

cleanup_backup_directories() {
    log "INFO" "=== Cleaning up backup directories ==="
    
    local backup_patterns=(
        "$PROJECT_ROOT/backups"
        "$PROJECT_ROOT/backup-*"
        "$PROJECT_ROOT/*backup*"
        "$PROJECT_ROOT/.backup*"
        "$PROJECT_ROOT/cleanup-backups-*"
    )
    
    for pattern in "${backup_patterns[@]}"; do
        for backup_dir in $pattern; do
            if [[ -d "$backup_dir" ]]; then
                safe_remove "$backup_dir" "backup directory"
            fi
        done
    done
}

cleanup_log_files() {
    log "INFO" "=== Cleaning up log files ==="
    
    local log_files=(
        "$PROJECT_ROOT/server-direct.log"
        "$PROJECT_ROOT/startup.log"
        "$PROJECT_ROOT/debug.log"
        "$PROJECT_ROOT/error.log"
        "$PROJECT_ROOT/access.log"
        "$PROJECT_ROOT/*.log"
    )
    
    for log_file in "${log_files[@]}"; do
        for file in $log_file; do
            if [[ -f "$file" ]]; then
                safe_remove "$file" "log file"
            fi
        done
    done
    
    # Clean logs in subdirectories
    find "$PROJECT_ROOT" -name "*.log" -not -path "*/node_modules/*" -not -path "*/scripts/cleanup/*" | while read -r logfile; do
        safe_remove "$logfile" "log file"
    done
}

cleanup_audit_directories() {
    log "INFO" "=== Cleaning up audit directories ==="
    
    local audit_dirs=(
        "$PROJECT_ROOT/legacy-audit"
        "$PROJECT_ROOT/debt-analysis"
        "$PROJECT_ROOT/audit"
        "$PROJECT_ROOT/security/rotation"
    )
    
    for dir in "${audit_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            safe_remove "$dir" "audit directory"
        fi
    done
}

cleanup_temporary_files() {
    log "INFO" "=== Cleaning up temporary files ==="
    
    local temp_patterns=(
        "$PROJECT_ROOT/*.tmp"
        "$PROJECT_ROOT/*.temp"
        "$PROJECT_ROOT/tmp/*"
        "$PROJECT_ROOT/.tmp*"
        "$PROJECT_ROOT/*~"
        "$PROJECT_ROOT/.DS_Store"
        "$PROJECT_ROOT/Thumbs.db"
    )
    
    for pattern in "${temp_patterns[@]}"; do
        for temp_file in $pattern; do
            if [[ -e "$temp_file" ]]; then
                safe_remove "$temp_file" "temporary file"
            fi
        done
    done
    
    # Clean temporary directories
    local temp_dirs=(
        "$PROJECT_ROOT/temp"
        "$PROJECT_ROOT/tmp"
        "$PROJECT_ROOT/.temp"
    )
    
    for dir in "${temp_dirs[@]}"; do
        if [[ -d "$dir" && -z "$(ls -A "$dir" 2>/dev/null)" ]]; then
            safe_remove "$dir" "empty temporary directory"
        fi
    done
}

cleanup_build_artifacts() {
    log "INFO" "=== Cleaning up build artifacts ==="
    
    # Test reports and coverage
    local build_artifacts=(
        "$PROJECT_ROOT/coverage"
        "$PROJECT_ROOT/.nyc_output"
        "$PROJECT_ROOT/test-results"
        "$PROJECT_ROOT/junit.xml"
        "$PROJECT_ROOT/coverage.xml"
        "$PROJECT_ROOT/dynamic-imports-test-report.json"
        "$PROJECT_ROOT/bundle-analysis-report.json"
        "$PROJECT_ROOT/frontend/bundle-analysis-report.json"
    )
    
    for artifact in "${build_artifacts[@]}"; do
        if [[ -e "$artifact" ]]; then
            safe_remove "$artifact" "build artifact"
        fi
    done
    
    # Clean dist/build directories (but preserve if they contain production builds)
    local build_dirs=(
        "$PROJECT_ROOT/dist"
        "$PROJECT_ROOT/build"
        "$PROJECT_ROOT/out"
    )
    
    for dir in "${build_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            # Only remove if it looks like a development build
            if [[ -f "$dir/.development" ]] || [[ -f "$dir/build.log" ]]; then
                safe_remove "$dir" "development build directory"
            else
                verbose_log "Preserving potential production build: $dir"
            fi
        fi
    done
}

cleanup_documentation_duplicates() {
    log "INFO" "=== Cleaning up duplicate documentation ==="
    
    local doc_cleanup_targets=(
        "$PROJECT_ROOT/docs-old-*"
        "$PROJECT_ROOT/*.md.bak"
        "$PROJECT_ROOT/*.md~"
        "$PROJECT_ROOT/README.old"
        "$PROJECT_ROOT/CHANGELOG.old"
    )
    
    for target in "${doc_cleanup_targets[@]}"; do
        for item in $target; do
            if [[ -e "$item" ]]; then
                safe_remove "$item" "old documentation"
            fi
        done
    done
}

cleanup_package_artifacts() {
    log "INFO" "=== Cleaning up package artifacts ==="
    
    # Remove package-lock backup files
    find "$PROJECT_ROOT" -name "package-lock.json.bak" -o -name "package-lock.json~" | while read -r lockfile; do
        safe_remove "$lockfile" "package-lock backup"
    done
    
    # Remove npm debug logs
    find "$PROJECT_ROOT" -name "npm-debug.log*" -o -name "yarn-error.log" -not -path "*/node_modules/*" | while read -r npmlog; do
        safe_remove "$npmlog" "npm debug log"
    done
}

show_cleanup_summary() {
    log "INFO" "=== File Cleanup Summary ==="
    
    local current_size
    current_size=$(calculate_size "$PROJECT_ROOT")
    log "INFO" "Current project size: $current_size"
    
    # Count remaining files by category
    local log_count=$(find "$PROJECT_ROOT" -name "*.log" -not -path "*/node_modules/*" -not -path "*/scripts/cleanup/*" | wc -l)
    local backup_count=$(find "$PROJECT_ROOT" -name "*backup*" -type d | wc -l)
    local temp_count=$(find "$PROJECT_ROOT" -name "*.tmp" -o -name "*.temp" -o -name "*~" | wc -l)
    
    log "INFO" "Remaining files:"
    log "INFO" "  - Log files: $log_count"
    log "INFO" "  - Backup directories: $backup_count"
    log "INFO" "  - Temporary files: $temp_count"
}

main() {
    echo -e "${BLUE}MediaNest File Cleanup${NC}\n"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run) DRY_RUN=true; shift ;;
            --yes) SKIP_CONFIRMATION=true; shift ;;
            --verbose) VERBOSE=true; shift ;;
            *) log "ERROR" "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN MODE - No files will be deleted"
    fi
    
    # Calculate initial size
    local initial_size
    initial_size=$(calculate_size "$PROJECT_ROOT")
    log "INFO" "Initial project size: $initial_size"
    
    # Run cleanup operations
    cleanup_backup_directories
    cleanup_log_files
    cleanup_audit_directories
    cleanup_temporary_files
    cleanup_build_artifacts
    cleanup_documentation_duplicates
    cleanup_package_artifacts
    
    # Show summary
    show_cleanup_summary
    
    if [[ "$DRY_RUN" == false ]]; then
        log "SUCCESS" "File cleanup completed successfully!"
    else
        log "INFO" "Dry run completed - no files were deleted"
    fi
}

main "$@"