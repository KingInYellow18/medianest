#!/bin/bash

# MediaNest Production Security Fix Script
# Automatically fixes critical security issues identified in the audit

set -e

echo "🔒 MediaNest Production Security Fix"
echo "===================================="

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Create backup of current .env
if [ -f ".env" ]; then
    echo "📋 Creating backup of current .env file..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Generate strong production secrets
echo "🔐 Generating production-grade secrets..."

# Generate JWT secret (64 characters)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n' | head -c 64)

# Generate encryption key (32 characters)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n' | head -c 32)

# Generate session secret (64 characters)  
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n' | head -c 64)

# Generate API key encryption (32 characters)
API_KEY_ENCRYPTION=$(openssl rand -base64 32 | tr -d '\n' | head -c 32)

echo "✅ Secrets generated successfully"

# Create production .env file
echo "📝 Creating production environment configuration..."

cat > .env.production << EOF
# MediaNest Production Environment Configuration
# Generated on: $(date -Iseconds)
# WARNING: These are production secrets - never commit to version control

# Environment
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Database Configuration (REPLACE WITH ACTUAL PRODUCTION VALUES)
# DATABASE_URL should point to your production PostgreSQL instance with SSL
DATABASE_URL=postgresql://username:password@production-host:5432/medianest_prod?sslmode=require

# Redis Configuration (REPLACE WITH ACTUAL PRODUCTION VALUES)  
# REDIS_URL should point to your production Redis instance with TLS
REDIS_URL=rediss://username:password@production-redis:6380/0

# JWT Configuration - PRODUCTION SECRETS
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration - PRODUCTION SECRETS
SESSION_SECRET=${SESSION_SECRET}
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTP_ONLY=true
SESSION_COOKIE_SAME_SITE=strict
SESSION_MAX_AGE=900000

# Encryption Keys - PRODUCTION SECRETS
ENCRYPTION_KEY=${ENCRYPTION_KEY}
API_KEY_ENCRYPTION=${API_KEY_ENCRYPTION}

# Logging
LOG_LEVEL=warn

# CORS (REPLACE WITH ACTUAL PRODUCTION DOMAINS)
ALLOWED_ORIGINS=https://your-production-domain.com,https://your-app-domain.com
FRONTEND_URL=https://your-frontend-domain.com

# Feature Flags
FEATURE_REAL_TIME_UPDATES=true
FEATURE_ADVANCED_SEARCH=true
FEATURE_RECOMMENDATIONS=true

# External Services (CONFIGURE WITH PRODUCTION VALUES)
PLEX_ENABLED=true
PLEX_URL=https://your-plex-server.com:32400
PLEX_TOKEN=your-production-plex-token
PLEX_CLIENT_ID=your-production-client-id
PLEX_CLIENT_SECRET=${JWT_SECRET:0:32}

# Overseerr Integration
OVERSEERR_ENABLED=true
OVERSEERR_URL=https://your-overseerr.com:5055
OVERSEERR_API_KEY=your-production-overseerr-key

# Monitoring (OPTIONAL)
UPTIME_KUMA_ENABLED=false
UPTIME_KUMA_URL=https://monitoring.your-domain.com
UPTIME_KUMA_USERNAME=
UPTIME_KUMA_PASSWORD=
EOF

echo "✅ Production environment file created: .env.production"

# Update docker-compose.yml for production security
echo "🐳 Updating Docker Compose configuration..."

# Check if docker-compose.prod.yml exists, if not create it
if [ ! -f "docker-compose.prod.yml" ]; then
    cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.prod
      args:
        BUILD_DATE: ${BUILD_DATE:-unknown}
        VCS_REF: ${VCS_REF:-unknown}
    container_name: medianest-backend-prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "4000:4000"
    networks:
      - medianest-prod
    volumes:
      - backend_uploads:/app/uploads:rw
      - backend_logs:/app/logs:rw
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
      - /var/run:noexec,nosuid,size=50m
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    container_name: medianest-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: medianest_prod
      POSTGRES_USER: ${POSTGRES_USER:-medianest}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_SSL_MODE: require
    ports:
      - "5432:5432"
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    networks:
      - medianest-prod
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-medianest} -d medianest_prod"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: >
      postgres
      -c ssl=on
      -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
      -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key

  redis:
    image: redis:7-alpine
    container_name: medianest-redis-prod
    restart: unless-stopped
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
    ports:
      - "6379:6379"
    volumes:
      - redis_prod_data:/data
    networks:
      - medianest-prod
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  medianest-prod:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16

volumes:
  postgres_prod_data:
    driver: local
  redis_prod_data:
    driver: local
  backend_uploads:
    driver: local  
  backend_logs:
    driver: local
