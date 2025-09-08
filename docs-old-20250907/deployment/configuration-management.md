# Configuration Management

This guide covers managing MediaNest configurations across different environments, secret management, and configuration best practices.

## Table of Contents

- [Overview](#overview)
- [Environment Configuration](#environment-configuration)
- [Secret Management](#secret-management)
- [Configuration Files](#configuration-files)
- [Container Configuration](#container-configuration)
- [Database Configuration](#database-configuration)
- [Network Configuration](#network-configuration)
- [Security Configuration](#security-configuration)
- [Monitoring Configuration](#monitoring-configuration)
- [Configuration Validation](#configuration-validation)

## Overview

MediaNest uses a layered configuration approach:

1. **Base Configuration**: Default settings in code
2. **Environment Files**: `.env` files for environment-specific settings
3. **Docker Secrets**: Sensitive data management
4. **Container Environment**: Runtime environment variables
5. **Configuration Maps**: Kubernetes/Docker Swarm configuration
6. **Dynamic Configuration**: Runtime-configurable settings

## Environment Configuration

### Environment Hierarchy

```
Production:  .env.production -> Docker secrets -> Container environment
Staging:     .env.staging -> Docker secrets -> Container environment
Development: .env.development -> .env.local -> Container environment
Testing:     .env.test -> Container environment
```

### Environment Files

#### .env.production

```bash
# Production Environment Configuration
NODE_ENV=production
LOG_LEVEL=info
DEBUG=false

# Security
JWT_SECRET_FILE=/run/secrets/jwt_secret
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
SESSION_SECRET_FILE=/run/secrets/session_secret

# Database
DATABASE_URL_FILE=/run/secrets/database_url
DB_SSL_MODE=require
DB_POOL_MIN=5
DB_POOL_MAX=50

# Redis
REDIS_URL_FILE=/run/secrets/redis_url
REDIS_TLS=true

# External Services
PLEX_CLIENT_ID_FILE=/run/secrets/plex_client_id
PLEX_CLIENT_SECRET_FILE=/run/secrets/plex_client_secret

# Performance
UV_THREADPOOL_SIZE=128
NODE_OPTIONS=--max-old-space-size=2048
```

#### .env.development

```bash
# Development Environment Configuration
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=medianest:*

# Security (less secure for development)
JWT_SECRET=dev-jwt-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-32-characters
SESSION_SECRET=dev-session-secret-change-prod

# Database (Docker development services)
DATABASE_URL=postgresql://medianest:medianest_password@localhost:5432/medianest
DB_SSL_MODE=disable
DB_POOL_MIN=1
DB_POOL_MAX=10

# Redis (Docker development services)
REDIS_URL=redis://localhost:6379
REDIS_TLS=false

# Development Features
HOT_RELOAD=true
CHOKIDAR_USEPOLLING=true
REACT_EDITOR=code
```

#### .env.staging

```bash
# Staging Environment Configuration
NODE_ENV=staging
LOG_LEVEL=debug
DEBUG=medianest:api,medianest:db

# Security (production-like but separate secrets)
JWT_SECRET_FILE=/run/secrets/jwt_secret_staging
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key_staging

# Database (staging database)
DATABASE_URL_FILE=/run/secrets/database_url_staging
DB_SSL_MODE=require
DB_POOL_MIN=2
DB_POOL_MAX=20

# Staging-specific
FEATURE_FLAGS_ENABLED=true
MOCK_EXTERNAL_SERVICES=true
```

#### .env.test

```bash
# Test Environment Configuration
NODE_ENV=test
LOG_LEVEL=error
DEBUG=false

# Test Database
DATABASE_URL=postgresql://test:test@localhost:5432/medianest_test
REDIS_URL=redis://localhost:6379/15

# Test Settings
TEST_TIMEOUT=30000
MOCK_ALL_EXTERNAL=true
DISABLE_RATE_LIMITING=true
```

### Environment Variable Loading

```javascript
// backend/src/config/env.js
const dotenv = require('dotenv');
const path = require('path');

// Load environment-specific .env file
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });

// Load default .env file as fallback
dotenv.config();

// Validate required environment variables
const requiredVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];

const missingVars = requiredVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
```

## Secret Management

### Docker Secrets

#### Creating Secrets

```bash
# Generate secure secrets
mkdir -p secrets

# Database secrets
echo -n "$(openssl rand -base64 32)" > secrets/database_url
echo -n "postgresql://medianest:$(openssl rand -base64 16)@postgres:5432/medianest" > secrets/database_url
echo -n "$(openssl rand -base64 16)" > secrets/postgres_password

# Application secrets
echo -n "$(openssl rand -base64 32)" > secrets/jwt_secret
echo -n "$(openssl rand -base64 32)" > secrets/encryption_key
echo -n "$(openssl rand -base64 32)" > secrets/nextauth_secret
echo -n "$(openssl rand -base64 32)" > secrets/session_secret

# Redis secrets
echo -n "redis://redis:6379" > secrets/redis_url
echo -n "$(openssl rand -base64 16)" > secrets/redis_password

# OAuth secrets (replace with actual values)
echo -n "your-plex-client-id" > secrets/plex_client_id
echo -n "your-plex-client-secret" > secrets/plex_client_secret

# Set secure permissions
chmod 600 secrets/*
```

#### Docker Compose Secrets

```yaml
# docker-compose.prod.yml
secrets:
  database_url:
    file: ./secrets/database_url
  postgres_password:
    file: ./secrets/postgres_password
  redis_url:
    file: ./secrets/redis_url
  redis_password:
    file: ./secrets/redis_password
  jwt_secret:
    file: ./secrets/jwt_secret
  encryption_key:
    file: ./secrets/encryption_key
  nextauth_secret:
    file: ./secrets/nextauth_secret
  plex_client_id:
    file: ./secrets/plex_client_id
  plex_client_secret:
    file: ./secrets/plex_client_secret

services:
  backend:
    secrets:
      - database_url
      - redis_url
      - jwt_secret
      - encryption_key
      - plex_client_id
      - plex_client_secret
    environment:
      - DATABASE_URL_FILE=/run/secrets/database_url
      - REDIS_URL_FILE=/run/secrets/redis_url
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
```

### Kubernetes Secrets

```bash
# Create Kubernetes secrets
kubectl create secret generic medianest-secrets \
  --from-file=database_url=secrets/database_url \
  --from-file=redis_url=secrets/redis_url \
  --from-file=jwt_secret=secrets/jwt_secret \
  --from-file=encryption_key=secrets/encryption_key \
  --namespace=medianest-prod

# Use in deployment
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: medianest-backend
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: medianest-secrets
          key: database_url
    volumeMounts:
    - name: secrets
      mountPath: "/run/secrets"
      readOnly: true
  volumes:
  - name: secrets
    secret:
      secretName: medianest-secrets
```

### Secret Rotation

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -base64 32)
NEW_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Update secrets files
echo -n "$NEW_JWT_SECRET" > secrets/jwt_secret.new
echo -n "$NEW_ENCRYPTION_KEY" > secrets/encryption_key.new

# Atomic replacement
mv secrets/jwt_secret.new secrets/jwt_secret
mv secrets/encryption_key.new secrets/encryption_key

# Restart services
docker-compose restart backend

echo "Secrets rotated successfully"
```

## Configuration Files

### Application Configuration

#### backend/src/config/index.js

```javascript
const fs = require('fs');
const path = require('path');

// Helper to read file-based secrets
const readSecret = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (error) {
    return null;
  }
};

// Helper to get config value from file or environment
const getConfig = (envVar, fileSuffix) => {
  const fileVar = `${envVar}_FILE`;
  const filePath = process.env[fileVar];

  if (filePath) {
    return readSecret(filePath);
  }

  return process.env[envVar];
};

module.exports = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 4000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  },

  // Database Configuration
  database: {
    url: getConfig('DATABASE_URL'),
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: getConfig('DB_PASSWORD', 'postgres_password'),
    ssl: process.env.DB_SSL_MODE === 'require',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT) || 60000,
      createTimeoutMillis: parseInt(process.env.DB_POOL_CREATE_TIMEOUT) || 30000,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
    },
  },

  // Redis Configuration
  redis: {
    url: getConfig('REDIS_URL'),
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: getConfig('REDIS_PASSWORD'),
    db: parseInt(process.env.REDIS_DB) || 0,
    tls: process.env.REDIS_TLS === 'true',
    retryDelayOnFailure: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
  },

  // Security Configuration
  security: {
    jwt: {
      secret: getConfig('JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },
    encryption: {
      key: getConfig('ENCRYPTION_KEY'),
      algorithm: 'aes-256-gcm',
    },
    session: {
      secret: getConfig('SESSION_SECRET'),
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      httpOnly: process.env.SESSION_COOKIE_HTTP_ONLY !== 'false',
      sameSite: process.env.SESSION_COOKIE_SAME_SITE || 'strict',
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 604800000,
    },
  },

  // External Services
  plex: {
    url: process.env.PLEX_URL,
    token: getConfig('PLEX_TOKEN'),
    clientId: getConfig('PLEX_CLIENT_ID'),
    clientSecret: getConfig('PLEX_CLIENT_SECRET'),
    timeout: parseInt(process.env.PLEX_TIMEOUT) || 30000,
  },

  overseerr: {
    url: process.env.OVERSEERR_URL,
    apiKey: getConfig('OVERSEERR_API_KEY'),
    timeout: parseInt(process.env.OVERSEERR_TIMEOUT) || 15000,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE_PATH,
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 7,
  },

  // Feature Flags
  features: {
    realTimeUpdates: process.env.FEATURE_REAL_TIME_UPDATES === 'true',
    advancedSearch: process.env.FEATURE_ADVANCED_SEARCH === 'true',
    recommendations: process.env.FEATURE_RECOMMENDATIONS === 'true',
  },
};
```

#### frontend/next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Environment variables exposed to client
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Public runtime config
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',
  },

  // Server runtime config
  serverRuntimeConfig: {
    nextAuthSecret: process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL,
  },

  // Image optimization
  images: {
    domains: ['localhost', 'cdn.medianest.com'],
    formats: ['image/webp', 'image/avif'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
```

### Infrastructure Configuration

#### nginx.conf Template

```nginx
# Environment variable substitution template
upstream backend {
    server ${BACKEND_HOST}:${BACKEND_PORT};
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN_NAME};

    # SSL configuration
    ssl_certificate ${SSL_CERT_PATH};
    ssl_certificate_key ${SSL_KEY_PATH};

    # Rate limiting based on environment
    set $rate_limit "${RATE_LIMIT_RPM}r/m";
    limit_req zone=api_limit rate=$rate_limit burst=${RATE_LIMIT_BURST} nodelay;
}
```

#### PostgreSQL Configuration

```postgresql
# infrastructure/database/postgresql.conf
# Performance tuning based on environment

# Memory settings (adjust based on available RAM)
shared_buffers = ${POSTGRES_SHARED_BUFFERS:-256MB}
effective_cache_size = ${POSTGRES_EFFECTIVE_CACHE_SIZE:-1GB}
maintenance_work_mem = ${POSTGRES_MAINTENANCE_WORK_MEM:-64MB}

# Connection settings
max_connections = ${POSTGRES_MAX_CONNECTIONS:-100}
superuser_reserved_connections = 3

# WAL settings
wal_buffers = ${POSTGRES_WAL_BUFFERS:-16MB}
checkpoint_completion_target = 0.9
wal_compression = on

# Query planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging (environment-specific)
log_statement = '${POSTGRES_LOG_STATEMENT:-none}'
log_min_duration_statement = ${POSTGRES_LOG_MIN_DURATION:-1000}
```

## Container Configuration

### Docker Environment Variables

#### docker-compose.prod.yml

```yaml
services:
  backend:
    environment:
      # Core configuration
      - NODE_ENV=production
      - PORT=4000
      - HOST=0.0.0.0

      # Security
      - DATABASE_URL_FILE=/run/secrets/database_url
      - REDIS_URL_FILE=/run/secrets/redis_url
      - JWT_SECRET_FILE=/run/secrets/jwt_secret

      # External references
      - FRONTEND_URL=${FRONTEND_URL}
      - CORS_ORIGIN=${CORS_ORIGIN}

      # Feature flags
      - FEATURE_REAL_TIME_UPDATES=${FEATURE_REAL_TIME_UPDATES:-true}
      - FEATURE_ADVANCED_SEARCH=${FEATURE_ADVANCED_SEARCH:-true}

      # Performance
      - UV_THREADPOOL_SIZE=128
      - NODE_OPTIONS=--max-old-space-size=2048

  postgres:
    environment:
      - POSTGRES_DB=medianest
      - POSTGRES_USER=medianest
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

      # Performance tuning
      - POSTGRES_MAX_CONNECTIONS=${DB_MAX_CONNECTIONS:-100}
      - POSTGRES_SHARED_BUFFERS=${DB_SHARED_BUFFERS:-256MB}
      - POSTGRES_EFFECTIVE_CACHE_SIZE=${DB_EFFECTIVE_CACHE_SIZE:-1GB}
```

### Environment Variable Validation

```javascript
// backend/src/config/validation.js
const Joi = require('joi');

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').required(),
  PORT: Joi.number().port().default(4000),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().min(32).required(),

  // Optional with defaults
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Environment-specific
  DB_SSL_MODE: Joi.string()
    .valid('require', 'prefer', 'disable')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.default('require'),
      otherwise: Joi.default('disable'),
    }),
});

module.exports = (config) => {
  const { error, value } = configSchema.validate(config, { allowUnknown: true });

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value;
};
```

## Database Configuration

### Connection Pool Configuration

```javascript
// backend/src/database/connection.js
const { Pool } = require('pg');
const config = require('../config');

const poolConfig = {
  connectionString: config.database.url,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,

  // Connection pool settings
  min: config.database.pool.min,
  max: config.database.pool.max,
  acquireTimeoutMillis: config.database.pool.acquireTimeoutMillis,
  createTimeoutMillis: config.database.pool.createTimeoutMillis,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,

  // Connection validation
  testOnBorrow: true,
  testOnReturn: false,

  // Error handling
  handleDisconnects: true,
  handleDuplicateColumns: false,
};

const pool = new Pool(poolConfig);

// Monitor pool events
pool.on('connect', (client) => {
  console.log('Database client connected');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
```

### Migration Configuration

```javascript
// knexfile.js
const config = require('./backend/src/config');

module.exports = {
  development: {
    client: 'postgresql',
    connection: config.database.url,
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      directory: './backend/migrations',
    },
    seeds: {
      directory: './backend/seeds',
    },
  },

  staging: {
    client: 'postgresql',
    connection: config.database.url,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './backend/migrations',
    },
  },

  production: {
    client: 'postgresql',
    connection: config.database.url,
    ssl: { rejectUnauthorized: false },
    pool: {
      min: 5,
      max: 50,
    },
    migrations: {
      directory: './backend/migrations',
    },
    acquireConnectionTimeout: 60000,
    log: {
      warn(message) {
        console.warn('Database warning:', message);
      },
      error(message) {
        console.error('Database error:', message);
      },
    },
  },
};
```

## Network Configuration

### Docker Networks

```yaml
# docker-compose.prod.yml
networks:
  frontend-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
    driver_opts:
      com.docker.network.bridge.enable_icc: 'true'
      com.docker.network.bridge.enable_ip_masquerade: 'true'

  backend-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/24
    driver_opts:
      com.docker.network.bridge.enable_icc: 'true'
      com.docker.network.bridge.enable_ip_masquerade: 'false'
    internal: true # No internet access for backend network

services:
  nginx:
    networks:
      - frontend-network

  frontend:
    networks:
      - frontend-network

  backend:
    networks:
      - frontend-network
      - backend-network

  postgres:
    networks:
      - backend-network

  redis:
    networks:
      - backend-network
```

### Firewall Configuration

```bash
#!/bin/bash
# scripts/setup-firewall.sh

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Deny direct database access
ufw deny 5432/tcp
ufw deny 6379/tcp

# Allow Docker networks
ufw allow in on docker0
ufw allow out on docker0

# Enable firewall
ufw --force enable
```

## Security Configuration

### SSL/TLS Configuration

```bash
# Generate strong DH parameters
openssl dhparam -out /etc/nginx/ssl/dhparam.pem 4096

# SSL configuration in nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
```

### Security Headers Configuration

```javascript
// backend/src/middleware/security.js
const helmet = require('helmet');

module.exports = (app) => {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          fontSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );
};
```

## Monitoring Configuration

### Prometheus Configuration

```yaml
# config/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'alert_rules.yml'

scrape_configs:
  - job_name: 'medianest-backend'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'medianest-postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s

  - job_name: 'medianest-redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Logging Configuration

```yaml
# config/promtail.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/log/containers/*.log

  - job_name: medianest-app
    static_configs:
      - targets:
          - localhost
        labels:
          job: medianest-app
          __path__: /var/log/app/*.log
```

## Configuration Validation

### Startup Validation

```javascript
// backend/src/utils/validateConfig.js
const fs = require('fs');
const config = require('../config');

const validateConfig = () => {
  const errors = [];

  // Check required secrets
  const requiredSecrets = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL'];

  requiredSecrets.forEach((secret) => {
    if (!config.security.jwt.secret && secret === 'JWT_SECRET') {
      errors.push(`Missing required secret: ${secret}`);
    }
  });

  // Validate database connection
  if (!config.database.url) {
    errors.push('Database URL is required');
  }

  // Validate Redis connection
  if (!config.redis.url) {
    errors.push('Redis URL is required');
  }

  // Check SSL in production
  if (config.server.env === 'production' && !config.database.ssl) {
    errors.push('SSL is required in production');
  }

  // Validate file permissions for secrets
  if (config.server.env === 'production') {
    const secretFiles = ['/run/secrets/jwt_secret', '/run/secrets/encryption_key'];
    secretFiles.forEach((file) => {
      try {
        const stats = fs.statSync(file);
        if ((stats.mode & parseInt('0777', 8)) !== parseInt('0600', 8)) {
          errors.push(`Insecure permissions on ${file}`);
        }
      } catch (error) {
        errors.push(`Cannot access secret file: ${file}`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  console.log('✅ Configuration validation passed');
};

module.exports = validateConfig;
```

### Health Check Configuration

```javascript
// backend/src/routes/health.js
const express = require('express');
const config = require('../config');
const pool = require('../database/connection');
const redis = require('../utils/redis');

const router = express.Router();

router.get('/health', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    version: process.env.npm_package_version || 'unknown',
    status: 'healthy',
    checks: {},
  };

  // Database health check
  try {
    await pool.query('SELECT 1');
    checks.checks.database = { status: 'healthy' };
  } catch (error) {
    checks.checks.database = { status: 'unhealthy', error: error.message };
    checks.status = 'unhealthy';
  }

  // Redis health check
  try {
    await redis.ping();
    checks.checks.redis = { status: 'healthy' };
  } catch (error) {
    checks.checks.redis = { status: 'unhealthy', error: error.message };
    checks.status = 'unhealthy';
  }

  // Configuration validation
  try {
    if (!config.security.jwt.secret) throw new Error('JWT secret not configured');
    if (!config.database.url) throw new Error('Database URL not configured');
    checks.checks.configuration = { status: 'healthy' };
  } catch (error) {
    checks.checks.configuration = { status: 'unhealthy', error: error.message };
    checks.status = 'unhealthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

router.get('/ready', async (req, res) => {
  // Readiness check - can handle requests
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

module.exports = router;
```

### Configuration Management Best Practices

1. **Never commit secrets to version control**
2. **Use environment-specific configuration files**
3. **Validate configuration at startup**
4. **Use Docker secrets in production**
5. **Implement configuration hot-reloading where possible**
6. **Monitor configuration changes**
7. **Use strong encryption for sensitive data**
8. **Regularly rotate secrets and certificates**
9. **Implement least-privilege access**
10. **Document all configuration options**

For more information, see the related documentation:

- [Production Deployment Guide](./production-deployment-guide.md)
- [Security Hardening](./security-guide.md)
- [Monitoring Setup](./monitoring-setup.md)
