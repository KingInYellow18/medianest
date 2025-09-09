#!/bin/bash
# ==============================================================================
# 🔍 MEDIANEST DOCKER SETUP VALIDATION SCRIPT
# ==============================================================================
# Validates the consolidated Docker setup for correctness and functionality
# ==============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/validation-report-$(date +%Y%m%d-%H%M%S).log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# ==============================================================================
# 🛠️ UTILITY FUNCTIONS
# ==============================================================================
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}" | tee -a "${LOG_FILE}"
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING: $1${NC}" | tee -a "${LOG_FILE}"
    ((WARNINGS++))
}

log_info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO: $1${NC}" | tee -a "${LOG_FILE}"
}

test_pass() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "${LOG_FILE}"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}❌ $1${NC}" | tee -a "${LOG_FILE}"
    ((TESTS_FAILED++))
}

# ==============================================================================
# 🔍 VALIDATION TESTS
# ==============================================================================
validate_file_structure() {
    log "Validating file structure..."
    
    local files=(
        "Dockerfile"
        "docker-compose.base.yml"
        "docker-compose.dev.yml"
        "docker-compose.prod.yml"
        "docker-build.sh"
        "docker-bake.hcl"
        ".dockerignore"
    )
    
    for file in "${files[@]}"; do
        if [[ -f "${SCRIPT_DIR}/${file}" ]]; then
            test_pass "File exists: ${file}"
        else
            test_fail "Missing file: ${file}"
        fi
    done
}

validate_dockerfile_syntax() {
    log "Validating Dockerfile syntax..."
    
    if command -v docker &> /dev/null; then
        if docker build --target development --dry-run -f Dockerfile . > /dev/null 2>&1; then
            test_pass "Dockerfile syntax is valid"
        else
            test_fail "Dockerfile syntax validation failed"
        fi
    else
        log_warn "Docker not available, skipping syntax validation"
    fi
}

validate_compose_syntax() {
    log "Validating Docker Compose syntax..."
    
    local compose_files=(
        "docker-compose.base.yml"
        "docker-compose.dev.yml" 
        "docker-compose.prod.yml"
    )
    
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        for file in "${compose_files[@]}"; do
            if docker compose -f "${file}" config > /dev/null 2>&1; then
                test_pass "Valid compose syntax: ${file}"
            else
                test_fail "Invalid compose syntax: ${file}"
            fi
        done
    else
        log_warn "Docker Compose not available, skipping syntax validation"
    fi
}

validate_build_targets() {
    log "Validating build targets in Dockerfile..."
    
    local expected_targets=(
        "base"
        "dev-dependencies"
        "prod-dependencies"
        "shared-builder"
        "backend-builder"
        "frontend-builder"
        "docs-builder"
        "development"
        "backend-production"
        "frontend-production"
        "nginx-production"
        "security-hardened"
        "test-runner"
        "migration-runner"
        "security-scanner"
        "build-tools"
    )
    
    for target in "${expected_targets[@]}"; do
        if grep -q "FROM .* AS ${target}" Dockerfile; then
            test_pass "Build target exists: ${target}"
        else
            test_fail "Missing build target: ${target}"
        fi
    done
}

validate_build_script() {
    log "Validating build script..."
    
    if [[ -x "./docker-build.sh" ]]; then
        test_pass "Build script is executable"
    else
        test_fail "Build script is not executable"
    fi
    
    # Test help functionality
    if ./docker-build.sh --help > /dev/null 2>&1; then
        test_pass "Build script help works"
    else
        test_fail "Build script help failed"
    fi
    
    # Test list functionality
    if ./docker-build.sh list > /dev/null 2>&1; then
        test_pass "Build script list works"
    else
        test_fail "Build script list failed"
    fi
}

validate_bake_configuration() {
    log "Validating Docker Bake configuration..."
    
    if command -v docker &> /dev/null && docker buildx version &> /dev/null; then
        if docker buildx bake --print > /dev/null 2>&1; then
            test_pass "Docker Bake configuration is valid"
        else
            test_fail "Docker Bake configuration validation failed"
        fi
    else
        log_warn "Docker Buildx not available, skipping Bake validation"
    fi
}

validate_environment_variables() {
    log "Validating environment variable usage..."
    
    # Check for environment variables in compose files
    local env_vars=(
        "NODE_ENV"
        "POSTGRES_PASSWORD"
        "SECURITY_LEVEL"
        "BUILD_TARGET"
    )
    
    for var in "${env_vars[@]}"; do
        if grep -r "\${${var}" docker-compose*.yml > /dev/null 2>&1; then
            test_pass "Environment variable used: ${var}"
        else
            log_warn "Environment variable not found: ${var}"
        fi
    done
}

validate_security_configuration() {
    log "Validating security configurations..."
    
    # Check for non-root user configuration
    if grep -q "USER.*medianest" Dockerfile; then
        test_pass "Non-root user configured"
    else
        test_fail "No non-root user configuration found"
    fi
    
    # Check for security options in compose
    if grep -q "no-new-privileges" docker-compose*.yml; then
        test_pass "Security options configured in compose"
    else
        log_warn "No security options found in compose files"
    fi
    
    # Check for read-only filesystems
    if grep -q "read_only.*true" docker-compose*.yml; then
        test_pass "Read-only filesystem configured"
    else
        log_warn "No read-only filesystem configuration found"
    fi
}

