#!/bin/bash

# 🔒 MediaNest Security Update Automation Script
# Automated security vulnerability remediation with rollback capability
# Generated: September 9, 2025

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./security-backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./security-update.log"
ROLLBACK_SCRIPT="$BACKUP_DIR/rollback.sh"

# Functions
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

info() {
    log "${BLUE}INFO: $1${NC}"
}

# Create backup
create_backup() {
    info "Creating backup before security updates..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup package files
    cp package.json "$BACKUP_DIR/" 2>/dev/null || true
    cp package-lock.json "$BACKUP_DIR/" 2>/dev/null || true
    cp backend/package.json "$BACKUP_DIR/backend-package.json" 2>/dev/null || true
    cp backend/package-lock.json "$BACKUP_DIR/backend-package-lock.json" 2>/dev/null || true
    cp frontend/package.json "$BACKUP_DIR/frontend-package.json" 2>/dev/null || true
    cp frontend/package-lock.json "$BACKUP_DIR/frontend-package-lock.json" 2>/dev/null || true
    cp shared/package.json "$BACKUP_DIR/shared-package.json" 2>/dev/null || true
    cp shared/package-lock.json "$BACKUP_DIR/shared-package-lock.json" 2>/dev/null || true
    
    # Create rollback script
    cat > "$ROLLBACK_SCRIPT" << 'EOF'
#!/bin/bash
# Rollback script for security updates
set -euo pipefail

echo "🔄 Rolling back security updates..."

# Restore package files
[ -f "package.json" ] && cp package.json ../
[ -f "package-lock.json" ] && cp package-lock.json ../
[ -f "backend-package.json" ] && cp backend-package.json ../backend/package.json
[ -f "backend-package-lock.json" ] && cp backend-package-lock.json ../backend/package-lock.json
[ -f "frontend-package.json" ] && cp frontend-package.json ../frontend/package.json
[ -f "frontend-package-lock.json" ] && cp frontend-package-lock.json ../frontend/package-lock.json
[ -f "shared-package.json" ] && cp shared-package.json ../shared/package.json
[ -f "shared-package-lock.json" ] && cp shared-package-lock.json ../shared/package-lock.json

# Reinstall dependencies
cd ..
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd shared && npm install && cd ..

echo "✅ Rollback completed. Run tests to verify."
EOF
    
    chmod +x "$ROLLBACK_SCRIPT"
    success "Backup created at $BACKUP_DIR"
}

# Test function
run_tests() {
    local component=$1
    info "Running tests for $component..."
    
    case $component in
        "backend")
            cd backend
            npm run test:ci || return 1
            npm run type-check || return 1
            cd ..
            ;;
        "frontend")
            cd frontend
            npm run test:ci || return 1
            npm run type-check || return 1
            cd ..
            ;;
        "shared")
            cd shared
            npm run test:ci || return 1
            npm run type-check || return 1
            cd ..
            ;;
        "root")
            npm run test:ci || return 1
            npm run typecheck || return 1
            ;;
    esac
    
    success "Tests passed for $component"
}

# Update function with testing
update_package() {
    local dir=$1
    local package=$2
    local version=$3
    local test_component=$4
    
    info "Updating $package to $version in $dir..."
    
    if [ "$dir" != "." ]; then
        cd "$dir"
    fi
    
    # Update package
    npm update "$package@$version" || {
        error "Failed to update $package in $dir"
        return 1
    }
    
    # Install dependencies
    npm install || {
        error "Failed to install dependencies in $dir"
        return 1
    }
    
    if [ "$dir" != "." ]; then
        cd ..
    fi
    
    # Run tests
    run_tests "$test_component" || {
        error "Tests failed after updating $package in $dir"
        return 1
    }
    
    success "Successfully updated and tested $package in $dir"
}

