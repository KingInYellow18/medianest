#!/bin/bash
# MediaNest Dependency Cleanup Script
# Generated: 2025-09-09
# Purpose: Apply security updates and cleanup unused dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo -e "\n${BLUE}=====================================\n📋 $1\n=====================================${NC}"
}

# Check if we're in the correct directory
if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
    log_error "Please run this script from the MediaNest root directory"
    exit 1
fi

# Backup package-lock.json files
backup_locks() {
    log_section "Creating Backup of Lock Files"
    
    for dir in . backend frontend shared; do
        if [[ -f "$dir/package-lock.json" ]]; then
            cp "$dir/package-lock.json" "$dir/package-lock.json.backup-$(date +%Y%m%d-%H%M%S)"
            log_success "Backed up $dir/package-lock.json"
        fi
    done
}

# Function to show current vulnerability status
show_audit_status() {
    log_section "Current Security Status"
    
    for dir in . backend frontend shared; do
        if [[ -f "$dir/package.json" ]]; then
            log_info "Checking $dir..."
            cd "$dir"
            
            # Get vulnerability count
            vuln_count=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.total // 0')
            
            if [[ "$vuln_count" -gt 0 ]]; then
                log_warning "$dir: $vuln_count vulnerabilities found"
            else
                log_success "$dir: No vulnerabilities"
            fi
            
            cd - > /dev/null
        fi
    done
}

# Apply critical security updates
apply_security_updates() {
    log_section "Applying Critical Security Updates"
    
    # Frontend - Critical Next.js update
    log_info "Updating frontend dependencies (Next.js critical fixes)..."
    cd frontend
    if npm update next@latest; then
        log_success "Frontend: Next.js updated successfully"
    else
        log_error "Frontend: Failed to update Next.js"
        cd ..
        return 1
    fi
    
    # Run audit fix for frontend
    if npm audit fix --force; then
        log_success "Frontend: Security issues fixed"
    else
        log_warning "Frontend: Some security issues may remain"
    fi
    cd ..
    
    # Backend - Vitest security update
    log_info "Updating backend dependencies (Vitest fixes)..."
    cd backend
    if npm update vitest@latest; then
        log_success "Backend: Vitest updated successfully"
    else
        log_error "Backend: Failed to update Vitest"
        cd ..
        return 1
    fi
    
    # Run audit fix for backend
    if npm audit fix; then
        log_success "Backend: Security issues fixed"
    else
        log_warning "Backend: Some security issues may remain"
    fi
    cd ..
    
    # Root - General security updates
    log_info "Updating root dependencies..."
    if npm audit fix; then
        log_success "Root: Security issues fixed"
    else
        log_warning "Root: Some security issues may remain"
    fi
}

# Clean up potential unused dependencies (with confirmation)
cleanup_unused_dependencies() {
    log_section "Unused Dependencies Cleanup"
    
    # List of potentially unused dependencies to review
    UNUSED_ROOT=("knex" "redis")
    UNUSED_BACKEND=("joi" "morgan" "multer" "pg")
    
    log_warning "The following dependencies were identified as potentially unused:"
    echo "Root: ${UNUSED_ROOT[*]}"
    echo "Backend: ${UNUSED_BACKEND[*]}"
    echo
    log_warning "These will be marked for manual review rather than automatic removal."
    
    # Create a report file instead of auto-removing
    cat > "dependency-review-needed.txt" << EOF
# Dependencies Requiring Manual Review
# Generated: $(date)

## Potentially Unused Dependencies

### Root Package
$(printf "- %s\n" "${UNUSED_ROOT[@]}")

### Backend Package
$(printf "- %s\n" "${UNUSED_BACKEND[@]}")

## Review Instructions
1. Search codebase for usage of each package
2. Check if they're used in build processes or scripts
3. Remove if confirmed unused: npm uninstall <package-name>
4. Test thoroughly after removal

## Search Commands
For each package, run:
grep -r "package-name" . --exclude-dir=node_modules
grep -r "require.*package-name" . --exclude-dir=node_modules
grep -r "import.*package-name" . --exclude-dir=node_modules
EOF

    log_success "Created dependency-review-needed.txt for manual review"
}

