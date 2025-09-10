# MediaNest Environment Variables Reference

## Table of Contents

1. [Complete Environment Variables Reference](#complete-environment-variables-reference)
2. [Environment Setup Guide](#environment-setup-guide)
3. [Security Best Practices](#security-best-practices)
4. [Troubleshooting Guide](#troubleshooting-guide)

---

## Complete Environment Variables Reference

MediaNest uses 150+ environment variables organized by category for maximum flexibility and security.

### 🌍 General Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `NODE_ENV` | Application environment | `development\|production\|test` | `development` | ✅ | All services |
| `VERSION` | Application version | String | `latest` | ❌ | Docker, CI/CD |
| `BUILD_DATE` | Build timestamp | ISO Date | - | ❌ | Docker |
| `VCS_REF` | Git commit hash | String | - | ❌ | Docker |
| `APP_NAME` | Application name | String | `MediaNest` | ❌ | Config files |
| `APP_VERSION` | Version identifier | String | `1.0.0` | ❌ | API responses |

### 🌐 Domain & URLs

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `DOMAIN_NAME` | Production domain | FQDN | `medianest.local` | Prod | Nginx, SSL |
| `FRONTEND_URL` | Frontend base URL | URL | `http://localhost:3000` | ✅ | Backend, Auth |
| `BACKEND_URL` | Backend API URL | URL | `http://localhost:3001` | ✅ | Frontend |
| `NEXTAUTH_URL` | NextAuth callback URL | URL | `http://localhost:3000` | ✅ | NextAuth.js |
| `NEXT_PUBLIC_API_URL` | Public API endpoint | URL | `http://localhost:4000/api` | ✅ | Frontend |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | WebSocket URL | `ws://localhost:4000` | ❌ | Frontend |
| `CORS_ORIGIN` | CORS allowed origins | URL/Array | `http://localhost:3000` | ✅ | Backend |

### 🗄️ Database Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | postgres:// URL | - | ✅ | Backend, Tests |
| `DATABASE_URL_FILE` | Docker secrets file path | File path | `/run/secrets/database_url` | Prod | Backend |
| `POSTGRES_DB` | Database name | String | `medianest_dev` | ✅ | Docker |
| `POSTGRES_USER` | Database user | String | `medianest` | ✅ | Docker |
| `POSTGRES_PASSWORD` | Database password | String | - | ✅ | Docker |
| `POSTGRES_PASSWORD_FILE` | Password secrets file | File path | `/run/secrets/postgres_password` | Prod | Docker |
| `DB_HOST` | Database host | Hostname/IP | `localhost` | ❌ | Backend |
| `DB_PORT` | Database port | Number | `5432` | ❌ | Backend |
| `DB_NAME` | Database name | String | `medianest` | ❌ | Backend |
| `DB_USER` | Database username | String | `postgres` | ❌ | Backend |
| `DB_PASSWORD` | Database password | String | - | ❌ | Backend |
| `DB_SSL` | Enable SSL connection | Boolean | `false` | ❌ | Backend |
| `DB_POOL_MIN` | Minimum pool connections | Number | `2` | ❌ | Backend |
| `DB_POOL_MAX` | Maximum pool connections | Number | `10` | ❌ | Backend |
| `DB_TIMEOUT` | Connection timeout (ms) | Number | `30000` | ❌ | Backend |
| `DATABASE_POOL_SIZE` | Connection pool size | Number | `10` | ❌ | Backend |
| `DATABASE_POOL_TIMEOUT` | Pool timeout (ms) | Number | `30000` | ❌ | Tests |
| `DATABASE_CONNECTION_LIMIT` | Max connections | Number | `20` | ❌ | Tests |

### 📊 Redis Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `REDIS_URL` | Redis connection string | redis:// URL | `redis://localhost:6379` | ✅ | Backend, Tests |
| `REDIS_URL_FILE` | Docker secrets file path | File path | `/run/secrets/redis_url` | Prod | Backend |
| `REDIS_HOST` | Redis hostname | Hostname/IP | `localhost` | ❌ | Backend |
| `REDIS_PORT` | Redis port | Number | `6379` | ❌ | Backend |
| `REDIS_PASSWORD` | Redis password | String | - | ❌ | Backend |
| `REDIS_PASSWORD_FILE` | Password secrets file | File path | `/run/secrets/redis_password` | Prod | Docker |
| `REDIS_DB` | Redis database number | Number | `0` | ❌ | Backend |
| `REDIS_MAX_RETRIES` | Max retry attempts | Number | `3` | ❌ | Backend |
| `REDIS_RETRY_DELAY_MS` | Retry delay (ms) | Number | `2000` | ❌ | Backend |
| `REDIS_KEY_PREFIX` | Key prefix | String | `medianest:` | ❌ | Backend |
| `REDIS_MAX_MEMORY_POLICY` | Memory eviction policy | String | `allkeys-lru` | ❌ | Tests |
| `REDIS_MAX_CLIENTS` | Maximum clients | Number | `1000` | ❌ | Tests |

### 🔐 Authentication & Security

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `NEXTAUTH_SECRET` | NextAuth.js secret | String (32+ chars) | - | ✅ | NextAuth.js |
| `NEXTAUTH_SECRET_FILE` | NextAuth secrets file | File path | `/run/secrets/nextauth_secret` | Prod | NextAuth.js |
| `JWT_SECRET` | JWT signing secret | String (32+ chars) | - | ✅ | Backend |
| `JWT_SECRET_FILE` | JWT secrets file | File path | `/run/secrets/jwt_secret` | Prod | Backend |
| `JWT_ISSUER` | JWT issuer | String | `medianest` | ❌ | Backend |
| `JWT_AUDIENCE` | JWT audience | String | `medianest-users` | ❌ | Backend |
| `JWT_EXPIRES_IN` | JWT expiration | Time string | `7d` | ❌ | Backend |
| `ENCRYPTION_KEY` | AES-256-GCM key | String (32 bytes) | - | ✅ | Backend |
| `ENCRYPTION_KEY_FILE` | Encryption key secrets file | File path | `/run/secrets/encryption_key` | Prod | Backend |
| `BCRYPT_ROUNDS` | BCrypt hash rounds | Number | `12` | ❌ | Backend |
| `PASSWORD_MIN_LENGTH` | Minimum password length | Number | `8` | ❌ | Backend |
| `MAX_LOGIN_ATTEMPTS` | Max failed logins | Number | `5` | ❌ | Backend |
| `LOCKOUT_TIME` | Account lockout time (ms) | Number | `1800000` | ❌ | Backend |

### 🔌 OAuth Integrations

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `PLEX_CLIENT_ID` | Plex OAuth client ID | String | - | ✅ | Backend |
| `PLEX_CLIENT_ID_FILE` | Plex client ID secrets file | File path | `/run/secrets/plex_client_id` | Prod | Backend |
| `PLEX_CLIENT_SECRET` | Plex OAuth client secret | String | - | ✅ | Backend |
| `PLEX_CLIENT_SECRET_FILE` | Plex client secret file | File path | `/run/secrets/plex_client_secret` | Prod | Backend |
| `PLEX_SERVER_URL` | Plex server URL | URL | - | ❌ | Backend |
| `PLEX_TOKEN` | Plex authentication token | String | - | ❌ | Backend |
| `PLEX_PRODUCT` | Plex product identifier | String | `MediaNest` | ❌ | Backend |
| `PLEX_VERSION` | Plex client version | String | `1.0.0` | ❌ | Backend |
| `PLEX_PLATFORM` | Plex platform | String | `Web` | ❌ | Backend |
| `PLEX_DEVICE` | Plex device name | String | `MediaNest Server` | ❌ | Backend |

### 📧 Email Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `SMTP_HOST` | SMTP server hostname | Hostname | - | ❌ | Backend |
| `SMTP_PORT` | SMTP server port | Number | `587` | ❌ | Backend |
| `SMTP_SECURE` | Use TLS/SSL | Boolean | `false` | ❌ | Backend |
| `SMTP_USER` | SMTP username | String | - | ❌ | Backend |
| `SMTP_PASS` | SMTP password | String | - | ❌ | Backend |
| `EMAIL_FROM` | Default sender email | Email | `noreply@medianest.com` | ❌ | Backend |
| `EMAIL_FROM_NAME` | Default sender name | String | `MediaNest` | ❌ | Backend |
| `EMAIL_SMTP_HOST` | Email SMTP host | Hostname | - | ❌ | Config |
| `EMAIL_SMTP_PORT` | Email SMTP port | Number | - | ❌ | Config |
| `EMAIL_USERNAME` | Email username | String | - | ❌ | Config |
| `EMAIL_PASSWORD` | Email password | String | - | ❌ | Config |

### 📂 Storage & File Paths

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `DATA_PATH` | Data storage path | Directory path | `./data` | ❌ | Docker |
| `LOG_PATH` | Log files path | Directory path | `./logs` | ❌ | Docker |
| `BACKUP_PATH` | Backup files path | Directory path | `./backups` | ❌ | Docker |

### 🔒 SSL/TLS Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `CERTBOT_EMAIL` | Let's Encrypt email | Email | - | Prod | Certbot |

### 🚀 Application Settings

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `PORT` | Server port | Number | `4000` | ❌ | Backend |
| `HOST` | Server host | IP/Hostname | `localhost` | ❌ | Backend |
| `TRUST_PROXY` | Trust proxy headers | Boolean | `true` | ❌ | Backend |
| `LOG_LEVEL` | Logging level | `error\|warn\|info\|debug\|verbose` | `info` | ❌ | All |
| `LOG_FORMAT` | Log output format | `json\|simple` | `json` | ❌ | All |
| `LOG_MAX_FILES` | Max log files | Number | `7` | ❌ | Backend |
| `LOG_MAX_SIZE` | Max log file size | String | `20m` | ❌ | Backend |
| `DEBUG` | Debug namespace | String | `medianest:*` | ❌ | All |
| `RUN_MIGRATIONS` | Run DB migrations | Boolean | `true` | ❌ | Backend |

### 📊 Monitoring & Metrics

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `GRAFANA_USER` | Grafana admin user | String | `admin` | ❌ | Grafana |
| `GRAFANA_PASSWORD_FILE` | Grafana password file | File path | `/run/secrets/grafana_password` | ❌ | Grafana |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout (ms) | Number | `10000` | ❌ | Backend |
| `HEALTH_CHECK_INTERVAL` | Health check interval (ms) | Number | `30000` | ❌ | Backend |
| `ERROR_REPORTING_ENABLED` | Enable error reporting | Boolean | `false` | ❌ | Backend |
| `ERROR_REPORTING_ENDPOINT` | Error reporting URL | URL | - | ❌ | Backend |

### ⚡ Performance & Rate Limiting

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `REQUEST_TIMEOUT` | Request timeout (ms) | Number | `30000` | ❌ | Backend |
| `BODY_LIMIT` | Request body limit | String | `10mb` | ❌ | Backend |
| `JSON_LIMIT` | JSON payload limit | String | `1mb` | ❌ | Backend |
| `RATE_LIMIT_API_REQUESTS` | API rate limit | Number | `100` | ❌ | Backend |
| `RATE_LIMIT_API_WINDOW` | API rate window (sec) | Number | `60` | ❌ | Backend |
| `RATE_LIMIT_YOUTUBE_REQUESTS` | YouTube API limit | Number | `5` | ❌ | Backend |
| `RATE_LIMIT_YOUTUBE_WINDOW` | YouTube rate window (sec) | Number | `3600` | ❌ | Backend |
| `RATE_LIMIT_WINDOW_MS` | General rate limit window (ms) | Number | `900000` | ❌ | Backend |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | Number | `100` | ❌ | Backend |
| `RATE_LIMIT_SKIP_SUCCESSFUL` | Skip successful requests | Boolean | `true` | ❌ | Backend |

### 🌐 WebSocket Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `WS_PORT` | WebSocket port | Number | - | ❌ | Backend |
| `WS_CORS_ORIGIN` | WebSocket CORS origins | URL/Array | - | ❌ | Backend |
| `WS_HEARTBEAT_INTERVAL` | Heartbeat interval (ms) | Number | `30000` | ❌ | Backend |

### 🔧 Feature Flags

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `ENABLE_REGISTRATION` | Allow user registration | Boolean | `true` | ❌ | Backend |
| `ENABLE_EMAIL_VERIFICATION` | Require email verification | Boolean | `false` | ❌ | Backend |
| `ENABLE_TWO_FACTOR_AUTH` | Enable 2FA | Boolean | `false` | ❌ | Backend |
| `ENABLE_PASSWORD_RESET` | Allow password reset | Boolean | `true` | ❌ | Backend |
| `ENABLE_REQUEST_LOGGING` | Log HTTP requests | Boolean | `true` | ❌ | Backend |
| `LOG_REQUESTS` | Detailed request logging | Boolean | `false` | ❌ | Backend |
| `LOG_ERRORS` | Log errors | Boolean | `true` | ❌ | Backend |

### 🔌 External Services

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `YOUTUBE_API_KEY` | YouTube Data API key | String | - | ❌ | Backend |
| `TMDB_API_KEY` | The Movie DB API key | String | - | ❌ | Backend |
| `OVERSEERR_URL` | Overseerr server URL | URL | - | ❌ | Backend |
| `OVERSEERR_API_KEY` | Overseerr API key | String | - | ❌ | Backend |
| `UPTIME_KUMA_URL` | Uptime Kuma URL | URL | - | ❌ | Backend |
| `UPTIME_KUMA_TOKEN` | Uptime Kuma token | String | - | ❌ | Backend |
| `WEBHOOK_URL` | Notification webhook URL | URL | - | ❌ | Backend |

### 🧪 Testing Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `CI` | Continuous Integration flag | Boolean | `false` | ❌ | Tests |
| `TEST_DATABASE_URL` | Test database URL | postgres:// URL | - | ✅ | Tests |
| `TEST_REDIS_URL` | Test Redis URL | redis:// URL | - | ✅ | Tests |
| `TEST_BASE_URL` | Base URL for tests | URL | `http://localhost:3001` | ❌ | Tests |
| `CYPRESS_AUTH_TOKEN` | Cypress auth token | String | - | ❌ | Cypress |
| `MAX_CONCURRENT_USERS` | Load test max users | Number | `1000` | ❌ | Load Tests |
| `TEST_DURATION` | Test duration (sec) | Number | `300` | ❌ | Load Tests |
| `STRESS_TEST_MAX_CONNECTIONS` | Max DB test connections | Number | `500` | ❌ | Stress Tests |
| `STRESS_TEST_MAX_REDIS_CLIENTS` | Max Redis test clients | Number | `200` | ❌ | Stress Tests |
| `MAX_DB_CONNECTIONS` | Max DB connections | Number | `100` | ❌ | Tests |
| `CONCURRENT_QUERIES` | Concurrent query limit | Number | `500` | ❌ | Tests |
| `SAMPLING_INTERVAL` | Metrics sampling interval (sec) | Number | `5` | ❌ | Tests |
| `UPDATE_SECURITY_BASELINE` | Update security baseline | Boolean | `false` | ❌ | Security Tests |

### 🔧 Development Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `CHOKIDAR_USEPOLLING` | Enable file polling | Boolean | `true` | ❌ | Dev |
| `WATCHPACK_POLLING` | Webpack polling | Boolean | `true` | ❌ | Dev |
| `FAST_REFRESH` | Enable Fast Refresh | Boolean | `true` | ❌ | Dev |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | Boolean | `true` | ❌ | Dev |
| `NPM_CONFIG_LOGLEVEL` | NPM log level | String | `warn` | ❌ | Dev |
| `NPM_CONFIG_PROGRESS` | NPM progress display | Boolean | `false` | ❌ | Dev |
| `NODE_OPTIONS` | Node.js runtime options | String | `--max-old-space-size=2048` | ❌ | Dev/Tests |

### 🔐 Docker Secrets

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `USE_DOCKER_SECRETS` | Enable Docker secrets | Boolean | `false` | ❌ | Backend |
| `DOCKER_SECRETS_PATH` | Secrets directory path | Directory path | `/run/secrets` | ❌ | Backend |

### 🎯 Session Management

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `SESSION_SECRET` | Session signing secret | String (32+ chars) | - | ✅ | Backend |
| `SESSION_COOKIE_MAX_AGE` | Session cookie max age (ms) | Number | `86400000` | ❌ | Backend |
| `SESSION_ROLLING` | Rolling sessions | Boolean | `false` | ❌ | Backend |
| `SESSION_SAVE_UNINITIALIZED` | Save uninitialized sessions | Boolean | `false` | ❌ | Backend |
| `SESSION_RESAVE` | Force session save | Boolean | `false` | ❌ | Backend |
| `SESSION_MAX_AGE` | Session max age (ms) | Number | `86400000` | ❌ | Backend |
| `SESSION_SECURE` | Secure session cookies | Boolean | `false` | ❌ | Backend |
| `SESSION_SAME_SITE` | SameSite cookie attribute | `strict\|lax\|none` | `lax` | ❌ | Backend |

### 🍪 Cookie Configuration

| Variable | Description | Format | Default | Required | Used In |
|----------|-------------|--------|---------|----------|---------|
| `AUTH_COOKIE_NAME` | Authentication cookie name | String | `auth-token` | ❌ | Backend |
| `AUTH_COOKIE_DOMAIN` | Cookie domain | Domain | - | ❌ | Backend |
| `AUTH_COOKIE_SECURE` | Secure cookies (auto in prod) | Boolean | Auto | ❌ | Backend |
| `AUTH_COOKIE_HTTP_ONLY` | HTTP-only cookies | Boolean | `true` | ❌ | Backend |
| `AUTH_COOKIE_SAME_SITE` | SameSite attribute | String | `strict` | ❌ | Backend |
| `CORS_CREDENTIALS` | Allow credentials | Boolean | `true` | ❌ | Backend |

---

## Environment Setup Guide

### Step-by-Step Development Setup

#### 1. Clone and Setup Project

```bash
git clone https://github.com/yourusername/medianest.git
cd medianest
npm install
```

#### 2. Create Environment File

```bash
# Copy the template
cp config/docker/docker-environment.env.template docker-environment.env

# Or create manually
touch docker-environment.env
```

#### 3. Configure Development Environment

```bash
# Minimal development configuration
cat > docker-environment.env << 'EOF'
# Basic Configuration
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://medianest:medianest_dev_password@localhost:5432/medianest_dev
POSTGRES_DB=medianest_dev
POSTGRES_USER=medianest
POSTGRES_PASSWORD=medianest_dev_password

# Redis
REDIS_URL=redis://localhost:6379

# Security (CHANGE THESE IN PRODUCTION!)
NEXTAUTH_SECRET=dev-nextauth-secret-change-in-production-32-chars-minimum
JWT_SECRET=dev-jwt-secret-change-in-production-32-chars-minimum
ENCRYPTION_KEY=dev-encryption-key-change-in-production-32-chars-minimum

# OAuth (Get from Plex Developer Console)
PLEX_CLIENT_ID=your_plex_client_id_here
PLEX_CLIENT_SECRET=your_plex_client_secret_here

# Logging
LOG_LEVEL=debug
DEBUG=medianest:*
EOF
```

#### 4. Start Development Services

```bash
# Using Docker Compose
docker-compose -f config/docker/docker-compose.dev.yml --env-file docker-environment.env up -d

# Or start services individually
npm run dev:backend &
npm run dev:frontend &
```

#### 5. Validate Configuration

```bash
# Check database connection
npm run db:test-connection

# Check Redis connection
npm run redis:ping

# Run configuration validator
npm run config:validate
```

### Production Environment Setup

#### 1. Generate Secure Secrets

```bash
#!/bin/bash
# generate-secrets.sh

# Generate secure random secrets
echo "Generating production secrets..."

# JWT Secret (64 characters)
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=${JWT_SECRET}" >> .env.production

# NextAuth Secret (64 characters)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> .env.production

# Encryption Key (32 bytes for AES-256)
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> .env.production

# Session Secret (64 characters)
SESSION_SECRET=$(openssl rand -hex 32)
echo "SESSION_SECRET=${SESSION_SECRET}" >> .env.production

echo "Secrets generated in .env.production"
echo "IMPORTANT: Store these securely and never commit them to version control!"
```

#### 2. Create Docker Secrets

```bash
#!/bin/bash
# create-docker-secrets.sh

# Create secrets directory
mkdir -p ./secrets

# Database URL
echo "postgresql://medianest:$(openssl rand -hex 16)@postgres:5432/medianest_prod" > ./secrets/database_url

# Redis URL
echo "redis://:$(openssl rand -hex 16)@redis:6379" > ./secrets/redis_url

# JWT Secret
openssl rand -hex 32 > ./secrets/jwt_secret

# NextAuth Secret
openssl rand -hex 32 > ./secrets/nextauth_secret

# Encryption Key
openssl rand -base64 32 > ./secrets/encryption_key

# Set secure permissions
chmod 600 ./secrets/*
chown root:docker ./secrets/*

echo "Docker secrets created in ./secrets/"
```

#### 3. Production Environment File

```bash
# Production configuration
cat > docker-environment.env << 'EOF'
# Environment
NODE_ENV=production

# URLs (UPDATE THESE FOR YOUR DOMAIN)
DOMAIN_NAME=yourdomain.com
FRONTEND_URL=https://yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
CORS_ORIGIN=https://yourdomain.com

# Use Docker secrets for sensitive data
DATABASE_URL_FILE=/run/secrets/database_url
REDIS_URL_FILE=/run/secrets/redis_url
NEXTAUTH_SECRET_FILE=/run/secrets/nextauth_secret
JWT_SECRET_FILE=/run/secrets/jwt_secret
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
PLEX_CLIENT_ID_FILE=/run/secrets/plex_client_id
PLEX_CLIENT_SECRET_FILE=/run/secrets/plex_client_secret

# Database
POSTGRES_DB=medianest_prod
POSTGRES_USER=medianest
POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

# Redis
REDIS_PASSWORD_FILE=/run/secrets/redis_password

# SSL/TLS
CERTBOT_EMAIL=admin@yourdomain.com

# Security Settings
BCRYPT_ROUNDS=14
MAX_LOGIN_ATTEMPTS=3
LOCKOUT_TIME=3600000

# Performance
DB_POOL_MAX=20
REDIS_MAX_CLIENTS=2000

# Monitoring
ERROR_REPORTING_ENABLED=true
LOG_LEVEL=warn
EOF
```

#### 4. Deploy with Docker Compose

```bash
# Deploy production stack
docker-compose -f config/docker/docker-compose.prod.yml \
  --env-file docker-environment.env up -d

# Verify deployment
docker-compose -f config/docker/docker-compose.prod.yml ps
```

### Testing Environment Setup

#### 1. Test Environment Configuration

```bash
cat > docker-environment.test.env << 'EOF'
# Test Environment
NODE_ENV=test

# Test URLs
FRONTEND_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
TEST_BASE_URL=http://localhost:3001

# Test Database
TEST_DATABASE_URL=postgresql://test_user:test_password@localhost:5432/medianest_test
DATABASE_URL=postgresql://test_user:test_password@localhost:5432/medianest_test

# Test Redis
TEST_REDIS_URL=redis://localhost:6379/15
REDIS_URL=redis://localhost:6379/15

# Test Secrets
JWT_SECRET=test-jwt-secret-that-is-at-least-32-characters-long-for-validation
NEXTAUTH_SECRET=test-nextauth-secret-32-chars-minimum
ENCRYPTION_KEY=test-encryption-key-32-bytes-long

# Test OAuth
PLEX_CLIENT_ID=test-plex-client-id
PLEX_CLIENT_SECRET=test-plex-client-secret

# Performance Testing
STRESS_TEST_MAX_CONNECTIONS=100
STRESS_TEST_MAX_REDIS_CLIENTS=50
MAX_DB_CONNECTIONS=50
CONCURRENT_QUERIES=100

# Logging
LOG_LEVEL=error
EOF
```

#### 2. CI/CD Environment

```bash
# .github/workflows/test.yml environment section
env:
  NODE_ENV: test
  CI: true
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/medianest_test
  REDIS_URL: redis://localhost:6379/15
  JWT_SECRET: ci-test-jwt-secret-32-chars-minimum
  NEXTAUTH_SECRET: ci-test-nextauth-secret-32-chars-minimum
  ENCRYPTION_KEY: ci-test-encryption-key-32-chars-minimum
  PLEX_CLIENT_ID: ci-test-plex-client-id
  PLEX_CLIENT_SECRET: ci-test-plex-client-secret
  LOG_LEVEL: error
  TEST_TIMEOUT: 30000
```

### Common Deployment Scenarios

#### Docker Development Stack

```bash
# Full development stack
docker-compose -f config/docker/docker-compose.dev.yml \
  --env-file docker-environment.env up -d

# Services: postgres, redis, backend, frontend
# Ports: 3000 (frontend), 4000 (backend), 5432 (postgres), 6379 (redis)
```

#### Production with SSL

```bash
# Production with Traefik reverse proxy and SSL
docker-compose -f config/docker/docker-compose.prod.yml \
  --env-file docker-environment.env up -d

# Includes: SSL termination, monitoring, backups
```

#### Testing Stack

```bash
# Isolated testing environment
docker-compose -f config/docker/docker-compose.test.yml \
  --env-file docker-environment.test.env up -d

# Clean environment for running tests
```

### Validation Commands

#### Environment Validation Script

```bash
#!/bin/bash
# validate-environment.sh

echo "🔍 Validating MediaNest Environment Configuration"

# Check required files
if [[ ! -f "docker-environment.env" ]]; then
  echo "❌ docker-environment.env not found"
  exit 1
fi

# Source environment file
set -a
source docker-environment.env
set +a

# Validate required variables
REQUIRED_VARS=(
  "NODE_ENV"
  "DATABASE_URL"
  "REDIS_URL"
  "JWT_SECRET"
  "NEXTAUTH_SECRET"
  "ENCRYPTION_KEY"
  "FRONTEND_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "❌ Required variable $var is not set"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

# Validate secret lengths
if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "❌ JWT_SECRET must be at least 32 characters"
  exit 1
fi

if [[ ${#NEXTAUTH_SECRET} -lt 32 ]]; then
  echo "❌ NEXTAUTH_SECRET must be at least 32 characters"
  exit 1
fi

if [[ ${#ENCRYPTION_KEY} -lt 32 ]]; then
  echo "❌ ENCRYPTION_KEY must be at least 32 characters"
  exit 1
fi

# Test database connection
echo "🗄️  Testing database connection..."
if command -v psql > /dev/null; then
  if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
  else
    echo "❌ Database connection failed"
  fi
else
  echo "⚠️  psql not found, skipping database test"
fi

# Test Redis connection
echo "📊 Testing Redis connection..."
if command -v redis-cli > /dev/null; then
  REDIS_HOST=$(echo $REDIS_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
  REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\).*/\1/p')
  
  if [[ -z "$REDIS_HOST" ]]; then
    REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\).*/\1/p')
  fi
  
  if [[ -z "$REDIS_PORT" ]]; then
    REDIS_PORT=6379
  fi
  
  if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo "✅ Redis connection successful"
  else
    echo "❌ Redis connection failed"
  fi
else
  echo "⚠️  redis-cli not found, skipping Redis test"
fi

echo "✅ Environment validation complete"
```

Make it executable and run:

```bash
chmod +x validate-environment.sh
./validate-environment.sh
```

#### Application Health Check

```bash
#!/bin/bash
# health-check.sh

echo "🏥 MediaNest Health Check"

# Check if services are running
services=("frontend" "backend" "postgres" "redis")

for service in "${services[@]}"; do
  if docker-compose ps -q "$service" > /dev/null 2>&1; then
    if [[ $(docker-compose ps -q "$service" | xargs docker inspect --format='{{.State.Health.Status}}') == "healthy" ]]; then
      echo "✅ $service is healthy"
    else
      echo "⚠️  $service is running but not healthy"
    fi
  else
    echo "❌ $service is not running"
  fi
done

# Test API endpoints
echo "🔗 Testing API endpoints..."

# Backend health
if curl -s http://localhost:4000/health > /dev/null; then
  echo "✅ Backend API is responding"
else
  echo "❌ Backend API is not responding"
fi

# Frontend health
if curl -s http://localhost:3000 > /dev/null; then
  echo "✅ Frontend is responding"
else
  echo "❌ Frontend is not responding"
fi

echo "🏁 Health check complete"
```

---

## Security Best Practices

### Secret Generation Guidelines

#### 1. Strong Secret Requirements

| Secret Type | Minimum Length | Recommended Length | Algorithm |
|-------------|-----------------|-------------------|-----------|
| JWT_SECRET | 32 characters | 64 characters | HMAC-SHA256 |
| NEXTAUTH_SECRET | 32 characters | 64 characters | Random |
| ENCRYPTION_KEY | 32 bytes | 32 bytes | AES-256-GCM |
| SESSION_SECRET | 32 characters | 64 characters | Random |
| Database Passwords | 16 characters | 32 characters | Random |

#### 2. Secure Secret Generation Commands

```bash
# JWT Secret (HMAC-SHA256 compatible)
JWT_SECRET=$(openssl rand -hex 32)

# NextAuth Secret
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# AES-256-GCM Encryption Key
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Database Password
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)

# Redis Password
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
```

#### 3. Secret Validation Script

```bash
#!/bin/bash
# validate-secrets.sh

validate_secret_strength() {
  local name=$1
  local value=$2
  local min_length=$3
  
  if [[ ${#value} -lt $min_length ]]; then
    echo "❌ $name is too short (${#value} < $min_length)"
    return 1
  fi
  
  # Check for common weak patterns
  if [[ "$value" =~ ^[a-zA-Z]+$ ]]; then
    echo "⚠️  $name contains only letters (consider adding numbers/symbols)"
  elif [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "⚠️  $name contains only numbers (consider adding letters/symbols)"
  elif [[ "$value" == *"password"* ]] || [[ "$value" == *"secret"* ]]; then
    echo "⚠️  $name contains dictionary words"
  else
    echo "✅ $name meets strength requirements"
  fi
}

# Validate secrets
validate_secret_strength "JWT_SECRET" "$JWT_SECRET" 32
validate_secret_strength "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" 32
validate_secret_strength "ENCRYPTION_KEY" "$ENCRYPTION_KEY" 32
validate_secret_strength "SESSION_SECRET" "$SESSION_SECRET" 32
```

### Docker Secrets Integration

#### 1. Create Docker Secrets

```bash
#!/bin/bash
# setup-docker-secrets.sh

# Create secrets directory
mkdir -p ./secrets
chmod 700 ./secrets

# Generate and store secrets
echo "$(openssl rand -hex 32)" | docker secret create jwt_secret -
echo "$(openssl rand -hex 32)" | docker secret create nextauth_secret -
echo "$(openssl rand -base64 32)" | docker secret create encryption_key -
echo "$(openssl rand -hex 16)" | docker secret create postgres_password -
echo "$(openssl rand -hex 16)" | docker secret create redis_password -

# Plex secrets (you need to provide these)
echo "your_plex_client_id" | docker secret create plex_client_id -
echo "your_plex_client_secret" | docker secret create plex_client_secret -

# Database URL with generated password
POSTGRES_PASSWORD=$(docker secret inspect postgres_password --format '{{.Spec.Data}}' | base64 -d)
echo "postgresql://medianest:${POSTGRES_PASSWORD}@postgres:5432/medianest_prod" | docker secret create database_url -

# List created secrets
docker secret ls
```

#### 2. Docker Compose Secrets Configuration

```yaml
# docker-compose.prod.yml secrets section
secrets:
  database_url:
    external: true
  jwt_secret:
    external: true
  nextauth_secret:
    external: true
  encryption_key:
    external: true
  plex_client_id:
    external: true
  plex_client_secret:
    external: true
  postgres_password:
    external: true
  redis_password:
    external: true

services:
  backend:
    secrets:
      - database_url
      - jwt_secret
      - nextauth_secret
      - encryption_key
      - plex_client_id
      - plex_client_secret
    environment:
      - USE_DOCKER_SECRETS=true
      - DATABASE_URL_FILE=/run/secrets/database_url
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - NEXTAUTH_SECRET_FILE=/run/secrets/nextauth_secret
      - ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
      - PLEX_CLIENT_ID_FILE=/run/secrets/plex_client_id
      - PLEX_CLIENT_SECRET_FILE=/run/secrets/plex_client_secret
```

### Environment Security Checklist

#### Development Environment

- [ ] Use development-specific secrets (never production secrets)
- [ ] Enable debug logging (`LOG_LEVEL=debug`)
- [ ] Use local development domains (`localhost`, `*.local`)
- [ ] Disable SSL requirements (`DB_SSL=false`)
- [ ] Use Docker internal networking
- [ ] Keep development secrets in `.env.local` (gitignored)

#### Staging Environment

- [ ] Use staging-specific secrets
- [ ] Test production-like security settings
- [ ] Enable SSL/TLS (`DB_SSL=true`)
- [ ] Use staging domains
- [ ] Test Docker secrets integration
- [ ] Validate secret rotation procedures

#### Production Environment

- [ ] Generate cryptographically secure secrets
- [ ] Use Docker secrets or external secret management
- [ ] Enable all security headers
- [ ] Use HTTPS everywhere (`NEXTAUTH_URL=https://...`)
- [ ] Enable strict cookie settings (`SESSION_SECURE=true`)
- [ ] Set production logging levels (`LOG_LEVEL=warn`)
- [ ] Enable error reporting (`ERROR_REPORTING_ENABLED=true`)
- [ ] Configure rate limiting
- [ ] Use production-grade database credentials
- [ ] Enable database SSL (`DB_SSL=true`)
- [ ] Set strong BCrypt rounds (`BCRYPT_ROUNDS=14`)
- [ ] Configure proper CORS origins
- [ ] Enable security monitoring

### Secret Rotation Procedures

#### 1. JWT Secret Rotation

```bash
#!/bin/bash
# rotate-jwt-secret.sh

OLD_SECRET=$JWT_SECRET
NEW_SECRET=$(openssl rand -hex 32)

echo "🔄 Rotating JWT Secret"
echo "Old secret: ${OLD_SECRET:0:8}..."
echo "New secret: ${NEW_SECRET:0:8}..."

# Update environment
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" docker-environment.env

# Restart backend services
docker-compose restart backend

# Wait for health check
sleep 10

# Verify new secret is working
if curl -s http://localhost:4000/health | grep -q "ok"; then
  echo "✅ JWT secret rotation successful"
else
  echo "❌ JWT secret rotation failed, rolling back"
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=$OLD_SECRET/" docker-environment.env
  docker-compose restart backend
fi
```

#### 2. Database Password Rotation

```bash
#!/bin/bash
# rotate-database-password.sh

NEW_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)

echo "🔄 Rotating Database Password"

# Update password in database
docker exec -it medianest_postgres_1 psql -U postgres -c "ALTER USER medianest PASSWORD '$NEW_PASSWORD';"

# Update environment
OLD_URL=$DATABASE_URL
NEW_URL=$(echo $DATABASE_URL | sed "s/:.*@/:$NEW_PASSWORD@/")

sed -i "s|DATABASE_URL=.*|DATABASE_URL=$NEW_URL|" docker-environment.env

# Restart services
docker-compose restart backend

echo "✅ Database password rotation complete"
```

### Security Headers Configuration

#### Backend Security Headers

```typescript
// backend/src/middleware/security.ts
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': process.env.NODE_ENV === 'production' 
    ? 'max-age=31536000; includeSubDomains' 
    : undefined,
};
```

#### CORS Security Configuration

```typescript
// backend/src/config/cors.ts
export const corsConfig = {
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
  credentials: process.env.CORS_CREDENTIALS !== 'false',
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token'
  ],
};
```

---

## Troubleshooting Guide

### Common Configuration Errors

#### 1. Database Connection Issues

**Error: `connection to server at "localhost" (127.0.0.1), port 5432 failed`**

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1;"

# Check connection string format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
```

**Solutions:**
```bash
# Fix 1: Ensure PostgreSQL is running
docker-compose -f config/docker/docker-compose.dev.yml up -d postgres

# Fix 2: Check connection string format
DATABASE_URL="postgresql://medianest:medianest_dev_password@postgres:5432/medianest_dev"

# Fix 3: Use localhost for local development
DATABASE_URL="postgresql://medianest:medianest_dev_password@localhost:5432/medianest_dev"

# Fix 4: Check database initialization
docker-compose logs postgres
```

#### 2. Redis Connection Failures

**Error: `Redis connection failed: connect ECONNREFUSED 127.0.0.1:6379`**

**Diagnosis:**
```bash
# Check Redis status
docker-compose ps redis

# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Verify Redis URL format
echo $REDIS_URL
# Should be: redis://localhost:6379 or redis://username:password@host:port
```

**Solutions:**
```bash
# Fix 1: Start Redis service
docker-compose -f config/docker/docker-compose.dev.yml up -d redis

# Fix 2: Correct Redis URL format
REDIS_URL="redis://localhost:6379"

# Fix 3: With authentication
REDIS_URL="redis://:password@localhost:6379"

# Fix 4: Check Redis logs
docker-compose logs redis
```

#### 3. JWT Secret Validation Errors

**Error: `JWT_SECRET must be at least 32 characters long`**

**Diagnosis:**
```bash
# Check secret length
echo "JWT_SECRET length: ${#JWT_SECRET}"

# Check if secret is set
if [[ -z "$JWT_SECRET" ]]; then
  echo "JWT_SECRET is not set"
else
  echo "JWT_SECRET is set (${#JWT_SECRET} characters)"
fi
```

**Solutions:**
```bash
# Generate proper JWT secret
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET" >> docker-environment.env

# Or use a specific 32+ character string
JWT_SECRET="your-super-secure-jwt-secret-that-is-at-least-32-characters-long"
```

#### 4. NextAuth Configuration Issues

**Error: `NEXTAUTH_URL mismatch` or `NEXTAUTH_SECRET missing`**

**Diagnosis:**
```bash
# Check NextAuth variables
echo "NEXTAUTH_URL: $NEXTAUTH_URL"
echo "NEXTAUTH_SECRET length: ${#NEXTAUTH_SECRET}"
echo "FRONTEND_URL: $FRONTEND_URL"
```

**Solutions:**
```bash
# Ensure URLs match
NEXTAUTH_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"

# Generate NextAuth secret
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Production URLs must use HTTPS
NEXTAUTH_URL="https://yourdomain.com"
```

### Environment Variable Validation

#### Comprehensive Validation Script

```bash
#!/bin/bash
# comprehensive-env-validation.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 MediaNest Environment Validation${NC}"

# Load environment file
ENV_FILE="${1:-docker-environment.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}❌ Environment file $ENV_FILE not found${NC}"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

VALIDATION_ERRORS=0

# Helper function to validate variable
validate_var() {
  local var_name="$1"
  local var_value="${!var_name:-}"
  local required="$2"
  local min_length="${3:-0}"
  local format="${4:-any}"
  
  if [[ -z "$var_value" ]]; then
    if [[ "$required" == "true" ]]; then
      echo -e "${RED}❌ $var_name is required but not set${NC}"
      ((VALIDATION_ERRORS++))
    else
      echo -e "${YELLOW}⚠️  $var_name is not set (optional)${NC}"
    fi
    return
  fi
  
  if [[ ${#var_value} -lt $min_length ]]; then
    echo -e "${RED}❌ $var_name is too short (${#var_value} < $min_length)${NC}"
    ((VALIDATION_ERRORS++))
    return
  fi
  
  case "$format" in
    "url")
      if [[ ! "$var_value" =~ ^https?:// ]]; then
        echo -e "${RED}❌ $var_name is not a valid URL${NC}"
        ((VALIDATION_ERRORS++))
        return
      fi
      ;;
    "postgres")
      if [[ ! "$var_value" =~ ^postgresql:// ]]; then
        echo -e "${RED}❌ $var_value is not a valid PostgreSQL URL${NC}"
        ((VALIDATION_ERRORS++))
        return
      fi
      ;;
    "redis")
      if [[ ! "$var_value" =~ ^redis:// ]]; then
        echo -e "${RED}❌ $var_value is not a valid Redis URL${NC}"
        ((VALIDATION_ERRORS++))
        return
      fi
      ;;
    "email")
      if [[ ! "$var_value" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        echo -e "${RED}❌ $var_name is not a valid email${NC}"
        ((VALIDATION_ERRORS++))
        return
      fi
      ;;
    "number")
      if [[ ! "$var_value" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ $var_name must be a number${NC}"
        ((VALIDATION_ERRORS++))
        return
      fi
      ;;
  esac
  
  echo -e "${GREEN}✅ $var_name is valid${NC}"
}

echo -e "\n${GREEN}📋 Validating Required Variables${NC}"

# Core required variables
validate_var "NODE_ENV" true 1 "any"
validate_var "DATABASE_URL" true 10 "postgres"
validate_var "REDIS_URL" true 5 "redis"
validate_var "JWT_SECRET" true 32 "any"
validate_var "NEXTAUTH_SECRET" true 32 "any"
validate_var "ENCRYPTION_KEY" true 32 "any"
validate_var "FRONTEND_URL" true 5 "url"

# Plex OAuth (required for auth)
validate_var "PLEX_CLIENT_ID" true 1 "any"
validate_var "PLEX_CLIENT_SECRET" true 1 "any"

echo -e "\n${GREEN}🔧 Validating Optional Variables${NC}"

# Optional but recommended
validate_var "NEXTAUTH_URL" false 5 "url"
validate_var "NEXT_PUBLIC_API_URL" false 5 "url"
validate_var "CORS_ORIGIN" false 5 "url"
validate_var "LOG_LEVEL" false 1 "any"

# Email configuration
validate_var "EMAIL_FROM" false 5 "email"
validate_var "SMTP_HOST" false 1 "any"
validate_var "SMTP_PORT" false 1 "number"

echo -e "\n${GREEN}🧪 Testing Connections${NC}"

# Test database connection
if command -v psql >/dev/null 2>&1; then
  if timeout 10 psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
  else
    echo -e "${RED}❌ Database connection failed${NC}"
    ((VALIDATION_ERRORS++))
  fi
else
  echo -e "${YELLOW}⚠️  psql not available, skipping database test${NC}"
fi

# Test Redis connection
if command -v redis-cli >/dev/null 2>&1; then
  # Parse Redis URL
  REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/.*@\([^:]*\).*/\1/p')
  REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
  
  if [[ -z "$REDIS_HOST" ]]; then
    REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/\([^:]*\).*/\1/p')
  fi
  
  if [[ -z "$REDIS_PORT" ]]; then
    REDIS_PORT=6379
  fi
  
  if timeout 5 redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis connection successful${NC}"
  else
    echo -e "${RED}❌ Redis connection failed${NC}"
    ((VALIDATION_ERRORS++))
  fi
else
  echo -e "${YELLOW}⚠️  redis-cli not available, skipping Redis test${NC}"
fi

echo -e "\n${GREEN}🔐 Security Validation${NC}"

# Check secret strength
if [[ ${#JWT_SECRET} -ge 64 ]]; then
  echo -e "${GREEN}✅ JWT_SECRET has excellent length${NC}"
elif [[ ${#JWT_SECRET} -ge 32 ]]; then
  echo -e "${YELLOW}⚠️  JWT_SECRET meets minimum requirements${NC}"
fi

if [[ ${#NEXTAUTH_SECRET} -ge 64 ]]; then
  echo -e "${GREEN}✅ NEXTAUTH_SECRET has excellent length${NC}"
elif [[ ${#NEXTAUTH_SECRET} -ge 32 ]]; then
  echo -e "${YELLOW}⚠️  NEXTAUTH_SECRET meets minimum requirements${NC}"
fi

# Check for weak secrets
if [[ "$JWT_SECRET" == *"password"* ]] || [[ "$JWT_SECRET" == *"secret"* ]] || [[ "$JWT_SECRET" == *"123"* ]]; then
  echo -e "${RED}❌ JWT_SECRET appears to be weak${NC}"
  ((VALIDATION_ERRORS++))
fi

# Production-specific checks
if [[ "$NODE_ENV" == "production" ]]; then
  echo -e "\n${GREEN}🏭 Production Environment Checks${NC}"
  
  if [[ "$FRONTEND_URL" != https://* ]]; then
    echo -e "${RED}❌ Production FRONTEND_URL should use HTTPS${NC}"
    ((VALIDATION_ERRORS++))
  fi
  
  if [[ "$NEXTAUTH_URL" != https://* ]]; then
    echo -e "${RED}❌ Production NEXTAUTH_URL should use HTTPS${NC}"
    ((VALIDATION_ERRORS++))
  fi
  
  if [[ "$LOG_LEVEL" == "debug" ]]; then
    echo -e "${YELLOW}⚠️  Debug logging enabled in production${NC}"
  fi
fi

# Summary
echo -e "\n${GREEN}📊 Validation Summary${NC}"

if [[ $VALIDATION_ERRORS -eq 0 ]]; then
  echo -e "${GREEN}✅ All validations passed! Environment is ready.${NC}"
  exit 0
else
  echo -e "${RED}❌ Found $VALIDATION_ERRORS validation error(s). Please fix before proceeding.${NC}"
  exit 1
fi
```

### Performance Issues

#### Database Performance Problems

**Issue: Slow database queries**

**Diagnosis:**
```bash
# Check connection pool settings
echo "DB_POOL_MIN: $DB_POOL_MIN"
echo "DB_POOL_MAX: $DB_POOL_MAX" 
echo "DB_TIMEOUT: $DB_TIMEOUT"

# Monitor active connections
docker exec -it medianest_postgres_1 psql -U postgres -c "
  SELECT count(*) as active_connections,
         state,
         wait_event_type,
         wait_event
  FROM pg_stat_activity
  GROUP BY state, wait_event_type, wait_event
  ORDER BY active_connections DESC;
"
```

**Solutions:**
```bash
# Increase connection pool
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_TIMEOUT=60000

# Enable connection pooling with PgBouncer
docker run -d --name pgbouncer \
  -e DATABASES_HOST=postgres \
  -e DATABASES_PORT=5432 \
  -e DATABASES_USER=medianest \
  -e DATABASES_PASSWORD=medianest_dev_password \
  -e DATABASES_DBNAME=medianest_dev \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=200 \
  -e DEFAULT_POOL_SIZE=25 \
  pgbouncer/pgbouncer:latest
```

#### Redis Performance Issues

**Issue: Redis connection timeouts**

**Diagnosis:**
```bash
# Check Redis memory usage
docker exec -it medianest_redis_1 redis-cli INFO memory

# Check Redis connections
docker exec -it medianest_redis_1 redis-cli INFO clients

# Monitor Redis commands
docker exec -it medianest_redis_1 redis-cli MONITOR
```

**Solutions:**
```bash
# Increase Redis memory and connections
REDIS_MAX_MEMORY_POLICY=allkeys-lru
REDIS_MAX_CLIENTS=2000

# Add Redis configuration
echo "maxmemory 256mb" >> redis.conf
echo "maxmemory-policy allkeys-lru" >> redis.conf
echo "maxclients 2000" >> redis.conf
```

### SSL/TLS Configuration Issues

#### Let's Encrypt Certificate Problems

**Issue: Certificate generation fails**

**Diagnosis:**
```bash
# Check Certbot logs
docker-compose logs certbot

# Verify domain DNS
nslookup yourdomain.com

# Check if port 80 is accessible
curl -I http://yourdomain.com/.well-known/acme-challenge/test
```

**Solutions:**
```bash
# Manual certificate generation
docker run --rm \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com

# Debug mode
docker run --rm \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  certbot/certbot certonly \
  --dry-run \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com
```

### Docker-Specific Issues

#### Container Startup Problems

**Issue: Backend container exits immediately**

**Diagnosis:**
```bash
# Check container logs
docker-compose logs backend

# Check environment variables in container
docker-compose exec backend env | grep -E "(DATABASE_URL|JWT_SECRET|REDIS_URL)"

# Test container manually
docker run --rm -it \
  --env-file docker-environment.env \
  medianest/backend:latest /bin/bash
```

**Solutions:**
```bash
# Fix 1: Ensure all required environment variables are set
# (Use validation script above)

# Fix 2: Check Docker secrets mounting
docker-compose config

# Fix 3: Verify image build
docker build -t medianest/backend:latest ./backend

# Fix 4: Check startup dependencies
depends_on:
  - postgres
  - redis
```

#### Docker Secrets Not Loading

**Issue: `readSecretFromFile` returns empty**

**Diagnosis:**
```bash
# Check if secrets are mounted
docker-compose exec backend ls -la /run/secrets/

# Verify secret content
docker-compose exec backend cat /run/secrets/jwt_secret

# Check Docker secrets exist
docker secret ls
```

**Solutions:**
```bash
# Recreate Docker secrets
docker secret rm jwt_secret
echo "$(openssl rand -hex 32)" | docker secret create jwt_secret -

# Verify secrets configuration in compose file
secrets:
  jwt_secret:
    external: true

# Enable Docker secrets in environment
USE_DOCKER_SECRETS=true
DOCKER_SECRETS_PATH=/run/secrets
```

### Testing Environment Issues

#### Test Database Connection Problems

**Issue: Tests fail with database connection errors**

**Diagnosis:**
```bash
# Check test database URL
echo "TEST_DATABASE_URL: $TEST_DATABASE_URL"

# Test connection manually
psql "$TEST_DATABASE_URL" -c "SELECT 1;"

# Check if test database exists
psql "$TEST_DATABASE_URL" -l
```

**Solutions:**
```bash
# Create test database
createdb -h localhost -U postgres medianest_test

# Set correct test environment
NODE_ENV=test
TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5432/medianest_test"

# Run database migrations for tests
npm run db:migrate:test
```

### Monitoring and Debugging Tools

#### Environment Debug Script

```bash
#!/bin/bash
# debug-environment.sh

echo "🔧 MediaNest Environment Debug Report"
echo "Generated: $(date)"
echo "=================================================="

echo -e "\n📋 Environment Summary"
echo "NODE_ENV: ${NODE_ENV:-'not set'}"
echo "Host: $(hostname)"
echo "User: $(whoami)"
echo "Working Directory: $(pwd)"

echo -e "\n🐳 Docker Status"
if command -v docker >/dev/null 2>&1; then
  echo "Docker Version: $(docker --version)"
  echo "Docker Compose Version: $(docker-compose --version)"
  
  echo -e "\nRunning Containers:"
  docker-compose ps
  
  echo -e "\nDocker Networks:"
  docker network ls | grep medianest
else
  echo "Docker not available"
fi

echo -e "\n🗄️  Database Status"
if [[ -n "$DATABASE_URL" ]]; then
  echo "Database URL: ${DATABASE_URL:0:20}..."
  if command -v psql >/dev/null 2>&1; then
    if timeout 5 psql "$DATABASE_URL" -c "SELECT version();" 2>/dev/null; then
      echo "✅ Database connection successful"
      psql "$DATABASE_URL" -c "SELECT current_database(), current_user, inet_server_addr(), inet_server_port();"
    else
      echo "❌ Database connection failed"
    fi
  fi
else
  echo "DATABASE_URL not set"
fi

echo -e "\n📊 Redis Status"
if [[ -n "$REDIS_URL" ]]; then
  echo "Redis URL: ${REDIS_URL:0:20}..."
  if command -v redis-cli >/dev/null 2>&1; then
    # Extract host and port
    REDIS_HOST=$(echo "$REDIS_URL" | sed 's|redis://||' | cut -d: -f1)
    REDIS_PORT=$(echo "$REDIS_URL" | sed 's|redis://||' | cut -d: -f2 | cut -d/ -f1)
    
    if timeout 5 redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null; then
      echo "✅ Redis connection successful"
      redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO server | head -5
    else
      echo "❌ Redis connection failed"
    fi
  fi
else
  echo "REDIS_URL not set"
fi

echo -e "\n🔐 Security Configuration"
echo "JWT_SECRET length: ${#JWT_SECRET:-0}"
echo "NEXTAUTH_SECRET length: ${#NEXTAUTH_SECRET:-0}"
echo "ENCRYPTION_KEY length: ${#ENCRYPTION_KEY:-0}"
echo "USE_DOCKER_SECRETS: ${USE_DOCKER_SECRETS:-false}"

if [[ "$USE_DOCKER_SECRETS" == "true" ]]; then
  echo -e "\nDocker Secrets:"
  ls -la /run/secrets/ 2>/dev/null || echo "Secrets directory not accessible"
fi

echo -e "\n🌐 Network Configuration"
echo "FRONTEND_URL: ${FRONTEND_URL:-'not set'}"
echo "NEXTAUTH_URL: ${NEXTAUTH_URL:-'not set'}"
echo "CORS_ORIGIN: ${CORS_ORIGIN:-'not set'}"

echo -e "\n📝 Logging Configuration"
echo "LOG_LEVEL: ${LOG_LEVEL:-'not set'}"
echo "LOG_FORMAT: ${LOG_FORMAT:-'not set'}"
echo "DEBUG: ${DEBUG:-'not set'}"

echo -e "\n🚀 Performance Settings"
echo "DB_POOL_MAX: ${DB_POOL_MAX:-'not set'}"
echo "REDIS_MAX_CLIENTS: ${REDIS_MAX_CLIENTS:-'not set'}"
echo "RATE_LIMIT_API_REQUESTS: ${RATE_LIMIT_API_REQUESTS:-'not set'}"

echo -e "\n🧪 Test Configuration"
if [[ "$NODE_ENV" == "test" ]]; then
  echo "TEST_DATABASE_URL: ${TEST_DATABASE_URL:-'not set'}"
  echo "TEST_REDIS_URL: ${TEST_REDIS_URL:-'not set'}"
else
  echo "Not in test environment"
fi

echo -e "\n📊 System Resources"
echo "Memory Usage: $(free -h 2>/dev/null | grep '^Mem:' || echo 'Not available')"
echo "Disk Usage: $(df -h . 2>/dev/null | tail -1 || echo 'Not available')"
echo "Load Average: $(uptime 2>/dev/null || echo 'Not available')"

echo -e "\n=================================================="
echo "🏁 Debug report complete"
```

Make it executable and run:

```bash
chmod +x debug-environment.sh
./debug-environment.sh > debug-report.txt
```

This comprehensive environment variables documentation provides everything needed to configure MediaNest correctly across all deployment scenarios. The guide includes detailed variable references, setup instructions, security best practices, and troubleshooting procedures to ensure successful configuration and deployment.