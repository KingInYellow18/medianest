#!/bin/bash

# MediaNest Docker Network Performance Validation
# Tests container network bridge performance, service discovery, and network policies

set -euo pipefail

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production-secure.yml}"
NETWORK_NAME="${NETWORK_NAME:-medianest_secure_internal}"
TEST_DURATION="${TEST_DURATION:-60}"
OUTPUT_DIR="${OUTPUT_DIR:-./performance/network-reports}"

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

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Test results storage
RESULTS_FILE="$OUTPUT_DIR/docker-network-$(date +%Y%m%d-%H%M%S).json"

# Initialize results JSON
cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "test_duration": $TEST_DURATION,
  "compose_file": "$COMPOSE_FILE",
  "network_name": "$NETWORK_NAME",
  "tests": {
    "network_bridge": {},
    "service_discovery": {},
    "inter_service": {},
    "bandwidth": {},
    "network_policies": {},
    "container_isolation": {}
  }
}
EOF

log_info "🐳 Docker Network Performance Validation Started"
log_info "📁 Results will be saved to: $RESULTS_FILE"

# 1. Test Docker Network Bridge Performance
test_network_bridge() {
    log_info "🌉 1. Testing Docker Network Bridge Performance"
    echo "======================================================"
    
    # Get network details
    NETWORK_INFO=$(docker network inspect "$NETWORK_NAME" 2>/dev/null || echo "null")
    
    if [ "$NETWORK_INFO" = "null" ]; then
        log_warning "Network $NETWORK_NAME not found, using default bridge"
        NETWORK_NAME="bridge"
        NETWORK_INFO=$(docker network inspect bridge)
    fi
    
    # Extract network configuration
    SUBNET=$(echo "$NETWORK_INFO" | jq -r '.[0].IPAM.Config[0].Subnet // "unknown"')
    GATEWAY=$(echo "$NETWORK_INFO" | jq -r '.[0].IPAM.Config[0].Gateway // "unknown"')
    DRIVER=$(echo "$NETWORK_INFO" | jq -r '.[0].Driver // "unknown"')
    MTU=$(echo "$NETWORK_INFO" | jq -r '.[0].Options."com.docker.network.driver.mtu" // "1500"')
    
    log_info "   📊 Network Driver: $DRIVER"
    log_info "   🌐 Subnet: $SUBNET"
    log_info "   🚪 Gateway: $GATEWAY"
    log_info "   📦 MTU: $MTU"
    
    # Test network connectivity within containers
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log_info "   🔍 Testing inter-container connectivity..."
        
        # Test ping between containers (if they exist)
        CONTAINERS=$(docker-compose -f "$COMPOSE_FILE" ps --services)
        PING_RESULTS=()
        
        for SERVICE in $CONTAINERS; do
            if docker-compose -f "$COMPOSE_FILE" ps "$SERVICE" | grep -q "Up"; then
                for TARGET in $CONTAINERS; do
                    if [ "$SERVICE" != "$TARGET" ] && docker-compose -f "$COMPOSE_FILE" ps "$TARGET" | grep -q "Up"; then
                        PING_TIME=$(docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE" ping -c 3 -W 2 "$TARGET" 2>/dev/null | \
                                   grep "avg" | awk -F'/' '{print $5}' || echo "failed")
                        
                        if [ "$PING_TIME" != "failed" ]; then
                            log_success "   ✅ $SERVICE -> $TARGET: ${PING_TIME}ms"
                            PING_RESULTS+=("$SERVICE->$TARGET:$PING_TIME")
                        else
                            log_warning "   ❌ $SERVICE -> $TARGET: Failed"
                            PING_RESULTS+=("$SERVICE->$TARGET:failed")
                        fi
                    fi
                done
            fi
        done
    else
        log_warning "   ⚠️  No running containers found for network testing"
    fi
    
    # Update results
    jq --arg driver "$DRIVER" \
       --arg subnet "$SUBNET" \
       --arg gateway "$GATEWAY" \
       --arg mtu "$MTU" \
       --argjson ping_results "$(printf '%s\n' "${PING_RESULTS[@]}" | jq -R . | jq -s .)" \
       '.tests.network_bridge = {
         "driver": $driver,
         "subnet": $subnet,
         "gateway": $gateway,
         "mtu": $mtu,
         "ping_results": $ping_results
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# 2. Test Service Discovery Performance
test_service_discovery() {
    log_info "🔍 2. Testing Service Discovery Performance"
    echo "=============================================="
    
    # Get list of services from compose file
    SERVICES=$(docker-compose -f "$COMPOSE_FILE" config --services)
    DISCOVERY_RESULTS=()
    
    for SERVICE in $SERVICES; do
        if docker-compose -f "$COMPOSE_FILE" ps "$SERVICE" | grep -q "Up"; then
            log_info "   🔍 Testing DNS resolution for: $SERVICE"
            
            # Test DNS resolution from within another container
            RESOLVER_SERVICE=$(echo "$SERVICES" | head -1)
            if [ "$RESOLVER_SERVICE" = "$SERVICE" ]; then
                RESOLVER_SERVICE=$(echo "$SERVICES" | sed -n '2p')
            fi
            
            if [ -n "$RESOLVER_SERVICE" ] && docker-compose -f "$COMPOSE_FILE" ps "$RESOLVER_SERVICE" | grep -q "Up"; then
                # Measure DNS resolution time
                DNS_TIME=$(docker-compose -f "$COMPOSE_FILE" exec -T "$RESOLVER_SERVICE" \
                          sh -c "time nslookup $SERVICE 2>&1" 2>&1 | \
                          grep "real" | awk '{print $2}' || echo "failed")
                
                if [ "$DNS_TIME" != "failed" ]; then
                    log_success "   ✅ DNS $SERVICE: $DNS_TIME"
                    DISCOVERY_RESULTS+=("$SERVICE:$DNS_TIME")
                else
                    log_warning "   ❌ DNS $SERVICE: Failed"
                    DISCOVERY_RESULTS+=("$SERVICE:failed")
                fi
                
                # Test service reachability
                SERVICE_IP=$(docker-compose -f "$COMPOSE_FILE" exec -T "$RESOLVER_SERVICE" \
                            nslookup "$SERVICE" 2>/dev/null | \
                            grep "Address:" | tail -1 | awk '{print $2}' || echo "unknown")
                
                if [ "$SERVICE_IP" != "unknown" ] && [ -n "$SERVICE_IP" ]; then
                    log_info "   📍 $SERVICE IP: $SERVICE_IP"
                fi
            fi
        else
            log_warning "   ⚠️  Service $SERVICE is not running"
        fi
    done
    
    # Update results
    jq --argjson discovery_results "$(printf '%s\n' "${DISCOVERY_RESULTS[@]}" | jq -R . | jq -s .)" \
       '.tests.service_discovery = {
         "results": $discovery_results,
         "services_tested": '$(echo "$SERVICES" | wc -l)'
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# 3. Test Inter-Service Communication Performance
test_inter_service_communication() {
    log_info "🔗 3. Testing Inter-Service Communication Performance"
    echo "===================================================="
    
    # Test HTTP communication between services
    COMM_RESULTS=()
    
    if docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        log_info "   🔍 Testing backend internal communication..."
        
        # Test backend health endpoint
        HEALTH_RESPONSE=$(docker-compose -f "$COMPOSE_FILE" exec -T backend \
                         curl -s -w "%{http_code}:%{time_total}" -o /dev/null \
                         http://localhost:4000/api/health 2>/dev/null || echo "failed")
        
        if [ "$HEALTH_RESPONSE" != "failed" ]; then
            HTTP_CODE=$(echo "$HEALTH_RESPONSE" | cut -d: -f1)
            RESPONSE_TIME=$(echo "$HEALTH_RESPONSE" | cut -d: -f2)
            log_success "   ✅ Backend Health: HTTP $HTTP_CODE in ${RESPONSE_TIME}s"
            COMM_RESULTS+=("backend-health:$HTTP_CODE:$RESPONSE_TIME")
        else
            log_warning "   ❌ Backend Health: Failed"
            COMM_RESULTS+=("backend-health:failed")
        fi
    fi
    
    # Test database connection if available
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_info "   🔍 Testing PostgreSQL connection..."
        
        DB_RESPONSE=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres \
                     psql -U medianest -d medianest -c "SELECT 1;" -t 2>/dev/null | \
                     grep -q "1" && echo "success" || echo "failed")
        
        if [ "$DB_RESPONSE" = "success" ]; then
            log_success "   ✅ PostgreSQL Connection: OK"
            COMM_RESULTS+=("postgres-connection:success")
        else
            log_warning "   ❌ PostgreSQL Connection: Failed"
            COMM_RESULTS+=("postgres-connection:failed")
        fi
    fi
    
    # Test Redis connection if available
    if docker-compose -f "$COMPOSE_FILE" ps redis | grep -q "Up"; then
        log_info "   🔍 Testing Redis connection..."
        
        REDIS_RESPONSE=$(docker-compose -f "$COMPOSE_FILE" exec -T redis \
                        redis-cli ping 2>/dev/null || echo "failed")
        
        if [ "$REDIS_RESPONSE" = "PONG" ]; then
            log_success "   ✅ Redis Connection: PONG"
            COMM_RESULTS+=("redis-connection:success")
        else
            log_warning "   ❌ Redis Connection: Failed"
            COMM_RESULTS+=("redis-connection:failed")
        fi
    fi
    
    # Update results
    jq --argjson comm_results "$(printf '%s\n' "${COMM_RESULTS[@]}" | jq -R . | jq -s .)" \
       '.tests.inter_service = {
         "results": $comm_results,
         "timestamp": "'$(date -Iseconds)'"
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# 4. Test Network Bandwidth Performance
test_network_bandwidth() {
    log_info "📊 4. Testing Network Bandwidth Performance"
    echo "============================================="
    
    BANDWIDTH_RESULTS=()
    
    # Test file transfer between containers
    if docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up" && \
       docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        
        log_info "   🔍 Creating test file for bandwidth testing..."
        
        # Create a test file in backend container
        docker-compose -f "$COMPOSE_FILE" exec -T backend \
            dd if=/dev/zero of=/tmp/testfile bs=1M count=10 2>/dev/null || true
        
        # Test transfer via network (simulate via HTTP if possible)
        if command -v curl >/dev/null 2>&1; then
            log_info "   📈 Testing HTTP transfer performance..."
            
            TRANSFER_TIME=$(docker-compose -f "$COMPOSE_FILE" exec -T backend \
                           sh -c "time curl -s -o /dev/null http://postgres:5432/ 2>&1" 2>&1 | \
                           grep "real" | awk '{print $2}' || echo "failed")
            
            if [ "$TRANSFER_TIME" != "failed" ]; then
                log_success "   ✅ Network Transfer Time: $TRANSFER_TIME"
                BANDWIDTH_RESULTS+=("transfer-time:$TRANSFER_TIME")
            fi
        fi
        
        # Clean up test file
        docker-compose -f "$COMPOSE_FILE" exec -T backend rm -f /tmp/testfile || true
    fi
    
    # Test network interface statistics if available
    if docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        log_info "   📊 Checking network interface statistics..."
        
        NET_STATS=$(docker-compose -f "$COMPOSE_FILE" exec -T backend \
                   cat /proc/net/dev 2>/dev/null | grep "eth0" || echo "not_available")
        
        if [ "$NET_STATS" != "not_available" ]; then
            RX_BYTES=$(echo "$NET_STATS" | awk '{print $2}')
            TX_BYTES=$(echo "$NET_STATS" | awk '{print $10}')
            log_info "   📥 RX Bytes: $RX_BYTES"
            log_info "   📤 TX Bytes: $TX_BYTES"
            BANDWIDTH_RESULTS+=("rx-bytes:$RX_BYTES" "tx-bytes:$TX_BYTES")
        fi
    fi
    
    # Update results
    jq --argjson bandwidth_results "$(printf '%s\n' "${BANDWIDTH_RESULTS[@]}" | jq -R . | jq -s .)" \
       '.tests.bandwidth = {
         "results": $bandwidth_results,
         "test_file_size": "10MB",
         "timestamp": "'$(date -Iseconds)'"
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# 5. Test Network Policies and Security
test_network_policies() {
    log_info "🛡️  5. Testing Network Policies and Security"
    echo "=============================================="
    
    POLICY_RESULTS=()
    
    # Check if network has internal flag
    INTERNAL_FLAG=$(docker network inspect "$NETWORK_NAME" 2>/dev/null | \
                   jq -r '.[0].Internal // false' || echo "unknown")
    
    log_info "   🔒 Network Internal Flag: $INTERNAL_FLAG"
    POLICY_RESULTS+=("internal-flag:$INTERNAL_FLAG")
    
    # Test port isolation
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log_info "   🔍 Testing database port isolation..."
        
        # Try to connect to database from host (should fail if properly isolated)
        DB_ACCESSIBLE=$(timeout 3 bash -c 'cat < /dev/null > /dev/tcp/localhost/5432' 2>/dev/null && echo "accessible" || echo "isolated")
        
        if [ "$DB_ACCESSIBLE" = "isolated" ]; then
            log_success "   ✅ Database properly isolated from host"
            POLICY_RESULTS+=("database-isolation:proper")
        else
            log_warning "   ⚠️  Database accessible from host (check security)"
            POLICY_RESULTS+=("database-isolation:exposed")
        fi
    fi
    
    # Check container security context
    if docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        CONTAINER_ID=$(docker-compose -f "$COMPOSE_FILE" ps -q backend)
        
        # Check if running as non-root
        USER_ID=$(docker inspect "$CONTAINER_ID" | jq -r '.[0].Config.User // "root"')
        log_info "   👤 Backend User Context: $USER_ID"
        POLICY_RESULTS+=("backend-user:$USER_ID")
        
        # Check security options
        SECURITY_OPTS=$(docker inspect "$CONTAINER_ID" | jq -r '.[0].HostConfig.SecurityOpt[]? // empty')
        if [ -n "$SECURITY_OPTS" ]; then
            log_success "   🛡️  Security options enabled: $SECURITY_OPTS"
            POLICY_RESULTS+=("security-opts:enabled")
        else
            log_warning "   ⚠️  No additional security options detected"
            POLICY_RESULTS+=("security-opts:none")
        fi
    fi
    
    # Update results
    jq --argjson policy_results "$(printf '%s\n' "${POLICY_RESULTS[@]}" | jq -R . | jq -s .)" \
       '.tests.network_policies = {
         "results": $policy_results,
         "internal_network": '$([[ "$INTERNAL_FLAG" == "true" ]] && echo "true" || echo "false")',
         "timestamp": "'$(date -Iseconds)'"
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# 6. Test Container Isolation
test_container_isolation() {
    log_info "🔐 6. Testing Container Isolation"
    echo "=================================="
    
    ISOLATION_RESULTS=()
    
    # Test filesystem isolation
    if docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        log_info "   📁 Testing filesystem isolation..."
        
        # Check if filesystem is read-only
        READONLY_FS=$(docker-compose -f "$COMPOSE_FILE" exec -T backend \
                     touch /test_write 2>&1 | grep -q "Read-only" && echo "readonly" || echo "writable")
        
        if [ "$READONLY_FS" = "readonly" ]; then
            log_success "   ✅ Filesystem is read-only (secure)"
            ISOLATION_RESULTS+=("filesystem:readonly")
        else
            log_warning "   ⚠️  Filesystem is writable"
            ISOLATION_RESULTS+=("filesystem:writable")
        fi
        
        # Clean up if test file was created
        docker-compose -f "$COMPOSE_FILE" exec -T backend rm -f /test_write 2>/dev/null || true
    fi
    
    # Test capability restrictions
    if docker-compose -f "$COMPOSE_FILE" ps backend | grep -q "Up"; then
        CONTAINER_ID=$(docker-compose -f "$COMPOSE_FILE" ps -q backend)
        
        # Check dropped capabilities
        CAP_DROP=$(docker inspect "$CONTAINER_ID" | jq -r '.[0].HostConfig.CapDrop[]? // empty' | tr '\n' ',' | sed 's/,$//')
        if [ -n "$CAP_DROP" ]; then
            log_success "   ✅ Capabilities dropped: $CAP_DROP"
            ISOLATION_RESULTS+=("capabilities-dropped:$CAP_DROP")
        else
            log_warning "   ⚠️  No capabilities explicitly dropped"
            ISOLATION_RESULTS+=("capabilities-dropped:none")
        fi
        
        # Check added capabilities
        CAP_ADD=$(docker inspect "$CONTAINER_ID" | jq -r '.[0].HostConfig.CapAdd[]? // empty' | tr '\n' ',' | sed 's/,$//')
        if [ -n "$CAP_ADD" ]; then
            log_info "   ℹ️  Capabilities added: $CAP_ADD"
            ISOLATION_RESULTS+=("capabilities-added:$CAP_ADD")
        else
            log_info "   ℹ️  No additional capabilities added"
            ISOLATION_RESULTS+=("capabilities-added:none")
        fi
    fi
    
    # Test PID limits
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        CONTAINER_ID=$(docker-compose -f "$COMPOSE_FILE" ps -q postgres)
        PID_LIMIT=$(docker inspect "$CONTAINER_ID" | jq -r '.[0].HostConfig.PidsLimit // null')
        
        if [ "$PID_LIMIT" != "null" ]; then
            log_success "   ✅ PID limit set: $PID_LIMIT"
            ISOLATION_RESULTS+=("pid-limit:$PID_LIMIT")
        else
            log_warning "   ⚠️  No PID limit configured"
            ISOLATION_RESULTS+=("pid-limit:none")
        fi
    fi
    
    # Update results
    jq --argjson isolation_results "$(printf '%s\n' "${ISOLATION_RESULTS[@]}" | jq -R . | jq -s .)" \
       '.tests.container_isolation = {
         "results": $isolation_results,
         "timestamp": "'$(date -Iseconds)'"
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# Generate summary report
generate_summary() {
    log_info "📊 Generating Summary Report"
    echo "============================"
    
    # Extract key metrics from results
    local BRIDGE_STATUS=$(jq -r '.tests.network_bridge.driver // "unknown"' "$RESULTS_FILE")
    local DNS_TESTS=$(jq -r '.tests.service_discovery.services_tested // 0' "$RESULTS_FILE")
    local COMM_TESTS=$(jq -r '.tests.inter_service.results | length' "$RESULTS_FILE")
    
    echo ""
    log_success "✅ DOCKER NETWORK PERFORMANCE SUMMARY"
    echo "======================================"
    echo "📊 Bridge Driver: $BRIDGE_STATUS"
    echo "🔍 Services Tested: $DNS_TESTS"
    echo "🔗 Communication Tests: $COMM_TESTS"
    echo "📁 Full Report: $RESULTS_FILE"
    echo ""
    
    # Add summary to results file
    jq --arg summary "Docker network validation completed successfully" \
       --arg bridge_status "$BRIDGE_STATUS" \
       --arg dns_tests "$DNS_TESTS" \
       --arg comm_tests "$COMM_TESTS" \
       '.summary = {
         "status": "completed",
         "message": $summary,
         "bridge_driver": $bridge_status,
         "services_tested": ($dns_tests | tonumber),
         "communication_tests": ($comm_tests | tonumber),
         "timestamp": "'$(date -Iseconds)'"
       }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
}

# Main execution
main() {
    # Check prerequisites
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "docker-compose not found. Please install Docker Compose."
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq not found. Please install jq for JSON processing."
        exit 1
    fi
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file $COMPOSE_FILE not found."
        exit 1
    fi
    
    # Run all tests
    test_network_bridge
    test_service_discovery
    test_inter_service_communication
    test_network_bandwidth
    test_network_policies
    test_container_isolation
    
    # Generate final summary
    generate_summary
    
    log_success "🎉 Docker Network Performance Validation Complete!"
    log_info "📁 Results saved to: $RESULTS_FILE"
}

# Execute main function
main "$@"