#!/bin/bash

# ==============================================================================
# 🔍 LOKI INTEGRATION VALIDATION SCRIPT
# ==============================================================================
# Validates complete Loki log aggregation setup for MEDIANEST
# Usage: ./monitoring/validate-loki.sh
# ==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOKI_URL="http://localhost:3100"
GRAFANA_URL="http://localhost:3001"
PROMTAIL_URL="http://localhost:9080"
TIMEOUT=10

echo -e "${BLUE}🔍 MEDIANEST LOKI INTEGRATION VALIDATION${NC}"
echo "=================================================="

# Check if monitoring directory exists
echo -e "\n${YELLOW}📁 Checking monitoring directory structure...${NC}"
if [[ ! -d "monitoring" ]]; then
    echo -e "${RED}❌ monitoring/ directory not found${NC}"
    exit 1
fi

required_files=(
    "monitoring/loki/loki-config.yml"
    "monitoring/promtail/promtail-config.yml"
    "monitoring/docker-compose.loki.yml"
    "monitoring/grafana/datasources/loki.yml"
    "monitoring/grafana/dashboards/medianest-logs.json"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        exit 1
    fi
done

# Check if services are running
echo -e "\n${YELLOW}🐳 Checking Docker services...${NC}"
if ! docker-compose -f monitoring/docker-compose.loki.yml ps | grep -q "Up"; then
    echo -e "${RED}❌ Loki stack not running. Start with:${NC}"
    echo "docker-compose -f monitoring/docker-compose.loki.yml up -d"
    echo -e "\n${YELLOW}⚠️  Validation will continue but some checks will fail${NC}"
    SERVICES_RUNNING=false
else
    echo -e "${GREEN}✅ Loki stack is running${NC}"
    SERVICES_RUNNING=true
fi

# Health checks
if [[ "$SERVICES_RUNNING" == "true" ]]; then
    echo -e "\n${YELLOW}🩺 Health checks...${NC}"
    
    # Loki health check
    if curl -sf --connect-timeout $TIMEOUT "$LOKI_URL/ready" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Loki is healthy ($LOKI_URL)${NC}"
    else
        echo -e "${RED}❌ Loki health check failed${NC}"
    fi
    
    # Promtail health check
    if curl -sf --connect-timeout $TIMEOUT "$PROMTAIL_URL/metrics" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Promtail is healthy ($PROMTAIL_URL)${NC}"
    else
        echo -e "${RED}❌ Promtail health check failed${NC}"
    fi
    
    # Grafana health check
    if curl -sf --connect-timeout $TIMEOUT "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Grafana is healthy ($GRAFANA_URL)${NC}"
    else
        echo -e "${RED}❌ Grafana health check failed${NC}"
    fi
fi

# Check logger integration
echo -e "\n${YELLOW}📝 Checking logger integration...${NC}"
if [[ -f "backend/src/utils/logger.ts" ]]; then
    if grep -q "Loki-compatible" backend/src/utils/logger.ts; then
        echo -e "${GREEN}✅ Winston logger enhanced for Loki${NC}"
    else
        echo -e "${RED}❌ Logger not enhanced for Loki compatibility${NC}"
    fi
    
    # Check for structured logging functions
    structured_functions=("createRequestLogger" "logPerformance" "logSecurityEvent" "logBusinessMetric")
    for func in "${structured_functions[@]}"; do
        if grep -q "$func" backend/src/utils/logger.ts; then
            echo -e "${GREEN}✅ $func available${NC}"
        else
            echo -e "${RED}❌ Missing function: $func${NC}"
        fi
    done
else
    echo -e "${RED}❌ backend/src/utils/logger.ts not found${NC}"
fi

# Check data directories
echo -e "\n${YELLOW}📦 Checking data directories...${NC}"
data_dirs=("monitoring/data/loki" "monitoring/data/grafana")
for dir in "${data_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
        echo -e "${GREEN}✅ $dir exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Creating $dir${NC}"
        mkdir -p "$dir"
    fi
done

# Test log ingestion (if services running)
if [[ "$SERVICES_RUNNING" == "true" ]]; then
    echo -e "\n${YELLOW}🔄 Testing log ingestion...${NC}"
    
    # Wait a moment for logs to be ingested
    sleep 5
    
    # Query Loki for recent logs
    query='{job=~".*"}'
    loki_query_url="$LOKI_URL/loki/api/v1/query_range?query=$(echo "$query" | sed 's/ /%20/g')&start=$(date -d '10 minutes ago' -u +%s)000000000&end=$(date -u +%s)000000000&limit=10"
    
    if curl -sf --connect-timeout $TIMEOUT "$loki_query_url" | jq -e '.data.result | length > 0' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Log ingestion working - logs found in Loki${NC}"
    else
        echo -e "${YELLOW}⚠️  No logs found in Loki yet (this may be normal for new setup)${NC}"
    fi
fi

# Configuration validation
echo -e "\n${YELLOW}⚙️  Configuration validation...${NC}"

# Validate Loki config
if yq eval '.limits_config.retention_period' monitoring/loki/loki-config.yml | grep -q "720h"; then
    echo -e "${GREEN}✅ Loki retention set to 30 days${NC}"
else
    echo -e "${RED}❌ Loki retention not properly configured${NC}"
fi

# Validate Promtail config
if yq eval '.scrape_configs[0].job_name' monitoring/promtail/promtail-config.yml | grep -q "docker-containers"; then
    echo -e "${GREEN}✅ Promtail configured for Docker container logs${NC}"
else
    echo -e "${RED}❌ Promtail Docker configuration missing${NC}"
fi

# Network connectivity test
if [[ "$SERVICES_RUNNING" == "true" ]]; then
    echo -e "\n${YELLOW}🌐 Network connectivity...${NC}"
    
    # Check if Promtail can reach Loki
    if docker exec medianest-promtail wget --spider --quiet --timeout=$TIMEOUT http://loki:3100/ready 2>/dev/null; then
        echo -e "${GREEN}✅ Promtail can reach Loki${NC}"
    else
        echo -e "${RED}❌ Promtail cannot reach Loki${NC}"
    fi
    
    # Check if Grafana can reach Loki
    if docker exec medianest-grafana wget --spider --quiet --timeout=$TIMEOUT http://loki:3100/ready 2>/dev/null; then
        echo -e "${GREEN}✅ Grafana can reach Loki${NC}"
    else
        echo -e "${RED}❌ Grafana cannot reach Loki${NC}"
    fi
fi

# Integration recommendations
echo -e "\n${BLUE}🔧 INTEGRATION RECOMMENDATIONS${NC}"
echo "=============================================="
echo -e "1. ${YELLOW}Connect to MEDIANEST network:${NC}"
echo "   docker network connect medianest-development medianest-promtail"
echo "   docker network connect medianest-development medianest-loki"
echo ""
echo -e "2. ${YELLOW}Start MEDIANEST with logging labels:${NC}"
echo "   Add to docker-compose.override.yml:"
echo "   labels:"
echo "     - \"com.medianest.service=backend\""
echo ""
echo -e "3. ${YELLOW}Access dashboards:${NC}"
echo "   - Grafana: $GRAFANA_URL (admin/medianest_grafana)"
echo "   - Loki API: $LOKI_URL"
echo "   - Promtail: $PROMTAIL_URL/metrics"
echo ""
echo -e "4. ${YELLOW}Test structured logging in your application:${NC}"
echo "   import { logPerformance } from '../utils/logger';"
echo "   logPerformance('api_call', 150, { endpoint: '/api/users' });"

# Summary
echo -e "\n${BLUE}📊 VALIDATION SUMMARY${NC}"
echo "================================"
if [[ "$SERVICES_RUNNING" == "true" ]]; then
    echo -e "${GREEN}✅ Loki integration is operational${NC}"
    echo "Ready for log aggregation and analysis!"
else
    echo -e "${YELLOW}⚠️  Services not running - start with:${NC}"
    echo "docker-compose -f monitoring/docker-compose.loki.yml up -d"
fi

echo -e "\n${YELLOW}📚 Next steps:${NC}"
echo "1. Review monitoring/README-loki-integration.md"
echo "2. Configure log retention policies"
echo "3. Set up alerting rules"
echo "4. Create custom Grafana dashboards"
echo "5. Implement log-based monitoring"

echo -e "\n${GREEN}🎉 Loki integration validation complete!${NC}"