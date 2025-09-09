#!/bin/bash
# 🚀 Docker Performance Build Script - MediaNest
# Optimized parallel builds with advanced caching and performance monitoring

set -euo pipefail

# ================================================================
# 🎯 Configuration and Constants
# ================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_START_TIME=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Build configuration
REGISTRY="${REGISTRY:-ghcr.io/medianest}"
TAG="${TAG:-latest}"
NODE_VERSION="${NODE_VERSION:-20}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILD_ARGS="${BUILD_ARGS:-}"
PUSH_IMAGES="${PUSH_IMAGES:-false}"
PARALLEL_BUILDS="${PARALLEL_BUILDS:-true}"
CACHE_TYPE="${CACHE_TYPE:-gha}"
PERFORMANCE_MODE="${PERFORMANCE_MODE:-true}"

# ================================================================
# 🛠️ Helper Functions
# ================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")  echo -e "${BLUE}ℹ️  [$timestamp]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}✅ [$timestamp]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}⚠️  [$timestamp]${NC} $message" ;;
        "ERROR") echo -e "${RED}❌ [$timestamp]${NC} $message" ;;
        "DEBUG") echo -e "${PURPLE}🔍 [$timestamp]${NC} $message" ;;
    esac
}

print_banner() {
    echo -e "${CYAN}"
    echo "================================================================"
    echo "🚀 MEDIANEST DOCKER PERFORMANCE BUILD"
    echo "================================================================"
    echo "🎯 Target: Production-optimized containers"
    echo "📦 Registry: $REGISTRY"
    echo "🏷️  Tag: $TAG"
    echo "🖥️  Platforms: $PLATFORMS"
    echo "⚡ Performance Mode: $PERFORMANCE_MODE"
    echo "================================================================"
    echo -e "${NC}"
}

check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Buildx
    if ! docker buildx version &> /dev/null; then
        log "ERROR" "Docker Buildx is not available"
        exit 1
    fi
    
    # Check if buildx instance exists
    if ! docker buildx inspect medianest-builder &> /dev/null; then
        log "INFO" "Creating buildx instance..."
        docker buildx create --name medianest-builder --use --driver docker-container --bootstrap
    else
        docker buildx use medianest-builder
    fi
    
    # Check dockerfile exists
    if [[ ! -f "$PROJECT_ROOT/Dockerfile.performance-optimized-v2" ]]; then
        log "ERROR" "Optimized Dockerfile not found"
        exit 1
    fi
    
    log "SUCCESS" "Prerequisites check completed"
}

analyze_build_context() {
    log "INFO" "Analyzing build context..."
    
    cd "$PROJECT_ROOT"
    
    # Calculate build context size
    local context_size=$(du -sh . 2>/dev/null | cut -f1 || echo "unknown")
    log "INFO" "Build context size: $context_size"
    
    # Show what's being excluded
    log "INFO" "Excluded by .dockerignore:"
    if [[ -f .dockerignore ]]; then
        local excluded_count=$(cat .dockerignore | grep -v '^#' | grep -v '^$' | wc -l)
        log "INFO" "- $excluded_count exclusion patterns"
    fi
    
    # Check for large files that might slow down build
    log "INFO" "Checking for large files..."
    find . -type f -size +50M 2>/dev/null | head -5 | while read -r file; do
        local size=$(du -sh "$file" | cut -f1)
        log "WARN" "Large file found: $file ($size)"
    done || true
}

setup_buildx_config() {
    log "INFO" "Setting up buildx configuration..."
    
    # Configure buildx for performance
    export BUILDX_EXPERIMENTAL=1
    export DOCKER_BUILDKIT=1
    export BUILDKIT_PROGRESS=plain
    
    # Set resource limits for build
    docker buildx inspect medianest-builder --bootstrap
    
    log "SUCCESS" "Buildx configuration completed"
}

