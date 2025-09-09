# Environment Variables Reference

Complete reference for all environment variables supported by MediaNest.

## Core Application Settings

### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `SECRET_KEY` | Django secret key for cryptographic signing | None | `django-insecure-abc123...` |
| `DATABASE_URL` | Database connection URL | None | `postgresql://user:pass@localhost/db` |

### Optional Core Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `DEBUG` | Enable debug mode | `False` | `True` |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hosts | `localhost,127.0.0.1` | `example.com,*.example.com` |
| `TIME_ZONE` | Application time zone | `UTC` | `America/New_York` |
| `LANGUAGE_CODE` | Default language code | `en-us` | `es-es` |
| `USE_TZ` | Enable timezone support | `True` | `False` |

## Database Configuration

### PostgreSQL (Recommended)

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Complete PostgreSQL URL | None | `postgresql://medianest:password@localhost:5432/medianest` |
| `DB_ENGINE` | Database engine | `django.db.backends.postgresql` | Same |
| `DB_NAME` | Database name | `medianest` | `medianest_prod` |
| `DB_USER` | Database username | `medianest` | `medianest_user` |
| `DB_PASSWORD` | Database password | None | `secure_password_123` |
| `DB_HOST` | Database host | `localhost` | `db.example.com` |
| `DB_PORT` | Database port | `5432` | `5432` |
| `DB_OPTIONS` | Additional database options | `{}` | `{"sslmode": "require"}` |

### MySQL/MariaDB

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Complete MySQL URL | None | `mysql://medianest:password@localhost:3306/medianest` |
| `DB_ENGINE` | Database engine | `django.db.backends.mysql` | Same |
| `MYSQL_SSL_CA` | SSL CA certificate path | None | `/etc/ssl/certs/ca.pem` |

## Redis and Caching

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` | `redis://user:pass@redis:6379/1` |
| `CACHE_URL` | Cache backend URL | Same as `REDIS_URL` | `redis://localhost:6379/2` |
| `SESSION_CACHE_ALIAS` | Cache alias for sessions | `default` | `sessions` |

## Media and File Storage

### Local Storage

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `MEDIA_ROOT` | Path to media files | `./media` | `/data/medianest/media` |
| `MEDIA_URL` | URL prefix for media files | `/media/` | `/media/` |
| `STATIC_ROOT` | Path to static files | `./staticfiles` | `/data/medianest/static` |
| `STATIC_URL` | URL prefix for static files | `/static/` | `/static/` |

### AWS S3 Storage

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `USE_S3` | Enable S3 storage | `False` | `True` |
| `AWS_ACCESS_KEY_ID` | AWS access key ID | None | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | None | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_STORAGE_BUCKET_NAME` | S3 bucket name | None | `medianest-media` |
| `AWS_S3_REGION_NAME` | S3 region | `us-east-1` | `us-west-2` |
| `AWS_S3_CUSTOM_DOMAIN` | Custom domain for S3 | None | `cdn.example.com` |
| `AWS_DEFAULT_ACL` | Default ACL for uploaded files | `public-read` | `private` |

## File Upload Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `FILE_UPLOAD_MAX_MEMORY_SIZE` | Max file size in memory (bytes) | `2621440` (2.5MB) | `52428800` (50MB) |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | Max request size in memory (bytes) | `2621440` (2.5MB) | `52428800` (50MB) |
| `DATA_UPLOAD_MAX_NUMBER_FIELDS` | Max number of form fields | `1000` | `5000` |
| `FILE_UPLOAD_TEMP_DIR` | Temporary upload directory | System temp | `/tmp/uploads` |

## Media Processing

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `MEDIA_PROCESSING_ENABLED` | Enable media processing | `True` | `False` |
| `MEDIA_THUMBNAIL_SIZE` | Thumbnail size (width,height) | `300,300` | `500,500` |
| `MEDIA_PREVIEW_SIZE` | Preview image size | `1920,1080` | `1280,720` |
| `MEDIA_THUMBNAIL_QUALITY` | JPEG quality for thumbnails | `85` | `95` |
| `MEDIA_EXTRACT_METADATA` | Extract file metadata | `True` | `False` |
| `MEDIA_PROCESSING_WORKERS` | Number of processing workers | `2` | `4` |

## Plex Integration

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `PLEX_SERVER_URL` | Plex Media Server URL | None | `http://plex.local:32400` |
| `PLEX_TOKEN` | Plex authentication token | None | `xyzabc123token` |
| `PLEX_SYNC_ENABLED` | Enable automatic Plex sync | `False` | `True` |
| `PLEX_SYNC_INTERVAL` | Sync interval in seconds | `300` (5 minutes) | `900` (15 minutes) |
| `PLEX_LIBRARY_SECTIONS` | Comma-separated library names | `Movies,TV Shows` | `Movies,TV Shows,Music` |
| `PLEX_AUTH_ENABLED` | Enable Plex user authentication | `False` | `True` |
| `PLEX_AUTH_REQUIRED` | Require Plex authentication | `False` | `True` |
| `PLEX_USER_SYNC` | Sync Plex users | `False` | `True` |

## Security Settings

### HTTPS and SSL

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `SECURE_SSL_REDIRECT` | Redirect HTTP to HTTPS | `False` | `True` |
| `SECURE_PROXY_SSL_HEADER` | HTTP header for HTTPS detection | None | `HTTP_X_FORWARDED_PROTO,https` |
| `SECURE_HSTS_SECONDS` | HSTS header max-age | `0` | `31536000` (1 year) |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | Include subdomains in HSTS | `False` | `True` |
| `SECURE_HSTS_PRELOAD` | Enable HSTS preload | `False` | `True` |

