#!/bin/bash
# MediaNest Docker Compose Validation Script
# Validates the consolidated docker-compose configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATION_RESULTS=()
ERROR_COUNT=0
WARNING_COUNT=0

# Logging functions
log() {
    echo -e "${BLUE}[VALIDATE] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    VALIDATION_RESULTS+=("WARNING: $1")
    ((WARNING_COUNT++))
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    VALIDATION_RESULTS+=("ERROR: $1")
    ((ERROR_COUNT++))
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
    VALIDATION_RESULTS+=("SUCCESS: $1")
}

# Function to check if file exists
check_file() {
    local file="$1"
    local description="$2"
    
    if [[ -f "$file" ]]; then
        success "$description found: $file"
        return 0
    else
        error "$description not found: $file"
        return 1
    fi
}

# Function to validate Docker Compose syntax
validate_compose_syntax() {
    local compose_files="$1"
    local environment="$2"
    
    log "Validating $environment compose syntax..."
    
    if docker compose $compose_files config --quiet 2>/dev/null; then
        success "$environment compose syntax is valid"
        return 0
    else
        error "$environment compose syntax validation failed"
        log "Run: docker compose $compose_files config"
        return 1
    fi
}

# Function to validate service configurations
validate_services() {
    local compose_files="$1"
    local environment="$2"
    
    log "Validating $environment service configurations..."
    
    # Get list of services
    local services
    services=$(docker compose $compose_files config --services 2>/dev/null)
    
    if [[ -z "$services" ]]; then
        error "No services found in $environment configuration"
        return 1
    fi
    
    # Check required services
    local required_services=("postgres" "redis" "app")
    for service in "${required_services[@]}"; do
        if echo "$services" | grep -q "^${service}$"; then
            success "$environment has required service: $service"
        else
            error "$environment missing required service: $service"
        fi
    done
    
    # Validate service health checks
    local config
    config=$(docker compose $compose_files config 2>/dev/null)
    
    for service in "${required_services[@]}"; do
        if echo "$config" | grep -A 20 "^  $service:" | grep -q "healthcheck:"; then
            success "$service has health check configured"
        else
            warn "$service missing health check"
        fi
    done
    
    return 0
}

# Function to validate networks
validate_networks() {
    local compose_files="$1"
    local environment="$2"
    
    log "Validating $environment network configuration..."
    
    local config
    config=$(docker compose $compose_files config 2>/dev/null)
    
    # Check for required networks
    if echo "$config" | grep -q "medianest-internal:"; then
        success "$environment has internal network configured"
    else
        error "$environment missing internal network"
    fi
    
    # Check network isolation for production
    if [[ "$environment" == "production" ]]; then
        if echo "$config" | grep -A 5 "medianest-internal:" | grep -q "internal: true"; then
            success "Production network properly isolated"
        else
            warn "Production network should be isolated (internal: true)"
        fi
    fi
    
    return 0
}

# Function to validate volumes
validate_volumes() {
    local compose_files="$1"
    local environment="$2"
    
    log "Validating $environment volume configuration..."
    
    local config
    config=$(docker compose $compose_files config 2>/dev/null)
    
    # Check for required volumes
    local required_volumes=("postgres_data" "redis_data" "uploads" "app_logs")
    for volume in "${required_volumes[@]}"; do
        if echo "$config" | grep -q "^  $volume:"; then
            success "$environment has required volume: $volume"
        else
            error "$environment missing required volume: $volume"
        fi
    done
    
    return 0
}

# Function to validate environment-specific configurations
validate_environment_specific() {
    local environment="$1"
    
    case "$environment" in
        development)
            log "Validating development-specific configurations..."
            
            # Check for development tools in profiles
            if docker compose -f docker-compose.yml -f docker-compose.dev.yml config 2>/dev/null | grep -q "profiles:"; then
                success "Development has profile-based services"
            else
                warn "Development should have profile-based development tools"
            fi
            ;;
            
        production)
            log "Validating production-specific configurations..."
            
            # Check for security hardening
            local prod_config
            prod_config=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml config 2>/dev/null)
            
            if echo "$prod_config" | grep -q "read_only: true"; then
                success "Production has read-only filesystem configured"
            else
                warn "Production should use read-only filesystems for security"
            fi
            
            if echo "$prod_config" | grep -q "secrets:"; then
                success "Production has Docker secrets configured"
            else
                error "Production must use Docker secrets for sensitive data"
            fi
            
            # Check for monitoring services
            if echo "$prod_config" | grep -q "prometheus:"; then
                success "Production has monitoring configured"
            else
                warn "Production should include monitoring services"
            fi
            ;;
    esac
}

