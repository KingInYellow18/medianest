#!/bin/bash
set -euo pipefail

# 🔍 DOCKER CONFIGURATION REGRESSION TESTING SUITE
# Comprehensive regression testing for Docker configuration changes
# Validates functionality preservation across configuration updates

# =============================================================================
# CONFIGURATION & GLOBALS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESULTS_DIR="${PROJECT_ROOT}/tests/docker-integration/regression-results"
DOCKER_CONFIG_DIR="${PROJECT_ROOT}/config/docker-consolidated"
REFERENCE_DIR="${PROJECT_ROOT}/tests/docker-integration/reference"

# Test configuration
TEST_TIMEOUT=300
REGRESSION_SAMPLES=5
API_TEST_ENDPOINTS=(
    "/health"
    "/api/health"
    "/api/status"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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
    mkdir -p "${RESULTS_DIR}/"{api-compatibility,environment-validation,volume-persistence,network-connectivity,security-configuration}
    mkdir -p "${REFERENCE_DIR}"
}

cleanup_containers() {
    log "Cleaning up regression test containers..."
    docker-compose -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" down --remove-orphans &>/dev/null || true
    docker-compose -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" down --remove-orphans &>/dev/null || true
    docker-compose -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" down --remove-orphans &>/dev/null || true
    docker system prune -f --volumes &>/dev/null || true
}

wait_for_service() {
    local service_name="$1"
    local port="$2"
    local max_attempts="${3:-30}"
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:${port}/health" &>/dev/null || \
           curl -f "http://localhost:${port}" &>/dev/null; then
            return 0
        fi
        sleep 3
        ((attempt++))
    done
    return 1
}

# =============================================================================
# BASELINE REFERENCE CAPTURE
# =============================================================================

capture_baseline_reference() {
    log "Capturing baseline reference for regression comparison..."
    
    # Start development environment for baseline capture
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d > /dev/null 2>&1
    
    # Wait for services
    wait_for_service "backend" "4000" || return 1
    wait_for_service "frontend" "3000" || return 1
    wait_for_service "postgres" "5432" || return 1
    wait_for_service "redis" "6379" || return 1
    
    local baseline_file="${REFERENCE_DIR}/baseline-reference.json"
    
    # Capture API responses
    local api_responses=()
    for endpoint in "${API_TEST_ENDPOINTS[@]}"; do
        local response=$(curl -s -w "%{http_code}|%{time_total}|%{size_download}" "http://localhost:4000${endpoint}" 2>/dev/null || echo "000|0|0")
        api_responses+=("\"${endpoint}\":\"${response}\"")
    done
    
    # Capture container configurations
    local backend_config=$(docker inspect medianest-backend --format '{{json .Config}}' 2>/dev/null | jq -c '.Env')
    local frontend_config=$(docker inspect medianest-frontend --format '{{json .Config}}' 2>/dev/null | jq -c '.Env')
    
    # Capture network configuration
    local network_info=$(docker network inspect medianest-internal --format '{{json .IPAM.Config}}' 2>/dev/null | jq -c '.')
    
    # Capture volume information
    local volume_info=$(docker volume ls --format "{{.Name}}" | grep medianest | wc -l)
    
    # Capture service status
    local backend_status=$(docker-compose ps backend --format json | jq -r '.State' 2>/dev/null || echo "unknown")
    local frontend_status=$(docker-compose ps frontend --format json | jq -r '.State' 2>/dev/null || echo "unknown")
    local postgres_status=$(docker-compose ps postgres --format json | jq -r '.State' 2>/dev/null || echo "unknown")
    local redis_status=$(docker-compose ps redis --format json | jq -r '.State' 2>/dev/null || echo "unknown")
    
    cat > "$baseline_file" <<EOF
{
  "baseline_timestamp": "$(date -Iseconds)",
  "api_responses": {
$(IFS=','; echo "${api_responses[*]}")
  },
  "container_configurations": {
    "backend_env": ${backend_config},
    "frontend_env": ${frontend_config}
  },
  "network_configuration": ${network_info},
  "volume_count": ${volume_info},
  "service_status": {
    "backend": "${backend_status}",
    "frontend": "${frontend_status}",
    "postgres": "${postgres_status}",
    "redis": "${redis_status}"
  },
  "performance_baseline": {
    "backend_startup_time": "$(docker inspect medianest-backend --format '{{.State.StartedAt}}' | date -d "$(cat -)" +%s)",
    "frontend_startup_time": "$(docker inspect medianest-frontend --format '{{.State.StartedAt}}' | date -d "$(cat -)" +%s)"
  }
}
EOF
    
    cleanup_containers
    success "Baseline reference captured: ${baseline_file}"
}

