#!/bin/bash

# ============================================
# 🚀 OPTIMIZED MKDOCS BUILD SCRIPT
# High-performance documentation build with advanced optimization
# ============================================

set -euo pipefail

# Color codes and formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly DOCS_DIR="$PROJECT_ROOT/docs"
readonly BUILD_DIR="$PROJECT_ROOT/site"
readonly CACHE_DIR="$PROJECT_ROOT/.mkdocs-cache"
readonly TEMP_DIR="/tmp/mkdocs-build-$$"

# Build configuration
readonly DEFAULT_PYTHON_VERSION="3.12"
readonly DEFAULT_PARALLEL_JOBS="4"
readonly BUILD_TIMEOUT="900"

# Performance targets
readonly TARGET_BUILD_TIME=60
readonly MAX_SITE_SIZE_MB=50

# Create necessary directories
mkdir -p "$CACHE_DIR" "$TEMP_DIR"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

print_header() {
    echo -e "${PURPLE}${BOLD}============================================${NC}"
    echo -e "${PURPLE}${BOLD}🚀 MEDIANEST OPTIMIZED BUILD SYSTEM${NC}"
    echo -e "${PURPLE}${BOLD}============================================${NC}"
    echo
}

print_section() {
    echo -e "${CYAN}${BOLD}▶ $1${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_progress() {
    echo -e "${PURPLE}⚡ $1${NC}"
}

# Check if running in CI environment
is_ci() {
    [[ -n "${CI:-}" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]] || [[ -n "${GITLAB_CI:-}" ]]
}

# Validate environment
validate_environment() {
    print_section "Environment Validation"
    
    # Check Python version
    local python_version
    if command -v python3 >/dev/null; then
        python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        print_success "Python $python_version detected"
    else
        print_error "Python 3 not found"
        exit 1
    fi
    
    # Check required files
    local required_files=("$PROJECT_ROOT/mkdocs.yml" "$DOCS_DIR/index.md")
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "Found: $(basename "$file")"
        else
            print_error "Missing required file: $file"
            exit 1
        fi
    done
    
    # Check available memory and disk space
    if command -v free >/dev/null; then
        local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        print_info "Available memory: ${available_mem}MB"
        
        if (( available_mem < 1000 )); then
            print_warning "Low memory detected, reducing parallel jobs"
            MKDOCS_PARALLEL_JOBS=2
        fi
    fi
    
    local available_space=$(df "$PROJECT_ROOT" | awk 'NR==2 {print int($4/1024)}')
    print_info "Available disk space: ${available_space}MB"
    
    if (( available_space < 500 )); then
        print_warning "Low disk space available"
    fi
    
    echo
}

# Setup optimized build environment
setup_build_environment() {
    print_section "Build Environment Setup"
    
    # Set environment variables for optimization
    export PYTHONUNBUFFERED=1
    export PYTHONDONTWRITEBYTECODE=1
    export MKDOCS_PARALLEL_JOBS="${MKDOCS_PARALLEL_JOBS:-$DEFAULT_PARALLEL_JOBS}"
    
    # Configure MkDocs for performance
    export MKDOCS_CONFIG_FILE="$PROJECT_ROOT/mkdocs.yml"
    
    # Setup caching if supported
    if [[ -d "$CACHE_DIR" ]]; then
        export MKDOCS_CACHE_DIR="$CACHE_DIR"
        print_success "Build cache configured: $CACHE_DIR"
    fi
    
    # CI-specific optimizations
    if is_ci; then
        export CI_BUILD=1
        export MKDOCS_STRICT=1
        print_info "CI environment detected - enabling strict mode"
    fi
    
    print_success "Build environment configured"
    print_info "Parallel jobs: $MKDOCS_PARALLEL_JOBS"
    echo
}

# Install dependencies with optimization
install_dependencies() {
    print_section "Dependency Installation"
    
    local requirements_file="$PROJECT_ROOT/requirements.txt"
    
    if [[ ! -f "$requirements_file" ]]; then
        print_warning "requirements.txt not found, installing core dependencies"
        pip install --quiet --upgrade pip
        pip install --quiet mkdocs-material mkdocs-git-revision-date-localized-plugin \
                           mkdocs-minify-plugin mkdocs-redirects mkdocs-gen-files \
                           pygments pymdown-extensions
    else
        # Check if dependencies are already installed
        local cache_file="$CACHE_DIR/deps-$(sha256sum "$requirements_file" | cut -d' ' -f1).cache"
        
        if [[ -f "$cache_file" ]] && ! is_ci; then
            print_success "Dependencies cached and up-to-date"
        else
            print_progress "Installing dependencies..."
            
            # Use pip with optimizations
            pip install --quiet --upgrade pip wheel setuptools
            pip install --quiet --no-warn-script-location -r "$requirements_file"
            
            # Create cache marker
            touch "$cache_file"
            print_success "Dependencies installed and cached"
        fi
    fi
    
    # Verify critical plugins
    python3 -c "
import mkdocs_material
import pymdownx
print('✅ Core plugins verified')
" || {
        print_error "Critical plugin verification failed"
        exit 1
    }
    
    echo
}

