#!/bin/bash

# MediaNest Secret Generation Utility
# Generates secure secrets for different environments
# Usage: ./scripts/generate-secrets.sh [environment] [--output-file]

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
OUTPUT_FILE="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# Secret generation functions
generate_base64_secret() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d '\n'
}

generate_hex_secret() {
    local length="${1:-32}"
    openssl rand -hex "$length"
}

generate_alphanumeric_secret() {
    local length="${1:-16}"
    openssl rand -base64 "$((length * 2))" | tr -d '/+=' | cut -c1-"$length"
}

generate_password() {
    local length="${1:-16}"
    openssl rand -base64 "$((length * 2))" | tr -d '/+' | head -c "$length"
}

# Generate environment-specific secrets
generate_secrets() {
    local env="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    echo "🔐 MediaNest Secret Generator"
    echo "=============================="
    echo ""
    log_info "Generating secrets for: $env environment"
    log_info "Generation timestamp: $(date)"
    echo ""
    
    case "$env" in
        "development")
            generate_development_secrets
            ;;
        "staging")
            generate_staging_secrets
            ;;
        "production")
            generate_production_secrets
            ;;
        *)
            log_error "Invalid environment: $env"
            echo "Usage: $0 [development|staging|production] [output-file]"
            exit 1
            ;;
    esac
    
    echo ""
    log_warning "SECURITY WARNINGS:"
    echo "• Store these secrets securely and never commit them to version control"
    echo "• Use different secrets for each environment"
    echo "• Rotate secrets regularly (at least quarterly)"
    echo "• Use a secret management service in production"
    echo ""
    
    if [[ "$env" == "production" ]]; then
        echo "🔒 PRODUCTION SECURITY REQUIREMENTS:"
        echo "• All secrets MUST be at least 32 characters"
        echo "• Use Docker secrets or equivalent secret management"
        echo "• Enable SSL/HTTPS for all external communication"
        echo "• Configure automated secret rotation"
        echo "• Audit secret access regularly"
        echo ""
    fi
}

generate_development_secrets() {
    echo "# Development Environment Secrets"
    echo "# Safe for local development - NOT FOR PRODUCTION USE"
    echo ""
    echo "# Authentication Secrets"
    echo "JWT_SECRET=dev_$(generate_alphanumeric_secret 32)_$(date +%s)"
    echo "NEXTAUTH_SECRET=dev_$(generate_alphanumeric_secret 32)_$(date +%s)"
    echo "ENCRYPTION_KEY=dev_$(generate_alphanumeric_secret 32)_$(date +%s)"
    echo "SESSION_SECRET=dev_$(generate_alphanumeric_secret 32)_$(date +%s)"
    echo ""
    echo "# Database Credentials (Development)"
    echo "POSTGRES_PASSWORD=$(generate_password 16)"
    echo "REDIS_PASSWORD=  # Optional for development"
    echo ""
    echo "# Admin Bootstrap (Development)"
    echo "ADMIN_PASSWORD=dev123"  # Weak password for development
    echo ""
    echo "# Plex Integration (Development)"
    echo "PLEX_CLIENT_ID=MediaNest-Development"
    echo "PLEX_CLIENT_SECRET=dev_$(generate_alphanumeric_secret 24)"
    echo ""
    echo "# Optional Service Keys (Development)"
    echo "YOUTUBE_API_KEY=  # Add your development YouTube API key"
    echo "TMDB_API_KEY=     # Add your development TMDB API key"
}

generate_staging_secrets() {
    echo "# Staging Environment Secrets"
    echo "# Production-like secrets for staging deployment"
    echo ""
    echo "# Authentication Secrets (UNIQUE FOR STAGING)"
    echo "JWT_SECRET=$(generate_base64_secret 32)"
    echo "NEXTAUTH_SECRET=$(generate_base64_secret 32)"
    echo "ENCRYPTION_KEY=$(generate_base64_secret 32)"
    echo "SESSION_SECRET=$(generate_base64_secret 32)"
    echo ""
    echo "# Database Credentials (Staging)"
    echo "POSTGRES_PASSWORD=$(generate_password 24)"
    echo "REDIS_PASSWORD=$(generate_password 24)"
    echo ""
    echo "# Security Tokens"
    echo "METRICS_TOKEN=$(generate_base64_secret 24)"
    echo ""
    echo "# Admin Bootstrap (Staging)"
    echo "ADMIN_PASSWORD=Staging_$(generate_password 12)_$(date +%m%d)"
    echo ""
    echo "# Plex Integration (Staging)"
    echo "PLEX_CLIENT_ID=REPLACE_WITH_STAGING_CLIENT_ID"
    echo "PLEX_CLIENT_SECRET=$(generate_base64_secret 24)"
    echo ""
    echo "# External Service Keys (Staging)"
    echo "YOUTUBE_API_KEY=REPLACE_WITH_STAGING_YOUTUBE_KEY"
    echo "TMDB_API_KEY=REPLACE_WITH_STAGING_TMDB_KEY"
    echo ""
    echo "# Email Configuration (Staging)"
    echo "SMTP_PASSWORD=$(generate_password 16)"
}

