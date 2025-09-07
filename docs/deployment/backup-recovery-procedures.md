# Backup and Recovery Procedures

Comprehensive guide for MediaNest backup strategies, automated procedures, disaster recovery, and data protection.

## Table of Contents

- [Backup Strategy](#backup-strategy)
- [Automated Backup System](#automated-backup-system)
- [Manual Backup Procedures](#manual-backup-procedures)
- [Recovery Procedures](#recovery-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Data Verification](#data-verification)
- [Backup Monitoring](#backup-monitoring)
- [Cloud Backup Integration](#cloud-backup-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Backup Strategy

### Backup Components

MediaNest requires backing up multiple components:

1. **Database (PostgreSQL)**
   - User data, media metadata, settings
   - Application configuration
   - User preferences and history

2. **Cache (Redis)**
   - Session data
   - Cached API responses
   - Real-time data

3. **Application Data**
   - Uploaded files and images
   - Downloaded media files
   - User-generated content

4. **Configuration Files**
   - Environment variables (without secrets)
   - Service configurations
   - SSL certificates

5. **Secrets**
   - API keys and tokens
   - Database credentials
   - Encryption keys

### Backup Types

#### Full Backups

- Complete system backup including all components
- Recommended frequency: Daily
- Retention: 7 daily backups

#### Incremental Backups

- Only changed data since last backup
- Recommended frequency: Every 6 hours
- Retention: 48 hours

#### Differential Backups

- Changes since last full backup
- Recommended frequency: Every 2 hours
- Retention: 24 hours

### Backup Schedule

```
Daily    00:00 UTC - Full backup
         06:00 UTC - Incremental backup
         12:00 UTC - Differential backup
         18:00 UTC - Incremental backup

Weekly   Sunday 01:00 UTC - Full backup with extended retention
Monthly  1st Sunday 02:00 UTC - Archive backup
```

## Automated Backup System

### Docker Compose Backup Service

```yaml
# docker-compose.backup.yml
version: '3.8'

services:
  backup:
    image: postgres:15-alpine
    container_name: medianest-backup
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
      - BACKUP_PATH=/backups
      - BACKUP_RETENTION_DAYS=7
      - POSTGRES_CONTAINER=medianest-postgres
      - REDIS_CONTAINER=medianest-redis
      - APP_CONTAINER=medianest-backend
      - BACKUP_NOTIFICATION_URL=${BACKUP_WEBHOOK_URL}
    volumes:
      - ./backups:/backups
      - ./scripts/backup.sh:/backup.sh:ro
      - ./scripts/restore-backup.sh:/restore-backup.sh:ro
      - /var/run/docker.sock:/var/run/docker.sock
    secrets:
      - postgres_password
      - redis_password
    networks:
      - backend-network
    restart: 'no'
    profiles:
      - backup
    command: |
      sh -c "
        echo 'Backup service ready'
        echo 'Manual backup: docker-compose run --rm backup /backup.sh'
        echo 'Restore backup: docker-compose run --rm backup /restore-backup.sh BACKUP_DIR'
        tail -f /dev/null
      "

  # Scheduled backup using cron
  backup-scheduler:
    image: alpine:latest
    container_name: medianest-backup-scheduler
    environment:
      - BACKUP_CONTAINER=medianest-backup
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./scripts/schedule-backups.sh:/schedule-backups.sh:ro
    command: |
      sh -c "
        apk add --no-cache docker-cli
        echo '0 0 * * * /schedule-backups.sh full' > /etc/crontabs/root
        echo '0 */6 * * * /schedule-backups.sh incremental' >> /etc/crontabs/root
        echo '0 */2 * * * /schedule-backups.sh differential' >> /etc/crontabs/root
        crond -f -l 2
      "
    profiles:
      - backup-scheduler
    restart: unless-stopped
```

### Enhanced Backup Script

The existing `scripts/backup.sh` provides comprehensive backup functionality. Here's an enhanced version:

```bash
#!/bin/bash
# Enhanced MediaNest Backup Script

set -euo pipefail

# Configuration
BACKUP_BASE_DIR="${BACKUP_PATH:-/backups}"
BACKUP_TYPE="${BACKUP_TYPE:-full}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE_DIR}/${BACKUP_TYPE}_${TIMESTAMP}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
INCREMENTAL_BASE="${BACKUP_BASE_DIR}/latest_full"

# Service containers
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-medianest-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-medianest-redis}"
APP_CONTAINER="${APP_CONTAINER:-medianest-backend}"

# Colors and logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO $(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS $(date '+%H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING $(date '+%H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR $(date '+%H:%M:%S')]${NC} $1" >&2
}

# Create backup directory
create_backup_directory() {
    log_info "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"

    # Create backup info file
    cat > "${BACKUP_DIR}/backup_info.json" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "type": "${BACKUP_TYPE}",
    "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "retention_days": ${RETENTION_DAYS},
    "components": {}
}
EOF
}

# Backup PostgreSQL with different strategies
backup_postgres() {
    log_info "Starting PostgreSQL ${BACKUP_TYPE} backup..."

    if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running"
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

    case $BACKUP_TYPE in
        "full")
            backup_postgres_full
            ;;
        "incremental")
            backup_postgres_incremental
            ;;
        "differential")
            backup_postgres_differential
            ;;
        *)
            log_error "Unknown backup type: $BACKUP_TYPE"
            return 1
            ;;
    esac
}

backup_postgres_full() {
    log_info "Performing full PostgreSQL backup..."

    # Full database dump
    if docker exec -e PGPASSWORD="$PGPASSWORD" "${POSTGRES_CONTAINER}" \
        pg_dump -U medianest -d medianest \
        --no-owner --no-acl --verbose \
        --format=custom --compress=9 \
        > "${BACKUP_DIR}/postgres_full.dump"; then

        log_success "PostgreSQL full backup completed"

        # Update latest full backup symlink
        cd "${BACKUP_BASE_DIR}"
        rm -f latest_full
        ln -s "${BACKUP_TYPE}_${TIMESTAMP}" latest_full

        # Backup WAL files for point-in-time recovery
        backup_postgres_wal
    else
        log_error "PostgreSQL full backup failed"
        return 1
    fi
}

backup_postgres_incremental() {
    if [ ! -d "$INCREMENTAL_BASE" ]; then
        log_warning "No full backup found, performing full backup instead"
        BACKUP_TYPE="full"
        backup_postgres_full
        return $?
    fi

    log_info "Performing incremental PostgreSQL backup..."

    # Create incremental backup based on last full backup
    if docker exec -e PGPASSWORD="$PGPASSWORD" "${POSTGRES_CONTAINER}" \
        pg_basebackup -U medianest -D /tmp/incremental_backup \
        --checkpoint=fast --wal-method=stream --format=tar --compress=9; then

        # Copy incremental backup
        docker cp "${POSTGRES_CONTAINER}:/tmp/incremental_backup" "${BACKUP_DIR}/postgres_incremental"

        # Cleanup container temp files
        docker exec "${POSTGRES_CONTAINER}" rm -rf /tmp/incremental_backup

        log_success "PostgreSQL incremental backup completed"
    else
        log_error "PostgreSQL incremental backup failed"
        return 1
    fi
}

backup_postgres_differential() {
    if [ ! -d "$INCREMENTAL_BASE" ]; then
        log_warning "No full backup found, performing full backup instead"
        BACKUP_TYPE="full"
        backup_postgres_full
        return $?
    fi

    log_info "Performing differential PostgreSQL backup..."

    # Get LSN from last full backup
    LAST_LSN=$(cat "${INCREMENTAL_BASE}/postgres_lsn.txt" 2>/dev/null || echo "")

    if [ -z "$LAST_LSN" ]; then
        log_warning "Cannot determine last LSN, performing full backup"
        BACKUP_TYPE="full"
        backup_postgres_full
        return $?
    fi

    # Differential backup using pg_waldump
    docker exec -e PGPASSWORD="$PGPASSWORD" "${POSTGRES_CONTAINER}" \
        sh -c "pg_waldump --start=$LAST_LSN --stats=record > /tmp/differential.sql"

    if docker cp "${POSTGRES_CONTAINER}:/tmp/differential.sql" "${BACKUP_DIR}/postgres_differential.sql"; then
        log_success "PostgreSQL differential backup completed"
    else
        log_error "PostgreSQL differential backup failed"
        return 1
    fi
}

backup_postgres_wal() {
    log_info "Backing up PostgreSQL WAL files..."

    # Archive WAL files for point-in-time recovery
    docker exec "${POSTGRES_CONTAINER}" \
        find /var/lib/postgresql/data/pg_wal -name "*.backup" -o -name "00*" | \
        head -10 | \
        while read wal_file; do
            docker cp "${POSTGRES_CONTAINER}:${wal_file}" "${BACKUP_DIR}/"
        done

    # Get current LSN for future incremental backups
    docker exec -e PGPASSWORD="$PGPASSWORD" "${POSTGRES_CONTAINER}" \
        psql -U medianest -d medianest -t -c "SELECT pg_current_wal_lsn();" | \
        tr -d ' ' > "${BACKUP_DIR}/postgres_lsn.txt"
}

# Backup Redis with RDB and AOF
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

    # Trigger BGSAVE for RDB
    if [ -n "$REDIS_PASSWORD" ]; then
        docker exec "${REDIS_CONTAINER}" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning BGSAVE
    else
        docker exec "${REDIS_CONTAINER}" redis-cli BGSAVE
    fi

    # Wait for BGSAVE to complete
    log_info "Waiting for Redis BGSAVE to complete..."
    sleep 10

    # Check BGSAVE status
    local save_status
    if [ -n "$REDIS_PASSWORD" ]; then
        save_status=$(docker exec "${REDIS_CONTAINER}" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)
    else
        save_status=$(docker exec "${REDIS_CONTAINER}" redis-cli LASTSAVE)
    fi

    # Copy RDB file
    if docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${BACKUP_DIR}/redis_dump.rdb"; then
        gzip "${BACKUP_DIR}/redis_dump.rdb"
        log_success "Redis RDB backup completed"
    else
        log_error "Redis RDB backup failed"
        return 1
    fi

    # Backup AOF file if it exists
    if docker exec "${REDIS_CONTAINER}" test -f /data/appendonly.aof; then
        if docker cp "${REDIS_CONTAINER}:/data/appendonly.aof" "${BACKUP_DIR}/redis_appendonly.aof"; then
            gzip "${BACKUP_DIR}/redis_appendonly.aof"
            log_success "Redis AOF backup completed"
        else
            log_warning "Redis AOF backup failed"
        fi
    fi
}

# Backup application data with rsync for incrementals
backup_app_data() {
    log_info "Starting application data backup..."

    local app_dirs=("/app/uploads" "/app/downloads")

    for dir in "${app_dirs[@]}"; do
        local dir_name=$(basename "$dir")
        log_info "Backing up ${dir}..."

        if docker exec "${APP_CONTAINER}" test -d "$dir"; then
            case $BACKUP_TYPE in
                "full")
                    backup_app_data_full "$dir" "$dir_name"
                    ;;
                "incremental"|"differential")
                    backup_app_data_incremental "$dir" "$dir_name"
                    ;;
            esac
        else
            log_info "Directory ${dir} does not exist, skipping"
        fi
    done
}

backup_app_data_full() {
    local source_dir="$1"
    local target_name="$2"

    if docker cp "${APP_CONTAINER}:${source_dir}" "${BACKUP_DIR}/${target_name}"; then
        tar -czf "${BACKUP_DIR}/${target_name}.tar.gz" -C "${BACKUP_DIR}" "${target_name}"
        rm -rf "${BACKUP_DIR}/${target_name}"

        local size=$(du -h "${BACKUP_DIR}/${target_name}.tar.gz" | cut -f1)
        log_success "${target_name} full backup completed (${size})"
    else
        log_warning "Failed to backup ${source_dir}"
    fi
}

backup_app_data_incremental() {
    local source_dir="$1"
    local target_name="$2"

    if [ ! -d "${INCREMENTAL_BASE}" ]; then
        log_warning "No full backup found, performing full backup of ${target_name}"
        backup_app_data_full "$source_dir" "$target_name"
        return
    fi

    # Create incremental backup using rsync
    mkdir -p "${BACKUP_DIR}/${target_name}_incremental"

    # Use find to get files modified since last full backup
    local last_full_time=$(stat -c %Y "${INCREMENTAL_BASE}")

    docker exec "${APP_CONTAINER}" \
        find "${source_dir}" -newer "${INCREMENTAL_BASE}/backup_info.json" -type f \
        > "${BACKUP_DIR}/${target_name}_files.list"

    if [ -s "${BACKUP_DIR}/${target_name}_files.list" ]; then
        while read -r file; do
            local rel_path=$(echo "$file" | sed "s|${source_dir}/||")
            local target_file="${BACKUP_DIR}/${target_name}_incremental/${rel_path}"
            mkdir -p "$(dirname "$target_file")"
            docker cp "${APP_CONTAINER}:${file}" "$target_file"
        done < "${BACKUP_DIR}/${target_name}_files.list"

        tar -czf "${BACKUP_DIR}/${target_name}_incremental.tar.gz" -C "${BACKUP_DIR}" "${target_name}_incremental"
        rm -rf "${BACKUP_DIR}/${target_name}_incremental"

        local size=$(du -h "${BACKUP_DIR}/${target_name}_incremental.tar.gz" | cut -f1)
        log_success "${target_name} incremental backup completed (${size})"
    else
        log_info "No changes in ${target_name} since last backup"
        echo "no changes" > "${BACKUP_DIR}/${target_name}_no_changes.txt"
    fi
}

# Backup configuration and secrets
backup_configuration() {
    log_info "Backing up configuration files..."

    local config_files=(
        ".env.production"
        "docker-compose.prod.yml"
        "infrastructure/nginx/nginx.conf"
        "monitoring/prometheus/prometheus.yml"
    )

    mkdir -p "${BACKUP_DIR}/config"

    for file in "${config_files[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "${BACKUP_DIR}/config/"
            log_info "Backed up $file"
        else
            log_warning "Configuration file $file not found"
        fi
    done

    # Backup secrets structure (not content) for restoration
    if [ -d "secrets" ]; then
        ls secrets/ > "${BACKUP_DIR}/config/secrets_list.txt"
        log_info "Backed up secrets list"
    fi

    # Backup SSL certificates
    if [ -d "infrastructure/nginx/ssl" ]; then
        cp -r infrastructure/nginx/ssl "${BACKUP_DIR}/config/"
        log_info "Backed up SSL certificates"
    fi

    tar -czf "${BACKUP_DIR}/config.tar.gz" -C "${BACKUP_DIR}" "config"
    rm -rf "${BACKUP_DIR}/config"

    log_success "Configuration backup completed"
}

# Enhanced backup verification
verify_backup() {
    log_info "Verifying backup integrity..."

    local verification_results="${BACKUP_DIR}/verification.log"
    local backup_valid=true

    # Test PostgreSQL backup
    if [ -f "${BACKUP_DIR}/postgres_full.dump" ]; then
        if file "${BACKUP_DIR}/postgres_full.dump" | grep -q "PostgreSQL custom"; then
            echo "✓ PostgreSQL backup format valid" >> "$verification_results"
        else
            echo "✗ PostgreSQL backup format invalid" >> "$verification_results"
            backup_valid=false
        fi
    fi

    # Test compressed files
    for gz_file in "${BACKUP_DIR}"/*.gz; do
        if [ -f "$gz_file" ]; then
            if gzip -t "$gz_file"; then
                echo "✓ $(basename "$gz_file") compression valid" >> "$verification_results"
            else
                echo "✗ $(basename "$gz_file") compression corrupted" >> "$verification_results"
                backup_valid=false
            fi
        fi
    done

    # Verify backup completeness
    local expected_files=("backup_info.json")
    case $BACKUP_TYPE in
        "full")
            expected_files+=("postgres_full.dump" "redis_dump.rdb.gz" "config.tar.gz")
            ;;
        "incremental"|"differential")
            if [ -f "${BACKUP_DIR}/postgres_incremental" ] || [ -f "${BACKUP_DIR}/postgres_differential.sql" ]; then
                expected_files+=("redis_dump.rdb.gz")
            fi
            ;;
    esac

    for expected_file in "${expected_files[@]}"; do
        if [ -f "${BACKUP_DIR}/${expected_file}" ]; then
            echo "✓ Required file ${expected_file} present" >> "$verification_results"
        else
            echo "✗ Required file ${expected_file} missing" >> "$verification_results"
            backup_valid=false
        fi
    done

    if [ "$backup_valid" = true ]; then
        log_success "Backup verification passed"
        echo "VERIFICATION: PASSED" >> "$verification_results"
    else
        log_error "Backup verification failed"
        echo "VERIFICATION: FAILED" >> "$verification_results"
        return 1
    fi
}

# Update backup metadata
update_backup_metadata() {
    log_info "Updating backup metadata..."

    local total_size=$(du -sh "${BACKUP_DIR}" | cut -f1)
    local file_count=$(find "${BACKUP_DIR}" -type f | wc -l)

    # Update backup info with results
    jq --arg size "$total_size" \
       --arg count "$file_count" \
       --arg status "completed" \
       '.total_size = $size | .file_count = ($count | tonumber) | .status = $status' \
       "${BACKUP_DIR}/backup_info.json" > "${BACKUP_DIR}/backup_info.json.tmp"

    mv "${BACKUP_DIR}/backup_info.json.tmp" "${BACKUP_DIR}/backup_info.json"

    log_info "Backup completed: ${total_size} in ${file_count} files"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."

    local removed_count=0

    find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d -name "*_[0-9]*_[0-9]*" -mtime +${RETENTION_DAYS} | \
    while read -r old_backup; do
        local backup_name=$(basename "$old_backup")
        log_info "Removing old backup: ${backup_name}"
        rm -rf "$old_backup"
        removed_count=$((removed_count + 1))
    done

    if [ $removed_count -gt 0 ]; then
        log_success "Removed ${removed_count} old backups"
    else
        log_info "No old backups to remove"
    fi
}

# Send notifications
send_notification() {
    local status="$1"
    local message="$2"

    if [ -n "${BACKUP_NOTIFICATION_URL:-}" ]; then
        local payload=$(jq -n \
            --arg status "$status" \
            --arg message "$message" \
            --arg backup_dir "$BACKUP_DIR" \
            --arg timestamp "$TIMESTAMP" \
            '{
                status: $status,
                message: $message,
                backup_directory: $backup_dir,
                timestamp: $timestamp,
                type: env.BACKUP_TYPE
            }')

        curl -s -X POST "${BACKUP_NOTIFICATION_URL}" \
            -H "Content-Type: application/json" \
            -d "$payload" > /dev/null || true
    fi
}

# Main backup execution
main() {
    log_info "Starting MediaNest ${BACKUP_TYPE} backup process..."

    local start_time=$(date +%s)
    local backup_success=true

    # Create backup directory
    create_backup_directory

    # Perform backups
    backup_postgres || backup_success=false
    backup_redis || backup_success=false
    backup_app_data || backup_success=false
    backup_configuration || backup_success=false

    # Verify backup
    verify_backup || backup_success=false

    # Update metadata
    update_backup_metadata

    # Cleanup old backups
    cleanup_old_backups

    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [ "$backup_success" = true ]; then
        log_success "Backup completed successfully in ${duration}s"
        log_success "Backup location: ${BACKUP_DIR}"
        send_notification "success" "Backup completed successfully in ${duration}s"
        exit 0
    else
        log_error "Backup completed with errors in ${duration}s"
        send_notification "error" "Backup completed with errors in ${duration}s"
        exit 1
    fi
}

# Run main function
main "$@"
```

### Backup Scheduling

```bash
#!/bin/bash
# scripts/schedule-backups.sh
BACKUP_TYPE="${1:-full}"
COMPOSE_FILE="docker-compose.yml"

case $BACKUP_TYPE in
    "full")
        docker-compose -f $COMPOSE_FILE run --rm backup /backup.sh
        ;;
    "incremental")
        BACKUP_TYPE=incremental docker-compose -f $COMPOSE_FILE run --rm backup /backup.sh
        ;;
    "differential")
        BACKUP_TYPE=differential docker-compose -f $COMPOSE_FILE run --rm backup /backup.sh
        ;;
    *)
        echo "Usage: $0 {full|incremental|differential}"
        exit 1
        ;;
esac
```

## Manual Backup Procedures

### Quick Backup Commands

```bash
# Full manual backup
docker-compose -f docker-compose.yml --profile backup run --rm backup

# Database only backup
docker-compose exec postgres pg_dump -U medianest medianest > backup_$(date +%Y%m%d).sql

# Redis backup
docker-compose exec redis redis-cli --rdb /tmp/dump_$(date +%Y%m%d).rdb
docker cp medianest-redis:/tmp/dump_$(date +%Y%m%d).rdb ./

# Application data backup
docker cp medianest-backend:/app/uploads ./uploads_backup_$(date +%Y%m%d)
docker cp medianest-backend:/app/downloads ./downloads_backup_$(date +%Y%m%d)
```

### Pre-Update Backup

```bash
#!/bin/bash
# scripts/pre-update-backup.sh

echo "Creating pre-update backup..."

# Stop services gracefully
docker-compose stop backend frontend

# Create timestamped backup
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/pre_update_${BACKUP_TIMESTAMP}"

# Run full backup
BACKUP_PATH="$BACKUP_DIR" docker-compose run --rm backup /backup.sh

echo "Pre-update backup completed: $BACKUP_DIR"
echo "Services stopped. Run docker-compose up -d to restart."
```

## Recovery Procedures

### Database Recovery

#### Full Database Restore

```bash
#!/bin/bash
# scripts/restore-database.sh

BACKUP_FILE="$1"
TARGET_DB="${2:-medianest}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file> [target_database]"
    exit 1
fi

# Stop application to prevent connections
docker-compose stop backend

# Drop existing database (WARNING: destructive)
docker-compose exec postgres dropdb -U medianest "$TARGET_DB" --if-exists
docker-compose exec postgres createdb -U medianest "$TARGET_DB"

# Restore from backup
if [[ "$BACKUP_FILE" == *.dump ]]; then
    # Custom format backup
    docker exec -i medianest-postgres pg_restore -U medianest -d "$TARGET_DB" < "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    # SQL format backup
    docker exec -i medianest-postgres psql -U medianest -d "$TARGET_DB" < "$BACKUP_FILE"
else
    echo "Unsupported backup format"
    exit 1
fi

echo "Database restored from $BACKUP_FILE"
```

#### Point-in-Time Recovery

```bash
#!/bin/bash
# scripts/restore-point-in-time.sh

BACKUP_DIR="$1"
TARGET_TIME="$2"  # Format: YYYY-MM-DD HH:MM:SS

if [ -z "$BACKUP_DIR" ] || [ -z "$TARGET_TIME" ]; then
    echo "Usage: $0 <backup_directory> <target_time>"
    echo "Example: $0 /backups/full_20231207_000000 '2023-12-07 14:30:00'"
    exit 1
fi

# Stop PostgreSQL
docker-compose stop postgres

# Restore base backup
docker cp "$BACKUP_DIR/postgres_full.dump" medianest-postgres:/tmp/
docker-compose start postgres

# Wait for PostgreSQL to start
sleep 10

# Apply WAL files up to target time
for wal_file in "$BACKUP_DIR"/*.backup; do
    if [ -f "$wal_file" ]; then
        docker cp "$wal_file" medianest-postgres:/var/lib/postgresql/data/pg_wal/
    fi
done

# Create recovery configuration
docker exec medianest-postgres sh -c "echo \"restore_command = 'cp /var/lib/postgresql/data/pg_wal/%f %p'\" > /var/lib/postgresql/data/recovery.conf"
docker exec medianest-postgres sh -c "echo \"recovery_target_time = '$TARGET_TIME'\" >> /var/lib/postgresql/data/recovery.conf"

# Restart PostgreSQL to trigger recovery
docker-compose restart postgres

echo "Point-in-time recovery initiated to $TARGET_TIME"
```

### Redis Recovery

```bash
#!/bin/bash
# scripts/restore-redis.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <redis_backup_file>"
    exit 1
fi

# Stop Redis
docker-compose stop redis

# Restore RDB file
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > /tmp/dump.rdb
    docker cp /tmp/dump.rdb medianest-redis:/data/dump.rdb
    rm /tmp/dump.rdb
else
    docker cp "$BACKUP_FILE" medianest-redis:/data/dump.rdb
fi

# Fix permissions
docker exec medianest-redis chown redis:redis /data/dump.rdb

# Start Redis
docker-compose start redis

echo "Redis restored from $BACKUP_FILE"
```

### Application Data Recovery

```bash
#!/bin/bash
# scripts/restore-app-data.sh

BACKUP_DIR="$1"
COMPONENT="${2:-all}"  # uploads, downloads, or all

if [ -z "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup_directory> [component]"
    exit 1
fi

restore_component() {
    local component="$1"
    local backup_file="$BACKUP_DIR/${component}.tar.gz"

    if [ -f "$backup_file" ]; then
        echo "Restoring $component..."

        # Extract backup
        tar -xzf "$backup_file" -C /tmp/

        # Stop application
        docker-compose stop backend

        # Remove existing data
        docker exec medianest-backend rm -rf "/app/$component"

        # Restore data
        docker cp "/tmp/$component" "medianest-backend:/app/"

        # Fix permissions
        docker exec medianest-backend chown -R 1001:1001 "/app/$component"

        # Cleanup
        rm -rf "/tmp/$component"

        echo "$component restored successfully"
    else
        echo "Backup file not found: $backup_file"
    fi
}

case $COMPONENT in
    "uploads")
        restore_component "uploads"
        ;;
    "downloads")
        restore_component "downloads"
        ;;
    "all")
        restore_component "uploads"
        restore_component "downloads"
        ;;
    *)
        echo "Invalid component: $COMPONENT"
        echo "Valid components: uploads, downloads, all"
        exit 1
        ;;
esac

# Start application
docker-compose start backend

echo "Application data restoration completed"
```

### Complete System Recovery

```bash
#!/bin/bash
# scripts/complete-restore.sh

BACKUP_DIR="$1"

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
    echo "Usage: $0 <backup_directory>"
    echo "Backup directory must exist and contain complete backup"
    exit 1
fi

echo "Starting complete system recovery from $BACKUP_DIR"
echo "This will overwrite all existing data!"
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    exit 1
fi

# Stop all services
echo "Stopping all services..."
docker-compose down

# Restore configuration
echo "Restoring configuration..."
if [ -f "$BACKUP_DIR/config.tar.gz" ]; then
    tar -xzf "$BACKUP_DIR/config.tar.gz" -C ./
fi

# Start database services only
echo "Starting database services..."
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 30

# Restore database
echo "Restoring database..."
if [ -f "$BACKUP_DIR/postgres_full.dump" ]; then
    ./scripts/restore-database.sh "$BACKUP_DIR/postgres_full.dump"
fi

# Restore Redis
echo "Restoring Redis..."
if [ -f "$BACKUP_DIR/redis_dump.rdb.gz" ]; then
    ./scripts/restore-redis.sh "$BACKUP_DIR/redis_dump.rdb.gz"
fi

# Start application services
echo "Starting application services..."
docker-compose up -d

# Wait for application to start
sleep 30

# Restore application data
echo "Restoring application data..."
./scripts/restore-app-data.sh "$BACKUP_DIR" all

echo "Complete system recovery finished"
echo "Please verify all services are working correctly"
```

## Disaster Recovery

### Disaster Recovery Plan

#### Recovery Time Objectives (RTO)

- **Critical**: 4 hours
- **Important**: 24 hours
- **Standard**: 72 hours

#### Recovery Point Objectives (RPO)

- **Database**: 1 hour
- **Application Data**: 4 hours
- **Configuration**: 24 hours

### Disaster Scenarios

#### Scenario 1: Database Corruption

```bash
# Detection
docker-compose exec postgres pg_isready -U medianest
# If fails, check logs
docker-compose logs postgres

# Recovery Steps
1. Stop application services
2. Restore database from latest backup
3. Verify data integrity
4. Restart services
5. Monitor for stability
```

#### Scenario 2: Complete Server Loss

```bash
# Recovery on new server
1. Install Docker and Docker Compose
2. Clone repository or restore from backup
3. Restore configuration files
4. Run complete system restore
5. Update DNS records
6. Verify SSL certificates
7. Test all functionality
```

#### Scenario 3: Data Center Outage

```bash
# Failover to backup location
1. Update DNS to point to backup server
2. Restore latest backup
3. Update configuration for new environment
4. Verify all services operational
5. Monitor performance and stability
```

### Backup Testing

```bash
#!/bin/bash
# scripts/test-backup-restore.sh

TEST_BACKUP="$1"
if [ -z "$TEST_BACKUP" ]; then
    echo "Usage: $0 <backup_directory>"
    exit 1
fi

echo "Starting backup restore test..."

# Create test environment
TEST_ENV="test_restore_$(date +%s)"
mkdir -p "/tmp/$TEST_ENV"
cd "/tmp/$TEST_ENV"

# Copy docker-compose files
cp "$OLDPWD/docker-compose.yml" .
cp "$OLDPWD/docker-compose.test.yml" .

# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Wait for services
sleep 30

# Test restore
$OLDPWD/scripts/complete-restore.sh "$TEST_BACKUP"

# Verify restore
echo "Testing database connection..."
if docker-compose exec postgres pg_isready -U medianest; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
fi

echo "Testing application startup..."
if curl -f http://localhost:3000/api/health; then
    echo "✓ Application health check passed"
else
    echo "✗ Application health check failed"
fi

# Cleanup
docker-compose down -v
cd "$OLDPWD"
rm -rf "/tmp/$TEST_ENV"

echo "Backup restore test completed"
```

## Cloud Backup Integration

### AWS S3 Integration

```bash
#!/bin/bash
# scripts/backup-to-s3.sh

BACKUP_DIR="$1"
S3_BUCKET="${S3_BACKUP_BUCKET}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$BACKUP_DIR" ] || [ -z "$S3_BUCKET" ]; then
    echo "Usage: $0 <backup_directory>"
    echo "S3_BACKUP_BUCKET environment variable must be set"
    exit 1
fi

# Install AWS CLI if not present
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    apk add --no-cache aws-cli
fi

# Compress backup directory
BACKUP_ARCHIVE="${BACKUP_DIR}.tar.gz"
tar -czf "$BACKUP_ARCHIVE" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"

# Upload to S3
echo "Uploading backup to S3..."
aws s3 cp "$BACKUP_ARCHIVE" "s3://$S3_BUCKET/medianest/$(basename "$BACKUP_ARCHIVE")" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA

if [ $? -eq 0 ]; then
    echo "Backup uploaded successfully to S3"
    # Optional: Remove local archive to save space
    rm "$BACKUP_ARCHIVE"
else
    echo "Failed to upload backup to S3"
    exit 1
fi
```

### Google Cloud Storage Integration

```bash
#!/bin/bash
# scripts/backup-to-gcs.sh

BACKUP_DIR="$1"
GCS_BUCKET="${GCS_BACKUP_BUCKET}"

if [ -z "$BACKUP_DIR" ] || [ -z "$GCS_BUCKET" ]; then
    echo "Usage: $0 <backup_directory>"
    echo "GCS_BACKUP_BUCKET environment variable must be set"
    exit 1
fi

# Install Google Cloud SDK
if ! command -v gsutil &> /dev/null; then
    echo "Installing Google Cloud SDK..."
    curl https://sdk.cloud.google.com | bash
    exec -l $SHELL
fi

# Authenticate (assumes service account key is available)
gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS"

# Compress and upload
BACKUP_ARCHIVE="${BACKUP_DIR}.tar.gz"
tar -czf "$BACKUP_ARCHIVE" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"

gsutil -m cp "$BACKUP_ARCHIVE" "gs://$GCS_BUCKET/medianest/"

if [ $? -eq 0 ]; then
    echo "Backup uploaded successfully to Google Cloud Storage"
    rm "$BACKUP_ARCHIVE"
else
    echo "Failed to upload backup to Google Cloud Storage"
    exit 1
fi
```

## Best Practices

### Backup Best Practices

1. **3-2-1 Rule**: 3 copies of data, 2 different media types, 1 offsite
2. **Test Restores**: Regularly test backup restoration procedures
3. **Verify Integrity**: Always verify backup integrity after creation
4. **Monitor Backups**: Set up alerts for backup failures
5. **Document Procedures**: Keep recovery procedures up to date
6. **Encrypt Backups**: Use encryption for sensitive data
7. **Version Control**: Keep configuration backups in version control
8. **Automate Everything**: Minimize manual intervention
9. **Monitor Storage**: Track backup storage usage and costs
10. **Regular Reviews**: Review and update backup strategies quarterly

### Security Considerations

```bash
# Encrypt backups
gpg --symmetric --cipher-algo AES256 --compress-algo 1 --s2k-digest-algo SHA512 \
    --output backup_encrypted.tar.gz.gpg backup.tar.gz

# Decrypt backups
gpg --output backup.tar.gz --decrypt backup_encrypted.tar.gz.gpg
```

### Performance Optimization

```bash
# Parallel compression
export GZIP=-9
tar cf - backup_directory | pigz > backup.tar.gz

# Exclude unnecessary files
tar --exclude='*.log' --exclude='*.tmp' --exclude='node_modules' \
    -czf backup.tar.gz backup_directory
```

## Troubleshooting

### Common Backup Issues

#### Backup Script Fails

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs backup

# Check disk space
df -h

# Check permissions
ls -la backups/
```

#### Database Backup Fails

```bash
# Test database connection
docker-compose exec postgres pg_isready -U medianest

# Check database logs
docker-compose logs postgres

# Test pg_dump manually
docker-compose exec postgres pg_dump -U medianest medianest --verbose
```

#### Recovery Fails

```bash
# Check backup integrity
file backup_file
gzip -t backup_file.gz

# Verify backup contents
tar -tzf backup.tar.gz | head -20

# Check target system resources
df -h
free -h
```

### Monitoring Backup Health

```bash
#!/bin/bash
# scripts/check-backup-health.sh

BACKUP_DIR="/backups"
MAX_AGE_HOURS=25  # 25 hours for daily backups

# Check if recent backup exists
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "full_*" -type d -mtime -1 | sort | tail -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "CRITICAL: No recent backup found"
    exit 2
fi

# Check backup age
BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ $BACKUP_AGE_HOURS -gt $MAX_AGE_HOURS ]; then
    echo "WARNING: Latest backup is $BACKUP_AGE_HOURS hours old"
    exit 1
fi

# Check backup integrity
if [ -f "$LATEST_BACKUP/verification.log" ]; then
    if grep -q "VERIFICATION: PASSED" "$LATEST_BACKUP/verification.log"; then
        echo "OK: Latest backup is healthy (${BACKUP_AGE_HOURS}h old)"
        exit 0
    else
        echo "CRITICAL: Latest backup failed verification"
        exit 2
    fi
else
    echo "WARNING: No verification log found for latest backup"
    exit 1
fi
```

This comprehensive backup and recovery system ensures MediaNest data is protected and can be quickly restored in case of any issues. Regular testing of these procedures is essential to ensure they work when needed.
