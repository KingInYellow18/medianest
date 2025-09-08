#!/bin/bash
set -euo pipefail

# MediaNest Docker Swarm Initialization Script
# Comprehensive production-ready orchestration setup

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Configuration
SWARM_NAME="medianest-cluster"
DATA_DIR="/opt/medianest"
STACK_FILE="docker-swarm-stack.yml"

log "🚀 Starting MediaNest Docker Swarm Initialization"

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running or not accessible"
        exit 1
    fi
    
    info "Docker version: $(docker --version)"
    log "✅ Prerequisites check passed"
}

# Initialize Docker Swarm
init_swarm() {
    log "🐳 Initializing Docker Swarm..."
    
    if docker info | grep -q "Swarm: active"; then
        warn "Docker Swarm is already initialized"
        info "Current Swarm status: $(docker info --format '{{.Swarm.LocalNodeState}}')"
        return 0
    fi
    
    # Initialize Swarm with default interface
    ADVERTISE_ADDR=$(ip route get 8.8.8.8 | awk 'NR==1 {print $7}')
    
    log "Initializing Swarm on interface: $ADVERTISE_ADDR"
    docker swarm init --advertise-addr "$ADVERTISE_ADDR"
    
    log "✅ Docker Swarm initialized successfully"
}

# Add node labels for placement constraints
label_nodes() {
    log "🏷️  Applying node labels for service placement..."
    
    NODE_ID=$(docker node ls --format "{{.ID}} {{.Self}}" | grep "true" | awk '{print $1}')
    
    # Label manager node for all services (single-node setup)
    docker node update --label-add database=true "$NODE_ID"
    docker node update --label-add cache=true "$NODE_ID"
    docker node update --label-add app=true "$NODE_ID"
    docker node update --label-add monitoring=true "$NODE_ID"
    docker node update --label-add zone=primary "$NODE_ID"
    
    log "✅ Node labels applied successfully"
}

