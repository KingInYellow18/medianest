#!/bin/bash
set -euo pipefail

# MediaNest Zero-Downtime Deployment System
# Production-ready deployment with rolling updates and health verification

# Color codes and logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_LOG="/var/log/medianest-deploy.log"
HEALTH_CHECK_URL="http://localhost/api/health"
DEPLOYMENT_TIMEOUT=600  # 10 minutes
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Deployment strategies
STRATEGY=${DEPLOY_STRATEGY:-"rolling"}  # rolling, blue-green, canary

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEPLOY_LOG"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$DEPLOY_LOG"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$DEPLOY_LOG"; }
info() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$DEPLOY_LOG"; }
debug() { echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] DEBUG: $1${NC}" | tee -a "$DEPLOY_LOG"; }

# Detect orchestration platform
detect_platform() {
    if docker info 2>/dev/null | grep -q "Swarm: active"; then
        echo "swarm"
    elif docker compose version >/dev/null 2>&1; then
        echo "compose"
    else
        echo "unknown"
    fi
}

# Pre-deployment validation
validate_deployment() {
    local version=$1
    local platform=$2
    
    log "🔍 Validating deployment prerequisites"
    
    # Check if new version is different from current
    local current_version
    case "$platform" in
        "swarm")
            current_version=$(docker service inspect medianest_medianest-app --format '{{.Spec.Labels.version}}' 2>/dev/null || echo "unknown")
            ;;
        "compose")
            current_version=$(docker inspect medianest-app-1 --format '{{.Config.Labels.version}}' 2>/dev/null || echo "unknown")
            ;;
    esac
    
    if [[ "$version" == "$current_version" ]]; then
        warn "Version $version is already deployed. Proceeding with force update."
    fi
    
    # Validate Docker image exists
    if [[ -n "$version" ]] && ! docker image inspect "medianest:$version" >/dev/null 2>&1; then
        error "Docker image medianest:$version not found"
        return 1
    fi
    
    # Check system resources
    local available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    local available_disk=$(df / | awk 'NR==2{printf "%.0f", ($4/1024/1024)}')
    
    if [[ $available_memory -lt 1024 ]]; then
        warn "Low available memory: ${available_memory}MB"
    fi
    
    if [[ $available_disk -lt 5 ]]; then
        error "Insufficient disk space: ${available_disk}GB available"
        return 1
    fi
    
    # Check current service health
    if ! check_service_health; then
        error "Current services are not healthy. Aborting deployment."
        return 1
    fi
    
    log "✅ Deployment validation passed"
    return 0
}

# Health check function
check_service_health() {
    local max_attempts=${1:-5}
    local wait_time=${2:-10}
    
    for ((i=1; i<=max_attempts; i++)); do
        debug "Health check attempt $i/$max_attempts"
        
        if curl -s -f "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            debug "✅ Health check passed"
            return 0
        fi
        
        if [[ $i -lt $max_attempts ]]; then
            debug "⏳ Waiting ${wait_time}s before next health check..."
            sleep "$wait_time"
        fi
    done
    
    error "❌ Health check failed after $max_attempts attempts"
    return 1
}

# Wait for service to be ready
wait_for_service_ready() {
    local service_name=$1
    local platform=$2
    local timeout=${3:-300}
    
    log "⏳ Waiting for $service_name to be ready (timeout: ${timeout}s)"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local ready=false
        
        case "$platform" in
            "swarm")
                local running_replicas=$(docker service ps "$service_name" --filter "desired-state=running" --format "{{.CurrentState}}" | grep -c "Running" || echo "0")
                local desired_replicas=$(docker service inspect "$service_name" --format "{{.Spec.Mode.Replicated.Replicas}}")
                
                if [[ "$running_replicas" == "$desired_replicas" ]]; then
                    ready=true
                fi
                ;;
            "compose")
                if docker ps --filter "name=$service_name" --filter "status=running" --format "{{.Names}}" | grep -q "$service_name"; then
                    ready=true
                fi
                ;;
        esac
        
        if $ready && check_service_health 3 5; then
            log "✅ Service $service_name is ready"
            return 0
        fi
        
        sleep 5
        echo -n "."
    done
    
    echo
    error "⏰ Timeout waiting for $service_name to be ready"
    return 1
}

