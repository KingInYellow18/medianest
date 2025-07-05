# Task: Docker and Docker Compose Setup

**Priority:** High  
**Estimated Duration:** 3 hours  
**Dependencies:** 04-nextjs-express-scaffolding  
**Phase:** 0 (Week 1 - Day 2)

## Objective
**Status:** ✅ Complete

Create Dockerfile for production builds, set up docker-compose.yml for local development, configure PostgreSQL and Redis containers with proper initialization, establish volume mounts for persistence, and ensure the entire stack runs smoothly.

## Background
Containerization ensures consistent environments across development, testing, and production. Docker Compose orchestrates our multi-service application for easy local development.

## Detailed Requirements

### 1. Production Dockerfile
- Multi-stage build for optimization
- Security best practices (non-root user)
- Minimal final image size
- Health check configuration

### 2. Docker Compose Configuration
- All services properly networked
- Environment variable management
- Volume persistence for data
- Development-friendly settings

### 3. Database Initialization
- PostgreSQL with extensions
- Redis configuration
- Initialization scripts
- Proper networking

### 4. Volume Management
- Database persistence
- YouTube downloads directory
- Redis data persistence
- Log file management

## Technical Implementation Details

### Production Dockerfile (Dockerfile)
```dockerfile
# Build stage for shared package
FROM node:20-alpine AS shared-builder
WORKDIR /app
COPY shared/package*.json ./shared/
COPY tsconfig.base.json ./
WORKDIR /app/shared
RUN npm ci
COPY shared/ ./
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY backend/package*.json ./backend/
COPY tsconfig.base.json ./
WORKDIR /app/backend
RUN npm ci
COPY --from=shared-builder /app/shared ../shared
COPY backend/ ./
RUN npm run build

# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
COPY tsconfig.base.json ./
WORKDIR /app/frontend
RUN npm ci
COPY --from=shared-builder /app/shared ../shared
COPY frontend/ ./
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Production stage
FROM node:20-alpine AS production
RUN apk add --no-cache tini curl
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy backend
WORKDIR /app/backend
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package*.json ./
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./node_modules

# Copy frontend
WORKDIR /app/frontend
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/.next ./.next
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public ./public
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/package*.json ./
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/node_modules ./node_modules

# Copy shared
WORKDIR /app
COPY --from=shared-builder --chown=nodejs:nodejs /app/shared ./shared

# Create directories for uploads and logs
RUN mkdir -p /app/uploads /app/logs /app/youtube && \
    chown -R nodejs:nodejs /app/uploads /app/logs /app/youtube

USER nodejs
WORKDIR /app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start both services
CMD ["sh", "-c", "cd backend && node dist/server.js & cd ../frontend && npm start"]

EXPOSE 3000 4000
```

### Development Dockerfile (Dockerfile.dev)
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git curl
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

RUN npm ci

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/youtube

# Development command
CMD ["npm", "run", "dev"]

EXPOSE 3000 4000
```

### Docker Compose Configuration (docker-compose.yml)
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: medianest-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-medianest}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-medianest}
      POSTGRES_DB: ${POSTGRES_DB:-medianest}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-medianest}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: medianest-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: >
      redis-server
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --save 60 1000
      --save 300 10
      --save 900 1
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Application (Development)
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: medianest-app
    restart: unless-stopped
    ports:
      - "3000:3000"  # Next.js
      - "4000:4000"  # Express
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${POSTGRES_USER:-medianest}:${POSTGRES_PASSWORD:-medianest}@postgres:5432/${POSTGRES_DB:-medianest}?schema=public
      REDIS_URL: redis://redis:6379
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-development-secret-change-in-production}
      JWT_SECRET: ${JWT_SECRET:-development-jwt-secret}
      PLEX_CLIENT_ID: ${PLEX_CLIENT_ID}
      PLEX_CLIENT_SECRET: ${PLEX_CLIENT_SECRET}
      NEXT_PUBLIC_API_URL: http://localhost:4000
    volumes:
      - ./frontend:/app/frontend:delegated
      - ./backend:/app/backend:delegated
      - ./shared:/app/shared:delegated
      - /app/node_modules
      - /app/frontend/node_modules
      - /app/backend/node_modules
      - /app/shared/node_modules
      - youtube_data:/app/youtube
      - upload_data:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    stdin_open: true
    tty: true

  # Nginx (Production-like setup)
  nginx:
    image: nginx:alpine
    container_name: medianest-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - app
    profiles:
      - production

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  youtube_data:
    driver: local
  upload_data:
    driver: local

networks:
  default:
    name: medianest-network
```