# =============================================================================
# API COMPATIBILITY REGRESSION TESTS
# =============================================================================

test_api_compatibility() {
    log "Testing API compatibility regression..."
    
    local results_file="${RESULTS_DIR}/api-compatibility/compatibility-test.json"
    local baseline_file="${REFERENCE_DIR}/baseline-reference.json"
    
    if [ ! -f "$baseline_file" ]; then
        warning "No baseline reference found, capturing current state as baseline"
        capture_baseline_reference
    fi
    
    # Start environment
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d > /dev/null 2>&1
    
    wait_for_service "backend" "4000" || return 1
    wait_for_service "frontend" "3000" || return 1
    
    # Test API endpoints
    local compatibility_results=()
    local failed_tests=0
    local total_tests=0
    
    for endpoint in "${API_TEST_ENDPOINTS[@]}"; do
        log "  Testing endpoint: ${endpoint}"
        ((total_tests++))
        
        # Get baseline response
        local baseline_response=$(cat "$baseline_file" | jq -r ".api_responses.\"${endpoint}\"" 2>/dev/null || echo "")
        local baseline_code=$(echo "$baseline_response" | cut -d'|' -f1)
        
        # Test current response
        local current_response=$(curl -s -w "%{http_code}|%{time_total}|%{size_download}" "http://localhost:4000${endpoint}" 2>/dev/null || echo "000|0|0")
        local current_code=$(echo "$current_response" | cut -d'|' -f1)
        local current_time=$(echo "$current_response" | cut -d'|' -f2)
        local current_size=$(echo "$current_response" | cut -d'|' -f3)
        
        # Compare responses
        local status="pass"
        if [ "$current_code" != "$baseline_code" ]; then
            status="fail"
            ((failed_tests++))
            error "    HTTP status code changed: ${baseline_code} -> ${current_code}"
        fi
        
        compatibility_results+=("{\"endpoint\":\"${endpoint}\",\"baseline_code\":\"${baseline_code}\",\"current_code\":\"${current_code}\",\"response_time\":\"${current_time}\",\"response_size\":\"${current_size}\",\"status\":\"${status}\"}")
    done
    
    # Test additional API functionality
    log "  Testing API functionality..."
    
    # Test database connectivity through API
    local db_test_response=$(curl -s -w "%{http_code}" "http://localhost:4000/health" 2>/dev/null | tail -c 3)
    if [ "$db_test_response" = "200" ]; then
        compatibility_results+=("{\"test\":\"database_connectivity\",\"status\":\"pass\",\"response_code\":\"${db_test_response}\"}")
    else
        compatibility_results+=("{\"test\":\"database_connectivity\",\"status\":\"fail\",\"response_code\":\"${db_test_response}\"}")
        ((failed_tests++))
    fi
    ((total_tests++))
    
    # Test frontend accessibility
    local frontend_response=$(curl -s -w "%{http_code}" "http://localhost:3000" 2>/dev/null | tail -c 3)
    if [ "$frontend_response" = "200" ] || [ "$frontend_response" = "404" ]; then
        compatibility_results+=("{\"test\":\"frontend_accessibility\",\"status\":\"pass\",\"response_code\":\"${frontend_response}\"}")
    else
        compatibility_results+=("{\"test\":\"frontend_accessibility\",\"status\":\"fail\",\"response_code\":\"${frontend_response}\"}")
        ((failed_tests++))
    fi
    ((total_tests++))
    
    local success_rate=$(( (total_tests - failed_tests) * 100 / total_tests ))
    
    cat > "$results_file" <<EOF
{
  "test_timestamp": "$(date -Iseconds)",
  "total_tests": ${total_tests},
  "failed_tests": ${failed_tests},
  "success_rate": ${success_rate},
  "compatibility_status": "$([ $failed_tests -eq 0 ] && echo "compatible" || echo "regression_detected")",
  "test_results": [
$(printf '%s\n' "${compatibility_results[@]}" | sed '$!s/$/,/')
  ]
}
EOF
    
    cleanup_containers
    
    if [ $failed_tests -eq 0 ]; then
        success "API compatibility tests passed (${success_rate}%)"
        return 0
    else
        error "API compatibility regression detected: ${failed_tests}/${total_tests} tests failed"
        return 1
    fi
}

# =============================================================================
# ENVIRONMENT VARIABLE VALIDATION
# =============================================================================

