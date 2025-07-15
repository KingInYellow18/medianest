# Phase 5: Docker Production Image Creation

**Status:** Not Started  
**Priority:** High  
**Dependencies:** All features complete, tests passing  
**Estimated Time:** 4 hours

## Objective

Create optimized Docker images for production deployment, configure production compose files, and prepare the containerized application for homelab deployment.

## Background

Production Docker images need to be optimized for size, security, and performance. We'll use multi-stage builds and production best practices.

## Tasks

### 1. Frontend Production Image

- [ ] Create multi-stage Dockerfile
- [ ] Optimize Next.js build
- [ ] Remove development dependencies
- [ ] Configure runtime environment
- [ ] Set up health checks
- [ ] Minimize image size

### 2. Backend Production Image

- [ ] Create multi-stage build
- [ ] Compile TypeScript
- [ ] Remove build tools
- [ ] Copy only necessary files
- [ ] Configure production settings
- [ ] Add security hardening

### 3. Docker Compose Production

- [ ] Create docker-compose.prod.yml
- [ ] Configure service dependencies
- [ ] Set resource limits
- [ ] Configure networks
- [ ] Set up volumes
- [ ] Add restart policies

### 4. Nginx Configuration

- [ ] Create Nginx image
- [ ] Configure SSL termination
- [ ] Set up reverse proxy
- [ ] Configure caching
- [ ] Add security headers
- [ ] Enable compression

### 5. Environment Configuration

- [ ] Create .env.production template
- [ ] Document all variables
- [ ] Set production defaults
- [ ] Configure secrets
- [ ] Validate configuration
- [ ] Create setup script

### 6. Image Testing

- [ ] Test image builds
- [ ] Verify minimal size
- [ ] Check security scanning
- [ ] Test container startup
- [ ] Verify health checks
- [ ] Test full stack locally

## Docker Configuration

### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile.prod
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]
```

### Backend Dockerfile

```dockerfile
# backend/Dockerfile.prod
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: medianest/nginx:latest
    ports:
      - '443:443'
      - '80:80'
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - medianest-network

  frontend:
    image: medianest/frontend:latest
    environment:
      - NODE_ENV=production
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    secrets:
      - nextauth_secret
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - medianest-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  backend:
    image: medianest/backend:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://medianest:${DB_PASSWORD}@postgres:5432/medianest_db
      - REDIS_URL=redis://redis:6379
    secrets:
      - db_password
      - encryption_key
      - plex_client_secret
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - medianest-network
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=medianest
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
      - POSTGRES_DB=medianest_db
    secrets:
      - db_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - medianest-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - medianest-network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

secrets:
  db_password:
    external: true
  nextauth_secret:
    external: true
  encryption_key:
    external: true
  plex_client_secret:
    external: true

volumes:
  postgres-data:
  redis-data:

networks:
  medianest-network:
    driver: bridge
```

### Build Script

```bash
#!/bin/bash
# scripts/build-production.sh

set -e

echo "Building MediaNest Production Images"

# Build frontend
echo "Building frontend..."
docker build -f frontend/Dockerfile.prod -t medianest/frontend:latest ./frontend
docker tag medianest/frontend:latest medianest/frontend:$(git rev-parse --short HEAD)

# Build backend
echo "Building backend..."
docker build -f backend/Dockerfile.prod -t medianest/backend:latest ./backend
docker tag medianest/backend:latest medianest/backend:$(git rev-parse --short HEAD)

# Build nginx
echo "Building nginx..."
docker build -f nginx/Dockerfile -t medianest/nginx:latest ./nginx
docker tag medianest/nginx:latest medianest/nginx:$(git rev-parse --short HEAD)

# Scan images for vulnerabilities
echo "Scanning images..."
docker scan medianest/frontend:latest || true
docker scan medianest/backend:latest || true

# Show image sizes
echo ""
echo "Image sizes:"
docker images | grep medianest

echo ""
echo "Build complete!"
```

### Environment Template

```bash
# .env.production
# Copy this file and fill in your values

# Application
NODE_ENV=production
NEXTAUTH_URL=https://media.yourdomain.com
NEXT_PUBLIC_API_URL=https://media.yourdomain.com/api

# Database (managed via Docker secrets)
# DB_PASSWORD is set via Docker secret

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Plex OAuth
PLEX_CLIENT_ID=your-plex-client-id
# PLEX_CLIENT_SECRET is set via Docker secret

# External Services
OVERSEERR_URL=http://overseerr.local:5055
OVERSEERR_API_KEY=your-overseerr-api-key
UPTIME_KUMA_URL=http://uptime-kuma.local:3001

# YouTube Downloads
YOUTUBE_DOWNLOAD_PATH=/youtube
MAX_DOWNLOAD_SIZE_GB=10

# Monitoring (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

## Testing Requirements

- [ ] Images build successfully
- [ ] Containers start properly
- [ ] Health checks pass
- [ ] Services communicate
- [ ] Volumes persist data
- [ ] Secrets load correctly

## Success Criteria

- [ ] Frontend image <200MB
- [ ] Backend image <300MB
- [ ] All services start in <30s
- [ ] Health checks functional
- [ ] No security vulnerabilities
- [ ] Production config working

## Notes

- Use specific version tags
- Scan images for vulnerabilities
- Document any special requirements
- Keep images minimal
- Test thoroughly before deployment
