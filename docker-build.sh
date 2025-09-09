#!/bin/bash
# ==============================================================================
# 🐳 MEDIANEST CONSOLIDATED DOCKER BUILD SCRIPT
# ==============================================================================
# Advanced build script with BuildKit optimizations, multi-architecture support,
# security scanning, and comprehensive build target management
# ==============================================================================

set -euo pipefail

# ==============================================================================
# 🔧 CONFIGURATION
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_LOG_DIR="${SCRIPT_DIR}/build-logs"
SECURITY_REPORTS_DIR="${SCRIPT_DIR}/security-reports"
CACHE_DIR="${SCRIPT_DIR}/.build-cache"

# Build Configuration
DEFAULT_BUILD_TARGET="backend-production"
DEFAULT_TAG_PREFIX="medianest"
DEFAULT_PLATFORMS="linux/amd64,linux/arm64"
BUILDKIT_VERSION="latest"

# Security Configuration
ENABLE_SECURITY_SCAN=${ENABLE_SECURITY_SCAN:-false}
SECURITY_LEVEL=${SECURITY_LEVEL:-standard}
TRIVY_CACHE_DIR="${CACHE_DIR}/trivy"

# Performance Configuration
BUILDKIT_INLINE_CACHE=${BUILDKIT_INLINE_CACHE:-1}
DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1}
COMPOSE_DOCKER_CLI_BUILD=${COMPOSE_DOCKER_CLI_BUILD:-1}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================================================================
# 🎯 AVAILABLE BUILD TARGETS
# ==============================================================================
declare -A BUILD_TARGETS=(
    ["development"]="Development environment with hot reload"
    ["backend-production"]="Optimized backend runtime"
    ["frontend-production"]="Optimized Next.js runtime"
    ["nginx-production"]="Reverse proxy and static serving"
    ["security-hardened"]="Maximum security configuration"
    ["test-runner"]="Comprehensive testing environment"
    ["migration-runner"]="Database operations"
    ["security-scanner"]="Container vulnerability scanning"
    ["build-tools"]="Development and CI/CD utilities"
    ["docs-builder"]="Documentation build environment"
)

# ==============================================================================
# 🛠️ UTILITY FUNCTIONS
# ==============================================================================
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

setup_directories() {
    log "Setting up build directories..."
    mkdir -p "${BUILD_LOG_DIR}" "${SECURITY_REPORTS_DIR}" "${CACHE_DIR}" "${TRIVY_CACHE_DIR}"
}

check_dependencies() {
    log "Checking dependencies..."
    
    # Check Docker version
    if ! command -v docker &> /dev/null; then
        log_error "Docker is required but not installed"
        exit 1
    fi
    
    local docker_version
    docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    log_info "Docker version: ${docker_version}"
    
    # Check if BuildKit is available
    if ! docker buildx version &> /dev/null; then
        log_warn "Docker Buildx not available, using legacy build"
    else
        log_info "Docker Buildx available"
    fi
    
    # Check if compose is available
    if ! docker compose version &> /dev/null; then
        log_warn "Docker Compose V2 not available"
    fi
}

configure_buildkit() {
    log "Configuring BuildKit..."
    
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    export BUILDKIT_PROGRESS=plain
    
    # Create buildx builder if not exists
    if docker buildx ls | grep -q "medianest-builder"; then
        log_info "Using existing buildx builder: medianest-builder"
    else
        log "Creating new buildx builder..."
        docker buildx create \
            --name medianest-builder \
            --driver docker-container \
            --bootstrap \
            --use
    fi
}

generate_build_args() {
    local target="$1"
    local args=""
    
    # Base arguments
    args+="--build-arg NODE_ENV=${NODE_ENV:-production} "
    args+="--build-arg BUILD_TARGET=${target} "
    args+="--build-arg SECURITY_LEVEL=${SECURITY_LEVEL} "
    args+="--build-arg OPTIMIZATION_LEVEL=${OPTIMIZATION_LEVEL:-size} "
    args+="--build-arg USER_ID=${USER_ID:-1001} "
    args+="--build-arg GROUP_ID=${GROUP_ID:-1001} "
    
    # Conditional arguments
    if [[ "${ENABLE_DEBUG:-false}" == "true" ]]; then
        args+="--build-arg ENABLE_DEBUG=true "
    fi
    
    if [[ "${ENABLE_MONITORING:-false}" == "true" ]]; then
        args+="--build-arg ENABLE_MONITORING=true "
    fi
    
    if [[ "${ENABLE_SECURITY_SCANNING}" == "true" ]]; then
        args+="--build-arg ENABLE_SECURITY_SCANNING=true "
    fi
    
    echo "${args}"
}

