#!/bin/bash
set -euo pipefail

# MediaNest Orchestration Manager
# Unified management script for Docker Swarm and Compose orchestration

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.orchestration.yml"
SWARM_STACK_FILE="$PROJECT_ROOT/docker-swarm-stack.yml"
DATA_DIR="/opt/medianest"

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"; }
info() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"; }
debug() { echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] DEBUG: $1${NC}"; }

# Help function
show_help() {
    cat << EOF
MediaNest Orchestration Manager

USAGE:
    $0 <command> [options]

COMMANDS:
    init                    Initialize orchestration platform
    deploy                  Deploy the application stack
    scale <service> <count> Scale a service to specified replicas
    status                  Show orchestration status
    logs <service>          Show logs for a service
    health                  Perform comprehensive health check
    backup                  Create system backup
    restore <backup>        Restore from backup
    update                  Update services with zero downtime
    cleanup                 Clean up unused resources
    monitor                 Start monitoring dashboard
    benchmark               Run performance benchmarks

PLATFORM COMMANDS:
    swarm-init             Initialize Docker Swarm mode
    swarm-deploy           Deploy to Docker Swarm
    swarm-status           Show Swarm status
    compose-up             Start with Docker Compose
    compose-down           Stop Docker Compose stack
    compose-status         Show Compose status

OPTIONS:
    -p, --platform <swarm|compose>  Specify orchestration platform
    -e, --env <file>               Environment file to use
    -v, --verbose                  Enable verbose logging
    -h, --help                     Show this help message

EXAMPLES:
    $0 init --platform swarm
    $0 deploy --platform compose
    $0 scale medianest-app 5
    $0 health --verbose
    $0 update --platform swarm

EOF
}

# Check prerequisites
check_prerequisites() {
    local platform=${1:-"detect"}
    
    log "🔍 Checking prerequisites for platform: $platform"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running or not accessible"
        exit 1
    fi
    
    # Check Docker Compose
    if [[ "$platform" == "compose" ]] || [[ "$platform" == "detect" ]]; then
        if ! docker compose version &> /dev/null; then
            warn "Docker Compose v2 not available, checking legacy version..."
            if ! command -v docker-compose &> /dev/null; then
                error "Docker Compose is not installed"
                exit 1
            fi
        fi
    fi
    
    # Check Swarm availability
    if [[ "$platform" == "swarm" ]] || [[ "$platform" == "detect" ]]; then
        if ! docker swarm --help &> /dev/null; then
            warn "Docker Swarm not available on this system"
        fi
    fi
    
    log "✅ Prerequisites check passed"
}

# Detect best orchestration platform
detect_platform() {
    log "🕵️ Detecting optimal orchestration platform..."
    
    # Check if Swarm is already initialized
    if docker info 2>/dev/null | grep -q "Swarm: active"; then
        echo "swarm"
        return 0
    fi
    
    # Check system resources
    local cpu_cores=$(nproc)
    local memory_gb=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 ))
    
    debug "System resources: ${cpu_cores} CPU cores, ${memory_gb}GB RAM"
    
    # Recommend platform based on resources
    if [[ $cpu_cores -ge 4 ]] && [[ $memory_gb -ge 8 ]]; then
        info "Recommending Docker Swarm for high-performance orchestration"
        echo "swarm"
    else
        info "Recommending Docker Compose for resource-constrained environment"
        echo "compose"
    fi
}

# Initialize orchestration platform
initialize_platform() {
    local platform=${1:-$(detect_platform)}
    
    log "🚀 Initializing orchestration platform: $platform"
    
    case "$platform" in
        "swarm")
            initialize_swarm
            ;;
        "compose")
            initialize_compose
            ;;
        *)
            error "Unknown platform: $platform"
            exit 1
            ;;
    esac
}

# Initialize Docker Swarm
initialize_swarm() {
    log "🐝 Initializing Docker Swarm..."
    
    if [[ -f "$PROJECT_ROOT/scripts/swarm-init.sh" ]]; then
        bash "$PROJECT_ROOT/scripts/swarm-init.sh"
    else
        error "Swarm initialization script not found"
        exit 1
    fi
}

