# Environment Configuration Consolidation Strategy

## Implementation Plan for Unified Configuration Management

This document outlines the practical implementation strategy for consolidating MediaNest's environment configuration management across Docker environments.

## Current State Analysis

### Environment Files Found
```
/.env                           # Main development environment
/backend/.env                   # Backend-specific development
/backend/.env.production        # Backend production config
/backend/.env.test             # Backend test config
/frontend/.env.local           # Frontend development config
/.env.production               # Root production config
/.env.production.template      # Production template
/deployment/environment/       # Deployment templates
```

### Docker Compose Files
```
/docker-compose.dev.yml        # Development environment
/docker-compose.prod.yml       # Production environment  
/docker-compose.test.yml       # Testing environment
/docker-swarm-stack.yml        # Swarm orchestration
```

### Secret Management Files
```
/secrets/                      # Docker secrets directory
└── database_url, jwt_secret, postgres_password, etc.
/deployment/kubernetes/secrets.yaml  # K8s secret templates
```

## Proposed Unified Structure

### New Configuration Hierarchy
```
config/
├── environments/
│   ├── base.env              # Common variables for all environments
│   ├── development.env       # Development overrides
│   ├── testing.env          # Testing overrides
│   ├── production.env       # Production overrides
│   └── local.env.example    # Local development template
├── docker/
│   ├── docker-compose.base.yml     # Base compose configuration
│   ├── docker-compose.dev.yml      # Development overrides
│   ├── docker-compose.test.yml     # Testing overrides
│   ├── docker-compose.prod.yml     # Production overrides
│   └── docker-swarm.yml           # Swarm configuration
├── secrets/
│   ├── development/          # Development secret templates
│   ├── production/           # Production secret files
│   └── kubernetes/          # K8s secret manifests
├── nginx/
│   ├── nginx.base.conf       # Base nginx configuration
│   ├── nginx.dev.conf        # Development nginx config
│   └── nginx.prod.conf       # Production nginx config
└── scripts/
    ├── generate-config.sh    # Configuration generation
    ├── generate-secrets.sh   # Secret generation
    └── validate-config.sh    # Configuration validation
```

## Phase 1: Environment File Consolidation

### Step 1: Create Base Configuration

#### `config/environments/base.env`
```env
# MediaNest Base Configuration
# Common environment variables for all environments

# Application Information
APP_NAME=MediaNest
APP_VERSION=1.0.0

# Node.js Configuration
NODE_OPTIONS=--max-old-space-size=1024

# Database Configuration (overridden per environment)
POSTGRES_DB=medianest
POSTGRES_USER=medianest
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000

# Redis Configuration
REDIS_DB=0
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100

# JWT Configuration
JWT_ISSUER=medianest
JWT_AUDIENCE=medianest-users
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# API Configuration
API_TIMEOUT=30000
API_RATE_LIMIT=1000
API_RATE_WINDOW=900000

# File Upload Configuration
UPLOAD_MAX_SIZE=52428800
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm
TMP_PATH=/tmp

# Feature Flags
ENABLE_CORS=true
ENABLE_COMPRESSION=true
ENABLE_METRICS=true

# Logging Configuration
LOG_FILE_ENABLED=true
LOG_FILE_MAX_SIZE=100m
LOG_FILE_MAX_FILES=10
LOG_FILE_DATE_PATTERN=YYYY-MM-DD
```

### Step 2: Environment-Specific Overrides

#### `config/environments/development.env`
```env
# MediaNest Development Environment Configuration
# Extends base.env with development-specific overrides

# Environment
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=*

# Database
POSTGRES_PASSWORD=medianest_dev_password
DATABASE_URL=postgresql://medianest:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?connection_limit=20&pool_timeout=30

# Redis
REDIS_URL=redis://redis:6379

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev_secret_12345
JWT_SECRET=dev_jwt_secret_12345
ENCRYPTION_KEY=dev_encryption_key_12345

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Plex Integration (Development)
PLEX_CLIENT_ID=${PLEX_CLIENT_ID:-MediaNest-Dev}
PLEX_CLIENT_SECRET=${PLEX_CLIENT_SECRET:-changeme-dev}

# Development Features
CHOKIDAR_USEPOLLING=true
FAST_REFRESH=true
NEXT_TELEMETRY_DISABLED=1

# File Paths
UPLOAD_PATH=/app/uploads
LOG_FILE_PATH=/app/logs
YOUTUBE_DOWNLOAD_PATH=/app/youtube

# Performance Settings (Relaxed for development)
ENABLE_RATE_LIMITING=false
ENABLE_CSRF_PROTECTION=false
STRICT_VALIDATION=false
```

