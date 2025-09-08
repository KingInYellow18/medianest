#!/bin/bash

# Start distributed tracing infrastructure script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="config/monitoring/jaeger/docker-compose.yml"
PROFILE="development" # or "production"
TIMEOUT=60

echo -e "${BLUE}🔍 Starting Distributed Tracing Infrastructure${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Docker compose file not found: $COMPOSE_FILE${NC}"
    exit 1
fi

# Function to wait for service health
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=$3
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $service_name to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 5
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy after $max_attempts attempts${NC}"
    return 1
}

# Start services based on profile
if [ "$PROFILE" = "production" ]; then
    echo -e "${BLUE}🚀 Starting production tracing stack with Elasticsearch...${NC}"
    docker-compose -f $COMPOSE_FILE --profile production up -d
    
    # Wait for Elasticsearch
    wait_for_service "Elasticsearch" "http://localhost:9200/_cluster/health" 24
    
    # Wait for Jaeger collector
    wait_for_service "Jaeger Collector" "http://localhost:14269/" 12
    
    # Wait for Jaeger query
    wait_for_service "Jaeger Query" "http://localhost:16687/" 12
    
else
    echo -e "${BLUE}🚀 Starting development tracing stack...${NC}"
    docker-compose -f $COMPOSE_FILE up -d jaeger-all-in-one otel-collector redis
    
    # Wait for Jaeger all-in-one
    wait_for_service "Jaeger" "http://localhost:16686/" 12
    
    # Wait for OTLP collector
    wait_for_service "OTEL Collector" "http://localhost:8888/" 12
    
    # Wait for Redis
    wait_for_service "Redis" "http://localhost:6379" 6 || echo -e "${YELLOW}⚠️ Redis health check failed, but it might still be working${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Distributed Tracing Infrastructure Started Successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Access Points:${NC}"
echo "  • Jaeger UI:        http://localhost:16686"
echo "  • OTLP Collector:   http://localhost:8888 (health)"
echo "  • Redis:            localhost:6379"

if [ "$PROFILE" = "production" ]; then
    echo "  • Elasticsearch:    http://localhost:9200"
    echo "  • Jaeger Query:     http://localhost:16687"
fi

echo ""
echo -e "${BLUE}🔧 Environment Variables:${NC}"
echo "  JAEGER_ENDPOINT=http://localhost:14268/api/traces"
echo "  OTLP_ENDPOINT=http://localhost:4318/v1/traces"
echo "  TRACING_ENABLED=true"
echo ""

# Show running containers
echo -e "${BLUE}🐳 Running Containers:${NC}"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo -e "${YELLOW}💡 Quick Start Commands:${NC}"
echo "  # Start your application with tracing"
echo "  cd backend && npm run dev"
echo ""
echo "  # View traces in Jaeger UI"
echo "  open http://localhost:16686"
echo ""
echo "  # Stop tracing infrastructure"
echo "  ./scripts/stop-tracing.sh"
echo ""

# Optional: Start the backend automatically
read -p "Do you want to start the backend server now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "backend/package.json" ]; then
        echo -e "${BLUE}🚀 Starting backend server with tracing...${NC}"
        cd backend && npm run dev &
        BACKEND_PID=$!
        echo "Backend started with PID: $BACKEND_PID"
        echo "You can stop it later with: kill $BACKEND_PID"
    else
        echo -e "${YELLOW}⚠️ Backend package.json not found. Please start manually.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup complete! Happy tracing! 🔍${NC}"