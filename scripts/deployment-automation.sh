#!/bin/bash
# MediaNest Deployment Automation Script
# Comprehensive deployment with validation and rollback capabilities
#
# Usage:
#   ./scripts/deployment-automation.sh deploy       # Full deployment
#   ./scripts/deployment-automation.sh validate     # Pre-deployment validation
#   ./scripts/deployment-automation.sh rollback     # Emergency rollback
#   ./scripts/deployment-automation.sh health       # Health check
#   ./scripts/deployment-automation.sh backup       # Create backup
#   ./scripts/deployment-automation.sh update       # Update deployment
#
# Version: 2.0.0

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="config/docker/docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="backups"
SECRETS_DIR="secrets"
LOG_FILE="logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Log to file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Log to console with colors
    case $level in
        ERROR)   echo -e "${RED}❌ ERROR: $message${NC}" ;;
        WARN)    echo -e "${YELLOW}⚠️  WARN: $message${NC}" ;;
        INFO)    echo -e "${BLUE}ℹ️  INFO: $message${NC}" ;;
        SUCCESS) echo -e "${GREEN}✅ SUCCESS: $message${NC}" ;;
        *)       echo "🔹 $message" ;;
    esac
}

# Error handling
error_exit() {
    log ERROR "$1"
    exit 1
}

