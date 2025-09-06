# Multi-stage Docker build for MediaNest
# Optimized for production deployment with minimal image size

# Build stage for shared dependencies
FROM node:20-alpine AS shared-builder
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/

# Install dependencies with exact versions
RUN npm ci --only=production --no-audit --no-fund

# Copy shared source code
COPY shared/src ./shared/src

# Build shared package
WORKDIR /app/shared
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/prisma ./backend/prisma

# Copy shared build from previous stage
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/

# Install backend dependencies
RUN npm ci --workspace=backend --only=production --no-audit --no-fund

# Generate Prisma client
WORKDIR /app/backend
RUN npx prisma generate

# Copy backend source code
COPY backend/src ./src

# Build backend
RUN npm run build

# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY frontend/next.config.js ./frontend/
COPY frontend/tailwind.config.ts ./frontend/
COPY frontend/postcss.config.mjs ./frontend/
COPY frontend/tsconfig.json ./frontend/

# Copy shared build
COPY --from=shared-builder /app/shared/dist ./shared/dist
COPY --from=shared-builder /app/shared/package.json ./shared/

# Install frontend dependencies
RUN npm ci --workspace=frontend --only=production --no-audit --no-fund

# Copy frontend source code
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/prisma ./frontend/prisma

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Production stage for backend
FROM node:20-alpine AS backend-production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S medianest -u 1001

# Install production dependencies only
COPY --from=backend-builder /app/package*.json ./
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/shared/package.json ./shared/

# Install runtime dependencies
RUN npm ci --workspace=backend --only=production --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf ~/.npm

# Copy built applications
COPY --from=backend-builder --chown=medianest:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=medianest:nodejs /app/backend/prisma ./backend/prisma
COPY --from=shared-builder --chown=medianest:nodejs /app/shared/dist ./shared/dist

# Copy entrypoint script
COPY --chown=medianest:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create logs directory
RUN mkdir -p logs && chown medianest:nodejs logs

# Switch to non-root user
USER medianest

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node backend/dist/health-check.js || exit 1

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "backend/dist/server.js"]

# Production stage for frontend
FROM node:20-alpine AS frontend-production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Install production dependencies
COPY --from=frontend-builder /app/package*.json ./
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/shared/package.json ./shared/

RUN npm ci --workspace=frontend --only=production --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf ~/.npm

# Copy built applications
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["node", "frontend/server.js"]

# Development stage (multi-service)
FROM node:20-alpine AS development
WORKDIR /app

# Install system dependencies for development
RUN apk add --no-cache git curl

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S app -u 1001

# Copy package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies (including dev dependencies)
RUN npm ci --no-audit --no-fund

# Copy source code
COPY --chown=app:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown app:nodejs logs

# Switch to app user
USER app

# Generate Prisma client
RUN npm run db:generate

EXPOSE 3000 3001

CMD ["npm", "run", "dev"]