# Function to validate Dockerfile references
validate_dockerfiles() {
    log "Validating Dockerfile references..."
    
    # Check for referenced Dockerfiles
    local dockerfiles=(
        "Dockerfile.performance-optimized-v2"
        "Dockerfile"
    )
    
    for dockerfile in "${dockerfiles[@]}"; do
        if [[ -f "$dockerfile" ]]; then
            success "Referenced Dockerfile found: $dockerfile"
            
            # Basic Dockerfile syntax check
            if grep -q "^FROM" "$dockerfile"; then
                success "$dockerfile has valid FROM instruction"
            else
                error "$dockerfile missing FROM instruction"
            fi
        else
            warn "Referenced Dockerfile not found: $dockerfile"
        fi
    done
}

# Function to validate environment files
validate_env_files() {
    log "Validating environment files..."
    
    if check_file ".env.example" "Environment template"; then
        # Check for required variables in template
        local required_vars=(
            "NODE_ENV"
            "POSTGRES_DB"
            "POSTGRES_USER" 
            "POSTGRES_PASSWORD"
            "NEXTAUTH_SECRET"
            "JWT_SECRET"
            "ENCRYPTION_KEY"
        )
        
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" .env.example; then
                success "Environment template has required variable: $var"
            else
                warn "Environment template missing variable: $var"
            fi
        done
    fi
    
    # Check for actual .env file
    if [[ -f ".env" ]]; then
        success "Environment file exists: .env"
        
        # Check if it's not just a copy of the example
        if ! diff -q .env .env.example >/dev/null 2>&1; then
            success "Environment file has been customized"
        else
            warn "Environment file appears to be unchanged from template"
        fi
    else
        warn "Environment file not found: .env"
        log "Copy .env.example to .env and customize for your environment"
    fi
}

# Function to validate scripts
validate_scripts() {
    log "Validating deployment scripts..."
    
    local scripts=(
        "docker-scripts/deploy.sh"
        "docker-scripts/setup-secrets.sh"
    )
    
    for script in "${scripts[@]}"; do
        if check_file "$script" "Deployment script"; then
            if [[ -x "$script" ]]; then
                success "$script is executable"
            else
                warn "$script is not executable (run: chmod +x $script)"
            fi
            
            # Basic script validation
            if head -1 "$script" | grep -q "#!/bin/bash"; then
                success "$script has proper shebang"
            else
                error "$script missing bash shebang"
            fi
        fi
    done
}

