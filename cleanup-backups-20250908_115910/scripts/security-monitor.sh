#!/bin/bash

# 🔍 MediaNest Security Monitoring Script
# Provides comprehensive security monitoring and reporting

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_NAME="medianest-secure"
COMPOSE_FILE="docker-compose.hardened.yml"

echo -e "${BLUE}🔍 MediaNest Security Monitoring Report${NC}"
echo "======================================="
echo "Generated: $(date)"
echo ""

# Function to check container security status
check_container_security() {
    echo -e "${BLUE}🔐 Container Security Status:${NC}"
    
    if command -v docker &> /dev/null; then
        # Check running containers
        local containers=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}" 2>/dev/null || echo "")
        
        if [[ -n "$containers" ]]; then
            echo "$containers" | while read -r container; do
                if [[ -n "$container" ]]; then
                    local status=$(docker inspect "$container" --format "{{.State.Status}}" 2>/dev/null || echo "unknown")
                    local health=$(docker inspect "$container" --format "{{.State.Health.Status}}" 2>/dev/null || echo "none")
                    
                    if [[ "$health" != "none" ]]; then
                        echo "  ✅ $container: $status (health: $health)"
                    else
                        echo "  ⚠️  $container: $status (no health check)"
                    fi
                fi
            done
        else
            echo "  ⚠️  No MediaNest containers found"
        fi
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to check for security updates
check_security_updates() {
    echo -e "${BLUE}🔄 Security Updates Available:${NC}"
    
    if command -v docker &> /dev/null; then
        # Check image versions
        local images=("postgres:16-alpine" "redis:7-alpine" "nginx:1.25-alpine")
        
        for image in "${images[@]}"; do
            if docker image inspect "$image" >/dev/null 2>&1; then
                local created=$(docker image inspect "$image" --format "{{.Created}}" | cut -d'T' -f1)
                echo "  📦 $image (created: $created)"
            else
                echo "  ❓ $image (not found locally)"
            fi
        done
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to monitor storage usage
check_storage_usage() {
    echo -e "${BLUE}💾 Storage Usage:${NC}"
    
    # Check Docker system usage
    if command -v docker &> /dev/null; then
        echo "  Docker System Usage:"
        docker system df 2>/dev/null | sed 's/^/    /' || echo "    ❌ Failed to get Docker system usage"
        echo ""
        
        # Check volume usage
        local volumes=$(docker volume ls --filter "name=${PROJECT_NAME}" --format "{{.Name}}" 2>/dev/null || echo "")
        if [[ -n "$volumes" ]]; then
            echo "  Volume Usage:"
            echo "$volumes" | while read -r volume; do
                if [[ -n "$volume" ]]; then
                    echo "    📁 $volume"
                fi
            done
        else
            echo "  ⚠️  No MediaNest volumes found"
        fi
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to analyze recent security events
check_security_events() {
    echo -e "${BLUE}📋 Recent Security Events:${NC}"
    
    # Check Docker logs for security-related events
    if command -v docker &> /dev/null; then
        local containers=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}" 2>/dev/null || echo "")
        
        if [[ -n "$containers" ]]; then
            local found_events=false
            echo "$containers" | while read -r container; do
                if [[ -n "$container" ]]; then
                    local security_logs=$(docker logs "$container" --since 24h 2>/dev/null | grep -i "error\|failed\|denied\|attack\|breach" | tail -5 || echo "")
                    
                    if [[ -n "$security_logs" ]]; then
                        echo "  🔍 $container:"
                        echo "$security_logs" | sed 's/^/    /'
                        found_events=true
                    fi
                fi
            done
            
            if [[ "$found_events" == "false" ]]; then
                echo "  ✅ No security events found in the last 24 hours"
            fi
        else
            echo "  ⚠️  No MediaNest containers found"
        fi
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to check resource usage
check_resource_usage() {
    echo -e "${BLUE}⚡ Resource Usage:${NC}"
    
    if command -v docker &> /dev/null; then
        local containers=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}" 2>/dev/null || echo "")
        
        if [[ -n "$containers" ]]; then
            echo "  Container Resource Usage:"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" $containers 2>/dev/null | sed 's/^/    /' || {
                echo "    ❌ Failed to get resource usage"
            }
        else
            echo "  ⚠️  No MediaNest containers found"
        fi
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to check network security
check_network_security() {
    echo -e "${BLUE}🌐 Network Security:${NC}"
    
    if command -v docker &> /dev/null; then
        # Check Docker networks
        local networks=$(docker network ls --filter "name=${PROJECT_NAME}" --format "{{.Name}}" 2>/dev/null || echo "")
        
        if [[ -n "$networks" ]]; then
            echo "  MediaNest Networks:"
            echo "$networks" | while read -r network; do
                if [[ -n "$network" ]]; then
                    local driver=$(docker network inspect "$network" --format "{{.Driver}}" 2>/dev/null || echo "unknown")
                    local internal=$(docker network inspect "$network" --format "{{.Internal}}" 2>/dev/null || echo "unknown")
                    
                    if [[ "$internal" == "true" ]]; then
                        echo "    🔒 $network ($driver, internal)"
                    else
                        echo "    🌐 $network ($driver, external)"
                    fi
                fi
            done
        else
            echo "  ⚠️  No MediaNest networks found"
        fi
        
        # Check exposed ports
        echo ""
        echo "  Exposed Ports:"
        local exposed_ports=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}\t{{.Ports}}" 2>/dev/null || echo "")
        
        if [[ -n "$exposed_ports" ]]; then
            echo "$exposed_ports" | while IFS=$'\t' read -r name ports; do
                if [[ -n "$name" && -n "$ports" ]]; then
                    if echo "$ports" | grep -q "0.0.0.0"; then
                        echo "    ⚠️  $name: $ports (publicly exposed)"
                    else
                        echo "    🔒 $name: $ports (localhost only)"
                    fi
                fi
            done
        else
            echo "    ✅ No containers exposing ports"
        fi
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to check secrets security
check_secrets_security() {
    echo -e "${BLUE}🔑 Secrets Security:${NC}"
    
    if command -v docker &> /dev/null; then
        local secrets=$(docker secret ls --filter "name=medianest" --format "{{.Name}}" 2>/dev/null || echo "")
        
        if [[ -n "$secrets" ]]; then
            local secret_count=$(echo "$secrets" | wc -l)
            echo "  ✅ $secret_count Docker secrets configured"
            
            # Check secret ages
            echo "  Secret Status:"
            echo "$secrets" | while read -r secret; do
                if [[ -n "$secret" ]]; then
                    local created=$(docker secret inspect "$secret" --format "{{.CreatedAt}}" 2>/dev/null | cut -d'T' -f1 || echo "unknown")
                    echo "    🔐 $secret (created: $created)"
                fi
            done
        else
            echo "  ⚠️  No MediaNest secrets found"
        fi
    else
        echo "  ❌ Docker not available"
    fi
    echo ""
}

# Function to generate recommendations
generate_recommendations() {
    echo -e "${BLUE}📝 Security Recommendations:${NC}"
    
    local recommendations=()
    
    # Check if running in production
    if [[ "${NODE_ENV:-}" == "production" ]]; then
        recommendations+=("✅ Running in production mode")
    else
        recommendations+=("⚠️  Consider setting NODE_ENV=production")
    fi
    
    # Check if SSL is configured
    if [[ -d "ssl" ]]; then
        recommendations+=("✅ SSL directory found")
    else
        recommendations+=("⚠️  Configure SSL certificates for production")
    fi
    
    # Check if monitoring is enabled
    if command -v docker &> /dev/null && docker ps --filter "name=prometheus" --format "{{.Names}}" | grep -q prometheus; then
        recommendations+=("✅ Monitoring service running")
    else
        recommendations+=("⚠️  Consider enabling monitoring services")
    fi
    
    # Output recommendations
    for rec in "${recommendations[@]}"; do
        echo "  $rec"
    done
    echo ""
}

# Main execution
main() {
    check_container_security
    check_security_updates
    check_storage_usage
    check_security_events
    check_resource_usage
    check_network_security
    check_secrets_security
    generate_recommendations
    
    echo -e "${GREEN}✅ Security monitoring complete${NC}"
    echo ""
    echo "For detailed logs, run:"
    echo "  docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f"
    echo ""
    echo "For security scan, run:"
    echo "  docker compose -f $COMPOSE_FILE -p $PROJECT_NAME --profile security-scan run --rm trivy"
}

# Run main function
main "$@"