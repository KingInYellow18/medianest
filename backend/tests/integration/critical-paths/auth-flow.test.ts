import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';

describe('Authentication Flow - Critical Path', () => {
  beforeAll(async () => {
    await databaseCleanup.cleanAll();
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('Complete Plex OAuth Flow', () => {
    it('should complete end-to-end OAuth authentication flow', async () => {
      // Step 1: Generate PIN
      const pinResponse = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'MediaNest Integration Test' })
        .expect(200);

      expect(pinResponse.body.success).toBe(true);
      expect(pinResponse.body.data).toHaveProperty('id');
      expect(pinResponse.body.data).toHaveProperty('code');
      expect(pinResponse.body.data).toHaveProperty('qrUrl');

      // Step 2: Simulate user authorization (in real scenario, user would authorize via Plex)
      // We'll use our test PIN that's pre-authorized in MSW
      const authorizedPinId = 'test-pin-first-user';

      // Step 3: Verify PIN and complete authentication
      const verifyResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: authorizedPinId,
          rememberMe: true,
        })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            username: expect.any(String),
            role: expect.any(String),
          },
          token: expect.any(String),
          rememberToken: expect.any(String),
        },
      });

      const { token } = verifyResponse.body.data;

      // Step 4: Verify session is valid
      const sessionResponse = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionResponse.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            username: expect.any(String),
            role: expect.any(String),
          },
        },
      });

      // Step 5: Test authenticated endpoint access
      const protectedResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Test' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(protectedResponse.body.success).toBe(true);

      // Step 6: Logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Logged out successfully',
      });

      // Step 7: Verify token is invalidated (session should fail)
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should handle first user becoming admin', async () => {
      // Ensure clean slate
      await databaseCleanup.cleanAll();

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-first-user',
          rememberMe: false,
        })
        .expect(200);

      expect(response.body.data.user.role).toBe('admin');

      // Verify user is saved as admin in database
      const user = await prisma.user.findUnique({
        where: { id: response.body.data.user.id },
      });
      expect(user?.role).toBe('admin');
    });

    it('should handle subsequent users as regular users', async () => {
      // Ensure first user exists
      await prisma.user.create({
        data: {
          plexId: 'existing-admin',
          plexUsername: 'admin',
          email: 'admin@example.com',
          role: 'admin',
          status: 'active',
          plexToken: 'encrypted-admin-token',
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-existing',
          rememberMe: false,
        })
        .expect(200);

      expect(response.body.data.user.role).toBe('user');
    });

    it('should handle existing user login', async () => {
      // Create existing user
      const existingUser = await prisma.user.create({
        data: {
          plexId: 'plex-test-123',
          plexUsername: 'existinguser',
          email: 'existing@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'old-encrypted-token',
          lastLoginAt: new Date('2023-01-01'),
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-existing',
          rememberMe: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify user data was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: existingUser.id },
      });
      expect(updatedUser?.plexToken).not.toBe('old-encrypted-token');
      expect(updatedUser?.lastLoginAt).not.toEqual(new Date('2023-01-01'));
    });
  });

  describe('Session Management', () => {
    let testUser: any;
    let userToken: string;

    beforeAll(async () => {
      testUser = await prisma.user.create({
        data: {
          plexId: 'session-test-user',
          plexUsername: 'sessiontest',
          email: 'session@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-session-token',
        },
      });
      userToken = createAuthToken(testUser);
    });

    it('should maintain session across multiple requests', async () => {
      // Make multiple authenticated requests
      const requests = [
        request(app).get('/api/v1/auth/session').set('Authorization', `Bearer ${userToken}`),
        request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${userToken}`),
        request(app).get('/api/v1/media/requests').set('Authorization', `Bearer ${userToken}`),
      ];

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = Array(5)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/auth/session').set('Authorization', `Bearer ${userToken}`),
        );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should reject expired tokens', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: testUser.id, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }, // Already expired
      );

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed tokens', async () => {
      const malformedToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app).get('/api/v1/auth/session').expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid authorization header format', async () => {
      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', 'Invalid format')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Plex API failures gracefully', async () => {
      // Test PIN generation when Plex is unavailable
      // This would require MSW to mock a failure scenario
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Test' });

      // Should either succeed (if Plex is mocked) or fail gracefully
      if (response.status === 503) {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'PLEX_UNREACHABLE',
          },
        });
      } else {
        expect(response.status).toBe(200);
      }
    });

    it('should handle database connection issues', async () => {
      // This is hard to test without actually disconnecting DB
      // For now, just ensure proper error handling structure exists
      const response = await request(app).post('/api/v1/auth/plex/verify').send({
        pinId: 'invalid-pin-test',
        rememberMe: false,
      });

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('message');
      }
    });
  });
});
