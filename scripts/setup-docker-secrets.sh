#!/bin/bash

# MediaNest Docker Secrets Setup Script
# Creates and manages Docker secrets for secure deployment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔐 MediaNest Docker Secrets Setup"
echo "================================"

# Check if Docker is running and swarm is initialized
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Initialize Docker Swarm if not already initialized
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q active; then
    echo "🔄 Initializing Docker Swarm..."
    docker swarm init --advertise-addr $(hostname -I | awk '{print $1}') || {
        echo "⚠️ Swarm initialization failed, trying with default interface..."
        docker swarm init
    }
fi

# Function to generate secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to create Docker secret
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"
    
    if docker secret inspect "$secret_name" >/dev/null 2>&1; then
        echo "⚠️ Secret $secret_name already exists, skipping..."
        return 0
    fi
    
    echo "$secret_value" | docker secret create "$secret_name" - --label "description=$description"
    echo "✅ Created secret: $secret_name"
}

echo
echo "🔑 Generating and creating Docker secrets..."
echo

# Database secrets
create_secret "medianest_postgres_db_v1" "medianest" "PostgreSQL database name"
create_secret "medianest_postgres_user_v1" "medianest_user" "PostgreSQL username"
create_secret "medianest_postgres_password_v1" "$(generate_secret 24)" "PostgreSQL password"

# Redis secret
create_secret "medianest_redis_password_v1" "$(generate_secret 32)" "Redis authentication password"

# Application secrets
create_secret "medianest_jwt_secret_v1" "$(generate_secret 64)" "JWT signing secret"
create_secret "medianest_encryption_key_v1" "$(generate_secret 32)" "Application encryption key"
create_secret "medianest_nextauth_secret_v1" "$(generate_secret 64)" "NextAuth.js secret"

# Plex integration secrets (if provided via environment)
if [[ -n "${PLEX_CLIENT_ID:-}" ]]; then
    create_secret "medianest_plex_client_id_v1" "$PLEX_CLIENT_ID" "Plex client ID"
else
    create_secret "medianest_plex_client_id_v1" "placeholder-plex-client-id" "Plex client ID (placeholder)"
fi

if [[ -n "${PLEX_CLIENT_SECRET:-}" ]]; then
    create_secret "medianest_plex_client_secret_v1" "$PLEX_CLIENT_SECRET" "Plex client secret"
else
    create_secret "medianest_plex_client_secret_v1" "placeholder-plex-client-secret" "Plex client secret (placeholder)"
fi

echo
echo "📋 Docker Secrets Summary"
echo "========================"
docker secret ls --filter label=description --format "table {{.Name}}\t{{.CreatedAt}}\t{{.Labels}}"

echo
echo "✅ All Docker secrets have been created successfully!"
echo
echo "🔄 Next Steps:"
echo "1. Use docker-compose.secure.yml for secure deployment"
echo "2. Update Plex secrets if needed: ./scripts/update-plex-secrets.sh"
echo "3. Deploy with: docker stack deploy -c docker-compose.secure.yml medianest"
echo
echo "🛡️ Security Notes:"
echo "- All secrets are stored securely in Docker Swarm"
echo "- Secrets are mounted as files in containers (/run/secrets/)"
echo "- Application must be updated to read secrets from files"
echo "- To rotate secrets, create new versions and update compose file"