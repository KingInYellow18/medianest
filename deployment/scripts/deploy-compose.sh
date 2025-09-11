#!/bin/bash
# MediaNest Docker Compose Deployment Script
# Simplified deployment for single-instance Docker Compose architecture

set -euo pipefail

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
CONTAINER_REGISTRY="${CONTAINER_REGISTRY:-docker.io}"
CONTAINER_TAG="${CONTAINER_TAG:-latest}"
DOMAIN="${DOMAIN:-localhost}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function for exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment failed with exit code $exit_code"
        log_info "Check logs with: docker-compose -f $COMPOSE_FILE logs"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("docker" "docker-compose")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or not accessible"
        exit 1
    fi
    
    # Check compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Function to validate environment variables
validate_environment() {
    log_info "Validating environment configuration..."
    
    local required_vars=("DB_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "NEXTAUTH_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_info "Please set these variables or source your .env file"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Function to create deployment backup
create_backup() {
    log_info "Creating deployment backup..."
    
    local backup_dir="backups/pre-deploy-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup current configuration
    cp "$COMPOSE_FILE" "$backup_dir/" 2>/dev/null || true
    cp .env.production "$backup_dir/" 2>/dev/null || true
    
    # Backup database if containers are running
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_info "Creating database backup..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "${DB_USER:-medianest}" "${DB_NAME:-medianest}" > "$backup_dir/database.sql" || log_warning "Database backup failed"
    fi
    
    log_success "Backup created: $backup_dir"
}

# Function to pull latest images
pull_images() {
    log_info "Pulling latest container images..."
    
    if ! docker-compose -f "$COMPOSE_FILE" pull; then
        log_error "Failed to pull container images"
        exit 1
    fi
    
    log_success "Container images pulled successfully"
}

# Function to deploy services
deploy_services() {
    log_info "Deploying services with Docker Compose..."
    
    # Deploy with rolling update
    docker-compose -f "$COMPOSE_FILE" up -d --force-recreate
    
    log_success "Services deployed successfully"
}

# Function to run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for services to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts..."
        
        local healthy_services=0
        local total_services=0
        
        # Check backend health
        if curl -f http://localhost:4000/api/health --max-time 10 >/dev/null 2>&1; then
            log_info "Backend service: HEALTHY"
            healthy_services=$((healthy_services + 1))
        else
            log_warning "Backend service: NOT READY"
        fi
        total_services=$((total_services + 1))
        
        # Check frontend health
        if curl -f http://localhost:3000/api/health --max-time 10 >/dev/null 2>&1; then
            log_info "Frontend service: HEALTHY"
            healthy_services=$((healthy_services + 1))
        else
            log_warning "Frontend service: NOT READY"
        fi
        total_services=$((total_services + 1))
        
        # Check database connectivity
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready >/dev/null 2>&1; then
            log_info "Database service: HEALTHY"
            healthy_services=$((healthy_services + 1))
        else
            log_warning "Database service: NOT READY"
        fi
        total_services=$((total_services + 1))
        
        # Check if all services are healthy
        if [ $healthy_services -eq $total_services ]; then
            log_success "All health checks passed"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Health checks failed after $max_attempts attempts"
            docker-compose -f "$COMPOSE_FILE" logs --tail=20
            exit 1
        fi
        
        sleep 10
        attempt=$((attempt + 1))
    done
}

# Function to display deployment summary
display_summary() {
    log_info "Deployment Summary"
    echo "=================="
    echo "Compose File: $COMPOSE_FILE"
    echo "Domain: $DOMAIN"
    echo "Container Tag: $CONTAINER_TAG"
    echo ""
    echo "Services:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "Container Status:"
    docker ps --filter "label=com.docker.compose.project=medianest" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    log_success "Deployment completed successfully!"
    log_info "Access your application at: http://$DOMAIN"
    log_info "API available at: http://$DOMAIN:4000/api"
}

# Main deployment function
main() {
    log_info "Starting MediaNest Docker Compose deployment..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-pull)
                SKIP_PULL=true
                shift
                ;;
            --tag)
                CONTAINER_TAG="$2"
                shift 2
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --compose-file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            --help)
                echo "MediaNest Docker Compose Deployment Script"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-backup        Skip creating deployment backup"
                echo "  --skip-pull          Skip pulling latest container images"
                echo "  --tag TAG            Container image tag (default: latest)"
                echo "  --domain DOMAIN      Domain name for the application"
                echo "  --compose-file FILE  Docker Compose file (default: docker-compose.production.yml)"
                echo "  --help               Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    
    if [ "${SKIP_BACKUP:-false}" != "true" ]; then
        create_backup
    fi
    
    if [ "${SKIP_PULL:-false}" != "true" ]; then
        pull_images
    fi
    
    deploy_services
    run_health_checks
    display_summary
}

# Run main function
main "$@"