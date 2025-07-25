# Task: Docker Development Environment

**Task ID:** PHASE1-02  
**Priority:** Critical  
**Estimated Time:** 3 hours  
**Dependencies:** PHASE1-01 (Project Setup)

## Objective
Create a complete Docker Compose development environment that mirrors production setup and enables easy local development.

## Acceptance Criteria
- [ ] All services start with `docker-compose up`
- [ ] Hot reload works for both frontend and backend
- [ ] Database persists data between restarts
- [ ] Redis is accessible for caching and sessions
- [ ] Health checks pass for all services

## Detailed Steps

### 1. Create Docker Compose Configuration
Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: medianest-postgres
    environment:
      POSTGRES_DB: medianest
      POSTGRES_USER: medianest_user
      POSTGRES_PASSWORD: dev_password_change_me
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medianest_user -d medianest"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: medianest-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: medianest-backend
    volumes:
      - ./backend:/app
      - /app/node_modules
      - ./youtube:/app/youtube
      - ./uploads:/app/uploads
    ports:
      - "4000:4000"
      - "9229:9229" # Debug port
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://medianest_user:dev_password_change_me@postgres:5432/medianest
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_me
      ENCRYPTION_KEY: dev_encryption_key_32_bytes_long!!
      PORT: 4000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev

  # Frontend Next.js
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: medianest-frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: dev_nextauth_secret_change_me
    depends_on:
      - backend
    command: npm run dev

  # Nginx Proxy (optional for development)
  nginx:
    image: nginx:alpine
    container_name: medianest-nginx
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: medianest-network
```

### 2. Create Backend Dockerfile.dev
Create `backend/Dockerfile.dev`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies for node-gyp
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code (handled by volume in dev)
COPY . .

# Expose ports
EXPOSE 4000 9229

# Start development server
CMD ["npm", "run", "dev"]
```

### 3. Create Frontend Dockerfile.dev
Create `frontend/Dockerfile.dev`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code (handled by volume in dev)
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
```

### 4. Create Nginx Development Config
Create `docker/nginx/nginx.dev.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:4000;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # API routes
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket support
        location /socket.io {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

### 5. Create Development Environment File
Create `.env.development`:

```bash
# Database
DATABASE_URL=postgresql://medianest_user:dev_password_change_me@localhost:5432/medianest

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=dev_jwt_secret_change_me
NEXTAUTH_SECRET=dev_nextauth_secret_change_me
ENCRYPTION_KEY=dev_encryption_key_32_bytes_long!!

# Plex OAuth (to be configured)
PLEX_CLIENT_ID=medianest-dev
PLEX_CLIENT_SECRET=

# Admin Bootstrap
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

# Service URLs (to be configured)
OVERSEERR_URL=
OVERSEERR_API_KEY=
UPTIME_KUMA_URL=
UPTIME_KUMA_TOKEN=

# YouTube Downloads
YOUTUBE_DOWNLOAD_PATH=/app/youtube
YOUTUBE_RATE_LIMIT=5

# Development
NODE_ENV=development
LOG_LEVEL=debug
```

### 6. Create Docker Helper Scripts
Create `scripts/docker-dev.sh`:

```bash
#!/bin/bash

# Docker development helper script

case "$1" in
  up)
    echo "Starting MediaNest development environment..."
    docker-compose up -d
    echo "Waiting for services to be healthy..."
    sleep 10
    docker-compose ps
    ;;
  down)
    echo "Stopping MediaNest development environment..."
    docker-compose down
    ;;
  restart)
    echo "Restarting MediaNest development environment..."
    docker-compose down
    docker-compose up -d
    ;;
  logs)
    docker-compose logs -f ${2:-}
    ;;
  reset)
    echo "Resetting MediaNest development environment..."
    docker-compose down -v
    docker-compose up -d
    ;;
  shell)
    docker-compose exec ${2:-backend} /bin/sh
    ;;
  *)
    echo "Usage: $0 {up|down|restart|logs|reset|shell} [service]"
    exit 1
    ;;
esac
```

### 7. Create Database Initialization Script
Create `scripts/init-db.sql`:

```sql
-- Initial database setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'available', 'failed');
CREATE TYPE download_status AS ENUM ('queued', 'downloading', 'completed', 'failed');
CREATE TYPE service_status AS ENUM ('up', 'down', 'degraded');

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest_user;
```

### 8. Create Docker Ignore Files
Create `backend/.dockerignore`:

```
node_modules
npm-debug.log
.env*
.git
.gitignore
README.md
.eslintrc*
.prettierrc*
coverage
.nyc_output
dist
.vscode
.idea
```

Create `frontend/.dockerignore`:

```
node_modules
npm-debug.log
.env*
.git
.gitignore
README.md
.eslintrc*
.prettierrc*
.next
out
coverage
.vscode
.idea
```

## Verification Steps
1. Run `docker-compose up -d` and verify all services start
2. Check health status: `docker-compose ps`
3. Verify database connection: `docker-compose exec postgres psql -U medianest_user -d medianest -c '\dt'`
4. Verify Redis: `docker-compose exec redis redis-cli ping`
5. Access frontend at http://localhost:3000
6. Access backend at http://localhost:4000
7. Check logs: `docker-compose logs -f`

## Testing Requirements
- [ ] Unit tests for Docker helper scripts (docker-dev.sh)
- [ ] Integration tests for service connectivity between containers
- [ ] Test health check endpoints for all services
- [ ] Verify volume persistence with data retention tests
- [ ] Test hot-reload functionality for both frontend and backend
- [ ] Validate environment variable injection
- [ ] Test container restart resilience
- [ ] Verify database initialization script executes correctly
- [ ] Test coverage should exceed 80% for helper scripts
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Port conflicts**: Change port mappings in docker-compose.yml
- **Permission issues**: Ensure volume directories have correct permissions
- **Database connection fails**: Wait for health checks to pass
- **Hot reload not working**: Check volume mounts and file watchers

## Notes
- Development environment uses simple passwords - never use in production
- Volumes persist data between container restarts
- Use `docker-compose down -v` to completely reset data
- Consider using Docker BuildKit for faster builds: `export DOCKER_BUILDKIT=1`

## Related Documentation
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Development Guide](/docs/DEVELOPMENT.md)
- [Environment Configuration](/docs/ENVIRONMENT.md)