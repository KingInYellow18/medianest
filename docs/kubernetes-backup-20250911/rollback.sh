#!/bin/bash
# MediaNest Production Rollback Script
# This script handles emergency rollback procedures for production deployments

set -euo pipefail

# Configuration
NAMESPACE="medianest-prod"
BACKUP_DIR="./backups"
KUBE_CONFIG="${KUBECONFIG:-~/.kube/config}"

# Colors for output
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

# Function to get deployment history
get_deployment_history() {
    local deployment_name=$1
    log_info "Getting deployment history for $deployment_name"
    kubectl rollout history deployment/"$deployment_name" -n "$NAMESPACE"
}

# Function to rollback deployment to previous version
rollback_deployment() {
    local deployment_name=$1
    local revision=${2:-}
    
    log_warning "Rolling back deployment: $deployment_name"
    
    if [ -n "$revision" ]; then
        log_info "Rolling back to revision: $revision"
        kubectl rollout undo deployment/"$deployment_name" --to-revision="$revision" -n "$NAMESPACE"
    else
        log_info "Rolling back to previous version"
        kubectl rollout undo deployment/"$deployment_name" -n "$NAMESPACE"
    fi
    
    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/"$deployment_name" --timeout=300s -n "$NAMESPACE"
    
    log_success "Rollback completed for $deployment_name"
}

# Function to backup current state before rollback
backup_current_state() {
    log_info "Backing up current state before rollback..."
    
    # Create backup directory with timestamp
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_path="$BACKUP_DIR/pre-rollback-$backup_timestamp"
    mkdir -p "$backup_path"
    
    # Backup deployments
    kubectl get deployments -o yaml -n "$NAMESPACE" > "$backup_path/deployments.yaml"
    
    # Backup configmaps
    kubectl get configmaps -o yaml -n "$NAMESPACE" > "$backup_path/configmaps.yaml"
    
    # Backup services
    kubectl get services -o yaml -n "$NAMESPACE" > "$backup_path/services.yaml"
    
    # Backup ingress
    kubectl get ingress -o yaml -n "$NAMESPACE" > "$backup_path/ingress.yaml"
    
    # Backup current pod status
    kubectl get pods -o wide -n "$NAMESPACE" > "$backup_path/pods-status.txt"
    
    log_success "Current state backed up to: $backup_path"
}

# Function to restore database from backup
restore_database() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_warning "Restoring database from backup: $backup_file"
    
    # Get PostgreSQL pod
    local postgres_pod=$(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    
    if [ -z "$postgres_pod" ]; then
        log_error "PostgreSQL pod not found"
        return 1
    fi
    
    # Copy backup file to pod
    kubectl cp "$backup_file" "$NAMESPACE/$postgres_pod:/tmp/restore.sql"
    
    # Stop application pods to prevent database access during restore
    log_info "Scaling down application pods..."
    kubectl scale deployment medianest-backend --replicas=0 -n "$NAMESPACE"
    kubectl scale deployment medianest-frontend --replicas=0 -n "$NAMESPACE"
    
    # Restore database
    kubectl exec "$postgres_pod" -n "$NAMESPACE" -- psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/restore.sql
    
    # Scale applications back up
    log_info "Scaling up application pods..."
    kubectl scale deployment medianest-backend --replicas=3 -n "$NAMESPACE"
    kubectl scale deployment medianest-frontend --replicas=2 -n "$NAMESPACE"
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=medianest-backend --timeout=300s -n "$NAMESPACE"
    kubectl wait --for=condition=ready pod -l app=medianest-frontend --timeout=300s -n "$NAMESPACE"
    
    log_success "Database restored successfully"
}

