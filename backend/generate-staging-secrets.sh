#!/bin/bash

# Generate secure secrets for staging environment
echo "# MediaNest Staging Environment Configuration"
echo "# Generated: $(date)"
echo "# SECURITY: These are staging-specific secrets"
echo ""

# Generate secure random secrets
echo "# Core Security Secrets"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_SECRET_ROTATION=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo ""

echo "# Database Configuration"
echo "DATABASE_URL=postgresql://medianest_staging:$(openssl rand -base64 16)@localhost:5432/medianest_staging"
echo ""

echo "# Redis Configuration"
echo "REDIS_PASSWORD=$(openssl rand -base64 16)"
echo "REDIS_URL=redis://default:$(openssl rand -base64 16)@localhost:6379"
echo ""

echo "# Monitoring"
echo "METRICS_TOKEN=$(openssl rand -base64 24)"
echo ""

echo "# Application Settings"
echo "NODE_ENV=production"
echo "PORT=3001"
echo "FRONTEND_URL=https://staging.medianest.com"
echo "ALLOWED_ORIGINS=https://staging.medianest.com,http://localhost:3001"
echo ""

echo "# Plex Configuration (staging)"
echo "PLEX_TOKEN=<your-staging-plex-token>"
echo "PLEX_SERVER_URL=http://staging-plex:32400"
echo "PLEX_ENABLED=true"
echo ""

echo "# External Services (use development keys)"
echo "YOUTUBE_API_KEY=<staging-youtube-key>"
echo "TMDB_API_KEY=<staging-tmdb-key>"
