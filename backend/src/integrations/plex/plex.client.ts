import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface PlexServerInfo {
  name: string;
  machineIdentifier: string;
  version: string;
  platform: string;
  updatedAt: number;
}

export interface PlexLibrary {
  key: string;
  type: 'movie' | 'show' | 'music' | 'photo';
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

  constructor(serverUrl: string, plexToken: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.plexToken = plexToken;

    // Create axios instance with basic config
    this.client = axios.create({
      baseURL: this.serverUrl,
      timeout: 5000, // 5 second timeout
      headers: {
        'X-Plex-Token': plexToken,
        'X-Plex-Client-Identifier': config.plex?.clientId || 'medianest',
        'X-Plex-Product': 'MediaNest',
        'X-Plex-Version': '1.0.0',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Response interceptor with basic error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response) {
          logger.error('Plex API error', {
            status: error.response.status,
            url: error.config?.url
          });
          
          if (error.response.status === 401) {
            throw new Error('Invalid or expired Plex token');
          } else if (error.response.status === 404) {
            throw new Error('Plex resource not found');
          }
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          logger.error('Plex API timeout', { url: error.config?.url });
          throw new Error('Plex server timeout');
        } else {
          logger.error('Plex API connection error', { 
            message: error.message,
            code: error.code 
          });
          throw new Error('Unable to connect to Plex server');
        }
        return Promise.reject(error);
      }
    );
  }

  // Test connection to Plex server
  async testConnection(): Promise<PlexServerInfo> {
    try {
      const response = await this.client.get('/');
      const data = response.data.MediaContainer;
      
      const serverInfo: PlexServerInfo = {
        name: data.friendlyName,
        machineIdentifier: data.machineIdentifier,
        version: data.version,
        platform: data.platform,
        updatedAt: data.updatedAt
      };

      return serverInfo;
    } catch (error) {
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
        updatedAt: lib.updatedAt
      }));

      return libraries;
    } catch (error) {
      throw new Error(`Failed to fetch libraries: ${error.message}`);
    }
  }

  // Get library items with pagination
  async getLibraryItems(
    libraryKey: string,
    options: {
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<{ items: PlexMediaItem[]; totalSize: number }> {
    const params = new URLSearchParams({
      'X-Plex-Container-Start': String(options.offset || 0),
      'X-Plex-Container-Size': String(options.limit || 50)
    });

    try {
      const response = await this.client.get(
        `/library/sections/${libraryKey}/all?${params}`
      );
      
      const container = response.data.MediaContainer;
      const items = (container.Metadata || []).map(this.mapMediaItem);

      return {
        items,
        totalSize: container.totalSize || 0
      };
    } catch (error) {
      throw new Error(`Failed to fetch library items: ${error.message}`);
    }
  }

  // Search across all libraries
  async search(query: string, limit = 20): Promise<PlexMediaItem[]> {
    const params = new URLSearchParams({
      query: encodeURIComponent(query),
      limit: String(limit)
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
      'X-Plex-Container-Size': String(limit)
    });

    try {
      const response = await this.client.get(`/library/recentlyAdded?${params}`);
      const items = response.data.MediaContainer.Metadata || [];
      
      return items.map(this.mapMediaItem);
    } catch (error) {
      throw new Error(`Failed to fetch recently added: ${error.message}`);
    }
  }

  // Helper to map Plex metadata to our interface
  private mapMediaItem(item: any): PlexMediaItem {
    return {
      ratingKey: item.ratingKey,
      key: item.key,
      guid: item.guid,
      type: item.type,
      title: item.title,
      summary: item.summary,
      year: item.year,
      thumb: item.thumb,
      duration: item.duration,
      addedAt: item.addedAt,
      viewCount: item.viewCount
    };
  }
}