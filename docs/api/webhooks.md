# Webhooks API

The MediaNest Webhooks API provides endpoints for receiving notifications from external services and integrating with third-party platforms for automated workflow management.

## Overview

The Webhooks API allows external services to notify MediaNest about events such as:
- Media request updates from Overseerr
- Download completion notifications
- Service status changes
- External system integrations

Webhooks are designed to be secure, reliable, and provide proper error handling and retry mechanisms.

## Base Endpoint

```
/api/v1/webhooks
```

## Security

### Signature Verification

Webhooks should include signature verification to ensure authenticity:

- **Overseerr**: Uses `X-Overseerr-Signature` header
- **Custom Webhooks**: Use configurable signature verification

### IP Whitelist

Production deployments should implement IP whitelisting for webhook endpoints.

## Overseerr Integration

### Overseerr Webhook

Receive notifications from Overseerr about media requests and availability updates.

```http
POST /api/v1/webhooks/overseerr
```

#### Request

**Headers:**
```
Content-Type: application/json
X-Overseerr-Signature: sha256=<signature>
User-Agent: Overseerr/1.33.2
```

**Supported Notification Types:**
- `MEDIA_PENDING` - New media request submitted
- `MEDIA_APPROVED` - Media request approved
- `MEDIA_AUTO_APPROVED` - Media request auto-approved
- `MEDIA_DECLINED` - Media request declined
- `MEDIA_AVAILABLE` - Media now available
- `MEDIA_FAILED` - Media processing failed
- `TEST_NOTIFICATION` - Test webhook

#### Request Body Examples

**Media Request Notification:**
```json
{
  "notification_type": "MEDIA_APPROVED",
  "event": "media.approved",
  "subject": "New movie request approved",
  "message": "The Matrix has been approved for download",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  "media": {
    "media_type": "movie",
    "tmdbId": 603,
    "tvdbId": null,
    "imdbId": "tt0133093",
    "status": "APPROVED",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:15:00.000Z"
  },
  "request": {
    "request_id": "req-456",
    "requestedBy_email": "user@example.com",
    "requestedBy_username": "john_doe",
    "requestedBy_avatar": "https://plex.tv/users/avatar.png"
  },
  "extra": []
}
```

**Media Available Notification:**
```json
{
  "notification_type": "MEDIA_AVAILABLE",
  "event": "media.available",
  "subject": "Movie available!",
  "message": "The Matrix is now available!",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  "media": {
    "media_type": "movie",
    "tmdbId": 603,
    "tvdbId": null,
    "imdbId": "tt0133093",
    "status": "AVAILABLE",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "request": {
    "request_id": "req-456",
    "requestedBy_email": "user@example.com",
    "requestedBy_username": "john_doe",
    "requestedBy_avatar": "https://plex.tv/users/avatar.png"
  },
  "extra": []
}
```

**TV Show Notification:**
```json
{
  "notification_type": "MEDIA_APPROVED",
  "event": "media.approved",
  "subject": "New TV show request approved",
  "message": "Breaking Bad Season 6 has been approved for download",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "media": {
    "media_type": "tv",
    "tmdbId": 1396,
    "tvdbId": 81189,
    "imdbId": "tt0903747",
    "status": "APPROVED",
    "createdAt": "2024-01-01T11:00:00.000Z",
    "updatedAt": "2024-01-01T11:15:00.000Z",
    "seasons": [
      {
        "id": 123,
        "seasonNumber": 6,
        "status": "APPROVED"
      }
    ]
  },
  "request": {
    "request_id": "req-789",
    "requestedBy_email": "user@example.com", 
    "requestedBy_username": "jane_doe",
    "requestedBy_avatar": "https://plex.tv/users/avatar.png"
  },
  "extra": []
}
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Webhook processed successfully",
    "notificationType": "MEDIA_APPROVED",
    "processedAt": "2024-01-01T10:15:30.000Z",
    "actions": [
      {
        "type": "notification_sent",
        "target": "user@example.com",
        "success": true
      },
      {
        "type": "status_updated",
        "requestId": "req-456",
        "success": true
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-01T10:15:30.000Z",
    "requestId": "webhook-overseerr-123",
    "processingTime": "45ms"
  }
}
```

#### Error Handling

**Status:** `400 Bad Request`
```json
{
  "success": false,
  "error": {
    "message": "Invalid webhook payload",
    "code": "WEBHOOK_INVALID_PAYLOAD",
    "statusCode": 400,
    "details": {
      "field": "notification_type",
      "issue": "Unknown notification type"
    }
  }
}
```

**Status:** `401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "message": "Invalid webhook signature",
    "code": "WEBHOOK_SIGNATURE_INVALID",
    "statusCode": 401
  }
}
```

## Webhook Processing

### Processing Flow

1. **Signature Verification**: Validate webhook authenticity
2. **Payload Parsing**: Parse and validate JSON payload
3. **Event Processing**: Handle specific notification types
4. **User Notification**: Send notifications to relevant users
5. **Status Updates**: Update internal request status
6. **Response Generation**: Return processing status

### Supported Actions

Based on notification type, the following actions are performed:

#### MEDIA_APPROVED
- Update request status to "approved"
- Notify requesting user via email/in-app notification
- Log approval event
- Trigger download queue processing

#### MEDIA_AVAILABLE
- Update request status to "available"
- Notify requesting user about availability
- Update Plex library cache
- Log availability event

#### MEDIA_DECLINED
- Update request status to "declined"
- Notify requesting user with reason
- Log decline event

#### MEDIA_FAILED
- Update request status to "failed"
- Notify requesting user and admins
- Log failure with error details
- Optionally retry or require manual intervention

### Retry Mechanism

Failed webhook processing includes automatic retry:

- **Initial Failure**: Immediate retry
- **Second Failure**: Retry after 30 seconds
- **Third Failure**: Retry after 5 minutes
- **Final Failure**: Log error and send admin alert

## Custom Webhooks

### Generic Webhook Handler

For custom integrations, MediaNest provides a generic webhook handler.

```http
POST /api/v1/webhooks/custom/:webhookId
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `webhookId` | string | Yes | Custom webhook identifier |

#### Request

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: <signature>
X-Webhook-Source: <source-identifier>
```

**Body:**
```json
{
  "event": "download.completed",
  "data": {
    "downloadId": "download-123",
    "title": "The Matrix (1999)",
    "status": "completed",
    "path": "/downloads/movies/The Matrix (1999).mkv",
    "size": 17179869184,
    "completedAt": "2024-01-01T12:00:00.000Z"
  },
  "metadata": {
    "source": "qbittorrent",
    "version": "4.5.4",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Webhook Configuration

### Setting Up Overseerr Webhook

In Overseerr admin settings, configure the webhook URL:

```
https://your-medianest-domain.com/api/v1/webhooks/overseerr
```

**Notification Types to Enable:**
- Media Approved
- Media Auto Approved
- Media Available
- Media Declined
- Media Failed

### Webhook Security

For production deployments, implement these security measures:

1. **HTTPS Only**: Use HTTPS for all webhook endpoints
2. **Signature Verification**: Validate webhook signatures
3. **IP Whitelist**: Restrict access to known source IPs
4. **Rate Limiting**: Implement rate limiting on webhook endpoints
5. **Request Size Limits**: Limit webhook payload sizes

## Data Models

### Overseerr Webhook Payload

```typescript
interface OverseerrWebhookPayload {
  notification_type: OverseerrNotificationType;
  event: string;
  subject: string;
  message: string;
  image?: string;
  media: OverseerrMedia;
  request: OverseerrRequest;
  extra: any[];
}

type OverseerrNotificationType = 
  | 'MEDIA_PENDING'
  | 'MEDIA_APPROVED'
  | 'MEDIA_AUTO_APPROVED'
  | 'MEDIA_DECLINED'
  | 'MEDIA_AVAILABLE'
  | 'MEDIA_FAILED'
  | 'TEST_NOTIFICATION';

interface OverseerrMedia {
  media_type: 'movie' | 'tv';
  tmdbId: number;
  tvdbId?: number;
  imdbId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  seasons?: OverseerrSeason[];
}

interface OverseerrRequest {
  request_id: string;
  requestedBy_email: string;
  requestedBy_username: string;
  requestedBy_avatar?: string;
}

interface OverseerrSeason {
  id: number;
  seasonNumber: number;
  status: string;
}
```

### Webhook Processing Result

```typescript
interface WebhookProcessingResult {
  success: boolean;
  notificationType: string;
  processedAt: string;
  actions: WebhookAction[];
  errors?: WebhookError[];
}

interface WebhookAction {
  type: 'notification_sent' | 'status_updated' | 'cache_invalidated' | 'retry_queued';
  target?: string;
  requestId?: string;
  success: boolean;
  details?: any;
}

interface WebhookError {
  action: string;
  error: string;
  timestamp: string;
}
```

## Monitoring and Logging

### Webhook Metrics

Track the following metrics for webhook reliability:

- **Success Rate**: Percentage of successfully processed webhooks
- **Processing Time**: Average time to process webhooks
- **Retry Rate**: Percentage of webhooks requiring retries
- **Error Rate**: Percentage of failed webhooks

### Logging

All webhook activity is logged with the following information:

```json
{
  "timestamp": "2024-01-01T10:15:30.000Z",
  "level": "info",
  "message": "Webhook processed successfully",
  "webhook": {
    "source": "overseerr",
    "type": "MEDIA_APPROVED",
    "id": "webhook-123"
  },
  "processing": {
    "duration": 45,
    "actions": 3,
    "errors": 0
  },
  "request": {
    "ip": "192.168.1.50",
    "userAgent": "Overseerr/1.33.2",
    "size": 1024
  }
}
```

## Testing Webhooks

### Test Overseerr Connection

Send a test webhook to verify the integration:

```bash
curl -X POST https://your-domain.com/api/v1/webhooks/overseerr \
  -H "Content-Type: application/json" \
  -H "User-Agent: Overseerr/1.33.2" \
  -d '{
    "notification_type": "TEST_NOTIFICATION",
    "event": "test",
    "subject": "Test notification",
    "message": "This is a test webhook from Overseerr",
    "media": {
      "media_type": "movie",
      "tmdbId": 603,
      "status": "APPROVED"
    },
    "request": {
      "request_id": "test-123",
      "requestedBy_email": "test@example.com",
      "requestedBy_username": "testuser"
    },
    "extra": []
  }'
```

### Development Testing

For development and testing, use tools like ngrok to expose local webhooks:

```bash
# Install ngrok
npm install -g ngrok

# Expose local port
ngrok http 8080

# Use the generated URL in Overseerr
https://abc123.ngrok.io/api/v1/webhooks/overseerr
```

## Error Handling Best Practices

1. **Graceful Failures**: Always return appropriate HTTP status codes
2. **Detailed Logging**: Log all webhook attempts with full context
3. **Retry Logic**: Implement exponential backoff for retries
4. **Dead Letter Queue**: Store permanently failed webhooks for manual review
5. **Monitoring**: Set up alerts for webhook processing failures

## Rate Limiting

Webhook endpoints have the following rate limits:

- **Overseerr Webhooks**: 100 requests per minute per source IP
- **Custom Webhooks**: 50 requests per minute per webhook ID
- **Test Webhooks**: 10 requests per minute per source IP

Exceeding rate limits returns a `429 Too Many Requests` response with retry-after header.