### Content Security

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `SECURE_CONTENT_TYPE_NOSNIFF` | Prevent MIME type sniffing | `False` | `True` |
| `SECURE_BROWSER_XSS_FILTER` | Enable XSS filter | `False` | `True` |
| `SECURE_REFERRER_POLICY` | Referrer policy | `same-origin` | `strict-origin-when-cross-origin` |
| `X_FRAME_OPTIONS` | X-Frame-Options header | `DENY` | `SAMEORIGIN` |

### CORS Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | None | `http://localhost:3000,https://app.example.com` |
| `CORS_ALLOW_CREDENTIALS` | Allow credentials in CORS | `False` | `True` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow all origins (dev only) | `False` | `True` |

## API Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `API_RATE_LIMIT_ENABLED` | Enable API rate limiting | `True` | `False` |
| `API_RATE_LIMIT_REQUESTS` | Requests per window | `100` | `1000` |
| `API_RATE_LIMIT_WINDOW` | Rate limit window (seconds) | `3600` (1 hour) | `300` (5 minutes) |
| `API_PAGINATION_SIZE` | Default page size | `20` | `50` |
| `API_MAX_PAGE_SIZE` | Maximum page size | `100` | `200` |

## Email Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `EMAIL_BACKEND` | Email backend class | `django.core.mail.backends.console.EmailBackend` | `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST` | SMTP server hostname | `localhost` | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP server port | `25` | `587` |
| `EMAIL_USE_TLS` | Use TLS encryption | `False` | `True` |
| `EMAIL_USE_SSL` | Use SSL encryption | `False` | `True` |
| `EMAIL_HOST_USER` | SMTP username | None | `your-email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | SMTP password | None | `your-app-password` |
| `DEFAULT_FROM_EMAIL` | Default sender email | `webmaster@localhost` | `MediaNest <noreply@example.com>` |
| `SERVER_EMAIL` | Server error email | `root@localhost` | `MediaNest Server <server@example.com>` |

## Logging Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Application log level | `INFO` | `DEBUG` |
| `DJANGO_LOG_LEVEL` | Django log level | `INFO` | `WARNING` |
| `CELERY_LOG_LEVEL` | Celery log level | `INFO` | `ERROR` |
| `LOG_FILE` | Main log file path | None | `/var/log/medianest/app.log` |
| `ERROR_LOG_FILE` | Error log file path | None | `/var/log/medianest/error.log` |
| `ACCESS_LOG_FILE` | Access log file path | None | `/var/log/medianest/access.log` |

## External Services

### Sentry Error Tracking

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `SENTRY_DSN` | Sentry DSN URL | None | `https://abc@sentry.io/123` |
| `SENTRY_ENVIRONMENT` | Environment name | `development` | `production` |
| `SENTRY_RELEASE` | Release version | None | `1.0.0` |

### Analytics

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `GOOGLE_ANALYTICS_ID` | Google Analytics ID | None | `UA-12345678-1` |
| `GTAG_ID` | Google gtag ID | None | `G-ABCDEFGHIJ` |

## Celery Task Queue

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `CELERY_BROKER_URL` | Celery broker URL | `redis://localhost:6379/0` | `redis://redis:6379/1` |
| `CELERY_RESULT_BACKEND` | Result backend URL | Same as broker | `redis://redis:6379/2` |
| `CELERY_TASK_ALWAYS_EAGER` | Execute tasks synchronously | `False` | `True` (dev only) |
| `CELERY_WORKER_CONCURRENCY` | Worker concurrency | `2` | `4` |
| `CELERY_TASK_SOFT_TIME_LIMIT` | Soft task time limit | `300` | `600` |
| `CELERY_TASK_TIME_LIMIT` | Hard task time limit | `600` | `1200` |

## Development and Testing

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `TESTING` | Enable testing mode | `False` | `True` |
| `COVERAGE_REPORT` | Generate coverage report | `False` | `True` |
| `DISABLE_MIGRATIONS` | Disable migrations in tests | `False` | `True` |
| `TEST_DATABASE_NAME` | Test database name | `:memory:` | `test_medianest` |

## Example Environment Files

### .env.development
```bash
DEBUG=True
ALLOWED_HOSTS=*
SECRET_KEY=development-secret-key-not-for-production
DATABASE_URL=postgresql://medianest:password@localhost:5432/medianest_dev
REDIS_URL=redis://localhost:6379/0
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
MEDIA_ROOT=./media
STATIC_ROOT=./staticfiles
LOG_LEVEL=DEBUG
CELERY_TASK_ALWAYS_EAGER=True
```

### .env.production
```bash
DEBUG=False
ALLOWED_HOSTS=medianest.example.com
SECRET_KEY=your-very-secure-production-secret-key
DATABASE_URL=postgresql://medianest:secure_password@db:5432/medianest
REDIS_URL=redis://redis:6379/0
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@example.com
EMAIL_HOST_PASSWORD=email_password
MEDIA_ROOT=/data/media
STATIC_ROOT=/data/static
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
LOG_LEVEL=WARNING
```

## Validation

Validate your environment configuration:

```bash
# Check Django configuration
python manage.py check --deploy

# Test database connection
python manage.py dbshell

# Test Redis connection
python manage.py shell -c "from django.core.cache import cache; print(cache.get('test', 'Redis OK'))"

# Test email configuration
python manage.py sendtestemail admin@example.com
```

## Security Considerations

### Required for Production
- Always set `DEBUG=False`
- Use a secure, random `SECRET_KEY`
- Configure `ALLOWED_HOSTS` properly
- Enable HTTPS with SSL settings
- Use strong database passwords
- Regularly rotate secrets and tokens

### Environment File Security
- Never commit `.env` files to version control
- Restrict file permissions: `chmod 600 .env`
- Use separate files for different environments
- Consider using a secrets management system for production