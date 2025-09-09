# Media API

The MediaNest Media API provides comprehensive media search, request management, and integration capabilities with external media services.

## Overview

The Media API allows users to:
- Search for movies and TV shows across multiple databases
- Submit media requests for content acquisition
- Manage personal media request queues
- Retrieve detailed media information and metadata

All media endpoints require authentication via JWT token.

## Base Endpoint

```
/api/v1/media
```

## Media Search

### Search Media

Search for movies and TV shows across integrated databases (TMDB, Overseerr, etc.).

```http
GET /api/v1/media/search
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query string |
| `type` | enum | No | Media type filter (`movie`, `tv`, `all`) |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
```
?q=breaking%20bad&type=tv
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "tmdb-1396",
      "tmdbId": "1396",
      "title": "Breaking Bad",
      "overview": "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
      "mediaType": "tv",
      "releaseDate": "2008-01-20",
      "genres": ["Crime", "Drama", "Thriller"],
      "rating": 9.5,
      "popularity": 123.456,
      "posterPath": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      "backdropPath": "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
      "status": "available",
      "availability": {
        "plex": {
          "available": true,
          "libraryId": "12345",
          "ratingKey": "67890"
        },
        "overseerr": {
          "status": "available",
          "requestId": null
        }
      },
      "seasons": 5,
      "episodes": 62
    }
  ],
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-search-123"
  }
}
```

#### Error Responses

**Status:** `400 Bad Request`
```json
{
  "success": false,
  "error": {
    "message": "Search query is required",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "details": {
      "field": "q",
      "constraint": "Search query must be at least 1 character"
    }
  }
}
```

### Get Media Details

Retrieve detailed information about a specific media item.

```http
GET /api/v1/media/:mediaType/:tmdbId
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mediaType` | enum | Yes | Type of media (`movie`, `tv`) |
| `tmdbId` | string | Yes | TMDB identifier |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL:**
```
/api/v1/media/tv/1396
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "tmdb-1396",
    "tmdbId": "1396",
    "title": "Breaking Bad",
    "originalTitle": "Breaking Bad",
    "overview": "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
    "tagline": "Change the equation.",
    "mediaType": "tv",
    "releaseDate": "2008-01-20",
    "endDate": "2013-09-29",
    "runtime": 47,
    "languages": ["en"],
    "originCountry": ["US"],
    "genres": [
      {
        "id": 80,
        "name": "Crime"
      },
      {
        "id": 18,
        "name": "Drama"
      }
    ],
    "productionCompanies": [
      {
        "id": 2605,
        "name": "High Bridge Productions",
        "logoPath": "/logo.png"
      }
    ],
    "networks": [
      {
        "id": 174,
        "name": "AMC",
        "logoPath": "/network.png"
      }
    ],
    "rating": {
      "tmdb": 9.5,
      "imdb": 9.5,
      "rottenTomatoes": 96
    },
    "popularity": 123.456,
    "voteCount": 12345,
    "posterPath": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    "backdropPath": "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    "images": {
      "posters": [
        {
          "filePath": "/poster1.jpg",
          "width": 500,
          "height": 750
        }
      ],
      "backdrops": [
        {
          "filePath": "/backdrop1.jpg",
          "width": 1920,
          "height": 1080
        }
      ]
    },
    "videos": [
      {
        "id": "video-123",
        "key": "HhesaQXLuRY",
        "name": "Official Trailer",
        "site": "YouTube",
        "type": "Trailer",
        "official": true
      }
    ],
    "seasons": [
      {
        "id": 3572,
        "name": "Season 1",
        "overview": "High school chemistry teacher Walter White's life is suddenly transformed by a dire medical diagnosis.",
        "posterPath": "/season1.jpg",
        "seasonNumber": 1,
        "episodeCount": 7,
        "airDate": "2008-01-20"
      }
    ],
    "cast": [
      {
        "id": 17419,
        "name": "Bryan Cranston",
        "character": "Walter White",
        "profilePath": "/actor.jpg"
      }
    ],
    "crew": [
      {
        "id": 66633,
        "name": "Vince Gilligan",
        "job": "Creator",
        "department": "Writing",
        "profilePath": "/creator.jpg"
      }
    ],
    "availability": {
      "plex": {
        "available": true,
        "libraryId": "12345",
        "ratingKey": "67890",
        "libraryName": "TV Shows",
        "addedAt": "2023-01-01T00:00:00.000Z"
      },
      "overseerr": {
        "status": "available",
        "requestId": null,
        "mediaId": "overseerr-456"
      }
    },
    "watchProviders": {
      "US": {
        "link": "https://www.themoviedb.org/tv/1396-breaking-bad/watch?locale=US",
        "rent": [
          {
            "providerId": 2,
            "providerName": "Apple TV",
            "logoPath": "/provider.jpg"
          }
        ],
        "buy": [],
        "flatrate": [
          {
            "providerId": 8,
            "providerName": "Netflix",
            "logoPath": "/netflix.jpg"
          }
        ]
      }
    },
    "keywords": [
      {
        "id": 41525,
        "name": "drug dealer"
      }
    ],
    "externalIds": {
      "imdbId": "tt0903747",
      "tvdbId": "81189"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-details-123"
  }
}
```

## Media Requests

### Submit Media Request

Submit a request for media to be acquired and added to the media library.

```http
POST /api/v1/media/request
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Breaking Bad",
  "mediaType": "tv",
  "tmdbId": "1396",
  "overseerrId": "456"
}
```

#### Response

**Status:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "request-789",
    "title": "Breaking Bad",
    "mediaType": "tv",
    "tmdbId": "1396",
    "overseerrId": "456",
    "status": "pending",
    "priority": "normal",
    "requestedBy": {
      "id": "user-123",
      "plexUsername": "john_doe"
    },
    "requestedAt": "2024-01-01T00:00:00.000Z",
    "estimatedCompletion": "2024-01-02T00:00:00.000Z",
    "metadata": {
      "poster": "/poster.jpg",
      "overview": "Media overview...",
      "releaseDate": "2008-01-20",
      "genres": ["Crime", "Drama"]
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-submit-123"
  }
}
```

