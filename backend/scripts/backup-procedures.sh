#!/bin/bash

# MediaNest Database Backup and Recovery Procedures
# This script provides comprehensive backup and recovery functionality

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "${LOG_FILE}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

# Load environment variables
load_env() {
    if [ -f "${PROJECT_ROOT}/.env" ]; then
        # Extract DATABASE_URL from .env
        export $(grep -v '^#' "${PROJECT_ROOT}/.env" | grep 'DATABASE_URL' | xargs)
    fi

    if [ -z "${DATABASE_URL:-}" ]; then
        error "DATABASE_URL not found. Please ensure .env file exists with DATABASE_URL"
    fi
}

# Create backup directory
ensure_backup_dir() {
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}/daily"
    mkdir -p "${BACKUP_DIR}/weekly"
    mkdir -p "${BACKUP_DIR}/monthly"
    mkdir -p "${BACKUP_DIR}/pre-deployment"
    touch "${LOG_FILE}"
}

# Check if PostgreSQL tools are available
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump is not installed or not in PATH"
    fi
    
    if ! command -v pg_restore &> /dev/null; then
        error "pg_restore is not installed or not in PATH"
    fi
    
    if ! command -v psql &> /dev/null; then
        error "psql is not installed or not in PATH"
    fi
    
    success "All dependencies are available"
}

# Test database connection
test_connection() {
    log "Testing database connection..."
    
    if psql "${DATABASE_URL}" -c "SELECT 1;" > /dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Cannot connect to database. Please check DATABASE_URL"
    fi
}

# Create full database backup
create_backup() {
    local backup_type="${1:-daily}"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="medianest_${backup_type}_${timestamp}"
    local backup_path="${BACKUP_DIR}/${backup_type}/${backup_name}"
    
    log "Creating ${backup_type} backup: ${backup_name}"
    
    # Create SQL dump with full schema and data
    log "Creating SQL dump..."
    pg_dump "${DATABASE_URL}" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        --file="${backup_path}.sql" 2>&1 | tee -a "${LOG_FILE}"
    
    # Create custom format dump for faster restore
    log "Creating custom format dump..."
    pg_dump "${DATABASE_URL}" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        --compress=9 \
        --file="${backup_path}.dump" 2>&1 | tee -a "${LOG_FILE}"
    
    # Create schema-only backup
    log "Creating schema-only backup..."
    pg_dump "${DATABASE_URL}" \
        --verbose \
        --schema-only \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        --file="${backup_path}_schema.sql" 2>&1 | tee -a "${LOG_FILE}"
    
    # Compress SQL files
    log "Compressing backup files..."
    gzip "${backup_path}.sql"
    gzip "${backup_path}_schema.sql"
    
    # Calculate file sizes
    local dump_size=$(du -h "${backup_path}.dump" | cut -f1)
    local sql_size=$(du -h "${backup_path}.sql.gz" | cut -f1)
    
    success "Backup completed successfully:"
    log "  - Custom dump: ${backup_path}.dump (${dump_size})"
    log "  - SQL dump: ${backup_path}.sql.gz (${sql_size})"
    log "  - Schema: ${backup_path}_schema.sql.gz"
    
    # Store metadata
    cat > "${backup_path}_metadata.json" << EOF
{
    "backup_type": "${backup_type}",
    "timestamp": "${timestamp}",
    "database_url": "${DATABASE_URL}",
    "files": {
        "custom_dump": "${backup_name}.dump",
        "sql_dump": "${backup_name}.sql.gz",
        "schema_dump": "${backup_name}_schema.sql.gz"
    },
    "sizes": {
        "custom_dump": "${dump_size}",
        "sql_dump": "${sql_size}"
    }
}
EOF

    echo "${backup_path}"
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    local confirmation="${2:-false}"
    
    if [ ! -f "${backup_file}" ]; then
        error "Backup file not found: ${backup_file}"
    fi
    
    if [ "${confirmation}" != "yes" ]; then
        warn "This will completely replace the current database!"
        echo -n "Are you sure you want to continue? (yes/no): "
        read -r response
        if [ "${response}" != "yes" ]; then
            log "Restore cancelled by user"
            exit 0
        fi
    fi
    
    log "Starting database restore from: ${backup_file}"
    
    # Determine file type and restore accordingly
    if [[ "${backup_file}" == *.dump ]]; then
        log "Restoring from custom format dump..."
        pg_restore "${DATABASE_URL}" \
            --verbose \
            --clean \
            --if-exists \
            --create \
            --exit-on-error \
            "${backup_file}" 2>&1 | tee -a "${LOG_FILE}"
    elif [[ "${backup_file}" == *.sql.gz ]]; then
        log "Restoring from compressed SQL dump..."
        zcat "${backup_file}" | psql "${DATABASE_URL}" 2>&1 | tee -a "${LOG_FILE}"
    elif [[ "${backup_file}" == *.sql ]]; then
        log "Restoring from SQL dump..."
        psql "${DATABASE_URL}" -f "${backup_file}" 2>&1 | tee -a "${LOG_FILE}"
    else
        error "Unsupported backup file format"
    fi
    
    success "Database restore completed successfully"
}

