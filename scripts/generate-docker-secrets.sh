#!/bin/bash

# MediaNest Docker Secrets Generator
# This script generates secure secrets for production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SECRETS_DIR="./secrets"
BACKUP_DIR="./secrets/backup-$(date +%Y%m%d-%H%M%S)"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate a secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -hex "$length"
}

# Function to generate a secure password
generate_password() {
    local length=${1:-16}
    openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
}

# Function to create secrets directory
create_secrets_dir() {
    if [[ -d "$SECRETS_DIR" ]]; then
        print_warning "Secrets directory already exists. Creating backup..."
        mkdir -p "$BACKUP_DIR"
        cp -r "$SECRETS_DIR"/* "$BACKUP_DIR"/ 2>/dev/null || true
        print_info "Backup created at: $BACKUP_DIR"
    fi
    
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
}

# Function to write secret to file
write_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local file_path="$SECRETS_DIR/$secret_name"
    
    echo -n "$secret_value" > "$file_path"
    chmod 600 "$file_path"
    print_success "Generated: $secret_name"
}

# Function to prompt for user input
prompt_for_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    local is_secret="${4:-false}"
    
    if [[ "$is_secret" == "true" ]]; then
        echo -n "$prompt: "
        read -s input_value
        echo
    else
        echo -n "$prompt [$default_value]: "
        read input_value
    fi
    
    if [[ -z "$input_value" ]]; then
        input_value="$default_value"
    fi
    
    declare -g "$var_name=$input_value"
}

# Main function
main() {
    print_info "MediaNest Docker Secrets Generator"
    print_info "=================================="
    echo
    
    # Check dependencies
    if ! command -v openssl &> /dev/null; then
        print_error "openssl is required but not installed."
        exit 1
    fi
    
    # Create secrets directory
    create_secrets_dir
    
    print_info "Generating application secrets..."
    
    # Generate core application secrets
    write_secret "nextauth_secret" "$(generate_secret 32)"
    write_secret "jwt_secret" "$(generate_secret 32)"
    write_secret "encryption_key" "$(generate_secret 32)"
    
    # Generate database secrets
    print_info "Generating database secrets..."
    DB_PASSWORD=$(generate_password 32)
    write_secret "postgres_password" "$DB_PASSWORD"
    
    # Prompt for database configuration
    prompt_for_input "Database host" DB_HOST "postgres"
    prompt_for_input "Database port" DB_PORT "5432"
    prompt_for_input "Database name" DB_NAME "medianest"
    prompt_for_input "Database user" DB_USER "medianest"
    
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?connection_limit=20&pool_timeout=30"
    write_secret "database_url" "$DATABASE_URL"
    
    # Generate Redis secrets
    print_info "Generating Redis secrets..."
    REDIS_PASSWORD=$(generate_password 32)
    write_secret "redis_password" "$REDIS_PASSWORD"
    
    prompt_for_input "Redis host" REDIS_HOST "redis"
    prompt_for_input "Redis port" REDIS_PORT "6379"
    
    REDIS_URL="redis://:$REDIS_PASSWORD@$REDIS_HOST:$REDIS_PORT"
    write_secret "redis_url" "$REDIS_URL"
    
    # Prompt for Plex OAuth secrets
    print_info "Configuring Plex OAuth..."
    prompt_for_input "Plex Client ID" PLEX_CLIENT_ID "MediaNest"
    prompt_for_input "Plex Client Secret" PLEX_CLIENT_SECRET "" true
    
    if [[ -z "$PLEX_CLIENT_SECRET" ]]; then
        print_warning "Plex Client Secret not provided. You can set this later."
        PLEX_CLIENT_SECRET="PLACEHOLDER-SET-IN-ADMIN-UI"
    fi
    
    write_secret "plex_client_id" "$PLEX_CLIENT_ID"
    write_secret "plex_client_secret" "$PLEX_CLIENT_SECRET"
    
    # Optional external service secrets
    print_info "Configuring external services (optional)..."
    
    prompt_for_input "Overseerr API Key (optional)" OVERSEERR_API_KEY ""
    if [[ -n "$OVERSEERR_API_KEY" ]]; then
        write_secret "overseerr_api_key" "$OVERSEERR_API_KEY"
    else
        write_secret "overseerr_api_key" "PLACEHOLDER-SET-IN-ADMIN-UI"
    fi
    
    prompt_for_input "Uptime Kuma Token (optional)" UPTIME_KUMA_TOKEN ""
    if [[ -n "$UPTIME_KUMA_TOKEN" ]]; then
        write_secret "uptime_kuma_token" "$UPTIME_KUMA_TOKEN"
    else
        write_secret "uptime_kuma_token" "PLACEHOLDER-SET-IN-ADMIN-UI"
    fi
    
    # Create environment file for non-secret variables
    print_info "Creating production environment file..."
    cat > .env.prod << EOF
# MediaNest Production Environment
# Generated on $(date)

# Application
NODE_ENV=production
USE_DOCKER_SECRETS=true
DOCKER_SECRETS_PATH=/run/secrets

# Server
PORT=4000
HOST=0.0.0.0
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com

# API Configuration
API_PREFIX=/api
API_VERSION=v1

# JWT Configuration
JWT_ISSUER=medianest
JWT_AUDIENCE=medianest-api
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_API_REQUESTS=100
RATE_LIMIT_API_WINDOW=60
RATE_LIMIT_YOUTUBE_REQUESTS=5
RATE_LIMIT_YOUTUBE_WINDOW=3600
RATE_LIMIT_MEDIA_REQUESTS=20
RATE_LIMIT_MEDIA_WINDOW=3600

# YouTube Configuration
YOUTUBE_DOWNLOAD_PATH=/app/youtube
YOUTUBE_MAX_CONCURRENT_DOWNLOADS=3
YOUTUBE_RATE_LIMIT=5

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

# Logging
LOG_LEVEL=info

# Frontend URLs (update with your domain)
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_BACKEND_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com
NEXT_PUBLIC_APP_NAME=MediaNest
NEXT_PUBLIC_APP_VERSION=1.0.0

# Monitoring
HEALTH_CHECK_INTERVAL=30000
EOF

    # Set permissions
    chmod 600 .env.prod
    
    # Create secrets verification script
    cat > scripts/verify-secrets.sh << 'EOF'
#!/bin/bash
# Verify all required secrets exist

SECRETS_DIR="./secrets"
REQUIRED_SECRETS=(
    "database_url"
    "postgres_password"
    "redis_url" 
    "redis_password"
    "nextauth_secret"
    "jwt_secret"
    "encryption_key"
    "plex_client_id"
    "plex_client_secret"
    "overseerr_api_key"
    "uptime_kuma_token"
)

echo "Verifying Docker secrets..."
missing_secrets=()

for secret in "${REQUIRED_SECRETS[@]}"; do
    if [[ ! -f "$SECRETS_DIR/$secret" ]]; then
        missing_secrets+=("$secret")
    else
        echo "✓ $secret"
    fi
done

if [[ ${#missing_secrets[@]} -gt 0 ]]; then
    echo
    echo "Missing secrets:"
    for secret in "${missing_secrets[@]}"; do
        echo "✗ $secret"
    done
    exit 1
else
    echo
    echo "All secrets verified!"
fi
EOF

    chmod +x scripts/verify-secrets.sh
    
    print_success "Docker secrets generated successfully!"
    echo
    print_info "Next steps:"
    echo "1. Review the generated secrets in: $SECRETS_DIR"
    echo "2. Update .env.prod with your actual domain and URLs"
    echo "3. Configure your Plex OAuth app with the correct redirect URLs"
    echo "4. Run: docker-compose -f docker-compose.prod.yml up -d"
    echo "5. Access the admin UI to configure external services"
    echo
    print_warning "Security reminders:"
    echo "- Keep the secrets directory secure and never commit it to version control"
    echo "- Change the default admin password after first login"
    echo "- Consider using a proper secrets management system for enhanced security"
    echo "- Backup your secrets securely"
}

# Run main function
main "$@"