# Staging Prerequisites

## Overview

This document outlines all infrastructure, software, and configuration prerequisites required for successful MediaNest staging deployment. Following these requirements ensures a stable and reliable staging environment.

!!! info "Deployment Validation"
    All prerequisites have been validated in our staging environment and are required for successful deployment with the applied critical fixes.

## System Requirements

### Hardware Requirements

| Component | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| **CPU** | 2 cores | 4 cores | AMD64/ARM64 architecture supported |
| **RAM** | 4GB | 8GB | Includes all services (app, DB, cache) |
| **Storage** | 20GB | 50GB | SSD recommended for database performance |
| **Network** | 10 Mbps | 100 Mbps | For media file operations |

### Operating System Support

**Supported Platforms:**
- Ubuntu 20.04 LTS or later
- CentOS/RHEL 8 or later  
- macOS 10.15 or later
- Windows Server 2019 or later (with WSL2)

**Container Runtime:**
- Docker Engine 20.10+ with Docker Compose v2.0+
- Podman 3.0+ (experimental support)

## Software Dependencies

### Required Software

#### 1. Docker Environment

```bash
# Install Docker Engine (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

**Version Requirements:**
- Docker Engine: 20.10.0+
- Docker Compose: 2.0.0+

#### 2. Git Version Control

```bash
# Install Git
sudo apt-get update && sudo apt-get install git

# Verify installation
git --version
```

**Version Requirements:**
- Git: 2.30.0+

#### 3. SSL/TLS Tools (Optional for HTTPS)

```bash
# Install OpenSSL
sudo apt-get install openssl

# Generate self-signed certificate (development)
openssl req -x509 -newkey rsa:4096 -keyout staging.key -out staging.crt -days 365 -nodes
```

### Optional Software

#### Node.js (for development/debugging)

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Recommended Version:**
- Node.js: 18.17.0+ (LTS)
- npm: 9.0.0+

## Database Requirements

### PostgreSQL Configuration

#### Database Server

**Option 1: Docker Container (Recommended)**
```yaml
postgres:
  image: postgres:14-alpine
  environment:
    - POSTGRES_DB=medianest_staging
    - POSTGRES_USER=medianest_user
    - POSTGRES_PASSWORD=${DB_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

**Option 2: External Database**
- PostgreSQL 14.0+ server
- Minimum 2GB RAM allocated to PostgreSQL
- UTF-8 encoding support
- Required extensions: `uuid-ossp`, `pgcrypto`

#### Database Preparation

```bash
# Connect to PostgreSQL server
psql -h your-db-host -U postgres

# Create database and user
CREATE DATABASE medianest_staging WITH ENCODING 'UTF8';
CREATE USER medianest_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE medianest_staging TO medianest_user;

# Enable required extensions
\c medianest_staging
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\q
```

#### Connection Requirements

- **Host**: Database server hostname/IP
- **Port**: 5432 (default) or custom port
- **SSL**: Recommended for production
- **Connection Pool**: 10-20 connections minimum

### Redis Configuration

#### Redis Server

**Option 1: Docker Container (Recommended)**
```yaml
redis:
  image: redis:6-alpine
  command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
```

**Option 2: External Redis**
- Redis 6.0+ server
- Minimum 1GB memory allocation
- Persistence enabled (AOF or RDB)
- Eviction policy configured

#### Redis Preparation

```bash
# Connect to Redis
redis-cli

# Test connection
ping
# Should return: PONG

# Configure memory policy
CONFIG SET maxmemory 1gb
CONFIG SET maxmemory-policy allkeys-lru

# Enable persistence
CONFIG SET appendonly yes

# Save configuration
CONFIG REWRITE
```

## Network Configuration

### Port Requirements

| Service | Port | Protocol | Access | Purpose |
|---------|------|----------|--------|---------|
| MediaNest API | 3000 | HTTP/HTTPS | External | Main application |
| Frontend | 3001 | HTTP/HTTPS | External | Web interface |
| PostgreSQL | 5432 | TCP | Internal | Database |
| Redis | 6379 | TCP | Internal | Cache/Sessions |
| Health Check | 8080 | HTTP | Internal | Monitoring |

### Firewall Configuration

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 3000/tcp comment "MediaNest API"
sudo ufw allow 3001/tcp comment "MediaNest Frontend"

# For external database access (if needed)
sudo ufw allow from 10.0.0.0/8 to any port 5432 comment "PostgreSQL"
sudo ufw allow from 10.0.0.0/8 to any port 6379 comment "Redis"

# Enable firewall
sudo ufw --force enable
```

### DNS Configuration

**Required DNS Records:**
- A record for staging domain (e.g., `staging.medianest.com`)
- Optional: CNAME for API subdomain (e.g., `api-staging.medianest.com`)

## Environment Configuration

### Environment Variables

#### Required Variables

Create `.env.staging` file with required configuration:

```bash
# Application Configuration
NODE_ENV=staging
PORT=3000
LOG_LEVEL=info

# Database Configuration  
DATABASE_URL=postgresql://medianest_user:${DB_PASSWORD}@postgres:5432/medianest_staging

# Cache Configuration
REDIS_URL=redis://redis:6379

# Security Configuration
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Plex Integration
PLEX_URL=http://your-plex-server:32400
PLEX_TOKEN=your-plex-token-here

# File Storage
MEDIA_PATH=/app/storage/media
UPLOAD_MAX_SIZE=100MB

# Health Check Configuration
HEALTH_CHECK_TIMEOUT=30000
HEALTH_CHECK_INTERVAL=60000
```

#### Security Variables

Generate secure values for secrets:

```bash
# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Generate session secret
echo "SESSION_SECRET=$(openssl rand -base64 32)"

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 16 | tr -d '\n=' | head -c 16)"
```

### Plex Server Configuration

#### Plex Token Generation

```bash
# Method 1: Via Plex Web Interface
# 1. Open Plex Web App
# 2. Open browser developer tools
# 3. Go to Network tab
# 4. Refresh page
# 5. Look for request headers with X-Plex-Token

