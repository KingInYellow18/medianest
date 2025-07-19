#!/bin/bash
# MediaNest Production Build Script
# Builds and tags all Docker images for production deployment

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION=${VERSION:-latest}
REGISTRY=${REGISTRY:-}
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# Function to build and tag an image
build_image() {
    local service=$1
    local context=$2
    local dockerfile=$3
    local image_name="medianest/${service}"
    
    if [[ -n "$REGISTRY" ]]; then
        image_name="${REGISTRY}/${image_name}"
    fi
    
    print_status "Building ${service} image..."
    
    docker build \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VCS_REF="${VCS_REF}" \
        --build-arg VERSION="${VERSION}" \
        --file "${dockerfile}" \
        --tag "${image_name}:${VERSION}" \
        --tag "${image_name}:latest" \
        --cache-from "${image_name}:latest" \
        "${context}"
    
    if [[ $? -eq 0 ]]; then
        print_success "Successfully built ${service} image"
        echo "  - ${image_name}:${VERSION}"
        echo "  - ${image_name}:latest"
    else
        print_error "Failed to build ${service} image"
        exit 1
    fi
}

# Main script
print_status "Starting MediaNest production build"
print_status "Version: ${VERSION}"
print_status "Build Date: ${BUILD_DATE}"
print_status "Git Ref: ${VCS_REF}"

if [[ -n "$REGISTRY" ]]; then
    print_status "Registry: ${REGISTRY}"
fi

# Check if we're in the project root
if [[ ! -f "package.json" ]] || [[ ! -d "frontend" ]] || [[ ! -d "backend" ]]; then
    print_error "This script must be run from the MediaNest project root"
    exit 1
fi

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running or not accessible"
    exit 1
fi

# Build frontend image
build_image "frontend" "./frontend" "./frontend/Dockerfile.prod"

# Build backend image
build_image "backend" "./backend" "./backend/Dockerfile.prod"

# Build nginx image
build_image "nginx" "./infrastructure/nginx" "./infrastructure/nginx/Dockerfile"

print_status "Build complete!"
print_status "To push images to registry, run:"
echo "  docker push medianest/frontend:${VERSION}"
echo "  docker push medianest/backend:${VERSION}"
echo "  docker push medianest/nginx:${VERSION}"

print_status "To deploy, run:"
echo "  docker compose -f docker-compose.prod.yml up -d"