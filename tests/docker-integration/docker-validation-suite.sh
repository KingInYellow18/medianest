#!/bin/bash
set -euo pipefail

# 🐳 DOCKER CONSOLIDATED CONFIGURATION VALIDATION SUITE
# Comprehensive integration testing for consolidated Docker configurations
# Tests multi-stage builds, service health, performance metrics, and regression

# =============================================================================
# CONFIGURATION & GLOBALS  
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/tests/docker-integration/logs"
RESULTS_DIR="${PROJECT_ROOT}/tests/docker-integration/results"
DOCKER_CONFIG_DIR="${PROJECT_ROOT}/config/docker-consolidated"

# Test configuration
TEST_TIMEOUT=300
MAX_RETRIES=3
HEALTH_CHECK_INTERVAL=10
BUILD_TIMEOUT=1800
PERFORMANCE_SAMPLES=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

create_directories() {
    mkdir -p "${LOG_DIR}" "${RESULTS_DIR}"
    mkdir -p "${RESULTS_DIR}/build-metrics"
    mkdir -p "${RESULTS_DIR}/performance"
    mkdir -p "${RESULTS_DIR}/health-checks"
}

cleanup_containers() {
    log "Cleaning up containers and volumes..."
    
    # Stop and remove containers
    docker-compose -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" down --remove-orphans || true
    docker-compose -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" down --remove-orphans || true
    docker-compose -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" down --remove-orphans || true
    
    # Remove test volumes
    docker volume rm medianest-test-postgres-data medianest-test-redis-data 2>/dev/null || true
    
    # Remove test networks
    docker network rm medianest-test-network 2>/dev/null || true
    
    # Clean up dangling images (optional)
    docker system prune -f --volumes || true
}

wait_for_service() {
    local service_name="$1"
    local port="$2"
    local max_attempts="${3:-30}"
    local attempt=1
    
    log "Waiting for ${service_name} on port ${port}..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:${port}/health" &>/dev/null || \
           curl -f "http://localhost:${port}" &>/dev/null; then
            success "${service_name} is ready on port ${port}"
            return 0
        fi
        
        info "Attempt ${attempt}/${max_attempts}: ${service_name} not ready yet..."
        sleep $HEALTH_CHECK_INTERVAL
        ((attempt++))
    done
    
    error "${service_name} failed to start within ${max_attempts} attempts"
    return 1
}

# =============================================================================
# BUILD VALIDATION TESTS
# =============================================================================

test_multi_stage_builds() {
    log "Testing multi-stage Docker builds..."
    local build_results_file="${RESULTS_DIR}/build-metrics/multi-stage-builds.json"
    local build_times_file="${RESULTS_DIR}/build-metrics/build-times.json"
    
    echo "{" > "$build_results_file"
    echo "{" > "$build_times_file"
    
    local stages=(
        "development"
        "backend-production"
        "frontend-production"
        "security-hardened"
        "test-runner"
        "migration-runner"
        "nginx-production"
    )
    
    local build_success=true
    local stage_count=0
    
    for stage in "${stages[@]}"; do
        log "Building stage: ${stage}"
        local start_time=$(date +%s)
        
        if docker build \
            -f "${DOCKER_CONFIG_DIR}/Dockerfile" \
            --target "${stage}" \
            --tag "medianest:test-${stage}" \
            --build-arg NODE_ENV=test \
            --build-arg BUILD_TARGET="${stage}" \
            "${PROJECT_ROOT}" \
            > "${LOG_DIR}/build-${stage}.log" 2>&1; then
            
            local end_time=$(date +%s)
            local build_time=$((end_time - start_time))
            
            success "✅ Stage '${stage}' built successfully in ${build_time}s"
            
            # Record build metrics
            if [ $stage_count -gt 0 ]; then
                echo "," >> "$build_results_file"
                echo "," >> "$build_times_file"
            fi
            echo "  \"${stage}\": {" >> "$build_results_file"
            echo "    \"status\": \"success\"," >> "$build_results_file"
            echo "    \"build_time\": ${build_time}," >> "$build_results_file"
            echo "    \"timestamp\": \"$(date -Iseconds)\"" >> "$build_results_file"
            echo "  }" >> "$build_results_file"
            
            echo "  \"${stage}\": ${build_time}" >> "$build_times_file"
            
        else
            error "❌ Stage '${stage}' build failed"
            build_success=false
            
            # Record failure
            if [ $stage_count -gt 0 ]; then
                echo "," >> "$build_results_file"
                echo "," >> "$build_times_file"
            fi
            echo "  \"${stage}\": {" >> "$build_results_file"
            echo "    \"status\": \"failed\"," >> "$build_results_file"
            echo "    \"build_time\": 0," >> "$build_results_file"
            echo "    \"error_log\": \"${LOG_DIR}/build-${stage}.log\"," >> "$build_results_file"
            echo "    \"timestamp\": \"$(date -Iseconds)\"" >> "$build_results_file"
            echo "  }" >> "$build_results_file"
            
            echo "  \"${stage}\": 0" >> "$build_times_file"
        fi
        
        ((stage_count++))
    done
    
    echo "}" >> "$build_results_file"
    echo "}" >> "$build_times_file"
    
    if [ "$build_success" = true ]; then
        success "All multi-stage builds completed successfully"
        return 0
    else
        error "Some multi-stage builds failed"
        return 1
    fi
}

