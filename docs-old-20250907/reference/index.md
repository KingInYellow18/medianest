# Reference Documentation

Quick reference materials and comprehensive documentation for MediaNest features, configurations, and technical specifications.

## Reference Sections

<div class="grid cards" markdown>

- :material-console-line: **CLI Commands**

  ***

  Complete command-line interface reference with examples and options.

  [CLI Reference →](cli.md)

- :material-cog: **Configuration Reference**

  ***

  Comprehensive guide to all configuration options and environment variables.

  [Config Reference →](config-reference.md)

- :material-file-multiple: **Supported Formats**

  ***

  Complete list of supported media formats and their capabilities.

  [Format Support →](formats.md)

- :material-frequently-asked-questions: **Frequently Asked Questions**

  ***

  Answers to common questions about MediaNest features and usage.

  [FAQ →](faq.md)

- :material-book-alphabet: **Glossary**

  ***

  Definitions of terms and concepts used throughout MediaNest.

  [Glossary →](glossary.md)

- :material-history: **Changelog**

  ***

  Detailed release notes and version history.

  [Changelog →](changelog.md)

</div>

## Quick Reference Cards

### Essential Commands

| Command             | Purpose                | Example                                     |
| ------------------- | ---------------------- | ------------------------------------------- |
| `medianest start`   | Start MediaNest server | `medianest start --port 8080`               |
| `medianest upload`  | Upload media files     | `medianest upload ./photos/*.jpg`           |
| `medianest backup`  | Create backup          | `medianest backup --output ./backup.tar.gz` |
| `medianest restore` | Restore from backup    | `medianest restore ./backup.tar.gz`         |
| `medianest config`  | Manage configuration   | `medianest config set STORAGE_PATH=/data`   |

### HTTP Status Codes

| Code  | Meaning           | Typical Cause            |
| ----- | ----------------- | ------------------------ |
| `200` | OK                | Request successful       |
| `201` | Created           | Resource created         |
| `400` | Bad Request       | Invalid parameters       |
| `401` | Unauthorized      | Missing/invalid auth     |
| `403` | Forbidden         | Insufficient permissions |
| `404` | Not Found         | Resource doesn't exist   |
| `429` | Too Many Requests | Rate limit exceeded      |
| `500` | Internal Error    | Server error             |

### Environment Variables

| Variable       | Default                      | Description            |
| -------------- | ---------------------------- | ---------------------- |
| `PORT`         | `8080`                       | HTTP server port       |
| `DATABASE_URL` | `sqlite://data/medianest.db` | Database connection    |
| `STORAGE_PATH` | `./data/media`               | Media storage location |
| `JWT_SECRET`   | `generated`                  | JWT signing secret     |
| `REDIS_URL`    | `redis://localhost:6379`     | Redis connection       |
| `LOG_LEVEL`    | `info`                       | Logging verbosity      |

### File Size Limits

| Plan           | Max File Size | Max Upload | Storage    |
| -------------- | ------------- | ---------- | ---------- |
| **Free**       | 100MB         | 1GB/month  | 10GB total |
| **Pro**        | 1GB           | 10GB/month | 1TB total  |
| **Enterprise** | 10GB          | Unlimited  | Unlimited  |

### Supported Media Types

| Category      | Extensions                              | Notes                     |
| ------------- | --------------------------------------- | ------------------------- |
| **Images**    | `.jpg`, `.png`, `.gif`, `.webp`, `.svg` | Full processing support   |
| **Videos**    | `.mp4`, `.avi`, `.mov`, `.webm`, `.mkv` | Automatic transcoding     |
| **Audio**     | `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg` | Waveform generation       |
| **Documents** | `.pdf`, `.doc`, `.docx`, `.txt`         | Text extraction           |
| **Archives**  | `.zip`, `.tar`, `.gz`, `.rar`           | Auto-extraction available |

## API Quick Reference

### Authentication

```http
Authorization: Bearer YOUR_API_TOKEN
```

### Common Headers

```http
Content-Type: application/json
Accept: application/json
X-API-Version: v1
```

### Pagination Parameters

```http
GET /api/v1/media?page=1&limit=20&sort=created_at&order=desc
```

### Standard Response Format

```json
{
  "success": true,
  "data": {
    /* response data */
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789",
    "version": "v1"
  }
}
```

## Configuration Templates

### Docker Compose Template

```yaml
version: '3.8'
services:
  medianest:
    image: medianest/medianest:latest
    ports:
      - '8080:8080'
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/medianest
      - REDIS_URL=redis://redis:6379
      - STORAGE_PATH=/app/data
    volumes:
      - medianest_data:/app/data
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=medianest
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  medianest_data:
  postgres_data:
  redis_data:
```

### Nginx Configuration Template

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 1G;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        alias /path/to/media/storage/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut       | Action          | Context     |
| -------------- | --------------- | ----------- |
| `Ctrl/Cmd + F` | Search          | Anywhere    |
| `Ctrl/Cmd + U` | Upload          | Anywhere    |
| `Ctrl/Cmd + N` | New Collection  | Collections |
| `Ctrl/Cmd + K` | Command Palette | Anywhere    |
| `Esc`          | Close Modal     | Modals      |