build_single_target() {
    local target="$1"
    local platforms="${2:-linux/amd64}"
    local tag_suffix="${3:-}"
    local push="${4:-false}"
    
    local image_tag="${DEFAULT_TAG_PREFIX}:${target}${tag_suffix}"
    local build_args
    build_args=$(generate_build_args "${target}")
    
    log "Building target: ${target}"
    log_info "Image tag: ${image_tag}"
    log_info "Platforms: ${platforms}"
    
    local build_cmd="docker buildx build"
    build_cmd+=" --target ${target}"
    build_cmd+=" --platform ${platforms}"
    build_cmd+=" --tag ${image_tag}"
    
    # Add build arguments
    build_cmd+=" ${build_args}"
    
    # Cache configuration
    if [[ "${BUILDKIT_INLINE_CACHE}" == "1" ]]; then
        build_cmd+=" --cache-from type=inline"
        build_cmd+=" --cache-to type=inline,mode=max"
    fi
    
    # Registry cache
    if [[ -n "${REGISTRY_CACHE:-}" ]]; then
        build_cmd+=" --cache-from type=registry,ref=${REGISTRY_CACHE}:${target}-cache"
        build_cmd+=" --cache-to type=registry,ref=${REGISTRY_CACHE}:${target}-cache,mode=max"
    fi
    
    # Local cache
    build_cmd+=" --cache-from type=local,src=${CACHE_DIR}/${target}"
    build_cmd+=" --cache-to type=local,dest=${CACHE_DIR}/${target},mode=max"
    
    # Metadata and labels
    build_cmd+=" --label build.target=${target}"
    build_cmd+=" --label build.timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    build_cmd+=" --label build.version=${BUILD_VERSION:-dev}"
    build_cmd+=" --label build.commit=${GIT_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
    
    # Push or load
    if [[ "${push}" == "true" ]]; then
        build_cmd+=" --push"
    else
        build_cmd+=" --load"
    fi
    
    # Add context
    build_cmd+=" ."
    
    # Execute build with logging
    local log_file="${BUILD_LOG_DIR}/build-${target}-$(date +%Y%m%d-%H%M%S).log"
    log_info "Build log: ${log_file}"
    
    if eval "${build_cmd}" 2>&1 | tee "${log_file}"; then
        log "✅ Successfully built ${image_tag}"
        
        # Security scan if enabled
        if [[ "${ENABLE_SECURITY_SCAN}" == "true" ]]; then
            security_scan "${image_tag}" "${target}"
        fi
        
        return 0
    else
        log_error "❌ Failed to build ${image_tag}"
        return 1
    fi
}

security_scan() {
    local image_tag="$1"
    local target="$2"
    
    log "Running security scan for ${image_tag}..."
    
    if ! command -v trivy &> /dev/null; then
        log_warn "Trivy not installed, skipping security scan"
        return 0
    fi
    
    local scan_report="${SECURITY_REPORTS_DIR}/scan-${target}-$(date +%Y%m%d-%H%M%S).json"
    
    trivy image \
        --cache-dir "${TRIVY_CACHE_DIR}" \
        --format json \
        --output "${scan_report}" \
        --severity HIGH,CRITICAL \
        --security-checks vuln,config,secret \
        --timeout 10m \
        "${image_tag}"
    
    if [[ $? -eq 0 ]]; then
        log "✅ Security scan completed: ${scan_report}"
        
        # Parse results for critical vulnerabilities
        local critical_count
        critical_count=$(jq '.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL") | .VulnerabilityID' "${scan_report}" 2>/dev/null | wc -l || echo 0)
        
        if [[ "${critical_count}" -gt 0 ]]; then
            log_warn "Found ${critical_count} critical vulnerabilities"
        else
            log "✅ No critical vulnerabilities found"
        fi
    else
        log_error "❌ Security scan failed"
    fi
}