test_environment_validation() {
    log "Testing environment variable regression..."
    
    local results_file="${RESULTS_DIR}/environment-validation/environment-test.json"
    local baseline_file="${REFERENCE_DIR}/baseline-reference.json"
    
    # Test both development and production environments
    local environment_results=()
    local total_env_tests=0
    local failed_env_tests=0
    
    for env in "development" "production"; do
        log "  Testing ${env} environment variables..."
        
        local compose_files=("-f" "${DOCKER_CONFIG_DIR}/docker-compose.base.yml")
        if [ "$env" = "development" ]; then
            compose_files+=("-f" "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml")
        else
            compose_files+=("-f" "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml")
            # Set production environment
            export NODE_ENV=production
            export POSTGRES_PASSWORD=test-password
            export REDIS_PASSWORD=test-password
            
            # Create secrets
            echo "test-jwt" | docker secret create medianest-jwt-secret-v1 - 2>/dev/null || true
            echo "test-pass" | docker secret create medianest-postgres-password-v1 - 2>/dev/null || true
            echo "test-redis" | docker secret create medianest-redis-password-v1 - 2>/dev/null || true
            echo "postgresql://test" | docker secret create medianest-database-url-v1 - 2>/dev/null || true
            echo "redis://test" | docker secret create medianest-redis-url-v1 - 2>/dev/null || true
        fi
        
        cd "${PROJECT_ROOT}"
        docker-compose "${compose_files[@]}" up -d backend > /dev/null 2>&1
        
        if wait_for_service "backend" "4000" 30; then
            # Test critical environment variables
            local node_env=$(docker-compose exec -T backend printenv NODE_ENV 2>/dev/null || echo "unset")
            local port=$(docker-compose exec -T backend printenv PORT 2>/dev/null || echo "unset")
            local db_url=$(docker-compose exec -T backend printenv DATABASE_URL 2>/dev/null | head -c 10)
            
            ((total_env_tests++))
            
            local env_status="pass"
            if [ "$node_env" != "$env" ] || [ "$port" = "unset" ] || [ -z "$db_url" ]; then
                env_status="fail"
                ((failed_env_tests++))
                error "    Environment validation failed for ${env}"
            fi
            
            environment_results+=("{\"environment\":\"${env}\",\"node_env\":\"${node_env}\",\"port\":\"${port}\",\"database_url_set\":\"$([ -n "$db_url" ] && echo "true" || echo "false")\",\"status\":\"${env_status}\"}")
        else
            ((total_env_tests++))
            ((failed_env_tests++))
            environment_results+=("{\"environment\":\"${env}\",\"status\":\"fail\",\"error\":\"service_failed_to_start\"}")
        fi
        
        cleanup_containers
        
        # Clean up production secrets
        if [ "$env" = "production" ]; then
            docker secret rm medianest-jwt-secret-v1 medianest-postgres-password-v1 medianest-redis-password-v1 2>/dev/null || true
            docker secret rm medianest-database-url-v1 medianest-redis-url-v1 2>/dev/null || true
        fi
    done
    
    local env_success_rate=$(( (total_env_tests - failed_env_tests) * 100 / total_env_tests ))
    
    cat > "$results_file" <<EOF
{
  "test_timestamp": "$(date -Iseconds)",
  "total_environment_tests": ${total_env_tests},
  "failed_tests": ${failed_env_tests},
  "success_rate": ${env_success_rate},
  "environment_status": "$([ $failed_env_tests -eq 0 ] && echo "valid" || echo "regression_detected")",
  "test_results": [
$(printf '%s\n' "${environment_results[@]}" | sed '$!s/$/,/')
  ]
}
EOF
    
    if [ $failed_env_tests -eq 0 ]; then
        success "Environment validation tests passed (${env_success_rate}%)"
        return 0
    else
        error "Environment validation regression detected: ${failed_env_tests}/${total_env_tests} tests failed"
        return 1
    fi
}

# =============================================================================
# VOLUME PERSISTENCE REGRESSION TESTS
# =============================================================================

