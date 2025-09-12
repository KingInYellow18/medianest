# Staging Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying MediaNest to staging environments. The staging deployment has been thoroughly tested and validated with critical fixes applied for production-ready stability.

!!! success "Production Ready"
The staging deployment includes critical fixes for:

    - ✅ Backend service startup (secrets_validator_1 fix)
    - ✅ Docker build improvements
    - ✅ JWT/Cache service stabilization
    - ✅ Memory leak fixes
    - ✅ Worker thread stability

## Quick Start

For immediate staging deployment, use our validated Docker Compose configuration:

```bash
# Clone and navigate to repository
git clone https://github.com/kinginyellow/medianest.git
cd medianest

# Start staging environment
docker-compose -f docker-compose.staging.yml up -d

# Verify deployment
curl -f http://localhost:3000/api/health || echo "Deployment verification failed"
```

## Pre-Deployment Checklist

Before deploying to staging, ensure all prerequisites are met:

### Infrastructure Requirements

- [ ] **Docker Engine**: Version 20.10+ with Docker Compose v2.0+
- [ ] **Memory**: Minimum 4GB RAM (8GB recommended)
- [ ] **Storage**: 20GB available disk space minimum
- [ ] **Network**: Ports 3000, 5432, 6379 available
- [ ] **SSL/TLS**: Valid certificates for HTTPS (production)

### Required Services

- [ ] **PostgreSQL Database**: Version 14+ with user/database created
- [ ] **Redis Cache**: Version 6+ for session and cache management
- [ ] **File Storage**: Persistent volume or external storage configured

### Environment Configuration

- [ ] **Environment Variables**: All required variables configured
- [ ] **Secrets Management**: Secure handling of sensitive data
- [ ] **Logging**: Centralized logging configured
- [ ] **Monitoring**: Health checks and metrics collection enabled

## Step-by-Step Deployment

### 1. Environment Setup

Create a staging-specific environment configuration:

```bash
# Copy staging environment template
cp .env.staging.example .env.staging

# Configure essential variables
cat > .env.staging << EOF
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://medianest_user:secure_password@postgres:5432/medianest_staging
REDIS_URL=redis://redis:6379
JWT_SECRET=$(openssl rand -base64 32)
PLEX_TOKEN=your_plex_token_here
LOG_LEVEL=info
HEALTH_CHECK_TIMEOUT=30000
EOF
```

### 2. Database Preparation

Set up the PostgreSQL database for staging:

```bash
# Create database and user
docker exec -it postgres-container psql -U postgres << EOF
CREATE DATABASE medianest_staging;
CREATE USER medianest_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE medianest_staging TO medianest_user;
\q
EOF

# Run database migrations
npm run db:migrate:staging
```

### 3. Docker Deployment

Deploy using our validated Docker configuration:

```bash
# Build production images with staging config
docker-compose -f docker-compose.staging.yml build --no-cache

# Start all services
docker-compose -f docker-compose.staging.yml up -d

# Monitor startup logs
docker-compose -f docker-compose.staging.yml logs -f
```

### 4. Service Validation

Verify all services are running correctly:

```bash
# Health check validation
curl -f http://localhost:3000/api/health

# Database connectivity test
docker-compose exec backend npm run test:db-connection

# Redis connectivity test
docker-compose exec backend npm run test:redis-connection

# Plex integration test
docker-compose exec backend npm run test:plex-connection
```

### 5. Post-Deployment Configuration

Configure additional settings after successful deployment:

```bash
# Create admin user
docker-compose exec backend npm run create-admin-user

# Initialize default settings
docker-compose exec backend npm run init-staging-config

# Set up monitoring
docker-compose exec backend npm run setup-monitoring
```

## Docker Compose Configuration

### Staging Docker Compose File

```yaml
version: '3.8'

services:
  # Backend API Service
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.staging
      args:
        NODE_ENV: staging
    container_name: medianest-backend-staging
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=staging
      - PORT=3000
      - DATABASE_URL=postgresql://medianest_user:${DB_PASSWORD}@postgres:5432/medianest_staging
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - PLEX_TOKEN=${PLEX_TOKEN}
      - LOG_LEVEL=info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    volumes:
      - media_storage:/app/storage
      - ./logs:/app/logs
    networks:
      - medianest-network
    restart: unless-stopped

  # Frontend Web Application
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.staging
      args:
        NODE_ENV: staging
        API_BASE_URL: http://localhost:3000/api
    container_name: medianest-frontend-staging
    ports:
      - '3001:3000'
    environment:
      - NODE_ENV=staging
      - API_BASE_URL=http://backend:3000/api
    depends_on:
      - backend
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000']
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - medianest-network
    restart: unless-stopped

  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    container_name: medianest-postgres-staging
    environment:
      - POSTGRES_DB=medianest_staging
      - POSTGRES_USER=medianest_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/staging-init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest_user -d medianest_staging']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - medianest-network
    restart: unless-stopped

  # Redis Cache
  redis:
    image: redis:6-alpine
    container_name: medianest-redis-staging
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - medianest-network
    restart: unless-stopped

networks:
  medianest-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  media_storage:
    driver: local
```