pre_build_optimizations() {
    log "INFO" "Running pre-build optimizations..."
    
    cd "$PROJECT_ROOT"
    
    # Clear old build caches if requested
    if [[ "${CLEAR_CACHE:-false}" == "true" ]]; then
        log "INFO" "Clearing build caches..."
        docker buildx prune -f || true
        docker system prune -f || true
    fi
    
    # Create build cache directory
    mkdir -p .build-cache
    
    # Generate build metadata
    cat > .build-cache/metadata.json << EOF
{
  "build_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "build_version": "$TAG",
  "node_version": "$NODE_VERSION",
  "platforms": "$PLATFORMS",
  "registry": "$REGISTRY"
}
EOF
    
    log "SUCCESS" "Pre-build optimizations completed"
}

build_with_bake() {
    log "INFO" "Building with Docker Bake (parallel mode)..."
    
    cd "$PROJECT_ROOT"
    
    # Export environment variables for bake
    export TAG="$TAG"
    export REGISTRY="$REGISTRY"
    export NODE_VERSION="$NODE_VERSION"
    export BUILD_PLATFORMS="$(echo $PLATFORMS | tr ',' ' ')"
    
    # Build arguments
    local bake_args=""
    if [[ "$PUSH_IMAGES" == "true" ]]; then
        bake_args="--push"
    else
        bake_args="--load"
    fi
    
    # Add performance flags
    if [[ "$PERFORMANCE_MODE" == "true" ]]; then
        export DOCKER_BUILDKIT_INLINE_CACHE=1
        bake_args="$bake_args --progress=plain"
    fi
    
    # Execute bake build
    local build_start=$(date +%s)
    
    if [[ -f "docker-bake.hcl" ]]; then
        log "INFO" "Using docker-bake.hcl configuration"
        docker buildx bake $bake_args production
    else
        log "WARN" "docker-bake.hcl not found, falling back to individual builds"
        build_individual_targets
    fi
    
    local build_end=$(date +%s)
    local build_duration=$((build_end - build_start))
    log "SUCCESS" "Bake build completed in ${build_duration}s"
}

build_individual_targets() {
    log "INFO" "Building individual targets..."
    
    cd "$PROJECT_ROOT"
    
    local targets=("backend-production" "frontend-production")
    local pids=()
    
    for target in "${targets[@]}"; do
        if [[ "$PARALLEL_BUILDS" == "true" ]]; then
            build_target "$target" &
            pids+=($!)
        else
            build_target "$target"
        fi
    done
    
    # Wait for parallel builds to complete
    if [[ "$PARALLEL_BUILDS" == "true" ]]; then
        log "INFO" "Waiting for parallel builds to complete..."
        for pid in "${pids[@]}"; do
            wait "$pid"
        done
    fi
}

build_target() {
    local target=$1
    local service=$(echo "$target" | sed 's/-production//')
    
    log "INFO" "Building target: $target"
    local target_start=$(date +%s)
    
    # Build command
    local build_cmd="docker buildx build"
    build_cmd="$build_cmd --file Dockerfile.performance-optimized-v2"
    build_cmd="$build_cmd --target $target"
    build_cmd="$build_cmd --platform $PLATFORMS"
    build_cmd="$build_cmd --tag $REGISTRY/$service:$TAG"
    
    # Add caching
    if [[ "$CACHE_TYPE" == "gha" ]]; then
        build_cmd="$build_cmd --cache-from type=gha,scope=$service"
        build_cmd="$build_cmd --cache-to type=gha,mode=max,scope=$service"
    elif [[ "$CACHE_TYPE" == "registry" ]]; then
        build_cmd="$build_cmd --cache-from type=registry,ref=$REGISTRY/cache:$service"
        build_cmd="$build_cmd --cache-to type=registry,ref=$REGISTRY/cache:$service,mode=max"
    fi
    
    # Build arguments
    build_cmd="$build_cmd --build-arg NODE_VERSION=$NODE_VERSION"
    build_cmd="$build_cmd --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    build_cmd="$build_cmd --build-arg VCS_REF=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
    build_cmd="$build_cmd --build-arg VERSION=$TAG"
    
    if [[ -n "$BUILD_ARGS" ]]; then
        build_cmd="$build_cmd $BUILD_ARGS"
    fi
    
    # Push or load
    if [[ "$PUSH_IMAGES" == "true" ]]; then
        build_cmd="$build_cmd --push"
    else
        build_cmd="$build_cmd --load"
    fi
    
    # Add build context
    build_cmd="$build_cmd ."
    
    # Execute build
    eval "$build_cmd"
    
    local target_end=$(date +%s)
    local target_duration=$((target_end - target_start))
    log "SUCCESS" "Target $target completed in ${target_duration}s"
}

