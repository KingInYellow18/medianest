# Plex Integration API

The MediaNest Plex Integration API provides seamless access to Plex Media Server functionality, including library browsing, search capabilities, collection management, and media metadata retrieval.

## Overview

The Plex API integration allows users to:
- Browse Plex media libraries and collections
- Search across all Plex content
- Retrieve detailed media information and metadata
- Access recently added content
- Manage collections and playlists

All Plex endpoints require authentication and implement intelligent caching for optimal performance.

## Base Endpoint

```
/api/v1/plex
```

## Server Information

### Get Plex Server Info

Retrieve comprehensive information about the connected Plex Media Server.

```http
GET /api/v1/plex/server
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`
**Cache:** 30 minutes

```json
{
  "success": true,
  "data": {
    "server": {
      "name": "MediaNest Plex Server",
      "version": "1.32.7.7621",
      "platform": "Linux",
      "platformVersion": "Ubuntu 22.04.3 LTS",
      "machineIdentifier": "abcd1234-efgh-5678-ijkl-9012mnop3456",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "multiuser": true,
      "transcoderActiveVideoSessions": 1,
      "transcoderAudio": true,
      "transcoderVideo": true,
      "transcoderVideoBitrates": ["64", "96", "208", "320", "720", "1500", "2000", "3000", "4000", "8000", "10000", "12000", "20000"],
      "transcoderVideoQualities": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
      "transcoderVideoResolutions": ["128", "208", "320", "480", "768", "1024", "1280", "1920", "2560", "3840"]
    },
    "connection": {
      "uri": "https://plex.example.com:32400",
      "local": false,
      "relay": false,
      "address": "plex.example.com",
      "port": 32400,
      "protocol": "https"
    },
    "features": {
      "activityNotifications": true,
      "collections": true,
      "contentRating": true,
      "dvr": false,
      "livetv": false,
      "musicAnalysis": true,
      "passthrough": true,
      "photoTranscoding": true,
      "playlists": true,
      "premium": true,
      "provider": "plex",
      "publicAddressMatches": true,
      "publish": true,
      "scannerPhotos": true,
      "searchByGenre": true,
      "sync": true,
      "transcodingThrottling": true,
      "voiceSearch": true
    },
    "statistics": {
      "accountID": 12345678,
      "deviceID": 987654321,
      "sessionCount": 3,
      "libraryCount": 8,
      "totalSize": 54975581388800,
      "totalDuration": 8765432100
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-server-123",
    "cached": true,
    "cacheAge": 1245
  }
}
```

## Library Management

### Get All Libraries

Retrieve all available Plex libraries with basic information.

```http
GET /api/v1/plex/libraries
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`
**Cache:** 30 minutes

```json
{
  "success": true,
  "data": {
    "libraries": [
      {
        "id": "1",
        "key": "/library/sections/1",
        "title": "Movies",
        "type": "movie",
        "agent": "tv.plex.agents.movie",
        "scanner": "Plex Movie Scanner",
        "language": "en-US",
        "uuid": "com.plexapp.plugins.library",
        "refreshing": false,
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T08:00:00.000Z",
        "scannedAt": "2024-01-01T08:00:00.000Z",
        "content": true,
        "directory": true,
        "contentChangedAt": 1704096000,
        "hidden": 0,
        "location": [
          {
            "id": 1,
            "path": "/data/media/movies"
          }
        ],
        "statistics": {
          "count": 2156,
          "totalSize": 23456789012345,
          "totalDuration": 4567890123
        },
        "filters": [
          {
            "filter": "genre",
            "filterType": "string",
            "key": "/library/sections/1/genre",
            "title": "Genre",
            "type": "filter"
          },
          {
            "filter": "year",
            "filterType": "integer",
            "key": "/library/sections/1/year",
            "title": "Year",
            "type": "filter"
          }
        ]
      },
      {
        "id": "2",
        "key": "/library/sections/2",
        "title": "TV Shows",
        "type": "show",
        "agent": "tv.plex.agents.series",
        "scanner": "Plex TV Series Scanner",
        "language": "en-US",
        "uuid": "com.plexapp.plugins.library",
        "refreshing": false,
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T08:30:00.000Z",
        "scannedAt": "2024-01-01T08:30:00.000Z",
        "content": true,
        "directory": true,
        "contentChangedAt": 1704097800,
        "hidden": 0,
        "location": [
          {
            "id": 2,
            "path": "/data/media/tv"
          }
        ],
        "statistics": {
          "count": 487,
          "seasons": 2341,
          "episodes": 15423,
          "totalSize": 18734567890123,
          "totalDuration": 3456789012
        }
      }
    ],
    "totalCount": 8,
    "totalMediaItems": 17579
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-libraries-123"
  }
}
```

