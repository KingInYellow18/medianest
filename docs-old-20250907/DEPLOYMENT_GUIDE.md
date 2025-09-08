# MediaNest Deployment Guide

**Version:** 1.0  
**Last Updated:** January 2025

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Overview](#deployment-overview)
- [Environment Setup](#environment-setup)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Database Setup](#database-setup)
- [Service Integration](#service-integration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Production Checklist](#production-checklist)

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB minimum for application and logs
- **Docker**: Version 24.0+ with Docker Compose V2
- **Node.js**: 20.x LTS (for manual deployment)
- **PostgreSQL**: 15.x
- **Redis**: 7.x
- **Nginx**: Latest stable (for SSL termination)

### Network Requirements

- Ports to open:
  - 80/443 (HTTP/HTTPS)
  - 4000 (Backend API - can be internal only)
  - 3000 (Frontend - can be internal only)
  - 5432 (PostgreSQL - internal only)
  - 6379 (Redis - internal only)

## Deployment Overview

MediaNest supports two deployment methods:

1. **Docker Deployment** (Recommended)

   - All-in-one deployment using Docker Compose
   - Automatic service orchestration
   - Easy updates and rollbacks

2. **Manual Deployment**
   - Direct installation on host
   - More control over individual services
   - Suitable for custom environments

## Environment Setup

### 1. Create Environment Files

```bash
# Clone the repository
git clone https://github.com/yourusername/medianest.git
cd medianest

# Copy example environment files
cp .env.example .env.production
cp docker-compose.yml docker-compose.prod.yml
```

### 2. Generate Security Keys

```bash
# Generate required secrets
npm run generate-secrets

# This creates:
# - NEXTAUTH_SECRET (32 bytes)
# - ENCRYPTION_KEY (32 bytes)
# - Database passwords
# - Redis password
```

### 3. Configure Environment Variables

Edit `.env.production`:

```bash
# Application
NODE_ENV=production
APP_URL=https://medianest.yourdomain.com

# Database
DATABASE_URL=postgresql://medianest:your_secure_password@postgres:5432/medianest
REDIS_URL=redis://:your_redis_password@redis:6379

# Authentication
NEXTAUTH_URL=https://medianest.yourdomain.com
NEXTAUTH_SECRET=your_generated_secret
ENCRYPTION_KEY=your_generated_key

# Plex OAuth
PLEX_CLIENT_ID=MediaNest
PLEX_CLIENT_SECRET=your_plex_secret
PLEX_APP_NAME=MediaNest
PLEX_APP_URL=https://medianest.yourdomain.com

# Services (configure as needed)
PLEX_URL=https://your-plex-server.com:32400
PLEX_TOKEN=your_plex_token
OVERSEERR_URL=https://overseerr.yourdomain.com
OVERSEERR_API_KEY=your_overseerr_api_key
UPTIME_KUMA_URL=https://status.yourdomain.com
```

## Docker Deployment

### 1. Prepare Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: medianest
      POSTGRES_USER: medianest
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass_FILE /run/secrets/redis_password
    volumes:
      - redis_data:/data
    secrets:
      - redis_password
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL_FILE: /run/secrets/database_url
      REDIS_URL_FILE: /run/secrets/redis_url
      NEXTAUTH_SECRET_FILE: /run/secrets/nextauth_secret
      ENCRYPTION_KEY_FILE: /run/secrets/encryption_key
    secrets:
      - database_url
      - redis_url
      - nextauth_secret
      - encryption_key
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      target: production
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://backend:4000
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
  redis_password:
    file: ./secrets/redis_password.txt
  database_url:
    file: ./secrets/database_url.txt
  redis_url:
    file: ./secrets/redis_url.txt
  nextauth_secret:
    file: ./secrets/nextauth_secret.txt
  encryption_key:
    file: ./secrets/encryption_key.txt
```

### 2. Generate Docker Secrets

```bash
# Create secrets directory
mkdir -p secrets

# Generate secrets
./scripts/generate-docker-secrets.sh

# This creates:
# - secrets/db_password.txt
# - secrets/redis_password.txt
# - secrets/database_url.txt
# - secrets/redis_url.txt
# - secrets/nextauth_secret.txt
# - secrets/encryption_key.txt
```

### 3. Build and Deploy

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Initialize Database

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate

# Create admin user (if needed)
docker compose -f docker-compose.prod.yml exec backend npm run admin:bootstrap
```

## Manual Deployment

### 1. Install Dependencies

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql-15 postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Install Nginx
sudo apt-get install -y nginx
```

### 2. Setup Database

```bash
# Create database and user
sudo -u postgres psql <<EOF
CREATE USER medianest WITH PASSWORD 'your_secure_password';
CREATE DATABASE medianest OWNER medianest;
GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest;
EOF
```

### 3. Configure Redis

Edit `/etc/redis/redis.conf`:

```conf
requirepass your_redis_password
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 4. Build Application

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 5. Setup Process Manager

Install PM2:

```bash
npm install -g pm2
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'medianest-backend',
      script: './backend/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
    {
      name: 'medianest-frontend',
      script: './frontend/.next/standalone/frontend/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
    },
  ],
};
```

Start services:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## SSL/TLS Configuration

### 1. Obtain SSL Certificate

Using Let's Encrypt:

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d medianest.yourdomain.com
```

### 2. Configure Nginx

Create `/etc/nginx/sites-available/medianest`:

```nginx
upstream frontend {
    least_conn;
    server localhost:3000 max_fails=3 fail_timeout=30s;
}

upstream backend {
    least_conn;
    server localhost:4000 max_fails=3 fail_timeout=30s;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

server {
    listen 80;
    server_name medianest.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name medianest.yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/medianest.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medianest.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Logging
    access_log /var/log/nginx/medianest-access.log;
    error_log /var/log/nginx/medianest-error.log;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Backend API
    location /api {
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        limit_req zone=auth burst=5 nodelay;

        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 30s;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /_next/static {
        proxy_pass http://frontend;
        proxy_cache_valid 200 60m;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/medianest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Service Integration

### 1. Configure Plex Authentication

1. Visit [Plex App Settings](https://www.plex.tv/api/v2/pins)
2. Create a new app called "MediaNest"
3. Note the Client ID and Client Secret
4. Update environment variables

### 2. Connect Overseerr

1. Access Overseerr admin panel
2. Generate API key in Settings > General
3. Update `OVERSEERR_API_KEY` in environment

### 3. Setup Uptime Kuma

1. Create a status page in Uptime Kuma
2. Note the status page URL
3. Update `UPTIME_KUMA_URL` in environment

## Monitoring & Logging

### 1. Application Logs

Logs are stored in:

- Backend: `./logs/application-YYYY-MM-DD.log`
- Frontend: PM2 logs or Docker logs
- Nginx: `/var/log/nginx/`

### 2. Log Rotation

Create `/etc/logrotate.d/medianest`:

```
/home/medianest/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 medianest medianest
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Monitoring Setup

Using Prometheus + Grafana:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'medianest'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
```

### 4. Health Checks

Monitor these endpoints:

- Frontend: `https://medianest.yourdomain.com/api/health`
- Backend: `https://medianest.yourdomain.com/api/health`
- Services: `https://medianest.yourdomain.com/api/v1/dashboard/status`

## Backup & Recovery

### 1. Database Backup

Create backup script `/usr/local/bin/backup-medianest.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backup/medianest"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="medianest"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U medianest -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

# Backup uploaded files (if any)
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz /path/to/uploads

# Backup configuration
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz .env* nginx/
```

### 2. Automated Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-medianest.sh
```

### 3. Recovery Process

```bash
# Restore database
gunzip < backup.sql.gz | psql -U medianest -d medianest

# Restore files
tar -xzf files_backup.tar.gz -C /

# Restore configuration
tar -xzf config_backup.tar.gz
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U medianest -h localhost -d medianest

# Check logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

#### 2. Redis Connection Failed

```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli -a your_redis_password ping

# Check logs
tail -f /var/log/redis/redis-server.log
```

#### 3. Frontend Not Loading

```bash
# Check process
pm2 status medianest-frontend

# Check logs
pm2 logs medianest-frontend

# Restart
pm2 restart medianest-frontend
```

#### 4. WebSocket Connection Failed

Check Nginx configuration for WebSocket headers:

- Upgrade header must be passed
- Connection header must be "upgrade"
- Ensure /socket.io location is configured

### Debug Mode

Enable debug logging:

```bash
# Set in environment
LOG_LEVEL=debug
DEBUG=medianest:*

# Restart services
pm2 restart all
```

## Production Checklist

### Pre-deployment

- [ ] Environment variables configured
- [ ] Security keys generated
- [ ] Database credentials secure
- [ ] SSL certificates obtained
- [ ] Firewall rules configured
- [ ] Backup strategy defined

### Deployment

- [ ] Database migrations run
- [ ] Services health checked
- [ ] SSL/TLS working
- [ ] Rate limiting active
- [ ] Logs being collected
- [ ] Monitoring configured

### Post-deployment

- [ ] All services accessible
- [ ] Authentication working
- [ ] WebSocket connections stable
- [ ] External services integrated
- [ ] Backups scheduled
- [ ] Alerts configured

### Security

- [ ] Default passwords changed
- [ ] Admin account secured
- [ ] Firewall configured
- [ ] Security headers set
- [ ] HTTPS enforced
- [ ] Secrets in environment/files

### Performance

- [ ] Gzip compression enabled
- [ ] Static assets cached
- [ ] Database indexed
- [ ] Redis configured
- [ ] Process clustering enabled
- [ ] CDN configured (optional)

---

## Support

For deployment issues:

1. Check application logs
2. Review this guide
3. Search existing issues on GitHub
4. Create a new issue with:
   - Deployment method used
   - Error messages
   - Environment details
   - Steps to reproduce