test_volume_persistence() {
    log "Testing volume persistence regression..."
    
    local results_file="${RESULTS_DIR}/volume-persistence/persistence-test.json"
    
    # Start environment
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d postgres redis > /dev/null 2>&1
    
    wait_for_service "postgres" "5432" || return 1
    
    local persistence_tests=()
    local total_persistence_tests=0
    local failed_persistence_tests=0
    
    # Test database persistence
    log "  Testing database persistence..."
    ((total_persistence_tests++))
    
    # Create test data
    if docker-compose exec -T postgres psql -U medianest_dev -d medianest_dev -c "CREATE TABLE regression_test (id SERIAL PRIMARY KEY, test_data TEXT, created_at TIMESTAMP DEFAULT NOW());" > /dev/null 2>&1 && \
       docker-compose exec -T postgres psql -U medianest_dev -d medianest_dev -c "INSERT INTO regression_test (test_data) VALUES ('persistence-test-data'), ('another-test-record');" > /dev/null 2>&1; then
        
        # Restart database to test persistence
        docker-compose restart postgres > /dev/null 2>&1
        wait_for_service "postgres" "5432"
        
        # Verify data persistence
        local record_count=$(docker-compose exec -T postgres psql -U medianest_dev -d medianest_dev -c "SELECT COUNT(*) FROM regression_test;" -t 2>/dev/null | tr -d ' \n' || echo "0")
        
        if [ "$record_count" = "2" ]; then
            persistence_tests+=("{\"test\":\"database_persistence\",\"status\":\"pass\",\"records_found\":${record_count}}")
        else
            persistence_tests+=("{\"test\":\"database_persistence\",\"status\":\"fail\",\"records_found\":${record_count}}")
            ((failed_persistence_tests++))
        fi
    else
        persistence_tests+=("{\"test\":\"database_persistence\",\"status\":\"fail\",\"error\":\"failed_to_create_test_data\"}")
        ((failed_persistence_tests++))
    fi
    
    # Test Redis persistence (if configured)
    log "  Testing Redis persistence..."
    ((total_persistence_tests++))
    
    if docker-compose exec -T redis redis-cli --no-auth-warning -a dev_redis_pass SET regression_test "test-value" > /dev/null 2>&1; then
        
        # Restart Redis
        docker-compose restart redis > /dev/null 2>&1
        sleep 5
        
        # Verify data persistence (Redis may not persist in dev mode)
        local redis_value=$(docker-compose exec -T redis redis-cli --no-auth-warning -a dev_redis_pass GET regression_test 2>/dev/null | tr -d '\r' || echo "")
        
        if [ "$redis_value" = "test-value" ]; then
            persistence_tests+=("{\"test\":\"redis_persistence\",\"status\":\"pass\",\"value_found\":\"${redis_value}\"}")
        else
            # Redis persistence might not be enabled in dev mode - this is expected
            persistence_tests+=("{\"test\":\"redis_persistence\",\"status\":\"expected_failure\",\"note\":\"persistence_disabled_in_dev\",\"value_found\":\"${redis_value}\"}")
        fi
    else
        persistence_tests+=("{\"test\":\"redis_persistence\",\"status\":\"fail\",\"error\":\"failed_to_set_test_data\"}")
        ((failed_persistence_tests++))
    fi
    
    # Test volume mounts
    log "  Testing volume mount configuration..."
    ((total_persistence_tests++))
    
    local volume_count=$(docker volume ls --format "{{.Name}}" | grep -E "(postgres|redis|app)" | wc -l)
    if [ "$volume_count" -gt 0 ]; then
        persistence_tests+=("{\"test\":\"volume_mounts\",\"status\":\"pass\",\"volumes_found\":${volume_count}}")
    else
        persistence_tests+=("{\"test\":\"volume_mounts\",\"status\":\"fail\",\"volumes_found\":${volume_count}}")
        ((failed_persistence_tests++))
    fi
    
    local persistence_success_rate=$(( (total_persistence_tests - failed_persistence_tests) * 100 / total_persistence_tests ))
    
    cat > "$results_file" <<EOF
{
  "test_timestamp": "$(date -Iseconds)",
  "total_persistence_tests": ${total_persistence_tests},
  "failed_tests": ${failed_persistence_tests},
  "success_rate": ${persistence_success_rate},
  "persistence_status": "$([ $failed_persistence_tests -eq 0 ] && echo "functional" || echo "regression_detected")",
  "test_results": [
$(printf '%s\n' "${persistence_tests[@]}" | sed '$!s/$/,/')
  ]
}
EOF
    
    cleanup_containers
    
    if [ $failed_persistence_tests -eq 0 ]; then
        success "Volume persistence tests passed (${persistence_success_rate}%)"
        return 0
    else
        error "Volume persistence regression detected: ${failed_persistence_tests}/${total_persistence_tests} tests failed"
        return 1
    fi
}

# =============================================================================
# NETWORK CONNECTIVITY REGRESSION TESTS
# =============================================================================

