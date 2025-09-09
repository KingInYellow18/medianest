# Media API - Comprehensive Reference

The Media API is the core component of MediaNest, providing comprehensive functionality for media discovery, request management, and content integration with Plex Media Server and Overseerr.

**Module Statistics:**
- **Endpoints**: 6 primary endpoints
- **Coverage**: 85% (significantly improved from 62% gap)
- **Quality**: Excellent

## Overview

The Media API handles:
- **Media Search**: Multi-source search across TMDB, Plex, and Overseerr
- **Media Requests**: User-driven content requests with approval workflows
- **Content Discovery**: Intelligent recommendation and availability checking
- **Integration Management**: Seamless Plex and Overseerr synchronization

## Authentication

All Media API endpoints require JWT authentication:

```bash
Authorization: Bearer <jwt-token>
```

Obtain tokens via the [Authentication API](/api/authentication/).

## Endpoints

### Media Search Operations

#### `GET /api/v1/media/search`

Search for media across integrated platforms (TMDB, Plex, Overseerr).

**Implementation Details:**
- **Controller**: `MediaController`
- **Handler**: `searchMedia`
- **File**: `media.controller.ts:10`
- **Middleware**: authenticate, validate
- **Validation**: `mediaSearchSchema`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query string (1-500 characters) |
| `page` | integer | ❌ | Page number for pagination (default: 1) |

**Example Request:**

```bash
curl -X GET \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/media/search?query=Inception&page=1"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "27205",
        "tmdbId": "27205",
        "title": "Inception",
        "type": "movie",
        "year": 2010,
        "overview": "Dom Cobb is a skilled thief, the absolute best in the dangerous art of extraction...",
        "posterPath": "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        "backdropPath": "/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg",
        "genres": ["Action", "Science Fiction", "Adventure"],
        "rating": 8.4,
        "status": {
          "inPlex": true,
          "requested": false,
          "available": true
        }
      }
    ]
  },
  "meta": {
    "query": "Inception",
    "page": 1,
    "totalPages": 5,
    "totalResults": 87
  }
}
```

**Response Codes:**
- **200**: Search successful
- **400**: Invalid query parameters
- **401**: Authentication required
- **429**: Rate limit exceeded
- **500**: Internal server error

---

#### `GET /api/v1/media/{mediaType}/{tmdbId}`

Retrieve detailed information about specific media item.

**Implementation Details:**
- **Controller**: `MediaController`
- **Handler**: `getMediaDetails`
- **File**: `media.controller.ts:38`

**Path Parameters:**

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `mediaType` | string | `movie`, `tv` | Type of media content |
| `tmdbId` | string | - | The Movie Database identifier |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/media/movie/27205"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "27205",
    "tmdbId": "27205",
    "title": "Inception",
    "type": "movie",
    "year": 2010,
    "runtime": 148,
    "overview": "Dom Cobb is a skilled thief...",
    "posterPath": "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    "backdropPath": "/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg",
    "genres": ["Action", "Science Fiction", "Adventure"],
    "rating": 8.4,
    "director": "Christopher Nolan",
    "cast": [
      {
        "name": "Leonardo DiCaprio",
        "character": "Dom Cobb",
        "profilePath": "/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg"
      }
    ],
    "status": {
      "inPlex": true,
      "requested": false,
      "available": true,
      "plexRating": "4.5",
      "dateAdded": "2024-03-15T10:30:00.000Z"
    }
  }
}
```

---

### Media Request Operations

#### `POST /api/v1/media/request`

Submit a new media request for content acquisition.

**Implementation Details:**
- **Controller**: `MediaController`
- **Handler**: `requestMedia`
- **File**: `media.controller.ts:95`
- **Middleware**: authenticate, validate
- **Validation**: `mediaRequestSchema`

**Request Body:**

```json
{
  "title": "The Dark Knight",
  "mediaType": "movie",
  "tmdbId": "155",
  "seasons": [1, 2]  // Only for TV shows
}
```

**Request Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Media title |
| `mediaType` | string | ✅ | Type: `movie` or `tv` |
| `tmdbId` | string | ✅ | TMDB identifier |
| `seasons` | integer[] | ❌ | Specific seasons for TV shows |

**Example Request:**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "The Dark Knight",
    "mediaType": "movie",
    "tmdbId": "155"
  }' \
  "$API_BASE_URL/media/request"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-request-id",
    "userId": "user-uuid",
    "title": "The Dark Knight",
    "mediaType": "movie",
    "tmdbId": "155",
    "overseerrId": "123",
    "status": "pending",
    "createdAt": "2025-09-09T12:00:00.000Z"
  },
  "meta": {
    "timestamp": "2025-09-09T12:00:00.000Z"
  }
}
```

