# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in MediaNest.

## Required Environment Variables

These variables must be set for MediaNest to function properly:

```bash
# Database Connection
DATABASE_URL=postgresql://username:password@host:port/database

# Security Keys
JWT_SECRET=your_secure_jwt_secret_minimum_32_characters
SESSION_SECRET=your_secure_session_secret_minimum_32_characters

# Application Environment
NODE_ENV=production  # or development, test
```

## Core Application Variables

### Application Settings

| Variable        | Description             | Default                 | Example                     |
| --------------- | ----------------------- | ----------------------- | --------------------------- |
| `NODE_ENV`      | Application environment | `development`           | `production`                |
| `PORT`          | Application port        | `3000`                  | `8080`                      |
| `APP_NAME`      | Application name        | `MediaNest`             | `My Media Server`           |
| `APP_URL`       | Public application URL  | `http://localhost:3000` | `https://media.example.com` |
| `API_BASE_PATH` | API base path           | `/api`                  | `/api/v1`                   |
| `TRUST_PROXY`   | Trust proxy headers     | `0`                     | `1`                         |

### Security Configuration

| Variable            | Description               | Default    | Example                                |
| ------------------- | ------------------------- | ---------- | -------------------------------------- |
| `JWT_SECRET`        | JWT signing secret        | _Required_ | `super-secure-jwt-secret-key-32-chars` |
| `SESSION_SECRET`    | Session encryption secret | _Required_ | `super-secure-session-secret-32-chars` |
| `BCRYPT_ROUNDS`     | Password hashing rounds   | `12`       | `14`                                   |
| `RATE_LIMIT_WINDOW` | Rate limiting window (ms) | `900000`   | `3600000`                              |
| `RATE_LIMIT_MAX`    | Max requests per window   | `100`      | `500`                                  |
| `CORS_ORIGIN`       | Allowed CORS origins      | `*`        | `https://app.example.com`              |
| `CORS_CREDENTIALS`  | Allow CORS credentials    | `true`     | `false`                                |

## Database Configuration

### PostgreSQL Settings

| Variable       | Description              | Default     | Example                               |
| -------------- | ------------------------ | ----------- | ------------------------------------- |
| `DATABASE_URL` | Complete database URL    | _Required_  | `postgresql://user:pass@host:5432/db` |
| `DB_HOST`      | Database host            | `localhost` | `db.example.com`                      |
| `DB_PORT`      | Database port            | `5432`      | `5433`                                |
| `DB_NAME`      | Database name            | `medianest` | `medianest_prod`                      |
| `DB_USER`      | Database username        | `medianest` | `db_user`                             |
| `DB_PASS`      | Database password        | _Required_  | `secure_db_password`                  |
| `DB_SSL`       | Enable SSL for database  | `false`     | `true`                                |
| `DB_POOL_MIN`  | Minimum pool connections | `2`         | `5`                                   |
| `DB_POOL_MAX`  | Maximum pool connections | `10`        | `20`                                  |
| `DB_TIMEOUT`   | Connection timeout (ms)  | `60000`     | `30000`                               |

### Database URL Format

The `DATABASE_URL` should follow this format:

```
postgresql://[user[:password]@][host][:port][/database][?param1=value1&...]
```

**Examples:**

```bash
# Basic connection
DATABASE_URL=postgresql://medianest:password@localhost:5432/medianest

# With SSL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Cloud database (Heroku style)
DATABASE_URL=postgres://user:pass@host.compute-1.amazonaws.com:5432/db
```

## Cache Configuration

### Redis Settings

| Variable         | Description                 | Default     | Example                  |
| ---------------- | --------------------------- | ----------- | ------------------------ |
| `REDIS_URL`      | Complete Redis URL          | _Optional_  | `redis://localhost:6379` |
| `REDIS_HOST`     | Redis host                  | `localhost` | `cache.example.com`      |
| `REDIS_PORT`     | Redis port                  | `6379`      | `6380`                   |
| `REDIS_PASSWORD` | Redis password              | _None_      | `redis_password`         |
| `REDIS_DB`       | Redis database number       | `0`         | `1`                      |
| `CACHE_TTL`      | Default cache TTL (seconds) | `3600`      | `7200`                   |
| `SESSION_STORE`  | Session store type          | `memory`    | `redis`                  |
| `SESSION_TTL`    | Session TTL (seconds)       | `86400`     | `3600`                   |