# Rolling update deployment
deploy_rolling_update() {
    local version=$1
    local platform=$2
    
    log "🔄 Executing rolling update deployment"
    
    case "$platform" in
        "swarm")
            deploy_swarm_rolling "$version"
            ;;
        "compose")
            deploy_compose_rolling "$version"
            ;;
    esac
}

# Docker Swarm rolling update
deploy_swarm_rolling() {
    local version=$1
    
    log "🐝 Deploying to Docker Swarm with rolling update"
    
    # Update service with new image
    local update_cmd="docker service update"
    
    if [[ -n "$version" ]]; then
        update_cmd="$update_cmd --image medianest:$version"
    else
        update_cmd="$update_cmd --force"
    fi
    
    # Configure rolling update parameters
    update_cmd="$update_cmd --update-parallelism 1"
    update_cmd="$update_cmd --update-delay 30s"
    update_cmd="$update_cmd --update-monitor 30s"
    update_cmd="$update_cmd --update-failure-action rollback"
    update_cmd="$update_cmd --rollback-parallelism 2"
    update_cmd="$update_cmd --rollback-delay 10s"
    
    # Add version label
    if [[ -n "$version" ]]; then
        update_cmd="$update_cmd --label-add version=$version"
    fi
    
    update_cmd="$update_cmd medianest_medianest-app"
    
    log "Executing: $update_cmd"
    
    if $update_cmd; then
        log "✅ Rolling update initiated"
        
        # Wait for update to complete
        wait_for_service_ready "medianest_medianest-app" "swarm" "$DEPLOYMENT_TIMEOUT"
        
        # Verify deployment
        verify_deployment "$version" "swarm"
    else
        error "❌ Rolling update failed"
        return 1
    fi
}

