# API Client Examples

This page provides comprehensive examples for integrating with the MediaNest API using various programming languages and frameworks. Each example includes authentication, error handling, and real-world usage scenarios.

## 🌐 JavaScript/TypeScript Client

### Full-Featured TypeScript Client

```typescript
// medianest-client.ts
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  correlationId?: string;
}

interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  year?: number;
  poster?: string;
  overview?: string;
  genres: string[];
  rating?: number;
  availability: {
    plex: boolean;
    requested: boolean;
    plexUrl?: string;
  };
}

interface PaginationInfo {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface MediaSearchResult {
  results: MediaItem[];
  pagination: PaginationInfo;
}

interface MediaRequest {
  id: string;
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled' | 'available';
  quality: string;
  comment?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

class APIError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: string;
  public readonly correlationId?: string;

  constructor(response: Response, data: APIResponse) {
    super(data.error?.message || 'API request failed');
    this.name = 'APIError';
    this.status = response.status;
    this.code = data.error?.code;
    this.details = data.error?.details;
    this.correlationId = data.correlationId;
  }
}

export class MediaNestClient {
  private baseUrl: string;
  private csrfToken: string | null = null;
  private sessionValid: boolean = false;

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Initialize the client by fetching a CSRF token
   */
  async init(): Promise<void> {
    try {
      const response = await this.request<{ token: string; expiresIn: number }>(
        'GET',
        '/csrf/token'
      );
      this.csrfToken = response.data.token;
    } catch (error) {
      console.warn('Failed to initialize CSRF token:', error);
      // Continue without CSRF token for read-only operations
    }
  }

  /**
   * Make an authenticated API request
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    headers: Record<string, string> = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      method,
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    // Add CSRF token for state-changing operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && this.csrfToken) {
      config.headers = {
        ...config.headers,
        'X-CSRF-Token': this.csrfToken,
      };
    }

    // Add request body for non-GET requests
    if (data && method.toUpperCase() !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const responseData: APIResponse<T> = await response.json();

      if (!response.ok) {
        throw new APIError(response, responseData);
      }

      return responseData;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      // Network or other errors
      throw new Error(`Network request failed: ${error.message}`);
    }
  }

  // Authentication Methods

  /**
   * Generate a Plex PIN for OAuth authentication
   */
  async generatePlexPin(): Promise<
    APIResponse<{
      id: string;
      code: string;
      authUrl: string;
      qrUrl: string;
      expiresIn: number;
    }>
  > {
    return this.request('POST', '/auth/plex/pin', { clientName: 'MediaNest Client' });
  }

  /**
   * Verify Plex PIN and authenticate
   */
  async verifyPlexPin(
    pinId: string,
    rememberMe: boolean = false
  ): Promise<
    APIResponse<{
      user: any;
      csrfToken: string;
    }>
  > {
    const response = await this.request('POST', '/auth/plex/verify', { pinId, rememberMe });

    if (response.success && response.data.csrfToken) {
      this.csrfToken = response.data.csrfToken;
      this.sessionValid = true;
    }

    return response;
  }

  /**
   * Get current session information
   */
  async getSession(): Promise<APIResponse<{ user: any; expiresAt: string }>> {
    const response = await this.request('GET', '/auth/session');
    this.sessionValid = response.success;
    return response;
  }

  /**
   * Logout current user
   */
  async logout(): Promise<APIResponse> {
    const response = await this.request('POST', '/auth/logout');
    if (response.success) {
      this.sessionValid = false;
      this.csrfToken = null;
    }
    return response;
  }

  // Media Methods

  /**
   * Search for media using TMDB
   */
  async searchMedia(
    query: string,
    type: 'movie' | 'tv' | 'all' = 'all',
    page: number = 1,
    limit: number = 20
  ): Promise<APIResponse<MediaSearchResult>> {
    const params = new URLSearchParams({
      q: query,
      type,
      page: page.toString(),
      limit: limit.toString(),
    });

    return this.request('GET', `/media/search?${params}`);
  }

  /**
   * Get detailed media information
   */
  async getMediaDetails(
    mediaType: 'movie' | 'tv',
    tmdbId: string
  ): Promise<
    APIResponse<
      MediaItem & {
        cast: any[];
        crew: any[];
        videos: any[];
        recommendations: MediaItem[];
      }
    >
  > {
    return this.request('GET', `/media/${mediaType}/${tmdbId}`);
  }

  /**
   * Submit a media request
   */
  async requestMedia(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    quality: string = '1080p',
    comment?: string
  ): Promise<APIResponse<MediaRequest>> {
    return this.request('POST', '/media/request', {
      tmdbId,
      mediaType,
      quality,
      comment,
    });
  }

  /**
   * Get user's media requests
   */
  async getMyRequests(
    status?: 'pending' | 'approved' | 'denied' | 'cancelled' | 'available',
    page: number = 1,
    limit: number = 20
  ): Promise<APIResponse<{ requests: MediaRequest[]; pagination: PaginationInfo }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) {
      params.append('status', status);
    }

    return this.request('GET', `/media/requests?${params}`);
  }

  /**
   * Get specific request details
   */
  async getRequestDetails(requestId: string): Promise<
    APIResponse<
      MediaRequest & {
        statusHistory: any[];
        media: any;
      }
    >
  > {
    return this.request('GET', `/media/requests/${requestId}`);
  }

  /**
   * Cancel a pending media request
   */
  async cancelRequest(requestId: string): Promise<APIResponse> {
    return this.request('DELETE', `/media/requests/${requestId}`);
  }

  // Plex Methods

  /**
   * Get Plex server information
   */
  async getPlexServer(): Promise<
    APIResponse<{
      name: string;
      version: string;
      platform: string;
      libraries: number;
      users: number;
    }>
  > {
    return this.request('GET', '/plex/server');
  }

  /**
   * Get all Plex libraries
   */
  async getPlexLibraries(): Promise<APIResponse<{ libraries: any[] }>> {
    return this.request('GET', '/plex/libraries');
  }

  /**
   * Get items from a Plex library
   */
  async getPlexLibraryItems(
    libraryKey: string,
    options: {
      page?: number;
      limit?: number;
      sort?: string;
      filter?: string;
      type?: string;
    } = {}
  ): Promise<APIResponse<{ items: any[]; pagination: PaginationInfo }>> {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 50).toString(),
      sort: options.sort || 'addedAt:desc',
    });

    if (options.filter) params.append('filter', options.filter);
    if (options.type) params.append('type', options.type);

    return this.request('GET', `/plex/libraries/${libraryKey}/items?${params}`);
  }

  /**
   * Search Plex content
   */
  async searchPlex(
    query: string,
    type?: 'movie' | 'show' | 'episode' | 'all',
    limit: number = 20
  ): Promise<APIResponse<{ results: any[]; totalResults: number }>> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    if (type) params.append('type', type);

    return this.request('GET', `/plex/search?${params}`);
  }

  /**
   * Get recently added items from Plex
   */
  async getRecentlyAdded(
    limit: number = 20,
    type?: 'movie' | 'show' | 'episode' | 'all'
  ): Promise<APIResponse<{ items: any[] }>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (type) params.append('type', type);

    return this.request('GET', `/plex/recently-added?${params}`);
  }

  // YouTube Methods

  /**
   * Get YouTube video metadata
   */
  async getYouTubeMetadata(url: string): Promise<
    APIResponse<{
      title: string;
      duration: number;
      thumbnail: string;
      uploader: string;
      formats: any[];
    }>
  > {
    const params = new URLSearchParams({ url });
    return this.request('GET', `/youtube/metadata?${params}`);
  }

  /**
   * Start a YouTube download
   */
  async startYouTubeDownload(
    url: string,
    quality: string = '720p',
    format: string = 'mp4'
  ): Promise<
    APIResponse<{
      id: string;
      url: string;
      title?: string;
      status: string;
      quality: string;
      format: string;
    }>
  > {
    return this.request('POST', '/youtube/download', { url, quality, format });
  }

  /**
   * Get YouTube download history
   */
  async getYouTubeDownloads(
    status?: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled',
    page: number = 1,
    limit: number = 20
  ): Promise<APIResponse<{ downloads: any[]; pagination: PaginationInfo }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) params.append('status', status);

    return this.request('GET', `/youtube/downloads?${params}`);
  }

  /**
   * Get download details and progress
   */
  async getDownloadDetails(downloadId: string): Promise<
    APIResponse<{
      id: string;
      progress: number;
      status: string;
      speed?: string;
      eta?: string;
      error?: string;
    }>
  > {
    return this.request('GET', `/youtube/downloads/${downloadId}`);
  }

  /**
   * Cancel/delete a download
   */
  async cancelDownload(downloadId: string): Promise<APIResponse> {
    return this.request('DELETE', `/youtube/downloads/${downloadId}`);
  }

  // Dashboard Methods

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<
    APIResponse<{
      summary: any;
      recentActivity: any[];
      quickStats: any;
    }>
  > {
    return this.request('GET', '/dashboard/stats');
  }

  /**
   * Get service statuses
   */
  async getServiceStatuses(): Promise<
    APIResponse<{
      services: any[];
      overall: any;
    }>
  > {
    return this.request('GET', '/dashboard/status');
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    unread: boolean = false,
    limit: number = 10
  ): Promise<
    APIResponse<{
      notifications: any[];
      unreadCount: number;
    }>
  > {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (unread) params.append('unread', 'true');

    return this.request('GET', `/dashboard/notifications?${params}`);
  }

  // Utility Methods

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.sessionValid;
  }

  /**
   * Refresh CSRF token
   */
  async refreshCSRFToken(): Promise<void> {
    const response = await this.request<{ token: string }>('POST', '/csrf/refresh');
    this.csrfToken = response.data.token;
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<
    APIResponse<{
      status: string;
      service: string;
      version: string;
      uptime: number;
    }>
  > {
    return this.request('GET', '/health');
  }
}

// Usage example
async function example() {
  const client = new MediaNestClient('http://localhost:4000/api/v1');

  try {
    // Initialize client
    await client.init();

    // Check if already authenticated
    try {
      const session = await client.getSession();
      console.log('Already authenticated as:', session.data.user.username);
    } catch (error) {
      // Need to authenticate
      console.log('Authentication required');

      const pinResponse = await client.generatePlexPin();
      console.log('Visit this URL to authenticate:', pinResponse.data.authUrl);
      console.log('PIN Code:', pinResponse.data.code);

      // Poll for verification (in real app, you'd do this differently)
      // const verified = await client.verifyPlexPin(pinResponse.data.id);
    }

    // Search for media
    const searchResults = await client.searchMedia('spider-man', 'movie');
    console.log(`Found ${searchResults.data.results.length} movies`);

    // Get Plex server info
    const plexServer = await client.getPlexServer();
    console.log(`Connected to: ${plexServer.data.name}`);
  } catch (error) {
    if (error instanceof APIError) {
      console.error(`API Error (${error.code}):`, error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}
```

