#!/bin/bash

# MediaNest Secure Secrets Generator
# Usage: ./scripts/generate-secrets.sh [environment]
# Environments: development, staging, production

set -euo pipefail

ENVIRONMENT=${1:-development}
OUTPUT_FILE=".env.${ENVIRONMENT}"

if [ "$ENVIRONMENT" == "development" ]; then
  OUTPUT_FILE=".env"
fi

echo "🔐 Generating secure secrets for ${ENVIRONMENT} environment..."

cat > "${OUTPUT_FILE}" << EOL
# MediaNest ${ENVIRONMENT^} Environment Configuration
# Generated: $(date)
# SECURITY WARNING: Never commit this file to version control

# ============================================================================
# CORE SECURITY SECRETS - Unique per environment
# ============================================================================

# JWT signing secret (32+ characters)
JWT_SECRET=$(openssl rand -base64 32)

# JWT rotation key for graceful secret rotation
JWT_SECRET_ROTATION=$(openssl rand -base64 32)

# Application encryption key for sensitive data
ENCRYPTION_KEY=$(openssl rand -base64 32)

# NextAuth secret for session management
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

# PostgreSQL connection string
DATABASE_URL=postgresql://medianest_${ENVIRONMENT}:$(openssl rand -base64 16 | tr -d "=+/")@localhost:5432/medianest_${ENVIRONMENT}

# ============================================================================
# REDIS CONFIGURATION
# ============================================================================

REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")
REDIS_URL=redis://default:\${REDIS_PASSWORD}@localhost:6379

# ============================================================================
# APPLICATION SETTINGS
# ============================================================================

NODE_ENV=${ENVIRONMENT}
PORT=3000

EOL

if [ "$ENVIRONMENT" == "staging" ]; then
  cat >> "${OUTPUT_FILE}" << EOL
FRONTEND_URL=https://staging.medianest.com
ALLOWED_ORIGINS=https://staging.medianest.com,http://localhost:3001
EOL
elif [ "$ENVIRONMENT" == "production" ]; then
  cat >> "${OUTPUT_FILE}" << EOL
FRONTEND_URL=https://medianest.com
ALLOWED_ORIGINS=https://medianest.com,https://www.medianest.com
EOL
else
  cat >> "${OUTPUT_FILE}" << EOL
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
EOL
fi

cat >> "${OUTPUT_FILE}" << EOL

# ============================================================================
# MONITORING & METRICS
# ============================================================================

METRICS_TOKEN=$(openssl rand -base64 24)

# ============================================================================
# EXTERNAL SERVICES - Add your own keys
# ============================================================================

# Plex Media Server
PLEX_TOKEN=<your-${ENVIRONMENT}-plex-token>
PLEX_SERVER_URL=http://localhost:32400
PLEX_ENABLED=false

# YouTube Data API
YOUTUBE_API_KEY=<your-${ENVIRONMENT}-youtube-api-key>

# The Movie Database
TMDB_API_KEY=<your-${ENVIRONMENT}-tmdb-api-key>

# Overseerr (optional)
OVERSEERR_ENABLED=false
OVERSEERR_URL=<your-overseerr-url>
OVERSEERR_API_KEY=<your-overseerr-api-key>

# Uptime Kuma (optional)
UPTIME_KUMA_ENABLED=false
UPTIME_KUMA_URL=<your-uptime-kuma-url>
UPTIME_KUMA_USERNAME=<your-username>
UPTIME_KUMA_PASSWORD=<your-password>
EOL

echo "✅ Secure secrets generated and saved to ${OUTPUT_FILE}"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "1. Never commit ${OUTPUT_FILE} to version control"
echo "2. Replace placeholder values (<your-...>) with actual service keys"
echo "3. Store production secrets in a secure secret management system"
echo "4. Rotate secrets regularly, especially after security incidents"
echo ""
echo "📋 Next steps:"
echo "1. Review and update service-specific keys in ${OUTPUT_FILE}"
echo "2. Set appropriate file permissions: chmod 600 ${OUTPUT_FILE}"
echo "3. For production, use environment variables or secret management tools"
