#!/bin/bash

# Stop distributed tracing infrastructure script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="config/monitoring/jaeger/docker-compose.yml"

echo -e "${BLUE}🛑 Stopping Distributed Tracing Infrastructure${NC}"

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Docker compose file not found: $COMPOSE_FILE${NC}"
    exit 1
fi

# Stop all services
echo -e "${YELLOW}⏳ Stopping tracing services...${NC}"
docker-compose -f $COMPOSE_FILE down

# Optional: Remove volumes (ask user)
read -p "Do you want to remove persistent volumes (this will delete stored traces)? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️ Removing volumes...${NC}"
    docker-compose -f $COMPOSE_FILE down --volumes
    echo -e "${GREEN}✅ Volumes removed${NC}"
else
    echo -e "${BLUE}📦 Volumes preserved${NC}"
fi

# Optional: Remove images
read -p "Do you want to remove Docker images to free up space? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🗑️ Removing images...${NC}"
    docker-compose -f $COMPOSE_FILE down --rmi all || echo -e "${YELLOW}⚠️ Some images might still be in use${NC}"
    echo -e "${GREEN}✅ Images removed${NC}"
fi

# Show remaining containers (if any)
echo ""
echo -e "${BLUE}🐳 Remaining containers:${NC}"
docker-compose -f $COMPOSE_FILE ps || echo "No containers running"

echo ""
echo -e "${GREEN}✅ Distributed tracing infrastructure stopped successfully!${NC}"
echo ""
echo -e "${YELLOW}💡 To start again, run:${NC}"
echo "  ./scripts/start-tracing.sh"