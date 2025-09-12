# MediaNest Docker Compose Deployment Guide

**Complete guide for deploying MediaNest using Docker Compose in production and development environments.**

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Production Deployment](#production-deployment)
- [Development Deployment](#development-deployment)
- [Configuration Management](#configuration-management)
- [Service Management](#service-management)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Backup & Recovery](#backup--recovery)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Quick Start

### Automated Production Deployment

```bash
# One-command production deployment
./deployment/scripts/deploy-compose.sh --domain your-domain.com --email admin@your-domain.com

# The script automatically:
# - Generates secure secrets
# - Sets up SSL certificates (Let's Encrypt)
# - Configures Nginx reverse proxy
# - Initializes database and runs migrations
# - Verifies all service health
```

### Development Environment

```bash
# Start development environment
docker compose -f config/docker/docker-compose.dev.yml up -d

# Initialize development database
npm run db:migrate:dev
npm run db:seed:dev
```

## Architecture Overview

MediaNest uses Docker Compose to orchestrate multiple services in a unified stack:

```
┌─────────────────────────────────────────────────────────┐
│                  MediaNest Stack                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Nginx    │  │  Frontend   │  │   Backend   │     │
│  │ (Reverse    │  │ (Next.js)   │  │ (Express)   │     │
│  │  Proxy)     │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                 │                 │           │
│         └─────────────────┼─────────────────┘           │
│                           │                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ PostgreSQL  │  │    Redis    │  │  Monitoring │     │
│  │ (Database)  │  │(Cache/Queue)│  │ (Optional)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Service Breakdown

| Service      | Purpose                                      | Port            | Health Check |
| ------------ | -------------------------------------------- | --------------- | ------------ |
| **nginx**    | Reverse proxy, SSL termination, static files | 80, 443         | HTTP 200     |
| **frontend** | Next.js React application                    | 3000 (internal) | `/health`    |
| **backend**  | Express.js API server                        | 4000 (internal) | `/health`    |
| **postgres** | Primary database                             | 5432 (internal) | `pg_isready` |
| **redis**    | Cache, sessions, job queue                   | 6379 (internal) | `PING`       |

## Prerequisites

### System Requirements

**Minimum Hardware:**

- CPU: 2 cores (4 cores recommended)
- RAM: 4GB (8GB recommended)
- Storage: 20GB free space (SSD recommended)
- Network: Stable internet connection

**Software Requirements:**

```bash
# Verify required software versions
docker --version          # Required: 24.0+
docker compose version    # Required: v2.20+
```

### Supported Operating Systems

- Ubuntu 20.04 LTS / 22.04 LTS (Recommended)
- CentOS 8+ / RHEL 8+
- Debian 11+
- macOS 12+ (Development only)
- Windows 10/11 with WSL2 (Development only)

## Production Deployment

### Method 1: Automated Deployment (Recommended)

```bash
# Complete production setup
./deployment/scripts/deploy-compose.sh \
  --domain your-domain.com \
  --email admin@your-domain.com \
  --ssl-method letsencrypt \
  --backup-existing

# Available options:
# --domain DOMAIN          Your domain name (required)
# --email EMAIL           Email for SSL certificates (required)
# --ssl-method METHOD     'letsencrypt' or 'selfsigned'
# --backup-existing       Backup existing installation
# --skip-ssl             Skip SSL certificate setup
# --dev-mode             Development mode deployment
# --help                 Show all options
```

### Method 2: Manual Production Deployment

#### Step 1: Prepare Environment

```bash
# Create application directory
sudo mkdir -p /opt/medianest
sudo chown $USER:$USER /opt/medianest
cd /opt/medianest

# Clone repository
git clone <repository-url> .

# Create required directories
mkdir -p {data,logs,backups,secrets}
mkdir -p data/{postgres,redis,uploads,certbot}
mkdir -p logs/{backend,frontend,nginx}
```

#### Step 2: Generate Secrets

```bash
# Generate production secrets
./deployment/scripts/generate-secrets.sh

# Generated files in ./secrets/:
# - postgres_password     (Database password)
# - redis_password        (Redis password)
# - jwt_secret           (JWT signing key)
# - nextauth_secret      (NextAuth secret)
# - encryption_key       (Data encryption key)
# - database_url         (Complete database connection string)
# - redis_url            (Complete Redis connection string)
```

#### Step 3: Configure Environment

```bash
# Copy and edit production configuration
cp .env.production.example .env.production

# Required settings:
nano .env.production
```

**Essential Environment Variables:**

```bash
# Domain Configuration
DOMAIN_NAME=your-domain.com
FRONTEND_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com

# SSL Configuration
CERTBOT_EMAIL=your-email@domain.com

# Application Settings
NODE_ENV=production
LOG_LEVEL=warn
RUN_MIGRATIONS=true

# Data Paths
DATA_PATH=/opt/medianest/data
LOG_PATH=/opt/medianest/logs
BACKUP_PATH=/opt/medianest/backups
```

#### Step 4: SSL Certificate Setup

**Let's Encrypt (Recommended):**

```bash
# Generate SSL certificate
sudo certbot certonly \
  --standalone \
  --email your-email@domain.com \
  --agree-tos \
  --domains your-domain.com

# Copy certificates to application
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem data/certbot/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem data/certbot/ssl/
sudo chown $USER:$USER data/certbot/ssl/*
```

**Self-Signed (Development/Testing):**

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout data/certbot/ssl/privkey.pem \
  -out data/certbot/ssl/fullchain.pem \
  -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

#### Step 5: Deploy Services

```bash
# Deploy production stack
docker compose -f config/docker/docker-compose.prod.yml up -d

# Verify deployment
docker compose -f config/docker/docker-compose.prod.yml ps

# Initialize database
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:migrate
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:seed
```

## Development Deployment

### Local Development Environment

```bash
# Start development services (database and Redis only)
docker compose -f config/docker/docker-compose.dev.yml up -d

# Install dependencies
npm install

# Set up development environment
cp .env.example .env
npm run generate-secrets:dev

# Run database migrations
npm run db:generate
npm run db:migrate:dev
npm run db:seed:dev

# Start development servers
npm run dev  # Starts both frontend (3000) and backend (4000)
```

### Full Stack Development

```bash
# Start complete development stack with containerized frontend/backend
docker compose -f config/docker/docker-compose.dev-full.yml up -d

# View logs
docker compose -f config/docker/docker-compose.dev-full.yml logs -f

# Access services:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:4000
# - Database: localhost:5432
# - Redis: localhost:6379
```

## Configuration Management

### Docker Compose Files

MediaNest includes multiple compose files for different scenarios:

```
config/docker/
├── docker-compose.prod.yml      # Production deployment
├── docker-compose.dev.yml       # Development services only
├── docker-compose.dev-full.yml  # Full development stack
├── docker-compose.test.yml      # Testing environment
└── docker-compose.monitoring.yml # Additional monitoring stack
```

### Environment Configuration

**Production (.env.production):**

- Full SSL/HTTPS configuration
- Optimized for performance and security
- Comprehensive monitoring and logging
- Automated backups and health checks

**Development (.env):**

- HTTP-only for local development
- Debug logging enabled
- Hot reload and development tools
- Simplified configuration

### Secrets Management

**Production Secrets (Docker Secrets):**

```yaml
secrets:
  postgres_password:
    file: ./secrets/postgres_password
  redis_password:
    file: ./secrets/redis_password
  jwt_secret:
    file: ./secrets/jwt_secret
  encryption_key:
    file: ./secrets/encryption_key
```

**Security Best Practices:**

- All secrets stored in separate files with 600 permissions
- No secrets in environment variables or compose files
- Automatic secret generation with cryptographically secure methods
- Regular secret rotation procedures documented

## Service Management

### Common Operations

```bash
# Production stack management
COMPOSE_FILE="config/docker/docker-compose.prod.yml"

# Start services
docker compose -f $COMPOSE_FILE up -d

# Stop services
docker compose -f $COMPOSE_FILE down

# Restart specific service
docker compose -f $COMPOSE_FILE restart backend

# View logs
docker compose -f $COMPOSE_FILE logs -f backend frontend

# Execute commands in containers
docker compose -f $COMPOSE_FILE exec backend npm run db:migrate
docker compose -f $COMPOSE_FILE exec postgres psql -U medianest -d medianest
```

### Service Scaling

```bash
# Scale backend service (for load balancing)
docker compose -f config/docker/docker-compose.prod.yml up -d --scale backend=3

# Scale with load balancer configuration
docker compose -f config/docker/docker-compose.prod.yml \
  -f config/docker/docker-compose.lb.yml up -d --scale backend=3
```

### Zero-Downtime Updates

```bash
# Update with zero downtime
./deployment/scripts/update.sh

# Manual zero-downtime update
docker compose -f config/docker/docker-compose.prod.yml pull
docker compose -f config/docker/docker-compose.prod.yml up -d --no-deps backend frontend
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run db:migrate
```

## Monitoring & Health Checks

### Built-in Health Checks

**Container Health Checks:**

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:4000/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

**Service Health Verification:**

```bash
# Check all service health
./deployment/scripts/health-check.sh

# Manual health checks
curl -f https://your-domain.com/health
curl -f https://your-domain.com/api/health
```

### Monitoring Stack (Optional)

```bash
# Deploy monitoring services
docker compose -f config/docker/docker-compose.prod.yml \
  -f config/docker/docker-compose.monitoring.yml up -d

# Access monitoring:
# - Grafana: https://your-domain.com:3001
# - Prometheus: https://your-domain.com:9090
```

### Log Management

```bash
# View aggregated logs
docker compose -f config/docker/docker-compose.prod.yml logs -f

# Service-specific logs
docker compose -f config/docker/docker-compose.prod.yml logs -f backend
docker compose -f config/docker/docker-compose.prod.yml logs -f frontend

# Log rotation (automatic)
# Logs automatically rotate with Docker's logging driver
# Custom retention: 14 days, max 100MB per file
```

## Backup & Recovery

### Automated Backups

```bash
# Set up automated backups
./deployment/scripts/setup-backups.sh

# Manual backup
./deployment/scripts/backup.sh

# Backup contents:
# - PostgreSQL database dump
# - Redis data
# - Upload files
# - Configuration files
# - SSL certificates
```

### Disaster Recovery

```bash
# Full system recovery
./deployment/scripts/restore.sh --backup-file backup-20250111-120000.tar.gz

# Database-only recovery
docker compose -f config/docker/docker-compose.prod.yml exec -T postgres \
  psql -U medianest medianest < backup-db-20250111.sql

# Point-in-time recovery
./deployment/scripts/restore.sh --point-in-time "2025-01-11 12:00:00"
```

## Security Considerations

### Container Security

```yaml
# Security configurations in compose files
security_opt:
  - no-new-privileges:true
user: 1000:1000 # Non-root user
read_only: true # Read-only root filesystem
tmpfs:
  - /tmp
  - /var/tmp
```

### Network Security

```yaml
# Internal network isolation
networks:
  internal:
    internal: true # No external access
  external:
    # Only for services needing internet access
```

### SSL/TLS Configuration

```nginx
# Nginx SSL configuration (generated automatically)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
```

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Diagnose startup issues
docker compose -f config/docker/docker-compose.prod.yml ps
docker compose -f config/docker/docker-compose.prod.yml logs

# Check system resources
df -h  # Disk space
free -h  # Memory usage
docker system df  # Docker space usage
```

#### Database Connection Issues

```bash
# Test database connectivity
docker compose -f config/docker/docker-compose.prod.yml exec postgres pg_isready -U medianest

# Check database logs
docker compose -f config/docker/docker-compose.prod.yml logs postgres

# Verify connection string
cat secrets/database_url
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in data/certbot/ssl/fullchain.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem data/certbot/ssl/
docker compose -f config/docker/docker-compose.prod.yml restart nginx
```

### Performance Issues

```bash
# Check container resources
docker stats

# Monitor service performance
docker compose -f config/docker/docker-compose.prod.yml exec backend npm run health:detailed

# Database performance
docker compose -f config/docker/docker-compose.prod.yml exec postgres \
  psql -U medianest -d medianest -c "SELECT * FROM pg_stat_activity;"
```

### Emergency Recovery

```bash
# Emergency stop
docker compose -f config/docker/docker-compose.prod.yml down

# Force recreate all services
docker compose -f config/docker/docker-compose.prod.yml down
docker compose -f config/docker/docker-compose.prod.yml up -d --force-recreate

# Reset to last known good state
./deployment/scripts/rollback.sh --backup-file backup-good-20250111.tar.gz
```

## Advanced Configuration

### Custom Nginx Configuration

```bash
# Override default Nginx config
cp config/nginx/prod.conf config/nginx/custom.conf
# Edit custom configuration
# Update docker-compose.prod.yml to use custom config
```

### Database Tuning

```yaml
# PostgreSQL performance tuning (docker-compose.prod.yml)
environment:
  - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --locale=en_US.UTF-8
command: >
  postgres
  -c shared_preload_libraries='pg_stat_statements'
  -c max_connections=200
  -c shared_buffers=256MB
  -c effective_cache_size=1GB
```

### Redis Configuration

```yaml
# Redis optimization
command: >
  redis-server
  --appendonly yes
  --maxmemory 512mb
  --maxmemory-policy allkeys-lru
  --save 900 1
  --save 300 10
  --save 60 10000
```

### External Service Integration

```bash
# Configure external services after deployment
# Access admin UI: https://your-domain.com/admin
# Navigate to Service Configuration
# Add Plex, Overseerr, Uptime Kuma configurations
```

## Support & Resources

### Documentation Links

- [Main README](../../README.md) - Project overview
- [Architecture Documentation](../../ARCHITECTURE.md) - System architecture
- [API Documentation](../api/overview.md) - API reference
- [Development Setup](../getting-started/development-setup.md) - Development guide

### Community & Support

- **Issues**: GitHub repository issues
- **Discussions**: GitHub repository discussions
- **Security**: Report security issues privately

### Useful Commands Reference

```bash
# Quick reference for common operations
alias dcp='docker compose -f config/docker/docker-compose.prod.yml'
alias dcd='docker compose -f config/docker/docker-compose.dev.yml'

# Examples:
dcp up -d          # Start production
dcp down           # Stop production
dcp logs -f        # View logs
dcp ps             # Service status
dcp exec backend bash  # Backend shell
```

---

**This guide provides comprehensive instructions for deploying MediaNest with Docker Compose. For additional support, refer to the troubleshooting section or create an issue in the GitHub repository.**