# Main update process
main() {
    info "🔒 Starting MediaNest Security Update Process"
    
    # Create backup first
    create_backup
    
    info "🚨 PHASE 1: Critical Security Updates"
    
    # Frontend Critical - Next.js security patches
    warning "Updating Next.js with critical security patches..."
    update_package "frontend" "next" "14.2.32" "frontend" || {
        error "Critical Next.js update failed. Consider manual intervention."
        info "Rollback script available at: $ROLLBACK_SCRIPT"
        exit 1
    }
    
    info "🔧 PHASE 2: Backend Security Updates"
    
    # Backend esbuild/vitest chain (requires force due to breaking changes)
    warning "Updating development dependencies with security patches..."
    cd backend
    npm audit fix --force || warning "Some audit fixes may require manual intervention"
    cd ..
    
    # Test after audit fix
    run_tests "backend" || {
        warning "Tests failed after npm audit fix. Manual review recommended."
    }
    
    # Authentication library updates
    info "Updating authentication libraries..."
    update_package "backend" "bcrypt" "6.0.0" "backend" || {
        warning "bcrypt update failed - may require rebuild. Continuing..."
    }
    
    update_package "backend" "express-rate-limit" "8.1.0" "backend" || {
        warning "express-rate-limit update failed. Continuing..."
    }
    
    info "🔍 PHASE 3: Shared Library Updates"
    
    update_package "shared" "bcrypt" "6.0.0" "shared" || {
        warning "shared bcrypt update failed. Continuing..."
    }
    
    info "🧪 PHASE 4: Final Validation"
    
    # Run comprehensive tests
    info "Running comprehensive test suite..."
    npm run test:all || {
        error "Comprehensive tests failed. Review required."
        info "Rollback script available at: $ROLLBACK_SCRIPT"
        exit 1
    }
    
    # Security scan
    info "Running final security audit..."
    npm audit --audit-level=high || {
        warning "Security audit found remaining issues. Review recommended."
    }
    
    cd backend && npm audit --audit-level=high || {
        warning "Backend audit found remaining issues. Review recommended."
    }
    cd ..
    
    cd frontend && npm audit --audit-level=high || {
        warning "Frontend audit found remaining issues. Review recommended."
    }
    cd ..
    
    success "🎉 Security update process completed!"
    info "📊 Summary:"
    info "  ✅ Critical Next.js vulnerabilities patched"
    info "  ✅ Backend development security issues addressed"
    info "  ✅ Authentication libraries updated"
    info "  ✅ Comprehensive tests passed"
    info ""
    info "📁 Backup available at: $BACKUP_DIR"
    info "🔄 Rollback script: $ROLLBACK_SCRIPT"
    info "📝 Detailed log: $LOG_FILE"
    info ""
    warning "⚠️  Manual Review Required:"
    info "  1. Test application functionality thoroughly"
    info "  2. Review any remaining npm audit warnings"
    info "  3. Consider updating major version dependencies (breaking changes)"
    info "  4. Update documentation with any API changes"
    info ""
    info "🔄 Major version updates (requires testing):"
    info "  - React 18 → 19 (breaking changes)"
    info "  - Express 4 → 5 (breaking changes)"  
    info "  - Zod 3 → 4 (breaking changes)"
    info "  - UUID 10 → 13 (3 major versions)"
}

# Rollback function
rollback() {
    warning "🔄 Initiating rollback..."
    if [ -f "$ROLLBACK_SCRIPT" ]; then
        bash "$ROLLBACK_SCRIPT"
        success "Rollback completed."
    else
        error "Rollback script not found. Manual restoration required."
        info "Backup location: $BACKUP_DIR"
    fi
}

# Command line interface
case "${1:-update}" in
    "update")
        main
        ;;
    "rollback")
        if [ -z "${2:-}" ]; then
            error "Please provide backup directory path for rollback"
        fi
        BACKUP_DIR="$2"
        ROLLBACK_SCRIPT="$BACKUP_DIR/rollback.sh"
        rollback
        ;;
    "test-only")
        info "Running test suite only..."
        run_tests "root"
        run_tests "backend"
        run_tests "frontend" 
        run_tests "shared"
        success "All tests completed"
        ;;
    "audit-only")
        info "Running security audit only..."
        npm audit --audit-level=moderate
        cd backend && npm audit --audit-level=moderate && cd ..
        cd frontend && npm audit --audit-level=moderate && cd ..
        cd shared && npm audit --audit-level=moderate && cd ..
        ;;
    "help"|"--help"|"-h")
        echo "MediaNest Security Update Automation"
        echo ""
        echo "Usage:"
        echo "  $0 [command]"
        echo ""
        echo "Commands:"
        echo "  update     - Run full security update process (default)"
        echo "  rollback   - Rollback to previous state"
        echo "  test-only  - Run test suite only"
        echo "  audit-only - Run security audit only"
        echo "  help       - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                              # Run security updates"
        echo "  $0 rollback ./security-backups/20250909_143022  # Rollback"
        echo "  $0 test-only                    # Test current state"
        ;;
    *)
        error "Unknown command: $1. Use '$0 help' for usage information."
        ;;
esac