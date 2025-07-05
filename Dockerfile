# Build stage
FROM node:24-alpine AS builder

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
FROM node:24-alpine

# Install yt-dlp and ffmpeg for YouTube downloads
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Create non-root user
RUN addgroup -g 1000 -S nodejs && \
    adduser -S nodejs -u 1000 -G nodejs

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

# Switch to non-root user
USER nodejs

EXPOSE 3000 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]