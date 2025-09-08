#!/bin/bash
# MediaNest Production Secrets Setup Script
# Creates Docker secrets directory structure and generates sample files

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# Function to generate a random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 "${length}" | tr -d '\n'
}

# Main script
print_status "Setting up MediaNest production secrets"

# Create secrets directory
SECRETS_DIR="./secrets"
if [[ ! -d "${SECRETS_DIR}" ]]; then
    print_status "Creating secrets directory..."
    mkdir -p "${SECRETS_DIR}"
    chmod 700 "${SECRETS_DIR}"
    print_success "Created secrets directory"
else
    print_warning "Secrets directory already exists"
fi

# Function to create a secret file
create_secret() {
    local name=$1
    local value=$2
    local file="${SECRETS_DIR}/${name}"
    
    if [[ ! -f "${file}" ]]; then
        echo -n "${value}" > "${file}"
        chmod 600 "${file}"
        print_success "Created ${name}"
    else
        print_warning "${name} already exists, skipping"
    fi
}

# Generate secrets
print_status "Generating secrets..."

# Database secrets
POSTGRES_PASSWORD=$(generate_secret 32)
create_secret "postgres_password" "${POSTGRES_PASSWORD}"
create_secret "database_url" "postgresql://medianest:${POSTGRES_PASSWORD}@postgres:5432/medianest?schema=public"

# Redis secrets
REDIS_PASSWORD=$(generate_secret 32)
create_secret "redis_password" "${REDIS_PASSWORD}"
create_secret "redis_url" "redis://:${REDIS_PASSWORD}@redis:6379"

# Application secrets
create_secret "nextauth_secret" "$(generate_secret 32)"
create_secret "jwt_secret" "$(generate_secret 32)"
create_secret "encryption_key" "$(generate_secret 32)"

# OAuth secrets (placeholders)
create_secret "plex_client_id" "YOUR_PLEX_CLIENT_ID"
create_secret "plex_client_secret" "YOUR_PLEX_CLIENT_SECRET"

# Create .gitignore for secrets
if [[ ! -f "${SECRETS_DIR}/.gitignore" ]]; then
    echo "*" > "${SECRETS_DIR}/.gitignore"
    echo "!.gitignore" >> "${SECRETS_DIR}/.gitignore"
    print_success "Created secrets .gitignore"
fi

print_status "Secrets setup complete!"
print_warning "Remember to update the following files with real values:"
echo "  - ${SECRETS_DIR}/plex_client_id"
echo "  - ${SECRETS_DIR}/plex_client_secret"

print_status "To view a secret:"
echo "  cat ${SECRETS_DIR}/secret_name"

print_warning "IMPORTANT: Never commit the secrets directory to version control!"