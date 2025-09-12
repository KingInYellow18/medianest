#!/bin/bash
# MediaNest Production Deployment Script
# This script orchestrates the complete production deployment process

set -euo pipefail

# Configuration
NAMESPACE="medianest-prod"
RELEASE_NAME="medianest"
CHART_DIR="./helm/medianest"
VALUES_FILE="./helm/values-prod.yaml"
KUBE_CONFIG="${KUBECONFIG:-~/.kube/config}"
CONTAINER_REGISTRY="${CONTAINER_REGISTRY:-docker.io}"
CONTAINER_TAG="${CONTAINER_TAG:-latest}"
DOMAIN="${DOMAIN:-medianest.yourdomain.com}"

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

# Cleanup function for exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment failed with exit code $exit_code"
        log_info "Check logs and run rollback if necessary: ./scripts/rollback.sh"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "helm" "openssl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Check your kubeconfig."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or not accessible"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Function to validate environment variables
validate_environment() {
    log_info "Validating environment configuration..."
    
    local required_vars=("DB_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "NEXTAUTH_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_info "Please set these variables or source your .env file"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Function to build and push container images
build_and_push_images() {
    log_info "Building and pushing container images..."
    
    # Build backend image
    log_info "Building backend image..."
    docker build -f backend/Dockerfile.prod -t "${CONTAINER_REGISTRY}/medianest/backend:${CONTAINER_TAG}" .
    docker push "${CONTAINER_REGISTRY}/medianest/backend:${CONTAINER_TAG}"
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -f frontend/Dockerfile.prod -t "${CONTAINER_REGISTRY}/medianest/frontend:${CONTAINER_TAG}" .
    docker push "${CONTAINER_REGISTRY}/medianest/frontend:${CONTAINER_TAG}"
    
    log_success "Container images built and pushed"
}

# Function to create namespace if it doesn't exist
setup_namespace() {
    log_info "Setting up namespace: $NAMESPACE"
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        kubectl apply -f deployment/kubernetes/namespace.yaml
        log_success "Namespace $NAMESPACE created"
    else
        log_info "Namespace $NAMESPACE already exists"
    fi
}

# Function to generate and apply secrets
setup_secrets() {
    log_info "Setting up secrets..."
    
    # Create temporary secrets file
    local temp_secrets_file=$(mktemp)
    
    # Replace placeholders in secrets template
    sed -e "s/REPLACE_WITH_STRONG_DB_PASSWORD/${DB_PASSWORD}/g" \
        -e "s/REPLACE_WITH_STRONG_REDIS_PASSWORD/${REDIS_PASSWORD}/g" \
        -e "s/REPLACE_WITH_GENERATED_JWT_SECRET/${JWT_SECRET}/g" \
        -e "s/REPLACE_WITH_GENERATED_ENCRYPTION_KEY/${ENCRYPTION_KEY}/g" \
        -e "s/REPLACE_WITH_GENERATED_NEXTAUTH_SECRET/${NEXTAUTH_SECRET}/g" \
        -e "s/REPLACE_WITH_PLEX_CLIENT_ID/${PLEX_CLIENT_ID:-placeholder}/g" \
        -e "s/REPLACE_WITH_PLEX_CLIENT_SECRET/${PLEX_CLIENT_SECRET:-placeholder}/g" \
        -e "s/REPLACE_WITH_TMDB_API_KEY/${TMDB_API_KEY:-placeholder}/g" \
        -e "s/REPLACE_WITH_SMTP_PASSWORD/${SMTP_PASSWORD:-placeholder}/g" \
        -e "s/REPLACE_WITH_STRONG_GRAFANA_PASSWORD/${GRAFANA_PASSWORD:-placeholder}/g" \
        -e "s/REPLACE_WITH_STRONG_PROMETHEUS_PASSWORD/${PROMETHEUS_PASSWORD:-placeholder}/g" \
        deployment/kubernetes/secrets.yaml > "$temp_secrets_file"
    
    kubectl apply -f "$temp_secrets_file"
    rm "$temp_secrets_file"
    
    log_success "Secrets configured"
}

# Function to apply configuration maps
setup_config() {
    log_info "Applying configuration maps..."
    
    # Update domain in config maps
    sed "s/yourdomain.com/${DOMAIN}/g" deployment/kubernetes/configmaps.yaml | kubectl apply -f -
    
    log_success "Configuration maps applied"
}

# Function to deploy database
deploy_database() {
    log_info "Deploying database..."
    
    kubectl apply -f deployment/kubernetes/database.yaml
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s -n "$NAMESPACE"
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis --timeout=300s -n "$NAMESPACE"
    
    log_success "Database services deployed and ready"
}

# Function to run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Create migration job
    kubectl create job --from=deployment/medianest-backend migrate-$(date +%Y%m%d-%H%M%S) -n "$NAMESPACE"
    kubectl set env job/migrate-$(date +%Y%m%d-%H%M%S) RUN_MIGRATIONS=true -n "$NAMESPACE"
    
    # Wait for migration to complete
    kubectl wait --for=condition=complete job/migrate-$(date +%Y%m%d-%H%M%S) --timeout=300s -n "$NAMESPACE"
    
    log_success "Database migrations completed"
}

# Function to deploy applications
deploy_applications() {
    log_info "Deploying applications..."
    
    # Update image tags in deployment files
    sed -e "s|medianest/backend:latest|${CONTAINER_REGISTRY}/medianest/backend:${CONTAINER_TAG}|g" \
        -e "s|medianest/frontend:latest|${CONTAINER_REGISTRY}/medianest/frontend:${CONTAINER_TAG}|g" \
        deployment/kubernetes/backend-deployment.yaml | kubectl apply -f -
    
    sed -e "s|medianest/frontend:latest|${CONTAINER_REGISTRY}/medianest/frontend:${CONTAINER_TAG}|g" \
        deployment/kubernetes/frontend-deployment.yaml | kubectl apply -f -
    
    # Wait for deployments to be ready
    log_info "Waiting for backend deployment to be ready..."
    kubectl rollout status deployment/medianest-backend --timeout=600s -n "$NAMESPACE"
    
    log_info "Waiting for frontend deployment to be ready..."
    kubectl rollout status deployment/medianest-frontend --timeout=600s -n "$NAMESPACE"
    
    log_success "Applications deployed successfully"
}

# Function to setup ingress
setup_ingress() {
    log_info "Setting up ingress..."
    
    # Update domain in ingress configuration
    sed "s/yourdomain.com/${DOMAIN}/g" deployment/kubernetes/ingress.yaml | kubectl apply -f -
    
    log_success "Ingress configured"
}

# Function to run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for all pods to be ready
    kubectl wait --for=condition=ready pod -l app=medianest-backend --timeout=300s -n "$NAMESPACE"
    kubectl wait --for=condition=ready pod -l app=medianest-frontend --timeout=300s -n "$NAMESPACE"
    
    # Test backend health endpoint
    local backend_pod=$(kubectl get pods -l app=medianest-backend -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    if kubectl exec "$backend_pod" -n "$NAMESPACE" -- curl -f http://localhost:4000/api/health > /dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        exit 1
    fi
    
    # Test frontend health endpoint
    local frontend_pod=$(kubectl get pods -l app=medianest-frontend -o jsonpath='{.items[0].metadata.name}' -n "$NAMESPACE")
    if kubectl exec "$frontend_pod" -n "$NAMESPACE" -- curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        exit 1
    fi
    
    log_success "All health checks passed"
}

# Function to setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Apply Prometheus configuration
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: $NAMESPACE
  labels:
    app: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        command:
        - '/bin/prometheus'
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus'
        - '--web.console.libraries=/etc/prometheus/console_libraries'
        - '--web.console.templates=/etc/prometheus/consoles'
        - '--storage.tsdb.retention.time=200h'
        - '--web.enable-lifecycle'
      volumes:
      - name: config
        configMap:
          name: prometheus-config
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: $NAMESPACE
spec:
  ports:
  - port: 9090
    targetPort: 9090
  selector:
    app: prometheus
EOF
    
    log_success "Monitoring setup completed"
}

