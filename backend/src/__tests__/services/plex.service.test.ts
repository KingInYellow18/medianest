import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlexService } from '../../services/plex.service';
import { mockPrismaClient, mockRedisClient, mockAxios } from '../setup';

vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

vi.mock('axios', () => ({
  default: mockAxios,
  create: vi.fn(() => mockAxios),
}));

describe('PlexService', () => {
  let plexService: PlexService;

  beforeEach(() => {
    plexService = new PlexService();
  });

  describe('generatePin', () => {
    it('should generate a PIN successfully', async () => {
      const mockPinResponse = {
        data: {
          id: 12345,
          code: 'ABCD',
          expires_in: 1800,
          auth_token: null,
        },
      };

      mockAxios.post.mockResolvedValueOnce(mockPinResponse);

      const result = await plexService.generatePin();

      expect(result).toEqual({
        success: true,
        pin: mockPinResponse.data.code,
        id: mockPinResponse.data.id,
        expires_in: mockPinResponse.data.expires_in,
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://plex.tv/pins',
        expect.objectContaining({
          'X-Plex-Client-Identifier': expect.any(String),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Client-Identifier': expect.any(String),
          }),
        }),
      );
    });

    it('should handle PIN generation errors', async () => {
      mockAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await plexService.generatePin();

      expect(result).toEqual({
        success: false,
        error: 'Failed to generate PIN',
      });
    });

    it('should validate Plex API response structure', async () => {
      const invalidResponse = {
        data: {
          // missing required fields
        },
      };

      mockAxios.post.mockResolvedValueOnce(invalidResponse);

      const result = await plexService.generatePin();

      expect(result).toEqual({
        success: false,
        error: 'Invalid PIN response from Plex',
      });
    });
  });

  describe('checkPin', () => {
    it('should check PIN status and return auth token when ready', async () => {
      const pinId = 12345;
      const mockCheckResponse = {
        data: {
          id: pinId,
          code: 'ABCD',
          auth_token: 'test-auth-token',
          expires_in: 1500,
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockCheckResponse);

      const result = await plexService.checkPin(pinId);

      expect(result).toEqual({
        success: true,
        authToken: mockCheckResponse.data.auth_token,
        pinId: pinId,
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        `https://plex.tv/pins/${pinId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Client-Identifier': expect.any(String),
          }),
        }),
      );
    });

    it('should return pending status when PIN not yet authorized', async () => {
      const pinId = 12345;
      const mockCheckResponse = {
        data: {
          id: pinId,
          code: 'ABCD',
          auth_token: null,
          expires_in: 1500,
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockCheckResponse);

      const result = await plexService.checkPin(pinId);

      expect(result).toEqual({
        success: true,
        status: 'pending',
        pinId: pinId,
      });
    });

    it('should handle expired PINs', async () => {
      const pinId = 12345;
      const mockCheckResponse = {
        data: {
          id: pinId,
          code: 'ABCD',
          auth_token: null,
          expires_in: 0,
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockCheckResponse);

      const result = await plexService.checkPin(pinId);

      expect(result).toEqual({
        success: false,
        error: 'PIN expired',
      });
    });

    it('should handle PIN check network errors', async () => {
      const pinId = 12345;
      mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await plexService.checkPin(pinId);

      expect(result).toEqual({
        success: false,
        error: 'Failed to check PIN status',
      });
    });

    it('should validate PIN ID parameter', async () => {
      const result = await plexService.checkPin(null as any);

      expect(result).toEqual({
        success: false,
        error: 'Invalid PIN ID',
      });
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info with valid auth token', async () => {
      const authToken = 'valid-auth-token';
      const mockUserResponse = {
        data: {
          MediaContainer: {
            User: [
              {
                id: 12345,
                uuid: 'user-uuid',
                title: 'TestUser',
                username: 'testuser',
                email: 'test@example.com',
                thumb: 'https://plex.tv/users/avatar/test',
              },
            ],
          },
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockUserResponse);

      const result = await plexService.getUserInfo(authToken);

      expect(result).toEqual({
        success: true,
        user: {
          plexId: '12345',
          uuid: 'user-uuid',
          title: 'TestUser',
          username: 'testuser',
          email: 'test@example.com',
          avatar: 'https://plex.tv/users/avatar/test',
        },
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://plex.tv/users/account',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Plex-Token': authToken,
          }),
        }),
      );
    });

    it('should handle invalid auth tokens', async () => {
      const authToken = 'invalid-token';
      mockAxios.get.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      });

      const result = await plexService.getUserInfo(authToken);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired auth token',
      });
    });

    it('should handle malformed user info response', async () => {
      const authToken = 'valid-token';
      const invalidResponse = {
        data: {
          // missing MediaContainer.User
        },
      };

      mockAxios.get.mockResolvedValueOnce(invalidResponse);

      const result = await plexService.getUserInfo(authToken);

      expect(result).toEqual({
        success: false,
        error: 'Invalid user info response from Plex',
      });
    });

    it('should validate auth token parameter', async () => {
      const result = await plexService.getUserInfo('');

      expect(result).toEqual({
        success: false,
        error: 'Auth token is required',
      });
    });
  });

  describe('getServers', () => {
    it('should fetch user servers with auth token', async () => {
      const authToken = 'valid-auth-token';
      const mockServersResponse = {
        data: {
          MediaContainer: {
            Server: [
              {
                name: 'Home Media Server',
                host: '192.168.1.100',
                port: 32400,
                machineIdentifier: 'server-uuid-1',
                version: '1.32.0',
              },
              {
                name: 'Remote Server',
                host: 'remote.example.com',
                port: 32400,
                machineIdentifier: 'server-uuid-2',
                version: '1.31.0',
              },
            ],
          },
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockServersResponse);

      const result = await plexService.getServers(authToken);

      expect(result).toEqual({
        success: true,
        servers: mockServersResponse.data.MediaContainer.Server,
      });
    });

    it('should handle empty servers list', async () => {
      const authToken = 'valid-auth-token';
      const emptyResponse = {
        data: {
          MediaContainer: {
            Server: [],
          },
        },
      };

      mockAxios.get.mockResolvedValueOnce(emptyResponse);

      const result = await plexService.getServers(authToken);

      expect(result).toEqual({
        success: true,
        servers: [],
      });
    });

    it('should handle servers API errors', async () => {
      const authToken = 'invalid-token';
      mockAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await plexService.getServers(authToken);

      expect(result).toEqual({
        success: false,
        error: 'Failed to fetch servers',
      });
    });
  });

  describe('testConnection', () => {
    it('should test connection to Plex server successfully', async () => {
      const serverInfo = {
        host: '192.168.1.100',
        port: 32400,
        authToken: 'valid-token',
      };

      const mockConnectionResponse = {
        data: {
          MediaContainer: {
            machineIdentifier: 'test-server',
            version: '1.32.0',
          },
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockConnectionResponse);

      const result = await plexService.testConnection(serverInfo);

      expect(result).toEqual({
        success: true,
        server: mockConnectionResponse.data.MediaContainer,
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        `http://${serverInfo.host}:${serverInfo.port}`,
        expect.objectContaining({
          timeout: 5000,
          headers: expect.objectContaining({
            'X-Plex-Token': serverInfo.authToken,
          }),
        }),
      );
    });

    it('should handle connection timeouts', async () => {
      const serverInfo = {
        host: '192.168.1.100',
        port: 32400,
        authToken: 'valid-token',
      };

      mockAxios.get.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout',
      });

      const result = await plexService.testConnection(serverInfo);

      expect(result).toEqual({
        success: false,
        error: 'Connection timeout',
      });
    });

    it('should validate server info parameters', async () => {
      const invalidServerInfo = {
        host: '',
        port: 0,
        authToken: '',
      };

      const result = await plexService.testConnection(invalidServerInfo);

      expect(result).toEqual({
        success: false,
        error: 'Invalid server information',
      });
    });

    it('should handle different connection error types', async () => {
      const serverInfo = {
        host: '192.168.1.100',
        port: 32400,
        authToken: 'valid-token',
      };

      // Test connection refused
      mockAxios.get.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const result = await plexService.testConnection(serverInfo);

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
      });
    });
  });

  describe('caching', () => {
    it('should cache user info after successful fetch', async () => {
      const authToken = 'cached-token';
      const mockUserResponse = {
        data: {
          MediaContainer: {
            User: [
              {
                id: 12345,
                title: 'CachedUser',
                email: 'cached@example.com',
              },
            ],
          },
        },
      };

      mockAxios.get.mockResolvedValueOnce(mockUserResponse);
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      await plexService.getUserInfo(authToken);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        `plex:user:${authToken}`,
        3600, // 1 hour cache
        expect.any(String),
      );
    });

    it('should return cached user info when available', async () => {
      const authToken = 'cached-token';
      const cachedUserInfo = {
        plexId: '12345',
        title: 'CachedUser',
        email: 'cached@example.com',
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedUserInfo));

      const result = await plexService.getUserInfo(authToken);

      expect(result).toEqual({
        success: true,
        user: cachedUserInfo,
        cached: true,
      });

      // Should not make API call
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
  });
});