## Environment Variables

### Required Environment Variables

| Variable               | Description                      | Example                               | Required |
| ---------------------- | -------------------------------- | ------------------------------------- | -------- |
| `NODE_ENV`             | Application environment          | `staging`                             | Yes      |
| `PORT`                 | Application port                 | `3000`                                | Yes      |
| `DATABASE_URL`         | PostgreSQL connection string     | `postgresql://user:pass@host:5432/db` | Yes      |
| `REDIS_URL`            | Redis connection string          | `redis://localhost:6379`              | Yes      |
| `JWT_SECRET`           | JWT signing secret               | `random-32-char-string`               | Yes      |
| `PLEX_TOKEN`           | Plex server authentication token | `your-plex-token`                     | Yes      |
| `LOG_LEVEL`            | Logging verbosity                | `info`                                | No       |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout (ms)        | `30000`                               | No       |

### Optional Configuration

| Variable            | Description              | Default | Purpose            |
| ------------------- | ------------------------ | ------- | ------------------ |
| `MAX_UPLOAD_SIZE`   | Maximum file upload size | `100MB` | File upload limits |
| `SESSION_TIMEOUT`   | User session timeout     | `24h`   | Security           |
| `RATE_LIMIT_WINDOW` | Rate limiting window     | `15min` | API protection     |
| `BACKUP_RETENTION`  | Backup retention period  | `7d`    | Data management    |

## Service Management

### Starting Services

```bash
# Start all services
docker-compose -f docker-compose.staging.yml up -d

# Start specific service
docker-compose -f docker-compose.staging.yml up -d backend

# View startup logs
docker-compose -f docker-compose.staging.yml logs -f backend
```

### Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.staging.yml down

# Stop and remove volumes
docker-compose -f docker-compose.staging.yml down -v

# Stop specific service
docker-compose -f docker-compose.staging.yml stop backend
```

### Service Monitoring

```bash
# Check service status
docker-compose -f docker-compose.staging.yml ps

# Monitor resource usage
docker stats

# View service logs
docker-compose -f docker-compose.staging.yml logs backend --tail=100
```

## Health Checks and Validation

### Automated Health Checks

The deployment includes comprehensive health checks:

```bash
#!/bin/bash
# health-check.sh - Staging deployment validation

echo "🏥 MediaNest Staging Health Check"
echo "=================================="

# API Health Check
echo "📡 Checking API health..."
if curl -f -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed"
    exit 1
fi

# Database Connection
echo "🗄️ Checking database connection..."
if docker-compose exec -T backend npm run test:db > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Redis Connection
echo "🔴 Checking Redis connection..."
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
    exit 1
fi

# Plex Integration
echo "🎬 Checking Plex integration..."
if docker-compose exec -T backend npm run test:plex > /dev/null 2>&1; then
    echo "✅ Plex integration working"
else
    echo "⚠️ Plex integration test failed (check configuration)"
fi

echo "🎉 Staging deployment validation complete!"
```

### Manual Validation Steps

1. **API Endpoints Test**

   ```bash
   # Test authentication endpoint
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'

   # Test media endpoint
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/media
   ```

2. **Frontend Accessibility**

   ```bash
   # Test frontend loading
   curl -f http://localhost:3001/

   # Test static assets
   curl -f http://localhost:3001/static/js/main.js
   ```

3. **Database Integrity**
   ```bash
   # Check database tables
   docker-compose exec postgres psql -U medianest_user -d medianest_staging \
     -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
   ```

## Backup and Recovery

### Automated Backups

```bash
#!/bin/bash
# backup-staging.sh - Staging environment backup

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/staging"
mkdir -p $BACKUP_DIR

# Database backup
echo "🗄️ Backing up database..."
docker-compose exec postgres pg_dump -U medianest_user medianest_staging > \
  $BACKUP_DIR/database_$BACKUP_DATE.sql

# Media files backup
echo "📁 Backing up media files..."
docker run --rm -v medianest_media_storage:/source:ro -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/media_$BACKUP_DATE.tar.gz -C /source .

