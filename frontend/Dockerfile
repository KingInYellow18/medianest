# MediaNest Frontend Dockerfile
# Implements :ContainerOrchestration pattern for :React v18 + :Node.js LTS
# Supports development workflow with hot-reload capabilities and integration with :Flask backend

# Use Node.js LTS official image for stability and security
FROM node:18-alpine

# Set environment variables for Node.js optimization and React configuration
ENV NODE_ENV=development \
    REACT_APP_API_URL=http://backend:5000/api \
    REACT_APP_ENVIRONMENT=development \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_PROGRESS=false

# Create non-root user for security (:SecurityFirst principle)
# Handle existing gid 1000 in Alpine base image
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Install system dependencies for potential native modules
# Keep minimal for Alpine Linux security and size optimization
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install Node.js dependencies
# Use npm install since no package-lock.json exists yet
# Use --no-cache to reduce image size and avoid :MemoryLeak
RUN npm install --silent && \
    npm cache clean --force

# Create necessary directories with proper permissions
RUN mkdir -p /app/src /app/public /app/build && \
    chown -R appuser:appuser /app

# Switch to non-root user (:SecurityFirst - mitigate :SecurityVulnerability)
USER appuser

# Copy application code (excluding sensitive files via .dockerignore)
# Note: src and public will be volume-mounted in development for hot-reload
COPY --chown=1001:1001 . .

# Expose React development server port
EXPOSE 3000

# Health check for container orchestration
# Check if React dev server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Default command for React development server with hot-reload
# Supports development workflow with volume mounting for src and public
# Binds to 0.0.0.0 to allow external access from docker-compose network
CMD ["npm", "start"]