# Function to run health checks after rollback
run_post_rollback_checks() {
    log_info "Running post-rollback health checks..."
    
    # Wait for all pods to be ready
    kubectl wait --for=condition=ready pod -l app=medianest-backend --timeout=300s -n "$NAMESPACE"
    kubectl wait --for=condition=ready pod -l app=medianest-frontend --timeout=300s -n "$NAMESPACE"
    
    # Test backend health endpoint
    local backend_pod=$(kubectl get pods -l app=medianest-backend -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    if kubectl exec "$backend_pod" -n "$NAMESPACE" -- curl -f http://localhost:4000/api/health > /dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Test frontend health endpoint
    local frontend_pod=$(kubectl get pods -l app=medianest-frontend -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    if kubectl exec "$frontend_pod" -n "$NAMESPACE" -- curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Test database connectivity
    if kubectl exec "$backend_pod" -n "$NAMESPACE" -- node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('DB OK'); process.exit(0); }).catch(() => process.exit(1));" > /dev/null 2>&1; then
        log_success "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
        return 1
    fi
    
    # Test Redis connectivity
    local redis_pod=$(kubectl get pods -l app=redis -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    if kubectl exec "$redis_pod" -n "$NAMESPACE" -- redis-cli ping | grep -q PONG; then
        log_success "Redis connectivity check passed"
    else
        log_error "Redis connectivity check failed"
        return 1
    fi
    
    log_success "All post-rollback health checks passed"
}

# Function to emergency stop all services
emergency_stop() {
    log_warning "EMERGENCY STOP: Shutting down all services"
    
    # Scale down all deployments
    kubectl scale deployment medianest-backend --replicas=0 -n "$NAMESPACE"
    kubectl scale deployment medianest-frontend --replicas=0 -n "$NAMESPACE"
    
    # Wait for pods to terminate
    kubectl wait --for=delete pod -l app=medianest-backend --timeout=60s -n "$NAMESPACE" || true
    kubectl wait --for=delete pod -l app=medianest-frontend --timeout=60s -n "$NAMESPACE" || true
    
    log_success "Emergency stop completed"
}

# Function to display rollback status
display_rollback_status() {
    log_info "Rollback Status Summary"
    echo "======================"
    echo "Namespace: $NAMESPACE"
    echo ""
    echo "Current Deployments:"
    kubectl get deployments -n "$NAMESPACE" -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,UP-TO-DATE:.status.updatedReplicas,AVAILABLE:.status.availableReplicas,AGE:.metadata.creationTimestamp
    echo ""
    echo "Current Pods:"
    kubectl get pods -n "$NAMESPACE" -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount,AGE:.metadata.creationTimestamp
    echo ""
    echo "Recent Events:"
    kubectl get events --sort-by=.metadata.creationTimestamp -n "$NAMESPACE" | tail -10
}

# Function to send notification
send_notification() {
    local message=$1
    local severity=${2:-info}
    
    log_info "Sending notification: $message"
    
    # If webhook URL is configured, send notification
    if [ -n "${WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"'"$message"'"}' \
            "$WEBHOOK_URL" || log_warning "Failed to send webhook notification"
    fi
    
    # Log to monitoring system if available
    if command -v logger &> /dev/null; then
        logger -t medianest-rollback "$message"
    fi
}

# Main rollback function
main() {
    log_warning "MediaNest Production Rollback Initiated"
    
    # Parse command line arguments
    local rollback_type=""
    local revision=""
    local db_backup=""
    local skip_backup=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --emergency)
                rollback_type="emergency"
                shift
                ;;
            --application)
                rollback_type="application"
                shift
                ;;
            --database)
                rollback_type="database"
                shift
                ;;
            --full)
                rollback_type="full"
                shift
                ;;
            --revision)
                revision="$2"
                shift 2
                ;;
            --db-backup)
                db_backup="$2"
                shift 2
                ;;
            --skip-backup)
                skip_backup=true
                shift
                ;;
            --help)
                echo "MediaNest Production Rollback Script"
                echo ""
                echo "Usage: $0 [ROLLBACK_TYPE] [OPTIONS]"
                echo ""
                echo "Rollback Types:"
                echo "  --emergency          Emergency stop of all services"
                echo "  --application        Rollback application deployments only"
                echo "  --database          Restore database from backup"
                echo "  --full              Full rollback (application + database)"
                echo ""
                echo "Options:"
                echo "  --revision REV      Rollback to specific revision"
                echo "  --db-backup FILE    Database backup file for restoration"
                echo "  --skip-backup       Skip backing up current state"
                echo "  --help              Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 --emergency"
                echo "  $0 --application --revision 3"
                echo "  $0 --database --db-backup ./backups/db-20240101.sql"
                echo "  $0 --full --db-backup ./backups/db-20240101.sql"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Require rollback type
    if [ -z "$rollback_type" ]; then
        log_error "Rollback type is required. Use --help for usage information."
        exit 1
    fi
    
    # Send notification about rollback start
    send_notification "MediaNest Production Rollback Started - Type: $rollback_type" "warning"
    
    case "$rollback_type" in
        emergency)
            log_warning "Performing emergency stop..."
            emergency_stop
            ;;
        application)
            if [ "$skip_backup" != "true" ]; then
                backup_current_state
            fi
            
            log_info "Rolling back application deployments..."
            get_deployment_history "medianest-backend"
            get_deployment_history "medianest-frontend"
            
            rollback_deployment "medianest-backend" "$revision"
            rollback_deployment "medianest-frontend" "$revision"
            
            run_post_rollback_checks
            ;;
        database)
            if [ -z "$db_backup" ]; then
                log_error "Database backup file is required for database rollback"
                exit 1
            fi
            
            if [ "$skip_backup" != "true" ]; then
                backup_current_state
            fi
            
            restore_database "$db_backup"
            run_post_rollback_checks
            ;;
        full)
            if [ -z "$db_backup" ]; then
                log_error "Database backup file is required for full rollback"
                exit 1
            fi
            
            if [ "$skip_backup" != "true" ]; then
                backup_current_state
            fi
            
            # Rollback applications first
            log_info "Rolling back application deployments..."
            rollback_deployment "medianest-backend" "$revision"
            rollback_deployment "medianest-frontend" "$revision"
            
            # Then restore database
            restore_database "$db_backup"
            
            run_post_rollback_checks
            ;;
    esac
    
    display_rollback_status
    
    # Send success notification
    send_notification "MediaNest Production Rollback Completed Successfully - Type: $rollback_type" "info"
    
    log_success "Rollback completed successfully!"
}

# Error handling
trap 'log_error "Rollback script failed at line $LINENO"; send_notification "MediaNest Production Rollback Failed" "error"; exit 1' ERR

# Run main function
main "$@"