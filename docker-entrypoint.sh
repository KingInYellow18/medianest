#!/bin/sh

# MediaNest Docker Entrypoint Script
# Handles multi-service startup with proper health checks and signal handling

# Exit on error and enable verbose logging
set -euo pipefail

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Signal handler for graceful shutdown
cleanup() {
    log_info "Received shutdown signal, cleaning up..."
    
    if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        log_info "Stopping frontend server..."
        kill -TERM "$FRONTEND_PID" || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi
    
    if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        log_info "Stopping backend server..."
        kill -TERM "$BACKEND_PID" || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
    
    log_success "Shutdown complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT SIGQUIT

# Health check function
wait_for_service() {
    local service_name="$1"
    local health_url="$2"
    local max_attempts="${3:-30}"
    local attempt=1
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            log_success "$service_name is ready!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Validate environment
validate_environment() {
    log_info "Validating environment..."
    
    # Check required environment variables
    local required_vars="DATABASE_URL"
    for var in $required_vars; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check if we're in the right directory
    if [ ! -f "/app/package.json" ]; then
        log_error "Not in the correct application directory"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Database setup
setup_database() {
    log_info "Setting up database..."
    
    # Check database connectivity
    until curl -f -s "$DATABASE_URL" > /dev/null 2>&1 || [ $? -eq 52 ]; do
        log_info "Waiting for database to be ready..."
        sleep 2
    done
    
    # Run database migrations
    log_info "Running database migrations..."
    cd /app/backend
    
    if npx prisma migrate deploy; then
        log_success "Database migrations completed"
    else
        log_warning "Database migrations failed, attempting to push schema..."
        npx prisma db push --accept-data-loss || {
            log_error "Database setup failed"
            exit 1
        }
    fi
    
    # Generate Prisma client if needed
    log_info "Ensuring Prisma client is generated..."
    npx prisma generate || {
        log_error "Failed to generate Prisma client"
        exit 1
    }
    
    cd /app
}

# Start services based on mode
start_services() {
    local mode="${1:-unified}"
    
    case "$mode" in
        "backend")
            log_info "Starting backend service only..."
            setup_database
            cd /app/backend
            exec node dist/server.js
            ;;
        "frontend")
            log_info "Starting frontend service only..."
            cd /app/frontend
            exec node server.js
            ;;
        "unified"|*)
            log_info "Starting unified MediaNest services..."
            
            # Setup database
            setup_database
            
            # Start backend server in background
            log_info "Starting backend server..."
            cd /app/backend
            npm start &
            BACKEND_PID=$!
            cd /app
            
            # Wait for backend to be ready
            if ! wait_for_service "backend" "http://localhost:3001/health" 60; then
                cleanup
                exit 1
            fi
            
            # Start frontend server in background
            log_info "Starting frontend server..."
            cd /app/frontend
            npm start &
            FRONTEND_PID=$!
            cd /app
            
            # Wait for frontend to be ready
            if ! wait_for_service "frontend" "http://localhost:3000" 60; then
                cleanup
                exit 1
            fi
            
            log_success "All services started successfully!"
            log_info "Backend available at: http://localhost:3001"
            log_info "Frontend available at: http://localhost:3000"
            
            # Keep script running and wait for signals
            while true; do
                # Check if processes are still running
                if [ -n "${BACKEND_PID:-}" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
                    log_error "Backend process died unexpectedly"
                    cleanup
                    exit 1
                fi
                
                if [ -n "${FRONTEND_PID:-}" ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
                    log_error "Frontend process died unexpectedly"
                    cleanup
                    exit 1
                fi
                
                sleep 5
            done
            ;;
    esac
}

# Main execution
main() {
    log_info "MediaNest Docker Container Starting..."
    log_info "Node.js version: $(node --version)"
    log_info "NPM version: $(npm --version)"
    log_info "Environment: ${NODE_ENV:-development}"
    
    validate_environment
    start_services "${1:-unified}"
}

# Execute main function with all arguments
main "$@"