validate_network_configuration() {
    log "Validating network configurations..."
    
    # Check for network isolation
    if grep -q "internal.*true" docker-compose*.yml; then
        test_pass "Network isolation configured"
    else
        log_warn "No network isolation found"
    fi
    
    # Check for multiple networks
    local networks=(
        "app-network"
        "database-network"
        "cache-network"
    )
    
    for network in "${networks[@]}"; do
        if grep -q "${network}" docker-compose*.yml; then
            test_pass "Network configured: ${network}"
        else
            log_warn "Network not found: ${network}"
        fi
    done
}

validate_volume_configuration() {
    log "Validating volume configurations..."
    
    # Check for persistent volumes
    local volumes=(
        "postgres_data"
        "redis_data"
        "app_uploads"
    )
    
    for volume in "${volumes[@]}"; do
        if grep -q "${volume}" docker-compose*.yml; then
            test_pass "Volume configured: ${volume}"
        else
            log_warn "Volume not found: ${volume}"
        fi
    done
}

validate_health_checks() {
    log "Validating health check configurations..."
    
    if grep -q "HEALTHCHECK" Dockerfile; then
        test_pass "Health checks configured in Dockerfile"
    else
        test_fail "No health checks found in Dockerfile"
    fi
    
    if grep -q "healthcheck:" docker-compose*.yml; then
        test_pass "Health checks configured in Compose"
    else
        log_warn "No health checks found in Compose files"
    fi
}

validate_optimization_features() {
    log "Validating optimization features..."
    
    # Check for BuildKit features
    if grep -q "# syntax=docker/dockerfile" Dockerfile; then
        test_pass "BuildKit syntax specified"
    else
        log_warn "BuildKit syntax not specified"
    fi
    
    # Check for cache mounts
    if grep -q "--mount=type=cache" Dockerfile; then
        test_pass "BuildKit cache mounts configured"
    else
        log_warn "No BuildKit cache mounts found"
    fi
    
    # Check for multi-stage optimization
    local stage_count=$(grep -c "FROM .* AS" Dockerfile)
    if [[ $stage_count -gt 10 ]]; then
        test_pass "Multi-stage build with ${stage_count} stages"
    else
        log_warn "Limited multi-stage optimization (${stage_count} stages)"
    fi
}

test_basic_build() {
    log "Testing basic build functionality..."
    
    if command -v docker &> /dev/null; then
        log_info "Testing development build..."
        if timeout 300 docker build --target development -t medianest:test-dev . > /dev/null 2>&1; then
            test_pass "Development build successful"
            docker rmi medianest:test-dev > /dev/null 2>&1 || true
        else
            test_fail "Development build failed"
        fi
    else
        log_warn "Docker not available, skipping build tests"
    fi
}

# ==============================================================================
# 🎯 MAIN EXECUTION
# ==============================================================================
main() {
    log "Starting MediaNest Docker Setup Validation"
    log_info "Log file: ${LOG_FILE}"
    
    echo "# MediaNest Docker Validation Report" > "${LOG_FILE}"
    echo "Generated: $(date)" >> "${LOG_FILE}"
    echo "" >> "${LOG_FILE}"
    
    # Run validation tests
    validate_file_structure
    validate_dockerfile_syntax
    validate_compose_syntax
    validate_build_targets
    validate_build_script
    validate_bake_configuration
    validate_environment_variables
    validate_security_configuration
    validate_network_configuration
    validate_volume_configuration
    validate_health_checks
    validate_optimization_features
    test_basic_build
    
    # Generate report
    echo -e "\n" | tee -a "${LOG_FILE}"
    log "Validation Summary:"
    echo -e "${GREEN}✅ Tests Passed: ${TESTS_PASSED}${NC}" | tee -a "${LOG_FILE}"
    echo -e "${RED}❌ Tests Failed: ${TESTS_FAILED}${NC}" | tee -a "${LOG_FILE}"
    echo -e "${YELLOW}⚠️  Warnings: ${WARNINGS}${NC}" | tee -a "${LOG_FILE}"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$(( TESTS_PASSED * 100 / total_tests ))
    fi
    
    echo -e "${BLUE}📊 Success Rate: ${success_rate}%${NC}" | tee -a "${LOG_FILE}"
    
    # Exit code based on results
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log "🎉 All validations passed! Docker setup is ready."
        exit 0
    else
        log_error "Validation failed. Please review errors and fix issues."
        exit 1
    fi
}

# Show usage if help requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    cat << EOF
🔍 MediaNest Docker Setup Validation Script

USAGE:
    $(basename "$0") [OPTIONS]

OPTIONS:
    -h, --help     Show this help message

DESCRIPTION:
    Validates the consolidated Docker setup including:
    - File structure and syntax
    - Build targets and configurations
    - Security and optimization features
    - Basic build functionality

EXAMPLES:
    $(basename "$0")                    # Run full validation
    $(basename "$0") --help             # Show help

EOF
    exit 0
fi

# Execute main function
main "$@"