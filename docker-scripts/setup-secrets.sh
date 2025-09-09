#!/bin/bash
# MediaNest Docker Secrets Setup Script
# Creates and manages Docker secrets for production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SECRETS_DIR="${HOME}/.medianest/secrets"
SECRET_PREFIX="medianest"
SECRET_VERSION="v2"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Function to generate secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $((length * 3 / 4)) | tr -d "=+/" | cut -c1-${length}
}

# Function to create Docker secret
create_docker_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local full_name="${SECRET_PREFIX}_${secret_name}_${SECRET_VERSION}"
    
    # Check if secret already exists
    if docker secret ls --format "{{.Name}}" | grep -q "^${full_name}$"; then
        warn "Secret ${full_name} already exists, skipping..."
        return 0
    fi
    
    # Create the secret
    echo -n "$secret_value" | docker secret create "$full_name" -
    success "Created Docker secret: ${full_name}"
}

# Function to backup secret to file
backup_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local backup_file="${SECRETS_DIR}/${secret_name}.secret"
    
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
    
    echo -n "$secret_value" > "$backup_file"
    chmod 600 "$backup_file"
    
    log "Backed up secret to: ${backup_file}"
}

# Function to prompt for secret value
prompt_for_secret() {
    local secret_name="$1"
    local description="$2"
    local default_length="$3"
    local secret_value=""
    
    echo
    log "Setting up: ${secret_name}"
    log "Description: ${description}"
    
    read -p "Enter value (leave empty to generate ${default_length}-char random): " secret_value
    
    if [[ -z "$secret_value" ]]; then
        secret_value=$(generate_secret "$default_length")
        log "Generated random value for ${secret_name}"
    fi
    
    echo "$secret_value"
}

# Function to setup all secrets interactively
setup_secrets_interactive() {
    log "Starting interactive Docker secrets setup..."
    
    # PostgreSQL password
    POSTGRES_PASSWORD=$(prompt_for_secret "postgres_password" "PostgreSQL database password" 32)
    create_docker_secret "postgres_password" "$POSTGRES_PASSWORD"
    backup_secret "postgres_password" "$POSTGRES_PASSWORD"
    
    # Redis password
    REDIS_PASSWORD=$(prompt_for_secret "redis_password" "Redis cache password" 32)
    create_docker_secret "redis_password" "$REDIS_PASSWORD"
    backup_secret "redis_password" "$REDIS_PASSWORD"
    
    # NextAuth secret
    NEXTAUTH_SECRET=$(prompt_for_secret "nextauth_secret" "NextAuth.js secret for JWT signing" 64)
    create_docker_secret "nextauth_secret" "$NEXTAUTH_SECRET"
    backup_secret "nextauth_secret" "$NEXTAUTH_SECRET"
    
    # JWT secret
    JWT_SECRET=$(prompt_for_secret "jwt_secret" "Application JWT secret" 64)
    create_docker_secret "jwt_secret" "$JWT_SECRET"
    backup_secret "jwt_secret" "$JWT_SECRET"
    
    # Encryption key
    ENCRYPTION_KEY=$(prompt_for_secret "encryption_key" "Data encryption key (32 characters required)" 32)
    create_docker_secret "encryption_key" "$ENCRYPTION_KEY"
    backup_secret "encryption_key" "$ENCRYPTION_KEY"
    
    # Plex Client ID
    echo
    log "Plex integration requires manual setup:"
    log "1. Go to https://www.plex.tv/claim/"
    log "2. Create an app and get your Client ID and Secret"
    PLEX_CLIENT_ID=$(prompt_for_secret "plex_client_id" "Plex application client ID" 0)
    if [[ -n "$PLEX_CLIENT_ID" ]]; then
        create_docker_secret "plex_client_id" "$PLEX_CLIENT_ID"
        backup_secret "plex_client_id" "$PLEX_CLIENT_ID"
    fi
    
    # Plex Client Secret
    PLEX_CLIENT_SECRET=$(prompt_for_secret "plex_client_secret" "Plex application client secret" 0)
    if [[ -n "$PLEX_CLIENT_SECRET" ]]; then
        create_docker_secret "plex_client_secret" "$PLEX_CLIENT_SECRET"
        backup_secret "plex_client_secret" "$PLEX_CLIENT_SECRET"
    fi
}