### React Hook Integration

```typescript
// useMediaNest.ts - React hook for MediaNest API
import { useState, useEffect, useContext, createContext } from 'react';
import { MediaNestClient, APIError } from './medianest-client';

interface MediaNestContextType {
  client: MediaNestClient;
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
  error: string | null;
}

const MediaNestContext = createContext<MediaNestContextType | null>(null);

export const MediaNestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client] = useState(() => new MediaNestClient());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeClient = async () => {
      try {
        await client.init();

        // Check if already authenticated
        const session = await client.getSession();
        setIsAuthenticated(true);
        setUser(session.data.user);
      } catch (error) {
        setIsAuthenticated(false);
        setUser(null);
        if (error instanceof APIError && error.code !== 'UNAUTHORIZED') {
          setError(error.message);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeClient();
  }, [client]);

  const value = {
    client,
    isAuthenticated,
    user,
    loading,
    error,
  };

  return <MediaNestContext.Provider value={value}>{children}</MediaNestContext.Provider>;
};

export const useMediaNest = () => {
  const context = useContext(MediaNestContext);
  if (!context) {
    throw new Error('useMediaNest must be used within a MediaNestProvider');
  }
  return context;
};

// Custom hooks for specific functionality
export const useMediaSearch = () => {
  const { client } = useMediaNest();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMedia = async (query: string, type: 'movie' | 'tv' | 'all' = 'all') => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await client.searchMedia(query, type);
      setResults(response.data.results);
    } catch (error) {
      setError(error instanceof APIError ? error.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, searchMedia };
};

export const useMediaRequests = () => {
  const { client } = useMediaNest();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async (status?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.getMyRequests(status as any);
      setRequests(response.data.requests);
    } catch (error) {
      setError(error instanceof APIError ? error.message : 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const requestMedia = async (
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    quality?: string,
    comment?: string
  ) => {
    try {
      const response = await client.requestMedia(tmdbId, mediaType, quality, comment);
      await fetchRequests(); // Refresh the list
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return { requests, loading, error, fetchRequests, requestMedia };
};

// Usage in React component
const MediaSearchComponent: React.FC = () => {
  const { results, loading, error, searchMedia } = useMediaSearch();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchMedia(query);
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for movies or TV shows..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="results">
        {results.map((item: any) => (
          <div key={item.id} className="media-item">
            <h3>{item.title}</h3>
            <p>{item.overview}</p>
            <p>Year: {item.year}</p>
            <p>Rating: {item.rating}/10</p>
            {item.availability.plex ? (
              <span>✓ Available in Plex</span>
            ) : (
              <button onClick={() => requestMedia(item.id, item.type)}>Request</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 🐍 Python Client

```python
# medianest_client.py
import requests
import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from dataclasses import dataclass