# Initialize Docker Compose
initialize_compose() {
    log "🐳 Initializing Docker Compose orchestration..."
    
    # Create data directories
    local directories=(
        "$DATA_DIR/postgres"
        "$DATA_DIR/redis" 
        "$DATA_DIR/prometheus"
        "$DATA_DIR/grafana"
        "$DATA_DIR/uploads"
        "$DATA_DIR/logs/traefik"
        "$DATA_DIR/logs/app"
        "$DATA_DIR/logs/postgres"
        "$DATA_DIR/logs/redis"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log "Creating directory: $dir"
            sudo mkdir -p "$dir"
            sudo chown -R $USER:$USER "$dir"
            sudo chmod -R 755 "$dir"
        fi
    done
    
    # Generate environment file if not exists
    if [[ ! -f "$PROJECT_ROOT/.env.orchestration" ]]; then
        log "Generating environment configuration..."
        create_env_file
    fi
    
    log "✅ Docker Compose orchestration initialized"
}

# Create environment file
create_env_file() {
    cat << EOF > "$PROJECT_ROOT/.env.orchestration"
# MediaNest Orchestration Environment
# Generated on $(date)

# Database Configuration
DB_NAME=medianest
DB_USER=medianest
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Redis Configuration  
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Application Security
NEXTAUTH_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# Grafana Configuration
GRAFANA_PASSWORD=admin123!@#

# SSL Configuration (if using)
SSL_EMAIL=admin@medianest.com
DOMAIN_NAME=medianest.local

# Performance Tuning
MAX_CONNECTIONS=100
SHARED_BUFFERS=256MB
EFFECTIVE_CACHE_SIZE=1GB

# Monitoring
PROMETHEUS_RETENTION=15d
GRAFANA_INSTALL_PLUGINS=grafana-piechart-panel,grafana-worldmap-panel

# Backup Configuration
BACKUP_RETENTION_DAYS=30
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
    
    log "Generated environment file: .env.orchestration"
    warn "Please review and customize the environment variables as needed"
}

# Deploy application stack
deploy_stack() {
    local platform=${1:-$(detect_platform)}
    
    log "🚀 Deploying MediaNest stack on platform: $platform"
    
    case "$platform" in
        "swarm")
            deploy_swarm_stack
            ;;
        "compose")
            deploy_compose_stack
            ;;
        *)
            error "Unknown platform: $platform"
            exit 1
            ;;
    esac
}

# Deploy to Docker Swarm
deploy_swarm_stack() {
    log "🐝 Deploying to Docker Swarm..."
    
    if ! docker info | grep -q "Swarm: active"; then
        error "Docker Swarm is not initialized. Run 'init --platform swarm' first"
        exit 1
    fi
    
    # Build and deploy
    docker build -t medianest:latest -f Dockerfile.optimized .
    docker stack deploy -c "$SWARM_STACK_FILE" medianest
    
    log "✅ Swarm stack deployment initiated"
}

# Deploy with Docker Compose
deploy_compose_stack() {
    log "🐳 Deploying with Docker Compose..."
    
    # Load environment
    if [[ -f "$PROJECT_ROOT/.env.orchestration" ]]; then
        set -a
        source "$PROJECT_ROOT/.env.orchestration"
        set +a
    fi
    
    # Deploy stack
    docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
    
    log "✅ Compose stack deployment initiated"
}

# Scale services
scale_service() {
    local service=$1
    local replicas=$2
    local platform=${3:-$(detect_platform)}
    
    log "⚖️ Scaling $service to $replicas replicas on $platform"
    
    case "$platform" in
        "swarm")
            docker service scale "${service}=$replicas"
            ;;
        "compose")
            warn "Docker Compose scaling requires manual adjustment of compose file"
            info "To scale $service, modify the replicas in $COMPOSE_FILE"
            ;;
        *)
            error "Unknown platform: $platform"
            exit 1
            ;;
    esac
}

# Show orchestration status
show_status() {
    local platform=${1:-$(detect_platform)}
    
    log "📊 Showing orchestration status for platform: $platform"
    
    case "$platform" in
        "swarm")
            show_swarm_status
            ;;
        "compose")
            show_compose_status
            ;;
        *)
            error "Unknown platform: $platform"
            exit 1
            ;;
    esac
}

# Show Docker Swarm status
show_swarm_status() {
    echo "==================== DOCKER SWARM STATUS ===================="
    
    if docker info | grep -q "Swarm: active"; then
        echo "📊 Node Status:"
        docker node ls
        
        echo
        echo "🚀 Service Status:"
        docker service ls
        
        echo
        echo "📦 Service Tasks:"
        docker stack ps medianest --no-trunc
        
        echo
        echo "🌐 Network Status:"
        docker network ls | grep -E "(medianest|NETWORK)"
        
        echo
        echo "💾 Volume Status:"
        docker volume ls | grep -E "(medianest|DRIVER)"
    else
        warn "Docker Swarm is not initialized"
    fi
}

# Show Docker Compose status
show_compose_status() {
    echo "==================== DOCKER COMPOSE STATUS ===================="
    
    if [[ -f "$COMPOSE_FILE" ]]; then
        echo "📊 Container Status:"
        docker compose -f "$COMPOSE_FILE" ps
        
        echo
        echo "🌐 Network Status:"
        docker network ls | grep -E "(medianest|frontend|backend|database|monitoring|NETWORK)"
        
        echo
        echo "💾 Volume Status:"
        docker volume ls | grep -E "(medianest|DRIVER)"
        
        echo
        echo "🔍 Resource Usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    else
        error "Compose file not found: $COMPOSE_FILE"
    fi
}

