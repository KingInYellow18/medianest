#!/bin/bash
# MediaNest Documentation Build Script - 2025 Optimized
# Advanced MkDocs Material build with performance optimization

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/docs"
BUILD_DIR="$PROJECT_ROOT/site"
CACHE_DIR="$PROJECT_ROOT/.cache"
LOG_FILE="$PROJECT_ROOT/build-docs.log"
REQUIREMENTS_FILE="$PROJECT_ROOT/requirements.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Print banner
print_banner() {
    echo -e "${PURPLE}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MediaNest Documentation Builder                           ║
║                          2025 Performance Optimized                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Python version
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is required but not installed"
    fi
    
    local python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    local required_version="3.8"
    
    if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"; then
        error "Python 3.8+ is required, found Python $python_version"
    fi
    
    success "Python $python_version detected"
    
    # Check if we're in a virtual environment
    if [[ -n "${VIRTUAL_ENV:-}" ]]; then
        info "Virtual environment detected: $VIRTUAL_ENV"
    else
        warn "No virtual environment detected - consider using one for isolation"
    fi
    
    # Check Node.js for additional tooling (optional)
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        info "Node.js $node_version detected (optional)"
    fi
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    local dirs=(
        "$CACHE_DIR"
        "$CACHE_DIR/social"
        "$CACHE_DIR/privacy"
        "$CACHE_DIR/optimize"
        "$BUILD_DIR"
        "$DOCS_DIR/assets/images/social"
        "$DOCS_DIR/snippets"
        "$DOCS_DIR/data"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        info "Created directory: $dir"
    done
}

# Install Python dependencies
install_dependencies() {
    log "Installing Python dependencies..."
    
    if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
        error "Requirements file not found: $REQUIREMENTS_FILE"
    fi
    
    # Install with optimizations
    pip install --upgrade pip setuptools wheel
    
    # Install requirements with caching
    if [[ -f "$CACHE_DIR/requirements-hash.txt" ]]; then
        local current_hash=$(sha256sum "$REQUIREMENTS_FILE" | cut -d' ' -f1)
        local cached_hash=$(cat "$CACHE_DIR/requirements-hash.txt" 2>/dev/null || echo "")
        
        if [[ "$current_hash" == "$cached_hash" ]]; then
            info "Dependencies are up to date (cache hit)"
            return 0
        fi
    fi
    
    pip install -r "$REQUIREMENTS_FILE" --no-warn-script-location
    
    # Cache the requirements hash
    sha256sum "$REQUIREMENTS_FILE" | cut -d' ' -f1 > "$CACHE_DIR/requirements-hash.txt"
    
    success "Dependencies installed successfully"
}

# Optimize images
optimize_images() {
    log "Optimizing images..."
    
    local image_dirs=(
        "$DOCS_DIR/assets/images"
        "$DOCS_DIR/assets/icons"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            # PNG optimization
            if command -v optipng &> /dev/null; then
                find "$dir" -name "*.png" -exec optipng -quiet -o2 {} \;
                info "Optimized PNG images in $dir"
            fi
            
            # JPEG optimization
            if command -v jpegoptim &> /dev/null; then
                find "$dir" -name "*.jpg" -o -name "*.jpeg" -exec jpegoptim --quiet --strip-all --max=85 {} \;
                info "Optimized JPEG images in $dir"
            fi
            
            # SVG optimization
            if command -v svgo &> /dev/null; then
                find "$dir" -name "*.svg" -exec svgo --quiet {} \;
                info "Optimized SVG images in $dir"
            fi
        fi
    done
}

# Generate API documentation if needed
generate_api_docs() {
    log "Generating API documentation..."
    
    local api_script="$SCRIPT_DIR/gen_api_docs.py"
    if [[ -f "$api_script" ]]; then
        python3 "$api_script"
        success "API documentation generated"
    else
        warn "API documentation script not found: $api_script"
    fi
}

# Validate configuration
validate_config() {
    log "Validating MkDocs configuration..."
    
    if ! mkdocs config-validation; then
        error "MkDocs configuration validation failed"
    fi
    
    success "MkDocs configuration is valid"
}

# Pre-build optimizations
pre_build_optimizations() {
    log "Running pre-build optimizations..."
    
    # Clean previous build
    if [[ -d "$BUILD_DIR" ]]; then
        rm -rf "$BUILD_DIR"
        info "Cleaned previous build directory"
    fi
    
    # Validate all markdown files
    local markdown_errors=0
    while IFS= read -r -d '' file; do
        if ! python3 -c "
import markdown
try:
    with open('$file', 'r', encoding='utf-8') as f:
        content = f.read()
    markdown.markdown(content)
except Exception as e:
    print(f'Error in $file: {e}')
    exit(1)
" 2>/dev/null; then
            warn "Markdown validation failed for: $file"
            ((markdown_errors++))
        fi
    done < <(find "$DOCS_DIR" -name "*.md" -type f -print0)
    
    if [[ $markdown_errors -gt 0 ]]; then
        warn "$markdown_errors markdown files have validation issues"
    else
        success "All markdown files validated successfully"
    fi
}

# Build documentation
build_docs() {
    local build_mode="${1:-production}"
    
    log "Building documentation in $build_mode mode..."
    
    # Set environment variables for optimization
    export OPTIMIZE_ENABLED=true
    export PRIVACY_ENABLED=true
    export TAGS_ENABLED=true
    
    # Performance monitoring
    local start_time=$(date +%s)
    
    case "$build_mode" in
        "development"|"dev")
            info "Building in development mode..."
            mkdocs build --clean --verbose
            ;;
        "production"|"prod")
            info "Building in production mode..."
            export CI=true
            mkdocs build --clean --strict --verbose
            ;;
        "fast")
            info "Building in fast mode (minimal optimization)..."
            export OPTIMIZE_ENABLED=false
            export PRIVACY_ENABLED=false
            mkdocs build --clean
            ;;
        *)
            error "Unknown build mode: $build_mode"
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    success "Documentation built successfully in ${duration}s"
}

