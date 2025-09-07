# Interactive API Documentation

Welcome to the MediaNest API interactive documentation! This page provides comprehensive information about all available endpoints, authentication methods, and real-world usage examples.

## 📊 OpenAPI Specification

Our complete API specification is available in OpenAPI 3.0 format:

- **[Enhanced OpenAPI Spec](openapi-enhanced.yaml)** - Complete specification with examples
- **[Original OpenAPI Spec](openapi.yaml)** - Legacy specification

## 🚀 Quick Start Guide

### 1. Authentication Flow

MediaNest uses Plex OAuth for authentication. Here's the complete flow:

```javascript
// Step 1: Generate a PIN
const pinResponse = await fetch('/api/v1/auth/plex/pin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientName: 'MediaNest',
  }),
});

const { data: pinData } = await pinResponse.json();
console.log('Visit this URL to authorize:', pinData.authUrl);

// Step 2: User authorizes on Plex
// Redirect user to pinData.authUrl or show them pinData.code

// Step 3: Verify the PIN (poll this until success)
const verifyResponse = await fetch('/api/v1/auth/plex/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    pinId: pinData.id,
    rememberMe: true,
  }),
});

if (verifyResponse.ok) {
  const { data: authData } = await verifyResponse.json();
  console.log('Authenticated as:', authData.user.username);
  // Authentication cookie is automatically set
}
```

### 2. Making Authenticated Requests

Once authenticated, all requests automatically include the session cookie:

```javascript
// Get current user session
const session = await fetch('/api/v1/auth/session', {
  credentials: 'include', // Important: include cookies
});

// Search for media
const searchResults = await fetch('/api/v1/media/search?q=avengers&type=movie', {
  credentials: 'include',
});

// Get Plex server info
const plexInfo = await fetch('/api/v1/plex/server', {
  credentials: 'include',
});
```

### 3. CSRF Protection

For state-changing operations (POST, PUT, DELETE), you need a CSRF token:

```javascript
// Get CSRF token
const csrfResponse = await fetch('/api/v1/csrf/token', {
  credentials: 'include',
});
const { data: csrfData } = await csrfResponse.json();

// Use token in protected requests
const requestResponse = await fetch('/api/v1/media/request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfData.token,
  },
  credentials: 'include',
  body: JSON.stringify({
    tmdbId: '299534',
    mediaType: 'movie',
    quality: '1080p',
    comment: 'Please add this awesome movie!',
  }),
});
```

## 📋 Common Use Cases

### Media Discovery Workflow