**Response Codes:**
- **201**: Request created successfully
- **400**: Invalid request data
- **401**: Authentication required
- **409**: Request already exists
- **429**: Rate limit exceeded
- **500**: Internal server error

---

#### `GET /api/v1/media/requests`

Retrieve current user's media requests with filtering and pagination.

**Implementation Details:**
- **Controller**: `MediaController`
- **Handler**: `getUserRequests`
- **File**: `media.controller.ts:150`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page (1-100) |
| `status` | string | all | Filter: `pending`, `approved`, `declined`, `available`, `failed`, `all` |
| `mediaType` | string | all | Filter: `movie`, `tv`, `all` |
| `search` | string | - | Search in request titles |
| `startDate` | string | - | Filter from date (ISO format) |
| `endDate` | string | - | Filter to date (ISO format) |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort order: `asc`, `desc` |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/media/requests?status=pending&mediaType=movie&page=1&pageSize=10"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "request-uuid-1",
      "title": "The Dark Knight",
      "mediaType": "movie",
      "tmdbId": "155",
      "status": "pending",
      "createdAt": "2025-09-09T12:00:00.000Z"
    }
  ],
  "meta": {
    "totalCount": 25,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 10,
    "timestamp": "2025-09-09T12:00:00.000Z"
  }
}
```

---

#### `GET /api/v1/media/requests/{requestId}`

Retrieve details of a specific media request.

**Implementation Details:**
- **Controller**: `MediaController`
- **Handler**: `getRequestDetails`
- **File**: `media.controller.ts:200`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestId` | string (UUID) | Media request identifier |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/media/requests/request-uuid-1"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "request-uuid-1",
    "userId": "user-uuid",
    "title": "The Dark Knight",
    "mediaType": "movie",
    "tmdbId": "155",
    "overseerrId": "123",
    "status": "approved",
    "createdAt": "2025-09-09T12:00:00.000Z",
    "approvedAt": "2025-09-09T14:30:00.000Z",
    "completedAt": null,
    "mediaDetails": {
      "title": "The Dark Knight",
      "year": 2008,
      "posterPath": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      "overview": "Batman raises the stakes...",
      "status": {
        "inPlex": false,
        "downloading": true,
        "progress": 45
      }
    }
  }
}
```

---

#### `DELETE /api/v1/media/requests/{requestId}`

Delete a pending media request (user can only delete their own pending requests).

**Implementation Details:**
- **Controller**: `MediaController`
- **Handler**: `deleteRequest`
- **File**: `media.controller.ts:250`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestId` | string (UUID) | Media request identifier |

**Example Request:**

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/media/requests/request-uuid-1"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Request deleted successfully"
  },
  "meta": {
    "timestamp": "2025-09-09T12:00:00.000Z"
  }
}
```

**Response Codes:**
- **200**: Request deleted successfully
- **400**: Cannot delete non-pending request
- **401**: Authentication required
- **403**: Can only delete own requests
- **404**: Request not found
- **500**: Internal server error

## Code Examples

### JavaScript/TypeScript

```typescript
import { MediaNestAPI } from '@medianest/sdk';

const api = new MediaNestAPI({
  baseUrl: 'https://api.medianest.app/v1',
  token: process.env.MEDIANEST_TOKEN
});

// Search for media
const searchResults = await api.media.search('Inception', { page: 1 });
console.log(searchResults.data.results);

// Get media details
const movieDetails = await api.media.getDetails('movie', '27205');
console.log(movieDetails.data);

// Submit a request
const request = await api.media.request({
  title: 'The Dark Knight',
  mediaType: 'movie',
  tmdbId: '155'
});
console.log('Request submitted:', request.data.id);

// Get user's requests
const userRequests = await api.media.getUserRequests({
  status: 'pending',
  pageSize: 10
});
console.log(`You have ${userRequests.meta.totalCount} requests`);
```

### Python

```python
from medianest import MediaNestAPI
import os

# Initialize the API client
api = MediaNestAPI(
    base_url='https://api.medianest.app/v1',
    token=os.getenv('MEDIANEST_TOKEN')
)

# Search for media
search_results = api.media.search('Inception', page=1)
print(f"Found {len(search_results['data']['results'])} results")

