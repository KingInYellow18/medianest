# MediaNest Frontend Docker Build
# Specialized build for frontend-only deployment
# Optimized for Next.js with security hardening

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
COPY next.config.js ./
COPY tailwind.config.ts ./
COPY postcss.config.mjs ./
COPY tsconfig.json ./
COPY vitest.config.ts ./

# Install dependencies
RUN npm ci --no-audit --no-fund

# Copy source code and assets
COPY src ./src
COPY public ./public
COPY prisma ./prisma
COPY server.js ./

# Build application with Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
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
    adduser -S nextjs -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install only production runtime dependencies
RUN npm ci --only=production --no-audit --no-fund --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

# Copy built Next.js application with proper ownership
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./

# Security: Run as non-root user
USER nextjs

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]