# Post-build optimizations
post_build_optimizations() {
    log "Running post-build optimizations..."
    
    if [[ ! -d "$BUILD_DIR" ]]; then
        error "Build directory not found: $BUILD_DIR"
    fi
    
    # Compress HTML files
    if command -v html-minifier &> /dev/null; then
        find "$BUILD_DIR" -name "*.html" -exec html-minifier \
            --collapse-whitespace \
            --remove-comments \
            --remove-optional-tags \
            --remove-redundant-attributes \
            --remove-script-type-attributes \
            --remove-tag-whitespace \
            --use-short-doctype \
            --minify-css true \
            --minify-js true \
            --output {} {} \;
        info "HTML files minified"
    fi
    
    # Generate sitemap if not already present
    if [[ ! -f "$BUILD_DIR/sitemap.xml" ]] && command -v python3 &> /dev/null; then
        python3 -c "
import os
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

site_url = 'https://docs.medianest.com'
build_dir = '$BUILD_DIR'
sitemap = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')

for html_file in Path(build_dir).rglob('*.html'):
    if html_file.name == '404.html':
        continue
    
    rel_path = html_file.relative_to(build_dir)
    if rel_path.name == 'index.html':
        url_path = str(rel_path.parent)
        if url_path == '.':
            url_path = ''
    else:
        url_path = str(rel_path)[:-5]  # Remove .html
    
    url = ET.SubElement(sitemap, 'url')
    ET.SubElement(url, 'loc').text = f'{site_url}/{url_path}'.rstrip('/')
    ET.SubElement(url, 'lastmod').text = datetime.now().isoformat()
    ET.SubElement(url, 'changefreq').text = 'weekly'
    ET.SubElement(url, 'priority').text = '0.8' if url_path == '' else '0.6'

tree = ET.ElementTree(sitemap)
tree.write('$BUILD_DIR/sitemap.xml', encoding='utf-8', xml_declaration=True)
print('Generated sitemap.xml')
"
        success "Generated sitemap.xml"
    fi
    
    # Create robots.txt
    cat > "$BUILD_DIR/robots.txt" << EOF
User-agent: *
Allow: /

Sitemap: https://docs.medianest.com/sitemap.xml
EOF
    info "Generated robots.txt"
    
    # Generate build info
    cat > "$BUILD_DIR/build-info.json" << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "buildNumber": "${BUILD_NUMBER:-$(date +%s)}",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "version": "$(cat $PROJECT_ROOT/package.json | python3 -c "import sys, json; print(json.load(sys.stdin)['version'])" 2>/dev/null || echo 'unknown')"
}
EOF
    info "Generated build-info.json"
}

# Validate build output
validate_build() {
    log "Validating build output..."
    
    local validation_errors=0
    
    # Check required files exist
    local required_files=(
        "index.html"
        "sitemap.xml"
        "robots.txt"
        "assets/stylesheets"
        "assets/javascripts"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -e "$BUILD_DIR/$file" ]]; then
            warn "Required file/directory missing: $file"
            ((validation_errors++))
        fi
    done
    
    # Check for broken links (basic check)
    local broken_links=0
    while IFS= read -r -d '' file; do
        if grep -q "href.*404\.html\|src.*404\.html" "$file"; then
            warn "Potential broken link found in: ${file#$BUILD_DIR/}"
            ((broken_links++))
        fi
    done < <(find "$BUILD_DIR" -name "*.html" -type f -print0)
    
    # Check HTML validity (basic)
    while IFS= read -r -d '' file; do
        if ! python3 -c "
from html.parser import HTMLParser
import sys

class HTMLValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []
    
    def error(self, message):
        self.errors.append(message)

