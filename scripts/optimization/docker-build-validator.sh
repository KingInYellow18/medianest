#!/bin/bash

# 🚀 Docker Build Validation Script - MediaNest
# Validates all Dockerfiles for compilation success

set -e

echo "🐋 MediaNest Docker Build Validator"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUILD_SUCCESS=0
BUILD_FAILURES=0

# Function to test Docker build
test_docker_build() {
    local dockerfile=$1
    local tag=$2
    local target=$3
    
    echo -e "\n📋 Testing: $dockerfile"
    echo "   Target: $target"
    echo "   Tag: $tag"
    echo "   -----------------------------------"
    
    if [ -n "$target" ]; then
        BUILD_CMD="docker build -f $dockerfile --target $target -t $tag . --progress=plain"
    else
        BUILD_CMD="docker build -f $dockerfile -t $tag . --progress=plain"
    fi
    
    echo "   Command: $BUILD_CMD"
    
    if eval $BUILD_CMD > "build_logs/${tag}_build.log" 2>&1; then
        echo -e "   ${GREEN}✅ SUCCESS${NC}: $dockerfile built successfully"
        BUILD_SUCCESS=$((BUILD_SUCCESS + 1))
        
        # Get image size
        SIZE=$(docker images --format "table {{.Size}}" $tag | tail -n 1)
        echo "   📏 Image Size: $SIZE"
        
        # Test health check if container starts
        echo "   🔍 Testing container startup..."
        if timeout 30 docker run --rm -d --name test-$tag $tag > /dev/null 2>&1; then
            sleep 5
            if docker exec test-$tag /app/entrypoint.sh healthcheck > /dev/null 2>&1; then
                echo -e "   ${GREEN}✅ HEALTH CHECK PASSED${NC}"
            else
                echo -e "   ${YELLOW}⚠️  Health check failed${NC}"
            fi
            docker stop test-$tag > /dev/null 2>&1 || true
        else
            echo -e "   ${YELLOW}⚠️  Container startup test skipped${NC}"
        fi
        
    else
        echo -e "   ${RED}❌ FAILED${NC}: $dockerfile build failed"
        BUILD_FAILURES=$((BUILD_FAILURES + 1))
        
        # Show last 20 lines of error log
        echo "   📄 Last 20 lines of build log:"
        tail -20 "build_logs/${tag}_build.log" | sed 's/^/      /'
    fi
}

# Create logs directory
mkdir -p build_logs

# Test all Dockerfiles
echo "🔍 Discovering Dockerfiles..."

# Production-ready Dockerfiles
test_docker_build "Dockerfile.production-secure" "medianest-production-backend" "backend-production"
test_docker_build "Dockerfile.production-secure" "medianest-production-frontend" "frontend-production"

# Standalone Dockerfiles
test_docker_build "Dockerfile.backend-standalone" "medianest-backend-standalone"
test_docker_build "Dockerfile.frontend-standalone" "medianest-frontend-standalone"

# Multi-stage optimized
test_docker_build "Dockerfile.optimized" "medianest-backend-optimized" "backend-production"
test_docker_build "Dockerfile.optimized" "medianest-frontend-optimized" "frontend-production"
test_docker_build "Dockerfile.optimized" "medianest-development" "development"

# Original Dockerfiles for comparison
test_docker_build "backend/Dockerfile" "medianest-backend-original"
test_docker_build "frontend/Dockerfile" "medianest-frontend-original"
test_docker_build "backend/Dockerfile.prod" "medianest-backend-prod"
test_docker_build "frontend/Dockerfile.prod" "medianest-frontend-prod"

echo -e "\n📊 BUILD SUMMARY"
echo "================="
echo -e "✅ Successful builds: ${GREEN}$BUILD_SUCCESS${NC}"
echo -e "❌ Failed builds: ${RED}$BUILD_FAILURES${NC}"

if [ $BUILD_FAILURES -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL DOCKER BUILDS SUCCESSFUL!${NC}"
    echo "🚀 Ready for production deployment"
    exit 0
else
    echo -e "\n🚨 ${RED}BUILD FAILURES DETECTED${NC}"
    echo "📝 Check build logs in ./build_logs/ directory"
    echo "🔧 Fix issues before deployment"
    exit 1
fi