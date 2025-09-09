# Media API Endpoints

The Media API provides endpoints for searching media content and managing media requests.

## Overview

All media endpoints require authentication. The API integrates with TMDB for media search and metadata.

**Base Path**: `/api/v1/media`

## Endpoints

### Search Media

Search for movies and TV shows using TMDB.

```http
GET /api/v1/media/search
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 1 character) |
| `type` | string | No | Media type: `movie`, `tv`, or `all` (default: `all`) |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/media/search?q=the%20matrix&type=movie" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "results": [
    {
      "id": "603",
      "title": "The Matrix",
      "overview": "Set in the 22nd century, The Matrix tells the story of a computer hacker...",
      "poster_path": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      "backdrop_path": "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
      "release_date": "1999-03-30",
      "media_type": "movie",
      "vote_average": 8.2
    }
  ],
  "total_results": 1,
  "total_pages": 1
}
```

---

### Get Media Details

Get detailed information about a specific media item.

```http
GET /api/v1/media/{mediaType}/{tmdbId}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mediaType` | string | Yes | Type of media: `movie` or `tv` |
| `tmdbId` | string | Yes | TMDB ID of the media |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/media/movie/603" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "id": "603",
  "title": "The Matrix",
  "overview": "Set in the 22nd century, The Matrix tells the story of a computer hacker...",
  "poster_path": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  "backdrop_path": "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
  "release_date": "1999-03-30",
  "media_type": "movie",
  "vote_average": 8.2,
  "genres": [
    {
      "id": 28,
      "name": "Action"
    },
    {
      "id": 878,
      "name": "Science Fiction"
    }
  ],
  "runtime": 136,
  "status": "Released",
  "budget": 63000000,
  "revenue": 463517383
}
```

---

### Submit Media Request

Submit a request for a movie or TV show.

```http
POST /api/v1/media/request
```

#### Request Body

```json
{
  "title": "The Matrix",
  "mediaType": "movie",
  "tmdbId": "603",
  "overseerrId": "123"
}
```

#### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Title of the media (1-500 characters) |
| `mediaType` | string | Yes | Type of media: `movie` or `tv` |
| `tmdbId` | string | No | TMDB ID for the media |
| `overseerrId` | string | No | Overseerr ID for the media |

#### Example Request

```bash
curl -X POST "http://localhost:3001/api/v1/media/request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "The Matrix",
    "mediaType": "movie",
    "tmdbId": "603"
  }'
```

#### Example Response

```json
{
  "id": "req-123e4567-e89b-12d3-a456-426614174000",
  "title": "The Matrix",
  "mediaType": "movie",
  "tmdbId": "603",
  "status": "pending",
  "requestedBy": "user-123",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2023-12-01T10:00:00Z"
}
```

---

### Get User's Media Requests

Get all media requests made by the current user.

```http
GET /api/v1/media/requests
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of requests to return (1-100, default: 20) |
| `offset` | integer | No | Number of requests to skip (default: 0) |
| `status` | string | No | Filter by status: `pending`, `approved`, `declined`, `completed` |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/media/requests?limit=10&status=pending" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "requests": [
    {
      "id": "req-123e4567-e89b-12d3-a456-426614174000",
      "title": "The Matrix",
      "mediaType": "movie",
      "tmdbId": "603",
      "status": "pending",
      "requestedBy": "user-123",
      "createdAt": "2023-12-01T10:00:00Z",
      "updatedAt": "2023-12-01T10:00:00Z"
    }
  ],
  "total": 25,
  "hasMore": true
}
```

---

### Get Specific Request Details

Get details of a specific media request.

```http
GET /api/v1/media/requests/{requestId}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requestId` | string | Yes | UUID of the request |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/media/requests/req-123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "id": "req-123e4567-e89b-12d3-a456-426614174000",
  "title": "The Matrix",
  "mediaType": "movie",
  "tmdbId": "603",
  "overseerrId": "123",
  "status": "completed",
  "requestedBy": "user-123",
  "createdAt": "2023-12-01T10:00:00Z",
  "updatedAt": "2023-12-01T12:30:00Z",
  "processedAt": "2023-12-01T11:15:00Z"
}
```

---

### Delete Pending Request

Delete a media request that is still pending.

```http
DELETE /api/v1/media/requests/{requestId}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requestId` | string | Yes | UUID of the request |

#### Example Request

```bash
curl -X DELETE "http://localhost:3001/api/v1/media/requests/req-123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "success": true,
  "message": "Request deleted successfully"
}
```

## Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `201` | Request created |
| `400` | Bad request (validation errors) |
| `401` | Unauthorized |
| `403` | Forbidden (cannot delete non-pending request) |
| `404` | Request not found |
| `500` | Internal server error |

## Error Responses

### Validation Error (400)

```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    "Title is required",
    "MediaType must be 'movie' or 'tv'"
  ]
}
```

### Not Found (404)

```json
{
  "error": "Not Found",
  "message": "Media request not found"
}
```

### Cannot Delete (403)

```json
{
  "error": "Forbidden",
  "message": "Cannot delete request with status 'completed'"
}
```

## Real-time Updates

Media requests support real-time status updates via WebSocket. Subscribe to request updates:

```javascript
// Subscribe to specific request
socket.emit('subscribe:request', requestId);

// Listen for status updates
socket.on(`request:${requestId}:status`, (update) => {
  console.log('Request status:', update.status);
});
```

See [WebSocket Documentation](../websocket.md) for more details.

## Integration Notes

### TMDB Integration
- Search results include TMDB metadata
- Poster and backdrop images available via TMDB image URLs
- Rating information from TMDB community

### Request Processing
- Requests are processed asynchronously
- Status updates sent via WebSocket
- Processing may involve external services (Overseerr, Plex)

### Permissions
- Users can only view/manage their own requests
- Admin users can view all requests
- Request deletion only allowed for pending requests