### Get User Requests

Retrieve all media requests submitted by the authenticated user.

```http
GET /api/v1/media/requests
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
```
?status=pending&page=1&limit=20
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | enum | No | Filter by status (`pending`, `approved`, `processing`, `completed`, `failed`) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "request-789",
      "title": "Breaking Bad",
      "mediaType": "tv",
      "tmdbId": "1396",
      "status": "processing",
      "priority": "normal",
      "requestedAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T06:00:00.000Z",
      "progress": {
        "percentage": 75,
        "currentStep": "downloading",
        "totalSteps": 4,
        "estimatedCompletion": "2024-01-01T08:00:00.000Z"
      },
      "metadata": {
        "poster": "/poster.jpg",
        "overview": "Media overview...",
        "seasons": [
          {
            "seasonNumber": 1,
            "status": "completed"
          },
          {
            "seasonNumber": 2,
            "status": "processing"
          }
        ]
      }
    }
  ],
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-list-123",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### Get Request Details

Retrieve detailed information about a specific media request.

```http
GET /api/v1/media/requests/:requestId
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requestId` | string | Yes | UUID of the media request |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "request-789",
    "title": "Breaking Bad",
    "mediaType": "tv",
    "tmdbId": "1396",
    "overseerrId": "456",
    "status": "processing",
    "priority": "high",
    "requestedBy": {
      "id": "user-123",
      "plexUsername": "john_doe",
      "email": "john@example.com"
    },
    "requestedAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T06:00:00.000Z",
    "approvedBy": {
      "id": "admin-456",
      "plexUsername": "admin_user"
    },
    "approvedAt": "2024-01-01T01:00:00.000Z",
    "progress": {
      "percentage": 75,
      "currentStep": "downloading",
      "totalSteps": 4,
      "steps": [
        {
          "name": "approval",
          "status": "completed",
          "completedAt": "2024-01-01T01:00:00.000Z"
        },
        {
          "name": "search",
          "status": "completed",
          "completedAt": "2024-01-01T02:00:00.000Z"
        },
        {
          "name": "downloading",
          "status": "in_progress",
          "progress": 75,
          "eta": "2024-01-01T08:00:00.000Z"
        },
        {
          "name": "import",
          "status": "pending"
        }
      ]
    },
    "logs": [
      {
        "timestamp": "2024-01-01T06:00:00.000Z",
        "level": "info",
        "message": "Download progress: 75%",
        "details": {
          "downloaded": "7.5 GB",
          "total": "10 GB",
          "speed": "15 MB/s"
        }
      }
    ],
    "seasonRequests": [
      {
        "seasonNumber": 1,
        "status": "completed",
        "completedAt": "2024-01-01T04:00:00.000Z"
      },
      {
        "seasonNumber": 2,
        "status": "processing",
        "progress": 50
      }
    ],
    "metadata": {
      "poster": "/poster.jpg",
      "backdrop": "/backdrop.jpg",
      "overview": "Media overview...",
      "releaseDate": "2008-01-20",
      "genres": ["Crime", "Drama"],
      "runtime": 47,
      "seasons": 5,
      "episodes": 62
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T06:30:00.000Z",
    "requestId": "req-detail-123"
  }
}
```

### Delete Media Request

Delete a pending media request (only allowed for pending requests).

```http
DELETE /api/v1/media/requests/:requestId
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requestId` | string | Yes | UUID of the media request |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Media request deleted successfully"
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-delete-123"
  }
}
```

