import { logger } from '../../utils/logger';
import { BaseApiClient, ApiClientConfig } from '../base-api-client';
import { getErrorMessage } from '../../utils/error-handling';
// Removed unused import

export interface PlexServer {
  name: string;
  host: string;
  port: number;
  machineIdentifier: string;
  version: string;
  scheme: string;
  address: string;
  owned: boolean;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  createdAt: number;
  scannedAt: number;
  refreshing: boolean;
}

export interface PlexMediaItem {
  ratingKey: string;
  key: string;
  guid: string;
  title: string;
  type: string;
  summary?: string;
  year?: number;
  thumb?: string;
  art?: string;
  duration?: number;
  addedAt: number;
  updatedAt: number;
  Media?: PlexMedia[];
}

export interface PlexMedia {
  id: string;
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
  Part: PlexPart[];
}

export interface PlexPart {
  id: string;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  has64bitOffsets: boolean;
  optimizedForStreaming: boolean;
}

export interface PlexUserData {
  id: string;
  uuid: string;
  email?: string;
  username: string;
  title: string;
  thumb: string;
  hasPassword: boolean;
  authToken: string;
  subscription?: {
    active: boolean;
    status: string;
    plan: string;
  };
  services?: Array<{
    identifier: string;
    endpoint: string;
    token: string;
    status: string;
  }>;
}

export interface PlexApiConfig extends ApiClientConfig {
  plexToken: string;
  serverUrl?: string;
}

export class PlexApiClient extends BaseApiClient {
  private _plexToken: string;
  private serverUrl?: string;

  constructor(config: PlexApiConfig) {
    super('Plex', {
      ...config,
      baseURL: config.baseURL || 'https://plex.tv',
      headers: {
        'X-Plex-Token': config.plexToken,
        'X-Plex-Client-Identifier': process.env.PLEX_CLIENT_IDENTIFIER || 'medianest-server',
        'X-Plex-Product': 'MediaNest',
        'X-Plex-Version': '1.0.0',
        'X-Plex-Platform': 'Web',
        'X-Plex-Platform-Version': '1.0',
        'X-Plex-Device': 'MediaNest',
        'X-Plex-Device-Name': 'MediaNest Server',
        ...config.headers,
      },
    });

    this._plexToken = config.plexToken;
    this.serverUrl = config.serverUrl;
  }

  async getUser(): Promise<PlexUserData> {
    try {
      const response = await this.request<{ user: PlexUserData }>('/api/v2/user', {
        method: 'GET',
      });

      return response.data.user;
    } catch (error: unknown) {
      logger.error('Failed to get Plex user data', { error: getErrorMessage(error) });
      throw new Error(`Failed to get Plex user: ${getErrorMessage(error)}`);
    }
  }

  async getServers(): Promise<PlexServer[]> {
    try {
      const response = await this.request<{ MediaContainer: { Server: PlexServer[] } }>(
        '/api/v2/resources',
        { method: 'GET' }
      );

      return response.data.MediaContainer?.Server || [];
    } catch (error: unknown) {
      logger.error('Failed to get Plex servers', { error: getErrorMessage(error) });
      throw new Error(`Failed to get Plex servers: ${getErrorMessage(error)}`);
    }
  }

  async getLibraries(serverUrl?: string): Promise<PlexLibrary[]> {
    const baseUrl = serverUrl || this.serverUrl;
    if (!baseUrl) {
      throw new Error('No Plex server URL configured');
    }

    try {
      const response = await this.requestToServer<{ MediaContainer: { Directory: PlexLibrary[] } }>(
        baseUrl,
        '/library/sections'
      );

      return response.data.MediaContainer?.Directory || [];
    } catch (error: unknown) {
      logger.error('Failed to get Plex libraries', { error: getErrorMessage(error) });
      throw new Error(`Failed to get Plex libraries: ${getErrorMessage(error)}`);
    }
  }

