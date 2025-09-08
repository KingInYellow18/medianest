#!/bin/bash

# MediaNest Quick Deploy Script
# One-command production deployment for self-hosters

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ASCII Art Banner
print_banner() {
    echo -e "${BLUE}${BOLD}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════════════════╗
║                           MediaNest Quick Deploy                          ║
║                        Production Deployment Tool                         ║
║                                                                           ║
║  🚀 Single-command deployment for self-hosters                           ║
║  📊 Comprehensive health monitoring                                       ║
║  🔒 Security-hardened containers                                          ║
║  💾 Automated backup and restore                                          ║
╚═══════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[DONE]${NC} $(date '+%H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') - $1"
}

log_step() {
    echo -e "\n${BOLD}${BLUE}=== $1 ===${NC}"
}

# Check system requirements
check_requirements() {
    log_step "CHECKING SYSTEM REQUIREMENTS"
    
    local missing_tools=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    else
        local docker_version
        docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
        log_success "Docker installed: v${docker_version}"
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        missing_tools+=("docker-compose")
    else
        local compose_version
        compose_version=$(docker compose version --short 2>/dev/null || echo "unknown")
        log_success "Docker Compose installed: v${compose_version}"
    fi
    
    # Check other tools
    for tool in curl git; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        else
            log_success "$tool is available"
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and run this script again"
        exit 1
    fi
    
    # Check system resources
    local available_memory
    if available_memory=$(free -m | awk 'NR==2{print $2}'); then
        if [[ "$available_memory" -lt 2048 ]]; then
            log_warning "Low system memory: ${available_memory}MB (recommended: 4GB+)"
        else
            log_success "System memory: ${available_memory}MB"
        fi
    fi
    
    # Check disk space
    local available_disk
    if available_disk=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//'); then
        if [[ "$available_disk" -lt 20 ]]; then
            log_warning "Low disk space: ${available_disk}GB (recommended: 50GB+)"
        else
            log_success "Available disk space: ${available_disk}GB"
        fi
    fi
}

