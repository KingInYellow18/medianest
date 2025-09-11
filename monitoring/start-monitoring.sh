#!/bin/bash

# MEDIANEST PLG Stack Startup Script
# Comprehensive monitoring with Prometheus, Loki, and Grafana

set -e

echo "🚀 Starting MEDIANEST PLG Observability Stack"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.monitoring.yml"
ENV_FILE=".env.monitoring"
DATA_DIR="./data"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check dependencies
check_dependencies() {
    print_header "Checking Dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "All dependencies are available"
}

# Create necessary directories
create_directories() {
    print_header "Creating Data Directories..."
    
    mkdir -p ${DATA_DIR}/{prometheus,grafana,loki,alertmanager}
    mkdir -p grafana/dashboards/{application,infrastructure,business,logs,slo}
    
    # Set proper permissions
    sudo chown -R 472:472 ${DATA_DIR}/grafana  # Grafana user
    sudo chown -R 65534:65534 ${DATA_DIR}/prometheus  # Nobody user
    sudo chown -R 10001:10001 ${DATA_DIR}/loki  # Loki user
    sudo chown -R 65534:65534 ${DATA_DIR}/alertmanager  # Nobody user
    
    print_status "Data directories created and permissions set"
}

# Generate environment file
generate_env_file() {
    print_header "Generating Environment Configuration..."
    
    cat > ${ENV_FILE} << EOF
# MEDIANEST PLG Monitoring Stack Configuration
ENVIRONMENT=development
COMPOSE_PROJECT_NAME=medianest-monitoring

# Database Credentials
POSTGRES_PASSWORD=password
REDIS_PASSWORD=

# Grafana Configuration  
GRAFANA_PASSWORD=admin123

# AlertManager Configuration
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USERNAME=alerts@medianest.local
SMTP_PASSWORD=your-smtp-password

# Slack Webhook (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Security
METRICS_TOKEN=monitoring-secret-token-${RANDOM}

# Resource Limits
PROMETHEUS_MEMORY=1g
GRAFANA_MEMORY=512m
LOKI_MEMORY=512m
EOF
    
    print_status "Environment file created at ${ENV_FILE}"
    print_warning "Please review and update credentials in ${ENV_FILE}"
}

# Validate configuration
validate_config() {
    print_header "Validating Configuration Files..."
    
    local files=(
        "prometheus/prometheus.yml"
        "prometheus/alerts.yml"
        "loki/loki-config.yml"
        "promtail/promtail-config.yml"
        "grafana/datasources.yml"
        "alertmanager/alertmanager.yml"
    )
    
    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Missing configuration file: $file"
            exit 1
        fi
        print_status "✓ $file"
    done
    
    print_status "All configuration files are present"
}

# Start monitoring stack
start_stack() {
    print_header "Starting Monitoring Stack..."
    
    # Load environment variables
    if [[ -f "${ENV_FILE}" ]]; then
        export $(cat ${ENV_FILE} | xargs)
    fi
    
    # Start services in order
    print_status "Starting infrastructure services..."
    docker-compose -f ${COMPOSE_FILE} up -d \
        prometheus \
        loki \
        alertmanager \
        node-exporter \
        cadvisor
    
    sleep 10
    
    print_status "Starting exporters..."
    docker-compose -f ${COMPOSE_FILE} up -d \
        postgres-exporter \
        redis-exporter \
        blackbox-exporter \
        pushgateway
    
    sleep 5
    
    print_status "Starting log collection..."
    docker-compose -f ${COMPOSE_FILE} up -d promtail
    
    sleep 5
    
    print_status "Starting visualization..."
    docker-compose -f ${COMPOSE_FILE} up -d grafana
    
    sleep 10
    
    print_status "Starting health checker..."
    docker-compose -f ${COMPOSE_FILE} up -d monitoring-health
}

# Check service health
check_health() {
    print_header "Checking Service Health..."
    
    local services=(
        "prometheus:9090/-/healthy"
        "grafana:3000/api/health"
        "loki:3100/ready"
        "alertmanager:9093/-/healthy"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r name endpoint <<< "$service"
        if curl -sf "http://localhost:${endpoint}" > /dev/null 2>&1; then
            print_status "✓ ${name} is healthy"
        else
            print_warning "⚠ ${name} is not responding (may still be starting up)"
        fi
    done
}

# Display access information
show_access_info() {
    print_header "Access Information"
    echo ""
    echo "📊 Grafana Dashboard:    http://localhost:3001 (admin/admin123)"
    echo "🔍 Prometheus:           http://localhost:9090"
    echo "📝 Loki:                 http://localhost:3100"
    echo "🚨 AlertManager:         http://localhost:9093"
    echo "💻 Node Exporter:        http://localhost:9100"
    echo "🐳 cAdvisor:             http://localhost:8080"
    echo "📊 Postgres Exporter:    http://localhost:9187"
    echo "🔴 Redis Exporter:       http://localhost:9121"
    echo "⚫ Blackbox Exporter:    http://localhost:9115"
    echo "📤 Pushgateway:          http://localhost:9091"
    echo ""
    echo "📋 View logs with: docker-compose -f ${COMPOSE_FILE} logs -f [service_name]"
    echo "🛑 Stop stack with: docker-compose -f ${COMPOSE_FILE} down"
    echo ""
}

# Import Grafana dashboards (placeholder for future implementation)
import_dashboards() {
    print_header "Dashboard Import (Future Feature)"
    print_status "Dashboard provisioning configured via datasources.yml"
    print_status "Custom dashboards will be created in Grafana UI or via API"
}

# Main execution flow
main() {
    echo ""
    print_header "MEDIANEST PLG OBSERVABILITY STACK DEPLOYMENT"
    echo ""
    
    check_dependencies
    
    # Handle command line arguments
    case "${1:-start}" in
        "start"|"up")
            if [[ ! -f "${ENV_FILE}" ]]; then
                generate_env_file
            fi
            create_directories
            validate_config
            start_stack
            sleep 15  # Give services time to fully start
            check_health
            show_access_info
            ;;
        "stop"|"down")
            print_status "Stopping monitoring stack..."
            docker-compose -f ${COMPOSE_FILE} down
            ;;
        "restart")
            print_status "Restarting monitoring stack..."
            docker-compose -f ${COMPOSE_FILE} restart
            ;;
        "status")
            docker-compose -f ${COMPOSE_FILE} ps
            check_health
            ;;
        "logs")
            docker-compose -f ${COMPOSE_FILE} logs -f "${2:-}"
            ;;
        "clean")
            print_warning "This will remove all monitoring data. Are you sure? (y/N)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                docker-compose -f ${COMPOSE_FILE} down -v
                sudo rm -rf ${DATA_DIR}
                print_status "All monitoring data cleaned"
            fi
            ;;
        "help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start    Start the monitoring stack (default)"
            echo "  stop     Stop the monitoring stack"  
            echo "  restart  Restart the monitoring stack"
            echo "  status   Show service status"
            echo "  logs     Show logs for all services or specific service"
            echo "  clean    Remove all data and stop services"
            echo "  help     Show this help message"
            ;;
        *)
            print_error "Unknown command: $1"
            print_status "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"