generate_production_secrets() {
    echo "# Production Environment Secrets"
    echo "# HIGH SECURITY - Store in secure secret management system"
    echo ""
    echo "# Authentication Secrets (CRITICAL - UNIQUE FOR PRODUCTION)"
    echo "JWT_SECRET=$(generate_base64_secret 48)"
    echo "NEXTAUTH_SECRET=$(generate_base64_secret 48)"
    echo "ENCRYPTION_KEY=$(generate_base64_secret 48)"
    echo "SESSION_SECRET=$(generate_base64_secret 48)"
    echo ""
    echo "# Database Credentials (Production)"
    echo "POSTGRES_PASSWORD=$(generate_password 32)"
    echo "REDIS_PASSWORD=$(generate_password 32)"
    echo ""
    echo "# Security Tokens"
    echo "METRICS_TOKEN=$(generate_base64_secret 32)"
    echo ""
    echo "# Admin Bootstrap (Production - CHANGE IMMEDIATELY AFTER FIRST LOGIN)"
    echo "ADMIN_PASSWORD=Production_$(generate_password 16)_$(date +%Y%m)"
    echo ""
    echo "# Plex Integration (Production)"
    echo "PLEX_CLIENT_ID=REPLACE_WITH_PRODUCTION_CLIENT_ID"
    echo "PLEX_CLIENT_SECRET=$(generate_base64_secret 32)"
    echo ""
    echo "# External Service Keys (Production)"
    echo "YOUTUBE_API_KEY=REPLACE_WITH_PRODUCTION_YOUTUBE_KEY"
    echo "TMDB_API_KEY=REPLACE_WITH_PRODUCTION_TMDB_KEY"
    echo ""
    echo "# Email Configuration (Production)"
    echo "SMTP_PASSWORD=REPLACE_WITH_PRODUCTION_SMTP_PASSWORD"
    echo ""
    echo "# Docker Secrets (Production)"
    echo "# Store these in Docker secrets or equivalent secure storage:"
    echo ""
    echo "# docker secret create jwt_secret -"
    echo "# docker secret create database_password -"
    echo "# docker secret create redis_password -"
    echo "# docker secret create encryption_key -"
}

# Save secrets to file if specified
save_to_file() {
    local env="$1"
    local output_file="$2"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local filename="${output_file:-secrets_${env}_${timestamp}.env}"
    
    log_info "Saving secrets to: $filename"
    
    # Generate secrets to file
    {
        generate_secrets "$env" 2>/dev/null
    } > "$filename"
    
    # Set restrictive permissions
    chmod 600 "$filename"
    
    log_success "Secrets saved to: $filename"
    log_warning "File permissions set to 600 (owner read/write only)"
    
    # Add to .gitignore if not already present
    if [[ -f "$PROJECT_ROOT/.gitignore" ]] && ! grep -q "secrets_.*\.env" "$PROJECT_ROOT/.gitignore"; then
        echo "secrets_*.env" >> "$PROJECT_ROOT/.gitignore"
        log_info "Added secrets_*.env to .gitignore"
    fi
}

# Validate OpenSSL availability
validate_requirements() {
    if ! command -v openssl >/dev/null 2>&1; then
        log_error "OpenSSL is required but not installed"
        echo "Install OpenSSL:"
        echo "  Ubuntu/Debian: sudo apt-get install openssl"
        echo "  macOS: brew install openssl"
        echo "  Windows: Use WSL or install OpenSSL for Windows"
        exit 1
    fi
    
    # Check OpenSSL version
    local openssl_version=$(openssl version)
    log_info "Using: $openssl_version"
}

# Show usage information
show_usage() {
    echo "MediaNest Secret Generation Utility"
    echo ""
    echo "Usage:"
    echo "  $0 [environment] [output-file]"
    echo ""
    echo "Environments:"
    echo "  development  - Development secrets with weak security (default for local)"
    echo "  staging      - Staging secrets with production-like security"
    echo "  production   - Production secrets with maximum security"
    echo ""
    echo "Examples:"
    echo "  $0 development                    # Generate development secrets to stdout"
    echo "  $0 staging staging_secrets.env    # Generate staging secrets to file"
    echo "  $0 production                     # Generate production secrets to stdout"
    echo ""
    echo "Security Notes:"
    echo "  • Development secrets are prefixed and safe for local use"
    echo "  • Staging and production secrets are cryptographically secure"
    echo "  • All secrets are unique and generated with OpenSSL"
    echo "  • Files are created with restrictive permissions (600)"
}

# Docker secrets helper
generate_docker_secrets() {
    local env="$1"
    echo ""
    echo "🐳 Docker Secrets Commands for $env:"
    echo "=================================="
    echo ""
    
    if [[ "$env" == "production" ]]; then
        echo "# Create Docker secrets (run these commands in your Docker environment):"
        echo "echo '$(generate_base64_secret 48)' | docker secret create jwt_secret -"
        echo "echo '$(generate_base64_secret 48)' | docker secret create nextauth_secret -"  
        echo "echo '$(generate_base64_secret 48)' | docker secret create encryption_key -"
        echo "echo '$(generate_password 32)' | docker secret create database_password -"
        echo "echo '$(generate_password 32)' | docker secret create redis_password -"
        echo ""
        echo "# Verify secrets were created:"
        echo "docker secret ls"
        echo ""
        echo "# Use in docker-compose.yml:"
        echo "secrets:"
        echo "  jwt_secret:"
        echo "    external: true"
        echo "  database_password:"
        echo "    external: true"
        echo "  # ... etc"
    else
        echo "Docker secrets are recommended for production only."
        echo "For $env environment, use environment variables."
    fi
}

# Main function
main() {
    local show_help=false
    local generate_docker=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help=true
                shift
                ;;
            --docker)
                generate_docker=true
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Show help if requested
    if [[ "$show_help" == true ]]; then
        show_usage
        exit 0
    fi
    
    # Validate requirements
    validate_requirements
    
    # Get environment and output file
    local environment="${1:-production}"
    local output_file="${2:-}"
    
    # Generate secrets
    if [[ -n "$output_file" ]]; then
        save_to_file "$environment" "$output_file"
    else
        generate_secrets "$environment"
    fi
    
    # Generate Docker secrets if requested
    if [[ "$generate_docker" == true ]]; then
        generate_docker_secrets "$environment"
    fi
}

# Run main function
main "$@"