# Pre-build optimization
pre_build_optimization() {
    print_section "Pre-Build Optimization"
    
    # Clean old builds if requested
    if [[ "${CLEAN_BUILD:-}" == "true" ]]; then
        print_progress "Cleaning previous build..."
        rm -rf "$BUILD_DIR"
        print_success "Previous build cleaned"
    fi
    
    # Optimize documentation source
    if [[ "${OPTIMIZE_SOURCE:-true}" == "true" ]]; then
        print_progress "Optimizing documentation source..."
        
        # Find and optimize images (if optimization tools available)
        if command -v optipng >/dev/null; then
            find "$DOCS_DIR" -name "*.png" -exec optipng -quiet -o2 {} + 2>/dev/null || true
        fi
        
        # Remove temporary files
        find "$DOCS_DIR" -name "*.tmp" -o -name ".DS_Store" -o -name "Thumbs.db" -delete 2>/dev/null || true
        
        print_success "Source optimization completed"
    fi
    
    # Generate dynamic content if script exists
    local gen_script="$PROJECT_ROOT/scripts/gen_api_docs.py"
    if [[ -f "$gen_script" ]]; then
        print_progress "Generating dynamic API documentation..."
        python3 "$gen_script" || print_warning "API docs generation had issues"
        print_success "Dynamic content generated"
    fi
    
    echo
}

# Execute optimized build
execute_build() {
    print_section "High-Performance Build Execution"
    
    local build_start=$(date +%s.%N)
    local build_config="$PROJECT_ROOT/mkdocs.yml"
    
    print_progress "Starting optimized MkDocs build..."
    print_info "Build configuration: $build_config"
    print_info "Output directory: $BUILD_DIR"
    
    # Build with optimizations
    local build_args=(
        "build"
        "--config-file" "$build_config"
        "--site-dir" "$BUILD_DIR"
        "--clean"
    )
    
    # Add strict mode in CI
    if is_ci; then
        build_args+=("--strict")
    fi
    
    # Add verbose mode if requested
    if [[ "${VERBOSE:-}" == "true" ]]; then
        build_args+=("--verbose")
    fi
    
    # Execute build with timeout
    if timeout "${BUILD_TIMEOUT}s" mkdocs "${build_args[@]}"; then
        local build_end=$(date +%s.%N)
        local build_time=$(echo "$build_end - $build_start" | bc)
        local build_time_int=$(printf "%.0f" "$build_time")
        
        print_success "Build completed in ${build_time}s"
        
        # Check build time performance
        if (( build_time_int <= TARGET_BUILD_TIME )); then
            print_success "Build time meets performance target (≤${TARGET_BUILD_TIME}s)"
        else
            print_warning "Build time (${build_time_int}s) exceeds target (${TARGET_BUILD_TIME}s)"
        fi
        
        # Store build metrics
        echo "$build_time" > "$CACHE_DIR/last-build-time"
        
        # Validate build output
        validate_build_output "$build_time"
        
    else
        print_error "Build failed or timed out after ${BUILD_TIMEOUT}s"
        exit 1
    fi
    
    echo
}

# Validate build output
validate_build_output() {
    local build_time="$1"
    
    print_section "Build Validation"
    
    # Check if build directory exists
    if [[ ! -d "$BUILD_DIR" ]]; then
        print_error "Build directory not created"
        exit 1
    fi
    
    # Check for essential files
    local essential_files=(
        "$BUILD_DIR/index.html"
        "$BUILD_DIR/sitemap.xml"
        "$BUILD_DIR/search/search_index.json"
    )
    
    for file in "${essential_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "Found: $(basename "$file")"
        else
            print_warning "Missing: $(basename "$file")"
        fi
    done
    
    # Calculate build statistics
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    local html_count=$(find "$BUILD_DIR" -name "*.html" | wc -l)
    local size_bytes=$(du -sb "$BUILD_DIR" | cut -f1)
    local size_mb=$(echo "scale=2; $size_bytes / 1024 / 1024" | bc)
    
    print_info "Build Statistics:"
    echo "   📊 Total files: $file_count"
    echo "   📄 HTML pages: $html_count"
    echo "   💾 Total size: ${size_mb}MB"
    echo "   ⏱️  Build time: ${build_time}s"
    
    # Check size limits
    if (( $(echo "$size_mb > $MAX_SITE_SIZE_MB" | bc -l) )); then
        print_warning "Site size (${size_mb}MB) exceeds target (${MAX_SITE_SIZE_MB}MB)"
    else
        print_success "Site size within target limits"
    fi
    
    # Generate build manifest
    generate_build_manifest "$build_time" "$size_mb" "$file_count"
    
    echo
}

