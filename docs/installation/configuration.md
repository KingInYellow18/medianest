# Configuration Guide

This guide covers all configuration options available in MediaNest, including environment variables, configuration files, and runtime settings.

## Configuration Methods

MediaNest supports multiple configuration methods:

1. **Environment Variables** (recommended for production)
2. **Configuration Files** (JSON/YAML)
3. **Command Line Arguments**
4. **Web Interface Settings**

## Environment Variables

### Core Application Settings

```bash
# Application Environment
NODE_ENV=production                    # development, production, test
PORT=3000                             # Application port
APP_URL=https://medianest.example.com  # Public application URL
APP_NAME="MediaNest"                  # Application name

# Security Settings
JWT_SECRET=your_secure_jwt_secret_min_32_chars
SESSION_SECRET=your_secure_session_secret_min_32_chars
BCRYPT_ROUNDS=12                      # Password hashing rounds (10-15)
RATE_LIMIT_WINDOW=900000              # Rate limit window in ms (15 min)
RATE_LIMIT_MAX=100                    # Max requests per window
```

### Database Configuration

```bash
# PostgreSQL Database
DATABASE_URL=postgresql://user:password@host:port/database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medianest
DB_USER=medianest
DB_PASS=secure_password
DB_SSL=false                          # Enable SSL for database connections
DB_POOL_MIN=2                         # Minimum connection pool size
DB_POOL_MAX=10                        # Maximum connection pool size
DB_TIMEOUT=60000                      # Connection timeout in ms
```

### Cache Configuration

```bash
# Redis Cache (optional but recommended)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0                            # Redis database number
CACHE_TTL=3600                        # Default cache TTL in seconds
SESSION_STORE=redis                   # Session store type: memory, redis
```

### Media and Storage Settings

```bash
# Media Storage
MEDIA_ROOT=/var/lib/medianest/media   # Media files root directory
UPLOAD_PATH=/var/lib/medianest/uploads # Upload directory
TEMP_PATH=/tmp/medianest              # Temporary files directory
MAX_FILE_SIZE=2147483648              # Max file size in bytes (2GB)
UPLOAD_MAX_SIZE=100mb                 # Max upload size
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,webp,mp4,mkv,avi,mov # Allowed file extensions

# Thumbnails
THUMBNAIL_QUALITY=80                  # JPEG quality for thumbnails (1-100)
THUMBNAIL_MAX_WIDTH=1920              # Max thumbnail width
THUMBNAIL_MAX_HEIGHT=1080             # Max thumbnail height
GENERATE_THUMBNAILS=true              # Auto-generate thumbnails
```

### External API Integration

```bash
# TMDB (The Movie Database)
TMDB_API_KEY=your_tmdb_api_key
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p/

# TVDB (TheTVDB)
TVDB_API_KEY=your_tvdb_api_key
TVDB_BASE_URL=https://api4.thetvdb.com/v4

# MusicBrainz
MUSICBRAINZ_BASE_URL=https://musicbrainz.org/ws/2
MUSICBRAINZ_USER_AGENT=MediaNest/1.0

# Plex Integration
PLEX_SERVER_URL=http://plex.example.com:32400
PLEX_TOKEN=your_plex_token
PLEX_SYNC_ENABLED=false
```

### Email Configuration

```bash
# SMTP Settings
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false                     # true for 465, false for other ports
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
SMTP_FROM="MediaNest <noreply@example.com>"

# Email Templates
EMAIL_TEMPLATE_PATH=/app/templates/email
EMAIL_LOGO_URL=https://example.com/logo.png
```

### Logging Configuration

```bash
# Logging Settings
LOG_LEVEL=info                        # error, warn, info, verbose, debug, silly
LOG_FORMAT=combined                   # combined, json, simple
LOG_DIR=/var/log/medianest           # Log directory
LOG_MAX_SIZE=10m                     # Max log file size
LOG_MAX_FILES=5                      # Max number of log files
LOG_DATE_PATTERN=YYYY-MM-DD          # Log rotation pattern

# Debug Options
DEBUG=medianest:*                    # Debug namespaces (development only)
VERBOSE_ERRORS=false                 # Include stack traces in API responses
```

