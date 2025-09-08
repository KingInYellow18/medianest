#!/bin/bash

# MediaNest Dependency Cleanup Script
# Resolves security vulnerabilities, version conflicts, and removes unused dependencies
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

run_npm_command() {
    local dir="$1"
    local cmd="$2"
    local description="$3"
    
    if [[ ! -f "$dir/package.json" ]]; then
        verbose_log "Skipping $description - no package.json in $dir"
        return 0
    fi
    
    log "INFO" "$description in $dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "[DRY RUN] Would run: cd $dir && $cmd"
        return 0
    fi
    
    if (cd "$dir" && eval "$cmd"); then
        log "SUCCESS" "$description completed"
        return 0
    else
        log "ERROR" "$description failed"
        return 1
    fi
}

audit_and_fix_vulnerabilities() {
    log "INFO" "=== Auditing and fixing security vulnerabilities ==="
    
    local package_dirs=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    for dir in "${package_dirs[@]}"; do
        if [[ -f "$dir/package.json" ]]; then
            # First, audit to see current vulnerabilities
            log "INFO" "Auditing vulnerabilities in $(basename "$dir")"
            if [[ "$DRY_RUN" == false ]]; then
                (cd "$dir" && npm audit --audit-level=moderate) || true
            fi
            
            # Attempt automatic fixes
            run_npm_command "$dir" "npm audit fix --force" "Fixing vulnerabilities automatically"
            
            # Update package-lock.json
            run_npm_command "$dir" "npm install --package-lock-only" "Updating package-lock.json"
        fi
    done
}

resolve_version_conflicts() {
    log "INFO" "=== Resolving version conflicts ==="
    
    # Known version conflicts from audit
    local version_fixes=(
        # Express version conflicts (4.x vs 5.x)
        "express@^4.19.2"
        # Helmet version standardization  
        "helmet@^7.1.0"
        # Core dependencies updates
        "@types/node@^20.11.0"
        "typescript@^5.3.0"
        "vitest@^1.2.0"
        "@vitejs/plugin-react@^4.2.0"
    )
    
    for dir in "$PROJECT_ROOT" "$PROJECT_ROOT/backend" "$PROJECT_ROOT/frontend" "$PROJECT_ROOT/shared"; do
        if [[ -f "$dir/package.json" ]]; then
            log "INFO" "Resolving conflicts in $(basename "$dir")"
            
            for fix in "${version_fixes[@]}"; do
                if [[ "$DRY_RUN" == false ]]; then
                    # Check if package exists in package.json
                    local package_name="${fix%@*}"
                    if jq -e ".dependencies.\"$package_name\" // .devDependencies.\"$package_name\"" "$dir/package.json" >/dev/null 2>&1; then
                        verbose_log "Updating $package_name in $(basename "$dir")"
                        (cd "$dir" && npm install "$fix" --save-exact) || true
                    fi
                else
                    log "INFO" "[DRY RUN] Would install: $fix in $(basename "$dir")"
                fi
            done
        fi
    done
}

remove_unused_dependencies() {
    log "INFO" "=== Identifying and removing unused dependencies ==="
    
    # Install depcheck if not available
    if ! command -v npx >/dev/null 2>&1; then
        log "WARN" "npx not available - skipping unused dependency check"
        return 0
    fi
    
    local package_dirs=(
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend" 
        "$PROJECT_ROOT/shared"
    )
    
    for dir in "${package_dirs[@]}"; do
        if [[ -f "$dir/package.json" ]]; then
            log "INFO" "Checking unused dependencies in $(basename "$dir")"
            
            if [[ "$DRY_RUN" == false ]]; then
                # Use depcheck to find unused dependencies
                if (cd "$dir" && npx depcheck --json) > /tmp/depcheck-output.json 2>/dev/null; then
                    # Parse unused dependencies
                    local unused_deps
                    unused_deps=$(jq -r '.dependencies[]?' /tmp/depcheck-output.json 2>/dev/null || echo "")
                    
                    if [[ -n "$unused_deps" ]]; then
                        log "WARN" "Unused dependencies found in $(basename "$dir"):"
                        echo "$unused_deps" | while read -r dep; do
                            if [[ -n "$dep" ]]; then
                                log "WARN" "  - $dep"
                                # Remove unused dependency
                                (cd "$dir" && npm uninstall "$dep") || true
                            fi
                        done
                    else
                        log "INFO" "No unused dependencies found in $(basename "$dir")"
                    fi
                    
                    rm -f /tmp/depcheck-output.json
                fi
            else
                log "INFO" "[DRY RUN] Would check for unused dependencies in $(basename "$dir")"
            fi
        fi
    done
}

dedupe_dependencies() {
    log "INFO" "=== Deduplicating dependencies ==="
    
    local package_dirs=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    for dir in "${package_dirs[@]}"; do
        run_npm_command "$dir" "npm dedupe" "Deduplicating dependencies"
    done
}

update_security_dependencies() {
    log "INFO" "=== Updating security-critical dependencies ==="
    
    # Security-critical packages that should be kept up-to-date
    local security_packages=(
        "helmet"
        "express-rate-limit"
        "cors"
        "bcrypt"
        "jsonwebtoken"
        "express-validator"
        "@types/bcrypt"
        "@types/jsonwebtoken"
    )
    
    for dir in "$PROJECT_ROOT" "$PROJECT_ROOT/backend"; do
        if [[ -f "$dir/package.json" ]]; then
            log "INFO" "Updating security packages in $(basename "$dir")"
            
            for package in "${security_packages[@]}"; do
                if [[ "$DRY_RUN" == false ]]; then
                    # Check if package exists and update it
                    if jq -e ".dependencies.\"$package\" // .devDependencies.\"$package\"" "$dir/package.json" >/dev/null 2>&1; then
                        verbose_log "Updating $package"
                        (cd "$dir" && npm update "$package") || true
                    fi
                else
                    log "INFO" "[DRY RUN] Would update: $package in $(basename "$dir")"
                fi
            done
        fi
    done
}