# Setup environment configuration
setup_environment() {
    log_step "SETTING UP ENVIRONMENT CONFIGURATION"
    
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.production.example" ]]; then
            log_info "Creating .env from production template..."
            cp .env.production.example .env
            log_success "Environment file created from template"
        else
            log_error ".env file not found and no template available"
            log_info "Please create a .env file with your configuration"
            exit 1
        fi
    else
        log_success "Environment file found"
    fi
    
    # Check for required environment variables
    local required_vars=("JWT_SECRET" "ENCRYPTION_KEY" "DATABASE_URL")
    local missing_vars=()
    
    source .env
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"<"* ]] || [[ "${!var}" == *"generate"* ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_warning "Missing or placeholder values for: ${missing_vars[*]}"
        log_info "Generating secure random values..."
        
        # Generate secrets
        if [[ -x "./scripts/generate-docker-secrets.sh" ]]; then
            ./scripts/generate-docker-secrets.sh
            log_success "Secrets generated automatically"
        else
            log_error "Cannot generate secrets automatically"
            log_info "Please update .env file with real values"
            exit 1
        fi
    else
        log_success "Environment configuration is complete"
    fi
}

# Create required directories
create_directories() {
    log_step "CREATING REQUIRED DIRECTORIES"
    
    local directories=(
        "data/postgres"
        "data/redis"
        "logs"
        "backups"
        "uploads"
        "ssl_certs"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_success "Created directory: $dir"
        else
            log_success "Directory exists: $dir"
        fi
    done
    
    # Set proper permissions
    chmod 755 data logs backups uploads 2>/dev/null || true
    chmod 700 ssl_certs 2>/dev/null || true
}

# Deploy the application
deploy_application() {
    log_step "DEPLOYING MEDIANEST APPLICATION"
    
    # Choose the appropriate compose file
    local compose_file="docker-compose.yml"
    if [[ -f "docker-compose.production.yml" ]]; then
        compose_file="docker-compose.production.yml"
        log_info "Using production compose file"
    else
        log_info "Using standard compose file"
    fi
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    if docker compose -f "$compose_file" pull; then
        log_success "Images pulled successfully"
    else
        log_warning "Some images failed to pull (continuing with local images)"
    fi
    
    # Start services
    log_info "Starting MediaNest services..."
    if docker compose -f "$compose_file" up -d; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        exit 1
    fi
    
    # Wait for services to be ready
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    local max_wait=120
    local wait_time=0
    local all_healthy=false
    
    while [[ $wait_time -lt $max_wait ]]; do
        if docker compose -f "$compose_file" ps | grep -q "unhealthy\|starting"; then
            log_info "Services still starting... (${wait_time}s elapsed)"
            sleep 10
            wait_time=$((wait_time + 10))
        else
            all_healthy=true
            break
        fi
    done
    
    if [[ "$all_healthy" == true ]]; then
        log_success "All services are healthy"
    else
        log_warning "Some services may not be fully ready yet"
    fi
}

# Run health checks
run_health_checks() {
    log_step "RUNNING HEALTH CHECKS"
    
    if [[ -x "./scripts/healthcheck.sh" ]]; then
        log_info "Running comprehensive health check..."
        if ./scripts/healthcheck.sh; then
            log_success "All health checks passed!"
        else
            log_warning "Some health checks failed (see details above)"
        fi
    else
        log_info "Running basic health checks..."
        
        # Check if services are responding
        local checks_passed=0
        local total_checks=0
        
        # Check backend API
        ((total_checks++))
        if curl -s -f --max-time 10 "http://localhost:4000/health" >/dev/null 2>&1; then
            log_success "Backend API is responding"
            ((checks_passed++))
        else
            log_warning "Backend API is not responding"
        fi
        
        # Check frontend
        ((total_checks++))
        if curl -s -f --max-time 10 "http://localhost:3000" >/dev/null 2>&1; then
            log_success "Frontend is accessible"
            ((checks_passed++))
        else
            log_warning "Frontend is not accessible"
        fi
        
        log_info "Health checks: ${checks_passed}/${total_checks} passed"
    fi
}

# Display deployment summary
show_deployment_summary() {
    log_step "DEPLOYMENT COMPLETE"
    
    echo -e "\n${GREEN}${BOLD}🎉 MediaNest has been successfully deployed!${NC}\n"
    
    echo -e "${BOLD}Access your MediaNest instance:${NC}"
    echo -e "  🌐 Web Interface: ${BLUE}http://localhost:3000${NC}"
    echo -e "  🔌 API Endpoint:  ${BLUE}http://localhost:4000${NC}"
    echo -e "  📊 Health Check:  ${BLUE}http://localhost:4000/health${NC}"
    
    echo -e "\n${BOLD}Useful commands:${NC}"
    echo -e "  📋 View logs:     ${YELLOW}docker compose logs -f${NC}"
    echo -e "  📊 Check status:  ${YELLOW}docker compose ps${NC}"
    echo -e "  🔄 Restart:       ${YELLOW}docker compose restart${NC}"
    echo -e "  🛑 Stop:          ${YELLOW}docker compose down${NC}"
    echo -e "  🔍 Health check:  ${YELLOW}./scripts/healthcheck.sh${NC}"
    
    if [[ -x "./scripts/backup.sh" ]]; then
        echo -e "  💾 Backup:        ${YELLOW}./scripts/backup.sh${NC}"
    fi
    
    echo -e "\n${BOLD}Next steps:${NC}"
    echo -e "  1. Configure your media libraries in the web interface"
    echo -e "  2. Set up SSL certificates for HTTPS (see docs/)"
    echo -e "  3. Configure automated backups"
    echo -e "  4. Review security settings in .env file"
    
    echo -e "\n${BOLD}Support:${NC}"
    echo -e "  📚 Documentation: ${BLUE}docs/${NC}"
    echo -e "  🐛 Issues:        ${BLUE}GitHub Issues${NC}"
    echo -e "  💬 Community:     ${BLUE}Discord/Forums${NC}"
    
    echo -e "\n${GREEN}${BOLD}Happy self-hosting! 🚀${NC}\n"
}

# Handle errors
handle_error() {
    local exit_code=$?
    log_error "Deployment failed with exit code: $exit_code"
    
    echo -e "\n${RED}${BOLD}❌ Deployment failed!${NC}\n"
    echo -e "${BOLD}Troubleshooting steps:${NC}"
    echo -e "  1. Check the error messages above"
    echo -e "  2. Verify your .env configuration"
    echo -e "  3. Ensure Docker is running properly"
    echo -e "  4. Check available disk space and memory"
    echo -e "  5. View container logs: ${YELLOW}docker compose logs${NC}"
    
    echo -e "\n${BOLD}Get help:${NC}"
    echo -e "  📋 Run health check: ${YELLOW}./scripts/healthcheck.sh${NC}"
    echo -e "  📊 Check status:     ${YELLOW}docker compose ps${NC}"
    echo -e "  📚 Read docs:        ${BLUE}docs/troubleshooting.md${NC}"
    
    exit $exit_code
}

# Main deployment process
main() {
    trap handle_error ERR
    
    print_banner
    
    log_info "Starting MediaNest production deployment..."
    log_info "Timestamp: $(date)"
    log_info "Working directory: $(pwd)"
    
    check_requirements
    setup_environment
    create_directories
    deploy_application
    run_health_checks
    show_deployment_summary
    
    log_success "Deployment completed successfully at $(date)"
}

# Script options
case "${1:-deploy}" in
    "deploy"|"start"|"up")
        main
        ;;
    "health"|"check")
        if [[ -x "./scripts/healthcheck.sh" ]]; then
            ./scripts/healthcheck.sh
        else
            log_error "Health check script not found"
            exit 1
        fi
        ;;
    "status")
        docker compose ps
        ;;
    "logs")
        docker compose logs -f "${2:-}"
        ;;
    "stop"|"down")
        log_info "Stopping MediaNest services..."
        docker compose down
        log_success "Services stopped"
        ;;
    "restart")
        log_info "Restarting MediaNest services..."
        docker compose restart
        log_success "Services restarted"
        ;;
    "help"|*)
        echo "MediaNest Quick Deploy Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Deploy MediaNest (default)"
        echo "  health    - Run health checks"
        echo "  status    - Show service status"
        echo "  logs      - Show service logs"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  help      - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 deploy      # Full deployment"
        echo "  $0 health      # Health check only"
        echo "  $0 logs app    # Show app logs"
        ;;
esac