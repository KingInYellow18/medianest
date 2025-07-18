#!/bin/bash

# MediaNest Backup Restore Script
# Restores database and application data from backup

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_BASE_DIR="${BACKUP_PATH:-/backups}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-medianest-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-medianest-redis}"
APP_CONTAINER="${APP_CONTAINER:-medianest-app}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Function to list available backups
list_backups() {
    log_info "Available backups:"
    echo
    
    if [ -d "$BACKUP_BASE_DIR" ]; then
        find "$BACKUP_BASE_DIR" -maxdepth 1 -type d -name "[0-9]*_[0-9]*" | sort -r | while read -r backup; do
            local backup_name=$(basename "$backup")
            local backup_info="$backup/backup_info.json"
            
            if [ -f "$backup_info" ]; then
                local date=$(jq -r '.date' "$backup_info" 2>/dev/null || echo "Unknown")
                local size=$(du -sh "$backup" | cut -f1)
                echo "  $backup_name - $date - Size: $size"
            else
                echo "  $backup_name - No metadata available"
            fi
        done
        
        if [ -L "$BACKUP_BASE_DIR/latest" ]; then
            echo
            echo "  Latest backup: $(readlink "$BACKUP_BASE_DIR/latest")"
        fi
    else
        log_error "Backup directory not found: $BACKUP_BASE_DIR"
        exit 1
    fi
    echo
}

# Function to select backup
select_backup() {
    local backup_dir=""
    
    if [ -n "${1:-}" ]; then
        # Backup specified as argument
        if [ -d "$BACKUP_BASE_DIR/$1" ]; then
            backup_dir="$BACKUP_BASE_DIR/$1"
        else
            log_error "Backup not found: $1"
            exit 1
        fi
    else
        # Use latest backup
        if [ -L "$BACKUP_BASE_DIR/latest" ]; then
            backup_dir="$BACKUP_BASE_DIR/$(readlink "$BACKUP_BASE_DIR/latest")"
            log_info "Using latest backup: $(basename "$backup_dir")"
        else
            log_error "No latest backup found. Please specify a backup directory."
            list_backups
            exit 1
        fi
    fi
    
    echo "$backup_dir"
}

# Function to confirm restore
confirm_restore() {
    local backup_dir="$1"
    
    log_warning "This will restore data from backup: $(basename "$backup_dir")"
    log_warning "Current data will be OVERWRITTEN!"
    echo
    
    # Show backup details
    if [ -f "$backup_dir/backup_info.json" ]; then
        log_info "Backup details:"
        jq . "$backup_dir/backup_info.json" 2>/dev/null || cat "$backup_dir/backup_info.json"
        echo
    fi
    
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Function to stop services
stop_services() {
    log_info "Stopping services..."
    
    # Stop app container first
    if docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER}$"; then
        docker stop "$APP_CONTAINER" || true
        log_info "Stopped $APP_CONTAINER"
    fi
    
    # Wait for connections to close
    sleep 5
}

# Function to restore PostgreSQL database
restore_postgres() {
    local backup_file="$1/postgres_dump.sql.gz"
    
    if [ ! -f "$backup_file" ]; then
        log_warning "PostgreSQL backup not found, skipping"
        return
    fi
    
    log_info "Restoring PostgreSQL database..."
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        log_error "PostgreSQL container is not running"
        return 1
    fi
    
    # Get database credentials
    if [ -f "/run/secrets/postgres_password" ]; then
        PGPASSWORD=$(cat /run/secrets/postgres_password)
    else
        PGPASSWORD="${POSTGRES_PASSWORD:-}"
    fi
    
    if [ -z "$PGPASSWORD" ]; then
        log_error "PostgreSQL password not found"
        return 1
    fi
    
    # Drop existing connections
    docker exec -e PGPASSWORD="$PGPASSWORD" "$POSTGRES_CONTAINER" \
        psql -U medianest -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'medianest' AND pid <> pg_backend_pid();" || true
    
    # Drop and recreate database
    log_info "Recreating database..."
    docker exec -e PGPASSWORD="$PGPASSWORD" "$POSTGRES_CONTAINER" \
        psql -U medianest -d postgres -c "DROP DATABASE IF EXISTS medianest;" || true
    
    docker exec -e PGPASSWORD="$PGPASSWORD" "$POSTGRES_CONTAINER" \
        psql -U medianest -d postgres -c "CREATE DATABASE medianest WITH ENCODING 'UTF8';"
    
    # Restore database
    log_info "Importing database dump..."
    gunzip -c "$backup_file" | docker exec -i -e PGPASSWORD="$PGPASSWORD" "$POSTGRES_CONTAINER" \
        psql -U medianest -d medianest
    
    if [ $? -eq 0 ]; then
        log_success "PostgreSQL database restored successfully"
        
        # Run ANALYZE to update statistics
        docker exec -e PGPASSWORD="$PGPASSWORD" "$POSTGRES_CONTAINER" \
            psql -U medianest -d medianest -c "ANALYZE;"
    else
        log_error "PostgreSQL restore failed"
        return 1
    fi
}

