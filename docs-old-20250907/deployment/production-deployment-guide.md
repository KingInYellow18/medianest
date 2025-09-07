# Production Deployment Guide

This comprehensive guide covers deploying MediaNest in production using Docker Compose with security hardening, monitoring, and SSL/TLS termination.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Security Configuration](#security-configuration)
- [Docker Compose Deployment](#docker-compose-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring Setup](#monitoring-setup)
- [Health Checks](#health-checks)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Hardware:**

- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- Network: 1 Gbps

**Recommended Hardware:**

- CPU: 8 cores
- RAM: 16GB
- Storage: 500GB NVMe SSD
- Network: 10 Gbps

**Software Requirements:**

- Docker 24.0+
- Docker Compose 2.20+
- Linux (Ubuntu 22.04+ or CentOS 8+)
- OpenSSL 1.1.1+
- curl, wget

### Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## Environment Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd medianest
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Critical Environment Variables:**

```bash
# Security
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Database
DB_PASSWORD=$(openssl rand -base64 16)
POSTGRES_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_PASSWORD=$(openssl rand -base64 16)

# Domain Configuration
DOMAIN_NAME=medianest.yourdomain.com
FRONTEND_URL=https://${DOMAIN_NAME}
NEXTAUTH_URL=https://${DOMAIN_NAME}

# Email (for SSL certificates)
CERTBOT_EMAIL=admin@yourdomain.com

# Container Registry (optional)
CONTAINER_REGISTRY=docker.io
VERSION=latest
```

### 3. Directory Structure Setup

```bash
# Create required directories
mkdir -p {data,logs,backups,secrets}
mkdir -p data/{postgres,redis,downloads,uploads,certbot}
mkdir -p logs/{backend,frontend,nginx,certbot}
mkdir -p backups/{postgres,redis}

# Set permissions
sudo chown -R 1001:1001 data/downloads data/uploads logs/backend logs/frontend
sudo chown -R 999:999 data/postgres logs/postgres
sudo chown -R 999:999 data/redis logs/redis
sudo chown -R 101:101 logs/nginx
```

## Security Configuration

### 1. Generate Secrets

```bash
# Run the secret generation script
./scripts/generate-docker-secrets.sh

# Or manually create secrets
mkdir -p secrets
echo -n "$(openssl rand -base64 32)" > secrets/database_url
echo -n "${DB_PASSWORD}" > secrets/postgres_password
echo -n "${REDIS_PASSWORD}" > secrets/redis_password
echo -n "$(openssl rand -base64 32)" > secrets/jwt_secret
echo -n "$(openssl rand -base64 32)" > secrets/encryption_key
echo -n "$(openssl rand -base64 32)" > secrets/nextauth_secret

# Secure permissions
chmod 600 secrets/*
```

### 2. SSL/TLS Preparation

```bash
# Generate DH parameters (takes time)
openssl dhparam -out infrastructure/nginx/ssl/dhparam.pem 4096

# Set proper permissions
chmod 600 infrastructure/nginx/ssl/dhparam.pem
```

## Docker Compose Deployment

MediaNest provides two production-ready compose files:

- `docker-compose.prod.yml` - Full production setup with security hardening
- `docker-compose.production.yml` - Alternative configuration with monitoring

### Option 1: Primary Production Deployment

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Check services
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Option 2: Alternative Production Setup

```bash
# Deploy with monitoring stack
docker-compose -f docker-compose.production.yml up -d

# Enable monitoring profile
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

### Service Architecture

**Core Services:**

- **nginx**: Reverse proxy with SSL termination, rate limiting
- **backend**: Node.js API server with health checks
- **frontend**: Next.js application with SSR
- **postgres**: Primary database with performance tuning
- **redis**: Cache and session store with persistence

**Optional Services:**

- **certbot**: Automated SSL certificate management
- **prometheus**: Metrics collection
- **promtail**: Log aggregation
- **backup**: Automated backup service

## SSL/TLS Configuration

### 1. Initial Certificate Generation

```bash
# Start nginx without SSL first
docker-compose -f docker-compose.prod.yml up nginx -d

# Generate initial certificate
docker-compose -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot -w /var/www/certbot \
    --email ${CERTBOT_EMAIL} --agree-tos --no-eff-email \
    -d ${DOMAIN_NAME}

# Restart nginx with SSL
docker-compose -f docker-compose.prod.yml restart nginx
```

### 2. Automatic Renewal

Certbot container runs automatically to renew certificates. Monitor logs:

```bash
docker-compose -f docker-compose.prod.yml logs certbot
```

### 3. SSL Configuration Details

The nginx configuration includes:

- **TLS 1.2/1.3 only** with strong cipher suites
- **HSTS** with preload directive
- **OCSP stapling** for certificate verification
- **Perfect Forward Secrecy** with DH parameters
- **Security headers** (CSP, XSS protection, etc.)

## Monitoring Setup

### 1. Enable Monitoring Profile

```bash
# Start monitoring stack
docker-compose -f docker-compose.production.yml --profile monitoring up -d

# Verify monitoring services
docker-compose -f docker-compose.production.yml ps prometheus promtail
```

### 2. Prometheus Configuration

Access Prometheus at `http://localhost:9090` (internal only)

**Key Metrics:**

- Application response times
- Database connection pool status
- Redis memory usage
- Nginx request rates
- Container resource usage

### 3. Log Aggregation

Promtail collects logs from:

- Application containers
- Nginx access/error logs
- System logs
- Docker container logs

## Health Checks

### 1. Built-in Health Endpoints

All services include comprehensive health checks:

```bash
# Backend health
curl https://${DOMAIN_NAME}/api/health

# Frontend health
curl https://${DOMAIN_NAME}/api/health

# Database connectivity
docker-compose exec postgres pg_isready -U medianest

# Redis connectivity
docker-compose exec redis redis-cli ping
```

### 2. External Monitoring

Configure external monitoring to check:

- `https://${DOMAIN_NAME}/api/health`
- `https://${DOMAIN_NAME}/api/ready`
- SSL certificate expiration
- DNS resolution

### 3. Health Check Script

```bash
#!/bin/bash
# Health check script
./scripts/production-health-check.sh
```

## Scaling

### 1. Horizontal Scaling

```bash
# Scale backend service
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale with load balancing
docker-compose -f docker-compose.prod.yml up -d --scale backend=3 --scale frontend=2
```

### 2. Resource Limits

Services have pre-configured resource limits:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

### 3. Database Optimization

PostgreSQL includes performance tuning:

```bash
# Apply custom configuration
cp infrastructure/database/postgresql.conf /path/to/postgres/data/
docker-compose restart postgres
```

## Backup and Recovery

### 1. Automated Backups

```bash
# Enable backup service
docker-compose -f docker-compose.production.yml --profile backup up -d

# Manual backup
docker-compose -f docker-compose.production.yml run --rm backup
```

### 2. Backup Components

- PostgreSQL database dump
- Redis persistence files
- Application uploads/downloads
- Configuration files
- SSL certificates

### 3. Restore Process

```bash
# Restore from backup
./scripts/restore-backup.sh /path/to/backup/20231207_143022
```

## Security Hardening

### 1. Container Security

- **Non-root users** (UID 1001:1001)
- **Read-only filesystems** where possible
- **No new privileges** flag
- **Minimal capabilities** (CAP_DROP=ALL)
- **Security scanning** with Trivy

### 2. Network Security

- **Isolated networks** for frontend/backend
- **Internal service communication** only
- **Rate limiting** on all endpoints
- **WAF-style filtering** in nginx

### 3. Runtime Security

- **Secret management** via Docker secrets
- **Environment isolation**
- **Resource constraints**
- **Security monitoring**

## Deployment Checklist

### Pre-Deployment

- [ ] Hardware requirements met
- [ ] Docker and Docker Compose installed
- [ ] Domain DNS configured
- [ ] SSL certificates ready
- [ ] Environment variables configured
- [ ] Secrets generated
- [ ] Firewall rules configured
- [ ] Monitoring setup planned

### Deployment

- [ ] Services started successfully
- [ ] Health checks passing
- [ ] SSL certificates working
- [ ] Database migrations completed
- [ ] Static assets served correctly
- [ ] API endpoints responding
- [ ] WebSocket connections working

### Post-Deployment

- [ ] External monitoring configured
- [ ] Backup schedule verified
- [ ] Log rotation configured
- [ ] Security scan completed
- [ ] Performance baseline established
- [ ] Documentation updated
- [ ] Team access configured

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**

   ```bash
   # Check certificate status
   docker-compose logs certbot

   # Renew manually
   docker-compose run --rm certbot renew
   ```

2. **Database Connection Issues**

   ```bash
   # Check database logs
   docker-compose logs postgres

   # Test connection
   docker-compose exec backend npm run db:test
   ```

3. **High Memory Usage**

   ```bash
   # Check resource usage
   docker stats

   # Adjust memory limits
   # Edit docker-compose.prod.yml
   ```

4. **Nginx Configuration Issues**

   ```bash
   # Test configuration
   docker-compose exec nginx nginx -t

   # Reload configuration
   docker-compose exec nginx nginx -s reload
   ```

### Performance Issues

1. **Database Performance**

   ```bash
   # Check slow queries
   docker-compose exec postgres psql -U medianest -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   ```

2. **Redis Memory**

   ```bash
   # Check Redis info
   docker-compose exec redis redis-cli info memory
   ```

3. **Application Metrics**
   ```bash
   # View Prometheus metrics
   curl http://localhost:9090/metrics
   ```

## Maintenance

### Regular Tasks

1. **Daily**

   - Monitor health endpoints
   - Check backup completion
   - Review error logs
   - Monitor resource usage

2. **Weekly**

   - Update dependencies
   - Review security logs
   - Check SSL certificate expiration
   - Performance analysis

3. **Monthly**
   - Security patches
   - Database maintenance
   - Log rotation cleanup
   - Capacity planning

### Update Process

```bash
# 1. Backup current deployment
./scripts/backup.sh

# 2. Pull latest changes
git pull origin main

# 3. Rebuild with new version
VERSION=new-version docker-compose -f docker-compose.prod.yml up -d --build

# 4. Verify deployment
./scripts/production-health-check.sh
```

## Support

For additional support:

- Check logs: `docker-compose logs -f`
- Run health checks: `./scripts/production-health-check.sh`
- Monitor resources: `docker stats`
- Review documentation: `/docs/`
