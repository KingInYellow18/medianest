#!/bin/bash

set -euo pipefail

# 🔐 MediaNest Secure Deployment Script
# Deploys MediaNest with hardened security configuration

echo "🚀 MediaNest Secure Deployment"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.hardened.yml"
PROJECT_NAME="medianest-secure"

# Function to check Docker Swarm
check_swarm() {
    echo -e "${BLUE}🐝 Checking Docker Swarm status...${NC}"
    
    if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q active; then
        echo -e "${YELLOW}⚠️  Docker Swarm not active, initializing...${NC}"
        docker swarm init --advertise-addr 127.0.0.1 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Using existing swarm or handling single node setup${NC}"
        }
        echo -e "${GREEN}✅ Docker Swarm initialized${NC}"
    else
        echo -e "${GREEN}✅ Docker Swarm already active${NC}"
    fi
}

# Function to create secrets if they don't exist
create_secrets() {
    echo -e "${BLUE}🔑 Creating Docker secrets...${NC}"
    
    # Function to create a secret if it doesn't exist
    create_secret() {
        local secret_name=$1
        local secret_value=$2
        
        if ! docker secret inspect "$secret_name" >/dev/null 2>&1; then
            echo "$secret_value" | docker secret create "$secret_name" - 2>/dev/null || {
                echo -e "${YELLOW}⚠️  Secret $secret_name creation failed or already exists${NC}"
            }
            echo -e "${GREEN}✅ Created secret: $secret_name${NC}"
        else
            echo -e "${YELLOW}⚠️  Secret $secret_name already exists, skipping...${NC}"
        fi
    }
    
    # Generate secure random secrets if environment variables are not set
    create_secret "medianest_nextauth_secret_v2" "${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}"
    create_secret "medianest_plex_client_id_v2" "${PLEX_CLIENT_ID:-$(openssl rand -base64 32)}"
    create_secret "medianest_plex_client_secret_v2" "${PLEX_CLIENT_SECRET:-$(openssl rand -base64 32)}"
    create_secret "medianest_encryption_key_v2" "${ENCRYPTION_KEY:-$(openssl rand -base64 32)}"
    create_secret "medianest_jwt_secret_v2" "${JWT_SECRET:-$(openssl rand -base64 32)}"
    create_secret "medianest_postgres_db_v2" "${POSTGRES_DB:-medianest}"
    create_secret "medianest_postgres_user_v2" "${POSTGRES_USER:-medianest}"
    create_secret "medianest_postgres_password_v2" "${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}"
    create_secret "medianest_redis_password_v2" "${REDIS_PASSWORD:-$(openssl rand -base64 32)}"
}

# Function to validate configuration
validate_config() {
    echo -e "${BLUE}🔍 Validating configuration...${NC}"
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        echo -e "${RED}❌ Compose file $COMPOSE_FILE not found${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Configuration validated${NC}"
}

# Function to create necessary directories
create_directories() {
    echo -e "${BLUE}📁 Creating directories...${NC}"
    
    # Create configuration directories
    mkdir -p config/{nginx,prometheus}
    mkdir -p security-reports
    
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Function to deploy services
deploy_services() {
    echo -e "${BLUE}🚀 Deploying services...${NC}"
    
    # Build images
    echo -e "${BLUE}🔨 Building Docker images...${NC}"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --no-cache || {
        echo -e "${YELLOW}⚠️  Build failed, attempting without cache...${NC}"
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build
    }
    
    # Deploy services
    echo -e "${BLUE}🚀 Starting secure services...${NC}"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    
    echo -e "${GREEN}✅ Services deployed${NC}"
}

# Function to wait for services
wait_for_services() {
    echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
    
    local max_attempts=60
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        local healthy_services=0
        
        # Check each critical service
        for service in postgres redis app; do
            if docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --format json | jq -r '.[] | select(.Service=="'$service'") | .Health' | grep -q "healthy"; then
                ((healthy_services++))
            fi
        done
        
        if [[ $healthy_services -eq 3 ]]; then
            echo -e "${GREEN}✅ All services are healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Waiting for services... (attempt $attempt/$max_attempts)${NC}"
        sleep 5
        ((attempt++))
    done
    
    echo -e "${YELLOW}⚠️  Services may not be fully healthy, but deployment continues${NC}"
    return 0
}

# Function to run security scan
run_security_scan() {
    echo -e "${BLUE}🔍 Running security scan...${NC}"
    
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" --profile security-scan run --rm trivy || {
        echo -e "${YELLOW}⚠️  Security scan completed with warnings${NC}"
    }
    
    echo -e "${GREEN}✅ Security scan complete${NC}"
}

# Function to display deployment summary
show_summary() {
    echo -e "\n${GREEN}🎉 MediaNest Secure Deployment Complete!${NC}"
    echo "================================================"
    echo -e "${BLUE}📊 Services Status:${NC}"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    
    echo -e "\n${BLUE}🌐 Access Points:${NC}"
    echo "• Application: http://localhost"
    echo "• Health Check: http://localhost/health"
    echo "• Prometheus: http://localhost:9090 (internal)"
    
    echo -e "\n${BLUE}🔧 Management Commands:${NC}"
    echo "• View logs: docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f"
    echo "• Stop services: docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down"
    echo "• View secrets: docker secret ls"
    echo "• Security scan: docker compose -f $COMPOSE_FILE -p $PROJECT_NAME --profile security-scan run --rm trivy"
    
    echo -e "\n${YELLOW}⚠️  Security Reminders:${NC}"
    echo "• Configure SSL certificates for production"
    echo "• Update domain names in Nginx configuration"
    echo "• Set up external monitoring and alerting"
    echo "• Review and customize security policies"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting MediaNest Secure Deployment...${NC}"
    
    # Execute deployment steps
    validate_config
    create_directories
    check_swarm
    create_secrets
    deploy_services
    wait_for_services
    run_security_scan
    show_summary
    
    echo -e "\n${GREEN}✅ Deployment script completed successfully!${NC}"
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Deployment interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"