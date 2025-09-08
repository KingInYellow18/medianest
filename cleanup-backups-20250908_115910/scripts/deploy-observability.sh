#!/bin/bash

# Observe - Comprehensive Observability Stack Deployment Script
# This script deploys the complete observability infrastructure in parallel with debt elimination

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$PROJECT_ROOT/config/monitoring"
LOG_FILE="/tmp/observability-deploy.log"

# Default values
ACTION="deploy"
ENVIRONMENT="development"
SKIP_DEPENDENCIES=false
DRY_RUN=false

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Observe Observability Stack Deployment

Usage: $0 [OPTIONS] [ACTION]

Actions:
  deploy     Deploy the complete observability stack (default)
  stop       Stop all observability services
  restart    Restart all observability services  
  status     Show status of all services
  health     Perform comprehensive health checks
  logs       Show logs for all services
  cleanup    Remove all observability resources

Options:
  -e, --environment ENV    Environment (development|staging|production) [default: development]
  -s, --skip-dependencies  Skip dependency checks
  -d, --dry-run           Show what would be done without executing
  -h, --help              Show this help message

Examples:
  $0 deploy                 # Deploy complete stack
  $0 -e production deploy   # Deploy for production
  $0 status                 # Check service status
  $0 health                 # Run health checks
  $0 cleanup               # Remove all resources

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--skip-dependencies)
                SKIP_DEPENDENCIES=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            deploy|stop|restart|status|health|logs|cleanup)
                ACTION="$1"
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Check dependencies
check_dependencies() {
    if [[ "$SKIP_DEPENDENCIES" == "true" ]]; then
        print_warning "Skipping dependency checks"
        return 0
    fi

    print_status "Checking dependencies..."
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # Check curl for health checks
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again"
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Create required directories
create_directories() {
    print_status "Creating required directories..."
    
    local dirs=(
        "$PROJECT_ROOT/backend/logs"
        "$PROJECT_ROOT/frontend/logs"
        "$MONITORING_DIR/prometheus/data"
        "$MONITORING_DIR/grafana/data"
        "$MONITORING_DIR/loki/data"
        "$MONITORING_DIR/jaeger/data"
        "$MONITORING_DIR/alertmanager/data"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "Would create directory: $dir"
        else
            mkdir -p "$dir"
            print_success "Created directory: $dir"
        fi
    done
}

# Generate monitoring configuration files
generate_configs() {
    print_status "Generating monitoring configurations..."
    
    # Generate Alertmanager configuration
    cat > "$MONITORING_DIR/alertmanager.yml" << 'EOF'
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'observability@observe.local'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://localhost:5001/webhook'
    send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
EOF

    # Generate Loki configuration
    cat > "$MONITORING_DIR/loki/loki-config.yml" << 'EOF'
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

ruler:
  storage:
    type: local
    local:
      directory: /loki/rules
  rule_path: /loki/rules
  alertmanager_url: http://alertmanager:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true
EOF

    # Generate Promtail configuration
    cat > "$MONITORING_DIR/promtail/promtail-config.yml" << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
- job_name: observe-backend
  static_configs:
  - targets:
      - localhost
    labels:
      job: observe-backend
      service: backend
      __path__: /app/backend/logs/*.log

- job_name: observe-frontend  
  static_configs:
  - targets:
      - localhost
    labels:
      job: observe-frontend
      service: frontend
      __path__: /app/frontend/logs/*.log

- job_name: system-logs
  static_configs:
  - targets:
      - localhost
    labels:
      job: system-logs
      __path__: /var/log/*.log
EOF

    print_success "Generated monitoring configurations"
}

# Deploy observability stack
deploy_stack() {
    print_status "Deploying observability stack..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "Would deploy Docker Compose stack"
        return 0
    fi
    
    cd "$MONITORING_DIR"
    
    # Pull latest images
    print_status "Pulling latest Docker images..."
    docker-compose -f docker-compose.observability.yml pull
    
    # Deploy stack
    print_status "Starting observability services..."
    docker-compose -f docker-compose.observability.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    print_success "Observability stack deployed successfully"
}

# Stop observability stack  
stop_stack() {
    print_status "Stopping observability stack..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "Would stop Docker Compose stack"
        return 0
    fi
    
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.observability.yml down
    
    print_success "Observability stack stopped"
}

# Restart observability stack
restart_stack() {
    print_status "Restarting observability stack..."
    stop_stack
    deploy_stack
}

# Check service status
check_status() {
    print_status "Checking service status..."
    
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.observability.yml ps
}

# Perform health checks
health_check() {
    print_status "Performing comprehensive health checks..."
    
    local services=(
        "Prometheus:http://localhost:9090/-/healthy"
        "Grafana:http://localhost:3001/api/health"
        "Loki:http://localhost:3100/ready"
        "Jaeger:http://localhost:16686/"
        "Alertmanager:http://localhost:9093/-/healthy"
        "Node-Exporter:http://localhost:9100/metrics"
        "cAdvisor:http://localhost:8080/healthz"
    )
    
    local healthy_count=0
    local total_count=${#services[@]}
    
    for service in "${services[@]}"; do
        local name="${service%%:*}"
        local url="${service##*:}"
        
        print_status "Checking $name..."
        
        if curl -s --max-time 10 "$url" > /dev/null 2>&1; then
            print_success "$name is healthy"
            ((healthy_count++))
        else
            print_error "$name is not responding"
        fi
    done
    
    echo ""
    print_status "Health Check Summary: $healthy_count/$total_count services healthy"
    
    if [[ $healthy_count -eq $total_count ]]; then
        print_success "All services are healthy!"
        print_status "Access points:"
        echo "  • Grafana:      http://localhost:3001 (admin/admin123)"
        echo "  • Prometheus:   http://localhost:9090"
        echo "  • Jaeger:       http://localhost:16686"  
        echo "  • Alertmanager: http://localhost:9093"
        echo ""
        print_success "Observability stack is fully operational!"
    else
        print_error "Some services are not healthy. Check logs for details."
        return 1
    fi
}

# Show logs for all services
show_logs() {
    print_status "Showing logs for all observability services..."
    
    cd "$MONITORING_DIR"
    docker-compose -f docker-compose.observability.yml logs -f --tail=100
}

# Cleanup all resources
cleanup_stack() {
    print_warning "This will remove all observability data and configurations!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleanup cancelled"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "Would cleanup all observability resources"
        return 0
    fi
    
    print_status "Cleaning up observability stack..."
    
    cd "$MONITORING_DIR"
    
    # Stop and remove containers, networks, volumes
    docker-compose -f docker-compose.observability.yml down -v --remove-orphans
    
    # Remove unused images
    docker image prune -f
    
    # Remove data directories
    sudo rm -rf "$MONITORING_DIR/*/data" 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Main execution function
main() {
    echo "🔍 Observe - Comprehensive Observability Stack"
    echo "=============================================="
    echo ""
    
    parse_args "$@"
    
    # Log all output
    exec > >(tee -a "$LOG_FILE") 2>&1
    
    print_status "Starting deployment with action: $ACTION"
    print_status "Environment: $ENVIRONMENT"
    print_status "Log file: $LOG_FILE"
    echo ""
    
    case "$ACTION" in
        deploy)
            check_dependencies
            create_directories
            generate_configs
            deploy_stack
            health_check
            ;;
        stop)
            stop_stack
            ;;
        restart)
            restart_stack
            health_check
            ;;
        status)
            check_status
            ;;
        health)
            health_check
            ;;
        logs)
            show_logs
            ;;
        cleanup)
            cleanup_stack
            ;;
        *)
            print_error "Unknown action: $ACTION"
            show_usage
            exit 1
            ;;
    esac
}

# Trap errors and cleanup
trap 'print_error "Script failed at line $LINENO"' ERR

# Execute main function with all arguments
main "$@"