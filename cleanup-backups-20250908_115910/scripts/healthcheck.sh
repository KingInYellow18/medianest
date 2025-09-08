#!/bin/bash

# MediaNest Comprehensive Health Check Script
# Validates all system components and provides detailed health status

set -euo pipefail

# Configuration
HEALTH_CHECK_TIMEOUT=30
POSTGRES_CONTAINER="medianest-postgres"
REDIS_CONTAINER="medianest-redis"
APP_CONTAINER="medianest-app"
NGINX_CONTAINER="medianest-nginx"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    ((PASSED_CHECKS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
    ((FAILED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Increment total checks counter
check_start() {
    ((TOTAL_CHECKS++))
}

# Check if container is running
check_container_running() {
    local container_name=$1
    check_start
    
    log_info "Checking if container '${container_name}' is running..."
    
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_success "Container '${container_name}' is running"
        return 0
    else
        log_error "Container '${container_name}' is not running"
        return 1
    fi
}

# Check container health status
check_container_health() {
    local container_name=$1
    check_start
    
    log_info "Checking health status of container '${container_name}'..."
    
    local health_status
    if health_status=$(docker inspect --format='{{.State.Health.Status}}' "${container_name}" 2>/dev/null); then
        case "$health_status" in
            "healthy")
                log_success "Container '${container_name}' is healthy"
                return 0
                ;;
            "unhealthy")
                log_error "Container '${container_name}' is unhealthy"
                return 1
                ;;
            "starting")
                log_warning "Container '${container_name}' is still starting"
                return 1
                ;;
            *)
                log_warning "Container '${container_name}' has no health check or unknown status: ${health_status}"
                return 1
                ;;
        esac
    else
        log_warning "Could not get health status for container '${container_name}'"
        return 1
    fi
}

# Check PostgreSQL database connectivity
check_postgres_connectivity() {
    check_start
    
    log_info "Checking PostgreSQL database connectivity..."
    
    if docker exec "${POSTGRES_CONTAINER}" pg_isready -U medianest -d medianest >/dev/null 2>&1; then
        log_success "PostgreSQL database is accepting connections"
        return 0
    else
        log_error "PostgreSQL database is not accepting connections"
        return 1
    fi
}

# Check PostgreSQL database query performance
check_postgres_performance() {
    check_start
    
    log_info "Checking PostgreSQL query performance..."
    
    local start_time
    start_time=$(date +%s.%N)
    
    if docker exec "${POSTGRES_CONTAINER}" psql -U medianest -d medianest -c "SELECT 1;" >/dev/null 2>&1; then
        local end_time
        end_time=$(date +%s.%N)
        local duration
        duration=$(echo "$end_time - $start_time" | bc)
        
        log_success "PostgreSQL query executed in ${duration}s"
        return 0
    else
        log_error "PostgreSQL query failed"
        return 1
    fi
}

# Check Redis connectivity
check_redis_connectivity() {
    check_start
    
    log_info "Checking Redis connectivity..."
    
    if docker exec "${REDIS_CONTAINER}" redis-cli ping >/dev/null 2>&1; then
        log_success "Redis is responding to ping"
        return 0
    else
        log_error "Redis is not responding to ping"
        return 1
    fi
}

# Check Redis memory usage
check_redis_memory() {
    check_start
    
    log_info "Checking Redis memory usage..."
    
    local memory_info
    if memory_info=$(docker exec "${REDIS_CONTAINER}" redis-cli info memory | grep used_memory_human); then
        local memory_used
        memory_used=$(echo "$memory_info" | cut -d: -f2 | tr -d '[:space:]')
        log_success "Redis memory usage: ${memory_used}"
        return 0
    else
        log_error "Could not retrieve Redis memory information"
        return 1
    fi
}

