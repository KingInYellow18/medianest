#!/bin/bash
# ==============================================================================
# ✅ DOCKER CONSOLIDATION VALIDATOR
# ==============================================================================
# Validates the consolidated Docker structure implementation
# Checks: structure, syntax, environment variables, performance targets
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_DIR="config/docker"
CONSOLIDATED_DOCKERFILE="$DOCKER_DIR/Dockerfile.consolidated"
VALIDATION_ERRORS=0

echo -e "${BLUE}🔍 MediaNest Docker Consolidation Validator${NC}"
echo "=============================================="
echo ""

# Function to log success
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to log warning  
log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to log error
log_error() {
    echo -e "${RED}❌ $1${NC}"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
}

# Function to check file exists
check_file_exists() {
    local file=$1
    local description=$2
    
    if [[ -f "$file" ]]; then
        log_success "$description exists: $file"
        return 0
    else
        log_error "$description missing: $file"
        return 1
    fi
}

# Function to check directory structure
validate_structure() {
    echo -e "${BLUE}📁 Validating Directory Structure${NC}"
    echo "=================================="
    
    # Check main directory
    if [[ -d "$DOCKER_DIR" ]]; then
        log_success "Docker config directory exists"
    else
        log_error "Docker config directory missing: $DOCKER_DIR"
        return 1
    fi
    
    # Check required files
    check_file_exists "$CONSOLIDATED_DOCKERFILE" "Consolidated Dockerfile"
    check_file_exists "$DOCKER_DIR/docker-compose.dev.yml" "Development compose file"
    check_file_exists "$DOCKER_DIR/docker-compose.test.yml" "Test compose file"
    check_file_exists "$DOCKER_DIR/docker-compose.prod.yml" "Production compose file"
    check_file_exists "$DOCKER_DIR/ecosystem.config.js" "PM2 ecosystem config"
    check_file_exists "$DOCKER_DIR/docker-environment.env.template" "Environment template"
    check_file_exists "$DOCKER_DIR/.dockerignore" "Docker ignore file"
    check_file_exists "$DOCKER_DIR/README.md" "Documentation"
    check_file_exists "$DOCKER_DIR/MIGRATION_GUIDE.md" "Migration guide"
    
    echo ""
}

# Function to validate Dockerfile syntax
validate_dockerfile_syntax() {
    echo -e "${BLUE}🐳 Validating Dockerfile Syntax${NC}"
    echo "==============================="
    
    if docker build -f "$CONSOLIDATED_DOCKERFILE" --target base -t validation-test . >/dev/null 2>&1; then
        log_success "Dockerfile syntax is valid"
    else
        log_error "Dockerfile syntax errors found"
        echo "Run: docker build -f $CONSOLIDATED_DOCKERFILE --target base -t validation-test ."
    fi
    
    echo ""
}

# Function to validate build targets
validate_build_targets() {
    echo -e "${BLUE}🎯 Validating Build Targets${NC}"
    echo "============================"
    
    local required_targets=("base" "development" "test" "backend-production" "frontend-production" "production")
    
    for target in "${required_targets[@]}"; do
        if grep -q "FROM .* AS $target" "$CONSOLIDATED_DOCKERFILE"; then
            log_success "Build target '$target' found"
        else
            log_error "Build target '$target' missing"
        fi
    done
    
    echo ""
}

# Function to validate compose files
validate_compose_files() {
    echo -e "${BLUE}📋 Validating Compose Files${NC}"
    echo "============================"
    
    local compose_files=(
        "$DOCKER_DIR/docker-compose.dev.yml"
        "$DOCKER_DIR/docker-compose.test.yml" 
        "$DOCKER_DIR/docker-compose.prod.yml"
    )
    
    for compose_file in "${compose_files[@]}"; do
        if docker compose -f "$compose_file" config >/dev/null 2>&1; then
            log_success "Compose file valid: $(basename "$compose_file")"
        else
            log_error "Compose file invalid: $(basename "$compose_file")"
            echo "Run: docker compose -f $compose_file config"
        fi
    done
    
    echo ""
}

