# MediaNest Configuration Guide

**Version:** 2.0  
**Date:** September 2025  
**Status:** Active - Post-Cleanup Configuration  

## Overview

MediaNest uses environment variables for configuration. After recent cleanup and improvements, configuration is more streamlined but still flexible. This guide covers all configuration options with examples and best practices.

## Configuration Files

### Main Configuration Files
- **`.env`** - Backend and shared configuration
- **`frontend/.env.local`** - Frontend-specific configuration  
- **`docker-compose.yml`** - Container configuration
- **`config/`** - Advanced configuration files

### Environment Validation

MediaNest validates configuration on startup:
- ✅ Required variables checked
- ✅ Secret strength validated
- ✅ Database connectivity tested
- ✅ External service connectivity verified

## Core Configuration

### Security Configuration

**Critical**: These must be configured before first run

```bash
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-chars
JWT_ISSUER=medianest
JWT_AUDIENCE=medianest-users

# Optional JWT rotation (for zero-downtime key rotation)
JWT_SECRET_ROTATION=your-rotation-secret-minimum-32-chars

# Encryption for sensitive data storage
ENCRYPTION_KEY=your-encryption-key-minimum-32-chars

# NextAuth (Frontend)
NEXTAUTH_SECRET=your-nextauth-secret-minimum-32-chars
NEXTAUTH_URL=http://localhost:3000
```

**Generate Secure Secrets:**
```bash
# Strong JWT secret
openssl rand -base64 48

# Strong encryption key  
openssl rand -base64 32

# NextAuth secret
openssl rand -base64 32
```

### Database Configuration

```bash
# Primary database (required)
DATABASE_URL=postgresql://username:password@host:5432/medianest

# Example configurations:
# Local development
DATABASE_URL=postgresql://medianest:medianest@localhost:5432/medianest

# Docker development
DATABASE_URL=postgresql://medianest:medianest@postgres:5432/medianest

# Production (use connection pooling)
DATABASE_URL=postgresql://user:pass@prod-db:5432/medianest?ssl=true&connection_limit=10
```

### Redis Configuration (Optional but Recommended)

```bash
# Basic Redis
REDIS_URL=redis://localhost:6379

# Redis with password
REDIS_URL=redis://username:password@localhost:6379

# Redis with database selection
REDIS_URL=redis://localhost:6379/1

# Disable Redis (will use in-memory caching)
# REDIS_URL=  # Leave empty or comment out
```

### Server Configuration

```bash
# Application settings
NODE_ENV=development  # development | production | test
PORT=3000            # Backend port
FRONTEND_PORT=3000   # Frontend port (for dev mode)

# CORS and security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Trust proxy (for production behind reverse proxy)
TRUST_PROXY=false  # Set to true if behind nginx/cloudflare
```

## Plex Integration

### Required Plex Configuration

```bash
# Backend (.env)
PLEX_TOKEN=your-plex-token-here
PLEX_SERVER_URL=http://your-plex-server:32400
PLEX_ENABLED=true

# Default token for public content (optional)
PLEX_DEFAULT_TOKEN=public-content-token

# Frontend (frontend/.env.local)
AUTH_PLEX_CLIENT_ID=MediaNest
PLEX_CLIENT_IDENTIFIER=your-unique-uuid-here  # Generate with uuidgen
```

### Getting Plex Configuration

**1. Get Plex Token:**
- Log into Plex Web App
- Open browser developer tools
- Go to any API call and look for `X-Plex-Token` header
- Or visit: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/

**2. Generate Client Identifier:**
```bash
# Linux/Mac
uuidgen

# Or online: https://www.uuidgenerator.net/
```

**3. Verify Plex Connection:**
```bash
# Test Plex connectivity
curl -H "X-Plex-Token: YOUR_TOKEN" http://your-plex-server:32400/identity
```

## External Service Integrations

### Overseerr Integration

```bash
# Enable Overseerr integration
OVERSEERR_ENABLED=true
OVERSEERR_URL=http://localhost:5055
OVERSEERR_API_KEY=your-overseerr-api-key

# Disable Overseerr
OVERSEERR_ENABLED=false
```

**Getting Overseerr API Key:**
1. Log into Overseerr web interface
2. Go to Settings → General  
3. Copy the API Key

### Uptime Kuma Integration

```bash
# Enable Uptime Kuma integration
UPTIME_KUMA_ENABLED=true
UPTIME_KUMA_URL=http://localhost:3001
UPTIME_KUMA_USERNAME=your-username
UPTIME_KUMA_PASSWORD=your-password

# Disable Uptime Kuma
UPTIME_KUMA_ENABLED=false
```

### YouTube Integration (Optional)

```bash
# YouTube Data API (for metadata)
YOUTUBE_API_KEY=your-youtube-api-key

# The Movie Database (for enhanced metadata)  
TMDB_API_KEY=your-tmdb-api-key
```

**Getting API Keys:**
- **YouTube**: https://console.developers.google.com/
- **TMDB**: https://www.themoviedb.org/settings/api

## Advanced Configuration

### Logging Configuration

```bash
# Log level (error | warn | info | debug)
LOG_LEVEL=info

# Log format (json | simple | combined)
LOG_FORMAT=json

# Log to file (optional)
LOG_FILE=logs/medianest.log

# Database logging for security events
SECURITY_LOG_TO_DB=true
```

### Performance Configuration

