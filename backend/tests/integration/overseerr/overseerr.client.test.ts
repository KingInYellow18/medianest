import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { OverseerrClient } from '@/integrations/overseerr/overseerr.client';

vi.mock('axios');
const mockedAxios = axios as any;

describe('OverseerrClient', () => {
  let client: OverseerrClient;
  const mockConfig = {
    url: 'http://localhost:5055',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    client = new OverseerrClient(mockConfig);
    client['client'] = mockAxiosInstance as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return true when status is ok', async () => {
      client['client'].get.mockResolvedValueOnce({
        data: { status: 'ok' }
      });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(client['client'].get).toHaveBeenCalledWith('/status');
    });

    it('should return false on error', async () => {
      client['client'].get.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('searchMedia', () => {
    it('should return search results', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              id: 123,
              mediaType: 'movie',
              title: 'Test Movie',
              releaseDate: '2023-01-01',
              posterPath: '/poster.jpg'
            }
          ],
          totalPages: 1
        }
      };

      client['client'].get.mockResolvedValueOnce(mockResponse);

      const result = await client.searchMedia('Test Movie');

      expect(client['client'].get).toHaveBeenCalledWith('/search', {
        params: { query: 'Test Movie', page: 1 }
      });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Test Movie');
      expect(result.totalPages).toBe(1);
    });

    it('should throw error on search failure', async () => {
      client['client'].get.mockRejectedValueOnce(new Error('API error'));

      await expect(client.searchMedia('Test')).rejects.toThrow('Failed to search media');
    });
  });

  describe('requestMedia', () => {
    it('should submit media request successfully', async () => {
      const mockRequest = {
        mediaType: 'movie' as const,
        mediaId: 123
      };

      const mockResponse = {
        data: {
          id: 1,
          status: 1,
          media: {
            tmdbId: 123,
            status: 2,
            type: 'movie'
          },
          requestedBy: {
            email: 'user@example.com',
            username: 'testuser'
          },
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01'
        }
      };

      client['client'].post.mockResolvedValueOnce(mockResponse);

      const result = await client.requestMedia(mockRequest);

      expect(client['client'].post).toHaveBeenCalledWith('/request', mockRequest);
      expect(result.id).toBe(1);
      expect(result.media.tmdbId).toBe(123);
    });

    it('should handle already requested error', async () => {
      const error = {
        response: { status: 409 },
        config: { url: '/request' }
      };

      // Setup interceptor to throw error
      const interceptorCall = client['client'].interceptors.response.use.mock.calls[0];
      const errorHandler = interceptorCall[1];

      await expect(errorHandler(error)).rejects.toThrow('Media already requested');
    });
  });

  describe('getUserRequests', () => {
    it('should get user requests with pagination', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              id: 1,
              status: 2,
              media: { tmdbId: 123, type: 'movie', status: 3 },
              requestedBy: { email: 'user@example.com', username: 'testuser' },
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01'
            }
          ],
          pageInfo: {
            pages: 1,
            results: 1
          }
        }
      };

      client['client'].get.mockResolvedValueOnce(mockResponse);

      const result = await client.getUserRequests({ take: 10, skip: 0 });

      expect(client['client'].get).toHaveBeenCalledWith('/request', {
        params: { take: 10, skip: 0 }
      });
      expect(result.results).toHaveLength(1);
      expect(result.pageInfo.results).toBe(1);
    });
  });
});