# Function to validate environment template
validate_environment_template() {
    echo -e "${BLUE}🌍 Validating Environment Template${NC}"
    echo "==================================="
    
    local template_file="$DOCKER_DIR/docker-environment.env.template"
    local required_vars=(
        "NODE_ENV"
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
        "NEXTAUTH_SECRET"
        "ENCRYPTION_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" "$template_file"; then
            log_success "Environment variable '$var' found"
        else
            log_error "Environment variable '$var' missing from template"
        fi
    done
    
    echo ""
}

# Function to validate security configurations
validate_security() {
    echo -e "${BLUE}🔒 Validating Security Configuration${NC}"
    echo "==================================="
    
    # Check for non-root user
    if grep -q "USER medianest" "$CONSOLIDATED_DOCKERFILE"; then
        log_success "Non-root user configured"
    else
        log_error "Non-root user not configured"
    fi
    
    # Check for security hardening in compose files
    if grep -q "security_opt:" "$DOCKER_DIR/docker-compose.prod.yml"; then
        log_success "Security options configured in production"
    else
        log_warning "Security options not found in production compose"
    fi
    
    # Check for capability dropping
    if grep -q "cap_drop:" "$DOCKER_DIR/docker-compose.prod.yml"; then
        log_success "Capability dropping configured"
    else
        log_warning "Capability dropping not configured"
    fi
    
    # Check for secrets usage
    if grep -q "secrets:" "$DOCKER_DIR/docker-compose.prod.yml"; then
        log_success "Docker secrets configured"
    else
        log_error "Docker secrets not configured"
    fi
    
    echo ""
}

# Function to validate performance optimizations
validate_performance() {
    echo -e "${BLUE}⚡ Validating Performance Optimizations${NC}"
    echo "======================================="
    
    # Check for multi-stage builds
    if grep -c "FROM .* AS" "$CONSOLIDATED_DOCKERFILE" | grep -q "[5-9]"; then
        log_success "Multi-stage builds implemented"
    else
        log_warning "Insufficient multi-stage builds"
    fi
    
    # Check for build cache optimizations
    if grep -q "mount=type=cache" "$CONSOLIDATED_DOCKERFILE"; then
        log_success "Build cache optimization implemented"
    else
        log_error "Build cache optimization missing"
    fi
    
    # Check for .dockerignore
    if [[ -f "$DOCKER_DIR/.dockerignore" ]]; then
        local ignore_lines=$(wc -l < "$DOCKER_DIR/.dockerignore")
        if (( ignore_lines > 50 )); then
            log_success "Comprehensive .dockerignore ($ignore_lines lines)"
        else
            log_warning "Basic .dockerignore ($ignore_lines lines)"
        fi
    else
        log_error ".dockerignore missing"
    fi
    
    # Check for health checks
    if grep -q "HEALTHCHECK" "$CONSOLIDATED_DOCKERFILE"; then
        log_success "Health checks implemented"
    else
        log_error "Health checks missing"
    fi
    
    echo ""
}

# Function to validate documentation
validate_documentation() {
    echo -e "${BLUE}📚 Validating Documentation${NC}"
    echo "============================"
    
    local readme_file="$DOCKER_DIR/README.md"
    local migration_file="$DOCKER_DIR/MIGRATION_GUIDE.md"
    
    # Check README completeness
    local readme_sections=(
        "Overview"
        "Quick Start"
        "Security"
        "Performance"
        "Troubleshooting"
    )
    
    for section in "${readme_sections[@]}"; do
        if grep -qi "$section" "$readme_file"; then
            log_success "README section '$section' found"
        else
            log_warning "README section '$section' missing"
        fi
    done
    
    # Check migration guide
    if grep -q "Step-by-Step Migration" "$migration_file"; then
        log_success "Migration guide includes step-by-step instructions"
    else
        log_error "Migration guide missing step-by-step instructions"
    fi
    
    echo ""
}

# Function to validate technology consistency
validate_technology_stack() {
    echo -e "${BLUE}🔧 Validating Technology Stack Consistency${NC}"
    echo "==========================================="
    
    # Check for Node.js standardization
    if grep -q "FROM node:20-alpine" "$CONSOLIDATED_DOCKERFILE"; then
        log_success "Standardized on Node.js 20 Alpine"
    else
        log_error "Not using standardized Node.js 20 Alpine base"
    fi
    
    # Check for Python removal (Flask conflict resolution)
    if grep -q "FROM python:" "$CONSOLIDATED_DOCKERFILE"; then
        log_error "Python base image still present (technology conflict)"
    else
        log_success "Python base image removed (conflict resolved)"
    fi
    
    # Check for consistent package managers
    if grep -q "npm ci" "$CONSOLIDATED_DOCKERFILE" && ! grep -q "yarn" "$CONSOLIDATED_DOCKERFILE"; then
        log_success "Consistent package manager (npm)"
    else
        log_warning "Mixed package managers detected"
    fi
    
    echo ""
}

# Function to validate legacy file cleanup
validate_legacy_cleanup() {
    echo -e "${BLUE}🧹 Validating Legacy File Cleanup${NC}"
    echo "=================================="
    
    local legacy_files=(
        "Dockerfile"
        "docker-compose.yml"
        "backend/Dockerfile"
        "frontend/Dockerfile"
        "backend/Dockerfile.prod"
        "frontend/Dockerfile.prod"
    )
    
    local legacy_found=0
    for file in "${legacy_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_warning "Legacy file still exists: $file"
            legacy_found=1
        fi
    done
    
    if (( legacy_found == 0 )); then
        log_success "No legacy Docker files found"
    else
        log_warning "Legacy files should be removed after successful migration"
    fi
    
    echo ""
}

# Function to test build targets (optional)
test_build_targets() {
    echo -e "${BLUE}🏗️  Testing Build Targets (Optional)${NC}"
    echo "===================================="
    
    local quick_test=${1:-false}
    
    if [[ "$quick_test" == "true" ]]; then
        echo "Skipping build tests (quick mode)"
        return 0
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        log_warning "Docker not available, skipping build tests"
        return 0
    fi
    
    # Test basic build target
    if docker build -f "$CONSOLIDATED_DOCKERFILE" --target base -t medianest-test:base . >/dev/null 2>&1; then
        log_success "Base target builds successfully"
    else
        log_error "Base target build failed"
    fi
    
    echo ""
}

# Main validation function
run_validation() {
    local quick_mode=${1:-false}
    
    echo "Starting validation (quick_mode: $quick_mode)"
    echo ""
    
    validate_structure
    validate_dockerfile_syntax  
    validate_build_targets
    validate_compose_files
    validate_environment_template
    validate_security
    validate_performance
    validate_documentation
    validate_technology_stack
    validate_legacy_cleanup
    
    if [[ "$quick_mode" != "true" ]]; then
        test_build_targets
    fi
}

# Function to generate validation report
generate_report() {
    echo -e "${BLUE}📊 VALIDATION REPORT${NC}"
    echo "===================="
    echo ""
    
    if (( VALIDATION_ERRORS == 0 )); then
        echo -e "${GREEN}🎉 ALL VALIDATIONS PASSED!${NC}"
        echo ""
        echo "The Docker consolidation is ready for use:"
        echo "✅ Structure: Complete"
        echo "✅ Syntax: Valid" 
        echo "✅ Security: Configured"
        echo "✅ Performance: Optimized"
        echo "✅ Documentation: Complete"
        echo "✅ Technology: Consistent"
        echo ""
        echo "Next steps:"
        echo "1. Test development environment: docker-compose -f config/docker/docker-compose.dev.yml up"
        echo "2. Run performance tests: ./config/docker/build-scripts/test-consolidated-build.sh"
        echo "3. Update CI/CD pipelines"
        echo "4. Train team on new structure"
        echo ""
        return 0
    else
        echo -e "${RED}❌ VALIDATION FAILED${NC}"
        echo ""
        echo "Found $VALIDATION_ERRORS error(s) that need to be addressed."
        echo ""
        echo "Please fix the issues above and run validation again."
        echo ""
        return 1
    fi
}

# Script execution
main() {
    local quick_mode=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                quick_mode=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [--quick] [--help]"
                echo ""
                echo "Options:"
                echo "  --quick    Skip build tests for faster validation"
                echo "  --help     Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    run_validation "$quick_mode"
    generate_report
}

# Run the script
main "$@"