```bash
# Rate limiting
RATE_LIMIT_MAX=100      # Requests per window
RATE_LIMIT_WINDOW=900   # Window in seconds (15 minutes)

# Session management  
SESSION_TIMEOUT=3600    # Session timeout in seconds (1 hour)
SESSION_CLEANUP=true    # Auto-cleanup expired sessions

# Cache settings
CACHE_TTL=300          # Default cache TTL (5 minutes)
CACHE_MAX_SIZE=100     # Max cache entries
```

### Security Configuration

```bash
# HTTPS enforcement (production)
FORCE_HTTPS=false      # Set to true in production

# Content Security Policy
CSP_ENABLED=true       # Enable Content Security Policy

# HSTS (HTTP Strict Transport Security)
HSTS_ENABLED=false     # Enable in production with HTTPS

# API rate limiting
API_RATE_LIMIT=true    # Enable API rate limiting
```

## Environment-Specific Configuration

### Development Configuration

**File**: `.env.development`

```bash
NODE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=simple

# Relaxed security for development
FORCE_HTTPS=false
TRUST_PROXY=false

# Development database
DATABASE_URL=postgresql://medianest:medianest@localhost:5432/medianest_dev

# Hot reloading
FRONTEND_HOT_RELOAD=true
BACKEND_HOT_RELOAD=true
```

### Production Configuration

**File**: `.env.production`

```bash
NODE_ENV=production
LOG_LEVEL=warn
LOG_FORMAT=json

# Production security
FORCE_HTTPS=true
TRUST_PROXY=true
CSP_ENABLED=true
HSTS_ENABLED=true

# Production database with SSL
DATABASE_URL=postgresql://user:pass@prod-db:5432/medianest?ssl=true

# Production Redis
REDIS_URL=redis://prod-redis:6379

# Metrics and monitoring
METRICS_TOKEN=your-secure-metrics-token
HEALTH_CHECK_TOKEN=your-health-check-token
```

### Test Configuration

**File**: `.env.test`

```bash
NODE_ENV=test
LOG_LEVEL=error

# Test databases
DATABASE_URL=postgresql://test:test@localhost:5433/medianest_test
REDIS_URL=redis://localhost:6380

# Disable external services in tests
PLEX_ENABLED=false
OVERSEERR_ENABLED=false
UPTIME_KUMA_ENABLED=false
```

## Docker Configuration

### Docker Compose Environment

**File**: `docker-compose.yml`

```yaml
services:
  medianest:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://medianest:medianest@postgres:5432/medianest
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
```

### Docker Secrets (Production)

```yaml
services:
  medianest:
    secrets:
      - jwt_secret
      - encryption_key
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
```

## Configuration Validation

### Startup Validation

MediaNest validates configuration on startup:

```bash
# Manual validation
npm run config:validate

# Start with validation
npm run dev:validate
```

### Common Validation Errors

**Missing Required Variables:**
```
Error: JWT_SECRET is required
Solution: Set JWT_SECRET in .env file
```

**Weak Secrets:**
```
Error: JWT_SECRET must be at least 32 characters
Solution: Generate stronger secret with openssl rand -base64 32
```

**Invalid Database URL:**
```
Error: Cannot connect to database
Solution: Check DATABASE_URL format and database availability
```

## Configuration Best Practices

### Security Best Practices

1. **Use Strong Secrets**: Minimum 32 characters for all secrets
2. **Rotate Secrets**: Change JWT and encryption keys periodically
3. **Environment Separation**: Different secrets for dev/staging/production
4. **Secret Management**: Use Docker secrets or vault systems in production
5. **No Defaults**: Never use default/example secrets in production

### Performance Best Practices

1. **Enable Redis**: Use Redis for better caching and session management
2. **Database Pooling**: Configure connection pooling for production
3. **Rate Limiting**: Enable appropriate rate limiting
4. **Log Levels**: Use appropriate log levels (warn/error in production)

### Deployment Best Practices

1. **Environment Files**: Keep environment files out of version control
2. **CI/CD Variables**: Use CI/CD system for secret management
3. **Health Checks**: Configure appropriate health check endpoints
4. **Monitoring**: Set up metrics and monitoring tokens

## Troubleshooting Configuration

### Common Issues

**Configuration Not Loading:**
```bash
# Check environment file exists
ls -la .env

# Verify file format (no spaces around =)
cat .env | grep "="
```

**Database Connection Issues:**
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT version();"

# Check database exists
psql $DATABASE_URL -c "\l"
```

**Secret Generation:**
```bash
# Generate all required secrets at once
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" 
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
```

### Configuration Testing

```bash
# Test configuration
npm run config:test

# Validate environment
npm run env:validate

# Check external service connectivity
npm run services:check
```

## Migration from Previous Versions

### Post-Cleanup Configuration Changes

The recent cleanup simplified configuration:

**Removed Configuration:**
- Legacy Docker files (consolidated to single Dockerfile)
- Duplicate environment variables
- Unused service configurations

**Simplified Configuration:**
- Streamlined environment files
- Consolidated Docker setup
- Removed redundant settings

**New Configuration Options:**
- Enhanced security settings
- Improved Redis configuration
- Better external service integration

### Migration Steps

1. **Backup Current Config**: `cp .env .env.backup`
2. **Update Environment**: Use new .env.example as template
3. **Test Configuration**: Run validation scripts
4. **Update Docker**: Use new docker-compose.yml
5. **Verify Services**: Test all integrations

---

**Last Updated**: September 2025  
**Configuration Version**: 2.0 (Post-Cleanup)  
**Next Review**: After remaining system improvements