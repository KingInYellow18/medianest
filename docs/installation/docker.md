# Docker Installation Guide

MediaNest provides official Docker images for easy deployment. This guide covers Docker installation methods.

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- 4GB+ available RAM
- 20GB+ available disk space

## Quick Start with Docker Compose

### 1. Download Docker Compose File

Create a new directory and download the Docker Compose configuration:

```bash
mkdir medianest && cd medianest
curl -O https://raw.githubusercontent.com/medianest/medianest/main/docker-compose.yml
```

### 2. Configure Environment

Create and edit the environment file:

```bash
cp .env.example .env
nano .env
```

Essential environment variables:

```bash
# Database Configuration
POSTGRES_DB=medianest
POSTGRES_USER=medianest
POSTGRES_PASSWORD=change_this_password

# Application Configuration
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
NODE_ENV=production

# Media Storage
MEDIA_ROOT=/data/media
UPLOAD_MAX_SIZE=100mb

# External Services (optional)
REDIS_URL=redis://redis:6379
```

### 3. Start Services

Launch MediaNest with Docker Compose:

```bash
docker-compose up -d
```

### 4. Verify Installation

Check that all services are running:

```bash
docker-compose ps
```

Access MediaNest at `http://localhost:3000`

## Manual Docker Installation

### 1. Create Docker Network

```bash
docker network create medianest
```

### 2. Start Database

```bash
docker run -d \
  --name medianest-postgres \
  --network medianest \
  -e POSTGRES_DB=medianest \
  -e POSTGRES_USER=medianest \
  -e POSTGRES_PASSWORD=secure_password \
  -v medianest-db:/var/lib/postgresql/data \
  postgres:14-alpine
```

### 3. Start Redis (Optional)

```bash
docker run -d \
  --name medianest-redis \
  --network medianest \
  -v medianest-cache:/data \
  redis:7-alpine
```

### 4. Start MediaNest Application

```bash
docker run -d \
  --name medianest-app \
  --network medianest \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://medianest:secure_password@medianest-postgres/medianest \
  -e REDIS_URL=redis://medianest-redis:6379 \
  -v medianest-media:/app/media \
  -v medianest-data:/app/data \
  medianest/medianest:latest
```

## Docker Configuration Options

### Environment Variables

| Variable          | Description                  | Default      |
| ----------------- | ---------------------------- | ------------ |
| `NODE_ENV`        | Application environment      | `production` |
| `PORT`            | Application port             | `3000`       |
| `DATABASE_URL`    | PostgreSQL connection string | Required     |
| `REDIS_URL`       | Redis connection string      | Optional     |
| `JWT_SECRET`      | JWT signing secret           | Required     |
| `SESSION_SECRET`  | Session encryption secret    | Required     |
| `MEDIA_ROOT`      | Media files root directory   | `/app/media` |
| `UPLOAD_MAX_SIZE` | Maximum upload file size     | `100mb`      |
| `LOG_LEVEL`       | Logging level                | `info`       |

### Volume Mounts

#### Essential Volumes

```yaml
volumes:
  - medianest-media:/app/media # Media files storage
  - medianest-data:/app/data # Application data
  - medianest-config:/app/config # Configuration files
```

#### Host Directory Mounts

```yaml
volumes:
  - /host/media:/app/media # Host media directory
  - /host/config:/app/config # Host config directory
  - ./logs:/app/logs # Host logs directory
```

### Network Configuration

#### Default Network Setup

```yaml
services:
  medianest:
    networks:
      - medianest
  postgres:
    networks:
      - medianest
networks:
  medianest:
    driver: bridge
```

#### External Network

```yaml
services:
  medianest:
    networks:
      - external-network
networks:
  external-network:
    external: true
```

## Production Deployment

### 1. Production Docker Compose

```yaml
version: '3.8'

services:
  medianest:
    image: medianest/medianest:latest
    restart: unless-stopped
    ports:
      - '80:3000'
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://medianest:${POSTGRES_PASSWORD}@postgres/medianest
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
    volumes:
      - ./media:/app/media
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:14-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: medianest
      POSTGRES_USER: medianest
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest']
      interval: 30s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres-data:
  redis-data:
```

### 2. SSL/TLS with Reverse Proxy

#### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name medianest.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Traefik Configuration

```yaml
services:
  medianest:
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.medianest.rule=Host(`medianest.yourdomain.com`)'
      - 'traefik.http.routers.medianest.tls.certresolver=letsencrypt'
```

## Docker Image Variants

### Available Tags

- `latest`: Latest stable release
- `v1.x.x`: Specific version tags
- `nightly`: Latest development build
- `alpine`: Smaller Alpine-based image

### Multi-Architecture Support

MediaNest Docker images support multiple architectures:

- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64)
- `linux/arm/v7` (ARM32)

## Monitoring and Logging

### Health Checks

Configure Docker health checks:

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Logging Configuration

```yaml
logging:
  driver: json-file
  options:
    max-size: '10m'
    max-file: '3'
```

### Monitoring with cAdvisor

```yaml
cadvisor:
  image: gcr.io/cadvisor/cadvisor:latest
  ports:
    - '8080:8080'
  volumes:
    - /:/rootfs:ro
    - /var/run:/var/run:ro
    - /sys:/sys:ro
    - /var/lib/docker/:/var/lib/docker:ro
```

## Backup and Recovery

### Database Backup

```bash
# Create database backup
docker-compose exec postgres pg_dump -U medianest medianest > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U medianest medianest < backup.sql
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v medianest_media:/data -v $(pwd):/backup alpine tar czf /backup/media-backup.tar.gz /data

# Restore volumes
docker run --rm -v medianest_media:/data -v $(pwd):/backup alpine tar xzf /backup/media-backup.tar.gz -C /
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker-compose logs medianest

# Check system resources
docker system df
docker system prune
```

#### Database Connection Issues

```bash
# Test database connectivity
docker-compose exec medianest nc -zv postgres 5432

# Check database logs
docker-compose logs postgres
```

#### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check container limits
docker inspect medianest | grep -A 10 "Memory"
```

### Debug Mode

Enable debug logging:

```yaml
environment:
  NODE_ENV: development
  LOG_LEVEL: debug
  DEBUG: 'medianest:*'
```

## Updates and Maintenance

### Updating MediaNest

```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Clean up old images
docker image prune
```

### Scheduled Maintenance

```bash
# Create maintenance script
#!/bin/bash
docker-compose exec postgres pg_dump -U medianest medianest > "backup-$(date +%Y%m%d).sql"
docker system prune -f
docker-compose pull
docker-compose up -d
```

For more advanced configuration options, see the [Configuration Guide](configuration.md).
