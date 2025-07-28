# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/frontend
RUN npm ci

WORKDIR /app/backend
RUN npm ci

# Copy source code
WORKDIR /app
COPY frontend ./frontend
COPY backend ./backend

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

# Security: Add labels for better container management
LABEL maintainer="MediaNest Team"
LABEL version="1.0.0"
LABEL description="MediaNest - Unified Media Management Portal"

# Install runtime dependencies and security updates
RUN apk upgrade --no-cache && \
    apk add --no-cache \
        python3 \
        py3-pip \
        ffmpeg \
        dumb-init \
        curl && \
    pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Create non-root user with specific UID/GID for consistency
RUN addgroup -g 1000 -S nodejs && \
    adduser -S nodejs -u 1000 -G nodejs && \
    mkdir -p /app/uploads /app/downloads /app/logs && \
    chown -R nodejs:nodejs /app

# Copy built applications
COPY --from=builder --chown=nodejs:nodejs /app/frontend ./frontend
COPY --from=builder --chown=nodejs:nodejs /app/backend ./backend

# Create directories for uploads and YouTube downloads
RUN mkdir -p /app/uploads /app/youtube && \
    chown -R nodejs:nodejs /app/uploads /app/youtube

# Install production dependencies only
WORKDIR /app/frontend
RUN npm ci --production

WORKDIR /app/backend
RUN npm ci --production

# Copy startup script
COPY --chown=nodejs:nodejs docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Security: Set environment defaults
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=1024" \
    NPM_CONFIG_LOGLEVEL=warn

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4000/api/health || exit 1

# Switch to non-root user
USER nodejs

# Expose only necessary ports
EXPOSE 3000 4000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["/app/docker-entrypoint.sh"]