#### `config/environments/testing.env`
```env
# MediaNest Testing Environment Configuration
# Optimized for CI/CD and automated testing

# Environment
NODE_ENV=test
LOG_LEVEL=warn
CI=true

# Database (Testing)
POSTGRES_PASSWORD=test_password
POSTGRES_USER=test_user
DATABASE_URL=postgresql://test_user:test_password@postgres-test:5432/medianest_test?connection_limit=10&pool_timeout=10

# Redis (Testing)
REDIS_URL=redis://redis-test:6379

# Authentication (Test credentials)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-nextauth-secret-key-32-bytes-long
JWT_SECRET=test-jwt-secret-key-32-bytes-long
ENCRYPTION_KEY=test-encryption-key-32-bytes-long

# Plex Integration (Test)
PLEX_CLIENT_ID=test-plex-client-id
PLEX_CLIENT_SECRET=test-plex-client-secret

# Test-specific URLs
TEST_DATABASE_URL=postgresql://test_user:test_password@postgres-test:5432/medianest_test
TEST_REDIS_URL=redis://redis-test:6379

# Performance (Optimized for speed)
ENABLE_RATE_LIMITING=false
ENABLE_CSRF_PROTECTION=false
PERFORMANCE_MONITORING=false
COLLECT_METRICS=false

# File Paths (Temporary)
UPLOAD_PATH=/tmp/uploads
LOG_FILE_PATH=/tmp/logs
YOUTUBE_DOWNLOAD_PATH=/tmp/youtube-downloads

# Testing Configuration
YOUTUBE_MAX_CONCURRENT_DOWNLOADS=3
YOUTUBE_RATE_LIMIT=false
DATABASE_POOL_SIZE=5
DATABASE_TIMEOUT=30000
```

#### `config/environments/production.env`
```env
# MediaNest Production Environment Configuration
# Production-grade security and performance settings

# Environment
NODE_ENV=production
LOG_LEVEL=info

# URLs (Template variables to be replaced)
DOMAIN=${DOMAIN_NAME}
FRONTEND_URL=https://${DOMAIN_NAME}
NEXT_PUBLIC_API_URL=https://${DOMAIN_NAME}/api
NEXTAUTH_URL=https://${DOMAIN_NAME}
CORS_ORIGIN=https://${DOMAIN_NAME}

# Database (Using Docker secrets)
DATABASE_URL_FILE=/run/secrets/database_url
POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

# Redis (Using Docker secrets)
REDIS_URL_FILE=/run/secrets/redis_url
REDIS_PASSWORD_FILE=/run/secrets/redis_password

# Authentication (Using Docker secrets)
JWT_SECRET_FILE=/run/secrets/jwt_secret
NEXTAUTH_SECRET_FILE=/run/secrets/nextauth_secret
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key

# Plex Integration (Using Docker secrets)
PLEX_CLIENT_ID_FILE=/run/secrets/plex_client_id
PLEX_CLIENT_SECRET_FILE=/run/secrets/plex_client_secret

# Security Settings
SECURITY_HEADERS=true
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
ENABLE_RATE_LIMITING=true
ENABLE_CSRF_PROTECTION=true
STRICT_VALIDATION=true

# Performance Settings
ENABLE_COMPRESSION=true
ENABLE_CACHE=true
CACHE_TTL=3600
CACHE_PREFIX=medianest:

# File Paths (Production volumes)
UPLOAD_PATH=/app/uploads
LOG_FILE_PATH=/app/logs
DATA_PATH=${DATA_PATH:-/opt/medianest/data}
LOG_PATH=${LOG_PATH:-/opt/medianest/logs}
BACKUP_PATH=${BACKUP_PATH:-/opt/medianest/backups}

# SSL/TLS Configuration
SSL_PROTOCOLS=TLSv1.2 TLSv1.3
SSL_STAPLING=on
SSL_SESSION_TIMEOUT=1d
CERTBOT_EMAIL=${CERTBOT_EMAIL}

# Resource Limits
POSTGRES_MAX_CONNECTIONS=100
POSTGRES_SHARED_BUFFERS=256MB
REDIS_MAX_MEMORY=512mb

# Monitoring
MONITORING_ENABLED=true
METRICS_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_INTERVAL=30000

# Build Information
BUILD_DATE=${BUILD_DATE}
VCS_REF=${VCS_REF}
VERSION=${VERSION:-latest}
```