analyze_build_results() {
    log "INFO" "Analyzing build results..."
    
    # Image sizes
    if [[ "$PUSH_IMAGES" != "true" ]]; then
        log "INFO" "Image size analysis:"
        docker images "$REGISTRY/*:$TAG" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" || true
    fi
    
    # Build cache analysis
    log "INFO" "Build cache analysis:"
    docker buildx du || true
    
    # Save build metrics
    local total_duration=$(($(date +%s) - BUILD_START_TIME))
    
    cat > .build-cache/build-metrics.json << EOF
{
  "total_build_time": "${total_duration}s",
  "build_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "parallel_builds": $PARALLEL_BUILDS,
  "performance_mode": $PERFORMANCE_MODE,
  "platforms": "$PLATFORMS",
  "cache_type": "$CACHE_TYPE",
  "images_pushed": $PUSH_IMAGES
}
EOF
    
    log "SUCCESS" "Build analysis completed"
}

cleanup() {
    log "INFO" "Running cleanup..."
    
    # Clean up build cache if requested
    if [[ "${CLEANUP_AFTER_BUILD:-false}" == "true" ]]; then
        docker buildx prune -f || true
    fi
    
    # Remove temporary files
    rm -f /tmp/build-*.tmp || true
    
    log "SUCCESS" "Cleanup completed"
}

show_summary() {
    local total_duration=$(($(date +%s) - BUILD_START_TIME))
    local minutes=$((total_duration / 60))
    local seconds=$((total_duration % 60))
    
    echo -e "${GREEN}"
    echo "================================================================"
    echo "🎉 BUILD COMPLETED SUCCESSFULLY"
    echo "================================================================"
    echo "⏱️  Total time: ${minutes}m ${seconds}s"
    echo "🏷️  Images tagged: $REGISTRY/*:$TAG"
    echo "🚀 Ready for deployment!"
    echo "================================================================"
    echo -e "${NC}"
    
    if [[ -f ".build-cache/build-metrics.json" ]]; then
        log "INFO" "Build metrics saved to .build-cache/build-metrics.json"
    fi
}

# ================================================================
# 🚀 Main Execution Flow
# ================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --tag)
                TAG="$2"
                shift 2
                ;;
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --platforms)
                PLATFORMS="$2"
                shift 2
                ;;
            --push)
                PUSH_IMAGES="true"
                shift
                ;;
            --no-parallel)
                PARALLEL_BUILDS="false"
                shift
                ;;
            --clear-cache)
                CLEAR_CACHE="true"
                shift
                ;;
            --cleanup)
                CLEANUP_AFTER_BUILD="true"
                shift
                ;;
            --cache-type)
                CACHE_TYPE="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Execute build pipeline
    print_banner
    check_prerequisites
    analyze_build_context
    setup_buildx_config
    pre_build_optimizations
    
    if [[ -f "docker-bake.hcl" && "$PARALLEL_BUILDS" == "true" ]]; then
        build_with_bake
    else
        build_individual_targets
    fi
    
    analyze_build_results
    cleanup
    show_summary
}

show_help() {
    echo "🚀 Docker Performance Build Script - MediaNest"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --tag TAG                 Docker image tag (default: latest)"
    echo "  --registry REGISTRY       Container registry (default: ghcr.io/medianest)"
    echo "  --platforms PLATFORMS     Target platforms (default: linux/amd64,linux/arm64)"
    echo "  --push                    Push images to registry"
    echo "  --no-parallel             Disable parallel builds"
    echo "  --clear-cache             Clear build cache before building"
    echo "  --cleanup                 Clean up after build"
    echo "  --cache-type TYPE         Cache type: gha, registry, local (default: gha)"
    echo "  --help                    Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 --tag v1.0.0 --push"
    echo "  $0 --registry my-registry.com --platforms linux/amd64"
    echo "  $0 --clear-cache --cleanup"
}

# Error handling
trap 'log "ERROR" "Build failed at line $LINENO"' ERR

# Execute main function
main "$@"