### Performance and Optimization

```bash
# Cluster Mode
CLUSTER_MODE=false                   # Enable cluster mode
WORKER_PROCESSES=auto                # Number of worker processes (auto = CPU cores)

# Memory Management
MAX_OLD_SPACE_SIZE=2048              # Node.js max old space size in MB
UV_THREADPOOL_SIZE=128               # UV thread pool size

# Request Handling
REQUEST_TIMEOUT=300000               # Request timeout in ms (5 min)
KEEP_ALIVE_TIMEOUT=65000             # Keep-alive timeout in ms
HEADERS_TIMEOUT=66000                # Headers timeout in ms
```

### Security Configuration

```bash
# CORS Settings
CORS_ENABLED=true
CORS_ORIGIN=*                        # Allowed origins (* for all)
CORS_CREDENTIALS=true                # Allow credentials
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization

# Content Security Policy
CSP_ENABLED=true
CSP_REPORT_ONLY=false

# HTTPS Settings
FORCE_HTTPS=true                     # Redirect HTTP to HTTPS
HSTS_MAX_AGE=31536000               # HTTPS Strict Transport Security max age
TRUST_PROXY=1                        # Trust proxy headers (0=false, 1=first hop, true=all)

# API Security
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_WINDOW=900000        # API rate limit window (15 min)
API_RATE_LIMIT_MAX=1000             # Max API requests per window
REQUIRE_API_KEY=false               # Require API key for API access
```

## Configuration Files

### Main Configuration File

Create `config/config.json`:

```json
{
  "development": {
    "app": {
      "name": "MediaNest Development",
      "url": "http://localhost:3000",
      "debug": true
    },
    "database": {
      "host": "localhost",
      "port": 5432,
      "database": "medianest_dev",
      "username": "medianest",
      "password": "password",
      "dialect": "postgres",
      "logging": true
    },
    "redis": {
      "host": "localhost",
      "port": 6379,
      "db": 0
    }
  },
  "production": {
    "app": {
      "name": "MediaNest",
      "url": "${APP_URL}",
      "debug": false
    },
    "database": {
      "use_env_variable": "DATABASE_URL",
      "dialect": "postgres",
      "logging": false,
      "pool": {
        "max": 10,
        "min": 2,
        "acquire": 60000,
        "idle": 10000
      }
    },
    "redis": {
      "url": "${REDIS_URL}"
    }
  }
}
```

### Feature Configuration

Create `config/features.json`:

```json
{
  "features": {
    "userRegistration": true,
    "socialLogin": false,
    "twoFactorAuth": true,
    "apiAccess": true,
    "webhooks": true,
    "mediaProcessing": true,
    "thumbnailGeneration": true,
    "videoTranscoding": false,
    "plexIntegration": false,
    "notifications": true,
    "search": true,
    "collections": true,
    "sharing": true,
    "comments": false,
    "ratings": true
  },
  "limits": {
    "maxUsers": 100,
    "maxStoragePerUser": "10GB",
    "maxUploadSize": "100MB",
    "maxApiCallsPerHour": 1000
  }
}
```

### Media Processing Configuration

Create `config/media.json`:

```json
{
  "processing": {
    "enabled": true,
    "concurrency": 2,
    "timeout": 300000,
    "retries": 3
  },
  "thumbnails": {
    "enabled": true,
    "quality": 80,
    "sizes": [
      { "name": "small", "width": 300, "height": 300 },
      { "name": "medium", "width": 600, "height": 600 },
      { "name": "large", "width": 1200, "height": 1200 }
    ]
  },
  "video": {
    "transcoding": false,
    "formats": ["mp4", "webm"],
    "quality": ["480p", "720p", "1080p"]
  },
  "metadata": {
    "autoFetch": true,
    "sources": ["tmdb", "tvdb", "musicbrainz"],
    "cacheMetadata": true,
    "metadataTTL": 2592000
  }
}
```