# Comprehensive health check
health_check() {
    local platform=${1:-$(detect_platform)}
    local verbose=${2:-false}
    
    log "🏥 Performing comprehensive health check..."
    
    echo "==================== HEALTH CHECK REPORT ===================="
    echo "Platform: $platform"
    echo "Timestamp: $(date)"
    echo "Host: $(hostname)"
    echo
    
    # System resources
    echo "💻 System Resources:"
    echo "CPU Cores: $(nproc)"
    echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
    echo "Disk Usage: $(df -h / | awk 'NR==2 {print $5}')"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
    echo
    
    # Docker status
    echo "🐳 Docker Status:"
    echo "Version: $(docker --version)"
    echo "Storage Driver: $(docker info --format '{{.Driver}}')"
    echo "Running Containers: $(docker ps -q | wc -l)"
    echo
    
    # Platform-specific health checks
    case "$platform" in
        "swarm")
            health_check_swarm "$verbose"
            ;;
        "compose") 
            health_check_compose "$verbose"
            ;;
    esac
    
    # Application health checks
    health_check_application "$verbose"
    
    echo "==================== END HEALTH CHECK ===================="
}

# Application health check
health_check_application() {
    local verbose=$1
    
    echo "🚀 Application Health:"
    
    # Check if services are responding
    services=("http://localhost:8080/ping" "http://localhost:9090/-/healthy" "http://localhost:3001/api/health")
    service_names=("Traefik" "Prometheus" "Grafana")
    
    for i in "${!services[@]}"; do
        url="${services[$i]}"
        name="${service_names[$i]}"
        
        if curl -s -f "$url" &>/dev/null; then
            echo "✅ $name: Healthy"
        else
            echo "❌ $name: Unhealthy or unreachable"
        fi
    done
    
    echo
}

# Performance benchmark
run_benchmark() {
    local platform=${1:-$(detect_platform)}
    
    log "📈 Running performance benchmarks..."
    
    # Create benchmark results directory
    mkdir -p "$PROJECT_ROOT/benchmarks/$(date +%Y%m%d_%H%M%S)"
    
    echo "Starting performance benchmark suite..."
    echo "Platform: $platform"
    echo "Timestamp: $(date)"
    
    # Basic load test (if application is running)
    if curl -s -f "http://localhost/api/health" &>/dev/null; then
        log "Running application load test..."
        
        # Simple concurrent request test
        echo "Testing concurrent connections..."
        for i in {1..10}; do
            curl -s "http://localhost/api/health" &
        done
        wait
        
        log "Load test completed"
    else
        warn "Application not accessible for load testing"
    fi
    
    # Resource usage benchmark
    log "Collecting resource usage metrics..."
    docker stats --no-stream > "$PROJECT_ROOT/benchmarks/resource-usage-$(date +%Y%m%d_%H%M%S).txt"
    
    log "✅ Benchmark completed"
}

# Cleanup unused resources
cleanup_resources() {
    local platform=${1:-$(detect_platform)}
    
    log "🧹 Cleaning up unused resources..."
    
    # Docker system cleanup
    docker system prune -f
    docker volume prune -f
    docker network prune -f
    
    # Platform-specific cleanup
    case "$platform" in
        "swarm")
            # Clean up unused services
            docker service ls --filter "label=com.medianest" --format "{{.Name}}" | while read -r service; do
                if [[ -n "$service" ]]; then
                    replicas=$(docker service inspect "$service" --format "{{.Spec.Mode.Replicated.Replicas}}")
                    if [[ "$replicas" == "0" ]]; then
                        log "Removing unused service: $service"
                        docker service rm "$service"
                    fi
                fi
            done
            ;;
        "compose")
            # Remove orphaned containers
            docker compose -f "$COMPOSE_FILE" down --remove-orphans
            ;;
    esac
    
    # Clean up old logs
    if [[ -d "$DATA_DIR/logs" ]]; then
        find "$DATA_DIR/logs" -name "*.log" -mtime +7 -delete
        log "Cleaned up old log files"
    fi
    
    log "✅ Cleanup completed"
}

# Main function
main() {
    local command=""
    local platform=""
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--platform)
                platform="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                if [[ -z "$command" ]]; then
                    command="$1"
                else
                    # Additional arguments for commands
                    break
                fi
                shift
                ;;
        esac
    done
    
    # Set verbose logging
    if [[ "$verbose" == "true" ]]; then
        set -x
    fi
    
    # Auto-detect platform if not specified
    if [[ -z "$platform" ]]; then
        platform=$(detect_platform)
    fi
    
    # Execute command
    case "$command" in
        "init")
            check_prerequisites "$platform"
            initialize_platform "$platform"
            ;;
        "deploy")
            check_prerequisites "$platform"
            deploy_stack "$platform"
            ;;
        "scale")
            if [[ $# -lt 2 ]]; then
                error "Scale command requires service name and replica count"
                echo "Usage: $0 scale <service> <count>"
                exit 1
            fi
            scale_service "$1" "$2" "$platform"
            ;;
        "status")
            show_status "$platform"
            ;;
        "health")
            health_check "$platform" "$verbose"
            ;;
        "benchmark")
            run_benchmark "$platform"
            ;;
        "cleanup")
            cleanup_resources "$platform"
            ;;
        "swarm-init")
            initialize_platform "swarm"
            ;;
        "swarm-deploy")
            deploy_stack "swarm"
            ;;
        "compose-up")
            deploy_stack "compose"
            ;;
        "compose-down")
            docker compose -f "$COMPOSE_FILE" down
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Script interrupted"; exit 1' INT TERM

# Execute main function
main "$@"