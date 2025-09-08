# MediaNest Comprehensive Deployment Guide

**Version:** 2.0  
**Last Updated:** September 2025  
**Consolidation:** Merged from 8 deployment documents for unified reference

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Environment Setup](#environment-setup)
5. [Docker Deployment](#docker-deployment)
6. [Manual Deployment](#manual-deployment)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Database Setup](#database-setup)
9. [Security Hardening](#security-hardening)
10. [Service Integration](#service-integration)
11. [Monitoring & Logging](#monitoring--logging)
12. [Backup & Recovery](#backup--recovery)
13. [Production Readiness Checklist](#production-readiness-checklist)
14. [Scaling & Performance](#scaling--performance)
15. [Troubleshooting](#troubleshooting)
16. [Staging Deployment](#staging-deployment)

## Overview

MediaNest supports multiple deployment methods for different environments:

- **Docker Deployment** (Recommended for production)
- **Manual Deployment** (Development/testing)
- **Staging Deployment** (Pre-production validation)

### Deployment Architecture

```
[Internet] → [Nginx (SSL)] → [Docker Network]
                              ├── Frontend (React)
                              ├── Backend (Express)
                              ├── PostgreSQL
                              ├── Redis
                              └── Monitoring Stack
```

## Prerequisites

### System Requirements

**Minimum Requirements:**

- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **CPU**: 2+ cores (4+ cores recommended)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB minimum for application and logs (50GB+ for production)
- **Docker**: Version 24.0+ with Docker Compose V2
- **Node.js**: 20.x LTS (for manual deployment)

**Production Recommendations:**

- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB+ SSD
- **Network**: 1 Gbps connection
- **PostgreSQL**: 15.x
- **Redis**: 7.x
- **Nginx**: Latest stable (for SSL termination)

### Network Requirements

**Ports to Configure:**

- `80` (HTTP - redirect to HTTPS)
- `443` (HTTPS)
- `4000` (Backend API - internal only)
- `3000` (Frontend - internal only)
- `5432` (PostgreSQL - internal only)
- `6379` (Redis - internal only)
- `3001` (Monitoring - internal only)

### Domain & DNS Setup

- Domain name with DNS configured
- SSL certificate (Let's Encrypt recommended)
- Subdomain configuration for monitoring (optional)

## Quick Start

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/medianest.git
cd medianest
```

### 2. Generate Secrets

```bash
# Generate secure secrets
./scripts/generate-docker-secrets.sh
```

### 3. Environment Configuration

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit with your configuration
nano .env.production
```

**Required Environment Variables:**

```bash
# Domain Configuration
DOMAIN_NAME=media.yourdomain.com
CERTBOT_EMAIL=admin@yourdomain.com

# Database
POSTGRES_DB=medianest
POSTGRES_USER=medianest
POSTGRES_PASSWORD=<generated_password>

# Redis
REDIS_PASSWORD=<generated_password>

# JWT Secrets
JWT_SECRET=<generated_secret>
JWT_REFRESH_SECRET=<generated_refresh_secret>
```

### 4. SSL Certificate Setup

```bash
# Setup SSL certificates
DOMAIN_NAME=media.yourdomain.com CERTBOT_EMAIL=admin@yourdomain.com ./scripts/setup-ssl.sh
```

### 5. Deploy

```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Verify deployment
docker-compose -f docker-compose.production.yml ps
```

## Environment Setup

### Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git ufw fail2ban htop tree

# Configure firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Directory Structure Setup

```bash
# Create application directories
sudo mkdir -p /opt/medianest/{data,logs,backups,ssl}
sudo chown -R $USER:$USER /opt/medianest

# Create log directories
mkdir -p /opt/medianest/logs/{backend,frontend,nginx,postgres,redis}
```

## Docker Deployment

### Production Docker Compose

The production deployment uses the optimized `docker-compose.production.yml` configuration:

**Key Features:**

- Multi-stage builds for optimized images
- Health checks for all services
- Resource limits and reservations
- Restart policies
- Network isolation
- Volume management for persistence

### Service Configuration

**Frontend Service:**

```yaml
frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile.prod
  restart: unless-stopped
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
    interval: 30s
    timeout: 10s
    retries: 3
```

**Backend Service:**

```yaml
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile.prod
  restart: unless-stopped
  environment:
    - NODE_ENV=production
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:4000/health']
```

### Volume Management

```bash
# Create named volumes for persistence
docker volume create medianest_postgres_data
docker volume create medianest_redis_data
docker volume create medianest_uploads
```

### Deployment Commands

```bash
# Deploy to production
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Update deployment
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d --build

# Scale services
docker-compose -f docker-compose.production.yml up -d --scale backend=3
```

## Manual Deployment

For development or custom deployment scenarios:

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run database migrations
npm run migrate

# Start backend
NODE_ENV=production npm start
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Build production assets
npm run build

# Serve static files
npm run start
```

### Database Setup

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres createdb medianest
sudo -u postgres createuser medianest
sudo -u postgres psql -c "ALTER USER medianest PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest;"
```

## SSL/TLS Configuration

### Let's Encrypt Setup

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d media.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Custom Certificate

```bash
# Place certificates in SSL directory
sudo cp your-cert.crt /opt/medianest/ssl/
sudo cp your-key.key /opt/medianest/ssl/
sudo cp ca-bundle.crt /opt/medianest/ssl/

# Set proper permissions
sudo chmod 644 /opt/medianest/ssl/*.crt
sudo chmod 600 /opt/medianest/ssl/*.key
```

### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;

    # SSL Security Headers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Database Setup

### PostgreSQL Production Configuration

```bash
# Create production database
docker exec -it medianest_postgres_1 psql -U postgres

CREATE DATABASE medianest_prod;
CREATE USER medianest_prod WITH ENCRYPTED PASSWORD 'production_password';
GRANT ALL PRIVILEGES ON DATABASE medianest_prod TO medianest_prod;
ALTER DATABASE medianest_prod OWNER TO medianest_prod;
\q
```

### Database Migrations

```bash
# Run migrations
cd backend
npm run migrate:prod

# Seed initial data
npm run seed:prod
```

### Database Backup Strategy

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/opt/medianest/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="medianest_prod"

# Create backup
docker exec medianest_postgres_1 pg_dump -U postgres $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

## Security Hardening

### Critical Security Fixes Applied ✅

- [x] JWT secret fallbacks removed
- [x] Random salt encryption implemented
- [x] Environment validation enforced
- [x] CSRF protection enabled
- [x] Rate limiting implemented
- [x] Security headers configured

### Firewall Configuration

```bash
# Configure UFW
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
```

### Fail2Ban Setup

```bash
# Install fail2ban
sudo apt install fail2ban

# Configure jail for nginx
sudo tee /etc/fail2ban/jail.d/nginx.conf << EOF
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600

[nginx-noscript]
enabled = true
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
bantime = 86400
EOF

sudo systemctl restart fail2ban
```

### System Security

```bash
# Disable root login
sudo passwd -l root

# Configure automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Service Integration

### OAuth Providers Setup

**Plex Integration:**

```bash
# Environment variables
PLEX_CLIENT_ID=your_plex_client_id
PLEX_CLIENT_SECRET=your_plex_client_secret
PLEX_REDIRECT_URI=https://media.yourdomain.com/auth/plex/callback
```

**Google OAuth:**

```bash
# Environment variables
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://media.yourdomain.com/auth/google/callback
```

**GitHub OAuth:**

```bash
# Environment variables
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://media.yourdomain.com/auth/github/callback
```

### External Service Configuration

**Redis Configuration:**

```bash
# Redis security
requirepass your_redis_password
bind 127.0.0.1
protected-mode yes
```

**Email Service Setup:**

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## Monitoring & Logging

### Log Management

**Log Rotation:**

```bash
# Configure logrotate
sudo tee /etc/logrotate.d/medianest << EOF
/opt/medianest/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
}
EOF
```

### Health Monitoring

**Health Check Endpoints:**

- Frontend: `https://media.yourdomain.com/health`
- Backend: `https://media.yourdomain.com/api/health`
- Database: Internal health check in backend

**Monitoring Script:**

```bash
#!/bin/bash
# Health check script
DOMAIN="media.yourdomain.com"

# Check frontend
if curl -f "https://$DOMAIN/health" > /dev/null 2>&1; then
    echo "✅ Frontend healthy"
else
    echo "❌ Frontend unhealthy"
fi

# Check backend
if curl -f "https://$DOMAIN/api/health" > /dev/null 2>&1; then
    echo "✅ Backend healthy"
else
    echo "❌ Backend unhealthy"
fi
```

### Performance Monitoring

**Prometheus & Grafana Setup:**

```yaml
# Add to docker-compose.production.yml
prometheus:
  image: prom/prometheus:latest
  ports:
    - '9090:9090'
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  ports:
    - '3001:3000'
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin_password
```

## Backup & Recovery

### Automated Backup System

**Backup Script:**

```bash
#!/bin/bash
# /opt/medianest/scripts/backup.sh

BACKUP_DIR="/opt/medianest/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker exec medianest_postgres_1 pg_dump -U postgres medianest > $BACKUP_DIR/db_$DATE.sql

# Application data backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/medianest/data/uploads/

# Configuration backup
tar -czf $BACKUP_DIR/config_$DATE.tar.gz .env.production docker-compose.production.yml

# Cleanup old backups (keep 14 days)
find $BACKUP_DIR -name "*.sql" -o -name "*.tar.gz" | sort | head -n -14 | xargs rm -f

echo "Backup completed: $DATE"
```

**Cron Job Setup:**

```bash
# Add to crontab
0 2 * * * /opt/medianest/scripts/backup.sh
```

### Disaster Recovery

**Recovery Process:**

1. Restore database from backup
2. Restore uploaded files
3. Restore configuration files
4. Rebuild and restart services

```bash
# Recovery script example
#!/bin/bash
BACKUP_DATE="20250907_020000"
BACKUP_DIR="/opt/medianest/backups"

# Stop services
docker-compose -f docker-compose.production.yml down

# Restore database
docker exec -i medianest_postgres_1 psql -U postgres medianest < $BACKUP_DIR/db_$BACKUP_DATE.sql

# Restore uploads
tar -xzf $BACKUP_DIR/uploads_$BACKUP_DATE.tar.gz -C /

# Start services
docker-compose -f docker-compose.production.yml up -d
```

## Production Readiness Checklist

### Pre-Deployment Checklist

**Security:**

- [ ] JWT secrets generated and secured
- [ ] Environment variables validated
- [ ] SSL certificates installed and configured
- [ ] Firewall rules configured
- [ ] Fail2ban installed and configured
- [ ] Security headers implemented
- [ ] CSRF protection enabled
- [ ] Rate limiting configured

**Infrastructure:**

- [ ] Domain DNS configured
- [ ] SSL certificates auto-renewal tested
- [ ] Backup system operational
- [ ] Monitoring configured
- [ ] Log rotation configured
- [ ] Health checks functional

**Application:**

- [ ] Database migrations completed
- [ ] OAuth providers configured
- [ ] Email service configured
- [ ] File uploads directory writable
- [ ] Environment-specific configuration validated

**Testing:**

- [ ] End-to-end tests passing
- [ ] Load testing completed
- [ ] Security testing performed
- [ ] Backup/restore tested

### Post-Deployment Verification

```bash
# Verification script
#!/bin/bash
echo "🔍 Verifying MediaNest deployment..."

# Check services
echo "Checking services..."
docker-compose -f docker-compose.production.yml ps

# Check health endpoints
echo "Checking health endpoints..."
curl -f "https://media.yourdomain.com/health"
curl -f "https://media.yourdomain.com/api/health"

# Check SSL certificate
echo "Checking SSL certificate..."
openssl s_client -connect media.yourdomain.com:443 -servername media.yourdomain.com < /dev/null

# Check security headers
echo "Checking security headers..."
curl -I "https://media.yourdomain.com"

echo "✅ Deployment verification complete"
```

## Scaling & Performance

### Horizontal Scaling

**Load Balancer Configuration:**

```nginx
upstream backend_servers {
    server backend_1:4000;
    server backend_2:4000;
    server backend_3:4000;
}

server {
    location /api {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Database Scaling:**

- Read replicas for query scaling
- Connection pooling
- Query optimization
- Index optimization

**Redis Scaling:**

- Redis Cluster for high availability
- Sentinel for failover
- Memory optimization

### Performance Optimization

**Application Level:**

- Response caching
- Database query optimization
- Static asset optimization
- API response compression

**Infrastructure Level:**

- CDN integration
- Database tuning
- Redis optimization
- Load balancing

## Troubleshooting

### Common Issues

**Service Won't Start:**

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs service_name

# Check resource usage
docker stats

# Check disk space
df -h
```

**Database Connection Issues:**

```bash
# Check PostgreSQL status
docker exec medianest_postgres_1 pg_isready

# Check connection from backend
docker exec medianest_backend_1 nc -zv postgres 5432
```

**SSL Certificate Issues:**

```bash
# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/media.yourdomain.com/cert.pem -noout -dates

# Renew certificate manually
sudo certbot renew

# Test certificate
openssl s_client -connect media.yourdomain.com:443 -servername media.yourdomain.com
```

**Performance Issues:**

```bash
# Check resource usage
htop
docker stats

# Check logs for errors
tail -f /opt/medianest/logs/*.log

# Check database performance
docker exec medianest_postgres_1 psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

### Emergency Procedures

**Service Restart:**

```bash
# Graceful restart
docker-compose -f docker-compose.production.yml restart

# Hard restart with rebuild
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build
```

**Rollback Deployment:**

```bash
# Rollback to previous version
git checkout previous_commit_hash
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build
```

**Database Recovery:**

```bash
# Stop application
docker-compose -f docker-compose.production.yml stop backend

# Restore from backup
docker exec -i medianest_postgres_1 psql -U postgres medianest < /opt/medianest/backups/latest_backup.sql

# Start application
docker-compose -f docker-compose.production.yml start backend
```

## Staging Deployment

### Staging Environment Setup

**Environment Configuration:**

```bash
# Create staging environment file
cp .env.production.example .env.staging

# Configure staging-specific values
DOMAIN_NAME=staging.media.yourdomain.com
DATABASE_NAME=medianest_staging
REDIS_DATABASE=1
```

**Staging Docker Compose:**

```bash
# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d

# Run staging tests
npm run test:e2e:staging
```

### Staging Validation

**Pre-Production Testing:**

1. End-to-end functionality tests
2. Performance testing
3. Security testing
4. Data migration testing
5. Backup/restore testing

**Staging Promotion:**

```bash
# Promote staging to production
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# Deploy tagged version to production
git checkout v1.0.0
docker-compose -f docker-compose.production.yml up -d --build
```

---

## Support & Maintenance

### Regular Maintenance Tasks

**Weekly:**

- Review system logs
- Check disk space usage
- Verify backup integrity
- Update system packages

**Monthly:**

- Security updates
- Performance review
- Log analysis
- Backup cleanup

**Quarterly:**

- Security audit
- Performance optimization
- Dependency updates
- Documentation review

### Getting Help

**Documentation:**

- [Architecture Overview](./02-architecture/README.md)
- [API Reference](./03-api-reference/README.md)
- [Security Guide](./07-security/README.md)
- [Monitoring Guide](./08-monitoring/README.md)

**Support Channels:**

- GitHub Issues
- Documentation Wiki
- Community Forum

---

**Last Updated:** September 7, 2025  
**Document Version:** 2.0  
**Consolidation Note:** This guide combines content from 8 previously separate deployment documents for unified reference.