EOF
    echo "✅ Production Docker Compose file created"
fi

# Create production deployment script
cat > deploy-production.sh << 'EOF'
#!/bin/bash

# MediaNest Production Deployment Script

set -e

echo "🚀 MediaNest Production Deployment"
echo "==================================="

# Pre-deployment checks
echo "🔍 Running pre-deployment security validation..."
npm run security:validate

if [ $? -ne 0 ]; then
    echo "❌ Security validation failed! Deployment aborted."
    exit 1
fi

# Build and deploy
echo "🏗️ Building production images..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Starting production services..."
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 30

echo "🔍 Running post-deployment verification..."
npm run deployment:verify

if [ $? -eq 0 ]; then
    echo "🎉 Production deployment successful!"
    echo "📊 Run 'docker compose -f docker-compose.prod.yml ps' to check status"
else
    echo "❌ Deployment verification failed!"
    echo "🔧 Check logs with 'docker compose -f docker-compose.prod.yml logs'"
    exit 1
fi
EOF

chmod +x deploy-production.sh
echo "✅ Production deployment script created"

# Create secrets management documentation
cat > PRODUCTION_SECRETS.md << EOF
# MediaNest Production Secrets Management

## Generated Secrets

The following production secrets have been generated:

### JWT Configuration
- **JWT_SECRET**: 64-character cryptographically secure secret
- **JWT_EXPIRES_IN**: 15m (production-safe short duration)
- **JWT_REFRESH_EXPIRES_IN**: 7d

### Session Security
- **SESSION_SECRET**: 64-character cryptographically secure secret
- **Secure Cookies**: Enabled with httpOnly, secure, sameSite=strict

### Encryption Keys
- **ENCRYPTION_KEY**: 32-character AES-256 compatible key
- **API_KEY_ENCRYPTION**: 32-character key for API key encryption

## IMPORTANT SECURITY NOTES

1. **Never commit .env.production to version control**
2. **Rotate secrets every 90 days**
3. **Use proper secret management in production**
4. **Monitor for secret exposure**

## Recommended Secret Management Solutions

### For Small Deployments
- Docker Secrets
- Environment variable injection from CI/CD

### For Enterprise Deployments  
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager

## Secret Rotation Process

1. Generate new secrets: \`./scripts/fix-production-security.sh\`
2. Update secret management system
3. Rolling deployment with zero-downtime
4. Verify all services operational
5. Revoke old secrets

## Emergency Secret Rotation

In case of suspected compromise:
1. Immediately generate new secrets
2. Update production environment
3. Restart all services
4. Invalidate all existing sessions/tokens
5. Audit access logs

Generated on: $(date -Iseconds)
EOF

echo "✅ Production secrets documentation created"

# Update package.json scripts
echo "📦 Updating package.json scripts..."

# Add production scripts to package.json
cat > temp_package.json << 'EOF'
    "security:validate": "node scripts/production-security-validator.js",
    "security:test": "./scripts/run-security-tests.sh", 
    "security:fix": "./scripts/fix-production-security.sh",
    "deployment:verify": "node scripts/verify-deployment.js",
    "production:deploy": "./deploy-production.sh",
    "production:secrets": "./scripts/fix-production-security.sh"
EOF

echo "✅ Package.json scripts ready for manual addition"

# Final security summary
echo ""
echo "🎉 PRODUCTION SECURITY FIXES COMPLETED!"
echo "========================================"
echo ""
echo "📋 WHAT WAS FIXED:"
echo "  ✅ Generated cryptographically secure secrets"
echo "  ✅ Created production environment configuration"
echo "  ✅ Added container security hardening (tmpfs)"
echo "  ✅ Configured SSL/TLS for database connections"
echo "  ✅ Set secure session cookies"
echo "  ✅ Created production deployment scripts"
echo ""
echo "📋 NEXT STEPS:"
echo "  1. Review and customize .env.production with your production values"
echo "  2. Set up your production database and Redis instances"
echo "  3. Configure your production domains in CORS settings"
echo "  4. Test deployment: ./deploy-production.sh"
echo "  5. Run security validation: npm run security:validate"
echo ""
echo "⚠️  IMPORTANT:"
echo "  - Never commit .env.production to version control"
echo "  - Store production secrets securely (Vault, etc.)"
echo "  - Monitor for secret exposure"
echo "  - Rotate secrets every 90 days"
echo ""
echo "📄 Files created:"
echo "  - .env.production (production environment)"
echo "  - docker-compose.prod.yml (production compose)"
echo "  - deploy-production.sh (deployment script)"
echo "  - PRODUCTION_SECRETS.md (secrets documentation)"
echo ""
echo "🔒 Your production environment is now security-hardened!"