# Function to restore Redis data
restore_redis() {
    local backup_file="$1/redis_dump.rdb.gz"
    
    if [ ! -f "$backup_file" ]; then
        log_warning "Redis backup not found, skipping"
        return
    fi
    
    log_info "Restoring Redis data..."
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
        log_error "Redis container is not running"
        return 1
    fi
    
    # Get Redis password
    if [ -f "/run/secrets/redis_password" ]; then
        REDIS_PASSWORD=$(cat /run/secrets/redis_password)
    else
        REDIS_PASSWORD="${REDIS_PASSWORD:-}"
    fi
    
    # Stop Redis persistence temporarily
    if [ -n "$REDIS_PASSWORD" ]; then
        docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG SET save ""
        docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning FLUSHALL
    else
        docker exec "$REDIS_CONTAINER" redis-cli CONFIG SET save ""
        docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL
    fi
    
    # Copy and restore dump file
    gunzip -c "$backup_file" > /tmp/redis_restore.rdb
    docker cp /tmp/redis_restore.rdb "$REDIS_CONTAINER:/data/dump.rdb"
    rm -f /tmp/redis_restore.rdb
    
    # Restart Redis to load the dump
    docker restart "$REDIS_CONTAINER"
    sleep 5
    
    log_success "Redis data restored successfully"
}

# Function to restore application data
restore_app_data() {
    local backup_dir="$1"
    
    log_info "Restoring application data..."
    
    # List of data archives to restore
    local data_files=(
        "uploads.tar.gz"
        "downloads.tar.gz"
    )
    
    for archive in "${data_files[@]}"; do
        if [ -f "$backup_dir/$archive" ]; then
            local dir_name="${archive%.tar.gz}"
            log_info "Restoring $dir_name..."
            
            # Create temporary directory
            local temp_dir="/tmp/restore_$$"
            mkdir -p "$temp_dir"
            
            # Extract archive
            tar -xzf "$backup_dir/$archive" -C "$temp_dir"
            
            # Copy to container
            if docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER}$"; then
                docker cp "$temp_dir/$dir_name/." "$APP_CONTAINER:/app/$dir_name/"
                log_success "Restored $dir_name"
            else
                log_warning "App container not running, skipping $dir_name"
            fi
            
            # Clean up
            rm -rf "$temp_dir"
        else
            log_info "No backup found for ${archive%.tar.gz}, skipping"
        fi
    done
}

# Function to restore configuration
restore_config() {
    local backup_dir="$1"
    local config_archive="$backup_dir/config.tar.gz"
    
    if [ ! -f "$config_archive" ]; then
        log_warning "Configuration backup not found, skipping"
        return
    fi
    
    log_info "Restoring configuration files..."
    
    # Create temporary directory
    local temp_dir="/tmp/restore_config_$$"
    mkdir -p "$temp_dir"
    
    # Extract configuration
    tar -xzf "$config_archive" -C "$temp_dir"
    
    # Show restored files
    log_info "Configuration files in backup:"
    find "$temp_dir/config" -type f -exec basename {} \; | sort
    
    echo
    read -p "Do you want to restore configuration files? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        # Copy configuration files
        cp -i "$temp_dir/config/"* . 2>/dev/null || true
        log_success "Configuration files restored"
    else
        log_info "Configuration restore skipped"
    fi
    
    # Clean up
    rm -rf "$temp_dir"
}

# Function to start services
start_services() {
    log_info "Starting services..."
    
    # Start app container
    docker start "$APP_CONTAINER" || docker-compose -f docker-compose.prod.yml up -d app
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check health
    if curl -s -f http://localhost:4000/api/health > /dev/null 2>&1; then
        log_success "Services started successfully"
    else
        log_warning "Services may not be fully ready yet"
    fi
}

# Function to verify restore
verify_restore() {
    log_info "Verifying restore..."
    
    # Check database connection
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U medianest > /dev/null 2>&1; then
        log_success "PostgreSQL is responding"
        
        # Get table count
        local table_count=$(docker exec "$POSTGRES_CONTAINER" psql -U medianest -d medianest -t -c \
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
        log_info "Database has $table_count tables"
    else
        log_warning "PostgreSQL verification failed"
    fi
    
    # Check Redis
    if docker exec "$REDIS_CONTAINER" redis-cli ping > /dev/null 2>&1; then
        log_success "Redis is responding"
    else
        log_warning "Redis verification failed"
    fi
    
    # Check application
    if curl -s -f http://localhost:4000/api/health > /dev/null 2>&1; then
        log_success "Application API is responding"
    else
        log_warning "Application API verification failed"
    fi
}

# Main restore process
main() {
    log_info "MediaNest Backup Restore Script"
    log_info "==============================="
    echo
    
    # Check if running with appropriate permissions
    if [ "$EUID" -ne 0 ] && [ ! -w "/var/run/docker.sock" ]; then
        log_warning "This script may need sudo privileges for some operations"
    fi
    
    # List available backups
    list_backups
    
    # Select backup
    BACKUP_DIR=$(select_backup "${1:-}")
    
    # Confirm restore
    confirm_restore "$BACKUP_DIR"
    
    # Create restore log
    RESTORE_LOG="./logs/restore_$(date +%Y%m%d_%H%M%S).log"
    mkdir -p ./logs
    
    log_info "Starting restore from: $(basename "$BACKUP_DIR")"
    log_info "Restore log: $RESTORE_LOG"
    echo
    
    # Stop services
    stop_services
    
    # Perform restore
    {
        restore_postgres "$BACKUP_DIR"
        restore_redis "$BACKUP_DIR"
        restore_app_data "$BACKUP_DIR"
        restore_config "$BACKUP_DIR"
    } 2>&1 | tee -a "$RESTORE_LOG"
    
    # Start services
    start_services
    
    # Verify restore
    verify_restore
    
    echo
    log_success "Restore completed!"
    log_info "Please verify that all services are working correctly"
    log_info "Restore log saved to: $RESTORE_LOG"
    
    # Post-restore recommendations
    echo
    log_info "Post-restore checklist:"
    echo "1. Test user authentication"
    echo "2. Verify media library access"
    echo "3. Check service integrations"
    echo "4. Review application logs for errors"
    echo "5. Run a new backup once verified"
}

# Run main function
main "$@"