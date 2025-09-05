# MediaNest Multi-Stage Production Docker Build
# Optimized for security, performance, and minimal image size
# Supports both development and production deployments

# =============================================================================
# SHARED DEPENDENCIES BUILD STAGE
# =============================================================================
FROM node:20-alpine AS shared-builder
WORKDIR /app

# Security hardening - add non-root user early
RUN addgroup -g 1001 -S nodejs && \
    adduser -S medianest -u 1001 -G nodejs

# Install system dependencies for build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Copy dependency manifests for optimal layer caching
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/

# Install shared dependencies with exact versions for security
RUN npm ci --only=production --no-audit --no-fund --ignore-scripts

# Copy shared source code
COPY shared/src ./shared/src

# Build shared package
WORKDIR /app/shared
RUN npm run build

# =============================================================================
# BACKEND BUILD STAGE
# =============================================================================
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy root and backend package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/prisma ./backend/prisma

# Copy shared build artifacts from previous stage
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/

# Install backend dependencies
RUN npm ci --workspace=backend --no-audit --no-fund

# Generate Prisma client for current environment
WORKDIR /app/backend
RUN npx prisma generate

# Copy backend source code
COPY backend/src ./src
COPY backend/nodemon.json ./

# Build backend with TypeScript
RUN npm run build

# =============================================================================
# FRONTEND BUILD STAGE  
# =============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy frontend package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY frontend/next.config.js ./frontend/
COPY frontend/tailwind.config.ts ./frontend/
COPY frontend/postcss.config.mjs ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vitest.config.ts ./frontend/

# Copy shared build artifacts
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/

# Install frontend dependencies
RUN npm ci --workspace=frontend --no-audit --no-fund

# Copy frontend source and assets
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/prisma ./frontend/prisma
COPY frontend/server.js ./frontend/

# Build frontend with Next.js standalone output
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# =============================================================================
# PRODUCTION BACKEND STAGE
# =============================================================================
FROM node:20-alpine AS backend-production

# Security hardening
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S medianest -u 1001 -G nodejs

# Copy dependency manifests
COPY --from=backend-builder /app/package*.json ./
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/shared/package.json ./shared/

# Install only production runtime dependencies
RUN npm ci --workspace=backend --only=production --no-audit --no-fund --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# Copy built applications with proper ownership
COPY --from=backend-builder --chown=medianest:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=medianest:nodejs /app/backend/prisma ./backend/prisma
COPY --from=shared-builder --chown=medianest:nodejs /app/shared/dist ./shared/dist

# Copy entrypoint script
COPY --chown=medianest:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create application directories
RUN mkdir -p logs uploads youtube && \
    chown -R medianest:nodejs logs uploads youtube

# Security: Run as non-root user
USER medianest

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Expose backend port
EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh", "backend"]

# =============================================================================
# PRODUCTION FRONTEND STAGE
# =============================================================================
FROM node:20-alpine AS frontend-production

# Security hardening
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Copy dependency manifests
COPY --from=frontend-builder /app/package*.json ./
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/shared/package.json ./shared/

# Install only production runtime dependencies
RUN npm ci --workspace=frontend --only=production --no-audit --no-fund --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# Copy built Next.js application with proper ownership
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/server.js ./frontend/

# Security: Run as non-root user
USER nextjs

# Health check for Next.js application
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose frontend port
EXPOSE 3000

# Production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "frontend/server.js"]

# =============================================================================
# UNIFIED PRODUCTION STAGE (Frontend + Backend)
# =============================================================================
FROM node:20-alpine AS production

# Security hardening and system utilities
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S medianest -u 1001 -G nodejs

# Copy dependency manifests for both services
COPY --from=backend-builder /app/package*.json ./
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=shared-builder /app/shared/package.json ./shared/

# Install production dependencies for both services
RUN npm ci --workspaces --only=production --no-audit --no-fund --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# Copy built applications with proper ownership
COPY --from=backend-builder --chown=medianest:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=medianest:nodejs /app/backend/prisma ./backend/prisma
COPY --from=frontend-builder --chown=medianest:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=medianest:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder --chown=medianest:nodejs /app/frontend/public ./frontend/public
COPY --from=frontend-builder --chown=medianest:nodejs /app/frontend/server.js ./frontend/
COPY --from=shared-builder --chown=medianest:nodejs /app/shared/dist ./shared/dist

# Copy entrypoint script
COPY --chown=medianest:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create application directories
RUN mkdir -p logs uploads youtube && \
    chown -R medianest:nodejs logs uploads youtube

# Security: Run as non-root user
USER medianest

# Multi-service health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health && curl -f http://localhost:3000/api/health || exit 1

# Expose both frontend and backend ports
EXPOSE 3000 3001

# Production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]

# =============================================================================
# DEVELOPMENT STAGE
# =============================================================================
FROM node:20-alpine AS development
WORKDIR /app

# Install system dependencies for development
RUN apk add --no-cache \
    git \
    curl \
    python3 \
    make \
    g++ \
    dumb-init

# Create app user for development
RUN addgroup -g 1001 -S nodejs && \
    adduser -S medianest -u 1001 -G nodejs

# Copy all package files for workspace setup
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies including dev dependencies
RUN npm ci --include=dev --no-audit --no-fund

# Copy all source code
COPY --chown=medianest:nodejs . .

# Create application directories
RUN mkdir -p logs uploads youtube && \
    chown -R medianest:nodejs logs uploads youtube

# Switch to app user
USER medianest

# Generate Prisma clients for both frontend and backend
RUN npm run db:generate

# Development health check (more lenient timing)
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:3000 && curl -f http://localhost:3001/health || exit 1

# Expose development ports
EXPOSE 3000 3001 5555

# Development environment variables
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true

# Use dumb-init and run development servers
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]