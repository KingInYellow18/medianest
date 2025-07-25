# MediaNest Backend Architecture Integration Design

## Executive Summary

This document provides a comprehensive architectural integration design for MediaNest's Express.js backend with the existing PR-1 foundation infrastructure. The backend demonstrates **HIGH production readiness** with **MEDIUM-LOW migration risk**, requiring only strategic Docker configuration resolution and environment coordination.

---

## 1. Docker Configuration Resolution

### 1.1 Primary Docker Integration Strategy

**Resolution**: Use `backend/Dockerfile.prod` as the definitive production container configuration.

#### Key Integration Points:

```dockerfile
# Multi-stage production build (Target: <300MB)
# Stage 1: Dependencies → Stage 2: Builder → Stage 3: Runner
# Security: Non-root user (nodejs:1001)
# Runtime: Node.js 20 Alpine with dumb-init
# Health Check: /api/health endpoint
```

#### Docker Secrets Integration:

- **Secrets Path**: `/run/secrets/`
- **Environment Variables**: Automatic file-to-env mapping
- **Runtime Injection**: Built-in entrypoint script handles secret reading

### 1.2 Docker Compose Integration

**Current State**: `docker-compose.prod.yml` already configured for backend service

#### Backend Service Configuration:

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile.prod
  image: medianest/backend:${VERSION:-latest}
  container_name: medianest-backend
  ports: None (internal 4000)
  networks: backend-network, frontend-network
  dependencies: postgres → redis → backend
```

#### Port Mapping Strategy:

- **Internal Port**: 4000 (backend container)
- **External Access**: Via nginx reverse proxy (443/80)
- **WebSocket Support**: Socket.IO on /socket.io/ path

### 1.3 Environment Variable Coordination

#### Secret Management:

```bash
# Docker Secrets (Production)
/run/secrets/database_url
/run/secrets/redis_url
/run/secrets/jwt_secret
/run/secrets/encryption_key
/run/secrets/plex_client_id
/run/secrets/plex_client_secret
```

#### Environment Template:

```bash
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
FRONTEND_URL=${FRONTEND_URL}
CORS_ORIGIN=${CORS_ORIGIN}
LOG_LEVEL=${LOG_LEVEL:-info}
RUN_MIGRATIONS=${RUN_MIGRATIONS:-false}
```

---

## 2. Backend Service Integration Architecture

### 2.1 Express.js Server Architecture

#### Server Initialization Sequence:

1. **Database Connection** (PostgreSQL + Prisma)
2. **Redis Connection** (Caching + Rate Limiting + BullMQ)
3. **Queue Initialization** (YouTube downloads, media processing)
4. **Socket.IO Server** (Real-time updates)
5. **External Services** (Plex, Overseerr, Uptime Kuma)
6. **HTTP Server Start** (Port 4000)

#### Application Structure:

```
src/
├── app.ts          # Express application setup
├── server.ts       # Server initialization and startup
├── config/         # Configuration management
├── controllers/    # API endpoint handlers
├── middleware/     # Express middleware
├── routes/         # API routing
├── services/       # Business logic services
├── socket/         # WebSocket handlers
├── jobs/           # Background job processors
└── utils/          # Utility functions
```

### 2.2 Database Integration (PostgreSQL + Prisma)

#### Connection Configuration:

```typescript
// config/database.ts
export async function initializeDatabase() {
  await prisma.$connect();
  logger.info('Database connected');
}
```

#### Migration Strategy:

- **Development**: `npx prisma migrate dev`
- **Production**: `npx prisma migrate deploy` (Docker entrypoint)
- **Schema Location**: `prisma/schema.prisma`

#### Database Features:

- **Connection Pooling**: Prisma default pooling
- **Health Checks**: `pg_isready` command
- **Backup Strategy**: Automated daily backups via backup service

### 2.3 Redis Integration

#### Connection Configuration:

```typescript
// config/redis.ts
export async function initializeRedis() {
  const redis = new Redis(env.REDIS_URL);
  logger.info('Redis connected');
}
```

#### Redis Use Cases:

- **Session Storage**: JWT token blacklisting
- **Rate Limiting**: API request throttling
- **Caching**: API response caching
- **BullMQ**: Background job queue management

#### Configuration:

```yaml
redis:
  image: redis:7-alpine
  command: >
    --appendonly yes 
    --maxmemory 512mb 
    --maxmemory-policy allkeys-lru
    --requirepass-file /run/secrets/redis_password
