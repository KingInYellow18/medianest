import { logger } from '../../utils/logger';
import { BaseApiClient, ApiClientConfig } from '../base-api-client';
import { getErrorMessage } from '../../utils/error-handling';

export interface OverseerrMediaRequest {
  id: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  type: 'movie' | 'tv';
  requestedBy: OverseerrUser;
  modifiedBy?: OverseerrUser;
  media: OverseerrMedia;
  seasons?: OverseerrSeason[];
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
  languageProfileId?: number;
  tags?: number[];
}

export interface OverseerrUser {
  id: number;
  email: string;
  username?: string;
  plexUsername?: string;
  displayName: string;
  avatar: string;
  permissions: number;
}

export interface OverseerrMedia {
  id: number;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  tvdbId?: number;
  imdbId?: string;
  status: number;
  status4k: number;
  createdAt: string;
  updatedAt: string;
  requests?: OverseerrMediaRequest[];
}

export interface OverseerrSeason {
  id: number;
  seasonNumber: number;
  status: number;
  status4k: number;
}

export interface OverseerrStatus {
  version: string;
  commitTag: string;
  updateAvailable: boolean;
  commitsBehind: number;
}

export interface OverseerrSettings {
  id: number;
  hostname: string;
  port: number;
  ssl: boolean;
  urlBase?: string;
  csrfProtection: boolean;
  cacheImages: boolean;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  enablePushRegistration: boolean;
  locale: string;
  region: string;
  originalLanguage: string;
  toDisplayLanguage: string;
  hideAvailable: boolean;
  localLogin: boolean;
  newPlexLogin: boolean;
  defaultPermissions: number;
}

export interface CreateMediaRequestInput {
  mediaType: 'movie' | 'tv';
  mediaId: number; // TMDB ID
  tvdbId?: number;
  seasons?: number[]; // For TV shows
  is4k?: boolean;
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
  languageProfileId?: number;
  tags?: number[];
}

export interface OverseerrApiConfig extends ApiClientConfig {
  overseerrUrl: string;
  apiKey: string;
}

export class OverseerrApiClient extends BaseApiClient {
  private overseerrUrl: string;
  private apiKey: string;

  constructor(config: OverseerrApiConfig) {
    super('Overseerr', {
      ...config,
      baseURL: config.overseerrUrl.replace(/\/$/, ''), // Remove trailing slash
      headers: {
        'X-API-Key': config.apiKey,
        ...config.headers,
      },
    });

    this.overseerrUrl = config.overseerrUrl;
    this.apiKey = config.apiKey;
  }

  async getStatus(): Promise<OverseerrStatus> {
    try {
      const response = await this.request<OverseerrStatus>('/api/v1/status');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Overseerr status', { error: getErrorMessage(error) });
      throw new Error(`Failed to get Overseerr status: ${getErrorMessage(error)}`);
    }
  }

  async getSettings(): Promise<OverseerrSettings> {
    try {
      const response = await this.request<OverseerrSettings>('/api/v1/settings/main');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Overseerr settings', { error: getErrorMessage(error) });
      throw new Error(`Failed to get Overseerr settings: ${getErrorMessage(error)}`);
    }
  }

  async getRequests(
    take: number = 20,
    skip: number = 0,
    filter?: 'all' | 'approved' | 'available' | 'pending' | 'processing' | 'unavailable'
  ): Promise<{
    results: OverseerrMediaRequest[];
    pageInfo: { pages: number; pageSize: number; total: number; page: number };
  }> {
    try {
      const params = new URLSearchParams({
        take: take.toString(),
        skip: skip.toString(),
        ...(filter && filter !== 'all' && { filter }),
      });

      const response = await this.request<{
        results: OverseerrMediaRequest[];
        pageInfo: { pages: number; pageSize: number; total: number; page: number };
      }>(`/api/v1/request?${params}`);

      return response.data;
    } catch (error) {
      logger.error('Failed to get Overseerr requests', { error: getErrorMessage(error) });
      throw new Error(`Failed to get Overseerr requests: ${getErrorMessage(error)}`);
    }
  }

  async getRequestById(requestId: number): Promise<OverseerrMediaRequest> {
    try {
      const response = await this.request<OverseerrMediaRequest>(`/api/v1/request/${requestId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Overseerr request', {
        requestId,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to get request ${requestId}: ${getErrorMessage(error)}`);
    }
  }