# Function to display deployment summary
display_summary() {
    log_info "Deployment Summary"
    echo "=================="
    echo "Namespace: $NAMESPACE"
    echo "Domain: $DOMAIN"
    echo "Container Tag: $CONTAINER_TAG"
    echo ""
    echo "Services:"
    kubectl get services -n "$NAMESPACE"
    echo ""
    echo "Pods:"
    kubectl get pods -n "$NAMESPACE"
    echo ""
    echo "Ingress:"
    kubectl get ingress -n "$NAMESPACE"
    echo ""
    log_success "Deployment completed successfully!"
    log_info "Access your application at: https://$DOMAIN"
    log_info "API available at: https://api.$DOMAIN"
}

# Main deployment function
main() {
    log_info "Starting MediaNest production deployment..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-migrations)
                SKIP_MIGRATIONS=true
                shift
                ;;
            --tag)
                CONTAINER_TAG="$2"
                shift 2
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --help)
                echo "MediaNest Production Deployment Script"
                echo ""
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-build         Skip building and pushing container images"
                echo "  --skip-migrations    Skip running database migrations"
                echo "  --tag TAG            Container image tag (default: latest)"
                echo "  --domain DOMAIN      Domain name for the application"
                echo "  --help               Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    
    if [ "${SKIP_BUILD:-false}" != "true" ]; then
        build_and_push_images
    fi
    
    setup_namespace
    setup_secrets
    setup_config
    deploy_database
    
    if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
        run_migrations
    fi
    
    deploy_applications
    setup_ingress
    run_health_checks
    setup_monitoring
    display_summary
}

# Run main function
main "$@"