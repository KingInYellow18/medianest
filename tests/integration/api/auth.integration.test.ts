/**
 * AUTH API INTEGRATION TESTS
 * 
 * Comprehensive integration tests for authentication endpoints covering:
 * - Complete authentication workflows
 * - End-to-end token management
 * - Real middleware integration
 * - Database and Redis interaction
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { App } from '../../../backend/src/app';
import { jwtTestHelpers } from '../../mocks/jwt-mock';
import { userMockHelpers } from '../../mocks/prisma-mock';
import { createMockUser } from '../../mocks/auth-mock';

describe('Auth API Integration Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    // Initialize test app
    const appInstance = new App();
    app = appInstance.express;
    server = app.listen(0); // Random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'TestPassword123!',
        rememberMe: false,
      };

      const mockUser = createMockUser({
        email: loginData.email,
        status: 'active',
      });

      // Mock user lookup
      userMockHelpers.mockFindUserByEmail(loginData.email, mockUser);

      // Mock password verification
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            role: mockUser.role,
          }),
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          },
        },
        message: 'Login successful',
      });

      // Verify tokens are valid JWT format
      expect(response.body.data.tokens.accessToken.split('.')).toHaveLength(3);
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'WrongPassword123!',
      };

      // Mock user not found
      userMockHelpers.mockUserNotFound();

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid credentials',
          statusCode: 401,
        },
      });
    });

    it('should return 403 for inactive user account', async () => {
      const loginData = {
        email: 'inactive@medianest.com',
        password: 'TestPassword123!',
      };

      const inactiveUser = createMockUser({
        email: loginData.email,
        status: 'inactive',
      });

      userMockHelpers.mockFindUserByEmail(loginData.email, inactiveUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Account is inactive',
          statusCode: 403,
        },
      });
    });

    it('should validate required fields', async () => {
      const invalidRequests = [
        {}, // Missing all fields
        { email: 'test@medianest.com' }, // Missing password
        { password: 'TestPassword123!' }, // Missing email
        { email: '', password: 'TestPassword123!' }, // Empty email
        { email: 'test@medianest.com', password: '' }, // Empty password
        { email: 'invalid-email', password: 'TestPassword123!' }, // Invalid email
      ];

      for (const invalidData of invalidRequests) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(invalidData)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            statusCode: 400,
          },
        });
      }
    });

    it('should handle remember me functionality', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'TestPassword123!',
        rememberMe: true,
      };

      const mockUser = createMockUser({ email: loginData.email });
      userMockHelpers.mockFindUserByEmail(loginData.email, mockUser);

      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Should receive tokens with longer expiry (verified in JWT generation logic)
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should rate limit login attempts', async () => {
      const loginData = {
        email: 'test@medianest.com',
        password: 'WrongPassword123!',
      };

      // Mock rate limit exceeded
      const { rateLimitMockHelpers } = await import('../../mocks/redis-mock');
      rateLimitMockHelpers.mockRateLimitExceeded();

      userMockHelpers.mockUserNotFound();

      // Make multiple rapid requests
      const promises = Array(6).fill(0).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);

      // At least one should be rate limited
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          success: false,
          error: {
            statusCode: 429,
            message: expect.stringContaining('Too many requests'),
          },
        });
      }
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const user = createMockUser();
      const token = jwtTestHelpers.createValidToken({ userId: user.id });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401,
        },
      });
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401,
        },
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const user = createMockUser();
      const refreshToken = jwtTestHelpers.createRefreshToken({
        userId: user.id,
        sessionId: 'test-session-id',
      });

      // Mock user lookup for refresh
      userMockHelpers.mockFindUserById(user.id, user);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            id: user.id,
            email: user.email,
          }),
        },
        message: 'Token refreshed successfully',
      });
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401,
        },
      });
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 400,
        },
      });
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const user = createMockUser();
      const token = jwtTestHelpers.createValidToken({ userId: user.id });

      // Mock user lookup
      userMockHelpers.mockFindUserById(user.id, user);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: expect.objectContaining({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plexId: user.plexId,
            plexUsername: user.plexUsername,
          }),
        },
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401,
        },
      });
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwtTestHelpers.createExpiredToken();

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401,
          message: expect.stringContaining('expired'),
        },
      });
    });
  });

  describe('POST /api/auth/validate-token', () => {
    it('should validate valid token', async () => {
      const user = createMockUser();
      const token = jwtTestHelpers.createValidToken({ userId: user.id });

      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ token })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          valid: true,
          payload: expect.objectContaining({
            userId: user.id,
          }),
        },
        message: 'Token is valid',
      });
    });

    it('should return invalid for bad token', async () => {
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({ token: 'invalid-token' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          valid: false,
          error: expect.any(String),
        },
        message: 'Token validation completed',
      });
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/validate-token')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 400,
        },
      });
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const user = createMockUser();
      const token = jwtTestHelpers.createValidToken({ userId: user.id });
      
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      // Mock user lookup
      userMockHelpers.mockFindUserById(user.id, {
        ...user,
        password: 'hashed-old-password',
      });

      // Mock user update
      userMockHelpers.mockUpdateUser(user.id, { password: 'hashed-new-password' });

      // Mock bcrypt operations
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-new-password');

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('should return 400 for incorrect current password', async () => {
      const user = createMockUser();
      const token = jwtTestHelpers.createValidToken({ userId: user.id });
      
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      userMockHelpers.mockFindUserById(user.id, user);

      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 400,
          message: 'Current password is incorrect',
        },
      });
    });

    it('should return 400 for password confirmation mismatch', async () => {
      const user = createMockUser();
      const token = jwtTestHelpers.createValidToken({ userId: user.id });
      
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 400,
        },
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const response = await request(app)
        .put('/api/auth/change-password')
        .send(passwordData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 401,
        },
      });
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid json')
        .type('json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 400,
        },
      });
    });

    it('should handle database connection errors', async () => {
      // Mock database connection failure
      const { errorMockHelpers } = await import('../../mocks/prisma-mock');
      
      userMockHelpers.mockFindUserByEmail.mockRejectedValue(
        errorMockHelpers.mockConnectionError()
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@medianest.com',
          password: 'TestPassword123!',
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 500,
        },
      });
    });
  });
});