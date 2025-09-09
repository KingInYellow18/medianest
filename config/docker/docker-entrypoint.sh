#!/bin/sh
# =============================================================================
# MediaNest Docker Entrypoint Script
# =============================================================================
# 
# FEATURES:
# - Environment-specific initialization
# - Database migration handling
# - Health check functionality  
# - Graceful shutdown handling
# - Logging and monitoring setup
# - Security validation
# =============================================================================

set -e

# =============================================================================
# CONFIGURATION
# =============================================================================

# Script metadata
SCRIPT_VERSION="2.0.0"
SCRIPT_NAME="MediaNest Docker Entrypoint"

# Environment detection
NODE_ENV="${NODE_ENV:-production}"
SERVICE_NAME="${SERVICE_NAME:-medianest}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Paths
APP_DIR="/app"
LOG_DIR="/app/logs"
BACKEND_DIR="/app/backend"
MIGRATION_DIR="/app/backend/prisma"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $*${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARN] $*${NC}" >&2
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*${NC}" >&2
    exit 1
}

debug() {
    if [ "$LOG_LEVEL" = "debug" ]; then
        echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] [DEBUG] $*${NC}"
    fi
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Wait for service to be available
wait_for_service() {
    local host="$1"
    local port="$2"
    local service_name="$3"
    local max_attempts="${4:-30}"
    local attempt=1
    
    log "Waiting for $service_name ($host:$port)..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            log "$service_name is available"
            return 0
        fi
        
        debug "Attempt $attempt/$max_attempts: $service_name not ready"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "$service_name is not available after $max_attempts attempts"
}

# Health check function
health_check() {
    local port="${PORT:-3001}"
    local endpoint="${HEALTH_ENDPOINT:-/api/health}"
    
    debug "Performing health check on http://localhost:$port$endpoint"
    
    if command -v curl >/dev/null 2>&1; then
        curl -f -s "http://localhost:$port$endpoint" >/dev/null
    elif command -v wget >/dev/null 2>&1; then
        wget -q --spider "http://localhost:$port$endpoint"
    else
        # Fallback: check if port is listening
        nc -z localhost "$port"
    fi
}

# Validate environment variables
validate_environment() {
    log "Validating environment configuration..."
    
    # Required environment variables
    local required_vars=""
    
    if [ "$NODE_ENV" = "production" ]; then
        required_vars="DATABASE_URL"
        
        # Additional production requirements
        if [ -z "${JWT_SECRET:-}" ]; then
            warn "JWT_SECRET not set - using default (NOT recommended for production)"
        fi
        
        if [ -z "${ENCRYPTION_KEY:-}" ]; then
            warn "ENCRYPTION_KEY not set - some features may not work"
        fi
    fi
    
    # Check required variables
    for var in $required_vars; do
        eval "value=\$$var"
        if [ -z "$value" ]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    log "Environment validation completed"
}

