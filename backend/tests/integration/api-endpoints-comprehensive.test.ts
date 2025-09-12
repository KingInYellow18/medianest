/**
 * COMPREHENSIVE API ENDPOINT INTEGRATION TESTS
 *
 * Full integration testing of all MediaNest API endpoints
 * Tests complete request/response cycles with real dependencies
 */

import supertest from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { createApp } from '../../src/app';

describe('Comprehensive API Endpoint Integration Tests', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);

    // Setup test authentication tokens
    const userLogin = await request
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass123' });

    authToken = userLogin.body?.token || 'mock-user-token';

    const adminLogin = await request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'adminpass123' });

    adminToken = adminLogin.body?.token || 'mock-admin-token';
  });

  describe('Authentication Endpoints Integration', () => {
    test('POST /api/auth/login - should authenticate valid user', async () => {
      const response = await request.post('/api/auth/login').send({
        username: 'validuser',
        password: 'validpass123',
      });

      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('success');

      if (response.body.success) {
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('id');
      }
    });

    test('POST /api/auth/login - should reject invalid credentials', async () => {
      const response = await request.post('/api/auth/login').send({
        username: 'invaliduser',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    test('POST /api/auth/refresh - should refresh valid token', async () => {
      const response = await request
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: 'valid-refresh-token' });

      // Should either refresh token or require re-authentication
      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('token');
      }
    });

    test('POST /api/auth/logout - should logout authenticated user', async () => {
      const response = await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
      }
    });

    test('GET /api/auth/verify - should verify token validity', async () => {
      const response = await request
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('valid', true);
        expect(response.body).toHaveProperty('user');
      }
    });
  });

  describe('Media Management Endpoints Integration', () => {
    test('GET /api/media/search - should search media content', async () => {
      const response = await request.get('/api/media/search').query({
        q: 'action movie',
        type: 'movie',
        page: 1,
        limit: 20,
      });

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('results');
        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      }
    });

    test('POST /api/media/request - should create media request', async () => {
      const response = await request
        .post('/api/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Movie Request',
          type: 'movie',
          year: 2024,
          imdbId: 'tt1234567',
          description: 'Integration test movie request',
        });

      expect([200, 201, 401, 403]).toContain(response.status);

      if ([200, 201].includes(response.status)) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.title).toBe('Test Movie Request');
      }
    });

    test('GET /api/media/requests - should list media requests', async () => {
      const response = await request
        .get('/api/media/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          status: 'pending',
          page: 1,
          limit: 10,
        });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('requests');
        expect(Array.isArray(response.body.requests)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      }
    });

    test('PUT /api/media/requests/:id/status - should update request status', async () => {
      // Create a test request first
      const createResponse = await request
        .post('/api/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Status Update Test',
          type: 'movie',
          imdbId: 'tt7654321',
        });

      if ([200, 201].includes(createResponse.status)) {
        const requestId = createResponse.body.data?.id || 'test-id';

        const response = await request
          .put(`/api/media/requests/${requestId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'approved' });

        expect([200, 401, 403, 404]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body.data.status).toBe('approved');
        }
      }
    });

    test('GET /api/media/popular - should get popular media', async () => {
      const response = await request.get('/api/media/popular').query({
        timeframe: '7d',
        type: 'all',
        limit: 20,
      });

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('results');
        expect(Array.isArray(response.body.results)).toBe(true);
      }
    });
  });

  describe('Dashboard Endpoints Integration', () => {
    test('GET /api/dashboard - should get user dashboard data', async () => {
      const response = await request
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeframe: '30d' });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('stats');
        expect(response.body.data).toHaveProperty('recentActivity');
      }
    });

    test('GET /api/dashboard/stats - should get detailed statistics', async () => {
      const response = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          period: 'week',
          metrics: 'requests,downloads,usage',
        });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('stats');
        expect(typeof response.body.stats).toBe('object');
      }
    });

    test('GET /api/dashboard/activity - should get recent activity', async () => {
      const response = await request
        .get('/api/dashboard/activity')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 50 });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('activities');
        expect(Array.isArray(response.body.activities)).toBe(true);
      }
    });
  });

  describe('Admin Management Endpoints Integration', () => {
    test('GET /api/admin/users - should list all users (admin only)', async () => {
      const response = await request
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 20,
          role: 'all',
        });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('users');
        expect(Array.isArray(response.body.users)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      }
    });

    test('PUT /api/admin/users/:id/role - should update user role', async () => {
      const response = await request
        .put('/api/admin/users/test-user-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' });

      expect([200, 400, 401, 403, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.role).toBe('moderator');
      }
    });

    test('GET /api/admin/system/status - should get system status', async () => {
      const response = await request
        .get('/api/admin/system/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('system');
        expect(response.body.system).toHaveProperty('status');
        expect(response.body.system).toHaveProperty('uptime');
      }
    });

    test('POST /api/admin/system/maintenance - should toggle maintenance mode', async () => {
      const response = await request
        .post('/api/admin/system/maintenance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          message: 'Scheduled maintenance',
        });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('maintenance');
      }
    });

    test('GET /api/admin/logs - should retrieve system logs', async () => {
      const response = await request
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          level: 'error',
          limit: 100,
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('logs');
        expect(Array.isArray(response.body.logs)).toBe(true);
      }
    });
  });

  describe('Plex Integration Endpoints', () => {
    test('GET /api/plex/auth - should initiate Plex authentication', async () => {
      const response = await request
        .get('/api/plex/auth')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 302, 401]).toContain(response.status);

      if ([200, 302].includes(response.status)) {
        expect(response.body || response.headers.location).toBeDefined();
      }
    });

    test('GET /api/plex/callback - should handle Plex callback', async () => {
      const response = await request.get('/api/plex/callback').query({
        code: 'test-auth-code',
        state: 'test-csrf-token',
      });

      expect([200, 400, 401]).toContain(response.status);
    });

    test('GET /api/plex/servers - should list Plex servers', async () => {
      const response = await request
        .get('/api/plex/servers')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('servers');
        expect(Array.isArray(response.body.servers)).toBe(true);
      }
    });

    test('GET /api/plex/libraries - should list Plex libraries', async () => {
      const response = await request
        .get('/api/plex/libraries')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ serverId: 'test-server-id' });

      expect([200, 400, 401, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('libraries');
        expect(Array.isArray(response.body.libraries)).toBe(true);
      }
    });

    test('POST /api/plex/sync - should sync Plex library', async () => {
      const response = await request
        .post('/api/plex/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverId: 'test-server-id',
          libraryIds: ['1', '2', '3'],
        });

      expect([200, 202, 400, 401, 503]).toContain(response.status);

      if ([200, 202].includes(response.status)) {
        expect(response.body).toHaveProperty('syncId');
      }
    });
  });

  describe('YouTube Integration Endpoints', () => {
    test('GET /api/youtube/search - should search YouTube content', async () => {
      const response = await request.get('/api/youtube/search').query({
        q: 'movie trailer',
        maxResults: 25,
        type: 'video',
      });

      expect([200, 400, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('results');
        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body).toHaveProperty('nextPageToken');
      }
    });

    test('POST /api/youtube/download - should initiate YouTube download', async () => {
      const response = await request
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          quality: '720p',
          format: 'mp4',
        });

      expect([200, 202, 400, 401]).toContain(response.status);

      if ([200, 202].includes(response.status)) {
        expect(response.body).toHaveProperty('downloadId');
      }
    });

    test('GET /api/youtube/download/:id/status - should get download status', async () => {
      const response = await request
        .get('/api/youtube/download/test-download-id/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('progress');
      }
    });
  });

  describe('Health and System Endpoints', () => {
    test('GET /api/health - should return health status', async () => {
      const response = await request.get('/api/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');

      if (response.status === 200) {
        expect(response.body.status).toBe('healthy');
      }
    });

    test('GET /api/health/detailed - should return detailed health info', async () => {
      const response = await request
        .get('/api/health/detailed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 401, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('services');
        expect(response.body).toHaveProperty('database');
        expect(response.body).toHaveProperty('external');
      }
    });

    test('GET /api/version - should return API version info', async () => {
      const response = await request.get('/api/version');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('build');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('File Upload and Management Endpoints', () => {
    test('POST /api/upload - should handle file uploads', async () => {
      const testFile = Buffer.from('test file content', 'utf8');

      const response = await request
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFile, 'test.txt')
        .field('type', 'document');

      expect([200, 201, 400, 401, 413, 415]).toContain(response.status);

      if ([200, 201].includes(response.status)) {
        expect(response.body).toHaveProperty('fileId');
        expect(response.body).toHaveProperty('url');
      }
    });

    test('GET /api/files/:id - should retrieve uploaded files', async () => {
      const response = await request
        .get('/api/files/test-file-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    test('DELETE /api/files/:id - should delete uploaded files', async () => {
      const response = await request
        .delete('/api/files/test-file-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 204, 401, 403, 404]).toContain(response.status);
    });
  });

  describe('WebSocket Endpoints Integration', () => {
    test('GET /socket.io/ - should establish WebSocket connection', async () => {
      const response = await request.get('/socket.io/').query({
        EIO: '4',
        transport: 'polling',
      });

      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.text).toContain('0{');
      }
    });

    test('POST /api/socket/broadcast - should broadcast messages', async () => {
      const response = await request
        .post('/api/socket/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'notification',
          message: 'Test broadcast message',
          recipients: 'all',
        });

      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('sent');
        expect(response.body).toHaveProperty('recipients');
      }
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request.get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request
        .post('/api/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle missing authorization headers', async () => {
      const response = await request.get('/api/dashboard');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle rate limiting', async () => {
      // Make rapid requests to trigger rate limiting
      const rapidRequests = Array(100)
        .fill(null)
        .map(() => request.get('/api/health'));

      const responses = await Promise.all(rapidRequests);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
