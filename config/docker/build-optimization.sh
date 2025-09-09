#!/bin/bash
# =============================================================================
# MediaNest Docker Build Optimization System
# =============================================================================
# 
# FEATURES:
# - Intelligent layer caching with BuildKit
# - Parallel multi-stage builds
# - Build context optimization
# - Cache management and cleanup
# - Performance monitoring and reporting
# 
# USAGE:
#   ./build-optimization.sh --target production --optimize size --parallel
#   ./build-optimization.sh --development --cache-strategy registry
#   ./build-optimization.sh --clean-cache --report
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUILD_LOG="${PROJECT_ROOT}/logs/docker-build.log"

# Default configuration
DEFAULT_TARGET="backend-production"
DEFAULT_OPTIMIZATION="balanced"  # size, speed, balanced
DEFAULT_CACHE_STRATEGY="local"   # local, registry, inline
DEFAULT_PARALLELISM=4

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Build metrics
BUILD_START_TIME=""
BUILD_END_TIME=""
TOTAL_BUILD_TIME=""
CACHE_HIT_RATIO=""

# =============================================================================
# LOGGING AND UTILITIES
# =============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $*${NC}" | tee -a "$BUILD_LOG"
}

warn() {
    echo -e "${YELLOW}[WARNING] $*${NC}" | tee -a "$BUILD_LOG"
}

error() {
    echo -e "${RED}[ERROR] $*${NC}" | tee -a "$BUILD_LOG"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $*${NC}" | tee -a "$BUILD_LOG"
}

debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${PURPLE}[DEBUG] $*${NC}" | tee -a "$BUILD_LOG"
    fi
}

progress() {
    echo -e "${CYAN}[PROGRESS] $*${NC}" | tee -a "$BUILD_LOG"
}

# =============================================================================
# BUILD OPTIMIZATION FUNCTIONS
# =============================================================================

setup_buildkit() {
    log "Setting up Docker BuildKit..."
    
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # Enable BuildKit experimental features
    export BUILDKIT_PROGRESS=plain
    export BUILDKIT_COLORS=1
    
    # Configure BuildKit for optimal performance
    docker buildx create --name medianest-builder \
        --driver docker-container \
        --driver-opt network=host \
        --use 2>/dev/null || docker buildx use medianest-builder
    
    debug "BuildKit configured with driver: $(docker buildx inspect --bootstrap)"
}

optimize_build_context() {
    local optimization_level="$1"
    
    progress "Optimizing build context for: $optimization_level"
    
    # Copy optimized .dockerignore based on build target
    case "$optimization_level" in
        size)
            cp "${SCRIPT_DIR}/.dockerignore.consolidated" "${PROJECT_ROOT}/.dockerignore"
            # Add additional size-focused exclusions
            cat >> "${PROJECT_ROOT}/.dockerignore" << 'EOF'

# Size optimization exclusions
**/*.map
**/*.d.ts.map
**/README.md
**/CHANGELOG.md
test-fixtures/
sample-data/
EOF
            ;;
        speed)
            # Speed-optimized .dockerignore (smaller exclusion list for faster context)
            cat > "${PROJECT_ROOT}/.dockerignore" << 'EOF'
