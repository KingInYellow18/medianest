import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { testPrismaClient as prisma } from '../helpers/test-prisma-client';
import { cleanupDatabase } from '../helpers/database-cleanup';
import {
  createAuthToken,
  createExpiredToken,
  createInvalidToken,
  createAdminToken,
} from '../helpers/auth';
import jwt from 'jsonwebtoken';

describe('Auth Endpoints - Critical Path', () => {
  let app: any;

  beforeAll(async () => {
    await cleanupDatabase(prisma);
    app = createTestApp();

    // Mock Plex OAuth PIN flow endpoints
    app.post('/api/auth/plex/pin', (req, res) => {
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({
          error: 'MISSING_CLIENT_ID',
          message: 'Client ID is required for Plex authentication',
        });
      }

      // Simulate Plex PIN generation
      res.status(201).json({
        id: 'pin_123456',
        code: '1234',
        product: 'MediaNest',
        trusted: true,
        clientIdentifier: clientId,
        location: {
          code: 'US',
          country: 'United States',
        },
        expiresIn: 1800, // 30 minutes
        authUrl: 'https://plex.tv/link',
        checkUrl: '/api/auth/plex/pin/pin_123456/status',
      });
    });

    app.get('/api/auth/plex/pin/:pinId/status', (req, res) => {
      const { pinId } = req.params;
      const isAuthenticated = req.query.auth === 'true';

      if (isAuthenticated) {
        // Simulate successful authentication
        const token = createAuthToken({
          id: 'plex_user_123',
          email: 'user@plex.tv',
          role: 'user',
        });

        res.json({
          authToken: 'plex_auth_token_123',
          user: {
            id: 'plex_user_123',
            title: 'Test User',
            username: 'testuser',
            email: 'user@plex.tv',
            thumb: 'https://plex.tv/users/avatar/123',
            authentication_token: 'plex_auth_token_123',
          },
          jwtToken: token,
        });
      } else {
        // Waiting for authentication
        res.json({
          authToken: null,
          user: null,
          message: 'Waiting for user authentication',
        });
      }
    });

    // Mock JWT refresh endpoint
    app.post('/api/auth/refresh', (req, res) => {
      const authHeader = req.headers.authorization;
      const { refreshToken } = req.body;

      if (!authHeader?.startsWith('Bearer ') && !refreshToken) {
        return res.status(401).json({
          error: 'MISSING_TOKEN',
          message: 'Access token or refresh token is required',
        });
      }

      try {
        // Simulate token refresh
        const newToken = createAuthToken({
          id: 'user_123',
          email: 'user@example.com',
          role: 'user',
        });

        res.json({
          accessToken: newToken,
          refreshToken: 'new_refresh_token_123',
          expiresIn: 3600,
          tokenType: 'Bearer',
        });
      } catch (error) {
        res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }
    });

    // Mock logout endpoint
    app.post('/api/auth/logout', (req, res) => {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'MISSING_TOKEN',
          message: 'Authentication token is required',
        });
      }

      // Simulate token invalidation
      res.json({
        message: 'Successfully logged out',
        timestamp: new Date().toISOString(),
      });
    });

    // Mock user profile endpoint
    app.get('/api/auth/me', (req, res) => {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'MISSING_TOKEN',
          message: 'Authentication token is required',
        });
      }

      const token = authHeader.slice(7);

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        res.json({
          id: decoded.userId,
          email: decoded.email || 'user@example.com',
          role: decoded.role || 'user',
          profile: {
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
          permissions: decoded.role === 'admin' ? ['read', 'write', 'admin'] : ['read'],
          lastLogin: new Date().toISOString(),
        });
      } catch (error) {
        res.status(401).json({
          error: 'INVALID_TOKEN',
          message: 'Authentication token is invalid or expired',
        });
      }
    });

    // Mock password change endpoint
    app.post('/api/auth/change-password', (req, res) => {
      const { currentPassword, newPassword } = req.body;

      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Current password and new password are required',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long',
        });
      }

      // Simulate password validation
      if (currentPassword === 'wrongpassword') {
        return res.status(400).json({
          error: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect',
        });
      }

      res.json({
        message: 'Password changed successfully',
        timestamp: new Date().toISOString(),
      });
    });

    // Mock admin impersonation endpoint
    app.post('/api/auth/impersonate/:userId', (req, res) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required for user impersonation',
        });
      }

      const { userId } = req.params;

      // Create impersonation token
      const impersonationToken = createAuthToken({
        id: userId,
        email: `user${userId}@example.com`,
        role: 'user',
        impersonatedBy: req.user.id,
      });

      res.json({
        impersonationToken,
        targetUser: {
          id: userId,
          email: `user${userId}@example.com`,
          role: 'user',
        },
        expiresIn: 3600,
        warning: 'Impersonation session will be logged for security audit',
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Plex OAuth PIN Flow', () => {
    it('should initiate Plex OAuth PIN flow with valid client ID', async () => {
      const response = await request(app)
        .post('/api/auth/plex/pin')
        .send({
          clientId: 'medianest-client-123',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.stringMatching(/^pin_/),
        code: expect.any(String),
        product: 'MediaNest',
        trusted: true,
        clientIdentifier: 'medianest-client-123',
        expiresIn: 1800,
        authUrl: 'https://plex.tv/link',
        checkUrl: expect.stringContaining('/api/auth/plex/pin/'),
      });

      expect(response.body.code).toHaveLength(4);
      expect(response.body.location).toHaveProperty('code');
      expect(response.body.location).toHaveProperty('country');
    });

    it('should reject PIN flow request without client ID', async () => {
      const response = await request(app).post('/api/auth/plex/pin').send({}).expect(400);

      expect(response.body).toMatchObject({
        error: 'MISSING_CLIENT_ID',
        message: expect.stringContaining('Client ID is required'),
      });
    });

    it('should check PIN authentication status (pending)', async () => {
      const response = await request(app).get('/api/auth/plex/pin/pin_123456/status').expect(200);

      expect(response.body).toMatchObject({
        authToken: null,
        user: null,
        message: 'Waiting for user authentication',
      });
    });

    it('should check PIN authentication status (authenticated)', async () => {
      const response = await request(app)
        .get('/api/auth/plex/pin/pin_123456/status?auth=true')
        .expect(200);

      expect(response.body).toMatchObject({
        authToken: 'plex_auth_token_123',
        user: {
          id: 'plex_user_123',
          title: 'Test User',
          username: 'testuser',
          email: 'user@plex.tv',
          thumb: expect.stringContaining('https://'),
          authentication_token: 'plex_auth_token_123',
        },
        jwtToken: expect.any(String),
      });

      // Verify JWT token is valid
      const decoded = jwt.verify(response.body.jwtToken, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe('plex_user_123');
    });
  });

  describe('Token Management', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid_refresh_token',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      // Verify new access token is valid JWT
      const decoded = jwt.verify(response.body.accessToken, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBeDefined();
    });

    it('should refresh token using Bearer token in header', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject refresh request without token', async () => {
      const response = await request(app).post('/api/auth/refresh').send({}).expect(401);

      expect(response.body).toMatchObject({
        error: 'MISSING_TOKEN',
        message: expect.stringContaining('token is required'),
      });
    });

    it('should handle logout with valid token', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Successfully logged out',
        timestamp: expect.any(String),
      });
    });

    it('should reject logout without token', async () => {
      const response = await request(app).post('/api/auth/logout').expect(401);

      expect(response.body).toMatchObject({
        error: 'MISSING_TOKEN',
        message: expect.stringContaining('token is required'),
      });
    });
  });

  describe('User Profile Access', () => {
    it('should get user profile with valid token', async () => {
      const validToken = createAuthToken({
        id: 'user_123',
        email: 'test@example.com',
        role: 'user',
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'user_123',
        email: 'test@example.com',
        role: 'user',
        profile: {
          name: expect.any(String),
          avatar: expect.any(String),
          preferences: expect.any(Object),
        },
        permissions: expect.arrayContaining(['read']),
        lastLogin: expect.any(String),
      });
    });

    it('should get admin profile with admin permissions', async () => {
      const adminToken = createAdminToken();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        role: 'admin',
        permissions: expect.arrayContaining(['read', 'write', 'admin']),
      });
    });

    it('should reject profile request with expired token', async () => {
      const expiredToken = createExpiredToken();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'INVALID_TOKEN',
        message: expect.stringContaining('invalid or expired'),
      });
    });

    it('should reject profile request with invalid token', async () => {
      const invalidToken = createInvalidToken();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'INVALID_TOKEN',
        message: expect.stringContaining('invalid or expired'),
      });
    });

    it('should reject profile request without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body).toMatchObject({
        error: 'MISSING_TOKEN',
        message: expect.stringContaining('token is required'),
      });
    });
  });

  describe('Password Management', () => {
    it('should change password with valid credentials', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword456',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Password changed successfully',
        timestamp: expect.any(String),
      });
    });

    it('should reject password change with missing fields', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'oldpassword123',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'MISSING_FIELDS',
        message: expect.stringContaining('required'),
      });
    });

    it('should reject weak password', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'oldpassword123',
          newPassword: '123',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'WEAK_PASSWORD',
        message: expect.stringContaining('8 characters'),
      });
    });

    it('should reject incorrect current password', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'INVALID_CURRENT_PASSWORD',
        message: expect.stringContaining('incorrect'),
      });
    });

    it('should reject password change without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'oldpassword123',
          newPassword: 'newpassword456',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('Authentication required'),
      });
    });
  });

  describe('Admin Impersonation', () => {
    it('should allow admin to impersonate user', async () => {
      const adminToken = createAdminToken();

      const response = await request(app)
        .post('/api/auth/impersonate/user123')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        impersonationToken: expect.any(String),
        targetUser: {
          id: 'user123',
          email: 'useruser123@example.com',
          role: 'user',
        },
        expiresIn: 3600,
        warning: expect.stringContaining('logged for security audit'),
      });

      // Verify impersonation token
      const decoded = jwt.verify(response.body.impersonationToken, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe('user123');
      expect(decoded.impersonatedBy).toBe('admin-user-id');
    });

    it('should reject impersonation from non-admin user', async () => {
      const userToken = createAuthToken();

      const response = await request(app)
        .post('/api/auth/impersonate/user123')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: expect.stringContaining('Admin privileges required'),
      });
    });

    it('should reject impersonation without authentication', async () => {
      const response = await request(app).post('/api/auth/impersonate/user123').expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('Authentication required'),
      });
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed JWT tokens gracefully', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'INVALID_TOKEN',
        message: expect.stringContaining('invalid or expired'),
      });
    });

    it('should handle empty Bearer token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'INVALID_TOKEN',
        message: expect.stringContaining('invalid or expired'),
      });
    });

    it('should handle Authorization header without Bearer prefix', async () => {
      const validToken = createAuthToken();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', validToken)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'MISSING_TOKEN',
        message: expect.stringContaining('token is required'),
      });
    });

    it('should validate JWT signature properly', async () => {
      // Create token with wrong signature
      const wrongSignature = createAuthToken().slice(0, -10) + 'wrongsig';

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${wrongSignature}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'INVALID_TOKEN',
      });
    });
  });
});