### Redis URL Format

The `REDIS_URL` should follow this format:

```
redis://[username:password@]host[:port][/database]
```

**Examples:**

```bash
# Basic connection
REDIS_URL=redis://localhost:6379

# With password
REDIS_URL=redis://:password@localhost:6379

# With database selection
REDIS_URL=redis://localhost:6379/1

# Secure connection
REDIS_URL=rediss://user:pass@host:6380/0
```

## Storage and Media Configuration

### File Storage

| Variable          | Description               | Default          | Example                      |
| ----------------- | ------------------------- | ---------------- | ---------------------------- |
| `MEDIA_ROOT`      | Media files directory     | `/app/media`     | `/var/lib/medianest/media`   |
| `UPLOAD_PATH`     | Upload directory          | `/app/uploads`   | `/var/lib/medianest/uploads` |
| `TEMP_PATH`       | Temporary files directory | `/tmp/medianest` | `/var/tmp/medianest`         |
| `STATIC_PATH`     | Static files directory    | `/app/public`    | `/var/www/static`            |
| `MAX_FILE_SIZE`   | Max file size (bytes)     | `2147483648`     | `5368709120`                 |
| `UPLOAD_MAX_SIZE` | Max upload size           | `100mb`          | `1gb`                        |
| `STORAGE_DRIVER`  | Storage driver            | `local`          | `s3`                         |

### Image Processing

| Variable               | Description              | Default                 | Example    |
| ---------------------- | ------------------------ | ----------------------- | ---------- |
| `THUMBNAIL_QUALITY`    | JPEG quality (1-100)     | `80`                    | `90`       |
| `THUMBNAIL_MAX_WIDTH`  | Max thumbnail width      | `1920`                  | `2560`     |
| `THUMBNAIL_MAX_HEIGHT` | Max thumbnail height     | `1080`                  | `1440`     |
| `GENERATE_THUMBNAILS`  | Auto-generate thumbnails | `true`                  | `false`    |
| `IMAGE_FORMATS`        | Supported image formats  | `jpg,jpeg,png,gif,webp` | `jpg,png`  |
| `VIDEO_FORMATS`        | Supported video formats  | `mp4,mkv,avi,mov`       | `mp4,webm` |

### Cloud Storage (AWS S3)

| Variable                | Description        | Default     | Example                                    |
| ----------------------- | ------------------ | ----------- | ------------------------------------------ |
| `AWS_ACCESS_KEY_ID`     | AWS access key     | _Optional_  | `AKIAIOSFODNN7EXAMPLE`                     |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key     | _Optional_  | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION`            | AWS region         | `us-east-1` | `eu-west-1`                                |
| `S3_BUCKET`             | S3 bucket name     | _Optional_  | `medianest-media`                          |
| `S3_ENDPOINT`           | Custom S3 endpoint | _Optional_  | `https://s3.amazonaws.com`                 |
| `CDN_URL`               | CDN base URL       | _Optional_  | `https://d1234567890.cloudfront.net`       |

## External API Integration

### TMDB (The Movie Database)

| Variable              | Description              | Default                        | Example                            |
| --------------------- | ------------------------ | ------------------------------ | ---------------------------------- |
| `TMDB_API_KEY`        | TMDB API key             | _Optional_                     | `1234567890abcdef1234567890abcdef` |
| `TMDB_BASE_URL`       | TMDB API base URL        | `https://api.themoviedb.org/3` | -                                  |
| `TMDB_IMAGE_BASE_URL` | TMDB image base URL      | `https://image.tmdb.org/t/p/`  | -                                  |
| `TMDB_TIMEOUT`        | API timeout (ms)         | `10000`                        | `5000`                             |
| `TMDB_RATE_LIMIT`     | API rate limit (req/sec) | `10`                           | `5`                                |

### TVDB (TheTVDB)

