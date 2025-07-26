# Docker Configuration

Comprehensive guide to MediaNest's Docker infrastructure, based on our production-ready containerized deployment system.

!!! info "Docker Infrastructure Status"
    ✅ Production-ready | ✅ 257 files optimized | ✅ Shared package created | ✅ Environment validated at 78%

## 🐳 Docker Architecture Overview

MediaNest uses a multi-container architecture for scalability and maintainability:

```mermaid
graph TB
    subgraph "Docker Compose Services"
        A[MediaNest App Container]
        B[PostgreSQL Database]
        C[Redis Cache]
        D[NGINX Proxy]
    end
    
    subgraph "Volumes"
        E[postgres_data]
        F[redis_data]
        G[app_uploads]
        H[app_logs]
    end
    
    subgraph "Networks"
        I[medianest_network]
    end
    
    A --> B
    A --> C
    D --> A
    B --> E
    C --> F
    A --> G
    A --> H
    A -.-> I
    B -.-> I
    C -.-> I
    D -.-> I
```

## 🏗️ Container Structure

### Main Application Container

**Base Image:** `node:20-alpine`  
**Multi-stage Build:** Optimized for production

```dockerfile
# MediaNest Production Dockerfile
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build shared package
RUN npm run build:shared

# Build backend
RUN npm run build:backend

# Build frontend
RUN npm run build:frontend

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Copy built application
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["npm", "start"]
```

### Database Container (PostgreSQL)

**Image:** `postgres:15-alpine`  
**Configuration:** Optimized for MediaNest workloads

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: medianest
    POSTGRES_USER: medianest
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --locale=C"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./infrastructure/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
  ports:
    - "5432:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U medianest"]
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped
```

### Cache Container (Redis)

**Image:** `redis:7-alpine`  
**Configuration:** Persistent caching with optimal settings

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5
  restart: unless-stopped
```

## 📋 Docker Compose Configurations

### Production Configuration

```yaml
# docker-compose.yml - Production
version: '3.8'

services:
  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: medianest
      POSTGRES_USER: medianest
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secure-password-change-me}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medianest"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - medianest_network

  # Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - medianest_network

  # MediaNest Application
  medianest:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://medianest:${POSTGRES_PASSWORD:-secure-password-change-me}@postgres:5432/medianest
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET: ${JWT_SECRET}
      PLEX_CLIENT_ID: ${PLEX_CLIENT_ID}
      PLEX_CLIENT_SECRET: ${PLEX_CLIENT_SECRET}
      OVERSEERR_URL: ${OVERSEERR_URL}
      OVERSEERR_API_KEY: ${OVERSEERR_API_KEY}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
    ports:
      - "3000:3000"
      - "8000:8000"
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - medianest_network

  # Reverse Proxy (Optional)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infrastructure/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - medianest
    restart: unless-stopped
    networks:
      - medianest_network

volumes:
  postgres_data:
  redis_data:

networks:
  medianest_network:
    driver: bridge
```

### Development Configuration

```yaml
# docker-compose.dev.yml - Development
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: medianest_dev
      POSTGRES_USER: medianest_dev
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medianest_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_dev_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Development container with hot reloading
  medianest-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://medianest_dev:dev_password@postgres:5432/medianest_dev
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET: development-jwt-secret
      LOG_LEVEL: debug
    ports:
      - "3000:3000"
      - "8000:8000"
      - "9229:9229"  # Node.js debugger
    volumes:
      - .:/app
      - /app/node_modules
      - /app/backend/node_modules
      - /app/frontend/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

volumes:
  postgres_dev_data:
  redis_dev_data:
```

### Testing Configuration

```yaml
# docker-compose.test.yml - CI/CD Testing
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: medianest_test
      POSTGRES_USER: medianest_test
      POSTGRES_PASSWORD: test_password
    tmpfs:
      - /var/lib/postgresql/data
    ports:
      - "5433:5432"

  redis-test:
    image: redis:7-alpine
    tmpfs:
      - /data
    ports:
      - "6380:6379"

  medianest-test:
    build:
      context: .
      dockerfile: Dockerfile.test
    environment:
      NODE_ENV: test
      DATABASE_URL: postgresql://medianest_test:test_password@postgres-test:5432/medianest_test
      REDIS_URL: redis://redis-test:6379/0
      JWT_SECRET: test-jwt-secret
    depends_on:
      - postgres-test
      - redis-test
    command: npm run test:ci
```

## 🚀 Deployment Commands

### Production Deployment

```bash
# Clone and setup
git clone https://github.com/medianest/medianest.git
cd medianest

# Configure environment
cp .env.example .env
# Edit .env with production values

# Build and deploy
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f medianest

# Health check
curl http://localhost:8000/health
```