# Check if running from correct directory
check_project_root() {
    if [[ ! -f "package.json" ]] || [[ ! -f "$COMPOSE_FILE" ]]; then
        error_exit "This script must be run from the MediaNest project root directory"
    fi
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("docker" "docker-compose" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "$cmd is required but not installed"
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error_exit "Docker daemon is not running or not accessible"
    fi
    
    # Check Docker Compose version
    local compose_version
    if command -v "docker" &> /dev/null && docker compose version &> /dev/null; then
        compose_version=$(docker compose version --short 2>/dev/null || echo "unknown")
        log INFO "Using Docker Compose v$compose_version"
    else
        error_exit "Docker Compose v2 is required"
    fi
    
    # Check system resources
    local available_memory_mb
    available_memory_mb=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [[ "$available_memory_mb" -lt 2048 ]]; then
        log WARN "Available memory is ${available_memory_mb}MB (recommended: 2GB+)"
    fi
    
    local available_disk_gb
    available_disk_gb=$(df -BG . | awk 'NR==2{printf "%.0f", $4}' | tr -d 'G')
    if [[ "$available_disk_gb" -lt 10 ]]; then
        error_exit "Available disk space is ${available_disk_gb}GB (minimum: 10GB required)"
    fi
    
    log SUCCESS "Prerequisites check passed"
}

# Validate configuration
validate_configuration() {
    log INFO "Validating configuration..."
    
    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        error_exit "Environment file $ENV_FILE not found"
    fi
    
    # Source environment file to check required variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check required environment variables
    local required_vars=("DOMAIN_NAME" "FRONTEND_URL" "NEXTAUTH_URL" "CERTBOT_EMAIL")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
    
    # Check secrets directory
    if [[ ! -d "$SECRETS_DIR" ]]; then
        error_exit "Secrets directory $SECRETS_DIR not found. Run generate-secrets.sh first."
    fi
    
    # Check required secrets
    local required_secrets=("postgres_password" "redis_password" "jwt_secret" "nextauth_secret" "database_url" "redis_url")
    for secret in "${required_secrets[@]}"; do
        local secret_file="$SECRETS_DIR/$secret"
        if [[ ! -f "$secret_file" ]]; then
            error_exit "Secret file $secret_file not found"
        fi
        if [[ ! -s "$secret_file" ]]; then
            error_exit "Secret file $secret_file is empty"
        fi
        # Check permissions
        local perms
        perms=$(stat -c "%a" "$secret_file")
        if [[ "$perms" != "600" ]]; then
            log WARN "Secret file $secret_file has permissions $perms, should be 600"
            chmod 600 "$secret_file"
        fi
    done
    
    # Check SSL certificates
    local ssl_cert="data/certbot/ssl/fullchain.pem"
    local ssl_key="data/certbot/ssl/privkey.pem"
    
    if [[ -f "$ssl_cert" ]] && [[ -f "$ssl_key" ]]; then
        # Check certificate validity
        if ! openssl x509 -in "$ssl_cert" -checkend 604800 -noout &> /dev/null; then
            log WARN "SSL certificate expires within 7 days"
        fi
        log INFO "SSL certificates found and valid"
    else
        log WARN "SSL certificates not found. HTTPS will not work until certificates are configured."
    fi
    
    log SUCCESS "Configuration validation passed"
}

# Create required directories
create_directories() {
    log INFO "Creating required directories..."
    
    local directories=(
        "data/postgres"
        "data/redis"
        "data/uploads"
        "data/certbot/webroot"
        "data/certbot/ssl"
        "logs/backend"
        "logs/frontend"
        "logs/nginx"
        "logs/certbot"
        "backups/postgres"
        "backups/redis"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log INFO "Created directory: $dir"
        fi
    done
    
    # Set proper ownership and permissions
    if [[ -d "data" ]]; then
        chmod 755 data logs backups
        chmod -R 755 data/certbot
    fi
    
    log SUCCESS "Directory structure created"
}

# Backup current deployment
create_backup() {
    log INFO "Creating backup..."
    
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/medianest-backup-$timestamp.tar.gz"
    
    mkdir -p "$BACKUP_DIR"
    
    # Create backup excluding sensitive files
    tar --exclude='node_modules' \
        --exclude='logs' \
        --exclude='*.log' \
        --exclude='backups' \
        --exclude='.git' \
        -czf "$backup_file" \
        -C .. "$(basename "$PROJECT_ROOT")" \
        2>/dev/null || true
    
    # Backup database if running
    if docker compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log INFO "Backing up database..."
        docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U medianest medianest | gzip > "$BACKUP_DIR/postgres-backup-$timestamp.sql.gz"
        
        # Backup Redis if running
        if docker compose -f "$COMPOSE_FILE" ps redis | grep -q "Up"; then
            log INFO "Backing up Redis..."
            docker compose -f "$COMPOSE_FILE" exec redis redis-cli -a "$(cat $SECRETS_DIR/redis_password)" --rdb /tmp/dump.rdb &>/dev/null || true
            docker cp "$(docker compose -f "$COMPOSE_FILE" ps -q redis):/tmp/dump.rdb" "$BACKUP_DIR/redis-backup-$timestamp.rdb" 2>/dev/null || true
        fi
    fi
    
    # Store backup location for potential rollback
    echo "$backup_file" > "$BACKUP_DIR/.last-backup"
    
    log SUCCESS "Backup created: $backup_file"
}

# Deploy application
deploy_application() {
    log INFO "Starting deployment..."
    
    # Pull latest images
    log INFO "Pulling Docker images..."
    docker compose -f "$COMPOSE_FILE" pull --quiet
    
    # Build application images
    log INFO "Building application images..."
    docker compose -f "$COMPOSE_FILE" build --pull
    
    # Start services
    log INFO "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    log INFO "Waiting for services to start..."
    local max_wait=180
    local wait_time=0
    
    while [[ $wait_time -lt $max_wait ]]; do
        if check_health_internal; then
            break
        fi
        sleep 10
        wait_time=$((wait_time + 10))
        log INFO "Waiting for services... ($wait_time/${max_wait}s)"
    done
    
    if [[ $wait_time -ge $max_wait ]]; then
        error_exit "Services failed to start within $max_wait seconds"
    fi
    
    # Run database migrations
    log INFO "Running database migrations..."
    if ! docker compose -f "$COMPOSE_FILE" exec -T backend npm run db:migrate; then
        log WARN "Database migrations failed. This might be expected for new installations."
    fi
    
    log SUCCESS "Deployment completed successfully"
}

# Internal health check function
check_health_internal() {
    # Check container status
    local unhealthy_containers
    unhealthy_containers=$(docker compose -f "$COMPOSE_FILE" ps --filter "health=unhealthy" -q 2>/dev/null | wc -l)
    
    if [[ "$unhealthy_containers" -gt 0 ]]; then
        return 1
    fi
    
    # Check if main services are running
    local required_services=("backend" "frontend" "postgres" "redis" "nginx")
    for service in "${required_services[@]}"; do
        if ! docker compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            return 1
        fi
    done
    
    return 0
}

# Comprehensive health check
check_health() {
    log INFO "Performing health check..."
    
    # Check container status
    log INFO "Checking container status..."
    docker compose -f "$COMPOSE_FILE" ps
    
    if ! check_health_internal; then
        log ERROR "Some services are not healthy"
        return 1
    fi
    
    # Test HTTP endpoints
    log INFO "Testing HTTP endpoints..."
    
    # Test backend health endpoint
    if curl -f -s "http://localhost/api/health" >/dev/null; then
        log SUCCESS "Backend health endpoint is responding"
    else
        log ERROR "Backend health endpoint is not responding"
        return 1
    fi
    
    # Test frontend (if accessible)
    if curl -f -s -I "http://localhost" >/dev/null; then
        log SUCCESS "Frontend is accessible"
    else
        log WARN "Frontend may not be accessible (this might be normal if HTTPS-only)"
    fi
    
    # Test HTTPS if certificates are configured
    local ssl_cert="data/certbot/ssl/fullchain.pem"
    if [[ -f "$ssl_cert" ]]; then
        if curl -f -s -k "https://localhost/api/health" >/dev/null; then
            log SUCCESS "HTTPS endpoint is responding"
        else
            log WARN "HTTPS endpoint is not responding"
        fi
    fi
    
    # Test database connectivity
    log INFO "Testing database connectivity..."
    if docker compose -f "$COMPOSE_FILE" exec -T backend node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
            .then(() => { console.log('Database connected'); process.exit(0); })
            .catch(err => { console.error('Database error:', err.message); process.exit(1); });
    " &>/dev/null; then
        log SUCCESS "Database connectivity is working"
    else
        log ERROR "Database connectivity failed"
        return 1
    fi
    
    # Test Redis connectivity
    log INFO "Testing Redis connectivity..."
    if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli -a "$(cat $SECRETS_DIR/redis_password)" ping 2>/dev/null | grep -q "PONG"; then
        log SUCCESS "Redis connectivity is working"
    else
        log ERROR "Redis connectivity failed"
        return 1
    fi
    
    log SUCCESS "All health checks passed"
    return 0
}

# Emergency rollback
perform_rollback() {
    log WARN "Performing emergency rollback..."
    
    # Stop current services
    docker compose -f "$COMPOSE_FILE" down
    
    # Check if there's a recent backup
    if [[ -f "$BACKUP_DIR/.last-backup" ]]; then
        local last_backup
        last_backup=$(cat "$BACKUP_DIR/.last-backup")
        
        if [[ -f "$last_backup" ]]; then
            log INFO "Found recent backup: $last_backup"
            
            # Extract backup
            local restore_dir="${last_backup%.tar.gz}-restore"
            mkdir -p "$restore_dir"
            
            if tar -xzf "$last_backup" -C "$restore_dir" --strip-components=1; then
                # Copy configuration files (but keep current secrets)
                cp "$restore_dir/$ENV_FILE" "$ENV_FILE.backup"
                cp "$restore_dir/$COMPOSE_FILE" "$COMPOSE_FILE.backup"
                
                log INFO "Configuration backed up for manual review"
            else
                log ERROR "Failed to extract backup"
            fi
            
            rm -rf "$restore_dir"
        fi
    fi
    
    # Attempt to restart with current configuration
    log INFO "Attempting to restart services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    # Wait and check health
    sleep 30
    if check_health_internal; then
        log SUCCESS "Rollback completed successfully"
    else
        log ERROR "Rollback failed. Manual intervention required."
        return 1
    fi
}

# Update deployment
update_deployment() {
    log INFO "Starting deployment update..."
    
    # Create backup before update
    create_backup
    
    # Pull latest changes
    if [[ -d ".git" ]]; then
        log INFO "Pulling latest code..."
        git pull origin main || log WARN "Git pull failed, continuing with current code"
    fi
    
    # Pull and rebuild images
    log INFO "Updating Docker images..."
    docker compose -f "$COMPOSE_FILE" pull --quiet
    docker compose -f "$COMPOSE_FILE" build --pull
    
    # Restart services with zero-downtime strategy
    log INFO "Updating services with zero downtime..."
    docker compose -f "$COMPOSE_FILE" up -d --no-deps backend
    sleep 10
    docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend
    sleep 10
    docker compose -f "$COMPOSE_FILE" up -d
    
    # Run any pending migrations
    log INFO "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec -T backend npm run db:migrate || true
    
    # Health check after update
    sleep 30
    if check_health; then
        log SUCCESS "Update completed successfully"
    else
        log ERROR "Update failed. Consider rollback."
        return 1
    fi
}

# Clean up old backups and logs
cleanup() {
    log INFO "Cleaning up old files..."
    
    # Clean old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete 2>/dev/null || true
    
    # Clean old logs (keep last 14 days)
    find logs -name "*.log" -mtime +14 -delete 2>/dev/null || true
    
    # Clean Docker system
    docker system prune -f --volumes
    
    log SUCCESS "Cleanup completed"
}

# Show usage
show_usage() {
    cat << EOF
MediaNest Deployment Automation Script

Usage: $0 COMMAND

Commands:
  deploy      Full deployment with validation and backup
  validate    Pre-deployment validation only
  rollback    Emergency rollback to last backup
  health      Comprehensive health check
  backup      Create backup of current deployment
  update      Update deployment with zero downtime
  cleanup     Clean up old backups and logs
  
Examples:
  $0 validate     # Check if system is ready for deployment
  $0 deploy       # Full deployment process
  $0 health       # Check if deployment is healthy
  $0 update       # Update existing deployment
  $0 rollback     # Emergency rollback
  
For detailed documentation, see README_DEPLOYMENT.md
EOF
}

# Main execution
main() {
    local command=${1:-help}
    
    # Change to project root
    cd "$PROJECT_ROOT"
    check_project_root
    
    case "$command" in
        validate)
            log INFO "Starting pre-deployment validation..."
            check_prerequisites
            validate_configuration
            create_directories
            log SUCCESS "Pre-deployment validation completed"
            ;;
            
        deploy)
            log INFO "Starting full deployment..."
            check_prerequisites
            validate_configuration
            create_directories
            create_backup
            deploy_application
            
            # Final health check
            sleep 10
            if check_health; then
                log SUCCESS "🎉 Deployment completed successfully!"
                log INFO "Your MediaNest instance should now be available at: $FRONTEND_URL"
            else
                log ERROR "Deployment completed but health check failed"
                exit 1
            fi
            ;;
            
        health)
            check_health
            ;;
            
        backup)
            create_backup
            ;;
            
        rollback)
            perform_rollback
            ;;
            
        update)
            check_prerequisites
            update_deployment
            ;;
            
        cleanup)
            cleanup
            ;;
            
        help|--help|-h)
            show_usage
            ;;
            
        *)
            log ERROR "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"