  async getLibraryContent(libraryKey: string, serverUrl?: string): Promise<PlexMediaItem[]> {
    const baseUrl = serverUrl || this.serverUrl;
    if (!baseUrl) {
      throw new Error('No Plex server URL configured');
    }

    try {
      const response = await this.requestToServer<{
        MediaContainer: { Metadata: PlexMediaItem[] };
      }>(baseUrl, `/library/sections/${libraryKey}/all`);

      return response.data.MediaContainer?.Metadata || [];
    } catch (error: unknown) {
      logger.error('Failed to get library content', {
        libraryKey,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to get library content: ${getErrorMessage(error)}`);
    }
  }

  async searchMedia(query: string, serverUrl?: string): Promise<PlexMediaItem[]> {
    const baseUrl = serverUrl || this.serverUrl;
    if (!baseUrl) {
      throw new Error('No Plex server URL configured');
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await this.requestToServer<{
        MediaContainer: { Metadata: PlexMediaItem[] };
      }>(baseUrl, `/search?query=${encodedQuery}`);

      return response.data.MediaContainer?.Metadata || [];
    } catch (error: unknown) {
      logger.error('Failed to search Plex media', {
        query,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to search media: ${getErrorMessage(error)}`);
    }
  }

  async getMediaItem(ratingKey: string, serverUrl?: string): Promise<PlexMediaItem> {
    const baseUrl = serverUrl || this.serverUrl;
    if (!baseUrl) {
      throw new Error('No Plex server URL configured');
    }

    try {
      const response = await this.requestToServer<{
        MediaContainer: { Metadata: PlexMediaItem[] };
      }>(baseUrl, `/library/metadata/${ratingKey}`);

      const items = response.data.MediaContainer?.Metadata || [];
      if (items.length === 0) {
        throw new Error(`Media item not found: ${ratingKey}`);
      }

      const item = items[0];
      if (!item) {
        throw new Error(`Media item not found: ${ratingKey}`);
      }
      return item;
    } catch (error: unknown) {
      logger.error('Failed to get Plex media item', {
        ratingKey,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to get media item: ${getErrorMessage(error)}`);
    }
  }

  async getRecentlyAdded(serverUrl?: string, limit: number = 10): Promise<PlexMediaItem[]> {
    const baseUrl = serverUrl || this.serverUrl;
    if (!baseUrl) {
      throw new Error('No Plex server URL configured');
    }

    try {
      const response = await this.requestToServer<{
        MediaContainer: { Metadata: PlexMediaItem[] };
      }>(baseUrl, `/library/recentlyAdded?X-Plex-Container-Size=${limit}`);

      return response.data.MediaContainer?.Metadata || [];
    } catch (error: unknown) {
      logger.error('Failed to get recently added media', { error: getErrorMessage(error) });
      throw new Error(`Failed to get recently added media: ${getErrorMessage(error)}`);
    }
  }

  private async requestToServer<T>(serverUrl: string, endpoint: string) {
    const originalBaseUrl = this.config.baseURL;
    this.config.baseURL = serverUrl;

    try {
      const result = await this.request<T>(endpoint);
      return result;
    } finally {
      this.config.baseURL = originalBaseUrl;
    }
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      await this.getUser();
    } catch (error: unknown) {
      throw new Error(`Plex health check failed: ${getErrorMessage(error)}`);
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch {
      return false;
    }
  }

  static async createFromUserToken(plexToken: string, serverUrl?: string): Promise<PlexApiClient> {
    const client = new PlexApiClient({
      plexToken,
      serverUrl,
      baseURL: 'https://plex.tv',
      timeout: 10000,
      retryAttempts: 2,
      circuitBreakerOptions: {
        failureThreshold: 3,
        resetTimeout: 60000,
        monitoringPeriod: 300000,
      },
    });

    // Validate token on creation
    const isValid = await client.validateToken();
    if (!isValid) {
      throw new Error('Invalid Plex token provided');
    }

    return client;
  }
}
