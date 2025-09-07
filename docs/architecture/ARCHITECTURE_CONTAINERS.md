# MediaNest Container Architecture

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Current Implementation

## Container Overview

MediaNest follows a **multi-container architecture** using Docker Compose V2 for orchestration. The system is designed as a monolithic application split into logical containers for better isolation, scalability, and maintainability.

## Container Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MediaNest Container Stack                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                nginx (Reverse Proxy)                    │   │
│  │  • SSL Termination (Let's Encrypt)                     │   │
│  │  • Request Routing                                      │   │
│  │  • Static Asset Serving                                │   │
│  │  • Rate Limiting                                        │   │
│  │  • CORS Headers                                         │   │
│  │  Ports: 80, 443                                         │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                           │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │              medianest-app                              │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐ │   │
│  │  │   Next.js 14    │    │    Express.js API          │ │   │
│  │  │   Frontend      │    │    Backend                 │ │   │
│  │  │   Port: 3000    │    │    Port: 4000              │ │   │
│  │  │                 │    │                            │ │   │
│  │  │ • React App     │    │ • REST API                 │ │   │
│  │  │ • Auth Pages    │    │ • Socket.io Server         │ │   │
│  │  │ • Dashboard     │    │ • JWT Authentication       │ │   │
│  │  │ • Media Browse  │    │ • Service Integration      │ │   │
│  │  │ • Real-time UI  │    │ • Job Processing           │ │   │
│  │  └─────────────────┘    └─────────────────────────────┘ │   │
│  │                    Internal Network                    │   │
│  └─────────────────┬───────────┬───────────────────────────┘   │
│                    │           │                               │
│  ┌─────────────────▼───────────▼───────────────────────────┐   │
│  │                 Data Layer                              │   │
│  │  ┌──────────────────┐        ┌──────────────────────┐   │   │
│  │  │   postgres       │        │      redis           │   │   │
│  │  │   Port: 5432     │        │      Port: 6379      │   │   │
│  │  │                  │        │                      │   │   │
│  │  │ • User Data      │        │ • Session Store      │   │   │
│  │  │ • Media Requests │        │ • Cache Layer        │   │   │
│  │  │ • Downloads      │        │ • Job Queue (BullMQ) │   │   │
│  │  │ • Service Config │        │ • Rate Limiting      │   │   │
│  │  │ • Audit Logs     │        │ • Real-time Events   │   │   │
│  │  └──────────────────┘        └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Volume Mounts                            │   │
│  │  • postgres_data → PostgreSQL persistent storage       │   │
│  │  • redis_data → Redis persistent storage               │   │
│  │  • youtube_downloads → Downloaded content storage      │   │
│  │  • uploads → User uploaded files                       │   │
│  │  • nginx_certs → SSL certificates                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Container Specifications

### 1. Nginx Reverse Proxy

**Image**: `nginx:1.25-alpine`  
**Purpose**: SSL termination, request routing, static asset serving

```yaml
nginx:
  image: nginx:1.25-alpine
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./infrastructure/nginx/certs:/etc/nginx/certs:ro
    - nginx_logs:/var/log/nginx
  depends_on:
    - app
  restart: unless-stopped
  networks:
    - medianest-network
```

**Configuration Highlights**:

- HTTP to HTTPS redirect
- WebSocket proxy support for Socket.io
- Static asset caching (1 year for immutable assets)
- Rate limiting (100 req/min per IP)
- Security headers (HSTS, CSP, X-Frame-Options)
- Gzip compression for text assets

### 2. MediaNest Application Container

**Image**: Custom built from `node:20-alpine`  
**Purpose**: Unified Next.js frontend and Express.js backend

```dockerfile
# Multi-stage build for optimization
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
RUN npm run build:shared

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/shared/dist ./shared/dist

# Non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S medianest -u 1001
USER medianest

EXPOSE 3000 4000
CMD ["npm", "start"]
```

**Runtime Configuration**:

```yaml
app:
  build:
    context: .
    dockerfile: Dockerfile
  environment:
    - NODE_ENV=production
    - DATABASE_URL=postgresql://user:${DB_PASSWORD}@postgres:5432/medianest
    - REDIS_URL=redis://redis:6379
    - NEXTAUTH_URL=https://${DOMAIN}
    - ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
  volumes:
    - youtube_downloads:/app/youtube:rw
    - uploads:/app/uploads:rw
  secrets:
    - encryption_key
    - nextauth_secret
    - plex_client_secret
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:4000/api/health']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
  restart: unless-stopped
  networks:
    - medianest-network
```

**Internal Services**:

1. **Frontend Server (Port 3000)**

   - Next.js 14 with App Router
   - Server-side rendering and static generation
   - Client-side React application
   - Socket.io client integration

2. **Backend API Server (Port 4000)**
   - Express.js REST API
   - Socket.io WebSocket server
   - JWT authentication middleware
   - Service integration layer
   - BullMQ job processing

### 3. PostgreSQL Database

**Image**: `postgres:15-alpine`  
**Purpose**: Primary data storage for users, requests, configurations

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    - POSTGRES_DB=medianest
    - POSTGRES_USER=medianest_user
    - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --locale=en_US.UTF-8
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./infrastructure/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
  secrets:
    - db_password
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U medianest_user -d medianest']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
  restart: unless-stopped
  networks:
    - medianest-network
```

**Database Configuration**:

- Connection pooling: max 20 connections
- Shared buffers: 256MB
- WAL level: replica (for future replication)
- Log queries taking > 1000ms
- Auto-vacuum enabled

### 4. Redis Cache & Queue

**Image**: `redis:7-alpine`  
**Purpose**: Session storage, caching, job queue, rate limiting

```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server 
    --appendonly yes 
    --maxmemory 256mb 
    --maxmemory-policy allkeys-lru
    --timeout 300
    --tcp-keepalive 60
  volumes:
    - redis_data:/data
    - ./infrastructure/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 3s
    retries: 3
    start_period: 30s
  restart: unless-stopped
  networks:
    - medianest-network
```

**Redis Usage Patterns**:

- **Sessions**: `session:{sessionId}` with 24h TTL
- **Cache**: `cache:{key}` with variable TTL
- **Rate Limiting**: `rate:{type}:{userId}` with Lua scripts
- **Job Queue**: BullMQ data structures
- **Real-time**: Pub/Sub for Socket.io scaling

## Network Architecture

### Internal Networks

```yaml
networks:
  medianest-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Network Segmentation**:

- All containers on isolated `medianest-network`
- Only nginx exposes ports to host network
- Internal container communication via service names
- No direct external access to data containers

### Service Discovery

Containers communicate using Docker's built-in DNS:

- `postgres:5432` - Database connection
- `redis:6379` - Cache and queue connection
- `app:3000` - Frontend internal access
- `app:4000` - Backend API access

## Volume Management

### Persistent Volumes

```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/postgres

  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/redis

  youtube_downloads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/youtube

  uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/medianest/uploads

  nginx_certs:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /etc/medianest/certs
```

### Data Persistence Strategy

1. **Database Data** (`postgres_data`)

   - Critical user and system data
   - Daily automated backups
   - Point-in-time recovery enabled

2. **Cache Data** (`redis_data`)

   - Session persistence across restarts
   - Job queue durability
   - AOF (Append Only File) enabled

3. **Media Files** (`youtube_downloads`)

   - User-downloaded content
   - Organized by user ID for isolation
   - Optional: automated cleanup of old files

4. **User Uploads** (`uploads`)

   - User-uploaded content (future feature)
   - Virus scanning before storage
   - Size limits per user role

5. **SSL Certificates** (`nginx_certs`)
   - Let's Encrypt certificates
   - Automatic renewal support
   - Backup for disaster recovery

## Security Architecture

### Container Security

1. **Non-root User Execution**

   ```dockerfile
   RUN addgroup -g 1001 -S nodejs
   RUN adduser -S medianest -u 1001
   USER medianest
   ```

2. **Secret Management**

   ```yaml
   secrets:
     db_password:
       file: ./secrets/db_password
     encryption_key:
       file: ./secrets/encryption_key
     nextauth_secret:
       file: ./secrets/nextauth_secret
   ```

3. **Resource Limits**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 1G
         cpus: '1.0'
       reservations:
         memory: 512M
         cpus: '0.5'
   ```

### Network Security

- **Firewall Rules**: Only ports 80/443 exposed to public
- **Internal Communication**: Encrypted where possible
- **Access Control**: Container-to-container restrictions
- **Monitoring**: Network traffic logging

## Environment-Specific Configurations

### Development Environment

```yaml
# docker-compose.dev.yml
services:
  app:
    build:
      target: development
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    ports:
      - '3000:3000' # Exposed for direct access
      - '4000:4000' # Exposed for direct access
```

### Testing Environment

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=medianest_test
      - POSTGRES_USER=test_user
      - POSTGRES_PASSWORD=test_password
    ports:
      - '5433:5432' # Different port to avoid conflicts

  redis-test:
    image: redis:7-alpine
    ports:
      - '6380:6379' # Different port to avoid conflicts
```

### Production Environment

```yaml
# docker-compose.prod.yml
services:
  app:
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

## Health Checks & Monitoring

### Container Health Checks

Each container implements health checks:

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:4000/api/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Monitoring Integration

- **Prometheus Metrics**: Application and container metrics
- **Log Aggregation**: Centralized logging with log rotation
- **Alert Manager**: Health check failure notifications
- **Grafana Dashboards**: Visual monitoring and alerting

## Scaling Considerations

### Horizontal Scaling Readiness

While designed for 10-20 users, the architecture supports scaling:

1. **Stateless Application**

   - Session data stored in Redis
   - No local file system dependencies
   - Load balancer ready

2. **Database Scaling**

   - Read replicas for query distribution
   - Connection pooling for efficiency
   - Partitioning strategies prepared

3. **Cache Scaling**
   - Redis Cluster for data distribution
   - Redis Sentinel for high availability
   - Consistent hashing for key distribution

### Resource Optimization

Current resource allocation for 10-20 users:

```yaml
deploy:
  resources:
    app:
      limits: { memory: 1G, cpus: '1.0' }
      reservations: { memory: 512M, cpus: '0.5' }
    postgres:
      limits: { memory: 512M, cpus: '0.5' }
      reservations: { memory: 256M, cpus: '0.25' }
    redis:
      limits: { memory: 256M, cpus: '0.25' }
      reservations: { memory: 128M, cpus: '0.1' }
```

## Deployment Strategies

### Rolling Deployment

```bash
# Zero-downtime deployment process
docker-compose pull app
docker-compose up -d --scale app=2 app
sleep 30  # Allow new container to be healthy
docker-compose up -d --scale app=1 app
```

### Blue-Green Deployment

For critical updates requiring full environment replacement:

1. Deploy to parallel environment
2. Run smoke tests
3. Switch DNS/load balancer
4. Monitor for issues
5. Keep blue environment for quick rollback

### Backup Strategy

```bash
# Database backup
docker-compose exec postgres pg_dump -U medianest_user medianest > backup.sql

# Redis backup
docker-compose exec redis redis-cli --rdb /data/backup.rdb

# Application data backup
docker run --rm -v medianest_youtube_downloads:/data -v $(pwd):/backup alpine tar czf /backup/youtube-backup.tar.gz /data
```

---

## Related Documentation

- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) - High-level system design
- [Component Architecture](./ARCHITECTURE_COMPONENTS.md) - Internal application structure
- [Deployment Architecture](./ARCHITECTURE_DEPLOYMENT.md) - Infrastructure deployment details
- [Security Architecture](../SECURITY_ARCHITECTURE_STRATEGY.md) - Security implementation

---

_This document details the container-level architecture. For application component details, see the Component Architecture documentation._