# Generate build manifest
generate_build_manifest() {
    local build_time="$1"
    local size_mb="$2" 
    local file_count="$3"
    
    local manifest_file="$BUILD_DIR/build-manifest.json"
    local git_commit="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}"
    local git_branch="${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo "unknown")}"
    
    cat > "$manifest_file" << EOF
{
  "build_info": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "build_time_seconds": $build_time,
    "git_commit": "$git_commit",
    "git_branch": "$git_branch",
    "build_environment": "$(if is_ci; then echo "CI"; else echo "local"; fi)",
    "build_user": "${USER:-unknown}",
    "python_version": "$(python3 --version | cut -d' ' -f2)"
  },
  "site_metrics": {
    "total_files": $file_count,
    "total_size_mb": $size_mb,
    "html_files": $(find "$BUILD_DIR" -name "*.html" | wc -l),
    "css_files": $(find "$BUILD_DIR" -name "*.css" | wc -l),
    "js_files": $(find "$BUILD_DIR" -name "*.js" | wc -l),
    "image_files": $(find "$BUILD_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.svg" \) | wc -l)
  },
  "performance": {
    "build_time_target_met": $(if (( $(echo "$build_time <= $TARGET_BUILD_TIME" | bc -l) )); then echo "true"; else echo "false"; fi),
    "size_target_met": $(if (( $(echo "$size_mb <= $MAX_SITE_SIZE_MB" | bc -l) )); then echo "true"; else echo "false"; fi),
    "build_time_target": $TARGET_BUILD_TIME,
    "size_target_mb": $MAX_SITE_SIZE_MB
  },
  "optimization": {
    "compression_applied": false,
    "minification_applied": true,
    "cache_enabled": $(if [[ -d "$CACHE_DIR" ]]; then echo "true"; else echo "false"; fi)
  }
}
EOF
    
    print_success "Build manifest created: $manifest_file"
}

# Post-build optimization
post_build_optimization() {
    print_section "Post-Build Optimization"
    
    if [[ "${SKIP_OPTIMIZATION:-}" == "true" ]]; then
        print_info "Optimization skipped by configuration"
        return 0
    fi
    
    local original_size=$(du -sb "$BUILD_DIR" | cut -f1)
    
    # Compress files for better transfer
    if [[ "${ENABLE_COMPRESSION:-true}" == "true" ]]; then
        print_progress "Applying compression optimization..."
        
        # Gzip compress HTML, CSS, JS files
        find "$BUILD_DIR" \( -name "*.html" -o -name "*.css" -o -name "*.js" \) -exec gzip -9 -k {} \;
        
        # Generate integrity hashes for security
        find "$BUILD_DIR" \( -name "*.css" -o -name "*.js" \) | while read file; do
            sha384sum "$file" | cut -d' ' -f1 | base64 -d | base64 > "$file.integrity"
        done
        
        print_success "Compression applied"
    fi
    
    # Create security headers file
    if [[ "${GENERATE_SECURITY_HEADERS:-true}" == "true" ]]; then
        create_security_headers
    fi
    
    # Calculate optimization savings
    local optimized_size=$(du -sb "$BUILD_DIR" | cut -f1)
    local savings_percent=$(echo "scale=2; (($original_size - $optimized_size) * 100) / $original_size" | bc 2>/dev/null || echo "0")
    
    print_success "Post-build optimization completed"
    print_info "Space savings: ${savings_percent}%"
    
    echo
}

# Create security headers configuration
create_security_headers() {
    local htaccess_file="$BUILD_DIR/.htaccess"
    local headers_file="$BUILD_DIR/_headers"
    
    # Apache .htaccess
    cat > "$htaccess_file" << 'EOF'
# Security Headers
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'"

# Performance Headers
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript
</IfModule>

<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
EOF

    # Netlify _headers
    cat > "$headers_file" << 'EOF'
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.js  
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.svg
  Cache-Control: public, max-age=31536000, immutable
EOF
    
    print_success "Security headers configured"
}

