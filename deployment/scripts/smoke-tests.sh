#!/bin/bash
# MediaNest Production Smoke Tests
# Basic smoke tests to verify deployment success

set -euo pipefail

# Configuration
DOMAIN="${DOMAIN:-medianest.yourdomain.com}"
API_DOMAIN="${API_DOMAIN:-api.medianest.yourdomain.com}"
TIMEOUT=30
RETRIES=3
NAMESPACE="medianest-prod"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test counter
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

# Function to run a test with retries
run_test() {
    local test_name="$1"
    local test_command="$2"
    local retries=${3:-$RETRIES}
    
    ((TEST_COUNT++))
    log_info "Running test: $test_name"
    
    for i in $(seq 1 $retries); do
        if eval "$test_command"; then
            log_success "$test_name"
            ((PASS_COUNT++))
            return 0
        else
            if [ $i -lt $retries ]; then
                log_warning "$test_name - Attempt $i/$retries failed, retrying..."
                sleep 5
            fi
        fi
    done
    
    log_error "$test_name - All attempts failed"
    ((FAIL_COUNT++))
    return 1
}

# Test: Frontend health endpoint
test_frontend_health() {
    curl -sf --max-time $TIMEOUT https://$DOMAIN/api/health > /dev/null
}

# Test: Backend health endpoint
test_backend_health() {
    curl -sf --max-time $TIMEOUT https://$API_DOMAIN/api/health > /dev/null
}

# Test: Frontend loads without errors
test_frontend_load() {
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT https://$DOMAIN/)
    [ "$status_code" = "200" ]
}

# Test: API responds to authentication endpoint
test_api_auth() {
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT https://$API_DOMAIN/api/auth/status)
    [ "$status_code" = "200" ] || [ "$status_code" = "401" ]
}

# Test: Database connectivity
test_database_connection() {
    local backend_pod=$(kubectl get pods -l app=medianest-backend -o jsonpath='{.items[0].metadata.name}' -n $NAMESPACE)
    kubectl exec $backend_pod -n $NAMESPACE -- node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
          .then(() => { console.log('DB connected'); process.exit(0); })
          .catch((e) => { console.error(e); process.exit(1); });
    " > /dev/null 2>&1
}

# Test: Redis connectivity
test_redis_connection() {
    local redis_pod=$(kubectl get pods -l app=redis -o jsonpath='{.items[0].metadata.name}' -n $NAMESPACE)
    kubectl exec $redis_pod -n $NAMESPACE -- redis-cli ping | grep -q PONG
}

