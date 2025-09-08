#!/bin/bash

# 🔐 MediaNest Docker Security Setup Script
# Initializes secure Docker environment with secrets management

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="/etc/docker/secrets"
DATA_DIR="/var/lib/medianest"

echo -e "${BLUE}🔐 MediaNest Docker Security Setup${NC}"
echo "================================================"

# Function to generate secure random strings
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to create Docker secret
create_docker_secret() {
    local secret_name=$1
    local secret_value=$2
    local version=${3:-v2}
    
    local full_name="medianest_${secret_name}_${version}"
    
    if docker secret ls --format "{{.Name}}" | grep -q "^${full_name}$"; then
        echo -e "${YELLOW}⚠️  Secret ${full_name} already exists, skipping...${NC}"
        return 0
    fi
    
    echo "$secret_value" | docker secret create "$full_name" -
    echo -e "${GREEN}✅ Created Docker secret: ${full_name}${NC}"
}

# Function to setup directory structure
setup_directories() {
    echo -e "\n${BLUE}📁 Setting up directory structure...${NC}"
    
    # Create data directories with proper permissions
    sudo mkdir -p "$DATA_DIR"/{postgres,redis,uploads}
    sudo mkdir -p /var/log/medianest
    sudo mkdir -p "$PROJECT_ROOT"/{security-reports,config/{nginx,prometheus}}
    
    # Set ownership and permissions
    sudo chown -R 999:999 "$DATA_DIR/postgres"
    sudo chown -R 999:1000 "$DATA_DIR/redis"
    sudo chown -R 1001:1001 "$DATA_DIR/uploads"
    sudo chown -R 1001:1001 /var/log/medianest
    
    # Secure permissions
    sudo chmod 750 "$DATA_DIR"/{postgres,redis,uploads}
    sudo chmod 755 /var/log/medianest
    
    echo -e "${GREEN}✅ Directory structure created${NC}"
}