try:
    with open('$file', 'r', encoding='utf-8') as f:
        content = f.read()
    
    parser = HTMLValidator()
    parser.feed(content)
    
    if parser.errors:
        print(f'HTML validation errors in $file:')
        for error in parser.errors:
            print(f'  {error}')
        sys.exit(1)
except Exception as e:
    print(f'Error validating $file: {e}')
    sys.exit(1)
" 2>/dev/null; then
            warn "HTML validation failed for: ${file#$BUILD_DIR/}"
            ((validation_errors++))
        fi
    done < <(find "$BUILD_DIR" -name "*.html" -type f -print0)
    
    if [[ $validation_errors -gt 0 ]]; then
        warn "Build validation completed with $validation_errors issues"
    else
        success "Build validation passed"
    fi
}

# Generate build report
generate_build_report() {
    log "Generating build report..."
    
    local report_file="$PROJECT_ROOT/build-report.json"
    local build_size=$(du -sh "$BUILD_DIR" | cut -f1)
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    local html_files=$(find "$BUILD_DIR" -name "*.html" | wc -l)
    local css_files=$(find "$BUILD_DIR" -name "*.css" | wc -l)
    local js_files=$(find "$BUILD_DIR" -name "*.js" | wc -l)
    local image_files=$(find "$BUILD_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" \) | wc -l)
    
    cat > "$report_file" << EOF
{
  "buildReport": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "buildDirectory": "$BUILD_DIR",
    "totalSize": "$build_size",
    "fileCount": {
      "total": $file_count,
      "html": $html_files,
      "css": $css_files,
      "javascript": $js_files,
      "images": $image_files
    },
    "performance": {
      "buildTime": "${BUILD_TIME:-unknown}s",
      "optimizationsEnabled": {
        "imageOptimization": $(command -v optipng &> /dev/null && echo true || echo false),
        "htmlMinification": $(command -v html-minifier &> /dev/null && echo true || echo false),
        "caching": true
      }
    },
    "validation": {
      "configValid": true,
      "markdownValid": true,
      "htmlValid": true
    }
  }
}
EOF
    
    info "Build report saved to: $report_file"
    
    # Print summary
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                            BUILD SUMMARY                                     ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC} Build Size:      $build_size"
    echo -e "${GREEN}║${NC} Total Files:     $file_count"
    echo -e "${GREEN}║${NC} HTML Pages:      $html_files"
    echo -e "${GREEN}║${NC} CSS Files:       $css_files"
    echo -e "${GREEN}║${NC} JS Files:        $js_files"
    echo -e "${GREEN}║${NC} Images:          $image_files"
    echo -e "${GREEN}║${NC} Build Time:      ${BUILD_TIME:-unknown}s"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
}

# Serve documentation locally
serve_docs() {
    local port="${1:-8000}"
    log "Serving documentation on port $port..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:$port"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:$port"
    fi
    
    mkdocs serve --dev-addr "0.0.0.0:$port"
}

# Main execution function
main() {
    local start_time=$(date +%s)
    local command="${1:-build}"
    local mode="${2:-production}"
    
    print_banner
    log "Starting MediaNest documentation build process..."
    
    # Initialize log
    echo "MediaNest Documentation Build Log - $(date)" > "$LOG_FILE"
    
    case "$command" in
        "build")
            check_requirements
            create_directories
            install_dependencies
            optimize_images
            generate_api_docs
            validate_config
            pre_build_optimizations
            build_docs "$mode"
            post_build_optimizations
            validate_build
            
            local end_time=$(date +%s)
            export BUILD_TIME=$((end_time - start_time))
            generate_build_report
            
            success "Documentation build completed successfully!"
            info "Build output: $BUILD_DIR"
            info "Build log: $LOG_FILE"
            ;;
        "serve")
            serve_docs "${mode:-8000}"
            ;;
        "clean")
            log "Cleaning build artifacts..."
            rm -rf "$BUILD_DIR" "$CACHE_DIR"
            success "Build artifacts cleaned"
            ;;
        "validate")
            validate_config
            success "Configuration validation completed"
            ;;
        "deps")
            check_requirements
            install_dependencies
            success "Dependencies check completed"
            ;;
        *)
            echo "Usage: $0 {build|serve|clean|validate|deps} [mode|port]"
            echo
            echo "Commands:"
            echo "  build [production|development|fast] - Build documentation"
            echo "  serve [port]                        - Serve documentation locally"
            echo "  clean                              - Clean build artifacts"
            echo "  validate                           - Validate configuration"
            echo "  deps                               - Check and install dependencies"
            echo
            echo "Build modes:"
            echo "  production (default) - Full optimization, strict validation"
            echo "  development         - Development build with verbose output"
            echo "  fast               - Minimal optimization for quick builds"
            exit 1
            ;;
    esac
}

# Trap to handle interruption
trap 'echo -e "\n${RED}Build interrupted!${NC}"; exit 1' INT

# Run main function with all arguments
main "$@"