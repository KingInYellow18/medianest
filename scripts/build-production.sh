#!/bin/bash
# MediaNest Production Build Script
# Automated build with image tagging, vulnerability scanning, and size reporting

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION=${VERSION:-latest}
REGISTRY=${REGISTRY:-medianest}
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
SCAN_VULNERABILITIES=${SCAN_VULNERABILITIES:-true}
PUSH_IMAGES=${PUSH_IMAGES:-false}

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

# Function to format bytes to human readable
format_bytes() {
    local bytes=$1
    local mb=$((bytes / 1048576))
    echo "${mb}MB"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to build and tag an image with size reporting
build_image() {
    local service=$1
    local context=$2
    local dockerfile=$3
    local target_size=$4
    local image_name="${REGISTRY}/${service}"
    
    print_status "Building ${service} image..."
    
    # Build with no cache for accurate size
    if docker build \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VCS_REF="${VCS_REF}" \
        --build-arg VERSION="${VERSION}" \
        --file "${dockerfile}" \
        --tag "${image_name}:${VERSION}" \
        --tag "${image_name}:${VCS_REF}" \
        --tag "${image_name}:latest" \
        --no-cache \
        "${context}"; then
        
        print_success "Successfully built ${service} image"
        
        # Get image size
        local size=$(docker inspect -f "{{ .Size }}" "${image_name}:${VERSION}")
        local human_size=$(format_bytes $size)
        local size_mb=$((size / 1048576))
        
        # Report size and check against target
        if [[ $size_mb -lt $target_size ]]; then
            print_success "${service} image size: ${human_size} (target: <${target_size}MB) ✓"
        else
            print_warning "${service} image size: ${human_size} exceeds target of ${target_size}MB"
        fi
        
        # Add to build report
        echo "${service}:${VERSION} - ${human_size}" >> build-report.txt
        
        return 0
    else
        print_error "Failed to build ${service} image"
        return 1
    fi
}

# Function to scan image for vulnerabilities
scan_image() {
    local image=$1
    
    if [[ "$SCAN_VULNERABILITIES" != "true" ]]; then
        return 0
    fi
    
    if command_exists trivy; then
        print_status "Scanning ${image} for vulnerabilities..."
        
        # Run Trivy scan with severity filtering
        if trivy image \
            --severity CRITICAL,HIGH \
            --format table \
            --exit-code 0 \
            "${image}" > "scan-${image//\//-}.txt"; then
            
            # Check if any vulnerabilities were found
            if grep -q "Total:" "scan-${image//\//-}.txt"; then
                print_warning "Vulnerabilities found in ${image} (see scan-${image//\//-}.txt)"
            else
                print_success "No critical/high vulnerabilities found in ${image}"
            fi
        fi
    else
        print_warning "Trivy not installed. Skipping vulnerability scan."
        print_warning "Install with: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
    fi
}

# Main script
print_status "Starting MediaNest production build"
print_status "Version: ${VERSION}"
print_status "Git SHA: ${VCS_REF}"
print_status "Build Date: ${BUILD_DATE}"
print_status "Registry: ${REGISTRY}"

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

# Initialize build report
echo "MediaNest Production Build Report" > build-report.txt
echo "=================================" >> build-report.txt
echo "Build Date: ${BUILD_DATE}" >> build-report.txt
echo "Git SHA: ${VCS_REF}" >> build-report.txt
echo "Version: ${VERSION}" >> build-report.txt
echo "" >> build-report.txt
echo "Image Sizes:" >> build-report.txt
echo "------------" >> build-report.txt

# Track build status
build_failed=0

# Build frontend image (target: <200MB)
if ! build_image "frontend" "./frontend" "./frontend/Dockerfile.prod" 200; then
    build_failed=1
fi

# Build backend image (target: <300MB)
if ! build_image "backend" "./backend" "./backend/Dockerfile.prod" 300; then
    build_failed=1
fi

# Build nginx image if it exists
if [[ -f "./infrastructure/nginx/Dockerfile" ]]; then
    if ! build_image "nginx" "./infrastructure/nginx" "./infrastructure/nginx/Dockerfile" 100; then
        build_failed=1
    fi
fi

# Check if any builds failed
if [[ $build_failed -eq 1 ]]; then
    print_error "One or more builds failed"
    exit 1
fi

print_success "All images built successfully!"

# Vulnerability scanning
if [[ "$SCAN_VULNERABILITIES" == "true" ]]; then
    print_status "Running vulnerability scans..."
    scan_image "${REGISTRY}/frontend:${VERSION}"
    scan_image "${REGISTRY}/backend:${VERSION}"
    
    if [[ -f "./infrastructure/nginx/Dockerfile" ]]; then
        scan_image "${REGISTRY}/nginx:${VERSION}"
    fi
fi

# Add vulnerability scan summary to report
if [[ "$SCAN_VULNERABILITIES" == "true" ]] && command_exists trivy; then
    echo "" >> build-report.txt
    echo "Vulnerability Scan Summary:" >> build-report.txt
    echo "--------------------------" >> build-report.txt
    for scan_file in scan-*.txt; do
        if [[ -f "$scan_file" ]]; then
            echo "See ${scan_file} for details" >> build-report.txt
        fi
    done
fi

# Test docker-compose configuration
print_status "Validating docker-compose.prod.yml..."
if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    print_success "docker-compose.prod.yml is valid"
else
    print_error "docker-compose.prod.yml validation failed"
    exit 1
fi

# Final report
echo "" >> build-report.txt
echo "Build Status: SUCCESS" >> build-report.txt

print_success "Build complete! See build-report.txt for details"

# Show next steps
echo ""
print_status "Tagged images:"
docker images | grep "${REGISTRY}" | grep -E "(${VERSION}|${VCS_REF}|latest)"

echo ""
print_status "Next steps:"
echo "  1. Review vulnerability scan results (if any)"
echo "  2. Test images locally: docker compose -f docker-compose.prod.yml up"
echo "  3. Push to registry: PUSH_IMAGES=true $0"

# Push images if requested
if [[ "$PUSH_IMAGES" == "true" ]]; then
    print_status "Pushing images to registry..."
    
    for service in frontend backend nginx; do
        if docker image inspect "${REGISTRY}/${service}:${VERSION}" > /dev/null 2>&1; then
            print_status "Pushing ${service} images..."
            docker push "${REGISTRY}/${service}:${VERSION}"
            docker push "${REGISTRY}/${service}:${VCS_REF}"
            docker push "${REGISTRY}/${service}:latest"
            print_success "Pushed ${service} images"
        fi
    done
fi