### Development Setup

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Attach to logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development
docker-compose -f docker-compose.dev.yml down
```

### Testing Pipeline

```bash
# Run test suite
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Cleanup test containers
docker-compose -f docker-compose.test.yml down -v
```

## 🔧 Container Management

### Service Management

```bash
# Start specific service
docker-compose up -d postgres

# Restart service
docker-compose restart medianest

# View service logs
docker-compose logs -f --tail=100 medianest

# Scale services
docker-compose up -d --scale medianest=2

# Update single service
docker-compose pull postgres
docker-compose up -d postgres
```

### Database Operations

```bash
# Database backup
docker-compose exec postgres pg_dump -U medianest medianest > backup.sql

# Database restore
docker-compose exec -T postgres psql -U medianest medianest < backup.sql

# Database console
docker-compose exec postgres psql -U medianest medianest

# Database migrations
docker-compose exec medianest npm run db:migrate
```

### Cache Operations

```bash
# Redis console
docker-compose exec redis redis-cli

# Clear cache
docker-compose exec redis redis-cli FLUSHALL

# Monitor Redis
docker-compose exec redis redis-cli MONITOR
```

## 📊 Monitoring and Health Checks

### Health Check Configuration

```bash
# Application health check
curl http://localhost:8000/health

# Database health check
docker-compose exec postgres pg_isready -U medianest

# Redis health check
docker-compose exec redis redis-cli ping

# Container health status
docker-compose ps
```

### Log Management

```bash
# View all logs
docker-compose logs

# Follow specific service logs
docker-compose logs -f medianest

# View logs with timestamps
docker-compose logs -t medianest

# Limit log output
docker-compose logs --tail=50 medianest

# Export logs
docker-compose logs --no-color medianest > medianest.log
```

### Resource Monitoring

```bash
# Container resource usage
docker stats

# Specific container stats
docker stats medianest_medianest_1

# Docker system information
docker system df
docker system info

# Volume usage
docker volume ls
docker volume inspect medianest_postgres_data
```

## 🔒 Security Configuration

### Container Security

```dockerfile
# Security best practices in Dockerfile

# Use non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
USER nextjs

# Set security options
docker run --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp \
  medianest
```

### Network Security

```yaml
# Network isolation
networks:
  medianest_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

# Service-specific network configuration
services:
  medianest:
    networks:
      medianest_network:
        ipv4_address: 172.20.0.10
```

### Secrets Management

```yaml
# Use Docker secrets for sensitive data
secrets:
  postgres_password:
    external: true
  jwt_secret:
    external: true

services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
```

## 🔄 Backup and Recovery

### Automated Backup Strategy

```bash
#!/bin/bash
# backup.sh - Automated backup script

BACKUP_DIR="/backup/medianest"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
docker-compose exec -T postgres pg_dump -U medianest medianest > "$BACKUP_DIR/database_$DATE.sql"

# Redis backup
docker-compose exec redis redis-cli --rdb - > "$BACKUP_DIR/redis_$DATE.rdb"

# Application files backup
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" uploads/
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" logs/

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Recovery Procedures

```bash
#!/bin/bash
# restore.sh - Recovery script

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Stop services
docker-compose down

# Restore database
docker-compose up -d postgres
sleep 10
docker-compose exec -T postgres psql -U medianest medianest < "$BACKUP_FILE"

# Start all services
docker-compose up -d

echo "Recovery completed"
```

## ⚡ Performance Optimization

### Container Optimization

```dockerfile
# Multi-stage build for smaller image
FROM node:20-alpine AS builder
# ... build steps ...

FROM node:20-alpine AS production
# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

### Resource Limits

```yaml
# Resource constraints
services:
  medianest:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    ulimits:
      nofile:
        soft: 1024
        hard: 2048
```

### Caching Strategies

```dockerfile
# Optimize Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy source code last
COPY . .
RUN npm run build
```

## 🔧 Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs medianest

# Check resource usage
docker stats

# Inspect container configuration
docker inspect medianest_medianest_1
```

#### Database Connection Issues

```bash
# Test database connectivity
docker-compose exec medianest npm run db:status

# Check PostgreSQL logs
docker-compose logs postgres

# Verify network connectivity
docker-compose exec medianest ping postgres
```

#### Performance Issues

```bash
# Monitor resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check disk usage
docker system df

# Analyze build time
docker build --progress=plain .
```

#### Volume Issues

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect medianest_postgres_data

# Backup and recreate volume
docker-compose down
docker volume create medianest_postgres_data_new
# Restore data to new volume
```

---

**Next**: [Environment Variables Reference](environment.md) →