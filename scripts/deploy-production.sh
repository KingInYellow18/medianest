#!/bin/bash
# MediaNest Production Deployment Script
# Handles the complete production deployment process

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# Default values
ACTION=${1:-help}
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "${ENV_FILE}" ]]; then
        print_error "Environment file ${ENV_FILE} not found"
        print_status "Copy .env.production to .env and update with your values"
        exit 1
    fi
    
    # Check secrets directory
    if [[ ! -d "./secrets" ]]; then
        print_error "Secrets directory not found"
        print_status "Run ./scripts/setup-secrets.sh first"
        exit 1
    fi
    
    # Check required directories
    for dir in data logs backups; do
        if [[ ! -d "./${dir}" ]]; then
            print_status "Creating ${dir} directory..."
            mkdir -p "./${dir}"
        fi
    done
    
    print_success "Prerequisites check passed"
}

# Function to create required directories
create_directories() {
    print_status "Creating required directories..."
    
    # Load environment variables
    source "${ENV_FILE}"
    
    # Create data directories
    for dir in postgres redis downloads uploads certbot ssl; do
        mkdir -p "${DATA_PATH:-./data}/${dir}"
    done
    
    # Create log directories
    for dir in backend frontend nginx certbot; do
        mkdir -p "${LOG_PATH:-./logs}/${dir}"
    done
    
    # Create backup directories
    for dir in postgres redis; do
        mkdir -p "${BACKUP_PATH:-./backups}/${dir}"
    done
    
    print_success "Directories created"
}

# Function to deploy the stack
deploy() {
    check_prerequisites
    create_directories
    
    print_status "Deploying MediaNest production stack..."
    
    # Pull latest images
    print_status "Pulling Docker images..."
    docker compose -f "${COMPOSE_FILE}" pull
    
    # Start services
    print_status "Starting services..."
    docker compose -f "${COMPOSE_FILE}" up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 10
    
    # Check service health
    docker compose -f "${COMPOSE_FILE}" ps
    
    print_success "Deployment complete!"
}

# Function to stop the stack
stop() {
    print_status "Stopping MediaNest production stack..."
    docker compose -f "${COMPOSE_FILE}" down
    print_success "Services stopped"
}

# Function to restart the stack
restart() {
    print_status "Restarting MediaNest production stack..."
    docker compose -f "${COMPOSE_FILE}" restart
    print_success "Services restarted"
}

# Function to show logs
logs() {
    local service=${2:-}
    if [[ -n "${service}" ]]; then
        docker compose -f "${COMPOSE_FILE}" logs -f "${service}"
    else
        docker compose -f "${COMPOSE_FILE}" logs -f
    fi
}

# Function to show status
status() {
    print_status "MediaNest service status:"
    docker compose -f "${COMPOSE_FILE}" ps
}

# Function to backup
backup() {
    print_status "Running backup..."
    docker compose -f "${COMPOSE_FILE}" --profile backup run --rm backup /backup.sh
    print_success "Backup complete"
}

# Function to update
update() {
    print_status "Updating MediaNest..."
    
    # Pull latest images
    print_status "Pulling latest images..."
    docker compose -f "${COMPOSE_FILE}" pull
    
    # Recreate containers with new images
    print_status "Recreating containers..."
    docker compose -f "${COMPOSE_FILE}" up -d --force-recreate
    
    # Clean up old images
    print_status "Cleaning up old images..."
    docker image prune -f
    
    print_success "Update complete"
}

# Function to run database migrations
migrate() {
    print_status "Running database migrations..."
    docker compose -f "${COMPOSE_FILE}" exec backend npx prisma migrate deploy
    print_success "Migrations complete"
}

# Function to show help
show_help() {
    echo "MediaNest Production Deployment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy    - Deploy the production stack"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  status    - Show service status"
    echo "  logs      - Show logs (optionally specify service)"
    echo "  backup    - Run database backup"
    echo "  update    - Update to latest images"
    echo "  migrate   - Run database migrations"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 logs backend"
    echo "  $0 status"
}

# Main script logic
case "${ACTION}" in
    deploy)
        deploy
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$@"
        ;;
    backup)
        backup
        ;;
    update)
        update
        ;;
    migrate)
        migrate
        ;;
    help|*)
        show_help
        ;;
esac