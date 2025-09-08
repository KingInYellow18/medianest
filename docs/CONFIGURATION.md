# MediaNest Configuration Guide

**Version:** 4.0 - Complete Configuration Management  
**Last Updated:** September 7, 2025  
**Scope:** Development, Staging, and Production Environments

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Environment Variables](#environment-variables)
3. [Database Configuration](#database-configuration)
4. [Authentication Configuration](#authentication-configuration)
5. [External Service Integration](#external-service-integration)
6. [Security Configuration](#security-configuration)
7. [Performance Tuning](#performance-tuning)
8. [Logging Configuration](#logging-configuration)
9. [Monitoring Configuration](#monitoring-configuration)
10. [Environment-Specific Settings](#environment-specific-settings)

## Configuration Overview

### Configuration Philosophy

MediaNest uses a hierarchical configuration system that prioritizes:

1. **Environment Variables** (highest priority)
2. **Configuration Files** (environment-specific)
3. **Default Values** (fallback defaults)

### Configuration Structure

```
config/
├── default.js          # Default configuration values
├── development.js      # Development overrides
├── staging.js          # Staging environment
├── production.js       # Production environment
├── test.js            # Testing environment
└── config.schema.js   # Configuration validation schema
```

### Configuration Validation

All configuration is validated at startup using Zod schemas to ensure:

- Required values are present
- Types are correct
- Values are within acceptable ranges
- Security requirements are met

## Environment Variables

### Core Application Settings

#### Application Configuration

```env
# Application Identity
NODE_ENV=production                    # Environment: development|staging|production|test
APP_NAME=MediaNest                    # Application name for logging/monitoring
APP_VERSION=1.0.0                     # Application version
PORT=4000                             # Server port (default: 4000)

# URLs and Endpoints
FRONTEND_URL=https://medianest.yourdomain.com    # Frontend URL for CORS
API_BASE_PATH=/api/v1                           # API base path
PUBLIC_URL=https://medianest.yourdomain.com     # Public-facing URL

# Server Configuration
HOST=0.0.0.0                          # Server bind address
TRUST_PROXY=true                      # Enable if behind reverse proxy
```

#### Database Configuration

```env
# PostgreSQL Database
DATABASE_URL=postgresql://username:password@localhost:5432/medianest_prod
DB_POOL_MIN=2                         # Minimum pool connections (default: 2)
DB_POOL_MAX=10                        # Maximum pool connections (default: 10)
DB_CONNECTION_TIMEOUT=5000            # Connection timeout in ms (default: 5000)
DB_IDLE_TIMEOUT=10000                 # Idle timeout in ms (default: 10000)

# Redis Cache
REDIS_URL=redis://localhost:6379      # Redis connection string
REDIS_PASSWORD=your-redis-password    # Redis password (if required)
REDIS_DB=0                           # Redis database number (default: 0)
REDIS_KEY_PREFIX=medianest:          # Key prefix for Redis keys
```

#### Security Configuration

```env
# JWT Configuration
JWT_SECRET=your-256-bit-jwt-secret-key-here-minimum-32-characters
JWT_REFRESH_SECRET=your-256-bit-refresh-secret-different-from-jwt
JWT_ACCESS_EXPIRES_IN=15m             # Access token expiration (default: 15m)
JWT_REFRESH_EXPIRES_IN=7d             # Refresh token expiration (default: 7d)

# Session Configuration
SESSION_COOKIE_NAME=medianest-session  # Session cookie name
SESSION_SECURE=true                   # Secure cookie flag (HTTPS only)
SESSION_SAME_SITE=strict             # SameSite cookie attribute
SESSION_MAX_AGE=86400000             # Session max age in ms (default: 24h)

# CSRF Protection
CSRF_SECRET=your-32-character-csrf-secret-key
CSRF_COOKIE_NAME=medianest-csrf      # CSRF cookie name
```

### External Service Configuration

#### Plex Integration

```env
# Plex Server Configuration
PLEX_SERVER_URL=http://your-plex-server:32400    # Plex server URL
PLEX_MACHINE_IDENTIFIER=your-plex-id             # Plex machine identifier
PLEX_TIMEOUT=10000                               # Request timeout in ms
PLEX_RETRY_ATTEMPTS=3                            # Number of retry attempts
PLEX_RETRY_DELAY=1000                           # Delay between retries in ms

# Plex Authentication
PLEX_CLIENT_ID=medianest-client-id              # Plex client identifier
PLEX_PRODUCT=MediaNest                          # Product name for Plex
PLEX_DEVICE_NAME=MediaNest-Server               # Device name
```

#### YouTube API Configuration

```env
# YouTube Data API
YOUTUBE_API_KEY=your-youtube-api-key-here       # YouTube Data API v3 key
YOUTUBE_QUOTA_LIMIT=10000                       # Daily quota limit
YOUTUBE_REQUEST_TIMEOUT=5000                    # Request timeout in ms
YOUTUBE_CACHE_TTL=3600                          # Cache TTL in seconds
YOUTUBE_MAX_RESULTS=50                          # Max results per request
```

### Performance and Rate Limiting

#### Rate Limiting Configuration

```env
# API Rate Limiting
RATE_LIMIT_WINDOW_MS=900000           # Rate limit window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=100           # Max requests per window per IP
RATE_LIMIT_SKIP_SUCCESS_RATE=true     # Skip rate limiting for successful requests

# Authentication Rate Limiting
AUTH_RATE_LIMIT_WINDOW_MS=900000      # Auth rate limit window (15 minutes)
AUTH_RATE_LIMIT_MAX_ATTEMPTS=5        # Max auth attempts per window per IP
AUTH_LOCKOUT_DURATION=1800000         # Account lockout duration (30 minutes)
```

#### Caching Configuration

```env
# Application Caching
CACHE_DEFAULT_TTL=3600                # Default cache TTL in seconds
CACHE_MAX_SIZE=100                    # Max cache entries
CACHE_COMPRESSION=true                # Enable cache compression

# External API Caching
PLEX_CACHE_TTL=300                    # Plex data cache TTL (5 minutes)
YOUTUBE_CACHE_TTL=1800                # YouTube data cache TTL (30 minutes)
```

### Logging and Monitoring

#### Logging Configuration

```env
# Log Configuration
LOG_LEVEL=info                        # Log level: error|warn|info|debug
LOG_FORMAT=json                       # Log format: json|simple
LOG_MAX_SIZE=10m                      # Max log file size
LOG_MAX_FILES=5                       # Max log file count
LOG_DATE_PATTERN=YYYY-MM-DD          # Log rotation pattern

# Log Destinations
LOG_CONSOLE=true                      # Enable console logging
LOG_FILE=true                         # Enable file logging
LOG_SYSLOG=false                     # Enable syslog (production)
```

#### Monitoring Configuration

```env
# Metrics Configuration
METRICS_ENABLED=true                  # Enable Prometheus metrics
METRICS_PORT=9090                     # Metrics endpoint port
METRICS_PATH=/metrics                 # Metrics endpoint path
METRICS_DEFAULT_LABELS=app=medianest  # Default metric labels

# Health Check Configuration
HEALTH_CHECK_ENABLED=true             # Enable health checks
HEALTH_CHECK_DATABASE=true            # Include database health
HEALTH_CHECK_REDIS=true               # Include Redis health
HEALTH_CHECK_EXTERNAL=true            # Include external service health
```

## Database Configuration

### PostgreSQL Configuration

#### Connection Pool Settings

```javascript
// Database connection configuration
const databaseConfig = {
  url: process.env.DATABASE_URL,
  pool: {
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    idle: parseInt(process.env.DB_IDLE_TIMEOUT) || 10000,
    acquire: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  },
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          require: true,
          rejectUnauthorized: false,
        }
      : false,
};
```

#### Migration Configuration

```env
# Database Migrations
AUTO_MIGRATE=false                    # Auto-run migrations on startup (dev only)
MIGRATE_ON_START=false               # Run pending migrations at startup
SEED_ON_START=false                  # Run database seeds at startup
```

### Redis Configuration

#### Connection Settings

```javascript
// Redis connection configuration
const redisConfig = {
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'medianest:',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};
```

## Authentication Configuration

### JWT Configuration

#### Token Settings

```javascript
// JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: 'MediaNest',
  audience: 'MediaNest-Users',
  algorithm: 'HS256',
};
```

### Session Configuration

#### Cookie Settings

```javascript
// Session cookie configuration
const sessionConfig = {
  name: process.env.SESSION_COOKIE_NAME || 'medianest-session',
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.SESSION_SECURE === 'true',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000,
    sameSite: process.env.SESSION_SAME_SITE || 'strict',
  },
  store: redisStore, // Use Redis for session storage
};
```

## External Service Integration

### Plex Configuration

#### Service Settings

```javascript
// Plex integration configuration
const plexConfig = {
  serverUrl: process.env.PLEX_SERVER_URL,
  timeout: parseInt(process.env.PLEX_TIMEOUT) || 10000,
  retryAttempts: parseInt(process.env.PLEX_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.PLEX_RETRY_DELAY) || 1000,
  clientIdentifier: process.env.PLEX_CLIENT_ID || 'medianest-client',
  product: process.env.PLEX_PRODUCT || 'MediaNest',
  deviceName: process.env.PLEX_DEVICE_NAME || 'MediaNest-Server',
  platform: 'Node.js',
  version: process.env.APP_VERSION || '1.0.0',
};
```

### YouTube Configuration

#### API Settings

```javascript
// YouTube API configuration
const youtubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY,
  quotaLimit: parseInt(process.env.YOUTUBE_QUOTA_LIMIT) || 10000,
  requestTimeout: parseInt(process.env.YOUTUBE_REQUEST_TIMEOUT) || 5000,
  cacheTTL: parseInt(process.env.YOUTUBE_CACHE_TTL) || 3600,
  maxResults: parseInt(process.env.YOUTUBE_MAX_RESULTS) || 50,
  retryAttempts: 3,
  retryDelay: 1000,
};
```

## Security Configuration

### HTTPS and SSL Configuration

#### SSL Settings

```env
# SSL/TLS Configuration
SSL_ENABLED=true                      # Enable HTTPS
SSL_CERT_PATH=/path/to/cert.pem      # SSL certificate path
SSL_KEY_PATH=/path/to/private.key    # SSL private key path
SSL_CA_PATH=/path/to/ca.pem          # SSL CA certificate path (optional)

# Security Headers
HSTS_ENABLED=true                     # Enable HSTS header
HSTS_MAX_AGE=31536000                # HSTS max age (1 year)
CSP_ENABLED=true                      # Enable CSP header
```

### CORS Configuration

#### Cross-Origin Settings

```javascript
// CORS configuration
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000', // Development frontend
      'http://localhost:3001', // Alternative dev port
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 86400, // 24 hours
};
```

## Performance Tuning

### Application Performance

#### Node.js Optimization

```env
# Node.js Performance
NODE_OPTIONS="--max-old-space-size=2048"  # Max heap size (2GB)
UV_THREADPOOL_SIZE=16                      # Increase thread pool size
NODE_ENV=production                        # Enable production optimizations
```

#### Express.js Configuration

```javascript
// Express performance configuration
app.set('trust proxy', process.env.TRUST_PROXY === 'true');
app.set('x-powered-by', false);
app.use(compression({ threshold: 1024 }));
app.use(helmet());
```

### Caching Strategy

#### Multi-Level Caching

```env
# Cache Configuration
L1_CACHE_SIZE=1000                    # In-memory cache size
L1_CACHE_TTL=300                      # L1 cache TTL (5 minutes)
L2_CACHE_TTL=3600                     # Redis cache TTL (1 hour)
CDN_CACHE_TTL=86400                   # CDN cache TTL (24 hours)
```

## Logging Configuration

### Structured Logging

#### Winston Configuration

```javascript
// Logging configuration
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.APP_NAME || 'MediaNest',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    // File transport
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
};
```

## Environment-Specific Settings

### Development Environment

```env
# Development-specific settings
NODE_ENV=development
LOG_LEVEL=debug
DB_LOGGING=true
AUTO_RELOAD=true
WEBPACK_DEV_MODE=true
SOURCE_MAPS=true
```

### Staging Environment

```env
# Staging-specific settings
NODE_ENV=staging
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECKS_ENABLED=true
SSL_ENABLED=true
```

### Production Environment

```env
# Production-specific settings
NODE_ENV=production
LOG_LEVEL=warn
METRICS_ENABLED=true
HEALTH_CHECKS_ENABLED=true
SSL_ENABLED=true
COMPRESSION_ENABLED=true
SECURITY_HEADERS_ENABLED=true
```

### Test Environment

```env
# Test-specific settings
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgresql://localhost:5432/medianest_test
DISABLE_AUTH=false
MOCK_EXTERNAL_APIS=true
```

---

**Note:** This configuration guide provides comprehensive settings for all MediaNest environments. Ensure sensitive values like secrets and API keys are properly secured and never committed to version control.