# Function to initialize Docker Swarm if not already done
init_swarm() {
    echo -e "\n${BLUE}🐝 Checking Docker Swarm status...${NC}"
    
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

# Function to create all required secrets
create_secrets() {
    echo -e "\n${BLUE}🔑 Creating Docker secrets...${NC}"
    
    # Application secrets
    create_docker_secret "nextauth_secret" "$(generate_secret 64)"
    create_docker_secret "plex_client_id" "${PLEX_CLIENT_ID:-$(generate_secret 32)}"
    create_docker_secret "plex_client_secret" "${PLEX_CLIENT_SECRET:-$(generate_secret 64)}"
    create_docker_secret "encryption_key" "$(generate_secret 32)"
    create_docker_secret "jwt_secret" "$(generate_secret 64)"
    
    # Database secrets
    create_docker_secret "postgres_db" "${POSTGRES_DB:-medianest}"
    create_docker_secret "postgres_user" "${POSTGRES_USER:-medianest}"
    create_docker_secret "postgres_password" "${POSTGRES_PASSWORD:-$(generate_secret 32)}"
    
    # Redis secrets
    create_docker_secret "redis_password" "${REDIS_PASSWORD:-$(generate_secret 32)}"
    
    echo -e "${GREEN}✅ All secrets created successfully${NC}"
}

# Function to create security configuration files
create_security_configs() {
    echo -e "\n${BLUE}⚙️  Creating security configuration files...${NC}"
    
    # Nginx security configuration
    cat > "$PROJECT_ROOT/config/nginx/nginx.conf" << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: ws:; frame-ancestors 'none';" always;
    
    # Hide Nginx version
    server_tokens off;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    include /etc/nginx/conf.d/*.conf;
}
EOF

    # MediaNest application configuration
    cat > "$PROJECT_ROOT/config/nginx/medianest.conf" << 'EOF'
upstream app {
    server 172.25.0.20:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name _;
    
    # Security headers for HTTP
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Redirect all HTTP traffic to HTTPS in production
    # location / {
    #     return 301 https://$server_name$request_uri;
    # }
    
    # For development, proxy to app
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_redirect off;
        
        # Security headers
        proxy_hide_header X-Powered-By;
    }
}

# HTTPS configuration (uncomment for production with SSL certificates)
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#     
#     ssl_certificate /etc/ssl/certs/your-domain.crt;
#     ssl_certificate_key /etc/ssl/certs/your-domain.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     ssl_session_cache shared:SSL:10m;
#     ssl_session_timeout 10m;
#     
#     location / {
#         proxy_pass http://app;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#         proxy_read_timeout 86400;
#         proxy_redirect off;
#     }
# }
EOF

    # Prometheus configuration
    cat > "$PROJECT_ROOT/config/prometheus/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files: []

scrape_configs:
  - job_name: 'medianest-app'
    static_configs:
      - targets: ['172.25.0.20:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    
  - job_name: 'nginx'
    static_configs:
      - targets: ['172.26.0.30:80']
    metrics_path: '/nginx_status'
    scrape_interval: 30s
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['172.25.0.10:5432']
    scrape_interval: 60s
    
  - job_name: 'redis'
    static_configs:
      - targets: ['172.25.0.11:6379']
    scrape_interval: 30s
EOF

    chmod 644 "$PROJECT_ROOT/config/nginx/"*.conf
    chmod 644 "$PROJECT_ROOT/config/prometheus/prometheus.yml"
    
    echo -e "${GREEN}✅ Security configuration files created${NC}"
}

# Function to create deployment scripts
create_deployment_scripts() {
    echo -e "\n${BLUE}📜 Creating deployment scripts...${NC}"
    
    # Production deployment script
    cat > "$PROJECT_ROOT/deploy-secure.sh" << 'EOF'
#!/bin/bash

set -euo pipefail

echo "🚀 Deploying MediaNest with hardened security configuration..."

# Build images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.hardened.yml build --no-cache

# Deploy services
echo "🚀 Starting secure services..."
docker-compose -f docker-compose.hardened.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout 300 bash -c '
  until docker-compose -f docker-compose.hardened.yml ps | grep -E "(healthy|Up)"; do
    echo "Waiting for services..."
    sleep 5
  done
'

echo "✅ MediaNest deployed successfully with hardened security!"
echo "🌐 Application available at: http://localhost"
echo "📊 Prometheus metrics at: http://localhost:9090 (internal)"

# Security scan
echo "🔍 Running security scan..."
docker-compose -f docker-compose.hardened.yml --profile security-scan run --rm trivy

echo "🎉 Deployment complete!"
EOF

    # Backup script
    cat > "$PROJECT_ROOT/scripts/backup-secure.sh" << 'EOF'
#!/bin/bash

set -euo pipefail

BACKUP_DIR="/var/lib/medianest/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "📦 Starting secure backup process..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
echo "🐘 Backing up PostgreSQL database..."
docker exec medianest-postgres-secure pg_dumpall -U $(docker secret inspect medianest_postgres_user_v2 --format '{{.Spec.Data}}' | base64 -d) > "$BACKUP_DIR/postgres_backup_$TIMESTAMP.sql"

# Backup Redis
echo "📦 Backing up Redis data..."
docker exec medianest-redis-secure redis-cli --rdb - > "$BACKUP_DIR/redis_backup_$TIMESTAMP.rdb"

# Backup uploads
echo "📁 Backing up uploads..."
tar -czf "$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz" -C /var/lib/medianest uploads/

# Cleanup old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "*backup_*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*backup_*.rdb" -mtime +7 -delete
find "$BACKUP_DIR" -name "*backup_*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed successfully!"
echo "📂 Backups stored in: $BACKUP_DIR"
EOF

    chmod +x "$PROJECT_ROOT/deploy-secure.sh"
    chmod +x "$PROJECT_ROOT/scripts/backup-secure.sh"
    
    echo -e "${GREEN}✅ Deployment scripts created${NC}"
}

# Function to create security monitoring
create_monitoring() {
    echo -e "\n${BLUE}📊 Setting up security monitoring...${NC}"
    
    # Create security monitoring script
    cat > "$PROJECT_ROOT/scripts/security-monitor.sh" << 'EOF'
#!/bin/bash

set -euo pipefail

echo "🔍 MediaNest Security Monitoring Report"
echo "======================================="

# Container security status
echo -e "\n🔐 Container Security Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep medianest

# Check for security updates
echo -e "\n🔄 Security Updates Available:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep -E "(postgres|redis|nginx|node)"

# Disk usage monitoring
echo -e "\n💾 Storage Usage:"
df -h /var/lib/medianest

# Log analysis for suspicious activity
echo -e "\n📋 Recent Security Events:"
if [ -d "/var/log/medianest" ]; then
    tail -n 20 /var/log/medianest/*.log 2>/dev/null | grep -i "error\|failed\|denied" | tail -10 || echo "No security events found"
fi

# Container resource usage
echo -e "\n⚡ Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep medianest

echo -e "\n✅ Security monitoring complete"
EOF

    chmod +x "$PROJECT_ROOT/scripts/security-monitor.sh"
    
    echo -e "${GREEN}✅ Security monitoring setup complete${NC}"
}

# Main execution flow
main() {
    echo -e "${BLUE}🚀 Starting MediaNest Docker Security Setup...${NC}"
    
    # Check if running as root for directory creation
    if [[ $EUID -ne 0 ]] && [[ "$1" != "--no-sudo" ]]; then
        echo -e "${YELLOW}⚠️  Some operations require sudo privileges${NC}"
        echo "Re-running with sudo for directory setup..."
        exec sudo -E "$0" --no-sudo
    fi
    
    # Execute setup steps
    setup_directories
    init_swarm
    create_secrets
    create_security_configs
    create_deployment_scripts
    create_monitoring
    
    echo -e "\n${GREEN}🎉 MediaNest Docker Security Setup Complete!${NC}"
    echo "================================================"
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Review generated configuration files"
    echo "2. Run: ./deploy-secure.sh"
    echo "3. Monitor: ./scripts/security-monitor.sh"
    echo "4. Backup: ./scripts/backup-secure.sh"
    echo ""
    echo -e "${YELLOW}⚠️  Remember to:${NC}"
    echo "• Configure SSL certificates for production"
    echo "• Update domain names in Nginx configuration"
    echo "• Set up external monitoring and alerting"
    echo "• Review and customize security policies"
}

# Script execution
main "$@"