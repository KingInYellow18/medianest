import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

import { config } from '@/config';
import { logger } from '@/utils/logger';

export interface PlexServerInfo {
  name: string;
  machineIdentifier: string;
  version: string;
  platform: string;
  updatedAt: number;
}

export interface PlexLibrary {
  key: string;
  type: 'movie' | 'show' | 'youtube';
  title: string;
  uuid: string;
  updatedAt: number;
}

export interface PlexMediaItem {
  ratingKey: string;
  key: string;
  guid: string;
  type: 'movie' | 'episode' | 'show' | 'season';
  title: string;
  summary?: string;
  year?: number;
  thumb?: string;
  duration?: number;
  addedAt: number;
  viewCount?: number;
}

export class PlexClient {
  private client: AxiosInstance;
  private serverUrl: string;
  private plexToken: string;
  private connectionPool: Map<string, Promise<any>> = new Map();
  private lastConnectionCheck = 0;
  private readonly CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(serverUrl: string, plexToken: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.plexToken = plexToken;

    // Create axios instance with enhanced config for performance
    this.client = axios.create({
      baseURL: this.serverUrl,
      timeout: 15000, // Increased timeout for large libraries
      maxRedirects: 3,
      maxContentLength: 50 * 1024 * 1024, // 50MB max response
      headers: {
        'X-Plex-Token': plexToken,
        'X-Plex-Client-Identifier': config.plex?.clientId || 'medianest',
        'X-Plex-Product': 'MediaNest',
        'X-Plex-Version': '1.0.0',
        Accept: 'application/json',
        Connection: 'keep-alive',
        'Accept-Encoding': 'gzip, deflate',
      },
      // Enable HTTP keep-alive for connection pooling
      httpAgent: new HttpAgent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 2,
        timeout: 60000,
        freeSocketTimeout: 30000,
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 2,
        timeout: 60000,
        freeSocketTimeout: 30000,
      }),
    });

    // Configure retry logic with exponential backoff
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: (retryCount) => {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        logger.debug('Plex retry attempt', { retryCount, delay });
        return delay;
      },
      retryCondition: (error) => {
        // Retry on network errors, timeouts, and server errors (5xx)
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status !== undefined && error.response.status >= 500) ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET'
        );
      },
      onRetry: (retryCount, error, requestConfig) => {
        logger.warn('Retrying Plex request', {
          retryCount,
          url: requestConfig.url,
          error: error.message,
        });
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for connection pooling
    this.client.interceptors.request.use(
      (config) => {
        // Add request timestamp for performance monitoring
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor with enhanced error handling and metrics
    this.client.interceptors.response.use(
      (response) => {
        // Log response time for performance monitoring
        const responseTime = Date.now() - response.config.metadata?.startTime;
        if (responseTime > 5000) {
          logger.warn('Slow Plex response', {
            url: response.config.url,
            responseTime,
          });
        }
        return response;
      },
      async (error: AxiosError) => {
        const responseTime = error.config?.metadata?.startTime
          ? Date.now() - error.config.metadata.startTime
          : 0;

        if (error.response) {
          logger.error('Plex API error', {
            status: error.response.status,
            url: error.config?.url,
            responseTime,
            retryCount: error.config?.['axios-retry']?.retryCount || 0,
          });

          // Enhanced error handling with specific error types
          switch (error.response.status) {
            case 401:
              throw new Error('Invalid or expired Plex token');
            case 404:
              throw new Error('Plex resource not found');
            case 429:
              logger.warn('Plex rate limit hit', { url: error.config?.url });
              throw new Error('Plex server rate limit exceeded');
            case 500:
            case 502:
            case 503:
            case 504:
              throw new Error(`Plex server error (${error.response.status})`);
            default:
              throw new Error(`Plex API error: ${error.response.status}`);
          }
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          logger.error('Plex API timeout', {
            url: error.config?.url,
            timeout: error.config?.timeout,
            responseTime,
          });
          throw new Error('Plex server timeout - consider checking your network connection');
        } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
          logger.error('Plex connection error', {
            message: error.message,
            code: error.code,
            url: error.config?.url,
          });
          throw new Error('Unable to connect to Plex server - server may be down');
        } else {
          logger.error('Plex API connection error', {
            message: error.message,
            code: error.code,
            responseTime,
          });
          throw new Error(`Connection error: ${error.message}`);
        }
      },
    );
  }

  // Test connection to Plex server with caching
  async testConnection(): Promise<PlexServerInfo> {
    const cacheKey = 'plex:connection';
    const now = Date.now();

    // Use cached connection check if recent
    if (
      this.lastConnectionCheck &&
      now - this.lastConnectionCheck < this.CONNECTION_CHECK_INTERVAL
    ) {
      const cached = this.connectionPool.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const connectionPromise = this.client.get('/').then((response) => {
        const data = response.data.MediaContainer;
        const serverInfo: PlexServerInfo = {
          name: data.friendlyName,
          machineIdentifier: data.machineIdentifier,
          version: data.version,
          platform: data.platform,
          updatedAt: data.updatedAt,
        };

        this.lastConnectionCheck = now;
        logger.debug('Plex connection verified', { serverInfo });
        return serverInfo;
      });

      this.connectionPool.set(cacheKey, connectionPromise);

      // Clean up cache after timeout
      setTimeout(() => {
        this.connectionPool.delete(cacheKey);
      }, this.CONNECTION_CHECK_INTERVAL);

      return await connectionPromise;
    } catch (error) {
      this.connectionPool.delete(cacheKey);
      throw new Error(`Failed to connect to Plex server: ${error.message}`);
    }
  }

  // Get all libraries
  async getLibraries(): Promise<PlexLibrary[]> {
    try {
      const response = await this.client.get('/library/sections');
      const libraries = response.data.MediaContainer.Directory.map((lib: any) => ({
        key: lib.key,
        type: lib.type,
        title: lib.title,
        uuid: lib.uuid,
        updatedAt: lib.updatedAt,
      }));

      return libraries;
    } catch (error) {
      throw new Error(`Failed to fetch libraries: ${error.message}`);
    }
  }

  // Get library items with pagination and request deduplication
  async getLibraryItems(
    libraryKey: string,
    options: {
      offset?: number;
      limit?: number;
    } = {},
  ): Promise<{ items: PlexMediaItem[]; totalSize: number }> {
    const offset = options.offset || 0;
    const limit = Math.min(options.limit || 50, 100); // Cap at 100 for performance
    const cacheKey = `library:${libraryKey}:${offset}:${limit}`;

    // Check for ongoing request to prevent duplicate requests
    const ongoing = this.connectionPool.get(cacheKey);
    if (ongoing) {
      return ongoing;
    }

    const params = new URLSearchParams({
      'X-Plex-Container-Start': String(offset),
      'X-Plex-Container-Size': String(limit),
    });

    try {
      const requestPromise = this.client
        .get(`/library/sections/${libraryKey}/all?${params}`)
        .then((response) => {
          const container = response.data.MediaContainer;
          const items = (container.Metadata || []).map(this.mapMediaItem.bind(this));

          return {
            items,
            totalSize: container.totalSize || 0,
          };
        });

      this.connectionPool.set(cacheKey, requestPromise);

      // Clean up request cache after 10 seconds
      setTimeout(() => {
        this.connectionPool.delete(cacheKey);
      }, 10000);

      return await requestPromise;
    } catch (error) {
      this.connectionPool.delete(cacheKey);
      throw new Error(`Failed to fetch library items: ${error.message}`);
    }
  }

  // Search across all libraries
  async search(query: string, limit = 20): Promise<PlexMediaItem[]> {
    const params = new URLSearchParams({
      query: encodeURIComponent(query),
      limit: String(limit),
    });

    try {
      const response = await this.client.get(`/search?${params}`);
      const results = response.data.MediaContainer.Metadata || [];

      return results.map(this.mapMediaItem);
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Get recently added items
  async getRecentlyAdded(limit = 20): Promise<PlexMediaItem[]> {
    const params = new URLSearchParams({
      'X-Plex-Container-Start': '0',
      'X-Plex-Container-Size': String(limit),
    });

    try {
      const response = await this.client.get(`/library/recentlyAdded?${params}`);
      const items = response.data.MediaContainer.Metadata || [];

      return items.map(this.mapMediaItem);
    } catch (error) {
      throw new Error(`Failed to fetch recently added: ${error.message}`);
    }
  }

  // Refresh a specific library section
  async refreshLibrary(sectionId: string): Promise<void> {
    try {
      await this.client.get(`/library/sections/${sectionId}/refresh`);
      logger.info('Plex library refresh initiated', { sectionId });
    } catch (error) {
      throw new Error(`Failed to refresh library: ${error.message}`);
    }
  }

  // Scan a specific directory within a library
  async scanDirectory(sectionId: string, directory: string): Promise<void> {
    const params = new URLSearchParams({
      path: directory,
    });

    try {
      await this.client.get(`/library/sections/${sectionId}/refresh?${params}`);
      logger.info('Plex directory scan initiated', { sectionId, directory });
    } catch (error) {
      throw new Error(`Failed to scan directory: ${error.message}`);
    }
  }

  // Get collections in a library
  async getCollections(libraryKey: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/library/sections/${libraryKey}/collections`);
      const collections = response.data.MediaContainer.Metadata || [];
      return collections;
    } catch (error) {
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }
  }

  // Get collection details with items
  async getCollectionDetails(collectionKey: string): Promise<any> {
    try {
      const response = await this.client.get(collectionKey);
      const collection = response.data.MediaContainer.Metadata[0];

      // Get collection items
      const itemsResponse = await this.client.get(`${collectionKey}/children`);
      const items = itemsResponse.data.MediaContainer.Metadata || [];

      return {
        ...collection,
        items,
      };
    } catch (error) {
      throw new Error(`Failed to fetch collection details: ${error.message}`);
    }
  }

  // Create a collection in a library
  async createCollection(libraryKey: string, title: string, items: string[] = []): Promise<void> {
    const params = new URLSearchParams({
      type: '18', // Collection type
      title,
      smart: '0', // Not a smart collection
    });

    // Add items to collection
    items.forEach((ratingKey) => {
      params.append('item', ratingKey);
    });

    try {
      await this.client.post(`/library/sections/${libraryKey}/collections?${params}`);
      logger.info('Plex collection created', { libraryKey, title, itemCount: items.length });
    } catch (error) {
      throw new Error(`Failed to create collection: ${error.message}`);
    }
  }

  // Cleanup resources to prevent memory leaks
  public cleanup(): void {
    this.connectionPool.clear();

    // Destroy HTTP agents to close keep-alive connections
    if (this.client.defaults.httpAgent) {
      this.client.defaults.httpAgent.destroy();
    }
    if (this.client.defaults.httpsAgent) {
      this.client.defaults.httpsAgent.destroy();
    }

    logger.debug('Plex client resources cleaned up');
  }

  // Get performance metrics
  public getMetrics(): {
    activeRequests: number;
    lastConnectionCheck: number;
    connectionPoolSize: number;
  } {
    return {
      activeRequests: this.connectionPool.size,
      lastConnectionCheck: this.lastConnectionCheck,
      connectionPoolSize: this.connectionPool.size,
    };
  }

  // Helper to map Plex metadata to our interface with better error handling
  private mapMediaItem(item: any): PlexMediaItem {
    if (!item || typeof item !== 'object') {
      logger.warn('Invalid Plex media item received', { item });
      throw new Error('Invalid media item data from Plex');
    }

    return {
      ratingKey: item.ratingKey || '',
      key: item.key || '',
      guid: item.guid || '',
      type: item.type || 'unknown',
      title: item.title || 'Unknown Title',
      summary: item.summary,
      year: item.year ? Number(item.year) : undefined,
      thumb: item.thumb,
      duration: item.duration ? Number(item.duration) : undefined,
      addedAt: item.addedAt ? Number(item.addedAt) : Date.now(),
      viewCount: item.viewCount ? Number(item.viewCount) : undefined,
    };
  }
}
