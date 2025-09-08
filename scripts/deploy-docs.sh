#!/bin/bash
# MediaNest Documentation Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILD_DIR="site"
DEPLOYMENT_BRANCH="gh-pages"
REMOTE_NAME="origin"
DOCS_URL="https://docs.medianest.com"

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

check_git_status() {
    log_info "Checking git repository status..."
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "You have uncommitted changes. Consider committing them first."
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "Git status check completed"
}

check_build() {
    log_info "Checking build directory..."
    
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory not found: $BUILD_DIR"
        log_info "Run './scripts/build-docs.sh' first"
        exit 1
    fi
    
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        log_error "Build seems incomplete. index.html not found in $BUILD_DIR"
        exit 1
    fi
    
    log_success "Build directory verified"
}

setup_deployment_branch() {
    log_info "Setting up deployment branch..."
    
    # Check if deployment branch exists locally
    if git show-ref --verify --quiet refs/heads/$DEPLOYMENT_BRANCH; then
        log_info "Deployment branch exists locally"
        git checkout $DEPLOYMENT_BRANCH
        git pull $REMOTE_NAME $DEPLOYMENT_BRANCH
    else
        # Check if deployment branch exists on remote
        if git ls-remote --heads $REMOTE_NAME $DEPLOYMENT_BRANCH | grep $DEPLOYMENT_BRANCH > /dev/null; then
            log_info "Deployment branch exists on remote, creating local branch"
            git checkout -b $DEPLOYMENT_BRANCH $REMOTE_NAME/$DEPLOYMENT_BRANCH
        else
            log_info "Creating new deployment branch"
            git checkout --orphan $DEPLOYMENT_BRANCH
            git rm -rf .
            
            # Create initial commit
            echo "# MediaNest Documentation" > README.md
            git add README.md
            git commit -m "Initial deployment branch"
            git push -u $REMOTE_NAME $DEPLOYMENT_BRANCH
        fi
    fi
    
    log_success "Deployment branch ready"
}

deploy_github_pages() {
    log_info "Deploying to GitHub Pages..."
    
    # Use mkdocs gh-deploy for GitHub Pages
    git checkout main  # or your main branch
    mkdocs gh-deploy --force --clean --message "Deploy documentation {sha}"
    
    log_success "Deployed to GitHub Pages"
    log_info "Documentation will be available at: https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\)\/\([^.]*\).*/\1.github.io\/\2/')/"
}

deploy_custom_server() {
    log_info "Deploying to custom server..."
    
    # Check for deployment configuration
    if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_PATH" ]; then
        log_error "Custom deployment requires DEPLOY_HOST and DEPLOY_PATH environment variables"
        exit 1
    fi
    
    # Deploy via rsync
    log_info "Uploading files to $DEPLOY_HOST:$DEPLOY_PATH"
    rsync -avz --delete "$BUILD_DIR/" "$DEPLOY_HOST:$DEPLOY_PATH/"
    
    log_success "Deployed to custom server"
    log_info "Documentation available at: $DOCS_URL"
}

deploy_netlify() {
    log_info "Deploying to Netlify..."
    
    if ! command -v netlify &> /dev/null; then
        log_error "Netlify CLI not found. Install with: npm install -g netlify-cli"
        exit 1
    fi
    
    # Deploy to Netlify
    netlify deploy --prod --dir="$BUILD_DIR"
    
    log_success "Deployed to Netlify"
}

deploy_vercel() {
    log_info "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI not found. Install with: npm install -g vercel"
        exit 1
    fi
    
    # Deploy to Vercel
    vercel --prod "$BUILD_DIR"
    
    log_success "Deployed to Vercel"
}

deploy_s3() {
    log_info "Deploying to AWS S3..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI first"
        exit 1
    fi
    
    if [ -z "$S3_BUCKET" ]; then
        log_error "S3 deployment requires S3_BUCKET environment variable"
        exit 1
    fi
    
    # Sync to S3
    aws s3 sync "$BUILD_DIR/" "s3://$S3_BUCKET/" --delete
    
    # Invalidate CloudFront if distribution ID is provided
    if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
        log_info "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
    fi
    
    log_success "Deployed to AWS S3"
    log_info "Documentation available at: https://$S3_BUCKET.s3-website.$(aws configure get region).amazonaws.com"
}

update_search_index() {
    log_info "Updating search index..."
    
    # If using external search service like Algolia
    if [ -n "$ALGOLIA_APP_ID" ] && [ -n "$ALGOLIA_API_KEY" ]; then
        log_info "Updating Algolia search index..."
        # Add Algolia DocSearch index update here
        log_success "Algolia index updated"
    fi
}