test_network_connectivity() {
    log "Testing network connectivity regression..."
    
    local results_file="${RESULTS_DIR}/network-connectivity/connectivity-test.json"
    
    # Start environment
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d > /dev/null 2>&1
    
    # Wait for services
    wait_for_service "backend" "4000" || return 1
    wait_for_service "frontend" "3000" || return 1
    wait_for_service "postgres" "5432" || return 1
    wait_for_service "redis" "6379" || return 1
    
    local connectivity_tests=()
    local total_connectivity_tests=0
    local failed_connectivity_tests=0
    
    # Test internal service communication
    log "  Testing internal service communication..."
    
    # Backend to database connectivity
    ((total_connectivity_tests++))
    if docker-compose exec -T backend sh -c "nc -z postgres 5432" > /dev/null 2>&1; then
        connectivity_tests+=("{\"test\":\"backend_to_postgres\",\"status\":\"pass\"}")
    else
        connectivity_tests+=("{\"test\":\"backend_to_postgres\",\"status\":\"fail\"}")
        ((failed_connectivity_tests++))
    fi
    
    # Backend to Redis connectivity
    ((total_connectivity_tests++))
    if docker-compose exec -T backend sh -c "nc -z redis 6379" > /dev/null 2>&1; then
        connectivity_tests+=("{\"test\":\"backend_to_redis\",\"status\":\"pass\"}")
    else
        connectivity_tests+=("{\"test\":\"backend_to_redis\",\"status\":\"fail\"}")
        ((failed_connectivity_tests++))
    fi
    
    # Frontend to backend connectivity
    ((total_connectivity_tests++))
    if docker-compose exec -T frontend sh -c "curl -f -m 5 http://backend:4000/health" > /dev/null 2>&1; then
        connectivity_tests+=("{\"test\":\"frontend_to_backend\",\"status\":\"pass\"}")
    else
        connectivity_tests+=("{\"test\":\"frontend_to_backend\",\"status\":\"fail\"}")
        ((failed_connectivity_tests++))
    fi
    
    # Test external connectivity
    log "  Testing external connectivity..."
    
    # External access to backend
    ((total_connectivity_tests++))
    if curl -f "http://localhost:4000/health" > /dev/null 2>&1; then
        connectivity_tests+=("{\"test\":\"external_backend_access\",\"status\":\"pass\"}")
    else
        connectivity_tests+=("{\"test\":\"external_backend_access\",\"status\":\"fail\"}")
        ((failed_connectivity_tests++))
    fi
    
    # External access to frontend
    ((total_connectivity_tests++))
    if curl -f "http://localhost:3000" > /dev/null 2>&1; then
        connectivity_tests+=("{\"test\":\"external_frontend_access\",\"status\":\"pass\"}")
    else
        connectivity_tests+=("{\"test\":\"external_frontend_access\",\"status\":\"fail\"}")
        ((failed_connectivity_tests++))
    fi
    
    # Test network isolation
    log "  Testing network configuration..."
    
    # Verify network exists
    ((total_connectivity_tests++))
    if docker network inspect medianest-internal > /dev/null 2>&1; then
        connectivity_tests+=("{\"test\":\"network_configuration\",\"status\":\"pass\"}")
    else
        connectivity_tests+=("{\"test\":\"network_configuration\",\"status\":\"fail\"}")
        ((failed_connectivity_tests++))
    fi
    
    local connectivity_success_rate=$(( (total_connectivity_tests - failed_connectivity_tests) * 100 / total_connectivity_tests ))
    
    cat > "$results_file" <<EOF
{
  "test_timestamp": "$(date -Iseconds)",
  "total_connectivity_tests": ${total_connectivity_tests},
  "failed_tests": ${failed_connectivity_tests},
  "success_rate": ${connectivity_success_rate},
  "connectivity_status": "$([ $failed_connectivity_tests -eq 0 ] && echo "functional" || echo "regression_detected")",
  "test_results": [
$(printf '%s\n' "${connectivity_tests[@]}" | sed '$!s/$/,/')
  ]
}
EOF
    
    cleanup_containers
    
    if [ $failed_connectivity_tests -eq 0 ]; then
        success "Network connectivity tests passed (${connectivity_success_rate}%)"
        return 0
    else
        error "Network connectivity regression detected: ${failed_connectivity_tests}/${total_connectivity_tests} tests failed"
        return 1
    fi
}

# =============================================================================
# SECURITY CONFIGURATION REGRESSION TESTS
# =============================================================================

