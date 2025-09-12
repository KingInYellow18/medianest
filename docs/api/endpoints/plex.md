# Plex Integration API Endpoints

The Plex API provides endpoints for integrating with Plex Media Server, allowing users to browse libraries, search content, and view server information.

## Overview

All Plex endpoints require authentication and a configured Plex server connection. The API provides read-only access to Plex content.

**Base Path**: `/api/v1/plex`

## Caching

Plex endpoints use intelligent caching to optimize performance:

- Server info: Long-term cache (1 hour)
- Libraries: Long-term cache (1 hour)
- Library items: Medium-term cache (15 minutes)
- Search results: Medium-term cache (15 minutes)
- Recently added: Medium-term cache (15 minutes)

## Endpoints

### Get Plex Server Information

Get information about the connected Plex server.

```http
GET /api/v1/plex/server
```

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/server" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "name": "MyPlexServer",
  "version": "1.32.5.7349-8f4248874",
  "platform": "Linux",
  "platformVersion": "5.4.0-74-generic (#83-Ubuntu)",
  "machineIdentifier": "abc123def456789",
  "size": 1247
}
```

---

### Get Plex Libraries

Get all available Plex media libraries.

```http
GET /api/v1/plex/libraries
```

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/libraries" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
[
  {
    "key": "1",
    "title": "Movies",
    "type": "movie",
    "size": 856,
    "updatedAt": "2023-12-01T10:30:00Z"
  },
  {
    "key": "2",
    "title": "TV Shows",
    "type": "show",
    "size": 124,
    "updatedAt": "2023-12-01T09:15:00Z"
  },
  {
    "key": "3",
    "title": "Music",
    "type": "artist",
    "size": 2341,
    "updatedAt": "2023-11-30T14:20:00Z"
  }
]
```

---

### Get Library Items

Get items from a specific Plex library.

```http
GET /api/v1/plex/libraries/{libraryKey}/items
```

#### Parameters

| Parameter    | Type    | Required | Description                                    |
| ------------ | ------- | -------- | ---------------------------------------------- |
| `libraryKey` | string  | Yes      | Plex library key                               |
| `limit`      | integer | No       | Number of items to return (1-100, default: 50) |
| `offset`     | integer | No       | Number of items to skip (default: 0)           |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/libraries/1/items?limit=10&offset=0" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "items": [
    {
      "key": "12345",
      "title": "The Matrix",
      "type": "movie",
      "summary": "Set in the 22nd century, The Matrix tells the story...",
      "year": 1999,
      "thumb": "/library/metadata/12345/thumb/1638360000",
      "art": "/library/metadata/12345/art/1638360000",
      "addedAt": "2023-11-15T10:30:00Z"
    },
    {
      "key": "12346",
      "title": "Inception",
      "type": "movie",
      "summary": "Dom Cobb is a skilled thief, the absolute best...",
      "year": 2010,
      "thumb": "/library/metadata/12346/thumb/1638360120",
      "art": "/library/metadata/12346/art/1638360120",
      "addedAt": "2023-11-20T15:45:00Z"
    }
  ],
  "total": 856
}
```

---

### Search Plex Libraries

Search across all Plex libraries.

```http
GET /api/v1/plex/search
```

#### Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| `query`   | string | Yes      | Search query (min 1 character) |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/search?query=matrix" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
[
  {
    "key": "12345",
    "title": "The Matrix",
    "type": "movie",
    "summary": "Set in the 22nd century, The Matrix tells the story...",
    "year": 1999,
    "thumb": "/library/metadata/12345/thumb/1638360000",
    "art": "/library/metadata/12345/art/1638360000",
    "addedAt": "2023-11-15T10:30:00Z"
  },
  {
    "key": "12347",
    "title": "The Matrix Reloaded",
    "type": "movie",
    "summary": "Neo and his allies race against time before...",
    "year": 2003,
    "thumb": "/library/metadata/12347/thumb/1638360240",
    "art": "/library/metadata/12347/art/1638360240",
    "addedAt": "2023-11-15T10:35:00Z"
  }
]
```

---

### Get Recently Added Items

Get recently added items from Plex.

```http
GET /api/v1/plex/recently-added
```

#### Parameters