# Check backend API health endpoint
check_backend_api() {
    check_start
    
    log_info "Checking backend API health endpoint..."
    
    local api_url="http://localhost:4000/health"
    local response
    
    if response=$(curl -s -f --max-time "${HEALTH_CHECK_TIMEOUT}" "${api_url}" 2>/dev/null); then
        local status
        status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "unknown")
        
        if [[ "$status" == "healthy" ]]; then
            log_success "Backend API health endpoint is responding: ${status}"
            return 0
        else
            log_error "Backend API health endpoint returned unexpected status: ${status}"
            return 1
        fi
    else
        log_error "Backend API health endpoint is not accessible"
        return 1
    fi
}

# Check frontend accessibility
check_frontend() {
    check_start
    
    log_info "Checking frontend accessibility..."
    
    local frontend_url="http://localhost:3000"
    
    if curl -s -f --max-time "${HEALTH_CHECK_TIMEOUT}" "${frontend_url}" >/dev/null 2>&1; then
        log_success "Frontend is accessible"
        return 0
    else
        log_error "Frontend is not accessible"
        return 1
    fi
}

# Check Nginx reverse proxy
check_nginx() {
    check_start
    
    log_info "Checking Nginx reverse proxy..."
    
    if check_container_running "${NGINX_CONTAINER}" 2>/dev/null; then
        if curl -s -f --max-time "${HEALTH_CHECK_TIMEOUT}" "http://localhost/health" >/dev/null 2>&1; then
            log_success "Nginx reverse proxy is working"
            return 0
        else
            log_warning "Nginx is running but health endpoint not accessible"
            return 1
        fi
    else
        log_warning "Nginx container is not running (may be normal in development)"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    check_start
    
    log_info "Checking disk space..."
    
    local disk_usage
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ "$disk_usage" -lt 90 ]]; then
        log_success "Disk space usage is acceptable: ${disk_usage}%"
        return 0
    elif [[ "$disk_usage" -lt 95 ]]; then
        log_warning "Disk space usage is high: ${disk_usage}%"
        return 1
    else
        log_error "Disk space usage is critical: ${disk_usage}%"
        return 1
    fi
}

# Check system memory
check_system_memory() {
    check_start
    
    log_info "Checking system memory..."
    
    local memory_info
    if command -v free >/dev/null; then
        memory_info=$(free -h | grep '^Mem:' | awk '{print $3 "/" $2 " (" int($3/$2*100) "%)"}')
        log_success "Memory usage: ${memory_info}"
        return 0
    else
        log_warning "Memory information not available (free command not found)"
        return 1
    fi
}

# Check Docker daemon
check_docker_daemon() {
    check_start
    
    log_info "Checking Docker daemon..."
    
    if docker version >/dev/null 2>&1; then
        log_success "Docker daemon is running"
        return 0
    else
        log_error "Docker daemon is not accessible"
        return 1
    fi
}