| Variable        | Description       | Default                       | Example                            |
| --------------- | ----------------- | ----------------------------- | ---------------------------------- |
| `TVDB_API_KEY`  | TVDB API key      | _Optional_                    | `1234567890abcdef1234567890abcdef` |
| `TVDB_BASE_URL` | TVDB API base URL | `https://api4.thetvdb.com/v4` | -                                  |
| `TVDB_TIMEOUT`  | API timeout (ms)  | `10000`                       | `15000`                            |

### Plex Integration

| Variable             | Description                 | Default    | Example                   |
| -------------------- | --------------------------- | ---------- | ------------------------- |
| `PLEX_SERVER_URL`    | Plex server URL             | _Optional_ | `http://plex.local:32400` |
| `PLEX_TOKEN`         | Plex authentication token   | _Optional_ | `xxxxxxxxxxxxxxxxxxxx`    |
| `PLEX_SYNC_ENABLED`  | Enable Plex synchronization | `false`    | `true`                    |
| `PLEX_SYNC_INTERVAL` | Sync interval (minutes)     | `60`       | `30`                      |

## Email Configuration

### SMTP Settings

| Variable       | Description          | Default               | Example                           |
| -------------- | -------------------- | --------------------- | --------------------------------- |
| `SMTP_ENABLED` | Enable email sending | `false`               | `true`                            |
| `SMTP_HOST`    | SMTP server host     | _Required if enabled_ | `smtp.gmail.com`                  |
| `SMTP_PORT`    | SMTP server port     | `587`                 | `465`                             |
| `SMTP_SECURE`  | Use SSL/TLS          | `false`               | `true`                            |
| `SMTP_USER`    | SMTP username        | _Required if enabled_ | `user@example.com`                |
| `SMTP_PASS`    | SMTP password        | _Required if enabled_ | `app_password`                    |
| `SMTP_FROM`    | From email address   | `noreply@localhost`   | `MediaNest <noreply@example.com>` |

### Email Service Providers

#### Gmail

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password  # Use App Password, not regular password
```

#### Outlook/Hotmail

```bash
SMTP_HOST=smtp.live.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_password
```

#### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

## Logging and Monitoring

### Logging Configuration

| Variable           | Description           | Default      | Example              |
| ------------------ | --------------------- | ------------ | -------------------- |
| `LOG_LEVEL`        | Logging level         | `info`       | `debug`              |
| `LOG_FORMAT`       | Log format            | `combined`   | `json`               |
| `LOG_DIR`          | Log directory         | `/app/logs`  | `/var/log/medianest` |
| `LOG_MAX_SIZE`     | Max log file size     | `10m`        | `50m`                |
| `LOG_MAX_FILES`    | Max log files to keep | `5`          | `10`                 |
| `LOG_DATE_PATTERN` | Log rotation pattern  | `YYYY-MM-DD` | `YYYY-MM-DD-HH`      |

### Debug Settings

| Variable           | Description                  | Default | Example       |
| ------------------ | ---------------------------- | ------- | ------------- |
| `DEBUG`            | Debug namespaces             | _None_  | `medianest:*` |
| `VERBOSE_ERRORS`   | Include stack traces         | `false` | `true`        |
| `ENABLE_PROFILING` | Enable performance profiling | `false` | `true`        |

### Monitoring and Health

| Variable               | Description               | Default    | Example        |
| ---------------------- | ------------------------- | ---------- | -------------- |
| `HEALTH_CHECK_ENABLED` | Enable health checks      | `true`     | `false`        |
| `HEALTH_CHECK_PATH`    | Health check endpoint     | `/health`  | `/api/health`  |
| `METRICS_ENABLED`      | Enable metrics collection | `false`    | `true`         |
| `METRICS_PATH`         | Metrics endpoint          | `/metrics` | `/api/metrics` |

## Performance Configuration

### Application Performance

| Variable             | Description                | Default | Example |
| -------------------- | -------------------------- | ------- | ------- |
| `CLUSTER_MODE`       | Enable cluster mode        | `false` | `true`  |
| `WORKER_PROCESSES`   | Number of worker processes | `auto`  | `4`     |
| `MAX_OLD_SPACE_SIZE` | Node.js max memory (MB)    | `2048`  | `4096`  |
| `UV_THREADPOOL_SIZE` | UV thread pool size        | `128`   | `256`   |

### Request Handling

| Variable             | Description             | Default  | Example  |
| -------------------- | ----------------------- | -------- | -------- |
| `REQUEST_TIMEOUT`    | Request timeout (ms)    | `300000` | `600000` |
| `KEEP_ALIVE_TIMEOUT` | Keep-alive timeout (ms) | `65000`  | `120000` |
| `HEADERS_TIMEOUT`    | Headers timeout (ms)    | `66000`  | `121000` |
| `BODY_PARSER_LIMIT`  | Request body size limit | `100mb`  | `500mb`  |

## Development Settings

### Development Mode Variables

| Variable             | Description              | Default | Example |
| -------------------- | ------------------------ | ------- | ------- |
| `HOT_RELOAD`         | Enable hot reloading     | `false` | `true`  |
| `WATCH_FILES`        | Enable file watching     | `false` | `true`  |
| `MOCK_EXTERNAL_APIS` | Mock external API calls  | `false` | `true`  |
| `SEED_DATABASE`      | Seed database on startup | `false` | `true`  |
| `AUTO_MIGRATE`       | Auto-run migrations      | `false` | `true`  |

## Environment File Examples

### Development Environment (.env.development)

```bash
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://medianest:password@localhost:5432/medianest_dev

