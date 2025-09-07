#!/bin/bash
# Enhanced MediaNest Documentation Deployment Script with Multi-Platform Support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default configuration
BUILD_DIR="site"
DEPLOYMENT_BRANCH="gh-pages"
REMOTE_NAME="origin"
DOCS_URL="https://docs.medianest.com"
STAGING_URL="https://docs-staging.medianest.com"

# Deployment targets
DEPLOY_GITHUB=false
DEPLOY_NETLIFY=false
DEPLOY_S3=false
DEPLOY_STAGING=false
DEPLOY_PRODUCTION=false

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

log_deploy() {
    echo -e "${PURPLE}[DEPLOY]${NC} $1"
}

show_help() {
    cat << EOF
Enhanced MediaNest Documentation Deployment Script

Usage: $0 [OPTIONS]

Deployment Targets:
  --github        Deploy to GitHub Pages
  --netlify       Deploy to Netlify
  --s3           Deploy to AWS S3
  --staging      Deploy to staging environment
  --production   Deploy to production environment

Options:
  --build-first   Build documentation before deployment
  --skip-checks   Skip pre-deployment validation
  --force        Force deployment even if checks fail
  --dry-run      Show what would be deployed without actually deploying
  --cleanup      Clean up temporary files after deployment
  --help         Show this help message

Environment Variables:
  GITHUB_TOKEN            GitHub API token for releases
  NETLIFY_AUTH_TOKEN      Netlify authentication token
  NETLIFY_SITE_ID         Netlify site ID
  AWS_ACCESS_KEY_ID       AWS access key for S3
  AWS_SECRET_ACCESS_KEY   AWS secret key for S3
  S3_BUCKET              S3 bucket name
  CLOUDFLARE_API_TOKEN   Cloudflare API token for cache purging
  CLOUDFLARE_ZONE_ID     Cloudflare zone ID

Examples:
  $0 --github --build-first
  $0 --staging --production --cleanup
  $0 --s3 --dry-run
EOF
}

check_dependencies() {
    log_info "Checking deployment dependencies..."
    
    # Check for required tools
    local missing_tools=()
    
    if command -v git &> /dev/null; then
        log_info "✓ Git found"
    else
        missing_tools+=("git")
    fi
    
    if $DEPLOY_NETLIFY; then
        if command -v netlify &> /dev/null || command -v ntl &> /dev/null; then
            log_info "✓ Netlify CLI found"
        else
            missing_tools+=("netlify-cli")
            log_warning "Install: npm install -g netlify-cli"
        fi
    fi
    
    if $DEPLOY_S3; then
        if command -v aws &> /dev/null; then
            log_info "✓ AWS CLI found"
        else
            missing_tools+=("aws-cli")
            log_warning "Install: pip install awscli"
        fi
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "All dependencies satisfied"
}

validate_environment() {
    log_info "Validating deployment environment..."
    
    if $DEPLOY_NETLIFY; then
        if [ -z "$NETLIFY_AUTH_TOKEN" ] || [ -z "$NETLIFY_SITE_ID" ]; then
            log_error "Netlify deployment requires NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID"
            exit 1
        fi
    fi
    
    if $DEPLOY_S3; then
        if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$S3_BUCKET" ]; then
            log_error "S3 deployment requires AWS credentials and S3_BUCKET"
            exit 1
        fi
    fi
    
    log_success "Environment validation completed"
}

check_build() {
    log_info "Validating build..."
    
    if [ ! -d "$BUILD_DIR" ]; then
        if $BUILD_FIRST; then
            log_info "Building documentation..."
            ./scripts/build-docs.sh
        else
            log_error "Build directory not found: $BUILD_DIR"
            log_info "Use --build-first to build automatically"
            exit 1
        fi
    fi
    
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        log_error "Build seems incomplete. index.html not found in $BUILD_DIR"
        exit 1
    fi
    
    # Check build quality
    local total_files=$(find "$BUILD_DIR" -type f | wc -l)
    local html_files=$(find "$BUILD_DIR" -name "*.html" | wc -l)
    local asset_files=$(find "$BUILD_DIR" \( -name "*.css" -o -name "*.js" \) | wc -l)
    
    log_info "Build statistics:"
    echo "  - Total files: $total_files"
    echo "  - HTML files: $html_files"
    echo "  - Asset files: $asset_files"
    echo "  - Build size: $(du -sh "$BUILD_DIR" | cut -f1)"
    
    if [ "$html_files" -lt 5 ]; then
        log_warning "Build seems small (only $html_files HTML files)"
    fi
    
    log_success "Build validation completed"
}