build_multi_target() {
    local targets=("$@")
    local failed_builds=()
    
    log "Building multiple targets: ${targets[*]}"
    
    for target in "${targets[@]}"; do
        if ! build_single_target "${target}"; then
            failed_builds+=("${target}")
        fi
    done
    
    if [[ ${#failed_builds[@]} -gt 0 ]]; then
        log_error "Failed builds: ${failed_builds[*]}"
        return 1
    fi
    
    log "✅ All builds completed successfully"
    return 0
}

clean_build_cache() {
    log "Cleaning build cache..."
    
    # Clean Docker build cache
    docker buildx prune --force
    
    # Clean local cache directory
    if [[ -d "${CACHE_DIR}" ]]; then
        rm -rf "${CACHE_DIR}"
        mkdir -p "${CACHE_DIR}"
    fi
    
    log "✅ Build cache cleaned"
}

show_usage() {
    cat << EOF
🐳 MediaNest Consolidated Docker Build Script

USAGE:
    $(basename "$0") [OPTIONS] [TARGET|COMMAND]

TARGETS:
EOF
    
    for target in "${!BUILD_TARGETS[@]}"; do
        printf "    %-20s %s\n" "${target}" "${BUILD_TARGETS[${target}]}"
    done
    
    cat << EOF

COMMANDS:
    all                     Build all production targets
    dev                     Build development environment
    prod                    Build production targets (backend, frontend, nginx)
    security                Build security-hardened targets
    test                    Build test environment
    clean                   Clean build cache
    scan [IMAGE]           Run security scan on image
    list                    List available targets

OPTIONS:
    -p, --platforms PLATFORMS    Target platforms (default: linux/amd64,linux/arm64)
    -t, --tag-suffix SUFFIX      Add suffix to image tags
    -s, --security-level LEVEL   Security level: standard|hardened (default: standard)
    -e, --enable-scan           Enable security scanning
    -d, --enable-debug          Enable debug features
    -m, --enable-monitoring     Enable monitoring features
    -c, --clean-first          Clean cache before building
    -v, --verbose              Verbose output
    -h, --help                 Show this help

ENVIRONMENT VARIABLES:
    NODE_ENV                    Node environment (production|development)
    SECURITY_LEVEL             Security level (standard|hardened)
    OPTIMIZATION_LEVEL         Optimization level (size|speed)
    ENABLE_SECURITY_SCAN       Enable security scanning (true|false)
    REGISTRY_CACHE             Registry for cache (e.g., ghcr.io/user/repo)
    BUILD_VERSION              Build version tag
    USER_ID                    User ID for containers (default: 1001)
    GROUP_ID                   Group ID for containers (default: 1001)

EXAMPLES:
    $(basename "$0") backend-production                    # Build backend production
    $(basename "$0") development -d -m                     # Build dev with debug and monitoring
    $(basename "$0") all --security-level hardened -e     # Build all with hardened security
    $(basename "$0") prod --platforms linux/amd64         # Build prod for x64 only
    $(basename "$0") clean                                 # Clean build cache
    $(basename "$0") scan medianest:backend-production     # Security scan image

EOF
}

# ==============================================================================
# 🚀 MAIN EXECUTION
# ==============================================================================
main() {
    local target=""
    local platforms="${DEFAULT_PLATFORMS}"
    local tag_suffix=""
    local clean_first=false
    local push=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -p|--platforms)
                platforms="$2"
                shift 2
                ;;
            -t|--tag-suffix)
                tag_suffix="$2"
                shift 2
                ;;
            -s|--security-level)
                export SECURITY_LEVEL="$2"
                shift 2
                ;;
            -e|--enable-scan)
                export ENABLE_SECURITY_SCAN=true
                shift
                ;;
            -d|--enable-debug)
                export ENABLE_DEBUG=true
                shift
                ;;
            -m|--enable-monitoring)
                export ENABLE_MONITORING=true
                shift
                ;;
            -c|--clean-first)
                clean_first=true
                shift
                ;;
            --push)
                push=true
                shift
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            all)
                target="all"
                shift
                ;;
            dev)
                target="development"
                shift
                ;;
            prod)
                target="prod"
                shift
                ;;
            security)
                target="security"
                shift
                ;;
            test)
                target="test-runner"
                shift
                ;;
            clean)
                clean_build_cache
                exit 0
                ;;
            scan)
                if [[ $# -gt 1 ]]; then
                    security_scan "$2" "manual"
                    exit 0
                else
                    log_error "Image name required for scan command"
                    exit 1
                fi
                ;;
            list)
                echo "Available build targets:"
                for t in "${!BUILD_TARGETS[@]}"; do
                    echo "  - ${t}"
                done
                exit 0
                ;;
            *)
                if [[ -n "${BUILD_TARGETS[$1]:-}" ]]; then
                    target="$1"
                else
                    log_error "Unknown option or target: $1"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Default target if none specified
    if [[ -z "${target}" ]]; then
        target="${DEFAULT_BUILD_TARGET}"
    fi
    
    # Setup environment
    setup_directories
    check_dependencies
    configure_buildkit
    
    # Clean cache if requested
    if [[ "${clean_first}" == "true" ]]; then
        clean_build_cache
    fi
    
    # Execute build based on target
    case "${target}" in
        all)
            build_multi_target "backend-production" "frontend-production" "nginx-production"
            ;;
        prod)
            build_multi_target "backend-production" "frontend-production" "nginx-production"
            ;;
        security)
            export SECURITY_LEVEL=hardened
            export ENABLE_SECURITY_SCAN=true
            build_single_target "security-hardened" "${platforms}" "${tag_suffix}" "${push}"
            ;;
        *)
            build_single_target "${target}" "${platforms}" "${tag_suffix}" "${push}"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"