# List available backups
list_backups() {
    log "Available backups:"
    
    for backup_type in daily weekly monthly pre-deployment; do
        local type_dir="${BACKUP_DIR}/${backup_type}"
        if [ -d "${type_dir}" ] && [ "$(ls -A ${type_dir})" ]; then
            echo -e "\n${BLUE}${backup_type} backups:${NC}"
            ls -lah "${type_dir}"/*.dump 2>/dev/null | while read -r line; do
                echo "  $line"
            done
        fi
    done
}

# Clean old backups
cleanup_backups() {
    local days_to_keep_daily="${1:-7}"
    local days_to_keep_weekly="${2:-30}"
    local days_to_keep_monthly="${3:-90}"
    
    log "Cleaning up old backups..."
    
    # Clean daily backups older than specified days
    find "${BACKUP_DIR}/daily" -name "*.dump" -type f -mtime +${days_to_keep_daily} -exec rm -f {} \;
    find "${BACKUP_DIR}/daily" -name "*.sql.gz" -type f -mtime +${days_to_keep_daily} -exec rm -f {} \;
    find "${BACKUP_DIR}/daily" -name "*_metadata.json" -type f -mtime +${days_to_keep_daily} -exec rm -f {} \;
    
    # Clean weekly backups
    find "${BACKUP_DIR}/weekly" -name "*.dump" -type f -mtime +${days_to_keep_weekly} -exec rm -f {} \;
    find "${BACKUP_DIR}/weekly" -name "*.sql.gz" -type f -mtime +${days_to_keep_weekly} -exec rm -f {} \;
    
    # Clean monthly backups
    find "${BACKUP_DIR}/monthly" -name "*.dump" -type f -mtime +${days_to_keep_monthly} -exec rm -f {} \;
    find "${BACKUP_DIR}/monthly" -name "*.sql.gz" -type f -mtime +${days_to_keep_monthly} -exec rm -f {} \;
    
    success "Backup cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ ! -f "${backup_file}" ]; then
        error "Backup file not found: ${backup_file}"
    fi
    
    log "Verifying backup integrity: ${backup_file}"
    
    # For custom format dumps, use pg_restore with list option
    if [[ "${backup_file}" == *.dump ]]; then
        if pg_restore --list "${backup_file}" > /dev/null 2>&1; then
            success "Backup file integrity check passed"
        else
            error "Backup file is corrupted or invalid"
        fi
    else
        log "Skipping integrity check for non-custom format backup"
    fi
}

# Create pre-deployment backup
pre_deployment_backup() {
    log "Creating pre-deployment backup..."
    local backup_path=$(create_backup "pre-deployment")
    
    # Also create a specifically named backup for easy reference
    local simple_name="${BACKUP_DIR}/pre-deployment/latest"
    cp "${backup_path}.dump" "${simple_name}.dump"
    cp "${backup_path}_metadata.json" "${simple_name}_metadata.json"
    
    success "Pre-deployment backup created: ${backup_path}"
    log "Also available as: ${simple_name}.dump"
}

# Emergency restore from latest backup
emergency_restore() {
    log "Emergency restore: Looking for latest backup..."
    
    local latest_backup=""
    
    # Look for pre-deployment backup first
    if [ -f "${BACKUP_DIR}/pre-deployment/latest.dump" ]; then
        latest_backup="${BACKUP_DIR}/pre-deployment/latest.dump"
        log "Found pre-deployment backup"
    else
        # Look for most recent daily backup
        latest_backup=$(find "${BACKUP_DIR}/daily" -name "*.dump" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
        if [ -n "${latest_backup}" ]; then
            log "Found daily backup: ${latest_backup}"
        else
            error "No backup files found for emergency restore"
        fi
    fi
    
    warn "EMERGENCY RESTORE - This will replace all current data!"
    restore_backup "${latest_backup}" "yes"
}

# Main function
main() {
    local command="${1:-}"
    
    case "${command}" in
        "backup")
            load_env
            ensure_backup_dir
            check_dependencies
            test_connection
            create_backup "${2:-daily}"
            ;;
        "restore")
            if [ -z "${2:-}" ]; then
                error "Please specify backup file to restore from"
            fi
            load_env
            check_dependencies
            test_connection
            restore_backup "$2" "${3:-false}"
            ;;
        "list")
            ensure_backup_dir
            list_backups
            ;;
        "verify")
            if [ -z "${2:-}" ]; then
                error "Please specify backup file to verify"
            fi
            verify_backup "$2"
            ;;
        "cleanup")
            ensure_backup_dir
            cleanup_backups "${2:-7}" "${3:-30}" "${4:-90}"
            ;;
        "pre-deployment")
            load_env
            ensure_backup_dir
            check_dependencies
            test_connection
            pre_deployment_backup
            ;;
        "emergency-restore")
            load_env
            check_dependencies
            test_connection
            emergency_restore
            ;;
        *)
            echo "MediaNest Database Backup and Recovery"
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  backup [daily|weekly|monthly]     Create database backup"
            echo "  restore <backup_file> [yes]       Restore from backup file"
            echo "  list                               List available backups"
            echo "  verify <backup_file>              Verify backup integrity"
            echo "  cleanup [daily_days] [weekly_days] [monthly_days]  Clean old backups"
            echo "  pre-deployment                     Create pre-deployment backup"
            echo "  emergency-restore                  Restore from latest backup"
            echo ""
            echo "Examples:"
            echo "  $0 backup daily"
            echo "  $0 restore /path/to/backup.dump"
            echo "  $0 cleanup 7 30 90"
            echo "  $0 pre-deployment"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"