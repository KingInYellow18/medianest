#!/bin/bash

# MediaNest Monitoring Stack Quick Start
# Launches the complete monitoring infrastructure for production

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 MediaNest Monitoring Stack - Quick Start${NC}"
echo "=============================================="
echo

# Check if we're in the right directory
if [[ ! -f "docker-compose.production.yml" ]]; then
    echo -e "${RED}❌ Error: Please run this script from the MediaNest root directory${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo -e "${BLUE}📋 Pre-flight Checklist${NC}"
echo "========================"

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Docker found${NC}"
fi

# Check Docker Compose
if ! command -v docker-compose >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Docker Compose found${NC}"
fi

# Check configuration files
if [[ ! -f "config/production/prometheus.yml" ]]; then
    echo -e "${RED}❌ Prometheus configuration not found${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Prometheus configuration found${NC}"
fi

if [[ ! -f "config/production/alert_rules.yml" ]]; then
    echo -e "${RED}❌ Alert rules not found${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Alert rules found${NC}"
fi

echo

echo -e "${YELLOW}🐳 Starting Monitoring Services${NC}"
echo "================================="

# Stop any existing monitoring services
echo "Stopping existing monitoring services..."
docker-compose --profile monitoring down 2>/dev/null || true

# Start monitoring stack
echo "Starting Prometheus..."
docker-compose --profile monitoring up -d prometheus

# Wait for Prometheus to be ready
echo "Waiting for Prometheus to start..."
timeout=60
counter=0
while ! curl -sf http://localhost:9090/api/v1/status/config >/dev/null 2>&1; do
    if [[ $counter -ge $timeout ]]; then
        echo -e "${RED}❌ Prometheus failed to start within ${timeout} seconds${NC}"
        exit 1
    fi
    sleep 1
    ((counter++))
    echo -n "."
done
echo -e "\n${GREEN}✅ Prometheus is running${NC}"

# Start Grafana if configured
if docker-compose config --services | grep -q grafana; then
    echo "Starting Grafana..."
    docker-compose --profile monitoring up -d grafana
    
    echo "Waiting for Grafana to start..."
    timeout=60
    counter=0
    while ! curl -sf http://localhost:3001/api/health >/dev/null 2>&1; do
        if [[ $counter -ge $timeout ]]; then
            echo -e "${YELLOW}⚠️  Grafana failed to start within ${timeout} seconds (continuing)${NC}"
            break
        fi
        sleep 1
        ((counter++))
        echo -n "."
    done
    
    if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
        echo -e "\n${GREEN}✅ Grafana is running${NC}"
    fi
fi

# Start additional monitoring services
echo "Starting additional monitoring services..."
docker-compose --profile monitoring up -d 2>/dev/null || true

echo

echo -e "${BLUE}🔍 Verifying Services${NC}"
echo "===================="

# Check Prometheus
if curl -sf http://localhost:9090/api/v1/status/config >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Prometheus: http://localhost:9090${NC}"
    
    # Check if targets are configured
    targets=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | jq -r '.data.activeTargets | length' 2>/dev/null || echo "0")
    echo "   📊 Active targets: $targets"
else
    echo -e "${RED}❌ Prometheus not accessible${NC}"
fi

# Check Grafana
if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Grafana: http://localhost:3001${NC}"
    echo "   🔑 Default login: admin/admin"
else
    echo -e "${YELLOW}⚠️  Grafana not accessible (may still be starting)${NC}"
fi

# Check if application is running
if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MediaNest Application: http://localhost:3000${NC}"
    
    # Check metrics endpoint
    if curl -sf http://localhost:3000/metrics >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Metrics endpoint: http://localhost:3000/metrics${NC}"
    else
        echo -e "${YELLOW}⚠️  Metrics endpoint not accessible (may need authentication)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  MediaNest application not running${NC}"
    echo "   💡 Start with: npm run start or docker-compose up -d app"
fi

echo

echo -e "${CYAN}🎯 Next Steps${NC}"
echo "============="
echo "1. Start MediaNest application (if not running):"
echo "   npm run start"
echo
echo "2. Validate metrics collection:"
echo "   ./scripts/test-metrics-endpoint.sh"
echo
echo "3. Run complete validation:"
echo "   ./scripts/prometheus-validator.sh"
echo
echo "4. Access monitoring dashboards:"
echo "   • Prometheus: http://localhost:9090"
echo "   • Grafana: http://localhost:3001 (admin/admin)"
echo
echo "5. Import Grafana dashboard:"
echo "   Import config/production/grafana-dashboards.json"

echo
echo -e "${GREEN}🎉 Monitoring stack startup complete!${NC}"
echo
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose --profile monitoring ps 2>/dev/null || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(prometheus|grafana)" || echo "No monitoring containers found"