| Parameter | Type    | Required | Description                                    |
| --------- | ------- | -------- | ---------------------------------------------- |
| `limit`   | integer | No       | Number of items to return (1-100, default: 20) |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/recently-added?limit=5" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
[
  {
    "key": "12350",
    "title": "Dune",
    "type": "movie",
    "summary": "Paul Atreides, a brilliant and gifted young man...",
    "year": 2021,
    "thumb": "/library/metadata/12350/thumb/1638370000",
    "art": "/library/metadata/12350/art/1638370000",
    "addedAt": "2023-12-01T08:30:00Z"
  },
  {
    "key": "12349",
    "title": "The Witcher",
    "type": "show",
    "summary": "Geralt of Rivia, a mutated monster-hunter...",
    "year": 2019,
    "thumb": "/library/metadata/12349/thumb/1638369000",
    "art": "/library/metadata/12349/art/1638369000",
    "addedAt": "2023-11-30T20:15:00Z"
  }
]
```

---

### Get Collections for Library

Get collections (playlists/smart collections) for a specific library.

```http
GET /api/v1/plex/libraries/{libraryKey}/collections
```

#### Parameters

| Parameter    | Type   | Required | Description      |
| ------------ | ------ | -------- | ---------------- |
| `libraryKey` | string | Yes      | Plex library key |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/libraries/1/collections" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
[
  {
    "key": "coll_1",
    "title": "Marvel Collection",
    "type": "collection",
    "summary": "All Marvel movies in chronological order",
    "itemCount": 28,
    "thumb": "/library/collections/coll_1/thumb/1638360000",
    "art": "/library/collections/coll_1/art/1638360000",
    "updatedAt": "2023-11-25T14:20:00Z"
  }
]
```

---

### Get Collection Details

Get detailed information about a specific collection.

```http
GET /api/v1/plex/collections/{collectionKey}
```

#### Parameters

| Parameter       | Type   | Required | Description         |
| --------------- | ------ | -------- | ------------------- |
| `collectionKey` | string | Yes      | Plex collection key |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/plex/collections/coll_1" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "key": "coll_1",
  "title": "Marvel Collection",
  "type": "collection",
  "summary": "All Marvel movies in chronological order",
  "itemCount": 28,
  "thumb": "/library/collections/coll_1/thumb/1638360000",
  "art": "/library/collections/coll_1/art/1638360000",
  "updatedAt": "2023-11-25T14:20:00Z",
  "items": [
    {
      "key": "12351",
      "title": "Iron Man",
      "type": "movie",
      "year": 2008,
      "thumb": "/library/metadata/12351/thumb/1638360000"
    },
    {
      "key": "12352",
      "title": "The Incredible Hulk",
      "type": "movie",
      "year": 2008,
      "thumb": "/library/metadata/12352/thumb/1638360120"
    }
  ]
}
```

## Status Codes

| Status | Description                            |
| ------ | -------------------------------------- |
| `200`  | Success                                |
| `400`  | Bad request (invalid query parameters) |
| `401`  | Unauthorized                           |
| `404`  | Library or item not found              |
| `503`  | Plex server unavailable                |
| `500`  | Internal server error                  |

## Error Responses

### Bad Request (400)

```json
{
  "error": "Bad Request",
  "message": "Search query is required",
  "details": ["Query parameter 'query' must be at least 1 character long"]
}
```

### Plex Server Unavailable (503)

```json
{
  "error": "Service Unavailable",
  "message": "Plex server is currently unavailable"
}
```

### Not Found (404)

```json
{
  "error": "Not Found",
  "message": "Library not found"
}
```

## Image URLs

Plex images (thumbs and art) are served through the Plex server. To construct full URLs:

```
https://your-plex-server.com:32400{thumb_path}?X-Plex-Token=<plex-token>
```

Example:

```
https://plex.example.com:32400/library/metadata/12345/thumb/1638360000?X-Plex-Token=abc123
```

## Library Types

Plex supports different library types:

| Type     | Description     |
| -------- | --------------- |
| `movie`  | Movie library   |
| `show`   | TV Show library |
| `artist` | Music library   |
| `photo`  | Photo library   |

## Performance Optimizations

### Caching Strategy

- Server information cached for 1 hour
- Library listings cached for 1 hour
- Dynamic content (items, search) cached for 15 minutes
- Cache headers included in responses

### Pagination

- Large libraries automatically paginated
- Use `limit` and `offset` for efficient browsing
- Default page size optimized for performance

### Connection Pooling

- Persistent connections to Plex server
- Connection pool managed automatically
- Failover handling for server unavailability

## Integration Notes

### Authentication Requirements

- User must be authenticated with MediaNest
- Plex server connection configured by admin
- Read-only access to Plex content

### Real-time Updates

While Plex endpoints don't support real-time updates directly, the dashboard status endpoints provide Plex server health information.

### Rate Limiting

Plex endpoints share the same rate limiting as other API endpoints to prevent overloading the Plex server.