# Speed-optimized exclusions (minimal list)
.git/
node_modules/
.env*
!.env.example
**/*.log
tmp/
temp/
coverage/
dist/
build/
.next/
EOF
            ;;
        balanced|*)
            cp "${SCRIPT_DIR}/.dockerignore.consolidated" "${PROJECT_ROOT}/.dockerignore"
            ;;
    esac
    
    # Calculate build context size
    local context_size=$(du -sh "$PROJECT_ROOT" 2>/dev/null | cut -f1 || echo "unknown")
    info "Build context size: $context_size"
}

setup_cache_strategy() {
    local strategy="$1"
    local target="$2"
    
    progress "Setting up cache strategy: $strategy"
    
    case "$strategy" in
        registry)
            CACHE_FROM="--cache-from type=registry,ref=medianest/${target}:cache"
            CACHE_TO="--cache-to type=registry,ref=medianest/${target}:cache,mode=max"
            ;;
        local)
            CACHE_FROM="--cache-from type=local,src=/tmp/.buildx-cache-${target}"
            CACHE_TO="--cache-to type=local,dest=/tmp/.buildx-cache-${target},mode=max"
            ;;
        inline)
            CACHE_FROM="--cache-from medianest/${target}:cache"
            CACHE_TO="--cache-to type=inline"
            ;;
        gha)
            # GitHub Actions cache
            CACHE_FROM="--cache-from type=gha"
            CACHE_TO="--cache-to type=gha,mode=max"
            ;;
        *)
            warn "Unknown cache strategy: $strategy, using local"
            CACHE_FROM="--cache-from type=local,src=/tmp/.buildx-cache-${target}"
            CACHE_TO="--cache-to type=local,dest=/tmp/.buildx-cache-${target},mode=max"
            ;;
    esac
    
    debug "Cache configuration: FROM=$CACHE_FROM TO=$CACHE_TO"
}

build_with_optimization() {
    local target="$1"
    local optimization="$2"
    local cache_strategy="$3"
    local parallel="${4:-true}"
    
    BUILD_START_TIME=$(date +%s)
    progress "Starting optimized build for target: $target"
    
    # Setup build environment
    setup_buildkit
    optimize_build_context "$optimization"
    setup_cache_strategy "$cache_strategy" "$target"
    
    # Build arguments based on optimization level
    local build_args=""
    case "$optimization" in
        size)
            build_args="--build-arg OPTIMIZATION_LEVEL=size --build-arg SECURITY_LEVEL=hardened"
            ;;
        speed)
            build_args="--build-arg OPTIMIZATION_LEVEL=speed --build-arg BUILD_PARALLELISM=$DEFAULT_PARALLELISM"
            ;;
        balanced|*)
            build_args="--build-arg OPTIMIZATION_LEVEL=balanced"
            ;;
    esac
    
    # Security-focused build arguments
    if [[ "$target" == *"production"* ]]; then
        build_args="$build_args --build-arg SECURITY_LEVEL=hardened --build-arg ENABLE_SECURITY_HARDENING=true"
    fi
    
    # Execute build with comprehensive optimization
    local build_cmd="docker buildx build \
        --file ${SCRIPT_DIR}/Dockerfile.consolidated \
        --target $target \
        --tag medianest/${target}:latest \
        --tag medianest/${target}:$(git rev-parse --short HEAD 2>/dev/null || echo 'dev') \
        $CACHE_FROM \
        $CACHE_TO \
        $build_args \
        --metadata-file ${PROJECT_ROOT}/logs/build-metadata-${target}.json \
        --progress plain \
        --load"
    
    if [[ "$parallel" == "true" ]]; then
        build_cmd="$build_cmd --build-arg BUILD_PARALLELISM=$DEFAULT_PARALLELISM"
    fi
    
    # Add build context
    build_cmd="$build_cmd $PROJECT_ROOT"
    
    log "Executing build command:"
    debug "$build_cmd"
    
    # Execute build with error handling
    if eval "$build_cmd" 2>&1 | tee -a "$BUILD_LOG"; then
        BUILD_END_TIME=$(date +%s)
        TOTAL_BUILD_TIME=$((BUILD_END_TIME - BUILD_START_TIME))
        log "Build completed successfully in ${TOTAL_BUILD_TIME}s"
        
        # Generate build report
        generate_build_report "$target"
        
        return 0
    else
        error "Build failed for target: $target"
        return 1
    fi
}

build_multi_target() {
    local targets=("$@")
    local optimization="${OPTIMIZATION:-balanced}"
    local cache_strategy="${CACHE_STRATEGY:-local}"
    
    progress "Building multiple targets: ${targets[*]}"
    
    # Build shared dependencies first for cache optimization
    local base_targets=("base" "build-deps" "shared-builder")
    
    for base_target in "${base_targets[@]}"; do
        if build_with_optimization "$base_target" "$optimization" "$cache_strategy" true; then
            info "Base target $base_target built successfully"
        else
            warn "Base target $base_target failed, continuing..."
        fi
    done
    
    # Build final targets in parallel if possible
    local pids=()
    for target in "${targets[@]}"; do
        if [[ "$PARALLEL_BUILDS" == "true" ]]; then
            build_with_optimization "$target" "$optimization" "$cache_strategy" true &
            pids+=($!)
        else
            build_with_optimization "$target" "$optimization" "$cache_strategy" true
        fi
    done
    
    # Wait for parallel builds to complete
    if [[ ${#pids[@]} -gt 0 ]]; then
        log "Waiting for ${#pids[@]} parallel builds to complete..."
        for pid in "${pids[@]}"; do
            if wait "$pid"; then
                info "Parallel build $pid completed successfully"
            else
                warn "Parallel build $pid failed"
            fi
        done
    fi
}

# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

clean_build_cache() {
    local cache_type="${1:-all}"
    
    log "Cleaning build cache: $cache_type"
    
    case "$cache_type" in
        local)
            rm -rf /tmp/.buildx-cache-* 2>/dev/null || true
            ;;
        docker)
            docker builder prune -f --filter type=exec.cachemount
            docker builder prune -f --filter type=source.local
            ;;
        registry)
            # Clean registry cache images
            docker images --filter "reference=medianest/*:cache" -q | xargs -r docker rmi -f
            ;;
        all|*)
            clean_build_cache local
            clean_build_cache docker
            clean_build_cache registry
            
            # Additional cleanup
            docker system prune -f --filter label=com.medianest.build
            ;;
    esac
    
    log "Cache cleanup completed"
}

analyze_cache_efficiency() {
    local build_log="$BUILD_LOG"
    
    if [[ ! -f "$build_log" ]]; then
        warn "Build log not found, cannot analyze cache efficiency"
        return 1
    fi
    
    progress "Analyzing cache efficiency..."
    
    # Extract cache statistics from build log
    local cached_layers=$(grep -c "CACHED" "$build_log" 2>/dev/null || echo "0")
    local total_layers=$(grep -c "=>" "$build_log" 2>/dev/null || echo "1")
    
    if [[ $total_layers -gt 0 ]]; then
        CACHE_HIT_RATIO=$((cached_layers * 100 / total_layers))
        info "Cache hit ratio: ${CACHE_HIT_RATIO}% (${cached_layers}/${total_layers} layers)"
    else
        warn "Unable to calculate cache hit ratio"
    fi
    
    # Analyze build time by stage
    grep -E "STAGE|=>" "$build_log" | while read -r line; do
        debug "$line"
    done
}

# =============================================================================
# REPORTING AND MONITORING
# =============================================================================

generate_build_report() {
    local target="$1"
    local report_file="${PROJECT_ROOT}/logs/build-report-${target}-$(date +%Y%m%d-%H%M%S).json"
    
    progress "Generating build report for: $target"
    
    # Collect build metrics
    local image_size=""
    local layer_count=""
    
    if docker image inspect "medianest/${target}:latest" >/dev/null 2>&1; then
        image_size=$(docker image inspect "medianest/${target}:latest" --format '{{.Size}}' | numfmt --to=iec)
        layer_count=$(docker image inspect "medianest/${target}:latest" --format '{{len .RootFS.Layers}}')
    fi
    
    # Generate comprehensive report
    cat > "$report_file" << EOF
{
  "build": {
    "target": "$target",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": ${TOTAL_BUILD_TIME:-0},
    "optimization_level": "${OPTIMIZATION:-balanced}",
    "cache_strategy": "${CACHE_STRATEGY:-local}",
    "cache_hit_ratio_percent": ${CACHE_HIT_RATIO:-0}
  },
  "image": {
    "size": "$image_size",
    "layers": ${layer_count:-0},
    "tags": [
      "medianest/${target}:latest"
    ]
  },
  "context": {
    "build_args": "$build_args",
    "dockerfile": "config/docker/Dockerfile.consolidated"
  },
  "performance": {
    "build_time_seconds": ${TOTAL_BUILD_TIME:-0},
    "cache_efficiency_percent": ${CACHE_HIT_RATIO:-0}
  }
}
EOF
    
    log "Build report generated: $report_file"
    
    # Print summary
    cat << EOF

${GREEN}=============================================================================
BUILD SUMMARY
=============================================================================${NC}
Target:           $target
Duration:         ${TOTAL_BUILD_TIME:-0}s
Image Size:       $image_size
Layers:           $layer_count
Cache Hit Ratio:  ${CACHE_HIT_RATIO:-0}%
Report:           $report_file
${GREEN}=============================================================================${NC}

EOF
}

monitor_build_performance() {
    local target="$1"
    
    progress "Monitoring build performance for: $target"
    
    # Start resource monitoring in background
    (
        while docker buildx ls | grep -q "medianest-builder"; do
            echo "$(date +%H:%M:%S) - Build in progress..."
            docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -n 5
            sleep 10
        done
    ) &
    
    local monitor_pid=$!
    
    # Store PID for cleanup
    echo $monitor_pid > "${PROJECT_ROOT}/logs/build-monitor.pid"
    
    debug "Build monitoring started with PID: $monitor_pid"
}

# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================

show_help() {
    cat << EOF
${GREEN}MediaNest Docker Build Optimization System${NC}

${YELLOW}USAGE:${NC}
  $0 [OPTIONS] [TARGETS...]

${YELLOW}OPTIONS:${NC}
  -t, --target TARGET           Build target (default: $DEFAULT_TARGET)
  -o, --optimize LEVEL          Optimization level: size|speed|balanced (default: $DEFAULT_OPTIMIZATION)
  -c, --cache STRATEGY          Cache strategy: local|registry|inline|gha (default: $DEFAULT_CACHE_STRATEGY)
  -p, --parallel                Enable parallel builds
  -d, --development             Build development target
  -P, --production              Build production targets
  -T, --test                    Build test target
  -M, --monitoring              Build monitoring stack
      --clean-cache [TYPE]      Clean build cache (local|docker|registry|all)
      --report                  Generate build report only
      --analyze-cache           Analyze cache efficiency
  -v, --verbose                 Enable debug output
  -h, --help                    Show this help

${YELLOW}EXAMPLES:${NC}
  $0 --target backend-production --optimize size --cache registry
  $0 --development --parallel
  $0 --production --cache gha
  $0 --clean-cache all
  $0 backend-production frontend-production --parallel

${YELLOW}TARGETS:${NC}
  base                   Base Alpine foundation
  backend-production     Production backend service
  frontend-production    Production frontend service
  nginx-proxy            Reverse proxy with security
  development            Development environment
  test-runner            Testing environment
  monitoring             Observability stack

${YELLOW}CACHE STRATEGIES:${NC}
  local      Local filesystem cache (default)
  registry   Docker registry cache
  inline     Inline cache in image
  gha        GitHub Actions cache

EOF
}

parse_arguments() {
    local targets=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--target)
                TARGET="$2"
                shift 2
                ;;
            -o|--optimize)
                OPTIMIZATION="$2"
                shift 2
                ;;
            -c|--cache)
                CACHE_STRATEGY="$2"
                shift 2
                ;;
            -p|--parallel)
                PARALLEL_BUILDS="true"
                shift
                ;;
            -d|--development)
                TARGET="development"
                shift
                ;;
            -P|--production)
                targets=("backend-production" "frontend-production" "nginx-proxy")
                PARALLEL_BUILDS="true"
                shift
                ;;
            -T|--test)
                TARGET="test-runner"
                shift
                ;;
            -M|--monitoring)
                TARGET="monitoring"
                shift
                ;;
            --clean-cache)
                CLEAN_CACHE="${2:-all}"
                shift 2
                ;;
            --report)
                REPORT_ONLY="true"
                shift
                ;;
            --analyze-cache)
                ANALYZE_CACHE="true"
                shift
                ;;
            -v|--verbose)
                DEBUG="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                ;;
            *)
                targets+=("$1")
                shift
                ;;
        esac
    done
    
    # Use provided targets or default
    if [[ ${#targets[@]} -gt 0 ]]; then
        TARGETS=("${targets[@]}")
    elif [[ -n "${TARGET:-}" ]]; then
        TARGETS=("$TARGET")
    else
        TARGETS=("$DEFAULT_TARGET")
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"
    
    # Initialize variables
    local TARGETS=()
    local TARGET=""
    local OPTIMIZATION="${DEFAULT_OPTIMIZATION}"
    local CACHE_STRATEGY="${DEFAULT_CACHE_STRATEGY}"
    local PARALLEL_BUILDS="false"
    local CLEAN_CACHE=""
    local REPORT_ONLY="false"
    local ANALYZE_CACHE="false"
    local DEBUG="false"
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Set global variables
    export OPTIMIZATION
    export CACHE_STRATEGY
    export PARALLEL_BUILDS
    export DEBUG
    
    log "MediaNest Docker Build Optimization System"
    log "Targets: ${TARGETS[*]}"
    log "Optimization: $OPTIMIZATION"
    log "Cache Strategy: $CACHE_STRATEGY"
    log "Parallel Builds: $PARALLEL_BUILDS"
    
    # Handle special operations
    if [[ -n "$CLEAN_CACHE" ]]; then
        clean_build_cache "$CLEAN_CACHE"
        exit 0
    fi
    
    if [[ "$ANALYZE_CACHE" == "true" ]]; then
        analyze_cache_efficiency
        exit 0
    fi
    
    if [[ "$REPORT_ONLY" == "true" ]]; then
        if [[ ${#TARGETS[@]} -eq 1 ]]; then
            generate_build_report "${TARGETS[0]}"
        else
            warn "Report generation requires a single target"
        fi
        exit 0
    fi
    
    # Execute builds
    if [[ ${#TARGETS[@]} -eq 1 ]]; then
        build_with_optimization "${TARGETS[0]}" "$OPTIMIZATION" "$CACHE_STRATEGY" "$PARALLEL_BUILDS"
    else
        build_multi_target "${TARGETS[@]}"
    fi
    
    # Final analysis
    analyze_cache_efficiency
    
    log "Build optimization completed successfully"
}

# Execute main function with all arguments
main "$@"