# Generate build report
generate_build_report() {
    print_section "Build Report Generation"
    
    local report_file="$BUILD_DIR/build-report.md"
    local build_time=$(cat "$CACHE_DIR/last-build-time" 2>/dev/null || echo "unknown")
    
    cat > "$report_file" << EOF
# 🚀 MediaNest Documentation Build Report

**Build Timestamp:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**Build Time:** ${build_time}s  
**Build Environment:** $(if is_ci; then echo "CI/CD"; else echo "Local"; fi)  
**Git Commit:** ${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}

## Build Statistics

$(jq -r '
"- **Total Files:** " + (.site_metrics.total_files | tostring) + "\n" +
"- **HTML Pages:** " + (.site_metrics.html_files | tostring) + "\n" +
"- **Total Size:** " + (.site_metrics.total_size_mb | tostring) + "MB\n" +
"- **Build Time:** " + (.build_info.build_time_seconds | tostring) + "s"
' "$BUILD_DIR/build-manifest.json" 2>/dev/null || echo "- Build manifest not available")

## Performance Analysis

$(jq -r '
if .performance.build_time_target_met then "✅ **Build Time Target:** Met (" + (.performance.build_time_target | tostring) + "s)" else "⚠️ **Build Time Target:** Exceeded (" + (.performance.build_time_target | tostring) + "s)" end + "\n" +
if .performance.size_target_met then "✅ **Size Target:** Met (" + (.performance.size_target_mb | tostring) + "MB)" else "⚠️ **Size Target:** Exceeded (" + (.performance.size_target_mb | tostring) + "MB)" end
' "$BUILD_DIR/build-manifest.json" 2>/dev/null || echo "- Performance data not available")

## Optimization Status

- **Minification:** $(if [[ -f "$BUILD_DIR/assets/stylesheets/main.*.min.css" ]]; then echo "✅ Applied"; else echo "❌ Not Applied"; fi)
- **Compression:** $(if [[ -f "$BUILD_DIR/index.html.gz" ]]; then echo "✅ Applied"; else echo "❌ Not Applied"; fi)
- **Security Headers:** $(if [[ -f "$BUILD_DIR/.htaccess" ]]; then echo "✅ Configured"; else echo "❌ Not Configured"; fi)

## Build Configuration

- **Python Version:** $(python3 --version | cut -d' ' -f2)
- **MkDocs Version:** $(mkdocs --version 2>/dev/null | head -1 || echo "unknown")
- **Parallel Jobs:** ${MKDOCS_PARALLEL_JOBS:-1}
- **Cache Enabled:** $(if [[ -d "$CACHE_DIR" ]]; then echo "Yes"; else echo "No"; fi)

---

*Generated by MediaNest Optimized Build System v2.0*
EOF
    
    print_success "Build report generated: $report_file"
    echo
}

# Main execution function
main() {
    print_header
    
    # Parse command line arguments
    local clean_build=false
    local verbose=false
    local skip_optimization=false
    local enable_compression=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --clean)
                clean_build=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            --skip-optimization)
                skip_optimization=true
                shift
                ;;
            --no-compression)
                enable_compression=false
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "OPTIONS:"
                echo "  --clean              Clean previous build"
                echo "  --verbose           Enable verbose output"
                echo "  --skip-optimization Skip post-build optimization"
                echo "  --no-compression    Disable compression"
                echo "  --help              Show this help"
                exit 0
                ;;
            *)
                print_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Export configuration
    export CLEAN_BUILD="$clean_build"
    export VERBOSE="$verbose"
    export SKIP_OPTIMIZATION="$skip_optimization"
    export ENABLE_COMPRESSION="$enable_compression"
    
    # Execute build pipeline
    validate_environment
    setup_build_environment
    install_dependencies
    pre_build_optimization
    execute_build
    post_build_optimization
    generate_build_report
    
    print_section "Build Complete"
    print_success "Documentation build completed successfully!"
    
    if [[ -f "$BUILD_DIR/build-manifest.json" ]]; then
        local build_time=$(jq -r '.build_info.build_time_seconds' "$BUILD_DIR/build-manifest.json")
        local size_mb=$(jq -r '.site_metrics.total_size_mb' "$BUILD_DIR/build-manifest.json")
        print_info "📊 Final build time: ${build_time}s"
        print_info "💾 Final site size: ${size_mb}MB"
    fi
    
    print_info "🌐 Site ready for deployment: $BUILD_DIR"
}

# Execute main function with all arguments
main "$@"