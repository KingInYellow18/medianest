# API Reference

MediaNest provides a comprehensive REST API that allows you to integrate media management capabilities into your applications, automate workflows, and build custom solutions.

## API Overview

The MediaNest API is organized around REST principles with predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes and authentication.

### Base URL

```
https://your-medianest-instance.com/api/v1
```

For local development:

```
http://localhost:8080/api/v1
```

### API Version

Current API version: **v1**

We maintain backward compatibility and will announce any breaking changes well in advance.

## Quick Start

### Authentication

All API requests require authentication using Bearer tokens:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://your-instance.com/api/v1/media
```

[Get your API token →](authentication.md)

### Basic Example

Upload a media file:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@image.jpg" \
  -F "collection=my-photos" \
  http://localhost:8080/api/v1/media
```

## API Endpoints

<div class="grid cards" markdown>

- :material-shield-account: **Authentication**

  ***

  Manage API tokens, user sessions, and access control

  [Authentication API →](authentication.md)

- :material-image-multiple: **Media API**

  ***

  Upload, retrieve, update, and delete media files

  [Media API →](media.md)

- :material-folder-multiple: **Collections**

  ***

  Organize media into collections and manage hierarchies

  [Collections API →](collections.md)

- :material-account-group: **User Management**

  ***

  Manage users, roles, and permissions

  [Users API →](users.md)

- :material-magnify: **Search API**

  ***

  Advanced search across media, metadata, and content

  [Search API →](search.md)

- :material-webhook: **Webhooks**

  ***

  Real-time notifications for media events

  [Webhooks →](webhooks.md)

</div>

## Core Concepts

### Resources

The API is built around these core resources:

| Resource        | Description                                               |
| --------------- | --------------------------------------------------------- |
| **Media**       | Individual media files (images, videos, audio, documents) |
| **Collections** | Logical groupings of media files                          |
| **Users**       | User accounts and authentication                          |
| **Tags**        | Metadata labels for categorization                        |
| **Comments**    | User annotations on media                                 |
| **Shares**      | Sharing permissions and links                             |

### Standard Operations

Each resource supports standard CRUD operations:

| HTTP Method | Operation | Example             |
| ----------- | --------- | ------------------- |
| `GET`       | Retrieve  | `GET /media/123`    |
| `POST`      | Create    | `POST /media`       |
| `PUT`       | Update    | `PUT /media/123`    |
| `DELETE`    | Delete    | `DELETE /media/123` |

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "v1",
    "requestId": "req_123456789"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request could not be processed",
    "details": {
      "field": "email",
      "issue": "required"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

## Authentication

The API uses Bearer token authentication. Include your token in the Authorization header:

```http
Authorization: Bearer YOUR_API_TOKEN
```

### Getting an API Token

1. Log into MediaNest web interface
2. Go to **Settings > API Tokens**
3. Click **Generate New Token**
4. Copy and store your token securely

[Full Authentication Guide →](authentication.md)

## Rate Limiting

API requests are rate-limited to ensure fair usage:

| Tier           | Requests per Hour | Burst Limit |
| -------------- | ----------------- | ----------- |
| **Free**       | 1,000             | 100         |
| **Pro**        | 10,000            | 500         |
| **Enterprise** | 100,000           | 2,000       |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1642252800
```

[Rate Limiting Details →](rate-limiting.md)

## Error Handling

The API uses conventional HTTP response codes:

| Code  | Meaning                                     |
| ----- | ------------------------------------------- |
| `200` | OK - Request successful                     |
| `201` | Created - Resource created successfully     |
| `400` | Bad Request - Invalid request parameters    |
| `401` | Unauthorized - Invalid or missing API token |
| `403` | Forbidden - Insufficient permissions        |
| `404` | Not Found - Resource not found              |
| `429` | Too Many Requests - Rate limit exceeded     |
| `500` | Internal Server Error - Server error        |

[Error Handling Guide →](errors.md)

## SDKs and Tools

### Official SDKs

- **JavaScript/Node.js**: `npm install @medianest/sdk`
- **Python**: `pip install medianest-sdk`
- **Go**: `go get github.com/medianest/medianest-go`
- **PHP**: `composer require medianest/medianest-php`

### Community SDKs

- **Ruby**: `gem install medianest-ruby`
- **Java**: Available on Maven Central
- **C#/.NET**: Available on NuGet

### API Tools

- **Postman Collection**: Import ready-to-use API requests
- **OpenAPI/Swagger**: Interactive API documentation
- **Insomnia**: REST client configuration

## Examples

### Upload and Process Media

```javascript
const MediaNest = require('@medianest/sdk');
const client = new MediaNest('YOUR_API_TOKEN');

// Upload with automatic processing
const result = await client.media.upload({
  file: fs.createReadStream('photo.jpg'),
  collection: 'vacation-2024',
  autoProcess: true,
  tags: ['beach', 'sunset'],
});

console.log('Uploaded:', result.data.id);
```

### Search Media

```python
import medianest

client = medianest.Client('YOUR_API_TOKEN')

# Search for beach photos from 2024
results = client.search({
    'query': 'beach sunset',
    'date_range': '2024-01-01:2024-12-31',
    'media_type': 'image',
    'limit': 20
})

for media in results.data:
    print(f"Found: {media.filename}")
```

### Create Collection

```bash
# Create a new collection
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Alpha Assets",
    "description": "Media files for Project Alpha",
    "privacy": "private",
    "tags": ["project", "alpha", "2024"]
  }' \
  http://localhost:8080/api/v1/collections
```

## Webhooks

Set up real-time notifications for media events:

```json
{
  "url": "https://your-app.com/webhooks/medianest",
  "events": ["media.uploaded", "media.processed"],
  "secret": "your-webhook-secret"
}
```

[Webhook Documentation →](webhooks.md)

## Best Practices

1. **Use HTTPS** - Always use HTTPS in production
2. **Store Tokens Securely** - Never expose API tokens in client-side code
3. **Handle Rate Limits** - Implement exponential backoff for rate-limited requests
4. **Validate Input** - Always validate data before sending to the API
5. **Monitor Usage** - Track API usage and set up alerts

## Support

Need help with the API?

- **Documentation**: Complete reference for all endpoints
- **GitHub Issues**: Report bugs and request features
- **Community Forum**: Get help from other developers
- **Enterprise Support**: Priority support for enterprise customers

---

Ready to start building? Check out our [Authentication Guide](authentication.md) to get your first API token!