# Check SSL certificates (if applicable)
check_ssl_certificates() {
    check_start
    
    log_info "Checking SSL certificates..."
    
    local cert_dir="./ssl_certs"
    if [[ -d "$cert_dir" ]] && [[ -n "$(ls -A "$cert_dir" 2>/dev/null)" ]]; then
        local cert_file
        for cert_file in "$cert_dir"/*.crt "$cert_dir"/*.pem; do
            if [[ -f "$cert_file" ]]; then
                local expiry_date
                if expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2); then
                    local expiry_epoch
                    expiry_epoch=$(date -d "$expiry_date" +%s)
                    local current_epoch
                    current_epoch=$(date +%s)
                    local days_until_expiry
                    days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
                    
                    if [[ "$days_until_expiry" -gt 30 ]]; then
                        log_success "SSL certificate expires in ${days_until_expiry} days"
                        return 0
                    elif [[ "$days_until_expiry" -gt 0 ]]; then
                        log_warning "SSL certificate expires in ${days_until_expiry} days (renewal recommended)"
                        return 1
                    else
                        log_error "SSL certificate has expired"
                        return 1
                    fi
                fi
            fi
        done
        log_warning "No SSL certificates found to check"
        return 1
    else
        log_info "No SSL certificates directory found (may be normal)"
        return 0
    fi
}

# Check backup system
check_backup_system() {
    check_start
    
    log_info "Checking backup system..."
    
    local backup_script="./scripts/backup.sh"
    if [[ -x "$backup_script" ]]; then
        log_success "Backup script is executable and available"
        
        # Check if backup directory exists
        local backup_dir="${BACKUP_PATH:-./backups}"
        if [[ -d "$backup_dir" ]]; then
            local latest_backup
            latest_backup=$(find "$backup_dir" -maxdepth 1 -type d -name "[0-9]*_[0-9]*" | sort | tail -1)
            if [[ -n "$latest_backup" ]]; then
                local backup_age
                backup_age=$(( ($(date +%s) - $(stat -c %Y "$latest_backup")) / 86400 ))
                if [[ "$backup_age" -le 1 ]]; then
                    log_success "Recent backup found (${backup_age} days old)"
                else
                    log_warning "Latest backup is ${backup_age} days old"
                fi
            else
                log_warning "No backups found in backup directory"
            fi
        else
            log_warning "Backup directory does not exist"
        fi
        return 0
    else
        log_error "Backup script is not available or not executable"
        return 1
    fi
}

# Generate health summary
generate_health_summary() {
    log_info "=== HEALTH CHECK SUMMARY ==="
    log_info "Total checks performed: ${TOTAL_CHECKS}"
    log_success "Passed checks: ${PASSED_CHECKS}"
    log_error "Failed checks: ${FAILED_CHECKS}"
    
    local success_rate
    if [[ "$TOTAL_CHECKS" -gt 0 ]]; then
        success_rate=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    else
        success_rate=0
    fi
    
    if [[ "$success_rate" -ge 90 ]]; then
        log_success "Overall system health: EXCELLENT (${success_rate}%)"
    elif [[ "$success_rate" -ge 75 ]]; then
        log_warning "Overall system health: GOOD (${success_rate}%)"
    elif [[ "$success_rate" -ge 50 ]]; then
        log_warning "Overall system health: FAIR (${success_rate}%)"
    else
        log_error "Overall system health: POOR (${success_rate}%)"
    fi
    
    return "$FAILED_CHECKS"
}

# Main health check routine
main() {
    log_info "Starting MediaNest comprehensive health check..."
    log_info "Health check timeout: ${HEALTH_CHECK_TIMEOUT}s"
    
    # Core infrastructure checks
    check_docker_daemon
    check_disk_space
    check_system_memory
    
    # Container checks
    check_container_running "$POSTGRES_CONTAINER" || true
    check_container_running "$REDIS_CONTAINER" || true  
    check_container_running "$APP_CONTAINER" || true
    
    # Container health checks (if containers are running)
    check_container_health "$POSTGRES_CONTAINER" || true
    check_container_health "$REDIS_CONTAINER" || true
    check_container_health "$APP_CONTAINER" || true
    
    # Service connectivity checks
    check_postgres_connectivity || true
    check_postgres_performance || true
    check_redis_connectivity || true
    check_redis_memory || true
    
    # Application checks
    check_backend_api || true
    check_frontend || true
    check_nginx || true
    
    # Security and maintenance checks
    check_ssl_certificates || true
    check_backup_system || true
    
    # Generate summary
    generate_health_summary
    
    # Exit with appropriate code
    if [[ "$FAILED_CHECKS" -eq 0 ]]; then
        log_success "All health checks passed!"
        exit 0
    elif [[ "$FAILED_CHECKS" -le 3 ]]; then
        log_warning "Minor issues detected (${FAILED_CHECKS} failures)"
        exit 1
    else
        log_error "Critical issues detected (${FAILED_CHECKS} failures)"
        exit 2
    fi
}

# Check for required tools
check_requirements() {
    local missing_tools=()
    
    for tool in curl jq docker bc; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools to run full health checks"
        exit 1
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_requirements
    main "$@"
fi