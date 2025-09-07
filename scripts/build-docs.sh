#!/bin/bash
# MediaNest Documentation Build Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCS_DIR="docs"
BUILD_DIR="site"
MKDOCS_CONFIG="mkdocs.yml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking build requirements..."
    
    # Check if Python is installed
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed."
        exit 1
    fi
    
    # Check if pip is installed
    if ! command -v pip3 &> /dev/null; then
        log_error "pip3 is required but not installed."
        exit 1
    fi
    
    # Check if mkdocs is installed
    if ! command -v mkdocs &> /dev/null; then
        log_warning "MkDocs not found. Installing..."
        pip3 install mkdocs-material mkdocs-git-revision-date-localized-plugin mkdocs-git-committers-plugin-2 mkdocs-minify-plugin mkdocs-redirects
    fi
    
    log_success "All requirements satisfied"
}

install_dependencies() {
    log_info "Installing/updating MkDocs dependencies..."
    
    pip3 install --upgrade \
        mkdocs \
        mkdocs-material \
        mkdocs-git-revision-date-localized-plugin \
        mkdocs-git-committers-plugin-2 \
        mkdocs-minify-plugin \
        mkdocs-redirects \
        mkdocs-tags \
        mkdocs-social \
        mkdocs-offline \
        pygments \
        pymdown-extensions
    
    log_success "Dependencies installed"
}

validate_config() {
    log_info "Validating MkDocs configuration..."
    
    if [ ! -f "$MKDOCS_CONFIG" ]; then
        log_error "MkDocs configuration file not found: $MKDOCS_CONFIG"
        exit 1
    fi
    
    # Validate configuration
    if mkdocs config-validation; then
        log_success "Configuration is valid"
    else
        log_error "Configuration validation failed"
        exit 1
    fi
}

check_content() {
    log_info "Checking documentation content..."
    
    if [ ! -d "$DOCS_DIR" ]; then
        log_error "Documentation directory not found: $DOCS_DIR"
        exit 1
    fi
    
    # Check for required files
    required_files=(
        "docs/index.md"
        "docs/getting-started/index.md"
        "docs/installation/index.md"
        "docs/user-guides/index.md"
        "docs/api/index.md"
        "docs/developers/index.md"
        "docs/troubleshooting/index.md"
        "docs/reference/index.md"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_warning "Required file not found: $file"
        fi
    done
    
    log_success "Content check completed"
}

build_docs() {
    log_info "Building documentation..."
    
    # Clean previous build
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        log_info "Cleaned previous build directory"
    fi
    
    # Build documentation
    mkdocs build --strict
    
    if [ $? -eq 0 ]; then
        log_success "Documentation built successfully"
    else
        log_error "Build failed"
        exit 1
    fi
}

optimize_build() {
    log_info "Optimizing build output..."
    
    # Compress CSS and JS files
    find "$BUILD_DIR" -name "*.css" -exec gzip -k {} \;
    find "$BUILD_DIR" -name "*.js" -exec gzip -k {} \;
    
    # Add security headers
    cat > "$BUILD_DIR/.htaccess" << 'EOF'
# Security Headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy strict-origin-when-cross-origin
Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Browser Caching
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
EOF
    
    log_success "Build optimized"
}

generate_sitemap() {
    log_info "Generating sitemap..."
    
    # MkDocs already generates sitemap.xml, but we can add custom entries
    cat > "$BUILD_DIR/robots.txt" << 'EOF'
User-agent: *
Allow: /
Disallow: /search/

Sitemap: https://docs.medianest.com/sitemap.xml
EOF
    
    log_success "Sitemap and robots.txt generated"
}

run_tests() {
    log_info "Running documentation tests..."
    
    # Check for broken links (requires linkchecker)
    if command -v linkchecker &> /dev/null; then
        log_info "Checking for broken links..."
        linkchecker --check-extern "$BUILD_DIR/index.html"
    else
        log_warning "linkchecker not found, skipping link validation"
    fi
    
    # Validate HTML (requires html5validator)
    if command -v html5validator &> /dev/null; then
        log_info "Validating HTML..."
        html5validator --root "$BUILD_DIR"
    else
        log_warning "html5validator not found, skipping HTML validation"
    fi
    
    log_success "Documentation tests completed"
}

generate_search_index() {
    log_info "Generating search index..."
    
    # MkDocs Material handles search index automatically
    if [ -f "$BUILD_DIR/search/search_index.json" ]; then
        log_success "Search index generated"
    else
        log_warning "Search index not found"
    fi
}

show_build_info() {
    log_info "Build Information:"
    echo "  - Build directory: $BUILD_DIR"
    echo "  - Total files: $(find "$BUILD_DIR" -type f | wc -l)"
    echo "  - Total size: $(du -sh "$BUILD_DIR" | cut -f1)"
    echo "  - HTML files: $(find "$BUILD_DIR" -name "*.html" | wc -l)"
    echo "  - CSS files: $(find "$BUILD_DIR" -name "*.css" | wc -l)"
    echo "  - JS files: $(find "$BUILD_DIR" -name "*.js" | wc -l)"
    echo "  - Image files: $(find "$BUILD_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.svg" \) | wc -l)"
}

# Main execution
main() {
    log_info "Starting MediaNest documentation build..."
    
    # Check command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --dev)
                DEV_MODE=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-deps    Skip dependency installation"
                echo "  --skip-tests   Skip running tests"
                echo "  --dev         Development mode (faster build)"
                echo "  --help        Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Build steps
    check_requirements
    
    if [ "$SKIP_DEPS" != true ]; then
        install_dependencies
    fi
    
    validate_config
    check_content
    build_docs
    
    if [ "$DEV_MODE" != true ]; then
        optimize_build
        generate_sitemap
        generate_search_index
        
        if [ "$SKIP_TESTS" != true ]; then
            run_tests
        fi
    fi
    
    show_build_info
    log_success "Documentation build completed successfully!"
    
    # Development server option
    if [ "$DEV_MODE" = true ]; then
        read -p "Start development server? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Starting development server..."
            mkdocs serve
        fi
    fi
}

# Run main function
main "$@"