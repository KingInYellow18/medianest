# Configuration Guide

This guide covers all configuration options for MediaNest, including environment variables, configuration files, and advanced settings.

## Configuration Methods

MediaNest can be configured using:

1. **Environment Variables** (recommended for Docker)
2. **Configuration Files** (recommended for manual installation)
3. **Database Settings** (runtime configuration via admin interface)

## Environment Variables

### Core Settings

```bash
# Application Settings
SECRET_KEY=your_secret_key_here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com
TIME_ZONE=UTC
LANGUAGE_CODE=en-us

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/dbname
# or
DB_ENGINE=django.db.backends.postgresql
DB_NAME=medianest
DB_USER=medianest
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### Media Settings

```bash
# Media Storage
MEDIA_ROOT=/path/to/media/files
MEDIA_URL=/media/
STATIC_ROOT=/path/to/static/files
STATIC_URL=/static/

# File Upload Limits
FILE_UPLOAD_MAX_MEMORY_SIZE=52428800  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE=52428800  # 50MB
DATA_UPLOAD_MAX_NUMBER_FIELDS=1000

# Media Processing
MEDIA_PROCESSING_ENABLED=True
MEDIA_THUMBNAIL_SIZE=300,300
MEDIA_PREVIEW_SIZE=1920,1080
MEDIA_EXTRACT_METADATA=True
```

### Plex Integration

```bash
# Plex Server Settings
PLEX_SERVER_URL=http://plex.local:32400
PLEX_TOKEN=your_plex_token
PLEX_SYNC_ENABLED=True
PLEX_SYNC_INTERVAL=300  # seconds
PLEX_LIBRARY_SECTIONS=Movies,TV Shows,Music

# Plex Authentication
PLEX_AUTH_ENABLED=True
PLEX_AUTH_REQUIRED=False
PLEX_USER_SYNC=True
```

### Security Settings

```bash
# Security
SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_CONTENT_TYPE_NOSNIFF=True
SECURE_BROWSER_XSS_FILTER=True

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
CORS_ALLOW_CREDENTIALS=True
CORS_ALLOW_ALL_ORIGINS=False

# API Rate Limiting
API_RATE_LIMIT_ENABLED=True
API_RATE_LIMIT_REQUESTS=100
API_RATE_LIMIT_WINDOW=3600  # 1 hour
```

### Email Configuration

```bash
# Email Backend
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Email Settings
DEFAULT_FROM_EMAIL=MediaNest <noreply@your-domain.com>
SERVER_EMAIL=MediaNest Server <server@your-domain.com>
ADMINS=admin@your-domain.com
```

### Logging Configuration

```bash
# Logging Levels
LOG_LEVEL=INFO
DJANGO_LOG_LEVEL=INFO
CELERY_LOG_LEVEL=INFO

# Log Files
LOG_FILE=/var/log/medianest/app.log
ERROR_LOG_FILE=/var/log/medianest/error.log
ACCESS_LOG_FILE=/var/log/medianest/access.log

# Sentry Integration (Optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
```

## Configuration Files

### settings.py Override

Create `local_settings.py` for custom configuration:

```python
# local_settings.py
from .settings import *

# Override any settings here
DEBUG = False
ALLOWED_HOSTS = ['your-domain.com']

# Custom media settings
MEDIA_PROCESSING_WORKERS = 4
MEDIA_THUMBNAIL_QUALITY = 95

# Custom API settings
API_PAGINATION_SIZE = 50
API_MAX_PAGE_SIZE = 200
```

### Celery Configuration

Create `celery_config.py`:

```python
# celery_config.py
from celery import Celery
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medianest.settings')

app = Celery('medianest')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Custom task routes
app.conf.task_routes = {
    'medianest.tasks.process_media': {'queue': 'media'},
    'medianest.tasks.sync_plex': {'queue': 'sync'},
    'medianest.tasks.cleanup': {'queue': 'maintenance'},
}

