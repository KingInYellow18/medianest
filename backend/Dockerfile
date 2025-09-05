# MediaNest Backend Docker Build  
# Specialized build for backend-only deployment
# Optimized for Node.js/Express with security hardening

# =============================================================================
# BUILD STAGE
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Security hardening - install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files for optimal caching
COPY package*.json ./
COPY tsconfig.json ./
COPY nodemon.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci --no-audit --no-fund

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# =============================================================================
# PRODUCTION STAGE
# =============================================================================
FROM node:20-alpine AS production

# Security hardening
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S medianest -u 1001 -G nodejs

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install only production runtime dependencies
RUN npm ci --only=production --no-audit --no-fund --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# Generate Prisma client for production
RUN npx prisma generate

# Copy built application with proper ownership
COPY --from=builder --chown=medianest:nodejs /app/dist ./dist

# Create application directories
RUN mkdir -p logs uploads && \
    chown -R medianest:nodejs logs uploads

# Security: Run as non-root user
USER medianest

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Production environment variables
ENV NODE_ENV=production

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]