### Media View Shortcuts

| Shortcut | Action        | Context        |
| -------- | ------------- | -------------- |
| `Space`  | Play/Pause    | Video/Audio    |
| `←/→`    | Previous/Next | Gallery        |
| `F`      | Fullscreen    | Media viewer   |
| `I`      | Info Panel    | Media viewer   |
| `Del`    | Delete        | Selected media |

### Selection Shortcuts

| Shortcut           | Action           | Context   |
| ------------------ | ---------------- | --------- |
| `Ctrl/Cmd + A`     | Select All       | Grid view |
| `Ctrl/Cmd + Click` | Toggle Selection | Grid view |
| `Shift + Click`    | Range Selection  | Grid view |
| `Ctrl/Cmd + D`     | Deselect All     | Grid view |

## Error Codes Reference

### API Error Codes

| Code                       | Message                    | Description             |
| -------------------------- | -------------------------- | ----------------------- |
| `INVALID_REQUEST`          | Invalid request parameters | Check request format    |
| `AUTH_REQUIRED`            | Authentication required    | Provide valid token     |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions   | Check user role         |
| `RESOURCE_NOT_FOUND`       | Resource not found         | Check resource ID       |
| `RATE_LIMIT_EXCEEDED`      | Rate limit exceeded        | Slow down requests      |
| `FILE_TOO_LARGE`           | File exceeds size limit    | Reduce file size        |
| `UNSUPPORTED_FORMAT`       | Unsupported file format    | Check supported formats |
| `STORAGE_FULL`             | Storage quota exceeded     | Clear space or upgrade  |

### System Error Codes

| Code      | Description                | Solution             |
| --------- | -------------------------- | -------------------- |
| `SYS_001` | Database connection failed | Check DB credentials |
| `SYS_002` | Storage not accessible     | Check permissions    |
| `SYS_003` | Processing worker down     | Restart workers      |
| `SYS_004` | Memory limit exceeded      | Increase memory      |
| `SYS_005` | Disk space full            | Clear storage space  |

## Performance Benchmarks

### Response Time Targets

| Operation         | Target  | Notes               |
| ----------------- | ------- | ------------------- |
| **Page Load**     | < 2s    | Initial page load   |
| **Media Upload**  | < 5s    | Per 100MB file      |
| **Thumbnail Gen** | < 3s    | Standard resolution |
| **Search Query**  | < 1s    | Basic text search   |
| **API Response**  | < 500ms | Simple GET requests |

### Scalability Metrics

| Metric            | Small   | Medium    | Large |
| ----------------- | ------- | --------- | ----- |
| **Users**         | 1-10    | 10-100    | 100+  |
| **Media Files**   | < 10K   | 10K-100K  | 100K+ |
| **Storage**       | < 100GB | 100GB-1TB | 1TB+  |
| **Daily Uploads** | < 100   | 100-1K    | 1K+   |

## Regular Expressions

### File Naming Patterns

```regex
# Image files
^.*\.(jpe?g|png|gif|webp|svg)$

# Video files
^.*\.(mp4|avi|mov|webm|mkv|m4v)$

# Valid collection name
^[a-zA-Z0-9][a-zA-Z0-9\-_\s]{2,50}$

# API token format
^mnt_[a-zA-Z0-9]{32}$
```

### Search Patterns

```regex
# Date range search
^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$

# Tag search
^#[a-zA-Z0-9_-]+$

# Size filter
^[0-9]+(\.[0-9]+)?(KB|MB|GB)$
```

## Integration Examples

### Webhook Payload

```json
{
  "event": "media.uploaded",
  "data": {
    "id": "media_123",
    "filename": "photo.jpg",
    "size": 1048576,
    "type": "image/jpeg",
    "uploadedBy": "user_456",
    "collection": "vacation-2024"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "signature": "sha256=..."
}
```

### SDK Usage

```javascript
const MediaNest = require('@medianest/sdk');
const client = new MediaNest('your-api-token');

// Upload file
const result = await client.media.upload({
  file: fs.createReadStream('photo.jpg'),
  collection: 'my-photos',
  tags: ['vacation', 'beach'],
});

// Search media
const search = await client.search({
  query: 'sunset beach',
  type: 'image',
  limit: 10,
});
```

## Troubleshooting Quick Reference

### Common Solutions

| Problem                | Quick Fix                             |
| ---------------------- | ------------------------------------- |
| Can't access interface | Check if port 8080 is open            |
| Upload fails           | Check file size and format            |
| Slow performance       | Restart Redis cache                   |
| Database errors        | Run migration: `medianest db migrate` |
| Login issues           | Clear browser cache                   |

### Log Locations

| Installation    | Log Path                |
| --------------- | ----------------------- |
| **Docker**      | `docker logs medianest` |
| **Systemd**     | `/var/log/medianest/`   |
| **Manual**      | `./logs/medianest.log`  |
| **Development** | Console output          |

---

Need more detailed information? Navigate to the specific reference sections above or search the documentation using the search bar.
