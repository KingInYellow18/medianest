#!/bin/bash

# MediaNest Production Backup Script
# Performs automated backups of database and application data

set -euo pipefail

# Configuration
BACKUP_BASE_DIR="${BACKUP_PATH:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-medianest-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-medianest-redis}"
APP_CONTAINER="${APP_CONTAINER:-medianest-app}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory
log_info "Creating backup directory: ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"

# Backup PostgreSQL database
backup_postgres() {
    log_info "Starting PostgreSQL backup..."
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running"
        return 1
    fi
    
    # Get database credentials from environment or secrets
    if [ -f "/run/secrets/postgres_password" ]; then
        PGPASSWORD=$(cat /run/secrets/postgres_password)
    else
        PGPASSWORD="${POSTGRES_PASSWORD:-}"
    fi
    
    if [ -z "$PGPASSWORD" ]; then
        log_error "PostgreSQL password not found"
        return 1
    fi
    
    # Perform database dump
    if docker exec -e PGPASSWORD="$PGPASSWORD" "${POSTGRES_CONTAINER}" \
        pg_dump -U medianest -d medianest --no-owner --no-acl \
        | gzip > "${BACKUP_DIR}/postgres_dump.sql.gz"; then
        log_info "PostgreSQL backup completed successfully"
        
        # Get backup size
        SIZE=$(du -h "${BACKUP_DIR}/postgres_dump.sql.gz" | cut -f1)
        log_info "Database backup size: ${SIZE}"
    else
        log_error "PostgreSQL backup failed"
        return 1
    fi
}

# Backup Redis data
backup_redis() {
    log_info "Starting Redis backup..."
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
        log_error "Redis container '${REDIS_CONTAINER}' is not running"
        return 1
    fi
    
    # Get Redis password
    if [ -f "/run/secrets/redis_password" ]; then
        REDIS_PASSWORD=$(cat /run/secrets/redis_password)
    else
        REDIS_PASSWORD="${REDIS_PASSWORD:-}"
    fi
    
    # Trigger Redis BGSAVE
    if [ -n "$REDIS_PASSWORD" ]; then
        docker exec "${REDIS_CONTAINER}" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning BGSAVE
    else
        docker exec "${REDIS_CONTAINER}" redis-cli BGSAVE
    fi
    
    # Wait for BGSAVE to complete
    log_info "Waiting for Redis BGSAVE to complete..."
    sleep 5
    
    # Copy Redis dump file
    if docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${BACKUP_DIR}/redis_dump.rdb"; then
        log_info "Redis backup completed successfully"
        
        # Compress the dump
        gzip "${BACKUP_DIR}/redis_dump.rdb"
        
        # Get backup size
        SIZE=$(du -h "${BACKUP_DIR}/redis_dump.rdb.gz" | cut -f1)
        log_info "Redis backup size: ${SIZE}"
    else
        log_error "Redis backup failed"
        return 1
    fi
}

# Backup application data
backup_app_data() {
    log_info "Starting application data backup..."
    
    # List of directories to backup
    APP_DIRS=(
        "/app/uploads"
        "/app/downloads"
    )
    
    for dir in "${APP_DIRS[@]}"; do
        DIR_NAME=$(basename "$dir")
        log_info "Backing up ${dir}..."
        
        if docker exec "${APP_CONTAINER}" test -d "$dir"; then
            if docker cp "${APP_CONTAINER}:${dir}" "${BACKUP_DIR}/${DIR_NAME}"; then
                # Compress the directory
                tar -czf "${BACKUP_DIR}/${DIR_NAME}.tar.gz" -C "${BACKUP_DIR}" "${DIR_NAME}"
                rm -rf "${BACKUP_DIR}/${DIR_NAME}"
                
                # Get backup size
                SIZE=$(du -h "${BACKUP_DIR}/${DIR_NAME}.tar.gz" | cut -f1)
                log_info "${DIR_NAME} backup size: ${SIZE}"
            else
                log_warning "Failed to backup ${dir}"
            fi
        else
            log_info "Directory ${dir} does not exist, skipping"
        fi
    done
}