# Standardize bcrypt usage
fix_bcrypt_duplication() {
    log_section "Fixing bcrypt/bcryptjs Duplication"
    
    log_info "Analysis shows both bcrypt and bcryptjs are used..."
    log_info "Recommendation: Standardize on 'bcrypt' (native, faster)"
    
    # Create migration guide
    cat > "bcrypt-migration-guide.md" << EOF
# bcrypt/bcryptjs Migration Guide

## Current State
- Root: bcryptjs@^2.4.3
- Backend: both bcrypt@^5.1.1 AND bcryptjs@^2.4.3  
- Shared: bcrypt@^5.1.1

## Recommendation
Standardize on \`bcrypt\` (native module) for better performance.

## Migration Steps
1. Update all imports from 'bcryptjs' to 'bcrypt'
2. Remove bcryptjs dependency: \`npm uninstall bcryptjs\`
3. Ensure bcrypt is installed: \`npm install bcrypt\`
4. Test all authentication flows

## Files to Update
\`\`\`bash
# Find files using bcryptjs
grep -r "bcryptjs" . --exclude-dir=node_modules
grep -r "require.*bcryptjs" . --exclude-dir=node_modules  
grep -r "import.*bcryptjs" . --exclude-dir=node_modules
\`\`\`

## Example Migration
\`\`\`javascript
// Before
import bcrypt from 'bcryptjs';

// After  
import bcrypt from 'bcrypt';
\`\`\`
EOF

    log_success "Created bcrypt-migration-guide.md"
}

# Generate dependency report
generate_dependency_report() {
    log_section "Generating Dependency Report"
    
    REPORT_FILE="dependency-status-$(date +%Y%m%d-%H%M%S).json"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"modules\": {"
        
        first=true
        for dir in . backend frontend shared; do
            if [[ -f "$dir/package.json" ]]; then
                [[ "$first" == true ]] && first=false || echo ","
                
                module_name=$(basename "$dir")
                [[ "$module_name" == "." ]] && module_name="root"
                
                echo "    \"$module_name\": {"
                cd "$dir"
                
                deps=$(jq -r '.dependencies | keys | length // 0' package.json 2>/dev/null)
                devDeps=$(jq -r '.devDependencies | keys | length // 0' package.json 2>/dev/null)
                vulns=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.total // 0')
                
                echo "      \"dependencies\": $deps,"
                echo "      \"devDependencies\": $devDeps,"
                echo "      \"vulnerabilities\": $vulns"
                echo "    }"
                
                cd - > /dev/null
            fi
        done
        
        echo "  }"
        echo "}"
    } > "$REPORT_FILE"
    
    log_success "Generated $REPORT_FILE"
}

# Main execution function
main() {
    log_section "MediaNest Dependency Cleanup"
    echo "🏠 Project: MediaNest"
    echo "📅 Date: $(date)"
    echo "👤 User: $(whoami)"
    echo "📁 Directory: $(pwd)"
    echo
    
    # Show current status
    show_audit_status
    
    # Create backups
    backup_locks
    
    # Apply security updates
    if apply_security_updates; then
        log_success "Security updates completed successfully"
    else
        log_error "Some security updates failed"
        exit 1
    fi
    
    # Clean up unused dependencies (with manual review)
    cleanup_unused_dependencies
    
    # Fix bcrypt duplication  
    fix_bcrypt_duplication
    
    # Generate final report
    generate_dependency_report
    
    # Show final status
    echo
    show_audit_status
    
    log_section "Cleanup Complete"
    log_success "Security updates applied successfully"
    log_success "Manual review files created"
    log_info "Next steps:"
    echo "  1. Review dependency-review-needed.txt"
    echo "  2. Follow bcrypt-migration-guide.md"  
    echo "  3. Run test suite to verify changes"
    echo "  4. Commit changes to version control"
    echo
    log_success "Dependency cleanup completed! 🎉"
}

# Run with error handling
if main "$@"; then
    exit 0
else
    log_error "Dependency cleanup failed"
    exit 1
fi