# Security (use weak secrets for development only)
JWT_SECRET=development-jwt-secret-key-32-chars
SESSION_SECRET=development-session-secret-32-chars

# Cache
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=debug
LOG_FORMAT=simple

# Development features
HOT_RELOAD=true
WATCH_FILES=true
MOCK_EXTERNAL_APIS=true
VERBOSE_ERRORS=true
```

### Production Environment (.env.production)

```bash
NODE_ENV=production
PORT=3000
APP_URL=https://medianest.example.com

# Database
DATABASE_URL=postgresql://medianest:secure_password@db.example.com:5432/medianest
DB_SSL=true

# Security (use strong, randomly generated secrets)
JWT_SECRET=production-secure-jwt-secret-minimum-32-characters-long
SESSION_SECRET=production-secure-session-secret-minimum-32-characters-long

# Cache
REDIS_URL=redis://:secure_redis_password@cache.example.com:6379/0

# Storage
MEDIA_ROOT=/var/lib/medianest/media
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_BUCKET=medianest-media-prod

# Email
SMTP_ENABLED=true
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key

# External APIs
TMDB_API_KEY=your_production_tmdb_key

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=/var/log/medianest

# Performance
CLUSTER_MODE=true
WORKER_PROCESSES=auto
```

## Environment Variable Validation

MediaNest validates environment variables on startup. Missing required variables will cause the application to exit with an error message.

### Validation Rules

1. **Required variables** must be present and non-empty
2. **Numeric variables** must be valid numbers within acceptable ranges
3. **URL variables** must be valid URLs
4. **Secret variables** must meet minimum length requirements
5. **Enum variables** must match allowed values

### Custom Validation

You can add custom validation by creating a `config/env-validation.js` file:

```javascript
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  // Add more validation rules as needed
});

module.exports = schema;
```

## Troubleshooting Environment Variables

### Check Current Environment

```bash
# List all environment variables
env | grep MEDIANEST

# Check specific variable
echo $DATABASE_URL

# Verify in Node.js
node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL)"
```

### Common Issues

#### Variable Not Set

```bash
# Check if variable exists
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set"
fi
```

#### Invalid Format

```bash
# Test database URL
node -e "
try {
  const url = new URL(process.env.DATABASE_URL);
  console.log('Valid URL:', url.href);
} catch (e) {
  console.error('Invalid URL:', e.message);
}
"
```

#### Permission Issues

```bash
# Check file permissions for .env file
ls -la .env

# Fix permissions (readable by owner only)
chmod 600 .env
```

For more information about configuration, see the [Configuration Guide](configuration.md).