```

### 2.4 WebSocket Server Integration

#### Socket.IO Configuration:

```typescript
// socket/index.ts
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});
```

#### WebSocket Handlers:

- **Health Status**: Real-time service monitoring
- **Media Requests**: Request status updates
- **YouTube Downloads**: Download progress
- **Notifications**: System alerts and messages

---

## 3. Security Architecture

### 3.1 JWT Authentication Flow

#### Authentication Sequence:

1. **Plex OAuth** → User authentication via Plex
2. **PIN Verification** → 4-digit PIN validation
3. **JWT Generation** → Token with 7-day expiry
4. **Token Validation** → Middleware-based verification

#### JWT Configuration:

```typescript
// config/env.ts
JWT_SECRET: Docker secret or environment variable
JWT_ISSUER: 'medianest'
JWT_AUDIENCE: 'medianest-users'
JWT_EXPIRES_IN: '7d'
```

### 3.2 CORS Configuration

#### Frontend-Backend Communication:

```typescript
// app.ts
cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
});
```

#### Nginx CORS Headers:

```nginx
# API CORS configuration
add_header 'Access-Control-Allow-Origin' $cors_origin always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
```

### 3.3 Rate Limiting Strategy

#### Multi-Layer Rate Limiting:

**Application Level (Express):**

```typescript
// middleware/rate-limit.ts
- API General: 100 requests/minute
- Authentication: 5 requests/minute
- YouTube: 5 requests/hour
```

**Nginx Level:**

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=youtube_limit:10m rate=5r/h;
```

**Redis-Based Storage:**

- **Key Pattern**: `rate_limit:{ip}:{endpoint}`
- **Sliding Window**: Time-based request counting
- **Persistent Storage**: Survives application restarts

### 3.4 API Versioning and Routing

#### Route Structure:

```
/api/v1/
├── auth/           # Authentication endpoints
├── dashboard/      # Dashboard data
├── media/          # Media search and requests
├── plex/           # Plex integration
├── youtube/        # YouTube downloads
├── admin/          # Admin endpoints
├── health/         # Health checks
└── webhooks/       # External service webhooks
```

#### Versioning Strategy:

- **Current Version**: v1
- **Route Prefix**: `/api/v1/`
- **Future Versions**: `/api/v2/` (additive)

---

## 4. Monitoring & Observability

### 4.1 Health Check Endpoints

#### Endpoint Configuration:

```typescript
// /api/health
{
  status: 'ok' | 'degraded' | 'error',
  timestamp: ISO string,
  services: {
    database: 'healthy' | 'unhealthy',
    redis: 'healthy' | 'unhealthy',
    plex: 'healthy' | 'unhealthy',
    overseerr: 'healthy' | 'unhealthy'
  }
}
```

#### Health Check Integration:

- **Docker Health Check**: `curl -f http://localhost:4000/api/health`
- **Nginx Health**: `/nginx_status` endpoint
- **Service Dependencies**: Cascading health validation

### 4.2 Logging Strategy (Winston)

#### Log Configuration:

```typescript
// utils/logger.ts
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/application.log' }),
    new winston.transports.Console(),
  ],
});
```

#### Log Levels:

- **Error**: Application errors, service failures
- **Warn**: Performance degradation, service timeouts
- **Info**: Request/response logging, service initialization
- **Debug**: Detailed debugging information (development only)

### 4.3 Metrics Collection (Prometheus Ready)

#### Metrics Endpoints:

```
/metrics            # Prometheus metrics endpoint
/api/health         # Health check data
```

#### Key Metrics:

- **Request Metrics**: Response times, status codes, throughput
- **Service Metrics**: Database connections, Redis operations
- **Business Metrics**: Media requests, download queue status
- **System Metrics**: Memory usage, CPU utilization

### 4.4 Error Handling and Reporting

#### Error Middleware:

```typescript
// middleware/error.ts
export const errorHandler = (err, req, res, next) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message,
    correlationId: req.correlationId,
  });
};
```

#### Error Categories:

- **Validation Errors**: Input validation failures
- **Authentication Errors**: JWT/Plex authentication issues
- **Service Errors**: External service communication failures
- **Database Errors**: Connection/query failures

---

## 5. Production Deployment Architecture

### 5.1 Container Orchestration Strategy

#### Service Startup Sequence:

```
1. postgres       # Database service (30s startup)
2. redis          # Caching service (20s startup)
3. backend        # Application service (60s startup)
4. frontend       # UI service (45s startup)
5. nginx          # Reverse proxy (30s startup)
```

#### Dependency Chain:

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

### 5.2 Graceful Shutdown Procedures

#### Shutdown Sequence:

```typescript
// server.ts
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // 1. Stop accepting new connections
  httpServer.close();

  // 2. Disconnect external services
  statusService.disconnect();

  // 3. Close database connections
  prisma.$disconnect();

  // 4. Force exit after timeout (10s)
  setTimeout(() => process.exit(0), 10000);
});
```

#### Graceful Operations:

- **Request Completion**: Wait for active requests to finish
- **WebSocket Cleanup**: Close Socket.IO connections
- **Queue Processing**: Complete active background jobs
- **Database Cleanup**: Close connection pools

### 5.3 Service Startup Sequence

#### Initialization Order:

1. **Environment Validation**: Verify required secrets
2. **Database Migration**: Run Prisma migrations
3. **Service Connections**: Connect to PostgreSQL, Redis
4. **Queue Initialization**: Start BullMQ processors
5. **Socket.IO Setup**: Initialize WebSocket handlers
6. **External Services**: Connect to Plex, Overseerr, Uptime Kuma
7. **HTTP Server**: Start Express server on port 4000

#### Startup Validation:

```typescript
async function startServer() {
  try {
    await initializeDatabase(); // PostgreSQL + Prisma
    await initializeRedis(); // Redis connection
    await initializeQueues(); // BullMQ setup
    await initializeServices(); // External services

    httpServer.listen(PORT);
    logger.info(`Server running on port ${PORT}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

### 5.4 Rollback and Recovery Procedures

#### Deployment Rollback:

```bash
# Version-based rollback
docker-compose -f docker-compose.prod.yml pull medianest/backend:v1.0.0
docker-compose -f docker-compose.prod.yml up -d backend

# Database rollback (if needed)
npx prisma migrate reset --force
npx prisma migrate deploy
```

#### Data Recovery:

- **Database Backup**: Daily automated PostgreSQL dumps
- **Redis Persistence**: AOF and RDB snapshots
- **File Storage**: Backup of uploads and downloads
- **Configuration Backup**: Environment and secrets backup

#### Recovery Validation:

1. **Health Check Validation**: Verify all services healthy
2. **API Endpoint Testing**: Test critical user flows
3. **WebSocket Connectivity**: Verify real-time features
4. **External Service Integration**: Test Plex/Overseerr connectivity

---

## 6. Integration Specifications

### 6.1 API Integration Specification

#### Authentication Flow:

```
1. GET /api/v1/auth/plex/login
2. Redirect to Plex OAuth
3. POST /api/v1/auth/pin (with PIN)
4. Response: JWT token + user profile
5. Header: Authorization: Bearer <token>
```

#### Media Request Flow:

```
1. GET /api/v1/media/search?query=movie
2. POST /api/v1/media/request (tmdbId, mediaType)
3. WebSocket: request_status_update
4. GET /api/v1/media/requests (user history)
```

#### YouTube Download Flow:

```
1. POST /api/v1/youtube/submit (url, options)
2. WebSocket: download_progress_update
3. GET /api/v1/youtube/queue (queue status)
4. WebSocket: download_complete
```

### 6.2 Environment Configuration Template

```bash
# MediaNest Backend Environment Configuration

# === Application Settings ===
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# === Database Configuration ===
DATABASE_URL_FILE=/run/secrets/database_url
# Format: postgresql://user:password@host:5432/database

# === Redis Configuration ===
REDIS_URL_FILE=/run/secrets/redis_url
# Format: redis://username:password@host:6379

# === Security Secrets ===
JWT_SECRET_FILE=/run/secrets/jwt_secret
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
NEXTAUTH_SECRET_FILE=/run/secrets/nextauth_secret

# === OAuth Configuration ===
PLEX_CLIENT_ID_FILE=/run/secrets/plex_client_id
PLEX_CLIENT_SECRET_FILE=/run/secrets/plex_client_secret

# === Operational Settings ===
LOG_LEVEL=info
RUN_MIGRATIONS=false
METRICS_TOKEN=<secure-token>

# === Rate Limiting ===
RATE_LIMIT_API_REQUESTS=100
RATE_LIMIT_API_WINDOW=60
RATE_LIMIT_YOUTUBE_REQUESTS=5
RATE_LIMIT_YOUTUBE_WINDOW=3600
```

### 6.3 Deployment Sequence Documentation

#### Pre-Deployment Checklist:

- [ ] Docker secrets generated and stored
- [ ] Environment variables configured
- [ ] SSL certificates obtained (Let's Encrypt)
- [ ] Domain DNS configured
- [ ] Firewall rules configured (80, 443)
- [ ] Backup storage configured

#### Deployment Commands:

```bash
# 1. Generate secrets
./scripts/generate-docker-secrets.sh

# 2. Build and deploy
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify deployment
./scripts/final-deployment-verification.sh

# 4. Monitor logs
docker-compose -f docker-compose.prod.yml logs -f
```

#### Post-Deployment Validation:

1. **Service Health**: All containers running and healthy
2. **API Connectivity**: Backend API responding correctly
3. **Frontend Access**: UI accessible via HTTPS
4. **Authentication**: Plex OAuth flow working
5. **WebSocket**: Real-time features operational
6. **External Services**: Plex/Overseerr integration functional

---

## 7. Conclusion

The MediaNest backend architecture demonstrates **production-ready maturity** with comprehensive:

- **Docker Integration**: Multi-stage production builds with security hardening
- **Service Architecture**: Robust Express.js application with proper separation of concerns
- **Security Implementation**: JWT authentication, CORS configuration, multi-layer rate limiting
- **Monitoring Strategy**: Health checks, structured logging, Prometheus metrics
- **Deployment Procedures**: Orchestrated startup, graceful shutdown, rollback capabilities

**Key Strengths:**

- Production-optimized Docker configuration already in place
- Comprehensive security middleware and rate limiting
- Real-time WebSocket integration for enhanced user experience
- External service integration with proper error handling
- Automated backup and recovery procedures

**Integration Risk Assessment: MEDIUM-LOW**

- Primary challenge: Docker configuration coordination (resolved)
- No architectural conflicts with PR-1 infrastructure
- Clean integration paths for all components
- Comprehensive testing infrastructure already established

The backend is **ready for production deployment** with the provided architectural integration blueprint.