# Setup logging directory
setup_logging() {
    debug "Setting up logging directory: $LOG_DIR"
    
    mkdir -p "$LOG_DIR"
    chown -R "$(whoami)" "$LOG_DIR" 2>/dev/null || true
    
    # Create log files with proper permissions
    touch "$LOG_DIR/application.log"
    touch "$LOG_DIR/error.log"
    touch "$LOG_DIR/access.log"
    
    chmod 644 "$LOG_DIR"/*.log 2>/dev/null || true
}

# Database operations
run_migrations() {
    if [ "$RUN_MIGRATIONS" != "true" ]; then
        debug "Migration execution disabled (RUN_MIGRATIONS != true)"
        return 0
    fi
    
    if [ ! -d "$MIGRATION_DIR" ]; then
        warn "Migration directory not found: $MIGRATION_DIR"
        return 0
    fi
    
    log "Running database migrations..."
    
    # Change to backend directory for Prisma commands
    cd "$BACKEND_DIR" || error "Backend directory not found: $BACKEND_DIR"
    
    # Run migrations with error handling
    if npx prisma migrate deploy 2>&1; then
        log "Database migrations completed successfully"
    else
        error "Database migration failed"
    fi
    
    # Return to app directory
    cd "$APP_DIR" || error "Failed to return to app directory"
}

# Generate Prisma client (if needed)
generate_prisma_client() {
    if [ -f "$BACKEND_DIR/prisma/schema.prisma" ]; then
        log "Generating Prisma client..."
        cd "$BACKEND_DIR"
        npx prisma generate || warn "Failed to generate Prisma client"
        cd "$APP_DIR"
    fi
}

# Security checks
security_check() {
    debug "Performing security checks..."
    
    # Check file permissions
    local secure=true
    
    # Check for world-writable files
    if find "$APP_DIR" -type f -perm -002 2>/dev/null | grep -q .; then
        warn "Found world-writable files - this may be a security risk"
        secure=false
    fi
    
    # Check for SUID/SGID files
    if find "$APP_DIR" -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | grep -q .; then
        warn "Found SUID/SGID files - this may be a security risk"
        secure=false
    fi
    
    if [ "$secure" = "true" ]; then
        debug "Security checks passed"
    else
        warn "Security checks found potential issues"
    fi
}

# Setup signal handlers for graceful shutdown
setup_signal_handlers() {
    debug "Setting up signal handlers..."
    
    # Create PID file
    echo $$ > "/tmp/medianest.pid"
    
    # Cleanup function
    cleanup() {
        log "Received shutdown signal, performing cleanup..."
        
        # Kill child processes
        if [ -f "/tmp/medianest.pid" ]; then
            local pid=$(cat "/tmp/medianest.pid")
            if kill -0 "$pid" 2>/dev/null; then
                log "Stopping main process (PID: $pid)"
                kill -TERM "$pid" 2>/dev/null || true
                
                # Wait for graceful shutdown
                local count=0
                while kill -0 "$pid" 2>/dev/null && [ $count -lt 30 ]; do
                    sleep 1
                    count=$((count + 1))
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    warn "Forcing process termination"
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            fi
            rm -f "/tmp/medianest.pid"
        fi
        
        log "Cleanup completed"
        exit 0
    }
    
    # Set up signal traps
    trap cleanup TERM INT QUIT
}

# =============================================================================
# SERVICE-SPECIFIC FUNCTIONS
# =============================================================================

# Start backend service
start_backend() {
    log "Starting MediaNest Backend Service..."
    
    # Validate backend directory and files
    if [ ! -d "$BACKEND_DIR" ]; then
        error "Backend directory not found: $BACKEND_DIR"
    fi
    
    if [ ! -f "$BACKEND_DIR/dist/server.js" ]; then
        error "Backend server file not found: $BACKEND_DIR/dist/server.js"
    fi
    
    # Setup backend environment
    cd "$BACKEND_DIR"
    
    # Generate Prisma client if needed
    generate_prisma_client
    
    # Run migrations if configured
    run_migrations
    
    # Start the backend server
    log "Starting Node.js backend server..."
    exec node dist/server.js
}

# Start frontend service
start_frontend() {
    log "Starting MediaNest Frontend Service..."
    
    # Validate server file
    if [ ! -f "$APP_DIR/server.js" ]; then
        error "Frontend server file not found: $APP_DIR/server.js"
    fi
    
    log "Starting Next.js frontend server..."
    exec node server.js
}

# =============================================================================
# COMMAND HANDLERS
# =============================================================================

# Handle health check command
handle_health_check() {
    debug "Health check requested"
    
    if health_check; then
        log "Health check: HEALTHY"
        exit 0
    else
        error "Health check: UNHEALTHY"
    fi
}

# Handle migration command
handle_migration() {
    log "Migration command requested"
    
    validate_environment
    run_migrations
    
    log "Migration completed"
    exit 0
}

# Handle security scan command
handle_security_scan() {
    log "Security scan requested"
    
    security_check
    
    # Additional security checks can be added here
    log "Security scan completed"
    exit 0
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    log "$SCRIPT_NAME v$SCRIPT_VERSION starting..."
    log "Environment: $NODE_ENV"
    log "Service: $SERVICE_NAME"
    
    # Setup signal handlers
    setup_signal_handlers
    
    # Setup logging
    setup_logging
    
    # Handle special commands
    case "${1:-}" in
        health|healthcheck)
            handle_health_check
            ;;
        migrate|migration)
            handle_migration
            ;;
        security-scan)
            handle_security_scan
            ;;
    esac
    
    # Standard startup sequence
    validate_environment
    security_check
    
    # Wait for dependencies if configured
    if [ -n "${DATABASE_URL:-}" ] && [ "$NODE_ENV" = "production" ]; then
        # Extract database host and port from DATABASE_URL
        db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        
        if [ -n "$db_host" ] && [ -n "$db_port" ]; then
            wait_for_service "$db_host" "$db_port" "PostgreSQL" 30
        fi
    fi
    
    # Determine service type and start appropriately
    if [ -f "$BACKEND_DIR/dist/server.js" ]; then
        start_backend
    elif [ -f "$APP_DIR/server.js" ]; then
        start_frontend
    else
        # Default: execute provided command
        log "No specific service detected, executing: $*"
        exec "$@"
    fi
}

# Execute main function with all arguments
main "$@"