run_pre_deployment_tests() {
    if $SKIP_CHECKS; then
        log_info "Skipping pre-deployment tests"
        return
    fi
    
    log_info "Running pre-deployment tests..."
    
    # Check for broken links
    if command -v linkchecker &> /dev/null; then
        log_info "Checking for broken links..."
        if ! linkchecker --check-extern "$BUILD_DIR/index.html"; then
            if ! $FORCE_DEPLOY; then
                log_error "Broken links found. Use --force to deploy anyway"
                exit 1
            else
                log_warning "Broken links found but continuing due to --force"
            fi
        fi
    fi
    
    # Validate HTML
    if command -v html5validator &> /dev/null; then
        log_info "Validating HTML..."
        if ! html5validator --root "$BUILD_DIR" --show-warnings; then
            if ! $FORCE_DEPLOY; then
                log_error "HTML validation failed. Use --force to deploy anyway"
                exit 1
            else
                log_warning "HTML validation failed but continuing due to --force"
            fi
        fi
    fi
    
    log_success "Pre-deployment tests completed"
}

deploy_github_pages() {
    log_deploy "Deploying to GitHub Pages..."
    
    # Save current branch
    local current_branch=$(git branch --show-current)
    
    # Setup deployment branch
    if git show-ref --verify --quiet refs/heads/$DEPLOYMENT_BRANCH; then
        git checkout $DEPLOYMENT_BRANCH
        git pull $REMOTE_NAME $DEPLOYMENT_BRANCH
    else
        if git ls-remote --heads $REMOTE_NAME $DEPLOYMENT_BRANCH | grep $DEPLOYMENT_BRANCH > /dev/null; then
            git checkout -b $DEPLOYMENT_BRANCH $REMOTE_NAME/$DEPLOYMENT_BRANCH
        else
            git checkout --orphan $DEPLOYMENT_BRANCH
            git rm -rf .
            echo "# MediaNest Documentation" > README.md
            git add README.md
            git commit -m "Initial deployment branch"
            git push -u $REMOTE_NAME $DEPLOYMENT_BRANCH
        fi
    fi
    
    # Clear branch content
    git rm -rf . 2>/dev/null || true
    
    # Copy built files
    cp -r "$BUILD_DIR"/* .
    
    # Add CNAME for custom domain
    if [ ! -z "$CUSTOM_DOMAIN" ]; then
        echo "$CUSTOM_DOMAIN" > CNAME
    fi
    
    # Add .nojekyll to prevent Jekyll processing
    touch .nojekyll
    
    # Create deployment commit
    git add .
    local commit_msg="Deploy documentation $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$commit_msg"
    
    if $DRY_RUN; then
        log_info "[DRY-RUN] Would push to $REMOTE_NAME/$DEPLOYMENT_BRANCH"
    else
        git push $REMOTE_NAME $DEPLOYMENT_BRANCH
        log_success "Deployed to GitHub Pages: https://$(basename $(git remote get-url origin) .git).github.io"
    fi
    
    # Return to original branch
    git checkout "$current_branch"
}

deploy_netlify() {
    log_deploy "Deploying to Netlify..."
    
    if $DRY_RUN; then
        log_info "[DRY-RUN] Would deploy to Netlify site: $NETLIFY_SITE_ID"
        return
    fi
    
    # Deploy using Netlify CLI
    if command -v netlify &> /dev/null; then
        netlify deploy --prod --dir="$BUILD_DIR" --site="$NETLIFY_SITE_ID" --auth="$NETLIFY_AUTH_TOKEN"
    elif command -v ntl &> /dev/null; then
        ntl deploy --prod --dir="$BUILD_DIR" --site="$NETLIFY_SITE_ID" --auth="$NETLIFY_AUTH_TOKEN"
    fi
    
    log_success "Deployed to Netlify"
}

deploy_s3() {
    log_deploy "Deploying to AWS S3..."
    
    if $DRY_RUN; then
        log_info "[DRY-RUN] Would sync to S3 bucket: $S3_BUCKET"
        aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" --dryrun
        return
    fi
    
    # Sync to S3
    aws s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" --delete
    
    # Set proper content types
    aws s3 cp "s3://$S3_BUCKET" "s3://$S3_BUCKET" --recursive \
        --exclude "*" --include "*.html" \
        --metadata-directive REPLACE \
        --content-type "text/html; charset=utf-8"
    
    aws s3 cp "s3://$S3_BUCKET" "s3://$S3_BUCKET" --recursive \
        --exclude "*" --include "*.css" \
        --metadata-directive REPLACE \
        --content-type "text/css"
    
    aws s3 cp "s3://$S3_BUCKET" "s3://$S3_BUCKET" --recursive \
        --exclude "*" --include "*.js" \
        --metadata-directive REPLACE \
        --content-type "application/javascript"
    
    log_success "Deployed to S3: s3://$S3_BUCKET"
    
    # Purge CloudFlare cache if configured
    if [ ! -z "$CLOUDFLARE_API_TOKEN" ] && [ ! -z "$CLOUDFLARE_ZONE_ID" ]; then
        log_info "Purging CloudFlare cache..."
        curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
             -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
             -H "Content-Type: application/json" \
             --data '{"purge_everything":true}' \
             --silent
        log_success "CloudFlare cache purged"
    fi
}

deploy_staging() {
    log_deploy "Deploying to staging environment..."
    
    if $DRY_RUN; then
        log_info "[DRY-RUN] Would deploy to staging: $STAGING_URL"
        return
    fi
    
    # Use rsync or scp based on staging setup
    if [ ! -z "$STAGING_HOST" ] && [ ! -z "$STAGING_PATH" ]; then
        rsync -avz --delete "$BUILD_DIR/" "$STAGING_HOST:$STAGING_PATH/"
        log_success "Deployed to staging: $STAGING_URL"
    else
        log_warning "Staging deployment not configured (missing STAGING_HOST or STAGING_PATH)"
    fi
}

deploy_production() {
    log_deploy "Deploying to production environment..."
    
    if $DRY_RUN; then
        log_info "[DRY-RUN] Would deploy to production: $DOCS_URL"
        return
    fi
    
    # Production deployment (customize based on your setup)
    if [ ! -z "$PRODUCTION_HOST" ] && [ ! -z "$PRODUCTION_PATH" ]; then
        rsync -avz --delete "$BUILD_DIR/" "$PRODUCTION_HOST:$PRODUCTION_PATH/"
        log_success "Deployed to production: $DOCS_URL"
    else
        log_warning "Production deployment not configured (missing PRODUCTION_HOST or PRODUCTION_PATH)"
    fi
}

post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    # Update search index if Algolia is configured
    if [ ! -z "$ALGOLIA_API_KEY" ] && [ ! -z "$ALGOLIA_INDEX_NAME" ]; then
        log_info "Updating search index..."
        # Add your search index update logic here
    fi
    
    # Send notifications
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        local message="📚 Documentation deployed successfully to production"
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"$message\"}" \
             "$SLACK_WEBHOOK" \
             --silent
    fi
    
    log_success "Post-deployment tasks completed"
}

cleanup() {
    if $CLEANUP; then
        log_info "Cleaning up temporary files..."
        # Add cleanup logic here
        log_success "Cleanup completed"
    fi
}

# Parse command line arguments
BUILD_FIRST=false
SKIP_CHECKS=false
FORCE_DEPLOY=false
DRY_RUN=false
CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --github)
            DEPLOY_GITHUB=true
            shift
            ;;
        --netlify)
            DEPLOY_NETLIFY=true
            shift
            ;;
        --s3)
            DEPLOY_S3=true
            shift
            ;;
        --staging)
            DEPLOY_STAGING=true
            shift
            ;;
        --production)
            DEPLOY_PRODUCTION=true
            shift
            ;;
        --build-first)
            BUILD_FIRST=true
            shift
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if any deployment target is specified
if ! $DEPLOY_GITHUB && ! $DEPLOY_NETLIFY && ! $DEPLOY_S3 && ! $DEPLOY_STAGING && ! $DEPLOY_PRODUCTION; then
    log_error "No deployment target specified"
    show_help
    exit 1
fi

# Main deployment process
main() {
    log_info "Starting enhanced documentation deployment..."
    
    if $DRY_RUN; then
        log_warning "Running in DRY-RUN mode - no actual deployment will occur"
    fi
    
    check_dependencies
    validate_environment
    check_build
    run_pre_deployment_tests
    
    # Deploy to specified targets
    if $DEPLOY_GITHUB; then
        deploy_github_pages
    fi
    
    if $DEPLOY_NETLIFY; then
        deploy_netlify
    fi
    
    if $DEPLOY_S3; then
        deploy_s3
    fi
    
    if $DEPLOY_STAGING; then
        deploy_staging
    fi
    
    if $DEPLOY_PRODUCTION; then
        deploy_production
    fi
    
    post_deployment_tasks
    cleanup
    
    log_success "Deployment completed successfully!"
}

# Run main function
main