# Reference Documentation

Complete technical reference for MediaNest configuration, CLI commands, and APIs.

## Quick Reference

### [CLI Commands](cli.md)
Complete command-line interface reference with examples and options.

### [Configuration Reference](config-reference.md)
All configuration options, environment variables, and settings.

### [Supported Formats](formats.md)
Comprehensive list of supported media formats and codecs.

### [FAQ](faq.md)
Frequently asked questions and quick answers.

### [Glossary](glossary.md)
Definitions of terms and concepts used throughout MediaNest.

### [Changelog](changelog.md)
Version history, new features, and breaking changes.

## Configuration Quick Reference

### Essential Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medianest
DB_USER=medianest
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
APP_PORT=8080
JWT_SECRET=your_jwt_secret
LOG_LEVEL=info

# Media
MEDIA_ROOT=/path/to/media
UPLOAD_PATH=/path/to/uploads
```

### Docker Environment
```yaml
# docker-compose.yml
version: '3.8'
services:
  medianest:
    image: medianest/medianest:latest
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - REDIS_HOST=redis
    volumes:
      - ./media:/app/media
      - ./config:/app/config
```

## API Quick Reference

### Authentication
```bash
# Get access token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Use token in requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/media
```

### Common Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | System health status |
| `/api/v1/media` | GET | List media items |
| `/api/v1/media/{id}` | GET | Get specific media item |
| `/api/v1/libraries` | GET | List media libraries |
| `/api/v1/scan` | POST | Trigger library scan |

## CLI Quick Reference

### Basic Commands
```bash
# Start MediaNest
medianest start

# Stop MediaNest
medianest stop

# Check status
medianest status

# Scan library
medianest scan --library movies

# Database operations
medianest db migrate
medianest db seed
medianest db backup
```

### Configuration Commands
```bash
# View configuration
medianest config show

# Set configuration value
medianest config set media.root /new/path

# Validate configuration
medianest config validate

# Reset to defaults
medianest config reset
```

## File Format Support

### Video Formats
**Containers**: MP4, MKV, AVI, MOV, M4V, WebM, FLV  
**Codecs**: H.264, H.265/HEVC, VP9, AV1, DivX, XviD

### Audio Formats  
**Lossless**: FLAC, APE, WAV, AIFF  
**Lossy**: MP3, AAC, OGG, M4A, WMA

### Image Formats
**Standard**: JPEG, PNG, GIF, BMP, TIFF  
**RAW**: CR2, NEF, ARW, DNG, RAF

### Subtitle Formats
**Text**: SRT, VTT, ASS, SSA  
**Image**: PGS, VobSub

## Performance Benchmarks

### Typical Performance
| Operation | Small Library (<1K) | Medium Library (<10K) | Large Library (>10K) |
|-----------|---------------------|----------------------|---------------------|
| **Initial Scan** | 2-5 minutes | 15-30 minutes | 1-3 hours |
| **Incremental Scan** | 10-30 seconds | 1-3 minutes | 5-15 minutes |
| **Search Response** | <100ms | <200ms | <500ms |
| **API Response** | <50ms | <100ms | <200ms |

### Resource Requirements
| Library Size | CPU | RAM | Storage |
|--------------|-----|-----|---------|
| **Small** | 2 cores | 4GB | 10GB |
| **Medium** | 4 cores | 8GB | 50GB |
| **Large** | 8+ cores | 16GB+ | 200GB+ |

## Security Reference

### Default Ports
- **Web Interface**: 8080 (HTTP), 8443 (HTTPS)
- **API**: Same as web interface
- **Database**: 5432 (PostgreSQL)
- **Cache**: 6379 (Redis)

### Security Headers
MediaNest automatically sets security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (when HTTPS enabled)

### Permissions Model
- **Admin**: Full system access
- **Manager**: Library management, user management
- **User**: Library access, personal settings
- **Guest**: Read-only library access

## Troubleshooting Quick Reference

### Common Error Codes
| Code | Description | Solution |
|------|-------------|----------|
| **500** | Internal server error | Check logs, restart service |
| **503** | Service unavailable | Check database/Redis connection |
| **401** | Unauthorized | Verify authentication token |
| **404** | Not found | Check URL and resource existence |

### Log Locations
- **Docker**: `docker logs medianest`
- **Manual**: `./logs/medianest.log`
- **System**: `/var/log/medianest/`

### Health Check URLs
- **Basic**: `/health`
- **Detailed**: `/health/detailed`
- **Database**: `/health/db`
- **Cache**: `/health/redis`

## Version Compatibility

### Supported Versions
- **Current**: 2.0.x (Active development)
- **LTS**: 1.8.x (Security updates only)
- **Legacy**: 1.6.x (No longer supported)

### Upgrade Paths
- **1.6.x → 1.8.x**: Database migration required
- **1.8.x → 2.0.x**: Breaking changes, see migration guide
- **2.0.x → 2.0.y**: Seamless updates

## Additional Resources

- **[API Documentation](../api/index.md)** - Complete API reference
- **[User Guides](../user-guides/index.md)** - Step-by-step tutorials  
- **[Developer Docs](../developers/index.md)** - Architecture and development
- **[Troubleshooting](../troubleshooting/index.md)** - Common issues and solutions

---

Need more specific information? Check our detailed guides or ask the [community](https://discord.gg/medianest)!