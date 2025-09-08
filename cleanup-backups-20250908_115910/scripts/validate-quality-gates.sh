#!/bin/bash

# Phase 3 Quality Gates Validation Script
# Usage: ./validate-quality-gates.sh --phase <phase-name>

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Quality gate functions
check_dependencies() {
    log_info "Validating dependencies..."
    
    # Check shared package dependencies
    cd shared
    local missing_deps=()
    
    # Critical dependencies
    npm list zod >/dev/null 2>&1 || missing_deps+=("zod")
    npm list @types/node >/dev/null 2>&1 || missing_deps+=("@types/node")
    npm list dotenv >/dev/null 2>&1 || missing_deps+=("dotenv")
    npm list @prisma/client >/dev/null 2>&1 || missing_deps+=("@prisma/client")
    npm list ioredis >/dev/null 2>&1 || missing_deps+=("ioredis")
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        return 1
    fi
    
    log_success "All dependencies present"
    cd ..
    return 0
}

check_build() {
    log_info "Validating build process..."
    
    # Test shared build
    if ! npm run build:shared >/dev/null 2>&1; then
        log_error "Shared package build failed"
        return 1
    fi
    
    # Test backend build
    if ! npm run build:backend >/dev/null 2>&1; then
        log_error "Backend build failed"
        return 1
    fi
    
    # Test frontend build
    if ! npm run build:frontend >/dev/null 2>&1; then
        log_error "Frontend build failed"  
        return 1
    fi
    
    log_success "All builds passing"
    return 0
}

check_linting() {
    log_info "Validating linting configuration..."
    
    # Check ESLint config validity
    if ! npm run lint >/dev/null 2>&1; then
        log_error "ESLint configuration invalid"
        return 1
    fi
    
    log_success "Linting configuration valid"
    return 0
}

check_typescript() {
    log_info "Validating TypeScript configuration..."
    
    # Check TypeScript compilation
    if ! npm run type-check >/dev/null 2>&1; then
        log_error "TypeScript compilation failed"
        return 1
    fi
    
    log_success "TypeScript validation passed"
    return 0
}

check_tests() {
    log_info "Validating test infrastructure..."
    
    # Check if tests can run
    if ! npm run test --silent >/dev/null 2>&1; then
        log_warning "Test infrastructure has issues"
        return 1
    fi
    
    log_success "Test infrastructure functional"
    return 0
}

run_security_scan() {
    log_info "Running security scan..."
    
    # Check for vulnerabilities
    if ! npm audit --audit-level moderate >/dev/null 2>&1; then
        log_warning "Security vulnerabilities detected"
        return 1
    fi
    
    log_success "No critical security issues"
    return 0
}

# Phase-specific validations
validate_next_js_phase() {
    log_info "Validating Next.js migration phase..."
    
    # Check Next.js specific requirements
    cd frontend
    if ! npx next build >/dev/null 2>&1; then
        log_error "Next.js build failed"
        cd ..
        return 1
    fi
    cd ..
    
    log_success "Next.js phase validation passed"
    return 0
}

validate_eslint_phase() {
    log_info "Validating ESLint configuration phase..."
    
    # Check ESLint configuration across all workspaces
    if ! npm run lint >/dev/null 2>&1; then
        log_error "ESLint phase validation failed"
        return 1
    fi
    
    log_success "ESLint phase validation passed"
    return 0
}

validate_react_phase() {
    log_info "Validating React components phase..."
    
    # Check React-specific builds and tests
    cd frontend
    if ! npm run test:components >/dev/null 2>&1; then
        log_warning "React component tests need attention"
        cd ..
        return 1
    fi
    cd ..
    
    log_success "React phase validation passed"
    return 0
}

validate_express_phase() {
    log_info "Validating Express backend phase..."
    
    # Check Express-specific functionality
    cd backend
    if ! npm run test:api >/dev/null 2>&1; then
        log_warning "Express API tests need attention"
        cd ..
        return 1
    fi
    cd ..
    
    log_success "Express phase validation passed"
    return 0
}

# Main validation function
run_quality_gates() {
    local phase=${1:-"all"}
    local failed_gates=()
    
    log_info "Running quality gates for phase: $phase"
    
    # Core quality gates (run for all phases)
    check_dependencies || failed_gates+=("dependencies")
    check_build || failed_gates+=("build")
    check_linting || failed_gates+=("linting")
    check_typescript || failed_gates+=("typescript")
    check_tests || failed_gates+=("tests")
    run_security_scan || failed_gates+=("security")
    
    # Phase-specific gates
    case $phase in
        "next-js"|"nextjs")
            validate_next_js_phase || failed_gates+=("next-js-specific")
            ;;
        "eslint")
            validate_eslint_phase || failed_gates+=("eslint-specific")
            ;;
        "react")
            validate_react_phase || failed_gates+=("react-specific")
            ;;
        "express")
            validate_express_phase || failed_gates+=("express-specific")
            ;;
        "all")
            validate_next_js_phase || failed_gates+=("next-js-specific")
            validate_eslint_phase || failed_gates+=("eslint-specific")
            validate_react_phase || failed_gates+=("react-specific")
            validate_express_phase || failed_gates+=("express-specific")
            ;;
    esac
    
    # Report results
    if [ ${#failed_gates[@]} -eq 0 ]; then
        log_success "All quality gates passed for phase: $phase"
        return 0
    else
        log_error "Failed quality gates: ${failed_gates[*]}"
        return 1
    fi
}

# Script main logic
main() {
    local phase="all"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --phase)
                phase="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 --phase <phase-name>"
                echo "Phases: all, next-js, eslint, react, express"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run quality gates
    if run_quality_gates "$phase"; then
        log_success "Quality gates validation completed successfully"
        exit 0
    else
        log_error "Quality gates validation failed"
        exit 1
    fi
}

# Run main function
main "$@"