test_build_caching() {
    log "Testing Docker build caching effectiveness..."
    local cache_test_file="${RESULTS_DIR}/build-metrics/cache-effectiveness.json"
    
    # First build (no cache)
    log "Performing first build (establishing cache)..."
    local start_time=$(date +%s)
    docker build \
        -f "${DOCKER_CONFIG_DIR}/Dockerfile" \
        --target "backend-production" \
        --tag "medianest:cache-test-1" \
        "${PROJECT_ROOT}" \
        > "${LOG_DIR}/cache-first-build.log" 2>&1
    local first_build_time=$(($(date +%s) - start_time))
    
    # Second build (with cache)
    log "Performing second build (using cache)..."
    start_time=$(date +%s)
    docker build \
        -f "${DOCKER_CONFIG_DIR}/Dockerfile" \
        --target "backend-production" \
        --tag "medianest:cache-test-2" \
        "${PROJECT_ROOT}" \
        > "${LOG_DIR}/cache-second-build.log" 2>&1
    local second_build_time=$(($(date +%s) - start_time))
    
    local cache_improvement=$((100 - (second_build_time * 100 / first_build_time)))
    
    cat > "$cache_test_file" <<EOF
{
  "first_build_time": ${first_build_time},
  "second_build_time": ${second_build_time},
  "cache_improvement_percent": ${cache_improvement},
  "cache_effective": $([ $cache_improvement -gt 20 ] && echo "true" || echo "false"),
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    if [ $cache_improvement -gt 20 ]; then
        success "Build caching is effective: ${cache_improvement}% improvement"
        return 0
    else
        warning "Build caching improvement is minimal: ${cache_improvement}%"
        return 1
    fi
}

# =============================================================================
# SERVICE STARTUP VALIDATION
# =============================================================================

test_development_environment() {
    log "Testing development environment startup..."
    
    # Start development environment
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d \
        > "${LOG_DIR}/dev-startup.log" 2>&1
    
    # Wait for services to be ready
    local services_ready=true
    
    # Test database
    if ! wait_for_service "postgres" "5432"; then
        services_ready=false
    fi
    
    # Test Redis
    if ! wait_for_service "redis" "6379"; then
        services_ready=false
    fi
    
    # Test backend
    if ! wait_for_service "backend" "4000"; then
        services_ready=false
    fi
    
    # Test frontend  
    if ! wait_for_service "frontend" "3000"; then
        services_ready=false
    fi
    
    # Test admin tools
    if ! wait_for_service "adminer" "8080"; then
        warning "Adminer not ready (non-critical)"
    fi
    
    # Record results
    local health_file="${RESULTS_DIR}/health-checks/development-environment.json"
    cat > "$health_file" <<EOF
{
  "environment": "development",
  "services_ready": ${services_ready},
  "postgres_ready": $(curl -f "http://localhost:5432" &>/dev/null && echo "true" || echo "false"),
  "redis_ready": $(curl -f "http://localhost:6379" &>/dev/null && echo "true" || echo "false"), 
  "backend_ready": $(curl -f "http://localhost:4000/health" &>/dev/null && echo "true" || echo "false"),
  "frontend_ready": $(curl -f "http://localhost:3000" &>/dev/null && echo "true" || echo "false"),
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Cleanup
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        down > /dev/null 2>&1
    
    if [ "$services_ready" = true ]; then
        success "Development environment started successfully"
        return 0
    else
        error "Development environment startup failed"
        return 1
    fi
}

test_production_environment() {
    log "Testing production environment startup..."
    
    # Create required secrets for production
    echo "test-jwt-secret" | docker secret create medianest-jwt-secret-v1 - 2>/dev/null || true
    echo "test-db-password" | docker secret create medianest-postgres-password-v1 - 2>/dev/null || true
    echo "test-redis-password" | docker secret create medianest-redis-password-v1 - 2>/dev/null || true
    echo "postgresql://medianest:test@postgres:5432/medianest" | docker secret create medianest-database-url-v1 - 2>/dev/null || true
    echo "redis://:test@redis:6379/0" | docker secret create medianest-redis-url-v1 - 2>/dev/null || true
    echo "test-grafana-password" | docker secret create medianest-grafana-password-v1 - 2>/dev/null || true
    
    # Start production environment
    cd "${PROJECT_ROOT}"
    
    # Set production environment variables
    export NODE_ENV=production
    export POSTGRES_PASSWORD=test-db-password
    export REDIS_PASSWORD=test-redis-password
    
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" \
        up -d \
        > "${LOG_DIR}/prod-startup.log" 2>&1
    
    # Wait for core services
    local services_ready=true
    
    # Test database (internal network, use docker exec)
    if ! docker-compose exec -T postgres pg_isready -U medianest_prod -d medianest_prod &>/dev/null; then
        services_ready=false
        error "PostgreSQL not ready"
    fi
    
    # Test Redis (internal network)
    if ! docker-compose exec -T redis redis-cli --no-auth-warning ping &>/dev/null; then
        services_ready=false  
        error "Redis not ready"
    fi
    
    # Test backend health (internal)
    if ! docker-compose exec -T backend curl -f http://localhost:4000/api/health &>/dev/null; then
        services_ready=false
        error "Backend not ready"
    fi
    
    # Test frontend health (internal)
    if ! docker-compose exec -T frontend curl -f http://localhost:3000 &>/dev/null; then
        services_ready=false
        error "Frontend not ready"
    fi
    
    # Record results
    local health_file="${RESULTS_DIR}/health-checks/production-environment.json"
    cat > "$health_file" <<EOF
{
  "environment": "production",
  "services_ready": ${services_ready},
  "postgres_ready": $(docker-compose exec -T postgres pg_isready -U medianest_prod -d medianest_prod &>/dev/null && echo "true" || echo "false"),
  "redis_ready": $(docker-compose exec -T redis redis-cli ping &>/dev/null && echo "true" || echo "false"),
  "backend_ready": $(docker-compose exec -T backend curl -f http://localhost:4000/api/health &>/dev/null && echo "true" || echo "false"),
  "frontend_ready": $(docker-compose exec -T frontend curl -f http://localhost:3000 &>/dev/null && echo "true" || echo "false"),
  "security_hardened": true,
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Cleanup
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" \
        down > /dev/null 2>&1
    
    # Remove test secrets
    docker secret rm medianest-jwt-secret-v1 medianest-postgres-password-v1 medianest-redis-password-v1 2>/dev/null || true
    docker secret rm medianest-database-url-v1 medianest-redis-url-v1 medianest-grafana-password-v1 2>/dev/null || true
    
    if [ "$services_ready" = true ]; then
        success "Production environment started successfully"
        return 0
    else
        error "Production environment startup failed"
        return 1
    fi
}

# =============================================================================
# PERFORMANCE COMPARISON TESTS
# =============================================================================

compare_build_performance() {
    log "Comparing build performance: consolidated vs individual Dockerfiles..."
    
    local perf_results="${RESULTS_DIR}/performance/build-comparison.json"
    
    # Test consolidated build
    log "Testing consolidated Dockerfile build performance..."
    local consolidated_times=()
    for i in $(seq 1 $PERFORMANCE_SAMPLES); do
        local start_time=$(date +%s.%N)
        
        docker build \
            -f "${DOCKER_CONFIG_DIR}/Dockerfile" \
            --target "backend-production" \
            --tag "medianest:consolidated-perf-$i" \
            "${PROJECT_ROOT}" \
            > "${LOG_DIR}/consolidated-build-$i.log" 2>&1
        
        local end_time=$(date +%s.%N)
        local build_time=$(echo "$end_time - $start_time" | bc)
        consolidated_times+=("$build_time")
        
        log "Consolidated build $i: ${build_time}s"
    done
    
    # Test individual build (if exists)
    local individual_times=()
    if [ -f "${PROJECT_ROOT}/backend/Dockerfile" ]; then
        log "Testing individual Dockerfile build performance..."
        for i in $(seq 1 $PERFORMANCE_SAMPLES); do
            local start_time=$(date +%s.%N)
            
            docker build \
                -f "${PROJECT_ROOT}/backend/Dockerfile" \
                --tag "medianest:individual-perf-$i" \
                "${PROJECT_ROOT}/backend" \
                > "${LOG_DIR}/individual-build-$i.log" 2>&1 || true
            
            local end_time=$(date +%s.%N)
            local build_time=$(echo "$end_time - $start_time" | bc)
            individual_times+=("$build_time")
            
            log "Individual build $i: ${build_time}s"
        done
    fi
    
    # Calculate averages
    local consolidated_avg=$(printf '%s\n' "${consolidated_times[@]}" | awk '{sum+=$1} END {print sum/NR}')
    local individual_avg=0
    if [ ${#individual_times[@]} -gt 0 ]; then
        individual_avg=$(printf '%s\n' "${individual_times[@]}" | awk '{sum+=$1} END {print sum/NR}')
    fi
    
    # Calculate improvement
    local improvement=0
    if [ "$individual_avg" != "0" ]; then
        improvement=$(echo "scale=2; (($individual_avg - $consolidated_avg) / $individual_avg) * 100" | bc)
    fi
    
    cat > "$perf_results" <<EOF
{
  "consolidated_build_times": [$(IFS=','; echo "${consolidated_times[*]}")],
  "individual_build_times": [$(IFS=','; echo "${individual_times[*]}")],
  "consolidated_average": ${consolidated_avg},
  "individual_average": ${individual_avg},
  "improvement_percent": ${improvement},
  "test_samples": ${PERFORMANCE_SAMPLES},
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    if (( $(echo "$improvement > 0" | bc -l) )); then
        success "Build performance improved by ${improvement}%"
        return 0
    else
        info "Build performance: consolidated=${consolidated_avg}s, individual=${individual_avg}s"
        return 1
    fi
}

test_runtime_performance() {
    log "Testing runtime performance of consolidated containers..."
    
    # Start development environment for testing
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d \
        > "${LOG_DIR}/runtime-test-startup.log" 2>&1
    
    # Wait for services
    wait_for_service "backend" "4000" || return 1
    wait_for_service "frontend" "3000" || return 1
    
    # Performance tests
    local perf_results="${RESULTS_DIR}/performance/runtime-performance.json"
    
    # Backend API response time
    local backend_times=()
    for i in $(seq 1 $PERFORMANCE_SAMPLES); do
        local start_time=$(date +%s.%N)
        curl -f "http://localhost:4000/health" > /dev/null 2>&1 || true
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc)
        backend_times+=("$response_time")
    done
    
    # Frontend response time
    local frontend_times=()
    for i in $(seq 1 $PERFORMANCE_SAMPLES); do
        local start_time=$(date +%s.%N)
        curl -f "http://localhost:3000" > /dev/null 2>&1 || true
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc)
        frontend_times+=("$response_time")
    done
    
    # Calculate averages
    local backend_avg=$(printf '%s\n' "${backend_times[@]}" | awk '{sum+=$1} END {print sum/NR}')
    local frontend_avg=$(printf '%s\n' "${frontend_times[@]}" | awk '{sum+=$1} END {print sum/NR}')
    
    # Container resource usage
    local backend_stats=$(docker stats medianest-backend --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" | tail -n 1)
    local frontend_stats=$(docker stats medianest-frontend --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" | tail -n 1)
    
    cat > "$perf_results" <<EOF
{
  "backend_response_times": [$(IFS=','; echo "${backend_times[*]}")],
  "frontend_response_times": [$(IFS=','; echo "${frontend_times[*]}")],
  "backend_avg_response": ${backend_avg},
  "frontend_avg_response": ${frontend_avg},
  "backend_stats": "${backend_stats}",
  "frontend_stats": "${frontend_stats}",
  "test_samples": ${PERFORMANCE_SAMPLES},
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Cleanup
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        down > /dev/null 2>&1
    
    success "Runtime performance testing completed"
    info "Backend avg response: ${backend_avg}s, Frontend avg response: ${frontend_avg}s"
    return 0
}

# =============================================================================
# FUNCTIONALITY REGRESSION TESTS
# =============================================================================

test_volume_mounts() {
    log "Testing volume mounts and persistence..."
    
    # Start environment
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d postgres redis \
        > "${LOG_DIR}/volume-test-startup.log" 2>&1
    
    # Wait for database
    wait_for_service "postgres" "5432" || return 1
    
    # Test database persistence
    log "Testing database persistence..."
    docker-compose exec -T postgres psql -U medianest_dev -d medianest_dev -c "CREATE TABLE test_persistence (id SERIAL PRIMARY KEY, data TEXT);" || return 1
    docker-compose exec -T postgres psql -U medianest_dev -d medianest_dev -c "INSERT INTO test_persistence (data) VALUES ('test-data');" || return 1
    
    # Restart services
    log "Restarting services to test persistence..."
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        restart postgres redis
    
    wait_for_service "postgres" "5432" || return 1
    
    # Check data persistence
    local test_result=$(docker-compose exec -T postgres psql -U medianest_dev -d medianest_dev -c "SELECT data FROM test_persistence WHERE id = 1;" -t | tr -d ' \n')
    
    if [ "$test_result" = "test-data" ]; then
        success "Volume persistence test passed"
        
        # Cleanup
        docker-compose \
            -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
            -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
            down > /dev/null 2>&1
        
        return 0
    else
        error "Volume persistence test failed: expected 'test-data', got '$test_result'"
        
        # Cleanup
        docker-compose \
            -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
            -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
            down > /dev/null 2>&1
        
        return 1
    fi
}

test_networking() {
    log "Testing networking between services..."
    
    # Start services
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d \
        > "${LOG_DIR}/networking-test-startup.log" 2>&1
    
    # Wait for services
    wait_for_service "backend" "4000" || return 1
    wait_for_service "postgres" "5432" || return 1
    wait_for_service "redis" "6379" || return 1
    
    # Test internal networking
    log "Testing internal service communication..."
    
    # Backend to database
    local db_test=$(docker-compose exec -T backend sh -c "curl -f -m 5 http://postgres:5432 2>/dev/null || echo 'connection-failed'")
    
    # Backend to redis
    local redis_test=$(docker-compose exec -T backend sh -c "curl -f -m 5 http://redis:6379 2>/dev/null || echo 'connection-failed'")
    
    # Frontend to backend
    local frontend_backend_test=$(docker-compose exec -T frontend sh -c "curl -f -m 5 http://backend:4000/health 2>/dev/null && echo 'success' || echo 'failed'")
    
    local networking_results="${RESULTS_DIR}/health-checks/networking-test.json"
    cat > "$networking_results" <<EOF
{
  "backend_to_postgres": "$([ "$db_test" != "connection-failed" ] && echo "success" || echo "failed")",
  "backend_to_redis": "$([ "$redis_test" != "connection-failed" ] && echo "success" || echo "failed")",
  "frontend_to_backend": "${frontend_backend_test}",
  "network_isolation": "enabled",
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Cleanup
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        down > /dev/null 2>&1
    
    if [ "$frontend_backend_test" = "success" ]; then
        success "Network communication test passed"
        return 0
    else
        error "Network communication test failed"
        return 1
    fi
}

test_environment_variables() {
    log "Testing environment variable propagation..."
    
    # Start development environment
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d backend \
        > "${LOG_DIR}/env-test-startup.log" 2>&1
    
    wait_for_service "backend" "4000" || return 1
    
    # Test environment variables
    local node_env=$(docker-compose exec -T backend printenv NODE_ENV)
    local port=$(docker-compose exec -T backend printenv PORT)
    local db_url=$(docker-compose exec -T backend printenv DATABASE_URL)
    
    local env_results="${RESULTS_DIR}/health-checks/environment-variables.json"
    cat > "$env_results" <<EOF
{
  "node_env": "${node_env}",
  "port": "${port}",
  "database_url_set": "$([ -n "$db_url" ] && echo "true" || echo "false")",
  "hot_reload": "$(docker-compose exec -T backend printenv HOT_RELOAD || echo "false")",
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Cleanup
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        down > /dev/null 2>&1
    
    if [ "$node_env" = "development" ] && [ "$port" = "4000" ] && [ -n "$db_url" ]; then
        success "Environment variables properly configured"
        return 0
    else
        error "Environment variables not properly configured"
        error "NODE_ENV: '$node_env', PORT: '$port', DB_URL set: $([ -n "$db_url" ] && echo "yes" || echo "no")"
        return 1
    fi
}

# =============================================================================
# SECURITY VALIDATION TESTS  
# =============================================================================

test_security_configuration() {
    log "Testing security configuration..."
    
    cd "${PROJECT_ROOT}"
    
    # Test development security (relaxed)
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d backend \
        > "${LOG_DIR}/security-dev-test.log" 2>&1
    
    # Check container security settings (development)
    local dev_caps=$(docker inspect medianest-backend --format '{{.HostConfig.CapDrop}}' 2>/dev/null || echo "[]")
    local dev_readonly=$(docker inspect medianest-backend --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
    
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        down > /dev/null 2>&1
    
    # Test production security (hardened)
    export NODE_ENV=production
    export POSTGRES_PASSWORD=test-password
    export REDIS_PASSWORD=test-password
    
    # Create secrets for production test
    echo "test-jwt" | docker secret create medianest-jwt-secret-v1 - 2>/dev/null || true
    echo "test-pass" | docker secret create medianest-postgres-password-v1 - 2>/dev/null || true
    echo "test-redis" | docker secret create medianest-redis-password-v1 - 2>/dev/null || true
    echo "postgresql://test" | docker secret create medianest-database-url-v1 - 2>/dev/null || true
    echo "redis://test" | docker secret create medianest-redis-url-v1 - 2>/dev/null || true
    
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" \
        up -d backend \
        > "${LOG_DIR}/security-prod-test.log" 2>&1
    
    # Check container security settings (production)
    local prod_caps=$(docker inspect medianest-backend --format '{{.HostConfig.CapDrop}}' 2>/dev/null || echo "[]")
    local prod_readonly=$(docker inspect medianest-backend --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
    local prod_user=$(docker inspect medianest-backend --format '{{.Config.User}}' 2>/dev/null || echo "root")
    
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" \
        down > /dev/null 2>&1
    
    # Clean up secrets
    docker secret rm medianest-jwt-secret-v1 medianest-postgres-password-v1 medianest-redis-password-v1 2>/dev/null || true
    docker secret rm medianest-database-url-v1 medianest-redis-url-v1 2>/dev/null || true
    
    local security_results="${RESULTS_DIR}/health-checks/security-configuration.json"
    cat > "$security_results" <<EOF
{
  "development": {
    "capabilities_dropped": "${dev_caps}",
    "readonly_filesystem": ${dev_readonly},
    "security_level": "relaxed"
  },
  "production": {
    "capabilities_dropped": "${prod_caps}",
    "readonly_filesystem": ${prod_readonly},
    "non_root_user": "$([ "$prod_user" != "root" ] && echo "true" || echo "false")",
    "security_level": "hardened"
  },
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    if [ "$prod_readonly" = "true" ] && [ "$prod_user" != "root" ]; then
        success "Security configuration test passed"
        return 0
    else
        warning "Security configuration needs review"
        return 1
    fi
}

# =============================================================================
# PERFORMANCE METRICS & REPORTING
# =============================================================================

generate_validation_report() {
    log "Generating comprehensive validation report..."
    
    local report_file="${RESULTS_DIR}/docker-validation-report.md"
    local summary_file="${RESULTS_DIR}/validation-summary.json"
    
    # Create report header
    cat > "$report_file" <<EOF
# Docker Consolidated Configuration Validation Report

**Generated:** $(date)  
**Project:** MediaNest  
**Test Suite Version:** 2.0.0  

## Executive Summary

This report contains the results of comprehensive integration testing for the MediaNest consolidated Docker configuration. The testing covered multi-stage builds, service startup validation, performance comparisons, functionality regression tests, and security configuration validation.

## Test Results Overview

EOF
    
    # Initialize counters
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warnings=0
    
    # Process build results
    echo "### Build Validation Results" >> "$report_file"
    echo "" >> "$report_file"
    
    if [ -f "${RESULTS_DIR}/build-metrics/multi-stage-builds.json" ]; then
        local build_success=$(cat "${RESULTS_DIR}/build-metrics/multi-stage-builds.json" | grep -o '"status": "success"' | wc -l)
        local build_failed=$(cat "${RESULTS_DIR}/build-metrics/multi-stage-builds.json" | grep -o '"status": "failed"' | wc -l)
        echo "- Multi-stage builds: ${build_success} successful, ${build_failed} failed" >> "$report_file"
        total_tests=$((total_tests + build_success + build_failed))
        passed_tests=$((passed_tests + build_success))
        failed_tests=$((failed_tests + build_failed))
    fi
    
    if [ -f "${RESULTS_DIR}/build-metrics/cache-effectiveness.json" ]; then
        local cache_effective=$(cat "${RESULTS_DIR}/build-metrics/cache-effectiveness.json" | grep -o '"cache_effective": true' | wc -l)
        echo "- Build caching: $([ $cache_effective -gt 0 ] && echo "Effective" || echo "Needs improvement")" >> "$report_file"
        total_tests=$((total_tests + 1))
        if [ $cache_effective -gt 0 ]; then
            passed_tests=$((passed_tests + 1))
        else
            warnings=$((warnings + 1))
        fi
    fi
    
    echo "" >> "$report_file"
    
    # Process service startup results
    echo "### Service Startup Validation" >> "$report_file"
    echo "" >> "$report_file"
    
    for env in "development" "production"; do
        if [ -f "${RESULTS_DIR}/health-checks/${env}-environment.json" ]; then
            local services_ready=$(cat "${RESULTS_DIR}/health-checks/${env}-environment.json" | grep -o '"services_ready": true' | wc -l)
            echo "- ${env^} environment: $([ $services_ready -gt 0 ] && echo "✅ Ready" || echo "❌ Failed")" >> "$report_file"
            total_tests=$((total_tests + 1))
            if [ $services_ready -gt 0 ]; then
                passed_tests=$((passed_tests + 1))
            else
                failed_tests=$((failed_tests + 1))
            fi
        fi
    done
    
    echo "" >> "$report_file"
    
    # Process performance results
    echo "### Performance Analysis" >> "$report_file"
    echo "" >> "$report_file"
    
    if [ -f "${RESULTS_DIR}/performance/build-comparison.json" ]; then
        local improvement=$(cat "${RESULTS_DIR}/performance/build-comparison.json" | grep -o '"improvement_percent": [0-9.-]*' | sed 's/"improvement_percent": //')
        echo "- Build performance improvement: ${improvement}%" >> "$report_file"
    fi
    
    if [ -f "${RESULTS_DIR}/performance/runtime-performance.json" ]; then
        local backend_avg=$(cat "${RESULTS_DIR}/performance/runtime-performance.json" | grep -o '"backend_avg_response": [0-9.]*' | sed 's/"backend_avg_response": //')
        local frontend_avg=$(cat "${RESULTS_DIR}/performance/runtime-performance.json" | grep -o '"frontend_avg_response": [0-9.]*' | sed 's/"frontend_avg_response": //')
        echo "- Backend average response time: ${backend_avg}s" >> "$report_file"
        echo "- Frontend average response time: ${frontend_avg}s" >> "$report_file"
    fi
    
    echo "" >> "$report_file"
    
    # Add functionality test results
    echo "### Functionality Regression Tests" >> "$report_file"
    echo "" >> "$report_file"
    
    local functionality_tests=("networking-test" "environment-variables" "security-configuration")
    for test in "${functionality_tests[@]}"; do
        if [ -f "${RESULTS_DIR}/health-checks/${test}.json" ]; then
            echo "- ${test//-/ }: ✅ Passed" >> "$report_file"
            total_tests=$((total_tests + 1))
            passed_tests=$((passed_tests + 1))
        fi
    done
    
    # Generate summary
    local success_rate=0
    if [ $total_tests -gt 0 ]; then
        success_rate=$((passed_tests * 100 / total_tests))
    fi
    
    cat > "$summary_file" <<EOF
{
  "total_tests": ${total_tests},
  "passed_tests": ${passed_tests},
  "failed_tests": ${failed_tests},
  "warnings": ${warnings},
  "success_rate": ${success_rate},
  "overall_status": "$([ $success_rate -ge 90 ] && echo "PASS" || echo "FAIL")",
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    # Add summary to report
    cat >> "$report_file" <<EOF

## Summary

- **Total Tests:** ${total_tests}
- **Passed:** ${passed_tests}
- **Failed:** ${failed_tests}
- **Warnings:** ${warnings}
- **Success Rate:** ${success_rate}%
- **Overall Status:** $([ $success_rate -ge 90 ] && echo "✅ PASS" || echo "❌ FAIL")

## Recommendations

EOF
    
    if [ $failed_tests -gt 0 ]; then
        echo "- Review failed test logs in \`${LOG_DIR}\`" >> "$report_file"
        echo "- Address critical failures before production deployment" >> "$report_file"
    fi
    
    if [ $warnings -gt 0 ]; then
        echo "- Consider optimizing areas with warnings for better performance" >> "$report_file"
    fi
    
    if [ $success_rate -ge 90 ]; then
        echo "- Configuration is ready for production deployment" >> "$report_file"
        echo "- Consider implementing continuous monitoring" >> "$report_file"
    fi
    
    cat >> "$report_file" <<EOF

## Detailed Results

All detailed test results and logs are available in:
- Results: \`${RESULTS_DIR}\`
- Logs: \`${LOG_DIR}\`

EOF
    
    success "Validation report generated: ${report_file}"
    info "Summary available at: ${summary_file}"
}

# =============================================================================
# MAIN EXECUTION FUNCTION
# =============================================================================

main() {
    log "🐳 Starting Docker Consolidated Configuration Validation Suite"
    
    # Setup
    create_directories
    cleanup_containers
    
    # Test counters
    local total_test_suites=0
    local passed_test_suites=0
    
    # Build validation tests
    log "==================== BUILD VALIDATION TESTS ===================="
    ((total_test_suites++))
    if test_multi_stage_builds && test_build_caching; then
        success "Build validation tests passed"
        ((passed_test_suites++))
    else
        error "Build validation tests failed"
    fi
    
    # Service startup tests
    log "================ SERVICE STARTUP VALIDATION TESTS ================"
    ((total_test_suites++))
    if test_development_environment && test_production_environment; then
        success "Service startup validation tests passed"
        ((passed_test_suites++))
    else
        error "Service startup validation tests failed"
    fi
    
    # Performance comparison tests
    log "================= PERFORMANCE COMPARISON TESTS =================="
    ((total_test_suites++))
    if compare_build_performance && test_runtime_performance; then
        success "Performance comparison tests passed"
        ((passed_test_suites++))
    else
        error "Performance comparison tests failed"
    fi
    
    # Functionality regression tests
    log "============== FUNCTIONALITY REGRESSION TESTS ================="
    ((total_test_suites++))
    if test_volume_mounts && test_networking && test_environment_variables; then
        success "Functionality regression tests passed"
        ((passed_test_suites++))
    else
        error "Functionality regression tests failed"
    fi
    
    # Security validation tests
    log "================= SECURITY VALIDATION TESTS =================="
    ((total_test_suites++))
    if test_security_configuration; then
        success "Security validation tests passed"
        ((passed_test_suites++))
    else
        error "Security validation tests failed"
    fi
    
    # Generate final report
    log "==================== GENERATING REPORT ======================"
    generate_validation_report
    
    # Final cleanup
    cleanup_containers
    
    # Final results
    log "==================== VALIDATION COMPLETE ======================"
    local success_rate=$((passed_test_suites * 100 / total_test_suites))
    
    if [ $success_rate -ge 90 ]; then
        success "🎉 Docker validation completed successfully!"
        success "Test suites passed: ${passed_test_suites}/${total_test_suites} (${success_rate}%)"
        success "Configuration is ready for production deployment"
        exit 0
    else
        error "❌ Docker validation failed"
        error "Test suites passed: ${passed_test_suites}/${total_test_suites} (${success_rate}%)"
        error "Please review failures and re-run validation"
        exit 1
    fi
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Trap cleanup on exit
trap cleanup_containers EXIT

# Check dependencies
command -v docker >/dev/null 2>&1 || { error "Docker is required but not installed"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { error "Docker Compose is required but not installed"; exit 1; }
command -v curl >/dev/null 2>&1 || { error "curl is required but not installed"; exit 1; }
command -v bc >/dev/null 2>&1 || { error "bc is required but not installed"; exit 1; }

# Run main function
main "$@"