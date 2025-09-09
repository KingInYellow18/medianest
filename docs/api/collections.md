# Collections API

Media collection management endpoints

## Base URL

```
/api/v1/collections
```

## Authentication

All API endpoints require authentication unless otherwise specified.

### Authentication Header

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Available Methods

`GET` | `POST` | `PUT` | `DELETE`

## Examples

### Basic Request

```bash
curl -X GET \
  "/api/v1/collections" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### Response Format

```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "timestamp": "2025-01-09T00:00:00Z"
}
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  },
  "timestamp": "2025-01-09T00:00:00Z"
}
```

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Rate Limiting

### Rate Limits

- **Authenticated users**: 1000 requests per hour
- **Anonymous users**: 100 requests per hour

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

## SDKs and Libraries

### Official SDKs

- [JavaScript SDK](https://github.com/medianest/js-sdk)
- [Python SDK](https://github.com/medianest/python-sdk)
- [Go SDK](https://github.com/medianest/go-sdk)

### Community Libraries

- [PHP Library](https://github.com/community/medianest-php)
- [Ruby Gem](https://github.com/community/medianest-ruby)

## Support

For API support and questions:

- [GitHub Issues](https://github.com/medianest/medianest/issues)
- [Discord Community](https://discord.gg/medianest)
- [Email Support](mailto:api-support@medianest.com)
