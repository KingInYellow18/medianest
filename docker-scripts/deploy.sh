#!/bin/bash
# MediaNest Docker Deployment Script
# Handles environment-specific deployments with proper override patterns

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
DEFAULT_ENVIRONMENT="production"
DEFAULT_PROFILES="backup,monitoring"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Function to show help
show_help() {
    cat << EOF
MediaNest Docker Deployment Script

Usage: $0 [ENVIRONMENT] [OPTIONS]

Environments:
    dev, development     Deploy development environment with hot reload
    prod, production     Deploy production environment with security hardening
    test                 Deploy test environment for CI/CD

Options:
    --build             Force rebuild of all images
    --pull              Pull latest base images before building
    --profiles=PROFILES Comma-separated list of profiles to enable
    --dry-run           Show commands without executing
    --clean             Remove existing containers and volumes
    --secrets           Setup Docker secrets before deployment
    --ssl               Initialize SSL certificates
    --monitoring        Enable monitoring stack (Prometheus, Grafana)
    --backup            Enable backup services
    --help              Show this help message

Examples:
    $0 dev                          # Development deployment
    $0 prod --build --monitoring    # Production with rebuild and monitoring
    $0 test --clean                 # Clean test deployment

Environment-specific commands:
    Development:
        docker compose -f docker compose.yml -f docker compose.dev.yml up -d
    
    Production:
        docker compose -f docker compose.yml -f docker compose.prod.yml up -d
    
    With profiles:
        docker compose -f docker compose.yml -f docker compose.dev.yml --profile dev-tools up -d

Configuration:
    Copy .env.example to .env and customize for your environment.
    For production, ensure Docker secrets are configured.

EOF
}

# Function to validate environment
validate_environment() {
    local env="$1"
    
    case "$env" in
        dev|development)
            ENVIRONMENT="development"
            COMPOSE_FILES="-f docker compose.yml -f docker compose.dev.yml"
            DEFAULT_PROFILES="dev-tools"
            ;;
        prod|production)
            ENVIRONMENT="production" 
            COMPOSE_FILES="-f docker compose.yml -f docker compose.prod.yml"
            DEFAULT_PROFILES="monitoring,backup"
            ;;
        test)
            ENVIRONMENT="test"
            COMPOSE_FILES="-f docker compose.yml -f docker compose.test.yml"
            DEFAULT_PROFILES=""
            ;;
        *)
            error "Invalid environment: $env"
            error "Valid environments: dev, prod, test"
            exit 1
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running or accessible"
        exit 1
    fi
    
    # Check if docker compose is available
    if ! command -v docker compose &> /dev/null; then
        error "docker compose is required but not installed"
        exit 1
    fi
    
    # Check if we're in the project root
    if [[ ! -f "docker compose.yml" ]]; then
        error "docker compose.yml not found. Are you in the project root?"
        exit 1
    fi
}

# Function to load environment file
load_environment() {
    if [[ -f "$ENV_FILE" ]]; then
        log "Loading environment from $ENV_FILE"
        # Export variables from .env file
        set -a  # automatically export all variables
        source "$ENV_FILE"
        set +a  # stop automatically exporting
    else
        warn ".env file not found, using defaults"
        if [[ "$ENVIRONMENT" == "production" ]]; then
            error "Production deployment requires .env file"
            log "Copy .env.example to .env and customize"
            exit 1
        fi
    fi
}

# Function to setup Docker secrets
setup_secrets() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Setting up Docker secrets for production..."
        if [[ -x "docker-scripts/setup-secrets.sh" ]]; then
            ./docker-scripts/setup-secrets.sh --auto
        else
            error "docker-scripts/setup-secrets.sh not found or not executable"
            exit 1
        fi
    else
        log "Skipping Docker secrets setup for $ENVIRONMENT environment"
    fi
}

# Function to create required directories
create_directories() {
    local directories=(
        "backups"
        "security-reports"
    )
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        directories+=(
            "/var/lib/medianest/postgres"
            "/var/lib/medianest/redis"
            "/var/lib/medianest/uploads"
            "/var/log/medianest"
            "/etc/ssl/medianest"
        )
    fi
    
    for dir in "${directories[@]}"; do
        if [[ "$dir" =~ ^/ ]]; then
            # Absolute path - requires sudo
            if [[ ! -d "$dir" ]]; then
                log "Creating directory: $dir"
                sudo mkdir -p "$dir"
                sudo chown "$(id -u):$(id -g)" "$dir" 2>/dev/null || true
            fi
        else
            # Relative path
            mkdir -p "$dir"
        fi
    done
}

# Function to build images
build_images() {
    log "Building Docker images..."
    docker compose $COMPOSE_FILES build
}

# Function to pull base images
pull_images() {
    log "Pulling base images..."
    docker compose $COMPOSE_FILES pull
}

# Function to clean existing deployment
clean_deployment() {
    log "Cleaning existing deployment..."
    
    # Stop and remove containers
    docker compose $COMPOSE_FILES down --remove-orphans || true
    
    # Remove volumes if requested
    if [[ "${CLEAN_VOLUMES:-false}" == "true" ]]; then
        warn "Removing all volumes (data will be lost!)"
        docker compose $COMPOSE_FILES down --volumes
    fi
    
    # Clean up unused images
    docker image prune -f || true
}