## Runtime Configuration

### Web Interface Settings

Access the web interface at `/admin/settings` to configure:

#### General Settings

- Site name and description
- Default language and timezone
- Theme and branding options
- Contact information

#### User Management

- User registration settings
- Password requirements
- Session duration
- Role and permission management

#### Media Library Settings

- Default scan intervals
- Metadata sources priority
- File organization rules
- Duplicate handling

#### Notification Settings

- Email notification preferences
- Webhook configurations
- Alert thresholds
- Notification templates

## Advanced Configuration

### Custom Middleware Configuration

Create `config/middleware.js`:

```javascript
module.exports = {
  // Custom authentication middleware
  auth: {
    enabled: true,
    strategies: ['jwt', 'session'],
    jwt: {
      algorithm: 'HS256',
      expiresIn: '1h',
    },
  },

  // Request logging middleware
  logging: {
    enabled: true,
    format: 'combined',
    skip: (req) => req.url.startsWith('/health'),
  },

  // Compression middleware
  compression: {
    enabled: true,
    level: 6,
    threshold: 1024,
  },

  // Static file serving
  static: {
    enabled: true,
    maxAge: '1y',
    immutable: true,
  },
};
```

### Database Migrations Configuration

Create `config/database-config.js`:

```javascript
module.exports = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'medianest_dev',
    username: process.env.DB_USER || 'medianest',
    password: process.env.DB_PASS || 'password',
    migrationStorageTableName: 'sequelize_meta',
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    migrationStorageTableName: 'sequelize_meta',
    dialectOptions: {
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
  },
};
```

## Configuration Validation

### Environment Variable Validation

MediaNest validates required environment variables on startup:

```javascript
const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'];

const optionalEnvVars = ['REDIS_URL', 'SMTP_HOST', 'TMDB_API_KEY'];
```

### Configuration Schema

The application validates configuration against a predefined schema:

```json
{
  "type": "object",
  "required": ["database", "app"],
  "properties": {
    "database": {
      "type": "object",
      "required": ["host", "port", "database"]
    },
    "app": {
      "type": "object",
      "required": ["name", "url"]
    }
  }
}
```

## Best Practices

### Security Best Practices

1. **Use Strong Secrets**: Generate cryptographically secure secrets
2. **Environment Isolation**: Keep secrets in environment variables
3. **Principle of Least Privilege**: Only grant necessary permissions
4. **Regular Updates**: Keep configuration up to date

### Performance Best Practices

1. **Connection Pooling**: Configure appropriate database pool sizes
2. **Caching Strategy**: Use Redis for session and data caching
3. **Resource Limits**: Set appropriate memory and CPU limits
4. **Monitoring**: Enable logging and metrics collection

### Configuration Management

1. **Version Control**: Track configuration changes
2. **Documentation**: Document all configuration options
3. **Validation**: Validate configuration before deployment
4. **Backup**: Backup configuration files regularly

## Troubleshooting Configuration Issues

### Common Issues

#### Invalid Environment Variables

```bash
# Check environment variables
printenv | grep MEDIANEST
node -e "console.log(process.env.DATABASE_URL)"
```

#### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"
```

#### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### Configuration Debugging

Enable debug mode to troubleshoot configuration issues:

```bash
DEBUG=medianest:config NODE_ENV=development npm start
```

### Health Check Endpoint

Use the health check endpoint to verify configuration:

```bash
curl http://localhost:3000/api/health
```

Response includes configuration status:

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "config": "valid"
}
```

For more configuration examples and advanced setups, see the [Deployment Guide](../developers/deployment.md).