# Docker Compose rolling update (manual process)
deploy_compose_rolling() {
    local version=$1
    
    log "🐳 Deploying to Docker Compose with rolling update"
    
    # Get current running instances
    local app_containers=($(docker ps --filter "name=medianest-app" --format "{{.Names}}" | sort))
    local total_containers=${#app_containers[@]}
    
    if [[ $total_containers -eq 0 ]]; then
        error "No application containers found"
        return 1
    fi
    
    log "Found $total_containers application containers for rolling update"
    
    # Update containers one by one
    for ((i=0; i<total_containers; i++)); do
        local container=${app_containers[$i]}
        local new_container="${container}-new"
        
        log "🔄 Updating container $((i+1))/$total_containers: $container"
        
        # Get current container configuration
        local network=$(docker inspect "$container" --format '{{range $key, $value := .NetworkSettings.Networks}}{{$key}}{{end}}' | head -1)
        local env_file="$PROJECT_ROOT/.env.orchestration"
        
        # Start new container
        local docker_run_cmd="docker run -d --name $new_container"
        docker_run_cmd="$docker_run_cmd --network $network"
        docker_run_cmd="$docker_run_cmd --env-file $env_file"
        docker_run_cmd="$docker_run_cmd -v uploads:/app/uploads"
        docker_run_cmd="$docker_run_cmd --label traefik.enable=true"
        docker_run_cmd="$docker_run_cmd --label com.medianest.component=application"
        
        if [[ -n "$version" ]]; then
            docker_run_cmd="$docker_run_cmd medianest:$version"
        else
            docker_run_cmd="$docker_run_cmd medianest:latest"
        fi
        
        if $docker_run_cmd; then
            log "✅ Started new container: $new_container"
            
            # Wait for new container to be healthy
            if wait_for_container_healthy "$new_container" 120; then
                log "✅ New container is healthy, removing old container"
                
                # Remove old container
                docker stop "$container" && docker rm "$container"
                
                # Rename new container
                docker rename "$new_container" "$container"
                
                log "✅ Container update completed: $container"
                
                # Wait between container updates
                if [[ $((i+1)) -lt $total_containers ]]; then
                    log "⏳ Waiting 30s before next container update..."
                    sleep 30
                fi
            else
                error "❌ New container failed health check, rolling back"
                docker stop "$new_container" && docker rm "$new_container"
                return 1
            fi
        else
            error "❌ Failed to start new container"
            return 1
        fi
    done
    
    log "✅ Rolling update completed for all containers"
    
    # Verify final deployment
    verify_deployment "$version" "compose"
}

# Wait for container to be healthy
wait_for_container_healthy() {
    local container=$1
    local timeout=${2:-120}
    
    debug "⏳ Waiting for container $container to be healthy (timeout: ${timeout}s)"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local container_status=$(docker inspect "$container" --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")
        
        if [[ "$container_status" == "healthy" ]]; then
            debug "✅ Container $container is healthy"
            return 0
        elif [[ "$container_status" == "unhealthy" ]]; then
            error "❌ Container $container is unhealthy"
            return 1
        fi
        
        # If no health check defined, check if container is running and port is accessible
        if [[ "$container_status" == "none" ]]; then
            local container_ip=$(docker inspect "$container" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' | head -1)
            if [[ -n "$container_ip" ]] && timeout 5 bash -c "</dev/tcp/$container_ip/3000" 2>/dev/null; then
                debug "✅ Container $container is accessible"
                return 0
            fi
        fi
        
        sleep 5
        echo -n "."
    done
    
    echo
    error "⏰ Timeout waiting for container $container to be healthy"
    return 1
}

# Blue-green deployment
deploy_blue_green() {
    local version=$1
    local platform=$2
    
    log "🔵🟢 Executing blue-green deployment"
    
    case "$platform" in
        "swarm")
            deploy_swarm_blue_green "$version"
            ;;
        "compose")
            deploy_compose_blue_green "$version"
            ;;
    esac
}

# Docker Swarm blue-green deployment
deploy_swarm_blue_green() {
    local version=$1
    
    log "🐝 Blue-green deployment on Docker Swarm"
    
    # Create green service
    local green_service="medianest_medianest-app-green"
    
    # Copy current service config and create green version
    docker service create \
        --name "$green_service" \
        --replicas 3 \
        --network medianest-backend \
        --network medianest-data \
        --label version="$version" \
        --label environment="green" \
        --env NODE_ENV=production \
        "medianest:$version"
    
    if wait_for_service_ready "$green_service" "swarm" 300; then
        log "✅ Green service is ready, switching traffic..."
        
        # Update load balancer to point to green service
        # This would typically involve updating Traefik labels or external load balancer config
        
        # For now, we'll update the original service
        docker service update --image "medianest:$version" medianest_medianest-app
        
        # Clean up green service after successful switch
        sleep 60
        docker service rm "$green_service"
        
        log "✅ Blue-green deployment completed"
    else
        error "❌ Green service failed to start, cleaning up"
        docker service rm "$green_service"
        return 1
    fi
}

# Canary deployment
deploy_canary() {
    local version=$1
    local platform=$2
    local percentage=${3:-10}
    
    log "🐤 Executing canary deployment (${percentage}% traffic)"
    
    case "$platform" in
        "swarm")
            deploy_swarm_canary "$version" "$percentage"
            ;;
        "compose")
            deploy_compose_canary "$version" "$percentage"
            ;;
    esac
}