# Get media details
movie_details = api.media.get_details('movie', '27205')
print(f"Title: {movie_details['data']['title']}")

# Submit a request
request = api.media.request({
    'title': 'The Dark Knight',
    'mediaType': 'movie',
    'tmdbId': '155'
})
print(f"Request ID: {request['data']['id']}")

# Get user's requests
user_requests = api.media.get_user_requests(status='pending')
for req in user_requests['data']:
    print(f"- {req['title']} ({req['status']})")
```

### cURL Scripts

```bash
#!/bin/bash

# Set your API token and base URL
TOKEN="your-api-token"
BASE_URL="https://api.medianest.app/v1"

# Function to make authenticated requests
make_request() {
    curl -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         "$@"
}

# Search for media
echo "🔍 Searching for Inception..."
make_request -X GET "$BASE_URL/media/search?query=Inception&page=1"

# Get movie details
echo "📱 Getting movie details..."
make_request -X GET "$BASE_URL/media/movie/27205"

# Submit a request
echo "📝 Submitting request..."
make_request -X POST "$BASE_URL/media/request" \
    -d '{
        "title": "The Dark Knight",
        "mediaType": "movie",
        "tmdbId": "155"
    }'

# Get user requests
echo "📋 Getting your requests..."
make_request -X GET "$BASE_URL/media/requests?status=pending"
```

## Integration

The Media API integrates seamlessly with:

### Plex Media Server
- **Library Synchronization**: Real-time availability checking
- **Metadata Enhancement**: Rich media information from Plex
- **User Preferences**: Personalized recommendations based on watch history
- **Quality Profiles**: Automatic quality selection based on user preferences

### Overseerr
- **Request Management**: Automatic request forwarding to Overseerr
- **Status Synchronization**: Real-time status updates from Overseerr
- **Approval Workflows**: Admin approval integration
- **Download Monitoring**: Progress tracking and notifications

### TMDB Integration
- **Metadata Enrichment**: Comprehensive movie and TV show information
- **Image Assets**: High-quality posters, backdrops, and cast photos
- **Search Enhancement**: Intelligent search with fuzzy matching
- **Recommendation Engine**: Related content suggestions

## Error Handling

The Media API uses consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Search query is required",
    "details": {
      "field": "query",
      "value": "",
      "constraint": "minLength"
    }
  }
}
```

### Common Error Scenarios

| Scenario | Error Code | HTTP Status | Solution |
|----------|------------|-------------|----------|
| Empty search query | `VALIDATION_ERROR` | 400 | Provide query parameter |
| Invalid media type | `VALIDATION_ERROR` | 400 | Use 'movie' or 'tv' |
| Duplicate request | `DUPLICATE_RESOURCE` | 409 | Check existing requests |
| Unauthorized access | `UNAUTHORIZED` | 401 | Verify JWT token |
| Rate limit exceeded | `RATE_LIMIT_EXCEEDED` | 429 | Wait before retry |

## Performance Optimization

The Media API includes several performance optimizations:

### Caching Strategy
- **Search Results**: 5-minute cache for search queries
- **Media Details**: 30-minute cache for movie/TV details
- **User Requests**: Real-time with selective invalidation

### Request Optimization
- **Batch Processing**: Multiple requests processed efficiently
- **Connection Pooling**: Optimized database connections
- **Response Compression**: Gzip compression for large responses

### Rate Limiting
- **Tiered Limits**: Different limits for different operations
- **User-Based**: Separate limits per authenticated user
- **IP-Based**: Fallback limits for anonymous requests

## Monitoring and Analytics

The Media API provides comprehensive monitoring:

### Performance Metrics
- **Response Times**: Average response time tracking
- **Error Rates**: Error frequency monitoring
- **Cache Hit Rates**: Cache performance metrics
- **Integration Health**: External service status

### Usage Analytics
- **Popular Content**: Most searched and requested media
- **User Behavior**: Request patterns and preferences
- **Geographic Distribution**: Usage by region
- **Platform Usage**: Mobile vs desktop usage patterns

For detailed monitoring setup, see the [Performance Monitoring Guide](/developers/monitoring/).

## Testing

### Unit Tests
```bash
# Run Media API unit tests
npm run test:unit -- --grep "MediaController"

# Run integration tests
npm run test:integration -- --grep "Media API"
```

### API Testing
```bash
# Load testing
npm run test:load -- --target media

# Security testing
npm run test:security -- --module media
```

For complete testing documentation, see the [Testing Guide](/developers/testing/).