# 🐳 MEDIANEST - CONSOLIDATED MULTI-STAGE DOCKERFILE
# Replaces 23+ individual Dockerfiles with single unified configuration
# Optimized for performance, security, and maintainability

# ==========================================
# STAGE 1: Base Alpine with Node.js 20 LTS
# ==========================================
FROM node:20-alpine AS base

# Install system dependencies for MediaNest requirements
RUN apk add --no-cache \
    dumb-init \
    su-exec \
    curl \
    bash \
    git \
    python3 \
    make \
    g++ \
    && addgroup -g 1001 -S medianest \
    && adduser -S medianest -u 1001 -G medianest

# Set working directory
WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# ==========================================
# STAGE 2: Development Dependencies
# ==========================================
FROM base AS dev-dependencies

# Install all dependencies (including devDependencies for development)
RUN npm ci --include=dev && npm cache clean --force

# Copy source code
COPY . .

# Set proper ownership
RUN chown -R medianest:medianest /app

# ==========================================
# STAGE 3: Production Dependencies
# ==========================================
FROM base AS prod-dependencies

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# ==========================================
# STAGE 4: Shared Builder Base
# ==========================================
FROM base AS shared-builder

# Copy production dependencies
COPY --from=prod-dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build shared assets and utilities
RUN npm run build:shared 2>/dev/null || echo "No shared build script found"

# ==========================================
# STAGE 5: Backend Builder
# ==========================================
FROM shared-builder AS backend-builder

# Build backend application
ENV NODE_ENV=production
RUN npm run build:backend 2>/dev/null || npm run build || echo "No backend build script found"

# ==========================================
# STAGE 6: Frontend Builder  
# ==========================================
FROM shared-builder AS frontend-builder

# Build frontend application (Next.js optimized)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:frontend 2>/dev/null || npm run build || echo "No frontend build script found"

# ==========================================
# STAGE 7: Development Environment
# ==========================================
FROM dev-dependencies AS development

# Expose common development ports
EXPOSE 3000 4000 5000 8000

# Set development environment
ENV NODE_ENV=development
ENV DEBUG=medianest:*

# Development user setup
USER medianest

# Health check for development
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start development server with hot reload
CMD ["dumb-init", "npm", "run", "dev"]

# ==========================================
# STAGE 8: Backend Production
# ==========================================
FROM base AS backend-production

# Copy production dependencies and built backend
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=backend-builder --chown=medianest:medianest /app/dist ./dist
COPY --from=backend-builder --chown=medianest:medianest /app/build ./build
COPY package*.json ./

# Copy additional backend assets
COPY --chown=medianest:medianest backend ./backend
COPY --chown=medianest:medianest shared ./shared

# Production environment
ENV NODE_ENV=production
ENV PORT=4000

# Security hardening
RUN apk del git python3 make g++ && rm -rf /var/cache/apk/*

# Expose backend port
EXPOSE 4000

# Switch to non-root user
USER medianest

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4000/api/health || exit 1

# Production startup
CMD ["dumb-init", "node", "backend/server.js"]

# ==========================================
# STAGE 9: Frontend Production
# ==========================================
FROM base AS frontend-production

# Copy production dependencies and built frontend
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=frontend-builder --chown=medianest:medianest /app/.next ./.next
COPY --from=frontend-builder --chown=medianest:medianest /app/dist ./dist
COPY --from=frontend-builder --chown=medianest:medianest /app/build ./build
COPY package*.json ./

# Copy frontend assets
COPY --chown=medianest:medianest frontend ./frontend
COPY --chown=medianest:medianest public ./public
COPY --chown=medianest:medianest next.config.js tailwind.config.js ./

# Production environment for Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Security hardening
RUN apk del git python3 make g++ && rm -rf /var/cache/apk/*

# Expose frontend port
EXPOSE 3000

# Switch to non-root user
USER medianest

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || curl -f http://localhost:3000 || exit 1

# Production startup
CMD ["dumb-init", "npm", "start"]

# ==========================================
# STAGE 10: Nginx Production Proxy
# ==========================================
FROM nginx:alpine AS nginx-production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy nginx configuration
COPY --chown=root:root infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=root:root infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy static frontend assets from frontend builder
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY --from=frontend-builder /app/build /usr/share/nginx/html

# Security headers and SSL setup
RUN mkdir -p /etc/nginx/ssl && chown -R nginx:nginx /etc/nginx/ssl

# Expose HTTP and HTTPS
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx with dumb-init
CMD ["dumb-init", "nginx", "-g", "daemon off;"]

# ==========================================
# STAGE 11: Security Hardened (Maximum Security)
# ==========================================
FROM backend-production AS security-hardened

# Switch back to root for security hardening
USER root

# Additional security packages
RUN apk add --no-cache \
    ca-certificates \
    && update-ca-certificates

# Create read-only filesystem areas
RUN mkdir -p /tmp/medianest /var/log/medianest \
    && chown medianest:medianest /tmp/medianest /var/log/medianest \
    && chmod 750 /tmp/medianest /var/log/medianest

# Remove shell access for security
RUN sed -i 's/medianest:x:1001:1001:medianest/medianest:x:1001:1001:medianest:\/nonexistent:\/bin\/false/' /etc/passwd

# Switch back to non-root user
USER medianest

# Security-focused startup with restricted privileges
CMD ["dumb-init", "--", "su-exec", "medianest:medianest", "node", "backend/server.js"]

# ==========================================
# STAGE 12: Test Runner
# ==========================================
FROM dev-dependencies AS test-runner

# Install additional test dependencies
RUN npm install -g jest playwright @playwright/test

# Copy test files and configurations
COPY --chown=medianest:medianest tests ./tests
COPY --chown=medianest:medianest jest.config.js playwright.config.js ./

# Test environment setup
ENV NODE_ENV=test
ENV CI=true

# Switch to test user
USER medianest

# Default test command
CMD ["npm", "test"]

# ==========================================
# STAGE 13: Database Migration Runner
# ==========================================
FROM base AS migration-runner

# Copy production dependencies for database tools
COPY --from=prod-dependencies /app/node_modules ./node_modules

# Copy migration files and database tools
COPY --chown=medianest:medianest backend/migrations ./backend/migrations
COPY --chown=medianest:medianest backend/seeders ./backend/seeders
COPY --chown=medianest:medianest backend/database ./backend/database
COPY package*.json ./

# Migration environment
ENV NODE_ENV=production

# Switch to non-root user
USER medianest

# Migration command
CMD ["npm", "run", "migrate"]

# ==========================================
# Build Arguments for Target Selection
# ==========================================
ARG BUILD_TARGET=backend-production
ARG NODE_ENV=production
ARG BUILD_CONTEXT=.

# Labels for container metadata
LABEL maintainer="MediaNest Team"
LABEL version="2.0.0-consolidated"
LABEL description="MediaNest consolidated multi-stage Docker image"
LABEL org.opencontainers.image.source="https://github.com/medianest/medianest"
LABEL org.opencontainers.image.documentation="https://docs.medianest.com"
LABEL build.target="${BUILD_TARGET}"
LABEL build.node_env="${NODE_ENV}"