### Get Library Items

Retrieve items from a specific Plex library with pagination and filtering.

```http
GET /api/v1/plex/libraries/:libraryKey/items
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `libraryKey` | string | Yes | Library identifier (e.g., "1", "2") |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
```
?start=0&size=50&sort=titleSort&type=movie&unwatched=1
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | number | No | Starting offset (default: 0) |
| `size` | number | No | Number of items (default: 50, max: 200) |
| `sort` | string | No | Sort field (`titleSort`, `addedAt`, `rating`, `year`) |
| `type` | string | No | Item type filter |
| `unwatched` | boolean | No | Filter for unwatched items |
| `genre` | string | No | Genre filter |
| `year` | number | No | Release year filter |

#### Response

**Status:** `200 OK`
**Cache:** 10 minutes

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "ratingKey": "12345",
        "key": "/library/metadata/12345",
        "guid": "plex://movie/5d776b59ad5437001f79c6f8",
        "type": "movie",
        "title": "The Matrix",
        "titleSort": "Matrix",
        "originalTitle": "The Matrix",
        "summary": "A computer programmer is led to fight an underground war against powerful computers who have constructed his entire reality with a system called the Matrix.",
        "rating": 8.7,
        "audienceRating": 8.5,
        "year": 1999,
        "tagline": "The fight for the future begins.",
        "contentRating": "R",
        "duration": 8160000,
        "originallyAvailableAt": "1999-03-31",
        "addedAt": "2023-06-15T14:30:00.000Z",
        "updatedAt": "2024-01-01T10:00:00.000Z",
        "art": "/library/metadata/12345/art/1704096000",
        "thumb": "/library/metadata/12345/thumb/1704096000",
        "theme": "/library/metadata/12345/theme/1704096000",
        "studio": "Warner Bros. Pictures",
        "genres": [
          {
            "id": 1,
            "tag": "Action"
          },
          {
            "id": 2,
            "tag": "Science Fiction"
          }
        ],
        "directors": [
          {
            "id": 123,
            "tag": "Lana Wachowski"
          },
          {
            "id": 124,
            "tag": "Lilly Wachowski"
          }
        ],
        "writers": [
          {
            "id": 123,
            "tag": "Lana Wachowski"
          },
          {
            "id": 124,
            "tag": "Lilly Wachowski"
          }
        ],
        "actors": [
          {
            "id": 456,
            "tag": "Keanu Reeves",
            "role": "Neo",
            "thumb": "/library/metadata/12345/character/456"
          },
          {
            "id": 457,
            "tag": "Laurence Fishburne",
            "role": "Morpheus",
            "thumb": "/library/metadata/12345/character/457"
          }
        ],
        "countries": [
          {
            "id": 1,
            "tag": "United States of America"
          }
        ],
        "collections": [
          {
            "id": 789,
            "tag": "The Matrix Collection"
          }
        ],
        "media": [
          {
            "id": 67890,
            "duration": 8160000,
            "bitrate": 8000,
            "width": 1920,
            "height": 1080,
            "aspectRatio": 1.78,
            "audioChannels": 6,
            "audioCodec": "dts",
            "videoCodec": "h264",
            "videoResolution": "1080",
            "container": "mkv",
            "videoFrameRate": "24p",
            "videoProfile": "high",
            "parts": [
              {
                "id": 98765,
                "key": "/library/parts/98765/1704096000/file.mkv",
                "duration": 8160000,
                "file": "/data/media/movies/The Matrix (1999)/The Matrix (1999).mkv",
                "size": 17179869184,
                "container": "mkv",
                "videoProfile": "high"
              }
            ]
          }
        ],
        "playbackProgress": {
          "viewOffset": 0,
          "viewCount": 0,
          "lastViewedAt": null
        }
      }
    ],
    "pagination": {
      "start": 0,
      "size": 50,
      "total": 2156,
      "hasMore": true
    },
    "libraryInfo": {
      "id": "1",
      "title": "Movies",
      "type": "movie"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-library-items-123"
  }
}
```

## Search Functionality

### Search Across Libraries

Search for content across all accessible Plex libraries.

```http
GET /api/v1/plex/search
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
```
?query=breaking%20bad&type=show&limit=20
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query string |
| `type` | string | No | Media type filter (`movie`, `show`, `episode`, `artist`, `album`, `track`) |
| `limit` | number | No | Maximum results (default: 50, max: 200) |

#### Response

**Status:** `200 OK`
**Cache:** 10 minutes

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "ratingKey": "54321",
        "key": "/library/metadata/54321",
        "type": "show",
        "title": "Breaking Bad",
        "titleSort": "Breaking Bad",
        "summary": "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
        "rating": 9.5,
        "year": 2008,
        "contentRating": "TV-MA",
        "studio": "AMC",
        "duration": 2820000,
        "originallyAvailableAt": "2008-01-20",
        "addedAt": "2023-08-10T20:15:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z",
        "art": "/library/metadata/54321/art/1704096000",
        "thumb": "/library/metadata/54321/thumb/1704096000",
        "banner": "/library/metadata/54321/banner/1704096000",
        "theme": "/library/metadata/54321/theme/1704096000",
        "library": {
          "id": "2",
          "title": "TV Shows",
          "type": "show"
        },
        "genres": [
          {
            "id": 10,
            "tag": "Crime"
          },
          {
            "id": 11,
            "tag": "Drama"
          }
        ],
        "actors": [
          {
            "id": 890,
            "tag": "Bryan Cranston",
            "role": "Walter White",
            "thumb": "/library/metadata/54321/character/890"
          },
          {
            "id": 891,
            "tag": "Aaron Paul",
            "role": "Jesse Pinkman",
            "thumb": "/library/metadata/54321/character/891"
          }
        ],
        "seasonCount": 5,
        "episodeCount": 62,
        "childCount": 62,
        "leafCount": 62,
        "viewedLeafCount": 0,
        "matchReason": "title"
      }
    ],
    "total": 1,
    "queryTime": 234
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-search-123"
  }
}
```