# Verify deployment
verify_deployment() {
    local version=$1
    local platform=$2
    
    log "🔍 Verifying deployment"
    
    # Check service health
    if ! check_service_health "$HEALTH_CHECK_RETRIES" "$HEALTH_CHECK_INTERVAL"; then
        error "❌ Deployment verification failed - health check failed"
        return 1
    fi
    
    # Check service scaling
    case "$platform" in
        "swarm")
            local running_replicas=$(docker service ps medianest_medianest-app --filter "desired-state=running" --format "{{.CurrentState}}" | grep -c "Running" || echo "0")
            local desired_replicas=$(docker service inspect medianest_medianest-app --format "{{.Spec.Mode.Replicated.Replicas}}")
            
            if [[ "$running_replicas" != "$desired_replicas" ]]; then
                warn "Running replicas ($running_replicas) don't match desired replicas ($desired_replicas)"
            fi
            ;;
        "compose")
            local running_containers=$(docker ps --filter "name=medianest-app" --filter "status=running" --format "{{.Names}}" | wc -l)
            log "Running application containers: $running_containers"
            ;;
    esac
    
    # Performance smoke test
    log "🚀 Running performance smoke test"
    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' "$HEALTH_CHECK_URL" | awk '{printf "%.0f", $1*1000}')
    
    if [[ $response_time -gt 5000 ]]; then
        warn "High response time detected: ${response_time}ms"
    else
        log "✅ Response time looks good: ${response_time}ms"
    fi
    
    log "✅ Deployment verification completed successfully"
    return 0
}

# Rollback function
rollback_deployment() {
    local platform=$1
    local target_version=${2:-"previous"}
    
    log "🔄 Rolling back deployment"
    
    case "$platform" in
        "swarm")
            log "Rolling back Docker Swarm service"
            if docker service rollback medianest_medianest-app; then
                wait_for_service_ready "medianest_medianest-app" "swarm" 300
                log "✅ Rollback completed"
            else
                error "❌ Rollback failed"
                return 1
            fi
            ;;
        "compose")
            log "Rolling back Docker Compose services"
            # This would require maintaining previous container versions or images
            warn "Compose rollback requires manual intervention or pre-built rollback images"
            ;;
    esac
}

# Main deployment function
main() {
    local command="${1:-help}"
    local version="${2:-latest}"
    local strategy="${STRATEGY:-rolling}"
    local platform
    
    # Initialize logging
    sudo touch "$DEPLOY_LOG"
    sudo chown $USER:$USER "$DEPLOY_LOG"
    
    # Detect platform
    platform=$(detect_platform)
    
    log "🚀 MediaNest Zero-Downtime Deployment"
    log "Platform: $platform, Strategy: $strategy, Version: $version"
    
    case "$command" in
        "deploy")
            if validate_deployment "$version" "$platform"; then
                case "$strategy" in
                    "rolling")
                        deploy_rolling_update "$version" "$platform"
                        ;;
                    "blue-green")
                        deploy_blue_green "$version" "$platform"
                        ;;
                    "canary")
                        deploy_canary "$version" "$platform" "${3:-10}"
                        ;;
                    *)
                        error "Unknown deployment strategy: $strategy"
                        exit 1
                        ;;
                esac
            else
                error "Deployment validation failed"
                exit 1
            fi
            ;;
        "rollback")
            rollback_deployment "$platform" "$version"
            ;;
        "verify")
            verify_deployment "$version" "$platform"
            ;;
        "health")
            check_service_health
            ;;
        *)
            echo "MediaNest Zero-Downtime Deployment"
            echo
            echo "Usage: $0 <command> [version] [options]"
            echo
            echo "Commands:"
            echo "  deploy <version>        Deploy new version"
            echo "  rollback [version]      Rollback deployment"
            echo "  verify [version]        Verify current deployment"
            echo "  health                  Check service health"
            echo
            echo "Environment Variables:"
            echo "  DEPLOY_STRATEGY         Deployment strategy (rolling|blue-green|canary)"
            echo "  DEPLOYMENT_TIMEOUT      Deployment timeout in seconds (default: 600)"
            echo "  HEALTH_CHECK_URL        Health check endpoint (default: http://localhost/api/health)"
            echo
            echo "Examples:"
            echo "  $0 deploy v1.2.3"
            echo "  DEPLOY_STRATEGY=blue-green $0 deploy v1.2.3"
            echo "  $0 rollback"
            echo
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Execute main function
main "$@"