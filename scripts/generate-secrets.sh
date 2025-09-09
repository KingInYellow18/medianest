#!/bin/bash
# MediaNest Production Secrets Generator
# Generates cryptographically secure secrets for production deployment
#
# Usage: ./scripts/generate-secrets.sh [--overwrite] [--dry-run]
#
# Options:
#   --overwrite    Overwrite existing secrets (DANGEROUS)
#   --dry-run      Show what would be generated without creating files
#   --help         Show this help message
#
# Version: 2.0.0

set -e

# Configuration
SECRETS_DIR="secrets"
REQUIRED_SECRETS=(
    "postgres_password"
    "redis_password" 
    "jwt_secret"
    "nextauth_secret"
    "encryption_key"
    "database_url"
    "redis_url"
)

# Optional secrets (created only if requested)
OPTIONAL_SECRETS=(
    "plex_client_id"
    "plex_client_secret"
    "grafana_password"
    "metrics_token"
    "backup_encryption_key"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
OVERWRITE=false
DRY_RUN=false

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Show usage
show_usage() {
    cat << EOF
MediaNest Production Secrets Generator

Usage: $0 [OPTIONS]

This script generates cryptographically secure secrets for MediaNest production deployment.
All secrets are generated using OpenSSL and appropriate randomization techniques.

Options:
  --overwrite    Overwrite existing secrets (DANGEROUS - will replace all existing secrets)
  --dry-run      Show what would be generated without creating files
  --help, -h     Show this help message

Generated Secrets:
  postgres_password      32-character strong database password
  redis_password         32-character strong Redis password  
  jwt_secret            64-character hex JWT signing secret
  nextauth_secret       64-character hex NextAuth secret
  encryption_key        64-character hex application encryption key
  database_url          Complete PostgreSQL connection URL
  redis_url            Complete Redis connection URL
  
Optional Secrets (created on request):
  plex_client_id        Placeholder for Plex OAuth client ID
  plex_client_secret    Placeholder for Plex OAuth client secret
  grafana_password      16-character Grafana admin password
  metrics_token         32-character metrics endpoint token
  backup_encryption_key 64-character backup encryption key

Security Features:
  - Uses OpenSSL random number generator
  - Removes problematic characters from passwords
  - Sets secure file permissions (600)
  - Validates secret strength
  - Creates backup of existing secrets before overwrite

Examples:
  $0                    # Generate missing secrets only
  $0 --dry-run         # Preview what would be generated
  $0 --overwrite       # Replace all existing secrets (DANGEROUS)

For more information, see README_DEPLOYMENT.md
EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --overwrite)
                OVERWRITE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check OpenSSL
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is required but not installed"
        exit 1
    fi
    
    # Check OpenSSL version (need 1.0+)
    local openssl_version
    openssl_version=$(openssl version | cut -d' ' -f2 | cut -d'.' -f1-2)
    log_info "Using OpenSSL version: $(openssl version)"
    
    # Check if running from project root
    if [[ ! -f "package.json" ]]; then
        log_error "This script must be run from the MediaNest project root directory"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Generate secure password
generate_password() {
    local length=$1
    local charset=${2:-'A-Za-z0-9'}
    
    # Generate password using OpenSSL, removing problematic characters
    openssl rand -base64 $((length * 2)) | tr -cd "$charset" | cut -c1-$length
}

# Generate hex secret
generate_hex_secret() {
    local length=$1
    openssl rand -hex $length
}

# Validate secret strength
validate_secret_strength() {
    local secret=$1
    local min_length=$2
    local secret_type=$3
    
    if [[ ${#secret} -lt $min_length ]]; then
        log_error "$secret_type is too short: ${#secret} characters (minimum: $min_length)"
        return 1
    fi
    
    # Check for sufficient entropy (basic check)
    local unique_chars
    unique_chars=$(echo "$secret" | fold -w1 | sort -u | wc -l)
    
    if [[ $unique_chars -lt 8 ]]; then
        log_warn "$secret_type may have low entropy (only $unique_chars unique characters)"
    fi
    
    return 0
}

# Create secrets directory
create_secrets_directory() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create secrets directory: $SECRETS_DIR"
        return
    fi
    
    if [[ ! -d "$SECRETS_DIR" ]]; then
        mkdir -p "$SECRETS_DIR"
        chmod 700 "$SECRETS_DIR"
        log_success "Created secrets directory: $SECRETS_DIR"
    else
        # Ensure correct permissions
        chmod 700 "$SECRETS_DIR"
        log_info "Using existing secrets directory: $SECRETS_DIR"
    fi
}

# Backup existing secrets
backup_existing_secrets() {
    if [[ "$DRY_RUN" == "true" ]]; then
        if [[ -d "$SECRETS_DIR" ]] && [[ "$(ls -A $SECRETS_DIR 2>/dev/null)" ]]; then
            log_info "[DRY RUN] Would backup existing secrets"
        fi
        return
    fi
    
    if [[ -d "$SECRETS_DIR" ]] && [[ "$(ls -A $SECRETS_DIR 2>/dev/null)" ]]; then
        local backup_dir="${SECRETS_DIR}-backup-$(date +%Y%m%d_%H%M%S)"
        cp -r "$SECRETS_DIR" "$backup_dir"
        chmod -R 600 "$backup_dir"/*
        log_success "Existing secrets backed up to: $backup_dir"
    fi
}

# Check if secret exists
secret_exists() {
    local secret_name=$1
    [[ -f "$SECRETS_DIR/$secret_name" ]] && [[ -s "$SECRETS_DIR/$secret_name" ]]
}

# Generate individual secret
generate_secret() {
    local secret_name=$1
    local secret_value=$2
    local file_path="$SECRETS_DIR/$secret_name"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would generate: $secret_name"
        echo "[DRY RUN] Content preview (first 16 chars): ${secret_value:0:16}..."
        return
    fi
    
    # Write secret to file
    echo "$secret_value" > "$file_path"
    chmod 600 "$file_path"
    
    log_success "Generated: $secret_name (${#secret_value} characters)"
}

# Generate database password
generate_postgres_password() {
    local secret_name="postgres_password"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating PostgreSQL password..."
    local password
    password=$(generate_password 32 'A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?')
    
    if validate_secret_strength "$password" 20 "PostgreSQL password"; then
        generate_secret "$secret_name" "$password"
    else
        log_error "Failed to generate secure PostgreSQL password"
        return 1
    fi
}

# Generate Redis password
generate_redis_password() {
    local secret_name="redis_password"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating Redis password..."
    local password
    password=$(generate_password 32 'A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?')
    
    if validate_secret_strength "$password" 20 "Redis password"; then
        generate_secret "$secret_name" "$password"
    else
        log_error "Failed to generate secure Redis password"
        return 1
    fi
}

# Generate JWT secret
generate_jwt_secret() {
    local secret_name="jwt_secret"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating JWT secret..."
    local secret
    secret=$(generate_hex_secret 32)
    
    if validate_secret_strength "$secret" 64 "JWT secret"; then
        generate_secret "$secret_name" "$secret"
    else
        log_error "Failed to generate secure JWT secret"
        return 1
    fi
}

# Generate NextAuth secret
generate_nextauth_secret() {
    local secret_name="nextauth_secret"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating NextAuth secret..."
    local secret
    secret=$(generate_hex_secret 32)
    
    if validate_secret_strength "$secret" 64 "NextAuth secret"; then
        generate_secret "$secret_name" "$secret"
    else
        log_error "Failed to generate secure NextAuth secret"
        return 1
    fi
}

# Generate encryption key
generate_encryption_key() {
    local secret_name="encryption_key"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating application encryption key..."
    local key
    key=$(generate_hex_secret 32)
    
    if validate_secret_strength "$key" 64 "Encryption key"; then
        generate_secret "$secret_name" "$key"
    else
        log_error "Failed to generate secure encryption key"
        return 1
    fi
}

# Generate database URL
generate_database_url() {
    local secret_name="database_url"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating database URL..."
    
    # Get password from file or generate new one
    local password_file="$SECRETS_DIR/postgres_password"
    if [[ ! -f "$password_file" ]]; then
        log_error "PostgreSQL password not found. Generate postgres_password first."
        return 1
    fi
    
    local password
    password=$(cat "$password_file")
    
    # URL encode the password to handle special characters
    local encoded_password
    encoded_password=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$password', safe=''))" 2>/dev/null || echo "$password")
    
    local database_url="postgresql://medianest:${encoded_password}@postgres:5432/medianest?sslmode=prefer&connection_limit=20&pool_timeout=30"
    
    generate_secret "$secret_name" "$database_url"
}

# Generate Redis URL
generate_redis_url() {
    local secret_name="redis_url"
    
    if secret_exists "$secret_name" && [[ "$OVERWRITE" == "false" ]]; then
        log_info "Skipping $secret_name (already exists)"
        return
    fi
    
    log_info "Generating Redis URL..."
    
    # Get password from file or generate new one
    local password_file="$SECRETS_DIR/redis_password"
    if [[ ! -f "$password_file" ]]; then
        log_error "Redis password not found. Generate redis_password first."
        return 1
    fi
    
    local password
    password=$(cat "$password_file")
    
    # URL encode the password to handle special characters
    local encoded_password
    encoded_password=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$password', safe=''))" 2>/dev/null || echo "$password")
    
    local redis_url="redis://:${encoded_password}@redis:6379"
    
    generate_secret "$secret_name" "$redis_url"
}

# Generate optional secrets
generate_optional_secrets() {
    local generate_optional=false
    
    if [[ "$DRY_RUN" == "false" ]]; then
        read -p "Generate optional secrets (Grafana, metrics, etc.)? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            generate_optional=true
        fi
    else
        log_info "[DRY RUN] Optional secrets would be prompted for in real run"
        return
    fi
    
    if [[ "$generate_optional" == "true" ]]; then
        # Generate Grafana password
        if ! secret_exists "grafana_password" || [[ "$OVERWRITE" == "true" ]]; then
            local grafana_password
            grafana_password=$(generate_password 16 'A-Za-z0-9')
            generate_secret "grafana_password" "$grafana_password"
        fi
        
        # Generate metrics token
        if ! secret_exists "metrics_token" || [[ "$OVERWRITE" == "true" ]]; then
            local metrics_token
            metrics_token=$(generate_hex_secret 16)
            generate_secret "metrics_token" "$metrics_token"
        fi
        
        # Generate backup encryption key
        if ! secret_exists "backup_encryption_key" || [[ "$OVERWRITE" == "true" ]]; then
            local backup_key
            backup_key=$(generate_hex_secret 32)
            generate_secret "backup_encryption_key" "$backup_key"
        fi
        
        # Create placeholder files for Plex OAuth (user needs to fill these)
        if ! secret_exists "plex_client_id" || [[ "$OVERWRITE" == "true" ]]; then
            generate_secret "plex_client_id" "REPLACE_WITH_YOUR_PLEX_CLIENT_ID"
        fi
        
        if ! secret_exists "plex_client_secret" || [[ "$OVERWRITE" == "true" ]]; then
            generate_secret "plex_client_secret" "REPLACE_WITH_YOUR_PLEX_CLIENT_SECRET"
        fi
    fi
}

# Verify generated secrets
verify_secrets() {
    log_info "Verifying generated secrets..."
    
    local errors=0
    
    for secret in "${REQUIRED_SECRETS[@]}"; do
        local file_path="$SECRETS_DIR/$secret"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would verify: $secret"
            continue
        fi
        
        if [[ ! -f "$file_path" ]]; then
            log_error "Missing secret file: $secret"
            ((errors++))
            continue
        fi
        
        if [[ ! -s "$file_path" ]]; then
            log_error "Empty secret file: $secret"
            ((errors++))
            continue
        fi
        
        # Check file permissions
        local perms
        perms=$(stat -c "%a" "$file_path")
        if [[ "$perms" != "600" ]]; then
            log_warn "Secret file $secret has permissions $perms, should be 600"
            chmod 600 "$file_path"
        fi
        
        # Basic content validation
        local content
        content=$(cat "$file_path")
        
        case "$secret" in
            *_password)
                if [[ ${#content} -lt 16 ]]; then
                    log_error "Password $secret is too short: ${#content} characters"
                    ((errors++))
                fi
                ;;
            *_secret|*_key)
                if [[ ${#content} -lt 32 ]]; then
                    log_error "Secret $secret is too short: ${#content} characters"
                    ((errors++))
                fi
                ;;
            database_url)
                if [[ ! "$content" =~ ^postgresql:// ]]; then
                    log_error "Database URL format is invalid"
                    ((errors++))
                fi
                ;;
            redis_url)
                if [[ ! "$content" =~ ^redis:// ]]; then
                    log_error "Redis URL format is invalid"
                    ((errors++))
                fi
                ;;
        esac
    done
    
    if [[ $errors -eq 0 ]]; then
        log_success "All secrets verified successfully"
    else
        log_error "Found $errors error(s) in generated secrets"
        return 1
    fi
}

# Display summary
display_summary() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Summary of what would be generated:"
    else
        log_success "🎉 Secret generation completed successfully!"
        echo
        log_info "📁 Secrets location: $SECRETS_DIR/"
        log_info "🔒 File permissions: 600 (owner read-only)"
    fi
    
    echo
    echo "Generated secrets:"
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            echo "  - $secret"
        else
            local file_path="$SECRETS_DIR/$secret"
            if [[ -f "$file_path" ]]; then
                local size
                size=$(stat -c%s "$file_path")
                echo "  ✅ $secret ($size bytes)"
            else
                echo "  ❌ $secret (missing)"
            fi
        fi
    done
    
    if [[ "$DRY_RUN" == "false" ]]; then
        echo
        log_warn "🚨 IMPORTANT SECURITY NOTES:"
        echo "   - Never commit these secrets to version control"
        echo "   - Keep secrets directory permissions at 700"
        echo "   - Keep secret files permissions at 600"
        echo "   - Rotate secrets regularly in production"
        echo "   - Use proper secrets management in production (AWS Secrets Manager, etc.)"
        echo
        log_info "📚 Next steps:"
        echo "   1. Review and update .env.production with your domain and settings"
        echo "   2. If using Plex, update plex_client_id and plex_client_secret files"
        echo "   3. Run: ./scripts/deployment-automation.sh validate"
        echo "   4. Run: ./scripts/deployment-automation.sh deploy"
    fi
}

# Main execution
main() {
    echo "🔐 MediaNest Production Secrets Generator"
    echo "========================================"
    echo
    
    # Parse arguments
    parse_arguments "$@"
    
    # Check prerequisites
    check_prerequisites
    
    # Create secrets directory
    create_secrets_directory
    
    # Backup existing secrets if overwriting
    if [[ "$OVERWRITE" == "true" ]]; then
        backup_existing_secrets
    fi
    
    # Generate secrets
    log_info "Generating cryptographically secure secrets..."
    echo
    
    generate_postgres_password
    generate_redis_password
    generate_jwt_secret
    generate_nextauth_secret
    generate_encryption_key
    generate_database_url
    generate_redis_url
    
    # Generate optional secrets
    generate_optional_secrets
    
    # Verify all secrets
    verify_secrets
    
    # Display summary
    display_summary
}

# Execute main function with all arguments
main "$@"