optimize_bundle_size() {
    log "INFO" "=== Optimizing bundle size ==="
    
    # Frontend-specific optimizations
    if [[ -f "$PROJECT_ROOT/frontend/package.json" ]]; then
        local frontend_optimizations=(
            # Replace heavy dependencies with lighter alternatives
            "date-fns@^3.3.0"  # Instead of moment.js
            "lodash-es@^4.17.21"  # Tree-shakeable lodash
        )
        
        for optimization in "${frontend_optimizations[@]}"; do
            local package_name="${optimization%@*}"
            if [[ "$DRY_RUN" == false ]]; then
                # Only install if it would replace something heavier
                if jq -e ".dependencies.moment // .dependencies.lodash" "$PROJECT_ROOT/frontend/package.json" >/dev/null 2>&1; then
                    verbose_log "Installing lighter alternative: $optimization"
                    (cd "$PROJECT_ROOT/frontend" && npm install "$optimization") || true
                fi
            else
                log "INFO" "[DRY RUN] Would install bundle optimization: $optimization"
            fi
        done
    fi
}

clean_lockfiles() {
    log "INFO" "=== Cleaning and regenerating lock files ==="
    
    local package_dirs=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    for dir in "${package_dirs[@]}"; do
        if [[ -f "$dir/package.json" ]]; then
            if [[ "$DRY_RUN" == false ]]; then
                # Remove old lock file and regenerate
                if [[ -f "$dir/package-lock.json" ]]; then
                    verbose_log "Regenerating package-lock.json in $(basename "$dir")"
                    rm -f "$dir/package-lock.json"
                    (cd "$dir" && npm install --package-lock-only) || true
                fi
            else
                log "INFO" "[DRY RUN] Would regenerate package-lock.json in $(basename "$dir")"
            fi
        fi
    done
}

verify_installations() {
    log "INFO" "=== Verifying installations ==="
    
    local package_dirs=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend" 
        "$PROJECT_ROOT/frontend"
        "$PROJECT_ROOT/shared"
    )
    
    local failed_dirs=()
    
    for dir in "${package_dirs[@]}"; do
        if [[ -f "$dir/package.json" ]]; then
            log "INFO" "Verifying installation in $(basename "$dir")"
            
            if [[ "$DRY_RUN" == false ]]; then
                if ! (cd "$dir" && npm ls --depth=0 >/dev/null 2>&1); then
                    log "WARN" "Installation issues found in $(basename "$dir")"
                    failed_dirs+=("$dir")
                    
                    # Attempt to fix
                    (cd "$dir" && npm install) || true
                else
                    log "SUCCESS" "Installation verified in $(basename "$dir")"
                fi
            else
                log "INFO" "[DRY RUN] Would verify installation in $(basename "$dir")"
            fi
        fi
    done
    
    if [[ ${#failed_dirs[@]} -gt 0 ]]; then
        log "WARN" "Some directories had installation issues: ${failed_dirs[*]}"
    fi
}

show_dependency_summary() {
    log "INFO" "=== Dependency Cleanup Summary ==="
    
    local package_dirs=(
        "$PROJECT_ROOT"
        "$PROJECT_ROOT/backend"
        "$PROJECT_ROOT/frontend" 
        "$PROJECT_ROOT/shared"
    )
    
    for dir in "${package_dirs[@]}"; do
        if [[ -f "$dir/package.json" ]]; then
            local dep_count=$(jq '.dependencies // {} | length' "$dir/package.json" 2>/dev/null || echo "0")
            local dev_dep_count=$(jq '.devDependencies // {} | length' "$dir/package.json" 2>/dev/null || echo "0")
            
            log "INFO" "$(basename "$dir"):"
            log "INFO" "  - Dependencies: $dep_count"
            log "INFO" "  - Dev Dependencies: $dev_dep_count"
            
            # Show vulnerability count if not dry run
            if [[ "$DRY_RUN" == false ]]; then
                local vuln_count
                vuln_count=$(cd "$dir" && npm audit --audit-level=moderate --json 2>/dev/null | jq '.metadata.vulnerabilities.total // 0' || echo "0")
                log "INFO" "  - Vulnerabilities: $vuln_count"
            fi
        fi
    done
}

main() {
    echo -e "${BLUE}MediaNest Dependency Cleanup${NC}\n"
    
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
        log "INFO" "DRY RUN MODE - No dependencies will be modified"
    fi
    
    # Check for npm
    if ! command -v npm >/dev/null 2>&1; then
        log "ERROR" "npm is required but not installed"
        exit 1
    fi
    
    # Run dependency cleanup operations
    audit_and_fix_vulnerabilities
    resolve_version_conflicts
    remove_unused_dependencies
    dedupe_dependencies
    update_security_dependencies
    optimize_bundle_size
    clean_lockfiles
    verify_installations
    
    # Show summary
    show_dependency_summary
    
    if [[ "$DRY_RUN" == false ]]; then
        log "SUCCESS" "Dependency cleanup completed successfully!"
        log "INFO" "Run 'npm test' in each directory to verify functionality"
    else
        log "INFO" "Dry run completed - no dependencies were modified"
    fi
}

main "$@"