## Recently Added Content

### Get Recently Added Items

Retrieve recently added content across all libraries.

```http
GET /api/v1/plex/recently-added
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
```
?limit=20&type=movie&library=1
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Maximum items (default: 50, max: 200) |
| `type` | string | No | Media type filter |
| `library` | string | No | Specific library ID |

#### Response

**Status:** `200 OK`
**Cache:** 10 minutes

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "ratingKey": "99999",
        "type": "movie",
        "title": "Spider-Man: No Way Home",
        "year": 2021,
        "addedAt": "2024-01-01T10:00:00.000Z",
        "thumb": "/library/metadata/99999/thumb/1704096000",
        "art": "/library/metadata/99999/art/1704096000",
        "summary": "With Spider-Man's identity now revealed...",
        "rating": 8.4,
        "duration": 9240000,
        "library": {
          "id": "1",
          "title": "Movies"
        },
        "genres": [
          {
            "tag": "Action"
          },
          {
            "tag": "Adventure"
          }
        ]
      }
    ],
    "total": 47,
    "timeframe": "last_30_days"
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-recent-123"
  }
}
```

## Collections Management

### Get Library Collections

Retrieve collections from a specific library.

```http
GET /api/v1/plex/libraries/:libraryKey/collections
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `libraryKey` | string | Yes | Library identifier |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`
**Cache:** 30 minutes

```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "ratingKey": "555555",
        "key": "/library/metadata/555555",
        "type": "collection",
        "title": "Marvel Cinematic Universe",
        "titleSort": "Marvel Cinematic Universe",
        "summary": "The Marvel Cinematic Universe (MCU) is an American media franchise and shared universe centered on a series of superhero films...",
        "contentRating": "PG-13",
        "addedAt": "2023-05-20T16:45:00.000Z",
        "updatedAt": "2024-01-01T09:30:00.000Z",
        "art": "/library/metadata/555555/art/1704096000",
        "thumb": "/library/metadata/555555/thumb/1704096000",
        "childCount": 31,
        "smart": false,
        "library": {
          "id": "1",
          "title": "Movies"
        }
      },
      {
        "ratingKey": "666666",
        "key": "/library/metadata/666666",
        "type": "collection",
        "title": "Christopher Nolan Films",
        "titleSort": "Christopher Nolan Films", 
        "summary": "A collection of films directed by Christopher Nolan...",
        "addedAt": "2023-07-12T11:20:00.000Z",
        "updatedAt": "2024-01-01T08:15:00.000Z",
        "art": "/library/metadata/666666/art/1704096000",
        "thumb": "/library/metadata/666666/thumb/1704096000",
        "childCount": 12,
        "smart": true,
        "library": {
          "id": "1",
          "title": "Movies"
        }
      }
    ],
    "total": 24,
    "library": {
      "id": "1",
      "title": "Movies",
      "type": "movie"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-collections-123"
  }
}
```

### Get Collection Details

Retrieve detailed information about a specific collection including its items.

```http
GET /api/v1/plex/collections/:collectionKey
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionKey` | string | Yes | Collection rating key |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`
**Cache:** 30 minutes