## Phase 2: Docker Compose Consolidation

### Base Compose Configuration

#### `config/docker/docker-compose.base.yml`
```yaml
# MediaNest Base Docker Compose Configuration
# Defines common service structure and patterns

version: '3.8'

# Common environment template
x-common-env: &common-env
  NODE_ENV: ${NODE_ENV:-development}
  LOG_LEVEL: ${LOG_LEVEL:-info}

# Common restart policy
x-restart-policy: &restart-policy
  restart: unless-stopped

# Common network configurations
networks:
  medianest-network:
    driver: bridge
    name: medianest-${NODE_ENV:-development}

# Common volume patterns
volumes:
  postgres_data:
    driver: local
    name: medianest-postgres-${NODE_ENV:-development}
  
  redis_data:
    driver: local
    name: medianest-redis-${NODE_ENV:-development}

services:
  # Base PostgreSQL service
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - medianest-network
    <<: *restart-policy

  # Base Redis service
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - medianest-network
    <<: *restart-policy
```

## Phase 3: Secret Management Implementation

### Development Secret Template

#### `config/secrets/development/.env.secrets.example`
```env
# MediaNest Development Secrets Template
# Copy to .env.secrets and update with actual values
# DO NOT commit the actual .env.secrets file

# Database
POSTGRES_PASSWORD=medianest_dev_password

# Authentication
NEXTAUTH_SECRET=dev_secret_12345_change_me
JWT_SECRET=dev_jwt_secret_12345_change_me
ENCRYPTION_KEY=dev_encryption_key_12345_change_me

# Plex Integration
PLEX_CLIENT_ID=your_plex_client_id
PLEX_CLIENT_SECRET=your_plex_client_secret

# External Services (optional)
TMDB_API_KEY=your_tmdb_api_key
SMTP_PASSWORD=your_smtp_password

# Admin (Development only)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme_immediately
```

### Production Secret Management

#### `config/scripts/generate-secrets.sh`
```bash
#!/bin/bash
# MediaNest Production Secret Generation Script

set -e

SECRETS_DIR="${SECRETS_DIR:-./secrets}"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "Generating secrets for MediaNest ${ENVIRONMENT} environment..."

# Create secrets directory
mkdir -p "${SECRETS_DIR}"

# Generate JWT secret (64 characters)
echo "Generating JWT secret..."
openssl rand -hex 32 > "${SECRETS_DIR}/jwt_secret"

# Generate encryption key (32 characters)
echo "Generating encryption key..."
openssl rand -hex 16 > "${SECRETS_DIR}/encryption_key"

# Generate NextAuth secret (32 characters)
echo "Generating NextAuth secret..."
openssl rand -hex 16 > "${SECRETS_DIR}/nextauth_secret"

# Generate database password (25 characters)
echo "Generating database password..."
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25 > "${SECRETS_DIR}/postgres_password"

# Generate Redis password (25 characters)
echo "Generating Redis password..."
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25 > "${SECRETS_DIR}/redis_password"

# Generate database URL
DB_PASSWORD=$(cat "${SECRETS_DIR}/postgres_password")
echo "postgresql://medianest:${DB_PASSWORD}@postgres:5432/medianest?sslmode=prefer" > "${SECRETS_DIR}/database_url"

# Generate Redis URL
REDIS_PASSWORD=$(cat "${SECRETS_DIR}/redis_password")
echo "redis://:${REDIS_PASSWORD}@redis:6379" > "${SECRETS_DIR}/redis_url"

# Set proper permissions
chmod 600 "${SECRETS_DIR}"/*

echo "✅ Secrets generated successfully in ${SECRETS_DIR}"
echo "⚠️  Please store these secrets securely and never commit them to version control"

# Display summary (without revealing actual secrets)
echo ""
echo "Generated files:"
ls -la "${SECRETS_DIR}"
```

## Phase 4: Configuration Loading Strategy

### Configuration Loader Utility