### PostgreSQL Initialization Script (docker/postgres/init.sql)
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'completed', 'failed');
CREATE TYPE download_status AS ENUM ('queued', 'downloading', 'completed', 'failed');

-- Set up database
ALTER DATABASE medianest SET timezone TO 'UTC';

-- Create application user (optional, for production)
-- CREATE USER medianest_app WITH PASSWORD 'app_password';
-- GRANT CONNECT ON DATABASE medianest TO medianest_app;
-- GRANT USAGE ON SCHEMA public TO medianest_app;
-- GRANT CREATE ON SCHEMA public TO medianest_app;
```

### Nginx Configuration (docker/nginx/nginx.conf)
```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server app:3000;
    }

    upstream backend {
        server app:4000;
    }

    server {
        listen 80;
        server_name localhost;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
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
    }
}
```

### Environment File Template (.env.example)
```bash
# Database
POSTGRES_USER=medianest
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=medianest

# Redis
REDIS_PASSWORD=change-me-in-production

# Application
NODE_ENV=development
PORT=4000

# URLs
DATABASE_URL=postgresql://medianest:medianest@localhost:5432/medianest?schema=public
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:4000

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-secure-secret-for-production
JWT_SECRET=generate-a-secure-jwt-secret

# Plex OAuth
PLEX_CLIENT_ID=your-plex-client-id
PLEX_CLIENT_SECRET=your-plex-client-secret

# Encryption
ENCRYPTION_KEY=generate-32-byte-key-for-encryption

# File paths
YOUTUBE_DOWNLOAD_PATH=/app/youtube
UPLOAD_PATH=/app/uploads
```

### Docker Ignore (.dockerignore)
```
# Dependencies
node_modules
npm-debug.log

# Build outputs
dist
build
.next
out

# Environment files
.env
.env.local
.env.*.local

# Git
.git
.gitignore

# IDE
.vscode
.idea

# OS
.DS_Store
Thumbs.db

# Testing
coverage
.nyc_output

# Documentation
docs
*.md

# Docker
docker-compose*.yml
Dockerfile*
```

## Acceptance Criteria
1. ✅ `docker-compose up` starts all services
2. ✅ Application accessible at http://localhost:3000
3. ✅ API accessible at http://localhost:4000
4. ✅ PostgreSQL data persists across restarts
5. ✅ Redis caching works properly
6. ✅ Health checks pass for all services
7. ✅ Volumes mounted correctly
8. ✅ Hot reload works in development

## Testing Requirements
1. Run `docker-compose up` and verify all services start
2. Check health endpoints through Docker
3. Create data and verify persistence after restart
4. Test hot reload by editing code
5. Verify logs are accessible

## Commands
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (careful!)
docker-compose down -v

# Rebuild after changes
docker-compose build

# Run database migrations
docker-compose exec app npm run db:migrate

# Access PostgreSQL
docker-compose exec postgres psql -U medianest

# Access Redis CLI
docker-compose exec redis redis-cli
```

## Common Issues & Solutions
1. **Port conflicts**: Change ports in docker-compose.yml
2. **Permission errors**: Check user/group in Dockerfile
3. **Database connection fails**: Wait for health checks
4. **Slow performance on Mac**: Use delegated mounts

## Security Considerations
- Never commit .env files
- Use secrets management in production
- Run containers as non-root user
- Limit container capabilities
- Use specific image versions

## Next Steps
- Set up CI/CD pipeline
- Configure GitHub Actions
- Add monitoring setup

## Completion Notes
- Completed on: July 4, 2025
- All acceptance criteria met
- Ready for production use

## References
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)