```json
{
  "success": true,
  "data": {
    "collection": {
      "ratingKey": "555555",
      "key": "/library/metadata/555555",
      "type": "collection",
      "title": "Marvel Cinematic Universe",
      "titleSort": "Marvel Cinematic Universe",
      "summary": "The Marvel Cinematic Universe (MCU) is an American media franchise and shared universe centered on a series of superhero films produced by Marvel Studios.",
      "contentRating": "PG-13",
      "addedAt": "2023-05-20T16:45:00.000Z",
      "updatedAt": "2024-01-01T09:30:00.000Z",
      "art": "/library/metadata/555555/art/1704096000",
      "thumb": "/library/metadata/555555/thumb/1704096000",
      "childCount": 31,
      "smart": false,
      "subtype": "movie",
      "library": {
        "id": "1",
        "title": "Movies",
        "type": "movie"
      }
    },
    "items": [
      {
        "ratingKey": "777777",
        "type": "movie",
        "title": "Iron Man",
        "year": 2008,
        "originallyAvailableAt": "2008-05-02",
        "addedAt": "2023-05-20T16:45:00.000Z",
        "rating": 7.9,
        "duration": 7560000,
        "thumb": "/library/metadata/777777/thumb/1704096000",
        "art": "/library/metadata/777777/art/1704096000",
        "summary": "After being held captive in an Afghan cave, billionaire engineer Tony Stark creates a unique weaponized suit of armor to fight evil.",
        "genres": [
          {
            "tag": "Action"
          },
          {
            "tag": "Adventure"
          }
        ],
        "actors": [
          {
            "tag": "Robert Downey Jr.",
            "role": "Tony Stark / Iron Man"
          }
        ]
      }
    ],
    "pagination": {
      "start": 0,
      "size": 31,
      "total": 31
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-collection-detail-123"
  }
}
```

## Data Models

### Plex Media Item