# Configuration backup
echo "⚙️ Backing up configuration..."
cp .env.staging $BACKUP_DIR/env_$BACKUP_DATE.backup
cp docker-compose.staging.yml $BACKUP_DIR/compose_$BACKUP_DATE.yml

echo "✅ Backup completed: $BACKUP_DIR"
```

### Recovery Procedures

```bash
#!/bin/bash
# restore-staging.sh - Restore staging environment

BACKUP_DATE=$1
BACKUP_DIR="/backups/staging"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    exit 1
fi

# Stop services
docker-compose -f docker-compose.staging.yml down

# Restore database
echo "🗄️ Restoring database..."
docker-compose -f docker-compose.staging.yml up -d postgres
sleep 10
docker-compose exec postgres psql -U medianest_user -d medianest_staging < \
  $BACKUP_DIR/database_$BACKUP_DATE.sql

# Restore media files
echo "📁 Restoring media files..."
docker run --rm -v medianest_media_storage:/target -v $BACKUP_DIR:/backup alpine \
  tar xzf /backup/media_$BACKUP_DATE.tar.gz -C /target

# Restore configuration
echo "⚙️ Restoring configuration..."
cp $BACKUP_DIR/env_$BACKUP_DATE.backup .env.staging

# Restart services
docker-compose -f docker-compose.staging.yml up -d

echo "✅ Recovery completed"
```

## Performance Monitoring

### Key Metrics to Monitor

1. **Application Metrics**
   - Response time (< 200ms average)
   - Error rate (< 1%)
   - Request throughput
   - Memory usage (< 80% of available)

2. **Database Metrics**
   - Connection pool usage
   - Query execution time
   - Cache hit ratio
   - Lock contention

3. **Infrastructure Metrics**
   - CPU usage (< 70% average)
   - Memory usage (< 80%)
   - Disk I/O
   - Network throughput

### Monitoring Setup

```yaml
# monitoring-compose.yml - Optional monitoring stack
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - medianest-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3002:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - medianest-network
```

## Security Considerations

### Network Security

- Use internal Docker networks for service communication
- Expose only necessary ports to external networks
- Implement reverse proxy with SSL termination
- Configure firewall rules for staging environment

### Access Control

- Use strong passwords for all services
- Rotate secrets regularly
- Implement role-based access control
- Audit user access and permissions

### Data Protection

- Encrypt data at rest and in transit
- Secure backup storage
- Implement proper logging without sensitive data
- Regular security assessments

## Integration Testing

### Automated Integration Tests

```bash
#!/bin/bash
# integration-tests.sh - Staging integration tests

echo "🧪 Running integration tests..."

# API integration tests
npm run test:integration:api

# Database integration tests
npm run test:integration:db

# Plex integration tests
npm run test:integration:plex

# End-to-end tests
npm run test:e2e

echo "✅ Integration tests completed"
```

### Load Testing

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/health

# Load test with wrk
wrk -t 12 -c 400 -d 30s http://localhost:3000/api/media
```

## Maintenance Tasks

### Regular Maintenance

```bash
#!/bin/bash
# maintenance.sh - Regular staging maintenance

# Update Docker images
docker-compose -f docker-compose.staging.yml pull
docker-compose -f docker-compose.staging.yml up -d

# Clean up unused containers and images
docker system prune -f

# Update application dependencies
docker-compose exec backend npm audit fix

# Optimize database
docker-compose exec postgres psql -U medianest_user -d medianest_staging -c "VACUUM ANALYZE;"

# Clear application logs older than 7 days
find ./logs -name "*.log" -mtime +7 -delete

echo "✅ Maintenance completed"
```

## Troubleshooting Quick Reference

For detailed troubleshooting information, see [Staging Troubleshooting Guide](staging-troubleshooting.md).

### Common Issues

| Issue                     | Quick Fix                         | See Also                                                      |
| ------------------------- | --------------------------------- | ------------------------------------------------------------- |
| Service won't start       | Check logs and dependencies       | [Troubleshooting](staging-troubleshooting.md#service-startup) |
| Database connection fails | Verify credentials and network    | [Prerequisites](staging-prerequisites.md#database)            |
| High memory usage         | Restart services, check for leaks | [Performance](../operations/monitoring-stack.md)              |
| Slow response times       | Check database queries and cache  | [Optimization](#performance-monitoring)                       |

### Emergency Contacts

- **On-call Engineer**: [Contact Information]
- **DevOps Team**: [Contact Information]
- **Database Administrator**: [Contact Information]

---

**Next Steps**: After successful staging deployment, see [Production Deployment Guide](production-deployment.md) for production rollout procedures.