# Function to generate all secrets automatically
setup_secrets_auto() {
    log "Starting automatic Docker secrets setup..."
    
    # Generate all secrets
    POSTGRES_PASSWORD=$(generate_secret 32)
    REDIS_PASSWORD=$(generate_secret 32)
    NEXTAUTH_SECRET=$(generate_secret 64)
    JWT_SECRET=$(generate_secret 64)
    ENCRYPTION_KEY=$(generate_secret 32)
    
    # Create Docker secrets
    create_docker_secret "postgres_password" "$POSTGRES_PASSWORD"
    create_docker_secret "redis_password" "$REDIS_PASSWORD"
    create_docker_secret "nextauth_secret" "$NEXTAUTH_SECRET"
    create_docker_secret "jwt_secret" "$JWT_SECRET"
    create_docker_secret "encryption_key" "$ENCRYPTION_KEY"
    
    # Backup secrets
    backup_secret "postgres_password" "$POSTGRES_PASSWORD"
    backup_secret "redis_password" "$REDIS_PASSWORD"
    backup_secret "nextauth_secret" "$NEXTAUTH_SECRET"
    backup_secret "jwt_secret" "$JWT_SECRET"
    backup_secret "encryption_key" "$ENCRYPTION_KEY"
    
    warn "Plex integration secrets not created (require manual setup)"
    log "You can add them later with: docker secret create"
}

# Function to list existing secrets
list_secrets() {
    log "Current MediaNest Docker secrets:"
    docker secret ls --filter "name=${SECRET_PREFIX}_" --format "table {{.ID}}\t{{.Name}}\t{{.CreatedAt}}"
}

# Function to remove all secrets
remove_secrets() {
    log "Removing all MediaNest Docker secrets..."
    
    docker secret ls --filter "name=${SECRET_PREFIX}_" --format "{{.Name}}" | while read -r secret_name; do
        if [[ -n "$secret_name" ]]; then
            docker secret rm "$secret_name"
            success "Removed secret: $secret_name"
        fi
    done
}

# Function to show help
show_help() {
    cat << EOF
MediaNest Docker Secrets Setup

Usage: $0 [OPTION]

Options:
    -i, --interactive    Setup secrets interactively (default)
    -a, --auto          Setup secrets automatically with generated values
    -l, --list          List existing secrets
    -r, --remove        Remove all MediaNest secrets
    -h, --help          Show this help message

Examples:
    $0                  # Interactive setup
    $0 --auto          # Automatic setup
    $0 --list          # List secrets
    
Note: Secrets are backed up to ${SECRETS_DIR}
EOF
}

# Function to check prerequisites
check_prerequisites() {
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running or accessible"
        exit 1
    fi
    
    # Check if running in swarm mode for secrets
    if ! docker node ls > /dev/null 2>&1; then
        warn "Docker swarm mode not detected. Initializing..."
        docker swarm init --advertise-addr 127.0.0.1 || {
            error "Failed to initialize Docker swarm"
            exit 1
        }
        success "Docker swarm initialized"
    fi
    
    # Check for required tools
    if ! command -v openssl &> /dev/null; then
        error "OpenSSL is required but not installed"
        exit 1
    fi
}

# Main function
main() {
    case "${1:-interactive}" in
        -i|--interactive|interactive)
            check_prerequisites
            setup_secrets_interactive
            ;;
        -a|--auto|auto)
            check_prerequisites
            setup_secrets_auto
            ;;
        -l|--list|list)
            list_secrets
            ;;
        -r|--remove|remove)
            read -p "Are you sure you want to remove all MediaNest secrets? (y/N): " -r
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                remove_secrets
            else
                log "Operation cancelled"
            fi
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"