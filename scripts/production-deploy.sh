#!/bin/bash
# MediaNest Production Deployment Script
# Automated deployment with safety checks and rollback capability

set -e

# Configuration
APP_DIR="/opt/medianest/app"
BACKUP_DIR="/opt/medianest/backups"
LOG_FILE="/var/log/medianest/deploy.log"
COMPOSE_FILE="docker-compose.production.yml"
HEALTH_CHECK_URL="http://localhost:3000/health"
MAX_HEALTH_CHECKS=30
HEALTH_CHECK_INTERVAL=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log_error "Deployment failed on line $1"
    log_error "Rolling back to previous version..."
    rollback_deployment
    exit 1
}

trap 'handle_error $LINENO' ERR

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as medianest user
    if [[ $(whoami) != "medianest" ]]; then
        log_error "This script must be run as the medianest user"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if git is available
    if ! command -v git >/dev/null 2>&1; then
        log_error "Git is not installed"
        exit 1
    fi
    
    # Check if application directory exists
    if [[ ! -d "$APP_DIR" ]]; then
        log_error "Application directory does not exist: $APP_DIR"
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "$APP_DIR/.env" ]]; then
        log_error "Environment file not found: $APP_DIR/.env"
        exit 1
    fi
    
    # Create necessary directories
    mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"
    
    log "Prerequisites check passed"
}

# Backup current deployment
backup_current_deployment() {
    log "Creating backup of current deployment..."
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/deployment_backup_$backup_timestamp.tar.gz"
    
    # Stop application for consistent backup
    docker-compose -f "$APP_DIR/$COMPOSE_FILE" stop app
    
    # Create backup
    tar -czf "$backup_file" \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='.git' \
        -C "$APP_DIR" .
    
    # Restart application
    docker-compose -f "$APP_DIR/$COMPOSE_FILE" start app
    
    # Store backup path for potential rollback
    echo "$backup_file" > /tmp/medianest_last_backup
    
    log "Backup created: $backup_file"
}

# Update application code
update_application() {
    log "Updating application code..."
    
    cd "$APP_DIR"
    
    # Check if it's a git repository
    if [[ -d ".git" ]]; then
        # Fetch latest changes
        git fetch origin
        
        # Check if there are updates
        local current_commit=$(git rev-parse HEAD)
        local latest_commit=$(git rev-parse origin/main)
        
        if [[ "$current_commit" == "$latest_commit" ]]; then
            log_info "No updates available"
            return 0
        fi
        
        log "Updating from $current_commit to $latest_commit"
        
        # Pull latest changes
        git pull origin main
        
        # Log the changes
        git log --oneline "$current_commit..$latest_commit" | tee -a "$LOG_FILE"
    else
        log_warning "Not a git repository, skipping code update"
    fi
}

# Build new Docker images
build_images() {
    log "Building new Docker images..."
    
    cd "$APP_DIR"
    
    # Build images with no cache for production
    docker-compose -f "$COMPOSE_FILE" build --no-cache --pull
    
    log "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$APP_DIR"
    
    # Check if database is accessible
    if ! docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres; then
        log_error "Database is not accessible"
        return 1
    fi
    
    # Run migrations
    docker-compose -f "$COMPOSE_FILE" run --rm app npm run migrate:prod
    
    log "Database migrations completed"
}

# Deploy new version
deploy_new_version() {
    log "Deploying new version..."
    
    cd "$APP_DIR"
    
    # Pull latest images (if using registry)
    # docker-compose -f "$COMPOSE_FILE" pull
    
    # Start services in correct order
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    local retries=30
    while ! docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres; do
        retries=$((retries - 1))
        if [[ $retries -eq 0 ]]; then
            log_error "Database failed to start"
            return 1
        fi
        sleep 2
    done
    
    # Start application
    docker-compose -f "$COMPOSE_FILE" up -d app
    
    # Start nginx
    docker-compose -f "$COMPOSE_FILE" up -d nginx
    
    log "New version deployed"
}

# Health check
perform_health_check() {
    log "Performing health checks..."
    
    local checks=0
    while [[ $checks -lt $MAX_HEALTH_CHECKS ]]; do
        if curl -sf "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi
        
        checks=$((checks + 1))
        log_info "Health check attempt $checks/$MAX_HEALTH_CHECKS failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health checks failed after $MAX_HEALTH_CHECKS attempts"
    return 1
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    if [[ ! -f "/tmp/medianest_last_backup" ]]; then
        log_error "No backup file found for rollback"
        return 1
    fi
    
    local backup_file=$(cat /tmp/medianest_last_backup)
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    cd "$APP_DIR"
    
    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Restore from backup
    tar -xzf "$backup_file" -C "$APP_DIR"
    
    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    sleep 30
    
    if perform_health_check; then
        log "Rollback completed successfully"
    else
        log_error "Rollback health check failed"
        return 1
    fi
}

# Cleanup old backups and images
cleanup() {
    log "Cleaning up old backups and images..."
    
    # Remove backups older than 30 days
    find "$BACKUP_DIR" -name "deployment_backup_*.tar.gz" -mtime +30 -delete
    
    # Remove unused Docker images
    docker image prune -a -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log "Cleanup completed"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    # Email notification (if configured)
    if command -v mail >/dev/null 2>&1 && [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
        echo "$message" | mail -s "MediaNest Deployment $status" "$NOTIFICATION_EMAIL"
    fi
    
    # Webhook notification (if configured)
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"MediaNest Deployment $status: $message\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    cd "$APP_DIR"
    
    # Check all containers are running
    local containers=$(docker-compose -f "$COMPOSE_FILE" ps -q)
    for container in $containers; do
        if [[ $(docker inspect -f '{{.State.Status}}' "$container") != "running" ]]; then
            log_error "Container $container is not running"
            return 1
        fi
    done
    
    # Check application logs for errors
    if docker-compose -f "$COMPOSE_FILE" logs --tail=100 app | grep -i "error\|exception" | grep -v "test"; then
        log_warning "Errors found in application logs"
    fi
    
    # Test API endpoints
    if ! curl -sf "$HEALTH_CHECK_URL/ready" >/dev/null 2>&1; then
        log_error "Readiness check failed"
        return 1
    fi
    
    log "Deployment verification passed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log "Starting MediaNest production deployment"
    log "========================================"
    
    # Load environment variables
    if [[ -f "$APP_DIR/.env" ]]; then
        set -a
        source "$APP_DIR/.env"
        set +a
    fi
    
    # Run deployment steps
    check_prerequisites
    backup_current_deployment
    update_application
    build_images
    run_migrations
    deploy_new_version
    
    # Health check with rollback on failure
    if ! perform_health_check; then
        log_error "Deployment health check failed, rolling back..."
        rollback_deployment
        send_notification "FAILED" "Deployment failed and was rolled back"
        exit 1
    fi
    
    verify_deployment
    cleanup
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "Deployment completed successfully in ${duration}s"
    send_notification "SUCCESS" "Deployment completed successfully in ${duration}s"
    
    # Remove backup reference
    rm -f /tmp/medianest_last_backup
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback_deployment
        ;;
    "health-check")
        perform_health_check
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health-check|cleanup}"
        echo "  deploy      - Full deployment process (default)"
        echo "  rollback    - Rollback to previous version"
        echo "  health-check - Perform health check only"
        echo "  cleanup     - Clean up old backups and images"
        exit 1
        ;;
esac