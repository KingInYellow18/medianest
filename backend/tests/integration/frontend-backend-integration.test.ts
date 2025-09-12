/**
 * MediaNest Frontend-Backend Integration Tests
 *
 * Comprehensive integration testing between frontend and backend:
 * - API contract validation
 * - Data flow testing between services
 * - Authentication token handling
 * - Error propagation testing
 * - WebSocket real-time communication
 * - File upload/download workflows
 */

import fs from 'fs/promises';
import path from 'path';

import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import FormData from 'form-data';
import Redis from 'ioredis';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';


import { createApp } from '@/app';

import { testUsers } from '../fixtures/test-data';
import { APIContractValidator } from '../helpers/api-contract-validator';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { RedisTestHelper } from '../helpers/redis-test-helper';

import { AuthService } from '@/services/auth.service';

describe('Frontend-Backend Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let redis: Redis;
  let dbHelper: DatabaseTestHelper;
  let redisHelper: RedisTestHelper;
  let contractValidator: APIContractValidator;

  // Test authentication tokens
  let userToken: string;
  let adminToken: string;
  let userInfo: any;
  let adminInfo: any;

  beforeAll(async () => {
    // Initialize test environment
    app = await createApp({ env: 'test' });
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/medianest_test',
        },
      },
    });

    redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6380');

    // Initialize helpers
    dbHelper = new DatabaseTestHelper(prisma);
    redisHelper = new RedisTestHelper(redis);
    contractValidator = new APIContractValidator();

    // Setup test environment
    await dbHelper.setupTestDatabase();
    await redisHelper.clearTestData();

    // Create test users and generate tokens
    const authService = new AuthService();

    userInfo = await dbHelper.createTestUser(testUsers[0]);
    adminInfo = await dbHelper.createTestUser(testUsers[1]);

    userToken = await authService.generateToken(userInfo);
    adminToken = await authService.generateToken(adminInfo);
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await redisHelper.cleanup();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await dbHelper.clearTestData();
    await redisHelper.clearTestData();
  });

  describe('API Contract Validation', () => {
    test('should validate authentication endpoints contract', async () => {
      // Test login endpoint
      const loginResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      const loginContract = await contractValidator.validateResponse(
        loginResponse,
        'AuthPinResponse',
      );
      expect(loginContract.isValid).toBe(true);
      expect(loginContract.errors).toHaveLength(0);

      // Test session endpoint
      const sessionResponse = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const sessionContract = await contractValidator.validateResponse(
        sessionResponse,
        'SessionResponse',
      );
      expect(sessionContract.isValid).toBe(true);

      // Test profile endpoint
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const profileContract = await contractValidator.validateResponse(
        profileResponse,
        'UserProfileResponse',
      );
      expect(profileContract.isValid).toBe(true);
      expect(profileContract.data.user.id).toBe(userInfo.id);
    });

    test('should validate media endpoints contract', async () => {
      // Test search endpoint
      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test movie', page: 1, pageSize: 20 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const searchContract = await contractValidator.validateResponse(
        searchResponse,
        'MediaSearchResponse',
      );
      expect(searchContract.isValid).toBe(true);
      expect(searchContract.data.results).toBeTruthy();
      expect(searchContract.data.pagination).toBeTruthy();

      // Test media details endpoint
      if (searchResponse.body.data.results.length > 0) {
        const movieId = searchResponse.body.data.results[0].id;
        const detailsResponse = await request(app)
          .get(`/api/v1/media/movie/${movieId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        const detailsContract = await contractValidator.validateResponse(
          detailsResponse,
          'MediaDetailsResponse',
        );
        expect(detailsContract.isValid).toBe(true);
      }

      // Test request creation endpoint
      const requestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 12345,
          title: 'Test Movie',
          quality: 'HD',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      const requestContract = await contractValidator.validateResponse(
        requestResponse,
        'MediaRequestResponse',
      );
      expect(requestContract.isValid).toBe(true);
      expect(requestContract.data.id).toBeTruthy();

      // Test request list endpoint
      const requestListResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, pageSize: 10 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const listContract = await contractValidator.validateResponse(
        requestListResponse,
        'MediaRequestListResponse',
      );
      expect(listContract.isValid).toBe(true);
      expect(Array.isArray(listContract.data.requests)).toBe(true);
    });

    test('should validate admin endpoints contract', async () => {
      // Test admin dashboard
      const dashboardResponse = await request(app)
        .get('/api/v1/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dashboardContract = await contractValidator.validateResponse(
        dashboardResponse,
        'AdminDashboardResponse',
      );
      expect(dashboardContract.isValid).toBe(true);
      expect(dashboardContract.data.stats).toBeTruthy();

      // Test user management
      const usersResponse = await request(app)
        .get('/api/v1/admin/users')
        .query({ page: 1, pageSize: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const usersContract = await contractValidator.validateResponse(
        usersResponse,
        'AdminUsersResponse',
      );
      expect(usersContract.isValid).toBe(true);
      expect(Array.isArray(usersContract.data.users)).toBe(true);

      // Test request management
      const adminRequestsResponse = await request(app)
        .get('/api/v1/admin/requests')
        .query({ status: 'pending', page: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminRequestsContract = await contractValidator.validateResponse(
        adminRequestsResponse,
        'AdminRequestsResponse',
      );
      expect(adminRequestsContract.isValid).toBe(true);
    });

    test('should maintain contract consistency across versions', async () => {
      // Test v1 endpoints
      const v1Response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Compare with expected contract
      const v1Contract = await contractValidator.validateResponse(
        v1Response,
        'UserProfileResponse',
      );
      expect(v1Contract.isValid).toBe(true);

      // Verify backwards compatibility fields are present
      expect(v1Contract.data.user).toHaveProperty('id');
      expect(v1Contract.data.user).toHaveProperty('plexUsername');
      expect(v1Contract.data.user).toHaveProperty('email');
      expect(v1Contract.data.user).toHaveProperty('role');
      expect(v1Contract.data.user).toHaveProperty('status');
    });
  });

  describe('Data Flow Testing', () => {
    test('should handle complete user registration flow', async () => {
      // 1. User initiates Plex OAuth
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      expect(pinResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          code: expect.any(String),
        }),
      });

      const pinId = pinResponse.body.data.id;

      // 2. User authorizes PIN and backend verifies
      const verifyResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId, mockToken: 'new-user-token' })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            id: expect.any(String),
            isNewUser: true,
          }),
        }),
      });

      const newUserToken = verifyResponse.body.data.token;
      const newUserId = verifyResponse.body.data.user.id;

      // 3. New user completes profile setup
      const profileSetupResponse = await request(app)
        .put('/api/v1/auth/profile')
        .send({
          displayName: 'New Test User',
          preferences: {
            notifications: true,
            language: 'en',
          },
        })
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(profileSetupResponse.body.data.user.displayName).toBe('New Test User');

      // 4. Verify user can access protected resources
      const protectedResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(protectedResponse.body.success).toBe(true);

      // 5. Verify user data is properly stored
      const dbUser = await prisma.user.findUnique({
        where: { id: newUserId },
        include: { profile: true },
      });

      expect(dbUser).toBeTruthy();
      expect(dbUser!.status).toBe('active');
      expect(dbUser!.profile?.displayName).toBe('New Test User');
    });

    test('should handle media request approval workflow', async () => {
      // 1. User creates media request
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 54321,
          title: 'Workflow Test Movie',
          quality: 'HD',
          notes: 'Please approve this test request',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // 2. Verify request appears in user's list
      const userRequestsResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userRequests = userRequestsResponse.body.data.requests;
      const userRequest = userRequests.find((req: any) => req.id === requestId);
      expect(userRequest).toBeTruthy();
      expect(userRequest.status).toBe('pending');

      // 3. Admin sees request in admin panel
      const adminRequestsResponse = await request(app)
        .get('/api/v1/admin/requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminRequests = adminRequestsResponse.body.data.requests;
      const adminRequest = adminRequests.find((req: any) => req.id === requestId);
      expect(adminRequest).toBeTruthy();
      expect(adminRequest.user.id).toBe(userInfo.id);

      // 4. Admin approves request
      const approvalResponse = await request(app)
        .put(`/api/v1/admin/requests/${requestId}/approve`)
        .send({
          notes: 'Approved for download',
          priority: 'normal',
          estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(approvalResponse.body.data.status).toBe('approved');
      expect(approvalResponse.body.data.approvedBy).toBe(adminInfo.id);

      // 5. User sees updated status
      const updatedRequestResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedRequestResponse.body.data.status).toBe('approved');
      expect(updatedRequestResponse.body.data.adminNotes).toBe('Approved for download');

      // 6. Verify notification was queued
      const notificationKey = `notification:${userInfo.id}:request_approved`;
      const notification = await redis.get(notificationKey);
      expect(notification).toBeTruthy();

      // 7. Verify status history is maintained
      const requestWithHistory = await prisma.mediaRequest.findUnique({
        where: { id: requestId },
        include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      });

      expect(requestWithHistory!.statusHistory).toHaveLength(2);
      expect(requestWithHistory!.statusHistory[0].status).toBe('pending');
      expect(requestWithHistory!.statusHistory[1].status).toBe('approved');
    });

    test('should handle error propagation correctly', async () => {
      // Test validation error propagation
      const validationErrorResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'invalid-type',
          tmdbId: 'not-a-number',
          title: '', // empty title
          quality: 'INVALID_QUALITY',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(validationErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
          details: expect.any(Array),
        }),
      });

      expect(validationErrorResponse.body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'mediaType',
          message: expect.stringMatching(/invalid/i),
        }),
      );

      // Test authorization error propagation
      const authErrorResponse = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`) // user token for admin endpoint
        .expect(403);

      expect(authErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.stringMatching(/insufficient.*permission/i),
        }),
      });

      // Test not found error propagation
      const notFoundResponse = await request(app)
        .get('/api/v1/media/requests/99999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(notFoundResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringMatching(/request.*not found/i),
        }),
      });

      // Test server error propagation
      const serverErrorResponse = await request(app)
        .get('/api/v1/test/server-error') // Special endpoint that triggers server error
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(serverErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: expect.any(String),
        }),
      });
    });
  });

  describe('Authentication Token Handling', () => {
    test('should handle token lifecycle correctly', async () => {
      const authService = new AuthService();

      // 1. Generate new token
      const newUser = await dbHelper.createTestUser({
        id: 'token-test-user',
        plexId: 'token-plex-123',
        username: 'tokentest',
        email: 'token@test.com',
        role: 'user',
        status: 'active',
      });

      const newToken = await authService.generateToken(newUser);

      // 2. Verify token works
      const authenticatedResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(authenticatedResponse.body.data.user.id).toBe(newUser.id);

      // 3. Test token refresh
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      const refreshedToken = refreshResponse.body.data.token;
      expect(refreshedToken).not.toBe(newToken);

      // 4. Verify old token is invalidated (if using token blacklist)
      const oldTokenResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(401);

      expect(oldTokenResponse.body.success).toBe(false);

      // 5. Verify new token works
      const newTokenResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${refreshedToken}`)
        .expect(200);

      expect(newTokenResponse.body.data.user.id).toBe(newUser.id);

      // 6. Test token revocation
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${refreshedToken}`)
        .expect(200);

      // 7. Verify revoked token is invalid
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${refreshedToken}`)
        .expect(401);
    });

    test('should handle token expiration gracefully', async () => {
      const authService = new AuthService();

      // Generate short-lived token (1 second)
      const shortToken = await authService.generateToken(userInfo, { expiresIn: '1s' });

      // Token should work initially
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${shortToken}`)
        .expect(200);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Token should be expired
      const expiredResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${shortToken}`)
        .expect(401);

      expect(expiredResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'TOKEN_EXPIRED',
          message: expect.stringMatching(/token.*expired/i),
        }),
      });
    });

    test('should handle malformed tokens correctly', async () => {
      const malformedTokenTests = [
        { token: 'invalid-token', description: 'completely invalid token' },
        { token: 'Bearer invalid-token', description: 'malformed bearer token' },
        { token: '', description: 'empty token' },
        {
          token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          description: 'token with invalid signature',
        },
      ];

      for (const test of malformedTokenTests) {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${test.token}`)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: expect.stringMatching(/TOKEN_INVALID|INVALID_TOKEN/i),
          }),
        });
      }
    });

    test('should handle concurrent token operations safely', async () => {
      // Create multiple simultaneous requests with the same token
      const concurrentRequests = Array.from({ length: 10 }, () =>
        request(app).get('/api/v1/media/requests').set('Authorization', `Bearer ${userToken}`),
      );

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      results.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Test concurrent refresh operations
      const refreshRequests = Array.from({ length: 3 }, () =>
        request(app).post('/api/v1/auth/refresh').set('Authorization', `Bearer ${userToken}`),
      );

      const refreshResults = await Promise.all(refreshRequests);

      // At least one should succeed, others may fail due to token invalidation
      const successCount = refreshResults.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('WebSocket Integration', () => {
    test('should authenticate WebSocket connections', async () => {
      const wsUrl = `ws://localhost:3001/ws?token=${userToken}`;

      const ws = new WebSocket(wsUrl);

      const authMessage = await new Promise((resolve, reject) => {
        ws.on('open', () => {
          // Connection opened successfully
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success') {
            resolve(message);
          }
        });

        ws.on('error', reject);

        setTimeout(() => reject(new Error('WebSocket auth timeout')), 5000);
      });

      expect(authMessage).toMatchObject({
        type: 'auth_success',
        data: expect.objectContaining({
          userId: userInfo.id,
          role: userInfo.role,
        }),
      });

      ws.close();
    });

    test('should handle real-time request updates', async () => {
      const wsUrl = `ws://localhost:3001/ws?token=${userToken}`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      // Create request via HTTP API
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 98765,
          title: 'WebSocket Test Show',
          seasons: [1, 2],
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Should receive WebSocket notification
      const wsMessage = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'media_request_created') {
            resolve(message);
          }
        });

        setTimeout(() => reject(new Error('WebSocket message timeout')), 3000);
      });

      expect(wsMessage).toMatchObject({
        type: 'media_request_created',
        data: expect.objectContaining({
          requestId,
          userId: userInfo.id,
          status: 'pending',
        }),
      });

      // Admin approves request
      await request(app)
        .put(`/api/v1/admin/requests/${requestId}/approve`)
        .send({ notes: 'WebSocket test approval' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should receive approval notification
      const approvalMessage = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'media_request_approved') {
            resolve(message);
          }
        });

        setTimeout(() => reject(new Error('Approval message timeout')), 3000);
      });

      expect(approvalMessage).toMatchObject({
        type: 'media_request_approved',
        data: expect.objectContaining({
          requestId,
          status: 'approved',
          approvedBy: adminInfo.id,
        }),
      });

      ws.close();
    });

    test('should handle WebSocket disconnection and reconnection', async () => {
      const wsUrl = `ws://localhost:3001/ws?token=${userToken}`;

      // Initial connection
      let ws = new WebSocket(wsUrl);
      await new Promise((resolve) => ws.on('open', resolve));

      // Simulate disconnection
      ws.close();

      // Reconnect
      ws = new WebSocket(wsUrl);

      const reconnectMessage = await new Promise((resolve, reject) => {
        ws.on('open', () => {
          // Send ping to verify connection
          ws.send(JSON.stringify({ type: 'ping' }));
        });

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            resolve(message);
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('Reconnection timeout')), 3000);
      });

      expect(reconnectMessage).toMatchObject({
        type: 'pong',
        timestamp: expect.any(String),
      });

      ws.close();
    });
  });

  describe('File Upload Integration', () => {
    test('should handle media file uploads correctly', async () => {
      // Create test file
      const testFilePath = path.join(__dirname, '../fixtures/test-media.jpg');
      const testContent = Buffer.from('fake-image-content');
      await fs.writeFile(testFilePath, testContent);

      // Upload file
      const form = new FormData();
      form.append('file', testContent, {
        filename: 'test-media.jpg',
        contentType: 'image/jpeg',
      });
      form.append('mediaType', 'movie');
      form.append('tmdbId', '12345');

      const uploadResponse = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', `multipart/form-data; boundary=${form.getBoundary()}`)
        .send(form.getBuffer())
        .expect(200);

      expect(uploadResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          fileId: expect.any(String),
          filename: 'test-media.jpg',
          size: expect.any(Number),
          url: expect.any(String),
        }),
      });

      // Verify file can be downloaded
      const downloadResponse = await request(app)
        .get(`/api/v1/media/download/${uploadResponse.body.data.fileId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(downloadResponse.headers['content-type']).toBe('image/jpeg');
      expect(downloadResponse.body).toBeTruthy();

      // Cleanup
      await fs.unlink(testFilePath).catch(() => {});
    });

    test('should validate file uploads correctly', async () => {
      // Test file size limit
      const largeFakeContent = Buffer.alloc(100 * 1024 * 1024); // 100MB

      const form = new FormData();
      form.append('file', largeFakeContent, {
        filename: 'too-large.jpg',
        contentType: 'image/jpeg',
      });

      const sizeErrorResponse = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', `multipart/form-data; boundary=${form.getBoundary()}`)
        .send(form.getBuffer())
        .expect(400);

      expect(sizeErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'FILE_TOO_LARGE',
          message: expect.stringMatching(/file.*too large/i),
        }),
      });

      // Test invalid file type
      const textForm = new FormData();
      textForm.append('file', 'text content', {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

      const typeErrorResponse = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', `multipart/form-data; boundary=${textForm.getBoundary()}`)
        .send(textForm.getBuffer())
        .expect(400);

      expect(typeErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_FILE_TYPE',
          message: expect.stringMatching(/file type.*not supported/i),
        }),
      });
    });

    test('should handle upload progress and cancellation', async () => {
      // This test would typically involve streaming uploads
      // For now, we'll test the upload metadata handling

      const testContent = Buffer.alloc(1024 * 1024); // 1MB
      const form = new FormData();
      form.append('file', testContent, {
        filename: 'progress-test.jpg',
        contentType: 'image/jpeg',
      });

      const startTime = Date.now();

      const uploadResponse = await request(app)
        .post('/api/v1/media/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', `multipart/form-data; boundary=${form.getBoundary()}`)
        .send(form.getBuffer())
        .expect(200);

      const uploadTime = Date.now() - startTime;

      expect(uploadResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          filename: 'progress-test.jpg',
          size: 1024 * 1024,
          uploadTime: expect.any(Number),
        }),
      });

      // Upload should complete within reasonable time
      expect(uploadTime).toBeLessThan(10000); // 10 seconds
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent API requests efficiently', async () => {
      const concurrentCount = 20;
      const requests = Array.from({ length: concurrentCount }, (_, i) =>
        request(app)
          .get('/api/v1/media/search')
          .query({ query: `concurrent-${i}`, page: 1 })
          .set('Authorization', `Bearer ${userToken}`),
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds for 20 requests
      const avgTime = totalTime / concurrentCount;
      expect(avgTime).toBeLessThan(500); // Average 500ms per request

      console.log(
        `Concurrent requests completed: ${concurrentCount} requests in ${totalTime}ms (avg: ${avgTime}ms)`,
      );
    });

    test('should maintain response times under load', async () => {
      const loadTestRounds = 5;
      const requestsPerRound = 10;

      const roundTimes = [];

      for (let round = 0; round < loadTestRounds; round++) {
        const roundRequests = Array.from({ length: requestsPerRound }, () =>
          request(app).get('/api/v1/media/requests').set('Authorization', `Bearer ${userToken}`),
        );

        const roundStart = Date.now();
        const roundResponses = await Promise.all(roundRequests);
        const roundTime = Date.now() - roundStart;

        roundTimes.push(roundTime);

        // Verify all responses are successful
        roundResponses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
      }

      // Calculate performance metrics
      const avgRoundTime = roundTimes.reduce((sum, time) => sum + time, 0) / loadTestRounds;
      const maxRoundTime = Math.max(...roundTimes);
      const minRoundTime = Math.min(...roundTimes);

      // Performance should be consistent
      expect(avgRoundTime).toBeLessThan(3000); // 3 seconds average
      expect(maxRoundTime).toBeLessThan(5000); // 5 seconds max

      // Variance shouldn't be too high (max shouldn't be more than 3x min)
      expect(maxRoundTime).toBeLessThan(minRoundTime * 3);

      console.log(
        `Load test results: avg=${avgRoundTime}ms, min=${minRoundTime}ms, max=${maxRoundTime}ms`,
      );
    });

    test('should handle memory usage efficiently during operations', async () => {
      // Monitor memory usage during operations
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          request(app)
            .get('/api/v1/media/search')
            .query({ query: `memory-test-${i}`, pageSize: 50 })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Memory usage shouldn't increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);

      console.log(
        `Memory usage: ${memoryIncreasePercent.toFixed(2)}% increase (${(memoryIncrease / 1024 / 1024).toFixed(2)}MB)`,
      );
    });
  });
});