```javascript
class MediaNestClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
    this.csrfToken = null;
  }

  async init() {
    // Get CSRF token for later use
    const response = await fetch(`${this.baseUrl}/csrf/token`, {
      credentials: 'include',
    });
    const { data } = await response.json();
    this.csrfToken = data.token;
  }

  async searchMedia(query, type = 'all') {
    const params = new URLSearchParams({ q: query, type });
    const response = await fetch(`${this.baseUrl}/media/search?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getMediaDetails(mediaType, tmdbId) {
    const response = await fetch(`${this.baseUrl}/media/${mediaType}/${tmdbId}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async requestMedia(tmdbId, mediaType, quality = '1080p', comment = '') {
    const response = await fetch(`${this.baseUrl}/media/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ tmdbId, mediaType, quality, comment }),
    });
    return response.json();
  }

  async getMyRequests(status = null) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const response = await fetch(`${this.baseUrl}/media/requests?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }
}

// Usage example
const client = new MediaNestClient();
await client.init();

// Search for movies
const searchResults = await client.searchMedia('spider-man', 'movie');
console.log(`Found ${searchResults.data.results.length} results`);

// Get detailed info about first result
const firstMovie = searchResults.data.results[0];
const details = await client.getMediaDetails(firstMovie.type, firstMovie.id);

// Check if it's already available
if (!details.data.availability.plex && !details.data.availability.requested) {
  // Request it!
  const request = await client.requestMedia(
    firstMovie.id,
    firstMovie.type,
    '1080p',
    'Looks like a great movie!'
  );
  console.log('Request submitted:', request.data.id);
}
```

### Plex Library Management

```javascript
class PlexExplorer {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  async getServerInfo() {
    const response = await fetch(`${this.baseUrl}/plex/server`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getLibraries() {
    const response = await fetch(`${this.baseUrl}/plex/libraries`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getLibraryItems(libraryKey, options = {}) {
    const params = new URLSearchParams({
      page: options.page || 1,
      limit: options.limit || 50,
      sort: options.sort || 'addedAt:desc',
      ...options,
    });

    const response = await fetch(`${this.baseUrl}/plex/libraries/${libraryKey}/items?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async searchPlex(query) {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${this.baseUrl}/plex/search?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getRecentlyAdded(limit = 20) {
    const params = new URLSearchParams({ limit: limit.toString() });
    const response = await fetch(`${this.baseUrl}/plex/recently-added?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getCollections(libraryKey) {
    const response = await fetch(`${this.baseUrl}/plex/libraries/${libraryKey}/collections`, {
      credentials: 'include',
    });
    return response.json();
  }
}

// Usage example
const plex = new PlexExplorer();

// Get server overview
const serverInfo = await plex.getServerInfo();
console.log(`Connected to: ${serverInfo.data.name} v${serverInfo.data.version}`);

// Browse all libraries
const libraries = await plex.getLibraries();
for (const library of libraries.data.libraries) {
  console.log(`${library.title} (${library.type}): ${library.count} items`);

  // Get recent items from this library
  const recentItems = await plex.getLibraryItems(library.key, {
    limit: 10,
    sort: 'addedAt:desc',
  });

  console.log(`  Recent additions:`);
  recentItems.data.items.forEach((item) => {
    console.log(`    - ${item.title} (${item.year || 'N/A'})`);
  });
}

// Search across all libraries
const searchResults = await plex.searchPlex('matrix');
console.log(`Found ${searchResults.data.totalResults} items matching 'matrix'`);
```

### YouTube Download Management

```javascript
class YouTubeDownloader {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
    this.csrfToken = null;
  }

  async init() {
    const response = await fetch(`${this.baseUrl}/csrf/token`, {
      credentials: 'include',
    });
    const { data } = await response.json();
    this.csrfToken = data.token;
  }

  async getVideoMetadata(url) {
    const params = new URLSearchParams({ url });
    const response = await fetch(`${this.baseUrl}/youtube/metadata?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async startDownload(url, quality = '720p', format = 'mp4') {
    const response = await fetch(`${this.baseUrl}/youtube/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ url, quality, format }),
    });
    return response.json();
  }

  async getDownloads(status = null) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const response = await fetch(`${this.baseUrl}/youtube/downloads?${params}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async getDownloadDetails(downloadId) {
    const response = await fetch(`${this.baseUrl}/youtube/downloads/${downloadId}`, {
      credentials: 'include',
    });
    return response.json();
  }

  async cancelDownload(downloadId) {
    const response = await fetch(`${this.baseUrl}/youtube/downloads/${downloadId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': this.csrfToken,
      },
      credentials: 'include',
    });
    return response.json();
  }

  // Poll for download progress
  async monitorDownload(downloadId, onProgress) {
    const poll = async () => {
      const response = await this.getDownloadDetails(downloadId);
      if (response.success) {
        const download = response.data;
        onProgress(download);

        if (download.status === 'downloading' || download.status === 'queued') {
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
      }
    };

    poll();
  }
}

// Usage example
const downloader = new YouTubeDownloader();
await downloader.init();

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// Get video info first
const metadata = await downloader.getVideoMetadata(videoUrl);
console.log(`Video: ${metadata.data.title}`);
console.log(`Duration: ${Math.floor(metadata.data.duration / 60)}:${metadata.data.duration % 60}`);
console.log(`Uploader: ${metadata.data.uploader}`);

// Start download
const download = await downloader.startDownload(videoUrl, '1080p', 'mp4');
if (download.success) {
  console.log(`Download started: ${download.data.id}`);

  // Monitor progress
  downloader.monitorDownload(download.data.id, (download) => {
    console.log(`Progress: ${download.progress || 0}% - ${download.status}`);
    if (download.speed) console.log(`Speed: ${download.speed}`);
    if (download.eta) console.log(`ETA: ${download.eta}`);

    if (download.status === 'completed') {
      console.log(`Download complete! File: ${download.outputPath}`);
    } else if (download.status === 'failed') {
      console.error(`Download failed: ${download.error}`);
    }
  });
}
```

## 🎯 Advanced Features

### Real-time WebSocket Integration

```javascript
class MediaNestWebSocket {
  constructor(baseUrl = 'ws://localhost:4000') {
    this.baseUrl = baseUrl;
    this.socket = null;
    this.eventHandlers = new Map();
  }

  connect() {
    this.socket = new WebSocket(this.baseUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const handlers = this.eventHandlers.get(data.type) || [];
      handlers.forEach((handler) => handler(data));
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Auto-reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000);
    };
  }

  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  off(eventType, handler) {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }
}

// Usage
const ws = new MediaNestWebSocket();

// Listen for service status updates
ws.on('service:status', (data) => {
  console.log(`Service ${data.service} is now ${data.status}`);
  updateServiceIndicator(data.service, data.status);
});

// Listen for request status changes
ws.on('request:update', (data) => {
  console.log(`Request ${data.requestId} status: ${data.status}`);
  updateRequestStatus(data.requestId, data.status);
});

// Listen for download progress
ws.on('download:progress', (data) => {
  console.log(`Download ${data.downloadId}: ${data.progress}%`);
  updateProgressBar(data.downloadId, data.progress);
});

// Listen for user notifications
ws.on('user:notification', (data) => {
  console.log(`New notification: ${data.title}`);
  showNotification(data.title, data.message, data.type);
});

ws.connect();
```

### Error Handling Best Practices

```javascript
class APIError extends Error {
  constructor(response, data) {
    super(data?.error?.message || 'API request failed');
    this.name = 'APIError';
    this.status = response.status;
    this.code = data?.error?.code;
    this.details = data?.error?.details;
    this.correlationId = data?.correlationId;
  }
}

async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new APIError(response, data);
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      // Handle specific API errors
      switch (error.code) {
        case 'UNAUTHORIZED':
          console.log('Session expired, redirecting to login...');
          window.location.href = '/login';
          break;

        case 'RATE_LIMIT_EXCEEDED':
          console.log(`Rate limited. Retry after: ${response.headers.get('Retry-After')}s`);
          break;

        case 'VALIDATION_ERROR':
          console.error('Validation failed:', error.details);
          break;

        default:
          console.error('API Error:', error.message);
      }

      throw error;
    } else {
      // Network or other errors
      console.error('Network error:', error.message);
      throw error;
    }
  }
}

// Usage with retry logic
async function robustAPICall(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiRequest(url, options);
    } catch (error) {
      if (error instanceof APIError) {
        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Don't retry on rate limits
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

## 🔧 Testing Your Integration

### Unit Testing with Jest

```javascript
// __tests__/medianest-client.test.js
import { MediaNestClient } from '../src/medianest-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('MediaNestClient', () => {
  let client;

  beforeEach(() => {
    client = new MediaNestClient();
    fetch.mockClear();
  });

  test('should search for media successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        results: [
          {
            id: '299534',
            title: 'Avengers: Endgame',
            type: 'movie',
            year: 2019,
          },
        ],
        pagination: {
          page: 1,
          totalPages: 1,
          totalItems: 1,
        },
      },
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await client.searchMedia('avengers', 'movie');

    expect(fetch).toHaveBeenCalledWith('/api/v1/media/search?q=avengers&type=movie', {
      credentials: 'include',
    });
    expect(result).toEqual(mockResponse);
    expect(result.data.results[0].title).toBe('Avengers: Endgame');
  });

  test('should handle API errors gracefully', async () => {
    const mockError = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Query parameter is required',
      },
    };

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => mockError,
    });

    await expect(client.searchMedia('')).rejects.toThrow('Query parameter is required');
  });
});
```

### Integration Testing

```javascript
// __tests__/integration.test.js
describe('MediaNest API Integration', () => {
  const baseUrl = process.env.TEST_API_URL || 'http://localhost:4000/api/v1';
  let authCookie = '';

  beforeAll(async () => {
    // Authenticate for tests
    const pinResponse = await fetch(`${baseUrl}/auth/plex/pin`, {
      method: 'POST',
    });
    const pinData = await pinResponse.json();

    // In real tests, you'd have a test Plex account
    // For now, we'll use a mock or skip auth-required tests
  });

  test('health check should return healthy status', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.status).toBe('healthy');
  });

  test('unauthenticated requests should require auth', async () => {
    const response = await fetch(`${baseUrl}/media/search?q=test`);

    expect(response.status).toBe(401);
  });
});
```

## 📖 API Reference Quick Links

### Authentication

- [`POST /auth/plex/pin`](openapi-enhanced.yaml#/paths/~1auth~1plex~1pin) - Generate Plex PIN
- [`POST /auth/plex/verify`](openapi-enhanced.yaml#/paths/~1auth~1plex~1verify) - Verify PIN and login
- [`GET /auth/session`](openapi-enhanced.yaml#/paths/~1auth~1session) - Get current session
- [`POST /auth/logout`](openapi-enhanced.yaml#/paths/~1auth~1logout) - Logout user

### Media Management

- [`GET /media/search`](openapi-enhanced.yaml#/paths/~1media~1search) - Search TMDB
- [`GET /media/{mediaType}/{tmdbId}`](openapi-enhanced.yaml#/paths/~1media~1{mediaType}~1{tmdbId}) - Get media details
- [`POST /media/request`](openapi-enhanced.yaml#/paths/~1media~1request) - Request media
- [`GET /media/requests`](openapi-enhanced.yaml#/paths/~1media~1requests) - Get user requests

### Plex Integration

- [`GET /plex/server`](openapi-enhanced.yaml#/paths/~1plex~1server) - Server information
- [`GET /plex/libraries`](openapi-enhanced.yaml#/paths/~1plex~1libraries) - List libraries
- [`GET /plex/libraries/{libraryKey}/items`](openapi-enhanced.yaml#/paths/~1plex~1libraries~1{libraryKey}~1items) - Library items
- [`GET /plex/search`](openapi-enhanced.yaml#/paths/~1plex~1search) - Search Plex content

### YouTube Downloads

- [`POST /youtube/download`](openapi-enhanced.yaml#/paths/~1youtube~1download) - Start download
- [`GET /youtube/downloads`](openapi-enhanced.yaml#/paths/~1youtube~1downloads) - Download history
- [`GET /youtube/metadata`](openapi-enhanced.yaml#/paths/~1youtube~1metadata) - Get video info

### Administration

- [`GET /admin/users`](openapi-enhanced.yaml#/paths/~1admin~1users) - Manage users
- [`GET /admin/stats`](openapi-enhanced.yaml#/paths/~1admin~1stats) - System statistics
- [`GET /admin/services`](openapi-enhanced.yaml#/paths/~1admin~1services) - Service status

## 🎉 Getting Help

- **API Issues**: Check the error response `correlationId` for debugging
- **Rate Limits**: See response headers for limit information
- **WebSocket Events**: Connect to the same host on port 4000
- **CSRF Tokens**: Required for all state-changing operations

## 🔗 Related Resources

- [API Reference](API_REFERENCE.md) - Detailed endpoint documentation
- [Authentication Guide](authentication-flow.md) - Complete auth flow
- [API Workflows](api-workflows.md) - Common usage patterns
- [OpenAPI Specification](openapi-enhanced.yaml) - Machine-readable API spec
