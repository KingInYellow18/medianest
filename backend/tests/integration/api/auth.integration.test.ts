import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../dist/app';
import { mockPrisma, mockRedis } from '../../setup';

// Integration test for auth endpoints
describe('Auth API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/pin/generate', () => {
    it('should generate Plex PIN successfully', async () => {
      // Arrange
      const mockAxios = await import('axios');
      (mockAxios.default.post as any).mockResolvedValue({
        data: '<response><id>12345</id><code>ABCD1234</code><expires_at>2024-01-01</expires_at></response>',
        status: 200
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/generate')
        .send({ clientName: 'Test Client' })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          pinId: '12345',
          code: 'ABCD1234',
          url: expect.stringContaining('plex.tv/link')
        }
      });
    });

    it('should handle missing client name with default', async () => {
      // Arrange
      const mockAxios = await import('axios');
      (mockAxios.default.post as any).mockResolvedValue({
        data: '<response><id>12345</id><code>ABCD1234</code></response>',
        status: 200
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/generate')
        .send({})
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.pinId).toBe('12345');
    });

    it('should handle Plex API errors', async () => {
      // Arrange
      const mockAxios = await import('axios');
      (mockAxios.default.post as any).mockRejectedValue({
        response: { status: 500, data: 'Internal Server Error' }
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/generate')
        .send({ clientName: 'Test Client' })
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should validate request body', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/generate')
        .send({ clientName: 123 }) // Invalid type
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('POST /api/v1/auth/pin/verify', () => {
    it('should verify PIN and create user session', async () => {
      // Arrange
      const mockAxios = await import('axios');
      (mockAxios.default.get as any)
        .mockResolvedValueOnce({
          data: '<response><id>12345</id><auth_token>test-auth-token</auth_token></response>',
          status: 200
        })
        .mockResolvedValueOnce({
          data: {
            user: {
              id: 'test-plex-user-id',
              email: 'test@plex.tv',
              username: 'testuser'
            }
          },
          status: 200
        });

      // Mock user repository
      const mockUserRepository = {
        findByPlexId: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'new-user-id',
          plexId: 'test-plex-user-id',
          email: 'test@plex.tv',
          role: 'user',
          status: 'active'
        })
      };

      // Mock JWT service
      const mockJWTService = {
        generateAccessToken: vi.fn().mockResolvedValue('access-token'),
        generateRefreshToken: vi.fn().mockResolvedValue('refresh-token')
      };

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/verify')
        .send({ pinId: '12345', rememberMe: true })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          user: expect.objectContaining({
            id: expect.any(String),
            plexId: expect.any(String)
          }),
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String)
          }
        }
      });
    });

    it('should handle existing user login', async () => {
      // Arrange
      const mockAxios = await import('axios');
      (mockAxios.default.get as any)
        .mockResolvedValueOnce({
          data: '<response><id>12345</id><auth_token>test-auth-token</auth_token></response>',
          status: 200
        })
        .mockResolvedValueOnce({
          data: {
            user: {
              id: 'existing-plex-user-id',
              email: 'existing@plex.tv',
              username: 'existinguser'
            }
          },
          status: 200
        });

      // Mock existing user
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        plexId: 'existing-plex-user-id',
        email: 'existing@plex.tv',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/verify')
        .send({ pinId: '12345', rememberMe: false })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe('existing-user-id');
    });

    it('should handle PIN verification failure', async () => {
      // Arrange
      const mockAxios = await import('axios');
      (mockAxios.default.get as any).mockRejectedValue({
        response: { status: 404, data: 'PIN not found' }
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/verify')
        .send({ pinId: 'invalid-pin' })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('PIN verification failed');
    });

    it('should validate required fields', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/verify')
        .send({}) // Missing pinId
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      mockPrisma.sessionToken.findUnique.mockResolvedValue({
        id: 'session-id',
        userId: 'test-user-id',
        token: 'old-refresh-token',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'old-refresh-token' })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String)
          }
        }
      });
    });

    it('should handle invalid refresh token', async () => {
      // Arrange
      mockPrisma.sessionToken.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid refresh token');
    });

    it('should handle expired refresh token', async () => {
      // Arrange
      mockPrisma.sessionToken.findUnique.mockResolvedValue({
        id: 'session-id',
        userId: 'test-user-id',
        token: 'expired-token',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000) // Expired
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'expired-token' })
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Refresh token expired');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with refresh token', async () => {
      // Arrange
      mockPrisma.sessionToken.delete.mockResolvedValue({
        id: 'session-id',
        userId: 'test-user-id',
        token: 'refresh-token-to-delete',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date()
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'refresh-token-to-delete' })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully'
      });
      expect(mockPrisma.sessionToken.delete).toHaveBeenCalledWith({
        where: { token: 'refresh-token-to-delete' }
      });
    });

    it('should handle logout without refresh token gracefully', async () => {
      // Act
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({})
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully'
      });
      expect(mockPrisma.sessionToken.delete).not.toHaveBeenCalled();
    });

    it('should handle non-existent refresh token gracefully', async () => {
      // Arrange
      const dbError = new Error('Record to delete does not exist');
      (dbError as any).code = 'P2025';
      mockPrisma.sessionToken.delete.mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'nonexistent-token' })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication middleware integration', () => {
    it('should protect authenticated routes', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/user/profile') // Assuming this is a protected route
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });

    it('should allow access with valid token', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        plexId: 'test-plex-id',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Act
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate limiting integration', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      // This test would require configuring rate limiting mocks
      // and making multiple requests to trigger the limit
      
      // Setup rate limit exceeded in Redis
      mockRedis.incr.mockResolvedValue(11); // Assuming limit is 10
      mockRedis.ttl.mockResolvedValue(60);

      // Act
      const response = await request(app)
        .post('/api/v1/auth/pin/generate')
        .send({ clientName: 'Test Client' })
        .expect(429);

      // Assert
      expect(response.body.error).toContain('Too many requests');
    });
  });
});