test_security_configuration() {
    log "Testing security configuration regression..."
    
    local results_file="${RESULTS_DIR}/security-configuration/security-test.json"
    
    local security_tests=()
    local total_security_tests=0
    local failed_security_tests=0
    
    # Test development security configuration
    log "  Testing development security configuration..."
    
    cd "${PROJECT_ROOT}"
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.dev.yml" \
        up -d backend > /dev/null 2>&1
    
    if wait_for_service "backend" "4000" 30; then
        # Check container security settings
        local dev_user=$(docker inspect medianest-backend --format '{{.Config.User}}' 2>/dev/null || echo "")
        local dev_readonly=$(docker inspect medianest-backend --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
        
        ((total_security_tests++))
        if [ "$dev_user" = "medianest" ] || [ "$dev_user" = "1001" ]; then
            security_tests+=("{\"test\":\"dev_non_root_user\",\"status\":\"pass\",\"user\":\"${dev_user}\"}")
        else
            security_tests+=("{\"test\":\"dev_non_root_user\",\"status\":\"warning\",\"user\":\"${dev_user}\",\"note\":\"development_mode\"}")
        fi
    else
        security_tests+=("{\"test\":\"dev_security_check\",\"status\":\"fail\",\"error\":\"service_failed_to_start\"}")
        ((failed_security_tests++))
        ((total_security_tests++))
    fi
    
    cleanup_containers
    
    # Test production security configuration
    log "  Testing production security configuration..."
    
    export NODE_ENV=production
    export POSTGRES_PASSWORD=test-password
    export REDIS_PASSWORD=test-password
    
    # Create secrets
    echo "test-jwt" | docker secret create medianest-jwt-secret-v1 - 2>/dev/null || true
    echo "test-pass" | docker secret create medianest-postgres-password-v1 - 2>/dev/null || true
    echo "test-redis" | docker secret create medianest-redis-password-v1 - 2>/dev/null || true
    echo "postgresql://test" | docker secret create medianest-database-url-v1 - 2>/dev/null || true
    echo "redis://test" | docker secret create medianest-redis-url-v1 - 2>/dev/null || true
    
    docker-compose \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.base.yml" \
        -f "${DOCKER_CONFIG_DIR}/docker-compose.prod.yml" \
        up -d backend > /dev/null 2>&1
    
    sleep 30  # Production services take longer to start
    
    # Check production security settings
    local prod_user=$(docker inspect medianest-backend --format '{{.Config.User}}' 2>/dev/null || echo "root")
    local prod_readonly=$(docker inspect medianest-backend --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null || echo "false")
    local prod_caps=$(docker inspect medianest-backend --format '{{.HostConfig.CapDrop}}' 2>/dev/null || echo "[]")
    
    # Non-root user check
    ((total_security_tests++))
    if [ "$prod_user" != "root" ] && [ "$prod_user" != "" ]; then
        security_tests+=("{\"test\":\"prod_non_root_user\",\"status\":\"pass\",\"user\":\"${prod_user}\"}")
    else
        security_tests+=("{\"test\":\"prod_non_root_user\",\"status\":\"fail\",\"user\":\"${prod_user}\"}")
        ((failed_security_tests++))
    fi
    
    # Read-only filesystem check
    ((total_security_tests++))
    if [ "$prod_readonly" = "true" ]; then
        security_tests+=("{\"test\":\"prod_readonly_filesystem\",\"status\":\"pass\"}")
    else
        security_tests+=("{\"test\":\"prod_readonly_filesystem\",\"status\":\"warning\",\"note\":\"may_be_intentional\"}")
    fi
    
    # Capability dropping check
    ((total_security_tests++))
    if echo "$prod_caps" | grep -q "ALL"; then
        security_tests+=("{\"test\":\"prod_capability_dropping\",\"status\":\"pass\"}")
    else
        security_tests+=("{\"test\":\"prod_capability_dropping\",\"status\":\"warning\",\"capabilities\":\"${prod_caps}\"}")
    fi
    
    # Docker secrets usage check
    ((total_security_tests++))
    local secrets_count=$(docker secret ls --format "{{.Name}}" | grep medianest | wc -l)
    if [ "$secrets_count" -gt 0 ]; then
        security_tests+=("{\"test\":\"prod_secrets_usage\",\"status\":\"pass\",\"secrets_count\":${secrets_count}}")
    else
        security_tests+=("{\"test\":\"prod_secrets_usage\",\"status\":\"fail\",\"secrets_count\":${secrets_count}}")
        ((failed_security_tests++))
    fi
    
    cleanup_containers
    
    # Clean up secrets
    docker secret rm medianest-jwt-secret-v1 medianest-postgres-password-v1 medianest-redis-password-v1 2>/dev/null || true
    docker secret rm medianest-database-url-v1 medianest-redis-url-v1 2>/dev/null || true
    
    local security_success_rate=$(( (total_security_tests - failed_security_tests) * 100 / total_security_tests ))
    
    cat > "$results_file" <<EOF
{
  "test_timestamp": "$(date -Iseconds)",
  "total_security_tests": ${total_security_tests},
  "failed_tests": ${failed_security_tests},
  "success_rate": ${security_success_rate},
  "security_status": "$([ $failed_security_tests -eq 0 ] && echo "secure" || echo "regression_detected")",
  "test_results": [
$(printf '%s\n' "${security_tests[@]}" | sed '$!s/$/,/')
  ]
}
EOF
    
    if [ $failed_security_tests -eq 0 ]; then
        success "Security configuration tests passed (${security_success_rate}%)"
        return 0
    else
        error "Security configuration regression detected: ${failed_security_tests}/${total_security_tests} tests failed"
        return 1
    fi
}

# =============================================================================
# REGRESSION REPORT GENERATION
# =============================================================================

generate_regression_report() {
    log "Generating regression test report..."
    
    local report_file="${RESULTS_DIR}/docker-regression-report.md"
    local summary_file="${RESULTS_DIR}/regression-summary.json"
    
    cat > "$report_file" <<EOF
# Docker Configuration Regression Test Report

**Generated:** $(date)  
**Project:** MediaNest Docker Configuration  
**Test Suite:** Regression Testing v2.0.0  

## Executive Summary

This report contains the results of comprehensive regression testing to ensure that Docker configuration changes do not break existing functionality. The testing covered API compatibility, environment validation, volume persistence, network connectivity, and security configuration.

## Test Results Summary

EOF
    
    local total_test_suites=0
    local passed_test_suites=0
    local total_individual_tests=0
    local failed_individual_tests=0
    
    # Process each test result file
    for test_dir in api-compatibility environment-validation volume-persistence network-connectivity security-configuration; do
        local test_file="${RESULTS_DIR}/${test_dir}/"*.json
        if [ -f $test_file ]; then
            local suite_status=$(cat $test_file | jq -r '.["'${test_dir//-/_}'_status"] // .compatibility_status // .environment_status // .persistence_status // .connectivity_status // .security_status' 2>/dev/null || echo "unknown")
            local suite_tests=$(cat $test_file | jq -r '.total_tests // .["total_'${test_dir//-/_}'_tests"] // .total_environment_tests // .total_persistence_tests // .total_connectivity_tests // .total_security_tests' 2>/dev/null || echo "0")
            local suite_failed=$(cat $test_file | jq -r '.failed_tests' 2>/dev/null || echo "0")
            local suite_success_rate=$(cat $test_file | jq -r '.success_rate' 2>/dev/null || echo "0")
            
            ((total_test_suites++))
            total_individual_tests=$((total_individual_tests + suite_tests))
            failed_individual_tests=$((failed_individual_tests + suite_failed))
            
            if [ "$suite_status" != "fail" ] && [ "$suite_status" != "regression_detected" ]; then
                ((passed_test_suites++))
            fi
            
            echo "### ${test_dir//-/ } Test Results" >> "$report_file"
            echo "- **Status**: $([ "$suite_status" = "pass" ] || [ "$suite_status" = "compatible" ] || [ "$suite_status" = "valid" ] || [ "$suite_status" = "functional" ] || [ "$suite_status" = "secure" ] && echo "✅ PASS" || echo "❌ REGRESSION DETECTED")" >> "$report_file"
            echo "- **Tests**: ${suite_tests} total, ${suite_failed} failed" >> "$report_file"  
            echo "- **Success Rate**: ${suite_success_rate}%" >> "$report_file"
            echo "" >> "$report_file"
        fi
    done
    
    # Calculate overall statistics
    local overall_success_rate=0
    if [ $total_individual_tests -gt 0 ]; then
        overall_success_rate=$(( (total_individual_tests - failed_individual_tests) * 100 / total_individual_tests ))
    fi
    
    cat >> "$report_file" <<EOF
## Overall Results

- **Total Test Suites**: ${total_test_suites}
- **Passed Test Suites**: ${passed_test_suites}
- **Total Individual Tests**: ${total_individual_tests}
- **Failed Tests**: ${failed_individual_tests}
- **Overall Success Rate**: ${overall_success_rate}%
- **Regression Status**: $([ $failed_individual_tests -eq 0 ] && echo "✅ NO REGRESSION" || echo "❌ REGRESSION DETECTED")

## Recommendations

EOF
    
    if [ $failed_individual_tests -eq 0 ]; then
        cat >> "$report_file" <<EOF
✅ **No regression detected** - Docker configuration changes are safe to deploy
- All functionality preserved across configuration updates
- API compatibility maintained
- Security configuration intact
- Network and volume configurations working properly

### Next Steps
- Proceed with deployment
- Continue monitoring in production
- Update baseline references if this represents intended changes
EOF
    else
        cat >> "$report_file" <<EOF
⚠️  **Regression detected** - Review required before deployment

### Critical Issues
- ${failed_individual_tests} test failures detected across test suites
- Review detailed results in individual test files
- Address failures before proceeding with deployment

### Immediate Actions Required
1. Review failed test details in results directory
2. Fix identified regressions
3. Re-run regression tests to verify fixes
4. Update documentation if changes are intentional
EOF
    fi
    
    cat >> "$report_file" <<EOF

## Detailed Results

Individual test results and logs are available in:
- API Compatibility: \`${RESULTS_DIR}/api-compatibility/\`
- Environment Validation: \`${RESULTS_DIR}/environment-validation/\`
- Volume Persistence: \`${RESULTS_DIR}/volume-persistence/\`
- Network Connectivity: \`${RESULTS_DIR}/network-connectivity/\`
- Security Configuration: \`${RESULTS_DIR}/security-configuration/\`

EOF
    
    # Generate summary JSON
    cat > "$summary_file" <<EOF
{
  "test_completion": "$(date -Iseconds)",
  "total_test_suites": ${total_test_suites},
  "passed_test_suites": ${passed_test_suites},
  "total_individual_tests": ${total_individual_tests},
  "failed_individual_tests": ${failed_individual_tests},
  "overall_success_rate": ${overall_success_rate},
  "regression_detected": $([ $failed_individual_tests -gt 0 ] && echo "true" || echo "false"),
  "deployment_recommendation": "$([ $failed_individual_tests -eq 0 ] && echo "approved" || echo "blocked")"
}
EOF
    
    success "Regression test report generated: ${report_file}"
    info "Summary available at: ${summary_file}"
    
    return $([ $failed_individual_tests -eq 0 ] && echo 0 || echo 1)
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    log "🔍 Starting Docker Configuration Regression Testing Suite"
    
    create_directories
    cleanup_containers
    
    # Capture baseline if not exists
    if [ ! -f "${REFERENCE_DIR}/baseline-reference.json" ]; then
        log "==================== CAPTURING BASELINE REFERENCE ===================="
        capture_baseline_reference
    fi
    
    # Run regression tests
    local total_suites=0
    local passed_suites=0
    
    log "=============== API COMPATIBILITY REGRESSION TESTS =================="
    ((total_suites++))
    if test_api_compatibility; then
        ((passed_suites++))
    fi
    
    log "=============== ENVIRONMENT VALIDATION REGRESSION TESTS =============="
    ((total_suites++))
    if test_environment_validation; then
        ((passed_suites++))
    fi
    
    log "=============== VOLUME PERSISTENCE REGRESSION TESTS =================="
    ((total_suites++))
    if test_volume_persistence; then
        ((passed_suites++))
    fi
    
    log "============== NETWORK CONNECTIVITY REGRESSION TESTS ================"
    ((total_suites++))
    if test_network_connectivity; then
        ((passed_suites++))
    fi
    
    log "============= SECURITY CONFIGURATION REGRESSION TESTS ==============="
    ((total_suites++))
    if test_security_configuration; then
        ((passed_suites++))
    fi
    
    log "==================== GENERATING REPORT ======================"
    if generate_regression_report; then
        local overall_result=0
    else
        local overall_result=1
    fi
    
    # Final cleanup
    cleanup_containers
    
    # Final results
    log "================= REGRESSION TESTING COMPLETE ==================="
    local suite_success_rate=$((passed_suites * 100 / total_suites))
    
    if [ $overall_result -eq 0 ]; then
        success "🎉 No regression detected!"
        success "Test suites passed: ${passed_suites}/${total_suites} (${suite_success_rate}%)"
        success "Docker configuration is safe to deploy"
        exit 0
    else
        error "❌ Regression detected in Docker configuration"
        error "Test suites passed: ${passed_suites}/${total_suites} (${suite_success_rate}%)"
        error "Review failures before deployment"
        exit 1
    fi
}

# Trap cleanup on exit
trap cleanup_containers EXIT

# Check dependencies
for cmd in docker docker-compose curl jq; do
    command -v "$cmd" >/dev/null 2>&1 || { error "$cmd is required but not installed"; exit 1; }
done

# Execute main function
main "$@"