# Function to start services
start_services() {
    local profiles_arg=""
    
    if [[ -n "${PROFILES:-}" ]]; then
        # Convert comma-separated profiles to multiple --profile arguments
        IFS=',' read -ra PROFILE_ARRAY <<< "${PROFILES}"
        for profile in "${PROFILE_ARRAY[@]}"; do
            profiles_arg="$profiles_arg --profile $profile"
        done
    fi
    
    log "Starting MediaNest services..."
    log "Environment: $ENVIRONMENT"
    log "Compose files: $COMPOSE_FILES"
    log "Profiles: ${PROFILES:-none}"
    
    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log "DRY RUN - Would execute:"
        echo "docker compose $COMPOSE_FILES $profiles_arg up -d"
        return 0
    fi
    
    # Start services
    if [[ -n "$profiles_arg" ]]; then
        eval "docker compose $COMPOSE_FILES $profiles_arg up -d"
    else
        docker compose $COMPOSE_FILES up -d
    fi
    
    success "Services started successfully!"
}

# Function to initialize SSL certificates
init_ssl() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        log "SSL initialization is only available for production environment"
        return 0
    fi
    
    log "Initializing SSL certificates..."
    docker compose $COMPOSE_FILES --profile ssl-init up certbot
}

# Function to show deployment status
show_status() {
    log "Deployment Status:"
    docker compose $COMPOSE_FILES ps
    
    echo
    log "Service Health:"
    docker compose $COMPOSE_FILES ps --filter "status=running" --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo
        log "Development URLs:"
        log "Frontend:        http://localhost:3000"
        log "Backend API:     http://localhost:3001"
        log "Database:        localhost:5432"
        log "Redis:           localhost:6379"
        log "Adminer:         http://localhost:8080"
        log "Redis Commander: http://localhost:8081"
        log "File Browser:    http://localhost:8082"
        log "MailHog:         http://localhost:8025"
        log "Dev Proxy:       http://localhost:8000"
    fi
}

# Function to validate deployment
validate_deployment() {
    log "Validating deployment..."
    
    local failed_services=()
    
    # Check service health
    while IFS= read -r service; do
        if ! docker compose $COMPOSE_FILES ps "$service" | grep -q "Up"; then
            failed_services+=("$service")
        fi
    done < <(docker compose $COMPOSE_FILES config --services)
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        error "Failed services: ${failed_services[*]}"
        log "Check service logs with: docker compose $COMPOSE_FILES logs [service]"
        return 1
    fi
    
    success "All services are running"
    return 0
}

# Main deployment function
deploy() {
    local environment="${1:-$DEFAULT_ENVIRONMENT}"
    
    log "Starting MediaNest deployment..."
    log "Environment: $environment"
    
    # Validate and set environment
    validate_environment "$environment"
    
    # Load environment configuration
    load_environment
    
    # Create required directories
    create_directories
    
    # Setup secrets if requested
    if [[ "${SETUP_SECRETS:-false}" == "true" ]]; then
        setup_secrets
    fi
    
    # Clean if requested
    if [[ "${CLEAN:-false}" == "true" ]]; then
        clean_deployment
    fi
    
    # Pull images if requested
    if [[ "${PULL:-false}" == "true" ]]; then
        pull_images
    fi
    
    # Build if requested
    if [[ "${BUILD:-false}" == "true" ]]; then
        build_images
    fi
    
    # Start services
    start_services
    
    # Initialize SSL if requested
    if [[ "${INIT_SSL:-false}" == "true" ]]; then
        init_ssl
    fi
    
    # Wait a moment for services to start
    sleep 5
    
    # Validate deployment
    if validate_deployment; then
        show_status
        success "MediaNest deployment completed successfully!"
    else
        error "Deployment validation failed"
        exit 1
    fi
}

# Parse command line arguments
parse_arguments() {
    ENVIRONMENT="$DEFAULT_ENVIRONMENT"
    PROFILES="$DEFAULT_PROFILES"
    BUILD="false"
    PULL="false"
    CLEAN="false"
    DRY_RUN="false"
    SETUP_SECRETS="false"
    INIT_SSL="false"
    CLEAN_VOLUMES="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|development|prod|production|test)
                ENVIRONMENT="$1"
                shift
                ;;
            --build)
                BUILD="true"
                shift
                ;;
            --pull)
                PULL="true"
                shift
                ;;
            --profiles=*)
                PROFILES="${1#*=}"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --clean)
                CLEAN="true"
                shift
                ;;
            --clean-volumes)
                CLEAN="true"
                CLEAN_VOLUMES="true"
                shift
                ;;
            --secrets)
                SETUP_SECRETS="true"
                shift
                ;;
            --ssl)
                INIT_SSL="true"
                shift
                ;;
            --monitoring)
                if [[ "$PROFILES" == "" ]]; then
                    PROFILES="monitoring"
                else
                    PROFILES="$PROFILES,monitoring"
                fi
                shift
                ;;
            --backup)
                if [[ "$PROFILES" == "" ]]; then
                    PROFILES="backup"
                else
                    PROFILES="$PROFILES,backup"
                fi
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
}

# Main script execution
main() {
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Check prerequisites
    check_prerequisites
    
    # Parse arguments
    parse_arguments "$@"
    
    # Execute deployment
    deploy "$ENVIRONMENT"
}

# Run main function with all arguments
main "$@"