@dataclass
class APIResponse:
    success: bool
    data: Any = None
    error: Dict[str, Any] = None
    correlation_id: str = None

class MediaNestError(Exception):
    def __init__(self, message: str, status_code: int = None, error_code: str = None, correlation_id: str = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.correlation_id = correlation_id

class MediaNestClient:
    def __init__(self, base_url: str = "http://localhost:4000/api/v1"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.csrf_token: Optional[str] = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def close(self):
        """Close the session"""
        self.session.close()

    def _make_request(self, method: str, endpoint: str, data: Any = None, params: Dict[str, Any] = None) -> APIResponse:
        """Make an HTTP request to the API"""
        url = f"{self.base_url}{endpoint}"

        headers = {'Content-Type': 'application/json'}

        # Add CSRF token for state-changing operations
        if method.upper() in ['POST', 'PUT', 'PATCH', 'DELETE'] and self.csrf_token:
            headers['X-CSRF-Token'] = self.csrf_token

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=headers,
                timeout=30
            )

            # Parse JSON response
            try:
                json_data = response.json()
            except json.JSONDecodeError:
                json_data = {'success': False, 'error': {'message': 'Invalid JSON response'}}

            # Handle errors
            if not response.ok:
                error_msg = json_data.get('error', {}).get('message', f'HTTP {response.status_code}')
                error_code = json_data.get('error', {}).get('code', 'UNKNOWN_ERROR')
                correlation_id = json_data.get('correlationId')

                raise MediaNestError(
                    message=error_msg,
                    status_code=response.status_code,
                    error_code=error_code,
                    correlation_id=correlation_id
                )

            return APIResponse(
                success=json_data.get('success', True),
                data=json_data.get('data'),
                error=json_data.get('error'),
                correlation_id=json_data.get('correlationId')
            )

        except requests.RequestException as e:
            raise MediaNestError(f"Network request failed: {str(e)}")

    def init(self):
        """Initialize the client by getting a CSRF token"""
        try:
            response = self._make_request('GET', '/csrf/token')
            self.csrf_token = response.data['token']
        except MediaNestError as e:
            if e.status_code != 401:  # Ignore auth errors for public endpoints
                print(f"Warning: Failed to get CSRF token: {e}")

    # Authentication methods
    def generate_plex_pin(self, client_name: str = "MediaNest Python Client") -> Dict[str, Any]:
        """Generate a Plex PIN for OAuth authentication"""
        response = self._make_request('POST', '/auth/plex/pin', {'clientName': client_name})
        return response.data

    def verify_plex_pin(self, pin_id: str, remember_me: bool = False) -> Dict[str, Any]:
        """Verify Plex PIN and authenticate"""
        response = self._make_request('POST', '/auth/plex/verify', {
            'pinId': pin_id,
            'rememberMe': remember_me
        })

        if response.success and 'csrfToken' in response.data:
            self.csrf_token = response.data['csrfToken']

        return response.data

    def get_session(self) -> Dict[str, Any]:
        """Get current session information"""
        response = self._make_request('GET', '/auth/session')
        return response.data

    def logout(self) -> bool:
        """Logout current user"""
        response = self._make_request('POST', '/auth/logout')
        if response.success:
            self.csrf_token = None
        return response.success

    # Media methods
    def search_media(self, query: str, media_type: str = 'all', page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Search for media using TMDB"""
        params = {
            'q': query,
            'type': media_type,
            'page': page,
            'limit': limit
        }
        response = self._make_request('GET', '/media/search', params=params)
        return response.data

    def get_media_details(self, media_type: str, tmdb_id: str) -> Dict[str, Any]:
        """Get detailed media information"""
        response = self._make_request('GET', f'/media/{media_type}/{tmdb_id}')
        return response.data

    def request_media(self, tmdb_id: str, media_type: str, quality: str = '1080p', comment: str = None) -> Dict[str, Any]:
        """Submit a media request"""
        data = {
            'tmdbId': tmdb_id,
            'mediaType': media_type,
            'quality': quality
        }
        if comment:
            data['comment'] = comment

        response = self._make_request('POST', '/media/request', data)
        return response.data

    def get_my_requests(self, status: str = None, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Get user's media requests"""
        params = {'page': page, 'limit': limit}
        if status:
            params['status'] = status

        response = self._make_request('GET', '/media/requests', params=params)
        return response.data

    def cancel_request(self, request_id: str) -> bool:
        """Cancel a pending media request"""
        response = self._make_request('DELETE', f'/media/requests/{request_id}')
        return response.success

    # Plex methods
    def get_plex_server(self) -> Dict[str, Any]:
        """Get Plex server information"""
        response = self._make_request('GET', '/plex/server')
        return response.data

    def get_plex_libraries(self) -> List[Dict[str, Any]]:
        """Get all Plex libraries"""
        response = self._make_request('GET', '/plex/libraries')
        return response.data['libraries']

    def get_plex_library_items(self, library_key: str, page: int = 1, limit: int = 50, sort: str = 'addedAt:desc') -> Dict[str, Any]:
        """Get items from a Plex library"""
        params = {
            'page': page,
            'limit': limit,
            'sort': sort
        }
        response = self._make_request('GET', f'/plex/libraries/{library_key}/items', params=params)
        return response.data

    def search_plex(self, query: str, media_type: str = 'all', limit: int = 20) -> Dict[str, Any]:
        """Search Plex content"""
        params = {
            'q': query,
            'limit': limit
        }
        if media_type != 'all':
            params['type'] = media_type

        response = self._make_request('GET', '/plex/search', params=params)
        return response.data

    def get_recently_added(self, limit: int = 20, media_type: str = 'all') -> List[Dict[str, Any]]:
        """Get recently added items from Plex"""
        params = {'limit': limit}
        if media_type != 'all':
            params['type'] = media_type

        response = self._make_request('GET', '/plex/recently-added', params=params)
        return response.data['items']

    # YouTube methods
    def get_youtube_metadata(self, url: str) -> Dict[str, Any]:
        """Get YouTube video metadata"""
        params = {'url': url}
        response = self._make_request('GET', '/youtube/metadata', params=params)
        return response.data

    def start_youtube_download(self, url: str, quality: str = '720p', format: str = 'mp4') -> Dict[str, Any]:
        """Start a YouTube download"""
        data = {
            'url': url,
            'quality': quality,
            'format': format
        }
        response = self._make_request('POST', '/youtube/download', data)
        return response.data

    def get_youtube_downloads(self, status: str = None, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """Get YouTube download history"""
        params = {'page': page, 'limit': limit}
        if status:
            params['status'] = status

        response = self._make_request('GET', '/youtube/downloads', params=params)
        return response.data

    def get_download_details(self, download_id: str) -> Dict[str, Any]:
        """Get download details and progress"""
        response = self._make_request('GET', f'/youtube/downloads/{download_id}')
        return response.data

    def cancel_download(self, download_id: str) -> bool:
        """Cancel/delete a download"""
        response = self._make_request('DELETE', f'/youtube/downloads/{download_id}')
        return response.success

    # Dashboard methods
    def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get dashboard statistics"""
        response = self._make_request('GET', '/dashboard/stats')
        return response.data

    def get_service_statuses(self) -> Dict[str, Any]:
        """Get service statuses"""
        response = self._make_request('GET', '/dashboard/status')
        return response.data

    def get_notifications(self, unread: bool = False, limit: int = 10) -> Dict[str, Any]:
        """Get user notifications"""
        params = {'limit': limit}
        if unread:
            params['unread'] = 'true'

        response = self._make_request('GET', '/dashboard/notifications', params=params)
        return response.data

    # Utility methods
    def get_health(self) -> Dict[str, Any]:
        """Get system health status"""
        response = self._make_request('GET', '/health')
        return response.data


# Usage example
def main():
    with MediaNestClient() as client:
        try:
            # Initialize client
            client.init()

            # Check health
            health = client.get_health()
            print(f"API Status: {health['status']}")

            # Try to get session (will fail if not authenticated)
            try:
                session = client.get_session()
                print(f"Authenticated as: {session['user']['username']}")
            except MediaNestError as e:
                if e.error_code == 'UNAUTHORIZED':
                    print("Authentication required")

                    # Generate PIN
                    pin_data = client.generate_plex_pin()
                    print(f"Visit: {pin_data['authUrl']}")
                    print(f"PIN: {pin_data['code']}")

                    # In real app, you'd wait for user to authorize
                    # pin_id = pin_data['id']
                    # client.verify_plex_pin(pin_id)
                else:
                    raise

            # Search for media
            results = client.search_media('spider-man', 'movie', limit=5)
            print(f"Found {len(results['results'])} movies")

            for movie in results['results']:
                print(f"- {movie['title']} ({movie.get('year', 'N/A')})")
                print(f"  Available in Plex: {movie['availability']['plex']}")
                print(f"  Already requested: {movie['availability']['requested']}")

            # Get Plex server info
            try:
                plex_info = client.get_plex_server()
                print(f"Plex Server: {plex_info['name']} v{plex_info['version']}")
            except MediaNestError as e:
                print(f"Plex unavailable: {e}")

        except MediaNestError as e:
            print(f"API Error ({e.error_code}): {e}")
        except Exception as e:
            print(f"Unexpected error: {e}")

if __name__ == "__main__":
    main()
```

## 🔗 PHP Client

```php
<?php
// MediaNestClient.php

class MediaNestError extends Exception {
    public $statusCode;
    public $errorCode;
    public $correlationId;

    public function __construct($message, $statusCode = null, $errorCode = null, $correlationId = null) {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->errorCode = $errorCode;
        $this->correlationId = $correlationId;
    }
}

class MediaNestClient {
    private $baseUrl;
    private $cookieJar;
    private $csrfToken;
    private $curl;

    public function __construct($baseUrl = 'http://localhost:4000/api/v1') {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->cookieJar = tempnam(sys_get_temp_dir(), 'medianest_cookies');
        $this->csrfToken = null;
        $this->initCurl();
    }

    public function __destruct() {
        if ($this->curl) {
            curl_close($this->curl);
        }
        if (file_exists($this->cookieJar)) {
            unlink($this->cookieJar);
        }
    }

    private function initCurl() {
        $this->curl = curl_init();
        curl_setopt($this->curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($this->curl, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($this->curl, CURLOPT_COOKIEJAR, $this->cookieJar);
        curl_setopt($this->curl, CURLOPT_COOKIEFILE, $this->cookieJar);
        curl_setopt($this->curl, CURLOPT_TIMEOUT, 30);
        curl_setopt($this->curl, CURLOPT_USERAGENT, 'MediaNest PHP Client/1.0');
    }

    private function makeRequest($method, $endpoint, $data = null) {
        $url = $this->baseUrl . $endpoint;

        curl_setopt($this->curl, CURLOPT_URL, $url);
        curl_setopt($this->curl, CURLOPT_CUSTOMREQUEST, $method);

        $headers = ['Content-Type: application/json'];

        // Add CSRF token for state-changing operations
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE']) && $this->csrfToken) {
            $headers[] = 'X-CSRF-Token: ' . $this->csrfToken;
        }

        curl_setopt($this->curl, CURLOPT_HTTPHEADER, $headers);

        // Add request body for non-GET requests
        if ($data !== null && $method !== 'GET') {
            curl_setopt($this->curl, CURLOPT_POSTFIELDS, json_encode($data));
        } else {
            curl_setopt($this->curl, CURLOPT_POSTFIELDS, '');
        }

        $response = curl_exec($this->curl);
        $httpCode = curl_getinfo($this->curl, CURLINFO_HTTP_CODE);

        if ($response === false) {
            throw new MediaNestError('cURL error: ' . curl_error($this->curl));
        }

        $decoded = json_decode($response, true);
        if ($decoded === null) {
            throw new MediaNestError('Invalid JSON response');
        }

        if ($httpCode >= 400) {
            $message = $decoded['error']['message'] ?? 'HTTP ' . $httpCode;
            $errorCode = $decoded['error']['code'] ?? 'UNKNOWN_ERROR';
            $correlationId = $decoded['correlationId'] ?? null;

            throw new MediaNestError($message, $httpCode, $errorCode, $correlationId);
        }

        return $decoded;
    }

    public function init() {
        try {
            $response = $this->makeRequest('GET', '/csrf/token');
            $this->csrfToken = $response['data']['token'];
        } catch (MediaNestError $e) {
            // Continue without CSRF token for read-only operations
            error_log('Warning: Failed to get CSRF token: ' . $e->getMessage());
        }
    }

    // Authentication methods
    public function generatePlexPin($clientName = 'MediaNest PHP Client') {
        $response = $this->makeRequest('POST', '/auth/plex/pin', ['clientName' => $clientName]);
        return $response['data'];
    }

    public function verifyPlexPin($pinId, $rememberMe = false) {
        $response = $this->makeRequest('POST', '/auth/plex/verify', [
            'pinId' => $pinId,
            'rememberMe' => $rememberMe
        ]);

        if (isset($response['data']['csrfToken'])) {
            $this->csrfToken = $response['data']['csrfToken'];
        }

        return $response['data'];
    }

    public function getSession() {
        $response = $this->makeRequest('GET', '/auth/session');
        return $response['data'];
    }

    public function logout() {
        $response = $this->makeRequest('POST', '/auth/logout');
        if ($response['success']) {
            $this->csrfToken = null;
        }
        return $response['success'];
    }

    // Media methods
    public function searchMedia($query, $type = 'all', $page = 1, $limit = 20) {
        $params = http_build_query([
            'q' => $query,
            'type' => $type,
            'page' => $page,
            'limit' => $limit
        ]);

        $response = $this->makeRequest('GET', '/media/search?' . $params);
        return $response['data'];
    }

    public function getMediaDetails($mediaType, $tmdbId) {
        $response = $this->makeRequest('GET', "/media/$mediaType/$tmdbId");
        return $response['data'];
    }

    public function requestMedia($tmdbId, $mediaType, $quality = '1080p', $comment = null) {
        $data = [
            'tmdbId' => $tmdbId,
            'mediaType' => $mediaType,
            'quality' => $quality
        ];

        if ($comment) {
            $data['comment'] = $comment;
        }

        $response = $this->makeRequest('POST', '/media/request', $data);
        return $response['data'];
    }

    public function getMyRequests($status = null, $page = 1, $limit = 20) {
        $params = ['page' => $page, 'limit' => $limit];
        if ($status) {
            $params['status'] = $status;
        }

        $queryString = http_build_query($params);
        $response = $this->makeRequest('GET', '/media/requests?' . $queryString);
        return $response['data'];
    }

    // Plex methods
    public function getPlexServer() {
        $response = $this->makeRequest('GET', '/plex/server');
        return $response['data'];
    }

    public function getPlexLibraries() {
        $response = $this->makeRequest('GET', '/plex/libraries');
        return $response['data']['libraries'];
    }

    public function searchPlex($query, $type = 'all', $limit = 20) {
        $params = http_build_query([
            'q' => $query,
            'type' => $type,
            'limit' => $limit
        ]);

        $response = $this->makeRequest('GET', '/plex/search?' . $params);
        return $response['data'];
    }

    // YouTube methods
    public function getYoutubeMetadata($url) {
        $params = http_build_query(['url' => $url]);
        $response = $this->makeRequest('GET', '/youtube/metadata?' . $params);
        return $response['data'];
    }

    public function startYoutubeDownload($url, $quality = '720p', $format = 'mp4') {
        $response = $this->makeRequest('POST', '/youtube/download', [
            'url' => $url,
            'quality' => $quality,
            'format' => $format
        ]);
        return $response['data'];
    }

    // Utility methods
    public function getHealth() {
        $response = $this->makeRequest('GET', '/health');
        return $response;
    }
}

// Usage example
try {
    $client = new MediaNestClient();
    $client->init();

    // Check health
    $health = $client->getHealth();
    echo "API Status: " . $health['status'] . "\n";

    // Search for media
    $results = $client->searchMedia('spider-man', 'movie');
    echo "Found " . count($results['results']) . " movies\n";

    foreach ($results['results'] as $movie) {
        echo "- " . $movie['title'] . " (" . ($movie['year'] ?? 'N/A') . ")\n";
    }

} catch (MediaNestError $e) {
    echo "API Error ({$e->errorCode}): {$e->getMessage()}\n";
} catch (Exception $e) {
    echo "Error: {$e->getMessage()}\n";
}
?>
```

## 🦀 Rust Client

```rust
// Cargo.toml
[package]
name = "medianest-client"
version = "0.1.0"
edition = "2021"

[dependencies]
reqwest = { version = "0.11", features = ["json", "cookies"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
anyhow = "1.0"
thiserror = "1.0"
url = "2.0"

// src/lib.rs
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug)]
pub enum MediaNestError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("API error ({code}): {message}")]
    Api {
        code: String,
        message: String,
        status: u16,
        correlation_id: Option<String>,
    },

    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("URL parsing error: {0}")]
    Url(#[from] url::ParseError),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    #[serde(rename = "correlationId")]
    pub correlation_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub year: Option<u32>,
    pub poster: Option<String>,
    pub overview: Option<String>,
    pub genres: Vec<String>,
    pub rating: Option<f64>,
    pub availability: MediaAvailability,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaAvailability {
    pub plex: bool,
    pub requested: bool,
    #[serde(rename = "plexUrl")]
    pub plex_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    #[serde(rename = "totalPages")]
    pub total_pages: u32,
    #[serde(rename = "totalItems")]
    pub total_items: u32,
    #[serde(rename = "itemsPerPage")]
    pub items_per_page: u32,
    #[serde(rename = "hasNext")]
    pub has_next: bool,
    #[serde(rename = "hasPrev")]
    pub has_prev: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaSearchResult {
    pub results: Vec<MediaItem>,
    pub pagination: PaginationInfo,
}

pub struct MediaNestClient {
    client: Client,
    base_url: Url,
    csrf_token: Option<String>,
}

impl MediaNestClient {
    pub fn new(base_url: &str) -> Result<Self, MediaNestError> {
        let base_url = Url::parse(base_url)?;
        let client = Client::builder()
            .cookie_store(true)
            .user_agent("MediaNest Rust Client/1.0")
            .build()?;

        Ok(MediaNestClient {
            client,
            base_url,
            csrf_token: None,
        })
    }

    pub async fn init(&mut self) -> Result<(), MediaNestError> {
        match self.get_csrf_token().await {
            Ok(token) => {
                self.csrf_token = Some(token);
                Ok(())
            }
            Err(_) => {
                // Continue without CSRF token for read-only operations
                Ok(())
            }
        }
    }

    async fn get_csrf_token(&self) -> Result<String, MediaNestError> {
        #[derive(Deserialize)]
        struct CsrfResponse {
            token: String,
        }

        let response: ApiResponse<CsrfResponse> = self
            .make_request("GET", "/csrf/token", None::<()>, None)
            .await?;

        Ok(response.data.unwrap().token)
    }

    async fn make_request<T, D>(
        &self,
        method: &str,
        endpoint: &str,
        data: Option<D>,
        params: Option<HashMap<String, String>>,
    ) -> Result<ApiResponse<T>, MediaNestError>
    where
        T: for<'de> Deserialize<'de>,
        D: Serialize,
    {
        let mut url = self.base_url.join(endpoint)?;

        if let Some(params) = params {
            let mut query_pairs = url.query_pairs_mut();
            for (key, value) in params {
                query_pairs.append_pair(&key, &value);
            }
        }

        let mut request_builder = match method {
            "GET" => self.client.get(url),
            "POST" => self.client.post(url),
            "PUT" => self.client.put(url),
            "DELETE" => self.client.delete(url),
            "PATCH" => self.client.patch(url),
            _ => return Err(MediaNestError::Http(reqwest::Error::from(reqwest::ErrorKind::Request))),
        };

        // Add CSRF token for state-changing operations
        if matches!(method, "POST" | "PUT" | "PATCH" | "DELETE") {
            if let Some(csrf_token) = &self.csrf_token {
                request_builder = request_builder.header("X-CSRF-Token", csrf_token);
            }
        }

        // Add JSON body for non-GET requests
        if let Some(data) = data {
            request_builder = request_builder.json(&data);
        }

        let response = request_builder.send().await?;
        let status = response.status();

        let api_response: ApiResponse<T> = response.json().await?;

        if !status.is_success() {
            if let Some(error) = api_response.error {
                return Err(MediaNestError::Api {
                    code: error.code,
                    message: error.message,
                    status: status.as_u16(),
                    correlation_id: api_response.correlation_id,
                });
            }
        }

        Ok(api_response)
    }

    // Authentication methods
    pub async fn generate_plex_pin(&self) -> Result<serde_json::Value, MediaNestError> {
        #[derive(Serialize)]
        struct PinRequest {
            #[serde(rename = "clientName")]
            client_name: String,
        }

        let response: ApiResponse<serde_json::Value> = self
            .make_request(
                "POST",
                "/auth/plex/pin",
                Some(PinRequest {
                    client_name: "MediaNest Rust Client".to_string(),
                }),
                None,
            )
            .await?;

        Ok(response.data.unwrap())
    }

    pub async fn verify_plex_pin(
        &mut self,
        pin_id: &str,
        remember_me: bool,
    ) -> Result<serde_json::Value, MediaNestError> {
        #[derive(Serialize)]
        struct VerifyRequest {
            #[serde(rename = "pinId")]
            pin_id: String,
            #[serde(rename = "rememberMe")]
            remember_me: bool,
        }

        let response: ApiResponse<serde_json::Value> = self
            .make_request(
                "POST",
                "/auth/plex/verify",
                Some(VerifyRequest {
                    pin_id: pin_id.to_string(),
                    remember_me,
                }),
                None,
            )
            .await?;

        // Update CSRF token if provided
        if let Some(data) = &response.data {
            if let Some(csrf_token) = data.get("csrfToken").and_then(|v| v.as_str()) {
                self.csrf_token = Some(csrf_token.to_string());
            }
        }

        Ok(response.data.unwrap())
    }

    // Media methods
    pub async fn search_media(
        &self,
        query: &str,
        media_type: Option<&str>,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<MediaSearchResult, MediaNestError> {
        let mut params = HashMap::new();
        params.insert("q".to_string(), query.to_string());
        params.insert("type".to_string(), media_type.unwrap_or("all").to_string());
        params.insert("page".to_string(), page.unwrap_or(1).to_string());
        params.insert("limit".to_string(), limit.unwrap_or(20).to_string());

        let response: ApiResponse<MediaSearchResult> = self
            .make_request("GET", "/media/search", None::<()>, Some(params))
            .await?;

        Ok(response.data.unwrap())
    }

    pub async fn request_media(
        &self,
        tmdb_id: &str,
        media_type: &str,
        quality: Option<&str>,
        comment: Option<&str>,
    ) -> Result<serde_json::Value, MediaNestError> {
        #[derive(Serialize)]
        struct MediaRequest {
            #[serde(rename = "tmdbId")]
            tmdb_id: String,
            #[serde(rename = "mediaType")]
            media_type: String,
            quality: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            comment: Option<String>,
        }

        let response: ApiResponse<serde_json::Value> = self
            .make_request(
                "POST",
                "/media/request",
                Some(MediaRequest {
                    tmdb_id: tmdb_id.to_string(),
                    media_type: media_type.to_string(),
                    quality: quality.unwrap_or("1080p").to_string(),
                    comment: comment.map(|s| s.to_string()),
                }),
                None,
            )
            .await?;

        Ok(response.data.unwrap())
    }

    // Plex methods
    pub async fn get_plex_server(&self) -> Result<serde_json::Value, MediaNestError> {
        let response: ApiResponse<serde_json::Value> = self
            .make_request("GET", "/plex/server", None::<()>, None)
            .await?;

        Ok(response.data.unwrap())
    }

    pub async fn search_plex(&self, query: &str) -> Result<serde_json::Value, MediaNestError> {
        let mut params = HashMap::new();
        params.insert("q".to_string(), query.to_string());

        let response: ApiResponse<serde_json::Value> = self
            .make_request("GET", "/plex/search", None::<()>, Some(params))
            .await?;

        Ok(response.data.unwrap())
    }

    // Utility methods
    pub async fn get_health(&self) -> Result<serde_json::Value, MediaNestError> {
        let response: ApiResponse<serde_json::Value> = self
            .make_request("GET", "/health", None::<()>, None)
            .await?;

        Ok(response.data.unwrap())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = MediaNestClient::new("http://localhost:4000/api/v1")?;
    client.init().await?;

    // Check health
    let health = client.get_health().await?;
    println!("API Status: {}", health.get("status").unwrap());

    // Search for media
    let results = client.search_media("spider-man", Some("movie"), None, Some(5)).await?;
    println!("Found {} movies", results.results.len());

    for movie in results.results {
        println!("- {} ({})", movie.title, movie.year.unwrap_or(0));
        println!("  Available in Plex: {}", movie.availability.plex);
    }

    Ok(())
}
```

## 🚀 Usage Best Practices

### 1. Error Handling Patterns

```typescript
// Comprehensive error handling
async function handleAPICall<T>(
  apiCall: () => Promise<APIResponse<T>>,
  onRetry?: () => void
): Promise<T> {
  const maxRetries = 3;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await apiCall();
      return response.data;
    } catch (error) {
      lastError = error;

      if (error instanceof APIError) {
        // Don't retry on client errors
        if (error.status >= 400 && error.status < 500) {
          break;
        }

        // Don't retry on rate limits
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          break;
        }

        // Handle specific errors
        switch (error.code) {
          case 'UNAUTHORIZED':
            // Trigger re-authentication
            await refreshAuthentication();
            continue;

          case 'CSRF_TOKEN_EXPIRED':
            // Refresh CSRF token
            await refreshCSRFToken();
            continue;
        }
      }

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        onRetry?.();
      }
    }
  }

  throw lastError;
}
```

### 2. Rate Limit Handling

```javascript
class RateLimitedClient {
  constructor(client) {
    this.client = client;
    this.rateLimitInfo = new Map();
  }

  async makeRequestWithRateLimit(endpoint, requestFn) {
    const limitInfo = this.rateLimitInfo.get(endpoint);

    if (limitInfo && limitInfo.resetTime > Date.now()) {
      const waitTime = limitInfo.resetTime - Date.now();
      console.log(`Rate limited. Waiting ${waitTime}ms before retry.`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    try {
      const response = await requestFn();

      // Clear rate limit info on success
      this.rateLimitInfo.delete(endpoint);

      return response;
    } catch (error) {
      if (error instanceof APIError && error.code === 'RATE_LIMIT_EXCEEDED') {
        // Extract rate limit info from headers if available
        const retryAfter = error.retryAfter || 60; // Default to 60 seconds

        this.rateLimitInfo.set(endpoint, {
          resetTime: Date.now() + retryAfter * 1000,
        });
      }

      throw error;
    }
  }
}
```

### 3. Caching and Optimization

```typescript
class CachedMediaNestClient extends MediaNestClient {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(method: string, endpoint: string, params?: any): string {
    return `${method}:${endpoint}:${JSON.stringify(params || {})}`;
  }

  private isExpired(entry: { expires: number }): boolean {
    return Date.now() > entry.expires;
  }

  async cachedRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Only cache GET requests
    if (method === 'GET') {
      const cacheKey = this.getCacheKey(method, endpoint, data);
      const cached = this.cache.get(cacheKey);

      if (cached && !this.isExpired(cached)) {
        console.log(`Cache hit for ${cacheKey}`);
        return cached.data;
      }
    }

    // Make the actual request
    const response = await super.request(method, endpoint, data);

    // Cache successful GET responses
    if (method === 'GET' && response.success) {
      const cacheKey = this.getCacheKey(method, endpoint, data);
      this.cache.set(cacheKey, {
        data: response.data,
        expires: Date.now() + ttl,
      });
    }

    return response.data;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Override search method to use caching
  async searchMedia(query: string, type?: string, page?: number, limit?: number): Promise<any> {
    return this.cachedRequest('GET', '/media/search', { q: query, type, page, limit });
  }
}
```

These client examples provide production-ready implementations with proper error handling, rate limiting, caching, and authentication management. Each client includes comprehensive documentation and usage examples to help developers integrate with the MediaNest API effectively.