# Backup environment configuration
backup_config() {
    log_info "Backing up configuration files..."
    
    # List of configuration files to backup
    CONFIG_FILES=(
        ".env.production"
        "docker-compose.prod.yml"
        "infrastructure/nginx/nginx.conf"
    )
    
    mkdir -p "${BACKUP_DIR}/config"
    
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "${BACKUP_DIR}/config/"
            log_info "Backed up $file"
        else
            log_warning "Configuration file $file not found"
        fi
    done
    
    # Compress config backup
    tar -czf "${BACKUP_DIR}/config.tar.gz" -C "${BACKUP_DIR}" "config"
    rm -rf "${BACKUP_DIR}/config"
}

# Create backup metadata
create_metadata() {
    log_info "Creating backup metadata..."
    
    cat > "${BACKUP_DIR}/backup_info.json" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "$(docker inspect ${APP_CONTAINER} --format='{{.Config.Labels}}' | grep -o 'version:[^ ]*' | cut -d: -f2 || echo 'unknown')",
    "components": {
        "postgres": $(docker inspect ${POSTGRES_CONTAINER} --format='{{json .State.Status}}' 2>/dev/null || echo '"unknown"'),
        "redis": $(docker inspect ${REDIS_CONTAINER} --format='{{json .State.Status}}' 2>/dev/null || echo '"unknown"'),
        "app": $(docker inspect ${APP_CONTAINER} --format='{{json .State.Status}}' 2>/dev/null || echo '"unknown"')
    },
    "files": [
        $(ls -1 ${BACKUP_DIR}/*.gz 2>/dev/null | xargs -I {} basename {} | sed 's/^/        "/' | sed 's/$/",/' | tr '\n' '\n' | sed '$ s/,$//')
    ]
}
EOF
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
    
    find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d -name "[0-9]*_[0-9]*" -mtime +${RETENTION_DAYS} | while read -r old_backup; do
        log_info "Removing old backup: $(basename "$old_backup")"
        rm -rf "$old_backup"
    done
}

# Create symlink to latest backup
create_latest_symlink() {
    log_info "Creating 'latest' symlink..."
    
    cd "${BACKUP_BASE_DIR}"
    rm -f latest
    ln -s "${TIMESTAMP}" latest
}

# Calculate total backup size
calculate_total_size() {
    TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
    log_info "Total backup size: ${TOTAL_SIZE}"
}

# Main backup process
main() {
    log_info "Starting MediaNest backup process..."
    
    # Check if running in Docker
    if [ -f /.dockerenv ]; then
        log_info "Running inside Docker container"
    fi
    
    # Perform backups
    BACKUP_SUCCESS=true
    
    backup_postgres || BACKUP_SUCCESS=false
    backup_redis || BACKUP_SUCCESS=false
    backup_app_data || BACKUP_SUCCESS=false
    backup_config || BACKUP_SUCCESS=false
    
    # Create metadata
    create_metadata
    
    # Calculate total size
    calculate_total_size
    
    # Create latest symlink
    create_latest_symlink
    
    # Clean old backups
    cleanup_old_backups
    
    if [ "$BACKUP_SUCCESS" = true ]; then
        log_info "Backup completed successfully at: ${BACKUP_DIR}"
        
        # Optional: Send notification
        if [ -n "${BACKUP_NOTIFICATION_URL:-}" ]; then
            curl -s -X POST "${BACKUP_NOTIFICATION_URL}" \
                -H "Content-Type: application/json" \
                -d "{\"text\":\"MediaNest backup completed successfully\",\"backup_dir\":\"${BACKUP_DIR}\",\"size\":\"${TOTAL_SIZE}\"}" || true
        fi
        
        exit 0
    else
        log_error "Backup completed with errors"
        
        # Optional: Send error notification
        if [ -n "${BACKUP_NOTIFICATION_URL:-}" ]; then
            curl -s -X POST "${BACKUP_NOTIFICATION_URL}" \
                -H "Content-Type: application/json" \
                -d "{\"text\":\"MediaNest backup completed with errors\",\"backup_dir\":\"${BACKUP_DIR}\"}" || true
        fi
        
        exit 1
    fi
}

# Run main function
main "$@"