```typescript
interface PlexMediaItem {
  ratingKey: string;
  key: string;
  guid?: string;
  type: 'movie' | 'show' | 'season' | 'episode' | 'artist' | 'album' | 'track';
  title: string;
  titleSort?: string;
  originalTitle?: string;
  summary?: string;
  rating?: number;
  audienceRating?: number;
  year?: number;
  contentRating?: string;
  duration?: number;
  originallyAvailableAt?: string;
  addedAt: string;
  updatedAt: string;
  art?: string;
  thumb?: string;
  banner?: string;
  theme?: string;
  studio?: string;
  tagline?: string;
  genres?: PlexTag[];
  directors?: PlexTag[];
  writers?: PlexTag[];
  actors?: PlexActor[];
  countries?: PlexTag[];
  collections?: PlexTag[];
  media?: PlexMediaInfo[];
  library: PlexLibraryReference;
}

interface PlexLibraryReference {
  id: string;
  title: string;
  type: string;
}

interface PlexTag {
  id?: number;
  tag: string;
}

interface PlexActor extends PlexTag {
  role?: string;
  thumb?: string;
}

interface PlexMediaInfo {
  id: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  aspectRatio: number;
  audioChannels: number;
  audioCodec: string;
  videoCodec: string;
  videoResolution: string;
  container: string;
  videoFrameRate: string;
  videoProfile: string;
  parts: PlexMediaPart[];
}

interface PlexMediaPart {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  videoProfile: string;
}
```

### Plex Library

```typescript
interface PlexLibrary {
  id: string;
  key: string;
  title: string;
  type: 'movie' | 'show' | 'artist' | 'photo';
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  refreshing: boolean;
  createdAt: string;
  updatedAt: string;
  scannedAt: string;
  content: boolean;
  directory: boolean;
  contentChangedAt: number;
  hidden: number;
  location: PlexLocation[];
  statistics: PlexLibraryStatistics;
  filters?: PlexFilter[];
}

interface PlexLocation {
  id: number;
  path: string;
}

interface PlexLibraryStatistics {
  count: number;
  totalSize: number;
  totalDuration: number;
  seasons?: number;
  episodes?: number;
}

interface PlexFilter {
  filter: string;
  filterType: string;
  key: string;
  title: string;
  type: string;
}
```

## Performance Optimization

### Caching Strategy

The Plex API implements intelligent caching:

- **Server Info**: 30 minutes (rarely changes)
- **Libraries**: 30 minutes (static structure)
- **Library Items**: 10 minutes (balanced freshness)
- **Search Results**: 10 minutes (user-specific)
- **Recently Added**: 10 minutes (frequent updates)
- **Collections**: 30 minutes (relatively static)

### Response Headers

```
Cache-Control: max-age=600, private
X-Plex-Cache-Status: HIT
X-Plex-Cache-Age: 245
X-Plex-Response-Time: 123ms
```

## Error Handling

### Common Error Codes

| Code | Description | Status |
|------|-------------|---------|
| `PLEX_SERVER_UNAVAILABLE` | Plex server is not accessible | 503 |
| `PLEX_UNAUTHORIZED` | Invalid Plex credentials | 401 |
| `LIBRARY_NOT_FOUND` | Specified library does not exist | 404 |
| `COLLECTION_NOT_FOUND` | Collection not found | 404 |
| `SEARCH_QUERY_TOO_SHORT` | Search query must be at least 2 characters | 400 |
| `PLEX_API_ERROR` | Generic Plex API error | 502 |

## Rate Limiting

Plex API endpoints have the following rate limits:

- **Server Info**: 20 requests per minute per user
- **Library Operations**: 60 requests per minute per user
- **Search**: 30 requests per minute per user  
- **Recently Added**: 20 requests per minute per user
- **Collections**: 40 requests per minute per user

## Usage Examples

### Browse Library with Pagination

```javascript
async function browseMovieLibrary(page = 0, pageSize = 50) {
  const start = page * pageSize;
  
  const response = await fetch(
    `/api/v1/plex/libraries/1/items?start=${start}&size=${pageSize}&sort=titleSort`,
    {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    }
  );
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error.message);
  }
  
  return {
    items: result.data.items,
    pagination: result.data.pagination,
    hasMore: result.data.pagination.hasMore
  };
}
```

### Search and Filter

```javascript
async function searchAndFilter(query, options = {}) {
  const params = new URLSearchParams({
    query,
    limit: options.limit || 50
  });
  
  if (options.type) params.append('type', options.type);
  
  const response = await fetch(
    `/api/v1/plex/search?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    }
  );
  
  const result = await response.json();
  
  return result.success ? result.data.results : [];
}

// Usage
const tvShows = await searchAndFilter('breaking', { type: 'show', limit: 10 });
const movies = await searchAndFilter('matrix', { type: 'movie' });
```