# Function to validate Docker requirements
validate_docker_requirements() {
    log "Validating Docker requirements..."
    
    # Check if Docker is installed
    if command -v docker >/dev/null 2>&1; then
        success "Docker is installed"
        
        # Check Docker version
        local docker_version
        docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
        success "Docker version: $docker_version"
        
        # Check if Docker is running
        if docker info >/dev/null 2>&1; then
            success "Docker daemon is running"
        else
            error "Docker daemon is not running"
        fi
    else
        error "Docker is not installed"
    fi
    
    # Check if docker compose is available
    if docker compose version >/dev/null 2>&1; then
        success "docker compose is available"
        
        local compose_version
        compose_version=$(docker compose version | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        success "docker compose version: $compose_version"
    else
        error "docker compose is not available"
    fi
}

# Function to validate file permissions
validate_permissions() {
    log "Validating file permissions..."
    
    # Check compose files are readable
    local compose_files=(
        "docker-compose.yml"
        "docker-compose.dev.yml" 
        "docker-compose.prod.yml"
    )
    
    for file in "${compose_files[@]}"; do
        if [[ -r "$file" ]]; then
            success "$file is readable"
        else
            error "$file is not readable"
        fi
    done
    
    # Check script permissions
    if [[ -d "docker-scripts" ]]; then
        local script_count
        script_count=$(find docker-scripts -name "*.sh" -executable | wc -l)
        if [[ $script_count -gt 0 ]]; then
            success "$script_count scripts in docker-scripts/ are executable"
        else
            warn "No executable scripts found in docker-scripts/"
        fi
    fi
}

# Function to perform comprehensive validation
run_comprehensive_validation() {
    log "Starting comprehensive MediaNest Docker Compose validation..."
    
    cd "$PROJECT_ROOT"
    
    # Core file validation
    check_file "docker-compose.yml" "Base compose file"
    check_file "docker-compose.dev.yml" "Development compose file" 
    check_file "docker-compose.prod.yml" "Production compose file"
    
    # Validate Docker requirements
    validate_docker_requirements
    
    # Validate compose syntax for all environments
    validate_compose_syntax "-f docker-compose.yml -f docker-compose.dev.yml" "development"
    validate_compose_syntax "-f docker-compose.yml -f docker-compose.prod.yml" "production"
    
    # Validate service configurations
    validate_services "-f docker-compose.yml -f docker-compose.dev.yml" "development"
    validate_services "-f docker-compose.yml -f docker-compose.prod.yml" "production"
    
    # Validate networks
    validate_networks "-f docker-compose.yml -f docker-compose.dev.yml" "development"
    validate_networks "-f docker-compose.yml -f docker-compose.prod.yml" "production"
    
    # Validate volumes
    validate_volumes "-f docker-compose.yml -f docker-compose.dev.yml" "development" 
    validate_volumes "-f docker-compose.yml -f docker-compose.prod.yml" "production"
    
    # Environment-specific validation
    validate_environment_specific "development"
    validate_environment_specific "production"
    
    # Validate supporting files
    validate_dockerfiles
    validate_env_files
    validate_scripts
    validate_permissions
}

# Function to show validation summary
show_validation_summary() {
    echo
    log "=== VALIDATION SUMMARY ==="
    
    if [[ $ERROR_COUNT -eq 0 && $WARNING_COUNT -eq 0 ]]; then
        success "All validations passed! ✅"
        success "MediaNest Docker Compose configuration is ready for deployment."
    else
        if [[ $ERROR_COUNT -gt 0 ]]; then
            error "Found $ERROR_COUNT error(s) that must be fixed before deployment"
        fi
        
        if [[ $WARNING_COUNT -gt 0 ]]; then
            warn "Found $WARNING_COUNT warning(s) that should be addressed"
        fi
    fi
    
    echo
    log "Results breakdown:"
    printf "%s\n" "${VALIDATION_RESULTS[@]}"
    
    echo
    if [[ $ERROR_COUNT -gt 0 ]]; then
        log "Fix all errors before proceeding with deployment"
        exit 1
    else
        log "Configuration is valid for deployment"
        exit 0
    fi
}

# Function to show help
show_help() {
    cat << EOF
MediaNest Docker Compose Validation Script

Usage: $0 [OPTIONS]

Options:
    --quick         Quick validation (syntax only)
    --comprehensive Full validation including all checks (default)
    --help          Show this help message

Examples:
    $0                  # Full comprehensive validation
    $0 --quick         # Quick syntax validation only

This script validates:
    ✓ Docker Compose file syntax
    ✓ Service configurations and health checks
    ✓ Network and volume configurations
    ✓ Security hardening (production)
    ✓ Environment file templates
    ✓ Deployment scripts
    ✓ File permissions
    ✓ Docker requirements

EOF
}

# Main function
main() {
    local validation_type="comprehensive"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                validation_type="quick"
                shift
                ;;
            --comprehensive)
                validation_type="comprehensive"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Run validation based on type
    if [[ "$validation_type" == "quick" ]]; then
        log "Running quick validation..."
        validate_compose_syntax "-f docker-compose.yml -f docker-compose.dev.yml" "development"
        validate_compose_syntax "-f docker-compose.yml -f docker-compose.prod.yml" "production"
    else
        run_comprehensive_validation
    fi
    
    # Show summary
    show_validation_summary
}

# Run main function with all arguments
main "$@"