#### `config/scripts/load-config.js`
```javascript
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class ConfigLoader {
  constructor(environment = process.env.NODE_ENV || 'development') {
    this.environment = environment;
    this.configDir = path.join(__dirname, '..', 'environments');
  }

  loadConfig() {
    const configs = [];
    
    // Load base configuration
    const basePath = path.join(this.configDir, 'base.env');
    if (fs.existsSync(basePath)) {
      configs.push(basePath);
    }

    // Load environment-specific configuration
    const envPath = path.join(this.configDir, `${this.environment}.env`);
    if (fs.existsSync(envPath)) {
      configs.push(envPath);
    }

    // Load local overrides (development only)
    if (this.environment === 'development') {
      const localPath = path.join(this.configDir, 'local.env');
      if (fs.existsSync(localPath)) {
        configs.push(localPath);
      }
    }

    // Process configurations in order (later files override earlier ones)
    const finalConfig = {};
    for (const configFile of configs) {
      const config = this.parseEnvFile(configFile);
      Object.assign(finalConfig, config);
    }

    return this.expandVariables(finalConfig);
  }

  parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key) {
          config[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return config;
  }

  expandVariables(config) {
    const expanded = { ...config };
    
    // Simple variable expansion (${VAR_NAME} format)
    Object.keys(expanded).forEach(key => {
      let value = expanded[key];
      if (typeof value === 'string') {
        value = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
          return expanded[varName] || process.env[varName] || match;
        });
        expanded[key] = value;
      }
    });
    
    return expanded;
  }

  validate() {
    const config = this.loadConfig();
    const required = this.getRequiredVariables();
    const missing = [];

    required.forEach(varName => {
      if (!config[varName] && !process.env[varName]) {
        missing.push(varName);
      }
    });

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return config;
  }

  getRequiredVariables() {
    const common = [
      'NODE_ENV',
      'POSTGRES_DB',
      'POSTGRES_USER'
    ];

    const environmentSpecific = {
      development: [
        'POSTGRES_PASSWORD',
        'JWT_SECRET',
        'NEXTAUTH_SECRET'
      ],
      production: [
        'DATABASE_URL_FILE',
        'JWT_SECRET_FILE',
        'NEXTAUTH_SECRET_FILE',
        'DOMAIN_NAME'
      ],
      test: [
        'TEST_DATABASE_URL',
        'JWT_SECRET'
      ]
    };

    return [...common, ...(environmentSpecific[this.environment] || [])];
  }
}

module.exports = ConfigLoader;

// CLI usage
if (require.main === module) {
  const environment = process.argv[2] || process.env.NODE_ENV || 'development';
  const loader = new ConfigLoader(environment);
  
  try {
    const config = loader.validate();
    console.log('✅ Configuration validation passed');
    console.log(`Environment: ${environment}`);
    console.log(`Variables loaded: ${Object.keys(config).length}`);
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
  }
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Create new config directory structure
- [ ] Implement base configuration files
- [ ] Create configuration loader utility
- [ ] Set up validation framework

### Week 2: Environment Consolidation
- [ ] Migrate development environment variables
- [ ] Implement environment-specific overrides
- [ ] Update Docker Compose files
- [ ] Test configuration loading

### Week 3: Secret Management
- [ ] Implement secret generation scripts
- [ ] Create production secret workflow
- [ ] Update Docker secret integration
- [ ] Test secret rotation procedures

### Week 4: Integration & Testing
- [ ] Update all Docker Compose files
- [ ] Test all environments thoroughly
- [ ] Performance impact assessment
- [ ] Create migration documentation

### Week 5: Rollout & Training
- [ ] Deploy to staging environment
- [ ] Team training sessions
- [ ] Production deployment
- [ ] Monitor and optimize

## Benefits of This Approach

### Developer Experience
- **Single source of truth** for environment configuration
- **Easy environment switching** with consistent patterns
- **Better validation** and error reporting
- **Simplified onboarding** with clear templates

### Security Improvements
- **Centralized secret management** with proper lifecycle
- **Environment-appropriate security** levels
- **No more secrets in version control**
- **Automated secret generation**

### Operations Benefits
- **Consistent configuration** across all environments
- **Easier troubleshooting** with validation
- **Better monitoring** and alerting capabilities
- **Simplified CI/CD integration**

---

*This strategy provides a practical, phased approach to consolidating MediaNest's environment configuration management while maintaining security best practices and developer productivity.*