# Worker configuration
app.conf.worker_prefetch_multiplier = 1
app.conf.worker_max_tasks_per_child = 1000
app.conf.task_soft_time_limit = 300
app.conf.task_time_limit = 600
```

## Database Settings

Many settings can be configured through the Django admin interface at `/admin/`.

### Site Configuration

- **Site Name**: Display name for your MediaNest instance
- **Site Description**: Brief description shown on the homepage
- **Allow Registration**: Enable/disable user registration
- **Require Email Verification**: Require email verification for new accounts

### Media Processing

- **Enable Thumbnail Generation**: Generate thumbnails for images
- **Enable Video Previews**: Generate preview images for videos
- **Enable Metadata Extraction**: Extract metadata from media files
- **Processing Queue Size**: Number of concurrent processing tasks

### Plex Integration

- **Server URL**: URL of your Plex Media Server
- **Authentication Token**: Plex authentication token
- **Sync Interval**: How often to sync with Plex (in minutes)
- **Library Sections**: Which Plex libraries to sync

## Advanced Configuration

### Custom Storage Backend

```python
# settings.py or local_settings.py

# Use AWS S3 for media storage
if os.environ.get('USE_S3') == 'True':
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    STATICFILES_STORAGE = 'storages.backends.s3boto3.StaticS3Boto3Storage'
    
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-west-2')
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN')
    AWS_DEFAULT_ACL = 'public-read'
```

### Custom Authentication Backend

```python
# authentication.py
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.models import User
import requests

class PlexAuthBackend(BaseBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        # Custom Plex authentication logic
        try:
            response = requests.post(
                'https://plex.tv/users/sign_in.json',
                data={'username': username, 'password': password}
            )
            if response.status_code == 200:
                user_data = response.json()['user']
                user, created = User.objects.get_or_create(
                    username=user_data['username'],
                    defaults={'email': user_data['email']}
                )
                return user
        except:
            pass
        return None
```

### Custom Media Processors

```python
# processors.py
from medianest.processors import BaseMediaProcessor

class CustomVideoProcessor(BaseMediaProcessor):
    supported_types = ['video/mp4', 'video/mkv']
    
    def process(self, media_file):
        # Custom video processing logic
        thumbnail = self.generate_thumbnail(media_file)
        metadata = self.extract_metadata(media_file)
        
        return {
            'thumbnail': thumbnail,
            'metadata': metadata,
            'duration': metadata.get('duration'),
            'resolution': f"{metadata.get('width')}x{metadata.get('height')}"
        }
```

## Performance Optimization

### Database Optimization

```python
# Database connection pooling
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'medianest',
        'USER': 'medianest',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5432',
        'OPTIONS': {
            'MAX_CONNS': 20,
            'MIN_CONNS': 5,
            'sslmode': 'prefer',
        },
        'CONN_MAX_AGE': 600,
    }
}

# Query optimization
DATABASE_CONNECTION_POOLING = True
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000
```

### Caching Configuration

```python
# Redis caching
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 100,
                'retry_on_timeout': True,
            },
        },
        'KEY_PREFIX': 'medianest',
        'TIMEOUT': 300,
    }
}

# Session caching
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
```

## Configuration Validation

Run the configuration check command to validate your settings:

```bash
python manage.py check --deploy
```

This will check for common configuration issues and security problems.

## Environment-Specific Configurations

### Development
```bash
DEBUG=True
ALLOWED_HOSTS=*
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
LOG_LEVEL=DEBUG
```

### Staging
```bash
DEBUG=False
ALLOWED_HOSTS=staging.your-domain.com
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
LOG_LEVEL=INFO
SENTRY_ENVIRONMENT=staging
```

### Production
```bash
DEBUG=False
ALLOWED_HOSTS=your-domain.com
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
LOG_LEVEL=WARNING
SENTRY_ENVIRONMENT=production
```

## Next Steps

- [Environment Variables](environment.md) - Complete environment variable reference
- [Database Setup](database.md) - Database configuration and optimization
- [Performance Tuning](../troubleshooting/performance.md) - Performance optimization guide