# Method 2: Via XML request
curl -u "username:password" \
  "https://plex.tv/users/sign_in.xml" \
  -X POST \
  -H "X-Plex-Client-Identifier: unique-client-id"
# Extract token from XML response
```

#### Plex Server Preparation

**Required Plex Configuration:**
- Plex Media Server 1.25.0+
- Remote access enabled
- Library sharing configured
- API access allowed

**Network Requirements:**
- Plex server accessible from staging environment
- Port 32400 open for API access
- Firewall rules configured for communication

## Storage Configuration

### File System Requirements

#### Media Storage

```bash
# Create media storage directory
sudo mkdir -p /opt/medianest/storage/media
sudo chown -R 1000:1000 /opt/medianest/storage

# Set proper permissions
sudo chmod -R 755 /opt/medianest/storage
```

#### Docker Volumes

```yaml
volumes:
  # Database persistence
  postgres_data:
    driver: local
    driver_opts:
      type: ext4
      device: /dev/disk/medianest-db
      
  # Redis persistence  
  redis_data:
    driver: local
    
  # Media file storage
  media_storage:
    driver: local
    driver_opts:
      type: ext4
      device: /dev/disk/medianest-media
```

### Backup Storage

```bash
# Create backup directory
sudo mkdir -p /opt/medianest/backups
sudo chown -R 1000:1000 /opt/medianest/backups

# Configure backup retention
echo "0 2 * * * find /opt/medianest/backups -name '*.sql' -mtime +7 -delete" | sudo crontab -
```

## Security Requirements

### SSL/TLS Configuration

#### Generate SSL Certificates

**Option 1: Self-Signed (Development)**
```bash
# Generate private key
openssl genrsa -out staging.medianest.com.key 2048

# Generate certificate signing request
openssl req -new -key staging.medianest.com.key -out staging.medianest.com.csr

# Generate self-signed certificate
openssl x509 -req -days 365 -in staging.medianest.com.csr \
  -signkey staging.medianest.com.key -out staging.medianest.com.crt
```

**Option 2: Let's Encrypt (Production)**
```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d staging.medianest.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Access Control

#### User Management

```bash
# Create service user
sudo useradd -r -s /bin/false medianest

# Set up sudo access for deployment
echo "medianest ALL=(ALL) NOPASSWD: /usr/bin/docker-compose" | sudo tee /etc/sudoers.d/medianest
```

#### File Permissions

```bash
# Set up proper file ownership
sudo chown -R medianest:medianest /opt/medianest

# Secure configuration files
chmod 600 .env.staging
chmod 600 /opt/medianest/ssl/*.key
```

## Monitoring Configuration

### Health Check Setup

Create health check endpoints verification:

```bash
#!/bin/bash
# health-check-setup.sh

# Test API health endpoint
curl -f http://localhost:3000/api/health || {
    echo "API health check endpoint not accessible"
    exit 1
}

# Test database connectivity
docker-compose exec postgres pg_isready -U medianest_user || {
    echo "Database not ready"
    exit 1
}

# Test Redis connectivity  
docker-compose exec redis redis-cli ping || {
    echo "Redis not ready"
    exit 1
}

echo "All health checks passed"
```

### Log Configuration

```bash
# Create log directories
sudo mkdir -p /var/log/medianest/{app,db,access}
sudo chown -R medianest:medianest /var/log/medianest

# Configure log rotation
cat > /etc/logrotate.d/medianest << EOF
/var/log/medianest/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
```

## Validation Checklist

### Pre-Deployment Validation

Use this checklist before starting deployment:

- [ ] **System Requirements**
  - [ ] Minimum hardware specifications met
  - [ ] Operating system supported and updated
  - [ ] Required disk space available

- [ ] **Software Dependencies**
  - [ ] Docker Engine installed and running
  - [ ] Docker Compose installed and working
  - [ ] Git installed and configured

- [ ] **Database Setup**
  - [ ] PostgreSQL server accessible
  - [ ] Database and user created
  - [ ] Required extensions installed
  - [ ] Connection string tested

- [ ] **Cache Setup**
  - [ ] Redis server accessible
  - [ ] Memory configuration set
  - [ ] Persistence enabled
  - [ ] Connection string tested

- [ ] **Network Configuration**
  - [ ] Required ports available
  - [ ] Firewall rules configured
  - [ ] DNS records configured (if applicable)

- [ ] **Environment Configuration**
  - [ ] Environment variables configured
  - [ ] Secrets generated and secured
  - [ ] Plex integration configured

- [ ] **Storage Configuration**
  - [ ] Storage directories created
  - [ ] Proper permissions set
  - [ ] Backup storage configured

- [ ] **Security Configuration**
  - [ ] SSL certificates installed (if applicable)
  - [ ] User access configured
  - [ ] File permissions secured

### Validation Scripts

```bash
#!/bin/bash
# validate-prerequisites.sh

echo "🔍 Validating MediaNest Staging Prerequisites"
echo "============================================"

# Check Docker
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is installed: $(docker --version)"
else
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose >/dev/null 2>&1; then
    echo "✅ Docker Compose is installed: $(docker-compose --version)"
else
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Check available ports
for port in 3000 3001; do
    if netstat -tuln | grep -q ":$port "; then
        echo "⚠️ Port $port is already in use"
    else
        echo "✅ Port $port is available"
    fi
done

# Check disk space
available_space=$(df / | tail -1 | awk '{print $4}')
required_space=$((20 * 1024 * 1024)) # 20GB in KB

if [ "$available_space" -gt "$required_space" ]; then
    echo "✅ Sufficient disk space available"
else
    echo "❌ Insufficient disk space (need 20GB minimum)"
    exit 1
fi

# Check memory
total_mem=$(free -m | awk 'NR==2{print $2}')
if [ "$total_mem" -gt 4096 ]; then
    echo "✅ Sufficient memory available (${total_mem}MB)"
else
    echo "⚠️ Low memory (${total_mem}MB, recommended 4GB+)"
fi

echo "🎉 Prerequisites validation completed"
```

## Troubleshooting

### Common Prerequisites Issues

#### Docker Installation Issues

```bash
# Permission denied error
sudo usermod -aG docker $USER
newgrp docker

# Service not running
sudo systemctl start docker
sudo systemctl enable docker

# Version too old
sudo apt-get remove docker docker-engine docker.io containerd runc
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U medianest_user -d medianest_staging -c "SELECT version();"

# Check PostgreSQL service
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### Network Connectivity Issues

```bash
# Test port availability
telnet localhost 3000

# Check firewall status
sudo ufw status

# Test DNS resolution
nslookup staging.medianest.com
```

### Getting Help

For additional support with prerequisites:

- **Documentation**: [Staging Deployment Guide](staging-deployment.md)
- **Troubleshooting**: [Staging Troubleshooting Guide](staging-troubleshooting.md)
- **Issues**: [GitHub Issues](https://github.com/kinginyellow/medianest/issues)

---

**Next Step**: Once all prerequisites are met, proceed to [Staging Deployment Guide](staging-deployment.md).