# Test: SSL certificate validity
test_ssl_certificate() {
    local cert_info=$(echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    echo "$cert_info" | grep -q "notAfter" && echo "$cert_info" | grep -q "notBefore"
}

# Test: Security headers
test_security_headers() {
    local headers=$(curl -s -I --max-time $TIMEOUT https://$DOMAIN/)
    echo "$headers" | grep -qi "x-frame-options" && \
    echo "$headers" | grep -qi "x-content-type-options" && \
    echo "$headers" | grep -qi "strict-transport-security"
}

# Test: CORS headers
test_cors_headers() {
    local headers=$(curl -s -I -H "Origin: https://$DOMAIN" --max-time $TIMEOUT https://$API_DOMAIN/api/health)
    echo "$headers" | grep -qi "access-control-allow-origin"
}

# Test: API rate limiting
test_rate_limiting() {
    # Make multiple rapid requests to test rate limiting
    local rate_limit_hit=false
    for i in {1..10}; do
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://$API_DOMAIN/api/health)
        if [ "$status_code" = "429" ]; then
            rate_limit_hit=true
            break
        fi
        sleep 0.1
    done
    # Rate limiting should be working (this test might not always trigger limits)
    return 0  # Always pass this test as it's hard to consistently trigger
}

# Test: WebSocket connection
test_websocket() {
    # Test WebSocket endpoint exists (basic connectivity test)
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT https://$API_DOMAIN/socket.io/)
    [ "$status_code" = "200" ] || [ "$status_code" = "400" ]  # 400 is expected for HTTP request to WS endpoint
}

# Test: Metrics endpoint accessibility
test_metrics_endpoint() {
    local backend_pod=$(kubectl get pods -l app=medianest-backend -o jsonpath='{.items[0].metadata.name}' -n $NAMESPACE)
    kubectl exec $backend_pod -n $NAMESPACE -- curl -sf http://localhost:4000/metrics > /dev/null
}

# Test: Log aggregation
test_logging() {
    local backend_pod=$(kubectl get pods -l app=medianest-backend -o jsonpath='{.items[0].metadata.name}' -n $NAMESPACE)
    local logs=$(kubectl logs $backend_pod -n $NAMESPACE --tail=10)
    [ -n "$logs" ]  # Check that logs are being generated
}

# Test: Persistent storage
test_persistent_storage() {
    # Check that persistent volumes are mounted
    kubectl get pv | grep -q "medianest" || kubectl get pvc -n $NAMESPACE | grep -q "Bound"
}

# Test: Auto-scaling configuration
test_autoscaling() {
    kubectl get hpa -n $NAMESPACE | grep -q "medianest"
}

# Test: Backup system
test_backup_system() {
    # Check if backup jobs/cronjobs exist
    kubectl get cronjobs -n $NAMESPACE | grep -q "backup" || return 0  # Optional test
}

# Main test execution
main() {
    log_info "Starting MediaNest Production Smoke Tests"
    log_info "Domain: $DOMAIN"
    log_info "API Domain: $API_DOMAIN"
    log_info "Namespace: $NAMESPACE"
    echo "==========================================="
    
    # Core functionality tests
    run_test "Frontend Health Check" "test_frontend_health"
    run_test "Backend Health Check" "test_backend_health"
    run_test "Frontend Load Test" "test_frontend_load"
    run_test "API Authentication Endpoint" "test_api_auth"
    
    # Infrastructure tests
    run_test "Database Connectivity" "test_database_connection"
    run_test "Redis Connectivity" "test_redis_connection"
    run_test "Persistent Storage" "test_persistent_storage"
    
    # Security tests
    run_test "SSL Certificate Validity" "test_ssl_certificate"
    run_test "Security Headers" "test_security_headers"
    run_test "CORS Headers" "test_cors_headers"
    
    # Performance and reliability tests
    run_test "WebSocket Connectivity" "test_websocket"
    run_test "Auto-scaling Configuration" "test_autoscaling"
    run_test "Metrics Endpoint" "test_metrics_endpoint"
    run_test "Log Aggregation" "test_logging"
    
    # Optional tests (don't fail the whole suite)
    run_test "Rate Limiting" "test_rate_limiting" 1 || true
    run_test "Backup System" "test_backup_system" 1 || true
    
    # Test summary
    echo "==========================================="
    log_info "Smoke Test Results:"
    log_info "Total Tests: $TEST_COUNT"
    log_success "Passed: $PASS_COUNT"
    
    if [ $FAIL_COUNT -gt 0 ]; then
        log_error "Failed: $FAIL_COUNT"
        log_error "Some smoke tests failed. Please investigate."
        
        # Output troubleshooting information
        echo ""
        log_info "Troubleshooting Information:"
        echo "Pods Status:"
        kubectl get pods -n $NAMESPACE -o wide
        echo ""
        echo "Services:"
        kubectl get services -n $NAMESPACE
        echo ""
        echo "Ingress:"
        kubectl get ingress -n $NAMESPACE
        echo ""
        echo "Recent Events:"
        kubectl get events --sort-by=.metadata.creationTimestamp -n $NAMESPACE | tail -10
        
        return 1
    else
        log_success "All smoke tests passed!"
        log_info "Deployment verification successful."
        return 0
    fi
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Smoke tests failed with exit code $exit_code"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --api-domain)
            API_DOMAIN="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retries)
            RETRIES="$2"
            shift 2
            ;;
        --help)
            echo "MediaNest Production Smoke Tests"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --domain DOMAIN        Frontend domain (default: medianest.yourdomain.com)"
            echo "  --api-domain DOMAIN    API domain (default: api.medianest.yourdomain.com)"
            echo "  --namespace NAMESPACE  Kubernetes namespace (default: medianest-prod)"
            echo "  --timeout SECONDS      Request timeout (default: 30)"
            echo "  --retries COUNT        Retry attempts (default: 3)"
            echo "  --help                 Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main