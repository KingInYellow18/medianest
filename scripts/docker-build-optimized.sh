#!/bin/bash
# Docker Build Cache Optimization Script

set -e

echo "🐳 Docker Build Cache Optimization"

# Enable BuildKit for better caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build with aggressive caching
echo "📦 Building with maximum cache utilization..."

# Backend build with cache
docker build   --file backend/Dockerfile.optimized   --target production   --cache-from medianest-backend:cache   --tag medianest-backend:latest   --tag medianest-backend:cache   .

# Frontend build with cache
docker build   --file frontend/Dockerfile.optimized   --target production   --cache-from medianest-frontend:cache   --tag medianest-frontend:latest   --tag medianest-frontend:cache   .

echo "✅ Optimized Docker builds complete"

# Optional: Push cache images to registry
# docker push medianest-backend:cache
# docker push medianest-frontend:cache

echo "📊 Image size analysis:"
docker images | grep medianest

echo "🧹 Cleaning up dangling images..."
docker image prune -f

echo "🎯 Build optimization complete!"
