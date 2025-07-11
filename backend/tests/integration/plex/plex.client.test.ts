import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { PlexClient } from '@/integrations/plex/plex.client';

vi.mock('axios');
const mockedAxios = axios as any;

describe('PlexClient', () => {
  let plexClient: PlexClient;
  const mockServerUrl = 'http://localhost:32400';
  const mockPlexToken = 'test-token';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock axios instance
    const mockAxiosInstance = {
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    plexClient = new PlexClient(mockServerUrl, mockPlexToken);
    plexClient['client'] = mockAxiosInstance as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      new PlexClient(mockServerUrl, mockPlexToken);
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockServerUrl,
        timeout: 5000,
        headers: expect.objectContaining({
          'X-Plex-Token': mockPlexToken,
          'X-Plex-Product': 'MediaNest',
          'Accept': 'application/json'
        })
      });
    });

    it('should remove trailing slash from server URL', () => {
      new PlexClient('http://localhost:32400/', mockPlexToken);
      
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:32400'
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return server info on success', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            friendlyName: 'My Plex Server',
            machineIdentifier: 'abc123',
            version: '1.32.0',
            platform: 'Linux',
            updatedAt: 1234567890
          }
        }
      };

      plexClient['client'].get.mockResolvedValueOnce(mockResponse);

      const result = await plexClient.testConnection();

      expect(plexClient['client'].get).toHaveBeenCalledWith('/');
      expect(result).toEqual({
        name: 'My Plex Server',
        machineIdentifier: 'abc123',
        version: '1.32.0',
        platform: 'Linux',
        updatedAt: 1234567890
      });
    });

    it('should throw error on connection failure', async () => {
      plexClient['client'].get.mockRejectedValueOnce(new Error('Network error'));

      await expect(plexClient.testConnection()).rejects.toThrow(
        'Failed to connect to Plex server: Network error'
      );
    });
  });

  describe('getLibraries', () => {
    it('should return list of libraries', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            Directory: [
              { key: '1', type: 'movie', title: 'Movies', uuid: 'uuid1', updatedAt: 123 },
              { key: '2', type: 'show', title: 'TV Shows', uuid: 'uuid2', updatedAt: 456 }
            ]
          }
        }
      };

      plexClient['client'].get.mockResolvedValueOnce(mockResponse);

      const result = await plexClient.getLibraries();

      expect(plexClient['client'].get).toHaveBeenCalledWith('/library/sections');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: '1',
        type: 'movie',
        title: 'Movies',
        uuid: 'uuid1',
        updatedAt: 123
      });
    });
  });

  describe('search', () => {
    it('should return search results', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {
            Metadata: [
              {
                ratingKey: '123',
                key: '/library/metadata/123',
                guid: 'plex://movie/123',
                type: 'movie',
                title: 'Test Movie',
                year: 2023,
                addedAt: 1234567890
              }
            ]
          }
        }
      };

      plexClient['client'].get.mockResolvedValueOnce(mockResponse);

      const result = await plexClient.search('Test Movie');

      expect(plexClient['client'].get).toHaveBeenCalledWith(
        expect.stringContaining('/search?query=Test%20Movie')
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Movie');
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        data: {
          MediaContainer: {}
        }
      };

      plexClient['client'].get.mockResolvedValueOnce(mockResponse);

      const result = await plexClient.search('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle 401 errors', async () => {
      const error = {
        response: { status: 401, data: {} },
        config: { url: '/test' }
      };

      // Setup interceptor to throw error
      const interceptorCall = plexClient['client'].interceptors.response.use.mock.calls[0];
      const errorHandler = interceptorCall[1];

      await expect(errorHandler(error)).rejects.toThrow('Invalid or expired Plex token');
    });

    it('should handle timeout errors', async () => {
      const error = {
        code: 'ECONNABORTED',
        config: { url: '/test' }
      };

      const interceptorCall = plexClient['client'].interceptors.response.use.mock.calls[0];
      const errorHandler = interceptorCall[1];

      await expect(errorHandler(error)).rejects.toThrow('Plex server timeout');
    });
  });
});