  async createRequest(requestData: CreateMediaRequestInput): Promise<OverseerrMediaRequest> {
    try {
      const response = await this.request<OverseerrMediaRequest>('/api/v1/request', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });

      logger.info('Overseerr media request created', {
        requestId: response.data.id,
        mediaType: requestData.mediaType,
        mediaId: requestData.mediaId,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Overseerr request', {
        requestData,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to create media request: ${getErrorMessage(error)}`);
    }
  }

  async updateRequest(
    requestId: number,
    updateData: Partial<CreateMediaRequestInput>
  ): Promise<OverseerrMediaRequest> {
    try {
      const response = await this.request<OverseerrMediaRequest>(`/api/v1/request/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      logger.info('Overseerr request updated', { requestId, updateData });

      return response.data;
    } catch (error) {
      logger.error('Failed to update Overseerr request', {
        requestId,
        updateData,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to update request ${requestId}: ${getErrorMessage(error)}`);
    }
  }

  async approveRequest(requestId: number): Promise<OverseerrMediaRequest> {
    try {
      const response = await this.request<OverseerrMediaRequest>(
        `/api/v1/request/${requestId}/approve`,
        { method: 'POST' }
      );

      logger.info('Overseerr request approved', { requestId });

      return response.data;
    } catch (error) {
      logger.error('Failed to approve Overseerr request', {
        requestId,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to approve request ${requestId}: ${getErrorMessage(error)}`);
    }
  }

  async declineRequest(requestId: number, reason?: string): Promise<OverseerrMediaRequest> {
    try {
      const response = await this.request<OverseerrMediaRequest>(
        `/api/v1/request/${requestId}/decline`,
        {
          method: 'POST',
          ...(reason && { body: JSON.stringify({ reason }) }),
        }
      );

      logger.info('Overseerr request declined', { requestId, reason });

      return response.data;
    } catch (error) {
      logger.error('Failed to decline Overseerr request', {
        requestId,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to decline request ${requestId}: ${getErrorMessage(error)}`);
    }
  }

  async deleteRequest(requestId: number): Promise<void> {
    try {
      await this.request(`/api/v1/request/${requestId}`, {
        method: 'DELETE',
      });

      logger.info('Overseerr request deleted', { requestId });
    } catch (error) {
      logger.error('Failed to delete Overseerr request', {
        requestId,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to delete request ${requestId}: ${getErrorMessage(error)}`);
    }
  }

  async getUserRequests(
    userId: number,
    take: number = 20,
    skip: number = 0
  ): Promise<{
    results: OverseerrMediaRequest[];
    pageInfo: { pages: number; pageSize: number; total: number; page: number };
  }> {
    try {
      const params = new URLSearchParams({
        take: take.toString(),
        skip: skip.toString(),
      });

      const response = await this.request<{
        results: OverseerrMediaRequest[];
        pageInfo: { pages: number; pageSize: number; total: number; page: number };
      }>(`/api/v1/user/${userId}/requests?${params}`);

      return response.data;
    } catch (error) {
      logger.error('Failed to get user requests from Overseerr', {
        userId,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to get user requests: ${getErrorMessage(error)}`);
    }
  }

  async searchMedia(
    query: string,
    type?: 'movie' | 'tv',
    page: number = 1
  ): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: unknown[];
  }> {
    try {
      const params = new URLSearchParams({
        query: query,
        page: page.toString(),
        ...(type && { type }),
      });

      const response = await this.request<{
        page: number;
        totalPages: number;
        totalResults: number;
        results: unknown[];
      }>(`/api/v1/search?${params}`);

      return response.data;
    } catch (error) {
      logger.error('Failed to search media in Overseerr', {
        query,
        type,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to search media: ${getErrorMessage(error)}`);
    }
  }

  async getMediaInfo(mediaType: 'movie' | 'tv', tmdbId: number): Promise<any> {
    try {
      const response = await this.request(`/api/v1/${mediaType}/${tmdbId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get media info from Overseerr', {
        mediaType,
        tmdbId,
        error: getErrorMessage(error),
      });
      throw new Error(`Failed to get media info: ${getErrorMessage(error)}`);
    }
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      await this.getStatus();
    } catch (error) {
      throw new Error(`Overseerr health check failed: ${getErrorMessage(error)}`);
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      await this.getStatus();
      await this.getSettings();
      return true;
    } catch {
      return false;
    }
  }

  static async createFromConfig(overseerrUrl: string, apiKey: string): Promise<OverseerrApiClient> {
    const client = new OverseerrApiClient({
      overseerrUrl,
      apiKey,
      baseURL: overseerrUrl,
      timeout: 10000,
      retryAttempts: 2,
      circuitBreakerOptions: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 60000,
      },
    });

    // Validate configuration on creation
    const isValid = await client.validateConfiguration();
    if (!isValid) {
      throw new Error('Invalid Overseerr configuration');
    }

    return client;
  }
}
