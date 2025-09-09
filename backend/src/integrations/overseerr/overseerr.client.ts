import axios, { AxiosInstance } from 'axios';

import { logger } from '@/utils/logger';
// Removed unused import

export interface OverseerrConfig {
  url: string;
  apiKey: string;
}

export interface MediaSearchResult {
  id: number;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string;
  title: string;
  releaseDate?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  mediaInfo?: {
    status: number; // 1=unknown, 2=pending, 3=processing, 4=partially available, 5=available
    requests?: MediaRequestInfo[];
  };
}

export interface MediaRequestInfo {
  id: number;
  status: number; // 1=pending approval, 2=approved, 3=declined
  media: {
    tmdbId: number;
    status: number;
    type: 'movie' | 'tv';
  };
  requestedBy: {
    email: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MediaRequest {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  seasons?: number[];
}

export class OverseerrClient {
  private client: AxiosInstance;

  constructor(config: OverseerrConfig) {
    this.client = axios.create({
      baseURL: config.url.replace(/\/$/, '') + '/api/v1',
      timeout: 5000,
      headers: {
        'X-Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        logger.error('Overseerr API error', {
          status: error.response?.status,
          url: error.config?.url,
        });

        if (error.response?.status === 409) {
          throw new Error('Media already requested');
        }

        return Promise.reject(error);
      }
    );
  }

  // Test connection to Overseerr
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/status');
      return response.data.status === 'ok';
    } catch (error: unknown) {
      logger.error('Overseerr connection test failed', { error });
      return false;
    }
  }

  // Search for media (simplified)
  async searchMedia(
    query: string,
    page = 1
  ): Promise<{
    results: MediaSearchResult[];
    totalPages: number;
  }> {
    try {
      const response = await this.client.get('/search', {
        params: { query, page },
      });

      return {
        results: response.data.results.map(this.mapSearchResult),
        totalPages: response.data.totalPages,
      };
    } catch (error: unknown) {
      logger.error('Search failed', { query, error });
      throw new Error('Failed to search media');
    }
  }

  // Get media details
  async getMediaDetails(mediaType: 'movie' | 'tv', tmdbId: number): Promise<MediaSearchResult> {
    try {
      const response = await this.client.get(`/${mediaType}/${tmdbId}`);
      return this.mapSearchResult(response.data);
    } catch (error: unknown) {
      logger.error('Failed to get media details', { mediaType, tmdbId, error });
      throw new Error('Failed to get media details');
    }
  }

  // Submit media request (simplified - no profile/server selection)
  async requestMedia(request: MediaRequest): Promise<MediaRequestInfo> {
    try {
      const response = await this.client.post('/request', request);
      return response.data;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Media already requested') {
        throw error;
      }
      logger.error('Failed to request media', { request, error });
      throw new Error('Failed to submit media request');
    }
  }

  // Get user's requests
  async getUserRequests(
    options: {
      take?: number;
      skip?: number;
    } = {}
  ): Promise<{
    results: MediaRequestInfo[];
    pageInfo: {
      pages: number;
      results: number;
    };
  }> {
    try {
      const response = await this.client.get('/request', {
        params: {
          take: options.take || 20,
          skip: options.skip || 0,
        },
      });

      return response.data;
    } catch (error: unknown) {
      logger.error('Failed to get user requests', { error });
      throw new Error('Failed to get user requests');
    }
  }

  // Helper to map Overseerr data to our interface
  private mapSearchResult(data: any): MediaSearchResult {
    return {
      id: data.id,
      mediaType: data.mediaType,
      tmdbId: data.tmdbId || data.id,
      imdbId: data.imdbId,
      title: data.title || data.name,
      releaseDate: data.releaseDate || data.firstAirDate,
      overview: data.overview,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
      mediaInfo: data.mediaInfo,
    };
  }
}