# Create necessary directories
setup_directories() {
    log "📁 Setting up data directories..."
    
    directories=(
        "$DATA_DIR/data/postgres"
        "$DATA_DIR/data/redis"
        "$DATA_DIR/monitoring/prometheus"
        "$DATA_DIR/monitoring/grafana"
        "$DATA_DIR/uploads"
        "$DATA_DIR/ssl"
        "$DATA_DIR/logs"
        "$DATA_DIR/backups"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log "Creating directory: $dir"
            sudo mkdir -p "$dir"
            sudo chown -R $USER:$USER "$dir"
            sudo chmod -R 755 "$dir"
        else
            info "Directory exists: $dir"
        fi
    done
    
    log "✅ Directory structure created"
}

# Generate secure secrets
generate_secrets() {
    log "🔐 Generating Docker Swarm secrets..."
    
    # Function to generate random password
    generate_password() {
        openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
    }
    
    # Secret definitions
    secrets=(
        "medianest_postgres_password_v1:$(generate_password)"
        "medianest_redis_password_v1:$(generate_password)"
        "medianest_jwt_secret_v1:$(openssl rand -hex 32)"
        "medianest_nextauth_secret_v1:$(openssl rand -hex 32)"
    )
    
    for secret_def in "${secrets[@]}"; do
        secret_name=$(echo "$secret_def" | cut -d: -f1)
        secret_value=$(echo "$secret_def" | cut -d: -f2)
        
        # Check if secret already exists
        if docker secret inspect "$secret_name" &>/dev/null; then
            warn "Secret $secret_name already exists, skipping..."
            continue
        fi
        
        # Create secret
        echo "$secret_value" | docker secret create "$secret_name" -
        log "Created secret: $secret_name"
    done
    
    log "✅ Secrets generated and stored securely"
}

# Deploy the stack
deploy_stack() {
    log "🚀 Deploying MediaNest Swarm Stack..."
    
    if [[ ! -f "$STACK_FILE" ]]; then
        error "Stack file $STACK_FILE not found"
        exit 1
    fi
    
    # Build application image first
    log "Building application image..."
    docker build -t medianest:latest -f Dockerfile.optimized .
    
    # Deploy stack
    docker stack deploy -c "$STACK_FILE" medianest
    
    log "✅ Stack deployed successfully"
}

# Wait for services to be ready
wait_for_services() {
    log "⏳ Waiting for services to become ready..."
    
    services=("medianest_postgres" "medianest_redis" "medianest_medianest-app" "medianest_traefik")
    
    for service in "${services[@]}"; do
        log "Waiting for $service to be ready..."
        
        # Wait up to 5 minutes for service
        timeout=300
        counter=0
        
        while ! docker service ps "$service" --format "{{.CurrentState}}" | grep -q "Running"; do
            if [[ $counter -ge $timeout ]]; then
                error "Service $service failed to start within timeout"
                docker service logs "$service" --tail 20
                exit 1
            fi
            
            sleep 5
            counter=$((counter + 5))
            echo -n "."
        done
        
        log "✅ Service $service is ready"
    done
}

# Verify deployment
verify_deployment() {
    log "🔍 Verifying deployment..."
    
    # Check stack status
    echo "==================== STACK STATUS ===================="
    docker stack ps medianest --no-trunc
    
    echo "==================== SERVICE STATUS ===================="
    docker service ls
    
    echo "==================== NETWORK STATUS ===================="
    docker network ls | grep medianest
    
    echo "==================== VOLUME STATUS ===================="
    docker volume ls | grep medianest
    
    echo "==================== SECRET STATUS ===================="
    docker secret ls | grep medianest
    
    log "✅ Deployment verification complete"
}

# Setup monitoring dashboards
setup_monitoring() {
    log "📊 Setting up monitoring dashboards..."
    
    # Wait for Prometheus to be ready
    log "Waiting for Prometheus to be accessible..."
    timeout=120
    counter=0
    
    while ! curl -s "http://localhost:9090/-/ready" &>/dev/null; do
        if [[ $counter -ge $timeout ]]; then
            warn "Prometheus not ready within timeout, continuing..."
            break
        fi
        sleep 5
        counter=$((counter + 5))
    done
    
    # Display access URLs
    echo "==================== ACCESS INFORMATION ===================="
    echo "🌐 Traefik Dashboard: http://localhost:8080"
    echo "📊 Prometheus: http://localhost:9090"
    echo "📈 Grafana: http://localhost:3001 (admin/admin123!@#)"
    echo "🚀 MediaNest App: http://localhost (via Traefik)"
    echo "=========================================================="
    
    log "✅ Monitoring setup complete"
}

# Performance tuning
tune_performance() {
    log "⚡ Applying performance optimizations..."
    
    # Docker daemon optimizations
    if [[ -f /etc/docker/daemon.json ]]; then
        log "Backing up existing Docker daemon config..."
        sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup
    fi
    
    # Create optimized Docker daemon config
    cat << 'EOF' | sudo tee /etc/docker/daemon.json > /dev/null
{
    "storage-driver": "overlay2",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "default-ulimits": {
        "nofile": {
            "Name": "nofile",
            "Hard": 65536,
            "Soft": 65536
        }
    },
    "max-concurrent-downloads": 10,
    "max-concurrent-uploads": 5,
    "storage-opts": [
        "overlay2.override_kernel_check=true"
    ]
}
EOF
    
    # Restart Docker daemon
    warn "Restarting Docker daemon for performance optimizations..."
    sudo systemctl restart docker
    
    # Wait for Docker to be ready
    sleep 10
    while ! docker info &>/dev/null; do
        sleep 2
    done
    
    log "✅ Performance optimizations applied"
}

# Create health check script
create_health_check() {
    log "🏥 Creating health check script..."
    
    cat << 'EOF' > "$DATA_DIR/health-check.sh"
#!/bin/bash
# MediaNest Swarm Health Check Script

echo "==================== SWARM HEALTH CHECK ===================="
echo "Timestamp: $(date)"
echo

# Check Swarm status
echo "📊 Swarm Status:"
docker info --format 'Swarm: {{.Swarm.LocalNodeState}}'
echo

# Check services
echo "🚀 Service Status:"
docker service ls --format "table {{.Name}}\t{{.Replicas}}\t{{.Image}}\t{{.Ports}}"
echo

# Check service health
echo "🏥 Service Health:"
for service in $(docker service ls --format "{{.Name}}"); do
    replicas=$(docker service ps "$service" --format "{{.CurrentState}}" | grep -c "Running")
    desired=$(docker service inspect "$service" --format "{{.Spec.Mode.Replicated.Replicas}}")
    echo "$service: $replicas/$desired running"
done
echo

# Check resource usage
echo "📈 Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo

# Check disk usage
echo "💾 Disk Usage:"
df -h /opt/medianest
echo

echo "==================== END HEALTH CHECK ===================="
EOF
    
    chmod +x "$DATA_DIR/health-check.sh"
    log "✅ Health check script created at $DATA_DIR/health-check.sh"
}

# Main execution
main() {
    log "🎯 Starting comprehensive Docker Swarm setup..."
    
    check_prerequisites
    init_swarm
    label_nodes
    setup_directories
    generate_secrets
    tune_performance
    deploy_stack
    wait_for_services
    verify_deployment
    setup_monitoring
    create_health_check
    
    echo
    log "🎉 MediaNest Docker Swarm initialization completed successfully!"
    echo
    warn "📝 Important Notes:"
    echo "   - Secrets are stored securely in Docker Swarm"
    echo "   - Data persisted in: $DATA_DIR"
    echo "   - Health check available: $DATA_DIR/health-check.sh"
    echo "   - To scale services: docker service scale medianest_medianest-app=5"
    echo "   - To update services: docker service update --image medianest:new-tag medianest_medianest-app"
    echo
    log "🚀 Your production-ready Docker Swarm cluster is now operational!"
}

# Handle script interruption
trap 'error "Script interrupted"; exit 1' INT TERM

# Execute main function
main "$@"