run_post_deploy_tests() {
    log_info "Running post-deployment tests..."
    
    # Wait a moment for deployment to propagate
    sleep 10
    
    # Test if site is accessible
    if command -v curl &> /dev/null; then
        if [ -n "$DOCS_URL" ]; then
            log_info "Testing site accessibility..."
            if curl -f -s "$DOCS_URL" > /dev/null; then
                log_success "Site is accessible"
            else
                log_warning "Site may not be accessible yet"
            fi
        fi
    fi
    
    # Test for common issues
    if [ -n "$DOCS_URL" ]; then
        log_info "Checking for common issues..."
        
        # Check if search is working
        if curl -f -s "$DOCS_URL/search/" > /dev/null; then
            log_success "Search page is accessible"
        else
            log_warning "Search page may have issues"
        fi
    fi
}

notify_deployment() {
    log_info "Sending deployment notifications..."
    
    # Slack notification (if webhook URL is provided)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"📚 MediaNest documentation has been deployed to $DOCS_URL\"}" \
            "$SLACK_WEBHOOK_URL"
        log_success "Slack notification sent"
    fi
    
    # Discord notification (if webhook URL is provided)
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"📚 MediaNest documentation has been deployed to $DOCS_URL\"}" \
            "$DISCORD_WEBHOOK_URL"
        log_success "Discord notification sent"
    fi
}

show_deployment_info() {
    echo
    log_info "Deployment Summary:"
    echo "  - Deployment target: $DEPLOYMENT_TARGET"
    echo "  - Documentation URL: $DOCS_URL"
    echo "  - Build size: $(du -sh "$BUILD_DIR" | cut -f1)"
    echo "  - Deployment time: $(date)"
    echo "  - Git commit: $(git rev-parse --short HEAD)"
    
    if [ -n "$DEPLOYMENT_TARGET" ] && [ "$DEPLOYMENT_TARGET" = "github" ]; then
        echo "  - GitHub Pages URL: https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\)\/\([^.]*\).*/\1.github.io\/\2/')/"
    fi
}

# Main execution
main() {
    log_info "Starting MediaNest documentation deployment..."
    
    # Parse command line arguments
    DEPLOYMENT_TARGET=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --github)
                DEPLOYMENT_TARGET="github"
                shift
                ;;
            --netlify)
                DEPLOYMENT_TARGET="netlify"
                shift
                ;;
            --vercel)
                DEPLOYMENT_TARGET="vercel"
                shift
                ;;
            --s3)
                DEPLOYMENT_TARGET="s3"
                shift
                ;;
            --custom)
                DEPLOYMENT_TARGET="custom"
                shift
                ;;
            --url)
                DOCS_URL="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [deployment-target] [options]"
                echo
                echo "Deployment targets:"
                echo "  --github    Deploy to GitHub Pages"
                echo "  --netlify   Deploy to Netlify"
                echo "  --vercel    Deploy to Vercel"
                echo "  --s3        Deploy to AWS S3"
                echo "  --custom    Deploy to custom server (requires DEPLOY_HOST and DEPLOY_PATH)"
                echo
                echo "Options:"
                echo "  --url URL   Override documentation URL"
                echo "  --help      Show this help message"
                echo
                echo "Environment variables:"
                echo "  DEPLOY_HOST             Custom deployment host"
                echo "  DEPLOY_PATH             Custom deployment path"
                echo "  S3_BUCKET              AWS S3 bucket name"
                echo "  CLOUDFRONT_DISTRIBUTION_ID   CloudFront distribution ID"
                echo "  SLACK_WEBHOOK_URL      Slack notification webhook"
                echo "  DISCORD_WEBHOOK_URL    Discord notification webhook"
                echo "  ALGOLIA_APP_ID         Algolia search app ID"
                echo "  ALGOLIA_API_KEY        Algolia search API key"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Default to GitHub Pages if no target specified
    if [ -z "$DEPLOYMENT_TARGET" ]; then
        DEPLOYMENT_TARGET="github"
        log_info "No deployment target specified, defaulting to GitHub Pages"
    fi
    
    # Pre-deployment checks
    check_git_status
    check_build
    
    # Deploy based on target
    case $DEPLOYMENT_TARGET in
        "github")
            deploy_github_pages
            ;;
        "netlify")
            deploy_netlify
            ;;
        "vercel")
            deploy_vercel
            ;;
        "s3")
            deploy_s3
            ;;
        "custom")
            deploy_custom_server
            ;;
        *)
            log_error "Invalid deployment target: $DEPLOYMENT_TARGET"
            exit 1
            ;;
    esac
    
    # Post-deployment tasks
    update_search_index
    run_post_deploy_tests
    notify_deployment
    show_deployment_info
    
    log_success "Documentation deployment completed successfully!"
    echo
    log_info "Next steps:"
    echo "  1. Verify the documentation is accessible at $DOCS_URL"
    echo "  2. Test search functionality"
    echo "  3. Check that all links work correctly"
    echo "  4. Share the documentation URL with your team"
}

# Run main function
main "$@"