## Data Models

### Media Item

```typescript
interface MediaItem {
  id: string;
  tmdbId: string;
  title: string;
  originalTitle?: string;
  overview: string;
  mediaType: 'movie' | 'tv';
  releaseDate: string;
  genres: string[] | Genre[];
  rating: number | RatingDetails;
  popularity: number;
  posterPath: string;
  backdropPath: string;
  status: 'available' | 'unavailable' | 'requested';
  availability: AvailabilityStatus;
}

interface Genre {
  id: number;
  name: string;
}

interface RatingDetails {
  tmdb?: number;
  imdb?: number;
  rottenTomatoes?: number;
}

interface AvailabilityStatus {
  plex: {
    available: boolean;
    libraryId?: string;
    ratingKey?: string;
    libraryName?: string;
    addedAt?: string;
  };
  overseerr: {
    status: 'available' | 'pending' | 'unavailable';
    requestId?: string;
    mediaId?: string;
  };
}
```

### Media Request

```typescript
interface MediaRequest {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  overseerrId?: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  requestedBy: UserInfo;
  requestedAt: string;
  updatedAt: string;
  approvedBy?: UserInfo;
  approvedAt?: string;
  completedAt?: string;
  progress?: ProgressInfo;
  metadata: MediaMetadata;
}

interface ProgressInfo {
  percentage: number;
  currentStep: string;
  totalSteps: number;
  steps: StepInfo[];
  estimatedCompletion?: string;
}

interface StepInfo {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  completedAt?: string;
  eta?: string;
}
```

## Error Handling

### Common Error Codes

| Code | Description | Status |
|------|-------------|---------|
| `MEDIA_NOT_FOUND` | Media item not found in database | 404 |
| `REQUEST_NOT_FOUND` | Media request not found | 404 |
| `REQUEST_ALREADY_EXISTS` | Media request already submitted | 409 |
| `REQUEST_NOT_DELETABLE` | Request cannot be deleted (not pending) | 400 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `SEARCH_QUERY_REQUIRED` | Search query parameter missing | 400 |
| `INVALID_MEDIA_TYPE` | Invalid media type parameter | 400 |

## Rate Limiting

Media API endpoints have the following rate limits:

- **Search**: 60 requests per minute per user
- **Media Details**: 120 requests per minute per user  
- **Submit Request**: 10 requests per hour per user
- **List Requests**: 60 requests per minute per user
- **Delete Request**: 20 requests per hour per user

## Examples

### Complete Media Request Flow

```javascript
async function requestMedia(query, mediaType = 'all') {
  try {
    // 1. Search for media
    const searchResponse = await fetch(
      `/api/v1/media/search?q=${encodeURIComponent(query)}&type=${mediaType}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      }
    );
    
    const searchResults = await searchResponse.json();
    
    if (!searchResults.success || searchResults.data.length === 0) {
      throw new Error('No media found');
    }
    
    const selectedMedia = searchResults.data[0];
    
    // 2. Check if already available
    if (selectedMedia.availability.plex.available) {
      console.log('Media already available in Plex');
      return selectedMedia;
    }
    
    // 3. Submit request
    const requestResponse = await fetch('/api/v1/media/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: selectedMedia.title,
        mediaType: selectedMedia.mediaType,
        tmdbId: selectedMedia.tmdbId
      })
    });
    
    const requestResult = await requestResponse.json();
    
    if (!requestResult.success) {
      throw new Error(requestResult.error.message);
    }
    
    console.log(`Media request submitted: ${requestResult.data.id}`);
    return requestResult.data;
    
  } catch (error) {
    console.error('Media request failed:', error);
    throw error;
  }
}

// Usage
requestMedia('Breaking Bad', 'tv')
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

### Monitor Request Progress

```javascript
async function monitorRequestProgress(requestId) {
  const pollInterval = 5000; // 5 seconds
  
  const poll = async () => {
    try {
      const response = await fetch(`/api/v1/media/requests/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error.message);
      }
      
      const request = result.data;
      console.log(`Request ${request.id}: ${request.status} (${request.progress?.percentage || 0}%)`);
      
      if (request.status === 'completed') {
        console.log('Request completed successfully!');
        return request;
      }
      
      if (request.status === 'failed') {
        throw new Error('Request failed');
      }
      
      // Continue polling
      setTimeout(poll, pollInterval);
      
    } catch (error) {
      console.error('Failed to check request status:', error);
    }
  };
  
  poll();
}
```